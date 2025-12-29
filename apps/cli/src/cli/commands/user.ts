import * as yaml from 'js-yaml';
import chalk from 'chalk';
import { Command } from 'commander';
import {
  Prompts,
  Logger,
  ErrorHandler,
  UserCancelledError,
} from '@overture/utils';
import { OvertureConfigSchema } from '@overture/config-schema';
import type { OvertureConfig } from '@overture/config-types';
import type { AppDependencies } from '../../composition-root';
import {
  validateEnvVarReferences,
  getFixSuggestion,
} from '../../lib/validators/env-var-validator';

/**
 * Common MCP servers available for global configuration
 */
const COMMON_MCP_SERVERS: Array<{
  name: string;
  value: string;
  checked?: boolean;
}> = [
  {
    name: 'filesystem - File operations and directory management',
    value: 'filesystem',
    checked: true,
  },
  {
    name: 'memory - Cross-conversation knowledge graph',
    value: 'memory',
    checked: true,
  },
  {
    name: 'sequentialthinking - Complex problem-solving',
    value: 'sequentialthinking',
    checked: true,
  },
  {
    name: 'context7 - Up-to-date library documentation',
    value: 'context7',
    checked: true,
  },
  {
    name: 'nx - Monorepo management and build orchestration',
    value: 'nx',
    checked: false,
  },
  { name: 'github - GitHub API integration', value: 'github', checked: false },
  {
    name: 'sqlite - SQLite database operations',
    value: 'sqlite',
    checked: false,
  },
  {
    name: 'postgres - PostgreSQL database operations',
    value: 'postgres',
    checked: false,
  },
];

/**
 * MCP server configurations with sensible defaults
 */
const MCP_SERVER_DEFAULTS: Record<
  string,
  Partial<OvertureConfig['mcp'][string]>
> = {
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
 * Prompt user for MCP server selection and handle empty selection case
 *
 * @param output - Output port for displaying messages
 * @returns Selected MCP server names
 */
async function selectMcpServers(output: unknown): Promise<string[]> {
  const selectedMcps = await Prompts.multiSelect(
    'Select MCP servers to enable globally:',
    COMMON_MCP_SERVERS,
  );

  if (selectedMcps.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (output as any).warn('No MCP servers selected');
    const shouldContinue = await Prompts.confirm(
      'Continue without any MCP servers?',
      false,
    );

    if (!shouldContinue) {
      throw new UserCancelledError('Configuration cancelled');
    }
  }

  return selectedMcps;
}

/**
 * Build MCP configuration from selected server names
 *
 * @param selectedMcps - Array of selected MCP server names
 * @returns MCP configuration object
 */
function buildMcpConfig(selectedMcps: string[]): OvertureConfig['mcp'] {
  const mcpConfig: OvertureConfig['mcp'] = {};
  for (const mcpName of selectedMcps) {
    if (Object.hasOwn(MCP_SERVER_DEFAULTS, mcpName)) {
      // eslint-disable-next-line security/detect-object-injection
      const defaults = MCP_SERVER_DEFAULTS[mcpName];
      if (
        defaults?.command &&
        defaults?.args &&
        defaults?.env &&
        defaults?.transport
      ) {
        // eslint-disable-next-line security/detect-object-injection
        mcpConfig[mcpName] = {
          command: defaults.command,
          args: defaults.args,
          env: defaults.env,
          transport: defaults.transport,
        };
      }
    }
  }
  return mcpConfig;
}

/**
 * Build complete user configuration object
 *
 * @param mcpConfig - MCP configuration object
 * @returns Complete user configuration
 */
function buildUserConfig(mcpConfig: OvertureConfig['mcp']): OvertureConfig {
  return {
    version: '2.0',
    mcp: mcpConfig,
    clients: {
      'claude-code': { enabled: true },
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
}

/**
 * Display configuration summary and get user confirmation
 *
 * @param output - Output port for displaying messages
 * @param userConfigPath - Path to the configuration file
 * @param selectedMcps - Array of selected MCP server names
 * @returns true if user confirmed to proceed, false otherwise
 */
async function confirmConfiguration(
  output: unknown,
  userConfigPath: string,
  selectedMcps: string[],
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = output as any;
  out.nl();
  out.info('Configuration summary:');
  out.info(`  Location: ${userConfigPath}`);
  out.info(`  MCP servers: ${selectedMcps.length}`);
  if (selectedMcps.length > 0) {
    selectedMcps.forEach((mcp) => {
      out.info(`    - ${mcp}`);
    });
  }
  out.nl();

  return await Prompts.confirm('Create user configuration?', true);
}

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
    .description(
      'Initialize user global configuration at ~/.config/overture.yml',
    )
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
      try {
        const userConfigPath = pathResolver.getUserConfigPath();
        const configDir = pathResolver.getUserConfigDir();

        // Check if config already exists
        if (filesystem.fileExists(userConfigPath) && !options.force) {
          throw Object.assign(
            new Error(
              `User configuration already exists at ${userConfigPath}. Use --force to overwrite or edit the file directly`,
            ),
            { exitCode: 1 },
          );
        }

        output.info('Initializing user global configuration...');
        output.nl();

        // Step 1: Select MCP servers
        const selectedMcps = await selectMcpServers(output);

        // Step 2: Build MCP configuration
        const mcpConfig = buildMcpConfig(selectedMcps);

        // Step 3: Build user configuration
        const userConfig = buildUserConfig(mcpConfig);

        // Step 4: Validate configuration schema
        const validationResult = OvertureConfigSchema.safeParse(userConfig);
        if (!validationResult.success) {
          throw Object.assign(
            new Error(
              `Configuration validation failed: ${validationResult.error.message}`,
            ),
            { exitCode: 3 },
          );
        }

        // Step 5: Validate environment variable security
        const envVarValidation = validateEnvVarReferences(userConfig);
        if (!envVarValidation.valid) {
          output.nl();
          output.warn('⚠️  Environment variable security warnings:');
          envVarValidation.issues.forEach((issue) =>
            output.warn(`  - ${issue}`),
          );
          output.info(getFixSuggestion(envVarValidation.issues));
          output.nl();
        }

        // Step 6: Get user confirmation
        const shouldProceed = await confirmConfiguration(
          output,
          userConfigPath,
          selectedMcps,
        );

        if (!shouldProceed) {
          throw new UserCancelledError('Configuration cancelled');
        }

        // Step 7: Create config directory if needed
        if (!filesystem.directoryExists(configDir)) {
          filesystem.createDirectory(configDir);
          output.debug(`Created directory: ${configDir}`);
        }

        // Step 8: Write YAML configuration
        const yamlContent = yaml.dump(userConfig, {
          indent: 2,
          lineWidth: 100,
          noRefs: true,
        });

        await filesystem.writeFile(userConfigPath, yamlContent);

        output.success('User configuration created!');
        output.info(`Location: ${userConfigPath}`);
        output.nl();
        output.info('Next steps:');
        output.info('  1. Review and customize the configuration file');
        output.info(
          '  2. Set any required environment variables (e.g., GITHUB_TOKEN)',
        );
        output.info(
          '  3. Run `overture sync` to apply configuration to clients',
        );
      } catch (error) {
        const verbose =
          process.env.DEBUG === '1' || process.env.DEBUG === 'true';
        ErrorHandler.handleCommandError(error, 'user init', verbose);
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
        if (!(await configLoader.hasUserConfig())) {
          throw Object.assign(
            new Error(
              `User configuration not found. Expected location: ${configPath}. Run \`overture user init\` to create a user configuration.`,
            ),
            { exitCode: 2 },
          );
        }

        // Validate format option
        const format = options.format.toLowerCase();
        if (format !== 'yaml' && format !== 'json') {
          throw Object.assign(
            new Error(`Invalid format: ${format}. Valid formats: yaml, json`),
            { exitCode: 1 },
          );
        }

        // Load config
        const config = await configLoader.loadUserConfig();

        // Display config
        displayUserConfig(config, configPath, format as OutputFormat);
      } catch (error) {
        const verbose =
          process.env.DEBUG === '1' || process.env.DEBUG === 'true';
        ErrorHandler.handleCommandError(error, 'user show', verbose);
      }
    });

  return command;
}

/**
 * Display client configuration section
 *
 * @param clients - Client configuration object
 */
function displayClients(clients: OvertureConfig['clients'] | undefined): void {
  if (!clients || Object.keys(clients).length === 0) {
    return;
  }

  console.log(chalk.bold('Clients:'));
  for (const [clientName, clientConfig] of Object.entries(clients)) {
    const enabledText =
      clientConfig.enabled !== false
        ? chalk.green('enabled')
        : chalk.red('disabled');
    console.log(chalk.cyan(`  ${clientName}:`), enabledText);

    if (clientConfig.configPath) {
      const pathDisplay =
        typeof clientConfig.configPath === 'string'
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

/**
 * Display environment variables for an MCP server
 *
 * @param env - Environment variables object
 */
function displayMcpEnv(env: Record<string, string> | undefined): void {
  if (!env || Object.keys(env).length === 0) {
    return;
  }

  console.log(chalk.gray('    env:'));
  for (const [key, value] of Object.entries(env)) {
    console.log(chalk.gray(`      ${key}: ${value}`));
  }
}

/**
 * Display client filters for an MCP server
 *
 * @param clients - Client filter configuration
 */
function displayMcpClientFilters(
  clients:
    | {
        exclude?: string[];
        include?: string[];
      }
    | undefined,
): void {
  if (!clients) {
    return;
  }

  if (clients.exclude && clients.exclude.length > 0) {
    console.log(
      chalk.gray(`    exclude-clients: [${clients.exclude.join(', ')}]`),
    );
  }
  if (clients.include && clients.include.length > 0) {
    console.log(
      chalk.gray(`    include-clients: [${clients.include.join(', ')}]`),
    );
  }
}

/**
 * Display a single MCP server configuration
 *
 * @param name - MCP server name
 * @param mcpConfig - MCP server configuration
 */
function displayMcpServer(
  name: string,
  mcpConfig: OvertureConfig['mcp'][string],
): void {
  console.log(chalk.cyan(`  ${name}:`));
  console.log(chalk.gray(`    command: ${mcpConfig.command}`));
  if (mcpConfig.args && mcpConfig.args.length > 0) {
    console.log(chalk.gray(`    args: [${mcpConfig.args.join(', ')}]`));
  }
  console.log(chalk.gray(`    transport: ${mcpConfig.transport}`));

  if (mcpConfig.version) {
    console.log(chalk.gray(`    version: ${mcpConfig.version}`));
  }

  displayMcpEnv(mcpConfig.env);
  displayMcpClientFilters(mcpConfig.clients);

  if (
    mcpConfig.platforms &&
    mcpConfig.platforms.exclude &&
    mcpConfig.platforms.exclude.length > 0
  ) {
    console.log(
      chalk.gray(
        `    exclude-platforms: [${mcpConfig.platforms.exclude.join(', ')}]`,
      ),
    );
  }
}

/**
 * Display MCP servers configuration section
 *
 * @param mcp - MCP configuration object
 */
function displayMcpServers(mcp: OvertureConfig['mcp'] | undefined): void {
  if (!mcp || Object.keys(mcp).length === 0) {
    console.log(chalk.yellow('No MCP servers configured'));
    Logger.nl();
    return;
  }

  console.log(chalk.bold('MCP Servers:'));

  for (const [name, mcpConfig] of Object.entries(mcp)) {
    displayMcpServer(name, mcpConfig);
  }

  Logger.nl();
}

/**
 * Display sync options configuration section
 *
 * @param sync - Sync configuration object
 */
function displaySyncOptions(sync: OvertureConfig['sync'] | undefined): void {
  if (!sync) {
    return;
  }

  console.log(chalk.bold('Sync Options:'));

  if (sync.backup !== undefined) {
    const backupText = sync.backup
      ? chalk.green('enabled')
      : chalk.red('disabled');
    console.log(`  backup: ${backupText}`);
  }

  if (sync.backupDir) {
    console.log(chalk.gray(`  backup-dir: ${sync.backupDir}`));
  }

  if (sync.backupRetention !== undefined) {
    console.log(chalk.gray(`  backup-retention: ${sync.backupRetention}`));
  }

  Logger.nl();
}

/**
 * Display configuration footer with summary
 *
 * @param config - User configuration object
 */
function displayFooter(config: OvertureConfig): void {
  const mcpCount = config.mcp ? Object.keys(config.mcp).length : 0;
  const clientCount = config.clients ? Object.keys(config.clients).length : 0;

  console.log(
    chalk.gray(
      `Total: ${mcpCount} MCP servers, ${clientCount} clients configured`,
    ),
  );
  Logger.nl();
}

/**
 * Display user configuration with formatted output
 *
 * @param config - User configuration object
 * @param configPath - Path to config file
 * @param format - Output format (yaml or json)
 */
function displayUserConfig(
  config: OvertureConfig,
  configPath: string,
  format: OutputFormat,
): void {
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

  // Display each section
  displayClients(config.clients);
  displayMcpServers(config.mcp);
  displaySyncOptions(config.sync);
  displayFooter(config);
}
