/**
 * Minimal internal JSON/JSONC map edit helper for the E3 era.
 *
 * Surgical byte edits at a caller-supplied path; preserves surrounding
 * comments, formatting, BOM, and trailing newline. Does NOT use full
 * document parse + reserialize.
 */
import {
  parse as parseJsonc,
  parseTree,
  type Node,
  type ParseError,
} from 'jsonc-parser/lib/esm/main.js';

export interface JsoncMapEditOk {
  readonly kind: 'ok';
  readonly nextBytes: Uint8Array;
  readonly changed: boolean;
}

export interface JsoncMapEditError {
  readonly kind: 'error';
  readonly reason: 'parse-error' | 'unsupported-shape' | 'unsupported-path';
  readonly detail?: string;
}

export type JsoncMapEditResult = JsoncMapEditOk | JsoncMapEditError;

export interface EditJsoncMapInput {
  readonly original: Uint8Array;
  /** Property names walked from the document root. Each segment must be a
   * string key. Example: ['projects', workspaceDir, 'mcpServers']. */
  readonly targetPath: readonly string[];
  /** Map-shape patch (no comments) to merge into the targeted map.
   * null/empty uses no-op. */
  readonly patch: Readonly<Record<string, unknown>>;
}

interface PlannedEdit {
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
}

function findChildProperty(
  parent: Node,
  key: string,
): Node | undefined {
  if (parent.type !== 'object' || parent.children === undefined) return undefined;
  for (const prop of parent.children) {
    if (prop.type !== 'property' || prop.children === undefined) continue;
    const keyNode = prop.children[0];
    if (keyNode !== undefined && keyNode.value === key) return prop;
  }
  return undefined;
}

function findPropertyByteRange(
  text: string,
  prop: Node,
): { readonly start: number; readonly end: number } {
  let end = prop.offset + prop.length;
  while (end < text.length && /\s/.test(text[end]!)) end++;
  if (text[end] === ',') end++;
  let start = prop.offset;
  while (start > 0 && /\s/.test(text[start - 1]!)) start--;
  return { start, end };
}

function applyEdits(
  text: string,
  edits: readonly PlannedEdit[],
): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let result = text;
  for (const edit of sorted) {
    result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
  }
  return result;
}

function walkToNode(
  root: Node,
  targetPath: readonly string[],
): Node | undefined {
  let current: Node = root;
  for (const seg of targetPath) {
    if (current.type !== 'object' || current.children === undefined) return undefined;
    const prop = findChildProperty(current, seg);
    if (prop === undefined || prop.children === undefined) return undefined;
    const valueNode = prop.children[1];
    if (valueNode === undefined) return undefined;
    current = valueNode;
  }
  return current;
}

export function editJsoncMap(input: EditJsoncMapInput): JsoncMapEditResult {
  if (input.targetPath.length === 0) {
    return {
      kind: 'error',
      reason: 'unsupported-path',
      detail: 'empty target path',
    };
  }
  const text = new TextDecoder('utf-8').decode(input.original);
  const errors: ParseError[] = [];
  const parsed = parseJsonc(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as unknown;

  if (errors.length > 0) {
    return {
      kind: 'error',
      reason: 'parse-error',
      detail: String(errors[0]?.error),
    };
  }
  if (parsed === undefined || parsed === null) {
    return {
      kind: 'error',
      reason: 'unsupported-shape',
      detail: 'empty document',
    };
  }

  // Walk to the target container. Returns undefined if any segment missing.
  let container: unknown = parsed;
  for (const seg of input.targetPath) {
    if (container === null || typeof container !== 'object')
      return { kind: 'error', reason: 'unsupported-path', detail: seg };
    container = (container as Record<string, unknown>)[seg];
  }
  if (container === undefined) {
    return {
      kind: 'error',
      reason: 'unsupported-path',
      detail: 'target container not found',
    };
  }
  if (
    container === null ||
    typeof container !== 'object' ||
    Array.isArray(container)
  ) {
    return {
      kind: 'error',
      reason: 'unsupported-shape',
      detail: 'target is not a map',
    };
  }

  const before = JSON.stringify(container);
  const next: Record<string, unknown> = {
    ...(container as Record<string, unknown>),
  };
  for (const [k, v] of Object.entries(input.patch)) {
    if (v === undefined) continue;
    next[k] = v;
  }
  const after = JSON.stringify(next);
  if (before === after) {
    return { kind: 'ok', nextBytes: input.original, changed: false };
  }

  const parseErrors: ParseError[] = [];
  const treeRoot = parseTree(text, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (parseErrors.length > 0 || treeRoot === undefined) {
    return { kind: 'error', reason: 'parse-error', detail: String(parseErrors[0]?.error) };
  }
  if (treeRoot.type !== 'object') {
    return { kind: 'error', reason: 'unsupported-shape', detail: 'root is not an object' };
  }

  const containerNode = walkToNode(treeRoot, input.targetPath);
  if (containerNode === undefined) {
    return {
      kind: 'error',
      reason: 'unsupported-path',
      detail: 'target container not found',
    };
  }
  if (containerNode.type !== 'object') {
    return {
      kind: 'error',
      reason: 'unsupported-shape',
      detail: 'target is not a map',
    };
  }

  const edits: PlannedEdit[] = [];
  for (const [key, newValue] of Object.entries(input.patch)) {
    const prop = findChildProperty(containerNode, key);
    if (prop === undefined) {
      return {
        kind: 'error',
        reason: 'unsupported-path',
        detail: `server entry '${key}' not found in container`,
      };
    }
    const range = findPropertyByteRange(text, prop);
    edits.push({ start: range.start, end: range.end, replacement: JSON.stringify(newValue) });
  }

  if (edits.length === 0) {
    return { kind: 'ok', nextBytes: input.original, changed: false };
  }

  const spliced = applyEdits(text, edits);
  return { kind: 'ok', nextBytes: new TextEncoder().encode(spliced), changed: true };
}
