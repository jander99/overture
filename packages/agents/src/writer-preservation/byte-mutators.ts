/**
 * Byte-level test helpers for the writer preservation harness.
 *
 * These mutators take a config file's raw bytes and produce a
 * deliberately-broken copy: comments stripped, keys swapped, top-level
 * keys deleted, MCP servers removed, indentation drifted, trailing
 * newlines removed, or arbitrary suffixes appended. The harness
 * self-tests use these to prove each individual preservation check
 * fires when a future writer regresses.
 *
 * All mutators preserve parseability of the resulting bytes — a
 * regression check that fails with a parse error is a different bug
 * than a preservation check that fails with a byte diff.
 *
 * JSON/JSONC mutators use a JSON-aware byte scanner that locates
 * top-level key ranges by pattern-matching `"key":` and walking braces
 * to find the value's end. This preserves comments and formatting
 * outside the modified region, so each mutator only breaks the
 * intended property.
 *
 * TOML mutators use line-based manipulation because `smol-toml` does
 * not expose a serializer (we cannot round-trip through
 * parse+stringify without losing comments and formatting).
 */
import type { McpLocationFormat } from '../types.js';

/**
 * Strip every comment run from the input. JSONC supports both
 * `// line` and `/* block *​/` comments; TOML and YAML support
 * `# line` comments. JSON has no comments and the input is returned
 * unchanged.
 *
 * Comment runs are removed entirely (not replaced with whitespace),
 * so the resulting string may be shorter than the input. String
 * literals are preserved verbatim — a `//`, `/*`, or `#` inside a
 * JSON string is NOT a comment.
 */
export function stripComments(text: string, format: McpLocationFormat): string {
  if (format === 'json') return text;
  if (format === 'jsonc') return stripJsoncComments(text);
  if (format === 'toml' || format === 'yaml') return stripHashComments(text);
  return text;
}

/**
 * Remove a top-level key (and its value, including any nested object/
 * array/scalar) from the document. For JSON/JSONC, the key is a JSON
 * object property; for TOML, the key is either a top-level scalar
 * (`key = value`), an explicit table header (`[key]`), or implicit
 * parent table defined by subtables (`[key.child]`).
 *
 * Returns the input unchanged if the key is not present.
 */
export function deleteTopLevelKey(
  text: string,
  format: McpLocationFormat,
  key: string,
): string {
  if (format === 'json' || format === 'jsonc') {
    return deleteJsonTopLevelKey(text, key);
  }
  if (format === 'toml') {
    return deleteTomlTopLevelKey(text, key);
  }
  return text;
}

/**
 * Remove a named MCP server from the `mcpKey` subtree (e.g. `mcp`,
 * `mcpServers`, `mcp_servers`). Returns the input unchanged if the
 * server is not present.
 */
export function deleteMcpServer(
  text: string,
  format: McpLocationFormat,
  mcpKey: string,
  serverName: string,
): string {
  if (format === 'json' || format === 'jsonc') {
    return deleteJsonMcpServer(text, mcpKey, serverName);
  }
  if (format === 'toml') {
    return deleteTomlMcpServer(text, mcpKey, serverName);
  }
  return text;
}

/**
 * Swap two top-level keys (and their values). Returns the input
 * unchanged if either key is not present.
 */
export function swapTopLevelKeys(
  text: string,
  format: McpLocationFormat,
  keyA: string,
  keyB: string,
): string {
  if (format === 'json' || format === 'jsonc') {
    return swapJsonTopLevelKeys(text, keyA, keyB);
  }
  if (format === 'toml') {
    return swapTomlTopLevelKeys(text, keyA, keyB);
  }
  return text;
}

/**
 * Swap two named MCP servers within the `mcpKey` subtree. Returns
 * the input unchanged if either server is not present.
 */
export function swapMcpServers(
  text: string,
  format: McpLocationFormat,
  mcpKey: string,
  serverA: string,
  serverB: string,
): string {
  if (format === 'json' || format === 'jsonc') {
    return swapJsonMcpServers(text, mcpKey, serverA, serverB);
  }
  if (format === 'toml') {
    return swapTomlMcpServers(text, mcpKey, serverA, serverB);
  }
  return text;
}

/**
 * Shift every line's leading whitespace by `delta` spaces (positive
 * or negative). Lines with no leading whitespace are left unchanged.
 * Trailing whitespace is preserved.
 */
export function driftIndentation(text: string, delta: number): string {
  if (delta === 0) return text;
  const lines = text.split('\n');
  const shifted = lines.map((line) => {
    if (delta > 0) {
      return ' '.repeat(delta) + line;
    }
    let removed = 0;
    while (removed < -delta && removed < line.length && line[removed] === ' ') {
      removed++;
    }
    return line.slice(removed);
  });
  return shifted.join('\n');
}

/**
 * Remove the trailing newline from the input. No-op if the input
 * already has no trailing newline.
 */
export function deleteTrailingNewline(text: string): string {
  if (text.endsWith('\n')) return text.slice(0, -1);
  return text;
}

/**
 * Append `suffix` to the input verbatim. Used to break idempotency:
 * if a future writer appends a trailing newline or signature on every
 * apply, this mutator simulates the second apply's output.
 */
export function appendString(text: string, suffix: string): string {
  return text + suffix;
}

// ---------------------------------------------------------------------------
// JSONC helpers (used for both `json` and `jsonc` formats — JSON is a
// strict subset of JSONC so the same parser and edit primitives work).
// ---------------------------------------------------------------------------

function stripJsoncComments(text: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  while (i < text.length) {
    const c = text[i];
    if (inString) {
      result += c;
      if (c === '\\' && i + 1 < text.length) {
        result += text[i + 1];
        i += 2;
        continue;
      }
      if (c === stringChar) {
        inString = false;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      result += c;
      i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        i++;
      }
      i += 2;
      continue;
    }
    result += c;
    i++;
  }
  return result;
}

function stripHashComments(text: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  while (i < text.length) {
    const c = text[i];
    if (inString) {
      result += c;
      if (c === '\\' && i + 1 < text.length) {
        result += text[i + 1];
        i += 2;
        continue;
      }
      if (c === stringChar) {
        inString = false;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      result += c;
      i++;
      continue;
    }
    if (c === '#') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    result += c;
    i++;
  }
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Given a position pointing at the start of a JSON value, return the
 * exclusive end offset of that value. Returns -1 on malformed input.
 */
function scanJsonValueEnd(text: string, start: number): number {
  if (start >= text.length) return -1;
  const c = text[start];
  if (c === '"' || c === "'") {
    let i = start + 1;
    while (i < text.length) {
      if (text[i] === '\\') {
        i += 2;
        continue;
      }
      if (text[i] === c) {
        return i + 1;
      }
      i++;
    }
    return -1;
  }
  if (c === '{' || c === '[') {
    const open = c;
    const close = c === '{' ? '}' : ']';
    let depth = 1;
    let i = start + 1;
    let inString = false;
    let stringChar = '';
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (inString) {
        if (ch === '\\') {
          i += 2;
          continue;
        }
        if (ch === stringChar) inString = false;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        i++;
        continue;
      }
      if (ch === open) depth++;
      else if (ch === close) depth--;
      i++;
    }
    return depth === 0 ? i : -1;
  }
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (
      ch === ' ' ||
      ch === '\t' ||
      ch === '\n' ||
      ch === '\r' ||
      ch === ',' ||
      ch === '}' ||
      ch === ']'
    ) {
      return i;
    }
    i++;
  }
  return i;
}

/**
 * Find a top-level JSON/JSONC property's byte range. Returns
 * `[startOffset, endOffset]` where `endOffset` is exclusive. The range
 * covers the property's key (including opening quote) and its value.
 * If the property is followed by a comma, the comma is included.
 * Returns `null` if the property is not present.
 */
function findJsonTopLevelRange(
  text: string,
  key: string,
): readonly [number, number] | null {
  // We intentionally do NOT call parseJsonc() here for validation:
  // jsonc-parser raises `InvalidCommentNoLine` on fragments whose
  // string literals contain `${...}` sequences (e.g. shell-style env
  // forwarders like "${CONTEXT7_API_KEY}"), even though those are
  // valid JSONC. The byte-mutator's job is to splice text ranges, not
  // to validate the document, so we rely on the regex-based key
  // search alone. Callers are expected to pass text that already
  // round-trips through jsonc-parser's `parse` (see checks.ts).
  const keyPattern = new RegExp(`"${escapeRegExp(key)}"\\s*:`, 'g');
  const match = keyPattern.exec(text);
  if (match === null) return null;
  const keyStart = match.index;
  let i = match.index + match[0].length;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) {
    i++;
  }
  if (i >= text.length) return null;
  const valueStart = i;
  const valueEnd = scanJsonValueEnd(text, valueStart);
  if (valueEnd === -1) return null;
  let j = valueEnd;
  while (
    j < text.length &&
    (text[j] === ' ' ||
      text[j] === '\t' ||
      text[j] === '\n' ||
      text[j] === '\r')
  ) {
    j++;
  }
  let endOffset = valueEnd;
  if (text[j] === ',') {
    endOffset = j + 1;
  }
  return [keyStart, endOffset] as const;
}

function deleteJsonTopLevelKey(text: string, key: string): string {
  const range = findJsonTopLevelRange(text, key);
  if (range === null) return text;
  const [start, end] = range;
  let result = text.slice(0, start) + text.slice(end);
  result = result.replace(/\n[ \t]*\n/g, '\n');
  return result;
}

function findJsonTopLevelRangeNoComma(
  text: string,
  key: string,
): readonly [number, number] | null {
  const range = findJsonTopLevelRange(text, key);
  if (range === null) return null;
  const [start, end] = range;
  if (text[end - 1] === ',') {
    return [start, end - 1] as const;
  }
  return range;
}

function swapJsonTopLevelKeys(
  text: string,
  keyA: string,
  keyB: string,
): string {
  // For swap, we must NOT include the trailing comma in either range,
  // otherwise the comma ends up in the wrong position and the swap
  // either no-ops or produces malformed JSON. `findJsonTopLevelRange`
  // includes the trailing comma for delete; here we strip it. The
  // comma at `aEnd` and `bEnd` is preserved naturally because
  // `text.slice(aEnd)` and `afterA.slice(newBEnd)` both start with the
  // original separator (comma + whitespace).
  const rangeA = findJsonTopLevelRangeNoComma(text, keyA);
  const rangeB = findJsonTopLevelRangeNoComma(text, keyB);
  if (rangeA === null || rangeB === null) return text;
  const [aStart, aEnd] = rangeA;
  const [bStart, bEnd] = rangeB;
  const blockA = text.slice(aStart, aEnd);
  const blockB = text.slice(bStart, bEnd);
  const afterA = text.slice(0, aStart) + blockB + text.slice(aEnd);
  const delta = blockB.length - (aEnd - aStart);
  const newBStart = bStart + delta;
  const newBEnd = bEnd + delta;
  return afterA.slice(0, newBStart) + blockA + afterA.slice(newBEnd);
}

function deleteJsonMcpServer(
  text: string,
  mcpKey: string,
  serverName: string,
): string {
  const mcpRange = findJsonTopLevelRange(text, mcpKey);
  if (mcpRange === null) return text;
  const [mcpStart, mcpEnd] = mcpRange;
  const mcpBlock = text.slice(mcpStart, mcpEnd);
  const braceIdx = mcpBlock.indexOf('{');
  if (braceIdx === -1) return text;
  const inner = mcpBlock.slice(braceIdx);
  const modifiedInner = deleteJsonTopLevelKey(inner, serverName);
  if (modifiedInner === inner) return text;
  const newMcpBlock = mcpBlock.slice(0, braceIdx) + modifiedInner;
  return text.slice(0, mcpStart) + newMcpBlock + text.slice(mcpEnd);
}

function swapJsonMcpServers(
  text: string,
  mcpKey: string,
  serverA: string,
  serverB: string,
): string {
  const mcpRange = findJsonTopLevelRange(text, mcpKey);
  if (mcpRange === null) return text;
  const [mcpStart, mcpEnd] = mcpRange;
  const mcpBlock = text.slice(mcpStart, mcpEnd);
  const braceIdx = mcpBlock.indexOf('{');
  if (braceIdx === -1) return text;
  const inner = mcpBlock.slice(braceIdx);
  const modifiedInner = swapJsonTopLevelKeys(inner, serverA, serverB);
  if (modifiedInner === inner) return text;
  const newMcpBlock = mcpBlock.slice(0, braceIdx) + modifiedInner;
  return text.slice(0, mcpStart) + newMcpBlock + text.slice(mcpEnd);
}

// ---------------------------------------------------------------------------
// TOML helpers (line-based; smol-toml does not expose a serializer).
// ---------------------------------------------------------------------------

function deleteTomlTopLevelKey(text: string, key: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;
  let removed = false;
  // In TOML, `[parent]` declares an explicit table. `[parent.child]`
  // declares a subtable that implicitly defines `parent`. Deleting
  // `parent` must remove both the explicit header and every subtable.
  const explicitTableRe = new RegExp(`^\\[${escapeRegExp(key)}\\]$`);
  const subtableRe = new RegExp(`^\\[${escapeRegExp(key)}\\.[^\\]]+\\]$`);
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const scalarMatch = new RegExp(`^${escapeRegExp(key)}\\s*=`).exec(line);
    if (scalarMatch !== null) {
      removed = true;
      i++;
      while (i < lines.length) {
        const next = lines[i] ?? '';
        if (next.trim() === '') {
          i++;
          continue;
        }
        if (next.trim().startsWith('[')) break;
        if (/^[A-Za-z_]/.test(next)) break;
        i++;
      }
      continue;
    }
    if (explicitTableRe.exec(line) !== null || subtableRe.exec(line) !== null) {
      removed = true;
      i++;
      while (i < lines.length) {
        const next = lines[i] ?? '';
        if (next.trim().startsWith('[')) break;
        i++;
      }
      continue;
    }
    out.push(line);
    i++;
  }
  if (!removed) return text;
  return out.join('\n');
}

function deleteTomlMcpServer(
  text: string,
  mcpKey: string,
  serverName: string,
): string {
  const lines = text.split('\n');
  const headerRe = new RegExp(
    `^\\[${escapeRegExp(mcpKey)}\\.${escapeRegExp(serverName)}\\]$`,
  );
  const out: string[] = [];
  let i = 0;
  let removed = false;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (headerRe.exec(line) !== null) {
      removed = true;
      i++;
      while (i < lines.length) {
        const next = lines[i] ?? '';
        if (next.trim().startsWith('[')) break;
        i++;
      }
      continue;
    }
    out.push(line);
    i++;
  }
  if (!removed) return text;
  return out.join('\n');
}

function swapTomlTopLevelKeys(
  text: string,
  keyA: string,
  keyB: string,
): string {
  const rangeA = findTomlTopLevelRange(text, keyA);
  const rangeB = findTomlTopLevelRange(text, keyB);
  if (rangeA === null || rangeB === null) return text;
  const [aStart, aEnd] = rangeA;
  const [bStart, bEnd] = rangeB;
  const blockA = text.slice(aStart, aEnd);
  const blockB = text.slice(bStart, bEnd);
  const afterA = text.slice(0, aStart) + blockB + text.slice(aEnd);
  const delta = blockB.length - (aEnd - aStart);
  const newBStart = bStart + delta;
  const newBEnd = bEnd + delta;
  return afterA.slice(0, newBStart) + blockA + afterA.slice(newBEnd);
}

function swapTomlMcpServers(
  text: string,
  mcpKey: string,
  serverA: string,
  serverB: string,
): string {
  const rangeA = findTomlSubtableRange(text, mcpKey, serverA);
  const rangeB = findTomlSubtableRange(text, mcpKey, serverB);
  if (rangeA === null || rangeB === null) return text;
  const [aStart, aEnd] = rangeA;
  const [bStart, bEnd] = rangeB;
  const blockA = text.slice(aStart, aEnd);
  const blockB = text.slice(bStart, bEnd);
  const afterA = text.slice(0, aStart) + blockB + text.slice(aEnd);
  const delta = blockB.length - (aEnd - aStart);
  const newBStart = bStart + delta;
  const newBEnd = bEnd + delta;
  return afterA.slice(0, newBStart) + blockA + afterA.slice(newBEnd);
}

function findTomlTopLevelRange(
  text: string,
  key: string,
): readonly [number, number] | null {
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineStart = offset;
    const lineEnd = offset + line.length + 1;
    offset = lineEnd;
    const scalarMatch = new RegExp(`^${escapeRegExp(key)}\\s*=`).exec(line);
    if (scalarMatch !== null) {
      let end = lineEnd;
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j] ?? '';
        if (next.trim() === '') {
          end += next.length + 1;
          j++;
          continue;
        }
        break;
      }
      return [lineStart, end] as const;
    }
    const tableMatch = new RegExp(`^\\[${escapeRegExp(key)}\\]$`).exec(line);
    if (tableMatch !== null) {
      let end = lineEnd;
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j] ?? '';
        if (next.trim().startsWith('[')) break;
        end += next.length + 1;
        j++;
      }
      return [lineStart, end] as const;
    }
  }
  return null;
}

function findTomlSubtableRange(
  text: string,
  parentKey: string,
  subKey: string,
): readonly [number, number] | null {
  const lines = text.split('\n');
  const headerRe = new RegExp(
    `^\\[${escapeRegExp(parentKey)}\\.${escapeRegExp(subKey)}\\]$`,
  );
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineStart = offset;
    const lineEnd = offset + line.length + 1;
    offset = lineEnd;
    if (headerRe.exec(line) !== null) {
      let end = lineEnd;
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j] ?? '';
        if (next.trim().startsWith('[')) break;
        end += next.length + 1;
        j++;
      }
      return [lineStart, end] as const;
    }
  }
  return null;
}
