import * as yaml from 'js-yaml';
import * as path from 'path';
import { FsUtils } from '../infrastructure/fs-utils';
import { OvertureConfigSchema, type OvertureConfig } from '../domain/schemas';
import { ConfigError } from '../domain/errors';
import { CONFIG_PATH, GLOBAL_CONFIG_DIR } from '../domain/constants';

export class ConfigManager {
  /**
   * Load project configuration from .overture/config.yaml
   */
  static async loadProjectConfig(
    projectDir: string = process.cwd()
  ): Promise<OvertureConfig | null> {
    const configPath = path.join(projectDir, CONFIG_PATH);

    if (!(await FsUtils.exists(configPath))) {
      return null;
    }

    return this.loadConfigFromFile(configPath);
  }

  /**
   * Load global configuration from ~/.config/overture/config.yaml
   */
  static async loadGlobalConfig(): Promise<OvertureConfig | null> {
    const configPath = path.join(GLOBAL_CONFIG_DIR, 'config.yaml');

    if (!(await FsUtils.exists(configPath))) {
      return null;
    }

    return this.loadConfigFromFile(configPath);
  }

  /**
   * Load and validate config from file (private helper)
   */
  private static async loadConfigFromFile(
    filePath: string
  ): Promise<OvertureConfig> {
    try {
      const content = await FsUtils.readFile(filePath);
      const parsed = yaml.load(content);

      // Validate with Zod
      const result = OvertureConfigSchema.safeParse(parsed);

      if (!result.success) {
        throw new ConfigError(
          `Invalid configuration: ${result.error.message}`,
          filePath
        );
      }

      return result.data;
    } catch (error) {
      if (error instanceof ConfigError) throw error;

      throw new ConfigError(
        `Failed to parse YAML: ${(error as Error).message}`,
        filePath
      );
    }
  }

  /**
   * Merge global and project configs (project takes precedence)
   */
  static mergeConfigs(
    global: OvertureConfig | null,
    project: OvertureConfig | null
  ): OvertureConfig {
    if (!global && !project) {
      throw new ConfigError('No configuration found');
    }

    // Project config takes precedence
    return {
      version: project?.version || global?.version || '1.0',
      project: project?.project,
      plugins: {
        ...global?.plugins,
        ...project?.plugins,
      },
      mcp: {
        ...global?.mcp,
        ...project?.mcp,
      },
    };
  }

  /**
   * Save configuration to file as YAML
   */
  static async saveConfig(
    config: OvertureConfig,
    filePath: string
  ): Promise<void> {
    try {
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: 80,
        noRefs: true,
      });

      await FsUtils.writeFile(filePath, yamlContent);
    } catch (error) {
      throw new ConfigError(
        `Failed to save configuration: ${(error as Error).message}`,
        filePath
      );
    }
  }

  /**
   * Initialize new project configuration with defaults
   */
  static async initializeConfig(
    projectDir: string,
    projectType?: string
  ): Promise<OvertureConfig> {
    const config: OvertureConfig = {
      version: '1.0',
      project: {
        name: path.basename(projectDir),
        type: projectType,
      },
      plugins: {},
      mcp: {},
    };

    const configPath = path.join(projectDir, CONFIG_PATH);
    await this.saveConfig(config, configPath);

    return config;
  }
}
