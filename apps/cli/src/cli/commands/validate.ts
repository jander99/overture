import { Command } from 'commander';
import { ConfigManager } from '../../core/config-manager';
import { Validator } from '../../core/validator';
import { Logger } from '../../utils/logger';

/**
 * Creates the 'validate' command for validating Overture configuration.
 *
 * Usage: overture validate
 *
 * Validates:
 * - Configuration schema (Zod validation)
 * - Plugin references
 * - MCP server command availability
 * - Plugin-to-MCP mappings
 */
export function createValidateCommand(): Command {
  const command = new Command('validate');

  command
    .description('Validate configuration schema and MCP availability')
    .action(async () => {
      try {
        // Load configuration
        Logger.info('Loading configuration...');
        const projectConfig = await ConfigManager.loadProjectConfig();
        const globalConfig = await ConfigManager.loadGlobalConfig();
        const config = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Validate
        Logger.info('Validating configuration...');
        const result = await Validator.validateAll(config);

        // Report errors
        if (result.errors.length > 0) {
          Logger.nl();
          Logger.error('Validation errors:');
          result.errors.forEach((err) => {
            Logger.error(`  ${err.field}: ${err.message}`);
            if (err.suggestion) {
              Logger.info(`    -> ${err.suggestion}`);
            }
          });
        }

        // Report warnings
        if (result.warnings.length > 0) {
          Logger.nl();
          Logger.warn('Warnings:');
          result.warnings.forEach((warn) => {
            Logger.warn(`  ${warn.message}`);
            if (warn.context) {
              Logger.info(`    (${warn.context})`);
            }
          });
        }

        // Summary
        Logger.nl();
        if (result.valid) {
          Logger.success('Configuration is valid!');
          process.exit(0);
        } else {
          Logger.error('Configuration has errors');
          process.exit(3);
        }
      } catch (error) {
        Logger.error(`Validation failed: ${(error as Error).message}`);
        process.exit((error as any).exitCode || 1);
      }
    });

  return command;
}
