/**
 * CLI Constants
 *
 * Shared constants used across CLI commands.
 *
 * @module cli/constants
 */

import type { ClientName } from '@overture/config-types';

/**
 * All supported client names
 */
export const ALL_CLIENTS: ClientName[] = [
  'claude-code',
  'copilot-cli',
  'opencode',
] as const;

/**
 * Individual client name constants
 */
export const CLIENTS = {
  CLAUDE_CODE: 'claude-code' as ClientName,
  COPILOT_CLI: 'copilot-cli' as ClientName,
  OPENCODE: 'opencode' as ClientName,
} as const;
