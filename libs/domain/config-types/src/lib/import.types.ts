/**
 * Import Types
 *
 * Type definitions remaining after import command removal.
 * Kept for adapter compatibility.
 *
 * @module @overture/config-types/import
 */

import type { McpServerConfig } from './config.types.js';

/**
 * Claude Code's full config structure (for reading ~/.claude.json)
 *
 * Note: This type is kept for adapter compatibility even though
 * the import functionality has been removed. It may be used by
 * future features that need to read Claude Code's full configuration.
 */
export interface ClaudeCodeFullConfig {
  /** Top-level (global) MCP servers */
  mcpServers?: Record<string, McpServerConfig>;
  /** Directory-specific configurations */
  projects?: Record<
    string,
    {
      mcpServers?: Record<string, McpServerConfig>;
      enabledMcpjsonServers?: string[];
      disabledMcpjsonServers?: string[];
      allowedTools?: string[];
      mcpContextUris?: string[];
      ignorePatterns?: string[];
      hasTrustDialogAccepted?: boolean;
      [key: string]: unknown;
    }
  >;
  /** Other user settings */
  [key: string]: unknown;
}
