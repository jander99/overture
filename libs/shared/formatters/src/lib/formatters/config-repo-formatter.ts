import type { OutputPort } from '@overture/ports-output';
import type {
  ConfigRepoCheckResult,
  GitCheckResult,
  SkillsCheckResult,
  AgentsCheckResult,
} from '@overture/diagnostics-types';
import chalk from 'chalk';

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
    // Handle global agents
    if (agents.globalAgentsDirExists) {
      if (agents.globalAgentCount > 0) {
        const hasErrors = agents.globalAgentErrors.length > 0;
        if (hasErrors) {
          this.output.warn(
            `  ${chalk.yellow('⚠')} ${scope} Agents - ${chalk.cyan(agents.globalAgentCount.toString())} valid, ${chalk.red(agents.globalAgentErrors.length.toString())} errors`,
          );
        } else {
          this.output.success(
            `  ${chalk.green('✓')} ${scope} Agents - ${chalk.cyan(agents.globalAgentCount.toString())} ${agents.globalAgentCount === 1 ? 'agent' : 'agents'} found`,
          );
        }

        // Show errors in verbose mode
        if (verbose && hasErrors) {
          console.log(`    ${chalk.dim('Validation errors:')}`);
          for (const error of agents.globalAgentErrors) {
            console.log(`      ${chalk.red('✗')} ${chalk.dim(error)}`);
          }
        }
      } else {
        this.output.warn(
          `  ${chalk.yellow('⚠')} ${scope} Agents directory exists but is empty`,
        );
        console.log(
          `    ${chalk.dim('→')} ${chalk.dim('Add agent YAML files to ' + agents.globalAgentsPath)}`,
        );
      }
    } else {
      this.output.warn(
        `  ${chalk.yellow('⚠')} ${scope} Agents directory not found`,
      );
      console.log(
        `    ${chalk.dim('→')} ${chalk.dim('Run: mkdir -p ' + agents.globalAgentsPath)}`,
      );
    }

    // Handle project agents if they exist
    if (
      agents.projectAgentsPath &&
      agents.projectAgentsDirExists &&
      agents.projectAgentCount > 0
    ) {
      const hasErrors = agents.projectAgentErrors.length > 0;
      if (hasErrors) {
        this.output.warn(
          `  ${chalk.yellow('⚠')} Project Agents - ${chalk.cyan(agents.projectAgentCount.toString())} valid, ${chalk.red(agents.projectAgentErrors.length.toString())} errors`,
        );
      } else {
        this.output.success(
          `  ${chalk.green('✓')} Project Agents - ${chalk.cyan(agents.projectAgentCount.toString())} ${agents.projectAgentCount === 1 ? 'agent' : 'agents'} found`,
        );
      }

      // Show errors in verbose mode
      if (verbose && hasErrors) {
        console.log(`    ${chalk.dim('Validation errors:')}`);
        for (const error of agents.projectAgentErrors) {
          console.log(`      ${chalk.red('✗')} ${chalk.dim(error)}`);
        }
      }
    }

    // Display sync status if available
    if (agents.syncStatus) {
      this.formatAgentSyncStatus(agents.syncStatus, verbose);
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
    if (!syncStatus) return;

    const totalAgents = new Set([
      ...syncStatus.globalAgents,
      ...syncStatus.projectAgents,
    ]).size;

    // Overall sync status
    if (totalAgents === 0) {
      return; // No agents to sync
    }

    if (!syncStatus.isInitialized) {
      this.output.warn(
        `  ${chalk.yellow('⚠')} Agent Sync - ${chalk.dim('not initialized')}`,
      );
      console.log(
        `    ${chalk.dim('→')} ${chalk.dim('Run: overture sync --skip-skills to sync agents')}`,
      );
      return;
    }

    const inSyncCount = syncStatus.inSync.length;
    const outOfSyncCount = syncStatus.outOfSync.length;
    const onlyGlobalCount = syncStatus.onlyInGlobal.length;

    // Determine overall status
    if (outOfSyncCount > 0 || onlyGlobalCount > 0) {
      this.output.warn(
        `  ${chalk.yellow('⚠')} Agent Sync - ${chalk.cyan(inSyncCount.toString())} in sync, ${chalk.yellow((outOfSyncCount + onlyGlobalCount).toString())} need sync`,
      );

      // Show details in verbose mode
      if (verbose) {
        if (syncStatus.inSync.length > 0) {
          console.log(`    ${chalk.dim('In sync:')}`);
          for (const agent of syncStatus.inSync) {
            console.log(`      ${chalk.green('✓')} ${chalk.dim(agent)}`);
          }
        }

        if (syncStatus.outOfSync.length > 0) {
          console.log(`    ${chalk.dim('Out of sync (modified):')}`);
          for (const agent of syncStatus.outOfSync) {
            console.log(`      ${chalk.yellow('⚠')} ${chalk.dim(agent)}`);
          }
        }

        if (syncStatus.onlyInGlobal.length > 0) {
          console.log(`    ${chalk.dim('Not synced yet:')}`);
          for (const agent of syncStatus.onlyInGlobal) {
            console.log(`      ${chalk.yellow('○')} ${chalk.dim(agent)}`);
          }
        }

        if (syncStatus.onlyInProject.length > 0) {
          console.log(`    ${chalk.dim('Project-only (custom):')}`);
          for (const agent of syncStatus.onlyInProject) {
            console.log(`      ${chalk.blue('•')} ${chalk.dim(agent)}`);
          }
        }
      }

      console.log(
        `    ${chalk.dim('→')} ${chalk.dim('Run: overture sync --skip-skills to update agents')}`,
      );
    } else {
      this.output.success(
        `  ${chalk.green('✓')} Agent Sync - ${chalk.cyan(inSyncCount.toString())} ${inSyncCount === 1 ? 'agent' : 'agents'} in sync`,
      );

      // Show agent list in verbose mode
      if (verbose && syncStatus.inSync.length > 0) {
        console.log(`    ${chalk.dim('Synced agents:')}`);
        for (const agent of syncStatus.inSync) {
          console.log(`      ${chalk.green('✓')} ${chalk.dim(agent)}`);
        }
      }

      if (verbose && syncStatus.onlyInProject.length > 0) {
        console.log(`    ${chalk.dim('Project-only (custom):')}`);
        for (const agent of syncStatus.onlyInProject) {
          console.log(`      ${chalk.blue('•')} ${chalk.dim(agent)}`);
        }
      }
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
