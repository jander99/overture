/**
 * Environment Variable Expansion Utilities
 *
 * Provides functions to expand environment variables in configuration strings.
 * Supports standard ${VAR} syntax and ${VAR:-default} for default values.
 *
 * @module @overture/sync-core/env-expander
 * @version 3.0
 */

import { ConfigError } from '@overture/errors';

/**
 * Expand environment variables in a string
 *
 * Supports two syntaxes:
 * - ${VAR} - Standard variable expansion
 * - ${VAR:-default} - Variable with default value
 *
 * @param input - String potentially containing environment variables
 * @param env - Environment object (defaults to process.env)
 * @returns String with all environment variables expanded
 *
 * @example
 * ```typescript
 * expandEnvVars('${HOME}/.config')
 * // Returns: '/home/user/.config'
 *
 * expandEnvVars('${MISSING:-/default/path}')
 * // Returns: '/default/path'
 *
 * expandEnvVars('${GITHUB_TOKEN}')
 * // Returns: 'ghp_xxx...' (if GITHUB_TOKEN is set)
 * // Returns: '' (if GITHUB_TOKEN is not set)
 * ```
 */
export function expandEnvVars(input: string, env: Record<string, string | undefined> = process.env): string {
  // Pattern: ${VAR} or ${VAR:-default}
  const pattern = /\$\{([A-Z_][A-Z0-9_]*)(?::-([^}]+))?\}/g;

  return input.replace(pattern, (match, varName, defaultValue) => {
    const value = env[varName];

    if (value !== undefined) {
      return value;
    }

    if (defaultValue !== undefined) {
      return defaultValue;
    }

    // Variable not set and no default - return empty string
    return '';
  });
}

/**
 * Recursively expand environment variables until no more expansions are possible
 *
 * Handles cases where environment variables reference other environment variables.
 * Includes cycle detection to prevent infinite loops.
 *
 * @param input - String potentially containing nested environment variables
 * @param env - Environment object (defaults to process.env)
 * @param maxDepth - Maximum recursion depth (default: 10)
 * @returns String with all environment variables recursively expanded
 * @throws Error if circular reference detected
 *
 * @example
 * ```typescript
 * // With env: { BASE: '/home/user', CONFIG: '${BASE}/.config' }
 * expandEnvVarsRecursive('${CONFIG}/overture.yml')
 * // Returns: '/home/user/.config/overture.yml'
 * ```
 */
export function expandEnvVarsRecursive(
  input: string,
  env: Record<string, string | undefined> = process.env,
  maxDepth = 10
): string {
  let result = input;
  let previousResult = '';
  let depth = 0;

  while (result !== previousResult && depth < maxDepth) {
    previousResult = result;
    result = expandEnvVars(result, env);
    depth++;
  }

  if (depth >= maxDepth && result !== previousResult) {
    throw new ConfigError(`Circular environment variable reference detected in: ${input}`);
  }

  return result;
}

/**
 * Expand environment variables in an object's string values
 *
 * Recursively expands env vars in all string values of an object.
 * Non-string values are left unchanged.
 *
 * @param obj - Object with string values potentially containing environment variables
 * @param env - Environment object (defaults to process.env)
 * @returns New object with all string values expanded
 *
 * @example
 * ```typescript
 * expandEnvVarsInObject({
 *   GITHUB_TOKEN: '${GITHUB_TOKEN}',
 *   DEBUG: 'true',
 *   HOME: '${HOME}'
 * })
 * // Returns: {
 * //   GITHUB_TOKEN: 'ghp_xxx...',
 * //   DEBUG: 'true',
 * //   HOME: '/home/user'
 * // }
 * ```
 */
export function expandEnvVarsInObject<T extends Record<string, unknown>>(
  obj: T,
  env: Record<string, string | undefined> = process.env
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = expandEnvVars(value, env);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = expandEnvVarsInObject(value as Record<string, unknown>, env);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Check if a string contains environment variable references
 *
 * @param input - String to check
 * @returns True if string contains ${VAR} or ${VAR:-default} patterns
 *
 * @example
 * ```typescript
 * hasEnvVars('${HOME}/.config')  // true
 * hasEnvVars('/home/user/.config')  // false
 * hasEnvVars('${TOKEN:-default}')  // true
 * ```
 */
export function hasEnvVars(input: string): boolean {
  const pattern = /\$\{[A-Z_][A-Z0-9_]*(?::-[^}]+)?\}/;
  return pattern.test(input);
}

/**
 * Extract all environment variable names referenced in a string
 *
 * @param input - String potentially containing environment variables
 * @returns Array of variable names (without ${} syntax)
 *
 * @example
 * ```typescript
 * extractEnvVarNames('${HOME}/.config/${USER}')
 * // Returns: ['HOME', 'USER']
 *
 * extractEnvVarNames('${TOKEN:-default}')
 * // Returns: ['TOKEN']
 * ```
 */
export function extractEnvVarNames(input: string): string[] {
  const pattern = /\$\{([A-Z_][A-Z0-9_]*)(?::-[^}]+)?\}/g;
  const matches = [...input.matchAll(pattern)];
  return matches.map((match) => match[1]);
}

/**
 * Validate that all required environment variables are set
 *
 * @param input - String containing environment variable references
 * @param env - Environment object (defaults to process.env)
 * @returns Object with validation result and missing variables
 *
 * @example
 * ```typescript
 * validateEnvVars('${HOME}/.config/${MISSING}')
 * // Returns: {
 * //   valid: false,
 * //   missing: ['MISSING']
 * // }
 * ```
 */
export function validateEnvVars(
  input: string,
  env: Record<string, string | undefined> = process.env
): { valid: boolean; missing: string[] } {
  const varNames = extractEnvVarNames(input);
  const missing: string[] = [];

  // Pattern to check for default values
  const defaultPattern = /\$\{([A-Z_][A-Z0-9_]*):-[^}]+\}/g;
  const varsWithDefaults = new Set([...input.matchAll(defaultPattern)].map((match) => match[1]));

  for (const varName of varNames) {
    // Skip validation if variable has default value
    if (varsWithDefaults.has(varName)) {
      continue;
    }

    if (env[varName] === undefined) {
      missing.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Expand environment variables in command arguments array
 *
 * Convenience function for expanding env vars in command args.
 *
 * @param args - Array of command arguments
 * @param env - Environment object (defaults to process.env)
 * @returns New array with all environment variables expanded
 *
 * @example
 * ```typescript
 * expandEnvVarsInArgs(['--token', '${GITHUB_TOKEN}', '--user', '${USER}'])
 * // Returns: ['--token', 'ghp_xxx...', '--user', 'username']
 * ```
 */
export function expandEnvVarsInArgs(
  args: string[],
  env: Record<string, string | undefined> = process.env
): string[] {
  return args.map((arg) => expandEnvVars(arg, env));
}
