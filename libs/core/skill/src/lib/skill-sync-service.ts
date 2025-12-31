/**
 * Skill Sync Service
 *
 * Syncs skills from the Overture config repo to client-specific
 * global skill directories (~/.claude/skills, ~/.github/skills, ~/.opencode/skill).
 *
 * This is a one-way sync: config repo → client dotfiles.
 *
 * @module lib/skill-sync-service
 * @version 1.0.0
 */

import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import type { OutputPort } from '@overture/ports-output';
import type {
  DiscoveredSkill,
  SkillSyncOptions,
  SkillSyncSummary,
  SkillSyncResult,
  ClientName,
} from '@overture/config-types';
import { getSkillDirectoryPath, getSkillPath } from '@overture/client-adapters';
import { OvertureError } from '@overture/errors';
import { SkillDiscovery } from './skill-discovery.js';

/**
 * All supported clients for skill sync
 */
const ALL_CLIENTS: ClientName[] = ['claude-code', 'copilot-cli', 'opencode'];

/**
 * Skill Sync Service
 *
 * Syncs Agent Skills from ~/.config/overture/skills/ to client-specific
 * global directories. Handles directory creation, file copying, and
 * skip/overwrite logic.
 *
 * @example
 * ```typescript
 * import { SkillSyncService, SkillDiscovery } from '@overture/skill';
 * import { NodeFilesystemAdapter, NodeEnvironmentAdapter } from '@overture/adapters-infrastructure';
 * import { ConsoleOutputAdapter } from '@overture/adapters-output';
 *
 * const filesystem = new NodeFilesystemAdapter();
 * const environment = new NodeEnvironmentAdapter();
 * const output = new ConsoleOutputAdapter();
 * const discovery = new SkillDiscovery(filesystem, environment);
 * const syncService = new SkillSyncService(filesystem, environment, discovery, output);
 *
 * // Sync all skills to all clients
 * const summary = await syncService.syncSkills();
 * console.log(`Synced ${summary.synced} skills`);
 *
 * // Sync with force overwrite
 * const summary = await syncService.syncSkills({ force: true });
 *
 * // Sync to specific clients only
 * const summary = await syncService.syncSkills({ clients: ['claude-code'] });
 * ```
 */
export class SkillSyncService {
  private readonly filesystem: FilesystemPort;
  private readonly environment: EnvironmentPort;
  private readonly skillDiscovery: SkillDiscovery;
  private readonly output: OutputPort;

  constructor(
    filesystem: FilesystemPort,
    environment: EnvironmentPort,
    skillDiscovery: SkillDiscovery,
    output: OutputPort,
  ) {
    this.filesystem = filesystem;
    this.environment = environment;
    this.skillDiscovery = skillDiscovery;
    this.output = output;
  }

  /**
   * Sync all skills to all clients
   *
   * Discovers all skills from the config repo and syncs them to each client's
   * global skill directory. Creates directories as needed and handles existing
   * skills based on the force option.
   *
   * @param options - Sync options (force, clients filter, dry run)
   * @returns Summary of sync operation
   *
   * @example
   * ```typescript
   * // Sync all skills to all clients
   * const summary = await syncService.syncSkills();
   *
   * // Force overwrite existing skills
   * const summary = await syncService.syncSkills({ force: true });
   *
   * // Sync only to Claude Code
   * const summary = await syncService.syncSkills({ clients: ['claude-code'] });
   *
   * // Dry run (log but don't write)
   * const summary = await syncService.syncSkills({ dryRun: true });
   * ```
   */
  async syncSkills(options: SkillSyncOptions = {}): Promise<SkillSyncSummary> {
    const { force = false, clients, dryRun = false } = options;

    // Discover all skills
    const skills = await this.skillDiscovery.discoverSkills();

    if (skills.length === 0) {
      return {
        total: 0,
        synced: 0,
        skipped: 0,
        failed: 0,
        results: [],
      };
    }

    // Sync each skill
    const allResults: SkillSyncResult[] = [];

    for (const skill of skills) {
      const skillResults = await this.syncSkill(skill, {
        force,
        clients,
        dryRun,
      });
      allResults.push(...skillResults);
    }

    // Calculate summary
    const summary: SkillSyncSummary = {
      total: skills.length,
      synced: allResults.filter((r) => r.success && !r.skipped).length,
      skipped: allResults.filter((r) => r.skipped).length,
      failed: allResults.filter((r) => !r.success).length,
      results: allResults,
    };

    return summary;
  }

  /**
   * Sync a single skill to all clients
   *
   * @param skill - Discovered skill to sync
   * @param options - Sync options
   * @returns Array of sync results (one per client)
   */
  async syncSkill(
    skill: DiscoveredSkill,
    options: SkillSyncOptions = {},
  ): Promise<SkillSyncResult[]> {
    const targetClients = options.clients || ALL_CLIENTS;
    const results: SkillSyncResult[] = [];

    for (const client of targetClients) {
      const result = await this.syncSkillToClient(skill, client, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Sync a skill to a specific client
   *
   * @param skill - Discovered skill to sync
   * @param client - Target client
   * @param options - Sync options
   * @returns Sync result for this client
   */
  private async syncSkillToClient(
    skill: DiscoveredSkill,
    client: ClientName,
    options: SkillSyncOptions = {},
  ): Promise<SkillSyncResult> {
    const { force = false, dryRun = false } = options;
    const homeDir = this.environment.homedir();

    // Get target path
    const targetPath = getSkillPath(client, skill.name, 'global', homeDir);
    const targetDir = getSkillDirectoryPath(
      client,
      skill.name,
      'global',
      homeDir,
    );

    try {
      // Check if skill already exists
      const exists = await this.skillExists(targetPath);

      if (exists && !force) {
        // Skip if already exists and not forcing
        return {
          skill: skill.name,
          client,
          targetPath,
          success: true,
          skipped: true,
        };
      }

      if (dryRun) {
        // Dry run - log what would happen
        if (exists) {
          this.output.info(`[DRY RUN] Would overwrite: ${targetPath}`);
        } else {
          this.output.info(`[DRY RUN] Would create: ${targetPath}`);
        }
        return {
          skill: skill.name,
          client,
          targetPath,
          success: true,
        };
      }

      // Copy entire skill directory (SKILL.md + references/, scripts/, assets/)
      await this.copySkillDirectory(skill.directoryPath, targetDir);

      return {
        skill: skill.name,
        client,
        targetPath,
        success: true,
      };
    } catch (error) {
      return {
        skill: skill.name,
        client,
        targetPath,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check if skill already exists at target
   *
   * @param targetPath - Path to check
   * @returns True if skill exists
   */
  private async skillExists(targetPath: string): Promise<boolean> {
    return this.filesystem.exists(targetPath);
  }

  /**
   * Recursively copy an entire skill directory
   *
   * @param sourceDir - Source skill directory path
   * @param targetDir - Target skill directory path
   */
  private async copySkillDirectory(
    sourceDir: string,
    targetDir: string,
  ): Promise<void> {
    try {
      // Create target directory
      await this.filesystem.mkdir(targetDir, { recursive: true });

      // Read source directory contents
      const entries = await this.filesystem.readdir(sourceDir);

      for (const entry of entries) {
        const sourcePath = `${sourceDir}/${entry}`;
        const targetPath = `${targetDir}/${entry}`;

        const stats = await this.filesystem.stat(sourcePath);

        if (stats.isDirectory()) {
          // Recursively copy subdirectory
          await this.copySkillDirectory(sourcePath, targetPath);
        } else {
          // Copy file
          const content = await this.filesystem.readFile(sourcePath);
          await this.filesystem.writeFile(targetPath, content);
        }
      }
    } catch (error) {
      throw new OvertureError(
        `Failed to copy skill directory from ${sourceDir} to ${targetDir}: ${(error as Error).message}`,
        'SKILL_COPY_ERROR',
      );
    }
  }
}
