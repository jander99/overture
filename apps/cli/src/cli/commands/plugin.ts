import { Command } from 'commander';
import { createPluginExportCommand } from './plugin-export.js';
import { createPluginListCommand } from './plugin-list.js';
import type { AppDependencies } from '../../composition-root.js';

/**
 * Creates the 'plugin' command group for managing Claude Code plugins.
 *
 * Usage:
 * - overture plugin list         - List installed plugins
 * - overture plugin export       - Export installed plugins to config
 */
export function createPluginCommand(deps: AppDependencies): Command {
  const command = new Command('plugin');

  command.description('Manage Claude Code plugins');

  // Add subcommands with dependencies
  command.addCommand(createPluginListCommand(deps));
  command.addCommand(createPluginExportCommand(deps));

  return command;
}
