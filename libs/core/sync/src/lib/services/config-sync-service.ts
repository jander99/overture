import type { OvertureConfig, ClientName } from '@overture/config-types';
import type { EnvironmentPort } from '@overture/ports-process';
import type { OutputPort } from '@overture/ports-output';
import type { ConfigLoader } from '@overture/config-core';
import {
  validateConfigEnvVars,
  formatEnvVarWarnings,
} from '../env-var-validator.js';

export interface ConfigSyncServiceDeps {
  configLoader: ConfigLoader;
  environment: EnvironmentPort;
  output: OutputPort;
  pathResolver: {
    findProjectRoot(): string | null;
  };
}

export interface ConfigLoadResult {
  userConfig: OvertureConfig | null;
  projectConfig: OvertureConfig | null;
  mergedConfig: OvertureConfig;
  mcpSources: Record<string, 'global' | 'project'>;
  warnings: string[];
  projectRoot: string | null;
}

const DEFAULT_CLIENTS: ClientName[] = [
  'claude-code',
  'copilot-cli',
  'opencode',
];

export class ConfigSyncService {
  constructor(private readonly deps: ConfigSyncServiceDeps) {}

  async loadConfigurations(projectRoot?: string): Promise<ConfigLoadResult> {
    const warnings: string[] = [];

    const detectedProjectRoot =
      projectRoot || this.deps.pathResolver.findProjectRoot();

    const userConfig = await this.deps.configLoader.loadUserConfig();
    const projectConfig = detectedProjectRoot
      ? await this.deps.configLoader.loadProjectConfig(detectedProjectRoot)
      : null;

    const mergedConfig = this.deps.configLoader.mergeConfigs(
      userConfig,
      projectConfig,
    );

    const configWarnings = this.validateConfigForWarnings(
      userConfig,
      projectConfig,
    );
    warnings.push(...configWarnings);

    const envVarWarnings = validateConfigEnvVars(
      mergedConfig,
      this.deps.environment.env,
    );
    if (envVarWarnings.length > 0) {
      warnings.push(...envVarWarnings);
      const formatted = formatEnvVarWarnings(envVarWarnings);
      if (formatted) {
        this.deps.output.warn(formatted);
      }
    }

    const mcpSources = this.deps.configLoader.getMcpSources(
      userConfig,
      projectConfig,
    );

    return {
      userConfig,
      projectConfig,
      mergedConfig,
      mcpSources,
      warnings,
      projectRoot: detectedProjectRoot,
    };
  }

  private validateConfigForWarnings(
    userConfig: OvertureConfig | null,
    projectConfig: OvertureConfig | null,
  ): string[] {
    const warnings: string[] = [];
    const validClients = new Set<string>(DEFAULT_CLIENTS);

    if (userConfig) {
      warnings.push(
        ...this.validateSingleConfigForWarnings(
          userConfig,
          'User',
          '~/.config/overture.yml',
          validClients,
        ),
      );
    }

    if (projectConfig) {
      warnings.push(
        ...this.validateSingleConfigForWarnings(
          projectConfig,
          'Project',
          '.overture/config.yaml',
          validClients,
        ),
      );
    }

    return warnings;
  }

  private validateSingleConfigForWarnings(
    config: OvertureConfig,
    configType: 'User' | 'Project',
    configPath: string,
    validClients: Set<string>,
  ): string[] {
    const warnings: string[] = [];

    if (config.version !== '1.0') {
      warnings.push(
        `${configType} config has version '${config.version}' but should be '1.0'. ` +
          `Update ${configPath} to use version: "1.0"`,
      );
    }

    if (config.clients) {
      const invalidClients = Object.keys(config.clients).filter(
        (client) => !validClients.has(client),
      );
      if (invalidClients.length > 0) {
        warnings.push(
          `${configType} config references unsupported clients: ${invalidClients.join(', ')}. ` +
            `Valid clients are: ${Array.from(validClients).join(', ')}. ` +
            `Remove these from the 'clients' section in ${configPath}`,
        );
      }
    }

    return warnings;
  }
}

export function createConfigSyncService(
  deps: ConfigSyncServiceDeps,
): ConfigSyncService {
  return new ConfigSyncService(deps);
}
