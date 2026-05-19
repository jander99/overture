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

    this.formatAgentDirectorySummary('Global agents', {
      dirExists: agents.globalAgentsDirExists,
      count: agents.globalAgentCount,
      errors: agents.globalAgentErrors,
    });

    if (agents.projectAgentsDirExists || agents.projectAgentCount > 0) {
      this.formatAgentDirectorySummary('Project agents', {
        dirExists: agents.projectAgentsDirExists,
        count: agents.projectAgentCount,
        errors: agents.projectAgentErrors,
      });
    }

    this.formatAgentSyncSummary(result);
    this.formatModelMappingsSummary(agents);
  }

  private formatAgentDirectorySummary(
    label: 'Global agents' | 'Project agents',
    agentStatus: { dirExists: boolean; count: number; errors: string[] },
  ): void {
    const directoryStatus = agentStatus.dirExists
      ? chalk.green('exists')
      : chalk.yellow('not found');
    const countStatus = this.formatAgentCount(
      agentStatus.dirExists,
      agentStatus.count,
    );
    const errorsStatus = this.formatAgentErrors(agentStatus.errors);
    const labelText =
      label === 'Global agents' ? 'Global agents:   ' : 'Project agents:  ';

    console.log(
      `  ${labelText} ${directoryStatus}${countStatus}${errorsStatus}`,
    );
  }

  private formatAgentCount(dirExists: boolean, count: number): string {
    if (!dirExists || count === 0) {
      return '';
    }

    return chalk.dim(` (${count} agent${count === 1 ? '' : 's'})`);
  }

  private formatAgentErrors(errors: string[]): string {
    if (errors.length === 0) {
      return '';
    }

    return chalk.yellow(
      ` - ${errors.length} error${errors.length === 1 ? '' : 's'}`,
    );
  }

  private formatAgentSyncSummary(result: DiagnosticsResult): void {
    const { agents } = result.configRepo;
    const { summary } = result;

    if (
      summary.agentsInSync !== undefined &&
      summary.agentsNeedSync !== undefined
    ) {
      this.formatAgentSyncCounts(summary.agentsInSync, summary.agentsNeedSync);
      return;
    }

    if (agents.syncStatus && !agents.syncStatus.isInitialized) {
      console.log(`  Agent sync:       ${chalk.yellow('not initialized')}`);
    }
  }

  private formatAgentSyncCounts(inSync: number, needSync: number): void {
    if (needSync > 0) {
      console.log(
        `  Agent sync:       ${chalk.yellow(`${inSync} synced, ${needSync} need sync`)}`,
      );
      return;
    }

    if (inSync > 0) {
      console.log(`  Agent sync:       ${chalk.green(`${inSync} in sync`)}`);
    }
  }

  private formatModelMappingsSummary(
    agents: DiagnosticsResult['configRepo']['agents'],
  ): void {
    const modelsStatus = agents.modelsConfigExists
      ? this.formatExistingModelMappingsStatus(agents.modelsConfigValid)
      : chalk.dim('not configured');

    console.log(`  Model mappings:   ${modelsStatus}`);
  }

  private formatExistingModelMappingsStatus(isValid: boolean): string {
    return isValid ? chalk.green('valid') : chalk.yellow('invalid');
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
