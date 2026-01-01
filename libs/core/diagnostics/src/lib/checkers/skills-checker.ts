/**
 * SkillsChecker - Counts skills in skills directory
 *
 * Responsibilities:
 * - Count valid skills (directories with SKILL.md file)
 *
 * Never throws errors - always returns a count.
 */

import type { FilesystemPort } from '@overture/ports-filesystem';

export class SkillsChecker {
  constructor(private readonly filesystem: FilesystemPort) {}

  /**
   * Count skills in skills directory
   */
  async countSkills(
    skillsPath: string,
    skillsDirExists: boolean,
  ): Promise<number> {
    let skillCount = 0;

    if (!skillsDirExists) {
      return skillCount;
    }

    try {
      const entries = await this.filesystem.readdir(skillsPath);
      for (const entry of entries) {
        try {
          const entryPath = `${skillsPath}/${entry}`;
          const stats = await this.filesystem.stat(entryPath);
          if (stats.isDirectory()) {
            const skillFile = `${entryPath}/SKILL.md`;
            const hasSkillFile = await this.filesystem.exists(skillFile);
            if (hasSkillFile) {
              skillCount++;
            }
          }
        } catch {
          // Ignore errors for individual entries and continue
        }
      }
    } catch {
      // Ignore errors - return 0
    }

    return skillCount;
  }
}
