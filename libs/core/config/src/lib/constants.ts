/**
 * Configuration constants
 *
 * Central location for all configuration-related constants used throughout Overture.
 *
 * @module lib/constants
 */

/**
 * Overture configuration directory name
 */
export const OVERTURE_DIR = '.overture';

/**
 * Configuration file name (project-level)
 */
export const CONFIG_FILE = 'config.yaml';

/**
 * Full path to project configuration file (relative)
 */
export const CONFIG_PATH = `${OVERTURE_DIR}/${CONFIG_FILE}`;

/**
 * Generated MCP JSON file name
 */
export const MCP_JSON_FILE = '.mcp.json';

/**
 * Generated CLAUDE.md file name
 */
export const CLAUDE_MD_FILE = 'CLAUDE.md';

/**
 * Default configuration version
 */
export const DEFAULT_CONFIG_VERSION = '1.0';

/**
 * Supported project types
 */
export const PROJECT_TYPES = [
  'python-backend',
  'typescript-frontend',
  'node-backend',
  'fullstack',
  'data-science',
  'kubernetes',
] as const;

/**
 * CLAUDE.md managed section markers (follows Nx MCP pattern)
 *
 * These markers define the section of CLAUDE.md that Overture manages.
 * Content between these markers is regenerated on sync.
 * Content outside these markers is preserved.
 */
export const CLAUDE_MD_START_MARKER = '<!-- overture configuration start-->';
export const CLAUDE_MD_END_MARKER = '<!-- overture configuration end-->';
export const CLAUDE_MD_USER_INSTRUCTION =
  '<!-- Leave the start & end comments to automatically receive updates. -->';
