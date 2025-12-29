/**
 * Configuration Loader Service
 *
 * Loads and merges Overture configuration from user global and project-level files.
 * Implements configuration precedence rules (project overrides user).
 *
 * **ARCHITECTURE:**
 * This service uses dependency injection to receive infrastructure dependencies
 * (FilesystemPort, PathResolver) rather than directly importing Node.js modules.
 *
 * @module lib/config-loader
 * @version 3.0
 */

import * as yaml from 'js-yaml';
import {
  OvertureConfigSchema,
  type OvertureConfig,
} from '@overture/config-schema';
import { ConfigError, ValidationError } from '@overture/errors';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { PathResolver } from './path-resolver.js';

/**
 * Configuration loader service
 *
 * Loads Overture configuration from user global and project-level files,
 * validates them against the schema, and merges them with proper precedence.
 *
 * @example
 * ```typescript
 * import { ConfigLoader, PathResolver } from '@overture/config-core';
 * import { NodeFilesystemAdapter } from '@overture/adapters-node';
 * import { NodeEnvironmentAdapter } from '@overture/adapters-node';
 *
 * const filesystem = new NodeFilesystemAdapter();
 * const environment = new NodeEnvironmentAdapter();
 * const pathResolver = new PathResolver(environment, filesystem);
 * const loader = new ConfigLoader(filesystem, pathResolver);
 *
 * // Load user config
 * const userConfig = await loader.loadUserConfig();
 *
 * // Load project config (if exists)
 * const projectConfig = await loader.loadProjectConfig();
 *
 * // Load and merge both configs
 * const config = await loader.loadConfig();
 * ```
 */
export class ConfigLoader {
  // Track which warnings we've already shown to avoid duplicates
  private static shownWarnings = new Set<string>();

  constructor(
    private filesystem: FilesystemPort,
    private pathResolver: PathResolver,
  ) {}

  /**
   * Format YAML parse error with line number information
   *
   * Extracts line/column info from js-yaml YAMLException and formats it nicely.
   *
   * @param error - YAML parse error from js-yaml
   * @param configPath - Path to configuration file
   * @returns Formatted error message with line numbers
   */
  private formatYamlParseError(error: Error, _configPath: string): string {
    // Check if error is from js-yaml (has mark property with line/column)
    const yamlError = error as {
      mark?: { line: number; column: number };
      message: string;
    };
    if (yamlError.mark && typeof yamlError.mark.line === 'number') {
      const line = yamlError.mark.line + 1; // js-yaml uses 0-indexed lines
      const column = yamlError.mark.column + 1; // js-yaml uses 0-indexed columns

      return `YAML parse error at line ${line}, column ${column}:\n  ${error.message}`;
    }

    return `YAML parse error: ${error.message}`;
  }

  /**
   * Check for deprecated fields in configuration
   *
   * Provides helpful error messages for common migration issues.
   *
   * @param parsed - Parsed YAML configuration object
   * @param configPath - Path to configuration file
   * @throws {ValidationError} If deprecated fields are found
   */
  private checkForDeprecatedFields(parsed: unknown, _configPath: string): void {
    if (!parsed || typeof parsed !== 'object') {
      return;
    }

    const config = parsed as Record<string, unknown>;

    // Check for deprecated 'scope' field in MCP configurations
    if ('mcp' in config && config.mcp && typeof config.mcp === 'object') {
      const mcp = config.mcp as Record<string, unknown>;

      for (const [mcpName, mcpConfig] of Object.entries(mcp)) {
        if (
          mcpConfig &&
          typeof mcpConfig === 'object' &&
          'scope' in mcpConfig
        ) {
          throw new ValidationError(
            `Deprecated 'scope' field found in configuration`,
            [
              `The 'scope' field has been removed in Overture v2.0`,
              `Remove the 'scope' field from mcp.${mcpName}.`,
              `Scope is now implicit based on file location:`,
              `  - MCPs in ~/.config/overture.yml are global`,
              `  - MCPs in .overture/config.yaml are project-scoped`,
            ],
          );
        }
      }
    }
  }

  /**
   * Load user global configuration
   *
   * Reads and validates configuration from ~/.config/overture/config.yml
   * Falls back to legacy path ~/.config/overture.yml for backward compatibility
   *
   * @returns User configuration object
   * @throws {ConfigError} If file cannot be read or parsed
   * @throws {ValidationError} If configuration is invalid
   *
   * @example
   * ```typescript
   * const userConfig = await loader.loadUserConfig();
   * console.log(userConfig.mcp); // All user-level MCP servers
   * ```
   */
  async loadUserConfig(): Promise<OvertureConfig> {
    const yamlPath = this.pathResolver.getUserConfigPath(); // .yaml (primary)
    const ymlPath = this.pathResolver.getUserConfigPathYml(); // .yml (fallback)
    const legacyConfigPath = this.pathResolver.getLegacyUserConfigPath(); // old location

    let configPath = yamlPath;
    let isLegacyPath = false;
    let isYmlExtension = false;

    // Try .yaml first (primary), then .yml (fallback), then legacy location
    if (await this.filesystem.exists(yamlPath)) {
      configPath = yamlPath;
    } else if (await this.filesystem.exists(ymlPath)) {
      configPath = ymlPath;
      isYmlExtension = true;
    } else if (await this.filesystem.exists(legacyConfigPath)) {
      configPath = legacyConfigPath;
      isLegacyPath = true;
    } else {
      throw new ConfigError(`User config file not found`, yamlPath);
    }

    try {
      // Read file
      const fileContent = await this.filesystem.readFile(configPath);

      // Parse YAML
      const parsed = yaml.load(fileContent);

      // Check for deprecated fields (provides helpful migration errors)
      this.checkForDeprecatedFields(parsed, configPath);

      // Validate with Zod
      const result = OvertureConfigSchema.safeParse(parsed);

      if (!result.success) {
        throw new ValidationError(
          `Invalid user configuration: ${result.error.message}`,
          result.error.issues.map(
            (issue) => `${issue.path.join('.')}: ${issue.message}`,
          ),
        );
      }

      // Show warning if using .yml extension instead of .yaml (only once per process)
      const ymlWarningKey = `yml-user-${ymlPath}`;
      if (
        isYmlExtension &&
        typeof process !== 'undefined' &&
        process.stderr &&
        !ConfigLoader.shownWarnings.has(ymlWarningKey)
      ) {
        const preferredPath = yamlPath.replace(
          this.pathResolver.getHomeDir(),
          '~',
        );
        const currentPath = ymlPath.replace(
          this.pathResolver.getHomeDir(),
          '~',
        );
        process.stderr.write(
          `\n⚠️  WARNING: Using .yml extension (fallback)\n` +
            `   Current: ${currentPath}\n` +
            `   Preferred: ${preferredPath}\n` +
            `   Consider renaming to use .yaml extension.\n` +
            `   Run: mv ${currentPath} ${preferredPath}\n\n`,
        );
        ConfigLoader.shownWarnings.add(ymlWarningKey);
      }

      // Show deprecation warning if using legacy path (only once per process)
      const legacyWarningKey = `legacy-user-${legacyConfigPath}`;
      if (
        isLegacyPath &&
        typeof process !== 'undefined' &&
        process.stderr &&
        !ConfigLoader.shownWarnings.has(legacyWarningKey)
      ) {
        const newPath = yamlPath.replace(this.pathResolver.getHomeDir(), '~');
        const oldPath = legacyConfigPath.replace(
          this.pathResolver.getHomeDir(),
          '~',
        );
        process.stderr.write(
          `\n⚠️  DEPRECATION WARNING: Using legacy config path\n` +
            `   Old path: ${oldPath}\n` +
            `   New path: ${newPath}\n` +
            `   Please move your config file to the new location.\n` +
            `   Run: mkdir -p ~/.config/overture && mv ${oldPath} ${newPath}\n\n`,
        );
        ConfigLoader.shownWarnings.add(legacyWarningKey);
      }

      return result.data;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      // Check if this is a YAML parse error and format it with line numbers
      const errorMessage =
        (error as Error).name === 'YAMLException'
          ? this.formatYamlParseError(error as Error, configPath)
          : `Failed to load user config: ${(error as Error).message}`;

      throw new ConfigError(errorMessage, configPath);
    }
  }

  /**
   * Load project configuration
   *
   * Reads and validates configuration from .overture/config.yaml
   *
   * @param projectRoot - Project root directory (defaults to cwd)
   * @returns Project configuration object or null if not found
   * @throws {ConfigError} If file exists but cannot be read or parsed
   * @throws {ValidationError} If configuration is invalid
   *
   * @example
   * ```typescript
   * const projectConfig = await loader.loadProjectConfig();
   * if (projectConfig) {
   *   console.log(projectConfig.mcp); // Project-level MCP servers
   * }
   * ```
   */
  async loadProjectConfig(
    projectRoot?: string,
  ): Promise<OvertureConfig | null> {
    const yamlPath = this.pathResolver.getProjectConfigPath(projectRoot); // .yaml (primary)
    const ymlPath = this.pathResolver.getProjectConfigPathYml(projectRoot); // .yml (fallback)

    let configPath: string | null = null;
    let isYmlExtension = false;

    // Try .yaml first (primary), then .yml (fallback)
    if (await this.filesystem.exists(yamlPath)) {
      configPath = yamlPath;
    } else if (await this.filesystem.exists(ymlPath)) {
      configPath = ymlPath;
      isYmlExtension = true;
    }

    // Project config is optional
    if (!configPath) {
      return null;
    }

    try {
      // Read file
      const fileContent = await this.filesystem.readFile(configPath);

      // Parse YAML
      const parsed = yaml.load(fileContent);

      // Check for deprecated fields (provides helpful migration errors)
      this.checkForDeprecatedFields(parsed, configPath);

      // Validate with Zod
      const result = OvertureConfigSchema.safeParse(parsed);

      if (!result.success) {
        throw new ValidationError(
          `Invalid project configuration: ${result.error.message}`,
          result.error.issues.map(
            (issue) => `${issue.path.join('.')}: ${issue.message}`,
          ),
        );
      }

      // Show warning if using .yml extension instead of .yaml (only once per process)
      const ymlWarningKey = `yml-project-${projectRoot}`;
      if (
        isYmlExtension &&
        typeof process !== 'undefined' &&
        process.stderr &&
        !ConfigLoader.shownWarnings.has(ymlWarningKey)
      ) {
        process.stderr.write(
          `\n⚠️  WARNING: Using .yml extension (fallback)\n` +
            `   Current: .overture/config.yml\n` +
            `   Preferred: .overture/config.yaml\n` +
            `   Consider renaming to use .yaml extension.\n` +
            `   Run: mv .overture/config.yml .overture/config.yaml\n\n`,
        );
        ConfigLoader.shownWarnings.add(ymlWarningKey);
      }

      return result.data;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      // Check if this is a YAML parse error and format it with line numbers
      const errorMessage =
        (error as Error).name === 'YAMLException'
          ? this.formatYamlParseError(error as Error, configPath)
          : `Failed to load project config: ${(error as Error).message}`;

      throw new ConfigError(errorMessage, configPath);
    }
  }

  /**
   * Categorize MCP servers by their source (global vs project)
   *
   * Returns an object mapping each MCP name to its source.
   * When an MCP exists in both configs, project takes precedence.
   *
   * @param globalConfig - Global configuration
   * @param projectConfig - Project configuration (if any)
   * @returns Map of MCP names to their source ('global' or 'project')
   *
   * @example
   * ```typescript
   * const sources = loader.getMcpSources(globalConfig, projectConfig);
   * // { filesystem: 'global', memory: 'global', nx-mcp: 'project' }
   * ```
   */
  getMcpSources(
    globalConfig: OvertureConfig | null,
    projectConfig: OvertureConfig | null,
  ): Record<string, 'global' | 'project'> {
    const sources: Record<string, 'global' | 'project'> = {};

    // Mark all global MCPs
    if (globalConfig?.mcp) {
      for (const mcpName of Object.keys(globalConfig.mcp)) {
        // mcpName from Object.keys() is always in the object
        if (Object.hasOwn(globalConfig.mcp, mcpName)) {
          // eslint-disable-next-line security/detect-object-injection -- mcpName from Object.keys()
          sources[mcpName] = 'global';
        }
      }
    }

    // Override with project MCPs (they take precedence)
    if (projectConfig?.mcp) {
      for (const mcpName of Object.keys(projectConfig.mcp)) {
        // mcpName from Object.keys() is always in the object
        if (Object.hasOwn(projectConfig.mcp, mcpName)) {
          // eslint-disable-next-line security/detect-object-injection -- mcpName from Object.keys()
          sources[mcpName] = 'project';
        }
      }
    }

    return sources;
  }

  /**
   * Merge user and project configurations
   *
   * Implements precedence rules:
   * - Project config overrides user config
   * - MCP servers: Project MCPs override user MCPs with same name
   * - Client settings: Project client settings override user client settings
   * - Sync options: Project sync options override user sync options
   *
   * @param userConfig - User global configuration
   * @param projectConfig - Project configuration (optional)
   * @returns Merged configuration with project taking precedence
   *
   * @example
   * ```typescript
   * const user = await loader.loadUserConfig();
   * const project = await loader.loadProjectConfig();
   * const merged = loader.mergeConfigs(user, project);
   * ```
   */
  mergeConfigs(
    userConfig: OvertureConfig,
    projectConfig: OvertureConfig | null,
  ): OvertureConfig {
    // If no project config, return user config as-is
    if (!projectConfig) {
      return userConfig;
    }

    // Merge MCP servers (project overrides user)
    const mergedMcp = {
      ...userConfig.mcp,
      ...projectConfig.mcp,
    };

    // Merge client settings (project overrides user)
    const mergedClients = {
      ...userConfig.clients,
      ...projectConfig.clients,
    };

    // Merge sync options (project overrides user)
    const mergedSync = {
      ...userConfig.sync,
      ...projectConfig.sync,
    };

    return {
      version: projectConfig.version || userConfig.version,
      clients:
        Object.keys(mergedClients).length > 0 ? mergedClients : undefined,
      mcp: mergedMcp,
      sync:
        Object.keys(mergedSync).length > 0
          ? (mergedSync as OvertureConfig['sync'])
          : undefined,
    };
  }

  /**
   * Load and merge configuration with automatic project detection
   *
   * Context-aware configuration loading:
   * - If run in a project directory (has .overture/config.yaml in cwd or ancestors):
   *   Loads user config + project config and merges them
   * - If run outside any project:
   *   Loads only user config
   *
   * @param projectRoot - Project root directory (optional, auto-detected if not provided)
   * @returns Merged configuration (user + project if in project, otherwise just user)
   * @throws {ConfigError} If no configuration is found
   * @throws {ValidationError} If either config is invalid
   *
   * @example
   * ```typescript
   * // Inside a project directory
   * const config = await loader.loadConfig();
   * // Returns: merged user + project config
   *
   * // Outside any project
   * const config = await loader.loadConfig();
   * // Returns: user config only
   *
   * // Force specific project root
   * const config = await loader.loadConfig('/path/to/project');
   * // Returns: merged config for that project
   * ```
   */
  async loadConfig(projectRoot?: string): Promise<OvertureConfig> {
    // Auto-detect project root if not provided
    const detectedProjectRoot =
      projectRoot || (await this.pathResolver.findProjectRoot());

    // Try to load user config (optional)
    let userConfig: OvertureConfig | null = null;
    try {
      userConfig = await this.loadUserConfig();
    } catch (error) {
      // User config is optional, ignore if not found
      if (!(error instanceof ConfigError)) {
        throw error; // Re-throw validation errors
      }
    }

    // Try to load project config (only if we detected a project)
    let projectConfig: OvertureConfig | null = null;
    if (detectedProjectRoot) {
      projectConfig = await this.loadProjectConfig(detectedProjectRoot);
    }

    // At least one config must exist
    if (!userConfig && !projectConfig) {
      throw new ConfigError(
        'No configuration found. Run "overture user init" to create user config or "overture init" for project config.',
        detectedProjectRoot || '/',
      );
    }

    // If only one config exists, return it
    if (!projectConfig) {
      if (!userConfig) {
        throw new ConfigError(
          'No configuration found after validation',
          detectedProjectRoot || '/',
        );
      }
      return userConfig;
    }
    if (!userConfig) {
      return projectConfig;
    }

    // Both exist, merge them (project context)
    return this.mergeConfigs(userConfig, projectConfig);
  }

  /**
   * Check if user config exists
   *
   * @returns True if user config file exists
   */
  async hasUserConfig(): Promise<boolean> {
    const configPath = this.pathResolver.getUserConfigPath();
    return await this.filesystem.exists(configPath);
  }

  /**
   * Check if project config exists
   *
   * @param projectRoot - Project root directory (optional)
   * @returns True if project config file exists
   */
  async hasProjectConfig(projectRoot?: string): Promise<boolean> {
    const configPath = this.pathResolver.getProjectConfigPath(projectRoot);
    return await this.filesystem.exists(configPath);
  }
}
