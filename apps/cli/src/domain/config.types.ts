/**
 * Overture v2.0 Configuration Type Definitions
 *
 * This file defines TypeScript interfaces for Overture v2.0 configuration schema.
 * Key features:
 * - User global + project-level configuration
 * - MCP-centric design with client exclusions
 * - Required transport field for all MCPs
 * - Optional version field (defaults to "latest")
 * - Client-specific overrides and platform exclusions
 *
 * @module domain/config.types
 * @version 2.0
 */

/**
 * Platform types supported by Overture
 */
export type Platform = 'darwin' | 'linux' | 'win32';

/**
 * Transport types for MCP server communication
 */
export type TransportType = 'stdio' | 'http' | 'sse';

/**
 * Scope of MCP server configuration
 * - global: Available in user global config, synced to all clients
 * - project: Available in project config, synced to project clients only
 */
export type Scope = 'global' | 'project';

/**
 * Supported AI client names
 */
export type ClientName =
  | 'claude-code'
  | 'claude-desktop'
  | 'vscode'
  | 'cursor'
  | 'windsurf'
  | 'copilot-cli'
  | 'jetbrains-copilot';

/**
 * Merge strategy for config synchronization
 * - append: Add Overture-managed entries to existing config (default)
 * - replace: Replace entire config with Overture-generated config
 */
export type MergeStrategy = 'append' | 'replace';

/**
 * Binary detection status for AI development clients
 * - found: Binary/app bundle was detected on the system
 * - not-found: Binary/app bundle was not detected
 * - skipped: Detection was skipped (skipBinaryDetection enabled)
 */
export type BinaryDetectionStatus = 'found' | 'not-found' | 'skipped';

/**
 * Binary Detection Result
 *
 * Result of detecting an AI development client binary or application bundle.
 *
 * @example
 * ```typescript
 * {
 *   status: 'found',
 *   binaryPath: '/usr/local/bin/claude',
 *   version: '2.1.0',
 *   warnings: []
 * }
 * ```
 */
export interface BinaryDetectionResult {
  /**
   * Detection status
   */
  status: BinaryDetectionStatus;

  /**
   * Path to the binary (for CLI clients)
   * @example "/usr/local/bin/claude"
   */
  binaryPath?: string;

  /**
   * Detected version string
   * @example "2.1.0", "v0.42.0"
   */
  version?: string;

  /**
   * Path to the application bundle (for GUI clients)
   * @example "/Applications/Claude.app"
   */
  appBundlePath?: string;

  /**
   * Config file path that was validated
   * @example "/Users/user/.config/claude/mcp.json"
   */
  configPath?: string;

  /**
   * Whether config file is valid JSON
   */
  configValid?: boolean;

  /**
   * Warnings or additional information
   * @example ["Binary found but version detection failed"]
   */
  warnings: string[];
}

/**
 * MCP Server Configuration (v2.0)
 *
 * Defines how to launch an MCP server and which clients should use it.
 *
 * @example
 * ```yaml
 * mcp:
 *   github:
 *     command: mcp-server-github
 *     args: []
 *     env:
 *       GITHUB_TOKEN: "${GITHUB_TOKEN}"
 *     transport: stdio
 *     version: "1.0.0"
 *     clients:
 *       exclude: [copilot-cli]  # Copilot CLI bundles this by default
 * ```
 */
export interface McpServerConfig {
  /**
   * Executable command to launch the MCP server
   * @example "npx", "uvx", "mcp-server-github"
   */
  command: string;

  /**
   * Command-line arguments passed to the MCP server
   * @example ["-y", "@modelcontextprotocol/server-filesystem"]
   */
  args: string[];

  /**
   * Environment variables for the MCP server process
   * Supports variable expansion: ${VAR_NAME}
   * @example { "GITHUB_TOKEN": "${GITHUB_TOKEN}", "DEBUG": "true" }
   */
  env: Record<string, string>;

  /**
   * Transport protocol (REQUIRED in v2.0)
   * - stdio: Standard input/output (universally supported)
   * - http: HTTP transport (not all clients support)
   * - sse: Server-Sent Events (not all clients support)
   */
  transport: TransportType;

  /**
   * MCP server version (optional, defaults to "latest")
   * Appended to package name if using package managers
   * @example "1.2.3" results in: npx -y @org/package@1.2.3
   */
  version?: string;

  /**
   * Client-specific configuration
   */
  clients?: {
    /**
     * Clients to exclude from syncing this MCP
     * @example ["copilot-cli", "windsurf"]
     */
    exclude?: ClientName[];

    /**
     * Only sync to these specific clients (whitelist)
     * Mutually exclusive with exclude. If both specified, include takes precedence.
     * @example ["claude-code", "cursor"]
     */
    include?: ClientName[];

    /**
     * Client-specific configuration overrides
     * @example { "vscode": { "transport": "http" } }
     */
    overrides?: Record<ClientName, Partial<McpServerConfig>>;
  };

  /**
   * Platform-specific configuration
   */
  platforms?: {
    /**
     * Platforms to exclude from syncing this MCP
     * @example ["win32"]  // Don't sync on Windows
     */
    exclude?: Platform[];

    /**
     * Platform-specific command overrides
     * @example { "win32": "python", "darwin": "/usr/local/bin/python3" }
     */
    commandOverrides?: Partial<Record<Platform, string>>;

    /**
     * Platform-specific args overrides
     * @example { "win32": ["-m", "mcp_server"] }
     */
    argsOverrides?: Partial<Record<Platform, string[]>>;
  };

  /**
   * Optional metadata (not used for sync, informational only)
   */
  metadata?: {
    description?: string;
    homepage?: string;
    tags?: string[];
  };
}

/**
 * Client Configuration
 *
 * Settings for a specific AI client.
 */
export interface ClientConfig {
  /**
   * Whether this client is enabled for syncing
   * @default true
   */
  enabled: boolean;

  /**
   * Override default config file path
   * Supports environment variable expansion
   * @example "~/.custom-claude/mcp.json"
   */
  configPath?: string | Partial<Record<Platform, string>>;

  /**
   * Maximum number of MCP servers to sync (for clients with limits)
   * @example 100 (Windsurf limit)
   */
  maxServers?: number;

  /**
   * Client-specific settings (free-form)
   */
  settings?: Record<string, unknown>;
}

/**
 * Sync Options
 *
 * Global synchronization settings.
 */
export interface SyncOptions {
  /**
   * Create backups before syncing
   * @default true
   */
  backup: boolean;

  /**
   * Backup directory path
   * @default "~/.config/overture/backups"
   */
  backupDir: string;

  /**
   * Number of backups to retain per client
   * @default 10
   */
  backupRetention: number;

  /**
   * Merge strategy for existing configs
   * @default "append"
   */
  mergeStrategy: MergeStrategy;

  /**
   * Auto-detect installed clients
   * @default true
   */
  autoDetectClients: boolean;

  /**
   * Specific clients to sync (empty = all enabled clients)
   */
  enabledClients?: ClientName[];

  /**
   * Skip binary detection for clients
   * If true, Overture will not check if client binaries are installed
   * @default false
   */
  skipBinaryDetection?: boolean;
}

/**
 * Overture v2.0 Configuration (User Global)
 *
 * This is the main configuration file for Overture v2.0.
 * Location: ~/.config/overture.yml
 *
 * Note: Scope is implicit based on file location.
 * - MCPs in ~/.config/overture.yml are global (synced to ~/.config/claude/mcp.json)
 * - MCPs in .overture/config.yaml are project-scoped (synced to .mcp.json)
 *
 * @example
 * ```yaml
 * version: "2.0"
 *
 * clients:
 *   claude-code:
 *     enabled: true
 *   claude-desktop:
 *     enabled: true
 *   vscode:
 *     enabled: false
 *
 * mcp:
 *   github:
 *     command: mcp-server-github
 *     args: []
 *     env:
 *       GITHUB_TOKEN: "${GITHUB_TOKEN}"
 *     transport: stdio
 *
 * sync:
 *   backup: true
 *   mergeStrategy: append
 * ```
 */
export interface OvertureConfig {
  /**
   * Configuration schema version
   * @example "2.0"
   */
  version: string;

  /**
   * Client-specific configurations
   * Key: ClientName, Value: ClientConfig
   */
  clients?: Record<ClientName, ClientConfig>;

  /**
   * MCP server definitions
   * Key: MCP server name, Value: McpServerConfig
   */
  mcp: Record<string, McpServerConfig>;

  /**
   * Synchronization options
   */
  sync?: SyncOptions;
}

/**
 * Client MCP Configuration (Generated)
 *
 * The configuration format that gets written to client-specific config files.
 * This format varies per client (e.g., VS Code uses "servers" instead of "mcpServers").
 */
export interface ClientMcpConfig {
  /**
   * MCP servers configuration
   * Root key varies by client:
   * - Most clients: "mcpServers"
   * - VS Code: "servers"
   */
  [rootKey: string]: Record<string, ClientMcpServerDef>;
}

/**
 * Client-specific MCP server definition
 *
 * Minimal fields required by clients (after conversion from OvertureConfig).
 */
export interface ClientMcpServerDef {
  /**
   * Command to execute
   */
  command: string;

  /**
   * Command arguments
   */
  args: string[];

  /**
   * Environment variables
   */
  env?: Record<string, string>;

  /**
   * Transport type (VS Code requires "type" field)
   */
  type?: TransportType;

  /**
   * HTTP URL (for HTTP transport)
   */
  url?: string;
}

/**
 * Sync Result
 *
 * Result of a synchronization operation across clients.
 */
export interface SyncResult {
  /**
   * Whether sync completed successfully
   */
  success: boolean;

  /**
   * Results per client
   */
  clients: Record<ClientName, ClientSyncResult>;

  /**
   * Overall summary
   */
  summary: {
    totalClients: number;
    successfulClients: number;
    failedClients: number;
    totalMcps: number;
    syncedMcps: number;
    skippedMcps: number;
  };

  /**
   * Errors encountered
   */
  errors: Error[];
}

/**
 * Client-specific sync result
 */
export interface ClientSyncResult {
  /**
   * Whether client sync succeeded
   */
  success: boolean;

  /**
   * MCP servers synced to this client
   */
  synced: string[];

  /**
   * MCP servers skipped (excluded)
   */
  skipped: string[];

  /**
   * Backup file path (if created)
   */
  backupPath?: string;

  /**
   * Binary detection result for this client
   */
  binaryDetection?: BinaryDetectionResult;

  /**
   * Error if sync failed
   */
  error?: Error;
}

/**
 * Backup Metadata
 *
 * Metadata for a configuration backup.
 */
export interface BackupMetadata {
  /**
   * Client name
   */
  client: ClientName;

  /**
   * Backup file path
   */
  path: string;

  /**
   * Backup timestamp
   */
  timestamp: Date;

  /**
   * Original config file path
   */
  originalPath: string;

  /**
   * File size in bytes
   */
  size: number;

  /**
   * Checksum (for integrity verification)
   */
  checksum?: string;
}

/**
 * Audit Result
 *
 * Result of auditing client configurations for unmanaged MCPs.
 */
export interface AuditResult {
  /**
   * MCPs managed by Overture
   */
  managed: string[];

  /**
   * MCPs found in clients but not in Overture config
   */
  unmanaged: Record<ClientName, string[]>;

  /**
   * Total unmanaged MCPs across all clients
   */
  totalUnmanaged: number;

  /**
   * Suggestions for consolidation
   */
  suggestions: string[];
}

/**
 * Validation Result
 *
 * Result of configuration validation.
 */
export interface ValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;

  /**
   * Validation errors
   */
  errors: ValidationError[];

  /**
   * Validation warnings
   */
  warnings: ValidationWarning[];
}

/**
 * Validation Error
 */
export interface ValidationError {
  /**
   * Error message
   */
  message: string;

  /**
   * Field path (e.g., "mcp.github.transport")
   */
  path: string;

  /**
   * Error code
   */
  code: string;
}

/**
 * Validation Warning
 */
export interface ValidationWarning {
  /**
   * Warning message
   */
  message: string;

  /**
   * Field path
   */
  path: string;

  /**
   * Suggested fix
   */
  suggestion?: string;
}

/**
 * Process Lock
 *
 * Lock file to prevent concurrent Overture runs.
 */
export interface ProcessLock {
  /**
   * Process ID
   */
  pid: number;

  /**
   * Lock timestamp
   */
  timestamp: Date;

  /**
   * Command being executed
   */
  command: string;

  /**
   * Lock file path
   */
  lockPath: string;
}
