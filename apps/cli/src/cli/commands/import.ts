/**
 * Import Command
 *
 * Import unmanaged MCP servers from client configs into Overture.
 *
 * @module cli/commands/import
 */

import { Command } from 'commander';
import * as p from '@clack/prompts';
import type { AppDependencies } from '../../composition-root.js';
import type {
  ClientName,
  DiscoveredMcp,
  Platform,
  OvertureConfig,
  ImportDiscoveryResult,
  McpConflict,
} from '@overture/config-types';
import type {
  ClaudeCodeAdapter,
  OpenCodeAdapter,
  CopilotCliAdapter,
} from '@overture/client-adapters';
import type { ImportService } from '@overture/import-core';
import type { PathResolver } from '@overture/config-core';
import type { OutputPort } from '@overture/ports-output';
import { ALL_CLIENTS, CLIENTS } from '../constants.js';
import { DetectionFormatter, formatConflict } from '@overture/import-core';

/**
 * Options for import command (detect mode)
 */
type DetectModeOptions = {
  client: string;
  detect: true;
  format: 'text' | 'json' | 'table';
  verbose?: boolean;
  yes?: boolean;
};

/**
 * Options for import command (interactive mode)
 */
type InteractiveModeOptions = {
  client: string;
  detect?: false;
  yes?: boolean;
};

/**
 * Create the import command
 */
export function createImportCommand(deps: AppDependencies): Command {
  const cmd = new Command('import');

  cmd
    .description(
      'Import unmanaged MCP servers from client configs into Overture\n\n' +
        'Examples:\n' +
        '  $ overture import                    # Interactive import\n' +
        '  $ overture import --detect           # Scan without importing\n' +
        '  $ overture import --detect --verbose # Detailed scan results\n' +
        '  $ overture import --detect --format json > mcps.json',
    )
    .option(
      '--client <name>',
      'Target client: claude-code, copilot-cli, opencode, or all',
      'all',
    )
    .option('--yes', 'Skip confirmation prompts')
    .option('--detect', 'Scan and report MCP configurations without importing')
    .option(
      '--format <type>',
      'Output format for --detect: text, json, table',
      'text',
    )
    .option('--verbose', 'Show detailed information (use with --detect)')
    .action(async (options) => {
      const {
        importService,
        configLoader,
        pathResolver,
        output,
        environment,
        adapterRegistry,
      } = deps;

      try {
        // Load current Overture config
        const overtureConfig = await configLoader.loadConfig();
        const platform = environment.platform();

        // Determine which clients to scan
        const clientFilter: ClientName[] =
          options.client === 'all'
            ? ALL_CLIENTS
            : [options.client as ClientName];

        // Get adapters
        const claudeCodeAdapter = clientFilter.includes(CLIENTS.CLAUDE_CODE)
          ? (adapterRegistry.get(
              CLIENTS.CLAUDE_CODE,
            ) as ClaudeCodeAdapter | null)
          : null;
        const openCodeAdapter = clientFilter.includes(CLIENTS.OPENCODE)
          ? (adapterRegistry.get(CLIENTS.OPENCODE) as OpenCodeAdapter | null)
          : null;
        const copilotCliAdapter = clientFilter.includes(CLIENTS.COPILOT_CLI)
          ? (adapterRegistry.get(
              CLIENTS.COPILOT_CLI,
            ) as CopilotCliAdapter | null)
          : null;

        // DETECT MODE: Read-only scan without importing
        if (options.detect) {
          await executeDetectionMode(
            importService,
            claudeCodeAdapter,
            openCodeAdapter,
            copilotCliAdapter,
            overtureConfig,
            platform,
            options,
          );
          return;
        }

        // NORMAL IMPORT MODE
        await executeImportMode(
          importService,
          pathResolver,
          output,
          claudeCodeAdapter,
          openCodeAdapter,
          copilotCliAdapter,
          overtureConfig,
          platform,
          options,
        );
      } catch (error) {
        p.cancel(`Import failed: ${(error as Error).message}`);
        throw error;
      }
    });

  return cmd;
}

/**
 * Execute detection mode: scan client configs without importing
 */
async function executeDetectionMode(
  importService: ImportService,
  claudeCodeAdapter: ClaudeCodeAdapter | null,
  openCodeAdapter: OpenCodeAdapter | null,
  copilotCliAdapter: CopilotCliAdapter | null,
  overtureConfig: OvertureConfig,
  platform: Platform,
  options: DetectModeOptions,
): Promise<void> {
  const result = await importService.performDetection(
    claudeCodeAdapter,
    openCodeAdapter,
    copilotCliAdapter,
    overtureConfig,
    platform,
  );

  const formatter = new DetectionFormatter();
  let formattedOutput: string;

  switch (options.format) {
    case 'json':
      formattedOutput = formatter.formatJson(result);
      break;
    case 'table':
      formattedOutput = formatter.formatTable(result);
      break;
    case 'text':
    default:
      formattedOutput = formatter.formatText(result, options.verbose || false);
  }

  console.log(formattedOutput);

  // Exit with appropriate code
  if (result.summary.parseErrors > 0) {
    process.exit(1);
  } else if (result.summary.conflicts > 0) {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

/**
 * Execute import mode: interactive import of unmanaged MCPs
 */
async function executeImportMode(
  importService: ImportService,
  pathResolver: PathResolver,
  output: OutputPort,
  claudeCodeAdapter: ClaudeCodeAdapter | null,
  openCodeAdapter: OpenCodeAdapter | null,
  copilotCliAdapter: CopilotCliAdapter | null,
  overtureConfig: OvertureConfig,
  platform: Platform,
  options: InteractiveModeOptions,
): Promise<void> {
  p.intro('🔍 Import MCPs from Client Configs');

  // Discover unmanaged MCPs
  const discovery = await discoverUnmanagedMcps(
    importService,
    claudeCodeAdapter,
    openCodeAdapter,
    copilotCliAdapter,
    overtureConfig,
    platform,
    output,
  );

  // Exit early if no MCPs found
  if (discovery.discovered.length === 0) {
    return;
  }

  // Let user select MCPs to import
  const selected = await selectMcpsToImport(discovery);
  if (!selected) {
    return; // User cancelled
  }

  // Show import plan and confirm
  await showImportPlan(selected);
  const confirmed = await confirmImport(selected, options);
  if (!confirmed) {
    return;
  }

  // Execute and show results
  await executeAndShowImportResults(
    importService,
    pathResolver,
    output,
    selected,
    options,
  );

  p.outro('Import complete! 🎉');
}

/**
 * Discover unmanaged MCPs and handle conflicts/completeness
 */
async function discoverUnmanagedMcps(
  importService: ImportService,
  claudeCodeAdapter: ClaudeCodeAdapter | null,
  openCodeAdapter: OpenCodeAdapter | null,
  copilotCliAdapter: CopilotCliAdapter | null,
  overtureConfig: OvertureConfig,
  platform: Platform,
  output: OutputPort,
): Promise<ImportDiscoveryResult> {
  const spinner = p.spinner();
  spinner.start('Scanning client configurations...');

  const discovery = await importService.discoverUnmanagedMcps(
    claudeCodeAdapter,
    openCodeAdapter,
    copilotCliAdapter,
    overtureConfig,
    platform,
  );

  spinner.stop('Scan complete');

  // Show conflicts if any
  if (discovery.conflicts.length > 0) {
    p.note(
      discovery.conflicts
        .map((c: McpConflict) => formatConflict(c))
        .join('\n\n'),
      '⚠️  Conflicts Detected',
    );
    output.info(
      'These MCPs have different configurations across clients and cannot be imported automatically.',
    );
    output.info(
      'Please resolve conflicts manually by making the configurations match.\n',
    );
  }

  // Check if any MCPs found
  if (discovery.discovered.length === 0) {
    if (discovery.alreadyManaged.length > 0) {
      p.outro(
        `✅ All ${discovery.alreadyManaged.length} MCP(s) already managed by Overture`,
      );
    } else {
      p.outro('No unmanaged MCPs found');
    }
  }

  return discovery;
}

/**
 * Let user select MCPs to import
 */
async function selectMcpsToImport(
  discovery: ImportDiscoveryResult,
): Promise<DiscoveredMcp[] | null> {
  const selectedValues = await p.multiselect({
    message: `Select MCPs to import (${discovery.discovered.length} found):`,
    options: discovery.discovered.map((mcp: DiscoveredMcp) => ({
      value: mcp,
      label: mcp.name,
      hint: `${mcp.source.client}: ${mcp.command} (${mcp.suggestedScope})`,
    })),
    required: false,
  });

  if (p.isCancel(selectedValues) || selectedValues.length === 0) {
    p.cancel('Import cancelled');
    return null;
  }

  return selectedValues as DiscoveredMcp[];
}

/**
 * Show import plan with scope assignments and environment variables
 */
async function showImportPlan(selected: DiscoveredMcp[]): Promise<void> {
  // Group by suggested scope
  const globalMcps = selected.filter((m) => m.suggestedScope === 'global');
  const projectMcps = selected.filter((m) => m.suggestedScope === 'project');

  // Show scope assignments
  const scopeLines: string[] = [];
  if (globalMcps.length > 0) {
    scopeLines.push(`\nGlobal scope (~/.config/overture/config.yaml):`);
    globalMcps.forEach((m) => scopeLines.push(`  • ${m.name}`));
  }
  if (projectMcps.length > 0) {
    scopeLines.push(`\nProject scope (.overture/config.yaml):`);
    projectMcps.forEach((m) => scopeLines.push(`  • ${m.name}`));
  }

  p.note(scopeLines.join('\n'), 'Import Plan');

  // Show environment variables if needed
  const allEnvVars = new Set<string>();
  selected.forEach((m) =>
    m.envVarsToSet?.forEach((v: string) => allEnvVars.add(v)),
  );

  if (allEnvVars.size > 0) {
    const envLines = Array.from(allEnvVars).map(
      (v) => `export ${v}="your-value-here"`,
    );
    p.note(envLines.join('\n'), '⚠️  Environment Variables Required');
  }
}

/**
 * Confirm import with user
 */
async function confirmImport(
  selected: DiscoveredMcp[],
  options: InteractiveModeOptions,
): Promise<boolean> {
  if (options.yes) {
    return true;
  }

  const confirmed = await p.confirm({
    message: `Import ${selected.length} MCP(s)?`,
    initialValue: true,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Import cancelled');
    return false;
  }

  return true;
}

/**
 * Execute import and show results
 */
async function executeAndShowImportResults(
  importService: ImportService,
  pathResolver: PathResolver,
  output: OutputPort,
  selected: DiscoveredMcp[],
  options: InteractiveModeOptions,
): Promise<void> {
  const importSpinner = p.spinner();
  importSpinner.start('Importing MCPs...');

  const globalPath = pathResolver.getUserConfigPath();
  const projectPath = pathResolver.getProjectConfigPath();

  const result = await importService.importMcps(
    selected,
    globalPath,
    projectPath,
  );

  importSpinner.stop('Import complete');

  // Show results
  p.note(
    [
      `Imported: ${result.imported.length}`,
      `Skipped: ${result.skipped.length}`,
      `Scopes modified: ${result.scopesModified.join(', ')}`,
    ].join('\n'),
    '✅ Import Results',
  );

  // Show environment variables reminder if needed
  const allEnvVars = new Set<string>();
  selected.forEach((m) =>
    m.envVarsToSet?.forEach((v: string) => allEnvVars.add(v)),
  );

  if (allEnvVars.size > 0) {
    output.info('\n⚠️  Remember to set the required environment variables!');
  }

  // Offer to run sync
  if (result.imported.length > 0 && !options.yes) {
    const shouldSync = await p.confirm({
      message: 'Run overture sync now?',
      initialValue: true,
    });

    if (!p.isCancel(shouldSync) && shouldSync) {
      output.info('\nRun: overture sync');
      output.info('(Automatic sync integration coming in next update)\n');
    }
  }
}
