/**
 * Environment Variable Security Validator
 *
 * Detects when actual credentials are hardcoded in MCP configuration
 * instead of using variable references like ${GITHUB_TOKEN}.
 *
 * This validator helps prevent security issues where sensitive tokens
 * might be accidentally committed to version control.
 *
 * @module lib/validators/env-var-validator
 */

import type { OvertureConfig } from '@overture/config-types';

/**
 * Validation result containing status and any detected issues
 */
export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Pattern matchers for common credential formats
 */
const TOKEN_PATTERNS = {
  // GitHub Personal Access Tokens (classic and fine-grained)
  // ghp_ (classic), ghs_ (fine-grained), followed by 20+ alphanumeric chars
  githubToken: /^gh[ps]_[a-zA-Z0-9]{20,}/,

  // PostgreSQL connection strings
  postgresConnection: /^postgres:\/\//,

  // MySQL connection strings
  mysqlConnection: /^mysql:\/\//,

  // MongoDB connection strings
  mongoConnection: /^mongodb(\+srv)?:\/\//,

  // Generic Bearer tokens
  bearerToken: /^Bearer\s+/i,

  // AWS-style access keys
  awsAccessKey: /^AKIA[0-9A-Z]{16}$/,

  // Base64-encoded secrets (longer than 20 chars)
  base64Secret: /^[A-Za-z0-9+/]{20,}={0,2}$/,
};

/**
 * Validate that environment variables use references instead of hardcoded values
 *
 * @param config - Overture configuration to validate
 * @returns Validation result with any detected issues
 *
 * @example
 * ```typescript
 * const config = {
 *   mcp: {
 *     github: {
 *       command: 'npx',
 *       args: [],
 *       env: { GITHUB_TOKEN: 'ghp_1234567890abcdefghijklmnopqrstuv' }
 *     }
 *   }
 * };
 *
 * const result = validateEnvVarReferences(config);
 * // result.valid === false
 * // result.issues[0] === "WARNING: MCP 'github' env.GITHUB_TOKEN appears to contain..."
 * ```
 */
export function validateEnvVarReferences(
  config: OvertureConfig,
): ValidationResult {
  const issues: string[] = [];

  // Iterate through all MCP server configurations
  for (const [mcpName, mcpConfig] of Object.entries(config.mcp || {})) {
    if (!mcpConfig.env) {
      continue;
    }

    // Check each environment variable in this MCP's configuration
    for (const [key, value] of Object.entries(mcpConfig.env)) {
      // Skip empty values
      if (!value || typeof value !== 'string') {
        continue;
      }

      // Check if value is a variable reference (correct format)
      const isVariableReference = value.startsWith('${') && value.endsWith('}');

      if (isVariableReference) {
        // Valid variable reference - skip
        continue;
      }

      // Check if the value matches any known credential patterns
      let matchedPattern: string | null = null;

      for (const [patternName, pattern] of Object.entries(TOKEN_PATTERNS)) {
        if (pattern.test(value)) {
          matchedPattern = patternName;
          break;
        }
      }

      if (matchedPattern) {
        issues.push(
          `WARNING: MCP "${mcpName}" env.${key} appears to contain an actual ` +
            `credential (detected: ${matchedPattern}). ` +
            `Use variable reference format instead: \${${key}}`,
        );
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Get a user-friendly suggestion for fixing detected issues
 *
 * @param issues - Array of detected issues
 * @returns Formatted suggestion text
 */
export function getFixSuggestion(issues: string[]): string {
  if (issues.length === 0) {
    return '';
  }

  return (
    '\n' +
    '💡 How to fix:\n' +
    '  1. Replace hardcoded credentials with variable references: ${VAR_NAME}\n' +
    '  2. Set the actual values in your shell environment:\n' +
    '     export GITHUB_TOKEN="ghp_your_token_here"\n' +
    '  3. The MCP server will automatically expand ${GITHUB_TOKEN} at runtime\n' +
    '\n' +
    'This keeps sensitive values out of version control and config files.'
  );
}
