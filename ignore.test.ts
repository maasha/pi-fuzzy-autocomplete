import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseFuzzignoreContent,
  isIgnored,
  type FuzzPattern,
} from "./ignore.ts";

function parse(content: string): FuzzPattern[] {
  return parseFuzzignoreContent(content);
}

describe("parseFuzzignoreContent", () => {
  it("skips blank lines and comments", () => {
    const p = parse("\n# comment\n\nnode_modules\n");
    assert.strictEqual(p.length, 1);
    assert.ok(isIgnored("node_modules/a.js", p));
  });

  it("handles negation", () => {
    const p = parse("*.log\n!important.log\n");
    assert.ok(isIgnored("debug.log", p));
    assert.ok(!isIgnored("important.log", p));
  });

  it("matches directory patterns with trailing slash anywhere", () => {
    const p = parse("build/\n");
    assert.ok(isIgnored("build/out.js", p));
    assert.ok(isIgnored("packages/x/build/out.js", p));
    // A file literally named "build" is not a directory match.
    assert.ok(!isIgnored("build", p));
  });

  it("matches a bare name as a path segment at any depth", () => {
    const p = parse("dist\n");
    assert.ok(isIgnored("dist/x.js", p));
    assert.ok(isIgnored("a/b/dist/x.js", p));
    assert.ok(!isIgnored("dist-tools/x.js", p));
  });

  it("handles anchored patterns", () => {
    const p = parse("/dist\n");
    assert.ok(isIgnored("dist/x.js", p));
    assert.ok(!isIgnored("a/dist/x.js", p));
  });

  it("supports * and ** globbing", () => {
    const p = parse("*.tmp\nlogs/**\n");
    assert.ok(isIgnored("scratch.tmp", p));
    assert.ok(isIgnored("deep/path/scratch.tmp", p));
    assert.ok(!isIgnored("scratch.tmp.bak", p));
    assert.ok(isIgnored("logs/a/b/c.log", p));
    assert.ok(isIgnored("logs/x.txt.done", p)); // ** matches everything inside
    assert.ok(!isIgnored("logs.old/x.txt", p));
  });

  it("supports ? single-char wildcard", () => {
    const p = parse("file?.txt\n");
    assert.ok(isIgnored("file1.txt", p));
    assert.ok(!isIgnored("file12.txt", p));
  });

  it("supports trailing ... rest-match", () => {
    const p = parse("scratch...\n");
    assert.ok(isIgnored("scratch/anything/here.js", p));
    assert.ok(!isIgnored("not-scratch/x.js", p));
  });

  it("last matching pattern wins", () => {
    const p = parse("*.log\n!keep.log\n*.log");
    assert.ok(isIgnored("keep.log", p)); // later *.log re-ignores
    const p2 = parse("*.log\n!keep.log");
    assert.ok(isIgnored("drop.log", p2));
    assert.ok(!isIgnored("keep.log", p2));
  });
});
