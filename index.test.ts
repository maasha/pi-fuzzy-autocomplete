import { describe, it } from "node:test";
import assert from "node:assert";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractAtPrefix, createFuzzyAutocompleteProvider } from "./index.ts";

describe("extension provider logic", () => {
  it("extracts @-prefix correctly", () => {
    assert.strictEqual(extractAtPrefix("@reme"), "reme");
    assert.strictEqual(extractAtPrefix("foo @src ctrl"), "src ctrl");
    assert.strictEqual(extractAtPrefix("foo bar"), undefined);
    assert.strictEqual(extractAtPrefix("@"), "");
    assert.strictEqual(extractAtPrefix("  @user"), "user");
  });

  it("delegates non-@ tokens to underlying provider", async () => {
    let delegated = false;
    const current = {
      async getSuggestions() {
        delegated = true;
        return { items: [{ value: "test", label: "test" }], prefix: "" };
      },
      applyCompletion() {
        return { lines: [], cursorLine: 0, cursorCol: 0 };
      },
      shouldTriggerFileCompletion() {
        return true;
      },
    };

    const mockPi = {
      exec: async () => ({ code: 0, stdout: "", stderr: "" }),
    } as any;

    const provider = createFuzzyAutocompleteProvider(current, mockPi, "/tmp");
    const result = await provider.getSuggestions(["/reload"], 0, 7, {
      signal: new AbortController().signal,
    });
    assert.ok(delegated);
    assert.ok(result);
  });

  it("falls back to built-in provider when file discovery fails", async () => {
    let delegated = false;
    const current = {
      async getSuggestions() {
        delegated = true;
        return { items: [{ value: "fallback", label: "fallback" }], prefix: "" };
      },
      applyCompletion() {
        return { lines: [], cursorLine: 0, cursorCol: 0 };
      },
      shouldTriggerFileCompletion() {
        return true;
      },
    };

    const mockPi = {
      exec: async () => {
        throw new Error("no fd");
      },
    } as any;

    const provider = createFuzzyAutocompleteProvider(current, mockPi, "/tmp");
    const result = await provider.getSuggestions(["@foo"], 0, 4, {
      signal: new AbortController().signal,
    });
    assert.ok(delegated);
    assert.ok(result);
  });

  it("filters discovered files via .fuzzignore", async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), "fuzz-"));
    try {
      await fs.writeFile(
        join(dir, ".fuzzignore"),
        "# skip generated output\nbuild/\n*.gen.ts\n"
      );

      const execCalls: string[][] = [];
      const mockPi = {
        exec: async (cmd: string, args: string[]) => {
          execCalls.push(args);
          if (cmd === "fd" || cmd === "fdfind") {
            throw new Error("no fd");
          }
          return {
            code: 0,
            stdout: ["./src/app.ts", "./src/app.gen.ts", "./build/out.js"].join("\n"),
            stderr: "",
          };
        },
      } as any;

      const current = {
        async getSuggestions() {
          return null;
        },
        applyCompletion() {
          return { lines: [], cursorLine: 0, cursorCol: 0 };
        },
        shouldTriggerFileCompletion() {
          return true;
        },
      };

      const provider = createFuzzyAutocompleteProvider(current, mockPi, dir);
      const result = await provider.getSuggestions(["@"], 0, 1, {
        signal: new AbortController().signal,
      });
      assert.ok(result);
      const values = result!.items.map((i) => i.value);
      assert.deepStrictEqual(values, ["src/app.ts"]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("does not consult .gitignore — only .fuzzignore is used", async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), "fuzz-"));
    try {
      // dist/ is ignored by git, but there is no .fuzzignore — so it
      // must still appear in the results.
      await fs.writeFile(join(dir, ".gitignore"), "dist/\n");

      const mockPi = {
        exec: async (cmd: string, args: string[]) => {
          if (cmd === "fd" || cmd === "fdfind") throw new Error("no fd");
          return {
            code: 0,
            stdout: ["./main.py", "./dist/bundle.js"].join("\n"),
            stderr: "",
          };
        },
      } as any;

      const current = {
        async getSuggestions() {
          return null;
        },
        applyCompletion() {
          return { lines: [], cursorLine: 0, cursorCol: 0 };
        },
        shouldTriggerFileCompletion() {
          return true;
        },
      };

      const provider = createFuzzyAutocompleteProvider(current, mockPi, dir);
      const result = await provider.getSuggestions(["@"], 0, 1, {
        signal: new AbortController().signal,
      });
      assert.ok(result);
      const values = result!.items.map((i) => i.value);
      assert.deepStrictEqual(values, ["dist/bundle.js", "main.py"]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
