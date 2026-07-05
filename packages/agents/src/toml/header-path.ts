/**
 * Parse a TOML table header line (e.g. `[mcp_servers.filesystem]` or
 * `[mcp_servers."foo bar".baz]`) into the ordered path segments it
 * names.
 *
 * Handles both bare keys (`[A-Za-z0-9_-]`) and quoted segments (single
 * or double quotes), with escape sequences (`\"`, `\'`) inside quoted
 * segments. Does NOT perform TOML-string unescaping; quoted segments
 * are returned as their raw inner slice and must be interpreted by
 * the caller only when it actually matters (smol-toml does the
 * canonical decoding inside the parsed object).
 *
 * Returns `null` for any malformed input:
 * - missing or mismatched `[…]` brackets,
 * - unterminated quote segment,
 * - bare-key segment of zero characters,
 * - an unexpected character between segments,
 * - an empty segment list.
 *
 * Single source of truth for both the openai-codex writer and the
 * writer-preservation harness; kept here so the two cannot drift.
 */
export function parseTomlHeaderPath(line: string): readonly string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const inner = trimmed.slice(1, -1);
  const segments: string[] = [];
  let i = 0;
  while (i < inner.length) {
    // Skip whitespace between segments.
    while (i < inner.length && (inner[i] === ' ' || inner[i] === '\t')) i++;
    if (i >= inner.length) break;
    const ch = inner[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i + 1;
      let j = start;
      while (j < inner.length && inner[j] !== quote) {
        if (inner[j] === '\\' && j + 1 < inner.length) j += 2;
        else j++;
      }
      if (j >= inner.length) return null; // unterminated quote
      segments.push(inner.slice(start, j));
      i = j + 1;
    } else {
      // Bare key: letters, digits, '-', '_'.
      const start = i;
      while (i < inner.length && /[A-Za-z0-9_-]/.test(inner[i] ?? '')) {
        i++;
      }
      if (i === start) return null; // bare key has zero chars
      segments.push(inner.slice(start, i));
    }
    // After a segment, expect either '.' (more segments) or end-of-header.
    if (i < inner.length) {
      if (inner[i] === '.') i++;
      else return null; // unexpected character between segments
    }
  }
  if (segments.length === 0) return null;
  return segments;
}
