/**
 * @overture/config-types
 *
 * Pure TypeScript type definitions for Overture configuration.
 * This library has ZERO runtime dependencies - types only.
 *
 * @module @overture/config-types
 */

export { SUPPORTED_CLIENTS, ALL_KNOWN_CLIENTS } from './lib/client-names.js';

export type {
  SupportedClientName,
  KnownClientName,
} from './lib/client-names.js';

export type {
  Platform,
  TransportType,
  McpTransport,
  Scope,
  ClientName,
  DetectionEnvironment,
  MergeStrategy,
  BinaryDetectionStatus,
  BinaryDetectionResult,
} from './lib/base-types.js';

export type {
  McpServerConfig,
  ClientMcpConfig,
  ClientMcpServerDef,
} from './lib/mcp-types.js';

export type {
  ClientConfig,
  PluginConfig,
  SyncOptions,
  ClientDiscoveryOverride,
  WSL2Config,
  DiscoveryConfig,
} from './lib/client-types.js';

export type {
  SyncResult,
  ClientSyncResult,
  BackupMetadata,
  AuditResult,
} from './lib/sync-types.js';

export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './lib/validation-types.js';

export type {
  ProcessLock,
  JsonValue,
  JsonObject,
  JsonArray,
} from './lib/utility-types.js';

export type {
  ModelMapping,
  AgentConfig,
  AgentDefinition,
  AgentSyncResult,
  AgentSyncSummary,
} from './lib/agent-types.js';

export type { OvertureConfig } from './lib/config.types.js';

export { isClientMcpConfig } from './lib/config.types.js';

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

export type {
  WSL2EnvironmentInfo,
  DetectionSource,
  ConfigSource,
  ClientDiscoveryResult,
  DiscoveryReport,
  DefaultInstallationPaths,
  WindowsDefaultPaths,
} from './lib/discovery.types.js';

export type { ClientAdapter, ConfigPathResult } from './lib/adapter.types.js';

export type { ClaudeCodeFullConfig } from './lib/import.types.js';

export type {
  DiscoveredSkill,
  SkillSyncResult,
  SkillSyncSummary,
  SkillDiscoveryOptions,
  SkillSyncOptions,
} from './lib/skill.types.js';
