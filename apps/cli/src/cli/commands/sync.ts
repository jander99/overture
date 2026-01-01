import { Command } from 'commander';
import type { AppDependencies } from '../../composition-root';
import type { ClientName } from '@overture/config-types';
import { formatDiff } from '@overture/sync-core';
import type { SyncResult, ClientSyncResult } from '@overture/sync-core';
import { ErrorHandler } from '@overture/utils';

const SKIPPED_ERROR_MESSAGE = 'Skipped - client not detected on system';

/**
 * Generates a table showing which MCP servers are configured for which clients.
 * Shows the source level (global/project) for each MCP server and which clients
 * have them configured.
 *
 * @param result - The sync result containing client sync information
 * @returns Formatted table as a string
 */
function generateMcpTable(result: SyncResult): string {
  // Collect all unique MCP server names across all clients
  const allMcpNames = new Set<string>();
  const mcpSourceMap = new Map<string, 'global' | 'project'>();

  // Build a map of client -> MCP servers with their sources
  const clientMcps = new Map<string, Map<string, 'global' | 'project'>>();

  for (const clientResult of result.results) {
    if (!clientResult.success || !clientResult.mcpSources) continue;

    const mcpMap = new Map<string, 'global' | 'project'>();
    for (const [mcpName, source] of Object.entries(clientResult.mcpSources)) {
      allMcpNames.add(mcpName);
      mcpMap.set(mcpName, source);
      // Store the source for the first column
      if (!mcpSourceMap.has(mcpName)) {
        mcpSourceMap.set(mcpName, source);
      }
    }
    clientMcps.set(clientResult.client, mcpMap);
  }

  if (allMcpNames.size === 0) {
    return '';
  }

  // Sort MCP names: global first, then project, then alphabetically within each group
  const sortedMcpNames = Array.from(allMcpNames).sort((a, b) => {
    const sourceA = mcpSourceMap.get(a) || 'project';
    const sourceB = mcpSourceMap.get(b) || 'project';

    if (sourceA === sourceB) {
      return a.localeCompare(b);
    }
    return sourceA === 'global' ? -1 : 1;
  });

  // Get client names from results
  const clientNames = Array.from(clientMcps.keys());

  // Calculate column widths
  const mcpColumnWidth = Math.max(
    15,
    ...sortedMcpNames.map((name) => name.length),
  );
  const sourceColumnWidth = 10;
  const clientColumnWidth = 15;

  // Build table header
  const header = [
    'MCP Server'.padEnd(mcpColumnWidth),
    'Source'.padEnd(sourceColumnWidth),
    ...clientNames.map((name) => name.padEnd(clientColumnWidth)),
  ].join(' | ');

  const separator = [
    '-'.repeat(mcpColumnWidth),
    '-'.repeat(sourceColumnWidth),
    ...clientNames.map(() => '-'.repeat(clientColumnWidth)),
  ].join('-|-');

  // Build table rows
  const rows: string[] = [];
  for (const mcpName of sortedMcpNames) {
    const source = mcpSourceMap.get(mcpName) || 'project';
    const sourceDisplay = source === 'global' ? 'Global' : 'Project';

    const row = [
      mcpName.padEnd(mcpColumnWidth),
      sourceDisplay.padEnd(sourceColumnWidth),
      ...clientNames.map((clientName) => {
        const clientMcp = clientMcps.get(clientName);
        if (clientMcp?.has(mcpName)) {
          const mcpSource = clientMcp.get(mcpName);
          return `✓ (${mcpSource})`.padEnd(clientColumnWidth);
        }
        return '-'.padEnd(clientColumnWidth);
      }),
    ].join(' | ');

    rows.push(row);
  }

  return [header, separator, ...rows].join('\n');
}

/**
 * Determines if a warning is critical and should be displayed.
 * Critical warnings include config file errors, permission issues, and sync failures.
 * Informational warnings about binary detection are filtered out.
 *
 * @param warning - The warning message to check
 * @returns true if the warning is critical and should be shown
 */
function isCriticalWarning(warning: string): boolean {
  const warningLower = warning.toLowerCase();

  // Include critical warnings
  const criticalKeywords = [
    'invalid',
    'error',
    'failed',
    'permission',
    'denied',
  ];
  if (criticalKeywords.some((keyword) => warningLower.includes(keyword))) {
    return true;
  }

  // Exclude informational warnings
  const informationalKeywords = [
    'detected:',
    'not detected on system',
    'will still be generated',
  ];
  if (informationalKeywords.some((keyword) => warningLower.includes(keyword))) {
    return false;
  }

  // Include all other warnings by default
  return true;
}

/**
 * Loads sync configuration and determines detail mode from config file and CLI options.
 * Handles config loading errors gracefully.
 *
 * @param options - CLI options
 * @param pathResolver - Path resolver service
 * @param configLoader - Config loader service
 * @returns Detail mode setting
 */
async function loadSyncConfig(
  options: Record<string, unknown>,
  pathResolver: AppDependencies['pathResolver'],
  configLoader: AppDependencies['configLoader'],
): Promise<boolean> {
  let detailMode = (options.detail as boolean) || false;
  try {
    const projectRoot = await pathResolver.findProjectRoot();
    const userConfig = await configLoader.loadUserConfig();
    const projectConfig = projectRoot
      ? await configLoader.loadProjectConfig(projectRoot)
      : null;
    const overtureConfig = configLoader.mergeConfigs(userConfig, projectConfig);
    detailMode =
      (options.detail as boolean | undefined) ??
      overtureConfig.sync?.detail ??
      false;
  } catch {
    // Config load failed, use CLI flag or false
  }
  return detailMode;
}

/**
 * Builds sync options from CLI options and detail mode.
 *
 * @param options - CLI options
 * @param detailMode - Detail mode setting
 * @returns Sync options for the sync engine
 */
function buildSyncOptions(
  options: Record<string, unknown>,
  detailMode: boolean,
): {
  dryRun: boolean;
  force: boolean;
  skipPlugins: boolean;
  skipSkills: boolean;
  skipUndetected: boolean;
  clients: ClientName[] | undefined;
  detail: boolean;
  skipAgents?: boolean;
} {
  return {
    dryRun: (options.dryRun as boolean) || false,
    force: (options.force as boolean) || false,
    skipPlugins: (options.skipPlugins as boolean) || false,
    skipSkills: (options.skipSkills as boolean) || false,
    skipAgents: (options.skipAgents as boolean) || false,
    skipUndetected: (options.skipUndetected as boolean) !== false,
    clients: (options.client as string)
      ? [options.client as string as ClientName]
      : undefined,
    detail: detailMode,
  };
}

/**
 * Displays client detection summary including detected, undetected, and skipped clients.
 *
 * @param output - Output service
 * @param result - Sync result containing client detection information
 */
function displayDetectionSummary(
  output: AppDependencies['output'],
  result: SyncResult,
): void {
  output.section?.('🔍 Detecting clients...');
  output.nl?.();

  const seenClients = new Set<string>();
  const detectedClients = result.results.filter((r) => {
    if (seenClients.has(r.client)) return false;
    if (r.binaryDetection?.status === 'found') {
      seenClients.add(r.client);
      return true;
    }
    return false;
  });

  seenClients.clear();
  const actuallySkippedClients = result.results.filter((r) => {
    if (seenClients.has(r.client)) return false;
    if (r.error === SKIPPED_ERROR_MESSAGE) {
      seenClients.add(r.client);
      return true;
    }
    return false;
  });

  seenClients.clear();
  const undetectedButSyncedClients = result.results.filter((r) => {
    if (seenClients.has(r.client)) return false;
    if (
      r.binaryDetection?.status === 'not-found' &&
      r.error !== SKIPPED_ERROR_MESSAGE
    ) {
      seenClients.add(r.client);
      return true;
    }
    return false;
  });

  // Show detected clients
  for (const clientResult of detectedClients) {
    const detection = clientResult.binaryDetection;
    if (!detection) {
      output.warn(
        `${clientResult.client} was detected but has no detection details; skipping from detection summary.`,
      );
      continue;
    }
    const versionStr = detection.version ? ` (v${detection.version})` : '';
    const configPath = detection.configPath || clientResult.configPath;
    output.success(`${clientResult.client}${versionStr} → ${configPath}`);
  }

  // Show undetected but synced clients (when --no-skip-undetected is used)
  for (const clientResult of undetectedButSyncedClients) {
    const configPath = clientResult.configPath;
    output.warn(
      `${clientResult.client} - not detected but config will be generated → ${configPath}`,
    );
  }

  // Show actually skipped clients
  for (const clientResult of actuallySkippedClients) {
    output.skip?.(`${clientResult.client} - not detected, skipped`);
  }
}

/**
 * Displays agents synchronization summary.
 *
 * @param output - Output service
 * @param result - Sync result containing agent sync information
 * @param detailMode - Whether detail mode is enabled
 */
function displayAgentsSummary(
  output: AppDependencies['output'],
  result: SyncResult,
  detailMode: boolean,
): void {
  if (result.agentSyncSummary && result.agentSyncSummary.total > 0) {
    const summary = result.agentSyncSummary;
    output.info('🤖 Agents:');
    if (summary.synced > 0) {
      const syncedResults = summary.results.filter((r) => r.success);
      const uniqueAgents = new Set(syncedResults.map((r) => r.agent));
      const clientCount = new Set(
        syncedResults.flatMap((r) => Object.keys(r.clientResults)),
      ).size;

      output.success(
        `  ✓ Synced ${uniqueAgents.size} agent(s) to ${clientCount} client(s)`,
      );
    }
    if (summary.failed > 0) {
      output.warn(`  ✗ Failed ${summary.failed} agent(s)`);
      if (detailMode) {
        const failedAgents = summary.results
          .filter((r) => !r.success)
          .map((r) => r.agent);
        for (const agent of failedAgents) {
          output.warn(`    - ${agent}`);
        }
      }
    }
    output.nl?.();
  }
}

/**
 * Displays MCP server configuration table.
 *
 * @param output - Output service
 * @param result - Sync result containing MCP configuration
 */
function displayMcpTable(
  output: AppDependencies['output'],
  result: SyncResult,
): void {
  const mcpTable = generateMcpTable(result);
  if (mcpTable) {
    output.nl?.();
    output.section?.('📋 MCP Server Configuration:');
    output.plain?.(mcpTable);
    output.nl?.();
  }
}

/**
 * Displays plugin sync plan in detail mode.
 *
 * @param output - Output service
 * @param result - Sync result containing plugin sync details
 * @param detailMode - Whether detail mode is enabled
 */
function displayPluginSyncPlan(
  output: AppDependencies['output'],
  result: SyncResult,
  detailMode: boolean,
): void {
  if (detailMode && result.pluginSyncDetails) {
    const details = result.pluginSyncDetails;
    output.section?.('📦 Plugin Sync Plan:');
    output.nl?.();
    output.info(`  Configured: ${details.configured} plugins`);
    output.info(`  Already installed: ${details.installed}`);

    if (details.toInstall.length > 0) {
      output.info(`  To install: ${details.toInstall.length}`);
      for (const plugin of details.toInstall) {
        output.info(`    - ${plugin.name}@${plugin.marketplace}`);
      }
    } else {
      output.success(`  ✅ All plugins already installed`);
    }
    output.nl?.();
  }
}

/**
 * Displays skills synchronization summary.
 *
 * @param output - Output service
 * @param result - Sync result containing skill sync information
 * @param detailMode - Whether detail mode is enabled
 */
function displaySkillsSummary(
  output: AppDependencies['output'],
  result: SyncResult,
  detailMode: boolean,
): void {
  if (result.skillSyncSummary && result.skillSyncSummary.total > 0) {
    const summary = result.skillSyncSummary;
    output.info('📚 Skills:');
    if (summary.synced > 0) {
      // Calculate unique skills and clients from synced results
      const syncedResults = summary.results.filter(
        (r) => r.success && !r.skipped,
      );
      const uniqueSkills = new Set(syncedResults.map((r) => r.skill));
      const uniqueClients = new Set(syncedResults.map((r) => r.client));

      const skillCount = uniqueSkills.size;
      const clientCount = uniqueClients.size;
      const totalOps = summary.synced;

      output.success(
        `  ✓ Synced ${skillCount} skill(s) to ${clientCount} client(s) (${totalOps} total operations)`,
      );
    }
    if (summary.skipped > 0) {
      output.info(`  ○ Skipped ${summary.skipped} (already synced)`);
    }
    if (summary.failed > 0) {
      output.warn(`  ✗ Failed ${summary.failed} skill(s)`);
      if (detailMode) {
        const failedSkills = summary.results
          .filter((r) => !r.success)
          .map((r) => `${r.skill} (${r.client})`);
        for (const skill of failedSkills) {
          output.warn(`    - ${skill}`);
        }
      }
    }
    output.nl?.();
  }
}

/**
 * Displays MCP source information for a client result in detail mode.
 *
 * @param output - Output service
 * @param clientResult - Client sync result containing MCP sources
 * @param configLabel - Label for the config (e.g., ' (user config)')
 */
function displayMcpSourcesDetail(
  output: AppDependencies['output'],
  clientResult: ClientSyncResult,
  configLabel: string,
): void {
  if (!clientResult.mcpSources) return;

  const globalMcps: string[] = [];
  const projectMcps: string[] = [];

  // Categorize MCPs by source
  for (const [mcpName, source] of Object.entries(clientResult.mcpSources)) {
    if (source === 'global') {
      globalMcps.push(mcpName);
    } else {
      projectMcps.push(mcpName);
    }
  }

  output.info(
    `Configuration changes for ${clientResult.client}${configLabel}:`,
  );
  output.nl?.();

  if (globalMcps.length > 0) {
    output.info(`Global MCPs (${globalMcps.length}):`);
    for (const mcpName of globalMcps.sort()) {
      output.info(`  ~ ${mcpName}`);
    }
    output.nl?.();
  }

  if (projectMcps.length > 0) {
    output.info(`Project MCPs (${projectMcps.length}):`);
    for (const mcpName of projectMcps.sort()) {
      output.info(`  ~ ${mcpName}`);
    }
    output.nl?.();
  }
}

/**
 * Displays diff and MCP sources for a successful client result in detail mode.
 *
 * @param output - Output service
 * @param clientResult - Client sync result with diff information
 * @param detailMode - Whether detail mode is enabled
 */
function displayClientDiff(
  output: AppDependencies['output'],
  clientResult: ClientSyncResult,
  detailMode: boolean,
): void {
  if (!detailMode || !clientResult.diff?.hasChanges) {
    return;
  }

  output.nl?.();
  const configLabel = clientResult.configType
    ? ` (${clientResult.configType} config)`
    : '';

  displayMcpSourcesDetail(output, clientResult, configLabel);

  const diffOutput = formatDiff(clientResult.diff);
  output.plain?.(diffOutput);
  output.nl?.();
}

/**
 * Displays sync results for a successful client with one or more config types.
 *
 * @param output - Output service
 * @param clientName - Name of the client
 * @param clientResults - Sync results for the client
 * @param detailMode - Whether detail mode is enabled
 */
function displaySuccessfulClientSync(
  output: AppDependencies['output'],
  clientName: string,
  clientResults: ClientSyncResult[],
  detailMode: boolean,
): void {
  // Show which configs were synced
  const configs = clientResults
    .map((r) => {
      if (r.configType === 'user') return 'user';
      if (r.configType === 'project') return 'project';
      return null;
    })
    .filter(Boolean);

  const configStr =
    configs.length > 1 ? ` (${configs.join(' + ')} configs)` : '';
  output.success(`${clientName} - synchronized${configStr}`);

  // Show diffs for each config in detail mode
  for (const clientResult of clientResults) {
    displayClientDiff(output, clientResult, detailMode);
  }
}

/**
 * Groups sync results by client name, deduplicating to ensure one entry per client.
 *
 * @param results - Array of client sync results
 * @returns Map of client name to array of sync results
 */
function groupResultsByClient(
  results: ClientSyncResult[],
): Map<string, ClientSyncResult[]> {
  const resultsByClient = new Map<string, ClientSyncResult[]>();
  for (const r of results) {
    if (!resultsByClient.has(r.client)) {
      resultsByClient.set(r.client, []);
    }
    const clientResults = resultsByClient.get(r.client);
    if (clientResults) {
      clientResults.push(r);
    }
  }
  return resultsByClient;
}

/**
 * Displays sync results grouped by client with diff information in detail mode.
 *
 * @param output - Output service
 * @param result - Sync result containing client sync results
 * @param detailMode - Whether detail mode is enabled
 */
function displaySyncResults(
  output: AppDependencies['output'],
  result: SyncResult,
  detailMode: boolean,
): void {
  const seenClients = new Set<string>();
  const detectedClients = result.results.filter((r) => {
    if (seenClients.has(r.client)) return false;
    if (r.binaryDetection?.status === 'found') {
      seenClients.add(r.client);
      return true;
    }
    return false;
  });

  seenClients.clear();
  const undetectedButSyncedClients = result.results.filter((r) => {
    if (seenClients.has(r.client)) return false;
    if (
      r.binaryDetection?.status === 'not-found' &&
      r.error !== SKIPPED_ERROR_MESSAGE
    ) {
      seenClients.add(r.client);
      return true;
    }
    return false;
  });

  const syncedClients = [...detectedClients, ...undetectedButSyncedClients];

  if (syncedClients.length > 0) {
    output.section?.('⚙️  Syncing configurations...');
    output.nl?.();

    const resultsByClient = groupResultsByClient(result.results);

    // Display results grouped by client
    for (const clientName of resultsByClient.keys()) {
      const clientResults = resultsByClient.get(clientName);
      if (!clientResults) continue;
      const allSuccess = clientResults.every((r) => r.success);

      if (allSuccess) {
        displaySuccessfulClientSync(
          output,
          clientName,
          clientResults,
          detailMode,
        );
      } else {
        output.error(`${clientName} - sync failed`);
      }
    }
  }
}

/**
 * Categorizes warnings by type (critical vs informational) and separates tips.
 *
 * @param clientResult - Client sync result containing warnings
 * @param detailMode - Whether detail mode is enabled
 * @returns Object with categorized warnings and tips
 */
function categorizeWarnings(
  clientResult: ClientSyncResult,
  detailMode: boolean,
): {
  critical: Array<{ client: string; warning: string }>;
  informational: Array<{ client: string; warning: string }>;
  tips: Set<string>;
} {
  const critical: Array<{ client: string; warning: string }> = [];
  const informational: Array<{ client: string; warning: string }> = [];
  const tips = new Set<string>();

  for (const warning of clientResult.warnings) {
    // Extract tips separately
    if (warning.includes('💡 Tip:')) {
      tips.add(warning);
      continue;
    }

    if (detailMode) {
      // Detail mode: categorize all warnings
      if (isCriticalWarning(warning)) {
        critical.push({ client: clientResult.client, warning });
      } else {
        informational.push({
          client: clientResult.client,
          warning,
        });
      }
    } else {
      // Normal mode: only critical warnings
      if (isCriticalWarning(warning)) {
        critical.push({ client: clientResult.client, warning });
      }
    }
  }

  return { critical, informational, tips };
}

/**
 * Displays global warnings and critical/informational warnings section headers.
 *
 * @param output - Output service
 * @param globalWarnings - Global warnings to display
 * @param criticalWarnings - Critical warnings
 * @param informationalWarnings - Informational warnings
 * @param detailMode - Whether detail mode is enabled
 */
function displayWarningsSection(
  output: AppDependencies['output'],
  globalWarnings: string[],
  criticalWarnings: Array<{ client: string; warning: string }>,
  informationalWarnings: Array<{ client: string; warning: string }>,
  detailMode: boolean,
): void {
  output.section?.('⚠️  Warnings:');

  // Show global warnings first (config validation issues)
  if (globalWarnings.length > 0) {
    output.nl?.();
    output.warn('Configuration:');
    for (const warning of globalWarnings) {
      output.warn(`  - ${warning}`);
    }
  }

  if (criticalWarnings.length > 0) {
    if (
      detailMode &&
      (informationalWarnings.length > 0 || globalWarnings.length > 0)
    ) {
      output.nl?.();
      output.warn('Critical:');
    }
    for (const item of criticalWarnings) {
      output.warn(`  - ${item.client}: ${item.warning}`);
    }
  }

  if (detailMode && informationalWarnings.length > 0) {
    output.nl?.();
    output.info('Informational:');
    for (const item of informationalWarnings) {
      output.info(`  - ${item.client}: ${item.warning}`);
    }
  }
}

/**
 * Displays tips section if tips are present.
 *
 * @param output - Output service
 * @param tips - Set of tips to display
 * @param hasWarnings - Whether warning section was displayed
 */
function displayTipsSection(
  output: AppDependencies['output'],
  tips: Set<string>,
  hasWarnings: boolean,
): void {
  if (tips.size === 0) return;

  if (!hasWarnings) {
    output.section?.('💡 Tips:');
  } else {
    output.nl?.();
  }
  for (const tip of tips) {
    output.info(`  ${tip}`);
  }
}

/**
 * Collects and displays all warnings, tips, and errors from sync results.
 *
 * @param output - Output service
 * @param result - Sync result containing warnings and errors
 * @param detailMode - Whether detail mode is enabled
 */
function collectAndDisplayWarnings(
  output: AppDependencies['output'],
  result: SyncResult,
  detailMode: boolean,
): void {
  const globalWarnings: string[] = [];
  const allCriticalWarnings: Array<{ client: string; warning: string }> = [];
  const allInformationalWarnings: Array<{
    client: string;
    warning: string;
  }> = [];
  const allTips = new Set<string>();

  // Collect global warnings (config validation, etc.)
  for (const warning of result.warnings) {
    globalWarnings.push(warning);
  }

  // Collect warnings from client results
  for (const clientResult of result.results) {
    const { critical, informational, tips } = categorizeWarnings(
      clientResult,
      detailMode,
    );
    allCriticalWarnings.push(...critical);
    allInformationalWarnings.push(...informational);
    for (const tip of tips) {
      allTips.add(tip);
    }
  }

  // Display warnings
  if (
    globalWarnings.length > 0 ||
    allCriticalWarnings.length > 0 ||
    allInformationalWarnings.length > 0
  ) {
    displayWarningsSection(
      output,
      globalWarnings,
      allCriticalWarnings,
      allInformationalWarnings,
      detailMode,
    );
  }

  // Show unique tips at the end if any exist
  const hasWarnings =
    globalWarnings.length > 0 ||
    allCriticalWarnings.length > 0 ||
    allInformationalWarnings.length > 0;
  displayTipsSection(output, allTips, hasWarnings);

  // Show global errors
  if (result.errors.length > 0) {
    output.section?.('❌ Errors:');
    for (const error of result.errors) {
      output.error(`  - ${error}`);
    }
  }
}

/**
 * Displays backup information in detail mode.
 *
 * @param output - Output service
 * @param result - Sync result containing backup information
 * @param detailMode - Whether detail mode is enabled
 */
function displayBackupInfo(
  output: AppDependencies['output'],
  result: SyncResult,
  detailMode: boolean,
): void {
  if (detailMode) {
    const backups = result.results.filter((r) => r.backupPath);
    if (backups.length > 0) {
      output.section?.('💾 Backups:');
      for (const clientResult of backups) {
        output.info(`  ${clientResult.client}: ${clientResult.backupPath}`);
      }
    }
  }
}

/**
 * Creates the 'sync' command for synchronizing MCP configurations to clients.
 *
 * Usage: overture sync [options]
 *
 * Performs the following operations:
 * 1. Loads user and project configurations
 * 2. Merges configs with proper precedence
 * 3. Filters MCPs by client, platform, and transport
 * 4. Backs up existing client configs
 * 5. Generates client-specific MCP configurations
 * 6. Writes configs to each client's config directory
 *
 * @param deps - Application dependencies from composition root
 * @returns Configured Commander Command instance
 */
export function createSyncCommand(deps: AppDependencies): Command {
  const { syncEngine, output, configLoader, pathResolver } = deps;
  const command = new Command('sync');

  command
    .description(
      'Sync MCP configuration and Agent Skills to AI clients (overwrites existing)',
    )
    .option('--dry-run', 'Preview changes without writing files')
    .option(
      '--client <name>',
      'Sync only for specific client (e.g., claude-code, claude-desktop)',
    )
    .option('--force', 'Force sync even if validation warnings exist')
    .option('--skip-plugins', 'Skip plugin installation, only sync MCPs')
    .option('--skip-skills', 'Skip skill synchronization, only sync MCPs')
    .option('--skip-agents', 'Skip agent synchronization, only sync MCPs')
    .option(
      '--no-skip-undetected',
      'Generate configs even for clients not detected on system',
    )
    .option(
      '--detail',
      'Show detailed output including diffs, plugin plans, and all warnings',
    )
    .action(async (options) => {
      try {
        // Load configuration and build sync options
        const detailMode = await loadSyncConfig(
          options,
          pathResolver,
          configLoader,
        );

        // Show dry-run indicator
        if (options.dryRun) {
          output.info('Running in dry-run mode - no changes will be made');
        }

        // Show client filter if specified
        if (options.client) {
          output.info(`Syncing for client: ${options.client}`);
        }

        // Build sync options and run sync
        const syncOptions = buildSyncOptions(options, detailMode);
        const result = await syncEngine.syncClients(syncOptions);

        // Phase 1: Detection Summary
        displayDetectionSummary(output, result);

        // Phase 1.3: MCP Configuration Table
        displayMcpTable(output, result);

        // Phase 1.5: Plugin Sync Plan
        displayPluginSyncPlan(output, result, detailMode);

        // Phase 1.6: Skill Sync Summary
        displaySkillsSummary(output, result, detailMode);

        // Phase 1.7: Agent Sync Summary
        displayAgentsSummary(output, result, detailMode);

        // Phase 2: Sync Summary
        displaySyncResults(output, result, detailMode);

        // Phase 3: Warnings
        collectAndDisplayWarnings(output, result, detailMode);

        // Phase 4: Backup Info
        displayBackupInfo(output, result, detailMode);

        // Final status
        output.nl?.();
        if (result.success) {
          output.success('Sync complete!');
        } else {
          output.error('Sync completed with errors');
        }

        // Exit with appropriate code
        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        ErrorHandler.handleCommandError(error, 'sync');
      }
    });

  return command;
}
