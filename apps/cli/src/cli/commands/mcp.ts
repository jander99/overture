import * as path from 'path';
import { Command } from 'commander';
import { ConfigManager } from '../../core/config-manager';
import { Logger } from '../../utils/logger';
import { Prompts } from '../../utils/prompts';
import { CONFIG_PATH } from '../../domain/constants';

/**
 * Creates the 'mcp' command group for managing MCP servers.
 *
 * Usage:
 * - overture mcp list         - List all configured MCP servers
 * - overture mcp enable <name> - Enable a disabled MCP server
 */
export function createMcpCommand(): Command {
  const command = new Command('mcp');

  command.description('Manage MCP servers');

  // mcp list subcommand
  command
    .command('list')
    .description('Show all configured MCPs and their status')
    .action(async () => {
      try {
        const config = await ConfigManager.loadProjectConfig();
        if (!config) {
          Logger.error('No configuration found');
          Logger.info(`Run \`overture init\` to create ${CONFIG_PATH}`);
          process.exit(2);
        }

        Logger.info('Configured MCP servers:');
        Logger.nl();

        const mcpEntries = Object.entries(config.mcp);
        if (mcpEntries.length === 0) {
          Logger.warn('No MCP servers configured');
          Logger.info(`Edit ${CONFIG_PATH} to add MCP servers`);
          return;
        }

        for (const [name, mcp] of mcpEntries) {
          const status = mcp.enabled !== false ? 'enabled' : 'disabled';
          const scope = `[${mcp.scope}]`;
          const statusIcon = mcp.enabled !== false ? '✓' : '✗';

          Logger.info(`  ${statusIcon} ${name} ${scope} (${status})`);
          if (mcp.command) {
            Logger.debug(`    Command: ${mcp.command}`);
          }
        }
      } catch (error) {
        Logger.error(`Failed to list MCP servers: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  // mcp enable subcommand
  command
    .command('enable')
    .description('Enable a disabled MCP server')
    .argument('<name>', 'Name of the MCP server to enable')
    .action(async (name: string) => {
      try {
        const projectDir = process.cwd();
        const config = await ConfigManager.loadProjectConfig(projectDir);

        if (!config) {
          Logger.error('No configuration found');
          Logger.info(`Run \`overture init\` to create ${CONFIG_PATH}`);
          process.exit(2);
        }

        if (!config.mcp[name]) {
          Logger.error(`MCP server '${name}' not found in configuration`);
          Logger.info('Available MCP servers:');
          Object.keys(config.mcp).forEach((mcpName) => {
            Logger.info(`  - ${mcpName}`);
          });
          process.exit(2);
        }

        // Enable the MCP server
        config.mcp[name].enabled = true;

        // Save updated configuration
        await ConfigManager.saveConfig(
          config,
          path.join(projectDir, CONFIG_PATH)
        );

        Logger.success(`Enabled MCP server: ${name}`);

        // Prompt to run sync
        const shouldSync = await Prompts.confirm(
          'Run sync to regenerate configuration?',
          true
        );

        if (shouldSync) {
          Logger.info('Run \`overture sync\` to apply changes');
        }
      } catch (error) {
        Logger.error(`Failed to enable MCP server: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
