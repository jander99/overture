/**
 * Configuration Loader
 *
 * Loads and merges Overture configuration from user global and project-level files.
 * Implements configuration precedence rules (project overrides user).
 *
 * @module core/config-loader
 * @version 2.0
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { OvertureConfigSchema, type OvertureConfig } from '../domain/config.schema';
import { getUserConfigPath, getProjectConfigPath, findProjectRoot } from './path-resolver';

/**
 * Configuration load error
 */
export class ConfigLoadError extends Error {
  public readonly path: string;
  public override readonly cause?: Error;

  constructor(message: string, path: string, cause?: Error) {
    super(message);
    this.name = 'ConfigLoadError';
    this.path = path;
    this.cause = cause;
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  public readonly path: string;
  public readonly validationErrors: unknown[];

  constructor(message: string, path: string, validationErrors: unknown[]) {
    super(message);
    this.name = 'ConfigValidationError';
    this.path = path;
    this.validationErrors = validationErrors;
  }
}

/**
 * Format YAML parse error with line number information
 *
 * Extracts line/column info from js-yaml YAMLException and formats it nicely.
 *
 * @param error - YAML parse error from js-yaml
 * @param configPath - Path to configuration file
 * @returns Formatted error message with line numbers
 */
function formatYamlParseError(error: Error, configPath: string): string {
  // Check if error is from js-yaml (has mark property with line/column)
  const yamlError = error as any;
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
 * @throws {ConfigValidationError} If deprecated fields are found
 */
function checkForDeprecatedFields(parsed: unknown, configPath: string): void {
  if (!parsed || typeof parsed !== 'object') {
    return;
  }

  const config = parsed as Record<string, unknown>;

  // Check for deprecated 'scope' field in MCP configurations
  if ('mcp' in config && config.mcp && typeof config.mcp === 'object') {
    const mcp = config.mcp as Record<string, unknown>;

    for (const [mcpName, mcpConfig] of Object.entries(mcp)) {
      if (mcpConfig && typeof mcpConfig === 'object' && 'scope' in mcpConfig) {
        throw new ConfigValidationError(
          `Deprecated 'scope' field found in configuration`,
          configPath,
          [
            {
              code: 'deprecated_field',
              path: ['mcp', mcpName, 'scope'],
              message: `The 'scope' field has been removed in Overture v2.0`,
              suggestion:
                `Remove the 'scope' field from mcp.${mcpName}. ` +
                `Scope is now implicit based on file location:\n` +
                `  - MCPs in ~/.config/overture.yml are global\n` +
                `  - MCPs in .overture/config.yaml are project-scoped`,
            },
          ]
        );
      }
    }
  }
}

/**
 * Load user global configuration
 *
 * Reads and validates configuration from ~/.config/overture.yml
 *
 * @returns User configuration object
 * @throws {ConfigLoadError} If file cannot be read or parsed
 * @throws {ConfigValidationError} If configuration is invalid
 *
 * @example
 * ```typescript
 * const userConfig = loadUserConfig();
 * console.log(userConfig.mcp); // All user-level MCP servers
 * ```
 */
export function loadUserConfig(): OvertureConfig {
  const configPath = getUserConfigPath();

  // Check if file exists
  if (!fs.existsSync(configPath)) {
    throw new ConfigLoadError(`User config file not found`, configPath);
  }

  try {
    // Read file
    const fileContent = fs.readFileSync(configPath, 'utf-8');

    // Parse YAML
    const parsed = yaml.load(fileContent);

    // Check for deprecated fields (provides helpful migration errors)
    checkForDeprecatedFields(parsed, configPath);

    // Validate with Zod
    const result = OvertureConfigSchema.safeParse(parsed);

    if (!result.success) {
      throw new ConfigValidationError(
        `Invalid user configuration: ${result.error.message}`,
        configPath,
        result.error.issues
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw error;
    }

    // Check if this is a YAML parse error and format it with line numbers
    const errorMessage = (error as Error).name === 'YAMLException'
      ? formatYamlParseError(error as Error, configPath)
      : `Failed to load user config: ${(error as Error).message}`;

    throw new ConfigLoadError(errorMessage, configPath, error as Error);
  }
}

/**
 * Load project configuration
 *
 * Reads and validates configuration from .overture/config.yaml
 *
 * @param projectRoot - Project root directory (defaults to cwd)
 * @returns Project configuration object or null if not found
 * @throws {ConfigLoadError} If file exists but cannot be read or parsed
 * @throws {ConfigValidationError} If configuration is invalid
 *
 * @example
 * ```typescript
 * const projectConfig = loadProjectConfig();
 * if (projectConfig) {
 *   console.log(projectConfig.mcp); // Project-level MCP servers
 * }
 * ```
 */
export function loadProjectConfig(projectRoot?: string): OvertureConfig | null {
  const configPath = getProjectConfigPath(projectRoot);

  // Check if file exists (project config is optional)
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    // Read file
    const fileContent = fs.readFileSync(configPath, 'utf-8');

    // Parse YAML
    const parsed = yaml.load(fileContent);

    // Check for deprecated fields (provides helpful migration errors)
    checkForDeprecatedFields(parsed, configPath);

    // Validate with Zod
    const result = OvertureConfigSchema.safeParse(parsed);

    if (!result.success) {
      throw new ConfigValidationError(
        `Invalid project configuration: ${result.error.message}`,
        configPath,
        result.error.issues
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw error;
    }

    // Check if this is a YAML parse error and format it with line numbers
    const errorMessage = (error as Error).name === 'YAMLException'
      ? formatYamlParseError(error as Error, configPath)
      : `Failed to load project config: ${(error as Error).message}`;

    throw new ConfigLoadError(errorMessage, configPath, error as Error);
  }
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
 * const user = loadUserConfig();
 * const project = loadProjectConfig();
 * const merged = mergeConfigs(user, project);
 * ```
 */
export function mergeConfigs(userConfig: OvertureConfig, projectConfig: OvertureConfig | null): OvertureConfig {
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
    clients: Object.keys(mergedClients).length > 0 ? mergedClients : undefined,
    mcp: mergedMcp,
    sync: Object.keys(mergedSync).length > 0 ? (mergedSync as OvertureConfig['sync']) : undefined,
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
 * @throws {ConfigLoadError} If no configuration is found
 * @throws {ConfigValidationError} If either config is invalid
 *
 * @example
 * ```typescript
 * // Inside a project directory
 * const config = loadConfig();
 * // Returns: merged user + project config
 *
 * // Outside any project
 * const config = loadConfig();
 * // Returns: user config only
 *
 * // Force specific project root
 * const config = loadConfig('/path/to/project');
 * // Returns: merged config for that project
 * ```
 */
export function loadConfig(projectRoot?: string): OvertureConfig {
  // Auto-detect project root if not provided
  const detectedProjectRoot = projectRoot || findProjectRoot();

  // Try to load user config (optional)
  let userConfig: OvertureConfig | null = null;
  try {
    userConfig = loadUserConfig();
  } catch (error) {
    // User config is optional, ignore if not found
    if (!(error instanceof ConfigLoadError)) {
      throw error; // Re-throw validation errors
    }
  }

  // Try to load project config (only if we detected a project)
  let projectConfig: OvertureConfig | null = null;
  if (detectedProjectRoot) {
    projectConfig = loadProjectConfig(detectedProjectRoot);
  }

  // At least one config must exist
  if (!userConfig && !projectConfig) {
    throw new ConfigLoadError(
      'No configuration found. Run "overture user init" to create user config or "overture init" for project config.',
      detectedProjectRoot || process.cwd()
    );
  }

  // If only one config exists, return it
  if (!projectConfig) {
    return userConfig!;
  }
  if (!userConfig) {
    return projectConfig;
  }

  // Both exist, merge them (project context)
  return mergeConfigs(userConfig, projectConfig);
}

/**
 * Check if user config exists
 *
 * @returns True if user config file exists
 */
export function hasUserConfig(): boolean {
  const configPath = getUserConfigPath();
  return fs.existsSync(configPath);
}

/**
 * Check if project config exists
 *
 * @param projectRoot - Project root directory (optional)
 * @returns True if project config file exists
 */
export function hasProjectConfig(projectRoot?: string): boolean {
  const configPath = getProjectConfigPath(projectRoot);
  return fs.existsSync(configPath);
}
