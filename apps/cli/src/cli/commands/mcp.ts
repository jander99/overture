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
import { detectClientMcps, compareMcpConfigs } from '../../core/mcp-detector';

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
    .option('--source <source>', 'Filter by source (overture, manual, all)', 'all')
    .action(async (options: { scope?: string; client?: string; source?: string }) => {
      // Load Overture configs
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

        // Get Overture MCPs
        const userMcps = userConfig?.mcp || {};
        const projectMcps = projectConfig?.mcp || {};
        const allOvertureMcps = { ...userMcps, ...projectMcps };

        // Detect MCPs from client configs (Claude Code native)
        const clientMcps = detectClientMcps(process.cwd());

        // Compare to categorize
        const detection = compareMcpConfigs(allOvertureMcps, clientMcps);

        if (detection.all.length === 0) {
          Logger.warn('No MCP servers configured');
          return;
        }

        // Get platform and adapters for sync info
        const platform = getPlatform();
        const adapters = adapterRegistry.getInstalledAdapters();

        // Build MCP list with metadata
        interface McpListEntry {
          name: string;
          scope: string;
          transport: string;
          source: string;
          command: string;
          syncsTo: string;
        }

        const mcpList: McpListEntry[] = [];

        // Process each detected MCP
        for (const mcp of detection.all) {
          // Determine scope for Overture-managed MCPs
          let scope = 'n/a';
          if (mcp.source === 'overture') {
            const inUser = mcp.name in userMcps;
            const inProject = mcp.name in projectMcps;
            scope = inUser && inProject ? 'both' : inUser ? 'global' : 'project';
          }

          // Apply scope filter
          if (options.scope && scope !== options.scope && scope !== 'both' && scope !== 'n/a') {
            continue;
          }

          // Apply source filter
          if (options.source && options.source !== 'all' && mcp.source !== options.source) {
            continue;
          }

          // Determine which clients would receive this MCP (for Overture-managed only)
          let syncsTo: string[] = [];
          if (mcp.source === 'overture') {
            const mcpConfig = projectMcps[mcp.name] || userMcps[mcp.name];

            if (adapters.length > 0) {
              syncsTo = adapters
                .filter((adapter) => shouldIncludeMcp(mcpConfig, adapter, platform).included)
                .map((a) => a.name);
            } else {
              // Fallback: use enabled clients from config
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
          } else {
            // Manual MCPs - show where detected from
            syncsTo = [mcp.detectedFrom];
          }

          // Apply client filter
          if (options.client && !syncsTo.includes(options.client)) {
            continue;
          }

          mcpList.push({
            name: mcp.name,
            scope,
            transport: mcp.transport || 'stdio',
            source: mcp.source,
            command: mcp.command,
            syncsTo: syncsTo.join(', ') || 'none',
          });
        }

        if (mcpList.length === 0) {
          Logger.warn('No MCP servers match the specified filters');
          return;
        }

        // Sort by name
        mcpList.sort((a, b) => a.name.localeCompare(b.name));

        // Display table
        Logger.info('MCP Servers:');
        Logger.nl();
        Logger.info('NAME | SCOPE | TRANSPORT | SOURCE | COMMAND');
        Logger.info('─'.repeat(80));

        mcpList.forEach((mcp) => {
          const sourceIcon = mcp.source === 'overture' ? '🎛️' : '✋';
          const source = `${sourceIcon} ${mcp.source}`;
          Logger.info(
            `${mcp.name} | ${mcp.scope} | ${mcp.transport} | ${source} | ${mcp.command}`
          );
        });

        Logger.nl();
        const overtureCount = mcpList.filter((m) => m.source === 'overture').length;
        const manualCount = mcpList.filter((m) => m.source === 'manual').length;
        Logger.info(
          `Total: ${mcpList.length} MCP${mcpList.length === 1 ? '' : 's'} ` +
          `(${overtureCount} Overture-managed, ${manualCount} manually-added)`
        );
        Logger.nl();
        Logger.info('Legend: 🎛️ = Overture-managed, ✋ = Manually-added');
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
