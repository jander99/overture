/**
 * Environment Variable Validation Service
 *
 * Validates environment variable references in MCP configurations.
 * Ensures ${VAR} syntax is correct and that referenced variables exist
 * when needed for pre-expansion.
 *
 * @module @overture/sync-core/environment-validator
 * @version 1.0
 */

import type { OvertureConfig } from '@overture/config-types';
import type { ClientAdapter } from '@overture/client-adapters';

/**
 * Environment variable syntax pattern
 * Matches: ${VAR_NAME} or ${VAR_NAME:-default_value}
 * More permissive to catch invalid syntax for better error messages
 */
const ENV_VAR_PATTERN = /\$\{([^}]+)\}/g;

/**
 * Valid environment variable name pattern
 * Must start with uppercase letter or underscore, contain only uppercase, numbers, underscores
 * Fixed: Use alternation instead of optional non-greedy group to prevent ReDoS
 * Changed from (?::-(.*?))? to (?::-(.*)|) to avoid nested quantifiers
 */
const VALID_VAR_NAME_PATTERN = /^([A-Z_][A-Z0-9_]*)(?::-(.*)|)$/;

/**
 * Environment variable validation result
 */
export interface EnvVarValidation {
  mcpName: string;
  envKey: string;
  envValue: string;
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Environment variable validation error
 */
export interface EnvVarError {
  mcpName: string;
  envKey: string;
  message: string;
  suggestion?: string;
}

/**
 * Environment variable validation warning
 */
export interface EnvVarWarning {
  mcpName: string;
  envKey: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Environment variable validation summary
 */
export interface EnvVarValidationSummary {
  total: number;
  valid: number;
  errors: EnvVarError[];
  warnings: EnvVarWarning[];
}

/**
 * Extract environment variable names from a value string
 *
 * @param value - String that may contain ${VAR} references
 * @returns Array of variable names and their defaults
 *
 * @example
 * ```typescript
 * extractEnvVars('${TOKEN}')
 * // => [{ name: 'TOKEN', hasDefault: false, defaultValue: undefined }]
 *
 * extractEnvVars('${API_URL:-https://api.example.com}')
 * // => [{ name: 'API_URL', hasDefault: true, defaultValue: 'https://api.example.com' }]
 * ```
 */
export function extractEnvVars(value: string): Array<{
  name: string;
  hasDefault: boolean;
  defaultValue?: string;
}> {
  const vars: Array<{
    name: string;
    hasDefault: boolean;
    defaultValue?: string;
  }> = [];
  const matches = value.matchAll(ENV_VAR_PATTERN);

  for (const match of matches) {
    const content = match[1]; // Everything between ${ and }

    // Parse variable name and optional default value
    const validMatch = content.match(VALID_VAR_NAME_PATTERN);
    if (validMatch) {
      vars.push({
        name: validMatch[1],
        hasDefault: validMatch[2] !== undefined,
        defaultValue: validMatch[2],
      });
    } else {
      // Invalid syntax - still extract for error reporting
      // Split on :- if present
      const parts = content.split(':-');
      vars.push({
        name: parts[0],
        hasDefault: parts.length > 1,
        defaultValue: parts[1],
      });
    }
  }

  return vars;
}

/**
 * Validate environment variable syntax
 *
 * @param value - String to validate
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * validateEnvVarSyntax('${API_TOKEN}')
 * // => { valid: true }
 *
 * validateEnvVarSyntax('${123_INVALID}')
 * // => { valid: false, error: 'Variable names must start with a letter or underscore' }
 * ```
 */
export function validateEnvVarSyntax(value: string): {
  valid: boolean;
  error?: string;
} {
  // Check for unclosed ${
  const openCount = (value.match(/\$\{/g) || []).length;
  const closeCount = (value.match(/\}/g) || []).length;

  if (openCount > closeCount) {
    return {
      valid: false,
      error:
        'Unclosed ${. Expected format: ${VAR_NAME} or ${VAR_NAME:-default}',
    };
  }

  // Extract and validate each variable reference
  const matches = value.matchAll(ENV_VAR_PATTERN);

  for (const match of matches) {
    const content = match[1]; // Everything between ${ and }

    // Check if it matches valid pattern
    if (!VALID_VAR_NAME_PATTERN.test(content)) {
      // Determine what's wrong
      const varName = content.split(':-')[0]; // Get the variable name part

      // Both conditions have same error message, so combine them
      if (!/^[A-Z_]/.test(varName) || !/^[A-Z_][A-Z0-9_]*$/.test(varName)) {
        return {
          valid: false,
          error: `Invalid variable name "${varName}". Must start with uppercase letter or underscore, contain only uppercase letters, numbers, and underscores.`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Check if environment variable value is hardcoded (contains no ${VAR} references)
 *
 * @param value - Environment variable value
 * @returns True if value is hardcoded
 */
export function isHardcodedValue(value: string): boolean {
  return !value.includes('${');
}

/**
 * Validate environment variables for a single MCP
 *
 * @param mcpName - Name of the MCP
 * @param env - Environment variables object
 * @param client - Client adapter (to check if env var expansion needed)
 * @param processEnv - Process environment variables (to check if vars exist)
 * @returns Validation result
 */
/**
 * Check a single env var value for validation issues
 */
function validateSingleEnvVar(
  mcpName: string,
  key: string,
  value: string,
  client: ClientAdapter,
  processEnv: NodeJS.ProcessEnv,
): EnvVarValidation | null {
  // Check syntax first
  const syntaxCheck = validateEnvVarSyntax(value);
  if (!syntaxCheck.valid) {
    return {
      mcpName,
      envKey: key,
      envValue: value,
      valid: false,
      error: syntaxCheck.error,
    };
  }

  // Check for hardcoded values
  if (isHardcodedValue(value) && value.length > 50) {
    return {
      mcpName,
      envKey: key,
      envValue: value,
      valid: true,
      warning: `Hardcoded value (${value.length} chars). Consider using environment variable to avoid exposing secrets in config files.`,
    };
  }

  // Check that referenced vars exist if client needs expansion
  if (client.needsEnvVarExpansion()) {
    const vars = extractEnvVars(value);
    for (const varRef of vars) {
      if (!varRef.hasDefault && !(varRef.name in processEnv)) {
        return {
          mcpName,
          envKey: key,
          envValue: value,
          valid: false,
          error: `Referenced environment variable ${varRef.name} is not defined. Client "${client.name}" requires env vars to be pre-expanded.`,
        };
      }
    }
  }

  // All checks passed
  return {
    mcpName,
    envKey: key,
    envValue: value,
    valid: true,
  };
}

export function validateMcpEnvVars(
  mcpName: string,
  env: Record<string, string> | undefined,
  client: ClientAdapter,
  processEnv: NodeJS.ProcessEnv = process.env,
): EnvVarValidation[] {
  if (!env) {
    return [];
  }

  const results: EnvVarValidation[] = [];
  for (const [key, value] of Object.entries(env)) {
    const result = validateSingleEnvVar(
      mcpName,
      key,
      value,
      client,
      processEnv,
    );
    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Get environment variable errors for all MCPs
 *
 * @param config - Overture configuration
 * @param client - Client adapter
 * @param processEnv - Process environment variables
 * @returns Array of errors
 */
/**
 * Extract errors from validation results
 */
function extractErrors(
  results: EnvVarValidation[],
  mcpNamePrefix: string,
): EnvVarError[] {
  const errors: EnvVarError[] = [];
  for (const result of results) {
    if (!result.valid && result.error) {
      errors.push({
        mcpName: mcpNamePrefix,
        envKey: result.envKey,
        message: result.error,
        suggestion: getSuggestion(result.error),
      });
    }
  }
  return errors;
}

export function getEnvVarErrors(
  config: OvertureConfig,
  client: ClientAdapter,
  processEnv: NodeJS.ProcessEnv = process.env,
): EnvVarError[] {
  const errors: EnvVarError[] = [];

  for (const [mcpName, mcpConfig] of Object.entries(config.mcp)) {
    // Validate base env vars
    const baseResults = validateMcpEnvVars(
      mcpName,
      mcpConfig.env,
      client,
      processEnv,
    );
    errors.push(...extractErrors(baseResults, mcpName));

    // Validate env vars in client overrides
    if (mcpConfig.clients?.overrides) {
      for (const [clientName, override] of Object.entries(
        mcpConfig.clients.overrides,
      )) {
        if (override.env) {
          const overrideResults = validateMcpEnvVars(
            `${mcpName} (${clientName} override)`,
            override.env,
            client,
            processEnv,
          );
          errors.push(
            ...extractErrors(
              overrideResults,
              `${mcpName} (client override: ${clientName})`,
            ),
          );
        }
      }
    }
  }

  return errors;
}

/**
 * Get environment variable warnings for all MCPs
 *
 * @param config - Overture configuration
 * @param client - Client adapter
 * @param processEnv - Process environment variables
 * @returns Array of warnings
 */
/**
 * Extract warnings from validation results
 */
function extractWarnings(
  results: EnvVarValidation[],
  mcpNamePrefix: string,
): EnvVarWarning[] {
  const warnings: EnvVarWarning[] = [];
  for (const result of results) {
    if (result.warning) {
      warnings.push({
        mcpName: mcpNamePrefix,
        envKey: result.envKey,
        message: result.warning,
        severity: getSeverity(result.warning),
      });
    }
  }
  return warnings;
}

export function getEnvVarWarnings(
  config: OvertureConfig,
  client: ClientAdapter,
  processEnv: NodeJS.ProcessEnv = process.env,
): EnvVarWarning[] {
  const warnings: EnvVarWarning[] = [];

  for (const [mcpName, mcpConfig] of Object.entries(config.mcp)) {
    // Validate base env vars
    const baseResults = validateMcpEnvVars(
      mcpName,
      mcpConfig.env,
      client,
      processEnv,
    );
    warnings.push(...extractWarnings(baseResults, mcpName));

    // Validate env vars in client overrides
    if (mcpConfig.clients?.overrides) {
      for (const [clientName, override] of Object.entries(
        mcpConfig.clients.overrides,
      )) {
        if (override.env) {
          const overrideResults = validateMcpEnvVars(
            `${mcpName} (${clientName} override)`,
            override.env,
            client,
            processEnv,
          );
          warnings.push(
            ...extractWarnings(
              overrideResults,
              `${mcpName} (client override: ${clientName})`,
            ),
          );
        }
      }
    }
  }

  return warnings;
}

/**
 * Get complete validation summary
 *
 * @param config - Overture configuration
 * @param client - Client adapter
 * @param processEnv - Process environment variables
 * @returns Validation summary
 */
export function getEnvVarValidationSummary(
  config: OvertureConfig,
  client: ClientAdapter,
  processEnv: NodeJS.ProcessEnv = process.env,
): EnvVarValidationSummary {
  const errors = getEnvVarErrors(config, client, processEnv);
  const warnings = getEnvVarWarnings(config, client, processEnv);

  // Count total env vars
  let total = 0;
  for (const mcpConfig of Object.values(config.mcp)) {
    if (mcpConfig.env) {
      total += Object.keys(mcpConfig.env).length;
    }
    if (mcpConfig.clients?.overrides) {
      for (const override of Object.values(mcpConfig.clients.overrides)) {
        if (override.env) {
          total += Object.keys(override.env).length;
        }
      }
    }
  }

  return {
    total,
    valid: total - errors.length,
    errors,
    warnings,
  };
}

/**
 * Format environment variable errors as human-readable text
 *
 * @param errors - Environment variable errors
 * @returns Formatted error text
 */
export function formatEnvVarErrors(errors: EnvVarError[]): string {
  if (errors.length === 0) {
    return 'No environment variable errors detected.';
  }

  const lines: string[] = [`Environment Variable Errors (${errors.length}):\n`];

  for (const error of errors) {
    lines.push(`  ✗ ${error.mcpName} → ${error.envKey}`);
    lines.push(`    ${error.message}`);
    if (error.suggestion) {
      lines.push(`    💡 ${error.suggestion}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format environment variable warnings as human-readable text
 *
 * @param warnings - Environment variable warnings
 * @returns Formatted warning text
 */
export function formatEnvVarWarnings(warnings: EnvVarWarning[]): string {
  if (warnings.length === 0) {
    return 'No environment variable warnings.';
  }

  const lines: string[] = [
    `Environment Variable Warnings (${warnings.length}):\n`,
  ];

  for (const warning of warnings) {
    const icon =
      warning.severity === 'high'
        ? '⚠️'
        : warning.severity === 'medium'
          ? '⚡'
          : 'ℹ️';
    lines.push(`  ${icon} ${warning.mcpName} → ${warning.envKey}`);
    lines.push(`    ${warning.message}`);
  }

  return lines.join('\n');
}

// Helper functions

/**
 * Get suggestion for error message
 */
function getSuggestion(error: string): string | undefined {
  if (error.includes('not defined')) {
    return 'Export the variable: export VAR_NAME=value, or add to .env file';
  }
  if (error.includes('Unclosed')) {
    return 'Check for matching closing brace }';
  }
  if (error.includes('Invalid variable name')) {
    return 'Use only uppercase letters, numbers, and underscores';
  }
  return undefined;
}

/**
 * Get severity for warning message
 */
function getSeverity(warning: string): 'low' | 'medium' | 'high' {
  // Check for hardcoded values first (most specific)
  if (warning.includes('Hardcoded')) {
    return 'medium';
  }
  // Check for secret-related warnings
  if (
    warning.toLowerCase().includes('secret') &&
    !warning.includes('Hardcoded')
  ) {
    return 'high';
  }
  return 'low';
}
