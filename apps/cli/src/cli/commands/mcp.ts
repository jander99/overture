import { Command } from 'commander';
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

      // Validate scope if provided
      if (options.scope && !['global', 'project'].includes(options.scope)) {
        output.error(`Invalid scope: "${options.scope}". Must be "global" or "project".`);
        return;
      }

      // Load configs based on scope filter
      let mcpsToDisplay: Array<{ name: string; config: any; scope: 'global' | 'project' }> = [];

      if (options.scope === 'global') {
        // Load only user config (global MCPs)
        const userConfig = await configLoader.loadUserConfig();
        if (userConfig?.mcp) {
          mcpsToDisplay = Object.entries(userConfig.mcp).map(([name, config]) => ({
            name,
            config,
            scope: 'global' as const,
          }));
        }
      } else if (options.scope === 'project') {
        // Load only project config (project MCPs)
        const projectConfig = await configLoader.loadProjectConfig(process.cwd());
        if (projectConfig?.mcp) {
          mcpsToDisplay = Object.entries(projectConfig.mcp).map(([name, config]) => ({
            name,
            config,
            scope: 'project' as const,
          }));
        }
      } else {
        // Load both configs for default display with scope indicators
        const userConfig = await configLoader.loadUserConfig();
        const projectConfig = await configLoader.loadProjectConfig(process.cwd());

        if (userConfig?.mcp) {
          mcpsToDisplay.push(
            ...Object.entries(userConfig.mcp).map(([name, config]) => ({
              name,
              config,
              scope: 'global' as const,
            }))
          );
        }

        if (projectConfig?.mcp) {
          mcpsToDisplay.push(
            ...Object.entries(projectConfig.mcp).map(([name, config]) => ({
              name,
              config,
              scope: 'project' as const,
            }))
          );
        }
      }

      // Filter by client if specified
      if (options.client) {
        mcpsToDisplay = mcpsToDisplay.filter(({ config }) => {
          // Check clients.only (whitelist)
          if (config.clients?.only) {
            return config.clients.only.includes(options.client as string);
          }

          // Check clients.except (blacklist)
          if (config.clients?.except) {
            return !config.clients.except.includes(options.client as string);
          }

          // No client restrictions - available to all
          return true;
        });
      }

      // Handle empty configuration
      if (mcpsToDisplay.length === 0) {
        output.warn('No MCP servers configured');
        return;
      }

      // Display header
      output.info('Configured MCP Servers:');
      output.nl();

      // Display each MCP with scope indicator (if not filtered)
      for (const { name, config, scope } of mcpsToDisplay) {
        const commandStr = `${config.command} ${config.args?.join(' ') || ''}`.trim();
        const scopeLabel = options.scope ? '' : ` (${scope})`;
        output.info(`  ${name}${scopeLabel}`);
        output.info(`    Command: ${commandStr}`);
        output.nl();
      }

      // TODO: Add error handling (Cycle 1.6)
    });

  // mcp enable subcommand
  command
    .command('enable')
    .description('Enable a disabled MCP server in project configuration')
    .action(async () => {
      // TODO: Implement in Cycle 1.7-1.8
    });

  return command;
}
