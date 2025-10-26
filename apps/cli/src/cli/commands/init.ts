import * as path from 'path';
import { Command } from 'commander';
import { ConfigManager } from '../../core/config-manager';
import { Logger } from '../../utils/logger';
import { Prompts } from '../../utils/prompts';
import { PROJECT_TYPES, CONFIG_PATH } from '../../domain/constants';
import { FsUtils } from '../../infrastructure/fs-utils';

/**
 * Creates the 'init' command for initializing Overture configuration.
 *
 * Usage: overture init [--type <project-type>] [--force]
 *
 * Initializes a new .overture/config.yaml file with sensible defaults
 * based on the project type (if specified).
 */
export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Initialize .overture/config.yaml with defaults')
    .option('-t, --type <project-type>', 'Project type (e.g., python-backend, node-api)')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
      try {
        const projectDir = process.cwd();
        const configPath = path.join(projectDir, CONFIG_PATH);

        // Check if config already exists
        if (await FsUtils.exists(configPath) && !options.force) {
          Logger.error('Configuration already exists');
          Logger.info(`Use --force to overwrite or edit ${CONFIG_PATH}`);
          process.exit(1);
        }

        // Prompt for project type if not provided
        let projectType = options.type;
        if (!projectType) {
          projectType = await Prompts.select(
            'Select project type:',
            PROJECT_TYPES.map((type) => ({ name: type, value: type }))
          );
        }

        // Validate project type
        if (!PROJECT_TYPES.includes(projectType as any)) {
          Logger.error(`Invalid project type: ${projectType}`);
          Logger.info(`Valid types: ${PROJECT_TYPES.join(', ')}`);
          process.exit(1);
        }

        // Initialize config
        Logger.info('Initializing Overture configuration...');
        await ConfigManager.initializeConfig(projectDir, projectType);

        Logger.success('Configuration created!');
        Logger.info(`Edit ${CONFIG_PATH} to add plugins and MCP servers`);
        Logger.info('Run \`overture sync\` to generate .mcp.json and CLAUDE.md');
      } catch (error) {
        Logger.error(`Failed to initialize configuration: ${(error as Error).message}`);
        process.exit((error as any).exitCode || 1);
      }
    });

  return command;
}
