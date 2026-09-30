// ─── .fuzzignore support ─────────────────────────────────────────────────────
//
// A minimal .gitignore-syntax parser used for the project-level `.fuzzignore`
// file. Supports:
//   - blank lines and `#` comments
//   - leading `!` negation (last matching pattern wins)
//   - trailing `/` (pattern matches directories only)
//   - leading `/` anchoring (pattern applies to the project root)
//   - `**` wildcards, `*` (no `/`), `?` (single char)
//   - trailing `...` — matches the named path and everything under it
//
// Unanchored patterns match any single path segment or the full relative
// path, mirroring how git applies unanchored ignore patterns.

export interface FuzzPattern {
  negated: boolean;
  dirOnly: boolean;
  anchored: boolean;
  /** Test a full relative path (no leading `./`). */
  matchFull(p: string): boolean;
  /** Test a single path segment (filename or directory name). */
  matchSegment(seg: string): boolean;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toRegex(pattern: string): RegExp {
  let out = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        out += ".*";
        i += 2;
        // `**/` collapses to match zero or more directory levels
        if (pattern[i] === "/") i += 1;
        continue;
      }
      out += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?") {
      out += "[^/]";
      i += 1;
      continue;
    }
    out += escapeRegex(c);
    i += 1;
  }
  return new RegExp("^" + out + "$");
}

/** Compile a single `.fuzzignore` line. Returns null for empty patterns. */
export function compileFuzzignore(raw: string): FuzzPattern | null {
  const negated = raw.startsWith("!");
  let p = negated ? raw.slice(1) : raw;

  // Trailing `...` — matches the named path and everything under it.
  let restMatch = false;
  if (p.endsWith("...")) {
    p = p.slice(0, -3);
    restMatch = true;
  }

  const dirOnly = p.endsWith("/");
  if (dirOnly) p = p.slice(0, -1);
  const anchored = p.startsWith("/");
  if (anchored) p = p.slice(1);
  if (p === "") return null;

  const re = toRegex(p);

  return {
    negated,
    dirOnly,
    anchored,
    matchFull: (path: string) =>
      restMatch ? path === p || path.startsWith(p + "/") : re.test(path),
    matchSegment: (seg: string) => !restMatch && re.test(seg),
  };}

/** Parse `.fuzzignore` file content into a list of patterns. */
export function parseFuzzignoreContent(content: string): FuzzPattern[] {
  const out: FuzzPattern[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const pattern = compileFuzzignore(line);
    if (pattern) out.push(pattern);
  }
  return out;
}

/**
 * Decide whether a relative path (no leading `./`) is ignored by the given
 * `.fuzzignore` patterns. The last matching pattern wins (negation-aware).
 */
export function isIgnored(relPath: string, patterns: FuzzPattern[]): boolean {
  if (patterns.length === 0) return false;
  const segments = relPath.split("/");
  const dirSegments = segments.slice(0, -1);
  let ignored = false;
  for (const pat of patterns) {
    let matched: boolean;
    if (pat.dirOnly) {
      // Directory-only patterns match intermediate path segments only.
      const pool = pat.anchored ? dirSegments.slice(0, 1) : dirSegments;
      matched = pool.some((s) => pat.matchSegment(s));
    } else if (pat.anchored) {
      // Root-anchored: single-segment patterns (e.g. `/dist`) bind to the
      // leading path segment; multi-segment patterns must match fully.
      matched = pat.matchFull(relPath) || pat.matchSegment(segments[0]);
    } else {
      matched = pat.matchFull(relPath) || segments.some((s) => pat.matchSegment(s));
    }
    if (matched) ignored = !pat.negated;
  }
  return ignored;
}
