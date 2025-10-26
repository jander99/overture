import { Command } from 'commander';
import { ConfigManager } from '../../core/config-manager';
import { PluginInstaller } from '../../core/plugin-installer';
import { Generator } from '../../core/generator';
import { Logger } from '../../utils/logger';

/**
 * Creates the 'sync' command for synchronizing plugins and generating configuration.
 *
 * Usage: overture sync [--skip-plugins]
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
    .action(async (options) => {
      try {
        // Load configuration
        Logger.info('Loading configuration...');
        const projectConfig = await ConfigManager.loadProjectConfig();
        const globalConfig = await ConfigManager.loadGlobalConfig();
        const config = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Install plugins
        if (!options.skipPlugins) {
          const pluginsToInstall = Object.entries(config.plugins)
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
          }
        }

        // Generate files
        Logger.info('Generating configuration files...');
        const result = await Generator.generateFiles(config);

        Logger.nl();
        Logger.success('Sync complete!');
        Logger.info('Files generated:');
        result.filesWritten.forEach((file) => {
          Logger.info(`  - ${file}`);
        });
      } catch (error) {
        Logger.error(`Sync failed: ${(error as Error).message}`);
        process.exit((error as any).exitCode || 1);
      }
    });

  return command;
}
