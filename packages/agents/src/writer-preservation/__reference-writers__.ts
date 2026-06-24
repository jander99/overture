/**
 * Intentionally-broken reference writers used only by
 * `contract.spec.ts` to prove the harness catches real writer-shaped
 * regressions. These are NOT production writers — they exist solely
 * to exercise the harness's individual preservation checks against
 * code that looks like a real per-agent writer (input → output
 * transforms) rather than raw byte-mutator outputs.
 *
 * File naming uses `__reference-writers__.ts` (double underscore) so
 * `index.ts` does not re-export these as part of the public surface.
 */
import {
  appendString,
  deleteMcpServer,
  deleteTopLevelKey,
  deleteTrailingNewline,
  driftIndentation,
  stripComments,
  swapTopLevelKeys,
} from './byte-mutators.js';
import type { McpLocationFormat } from '../types.js';

/**
 * Reference writer signature. Takes the original bytes plus the
 * targetPath the writer is "allowed" to mutate, returns the output
 * bytes. Matches the shape a future real per-agent writer will have.
 */
export type ReferenceWriter = (
  original: string,
  format: McpLocationFormat,
  targetPath: readonly string[],
) => string;

/**
 * A perfectly-preserving reference writer — returns the input
 * unchanged. The harness must report allPassed=true for this writer
 * on every format.
 */
export const preservingWriter: ReferenceWriter = (original) => original;

/**
 * A comment-stripping reference writer. Strips every JSONC/TOML/YAML
 * comment from the input. The harness must fire the `comments` check.
 */
export const commentStrippingWriter: ReferenceWriter = (original, format) =>
  stripComments(original, format);

/**
 * A key-reordering reference writer. Swaps the two top-level keys
 * listed in targetPath (or the first two unrelated top-level keys if
 * targetPath is empty). The harness must fire the `keyOrder` check.
 */
export const keyReorderingWriter: ReferenceWriter = (original, format) => {
  // Pick two unrelated top-level keys based on format.
  if (format === 'json' || format === 'jsonc') {
    return swapTopLevelKeys(
      original,
      format,
      'numStartups',
      'autoUpdaterStatus',
    );
  }
  if (format === 'toml') {
    return swapTopLevelKeys(original, format, 'model', 'approval_mode');
  }
  return original;
};

/**
 * A reference writer that deletes an unrelated top-level key. The
 * harness must fire the `topLevelKeys` check.
 */
export const unrelatedKeyDeletingWriter: ReferenceWriter = (
  original,
  format,
) => {
  if (format === 'json' || format === 'jsonc') {
    return deleteTopLevelKey(original, format, 'numStartups');
  }
  if (format === 'toml') {
    return deleteTopLevelKey(original, format, 'model');
  }
  return original;
};

/**
 * A reference writer that deletes an unrelated MCP server. The
 * harness must fire the `mcpServers` check.
 */
export const unrelatedServerDeletingWriter: ReferenceWriter = (
  original,
  format,
  targetPath,
) => {
  if (targetPath.length === 0) return original;
  const mcpKey = targetPath[0]!;
  const touched = targetPath.length > 1 ? targetPath[1]! : '';
  // Pick an unrelated server name based on format.
  const unrelated = format === 'toml' ? 'context7' : 'context7';
  if (unrelated === touched) return original;
  return deleteMcpServer(original, format, mcpKey, unrelated);
};

/**
 * A reference writer that drifts indentation by +2 spaces. The
 * harness must fire the `formatting` check.
 */
export const whitespaceDriftingWriter: ReferenceWriter = (original) =>
  driftIndentation(original, 2);

/**
 * A non-idempotent reference writer that appends a trailing newline
 * on every apply. Applied twice, the second output has a double
 * trailing newline. The harness must fire the `idempotency` check.
 */
export const nonIdempotentWriter: ReferenceWriter = (original) =>
  appendString(original, '\n');

/**
 * A reference writer that deletes the trailing newline. The harness
 * must fire the `formatting` check.
 */
export const trailingNewlineDeletingWriter: ReferenceWriter = (original) =>
  deleteTrailingNewline(original);
