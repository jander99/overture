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
import { OvertureConfigV2Schema, type OvertureConfigV2 } from '../domain/config-v2.schema';
import { getUserConfigPath, getProjectConfigPath } from './path-resolver';

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
export function loadUserConfig(): OvertureConfigV2 {
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

    // Validate with Zod
    const result = OvertureConfigV2Schema.safeParse(parsed);

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

    throw new ConfigLoadError(`Failed to load user config: ${(error as Error).message}`, configPath, error as Error);
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
export function loadProjectConfig(projectRoot?: string): OvertureConfigV2 | null {
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

    // Validate with Zod
    const result = OvertureConfigV2Schema.safeParse(parsed);

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

    throw new ConfigLoadError(
      `Failed to load project config: ${(error as Error).message}`,
      configPath,
      error as Error
    );
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
export function mergeConfigs(userConfig: OvertureConfigV2, projectConfig: OvertureConfigV2 | null): OvertureConfigV2 {
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
    sync: Object.keys(mergedSync).length > 0 ? (mergedSync as OvertureConfigV2['sync']) : undefined,
  };
}

/**
 * Load and merge configuration
 *
 * Convenience function that loads both user and project configs and merges them.
 * User config is optional - if it doesn't exist, only project config is used.
 * At least one config (user or project) must exist.
 *
 * @param projectRoot - Project root directory (optional)
 * @returns Merged configuration
 * @throws {ConfigLoadError} If no configuration is found
 * @throws {ConfigValidationError} If either config is invalid
 *
 * @example
 * ```typescript
 * try {
 *   const config = loadConfig();
 *   console.log(config.mcp); // All MCP servers (user + project)
 * } catch (error) {
 *   if (error instanceof ConfigLoadError) {
 *     console.error('Config not found:', error.path);
 *   }
 * }
 * ```
 */
export function loadConfig(projectRoot?: string): OvertureConfigV2 {
  // Try to load user config (optional)
  let userConfig: OvertureConfigV2 | null = null;
  try {
    userConfig = loadUserConfig();
  } catch (error) {
    // User config is optional, ignore if not found
    if (!(error instanceof ConfigLoadError)) {
      throw error; // Re-throw validation errors
    }
  }

  // Try to load project config (optional)
  const projectConfig = loadProjectConfig(projectRoot);

  // At least one config must exist
  if (!userConfig && !projectConfig) {
    throw new ConfigLoadError(
      'No configuration found. Run "overture user init" to create user config or "overture init" for project config.',
      projectRoot || process.cwd()
    );
  }

  // If only one config exists, return it
  if (!projectConfig) {
    return userConfig!;
  }
  if (!userConfig) {
    return projectConfig;
  }

  // Both exist, merge them
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
