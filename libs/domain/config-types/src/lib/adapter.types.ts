/**
 * Client Adapter Types
 *
 * Types for client adapter interfaces used by discovery service.
 *
 * @module @overture/config-types
 */

import type { Platform, ClientName, TransportType } from './config.types.js';

/**
 * Config path result
 *
 * Some clients support both user and project-level configs.
 */
export type ConfigPathResult = string | { user: string; project: string } | null;

/**
 * Client adapter interface
 *
 * All client adapters must implement this interface.
 * This is a minimal interface used by the discovery service.
 */
export interface ClientAdapter {
  /**
   * Client name identifier
   */
  readonly name: ClientName;

  /**
   * Root key for MCP servers in client config
   * - Most clients: "mcpServers"
   * - VS Code: "servers"
   */
  readonly schemaRootKey: 'mcpServers' | 'servers';

  /**
   * Detect client config file path(s)
   *
   * @param platform - Target platform
   * @param projectRoot - Project root directory (for project-level configs)
   * @returns Config path(s) or null if client not installed
   */
  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult;

  /**
   * Check if client supports a transport type
   *
   * @param transport - Transport type to check
   * @returns True if transport is supported
   */
  supportsTransport(transport: TransportType): boolean;

  /**
   * Check if client is installed
   *
   * @param platform - Target platform
   * @returns True if client appears to be installed
   */
  isInstalled(platform: Platform): boolean;

  /**
   * Get CLI binary names to detect for this client
   *
   * @returns Array of binary names
   */
  getBinaryNames(): string[];

  /**
   * Get application bundle paths to check for this client
   *
   * @param platform - Target platform
   * @returns Array of app bundle paths to check
   */
  getAppBundlePaths(platform: Platform): string[];

  /**
   * Check if this client requires a binary to function
   *
   * @returns True if binary is required
   */
  requiresBinary(): boolean;
}
