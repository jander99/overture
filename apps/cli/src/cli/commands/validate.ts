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
} from '@overture/config-types';
import { ALL_KNOWN_CLIENTS } from '@overture/config-types';
import type { AppDependencies } from '../../composition-root';
import {
  validateEnvVarReferences,
  getFixSuggestion,
} from '../../lib/validators/env-var-validator';

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

        if (!config) {
          output.error('No configuration found');
          process.exit(2);
        }

        // Custom validations
        const errors: string[] = [];

        // Validate all MCP configurations
        for (const [mcpName, mcpConfig] of Object.entries(config.mcp)) {
          // Validate required fields
          if (!mcpConfig.command || mcpConfig.command.trim() === '') {
            errors.push(
              `MCP "${mcpName}": command is required and cannot be empty`,
            );
          }

          if (!mcpConfig.transport) {
            errors.push(`MCP "${mcpName}": transport is required`);
          }

          // Validate platform names in exclusion list
          if (mcpConfig.platforms?.exclude) {
            for (const platform of mcpConfig.platforms.exclude) {
              if (!VALID_PLATFORMS.includes(platform)) {
                errors.push(
                  `MCP "${mcpName}": invalid platform in exclusion list: "${platform}". Valid platforms: ${VALID_PLATFORMS.join(', ')}`,
                );
              }
            }
          }

          // Validate platform names in commandOverrides
          if (mcpConfig.platforms?.commandOverrides) {
            for (const platform of Object.keys(
              mcpConfig.platforms.commandOverrides,
            )) {
              if (!VALID_PLATFORMS.includes(platform as Platform)) {
                errors.push(
                  `MCP "${mcpName}": invalid platform in commandOverrides: "${platform}". Valid platforms: ${VALID_PLATFORMS.join(', ')}`,
                );
              }
            }
          }

          // Validate platform names in argsOverrides
          if (mcpConfig.platforms?.argsOverrides) {
            for (const platform of Object.keys(
              mcpConfig.platforms.argsOverrides,
            )) {
              if (!VALID_PLATFORMS.includes(platform as Platform)) {
                errors.push(
                  `MCP "${mcpName}": invalid platform in argsOverrides: "${platform}". Valid platforms: ${VALID_PLATFORMS.join(', ')}`,
                );
              }
            }
          }

          // Validate client names in exclusion list
          if (mcpConfig.clients?.exclude) {
            for (const client of mcpConfig.clients.exclude) {
              if (!VALID_CLIENT_NAMES.includes(client)) {
                errors.push(
                  `MCP "${mcpName}": invalid client in exclusion list: "${client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`,
                );
              }
            }
          }

          // Validate client names in include list
          if (mcpConfig.clients?.include) {
            for (const client of mcpConfig.clients.include) {
              if (!VALID_CLIENT_NAMES.includes(client)) {
                errors.push(
                  `MCP "${mcpName}": invalid client in include list: "${client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`,
                );
              }
            }
          }

          // Validate client names in overrides
          if (mcpConfig.clients?.overrides) {
            for (const client of Object.keys(mcpConfig.clients.overrides)) {
              if (!VALID_CLIENT_NAMES.includes(client as ClientName)) {
                errors.push(
                  `MCP "${mcpName}": invalid client in overrides: "${client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`,
                );
              }
            }
          }

          // Environment variable validation is now handled separately after client determination
        }

        // Check for duplicate MCP names (case-insensitive)
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

        // Validate environment variable security (detect hardcoded credentials)
        const envVarValidation = validateEnvVarReferences(config);
        if (!envVarValidation.valid) {
          output.warn('Environment variable security warnings:');
          envVarValidation.issues.forEach((issue) =>
            output.warn(`  - ${issue}`),
          );
          if (options.verbose) {
            output.info(getFixSuggestion(envVarValidation.issues));
          }
        }

        // Validate sync.enabledClients
        if (config.sync?.enabledClients) {
          for (const client of config.sync.enabledClients) {
            if (!VALID_CLIENT_NAMES.includes(client)) {
              errors.push(
                `Invalid client in sync.enabledClients: "${client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`,
              );
            }
          }
        }

        // Validate --client option if provided
        if (options.client) {
          if (!VALID_CLIENT_NAMES.includes(options.client)) {
            errors.push(
              `Invalid --client option: "${options.client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`,
            );
          } else {
            // Check if client adapter exists
            const adapter = adapterRegistry.get(options.client);
            if (!adapter) {
              errors.push(
                `No adapter registered for client: "${options.client}"`,
              );
            }
          }
        }

        // If there are validation errors, exit with code 3
        if (errors.length > 0) {
          output.error('Validation errors:');
          errors.forEach((err) => output.error(`  - ${err}`));
          process.exit(3);
        }

        // Transport validation - determine which clients to validate
        const clientsToValidate: ClientName[] = [];
        if (options.client) {
          // Validate specific client
          clientsToValidate.push(options.client);
        } else if (config.sync?.enabledClients) {
          // Validate all enabled clients from sync.enabledClients
          clientsToValidate.push(...config.sync.enabledClients);
        } else if (config.clients) {
          // Fallback: extract enabled clients from clients section
          for (const [clientName, clientConfig] of Object.entries(
            config.clients,
          )) {
            if ((clientConfig as any).enabled !== false) {
              clientsToValidate.push(clientName as ClientName);
            }
          }
        }

        // Run transport validation for each client
        const allTransportWarnings: TransportWarning[] = [];
        for (const clientName of clientsToValidate) {
          const adapter = adapterRegistry.get(clientName);
          if (adapter) {
            const warnings = getTransportWarnings(config.mcp, adapter);
            allTransportWarnings.push(...warnings);
          }
        }

        // Run environment variable validation for each client
        const allEnvErrors: Array<{
          client: string;
          error: string;
          suggestion?: string;
        }> = [];
        const allEnvWarnings: Array<{ client: string; warning: string }> = [];

        for (const clientName of clientsToValidate) {
          const adapter = adapterRegistry.get(clientName);
          if (adapter) {
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
        if (options.verbose && options.client) {
          const adapter = adapterRegistry.get(options.client);
          if (adapter) {
            const summary = getTransportValidationSummary(config.mcp, adapter);
            output.info('\nTransport validation summary:');
            output.info(`  Total MCPs: ${summary.total}`);
            output.info(`  Supported: ${summary.supported}`);
            output.info(`  Unsupported: ${summary.unsupported}`);
          }
        }

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
