import { Command } from 'commander';
import { ErrorHandler } from '@overture/utils';
import type { AppDependencies } from '../../composition-root';

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
export function createPluginExportCommand(deps: AppDependencies): Command {
  const { pluginExporter, output } = deps;
  const command = new Command('export');

  command
    .description('Export installed plugins to user config')
    .option(
      '--plugin <name>',
      'Export specific plugin(s) (can specify multiple)',
      collect,
      [],
    )
    .option('--all', 'Export all installed plugins without prompting')
    .action(async (options) => {
      try {
        // Determine export mode
        if (options.all) {
          // Export all mode
          output.info('Exporting all installed plugins...');
          await pluginExporter.exportAllPlugins();
        } else if (options.plugin && options.plugin.length > 0) {
          // Non-interactive mode with explicit plugin list
          output.info(`Exporting ${options.plugin.length} plugin(s)...`);
          await pluginExporter.exportPlugins({
            interactive: false,
            pluginNames: options.plugin,
          });
        } else {
          // Interactive mode (default)
          output.info('Starting interactive plugin export...');
          await pluginExporter.exportPlugins({
            interactive: true,
          });
        }
      } catch (error) {
        const verbose =
          process.env.DEBUG === '1' || process.env.DEBUG === 'true';
        ErrorHandler.handleCommandError(error, 'plugin export', verbose);
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
