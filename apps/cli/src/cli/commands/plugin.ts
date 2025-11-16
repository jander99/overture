import { Command } from 'commander';
import { createPluginExportCommand } from './plugin-export';
import { createPluginListCommand } from './plugin-list';

/**
 * Creates the 'plugin' command group for managing Claude Code plugins.
 *
 * Usage:
 * - overture plugin list         - List installed plugins
 * - overture plugin export       - Export installed plugins to config
 */
export function createPluginCommand(): Command {
  const command = new Command('plugin');

  command.description('Manage Claude Code plugins');

  // Add subcommands
  command.addCommand(createPluginListCommand());
  command.addCommand(createPluginExportCommand());

  return command;
}
