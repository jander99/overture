/**
 * Zod Schema Validators for Overture v2.0 Configuration
 *
 * These schemas validate the structure and constraints of Overture configuration files.
 * They provide runtime validation and type inference for user and project configs.
 *
 * @module domain/config.schema
 * @version 2.0
 */

import { z } from 'zod';

/**
 * Platform type schema
 */
export const PlatformSchema = z.enum(['darwin', 'linux', 'win32']);

/**
 * Transport type schema
 */
export const TransportTypeSchema = z.enum(['stdio', 'http', 'sse']);

/**
 * Scope schema
 * @deprecated Scope is now implicit based on config file location (user vs project)
 */
export const ScopeSchema = z.enum(['global', 'project']);

/**
 * Client name schema
 */
export const ClientNameSchema = z.enum([
  'claude-code',
  'claude-desktop',
  'vscode',
  'cursor',
  'windsurf',
  'copilot-cli',
  'jetbrains-copilot',
]);

/**
 * Merge strategy schema
 */
export const MergeStrategySchema = z.enum(['append', 'replace']);

/**
 * Environment variable expansion pattern validation
 * Supports: ${VAR} and ${VAR:-default}
 */
const EnvVarPatternSchema = z
  .string()
  .regex(/^[^$]*(\$\{[A-Z_][A-Z0-9_]*(:-.+)?\}[^$]*)*$/, 'Invalid environment variable syntax');

/**
 * MCP Server Override Schema
 *
 * Partial schema for client-specific MCP server overrides.
 * Allows overriding any field from the base MCP config.
 */
const McpServerOverrideSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), EnvVarPatternSchema).optional(),
  transport: TransportTypeSchema.optional(),
  version: z.string().optional(),
});

/**
 * MCP Server Configuration Schema (v2.0)
 *
 * Validates MCP server definitions with required transport field.
 */
export const McpServerConfigSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), EnvVarPatternSchema).default({}),
  transport: TransportTypeSchema, // REQUIRED in v2.0
  version: z.string().optional(), // Optional, defaults to "latest"
  enabled: z.boolean().optional(), // Allow disabling MCPs
  description: z.string().optional(), // Human-readable description
  clients: z
    .object({
      exclude: z.array(ClientNameSchema).optional(),
      include: z.array(ClientNameSchema).optional(),
      overrides: z.record(z.string(), McpServerOverrideSchema).optional(),
    })
    .strict()
    .optional()
    .refine(
      (data) => {
        // Ensure exclude and include are mutually exclusive
        if (data && data.exclude && data.include) {
          return false;
        }
        return true;
      },
      {
        message: 'Cannot specify both "exclude" and "include" - use one or the other',
      }
    ),
  platforms: z
    .object({
      exclude: z.array(PlatformSchema).optional(),
      commandOverrides: z.record(z.string(), z.string()).optional(),
      argsOverrides: z.record(z.string(), z.array(z.string())).optional(),
    })
    .strict()
    .optional(),
  metadata: z
    .object({
      description: z.string().optional(),
      homepage: z.string().url().optional(),
      tags: z.array(z.string()).optional(),
    })
    .strict()
    .optional(),
}).strict(); // Reject unknown fields like 'scope'

/**
 * Client Configuration Schema
 */
export const ClientConfigSchema = z.object({
  enabled: z.boolean().default(true),
  configPath: z.union([z.string(), z.record(PlatformSchema, z.string())]).optional(),
  maxServers: z.number().int().positive().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
}).strict();

/**
 * Sync Options Schema
 */
export const SyncOptionsSchema = z.object({
  backup: z.boolean().default(true),
  backupDir: z.string().default('~/.config/overture/backups'),
  backupRetention: z.number().int().positive().default(10),
  mergeStrategy: MergeStrategySchema.default('append'),
  autoDetectClients: z.boolean().default(true),
  enabledClients: z.array(ClientNameSchema).optional(),
  skipBinaryDetection: z.boolean().default(false),
}).strict();

/**
 * Project Configuration Schema
 *
 * Metadata about the project using Overture.
 */
export const ProjectConfigSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  type: z.string().optional(),
  description: z.string().optional(),
}).strict();

/**
 * Plugin Configuration Schema
 *
 * Configuration for Claude Code plugins.
 */
export const PluginConfigSchema = z.object({
  marketplace: z.string().min(1, 'Marketplace name is required'),
  enabled: z.boolean().default(true),
  mcps: z.array(z.string()).default([]),
}).strict();

/**
 * Main Overture v2.0 Configuration Schema
 *
 * Validates the complete user or project configuration file.
 */
export const OvertureConfigSchema = z.object({
  version: z.string().regex(/^\d+\.\d+$/, 'Version must be in format "X.Y"'),
  project: ProjectConfigSchema.optional(),
  plugins: z.record(z.string(), PluginConfigSchema).optional(),
  clients: z.record(z.string(), ClientConfigSchema).optional(),
  mcp: z.record(z.string(), McpServerConfigSchema),
  sync: SyncOptionsSchema.optional(),
}).strict(); // Reject unknown fields at top level

/**
 * Client MCP Server Definition Schema
 *
 * Schema for client-specific MCP server configuration (generated output).
 */
export const ClientMcpServerDefSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  type: TransportTypeSchema.optional(), // VS Code requires "type" field
  url: z.string().url().optional(), // For HTTP transport
});

/**
 * Client MCP Configuration Schema (Generated)
 *
 * Schema for client-specific config files (e.g., .mcp.json, claude_desktop_config.json).
 */
export const ClientMcpConfigSchema = z.record(z.string(), z.record(z.string(), ClientMcpServerDefSchema));

/**
 * Sync Result Schemas
 */
export const ClientSyncResultSchema = z.object({
  success: z.boolean(),
  synced: z.array(z.string()),
  skipped: z.array(z.string()),
  backupPath: z.string().optional(),
  error: z.instanceof(Error).optional(),
});

export const SyncResultSchema = z.object({
  success: z.boolean(),
  clients: z.record(ClientNameSchema, ClientSyncResultSchema),
  summary: z.object({
    totalClients: z.number().int().nonnegative(),
    successfulClients: z.number().int().nonnegative(),
    failedClients: z.number().int().nonnegative(),
    totalMcps: z.number().int().nonnegative(),
    syncedMcps: z.number().int().nonnegative(),
    skippedMcps: z.number().int().nonnegative(),
  }),
  errors: z.array(z.instanceof(Error)),
});

/**
 * Backup Metadata Schema
 */
export const BackupMetadataSchema = z.object({
  client: ClientNameSchema,
  path: z.string(),
  timestamp: z.date(),
  originalPath: z.string(),
  size: z.number().int().nonnegative(),
  checksum: z.string().optional(),
});

/**
 * Audit Result Schema
 */
export const AuditResultSchema = z.object({
  managed: z.array(z.string()),
  unmanaged: z.record(ClientNameSchema, z.array(z.string())),
  totalUnmanaged: z.number().int().nonnegative(),
  suggestions: z.array(z.string()),
});

/**
 * Validation Result Schemas
 */
export const ValidationErrorSchema = z.object({
  message: z.string(),
  path: z.string(),
  code: z.string(),
});

export const ValidationWarningSchema = z.object({
  message: z.string(),
  path: z.string(),
  suggestion: z.string().optional(),
});

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(ValidationErrorSchema),
  warnings: z.array(ValidationWarningSchema),
});

/**
 * Process Lock Schema
 */
export const ProcessLockSchema = z.object({
  pid: z.number().int().positive(),
  timestamp: z.date(),
  command: z.string(),
  lockPath: z.string(),
});

/**
 * Type inference helpers
 */
export type Platform = z.infer<typeof PlatformSchema>;
export type TransportType = z.infer<typeof TransportTypeSchema>;
export type Scope = z.infer<typeof ScopeSchema>;
export type ClientName = z.infer<typeof ClientNameSchema>;
export type MergeStrategy = z.infer<typeof MergeStrategySchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type ClientConfig = z.infer<typeof ClientConfigSchema>;
export type SyncOptions = z.infer<typeof SyncOptionsSchema>;
export type OvertureConfig = z.infer<typeof OvertureConfigSchema>;
export type ClientMcpServerDef = z.infer<typeof ClientMcpServerDefSchema>;
export type ClientMcpConfig = z.infer<typeof ClientMcpConfigSchema>;
export type ClientSyncResult = z.infer<typeof ClientSyncResultSchema>;
export type SyncResult = z.infer<typeof SyncResultSchema>;
export type BackupMetadata = z.infer<typeof BackupMetadataSchema>;
export type AuditResult = z.infer<typeof AuditResultSchema>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export type ValidationWarning = z.infer<typeof ValidationWarningSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type ProcessLock = z.infer<typeof ProcessLockSchema>;
