/**
 * Skill Discovery Service
 *
 * Scans the skills/ directory in the Overture config repo
 * (~/.config/overture/skills/) and returns a list of discovered skills.
 *
 * Skills are directories containing a SKILL.md file that provides
 * specialized instructions to AI coding assistants.
 *
 * @module lib/skill-discovery
 * @version 1.0.0
 */

import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import type {
  DiscoveredSkill,
  SkillDiscoveryOptions,
} from '@overture/config-types';
import { OvertureError } from '@overture/errors';

/**
 * Skill Discovery Service
 *
 * Discovers Agent Skills from the Overture config directory.
 * Skills are automatically discovered from ~/.config/overture/skills/<name>/SKILL.md
 *
 * @example
 * ```typescript
 * import { SkillDiscovery } from '@overture/skill';
 * import { NodeFilesystemAdapter, NodeEnvironmentAdapter } from '@overture/adapters-infrastructure';
 *
 * const filesystem = new NodeFilesystemAdapter();
 * const environment = new NodeEnvironmentAdapter();
 * const discovery = new SkillDiscovery(filesystem, environment);
 *
 * // Discover all skills
 * const skills = await discovery.discoverSkills();
 * // [
 * //   { name: 'debugging', path: '~/.config/overture/skills/debugging/SKILL.md', description: '...' },
 * //   { name: 'code-review', path: '~/.config/overture/skills/code-review/SKILL.md', description: '...' }
 * // ]
 *
 * // Get specific skill
 * const skill = await discovery.getSkill('debugging');
 * ```
 */
export class SkillDiscovery {
  private readonly filesystem: FilesystemPort;
  private readonly environment: EnvironmentPort;

  constructor(filesystem: FilesystemPort, environment: EnvironmentPort) {
    this.filesystem = filesystem;
    this.environment = environment;
  }

  /**
   * Discover all skills in the config repo
   *
   * Scans ~/.config/overture/skills/ for directories containing SKILL.md files.
   * Returns an empty array if the skills directory doesn't exist.
   *
   * @param options - Discovery options (custom skills directory)
   * @returns Array of discovered skills
   *
   * @example
   * ```typescript
   * // Discover all skills
   * const skills = await discovery.discoverSkills();
   *
   * // Use custom skills directory
   * const skills = await discovery.discoverSkills({
   *   skillsDir: '/custom/path/skills'
   * });
   * ```
   */
  async discoverSkills(
    options: SkillDiscoveryOptions = {},
  ): Promise<DiscoveredSkill[]> {
    const skillsDir = options.skillsDir || this.getDefaultSkillsDirectoryPath();

    // Check if skills directory exists
    const exists = await this.hasSkillsDirectory(options);
    if (!exists) {
      return [];
    }

    try {
      // Read directory contents
      const entries = await this.filesystem.readdir(skillsDir);

      // Process each entry
      const skills: DiscoveredSkill[] = [];

      for (const entry of entries) {
        const entryPath = `${skillsDir}/${entry}`;

        // Check if entry is a directory
        const stats = await this.filesystem.stat(entryPath);
        if (!stats.isDirectory()) {
          continue;
        }

        // Check if SKILL.md exists in directory
        const skillPath = `${entryPath}/SKILL.md`;
        const skillExists = await this.filesystem.exists(skillPath);

        if (skillExists) {
          // Read SKILL.md and extract description
          const content = await this.filesystem.readFile(skillPath);
          const description = this.extractDescription(content);

          skills.push({
            name: entry,
            path: skillPath,
            directoryPath: entryPath,
            description,
          });
        }
      }

      return skills;
    } catch (error) {
      throw new OvertureError(
        `Failed to discover skills from ${skillsDir}: ${(error as Error).message}`,
        'SKILL_DISCOVERY_ERROR',
      );
    }
  }

  /**
   * Get a specific skill by name
   *
   * @param name - Skill name (directory name)
   * @param options - Discovery options
   * @returns Skill if found, null otherwise
   *
   * @example
   * ```typescript
   * const skill = await discovery.getSkill('debugging');
   * if (skill) {
   *   console.log(skill.description);
   * }
   * ```
   */
  async getSkill(
    name: string,
    options: SkillDiscoveryOptions = {},
  ): Promise<DiscoveredSkill | null> {
    const skillsDir = options.skillsDir || this.getDefaultSkillsDirectoryPath();
    const skillDirectoryPath = `${skillsDir}/${name}`;
    const skillPath = `${skillDirectoryPath}/SKILL.md`;

    const exists = await this.filesystem.exists(skillPath);
    if (!exists) {
      return null;
    }

    try {
      const content = await this.filesystem.readFile(skillPath);
      const description = this.extractDescription(content);

      return {
        name,
        path: skillPath,
        directoryPath: skillDirectoryPath,
        description,
      };
    } catch (error) {
      throw new OvertureError(
        `Failed to read skill '${name}': ${(error as Error).message}`,
        'SKILL_READ_ERROR',
      );
    }
  }

  /**
   * Check if skills directory exists
   *
   * @param options - Discovery options
   * @returns True if skills directory exists
   */
  async hasSkillsDirectory(
    options: SkillDiscoveryOptions = {},
  ): Promise<boolean> {
    const skillsDir = options.skillsDir || this.getDefaultSkillsDirectoryPath();
    return this.filesystem.exists(skillsDir);
  }

  /**
   * Get the default skills directory path
   *
   * @returns Path to ~/.config/overture/skills/
   */
  getDefaultSkillsDirectoryPath(): string {
    return this.getSkillsDirectoryPath();
  }

  /**
   * Get skills directory path
   *
   * @returns Absolute path to skills directory
   */
  getSkillsDirectoryPath(): string {
    const homeDir = this.environment.homedir();
    return `${homeDir}/.config/overture/skills`;
  }

  /**
   * Extract description from SKILL.md content
   *
   * Tries frontmatter first, then first paragraph.
   * Frontmatter format:
   * ---
   * description: "..."
   * ---
   *
   * @param content - SKILL.md file content
   * @returns Description or undefined
   */
  private extractDescription(content: string): string | undefined {
    // Try frontmatter first
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/m);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const descMatch = frontmatter.match(
        /description:\s*["']?([^"'\n]+)["']?/,
      );
      if (descMatch) {
        return descMatch[1].trim();
      }
    }

    // Try first paragraph (after any frontmatter and headings)
    const withoutFrontmatter = content.replace(
      /^---\s*\n[\s\S]*?\n---\s*\n/m,
      '',
    );
    const withoutHeadings = withoutFrontmatter.replace(/^#.*$/gm, '');
    const paragraphs = withoutHeadings
      .split('\n\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length > 0) {
      // Take first paragraph, remove newlines, limit length
      const firstPara = paragraphs[0].replace(/\n/g, ' ').trim();
      return firstPara.length > 200
        ? firstPara.substring(0, 197) + '...'
        : firstPara;
    }

    return undefined;
  }
}
