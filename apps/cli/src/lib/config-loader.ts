/**
 * Config Loading Utilities
 *
 * Centralized config loading pattern for commands.
 * Loads user config, optional project config, and provides merged config.
 */

import type { OvertureConfig } from '@overture/config-types';
import type { PathResolver, ConfigLoader } from '@overture/config-core';

/**
 * Result of loading user and project configs
 */
export type LoadedConfigs = {
  userConfig: OvertureConfig;
  projectConfig: OvertureConfig | null;
  projectRoot: string | null;
};

/**
 * Load user config and optional project config
 *
 * This utility provides a consistent pattern for loading configurations:
 * 1. Always loads user config (required)
 * 2. Attempts to find project root
 * 3. Loads project config if project root exists
 *
 * @param pathResolver - Path resolution service
 * @param configLoader - Config loading service
 * @returns Object containing user config, optional project config, and project root
 */
export async function loadConfigs(
  pathResolver: PathResolver,
  configLoader: ConfigLoader,
): Promise<LoadedConfigs> {
  const userConfig = await configLoader.loadUserConfig();
  const projectRoot = await pathResolver.findProjectRoot();
  const projectConfig = projectRoot
    ? await configLoader.loadProjectConfig(projectRoot)
    : null;

  return {
    userConfig,
    projectConfig,
    projectRoot,
  };
}

/**
 * Load and merge user and project configs
 *
 * Convenience function that loads both configs and merges them.
 * Useful when you need the final merged configuration.
 *
 * @param pathResolver - Path resolution service
 * @param configLoader - Config loading service
 * @returns Merged configuration
 */
export async function loadMergedConfig(
  pathResolver: PathResolver,
  configLoader: ConfigLoader,
): Promise<OvertureConfig> {
  const { userConfig, projectConfig } = await loadConfigs(
    pathResolver,
    configLoader,
  );
  return configLoader.mergeConfigs(userConfig, projectConfig);
}
