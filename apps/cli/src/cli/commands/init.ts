import * as yaml from 'js-yaml';
import { Command } from 'commander';
import { CONFIG_PATH } from '@overture/config-core';
import type { OvertureConfig } from '@overture/config-types';
import type { AppDependencies } from '../../composition-root';

/**
 * Creates the 'init' command for initializing Overture configuration.
 *
 * Usage: overture init [--force]
 *
 * Initializes a new .overture/config.yaml file with sensible defaults
 * for v0.2 multi-client MCP configuration.
 */
export function createInitCommand(deps: AppDependencies): Command {
  const { filesystem, output, pathResolver } = deps;
  const command = new Command('init');

  command
    .description('Initialize .overture/config.yaml with defaults')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
      try {
        const projectDir = process.cwd();
        const configPath = pathResolver.resolveProjectConfig(projectDir);
        const overtureDir = pathResolver.getProjectOvertureDir(projectDir);

        // Check if config already exists
        if (filesystem.fileExists(configPath) && !options.force) {
          output.error('Configuration already exists');
          output.info(`Use --force to overwrite or edit ${CONFIG_PATH}`);
          process.exit(1);
        }

        output.info('Initializing Overture configuration...');

        // Create basic v0.2 config
        const config: OvertureConfig = {
          version: '2.0',
          mcp: {
            // Example MCP server (commented out)
            // 'example-mcp': {
            //   transport: 'stdio',
            //   command: 'npx',
            //   args: ['-y', 'example-mcp-server'],
            //   env: {},
            // },
          },
          clients: {
            'claude-code': {
              enabled: true,
            },
          },
        };

        // Ensure .overture directory exists
        if (!filesystem.directoryExists(overtureDir)) {
          filesystem.createDirectory(overtureDir);
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

        filesystem.writeFile(configPath, configWithComments);

        output.success('Configuration created!');
        output.info(`Location: ${configPath}`);
        output.nl();
        output.info('Next steps:');
        output.info('  1. Edit .overture/config.yaml to add MCP servers');
        output.info('  2. Run \`overture sync\` to generate client configurations');
      } catch (error) {
        output.error(`Failed to initialize configuration: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
