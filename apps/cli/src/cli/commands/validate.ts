import { Command } from 'commander';
import { loadConfig, ConfigLoadError, ConfigValidationError } from '../../core/config-loader';
import { getTransportWarnings, getTransportValidationSummary, type TransportWarning } from '../../core/transport-validator';
import { adapterRegistry } from '../../adapters/adapter-registry';
import { ErrorHandler } from '../../core/error-handler';
import { Logger } from '../../utils/logger';
import type { Platform, ClientName } from '../../domain/config.types';

/**
 * Valid platform names
 */
const VALID_PLATFORMS: Platform[] = ['darwin', 'linux', 'win32'];

/**
 * Valid client names
 */
const VALID_CLIENT_NAMES: ClientName[] = [
  'claude-code',
  'claude-desktop',
  'vscode',
  'cursor',
  'windsurf',
  'copilot-cli',
  'jetbrains-copilot',
];

/**
 * Environment variable syntax pattern: ${VAR_NAME} or ${VAR_NAME:-default}
 */
const ENV_VAR_PATTERN = /^\$\{[A-Z_][A-Z0-9_]*(?::-[^}]*)?\}$/;

/**
 * Creates the 'validate' command for validating Overture configuration.
 *
 * Usage: overture validate [options]
 *
 * Validates:
 * - Configuration schema (Zod validation via loadConfig)
 * - Platform names (darwin, linux, win32)
 * - Client names (installed adapters)
 * - Environment variable syntax (${VAR_NAME})
 * - Duplicate MCP names (case-insensitive)
 * - Required fields (command, transport)
 * - Transport compatibility
 */
export function createValidateCommand(): Command {
  const command = new Command('validate');

  command
    .description('Validate configuration schema and MCP availability')
    .option('--platform <platform>', 'Validate for specific platform (darwin, linux, win32)')
    .option('--client <client>', 'Validate for specific client')
    .option('--verbose', 'Show detailed validation output')
    .action(async (options) => {
      try {
        // Load configuration (throws ConfigLoadError or ConfigValidationError)
        const config = await loadConfig(process.cwd());

        if (!config) {
          Logger.error('No configuration found');
          process.exit(2);
        }

        // Custom validations
        const errors: string[] = [];

        // Validate all MCP configurations
        for (const [mcpName, mcpConfig] of Object.entries(config.mcp)) {
          // Validate required fields
          if (!mcpConfig.command || mcpConfig.command.trim() === '') {
            errors.push(`MCP "${mcpName}": command is required and cannot be empty`);
          }

          if (!mcpConfig.transport) {
            errors.push(`MCP "${mcpName}": transport is required`);
          }

          // Validate platform names in exclusion list
          if (mcpConfig.platforms?.exclude) {
            for (const platform of mcpConfig.platforms.exclude) {
              if (!VALID_PLATFORMS.includes(platform)) {
                errors.push(`MCP "${mcpName}": invalid platform in exclusion list: "${platform}". Valid platforms: ${VALID_PLATFORMS.join(', ')}`);
              }
            }
          }

          // Validate platform names in commandOverrides
          if (mcpConfig.platforms?.commandOverrides) {
            for (const platform of Object.keys(mcpConfig.platforms.commandOverrides)) {
              if (!VALID_PLATFORMS.includes(platform as Platform)) {
                errors.push(`MCP "${mcpName}": invalid platform in commandOverrides: "${platform}". Valid platforms: ${VALID_PLATFORMS.join(', ')}`);
              }
            }
          }

          // Validate platform names in argsOverrides
          if (mcpConfig.platforms?.argsOverrides) {
            for (const platform of Object.keys(mcpConfig.platforms.argsOverrides)) {
              if (!VALID_PLATFORMS.includes(platform as Platform)) {
                errors.push(`MCP "${mcpName}": invalid platform in argsOverrides: "${platform}". Valid platforms: ${VALID_PLATFORMS.join(', ')}`);
              }
            }
          }

          // Validate client names in exclusion list
          if (mcpConfig.clients?.exclude) {
            for (const client of mcpConfig.clients.exclude) {
              if (!VALID_CLIENT_NAMES.includes(client)) {
                errors.push(`MCP "${mcpName}": invalid client in exclusion list: "${client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`);
              }
            }
          }

          // Validate client names in include list
          if (mcpConfig.clients?.include) {
            for (const client of mcpConfig.clients.include) {
              if (!VALID_CLIENT_NAMES.includes(client)) {
                errors.push(`MCP "${mcpName}": invalid client in include list: "${client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`);
              }
            }
          }

          // Validate client names in overrides
          if (mcpConfig.clients?.overrides) {
            for (const client of Object.keys(mcpConfig.clients.overrides)) {
              if (!VALID_CLIENT_NAMES.includes(client as ClientName)) {
                errors.push(`MCP "${mcpName}": invalid client in overrides: "${client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`);
              }
            }
          }

          // Validate environment variable syntax
          if (mcpConfig.env) {
            for (const [key, value] of Object.entries(mcpConfig.env)) {
              // Check if value contains env var syntax
              if (value.includes('${')) {
                // Extract all ${...} patterns (including malformed ones)
                const matches = value.match(/\$\{[^}]*\}/g);

                // Check if there are unclosed ${
                const openCount = (value.match(/\$\{/g) || []).length;
                const closeCount = (value.match(/\}/g) || []).length;

                if (openCount > closeCount) {
                  errors.push(`MCP "${mcpName}": invalid environment variable syntax in "${key}": unclosed \${. Expected format: \${VAR_NAME} or \${VAR_NAME:-default}`);
                } else if (matches) {
                  // Validate each matched pattern
                  for (const match of matches) {
                    if (!ENV_VAR_PATTERN.test(match)) {
                      errors.push(`MCP "${mcpName}": invalid environment variable syntax in "${key}": "${match}". Expected format: \${VAR_NAME} or \${VAR_NAME:-default}`);
                    }
                  }
                }
              }
            }
          }

          // Validate env vars in client overrides
          if (mcpConfig.clients?.overrides) {
            for (const [clientName, override] of Object.entries(mcpConfig.clients.overrides)) {
              if (override.env) {
                for (const [key, value] of Object.entries(override.env)) {
                  if (value && value.includes('${')) {
                    const matches = value.match(/\$\{[^}]*\}/g);

                    // Check if there are unclosed ${
                    const openCount = (value.match(/\$\{/g) || []).length;
                    const closeCount = (value.match(/\}/g) || []).length;

                    if (openCount > closeCount) {
                      errors.push(`MCP "${mcpName}" client override "${clientName}": invalid environment variable syntax in "${key}": unclosed \${. Expected format: \${VAR_NAME} or \${VAR_NAME:-default}`);
                    } else if (matches) {
                      for (const match of matches) {
                        if (!ENV_VAR_PATTERN.test(match)) {
                          errors.push(`MCP "${mcpName}" client override "${clientName}": invalid environment variable syntax in "${key}": "${match}". Expected format: \${VAR_NAME} or \${VAR_NAME:-default}`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Check for duplicate MCP names (case-insensitive)
        const mcpNames = Object.keys(config.mcp);
        const lowerCaseNames = new Map<string, string>();
        for (const name of mcpNames) {
          const lower = name.toLowerCase();
          if (lowerCaseNames.has(lower)) {
            errors.push(`Duplicate MCP name (case-insensitive): "${name}" and "${lowerCaseNames.get(lower)}"`);
          } else {
            lowerCaseNames.set(lower, name);
          }
        }

        // Validate sync.enabledClients
        if (config.sync?.enabledClients) {
          for (const client of config.sync.enabledClients) {
            if (!VALID_CLIENT_NAMES.includes(client)) {
              errors.push(`Invalid client in sync.enabledClients: "${client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`);
            }
          }
        }

        // Validate --client option if provided
        if (options.client) {
          if (!VALID_CLIENT_NAMES.includes(options.client)) {
            errors.push(`Invalid --client option: "${options.client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`);
          } else {
            // Check if client adapter exists
            const adapter = adapterRegistry.get(options.client);
            if (!adapter) {
              errors.push(`No adapter registered for client: "${options.client}"`);
            }
          }
        }

        // If there are validation errors, exit with code 3
        if (errors.length > 0) {
          Logger.error('Validation errors:');
          errors.forEach((err) => Logger.error(`  - ${err}`));
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
          for (const [clientName, clientConfig] of Object.entries(config.clients)) {
            if ((clientConfig as any).enabled !== false) {
              clientsToValidate.push(clientName as ClientName);
            }
          }
        }

        // Run transport validation for each client
        const allWarnings: TransportWarning[] = [];
        for (const clientName of clientsToValidate) {
          const adapter = adapterRegistry.get(clientName);
          if (adapter) {
            const warnings = getTransportWarnings(config.mcp, adapter);
            allWarnings.push(...warnings);
          }
        }

        // Display transport warnings
        if (allWarnings.length > 0) {
          Logger.warn('Transport compatibility warnings:');
          allWarnings.forEach((w) => Logger.warn(`  - ${w.message}`));
        }

        // Show verbose summary if requested
        if (options.verbose && options.client) {
          const adapter = adapterRegistry.get(options.client);
          if (adapter) {
            const summary = getTransportValidationSummary(config.mcp, adapter);
            Logger.info('Transport validation summary:');
            Logger.info(`  Total MCPs: ${summary.total}`);
            Logger.info(`  Supported: ${summary.supported}`);
            Logger.info(`  Unsupported: ${summary.unsupported}`);
          }
        }

        Logger.success('Configuration is valid');
        process.exit(0);
      } catch (error) {
        // Re-throw if this is a process.exit error (from test mocking)
        if (error instanceof Error && error.message.startsWith('Process exit:')) {
          throw error;
        }

        // Handle ConfigLoadError with exit code 2
        if (error instanceof ConfigLoadError) {
          ErrorHandler.handleCommandError(error, 'validate', options.verbose);
          // ErrorHandler.handleCommandError calls process.exit internally
          return; // This won't be reached, but TypeScript needs it
        }

        // Handle ConfigValidationError with exit code 3
        if (error instanceof ConfigValidationError) {
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
