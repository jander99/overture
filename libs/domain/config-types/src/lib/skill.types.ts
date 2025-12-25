/**
 * Skill Domain Type Definitions
 *
 * Types for Agent Skills synchronization in Overture.
 * Skills are SKILL.md files that provide specialized instructions to AI coding assistants.
 *
 * @module @overture/config-types
 * @version 2.0
 */

import { ClientName } from './config.types.js';

/**
 * Discovered skill from the skills/ directory
 *
 * Represents a skill found in ~/.config/overture/skills/<name>/SKILL.md
 */
export interface DiscoveredSkill {
  /**
   * Skill name (directory name)
   * @example "debugging", "code-review"
   */
  name: string;

  /**
   * Full path to SKILL.md file
   * @example "/home/user/.config/overture/skills/debugging/SKILL.md"
   */
  path: string;

  /**
   * Description extracted from SKILL.md (first paragraph or frontmatter)
   * @example "Advanced debugging techniques for complex issues"
   */
  description?: string;
}

/**
 * Result of syncing a skill to a client
 */
export interface SkillSyncResult {
  /**
   * Skill name
   */
  skill: string;

  /**
   * Client name
   */
  client: ClientName;

  /**
   * Target path where skill was synced
   * @example "/home/user/.claude/skills/debugging/SKILL.md"
   */
  targetPath: string;

  /**
   * Whether sync succeeded
   */
  success: boolean;

  /**
   * Whether skill was skipped (already exists)
   */
  skipped?: boolean;

  /**
   * Error message if failed
   */
  error?: string;
}

/**
 * Summary of skill sync operation
 */
export interface SkillSyncSummary {
  /**
   * Total skills discovered
   */
  total: number;

  /**
   * Successfully synced
   */
  synced: number;

  /**
   * Skipped (already exists)
   */
  skipped: number;

  /**
   * Failed
   */
  failed: number;

  /**
   * Per-skill results
   */
  results: SkillSyncResult[];
}

/**
 * Options for skill discovery
 */
export interface SkillDiscoveryOptions {
  /**
   * Custom skills directory path
   * @default "~/.config/overture/skills/"
   */
  skillsDir?: string;
}

/**
 * Options for skill sync
 */
export interface SkillSyncOptions {
  /**
   * Force overwrite existing skills
   * @default false
   */
  force?: boolean;

  /**
   * Specific clients to sync to
   * @default undefined (all clients)
   */
  clients?: ClientName[];

  /**
   * Dry run mode (log but don't write)
   * @default false
   */
  dryRun?: boolean;
}

/**
 * Options for skill copy (to project)
 */
export interface SkillCopyOptions {
  /**
   * Force overwrite existing skills
   * @default false
   */
  force?: boolean;

  /**
   * Specific clients to copy for
   * @default undefined (all clients)
   */
  clients?: ClientName[];

  /**
   * Project root directory
   * @default process.cwd()
   */
  projectRoot?: string;
}
