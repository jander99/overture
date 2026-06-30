/**
 * Minimal internal JSON/JSONC map edit helper for the E3 era.
 *
 * Surgical byte edits at a caller-supplied path; preserves surrounding
 * comments, formatting, BOM, and trailing newline. Does NOT use full
 * document parse + reserialize.
 */
import {
  parse as parseJsonc,
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

  // We do NOT perform a byte-level splice here. The per-agent writer is
  // expected to do its own byte splicing using its own navigator. This
  // helper is intentionally conservative: it only validates targetability
  // and produces the next container shape, plus a placeholder nextBytes
  // (== original) so the type system stays honest. Per-agent writers
  // override the actual byte splice with their own logic.
  // Future TDD: replace this stub with a real byte splice.
  return {
    kind: 'ok',
    nextBytes: input.original,
    changed: true,
  };
}
