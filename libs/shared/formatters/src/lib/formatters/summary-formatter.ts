/**
 * @overture/formatters
 *
 * SummaryFormatter - Formats diagnostic summary results
 *
 * Responsibilities:
 * - Format complete diagnostic summary with colors and status indicators
 * - Display config repository status (git, skills, agents)
 * - Display client detection summary
 * - Display MCP server availability summary
 * - Generate recommendations based on results
 */

import type { OutputPort } from '@overture/ports-output';
import type { DiagnosticsResult } from '@overture/diagnostics-types';
import chalk from 'chalk';

/**
 * SummaryFormatter - Formats diagnostic summary for display
 */
export class SummaryFormatter {
  constructor(private readonly output: OutputPort) {}

  /**
   * Format and output complete diagnostic summary
   */
  formatSummary(result: DiagnosticsResult, totalClients: number): void {
    console.log('');
    this.output.info(chalk.bold('Summary:\n'));

    this.formatConfigRepoSummary(result);
    console.log('');

    this.formatClientsSummary(result, totalClients);
    this.formatConfigsSummary(result);
    this.formatMcpSummary(result);

    console.log('');
  }

  /**
   * Format config repository summary
   */
  private formatConfigRepoSummary(result: DiagnosticsResult): void {
    const configRepoStatus = result.configRepo.configRepoExists
      ? chalk.green('exists')
      : chalk.yellow('not found');
    console.log(`  Config repo:      ${configRepoStatus}`);

    if (result.configRepo.configRepoExists) {
      this.formatGitRepoSummary(result);
      this.formatSkillsSummary(result);
      this.formatAgentsSummary(result);
    }
  }

  /**
   * Format git repository summary
   */
  private formatGitRepoSummary(result: DiagnosticsResult): void {
    const { git } = result.configRepo;

    const gitRepoStatus = git.isGitRepo
      ? chalk.green('yes')
      : chalk.yellow('no');
    console.log(`  Git repository:   ${gitRepoStatus}`);

    if (git.isGitRepo) {
      const remoteStatus = git.gitRemote
        ? chalk.green('configured')
        : chalk.yellow('not configured');
      console.log(`  Git remote:       ${remoteStatus}`);
      this.formatGitSyncSummary(git);
    }
  }

  /**
   * Format git sync summary
   */
  private formatGitSyncSummary(git: {
    gitRemote: string | null;
    localHash: string | null;
    remoteHash: string | null;
    gitInSync: boolean;
  }): void {
    if (git.gitRemote && git.localHash && git.remoteHash) {
      const syncStatus = git.gitInSync
        ? chalk.green('in sync')
        : chalk.yellow('out of sync');
      console.log(`  Git sync:         ${syncStatus}`);
    }
  }

  /**
   * Format skills directory summary
   */
  private formatSkillsSummary(result: DiagnosticsResult): void {
    const { skills } = result.configRepo;

    const skillsStatus = skills.skillsDirExists
      ? chalk.green('exists')
      : chalk.yellow('not found');
    const skillCountStr =
      skills.skillsDirExists && skills.skillCount > 0
        ? chalk.dim(
            ` (${skills.skillCount} skill${skills.skillCount === 1 ? '' : 's'})`,
          )
        : '';
    console.log(`  Skills directory: ${skillsStatus}${skillCountStr}`);
  }

  /**
   * Format agents summary - shows counts similar to skills
   */
  private formatAgentsSummary(result: DiagnosticsResult): void {
    const { agents } = result.configRepo;
    const { summary } = result;

    // Global agents with count (similar to skills display)
    const globalAgentsStatus = agents.globalAgentsDirExists
      ? chalk.green('exists')
      : chalk.yellow('not found');
    const globalAgentCountStr =
      agents.globalAgentsDirExists && agents.globalAgentCount > 0
        ? chalk.dim(
            ` (${agents.globalAgentCount} agent${agents.globalAgentCount === 1 ? '' : 's'})`,
          )
        : '';
    const globalErrorsStr =
      agents.globalAgentErrors.length > 0
        ? chalk.yellow(
            ` - ${agents.globalAgentErrors.length} error${agents.globalAgentErrors.length === 1 ? '' : 's'}`,
          )
        : '';
    console.log(
      `  Global agents:    ${globalAgentsStatus}${globalAgentCountStr}${globalErrorsStr}`,
    );

    // Project agents (if present)
    if (agents.projectAgentsDirExists || agents.projectAgentCount > 0) {
      const projectAgentsStatus = agents.projectAgentsDirExists
        ? chalk.green('exists')
        : chalk.yellow('not found');
      const projectAgentCountStr =
        agents.projectAgentsDirExists && agents.projectAgentCount > 0
          ? chalk.dim(
              ` (${agents.projectAgentCount} agent${agents.projectAgentCount === 1 ? '' : 's'})`,
            )
          : '';
      const projectErrorsStr =
        agents.projectAgentErrors.length > 0
          ? chalk.yellow(
              ` - ${agents.projectAgentErrors.length} error${agents.projectAgentErrors.length === 1 ? '' : 's'}`,
            )
          : '';
      console.log(
        `  Project agents:   ${projectAgentsStatus}${projectAgentCountStr}${projectErrorsStr}`,
      );
    }

    // Agent sync status (compact summary line)
    if (
      summary.agentsInSync !== undefined &&
      summary.agentsNeedSync !== undefined
    ) {
      if (summary.agentsNeedSync > 0) {
        const syncStatusStr = chalk.yellow(
          `${summary.agentsInSync} synced, ${summary.agentsNeedSync} need sync`,
        );
        console.log(`  Agent sync:       ${syncStatusStr}`);
      } else if (summary.agentsInSync > 0) {
        const syncStatusStr = chalk.green(`${summary.agentsInSync} in sync`);
        console.log(`  Agent sync:       ${syncStatusStr}`);
      }
    } else if (agents.syncStatus && !agents.syncStatus.isInitialized) {
      console.log(`  Agent sync:       ${chalk.yellow('not initialized')}`);
    }

    // Model mappings
    const modelsStatus = agents.modelsConfigExists
      ? agents.modelsConfigValid
        ? chalk.green('valid')
        : chalk.yellow('invalid')
      : chalk.dim('not configured');
    console.log(`  Model mappings:   ${modelsStatus}`);
  }

  /**
   * Format clients summary
   */
  private formatClientsSummary(
    result: DiagnosticsResult,
    totalClients: number,
  ): void {
    const { summary } = result;

    console.log(
      `  Clients detected: ${chalk.green(summary.clientsDetected)} / ${totalClients}`,
    );
    console.log(`  Clients missing:  ${chalk.red(summary.clientsMissing)}`);

    if (summary.wsl2Detections > 0) {
      console.log(`  WSL2 detections:  ${chalk.cyan(summary.wsl2Detections)}`);
    }
  }

  /**
   * Format configs summary
   */
  private formatConfigsSummary(result: DiagnosticsResult): void {
    const { summary } = result;

    console.log(`  Configs valid:    ${chalk.green(summary.configsValid)}`);
    if (summary.configsInvalid > 0) {
      console.log(
        `  Configs invalid:  ${chalk.yellow(summary.configsInvalid)}`,
      );
    }
  }

  /**
   * Format MCP servers summary
   */
  private formatMcpSummary(result: DiagnosticsResult): void {
    const { summary, mcpServers } = result;
    const totalMcpServers = mcpServers.mcpServers.length;

    if (totalMcpServers > 0) {
      console.log('');
      console.log(
        `  MCP commands available: ${chalk.green(summary.mcpCommandsAvailable)} / ${totalMcpServers}`,
      );
      if (summary.mcpCommandsMissing > 0) {
        console.log(
          `  MCP commands missing:   ${chalk.yellow(summary.mcpCommandsMissing)}`,
        );
      }
    }
  }
}
