/**
 * @module @overture/config-types/client-types
 */

import type {
  ClientName,
  DetectionEnvironment,
  Platform,
  MergeStrategy,
} from './base-types.js';

export interface ClientConfig {
  enabled: boolean;
  configPath?: string | Partial<Record<Platform, string>>;
  maxServers?: number;
  settings?: Record<string, unknown>;
}

export interface PluginConfig {
  marketplace: string;
  enabled: boolean;
  mcps?: string[];
}

export interface SyncOptions {
  backup: boolean;
  backupDir: string;
  backupRetention: number;
  mergeStrategy: MergeStrategy;
  autoDetectClients: boolean;
  enabledClients?: ClientName[];
  skipBinaryDetection?: boolean;
  skipPlugins?: boolean;
}

export interface ClientDiscoveryOverride {
  binary_path?: string;
  config_path?: string;
  app_bundle_path?: string;
  enabled?: boolean;
}

export interface WSL2Config {
  windows_user_profile?: string;
  windows_binary_paths?: string[];
  windows_config_paths?: Partial<Record<ClientName, string>>;
}

export interface DiscoveryConfig {
  enabled?: boolean;
  timeout?: number;
  wsl2_auto_detect?: boolean;
  environment?: DetectionEnvironment;
  clients?: Partial<Record<ClientName, ClientDiscoveryOverride>>;
  wsl2?: WSL2Config;
}
