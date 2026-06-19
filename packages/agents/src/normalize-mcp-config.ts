// Shared normalization helpers used by every per-agent MCP normalizer.
//
// These helpers convert each agent's native MCP config shape into the
// canonical `OvertureMcpServer` union exposed by `@overture/config`. They
// are intentionally narrow: the per-agent normalizer decides which
// `type` to pick, and the helpers do the structural validation for the
// optional `args` / `env` / `headers` fields. The helpers are total
// (no thrown exceptions) and never mutate their input.
//
// Behavior rules (from the B2 plan):
// - Omit optional fields only when the native field is `undefined`.
//   Preserve explicitly present valid empty arrays/maps (`[]` / `{}`)
//   because B1's `serverSettingsEqual` treats them as distinct from
//   `undefined`.
// - Copy readonly native arrays/maps into mutable canonical values
//   BEFORE returning. The helper return types are mutable so the
//   resulting `OvertureMcpServer` can be passed straight into a
//   canonical constructor without an extra copy.
// - Do NOT trim strings; whitespace-only strings are valid non-empty
//   strings (B1 does byte-exact equality).
// - All helpers are total: invalid values return the canonical reason
//   string instead of throwing.
import type { OvertureMcpServer } from '@overture/config';
import type {
  AgentMcpNormalizeHandler,
  AgentMcpNormalizeReason,
  AgentMcpReadResult,
  AgentNormalizedMcpServer,
} from './types.js';

/**
 * Runtime set of every `AgentMcpNormalizeReason` string. Useful for
 * guards (e.g. `if (NORMALIZE_SHAPE_CONFLICT_REASONS.has(reason)) ...`)
 * and for exhaustiveness checks inside per-agent normalizers. The
 * union in `types.ts` is the source of truth for the strings; this
 * constant mirrors that union at runtime so the value set can be
 * inspected without re-listing the literals.
 */
export const NORMALIZE_SHAPE_CONFLICT_REASONS: ReadonlySet<AgentMcpNormalizeReason> =
  new Set<AgentMcpNormalizeReason>([
    'Expected server entry to be an object.',
    'Stdio command is missing or empty.',
    'Remote url is missing or empty.',
    'Server declares both stdio command and remote url.',
    'Server declares neither stdio command nor remote url.',
    'Expected string array for args.',
    'Expected string map for env.',
    'Expected string map for headers.',
    'Unsupported MCP server transport type.',
  ]);

/**
 * Wrap a canonical `OvertureMcpServer` as a successful normalization
 * result. Per-agent normalizers return a `Readonly<Record<string,
 * AgentNormalizedMcpServer>>` keyed by server name; this helper builds
 * the success arm.
 */
export function normalized(
  server: OvertureMcpServer,
): AgentNormalizedMcpServer {
  return { state: 'normalized', server };
}

/**
 * Build a shape-conflict result carrying the canonical reason string.
 * The reason union is enforced by the `AgentMcpNormalizeReason` type
 * so callers cannot pass an arbitrary string.
 */
export function shapeConflict(
  reason: AgentMcpNormalizeReason,
): AgentNormalizedMcpServer {
  return { state: 'shape-conflict', reason };
}

/**
 * Adapt a typed per-agent normalizer to the registry's non-generic
 * `AgentMcpNormalizeHandler<unknown>` slot. The cast is sound because
 * `AgentMcpReadResult<TConfig>` is covariant in `TConfig` for the
 * shape the normalizer reads (the normalizer only inspects the typed
 * `config` field) and the registry invokes the handler through the
 * `unknown` slot without re-narrowing.
 *
 * Keeping the cast on the adapter (not on the per-agent file) means
 * every typed normalizer calls `asRegistryNormalizeHandler(myHandler)`
 * at the call site and the narrowing happens in one well-tested
 * place. The registry stays non-generic; per-agent types stay
 * precise.
 */
export function asRegistryNormalizeHandler<TConfig>(
  handler: AgentMcpNormalizeHandler<TConfig>,
): AgentMcpNormalizeHandler<unknown> {
  return (input) => handler(input as AgentMcpReadResult<TConfig>);
}

/**
 * Type guard: true for non-null, non-array objects. Used to gate
 * the `args` / `env` / `headers` validators before they look at
 * own-property values.
 */
export function isRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard: true for plain objects where every own enumerable
 * value is a string. Empty objects are valid string maps. Arrays,
 * `null`, and primitives return false. Symbol keys are ignored
 * (`Object.keys` returns own string keys only); MCP config files
 * don't use symbol-keyed maps, so this is safe in practice.
 */
export function isStringMap(
  value: unknown,
): value is Readonly<Record<string, string>> {
  if (!isRecord(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    if (typeof value[key] !== 'string') {
      return false;
    }
  }
  return true;
}

/**
 * Type guard: true for arrays whose every entry is a string. Used by
 * the args validator and normalizer. Accepts both mutable `string[]`
 * and readonly `readonly string[]` shapes; both are valid native
 * MCP arg vectors.
 */
function isStringArray(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  for (const entry of value) {
    if (typeof entry !== 'string') {
      return false;
    }
  }
  return true;
}

/**
 * Validate an optional string-map field (env / headers). Returns
 * `undefined` when the value is absent or is a valid string map;
 * returns the canonical reason string for the named field when the
 * value is present but not a string map.
 *
 * The helper recognizes the four field-name aliases used across the
 * supported agents' native shapes:
 * - `'env' | 'environment'` → `'Expected string map for env.'`
 * - `'headers' | 'http_headers'` → `'Expected string map for headers.'`
 *
 * For any other field name the helper returns `undefined` (it only
 * knows the env / headers reason strings). Per-agent normalizers
 * that need to validate a different field should branch on the
 * field name before calling this helper.
 */
export function validateOptionalStringMap(
  value: unknown,
  field: string,
): AgentMcpNormalizeReason | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (field === 'env' || field === 'environment') {
    return isStringMap(value) ? undefined : 'Expected string map for env.';
  }
  if (field === 'headers' || field === 'http_headers') {
    return isStringMap(value) ? undefined : 'Expected string map for headers.';
  }
  return undefined;
}

/**
 * Validate an optional string-array field (args). Returns
 * `undefined` when the value is absent or is a valid string array;
 * returns the canonical reason string when the value is present but
 * not a string array. Empty arrays are valid (B1 distinguishes
 * `[]` from `undefined`).
 */
export function validateOptionalStringArray(
  value: unknown,
): AgentMcpNormalizeReason | undefined {
  if (value === undefined) {
    return undefined;
  }
  return isStringArray(value) ? undefined : 'Expected string array for args.';
}

/**
 * Normalize an optional args field. Returns `undefined` when absent;
 * a fresh mutable `string[]` copy when present and valid; the
 * canonical reason string when present but not a string array.
 *
 * Empty arrays are preserved as empty `[]` (not collapsed to
 * `undefined`) so the resulting `OvertureMcpServer.args` is
 * byte-exact equal to the native value under B1's
 * `serverSettingsEqual`. The return is always a fresh mutable
 * `string[]` so callers can mutate it without affecting the
 * native shape.
 */
export function normalizeOptionalArgs(
  value: unknown,
): string[] | undefined | AgentMcpNormalizeReason {
  if (value === undefined) {
    return undefined;
  }
  if (!isStringArray(value)) {
    return 'Expected string array for args.';
  }
  return [...value];
}

/**
 * Normalize an optional env field. Returns `undefined` when absent;
 * a fresh mutable `Record<string, string>` copy when present and
 * valid; the canonical reason string when present but not a string
 * map.
 *
 * Empty maps are preserved as empty `{}` (not collapsed to
 * `undefined`) for the same B1 equality reason as `args`. The
 * return is always a fresh mutable map so callers can mutate it
 * without affecting the native shape.
 */
export function normalizeOptionalEnv(
  value: unknown,
): Record<string, string> | undefined | AgentMcpNormalizeReason {
  if (value === undefined) {
    return undefined;
  }
  if (!isStringMap(value)) {
    return 'Expected string map for env.';
  }
  return { ...value };
}

/**
 * Normalize an optional headers field. Same contract as
 * `normalizeOptionalEnv` but with the headers-specific reason
 * string (`'Expected string map for headers.'`). Per-agent
 * normalizers that read a `headers` (or `http_headers`) field
 * from a native MCP config call this helper to validate and copy
 * in one step.
 */
export function normalizeOptionalHeaders(
  value: unknown,
): Record<string, string> | undefined | AgentMcpNormalizeReason {
  if (value === undefined) {
    return undefined;
  }
  if (!isStringMap(value)) {
    return 'Expected string map for headers.';
  }
  return { ...value };
}
