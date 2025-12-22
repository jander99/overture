/**
 * Import Types
 *
 * Type definitions for the import and cleanup functionality.
 *
 * @module @overture/config-types/import
 */

import type { ClientName, McpServerConfig } from './config.types.js';

/**
 * Source information for a discovered MCP
 */
export interface McpSource {
  /** The client where this MCP was found */
  client: ClientName;
  /** Human-readable location description */
  location: string;
  /** Type of configuration location */
  locationType: 'global' | 'project' | 'directory-override';
  /** Full file path to the config */
  filePath: string;
}

/**
 * A discovered MCP server from client configs
 */
export interface DiscoveredMcp {
  /** MCP server name */
  name: string;
  /** Command to run the server */
  command: string;
  /** Command arguments */
  args: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Transport type */
  transport?: 'stdio' | 'http' | 'sse';
  /** Where this MCP was discovered */
  source: McpSource;
  /** Suggested scope for import (global or project) */
  suggestedScope: 'global' | 'project';
  /** Original env before conversion (for reference) */
  originalEnv?: Record<string, string>;
  /** Environment variables that need to be set by user */
  envVarsToSet?: string[];
}

/**
 * Conflict when same MCP has different configs across clients
 */
export interface McpConflict {
  /** MCP server name */
  name: string;
  /** All sources where this MCP was found */
  sources: McpSource[];
  /** The different configurations found */
  configs: Array<{
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
  /** Reason for the conflict */
  reason: 'different-command' | 'different-args' | 'different-env';
}

/**
 * Result of discovering unmanaged MCPs
 */
export interface ImportDiscoveryResult {
  /** MCPs that can be imported */
  discovered: DiscoveredMcp[];
  /** MCPs with conflicting configs */
  conflicts: McpConflict[];
  /** MCP names already managed by Overture */
  alreadyManaged: string[];
}

/**
 * Result of importing MCPs
 */
export interface ImportResult {
  /** MCPs successfully imported */
  imported: DiscoveredMcp[];
  /** MCPs skipped (conflicts or errors) */
  skipped: DiscoveredMcp[];
  /** Environment variables user needs to set */
  envVarsToSet: string[];
  /** Scopes where config was written */
  scopesModified: Array<'global' | 'project'>;
}

/**
 * Target for cleanup operation
 */
export interface CleanupTarget {
  /** Directory path (key in projects object) */
  directory: string;
  /** Whether this directory has an Overture config */
  hasOvertureConfig: boolean;
  /** Path to ~/.claude.json */
  filePath: string;
  /** MCP names to remove (managed by Overture) */
  mcpsToRemove: string[];
  /** MCP names to preserve (not in Overture) */
  mcpsToPreserve: string[];
}

/**
 * Result of cleanup operation
 */
export interface CleanupResult {
  /** Directories cleaned */
  directoriesCleaned: string[];
  /** Total MCPs removed */
  mcpsRemoved: number;
  /** MCPs preserved with warnings */
  mcpsPreserved: Array<{ directory: string; mcpName: string }>;
  /** Backup file path */
  backupPath: string;
}

/**
 * Claude Code's full config structure (for reading ~/.claude.json)
 */
export interface ClaudeCodeFullConfig {
  /** Top-level (global) MCP servers */
  mcpServers?: Record<string, McpServerConfig>;
  /** Directory-specific configurations */
  projects?: Record<
    string,
    {
      mcpServers?: Record<string, McpServerConfig>;
      enabledMcpjsonServers?: string[];
      disabledMcpjsonServers?: string[];
      allowedTools?: string[];
      mcpContextUris?: string[];
      ignorePatterns?: string[];
      hasTrustDialogAccepted?: boolean;
      [key: string]: unknown;
    }
  >;
  /** Other user settings */
  [key: string]: unknown;
}

/**
 * Parse error detail with line/column information
 */
export interface ParseErrorDetail {
  /** Error message */
  message: string;
  /** Line number where error occurred (1-based) */
  line?: number;
  /** Column number where error occurred (1-based) */
  column?: number;
}

/**
 * Status of a configuration file path
 */
export interface ConfigPathStatus {
  /** Full file path */
  path: string;
  /** Config type (user or project) */
  type: 'user' | 'project';
  /** Whether the file exists */
  exists: boolean;
  /** Whether the file is readable */
  readable: boolean;
  /** Parse status */
  parseStatus: 'valid' | 'invalid' | 'not-found';
  /** Parse error if status is 'invalid' */
  parseError?: ParseErrorDetail;
}

/**
 * Client detection result
 */
export interface ClientDetectionResult {
  /** Client name */
  name: ClientName;
  /** Client version (if detected) */
  version?: string;
  /** Binary path (if detected) */
  binaryPath?: string;
  /** Whether client binary was detected on system */
  detected: boolean;
  /** Status of config file paths */
  configPaths: ConfigPathStatus[];
}

/**
 * Managed MCP detection info
 */
export interface ManagedMcpDetection {
  /** MCP server name */
  name: string;
  /** All sources where this managed MCP was found */
  sources: McpSource[];
  /** Always true for managed MCPs */
  inOvertureConfig: true;
}

/**
 * Parse error information
 */
export interface ParseErrorInfo {
  /** Client where parse error occurred */
  client: ClientName;
  /** Config file path where error occurred */
  configPath: string;
  /** Parse error details */
  error: ParseErrorDetail;
}

/**
 * MCP detection categories
 */
export interface McpDetectionCategories {
  /** MCPs already managed by Overture */
  managed: ManagedMcpDetection[];
  /** MCPs not managed by Overture (can be imported) */
  unmanaged: DiscoveredMcp[];
  /** MCPs with conflicting configurations across clients */
  conflicts: McpConflict[];
  /** Config files with parse errors */
  parseErrors: ParseErrorInfo[];
}

/**
 * Detection summary statistics
 */
export interface DetectionSummary {
  /** Number of clients scanned */
  clientsScanned: number;
  /** Total number of unique MCPs found */
  totalMcps: number;
  /** Number of MCPs already managed by Overture */
  managed: number;
  /** Number of unmanaged MCPs available for import */
  unmanaged: number;
  /** Number of MCPs with conflicts */
  conflicts: number;
  /** Number of config files with parse errors */
  parseErrors: number;
}

/**
 * Complete detection result (read-only scan)
 */
export interface DetectionResult {
  /** Summary statistics */
  summary: DetectionSummary;
  /** Per-client detection results */
  clients: ClientDetectionResult[];
  /** Categorized MCP detection results */
  mcps: McpDetectionCategories;
}
