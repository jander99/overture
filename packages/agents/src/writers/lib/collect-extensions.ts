import type { JsonValue } from '../../types.js';

/**
 * Return every property of `existing` whose key is NOT in
 * `canonicalFieldNames`. Values of `undefined` are also omitted.
 * Returns `{}` when `existing` is `undefined`.
 *
 * Used by every JSONC writer
 * (`claude-code-write`, `github-copilot-cli-write`, `opencode-write`)
 * to lift the user's custom extension fields off an existing native
 * server entry so they can be re-emitted alongside the rewritten
 * canonical fields. OpenAI Codex is intentionally not migrated: its
 * native-entry extensions are transport-aware and shape-validated
 * via `UnsupportedCodexExtensionShapeError`, not simple passthrough.
 *
 * Accepts a `Record<string, unknown>` so callers may pass the
 * broader writer-specific writable-server type (some writers index
 * their entries as `unknown`, others as `JsonValue | undefined`);
 * both satisfy the constraint. Returns `Record<string, JsonValue>`;
 * JsonValue ⊆ unknown so call sites that spread into a
 * `Record<string, unknown>`-shaped output still type-check.
 */
export function collectExtensions(
  existing: Record<string, unknown> | undefined,
  canonicalFieldNames: ReadonlySet<string>,
): Record<string, JsonValue> {
  const extensions: Record<string, JsonValue> = {};
  if (existing === undefined) {
    return extensions;
  }

  for (const key of Object.keys(existing)) {
    if (canonicalFieldNames.has(key)) {
      continue;
    }
    const value = existing[key];
    if (value !== undefined) {
      extensions[key] = value as JsonValue;
    }
  }

  return extensions;
}
