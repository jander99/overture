import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Command } from 'commander';
import { loadUserConfig, loadProjectConfig } from '../../core/config-loader';
import { shouldIncludeMcp } from '../../core/exclusion-filter';
import { adapterRegistry } from '../../adapters/adapter-registry';
import { getPlatform } from '../../core/path-resolver';
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
    .option('--scope <scope>', 'Filter by scope (global, project)')
    .option('--client <client>', 'Filter by client name')
    .action(async (options: { scope?: string; client?: string }) => {
      // Load both configs
      let userConfig = null;
      let projectConfig = null;

      try {
        userConfig = await loadUserConfig();
      } catch (error) {
        // User config not found or invalid - continue
      }

      try {
        projectConfig = await loadProjectConfig(process.cwd());
      } catch (error) {
        // Project config not found or invalid - continue
      }

      if (!userConfig && !projectConfig) {
        Logger.error('No configuration found');
        process.exit(2);
      }

      try {
        // Validate client option if provided
        if (options.client) {
          const validClients = [
            'claude-code',
            'claude-desktop',
            'vscode',
            'cursor',
            'windsurf',
            'copilot-cli',
            'jetbrains-copilot',
          ];
          if (!validClients.includes(options.client)) {
            Logger.error(`Invalid client name: "${options.client}"`);
            Logger.info(`Valid clients: ${validClients.join(', ')}`);
            process.exit(1);
          }
        }

        // Track which MCPs are in which configs
        const userMcps = userConfig?.mcp || {};
        const projectMcps = projectConfig?.mcp || {};

        // Get all MCP names (merged)
        const allMcpNames = new Set([...Object.keys(userMcps), ...Object.keys(projectMcps)]);

        if (allMcpNames.size === 0) {
          Logger.warn('No MCP servers configured');
          return;
        }

        // Get platform and clients for filtering
        const platform = getPlatform();
        const adapters = adapterRegistry.getInstalledAdapters();

        // Build MCP list with metadata
        const mcpList = [];
        for (const name of Array.from(allMcpNames).sort()) {
          // Determine scope
          const inUser = name in userMcps;
          const inProject = name in projectMcps;
          const scope = inUser && inProject ? 'both' : inUser ? 'global' : 'project';

          // Get MCP config (project overrides user)
          const mcpConfig = projectMcps[name] || userMcps[name];

          // Apply scope filter
          if (options.scope && scope !== options.scope && scope !== 'both') {
            continue;
          }

          // Determine which clients receive this MCP
          let syncsTo: string[] = [];

          if (adapters.length > 0) {
            // Use installed adapters to determine sync targets
            syncsTo = adapters
              .filter((adapter) => shouldIncludeMcp(mcpConfig, adapter, platform).included)
              .map((a) => a.name);
          } else {
            // Fallback: use enabled clients from config when no adapters are installed
            const enabledClients: string[] = [];
            if (projectConfig?.clients) {
              for (const [clientName, clientConfig] of Object.entries(projectConfig.clients)) {
                if ((clientConfig as any).enabled !== false) {
                  enabledClients.push(clientName);
                }
              }
            }
            if (userConfig?.clients && enabledClients.length === 0) {
              for (const [clientName, clientConfig] of Object.entries(userConfig.clients)) {
                if ((clientConfig as any).enabled !== false) {
                  enabledClients.push(clientName);
                }
              }
            }
            syncsTo = enabledClients;
          }

          // Apply client filter
          if (options.client && !syncsTo.includes(options.client)) {
            continue;
          }

          mcpList.push({
            name,
            scope,
            transport: mcpConfig.transport,
            syncsTo: syncsTo.join(', ') || 'none',
          });
        }

        if (mcpList.length === 0) {
          Logger.warn('No MCP servers match the specified filters');
          return;
        }

        // Display table
        Logger.info('Configured MCP servers:');
        Logger.nl();
        Logger.info('NAME | SCOPE | TRANSPORT | SYNCS TO');
        Logger.info('─'.repeat(60));

        mcpList.forEach((mcp) => {
          Logger.info(`${mcp.name} | ${mcp.scope} | ${mcp.transport} | ${mcp.syncsTo}`);
        });

        Logger.nl();
        Logger.info(`Total: ${mcpList.length} MCP${mcpList.length === 1 ? '' : 's'}`);
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
        const configPath = path.join(projectDir, CONFIG_PATH);
        const config = loadProjectConfig(projectDir);

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
        const yamlContent = yaml.dump(config, {
          indent: 2,
          lineWidth: 100,
          noRefs: true,
        });
        fs.writeFileSync(configPath, yamlContent, 'utf-8');

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
