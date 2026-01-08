/**
 * @module @overture/config-types/client-types
 */

import type {
  ClientName,
  DetectionEnvironment,
  Platform,
  MergeStrategy,
} from './base-types.js';

/**
 * Per-client configuration.
 */
export interface ClientConfig {
  /** Whether client is enabled */
  enabled: boolean;
  /** Path to config file (string or per-platform) */
  configPath?: string | Partial<Record<Platform, string>>;
  /** Maximum concurrent servers */
  maxServers?: number;
  /** Client-specific settings */
  settings?: Record<string, unknown>;
}

/**
 * Plugin configuration.
 */
export interface PluginConfig {
  /** Plugin marketplace identifier */
  marketplace: string;
  /** Whether plugin is enabled */
  enabled: boolean;
  /** Associated MCP servers */
  mcps?: string[];
}

/**
 * Sync operation options.
 */
export interface SyncOptions {
  /** Create backups before changes */
  backup: boolean;
  /** Backup directory path */
  backupDir: string;
  /** Number of backups to retain */
  backupRetention: number;
  /** Strategy for merging configs */
  mergeStrategy: MergeStrategy;
  /** Auto-detect clients */
  autoDetectClients: boolean;
  /** Explicitly enabled clients */
  enabledClients?: ClientName[];
  /** Skip binary detection */
  skipBinaryDetection?: boolean;
  /** Skip plugin discovery */
  skipPlugins?: boolean;
}

/**
 * Per-client discovery overrides.
 */
export interface ClientDiscoveryOverride {
  /** Override binary path */
  binary_path?: string;
  /** Override config path */
  config_path?: string;
  /** Override app bundle path (macOS) */
  app_bundle_path?: string;
  /** Whether client is enabled for discovery */
  enabled?: boolean;
}

/**
 * WSL2-specific configuration.
 */
export interface WSL2Config {
  /** Windows user profile path */
  windows_user_profile?: string;
  /** Additional Windows binary search paths */
  windows_binary_paths?: string[];
  /** Per-client Windows config paths */
  windows_config_paths?: Partial<Record<ClientName, string>>;
}

/**
 * Client discovery configuration.
 */
export interface DiscoveryConfig {
  /** Enable auto-discovery */
  enabled?: boolean;
  /** Discovery timeout (ms) */
  timeout?: number;
  /** Auto-detect WSL2 clients */
  wsl2_auto_detect?: boolean;
  /** Detection environment */
  environment?: DetectionEnvironment;
  /** Per-client overrides */
  clients?: Partial<Record<ClientName, ClientDiscoveryOverride>>;
  /** WSL2 configuration */
  wsl2?: WSL2Config;
}
