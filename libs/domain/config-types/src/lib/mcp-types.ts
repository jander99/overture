/**
 * @module @overture/config-types/mcp-types
 */

import type { ClientName, Platform, TransportType } from './base-types.js';

/**
 * Configuration for an MCP server.
 *
 * @example
 * ```ts
 * const server: McpServerConfig = {
 *   command: 'node',
 *   args: ['dist/server.js'],
 *   env: { NODE_ENV: 'production' },
 *   transport: 'stdio',
 * };
 * ```
 */
export interface McpServerConfig {
  /** Command to launch the server */
  command: string;
  /** Command-line arguments */
  args: string[];
  /** Environment variables */
  env: Record<string, string>;
  /** Communication transport */
  transport: TransportType;
  /** Server version */
  version?: string;
  /** Client-specific configuration */
  clients?: {
    /** Clients to exclude */
    exclude?: ClientName[];
    /** Clients to include */
    include?: ClientName[];
    /** Per-client overrides */
    overrides?: Record<ClientName, Partial<McpServerConfig>>;
  };
  /** Platform-specific configuration */
  platforms?: {
    /** Platforms to exclude */
    exclude?: Platform[];
    /** Per-platform command overrides */
    commandOverrides?: Partial<Record<Platform, string>>;
    /** Per-platform args overrides */
    argsOverrides?: Partial<Record<Platform, string[]>>;
  };
  /** Server metadata */
  metadata?: {
    /** Human-readable description */
    description?: string;
    /** Homepage URL */
    homepage?: string;
    /** Search tags */
    tags?: string[];
  };
}

/**
 * Client-side MCP configuration.
 * Maps root keys to server definitions.
 */
export interface ClientMcpConfig {
  [rootKey: string]: Record<string, ClientMcpServerDef>;
}

/**
 * Client-facing MCP server definition.
 * The format consumed by AI clients.
 */
export interface ClientMcpServerDef {
  /** Command to launch server */
  command: string;
  /** Command arguments */
  args: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Transport type */
  type?: TransportType;
  /** Whether server is disabled */
  disabled?: boolean;
  /** Tools allowed without confirmation */
  alwaysAllow?: string[];
  /** Server URL for remote transports */
  url?: string;
  /** Additional client-specific fields */
  [key: string]: unknown;
}
