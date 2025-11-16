/**
 * Plugin Domain Type Definitions
 *
 * Type definitions for Claude Code plugin synchronization feature.
 * Defines the core data structures for plugin detection, installation, and export.
 *
 * @module domain/plugin.types
 * @version 0.3.0
 */

/**
 * Claude Code Plugin Information
 *
 * Represents an installed Claude Code plugin detected from .claude/settings.json
 *
 * @example
 * ```typescript
 * {
 *   name: 'python-development',
 *   marketplace: 'claude-code-workflows',
 *   enabled: true,
 *   installedAt: '2025-01-15T10:30:00Z'
 * }
 * ```
 */
export interface InstalledPlugin {
  /**
   * Plugin name
   * @example "python-development"
   */
  name: string;

  /**
   * Marketplace identifier
   * Can be a shortcut (e.g., "claude-code-workflows") or full path (e.g., "anthropics/claude-code-workflows")
   * @example "claude-code-workflows", "myorg/custom-marketplace"
   */
  marketplace: string;

  /**
   * Whether the plugin is enabled
   * @default true
   */
  enabled: boolean;

  /**
   * Installation timestamp (if available from settings)
   * ISO 8601 format
   * @example "2025-01-15T10:30:00Z"
   */
  installedAt?: string;
}

/**
 * Plugin Installation Result
 *
 * Result of attempting to install a single plugin via Claude CLI.
 *
 * @example
 * ```typescript
 * {
 *   success: true,
 *   plugin: 'python-development',
 *   marketplace: 'claude-code-workflows',
 *   output: 'Plugin installed successfully',
 * }
 * ```
 */
export interface InstallationResult {
  /**
   * Whether installation succeeded
   */
  success: boolean;

  /**
   * Plugin name that was installed or attempted
   * @example "python-development"
   */
  plugin: string;

  /**
   * Marketplace used for installation
   * @example "claude-code-workflows"
   */
  marketplace: string;

  /**
   * Command output (stdout) from Claude CLI
   */
  output?: string;

  /**
   * Error message if installation failed
   */
  error?: string;

  /**
   * Whether plugin was already installed (skipped)
   */
  skipped?: boolean;
}

/**
 * Plugin Sync Result
 *
 * Summary result of syncing plugins from config to Claude Code.
 *
 * @example
 * ```typescript
 * {
 *   totalPlugins: 5,
 *   installed: 2,
 *   skipped: 3,
 *   failed: 0,
 *   results: [...]
 * }
 * ```
 */
export interface PluginSyncResult {
  /**
   * Total number of plugins in config
   */
  totalPlugins: number;

  /**
   * Number of plugins successfully installed
   */
  installed: number;

  /**
   * Number of plugins skipped (already installed)
   */
  skipped: number;

  /**
   * Number of plugins that failed to install
   */
  failed: number;

  /**
   * Detailed results for each plugin
   */
  results: InstallationResult[];

  /**
   * Warnings encountered during sync
   */
  warnings: string[];
}

/**
 * Plugin Export Options
 *
 * Options for exporting installed plugins to user config.
 *
 * @example
 * ```typescript
 * // Interactive mode (default)
 * { interactive: true }
 *
 * // Non-interactive with explicit plugin list
 * {
 *   interactive: false,
 *   pluginNames: ['python-development', 'backend-development']
 * }
 * ```
 */
export interface ExportOptions {
  /**
   * Enable interactive selection mode
   * If true, prompts user to select plugins via checkbox interface
   * @default true
   */
  interactive?: boolean;

  /**
   * Explicit list of plugin names to export
   * Used when interactive is false
   * @example ['python-development', 'backend-development']
   */
  pluginNames?: string[];
}

/**
 * Plugin Detection Options
 *
 * Options for customizing plugin detection behavior.
 */
export interface DetectionOptions {
  /**
   * Custom path to .claude/settings.json
   * If not provided, uses default locations:
   * - User: ~/.claude/settings.json
   * - Project: .claude/settings.json
   */
  settingsPath?: string;

  /**
   * Include disabled plugins in detection
   * @default true
   */
  includeDisabled?: boolean;
}

/**
 * Marketplace Configuration
 *
 * Configuration for a plugin marketplace.
 *
 * @example
 * ```typescript
 * {
 *   shortName: 'claude-code-workflows',
 *   fullPath: 'anthropics/claude-code-workflows',
 *   type: 'github'
 * }
 * ```
 */
export interface MarketplaceConfig {
  /**
   * Short name used in config
   * @example "claude-code-workflows"
   */
  shortName: string;

  /**
   * Full path for Claude CLI
   * @example "anthropics/claude-code-workflows"
   */
  fullPath: string;

  /**
   * Marketplace type
   */
  type: 'github' | 'local' | 'custom';

  /**
   * Local filesystem path (for local marketplaces)
   * @example "/home/user/dev/marketplace"
   */
  localPath?: string;
}

/**
 * Plugin Installation Options
 *
 * Options for customizing plugin installation behavior.
 */
export interface InstallationOptions {
  /**
   * Dry run mode - simulate installation without executing
   * @default false
   */
  dryRun?: boolean;

  /**
   * Force installation even if already installed
   * @default false
   */
  force?: boolean;

  /**
   * Timeout for installation in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * Claude Settings File Structure
 *
 * Expected structure of .claude/settings.json file.
 * Note: This is undocumented and may change. Handle defensively.
 *
 * @internal
 */
export interface ClaudeSettings {
  /**
   * Installed plugins
   * Key: plugin@marketplace format
   */
  plugins?: Record<string, ClaudePluginEntry>;

  /**
   * Other settings (ignored)
   */
  [key: string]: unknown;
}

/**
 * Claude Plugin Entry in settings.json
 *
 * @internal
 */
export interface ClaudePluginEntry {
  /**
   * Whether plugin is enabled
   */
  enabled?: boolean;

  /**
   * Installation timestamp
   */
  installedAt?: string;

  /**
   * Marketplace source
   */
  marketplace?: string;

  /**
   * Plugin version
   */
  version?: string;

  /**
   * Other metadata (ignored)
   */
  [key: string]: unknown;
}
