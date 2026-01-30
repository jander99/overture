import { Command } from 'commander';
import { ConfigError, ValidationError } from '@overture/errors';
import { ErrorHandler } from '@overture/utils';
import type { AppDependencies } from '../../composition-root.js';
import {
  validateMcpConfigs,
  checkDuplicateMcpNames,
} from '../../lib/validators/mcp-config-validator.js';
import {
  validateClientOption,
  validateEnabledClients,
  determineClientsToValidate,
  validateTransportAndEnv,
} from '../../lib/validators/client-validator.js';
import { parseValidateOptions } from '../../lib/option-parser.js';
import {
  validateEnvVarSecurity,
  displayValidationResults,
} from '../../lib/formatters/validation-formatter.js';

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
    .action(async (options: Record<string, unknown>) => {
      // Parse and validate options using Zod schema
      const parsedOptions = parseValidateOptions(options);

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
        validateEnvVarSecurity(config, output, parsedOptions);

        // 4. Validate sync.enabledClients
        validateEnabledClients(config, errors);

        // 5. Validate --client option if provided
        validateClientOption(parsedOptions, adapterRegistry, errors);

        // If there are validation errors, exit with code 3
        if (errors.length > 0) {
          output.error('Validation errors:');
          errors.forEach((err) => output.error(`  - ${err}`));
          process.exit(3);
        }

        // 6. Determine which clients to validate
        const clientsToValidate = determineClientsToValidate(
          parsedOptions,
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
          parsedOptions,
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
          ErrorHandler.handleCommandError(
            error,
            'validate',
            parsedOptions.verbose,
          );
          // ErrorHandler.handleCommandError calls process.exit internally
          return; // This won't be reached, but TypeScript needs it
        }

        // Handle ValidationError with exit code 3
        if (error instanceof ValidationError) {
          ErrorHandler.handleCommandError(
            error,
            'validate',
            parsedOptions.verbose,
          );
          // ErrorHandler.handleCommandError calls process.exit internally
          return; // This won't be reached, but TypeScript needs it
        }

        // Handle all other errors
        ErrorHandler.handleCommandError(
          error,
          'validate',
          parsedOptions.verbose,
        );
        // ErrorHandler.handleCommandError calls process.exit internally
      }
    });

  return command;
}
