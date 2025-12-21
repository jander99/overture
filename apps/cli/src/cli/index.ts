import { Command } from 'commander';
import type { AppDependencies } from '../composition-root';
import { createInitCommand } from './commands/init';
import { createSyncCommand } from './commands/sync';
import { createValidateCommand } from './commands/validate';
import { createMcpCommand } from './commands/mcp';
import { createPluginCommand } from './commands/plugin';
import { createUserCommand } from './commands/user';
import { createAuditCommand } from './commands/audit';
import { createBackupCommand } from './commands/backup';
import { createDoctorCommand } from './commands/doctor';
import { createImportCommand } from './commands/import';
import { createCleanupCommand } from './commands/cleanup';

/**
 * CLI version - synchronized with package.json
 * This should be updated when releasing new versions.
 */
const CLI_VERSION = '0.3.0';

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
 * - import: Import unmanaged MCPs from client configs
 * - cleanup: Remove Overture-managed MCPs from directory configs
 *
 * @param deps - Application dependencies from composition root
 * @returns Configured Commander Program instance
 */
export function createProgram(deps: AppDependencies): Command {
  const program = new Command();

  program
    .name('overture')
    .description('Orchestration layer for Claude Code plugins and MCP servers')
    .version(CLI_VERSION);

  // Register all commands with dependencies
  program.addCommand(createInitCommand(deps));
  program.addCommand(createSyncCommand(deps));
  program.addCommand(createValidateCommand(deps));
  program.addCommand(createDoctorCommand(deps));
  program.addCommand(createMcpCommand(deps));
  program.addCommand(createPluginCommand(deps));
  program.addCommand(createUserCommand(deps));
  program.addCommand(createAuditCommand(deps));
  program.addCommand(createBackupCommand(deps));
  program.addCommand(createImportCommand(deps));
  program.addCommand(createCleanupCommand(deps));

  return program;
}
