/**
 * Verbose Mode Utility
 *
 * Centralized verbose mode detection used across all CLI commands.
 * Replaces 8 duplicated instances of DEBUG env var checking.
 *
 * @module @overture/cli-utils/verbose-mode
 */

/**
 * Check if verbose mode is enabled via DEBUG environment variable.
 *
 * Returns true if DEBUG is set to '1' or 'true'.
 *
 * @returns true if verbose mode is enabled, false otherwise
 *
 * @example
 * ```typescript
 * import { isVerboseMode } from '@overture/cli-utils';
 *
 * const verbose = isVerboseMode();
 * if (verbose) {
 *   console.log('Debug information...');
 * }
 * ```
 */
export function isVerboseMode(): boolean {
  const debug = process.env.DEBUG;
  return debug === '1' || debug === 'true';
}
