import { Command } from 'commander';
import type { AppDependencies } from '../../composition-root.js';
import type { ClientName } from '@overture/config-types';
import { SyncFormatter } from '@overture/formatters';
import { ErrorHandler } from '@overture/utils';

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

export function createSyncCommand(deps: AppDependencies): Command {
  const { syncEngine, output, configLoader, pathResolver } = deps;
  const formatter = new SyncFormatter(output);
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
        const detailMode = await loadSyncConfig(
          options,
          pathResolver,
          configLoader,
        );

        if (options.dryRun) {
          output.info('Running in dry-run mode - no changes will be made');
        }

        if (options.client) {
          output.info(`Syncing for client: ${options.client}`);
        }

        const syncOptions = buildSyncOptions(options, detailMode);
        const result = await syncEngine.syncClients(syncOptions);

        formatter.displayDetectionSummary(result);
        formatter.displayMcpTable(result);
        formatter.displayPluginSyncPlan(result, detailMode);
        formatter.displaySkillsSummary(result, detailMode);
        formatter.displayAgentsSummary(result, detailMode);
        formatter.displaySyncResults(result, detailMode);
        formatter.displayWarnings(result, detailMode);
        formatter.displayBackupInfo(result, detailMode);
        formatter.displayFinalStatus(result);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        ErrorHandler.handleCommandError(error, 'sync');
      }
    });

  return command;
}
