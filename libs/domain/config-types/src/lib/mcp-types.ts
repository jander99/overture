/**
 * @module @overture/config-types/mcp-types
 */

import type { ClientName, Platform, TransportType } from './base-types.js';

export interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
  transport: TransportType;
  version?: string;
  clients?: {
    exclude?: ClientName[];
    include?: ClientName[];
    overrides?: Record<ClientName, Partial<McpServerConfig>>;
  };
  platforms?: {
    exclude?: Platform[];
    commandOverrides?: Partial<Record<Platform, string>>;
    argsOverrides?: Partial<Record<Platform, string[]>>;
  };
  metadata?: {
    description?: string;
    homepage?: string;
    tags?: string[];
  };
}

export interface ClientMcpConfig {
  [rootKey: string]: Record<string, ClientMcpServerDef>;
}

export interface ClientMcpServerDef {
  command: string;
  args: string[];
  env?: Record<string, string>;
  type?: TransportType;
  disabled?: boolean;
  alwaysAllow?: string[];
  url?: string;
  [key: string]: unknown;
}
