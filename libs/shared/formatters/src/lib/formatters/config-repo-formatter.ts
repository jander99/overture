import type { OutputPort } from '@overture/ports-output';
import type {
  ConfigRepoCheckResult,
  GitCheckResult,
  SkillsCheckResult,
  AgentsCheckResult,
} from '@overture/diagnostics-types';
import chalk from 'chalk';

type AgentSyncStatus = NonNullable<AgentsCheckResult['syncStatus']>;

/**
 * ConfigRepoFormatter - Formats config repository status
 *
 * Displays comprehensive information about the config repository including:
 * - Git repository status and sync state
 * - Skills directory contents
 * - Agents directory validation (global and project)
 * - Models configuration status
 *
 * Uses OutputPort for structured output and chalk for colored terminal output.
 */
export class ConfigRepoFormatter {
  constructor(private readonly output: OutputPort) {}

  /**
   * Format and output config repository status
   *
   * Main entry point for formatting all config repo information.
   * Displays different output based on whether the config repo exists.
   *
   * @param configRepo - Complete config repository check result
   * @param verbose - Whether to show detailed error messages
   */
  formatConfigRepoStatus(
    configRepo: ConfigRepoCheckResult & {
      git: GitCheckResult;
      skills: SkillsCheckResult;
      agents: AgentsCheckResult;
    },
    verbose: boolean,
  ): void {
    this.output.info(chalk.bold('Checking config repository...\n'));

    if (configRepo.configRepoExists) {
      this.output.success(
        `${chalk.green('✓')} Config repo - ${chalk.dim(configRepo.configRepoPath)}`,
      );
      this.formatGitRepoStatus(configRepo.git, configRepo.configRepoPath);
      this.formatSkillsStatus(configRepo.skills);
      this.formatAgentsStatus(configRepo.agents, 'Global', verbose);
      this.formatModelsConfigStatus(configRepo.agents);
    } else {
      this.formatConfigRepoNotFound(configRepo.configRepoPath);
    }

    console.log('');
  }

  /**
   * Format git repository status
   *
   * Displays git initialization, remote configuration, and sync status.
   * Provides actionable suggestions when git is not configured.
   *
   * @param git - Git check result
   * @param configRepoPath - Path to config repository for command suggestions
   */
  private formatGitRepoStatus(
    git: GitCheckResult,
    configRepoPath: string,
  ): void {
    if (git.isGitRepo) {
      const hashShort = git.localHash
        ? git.localHash.substring(0, 7)
        : 'unknown';
      this.output.success(
        `  ${chalk.green('✓')} Git repository - ${chalk.dim('initialized')} ${chalk.dim(`(${hashShort})`)}`,
      );
      if (git.gitRemote) {
        this.output.success(
          `    ${chalk.green('✓')} Remote configured - ${chalk.dim(git.gitRemote)}`,
        );
        this.formatGitSyncStatus(git);
      } else {
        this.output.warn(`    ${chalk.yellow('⚠')} No git remote configured`);
        console.log(
          `      ${chalk.dim('→')} ${chalk.dim('Run: git remote add origin <url>')}`,
        );
      }
    } else {
      this.output.warn(`  ${chalk.yellow('⚠')} Not a git repository`);
      console.log(
        `    ${chalk.dim('→')} ${chalk.dim('Run: cd ' + configRepoPath + ' && git init')}`,
      );
    }
  }

  /**
   * Format git sync status
   *
   * Compares local and remote hashes to determine if the repository is in sync.
   * Shows warnings with actionable commands when out of sync.
   *
   * @param git - Git check result with hash information
   */
  private formatGitSyncStatus(git: GitCheckResult): void {
    if (git.gitInSync) {
      this.output.success(
        `      ${chalk.green('✓')} In sync with remote ${chalk.dim('(up to date)')}`,
      );
    } else {
      this.output.warn(`      ${chalk.yellow('⚠')} Out of sync with remote`);
      if (git.localHash && git.remoteHash) {
        console.log(
          `        ${chalk.dim('Local:')}  ${chalk.dim(git.localHash.substring(0, 7))}`,
        );
        console.log(
          `        ${chalk.dim('Remote:')} ${chalk.dim(git.remoteHash.substring(0, 7))}`,
        );
      }
      console.log(
        `        ${chalk.dim('→')} ${chalk.dim('Run: git pull or git push')}`,
      );
    }
  }

  /**
   * Format skills directory status
   *
   * Displays skill count and directory existence.
   * Shows warning with setup instructions if skills directory is missing.
   *
   * @param skills - Skills check result
   */
  private formatSkillsStatus(skills: SkillsCheckResult): void {
    if (skills.skillsDirExists) {
      if (skills.skillCount > 0) {
        this.output.success(
          `  ${chalk.green('✓')} Skills - ${chalk.cyan(skills.skillCount.toString())} ${skills.skillCount === 1 ? 'skill' : 'skills'} found`,
        );
      } else {
        this.output.warn(
          `  ${chalk.yellow('⚠')} Skills directory exists but is empty`,
        );
        console.log(
          `    ${chalk.dim('→')} ${chalk.dim('Add .md skill files to ' + skills.skillsPath)}`,
        );
      }
    } else {
      this.output.warn(`  ${chalk.yellow('⚠')} Skills directory not found`);
      console.log(
        `    ${chalk.dim('→')} ${chalk.dim('Run: mkdir -p ' + skills.skillsPath)}`,
      );
    }
  }

  /**
   * Format agents directory status
   *
   * Displays agent count and validation errors for both global and project agents.
   * In verbose mode, shows detailed error messages and sync status.
   *
   * @param agents - Agents check result
   * @param scope - Scope label ('Global' or 'Project')
   * @param verbose - Whether to show detailed error messages
   */
  private formatAgentsStatus(
    agents: AgentsCheckResult,
    scope: string,
    verbose: boolean,
  ): void {
    this.formatGlobalAgentsStatus(agents, scope, verbose);
    this.formatProjectAgentsStatus(agents, verbose);

    if (agents.syncStatus) {
      this.formatAgentSyncStatus(agents.syncStatus, verbose);
    }
  }

  private formatGlobalAgentsStatus(
    agents: AgentsCheckResult,
    scope: string,
    verbose: boolean,
  ): void {
    if (!agents.globalAgentsDirExists) {
      this.output.warn(
        `  ${chalk.yellow('⚠')} ${scope} Agents directory not found`,
      );
      console.log(
        `    ${chalk.dim('→')} ${chalk.dim('Run: mkdir -p ' + agents.globalAgentsPath)}`,
      );
      return;
    }

    if (agents.globalAgentCount === 0) {
      this.output.warn(
        `  ${chalk.yellow('⚠')} ${scope} Agents directory exists but is empty`,
      );
      console.log(
        `    ${chalk.dim('→')} ${chalk.dim('Add agent YAML files to ' + agents.globalAgentsPath)}`,
      );
      return;
    }

    this.formatAgentCountStatus(
      scope,
      agents.globalAgentCount,
      agents.globalAgentErrors,
      verbose,
    );
  }

  private formatProjectAgentsStatus(
    agents: AgentsCheckResult,
    verbose: boolean,
  ): void {
    if (
      !agents.projectAgentsPath ||
      !agents.projectAgentsDirExists ||
      agents.projectAgentCount === 0
    ) {
      return;
    }

    this.formatAgentCountStatus(
      'Project',
      agents.projectAgentCount,
      agents.projectAgentErrors,
      verbose,
    );
  }

  private formatAgentCountStatus(
    scope: string,
    count: number,
    errors: string[],
    verbose: boolean,
  ): void {
    if (errors.length > 0) {
      this.output.warn(
        `  ${chalk.yellow('⚠')} ${scope} Agents - ${chalk.cyan(count.toString())} valid, ${chalk.red(errors.length.toString())} errors`,
      );
      this.formatAgentValidationErrors(errors, verbose);
      return;
    }

    this.output.success(
      `  ${chalk.green('✓')} ${scope} Agents - ${chalk.cyan(count.toString())} ${count === 1 ? 'agent' : 'agents'} found`,
    );
  }

  private formatAgentValidationErrors(errors: string[], verbose: boolean): void {
    if (!verbose || errors.length === 0) {
      return;
    }

    console.log(`    ${chalk.dim('Validation errors:')}`);
    for (const error of errors) {
      console.log(`      ${chalk.red('✗')} ${chalk.dim(error)}`);
    }
  }

  /**
   * Format agent sync status
   *
   * Displays sync information comparing global and project agents.
   * Shows which agents are in sync, out of sync, or only in one location.
   *
   * @param syncStatus - Agent sync status data
   * @param verbose - Whether to show detailed agent lists
   */
  private formatAgentSyncStatus(
    syncStatus: AgentsCheckResult['syncStatus'],
    verbose: boolean,
  ): void {
    if (!syncStatus || this.getAgentSyncTotal(syncStatus) === 0) {
      return;
    }

    if (!syncStatus.isInitialized) {
      this.formatAgentSyncNotInitialized();
      return;
    }

    if (this.hasAgentsNeedingSync(syncStatus)) {
      this.formatAgentsNeedingSync(syncStatus, verbose);
      return;
    }

    this.formatAgentsInSync(syncStatus, verbose);
  }

  private getAgentSyncTotal(syncStatus: AgentSyncStatus): number {
    return new Set([...syncStatus.globalAgents, ...syncStatus.projectAgents]).size;
  }

  private formatAgentSyncNotInitialized(): void {
    this.output.warn(
      `  ${chalk.yellow('⚠')} Agent Sync - ${chalk.dim('not initialized')}`,
    );
    console.log(
      `    ${chalk.dim('→')} ${chalk.dim('Run: overture sync --skip-skills to sync agents')}`,
    );
  }

  private hasAgentsNeedingSync(syncStatus: AgentSyncStatus): boolean {
    return syncStatus.outOfSync.length > 0 || syncStatus.onlyInGlobal.length > 0;
  }

  private formatAgentsNeedingSync(
    syncStatus: AgentSyncStatus,
    verbose: boolean,
  ): void {
    const inSyncCount = syncStatus.inSync.length;
    const needSyncCount = syncStatus.outOfSync.length + syncStatus.onlyInGlobal.length;

    this.output.warn(
      `  ${chalk.yellow('⚠')} Agent Sync - ${chalk.cyan(inSyncCount.toString())} in sync, ${chalk.yellow(needSyncCount.toString())} need sync`,
    );

    this.formatAgentSyncDetails(syncStatus, verbose, 'pending');
    console.log(
      `    ${chalk.dim('→')} ${chalk.dim('Run: overture sync --skip-skills to update agents')}`,
    );
  }

  private formatAgentsInSync(
    syncStatus: AgentSyncStatus,
    verbose: boolean,
  ): void {
    const inSyncCount = syncStatus.inSync.length;

    this.output.success(
      `  ${chalk.green('✓')} Agent Sync - ${chalk.cyan(inSyncCount.toString())} ${inSyncCount === 1 ? 'agent' : 'agents'} in sync`,
    );
    this.formatAgentSyncDetails(syncStatus, verbose, 'synced');
  }

  private formatAgentSyncDetails(
    syncStatus: AgentSyncStatus,
    verbose: boolean,
    mode: 'pending' | 'synced',
  ): void {
    if (!verbose) {
      return;
    }

    const lists =
      mode === 'pending'
        ? this.getPendingAgentSyncLists(syncStatus)
        : this.getSyncedAgentSyncLists(syncStatus);

    for (const list of lists) {
      this.formatAgentList(list.title, list.marker, list.agents);
    }
  }

  private getPendingAgentSyncLists(syncStatus: AgentSyncStatus) {
    return [
      { title: 'In sync:', marker: chalk.green('✓'), agents: syncStatus.inSync },
      {
        title: 'Out of sync (modified):',
        marker: chalk.yellow('⚠'),
        agents: syncStatus.outOfSync,
      },
      {
        title: 'Not synced yet:',
        marker: chalk.yellow('○'),
        agents: syncStatus.onlyInGlobal,
      },
      {
        title: 'Project-only (custom):',
        marker: chalk.blue('•'),
        agents: syncStatus.onlyInProject,
      },
    ];
  }

  private getSyncedAgentSyncLists(syncStatus: AgentSyncStatus) {
    return [
      {
        title: 'Synced agents:',
        marker: chalk.green('✓'),
        agents: syncStatus.inSync,
      },
      {
        title: 'Project-only (custom):',
        marker: chalk.blue('•'),
        agents: syncStatus.onlyInProject,
      },
    ];
  }

  private formatAgentList(
    title: string,
    marker: string,
    agents: string[],
  ): void {
    if (agents.length === 0) {
      return;
    }

    console.log(`    ${chalk.dim(title)}`);
    for (const agent of agents) {
      console.log(`      ${marker} ${chalk.dim(agent)}`);
    }
  }

  /**
   * Format models configuration status
   *
   * Displays status of the models.yaml configuration file.
   * Shows validation errors when the file exists but is invalid.
   *
   * @param agents - Agents check result containing models config status
   */
  private formatModelsConfigStatus(agents: AgentsCheckResult): void {
    if (agents.modelsConfigExists) {
      if (agents.modelsConfigValid) {
        this.output.success(
          `  ${chalk.green('✓')} Models config - ${chalk.dim(agents.modelsConfigPath)}`,
        );
      } else {
        this.output.error(
          `  ${chalk.red('✗')} Models config - ${chalk.red('invalid')}`,
        );
        if (agents.modelsConfigError) {
          console.log(
            `    ${chalk.dim('Error:')} ${chalk.dim(agents.modelsConfigError)}`,
          );
        }
        console.log(
          `    ${chalk.dim('→')} ${chalk.dim('Fix YAML syntax in ' + agents.modelsConfigPath)}`,
        );
      }
    } else {
      this.output.warn(`  ${chalk.yellow('⚠')} Models config not found`);
      console.log(
        `    ${chalk.dim('→')} ${chalk.dim('Create ' + agents.modelsConfigPath + ' to configure model overrides')}`,
      );
    }
  }

  /**
   * Format config repository not found message
   *
   * Displays error and setup instructions when config repo doesn't exist.
   *
   * @param configRepoPath - Expected path to config repository
   */
  private formatConfigRepoNotFound(configRepoPath: string): void {
    this.output.error(
      `${chalk.red('✗')} Config repo not found - ${chalk.dim(configRepoPath)}`,
    );
    console.log(
      `  ${chalk.dim('→')} ${chalk.dim('Run: overture init to create config repository')}`,
    );
  }
}
