/**
 * @module config.types
 */

export * from './base-types.js';
export * from './mcp-types.js';
export * from './client-types.js';
export * from './sync-types.js';
export * from './validation-types.js';
export * from './utility-types.js';
export * from './agent-types.js';

import type { ClientName } from './base-types.js';
import type { McpServerConfig, ClientMcpConfig } from './mcp-types.js';
import type {
  ClientConfig,
  PluginConfig,
  SyncOptions,
  DiscoveryConfig,
} from './client-types.js';

/**
 * Overture v2.0 Configuration (User Global)
 *
 * This is the main configuration file for Overture v2.0.
 * Location: ~/.config/overture.yml
 *
 * Note: Scope is implicit based on file location.
 * - MCPs in ~/.config/overture.yml are global (synced to ~/.claude.json)
 * - MCPs in .overture/config.yaml are project-scoped (synced to .mcp.json)
 *
 * @example
 * ```yaml
 * version: "2.0"
 *
 * clients:
 *   claude-code:
 *     enabled: true
 *   claude-desktop:
 *     enabled: true
 *   vscode:
 *     enabled: false
 *
 * mcp:
 *   github:
 *     command: mcp-server-github
 *     args: []
 *     env:
 *       GITHUB_TOKEN: "${GITHUB_TOKEN}"
 *     transport: stdio
 *
 * sync:
 *   backup: true
 *   mergeStrategy: append
 * ```
 */
export interface OvertureConfig {
  /**
   * Configuration schema version
   * @example "2.0"
   */
  version: string;

  /**
   * Client-specific configurations
   * Key: ClientName, Value: ClientConfig
   */
  clients?: Partial<Record<ClientName, ClientConfig>>;

  /**
   * Plugin configurations
   * Key: Plugin name, Value: PluginConfig
   */
  plugins?: Record<string, PluginConfig>;

  /**
   * MCP server definitions
   * Key: MCP server name, Value: McpServerConfig
   */
  mcp: Record<string, McpServerConfig>;

  /**
   * Synchronization options
   */
  sync?: SyncOptions;

  /**
   * Discovery configuration for CLI/tool detection
   */
  discovery?: DiscoveryConfig;
}

/**
 * Type guard to check if value is ClientMcpConfig
 *
 * @param value - Value to check
 * @returns True if value is a valid ClientMcpConfig object
 *
 * @example
 * if (isClientMcpConfig(data)) {
 *   // TypeScript knows data is ClientMcpConfig
 *   console.log(data.mcpServers);
 * }
 */
export function isClientMcpConfig(value: unknown): value is ClientMcpConfig {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  // Check if it has at least one object-valued property
  // (could be mcpServers, servers, or other client-specific keys)
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      // eslint-disable-next-line security/detect-object-injection -- Safe: key existence verified with hasOwn
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        return true;
      }
    }
  }

  return true; // Empty config is valid
}
