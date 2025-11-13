import { Command } from 'commander';
import { ConfigManager } from '../../core/config-manager';
import { PluginInstaller } from '../../core/plugin-installer';
import { Generator } from '../../core/generator';
import { Logger } from '../../utils/logger';

/**
 * Creates the 'sync' command for synchronizing plugins and generating configuration.
 *
 * Usage: overture sync [options]
 *
 * Performs the following operations:
 * 1. Reads .overture/config.yaml
 * 2. Installs/updates configured plugins via `claude plugin install`
 * 3. Generates .mcp.json with project-scoped MCP servers
 * 4. Generates CLAUDE.md with plugin-to-MCP mappings
 */
export function createSyncCommand(): Command {
  const command = new Command('sync');

  command
    .description('Install plugins and generate .mcp.json and CLAUDE.md')
    .option('--skip-plugins', 'Skip plugin installation')
    .option('--dry-run', 'Preview changes without writing files')
    .option('--client <name>', 'Sync only for specific client (e.g., claude-code, claude-desktop)')
    .option('--force', 'Force sync even if validation warnings exist')
    .action(async (options) => {
      try {
        // Show dry-run indicator
        if (options.dryRun) {
          Logger.info('Running in dry-run mode - no changes will be made');
        }

        // Show client filter if specified
        if (options.client) {
          Logger.info(`Syncing for client: ${options.client}`);
        }

        // Load configuration
        Logger.info('Loading configuration...');
        const projectConfig = await ConfigManager.loadProjectConfig();
        const globalConfig = await ConfigManager.loadGlobalConfig();
        const config = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Install plugins
        if (!options.skipPlugins && !options.dryRun) {
          const plugins = config.plugins || {};
          const pluginsToInstall = Object.entries(plugins)
            .filter(([_, plugin]) => plugin.enabled !== false)
            .map(([name, plugin]) => ({
              name,
              marketplace: plugin.marketplace,
            }));

          if (pluginsToInstall.length > 0) {
            Logger.info(`Installing ${pluginsToInstall.length} plugin(s)...`);
            const results = await PluginInstaller.installPlugins(
              pluginsToInstall
            );

            // Report results
            const failed = results.filter((r) => !r.success);
            if (failed.length > 0) {
              Logger.warn(`${failed.length} plugin(s) failed to install`);
              failed.forEach((r) => {
                Logger.error(`  ${r.pluginName}: ${r.message}`);
              });
            }
          } else {
            Logger.info('No plugins configured');
          }
        } else if (options.skipPlugins) {
          Logger.info('Skipping plugin installation');
        } else if (options.dryRun) {
          Logger.info('Would install plugins (skipped in dry-run mode)');
        }

        // Generate files
        if (!options.dryRun) {
          Logger.info('Generating configuration files...');
          const result = await Generator.generateFiles(config);

          Logger.nl();
          Logger.success('Sync complete!');
          Logger.info('Files generated:');
          result.filesWritten.forEach((file) => {
            Logger.info(`  - ${file}`);
          });
        } else {
          Logger.info('Would generate configuration files (dry-run mode)');
          Logger.nl();
          Logger.success('Dry-run complete - no changes made');
        }
      } catch (error) {
        Logger.error(`Sync failed: ${(error as Error).message}`);
        process.exit((error as any).exitCode || 1);
      }
    });

  return command;
}
