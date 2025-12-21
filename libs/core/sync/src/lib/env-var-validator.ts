/**
 * Environment Variable Validator
 *
 * Validates that required environment variables are set before sync.
 *
 * @module @overture/sync-core/env-var-validator
 */

import type { OvertureConfig } from '@overture/config-types';
import { validateEnvVars as validateEnvVarString } from './env-expander.js';

/**
 * Validate environment variables in Overture config
 *
 * Returns warnings for missing environment variables (without defaults)
 */
export function validateConfigEnvVars(
  config: OvertureConfig,
  currentEnv: Record<string, string | undefined>,
): string[] {
  const warnings: string[] = [];
  const missingByVar = new Map<string, string[]>(); // varName -> [mcpNames]

  for (const [mcpName, mcpConfig] of Object.entries(config.mcp)) {
    if (!mcpConfig.env) {
      continue;
    }

    // Check each environment value
    for (const [_key, value] of Object.entries(mcpConfig.env)) {
      const result = validateEnvVarString(value, currentEnv);

      if (!result.valid) {
        // Track which MCPs need which missing vars
        for (const varName of result.missing) {
          if (!missingByVar.has(varName)) {
            missingByVar.set(varName, []);
          }
          if (!missingByVar.get(varName)!.includes(mcpName)) {
            missingByVar.get(varName)!.push(mcpName);
          }
        }
      }
    }
  }

  // Generate warnings
  for (const [varName, mcpNames] of missingByVar.entries()) {
    const mcpList = mcpNames.join(', ');
    warnings.push(
      `Environment variable ${varName} is not set (required by: ${mcpList})`,
    );
  }

  return warnings;
}

/**
 * Format env var warnings for display
 */
export function formatEnvVarWarnings(warnings: string[]): string {
  if (warnings.length === 0) {
    return '';
  }

  const lines = [
    '⚠️  Missing Environment Variables:',
    '',
    ...warnings.map((w) => `  • ${w}`),
    '',
    'Set these variables before syncing:',
  ];

  // Extract unique var names from warnings
  const varNames = new Set<string>();
  for (const warning of warnings) {
    const match = warning.match(/Environment variable (\w+) is not set/);
    if (match) {
      varNames.add(match[1]);
    }
  }

  for (const varName of varNames) {
    lines.push(`  export ${varName}="your-value"`);
  }

  return lines.join('\n');
}
