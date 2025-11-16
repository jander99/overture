import { Command } from 'commander';
import { PluginExporter } from '../../core/plugin-exporter';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../core/error-handler';
import type { InstalledPlugin } from '../../domain/plugin.types';

/**
 * Creates the 'plugin list' command for listing installed plugins.
 *
 * Usage: overture plugin list [options]
 *
 * Display modes:
 * - Default: Human-readable format with plugin details
 * - --json: JSON format for scripting
 *
 * Filters:
 * - --config-only: Show only plugins in config
 * - --installed-only: Show only installed plugins not in config
 *
 * Shows:
 * - Plugin name and marketplace
 * - Enabled/disabled status
 * - Whether plugin is in config
 * - Summary statistics
 */
export function createPluginListCommand(): Command {
  const command = new Command('list');

  command
    .description('List installed Claude Code plugins')
    .option('--json', 'Output as JSON for scripting')
    .option('--config-only', 'Show only plugins in config')
    .option('--installed-only', 'Show only installed plugins not in config')
    .action(async (options) => {
      try {
        const exporter = new PluginExporter();

        // Get plugin comparison data
        const comparison = await exporter.compareInstalledWithConfig();

        // Combine installed plugins based on filter
        let plugins: Array<InstalledPlugin & { inConfig: boolean }>;

        if (options.configOnly) {
          // Only plugins in config (installed and in config)
          plugins = comparison.both.map((p) => ({ ...p, inConfig: true }));
        } else if (options.installedOnly) {
          // Only plugins installed but not in config
          plugins = comparison.installedOnly.map((p) => ({ ...p, inConfig: false }));
        } else {
          // All installed plugins
          plugins = [
            ...comparison.both.map((p) => ({ ...p, inConfig: true })),
            ...comparison.installedOnly.map((p) => ({ ...p, inConfig: false })),
          ];
        }

        // Output based on format
        if (options.json) {
          // JSON format
          const output = {
            installed: plugins.map((p) => ({
              name: p.name,
              marketplace: p.marketplace,
              enabled: p.enabled,
              inConfig: p.inConfig,
              installedAt: p.installedAt,
            })),
            summary: {
              totalInstalled: comparison.both.length + comparison.installedOnly.length,
              inConfig: comparison.both.length,
              notInConfig: comparison.installedOnly.length,
            },
          };

          console.log(JSON.stringify(output, null, 2));
        } else {
          // Human-readable format
          Logger.info('Installed Claude Code Plugins:');
          Logger.nl();

          if (plugins.length === 0) {
            Logger.info('  No plugins found matching filter criteria.');
          } else {
            for (const plugin of plugins) {
              const statusIcon = plugin.enabled ? '✓' : ' ';
              const configStatus = plugin.inConfig ? 'Yes' : 'No';

              Logger.info(`${statusIcon} ${plugin.name}@${plugin.marketplace}`);
              Logger.info(`  Status: ${plugin.enabled ? 'Enabled' : 'Disabled'}`);
              Logger.info(`  In config: ${configStatus}`);
              Logger.nl();
            }
          }

          // Summary
          const totalInstalled = comparison.both.length + comparison.installedOnly.length;
          const inConfig = comparison.both.length;

          Logger.info(`📊 Summary: ${totalInstalled} plugin(s) installed, ${inConfig} in config`);

          // Tips
          if (comparison.installedOnly.length > 0 && !options.installedOnly) {
            Logger.nl();
            Logger.info('💡 Tips:');
            Logger.info("   • Use 'overture plugin export' to add plugins to config");
            Logger.info("   • Use 'overture sync' to install plugins from config");
          }
        }
      } catch (error) {
        ErrorHandler.handleCommandError(error, 'plugin list');
        process.exit(1);
      }
    });

  return command;
}
