# Fuzzy Autocomplete — Pi Extension

A [Pi](https://github.com/earendil-works/pi) extension that replaces the built-in `@` file-autocomplete with a VS Code Quick Open–style fuzzy scorer.

> 💻 **Vibe coded** with the [`moonshotai/kimi-k2.6`](https://huggingface.co/moonshotai/kimi-k2.6) model. Every line of TypeScript was written, tested, and refined through collaborative prompting — no manual coding required.

## Install

### From git (recommended)

Install permanently from this repository:

```bash
pi install git:github.com/maasha/pi-fuzzy-autocomplete
```

Or try it once without installing:

```bash
pi -e git:github.com/maasha/pi-fuzzy-autocomplete
```

### From a local path

Clone the repo and load the extension directly:

```bash
git clone https://github.com/maasha/pi-fuzzy-autocomplete.git
pi --extension ./pi-fuzzy-autocomplete
```

Or add it to your project's Pi settings:

```json
{
  "packages": [
    {
      "source": "./pi-fuzzy-autocomplete"
    }
  ]
}
```

No build step is required.

## What it does

When you type `@` followed by a query in Pi's input box, this extension searches all files in the current project and ranks them with a fuzzy match algorithm. Results are highlighted in bold so you can see *which characters* matched.

| Query | Matches | Why |
|-------|---------|-----|
| `@reme` | `README.md` | `R…E…M…E` (non-contiguous subsequence) |
| `@usrctrl` | `src/user/controller.ts` | `usr` → `user`, `ctrl` → `controller` |
| `@src "controller.ts"` | `src/user/controller.ts` | Exact token `"controller.ts"` + fuzzy `src` |
| `@tset` | `tokenizer.test.ts` | `t…s…e…t` across words and case boundaries |

## Examples

### Typo-tolerant file search

You have this project layout:

```
├── README.md
├── package.json
├── src/
│   ├── tokenizer.ts
│   └── index.ts
└── tests/
    └── tokenizer.test.ts
```

You want the tokenizer test file but your fingers slip:

```
@toknizertest
```

**Result:** `tests/tokenizer.test.ts` still ranks on top — the scorer tolerates the missing `e`.

---

### Navigating deeply nested code

```
├── src/
│   ├── user/
│   │   └── controller.ts
│   ├── admin/
│   │   └── controller.ts
│   └── shared/
│       └── utils.ts
```

Type:

```
@usrctrl
```

**Result:** `src/user/controller.ts` ranks highest — matches at word starts score higher, and shallower paths win ties.

---

### Filtering by exact filename across directories

```
├── api/
│   └── controller.ts
├── web/
│   └── controller.ts
└── mobile/
    └── controller.ts
```

You want only the `web` controller:

```
@web "controller.ts"
```

**Result:** `web/controller.ts` — the only path containing both `web` and an exact `controller.ts`.

---

### Consecutive-character priority

Given two files:
- `fuzzy-score.ts`
- `file-for-you-to-see.ts`

Type:

```
@fuzzy
```

**Result:** `fuzzy-score.ts` wins — consecutive matches rank above scattered ones.

---

### CamelCase boundary matching

```
├── src/
│   ├── fileDialog.ts
│   └── filedialog.test.ts
```

Type:

```
@fD
```

**Result:** `src/fileDialog.ts` ranks above `src/filedialog.test.ts` — the `f` → `D` case boundary is a strong signal.

---

### Multi-token narrowing

```
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   └── Modal.tsx
│   └── pages/
│       ├── Home.tsx
│       └── About.tsx
```

Type:

```
@comp btn
```

**Result:** `src/components/Button.tsx` — every token must match for a file to appear.

## Features

### Multi-Token Queries (AND Semantics)

Separate tokens with spaces. Every token must match for a file to appear:

```
@user ctrl
```

Finds files matching `user` **and** `ctrl` — great for narrowing by directory and filename at once.

### Quoted Exact Tokens

Wrap a token in quotes to require an exact (case-sensitive) substring match instead of fuzzy matching:

```
@src "controller.ts"
```

`src` still matches fuzzily, but `controller.ts` must appear exactly as written.

### Path-Aware Matching

If a token contains `/` or `\`, matches in directory segments are weighted more heavily, so `@src/con` strongly prefers `src/controller.ts`.

### Ignoring Noisy Directories

A handful of directories are always skipped (`.git/`, `.mypy_cache/`, `__pycache__/`, `node_modules/`). To control anything beyond that, add a **`.fuzzignore`** file to your project root using `.gitignore`-style patterns:

```gitignore
# .fuzzignore — skip generated output
build/
*.gen.ts
dist...
!dist/keep.txt
```

Supported syntax:

| Syntax | Meaning |
|--------|---------|
| `# comment` | Blank lines and `#` comments are ignored |
| `!pattern` | Negate — un-ignore a path (last matching pattern wins) |
| `dir/` | Trailing `/` — match a directory at any depth (and everything under it) |
| `/pattern` | Leading `/` — anchor to the project root |
| `name` | Bare name — match a path segment at any depth |
| `*` | Zero or more characters (never crosses `/`) |
| `?` | Exactly one character |
| `**` | Zero or more path segments (e.g. `logs/**`) |
| `path...` | Trailing `...` — match the named path and everything under it |

Examples of what each line does:

- `build/` — skips `build/x.js` and `packages/x/build/x.js`
- `*.gen.ts` — skips `src/app.gen.ts` anywhere
- `dist...` — skips the entire `dist/` subtree
- `!dist/keep.txt` — keeps a specific file inside an otherwise ignored directory

No `.fuzzignore` is required — the built-in exclusions keep suggestions clean for most projects.

## Development

Run the test suite:

```bash
npx tsx --test
```

## License

MIT
