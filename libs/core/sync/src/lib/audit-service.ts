/**
 * Audit Service
 *
 * Detects MCPs configured directly in client configs that are NOT managed by Overture.
 * Helps users discover unmanaged MCPs they might want to add to their Overture config.
 *
 * @module @overture/sync-core/audit-service
 * @version 3.0
 */

import type { ClientAdapter } from '@overture/client-adapters';
import type {
  OvertureConfig,
  ClientName,
  Platform,
} from '@overture/config-types';

/**
 * Audit service for detecting unmanaged MCPs
 *
 * Scans client configurations and identifies MCP servers that exist in client configs
 * but are not managed by Overture. Provides suggestions for consolidating configuration.
 */
export class AuditService {
  /**
   * Audit a single client for unmanaged MCPs
   *
   * Reads the client's MCP configuration and compares against Overture's managed MCPs.
   *
   * @param adapter - Client adapter to audit
   * @param overtureConfig - Current Overture configuration
   * @param platform - Target platform
   * @returns Array of unmanaged MCP names
   *
   * @example
   * ```typescript
   * const service = new AuditService();
   * const adapter = new ClaudeCodeAdapter();
   * const config = loadConfig();
   * const unmanaged = service.auditClient(adapter, config, 'linux');
   * // => ['filesystem', 'slack']
   * ```
   */
  async auditClient(
    adapter: ClientAdapter,
    overtureConfig: OvertureConfig,
    platform: Platform,
  ): Promise<string[]> {
    // Detect config path
    const configPath = adapter.detectConfigPath(platform);

    // If client not installed, skip
    if (!configPath) {
      return [];
    }

    // Collect all MCP names from client configs
    const clientMcps = new Set<string>();

    // Handle different config path formats
    if (typeof configPath === 'string') {
      // Single config path (e.g., Claude Desktop)
      const config = await adapter.readConfig(configPath);
      const rootKey = adapter.schemaRootKey;

      if (config[rootKey]) {
        Object.keys(config[rootKey]).forEach((name) => clientMcps.add(name));
      }
    } else {
      // User + project config paths (e.g., Claude Code)
      const userConfig = await adapter.readConfig(configPath.user);
      const projectConfig = await adapter.readConfig(configPath.project);

      const rootKey = adapter.schemaRootKey;

      if (userConfig[rootKey]) {
        Object.keys(userConfig[rootKey]).forEach((name) =>
          clientMcps.add(name),
        );
      }

      if (projectConfig[rootKey]) {
        Object.keys(projectConfig[rootKey]).forEach((name) =>
          clientMcps.add(name),
        );
      }
    }

    // Get Overture managed MCPs
    const overtureMcps = Object.keys(overtureConfig.mcp);

    // Compare and find unmanaged
    return this.compareConfigs(Array.from(clientMcps), overtureMcps);
  }

  /**
   * Audit all clients for unmanaged MCPs
   *
   * Audits multiple clients and returns a mapping of client names to unmanaged MCP lists.
   *
   * @param adapters - Array of client adapters to audit
   * @param overtureConfig - Current Overture configuration
   * @param platform - Target platform
   * @returns Object mapping client names to arrays of unmanaged MCP names
   *
   * @example
   * ```typescript
   * const service = new AuditService();
   * const adapters = [new ClaudeCodeAdapter(), new VSCodeAdapter()];
   * const config = loadConfig();
   * const result = service.auditAllClients(adapters, config, 'linux');
   * // => { 'claude-code': ['filesystem'], 'vscode': ['slack'] }
   * ```
   */
  async auditAllClients(
    adapters: ClientAdapter[],
    overtureConfig: OvertureConfig,
    platform: Platform,
  ): Promise<Partial<Record<ClientName, string[]>>> {
    const result: Partial<Record<ClientName, string[]>> = {};

    for (const adapter of adapters) {
      const unmanaged = await this.auditClient(
        adapter,
        overtureConfig,
        platform,
      );

      // Only include clients with unmanaged MCPs
      if (unmanaged.length > 0) {
        result[adapter.name] = unmanaged;
      }
    }

    return result;
  }

  /**
   * Compare client MCPs against Overture MCPs
   *
   * Identifies which MCPs from the client config are not managed by Overture.
   *
   * @param clientMcps - MCP names from client config
   * @param overtureMcps - MCP names from Overture config
   * @returns Array of unmanaged MCP names
   *
   * @example
   * ```typescript
   * const service = new AuditService();
   * const unmanaged = service.compareConfigs(
   *   ['github', 'filesystem', 'slack'],
   *   ['github']
   * );
   * // => ['filesystem', 'slack']
   * ```
   */
  compareConfigs(clientMcps: string[], overtureMcps: string[]): string[] {
    const overtureMcpSet = new Set(overtureMcps);
    return clientMcps.filter((name) => !overtureMcpSet.has(name));
  }

  /**
   * Generate suggestions for adding unmanaged MCPs
   *
   * Creates `overture user add mcp <name>` commands for each unique unmanaged MCP.
   *
   * @param unmanagedByClient - Mapping of client names to unmanaged MCP arrays
   * @returns Array of suggested commands
   *
   * @example
   * ```typescript
   * const service = new AuditService();
   * const suggestions = service.generateSuggestions({
   *   'claude-code': ['filesystem', 'slack'],
   *   'vscode': ['github']
   * });
   * // => [
   * //   'overture user add mcp filesystem',
   * //   'overture user add mcp github',
   * //   'overture user add mcp slack'
   * // ]
   * ```
   */
  generateSuggestions(
    unmanagedByClient: Record<ClientName, string[]>,
  ): string[] {
    // Collect all unique unmanaged MCPs
    const allUnmanaged = new Set<string>();

    for (const mcps of Object.values(unmanagedByClient)) {
      mcps.forEach((name) => allUnmanaged.add(name));
    }

    // Generate suggestions (sorted alphabetically)
    return Array.from(allUnmanaged)
      .sort()
      .map((name) => `overture user add mcp ${name}`);
  }
}
