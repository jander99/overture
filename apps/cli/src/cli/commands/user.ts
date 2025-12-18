import * as yaml from 'js-yaml';
import chalk from 'chalk';
import { Command } from 'commander';
import { Prompts, Logger } from '@overture/utils';
import { OvertureConfigSchema } from '@overture/config-schema';
import { ConfigError } from '@overture/errors';
import type { OvertureConfig } from '@overture/config-types';
import type { AppDependencies } from '../../composition-root';
import { validateEnvVarReferences, getFixSuggestion } from '../../lib/validators/env-var-validator';

/**
 * Common MCP servers available for global configuration
 */
const COMMON_MCP_SERVERS: Array<{ name: string; value: string; checked?: boolean }> = [
  { name: 'filesystem - File operations and directory management', value: 'filesystem', checked: true },
  { name: 'memory - Cross-conversation knowledge graph', value: 'memory', checked: true },
  { name: 'sequentialthinking - Complex problem-solving', value: 'sequentialthinking', checked: true },
  { name: 'context7 - Up-to-date library documentation', value: 'context7', checked: true },
  { name: 'nx - Monorepo management and build orchestration', value: 'nx', checked: false },
  { name: 'github - GitHub API integration', value: 'github', checked: false },
  { name: 'sqlite - SQLite database operations', value: 'sqlite', checked: false },
  { name: 'postgres - PostgreSQL database operations', value: 'postgres', checked: false },
];

/**
 * MCP server configurations with sensible defaults
 */
const MCP_SERVER_DEFAULTS: Record<string, Partial<OvertureConfig['mcp'][string]>> = {
  filesystem: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/home'],
    env: {},
    transport: 'stdio',
  },
  memory: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {},
    transport: 'stdio',
  },
  sequentialthinking: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    env: {},
    transport: 'stdio',
  },
  context7: {
    command: 'npx',
    args: ['-y', '@context7/mcp-server'],
    env: {},
    transport: 'stdio',
  },
  nx: {
    command: 'npx',
    args: ['-y', '@nx/mcp-server'],
    env: {},
    transport: 'stdio',
  },
  github: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
    transport: 'stdio',
  },
  sqlite: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite'],
    env: {},
    transport: 'stdio',
  },
  postgres: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: {
      POSTGRES_CONNECTION_STRING: '${POSTGRES_CONNECTION_STRING}',
    },
    transport: 'stdio',
  },
};

/**
 * Format type for output display
 */
type OutputFormat = 'yaml' | 'json';

/**
 * Creates the 'user' command group for managing user global configuration.
 *
 * Usage:
 * - overture user init - Initialize user global configuration at ~/.config/overture.yml
 * - overture user show [--format <yaml|json>] - Display user global configuration
 */
export function createUserCommand(deps: AppDependencies): Command {
  const { configLoader, pathResolver, filesystem, output } = deps;
  const command = new Command('user');

  command.description('Manage user global configuration');

  // user init subcommand
  command
    .command('init')
    .description('Initialize user global configuration at ~/.config/overture.yml')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
      try {
        const userConfigPath = pathResolver.getUserConfigPath();
        const configDir = pathResolver.getUserConfigDir();

        // Check if config already exists
        if (filesystem.fileExists(userConfigPath) && !options.force) {
          output.error('User configuration already exists');
          output.info(`Location: ${userConfigPath}`);
          output.info('Use --force to overwrite or edit the file directly');
          process.exit(1);
        }

        output.info('Initializing user global configuration...');
        output.nl();

        // Prompt for MCP servers to enable
        const selectedMcps = await Prompts.multiSelect(
          'Select MCP servers to enable globally:',
          COMMON_MCP_SERVERS
        );

        if (selectedMcps.length === 0) {
          output.warn('No MCP servers selected');
          const shouldContinue = await Prompts.confirm(
            'Continue without any MCP servers?',
            false
          );

          if (!shouldContinue) {
            output.info('Configuration cancelled');
            process.exit(0);
          }
        }

        // Build MCP configuration
        const mcpConfig: OvertureConfig['mcp'] = {};
        for (const mcpName of selectedMcps) {
          const defaults = MCP_SERVER_DEFAULTS[mcpName];
          if (defaults) {
            mcpConfig[mcpName] = {
              command: defaults.command!,
              args: defaults.args!,
              env: defaults.env!,
              transport: defaults.transport!,
            };
          }
        }

        // Build user configuration
        const userConfig: OvertureConfig = {
          version: '2.0',
          mcp: mcpConfig,
          clients: {
            'claude-code': { enabled: true },
            'claude-desktop': { enabled: true },
            vscode: { enabled: false },
            cursor: { enabled: false },
            windsurf: { enabled: false },
            'copilot-cli': { enabled: false },
            'jetbrains-copilot': { enabled: false },
          },
          sync: {
            backup: true,
            backupDir: '~/.config/overture/backups',
            backupRetention: 10,
            mergeStrategy: 'append',
            autoDetectClients: true,
          },
        };

        // Validate configuration
        const validationResult = OvertureConfigSchema.safeParse(userConfig);
        if (!validationResult.success) {
          output.error('Configuration validation failed');
          output.error(validationResult.error.message);
          process.exit(1);
        }

        // Validate environment variable security (detect hardcoded credentials)
        const envVarValidation = validateEnvVarReferences(userConfig);
        if (!envVarValidation.valid) {
          output.nl();
          output.warn('⚠️  Environment variable security warnings:');
          envVarValidation.issues.forEach((issue) => output.warn(`  - ${issue}`));
          output.info(getFixSuggestion(envVarValidation.issues));
          output.nl();
        }

        // Confirmation
        output.nl();
        output.info('Configuration summary:');
        output.info(`  Location: ${userConfigPath}`);
        output.info(`  MCP servers: ${selectedMcps.length}`);
        if (selectedMcps.length > 0) {
          selectedMcps.forEach((mcp) => {
            output.info(`    - ${mcp}`);
          });
        }
        output.nl();

        const shouldProceed = await Prompts.confirm(
          'Create user configuration?',
          true
        );

        if (!shouldProceed) {
          output.info('Configuration cancelled');
          process.exit(0);
        }

        // Create config directory if it doesn't exist
        if (!filesystem.directoryExists(configDir)) {
          filesystem.createDirectory(configDir);
          output.debug(`Created directory: ${configDir}`);
        }

        // Write YAML configuration
        const yamlContent = yaml.dump(userConfig, {
          indent: 2,
          lineWidth: 100,
          noRefs: true,
        });

        filesystem.writeFile(userConfigPath, yamlContent);

        output.success('User configuration created!');
        output.info(`Location: ${userConfigPath}`);
        output.nl();
        output.info('Next steps:');
        output.info('  1. Review and customize the configuration file');
        output.info('  2. Set any required environment variables (e.g., GITHUB_TOKEN)');
        output.info('  3. Run `overture sync` to apply configuration to clients');
      } catch (error) {
        // Don't handle process.exit() errors - let them propagate
        if (error instanceof Error && error.message.startsWith('process.exit:')) {
          throw error;
        }

        output.error(`Failed to initialize user configuration: ${(error as Error).message}`);
        process.exit((error as any).exitCode || 1);
      }
    });

  // user show subcommand
  command
    .command('show')
    .description('Display user global configuration')
    .option('-f, --format <format>', 'Output format (yaml or json)', 'yaml')
    .action(async (options: { format: string }) => {
      try {
        const configPath = pathResolver.getUserConfigPath();

        // Check if config exists
        if (!configLoader.hasUserConfig()) {
          output.warn('User configuration not found');
          output.info(`Expected location: ${configPath}`);
          output.nl();
          output.info('Create a user config to define global MCP servers that apply to all projects.');
          output.info('Run `overture user init` to create a user configuration.');
          process.exit(2);
        }

        // Validate format option
        const format = options.format.toLowerCase();
        if (format !== 'yaml' && format !== 'json') {
          output.error(`Invalid format: ${format}`);
          output.info('Valid formats: yaml, json');
          process.exit(1);
        }

        // Load config
        const config = await configLoader.loadUserConfig();

        // Display config
        displayUserConfig(config, configPath, format as OutputFormat);
      } catch (error) {
        // Don't handle process.exit() errors - let them propagate
        if (error instanceof Error && error.message.startsWith('process.exit:')) {
          throw error;
        }

        if (error instanceof ConfigError) {
          output.error('Failed to load user configuration');
          output.error(error.message);
          if (error.filePath) {
            output.debug(`Path: ${error.filePath}`);
          }
          process.exit(1);
        }

        output.error(`Failed to display user configuration: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}

/**
 * Display user configuration with formatted output
 *
 * @param config - User configuration object
 * @param configPath - Path to config file
 * @param format - Output format (yaml or json)
 */
function displayUserConfig(config: OvertureConfig, configPath: string, format: OutputFormat): void {
  // Header
  Logger.nl();
  console.log(chalk.bold.cyan('User Global Configuration'));
  console.log(chalk.gray(`Location: ${configPath}`));
  Logger.nl();

  if (format === 'json') {
    // JSON output
    const output = JSON.stringify(config, null, 2);
    console.log(output);
    Logger.nl();
    return;
  }

  // YAML output with sections and highlighting
  console.log(chalk.bold('Version:'));
  console.log(chalk.yellow(`  ${config.version}`));
  Logger.nl();

  // Display client configuration
  if (config.clients && Object.keys(config.clients).length > 0) {
    console.log(chalk.bold('Clients:'));
    for (const [clientName, clientConfig] of Object.entries(config.clients)) {
      const enabledText = clientConfig.enabled !== false ? chalk.green('enabled') : chalk.red('disabled');
      console.log(chalk.cyan(`  ${clientName}:`), enabledText);

      if (clientConfig.configPath) {
        const pathDisplay = typeof clientConfig.configPath === 'string'
          ? clientConfig.configPath
          : JSON.stringify(clientConfig.configPath);
        console.log(chalk.gray(`    config-path: ${pathDisplay}`));
      }

      if (clientConfig.maxServers) {
        console.log(chalk.gray(`    max-servers: ${clientConfig.maxServers}`));
      }
    }
    Logger.nl();
  }

  // Display MCP servers
  if (config.mcp && Object.keys(config.mcp).length > 0) {
    console.log(chalk.bold('MCP Servers:'));

    for (const [name, mcp] of Object.entries(config.mcp)) {
      console.log(chalk.cyan(`  ${name}:`));
      console.log(chalk.gray(`    command: ${mcp.command}`));
      if (mcp.args && mcp.args.length > 0) {
        console.log(chalk.gray(`    args: [${mcp.args.join(', ')}]`));
      }
      console.log(chalk.gray(`    transport: ${mcp.transport}`));

      if (mcp.version) {
        console.log(chalk.gray(`    version: ${mcp.version}`));
      }

      if (mcp.env && Object.keys(mcp.env).length > 0) {
        console.log(chalk.gray('    env:'));
        for (const [key, value] of Object.entries(mcp.env)) {
          console.log(chalk.gray(`      ${key}: ${value}`));
        }
      }

      if (mcp.clients) {
        if (mcp.clients.exclude && mcp.clients.exclude.length > 0) {
          console.log(chalk.gray(`    exclude-clients: [${mcp.clients.exclude.join(', ')}]`));
        }
        if (mcp.clients.include && mcp.clients.include.length > 0) {
          console.log(chalk.gray(`    include-clients: [${mcp.clients.include.join(', ')}]`));
        }
      }

      if (mcp.platforms) {
        if (mcp.platforms.exclude && mcp.platforms.exclude.length > 0) {
          console.log(chalk.gray(`    exclude-platforms: [${mcp.platforms.exclude.join(', ')}]`));
        }
      }
    }

    Logger.nl();
  } else {
    console.log(chalk.yellow('No MCP servers configured'));
    Logger.nl();
  }

  // Display sync options
  if (config.sync) {
    console.log(chalk.bold('Sync Options:'));

    if (config.sync.backup !== undefined) {
      const backupText = config.sync.backup ? chalk.green('enabled') : chalk.red('disabled');
      console.log(`  backup: ${backupText}`);
    }

    if (config.sync.backupDir) {
      console.log(chalk.gray(`  backup-dir: ${config.sync.backupDir}`));
    }

    if (config.sync.backupRetention !== undefined) {
      console.log(chalk.gray(`  backup-retention: ${config.sync.backupRetention}`));
    }

    Logger.nl();
  }

  // Footer with summary
  const mcpCount = config.mcp ? Object.keys(config.mcp).length : 0;
  const clientCount = config.clients ? Object.keys(config.clients).length : 0;

  console.log(chalk.gray(`Total: ${mcpCount} MCP servers, ${clientCount} clients configured`));
  Logger.nl();
}
