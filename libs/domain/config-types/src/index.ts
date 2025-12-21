/**
 * @overture/config-types
 *
 * Pure TypeScript type definitions for Overture configuration.
 * This library has ZERO runtime dependencies - types only.
 *
 * @module @overture/config-types
 */

// Client name constants and types
export { SUPPORTED_CLIENTS, ALL_KNOWN_CLIENTS } from './lib/client-names.js';

export type {
  SupportedClientName,
  KnownClientName,
} from './lib/client-names.js';

// Configuration types
export type {
  Platform,
  TransportType,
  Scope,
  ClientName,
  DetectionEnvironment,
  MergeStrategy,
  BinaryDetectionStatus,
  BinaryDetectionResult,
  McpServerConfig,
  ClientConfig,
  PluginConfig,
  SyncOptions,
  ClientDiscoveryOverride,
  WSL2Config,
  DiscoveryConfig,
  OvertureConfig,
  ClientMcpConfig,
  ClientMcpServerDef,
  SyncResult,
  ClientSyncResult,
  BackupMetadata,
  AuditResult,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ProcessLock,
} from './lib/config.types.js';

// Plugin types
export type {
  InstalledPlugin,
  InstallationResult,
  PluginSyncResult,
  ExportOptions,
  DetectionOptions,
  MarketplaceConfig,
  InstallationOptions,
  ClaudeSettings,
  ClaudePluginEntry,
} from './lib/plugin.types.js';

// Discovery types
export type {
  WSL2EnvironmentInfo,
  DetectionSource,
  ConfigSource,
  ClientDiscoveryResult,
  DiscoveryReport,
  DefaultInstallationPaths,
  WindowsDefaultPaths,
} from './lib/discovery.types.js';

// Adapter types
export type { ClientAdapter, ConfigPathResult } from './lib/adapter.types.js';

// Import/Cleanup types
export type {
  McpSource,
  DiscoveredMcp,
  McpConflict,
  ImportDiscoveryResult,
  ImportResult,
  CleanupTarget,
  CleanupResult,
  ClaudeCodeFullConfig,
} from './lib/import.types.js';
