import { Command } from 'commander';
import { createInitCommand } from './commands/init';
import { createSyncCommand } from './commands/sync';
import { createValidateCommand } from './commands/validate';
import { createMcpCommand } from './commands/mcp';
import { createUserCommand } from './commands/user';
import { createAuditCommand } from './commands/audit';
import { createBackupCommand } from './commands/backup';
import { createDoctorCommand } from './commands/doctor';

/**
 * Creates and configures the Overture CLI program.
 *
 * The CLI provides commands for managing Claude Code plugins and MCP servers:
 * - init: Initialize .overture/config.yaml
 * - sync: Install plugins and generate configuration files
 * - validate: Validate configuration and MCP availability
 * - doctor: Check system for installed clients and MCP servers
 * - mcp: Manage MCP servers (list, enable)
 * - user: Manage user global configuration
 * - audit: Audit MCP configurations across clients
 * - backup: Backup and restore MCP configurations
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
  program.addCommand(createDoctorCommand());
  program.addCommand(createMcpCommand());
  program.addCommand(createUserCommand());
  program.addCommand(createAuditCommand());
  program.addCommand(createBackupCommand());

  return program;
}
