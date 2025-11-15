import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Command } from 'commander';
import { Logger } from '../../utils/logger';
import { Prompts } from '../../utils/prompts';
import { CONFIG_PATH } from '../../domain/constants';
import type { OvertureConfig } from '../../domain/config.types';

/**
 * Creates the 'init' command for initializing Overture configuration.
 *
 * Usage: overture init [--force]
 *
 * Initializes a new .overture/config.yaml file with sensible defaults
 * for v0.2 multi-client MCP configuration.
 */
export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Initialize .overture/config.yaml with defaults')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
      try {
        const projectDir = process.cwd();
        const configPath = path.join(projectDir, CONFIG_PATH);
        const overtureDir = path.dirname(configPath);

        // Check if config already exists
        if (fs.existsSync(configPath) && !options.force) {
          Logger.error('Configuration already exists');
          Logger.info(`Use --force to overwrite or edit ${CONFIG_PATH}`);
          process.exit(1);
        }

        // Prompt for project info
        const projectName = path.basename(projectDir);

        Logger.info('Initializing Overture configuration...');

        // Create basic v0.2 config
        const config: OvertureConfig = {
          version: '2.0',
          project: {
            name: projectName,
          },
          mcp: {
            // Example MCP server (commented out)
            // 'example-mcp': {
            //   transport: 'stdio',
            //   command: 'npx',
            //   args: ['-y', 'example-mcp-server'],
            //   enabled: true,
            // },
          },
          clients: {
            'claude-code': {
              enabled: true,
            },
          },
        };

        // Ensure .overture directory exists
        if (!fs.existsSync(overtureDir)) {
          fs.mkdirSync(overtureDir, { recursive: true });
        }

        // Write YAML configuration
        const yamlContent = yaml.dump(config, {
          indent: 2,
          lineWidth: 100,
          noRefs: true,
          quotingType: '"',
          forceQuotes: false,
        });

        // Add helpful comments
        const configWithComments = `# Overture Configuration (v0.2)
# Multi-client MCP configuration orchestrator
#
# This file defines MCP servers and client configurations for your project.
# MCP servers configured here will be synced to enabled clients.
#
# Supported clients:
#   - claude-code (Claude Code CLI)
#   - claude-desktop (Claude Desktop App)
#   - vscode (VS Code with Continue/Cody)
#   - cursor (Cursor IDE)
#   - windsurf (Windsurf IDE)
#   - copilot-cli (GitHub Copilot CLI)
#   - jetbrains-copilot (JetBrains IDEs with Copilot)
#
# Run 'overture sync' to apply configuration to clients

${yamlContent}`;

        fs.writeFileSync(configPath, configWithComments, 'utf-8');

        Logger.success('Configuration created!');
        Logger.info(`Location: ${configPath}`);
        Logger.nl();
        Logger.info('Next steps:');
        Logger.info('  1. Edit .overture/config.yaml to add MCP servers');
        Logger.info('  2. Run \`overture sync\` to generate client configurations');
      } catch (error) {
        Logger.error(`Failed to initialize configuration: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
