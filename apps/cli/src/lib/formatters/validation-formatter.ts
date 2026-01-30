/**
 * Validation Result Formatters
 *
 * Extracted from validate.ts for better modularity.
 * Handles display and formatting of validation results.
 */

import type { OvertureConfig } from '@overture/config-types';
import type { OutputPort } from '@overture/ports-output';
import type { AdapterRegistry } from '@overture/client-adapters';
import type { ClientName } from '@overture/config-types';
import {
  getTransportValidationSummary,
  type TransportWarning,
} from '@overture/sync-core';
import {
  validateEnvVarReferences,
  getFixSuggestion,
} from '../validators/env-var-validator.js';

/**
 * Validates environment variable security (detects hardcoded credentials)
 */
export function validateEnvVarSecurity(
  config: OvertureConfig,
  output: OutputPort,
  options: { verbose?: boolean },
): void {
  const envVarValidation = validateEnvVarReferences(config);
  if (!envVarValidation.valid) {
    output.warn('Environment variable security warnings:');
    envVarValidation.issues.forEach((issue) => output.warn(`  - ${issue}`));
    if (options.verbose) {
      output.info(getFixSuggestion(envVarValidation.issues));
    }
  }
}

/**
 * Displays validation results (warnings and errors)
 */
export function displayValidationResults(
  allTransportWarnings: TransportWarning[],
  allEnvErrors: Array<{ client: string; error: string; suggestion?: string }>,
  allEnvWarnings: Array<{ client: string; warning: string }>,
  output: OutputPort,
  options: { verbose?: boolean; client?: string },
  config?: OvertureConfig,
  adapterRegistry?: AdapterRegistry,
): void {
  // Display environment variable errors (fail validation)
  if (allEnvErrors.length > 0) {
    output.error('Environment variable validation errors:');
    for (const { client, error, suggestion } of allEnvErrors) {
      output.error(`  - ${client}: ${error}`);
      if (suggestion && options.verbose) {
        output.info(`    💡 ${suggestion}`);
      }
    }
    process.exit(3);
  }

  // Display transport warnings
  if (allTransportWarnings.length > 0) {
    output.warn('Transport compatibility warnings:');
    allTransportWarnings.forEach((w) => output.warn(`  - ${w.message}`));
  }

  // Display environment variable warnings (don't fail validation)
  if (allEnvWarnings.length > 0) {
    output.warn('Environment variable warnings:');
    for (const { client, warning } of allEnvWarnings) {
      output.warn(`  - ${client}: ${warning}`);
    }
  }

  // Show verbose summary if requested
  if (options.verbose && options.client && config && adapterRegistry) {
    const adapter = adapterRegistry.get(options.client as ClientName);
    if (adapter) {
      const summary = getTransportValidationSummary(config.mcp, adapter);
      output.info('\nTransport validation summary:');
      output.info(`  Total MCPs: ${summary.total}`);
      output.info(`  Supported: ${summary.supported}`);
      output.info(`  Unsupported: ${summary.unsupported}`);
    }
  }
}
