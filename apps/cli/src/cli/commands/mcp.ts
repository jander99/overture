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
    .action(async () => {
      const { configLoader, output } = deps;

      // Load merged user + project configuration
      const config = await configLoader.loadConfig(process.cwd());

      // Access MCP configuration
      const mcps = config.mcp;
      const mcpEntries = Object.entries(mcps);

      // Handle empty configuration
      if (mcpEntries.length === 0) {
        output.warn('No MCP servers configured');
        return;
      }

      // Display header
      output.info('Configured MCP Servers:');
      output.nl();

      // Display each MCP
      for (const [name, mcpConfig] of mcpEntries) {
        const commandStr = `${mcpConfig.command} ${mcpConfig.args?.join(' ') || ''}`.trim();
        output.info(`  ${name}`);
        output.info(`    Command: ${commandStr}`);
        output.nl();
      }

      // TODO: Add filtering by scope (Cycle 1.4)
      // TODO: Add filtering by client (Cycle 1.5)
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
