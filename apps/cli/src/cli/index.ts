import { Command } from 'commander';
import { createInitCommand } from './commands/init';
import { createSyncCommand } from './commands/sync';
import { createValidateCommand } from './commands/validate';
import { createMcpCommand } from './commands/mcp';

/**
 * Creates and configures the Overture CLI program.
 *
 * The CLI provides commands for managing Claude Code plugins and MCP servers:
 * - init: Initialize .overture/config.yaml
 * - sync: Install plugins and generate configuration files
 * - validate: Validate configuration and MCP availability
 * - mcp: Manage MCP servers (list, enable)
 *
 * @returns Configured Commander Program instance
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('overture')
    .description('Orchestration layer for Claude Code plugins and MCP servers')
    .version('1.0.0');

  // Register all commands
  program.addCommand(createInitCommand());
  program.addCommand(createSyncCommand());
  program.addCommand(createValidateCommand());
  program.addCommand(createMcpCommand());

  return program;
}
