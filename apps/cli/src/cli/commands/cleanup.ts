/**
 * Cleanup Command
 *
 * Remove Overture-managed MCPs from Claude Code's directory-based configs.
 *
 * @module cli/commands/cleanup
 */

import { Command } from 'commander';
import * as p from '@clack/prompts';
import type { AppDependencies } from '../../composition-root.js';
import type { ClaudeCodeAdapter } from '@overture/client-adapters';
import type { CleanupTarget, Platform } from '@overture/config-types';

/**
 * Filter cleanup targets based on command options
 */
async function filterCleanupTargets(
  targets: CleanupTarget[],
  options: { directory?: string; all?: boolean },
): Promise<CleanupTarget[] | null> {
  if (targets.length === 0) {
    p.outro('No cleanup needed - no Overture-managed directories found');
    return null;
  }

  let filteredTargets = targets;

  // Filter by specific directory if requested
  if (options.directory) {
    filteredTargets = targets.filter((t) => t.directory === options.directory);
    if (filteredTargets.length === 0) {
      p.cancel(`No Overture config found at ${options.directory}`);
      return null;
    }
  }

  // Interactive selection (unless --all or --directory specified)
  if (!options.all && !options.directory) {
    const selectedValues = await p.multiselect({
      message: `Select directories to clean up (${targets.length} found):`,
      options: targets.map((t) => ({
        value: t,
        label: t.directory,
        hint: `Remove ${t.mcpsToRemove.length} MCP(s), preserve ${t.mcpsToPreserve.length}`,
      })),
      required: false,
    });

    if (p.isCancel(selectedValues) || selectedValues.length === 0) {
      p.cancel('Cleanup cancelled');
      return null;
    }

    return selectedValues as typeof targets;
  }

  return filteredTargets;
}

/**
 * Generate and display cleanup plan
 */
function generateCleanupPlan(
  selectedTargets: CleanupTarget[],
  dryRun: boolean,
  output: { warn(msg: string): void },
): void {
  const planLines: string[] = [];
  let totalToPreserve = 0;

  for (const target of selectedTargets) {
    planLines.push(`\n${target.directory}:`);
    planLines.push(`  Remove ${target.mcpsToRemove.length} managed MCP(s):`);
    target.mcpsToRemove.forEach((name) => planLines.push(`    • ${name}`));

    if (target.mcpsToPreserve.length > 0) {
      planLines.push(
        `  Preserve ${target.mcpsToPreserve.length} unmanaged MCP(s):`,
      );
      target.mcpsToPreserve.forEach((name) =>
        planLines.push(`    • ${name} (⚠️  not in Overture)`),
      );
    }

    totalToPreserve += target.mcpsToPreserve.length;
  }

  p.note(
    planLines.join('\n'),
    dryRun ? '🔍 Cleanup Plan (Dry Run)' : '🗑️  Cleanup Plan',
  );

  if (totalToPreserve > 0) {
    output.warn(
      `\n⚠️  ${totalToPreserve} unmanaged MCP(s) will be preserved (not in your Overture config)\n`,
    );
  }
}

/**
 * Confirm cleanup with user
 */
async function confirmCleanup(
  selectedTargetsLength: number,
  dryRun: boolean,
  skipConfirm: boolean,
): Promise<boolean> {
  if (skipConfirm || dryRun) {
    return true;
  }

  const confirmed = await p.confirm({
    message: `Clean up ${selectedTargetsLength} director${selectedTargetsLength === 1 ? 'y' : 'ies'}? (Backup will be created)`,
    initialValue: false,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Cleanup cancelled');
    return false;
  }

  return true;
}

/**
 * Execute cleanup and display results
 */
async function executeCleanupFlow(
  cleanupService: AppDependencies['cleanupService'],
  claudeCodeAdapter: ClaudeCodeAdapter,
  platform: Platform,
  selectedTargets: CleanupTarget[],
  dryRun: boolean,
): Promise<void> {
  const cleanupSpinner = p.spinner();
  cleanupSpinner.start(dryRun ? 'Previewing cleanup...' : 'Cleaning up...');

  const result = await cleanupService.executeCleanup(
    claudeCodeAdapter,
    platform,
    selectedTargets,
    dryRun,
  );

  cleanupSpinner.stop(dryRun ? 'Preview complete' : 'Cleanup complete');

  // Show results
  const resultLines = [
    `Directories cleaned: ${result.directoriesCleaned.length}`,
    `MCPs removed: ${result.mcpsRemoved}`,
  ];

  if (result.mcpsPreserved.length > 0) {
    resultLines.push(`MCPs preserved: ${result.mcpsPreserved.length}`);
  }

  if (!dryRun && result.backupPath) {
    resultLines.push(`\nBackup created: ${result.backupPath}`);
  }

  p.note(
    resultLines.join('\n'),
    dryRun ? '🔍 Preview Results' : '✅ Cleanup Results',
  );

  if (dryRun) {
    p.outro('Dry run complete - no files were modified');
  } else {
    p.outro('Cleanup complete! 🎉');
  }
}

/**
 * Create the cleanup command
 */
export function createCleanupCommand(deps: AppDependencies): Command {
  const cmd = new Command('cleanup');

  cmd
    .description(
      'Remove Overture-managed MCPs from Claude Code directory configs',
    )
    .option('--dry-run', 'Preview changes without modifying files')
    .option('--all', 'Clean all directories with Overture configs')
    .option('--directory <path>', 'Clean specific directory only')
    .option('--yes', 'Skip confirmation prompts')
    .action(async (options) => {
      const {
        cleanupService,
        configLoader,
        environment,
        adapterRegistry,
        output,
      } = deps;

      p.intro('🧹 Cleanup Directory-Based MCP Configs');

      try {
        // Get Claude Code adapter
        const claudeCodeAdapter = adapterRegistry.get(
          'claude-code',
        ) as ClaudeCodeAdapter;
        if (!claudeCodeAdapter) {
          p.cancel('Claude Code adapter not available');
          return;
        }

        const platform = environment.platform();
        const overtureConfig = await configLoader.loadConfig();

        // Find cleanup targets
        const spinner = p.spinner();
        spinner.start('Scanning for cleanup targets...');

        const targets = await cleanupService.findCleanupTargets(
          claudeCodeAdapter,
          platform,
          overtureConfig,
        );

        spinner.stop('Scan complete');

        // Filter targets based on options
        const selectedTargets = await filterCleanupTargets(targets, options);
        if (!selectedTargets) {
          return;
        }

        // Generate and display cleanup plan
        generateCleanupPlan(selectedTargets, options.dryRun, output);

        // Confirm cleanup
        const confirmed = await confirmCleanup(
          selectedTargets.length,
          options.dryRun,
          options.yes,
        );
        if (!confirmed) {
          return;
        }

        // Execute cleanup and display results
        await executeCleanupFlow(
          cleanupService,
          claudeCodeAdapter,
          platform,
          selectedTargets,
          options.dryRun,
        );
      } catch (error) {
        p.cancel(`Cleanup failed: ${(error as Error).message}`);
        throw error;
      }
    });

  return cmd;
}
