/**
 * ConfigRepoChecker - Checks config repository existence and git status
 *
 * Responsibilities:
 * - Check if ~/.config/overture directory exists
 * - Check if skills directory exists
 * - Validate git repository setup
 * - Get git remote, local hash, remote hash
 * - Check if local and remote are in sync
 *
 * Never throws errors - always returns results.
 */

import type { FilesystemPort } from '@overture/ports-filesystem';
import type { ProcessPort, EnvironmentPort } from '@overture/ports-process';
import type {
  ConfigRepoCheckResult,
  GitCheckResult,
} from '@overture/diagnostics-types';

export class ConfigRepoChecker {
  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly process: ProcessPort,
    private readonly environment: EnvironmentPort,
  ) {}

  /**
   * Check if config repository exists
   */
  async checkConfigRepository(): Promise<ConfigRepoCheckResult> {
    try {
      const homeDir = this.environment.homedir();
      const configRepoPath = `${homeDir}/.config/overture`;
      const skillsPath = `${configRepoPath}/skills`;

      const configRepoExists = await this.filesystem.exists(configRepoPath);
      const skillsDirExists = await this.filesystem.exists(skillsPath);

      return {
        configRepoPath,
        skillsPath,
        configRepoExists,
        skillsDirExists,
      };
    } catch {
      // Never throw - return safe defaults
      const homeDir = this.environment.homedir();
      return {
        configRepoPath: `${homeDir}/.config/overture`,
        skillsPath: `${homeDir}/.config/overture/skills`,
        configRepoExists: false,
        skillsDirExists: false,
      };
    }
  }

  /**
   * Check git repository status
   */
  async checkGitRepository(
    configRepoPath: string,
    configRepoExists: boolean,
  ): Promise<GitCheckResult> {
    if (!configRepoExists) {
      return {
        isGitRepo: false,
        gitRemote: null,
        localHash: null,
        remoteHash: null,
        gitInSync: false,
      };
    }

    const gitDirPath = `${configRepoPath}/.git`;
    const isGitRepo = await this.filesystem.exists(gitDirPath);

    if (!isGitRepo) {
      return {
        isGitRepo: false,
        gitRemote: null,
        localHash: null,
        remoteHash: null,
        gitInSync: false,
      };
    }

    const gitRemote = await this.getGitRemote(configRepoPath);
    const localHash = await this.getLocalHash(configRepoPath);
    const { remoteHash, gitInSync } = await this.getRemoteHashAndSyncStatus(
      configRepoPath,
      gitRemote,
      localHash,
    );

    return {
      isGitRepo,
      gitRemote,
      localHash,
      remoteHash,
      gitInSync,
    };
  }

  /**
   * Get git remote origin URL
   */
  private async getGitRemote(configRepoPath: string): Promise<string | null> {
    try {
      const result = await this.process.exec('git', [
        '-C',
        configRepoPath,
        'remote',
        'get-url',
        'origin',
      ]);
      if (result.exitCode === 0 && result.stdout.trim()) {
        return result.stdout.trim();
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  /**
   * Get local git HEAD hash
   */
  private async getLocalHash(configRepoPath: string): Promise<string | null> {
    try {
      const result = await this.process.exec('git', [
        '-C',
        configRepoPath,
        'rev-parse',
        'HEAD',
      ]);
      if (result.exitCode === 0 && result.stdout.trim()) {
        return result.stdout.trim();
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  /**
   * Get remote hash and check sync status
   */
  private async getRemoteHashAndSyncStatus(
    configRepoPath: string,
    gitRemote: string | null,
    localHash: string | null,
  ): Promise<{ remoteHash: string | null; gitInSync: boolean }> {
    let remoteHash: string | null = null;
    let gitInSync = false;

    if (!gitRemote || !localHash) {
      return { remoteHash, gitInSync };
    }

    try {
      const result = await this.process.exec('git', [
        '-C',
        configRepoPath,
        'ls-remote',
        'origin',
        'HEAD',
      ]);
      if (result.exitCode === 0 && result.stdout.trim()) {
        const match = result.stdout.trim().split(/\s+/);
        if (match.length > 0) {
          remoteHash = match[0];
          gitInSync = localHash === remoteHash;
        }
      }
    } catch {
      // Ignore errors
    }

    return { remoteHash, gitInSync };
  }
}
