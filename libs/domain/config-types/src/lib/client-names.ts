/**
 * Client Name Constants
 *
 * Centralized definitions of supported AI client names.
 * Use these constants instead of hardcoding client names throughout the codebase.
 *
 * @module lib/client-names
 */

/**
 * Actively supported client names for MCP configuration sync
 */
export const SUPPORTED_CLIENTS = [
  'claude-code',
  'copilot-cli',
  'opencode',
] as const;

/**
 * Type for actively supported client names
 */
export type SupportedClientName = (typeof SUPPORTED_CLIENTS)[number];

/**
 * All known client names including deprecated/legacy ones
 * Used for validation and migration warnings
 */
export const ALL_KNOWN_CLIENTS = [
  ...SUPPORTED_CLIENTS,
  'claude-desktop',
  'vscode',
  'cursor',
  'windsurf',
  'jetbrains-copilot',
  'codex',
  'gemini-cli',
] as const;

/**
 * Type for all known client names
 */
export type KnownClientName = (typeof ALL_KNOWN_CLIENTS)[number];
