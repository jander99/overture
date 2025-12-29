import { Command } from 'commander';
import type { McpServerConfig, ClientName } from '@overture/config-types';
import type { AppDependencies } from '../../composition-root';

/**
 * Creates the 'mcp' command group for managing MCP servers.
 *
 * Usage:
 * - overture mcp list                      - List all configured MCPs
 * - overture mcp list --scope <scope>      - Filter by scope (global/project)
 * - overture mcp list --client <name>      - Filter by client
 * - overture mcp enable <name>             - Enable a disabled MCP in project config
 */
export function createMcpCommand(deps: AppDependencies): Command {
  const command = new Command('mcp');

  command.description('Manage MCP server configurations');

  // mcp list subcommand
  command
    .command('list')
    .description('List all configured MCP servers')
    .option('--scope <type>', 'Filter by scope (global or project)')
    .option('--client <name>', 'Filter by client compatibility')
    .action(async (options: { scope?: string; client?: string }) => {
      const { configLoader, output } = deps;

      try {
        // Validate scope if provided
        if (options.scope && !['global', 'project'].includes(options.scope)) {
          output.error(
            `Invalid scope: "${options.scope}". Must be "global" or "project".`,
          );
          return;
        }

        // Load MCPs from configs
        const mcpsToDisplay = await loadMcpServersToDisplay(
          configLoader,
          options,
        );

        // Handle empty configuration
        if (mcpsToDisplay.length === 0) {
          output.warn('No MCP servers configured');
          return;
        }

        // Display the MCPs
        displayMcpList(mcpsToDisplay, options, output);
      } catch (error) {
        // Handle configuration loading errors gracefully
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        output.error(`Failed to load configuration: ${errorMessage}`);
      }
    });

  // mcp enable subcommand
  command
    .command('enable')
    .description('Enable a disabled MCP server in project configuration')
    .argument('<name>', 'Name of the MCP server to enable')
    .action(async (name: string) => {
      const { configLoader, pathResolver, filesystem, output } = deps;

      try {
        // Load and update MCP config
        const config = await findAndEnableMcp(configLoader, name, output);
        if (!config) {
          return; // Error already handled by findAndEnableMcp
        }

        // Write updated config to file
        await writeUpdatedConfig(pathResolver, filesystem, config);

        // Display success message
        output.success(
          `MCP server "${name}" has been enabled in project configuration.`,
        );
      } catch (error) {
        // Error handling will be added in Cycle 1.8
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        output.error(`Failed to enable MCP: ${errorMessage}`);
      }
    });

  return command;
}

/**
 * Load MCP servers from configuration files based on scope filter
 */
async function loadMcpServersToDisplay(
  configLoader: any,
  options: { scope?: string; client?: string },
): Promise<
  Array<{
    name: string;
    config: McpServerConfig;
    scope: 'global' | 'project';
  }>
> {
  let mcpsToDisplay: Array<{
    name: string;
    config: McpServerConfig;
    scope: 'global' | 'project';
  }> = [];

  if (options.scope === 'global') {
    // Load only user config (global MCPs)
    const userConfig = await configLoader.loadUserConfig();
    if (userConfig?.mcp) {
      mcpsToDisplay = Object.entries(userConfig.mcp).map(([name, config]) => ({
        name,
        config: config as McpServerConfig,
        scope: 'global' as const,
      }));
    }
  } else if (options.scope === 'project') {
    // Load only project config (project MCPs)
    const projectConfig = await configLoader.loadProjectConfig(process.cwd());
    if (projectConfig?.mcp) {
      mcpsToDisplay = Object.entries(projectConfig.mcp).map(
        ([name, config]) => ({
          name,
          config: config as McpServerConfig,
          scope: 'project' as const,
        }),
      );
    }
  } else {
    // Load both configs for default display with scope indicators
    const userConfig = await configLoader.loadUserConfig();
    const projectConfig = await configLoader.loadProjectConfig(process.cwd());

    if (userConfig?.mcp) {
      mcpsToDisplay.push(
        ...Object.entries(userConfig.mcp).map(([name, config]) => ({
          name,
          config: config as McpServerConfig,
          scope: 'global' as const,
        })),
      );
    }

    if (projectConfig?.mcp) {
      mcpsToDisplay.push(
        ...Object.entries(projectConfig.mcp).map(([name, config]) => ({
          name,
          config: config as McpServerConfig,
          scope: 'project' as const,
        })),
      );
    }
  }

  // Filter by client if specified
  if (options.client) {
    mcpsToDisplay = mcpsToDisplay.filter(({ config }) => {
      // Check clients.include (whitelist)
      if (config.clients?.include) {
        return config.clients.include.includes(options.client as ClientName);
      }

      // Check clients.exclude (blacklist)
      if (config.clients?.exclude) {
        return !config.clients.exclude.includes(options.client as ClientName);
      }

      // No client restrictions - available to all
      return true;
    });
  }

  return mcpsToDisplay;
}

/**
 * Display list of MCP servers with formatting
 */
function displayMcpList(
  mcpsToDisplay: Array<{
    name: string;
    config: McpServerConfig;
    scope: 'global' | 'project';
  }>,
  options: { scope?: string; client?: string },
  output: any,
): void {
  // Display header
  output.info('Configured MCP Servers:');
  output.nl();

  // Display each MCP with scope indicator (if not filtered)
  for (const { name, config, scope } of mcpsToDisplay) {
    const commandStr =
      `${config.command} ${config.args?.join(' ') || ''}`.trim();
    const scopeLabel = options.scope ? '' : ` (${scope})`;
    output.info(`  ${name}${scopeLabel}`);
    output.info(`    Command: ${commandStr}`);
    output.nl();
  }
}

/**
 * Find and enable MCP server in project configuration
 */
async function findAndEnableMcp(
  configLoader: any,
  name: string,
  output: any,
): Promise<any | null> {
  // Load project config
  const cwd = process.cwd();
  const projectConfig = await configLoader.loadProjectConfig(cwd);

  // Initialize or use existing config
  const config = projectConfig || { version: '1.0' as const, mcp: {} };

  // Check if MCP exists in project config
  if (config.mcp && Object.hasOwn(config.mcp, name)) {
    return tryEnableFromProjectConfig(config, name, output);
  }

  // MCP not in project config, try user config
  return await tryEnableFromUserConfig(configLoader, config, name, output);
}

/**
 * Enable MCP from project config
 */
function tryEnableFromProjectConfig(
  config: any,
  name: string,
  output: any,
): any | null {
  // eslint-disable-next-line security/detect-object-injection
  const mcpConfig = config.mcp[name];
  if (mcpConfig && mcpConfig.enabled !== false) {
    output.warn(`MCP server "${name}" is already enabled.`);
    return null;
  }

  // Enable the MCP
  if (mcpConfig) {
    mcpConfig.enabled = true;
    return config;
  }

  return null;
}

/**
 * Try to enable MCP by copying from user config
 */
async function tryEnableFromUserConfig(
  configLoader: any,
  config: any,
  name: string,
  output: any,
): Promise<any | null> {
  const userConfig = await configLoader.loadUserConfig();
  if (userConfig?.mcp && Object.hasOwn(userConfig.mcp, name)) {
    // Copy from user config to project config
    if (!config.mcp) {
      config.mcp = {};
    }
    // eslint-disable-next-line security/detect-object-injection
    const userMcpConfig = userConfig.mcp[name];
    if (userMcpConfig) {
      // eslint-disable-next-line security/detect-object-injection
      config.mcp[name] = {
        ...userMcpConfig,
        enabled: true,
      };
      return config;
    }
  }

  // MCP not found in any config
  output.error(
    `MCP server "${name}" not found in user or project configuration.`,
  );
  return null;
}

/**
 * Write updated MCP configuration to project config file
 */
async function writeUpdatedConfig(
  pathResolver: any,
  filesystem: any,
  config: any,
): Promise<void> {
  const configPath = pathResolver.getProjectConfigPath(process.cwd());
  const yaml = await import('js-yaml');
  const yamlContent = yaml.dump(config);
  await filesystem.writeFile(configPath, yamlContent);
}
