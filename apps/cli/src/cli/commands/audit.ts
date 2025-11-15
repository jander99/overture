/**
 * Audit Command
 *
 * Detects MCPs configured directly in client configs that are NOT managed by Overture.
 * Helps users discover unmanaged MCPs they might want to add to their Overture config.
 *
 * Usage: overture audit [--client <name>]
 *
 * @module cli/commands/audit
 */

import { Command } from 'commander';
import { AuditService } from '../../core/audit-service';
import { loadConfig } from '../../core/config-loader';
import { adapterRegistry } from '../../adapters/adapter-registry';
import { getPlatform } from '../../core/path-resolver';
import { Logger } from '../../utils/logger';
import type { ClientName } from '../../domain/config.types';
import { ErrorHandler } from '../../core/error-handler';

/**
 * Creates the 'audit' command for detecting unmanaged MCPs
 *
 * @returns Commander Command instance
 */
export function createAuditCommand(): Command {
  const command = new Command('audit');

  command
    .description('Detect MCPs in client configs that are not managed by Overture')
    .option('--client <name>', 'Audit specific client only (e.g., claude-code, vscode)')
    .action(async (options) => {
      try {
        Logger.info('Loading Overture configuration...');

        // Load Overture configuration
        const overtureConfig = loadConfig();
        const platform = getPlatform();
        const auditService = new AuditService();

        // Determine which clients to audit
        if (options.client) {
          // Audit specific client
          await auditSingleClient(options.client as ClientName, overtureConfig, platform, auditService);
        } else {
          // Audit all installed clients
          await auditAllInstalledClients(overtureConfig, platform, auditService);
        }
      } catch (error) {
        const verbose = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
        ErrorHandler.handleCommandError(error, 'audit', verbose);
      }
    });

  return command;
}

/**
 * Audit a single client for unmanaged MCPs
 */
async function auditSingleClient(
  clientName: ClientName,
  overtureConfig: any,
  platform: string,
  auditService: AuditService
): Promise<void> {
  // Get adapter for client
  const adapter = adapterRegistry.get(clientName);

  if (!adapter) {
    Logger.error(`Unknown client: ${clientName}`);
    Logger.info('Available clients: claude-code, claude-desktop, vscode, cursor, windsurf, copilot-cli, jetbrains-copilot');
    process.exit(1);
  }

  // Check if client is installed
  if (!adapter.isInstalled(platform as any)) {
    Logger.warn(`Client '${clientName}' is not installed on this system`);
    Logger.success(`No unmanaged MCPs found (client not installed)`);
    return;
  }

  Logger.info(`Auditing client: ${clientName}...\n`);

  // Audit the client
  const unmanaged = auditService.auditClient(adapter, overtureConfig, platform as any);

  // Display results
  if (unmanaged.length === 0) {
    Logger.success(`No unmanaged MCPs found in ${clientName}`);
  } else {
    Logger.warn(`Found ${unmanaged.length} unmanaged MCP(s) in ${clientName}:`);
    Logger.nl();
    Logger.info(`  ${clientName}:`);
    unmanaged.forEach((mcpName) => {
      Logger.info(`    - ${mcpName}`);
    });
    Logger.nl();

    // Generate suggestions
    const suggestions = auditService.generateSuggestions({ [clientName]: unmanaged } as Record<ClientName, string[]>);
    displaySuggestions(suggestions);
  }
}

/**
 * Audit all installed clients for unmanaged MCPs
 */
async function auditAllInstalledClients(
  overtureConfig: any,
  platform: string,
  auditService: AuditService
): Promise<void> {
  // Get installed adapters
  const installedAdapters = adapterRegistry.getInstalledAdapters(platform as any);

  if (installedAdapters.length === 0) {
    Logger.warn('No installed AI clients detected');
    Logger.info('Overture supports: claude-code, claude-desktop, vscode, cursor, windsurf, copilot-cli, jetbrains-copilot');
    Logger.success('No unmanaged MCPs found (no clients installed)');
    return;
  }

  Logger.info(`Auditing ${installedAdapters.length} installed client(s)...\n`);

  // Audit all clients
  const unmanagedByClient = auditService.auditAllClients(installedAdapters, overtureConfig, platform as any);

  // Display results
  if (Object.keys(unmanagedByClient).length === 0) {
    Logger.success('No unmanaged MCPs found in any client');
    Logger.info('All client MCPs are managed by Overture');
  } else {
    const totalUnmanaged = Object.values(unmanagedByClient).reduce((sum, mcps) => sum + mcps.length, 0);
    Logger.warn(`Found ${totalUnmanaged} unmanaged MCP(s) across ${Object.keys(unmanagedByClient).length} client(s):`);
    Logger.nl();

    // Display by client
    for (const [clientName, mcpNames] of Object.entries(unmanagedByClient)) {
      Logger.info(`  ${clientName}:`);
      mcpNames.forEach((mcpName) => {
        Logger.info(`    - ${mcpName}`);
      });
      Logger.nl();
    }

    // Generate suggestions
    const suggestions = auditService.generateSuggestions(unmanagedByClient as any);
    displaySuggestions(suggestions);
  }
}

/**
 * Display suggestions for adding unmanaged MCPs
 */
function displaySuggestions(suggestions: string[]): void {
  if (suggestions.length === 0) {
    return;
  }

  Logger.info('Suggestions:');
  Logger.info('To add these MCPs to Overture, run:');
  Logger.nl();

  suggestions.forEach((suggestion) => {
    Logger.info(`  ${suggestion}`);
  });

  Logger.nl();
  Logger.info('Note: You will need to manually configure command, args, and transport for each MCP');
}
