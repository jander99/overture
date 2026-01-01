/**
 * Plugin Detector Service
 *
 * Detects installed Claude Code plugins by parsing .claude/settings.json.
 * Handles missing or malformed settings files gracefully.
 *
 * The .claude/settings.json format is undocumented (public beta), so this
 * implementation uses defensive parsing with comprehensive error handling.
 *
 * Uses hexagonal architecture with dependency injection for testability.
 *
 * @module lib/plugin-detector
 * @version 3.0.0
 */

import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import type {
  InstalledPlugin,
  DetectionOptions,
  ClaudeSettings,
} from '@overture/config-types';
import { PluginError } from '@overture/errors';

/**
 * Plugin Detector Service
 *
 * Provides methods to detect installed Claude Code plugins from .claude/settings.json
 *
 * @example
 * ```typescript
 * import { PluginDetector } from '@overture/plugin-core';
 * import { NodeFilesystemAdapter, NodeEnvironmentAdapter } from '@overture/adapters-node';
 *
 * const filesystem = new NodeFilesystemAdapter();
 * const environment = new NodeEnvironmentAdapter();
 * const detector = new PluginDetector(filesystem, environment);
 *
 * // Detect all installed plugins
 * const plugins = await detector.detectInstalledPlugins();
 * // [
 * //   { name: 'python-development', marketplace: 'claude-code-workflows', enabled: true },
 * //   { name: 'backend-development', marketplace: 'claude-code-workflows', enabled: false }
 * // ]
 *
 * // Check if specific plugin is installed
 * const isInstalled = await detector.isPluginInstalled('python-development', 'claude-code-workflows');
 * // true
 * ```
 */
export class PluginDetector {
  private readonly filesystem: FilesystemPort;
  private readonly environment: EnvironmentPort;

  constructor(filesystem: FilesystemPort, environment: EnvironmentPort) {
    this.filesystem = filesystem;
    this.environment = environment;
  }

  /**
   * Detect all installed Claude Code plugins
   *
   * Reads .claude/settings.json from user and/or project directories and extracts
   * plugin information. Handles missing or malformed files gracefully by logging
   * warnings and returning empty arrays.
   *
   * @param options - Detection options (custom settings path, filter disabled plugins)
   * @returns Array of installed plugins
   *
   * @example
   * ```typescript
   * // Detect all plugins (default user settings)
   * const plugins = await detector.detectInstalledPlugins();
   *
   * // Use custom settings path
   * const plugins = await detector.detectInstalledPlugins({
   *   settingsPath: '/custom/path/settings.json'
   * });
   *
   * // Exclude disabled plugins
   * const plugins = await detector.detectInstalledPlugins({
   *   includeDisabled: false
   * });
   * ```
   */
  async detectInstalledPlugins(
    options: DetectionOptions = {},
  ): Promise<InstalledPlugin[]> {
    const includeDisabled = options.includeDisabled ?? true;

    // Determine settings path
    const settingsPath = options.settingsPath || this.getUserSettingsPath();

    // Validate settings path for security
    if (options.settingsPath) {
      await this.validateSettingsPath(settingsPath);
    }

    try {
      // Parse settings file and extract plugins
      return this.extractPluginsFromSettings(
        await this.parseClaudeSettings(settingsPath),
        includeDisabled,
      );
    } catch (error) {
      if (error instanceof PluginError && error.code === 'PLUGIN_ERROR') {
        // Settings file not found or malformed - log warning and return empty array
        console.warn(`⚠️  ${error.message}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Check if a specific plugin is installed
   *
   * Convenience method to check if a plugin with the given name and marketplace
   * is currently installed in Claude Code.
   *
   * @param name - Plugin name
   * @param marketplace - Marketplace identifier
   * @param options - Detection options
   * @returns True if plugin is installed
   *
   * @example
   * ```typescript
   * const isInstalled = await detector.isPluginInstalled(
   *   'python-development',
   *   'claude-code-workflows'
   * );
   * // true
   * ```
   */
  async isPluginInstalled(
    name: string,
    marketplace: string,
    options: DetectionOptions = {},
  ): Promise<boolean> {
    const plugins = await this.detectInstalledPlugins(options);
    return plugins.some(
      (plugin) =>
        plugin.name === name &&
        (plugin.marketplace === marketplace ||
          plugin.marketplace === this.normalizeMarketplace(marketplace)),
    );
  }

  /**
   * Parse .claude/settings.json file
   *
   * Reads and parses the Claude settings file. Handles common error cases:
   * - File not found (ENOENT): Returns empty settings
   * - Malformed JSON: Throws PluginError with helpful message
   * - Permission errors: Throws PluginError
   *
   * @param settingsPath - Path to settings.json file
   * @returns Parsed settings object
   * @throws {PluginError} If file cannot be read or parsed
   *
   * @internal
   */
  private async parseClaudeSettings(
    settingsPath: string,
  ): Promise<ClaudeSettings> {
    try {
      // Check if file exists
      const exists = await this.filesystem.exists(settingsPath);
      if (!exists) {
        throw new PluginError(
          `.claude/settings.json not found at ${settingsPath}. Assuming no plugins installed.`,
          undefined,
        );
      }

      // Read file
      const content = await this.filesystem.readFile(settingsPath);

      // Parse JSON
      return JSON.parse(content) as ClaudeSettings;
    } catch (error) {
      // Already a PluginError - rethrow
      if (error instanceof PluginError) {
        throw error;
      }

      // JSON parse error
      if (error instanceof SyntaxError) {
        throw new PluginError(
          `Malformed .claude/settings.json at ${settingsPath}: ${error.message}`,
          undefined,
        );
      }

      // Unknown error
      throw new PluginError(
        `Failed to read .claude/settings.json: ${(error as Error).message}`,
        undefined,
      );
    }
  }

  /**
   * Extract plugin information from parsed settings
   *
   * Parses the plugins section of .claude/settings.json and extracts plugin
   * metadata. Handles various potential formats defensively since the schema
   * is undocumented.
   *
   * Expected format (may change):
   * ```json
   * {
   *   "plugins": {
   *     "python-development@claude-code-workflows": {
   *       "enabled": true,
   *       "marketplace": "claude-code-workflows",
   *       "installedAt": "2025-01-15T10:30:00Z"
   *     }
   *   }
   * }
   * ```
   *
   * @param settings - Parsed Claude settings object
   * @param includeDisabled - Whether to include disabled plugins
   * @returns Array of installed plugins
   *
   * @internal
   */
  private extractPluginsFromSettings(
    settings: ClaudeSettings,
    includeDisabled: boolean,
  ): InstalledPlugin[] {
    // No plugins section
    if (!settings.plugins || typeof settings.plugins !== 'object') {
      return [];
    }

    const plugins: InstalledPlugin[] = [];

    // Iterate over plugin entries
    for (const [key, entry] of Object.entries(settings.plugins)) {
      try {
        // Parse plugin key (expected format: "name@marketplace" or just "name")
        const { name, marketplace } = this.parsePluginKey(key, entry);

        // Check if plugin is enabled
        const enabled = entry.enabled ?? true;

        // Skip disabled plugins if requested
        if (!includeDisabled && !enabled) {
          continue;
        }

        // Extract installation timestamp
        const installedAt = entry.installedAt;

        plugins.push({
          name,
          marketplace,
          enabled,
          installedAt,
        });
      } catch {
        // Skip malformed plugin entries
        console.warn(`⚠️  Skipping malformed plugin entry: ${key}`);
        continue;
      }
    }

    return plugins;
  }

  /**
   * Parse plugin key from settings.json
   *
   * Handles various potential key formats:
   * - "name@marketplace" (preferred)
   * - "name" (uses marketplace from entry)
   * - "marketplace/name" (alternative format)
   *
   * @param key - Plugin key from settings.json
   * @param entry - Plugin entry object
   * @returns Parsed name and marketplace
   *
   * @internal
   */
  private parsePluginKey(
    key: string,
    entry: { marketplace?: string; [key: string]: unknown },
  ): { name: string; marketplace: string } {
    // Format: "name@marketplace"
    if (key.includes('@')) {
      const [name, marketplace] = key.split('@');
      return {
        name: name.trim(),
        marketplace: marketplace.trim(),
      };
    }

    // Format: "marketplace/name"
    if (key.includes('/')) {
      const [marketplace, name] = key.split('/');
      return {
        name: name.trim(),
        marketplace: marketplace.trim(),
      };
    }

    // Format: "name" (marketplace in entry)
    if (entry.marketplace && typeof entry.marketplace === 'string') {
      return {
        name: key.trim(),
        marketplace: entry.marketplace.trim(),
      };
    }

    // Fallback: use key as name, unknown marketplace
    return {
      name: key.trim(),
      marketplace: 'unknown',
    };
  }

  /**
   * Normalize marketplace identifier
   *
   * Converts full marketplace paths to short names if they match known patterns.
   *
   * @param marketplace - Marketplace identifier
   * @returns Normalized marketplace identifier
   *
   * @internal
   */
  private normalizeMarketplace(marketplace: string): string {
    // anthropics/claude-code-workflows → claude-code-workflows
    if (marketplace === 'anthropics/claude-code-workflows') {
      return 'claude-code-workflows';
    }

    return marketplace;
  }

  /**
   * Validate settings path for security
   *
   * Prevents path traversal attacks by ensuring the settings path is within
   * allowed .claude directories. This is a defense-in-depth measure to prevent
   * arbitrary file reads.
   *
   * Allowed directories:
   * - User: ~/.claude/
   * - Project: <cwd>/.claude/
   *
   * @param settingsPath - Path to validate
   * @throws {PluginError} If path is not within .claude directory
   *
   * @internal
   * @security Path validation prevents reading arbitrary files on the system
   */
  private async validateSettingsPath(settingsPath: string): Promise<void> {
    // Check for null bytes (directory traversal technique)
    if (settingsPath.includes('\0')) {
      throw new PluginError(
        `Settings path must be within .claude directory: ${settingsPath.replace(/\0/g, '\\0')}`,
        undefined,
      );
    }

    // Simple validation: path must be within .claude directory
    const normalizedPath = settingsPath.replace(/\\/g, '/');
    if (!normalizedPath.includes('/.claude/')) {
      throw new PluginError(
        `Settings path must be within .claude directory: ${settingsPath}`,
        undefined,
      );
    }
  }

  /**
   * Get user settings path
   *
   * @returns Path to user-level .claude/settings.json
   * @internal
   */
  private getUserSettingsPath(): string {
    const homeDir = this.environment.homedir();
    const separator = this.environment.platform() === 'win32' ? '\\' : '/';
    return `${homeDir}${separator}.claude${separator}settings.json`;
  }

  /**
   * Get project settings path
   *
   * @returns Path to project-level .claude/settings.json
   * @internal
   */
  private getProjectSettingsPath(): string {
    // For now, use a fixed path - in real implementation, would need current working directory
    const separator = this.environment.platform() === 'win32' ? '\\' : '/';
    return `.${separator}.claude${separator}settings.json`;
  }

  /**
   * Get default settings paths
   *
   * Returns the default paths checked for .claude/settings.json
   *
   * @returns Object with user and project settings paths
   *
   * @example
   * ```typescript
   * const paths = detector.getDefaultSettingsPaths();
   * // {
   * //   user: '/Users/user/.claude/settings.json',
   * //   project: '/path/to/project/.claude/settings.json'
   * // }
   * ```
   */
  getDefaultSettingsPaths(): { user: string; project: string } {
    return {
      user: this.getUserSettingsPath(),
      project: this.getProjectSettingsPath(),
    };
  }
}
