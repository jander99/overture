/**
 * Individual preservation checks for the writer preservation harness.
 *
 * Each check is a pure function: it takes the original bytes, the
 * written bytes, the required rewritten bytes (for idempotency), and
 * the targetPath the writer was allowed to mutate. It returns a
 * {@link PreservationCheckResult} with pass/fail and diagnostic details.
 *
 * The checks are format-aware. JSON/JSONC uses jsonc-parser for
 * structural comparisons; TOML uses smol-toml for structural parsing
 * and line-based manipulation for byte-level checks (because smol-toml
 * does not preserve comments or key order through parse).
 */
import {
  parse as parseJsonc,
  parseTree,
  type Node,
  type ParseError,
} from 'jsonc-parser/lib/esm/main.js';
import { createRequire } from 'node:module';

import type { McpLocationFormat } from '../types.js';
import type {
  PreservationCheckName,
  PreservationCheckResult,
  TargetPath,
} from './types.js';

const smolTomlCjsModule = createRequire(__filename)('smol-toml') as unknown as {
  parse: (text: string) => Record<string, unknown>;
};

/**
 * Determines which checks apply for a given format. JSONC and TOML add
 * the `comments` check; JSON skips it (JSON has no comments). YAML is
 * not yet supported by any E1 agent (opencode, claude-code,
 * copilot-cli, codex are JSON/JSONC/TOML only) and returns no
 * advertised checks. Every supported format runs the base set
 * (topLevelKeys, keyOrder, mcpServers, formatting) plus `rawBytes`
 * and `idempotency` (which are always invoked from `runPreservationChecks`).
 */
export function checksForFormat(
  format: McpLocationFormat,
): readonly PreservationCheckName[] {
  const base: PreservationCheckName[] = [
    'topLevelKeys',
    'keyOrder',
    'mcpServers',
    'formatting',
  ];
  if (format === 'json') return base;
  if (format === 'jsonc') return ['comments', ...base];
  if (format === 'toml') return ['comments', ...base];
  // YAML: no supported agent uses YAML yet (E1 scope = opencode, claude-code,
  // copilot-cli, codex). When a YAML agent is added (E4) this branch must
  // gain real checks. Until then, no checks are advertised so callers cannot
  // assume coverage they don't have.
  return [];
}

/**
 * Build the result of a skipped check — the check was not applicable
 * for this format (e.g. `comments` for JSON, or the target is the
 * whole document). The `details` field is empty and `pass` is true
 * (skipping is not a failure).
 */
export function skippedCheck(
  name: PreservationCheckName,
): PreservationCheckResult {
  return { name, pass: true, details: '', skipped: true };
}

export function commentsCheck(
  original: string,
  written: string,
  targetPath: TargetPath,
  format: McpLocationFormat,
): PreservationCheckResult {
  if (format === 'json') return skippedCheck('comments');
  const extract =
    format === 'jsonc' ? extractJsoncComments : extractHashComments;
  const outsideOriginal = extractOutside(original, targetPath, format);
  const allWritten = extract(written);
  const missing = outsideOriginal.filter((c) => !allWritten.includes(c));
  if (missing.length === 0) {
    return { name: 'comments', pass: true, details: '', skipped: false };
  }
  const preview = missing
    .slice(0, 3)
    .map((m) => `  - ${JSON.stringify(m)}`)
    .join('\n');
  const more =
    missing.length > 3 ? `\n  ...and ${missing.length - 3} more` : '';
  return {
    name: 'comments',
    pass: false,
    details: `Missing ${missing.length} comment(s) from output:\n${preview}${more}`,
    skipped: false,
  };
}

export function topLevelKeysCheck(
  original: string,
  written: string,
  targetPath: TargetPath,
  format: McpLocationFormat,
): PreservationCheckResult {
  const allowedTopLevel = targetPath[0];
  if (format === 'json' || format === 'jsonc') {
    return jsonTopLevelKeysCheck(original, written, allowedTopLevel);
  }
  if (format === 'toml') {
    return tomlTopLevelKeysCheck(original, written, allowedTopLevel);
  }
  return skippedCheck('topLevelKeys');
}

export function keyOrderCheck(
  original: string,
  written: string,
  targetPath: TargetPath,
  format: McpLocationFormat,
): PreservationCheckResult {
  if (format === 'json' || format === 'jsonc') {
    return jsonKeyOrderCheck(original, written, targetPath);
  }
  if (format === 'toml') {
    return tomlKeyOrderCheck(original, written, targetPath);
  }
  return skippedCheck('keyOrder');
}

export function mcpServersCheck(
  original: string,
  written: string,
  targetPath: TargetPath,
  format: McpLocationFormat,
): PreservationCheckResult {
  if (targetPath.length === 0) return skippedCheck('mcpServers');
  const mcpKey = targetPath[0];
  const touchedServer = targetPath.length > 1 ? targetPath[1] : undefined;
  if (format === 'json' || format === 'jsonc') {
    return jsonMcpServersCheck(original, written, mcpKey, touchedServer);
  }
  if (format === 'toml') {
    return tomlMcpServersCheck(original, written, mcpKey, touchedServer);
  }
  return skippedCheck('mcpServers');
}

export function formattingCheck(
  original: string,
  written: string,
  targetPath: TargetPath,
  format: McpLocationFormat,
): PreservationCheckResult {
  if (format === 'json' || format === 'jsonc') {
    return jsonFormattingCheck(original, written, targetPath);
  }
  if (format === 'toml') {
    return tomlFormattingCheck(original, written, targetPath);
  }
  return skippedCheck('formatting');
}

export function idempotencyCheck(
  written: string,
  rewritten: string,
): PreservationCheckResult {
  if (rewritten === written) {
    return { name: 'idempotency', pass: true, details: '', skipped: false };
  }
  return {
    name: 'idempotency',
    pass: false,
    details: `Second apply produced different bytes than first apply (length: ${written.length} vs ${rewritten.length})`,
    skipped: false,
  };
}

/**
 * Strongest preservation guarantee: every byte outside the targetPath
 * subtree must be byte-identical between `original` and `written`.
 *
 * This is the primary E1 contract. The structured checks (comments,
 * topLevelKeys, keyOrder, mcpServers, formatting) are diagnostic
 * aids that name *which* property regressed; this check is the
 * catch-all that fires on any out-of-scope byte change those
 * structural checks might miss (e.g. a comment text change that keeps
 * the same set, or a value-type swap in a non-target top-level key
 * that keeps structural equality).
 *
 * For JSON/JSONC: extract the targetPath subtree's byte range, then
 * compare `original[0..start] + original[end..]` byte-for-byte against
 * the same concatenation from `written`.
 *
 * For TOML: same approach but the targetPath range is a line range,
 * converted to a byte range.
 *
 * For empty targetPath: skipped (whole document was allowed).
 *
 * For YAML: skipped (no supported agent uses YAML yet).
 */
export function rawBytesCheck(
  original: string,
  written: string,
  targetPath: TargetPath,
  format: McpLocationFormat,
): PreservationCheckResult {
  if (targetPath.length === 0) return skippedCheck('rawBytes');
  if (format === 'json' || format === 'jsonc') {
    // Compute the target range INDEPENDENTLY in both original and
    // written. A writer that adds fields to the target server (e.g. a
    // new "env" entry) changes the target's length; using the original
    // range for the written side would then slice into the wrong
    // content and falsely fire.
    const origRange = findJsonTargetPathRange(original, targetPath);
    const writtenRange = findJsonTargetPathRange(written, targetPath);
    if (origRange === null) {
      return {
        name: 'rawBytes',
        pass: false,
        details: `targetPath ${JSON.stringify(targetPath)} not found in original document`,
        skipped: false,
      };
    }
    if (writtenRange === null) {
      return {
        name: 'rawBytes',
        pass: false,
        details: `targetPath ${JSON.stringify(targetPath)} not found in written document — writer removed the target subtree entirely`,
        skipped: false,
      };
    }
    const [origStart, origEnd] = origRange;
    const [writtenStart, writtenEnd] = writtenRange;
    const origOutside = original.slice(0, origStart) + original.slice(origEnd);
    const writtenOutside =
      written.slice(0, writtenStart) + written.slice(writtenEnd);
    if (origOutside === writtenOutside) {
      return { name: 'rawBytes', pass: true, details: '', skipped: false };
    }
    return diffResult(
      'rawBytes',
      origOutside,
      writtenOutside,
      origStart,
      origEnd,
      format,
    );
  }
  if (format === 'toml') {
    // Same independence requirement for TOML line ranges.
    const origLineRange = findTomlTargetPathLineRange(original, targetPath);
    const writtenLineRange = findTomlTargetPathLineRange(written, targetPath);
    if (origLineRange === null) {
      return {
        name: 'rawBytes',
        pass: false,
        details: `targetPath ${JSON.stringify(targetPath)} not found in original TOML document`,
        skipped: false,
      };
    }
    if (writtenLineRange === null) {
      return {
        name: 'rawBytes',
        pass: false,
        details: `targetPath ${JSON.stringify(targetPath)} not found in written TOML document — writer removed the target subtree entirely`,
        skipped: false,
      };
    }
    const [startLine, endLine] = origLineRange;
    const [writtenStartLine, writtenEndLine] = writtenLineRange;
    const origLines = original.split('\n');
    const writtenLines = written.split('\n');
    const origOutside = [
      ...origLines.slice(0, startLine),
      ...origLines.slice(endLine),
    ].join('\n');
    const writtenOutside = [
      ...writtenLines.slice(0, writtenStartLine),
      ...writtenLines.slice(writtenEndLine),
    ].join('\n');
    if (origOutside === writtenOutside) {
      return { name: 'rawBytes', pass: true, details: '', skipped: false };
    }
    return diffResult(
      'rawBytes',
      origOutside,
      writtenOutside,
      startLine,
      endLine,
      format,
    );
  }
  return skippedCheck('rawBytes');
}

function diffResult(
  name: PreservationCheckName,
  origOutside: string,
  writtenOutside: string,
  start: number,
  end: number,
  format: McpLocationFormat,
): PreservationCheckResult {
  // Find the first divergent byte to give a useful diagnostic.
  let divergeAt = 0;
  const minLen = Math.min(origOutside.length, writtenOutside.length);
  while (
    divergeAt < minLen &&
    origOutside[divergeAt] === writtenOutside[divergeAt]
  ) {
    divergeAt++;
  }
  const lenDelta = writtenOutside.length - origOutside.length;
  const snippet = origOutside.slice(
    Math.max(0, divergeAt - 20),
    divergeAt + 20,
  );
  return {
    name,
    pass: false,
    details:
      `Bytes outside targetPath[${format === 'toml' ? 'line' : 'byte'} ${start}\u2013${end}] differ: ` +
      `first divergence at offset ${divergeAt} (len delta: ${lenDelta}), ` +
      `snippet: ${JSON.stringify(snippet)}`,
    skipped: false,
  };
}

// ---------------------------------------------------------------------------
// JSON / JSONC helpers
// ---------------------------------------------------------------------------

function parseJsoncStrict(text: string): unknown {
  const errors: ParseError[] = [];
  const result = parseJsonc(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0) {
    const first = errors[0];
    throw new Error(
      `jsonc parse error: ${first?.error ?? 'unknown'} at offset ${first?.offset ?? 0}`,
    );
  }
  return result;
}

/**
 * Find the byte range of the targetPath subtree in a JSON/JSONC
 * document. Returns `[start, end)` where the range covers the entire
 * subtree (the final value node) plus a trailing comma if present.
 * Returns `null` if the path doesn't exist.
 *
 * Walks the AST once (no re-parsing of sliced text). This is correct
 * even when an unrelated earlier object contains a nested key whose
 * name collides with `targetPath[0]` (the regex-first-match bug), and
 * it doesn't depend on a brace-counting scanner that would miscount
 * braces inside comments.
 */
function findJsonTargetPathRange(
  text: string,
  targetPath: TargetPath,
): readonly [number, number] | null {
  if (targetPath.length === 0) return null;
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (root === undefined) return null;
  if (errors.length > 0) return null;
  if (root.type !== 'object') return null;
  let currentNode: Node = root;
  for (const segment of targetPath) {
    if (currentNode.type !== 'object' || currentNode.children === undefined) {
      return null;
    }
    let found: Node | undefined;
    for (const property of currentNode.children) {
      if (property.type !== 'property' || property.children === undefined) {
        continue;
      }
      const keyNode = property.children[0];
      if (keyNode !== undefined && keyNode.value === segment) {
        found = property;
        break;
      }
    }
    if (found === undefined) return null;
    // Descend into the property's value node for the next segment.
    if (found.children === undefined) return null;
    const valueNode = found.children[1];
    if (valueNode === undefined) return null;
    currentNode = valueNode;
  }
  // The final node is the target value. Compute its byte range plus
  // any trailing comma.
  let endOffset = currentNode.offset + currentNode.length;
  while (endOffset < text.length && /\s/.test(text[endOffset]!)) {
    endOffset++;
  }
  if (text[endOffset] === ',') endOffset++;
  return [currentNode.offset, endOffset] as const;
}

function jsonTopLevelKeysCheck(
  original: string,
  written: string,
  allowedTopLevel: string | undefined,
): PreservationCheckResult {
  const origDoc = parseJsoncStrict(original) as Record<string, unknown> | null;
  const writtenDoc = parseJsoncStrict(written) as Record<
    string,
    unknown
  > | null;
  if (
    origDoc === null ||
    typeof origDoc !== 'object' ||
    Array.isArray(origDoc)
  ) {
    return skippedCheck('topLevelKeys');
  }
  if (
    writtenDoc === null ||
    typeof writtenDoc !== 'object' ||
    Array.isArray(writtenDoc)
  ) {
    return {
      name: 'topLevelKeys',
      pass: false,
      details: 'written document is not a JSON object',
      skipped: false,
    };
  }
  const missing: string[] = [];
  const different: string[] = [];
  for (const key of Object.keys(origDoc)) {
    if (key === allowedTopLevel) continue;
    if (!(key in writtenDoc)) {
      missing.push(key);
      continue;
    }
    if (!jsonDeepEqual(origDoc[key], writtenDoc[key])) {
      different.push(key);
    }
  }
  if (missing.length === 0 && different.length === 0) {
    return { name: 'topLevelKeys', pass: true, details: '', skipped: false };
  }
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
  if (different.length > 0) parts.push(`differ: ${different.join(', ')}`);
  return {
    name: 'topLevelKeys',
    pass: false,
    details: `Top-level keys outside targetPath: ${parts.join('; ')}`,
    skipped: false,
  };
}

function jsonKeyOrderCheck(
  original: string,
  written: string,
  targetPath: TargetPath,
): PreservationCheckResult {
  const origDoc = parseJsoncStrict(original) as Record<string, unknown> | null;
  const writtenDoc = parseJsoncStrict(written) as Record<
    string,
    unknown
  > | null;
  if (
    origDoc === null ||
    typeof origDoc !== 'object' ||
    Array.isArray(origDoc)
  ) {
    return skippedCheck('keyOrder');
  }
  if (
    writtenDoc === null ||
    typeof writtenDoc !== 'object' ||
    Array.isArray(writtenDoc)
  ) {
    return {
      name: 'keyOrder',
      pass: false,
      details: 'written document is not a JSON object',
      skipped: false,
    };
  }
  // jsonc-parser preserves key order via Object.keys() on the parsed
  // object (insertion order). The checks below rely on that.
  const diffs: string[] = [];
  compareContainerKeyOrder(origDoc, writtenDoc, '$', targetPath, diffs);
  if (diffs.length === 0) {
    return { name: 'keyOrder', pass: true, details: '', skipped: false };
  }
  return {
    name: 'keyOrder',
    pass: false,
    details: `Key order differs at:\n${diffs
      .slice(0, 5)
      .map((d) => `  - ${d}`)
      .join('\n')}`,
    skipped: false,
  };
}

function jsonMcpServersCheck(
  original: string,
  written: string,
  mcpKey: string,
  touchedServer: string | undefined,
): PreservationCheckResult {
  const origDoc = parseJsoncStrict(original) as Record<string, unknown> | null;
  const writtenDoc = parseJsoncStrict(written) as Record<
    string,
    unknown
  > | null;
  if (
    origDoc === null ||
    writtenDoc === null ||
    typeof origDoc !== 'object' ||
    typeof writtenDoc !== 'object' ||
    Array.isArray(origDoc) ||
    Array.isArray(writtenDoc)
  ) {
    return skippedCheck('mcpServers');
  }
  const origMcp = origDoc[mcpKey];
  const writtenMcp = writtenDoc[mcpKey];
  if (origMcp === undefined) return skippedCheck('mcpServers');
  if (
    typeof origMcp !== 'object' ||
    origMcp === null ||
    Array.isArray(origMcp)
  ) {
    return skippedCheck('mcpServers');
  }
  const writtenServers =
    writtenMcp !== undefined &&
    typeof writtenMcp === 'object' &&
    !Array.isArray(writtenMcp)
      ? (writtenMcp as Record<string, unknown>)
      : {};
  const missing: string[] = [];
  const different: string[] = [];
  for (const server of Object.keys(origMcp)) {
    if (server === touchedServer) continue;
    if (!(server in writtenServers)) {
      missing.push(server);
      continue;
    }
    if (
      !jsonDeepEqual(
        (origMcp as Record<string, unknown>)[server],
        writtenServers[server],
      )
    ) {
      different.push(server);
    }
  }
  if (missing.length === 0 && different.length === 0) {
    return { name: 'mcpServers', pass: true, details: '', skipped: false };
  }
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
  if (different.length > 0) parts.push(`differ: ${different.join(', ')}`);
  return {
    name: 'mcpServers',
    pass: false,
    details: `MCP servers outside targetPath: ${parts.join('; ')}`,
    skipped: false,
  };
}

function jsonFormattingCheck(
  original: string,
  written: string,
  targetPath: TargetPath,
): PreservationCheckResult {
  // Compute target ranges INDEPENDENTLY in original and written. A
  // length-changing inside-target mutation (e.g. adding a field to
  // the target server) shifts line indices; using only the original
  // range would mark the wrong lines as "inside target" and compare
  // outside lines at shifted indices, falsely firing.
  const origRange = findJsonTargetPathRange(original, targetPath);
  const writtenRange = findJsonTargetPathRange(written, targetPath);
  if (origRange === null || writtenRange === null) {
    return skippedCheck('formatting');
  }
  const [origStart, origEnd] = origRange;
  const [writtenStart, writtenEnd] = writtenRange;
  const origOutside = original.slice(0, origStart) + original.slice(origEnd);
  const writtenOutside =
    written.slice(0, writtenStart) + written.slice(writtenEnd);
  const origLines = origOutside.split('\n');
  const writtenLines = writtenOutside.split('\n');
  const diffs: string[] = [];
  const maxLines = Math.min(origLines.length, writtenLines.length);
  for (let i = 0; i < maxLines; i++) {
    const origLeading = origLines[i]!.match(/^[ \t]*/)?.[0] ?? '';
    const writtenLeading = writtenLines[i]!.match(/^[ \t]*/)?.[0] ?? '';
    if (origLeading !== writtenLeading) {
      diffs.push(
        `line ${i + 1}: leading whitespace ${JSON.stringify(origLeading)} vs ${JSON.stringify(writtenLeading)}`,
      );
    }
  }
  if (original.endsWith('\n') !== written.endsWith('\n')) {
    diffs.push(
      `trailing newline: original=${original.endsWith('\n')}, written=${written.endsWith('\n')}`,
    );
  }
  if (diffs.length === 0) {
    return { name: 'formatting', pass: true, details: '', skipped: false };
  }
  return {
    name: 'formatting',
    pass: false,
    details: `Formatting drift outside targetPath:\n${diffs
      .slice(0, 5)
      .map((d) => `  - ${d}`)
      .join('\n')}`,
    skipped: false,
  };
}

/**
 * Deep-equal comparison for JSON values. Handles primitives, arrays,
 * and plain objects. Does not handle `undefined`, functions, or
 * non-JSON values.
 */
function jsonDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!jsonDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (
        !jsonDeepEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        )
      )
        return false;
    }
    return true;
  }
  return false;
}

/**
 * Walk two parsed JSON trees and report every container whose key
 * order differs outside the targetPath subtree. `path` is the JSON
 * pointer to the current container.
 */
function compareContainerKeyOrder(
  orig: Record<string, unknown>,
  written: Record<string, unknown>,
  path: string,
  targetPath: TargetPath,
  diffs: string[],
): void {
  // If this container is inside targetPath, skip it.
  if (isPathInsideTarget(path, targetPath)) return;
  const origKeys = Object.keys(orig);
  const writtenKeys = Object.keys(written);
  const common = origKeys.filter((k) => k in written);
  const writtenOrder = common.map((k) => writtenKeys.indexOf(k));
  const expected = common.map((_, i) => i);
  if (JSON.stringify(writtenOrder) !== JSON.stringify(expected)) {
    diffs.push(
      `${path}: expected [${expected}], got [${writtenOrder}] (keys: ${JSON.stringify(common)})`,
    );
  }
  // Recurse into containers outside targetPath.
  for (const key of common) {
    const childPath = `${path}.${key}`;
    const o = orig[key];
    const w = written[key];
    if (
      o !== null &&
      w !== null &&
      typeof o === 'object' &&
      typeof w === 'object' &&
      !Array.isArray(o) &&
      !Array.isArray(w)
    ) {
      compareContainerKeyOrder(
        o as Record<string, unknown>,
        w as Record<string, unknown>,
        childPath,
        targetPath,
        diffs,
      );
    }
  }
}

/**
 * JSON-pointer-ish path-inside-target check. A path like
 * `$.mcpServers.filesystem` is inside targetPath `['mcpServers', 'filesystem']`.
 */
function isPathInsideTarget(path: string, targetPath: TargetPath): boolean {
  if (targetPath.length === 0) return false;
  // path starts with "$."; split into segments
  const segments = path
    .slice(2)
    .split('.')
    .filter((s) => s.length > 0);
  if (segments.length < targetPath.length) return false;
  for (let i = 0; i < targetPath.length; i++) {
    if (segments[i] !== targetPath[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// JSONC comment extraction
// ---------------------------------------------------------------------------

function extractJsoncComments(text: string): string[] {
  const comments: string[] = [];
  let i = 0;
  let inString = false;
  let stringChar = '';
  while (i < text.length) {
    const c = text[i];
    if (inString) {
      if (c === '\\' && i + 1 < text.length) {
        i += 2;
        continue;
      }
      if (c === stringChar) inString = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      const start = i;
      while (i < text.length && text[i] !== '\n') i++;
      comments.push(text.slice(start, i));
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i = Math.min(i + 2, text.length);
      comments.push(text.slice(start, i));
      continue;
    }
    i++;
  }
  return comments;
}

function extractHashComments(text: string): string[] {
  const comments: string[] = [];
  let i = 0;
  let inString = false;
  let stringChar = '';
  while (i < text.length) {
    const c = text[i];
    if (inString) {
      if (c === '\\' && i + 1 < text.length) {
        i += 2;
        continue;
      }
      if (c === stringChar) inString = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      i++;
      continue;
    }
    if (c === '#') {
      const start = i;
      while (i < text.length && text[i] !== '\n') i++;
      comments.push(text.slice(start, i));
      continue;
    }
    i++;
  }
  return comments;
}

/**
 * Extract comments from `text` that are NOT inside the targetPath
 * subtree. For JSON/JSONC, the subtree is identified by byte range.
 * For TOML, the subtree is identified by line range.
 */
function extractCommentsOutside(
  text: string,
  targetPath: TargetPath,
  format: McpLocationFormat,
): string[] {
  if (format === 'jsonc') {
    const range = findJsonTargetPathRange(text, targetPath);
    if (range === null) return extractJsoncComments(text);
    return extractJsoncCommentsByLines(text, range[0], range[1]);
  }
  if (format === 'toml' || format === 'yaml') {
    const lineRange = findTomlTargetPathLineRange(text, targetPath);
    if (lineRange === null) return extractHashComments(text);
    return extractHashCommentsByLines(text, lineRange[0], lineRange[1]);
  }
  return [];
}

function extractOutside(
  text: string,
  targetPath: TargetPath,
  format: McpLocationFormat,
): string[] {
  if (format === 'json') return [];
  return extractCommentsOutside(text, targetPath, format);
}

function extractJsoncCommentsByLines(
  text: string,
  startByte: number,
  endByte: number,
): string[] {
  const result: string[] = [];
  // Walk through text, tracking which comments fall outside [startByte, endByte).
  let i = 0;
  let inString = false;
  let stringChar = '';
  while (i < text.length) {
    const c = text[i];
    if (inString) {
      if (c === '\\' && i + 1 < text.length) {
        i += 2;
        continue;
      }
      if (c === stringChar) inString = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      const start = i;
      while (i < text.length && text[i] !== '\n') i++;
      if (start < startByte || i >= endByte) {
        result.push(text.slice(start, i));
      }
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i = Math.min(i + 2, text.length);
      if (start < startByte || i >= endByte) {
        result.push(text.slice(start, i));
      }
      continue;
    }
    i++;
  }
  return result;
}

function extractHashCommentsByLines(
  text: string,
  startLine: number,
  endLine: number,
): string[] {
  const lines = text.split('\n');
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i >= startLine && i < endLine) continue;
    const line = lines[i]!;
    // Find first # that's not inside a string on this line.
    let j = 0;
    let inString = false;
    let stringChar = '';
    while (j < line.length) {
      const c = line[j];
      if (inString) {
        if (c === '\\' && j + 1 < line.length) {
          j += 2;
          continue;
        }
        if (c === stringChar) inString = false;
        j++;
        continue;
      }
      if (c === '"' || c === "'") {
        inString = true;
        stringChar = c;
        j++;
        continue;
      }
      if (c === '#') {
        result.push(line.slice(j));
        break;
      }
      j++;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// TOML helpers
// ---------------------------------------------------------------------------

function tomlTopLevelKeysCheck(
  original: string,
  written: string,
  allowedTopLevel: string | undefined,
): PreservationCheckResult {
  const origDoc = smolTomlCjsModule.parse(original);
  const writtenDoc = smolTomlCjsModule.parse(written);
  if (typeof origDoc !== 'object' || origDoc === null) {
    return skippedCheck('topLevelKeys');
  }
  if (typeof writtenDoc !== 'object' || writtenDoc === null) {
    return {
      name: 'topLevelKeys',
      pass: false,
      details: 'written TOML document is not an object',
      skipped: false,
    };
  }
  const missing: string[] = [];
  const different: string[] = [];
  for (const key of Object.keys(origDoc)) {
    if (key === allowedTopLevel) continue;
    if (!(key in writtenDoc)) {
      missing.push(key);
      continue;
    }
    if (
      !tomlDeepEqual(
        (origDoc as Record<string, unknown>)[key],
        (writtenDoc as Record<string, unknown>)[key],
      )
    ) {
      different.push(key);
    }
  }
  if (missing.length === 0 && different.length === 0) {
    return { name: 'topLevelKeys', pass: true, details: '', skipped: false };
  }
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
  if (different.length > 0) parts.push(`differ: ${different.join(', ')}`);
  return {
    name: 'topLevelKeys',
    pass: false,
    details: `Top-level keys outside targetPath: ${parts.join('; ')}`,
    skipped: false,
  };
}

function tomlKeyOrderCheck(
  original: string,
  written: string,
  targetPath: TargetPath,
): PreservationCheckResult {
  // smol-toml does not preserve key order. Use line-based: for each
  // key=value line outside targetPath's line range, verify it appears
  // in written at the same line offset. This is a weaker check than
  // JSON's parse-based one but it's the best we can do for TOML
  // without a serializer.
  const origLineRange = findTomlTargetPathLineRange(original, targetPath);
  const writtenLineRange = findTomlTargetPathLineRange(written, targetPath);
  if (origLineRange === null) return skippedCheck('keyOrder');
  const origLines = original.split('\n');
  const writtenLines = written.split('\n');
  const diffs: string[] = [];
  const [startLine, endLine] = origLineRange;
  for (let i = 0; i < origLines.length; i++) {
    if (i >= startLine && i < endLine) continue;
    const origLine = origLines[i]!.trim();
    if (origLine === '' || origLine.startsWith('#')) continue;
    // Find the same line in written.
    const writtenIdx = writtenLines.findIndex((l) => l.trim() === origLine);
    if (writtenIdx === -1) {
      diffs.push(`line ${i + 1}: missing line ${JSON.stringify(origLine)}`);
      continue;
    }
    // The line should appear at the same position outside targetPath.
    if (writtenLineRange !== null) {
      const [wStart, wEnd] = writtenLineRange;
      if (writtenIdx >= wStart && writtenIdx < wEnd) continue; // inside written's targetPath, skip
    }
    if (writtenIdx !== i) {
      diffs.push(`line ${i + 1}: appears at line ${writtenIdx + 1} instead`);
    }
  }
  if (diffs.length === 0) {
    return { name: 'keyOrder', pass: true, details: '', skipped: false };
  }
  return {
    name: 'keyOrder',
    pass: false,
    details: `TOML line/key order drift outside targetPath:\n${diffs
      .slice(0, 5)
      .map((d) => `  - ${d}`)
      .join('\n')}`,
    skipped: false,
  };
}

function tomlMcpServersCheck(
  original: string,
  written: string,
  mcpKey: string,
  touchedServer: string | undefined,
): PreservationCheckResult {
  const origDoc = smolTomlCjsModule.parse(original);
  const writtenDoc = smolTomlCjsModule.parse(written);
  if (typeof origDoc !== 'object' || origDoc === null)
    return skippedCheck('mcpServers');
  if (typeof writtenDoc !== 'object' || writtenDoc === null)
    return skippedCheck('mcpServers');
  const origMcp = (origDoc as Record<string, unknown>)[mcpKey];
  const writtenMcp = (writtenDoc as Record<string, unknown>)[mcpKey];
  if (origMcp === undefined) return skippedCheck('mcpServers');
  if (typeof origMcp !== 'object' || origMcp === null)
    return skippedCheck('mcpServers');
  const writtenServers =
    writtenMcp !== undefined &&
    typeof writtenMcp === 'object' &&
    writtenMcp !== null
      ? (writtenMcp as Record<string, unknown>)
      : {};
  const missing: string[] = [];
  const different: string[] = [];
  for (const server of Object.keys(origMcp)) {
    if (server === touchedServer) continue;
    if (!(server in writtenServers)) {
      missing.push(server);
      continue;
    }
    if (
      !tomlDeepEqual(
        (origMcp as Record<string, unknown>)[server],
        writtenServers[server],
      )
    ) {
      different.push(server);
    }
  }
  if (missing.length === 0 && different.length === 0) {
    return { name: 'mcpServers', pass: true, details: '', skipped: false };
  }
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
  if (different.length > 0) parts.push(`differ: ${different.join(', ')}`);
  return {
    name: 'mcpServers',
    pass: false,
    details: `MCP servers outside targetPath: ${parts.join('; ')}`,
    skipped: false,
  };
}

function tomlFormattingCheck(
  original: string,
  written: string,
  targetPath: TargetPath,
): PreservationCheckResult {
  // Compute target line ranges INDEPENDENTLY in original and written.
  // A length-changing inside-target mutation shifts line indices; using
  // only the original range would mark the wrong lines as inside.
  const origLineRange = findTomlTargetPathLineRange(original, targetPath);
  const writtenLineRange = findTomlTargetPathLineRange(written, targetPath);
  if (origLineRange === null || writtenLineRange === null) {
    return skippedCheck('formatting');
  }
  const [origStart, origEnd] = origLineRange;
  const [writtenStart, writtenEnd] = writtenLineRange;
  const origLines = original.split('\n');
  const writtenLines = written.split('\n');
  const origOutside = [
    ...origLines.slice(0, origStart),
    ...origLines.slice(origEnd),
  ].join('\n');
  const writtenOutside = [
    ...writtenLines.slice(0, writtenStart),
    ...writtenLines.slice(writtenEnd),
  ].join('\n');
  const origOutsideLines = origOutside.split('\n');
  const writtenOutsideLines = writtenOutside.split('\n');
  const diffs: string[] = [];
  for (
    let i = 0;
    i < Math.min(origOutsideLines.length, writtenOutsideLines.length);
    i++
  ) {
    const origLeading = origOutsideLines[i]!.match(/^[ \t]*/)?.[0] ?? '';
    const writtenLeading = writtenOutsideLines[i]!.match(/^[ \t]*/)?.[0] ?? '';
    if (origLeading !== writtenLeading) {
      diffs.push(
        `line ${i + 1}: leading whitespace ${JSON.stringify(origLeading)} vs ${JSON.stringify(writtenLeading)}`,
      );
    }
  }
  if (original.endsWith('\n') !== written.endsWith('\n')) {
    diffs.push(
      `trailing newline: original=${original.endsWith('\n')}, written=${written.endsWith('\n')}`,
    );
  }
  if (diffs.length === 0) {
    return { name: 'formatting', pass: true, details: '', skipped: false };
  }
  return {
    name: 'formatting',
    pass: false,
    details: `Formatting drift outside targetPath:\n${diffs
      .slice(0, 5)
      .map((d) => `  - ${d}`)
      .join('\n')}`,
    skipped: false,
  };
}

function tomlDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!tomlDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (
        !tomlDeepEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        )
      )
        return false;
    }
    return true;
  }
  return false;
}

/**
 * Find the line range `[startLine, endLine)` of the targetPath
 * subtree in a TOML document. For `['mcp_servers']`, returns the
 * range of `[mcp_servers.*]` subtables. For `['mcp_servers', 'filesystem']`,
 * returns the range of `[mcp_servers.filesystem]`.
 */
function findTomlTargetPathLineRange(
  text: string,
  targetPath: TargetPath,
): readonly [number, number] | null {
  if (targetPath.length === 0) return null;
  const lines = text.split('\n');
  if (targetPath.length === 1) {
    const parent = targetPath[0]!;
    // Find [parent] or [parent.*] headers
    let startLine = -1;
    let endLine = lines.length;
    const explicitRe = new RegExp(`^\\s*\\[${escapeRegExp(parent)}\\]$`);
    const subRe = new RegExp(`^\\s*\\[${escapeRegExp(parent)}\\.[^\\]]+\\]$`);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (startLine === -1 && (explicitRe.test(line) || subRe.test(line))) {
        startLine = i;
        continue;
      }
      if (
        startLine !== -1 &&
        line.trim().startsWith('[') &&
        !subRe.test(line) &&
        !explicitRe.test(line)
      ) {
        endLine = i;
        break;
      }
    }
    if (startLine === -1) return null;
    return [startLine, endLine] as const;
  }
  if (targetPath.length === 2) {
    const parent = targetPath[0]!;
    const child = targetPath[1]!;
    const headerRe = new RegExp(
      `^\\s*\\[${escapeRegExp(parent)}\\.${escapeRegExp(child)}\\]$`,
    );
    let startLine = -1;
    let endLine = lines.length;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (startLine === -1 && headerRe.test(line)) {
        startLine = i;
        continue;
      }
      if (startLine !== -1 && line.trim().startsWith('[')) {
        endLine = i;
        break;
      }
    }
    if (startLine === -1) return null;
    return [startLine, endLine] as const;
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
