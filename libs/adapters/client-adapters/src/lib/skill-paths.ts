/**
 * Skill Path Resolution
 *
 * Provides per-client skill directory paths for Agent Skills synchronization.
 * Different AI clients store skills in different locations, and OpenCode uses
 * singular 'skill/' while others use plural 'skills/'.
 *
 * @module lib/skill-paths
 * @version 1.0.0
 */

import type { ClientName } from '@overture/config-types';

/**
 * Skill paths for a specific client
 */
export interface SkillPaths {
  /**
   * Global skill directory (user-level)
   * @example "~/.claude/skills" (Claude Code)
   * @example "~/.opencode/skill" (OpenCode - note singular)
   */
  global: string;

  /**
   * Project skill directory
   * @example ".claude/skills" (Claude Code)
   * @example ".opencode/skill" (OpenCode - note singular)
   */
  project: string;
}

/**
 * Get skill paths for a specific client
 *
 * Returns both global (user-level) and project-level skill directory paths
 * for the specified AI client.
 *
 * @param client - Client name
 * @param homeDir - User's home directory path
 * @param projectRoot - Optional project root directory (defaults to current directory for project paths)
 * @returns Skill paths for the client
 * @throws Error if client is unknown
 *
 * @example
 * ```typescript
 * // Get paths for Claude Code
 * const paths = getSkillPaths('claude-code', '/home/user');
 * // {
 * //   global: '/home/user/.claude/skills',
 * //   project: '.claude/skills'
 * // }
 *
 * // Get paths with project root
 * const paths = getSkillPaths('claude-code', '/home/user', '/home/user/my-project');
 * // {
 * //   global: '/home/user/.claude/skills',
 * //   project: '/home/user/my-project/.claude/skills'
 * // }
 * ```
 */
export function getSkillPaths(
  client: ClientName,
  homeDir: string,
  projectRoot?: string,
): SkillPaths {
  switch (client) {
    case 'claude-code':
      return {
        global: `${homeDir}/.claude/skills`,
        project: projectRoot
          ? `${projectRoot}/.claude/skills`
          : '.claude/skills',
      };

    case 'copilot-cli':
      return {
        global: `${homeDir}/.github/skills`,
        project: projectRoot
          ? `${projectRoot}/.github/skills`
          : '.github/skills',
      };

    case 'opencode':
      // Note: OpenCode uses singular 'skill/' not 'skills/'
      return {
        global: `${homeDir}/.opencode/skill`,
        project: projectRoot
          ? `${projectRoot}/.opencode/skill`
          : '.opencode/skill',
      };

    default:
      throw new Error(`Unknown client: ${client satisfies never}`);
  }
}

/**
 * Get full path to a specific skill for a client
 *
 * Returns the complete file path to a skill's SKILL.md file for a specific
 * client and scope (global or project).
 *
 * @param client - Client name
 * @param skillName - Skill name (directory name)
 * @param scope - 'global' for user-level, 'project' for project-level
 * @param homeDir - User's home directory path
 * @param projectRoot - Optional project root directory
 * @returns Full path to SKILL.md file
 * @throws Error if client is unknown
 *
 * @example
 * ```typescript
 * // Get global skill path for Claude Code
 * const path = getSkillPath('claude-code', 'debugging', 'global', '/home/user');
 * // '/home/user/.claude/skills/debugging/SKILL.md'
 *
 * // Get project skill path
 * const path = getSkillPath('claude-code', 'debugging', 'project', '/home/user', '/home/user/my-project');
 * // '/home/user/my-project/.claude/skills/debugging/SKILL.md'
 * ```
 */
export function getSkillPath(
  client: ClientName,
  skillName: string,
  scope: 'global' | 'project',
  homeDir: string,
  projectRoot?: string,
): string {
  const paths = getSkillPaths(client, homeDir, projectRoot);
  const base = scope === 'global' ? paths.global : paths.project;
  return `${base}/${skillName}/SKILL.md`;
}

/**
 * Get skill directory path (without SKILL.md filename)
 *
 * Returns the directory path where a skill should be stored, without
 * the SKILL.md filename.
 *
 * @param client - Client name
 * @param skillName - Skill name (directory name)
 * @param scope - 'global' for user-level, 'project' for project-level
 * @param homeDir - User's home directory path
 * @param projectRoot - Optional project root directory
 * @returns Path to skill directory
 * @throws Error if client is unknown
 *
 * @example
 * ```typescript
 * const dir = getSkillDirectoryPath('claude-code', 'debugging', 'global', '/home/user');
 * // '/home/user/.claude/skills/debugging'
 * ```
 */
export function getSkillDirectoryPath(
  client: ClientName,
  skillName: string,
  scope: 'global' | 'project',
  homeDir: string,
  projectRoot?: string,
): string {
  const paths = getSkillPaths(client, homeDir, projectRoot);
  const base = scope === 'global' ? paths.global : paths.project;
  return `${base}/${skillName}`;
}
