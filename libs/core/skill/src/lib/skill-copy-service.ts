/**
 * Skill Copy Service
 *
 * Copies skills from the Overture config repo to project directories.
 * This is for sharing skills with team members via version control.
 *
 * Source: ~/.config/overture/skills/<name>/SKILL.md
 * Target: .claude/skills/<name>/SKILL.md (and other clients)
 *
 * @module lib/skill-copy-service
 * @version 1.0.0
 */

import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import type {
  SkillCopyOptions,
  SkillSyncResult,
  ClientName,
} from '@overture/config-types';
import { getSkillDirectoryPath, getSkillPath } from '@overture/client-adapters';
import { OvertureError } from '@overture/errors';
import { SkillDiscovery } from './skill-discovery.js';

/**
 * All supported clients for skill copy
 */
const ALL_CLIENTS: ClientName[] = ['claude-code', 'copilot-cli', 'opencode'];

/**
 * Skill Copy Service
 *
 * Copies skills from the config repo to project-level directories
 * for sharing with team members via version control.
 *
 * @example
 * ```typescript
 * import { SkillCopyService, SkillDiscovery } from '@overture/skill';
 * import { NodeFilesystemAdapter, NodeEnvironmentAdapter } from '@overture/adapters-infrastructure';
 *
 * const filesystem = new NodeFilesystemAdapter();
 * const environment = new NodeEnvironmentAdapter();
 * const discovery = new SkillDiscovery(filesystem, environment);
 * const copyService = new SkillCopyService(filesystem, environment, discovery);
 *
 * // Copy skill to project
 * const results = await copyService.copySkillToProject('debugging');
 *
 * // Copy with force overwrite
 * const results = await copyService.copySkillToProject('debugging', { force: true });
 *
 * // Copy for specific client only
 * const results = await copyService.copySkillToProject('debugging', { clients: ['claude-code'] });
 * ```
 */
export class SkillCopyService {
  private readonly filesystem: FilesystemPort;
  private readonly environment: EnvironmentPort;
  private readonly skillDiscovery: SkillDiscovery;

  constructor(
    filesystem: FilesystemPort,
    environment: EnvironmentPort,
    skillDiscovery: SkillDiscovery,
  ) {
    this.filesystem = filesystem;
    this.environment = environment;
    this.skillDiscovery = skillDiscovery;
  }

  /**
   * Copy a skill to the current project
   *
   * Copies the specified skill from ~/.config/overture/skills/ to project
   * directories for each client (.claude/skills/, .github/skills/, .opencode/skill/).
   *
   * @param skillName - Name of the skill to copy
   * @param options - Copy options (force, clients filter, project root)
   * @returns Array of copy results (one per client)
   * @throws OvertureError if skill doesn't exist in config repo
   *
   * @example
   * ```typescript
   * // Copy to current directory
   * const results = await copyService.copySkillToProject('debugging');
   *
   * // Copy with force overwrite
   * const results = await copyService.copySkillToProject('debugging', { force: true });
   *
   * // Copy to specific project directory
   * const results = await copyService.copySkillToProject('debugging', {
   *   projectRoot: '/home/user/my-project'
   * });
   *
   * // Copy for specific clients only
   * const results = await copyService.copySkillToProject('debugging', {
   *   clients: ['claude-code', 'opencode']
   * });
   * ```
   */
  async copySkillToProject(
    skillName: string,
    options: SkillCopyOptions = {},
  ): Promise<SkillSyncResult[]> {
    const { force = false, clients, projectRoot } = options;

    // Get skill from config repo
    const skill = await this.skillDiscovery.getSkill(skillName);

    if (!skill) {
      throw new OvertureError(
        `Skill '${skillName}' not found in config repo. Run 'overture skill list' to see available skills.`,
        'SKILL_NOT_FOUND',
      );
    }

    // Determine target clients
    const targetClients = clients || ALL_CLIENTS;
    const homeDir = this.environment.homedir();
    const projectDir = projectRoot || process.cwd();

    // Copy to each client
    const results: SkillSyncResult[] = [];

    for (const client of targetClients) {
      const result = await this.copySkillToClient(
        skill.path,
        skillName,
        client,
        homeDir,
        projectDir,
        force,
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Check if skill exists in project for a specific client
   *
   * @param skillName - Skill name
   * @param client - Client name
   * @param projectRoot - Project root directory
   * @returns True if skill exists in project
   */
  async skillExistsInProject(
    skillName: string,
    client: ClientName,
    projectRoot: string,
  ): Promise<boolean> {
    const homeDir = this.environment.homedir();
    const skillPath = getSkillPath(
      client,
      skillName,
      'project',
      homeDir,
      projectRoot,
    );

    return this.filesystem.exists(skillPath);
  }

  /**
   * Copy skill to a specific client's project directory
   *
   * @param sourcePath - Source SKILL.md path from config repo
   * @param skillName - Skill name
   * @param client - Target client
   * @param homeDir - Home directory
   * @param projectRoot - Project root directory
   * @param force - Force overwrite if exists
   * @returns Copy result
   */
  private async copySkillToClient(
    sourcePath: string,
    skillName: string,
    client: ClientName,
    homeDir: string,
    projectRoot: string,
    force: boolean,
  ): Promise<SkillSyncResult> {
    // Get target path
    const targetPath = getSkillPath(
      client,
      skillName,
      'project',
      homeDir,
      projectRoot,
    );
    const targetDir = getSkillDirectoryPath(
      client,
      skillName,
      'project',
      homeDir,
      projectRoot,
    );

    try {
      // Check if skill already exists
      const exists = await this.filesystem.exists(targetPath);

      if (exists && !force) {
        // Skip if already exists and not forcing
        return {
          skill: skillName,
          client,
          targetPath,
          success: true,
          skipped: true,
        };
      }

      // Create target directory
      await this.filesystem.mkdir(targetDir, { recursive: true });

      // Copy SKILL.md file
      await this.copySkillFile(sourcePath, targetPath);

      return {
        skill: skillName,
        client,
        targetPath,
        success: true,
      };
    } catch (error) {
      return {
        skill: skillName,
        client,
        targetPath,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Copy skill file from source to target
   *
   * @param sourcePath - Source SKILL.md path
   * @param targetPath - Target SKILL.md path
   */
  private async copySkillFile(
    sourcePath: string,
    targetPath: string,
  ): Promise<void> {
    try {
      // Read source file
      const content = await this.filesystem.readFile(sourcePath);

      // Write to target
      await this.filesystem.writeFile(targetPath, content);
    } catch (error) {
      throw new OvertureError(
        `Failed to copy skill from ${sourcePath} to ${targetPath}: ${(error as Error).message}`,
        'SKILL_COPY_ERROR',
      );
    }
  }
}
