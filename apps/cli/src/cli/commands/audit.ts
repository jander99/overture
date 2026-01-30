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
import type {
  ClientName,
  OvertureConfig,
  Platform,
} from '@overture/config-types';
import { ErrorHandler } from '@overture/utils';
import { parseAuditOptions } from '../../lib/option-parser.js';
import type { AppDependencies } from '../../composition-root.js';

/**
 * Audit results mapping client names to their unmanaged MCPs
 */
type UnmanagedMCPsByClient = Partial<Record<ClientName, string[]>>;

/**
 * Command options for audit command
 */
interface AuditCommandOptions {
  client?: string;
}

/**
 * Creates the 'audit' command for detecting unmanaged MCPs
 *
 * @returns Commander Command instance
 */
export function createAuditCommand(deps: AppDependencies): Command {
  const { configLoader, pathResolver, output } = deps;
  const command = new Command('audit');

  command
    .description(
      'Detect MCPs in client configs that are not managed by Overture',
    )
    .option(
      '--client <name>',
      'Audit specific client only (e.g., claude-code, vscode)',
    )
    .action(async (options: AuditCommandOptions): Promise<void> => {
      try {
        const parsedOptions = parseAuditOptions(
          options as Record<string, unknown>,
        );
        output.info('Loading Overture configuration...');

        // Load Overture configuration
        const overtureConfig = await configLoader.loadConfig();
        const platform = pathResolver.getPlatform();

        // Determine which clients to audit
        if (parsedOptions.client) {
          // Audit specific client
          await auditSingleClient(
            deps,
            parsedOptions.client,
            overtureConfig,
            platform,
          );
        } else {
          // Audit all installed clients
          await auditAllInstalledClients(deps, overtureConfig, platform);
        }
      } catch (error) {
        const verbose =
          process.env.DEBUG === '1' || process.env.DEBUG === 'true';
        ErrorHandler.handleCommandError(error, 'audit', verbose);
      }
    });

  return command;
}

/**
 * Audit a single client for unmanaged MCPs
 */
async function auditSingleClient(
  deps: AppDependencies,
  clientName: string,
  overtureConfig: OvertureConfig,
  platform: Platform,
): Promise<void> {
  // Get adapter for client
  const { adapterRegistry, auditService, output } = deps;
  const adapter = adapterRegistry.get(clientName);

  if (!adapter) {
    throw Object.assign(
      new Error(
        `Unknown client: ${clientName}. Available clients: claude-code, claude-desktop, vscode, cursor, windsurf, copilot-cli, jetbrains-copilot`,
      ),
      { exitCode: 1 },
    );
  }

  // Check if client is installed
  if (!adapter.isInstalled(platform)) {
    output.warn(`Client '${clientName}' is not installed on this system`);
    output.success(`No unmanaged MCPs found (client not installed)`);
    return;
  }

  output.info(`Auditing client: ${clientName}...\n`);

  // Audit the client
  const unmanaged = await auditService.auditClient(
    adapter,
    overtureConfig,
    platform,
  );

  // Display results
  if (unmanaged.length === 0) {
    output.success(`No unmanaged MCPs found in ${clientName}`);
  } else {
    output.warn(`Found ${unmanaged.length} unmanaged MCP(s) in ${clientName}:`);
    output.nl?.();
    output.info(`  ${clientName}:`);
    unmanaged.forEach((mcpName: string): void => {
      output.info(`    - ${mcpName}`);
    });
    output.nl?.();

    // Generate suggestions
    const suggestions = deps.auditService.generateSuggestions({
      [clientName]: unmanaged,
    } as Record<ClientName, string[]>);
    displaySuggestions(deps, suggestions);
  }
}

/**
 * Audit all installed clients for unmanaged MCPs
 */
async function auditAllInstalledClients(
  deps: AppDependencies,
  overtureConfig: OvertureConfig,
  platform: Platform,
): Promise<void> {
  const { adapterRegistry, auditService, output } = deps;

  // Get installed adapters
  const installedAdapters = adapterRegistry.getInstalledAdapters(platform);

  if (installedAdapters.length === 0) {
    output.warn('No installed AI clients detected');
    output.info(
      'Overture supports: claude-code, claude-desktop, vscode, cursor, windsurf, copilot-cli, jetbrains-copilot',
    );
    output.success('No unmanaged MCPs found (no clients installed)');
    return;
  }

  output.info(`Auditing ${installedAdapters.length} installed client(s)...\n`);

  // Audit all clients
  const unmanagedByClient: UnmanagedMCPsByClient =
    await auditService.auditAllClients(
      installedAdapters,
      overtureConfig,
      platform,
    );

  // Display results
  if (Object.keys(unmanagedByClient).length === 0) {
    output.success('No unmanaged MCPs found in any client');
    output.info('All client MCPs are managed by Overture');
  } else {
    const totalUnmanaged = Object.values(unmanagedByClient).reduce(
      (sum, mcps) => sum + mcps.length,
      0,
    );
    output.warn(
      `Found ${totalUnmanaged} unmanaged MCP(s) across ${Object.keys(unmanagedByClient).length} client(s):`,
    );
    output.nl?.();

    // Display by client
    for (const [clientName, mcpNames] of Object.entries(unmanagedByClient)) {
      output.info(`  ${clientName}:`);
      mcpNames.forEach((mcpName: string): void => {
        output.info(`    - ${mcpName}`);
      });
      output.nl?.();
    }

    // Generate suggestions
    const suggestions = auditService.generateSuggestions(
      unmanagedByClient as Record<ClientName, string[]>,
    );
    displaySuggestions(deps, suggestions);
  }
}

/**
 * Display suggestions for adding unmanaged MCPs
 */
function displaySuggestions(
  deps: AppDependencies,
  suggestions: string[],
): void {
  const { output } = deps;

  if (suggestions.length === 0) {
    return;
  }

  output.info('Suggestions:');
  output.info('To add these MCPs to Overture, run:');
  output.nl?.();

  suggestions.forEach((suggestion: string): void => {
    output.info(`  ${suggestion}`);
  });

  output.nl?.();
  output.info(
    'Note: You will need to manually configure command, args, and transport for each MCP',
  );
}
