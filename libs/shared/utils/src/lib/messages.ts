/**
 * User-facing message constants
 *
 * Central location for all user-facing messages that are displayed in output,
 * error messages, and help text. This prevents duplication and ensures consistency.
 *
 * @module lib/messages
 */

/**
 * Common file path references used in help text and messages
 */
export const PROJECT_CONFIG_FILE_PATH = '.overture/config.yaml';
export const PROJECT_CONFIG_DIR = '.overture';
export const PROJECT_CONFIG_FILE_LEGACY = '.overture/config.yml';

/**
 * Common message fragments
 */
export const MSG_EDIT_CONFIG = `Edit ${PROJECT_CONFIG_FILE_PATH}`;
export const MSG_RUN_INIT = 'Run `overture init` to create project configuration';
export const MSG_RUN_VALIDATE = 'Run `overture validate` to verify';
export const MSG_CHECK_CONFIG_SYNTAX = 'Check YAML syntax at https://www.yamllint.com/';
export const MSG_LIST_MCPS = 'List available MCPs: `overture mcp list`';

/**
 * Common error message patterns
 */
export const ERROR_CONFIG_MISSING = `${MSG_RUN_INIT} at ${PROJECT_CONFIG_FILE_PATH}\nFor global config, use \`overture user init\``;
export const ERROR_CONFIG_SYNTAX = `${MSG_CHECK_CONFIG_SYNTAX}`;
export const ERROR_MCP_NOT_FOUND = `MCP server not found in configuration:\n  1. ${MSG_LIST_MCPS}\n  2. Check spelling\n  3. Add to ${PROJECT_CONFIG_FILE_PATH} if missing`;
