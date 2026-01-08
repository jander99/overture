import type { OutputPort } from '@overture/ports-output';
import type {
  SyncResult,
  ClientSyncResult,
  ConfigDiff,
} from '@overture/sync-core';
import { formatDiff } from '@overture/sync-core';
import { TABLE_FORMATTING } from '@overture/utils';

const SKIPPED_ERROR_MESSAGE = 'Skipped - client not detected on system';

interface TableFormatConfig {
  minMcpColumnWidth: number;
  sourceColumnWidth: number;
  clientColumnWidth: number;
}

const DEFAULT_TABLE_CONFIG: TableFormatConfig = {
  minMcpColumnWidth: TABLE_FORMATTING.MIN_MCP_COLUMN_WIDTH,
  sourceColumnWidth: TABLE_FORMATTING.SOURCE_COLUMN_WIDTH,
  clientColumnWidth: TABLE_FORMATTING.CLIENT_COLUMN_WIDTH,
};

export class SyncFormatter {
  constructor(
    private readonly output: OutputPort,
    private readonly tableConfig: TableFormatConfig = DEFAULT_TABLE_CONFIG,
  ) {}

  generateMcpTable(result: SyncResult): string {
    const allMcpNames = new Set<string>();
    const mcpSourceMap = new Map<string, 'global' | 'project'>();
    const clientMcps = new Map<string, Map<string, 'global' | 'project'>>();

    for (const clientResult of result.results) {
      if (!clientResult.success || !clientResult.mcpSources) continue;

      const mcpMap = new Map<string, 'global' | 'project'>();
      for (const [mcpName, source] of Object.entries(clientResult.mcpSources)) {
        allMcpNames.add(mcpName);
        mcpMap.set(mcpName, source);
        if (!mcpSourceMap.has(mcpName)) {
          mcpSourceMap.set(mcpName, source);
        }
      }
      clientMcps.set(clientResult.client, mcpMap);
    }

    if (allMcpNames.size === 0) {
      return '';
    }

    const sortedMcpNames = Array.from(allMcpNames).sort((a, b) => {
      const sourceA = mcpSourceMap.get(a) || 'project';
      const sourceB = mcpSourceMap.get(b) || 'project';
      if (sourceA === sourceB) {
        return a.localeCompare(b);
      }
      return sourceA === 'global' ? -1 : 1;
    });

    const clientNames = Array.from(clientMcps.keys());
    const mcpColumnWidth = Math.max(
      this.tableConfig.minMcpColumnWidth,
      ...sortedMcpNames.map((name) => name.length),
    );

    const header = [
      'MCP Server'.padEnd(mcpColumnWidth),
      'Source'.padEnd(this.tableConfig.sourceColumnWidth),
      ...clientNames.map((name) =>
        name.padEnd(this.tableConfig.clientColumnWidth),
      ),
    ].join(' | ');

    const separator = [
      '-'.repeat(mcpColumnWidth),
      '-'.repeat(this.tableConfig.sourceColumnWidth),
      ...clientNames.map(() => '-'.repeat(this.tableConfig.clientColumnWidth)),
    ].join('-|-');

    const rows: string[] = [];
    for (const mcpName of sortedMcpNames) {
      const source = mcpSourceMap.get(mcpName) || 'project';
      const sourceDisplay = source === 'global' ? 'Global' : 'Project';

      const row = [
        mcpName.padEnd(mcpColumnWidth),
        sourceDisplay.padEnd(this.tableConfig.sourceColumnWidth),
        ...clientNames.map((clientName) => {
          const clientMcp = clientMcps.get(clientName);
          if (clientMcp?.has(mcpName)) {
            const mcpSource = clientMcp.get(mcpName);
            return `✓ (${mcpSource})`.padEnd(
              this.tableConfig.clientColumnWidth,
            );
          }
          return '-'.padEnd(this.tableConfig.clientColumnWidth);
        }),
      ].join(' | ');

      rows.push(row);
    }

    return [header, separator, ...rows].join('\n');
  }

  displayDetectionSummary(result: SyncResult): void {
    this.output.section?.('🔍 Detecting clients...');
    this.output.nl?.();

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

    for (const clientResult of detectedClients) {
      const detection = clientResult.binaryDetection;
      if (!detection) {
        this.output.warn(
          `${clientResult.client} was detected but has no detection details; skipping from detection summary.`,
        );
        continue;
      }
      const versionStr = detection.version ? ` (v${detection.version})` : '';
      const configPath = detection.configPath || clientResult.configPath;
      this.output.success(
        `${clientResult.client}${versionStr} → ${configPath}`,
      );
    }

    for (const clientResult of undetectedButSyncedClients) {
      const configPath = clientResult.configPath;
      this.output.warn(
        `${clientResult.client} - not detected but config will be generated → ${configPath}`,
      );
    }

    for (const clientResult of actuallySkippedClients) {
      this.output.skip?.(`${clientResult.client} - not detected, skipped`);
    }
  }

  displayAgentsSummary(result: SyncResult, detailMode: boolean): void {
    if (result.agentSyncSummary && result.agentSyncSummary.total > 0) {
      const summary = result.agentSyncSummary;
      this.output.info('🤖 Agents:');
      if (summary.synced > 0) {
        const syncedResults = summary.results.filter((r) => r.success);
        const uniqueAgents = new Set(syncedResults.map((r) => r.agent));
        const clientCount = new Set(
          syncedResults.flatMap((r) => Object.keys(r.clientResults)),
        ).size;

        this.output.success(
          `  ✓ Synced ${uniqueAgents.size} agent(s) to ${clientCount} client(s)`,
        );
      }
      if (summary.failed > 0) {
        this.output.warn(`  ✗ Failed ${summary.failed} agent(s)`);
        if (detailMode) {
          const failedAgents = summary.results
            .filter((r) => !r.success)
            .map((r) => r.agent);
          for (const agent of failedAgents) {
            this.output.warn(`    - ${agent}`);
          }
        }
      }
      this.output.nl?.();
    }
  }

  displayMcpTable(result: SyncResult): void {
    const mcpTable = this.generateMcpTable(result);
    if (mcpTable) {
      this.output.nl?.();
      this.output.section?.('📋 MCP Server Configuration:');
      this.output.plain?.(mcpTable);
      this.output.nl?.();
    }
  }

  displayPluginSyncPlan(result: SyncResult, detailMode: boolean): void {
    if (detailMode && result.pluginSyncDetails) {
      const details = result.pluginSyncDetails;
      this.output.section?.('📦 Plugin Sync Plan:');
      this.output.nl?.();
      this.output.info(`  Configured: ${details.configured} plugins`);
      this.output.info(`  Already installed: ${details.installed}`);

      if (details.toInstall.length > 0) {
        this.output.info(`  To install: ${details.toInstall.length}`);
        for (const plugin of details.toInstall) {
          this.output.info(`    - ${plugin.name}@${plugin.marketplace}`);
        }
      } else {
        this.output.success(`  ✅ All plugins already installed`);
      }
      this.output.nl?.();
    }
  }

  displaySkillsSummary(result: SyncResult, detailMode: boolean): void {
    if (result.skillSyncSummary && result.skillSyncSummary.total > 0) {
      const summary = result.skillSyncSummary;
      this.output.info('📚 Skills:');
      if (summary.synced > 0) {
        const syncedResults = summary.results.filter(
          (r) => r.success && !r.skipped,
        );
        const uniqueSkills = new Set(syncedResults.map((r) => r.skill));
        const uniqueClients = new Set(syncedResults.map((r) => r.client));

        const skillCount = uniqueSkills.size;
        const clientCount = uniqueClients.size;
        const totalOps = summary.synced;

        this.output.success(
          `  ✓ Synced ${skillCount} skill(s) to ${clientCount} client(s) (${totalOps} total operations)`,
        );
      }
      if (summary.skipped > 0) {
        this.output.info(`  ○ Skipped ${summary.skipped} (already synced)`);
      }
      if (summary.failed > 0) {
        this.output.warn(`  ✗ Failed ${summary.failed} skill(s)`);
        if (detailMode) {
          const failedSkills = summary.results
            .filter((r) => !r.success)
            .map((r) => `${r.skill} (${r.client})`);
          for (const skill of failedSkills) {
            this.output.warn(`    - ${skill}`);
          }
        }
      }
      this.output.nl?.();
    }
  }

  displaySyncResults(result: SyncResult, detailMode: boolean): void {
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
      this.output.section?.('⚙️  Syncing configurations...');
      this.output.nl?.();

      const resultsByClient = this.groupResultsByClient(result.results);

      for (const clientName of resultsByClient.keys()) {
        const clientResults = resultsByClient.get(clientName);
        if (!clientResults) continue;
        const allSuccess = clientResults.every((r) => r.success);

        if (allSuccess) {
          this.displaySuccessfulClientSync(
            clientName,
            clientResults,
            detailMode,
          );
        } else {
          this.output.error(`${clientName} - sync failed`);
        }
      }
    }
  }

  displayWarnings(result: SyncResult, detailMode: boolean): void {
    const globalWarnings: string[] = [];
    const allCriticalWarnings: Array<{ client: string; warning: string }> = [];
    const allInformationalWarnings: Array<{ client: string; warning: string }> =
      [];
    const allTips = new Set<string>();

    for (const warning of result.warnings) {
      globalWarnings.push(warning);
    }

    for (const clientResult of result.results) {
      const { critical, informational, tips } = this.categorizeWarnings(
        clientResult,
        detailMode,
      );
      allCriticalWarnings.push(...critical);
      allInformationalWarnings.push(...informational);
      for (const tip of tips) {
        allTips.add(tip);
      }
    }

    if (
      globalWarnings.length > 0 ||
      allCriticalWarnings.length > 0 ||
      allInformationalWarnings.length > 0
    ) {
      this.displayWarningsSection(
        globalWarnings,
        allCriticalWarnings,
        allInformationalWarnings,
        detailMode,
      );
    }

    const hasWarnings =
      globalWarnings.length > 0 ||
      allCriticalWarnings.length > 0 ||
      allInformationalWarnings.length > 0;
    this.displayTipsSection(allTips, hasWarnings);

    if (result.errors.length > 0) {
      this.output.section?.('❌ Errors:');
      for (const error of result.errors) {
        this.output.error(`  - ${error}`);
      }
    }
  }

  displayBackupInfo(result: SyncResult, detailMode: boolean): void {
    if (detailMode) {
      const backups = result.results.filter((r) => r.backupPath);
      if (backups.length > 0) {
        this.output.section?.('💾 Backups:');
        for (const clientResult of backups) {
          this.output.info(
            `  ${clientResult.client}: ${clientResult.backupPath}`,
          );
        }
      }
    }
  }

  displayFinalStatus(result: SyncResult): void {
    this.output.nl?.();
    if (result.success) {
      this.output.success('Sync complete!');
    } else {
      this.output.error('Sync completed with errors');
    }
  }

  private groupResultsByClient(
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

  private displaySuccessfulClientSync(
    clientName: string,
    clientResults: ClientSyncResult[],
    detailMode: boolean,
  ): void {
    const configs = clientResults
      .map((r) => {
        if (r.configType === 'user') return 'user';
        if (r.configType === 'project') return 'project';
        return null;
      })
      .filter(Boolean);

    const configStr =
      configs.length > 1 ? ` (${configs.join(' + ')} configs)` : '';
    this.output.success(`${clientName} - synchronized${configStr}`);

    for (const clientResult of clientResults) {
      this.displayClientDiff(clientResult, detailMode);
    }
  }

  private displayClientDiff(
    clientResult: ClientSyncResult,
    detailMode: boolean,
  ): void {
    if (!detailMode || !clientResult.diff?.hasChanges) {
      return;
    }

    this.output.nl?.();
    const configLabel = clientResult.configType
      ? ` (${clientResult.configType} config)`
      : '';

    this.displayMcpSourcesDetail(clientResult, configLabel);

    const diffOutput = formatDiff(clientResult.diff as ConfigDiff);
    this.output.plain?.(diffOutput);
    this.output.nl?.();
  }

  private displayMcpSourcesDetail(
    clientResult: ClientSyncResult,
    configLabel: string,
  ): void {
    if (!clientResult.mcpSources) return;

    const globalMcps: string[] = [];
    const projectMcps: string[] = [];

    for (const [mcpName, source] of Object.entries(clientResult.mcpSources)) {
      if (source === 'global') {
        globalMcps.push(mcpName);
      } else {
        projectMcps.push(mcpName);
      }
    }

    this.output.info(
      `Configuration changes for ${clientResult.client}${configLabel}:`,
    );
    this.output.nl?.();

    if (globalMcps.length > 0) {
      this.output.info(`Global MCPs (${globalMcps.length}):`);
      for (const mcpName of globalMcps.sort()) {
        this.output.info(`  ~ ${mcpName}`);
      }
      this.output.nl?.();
    }

    if (projectMcps.length > 0) {
      this.output.info(`Project MCPs (${projectMcps.length}):`);
      for (const mcpName of projectMcps.sort()) {
        this.output.info(`  ~ ${mcpName}`);
      }
      this.output.nl?.();
    }
  }

  private categorizeWarnings(
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
      if (warning.includes('💡 Tip:')) {
        tips.add(warning);
        continue;
      }

      if (detailMode) {
        if (this.isCriticalWarning(warning)) {
          critical.push({ client: clientResult.client, warning });
        } else {
          informational.push({ client: clientResult.client, warning });
        }
      } else {
        if (this.isCriticalWarning(warning)) {
          critical.push({ client: clientResult.client, warning });
        }
      }
    }

    return { critical, informational, tips };
  }

  private isCriticalWarning(warning: string): boolean {
    const warningLower = warning.toLowerCase();

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

    const informationalKeywords = [
      'detected:',
      'not detected on system',
      'will still be generated',
    ];
    if (
      informationalKeywords.some((keyword) => warningLower.includes(keyword))
    ) {
      return false;
    }

    return true;
  }

  private displayWarningsSection(
    globalWarnings: string[],
    criticalWarnings: Array<{ client: string; warning: string }>,
    informationalWarnings: Array<{ client: string; warning: string }>,
    detailMode: boolean,
  ): void {
    this.output.section?.('⚠️  Warnings:');

    if (globalWarnings.length > 0) {
      this.output.nl?.();
      this.output.warn('Configuration:');
      for (const warning of globalWarnings) {
        this.output.warn(`  - ${warning}`);
      }
    }

    if (criticalWarnings.length > 0) {
      if (
        detailMode &&
        (informationalWarnings.length > 0 || globalWarnings.length > 0)
      ) {
        this.output.nl?.();
        this.output.warn('Critical:');
      }
      for (const item of criticalWarnings) {
        this.output.warn(`  - ${item.client}: ${item.warning}`);
      }
    }

    if (detailMode && informationalWarnings.length > 0) {
      this.output.nl?.();
      this.output.info('Informational:');
      for (const item of informationalWarnings) {
        this.output.info(`  - ${item.client}: ${item.warning}`);
      }
    }
  }

  private displayTipsSection(tips: Set<string>, hasWarnings: boolean): void {
    if (tips.size === 0) return;

    if (!hasWarnings) {
      this.output.section?.('💡 Tips:');
    } else {
      this.output.nl?.();
    }
    for (const tip of tips) {
      this.output.info(`  ${tip}`);
    }
  }
}
