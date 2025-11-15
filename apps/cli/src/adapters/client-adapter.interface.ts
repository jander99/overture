/**
 * Client Adapter Interface
 *
 * Defines the contract for all client adapters. Each AI client (Claude Code, VS Code, etc.)
 * has its own adapter implementing this interface to handle client-specific config formats.
 *
 * @module adapters/client-adapter.interface
 * @version 2.0
 */

import type { Platform, ClientName, TransportType, OvertureConfig } from '../domain/config.types';

/**
 * Client MCP configuration format
 *
 * The root structure varies by client:
 * - Most clients: { "mcpServers": { ... } }
 * - VS Code: { "servers": { ... } }
 */
export interface ClientMcpConfig {
  [rootKey: string]: Record<string, ClientMcpServerDef>;
}

/**
 * Client-specific MCP server definition
 *
 * Minimal fields required by clients after conversion.
 */
export interface ClientMcpServerDef {
  command: string;
  args: string[];
  env?: Record<string, string>;
  type?: TransportType; // VS Code requires "type" field
  url?: string; // For HTTP transport
}

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
   *
   * @example
   * ```typescript
   * // Client with only user config
   * detectConfigPath('darwin') // => '/Users/user/Library/Application Support/Claude/claude_desktop_config.json'
   *
   * // Client with user + project configs
   * detectConfigPath('linux', '/home/user/project') // => { user: '...', project: '...' }
   * ```
   */
  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult;

  /**
   * Read client config from file
   *
   * @param path - Config file path
   * @returns Parsed client config or empty config if file doesn't exist
   * @throws Error if file exists but cannot be read/parsed
   */
  readConfig(path: string): ClientMcpConfig;

  /**
   * Write client config to file
   *
   * @param path - Config file path
   * @param config - Client config to write
   * @throws Error if file cannot be written
   */
  writeConfig(path: string, config: ClientMcpConfig): void;

  /**
   * Convert Overture config to client-specific format
   *
   * Filters MCPs based on:
   * - Client exclusions (mcp.clients.exclude)
   * - Client inclusions (mcp.clients.include)
   * - Platform exclusions (mcp.platforms.exclude)
   * - Transport support
   *
   * Applies:
   * - Client-specific overrides (mcp.clients.overrides[clientName])
   * - Platform-specific overrides (mcp.platforms.commandOverrides, argsOverrides)
   * - Environment variable expansion (if needed)
   *
   * @param overtureConfig - Full Overture configuration
   * @param platform - Target platform
   * @returns Client-specific config ready to write
   */
  convertFromOverture(overtureConfig: OvertureConfig, platform: Platform): ClientMcpConfig;

  /**
   * Check if client supports a transport type
   *
   * @param transport - Transport type to check
   * @returns True if transport is supported
   *
   * @example
   * ```typescript
   * claudeCode.supportsTransport('stdio') // => true
   * claudeCode.supportsTransport('http') // => true
   * claudeCode.supportsTransport('sse') // => true
   *
   * claudeDesktop.supportsTransport('stdio') // => true
   * claudeDesktop.supportsTransport('http') // => false (as of 2025-11)
   * ```
   */
  supportsTransport(transport: TransportType): boolean;

  /**
   * Check if Overture needs to expand environment variables
   *
   * Some clients support native ${VAR} expansion, others require Overture to expand.
   *
   * @returns True if Overture should expand env vars before writing config
   *
   * @example
   * ```typescript
   * claudeCode.needsEnvVarExpansion() // => false (native support)
   * vscode.needsEnvVarExpansion() // => true (Overture must expand)
   * ```
   */
  needsEnvVarExpansion(): boolean;

  /**
   * Check if client is installed
   *
   * Convenience method to check if config path can be detected.
   *
   * @param platform - Target platform
   * @returns True if client appears to be installed
   */
  isInstalled(platform: Platform): boolean;

  /**
   * Get CLI binary names to detect for this client
   *
   * Returns array of binary names that should be checked in PATH.
   * Empty array for GUI-only clients.
   *
   * @returns Array of binary names
   *
   * @example
   * ```typescript
   * claudeCode.getBinaryNames() // => ['claude']
   * vscode.getBinaryNames() // => ['code']
   * claudeDesktop.getBinaryNames() // => [] (GUI-only)
   * ```
   */
  getBinaryNames(): string[];

  /**
   * Get application bundle paths to check for this client
   *
   * Returns platform-specific paths to application bundles.
   * Empty array for CLI-only clients.
   *
   * @param platform - Target platform
   * @returns Array of app bundle paths to check
   *
   * @example
   * ```typescript
   * claudeDesktop.getAppBundlePaths('darwin') // => ['/Applications/Claude.app']
   * claudeDesktop.getAppBundlePaths('win32') // => ['C:\\Program Files\\Claude\\Claude.exe']
   * claudeCode.getAppBundlePaths('darwin') // => [] (CLI-only)
   * ```
   */
  getAppBundlePaths(platform: Platform): string[];

  /**
   * Check if this client requires a binary to function
   *
   * - true: Client requires CLI binary (e.g., claude-code)
   * - false: Client can work with just app bundle (e.g., claude-desktop)
   *
   * @returns True if binary is required
   *
   * @example
   * ```typescript
   * claudeCode.requiresBinary() // => true (CLI-only)
   * claudeDesktop.requiresBinary() // => false (app bundle sufficient)
   * windsurf.requiresBinary() // => false (either binary OR app bundle)
   * ```
   */
  requiresBinary(): boolean;
}

/**
 * Base adapter class with common functionality
 *
 * Provides default implementations for common adapter methods.
 */
export abstract class BaseClientAdapter implements ClientAdapter {
  abstract readonly name: ClientName;
  abstract readonly schemaRootKey: 'mcpServers' | 'servers';

  abstract detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult;
  abstract readConfig(path: string): ClientMcpConfig;
  abstract writeConfig(path: string, config: ClientMcpConfig): void;
  abstract convertFromOverture(overtureConfig: OvertureConfig, platform: Platform): ClientMcpConfig;
  abstract supportsTransport(transport: TransportType): boolean;
  abstract needsEnvVarExpansion(): boolean;

  /**
   * Default implementation: Check if detectConfigPath returns non-null
   */
  isInstalled(platform: Platform): boolean {
    const path = this.detectConfigPath(platform);
    return path !== null;
  }

  /**
   * Default implementation: No binary names (subclasses should override)
   */
  getBinaryNames(): string[] {
    return [];
  }

  /**
   * Default implementation: No app bundle paths (subclasses should override)
   */
  getAppBundlePaths(_platform: Platform): string[] {
    return [];
  }

  /**
   * Default implementation: Binary not required (subclasses should override)
   */
  requiresBinary(): boolean {
    return false;
  }

  /**
   * Helper: Check if MCP should be synced to this client
   *
   * @param mcpConfig - MCP server configuration
   * @param platform - Target platform
   * @returns True if MCP should be included for this client
   */
  protected shouldSyncMcp(
    mcpConfig: OvertureConfig['mcp'][string],
    platform: Platform
  ): boolean {
    // Check platform exclusions
    if (mcpConfig.platforms?.exclude?.includes(platform)) {
      return false;
    }

    // Check client exclusions
    if (mcpConfig.clients?.exclude?.includes(this.name)) {
      return false;
    }

    // Check client inclusions (whitelist)
    if (mcpConfig.clients?.include && !mcpConfig.clients.include.includes(this.name)) {
      return false;
    }

    // Check transport support
    if (!this.supportsTransport(mcpConfig.transport)) {
      return false;
    }

    return true;
  }
}
