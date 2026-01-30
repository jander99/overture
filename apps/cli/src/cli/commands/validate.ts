import { Command } from 'commander';
import { ConfigError, ValidationError } from '@overture/errors';
import {
  getTransportWarnings,
  getTransportValidationSummary,
  getEnvVarErrors,
  getEnvVarWarnings,
  type TransportWarning,
} from '@overture/sync-core';
import { ErrorHandler } from '@overture/utils';
import type {
  Platform,
  ClientName,
  KnownClientName,
  OvertureConfig,
} from '@overture/config-types';
import { ALL_KNOWN_CLIENTS } from '@overture/config-types';
import type { AppDependencies } from '../../composition-root.js';
import type { AdapterRegistry } from '@overture/client-adapters';
import type { OutputPort } from '@overture/ports-output';
import {
  validateEnvVarReferences,
  getFixSuggestion,
} from '../../lib/validators/env-var-validator.js';

/**
 * Valid platform names
 */
const VALID_PLATFORMS: Platform[] = ['darwin', 'linux', 'win32'];

/**
 * Valid client names (imported from centralized constants)
 * Includes all known clients for validation purposes
 */
const VALID_CLIENT_NAMES: readonly KnownClientName[] = ALL_KNOWN_CLIENTS;

/**
 * Validates a list of items from MCP config against valid values
 */
function validateConfigItems(
  items: string[],
  validItems: readonly string[],
  mcpName: string,
  section: string,
  itemType: string,
  errors: string[],
): void {
  for (const item of items) {
    if (!validItems.includes(item)) {
      errors.push(
        `MCP "${mcpName}": invalid ${itemType} in ${section}: "${item}". Valid ${itemType}s: ${validItems.join(', ')}`,
      );
    }
  }
}

/**
 * Validates platform configuration for a single MCP
 */
function validateMcpPlatforms(
  mcpName: string,
  platforms: Record<string, unknown> | undefined,
  errors: string[],
): void {
  if (!platforms) return;

  if (platforms.exclude) {
    validateConfigItems(
      platforms.exclude as string[],
      VALID_PLATFORMS,
      mcpName,
      'exclusion list',
      'platform',
      errors,
    );
  }

  if (platforms.commandOverrides) {
    validateConfigItems(
      Object.keys(platforms.commandOverrides as Record<string, unknown>),
      VALID_PLATFORMS,
      mcpName,
      'commandOverrides',
      'platform',
      errors,
    );
  }

  if (platforms.argsOverrides) {
    validateConfigItems(
      Object.keys(platforms.argsOverrides as Record<string, unknown>),
      VALID_PLATFORMS,
      mcpName,
      'argsOverrides',
      'platform',
      errors,
    );
  }
}

/**
 * Validates client configuration for a single MCP
 */
function validateMcpClients(
  mcpName: string,
  clients: Record<string, unknown> | undefined,
  errors: string[],
): void {
  if (!clients) return;

  if (clients.exclude) {
    validateConfigItems(
      clients.exclude as string[],
      VALID_CLIENT_NAMES,
      mcpName,
      'exclusion list',
      'client',
      errors,
    );
  }

  if (clients.include) {
    validateConfigItems(
      clients.include as string[],
      VALID_CLIENT_NAMES,
      mcpName,
      'include list',
      'client',
      errors,
    );
  }

  if (clients.overrides) {
    validateConfigItems(
      Object.keys(clients.overrides as Record<string, unknown>),
      VALID_CLIENT_NAMES,
      mcpName,
      'overrides',
      'client',
      errors,
    );
  }
}

/**
 * Validates MCP configuration fields (command, transport, platforms, clients)
 */
function validateMcpConfigs(config: OvertureConfig, errors: string[]): void {
  for (const [mcpName, mcpConfig] of Object.entries(config.mcp)) {
    // Validate required fields
    if (!mcpConfig.command || mcpConfig.command.trim() === '') {
      errors.push(`MCP "${mcpName}": command is required and cannot be empty`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!mcpConfig.transport) {
      errors.push(`MCP "${mcpName}": transport is required`);
    }

    // Validate platform configuration
    validateMcpPlatforms(mcpName, mcpConfig.platforms, errors);

    // Validate client configuration
    validateMcpClients(mcpName, mcpConfig.clients, errors);
  }
}

/**
 * Checks for duplicate MCP names (case-insensitive)
 */
function checkDuplicateMcpNames(
  config: OvertureConfig,
  errors: string[],
): void {
  const mcpNames = Object.keys(config.mcp);
  const lowerCaseNames = new Map<string, string>();
  for (const name of mcpNames) {
    const lower = name.toLowerCase();
    if (lowerCaseNames.has(lower)) {
      errors.push(
        `Duplicate MCP name (case-insensitive): "${name}" and "${lowerCaseNames.get(lower)}"`,
      );
    } else {
      lowerCaseNames.set(lower, name);
    }
  }
}

/**
 * Validates environment variable security (detects hardcoded credentials)
 */
function validateEnvVarSecurity(
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
 * Validates sync.enabledClients configuration
 */
function validateEnabledClients(
  config: OvertureConfig,
  errors: string[],
): void {
  if (config.sync?.enabledClients) {
    for (const client of config.sync.enabledClients) {
      if (!VALID_CLIENT_NAMES.includes(client)) {
        errors.push(
          `Invalid client in sync.enabledClients: "${client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`,
        );
      }
    }
  }
}

/**
 * Validates --client option if provided
 */
function validateClientOption(
  options: { client?: string },
  adapterRegistry: AdapterRegistry,
  errors: string[],
): void {
  if (options.client) {
    if (!VALID_CLIENT_NAMES.includes(options.client as ClientName)) {
      errors.push(
        `Invalid --client option: "${options.client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`,
      );
    } else {
      // Check if client adapter exists
      const adapter = adapterRegistry.get(options.client as ClientName);
      if (!adapter) {
        errors.push(`No adapter registered for client: "${options.client}"`);
      }
    }
  }
}

/**
 * Determines which clients to validate based on options and config
 */
function determineClientsToValidate(
  options: { client?: string },
  config: OvertureConfig,
  _adapterRegistry: AdapterRegistry,
): ClientName[] {
  const clientsToValidate: ClientName[] = [];
  if (options.client) {
    clientsToValidate.push(options.client as ClientName);
  } else if (config.sync?.enabledClients) {
    clientsToValidate.push(...config.sync.enabledClients);
  } else if (config.clients) {
    for (const [clientName, clientConfig] of Object.entries(config.clients)) {
      if (
        typeof clientConfig === 'object' &&
        (!('enabled' in clientConfig) || clientConfig.enabled === true)
      ) {
        clientsToValidate.push(clientName as ClientName);
      }
    }
  }
  return clientsToValidate;
}

/**
 * Validates transport and environment variables for specified clients
 */
function validateTransportAndEnv(
  clientsToValidate: ClientName[],
  config: OvertureConfig,
  adapterRegistry: AdapterRegistry,
): {
  allTransportWarnings: TransportWarning[];
  allEnvErrors: Array<{
    client: string;
    error: string;
    suggestion?: string;
  }>;
  allEnvWarnings: Array<{ client: string; warning: string }>;
} {
  const allTransportWarnings: TransportWarning[] = [];
  const allEnvErrors: Array<{
    client: string;
    error: string;
    suggestion?: string;
  }> = [];
  const allEnvWarnings: Array<{ client: string; warning: string }> = [];

  for (const clientName of clientsToValidate) {
    const adapter = adapterRegistry.get(clientName);
    if (adapter) {
      const warnings = getTransportWarnings(config.mcp, adapter);
      allTransportWarnings.push(...warnings);

      const envErrors = getEnvVarErrors(config, adapter);
      const envWarnings = getEnvVarWarnings(config, adapter);

      // Collect errors with client context
      for (const error of envErrors) {
        allEnvErrors.push({
          client: clientName,
          error: `[${error.mcpName}] ${error.envKey}: ${error.message}`,
          suggestion: error.suggestion,
        });
      }

      // Collect warnings with client context
      for (const warning of envWarnings) {
        allEnvWarnings.push({
          client: clientName,
          warning: `[${warning.mcpName}] ${warning.envKey}: ${warning.message}`,
        });
      }
    }
  }

  return { allTransportWarnings, allEnvErrors, allEnvWarnings };
}

/**
 * Displays validation results (warnings and errors)
 */
function displayValidationResults(
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

/**
 * Creates the 'validate' command for validating Overture configuration.
 *
 * Usage: overture validate [options]
 *
 * Validates:
 * - Configuration schema (Zod validation via loadConfig)
 * - Platform names (darwin, linux, win32)
 * - Client names (installed adapters)
 * - Environment variable syntax (${VAR_NAME} or ${VAR_NAME:-default})
 * - Environment variable references (checks if vars exist for pre-expansion)
 * - Duplicate MCP names (case-insensitive)
 * - Required fields (command, transport)
 * - Transport compatibility per client
 *
 * Warnings:
 * - Hardcoded values that could be secrets
 * - Unsupported transport types for specific clients
 */
export function createValidateCommand(deps: AppDependencies): Command {
  const { configLoader, adapterRegistry, output } = deps;
  const command = new Command('validate');

  command
    .description('Validate configuration schema and MCP availability')
    .option(
      '--platform <platform>',
      'Validate for specific platform (darwin, linux, win32)',
    )
    .option('--client <client>', 'Validate for specific client')
    .option('--verbose', 'Show detailed validation output')
    .action(async (options) => {
      try {
        // Load configuration (throws ConfigLoadError or ConfigValidationError)
        const config = await configLoader.loadConfig(process.cwd());

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!config) {
          output.error('No configuration found');
          process.exit(2);
        }

        // Collect validation errors
        const errors: string[] = [];

        // 1. Validate MCP configurations
        validateMcpConfigs(config, errors);

        // 2. Check for duplicate MCP names
        checkDuplicateMcpNames(config, errors);

        // 3. Validate environment variable security (hardcoded credentials)
        validateEnvVarSecurity(config, output, options);

        // 4. Validate sync.enabledClients
        validateEnabledClients(config, errors);

        // 5. Validate --client option if provided
        validateClientOption(options, adapterRegistry, errors);

        // If there are validation errors, exit with code 3
        if (errors.length > 0) {
          output.error('Validation errors:');
          errors.forEach((err) => output.error(`  - ${err}`));
          process.exit(3);
        }

        // 6. Determine which clients to validate
        const clientsToValidate = determineClientsToValidate(
          options,
          config,
          adapterRegistry,
        );

        // 7. Validate transport and environment variables for each client
        const { allTransportWarnings, allEnvErrors, allEnvWarnings } =
          validateTransportAndEnv(clientsToValidate, config, adapterRegistry);

        // 8. Display validation results
        displayValidationResults(
          allTransportWarnings,
          allEnvErrors,
          allEnvWarnings,
          output,
          options,
          config,
          adapterRegistry,
        );

        output.success('Configuration is valid');
        process.exit(0);
      } catch (error) {
        // Re-throw if this is a process.exit error (from test mocking)
        if (
          error instanceof Error &&
          error.message.startsWith('Process exit:')
        ) {
          throw error;
        }

        // Handle ConfigError with exit code 2
        if (error instanceof ConfigError) {
          ErrorHandler.handleCommandError(error, 'validate', options.verbose);
          // ErrorHandler.handleCommandError calls process.exit internally
          return; // This won't be reached, but TypeScript needs it
        }

        // Handle ValidationError with exit code 3
        if (error instanceof ValidationError) {
          ErrorHandler.handleCommandError(error, 'validate', options.verbose);
          // ErrorHandler.handleCommandError calls process.exit internally
          return; // This won't be reached, but TypeScript needs it
        }

        // Handle all other errors
        ErrorHandler.handleCommandError(error, 'validate', options.verbose);
        // ErrorHandler.handleCommandError calls process.exit internally
      }
    });

  return command;
}
