/**
 * Test Constants
 *
 * Shared constants used across test files to reduce duplication.
 *
 * @module test-utils/test-constants
 */

/**
 * Common test file paths
 */
export const TEST_PATHS = {
  CLAUDE_CONFIG: '/home/user/.claude.json',
  PROJECT_MCP: '/home/user/project/.mcp.json',
  PROJECT_ROOT: '/home/user/project',
  USER_CONFIG: '/home/user/.config/overture.yml',
} as const;

/**
 * Common test platform values
 */
export const TEST_PLATFORMS = {
  LINUX: 'linux' as const,
  LINUX_NATIVE: 'linux-native' as const,
} as const;

/**
 * Common test client names
 */
export const TEST_CLIENTS = {
  CLAUDE_CODE: 'claude-code' as const,
} as const;

/**
 * All client names array for testing
 */
export const TEST_ALL_CLIENTS = [
  'claude-code',
  'copilot-cli',
  'opencode',
] as const;
