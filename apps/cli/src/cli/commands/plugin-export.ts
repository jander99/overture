import { Command } from 'commander';
import { PluginExporter } from '../../core/plugin-exporter';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../core/error-handler';

/**
 * Creates the 'plugin export' command for exporting installed plugins to config.
 *
 * Usage: overture plugin export [options]
 *
 * Modes:
 * - Interactive (default): Prompts user to select plugins
 * - Non-interactive (--plugin): Export specific plugins
 * - Export all (--all): Export all installed plugins
 *
 * Performs the following operations:
 * 1. Detects installed Claude Code plugins
 * 2. Prompts user to select plugins (or uses explicit list)
 * 3. Updates ~/.config/overture.yml with selected plugins
 * 4. Shows confirmation message
 */
export function createPluginExportCommand(): Command {
  const command = new Command('export');

  command
    .description('Export installed plugins to user config')
    .option('--plugin <name>', 'Export specific plugin(s) (can specify multiple)', collect, [])
    .option('--all', 'Export all installed plugins without prompting')
    .action(async (options) => {
      try {
        const exporter = new PluginExporter();

        // Determine export mode
        if (options.all) {
          // Export all mode
          Logger.info('Exporting all installed plugins...');
          await exporter.exportAllPlugins();
        } else if (options.plugin && options.plugin.length > 0) {
          // Non-interactive mode with explicit plugin list
          Logger.info(`Exporting ${options.plugin.length} plugin(s)...`);
          await exporter.exportPlugins({
            interactive: false,
            pluginNames: options.plugin,
          });
        } else {
          // Interactive mode (default)
          Logger.info('Starting interactive plugin export...');
          await exporter.exportPlugins({
            interactive: true,
          });
        }
      } catch (error) {
        ErrorHandler.handleCommandError(error, 'plugin export');
        process.exit(1);
      }
    });

  return command;
}

/**
 * Collector function for --plugin option to support multiple values
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
