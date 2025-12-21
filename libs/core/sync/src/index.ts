/**
 * @overture/sync-core - MCP Configuration Synchronization
 *
 * Core library for orchestrating MCP configuration synchronization to multiple clients.
 * Provides dependency-injected services following hexagonal architecture principles.
 *
 * @module @overture/sync-core
 * @version 3.0
 */

// Sync Engine
export { SyncEngine, createSyncEngine } from './lib/sync-engine.js';
export type {
  SyncEngineDeps,
  SyncOptions,
  SyncResult,
  ClientSyncResult,
  PluginSyncResult,
} from './lib/sync-engine.js';

// Exclusion Filter
export {
  filterMcpsForClient,
  shouldIncludeMcp,
  getExcludedMcps,
  getFilterSummary,
  validateRequiredMcps,
} from './lib/exclusion-filter.js';
export type {
  FilterResult,
  FilterSummary,
  ValidationResult,
} from './lib/exclusion-filter.js';

// Config Diff
export {
  generateDiff,
  formatDiff,
  formatDiffSummary,
} from './lib/config-diff.js';
export type {
  ConfigDiff,
  McpChange,
  FieldChange,
  ChangeType,
} from './lib/config-diff.js';

// Transport Validator
export {
  validateMcpTransport,
  validateAllTransports,
  getTransportWarnings,
  filterByTransport,
  getTransportValidationSummary,
  hasTransportIssues,
  formatTransportWarnings,
} from './lib/transport-validator.js';
export type {
  TransportValidation,
  TransportValidationSummary,
  TransportWarning,
} from './lib/transport-validator.js';

// Environment Validator
export {
  extractEnvVars,
  validateEnvVarSyntax,
  isHardcodedValue,
  validateMcpEnvVars,
  getEnvVarErrors,
  getEnvVarWarnings,
  getEnvVarValidationSummary,
  formatEnvVarErrors,
  formatEnvVarWarnings,
} from './lib/environment-validator.js';
export type {
  EnvVarValidation,
  EnvVarError,
  EnvVarWarning,
  EnvVarValidationSummary,
} from './lib/environment-validator.js';

// Client Environment Service
export {
  shouldExpandEnvVars,
  expandEnvVarsInMcpConfig,
  expandEnvVarsInClientConfig,
  getClientsNeedingExpansion,
  getClientsWithNativeSupport,
} from './lib/client-env-service.js';

// Backup Service
export { BackupService } from './lib/backup-service.js';
export type {
  BackupMetadata,
  BackupServiceDeps,
} from './lib/backup-service.js';

// Restore Service
export { RestoreService } from './lib/restore-service.js';
export type {
  RestoreResult,
  ComparisonResult,
  RestoreServiceDeps,
} from './lib/restore-service.js';

// Audit Service
export { AuditService } from './lib/audit-service.js';

// MCP Detector
export { compareMcpConfigs, getUnmanagedMcps } from './lib/mcp-detector.js';
export type { DetectedMcp, McpDetectionResult } from './lib/mcp-detector.js';

// Environment Variable Expander
export {
  expandEnvVars,
  expandEnvVarsRecursive,
  expandEnvVarsInObject,
  hasEnvVars,
  extractEnvVarNames,
  validateEnvVars,
  expandEnvVarsInArgs,
} from './lib/env-expander.js';
