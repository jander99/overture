/**
 * Doctor Command - Diagnostic Tool for Overture
 *
 * Provides comprehensive diagnostics for:
 * - Client binary/app bundle detection
 * - Client version information
 * - Config file validity
 * - MCP server command availability
 *
 * @module cli/commands/doctor
 * @version 0.2.5
 */

import { Command } from 'commander';
import * as os from 'os';
import type { Platform, ClientName } from '../../domain/config.types';
import { adapterRegistry } from '../../adapters/adapter-registry';
import { BinaryDetector } from '../../core/binary-detector';
import { loadUserConfig, loadProjectConfig } from '../../core/config-loader';
import { findProjectRoot } from '../../core/path-resolver';
import { ProcessExecutor } from '../../infrastructure/process-executor';
import { ErrorHandler } from '../../core/error-handler';
import { Logger } from '../../utils/logger';
import chalk from 'chalk';

/**
 * Get current platform
 */
function getCurrentPlatform(): Platform {
  const platform = os.platform();
  if (platform === 'darwin') return 'darwin';
  if (platform === 'win32') return 'win32';
  return 'linux';
}

/**
 * All client names
 */
const ALL_CLIENTS: ClientName[] = [
  'claude-code',
  'claude-desktop',
  'vscode',
  'cursor',
  'windsurf',
  'copilot-cli',
  'jetbrains-copilot',
];

/**
 * Check if MCP command exists
 */
async function checkMcpCommand(command: string): Promise<boolean> {
  try {
    return await ProcessExecutor.commandExists(command);
  } catch {
    return false;
  }
}

/**
 * Creates the 'doctor' command for system diagnostics.
 *
 * Usage: overture doctor [options]
 *
 * Checks:
 * - Client binary/application installations
 * - Client versions
 * - Config file validity
 * - MCP server command availability
 */
export function createDoctorCommand(): Command {
  const command = new Command('doctor');

  command
    .description('Check system for installed clients and MCP servers')
    .option('--json', 'Output results as JSON')
    .option('--verbose', 'Show detailed output')
    .action(async (options) => {
      try {
        const platform = getCurrentPlatform();
        const detector = new BinaryDetector();

        // Detect project root
        const projectRoot = findProjectRoot();

        // Load configs
        const userConfig = await loadUserConfig();
        const projectConfig = projectRoot
          ? await loadProjectConfig(projectRoot)
          : null;

        const results = {
          clients: [] as any[],
          mcpServers: [] as any[],
          summary: {
            clientsDetected: 0,
            clientsMissing: 0,
            configsValid: 0,
            configsInvalid: 0,
            mcpCommandsAvailable: 0,
            mcpCommandsMissing: 0,
          },
        };

        // Check all clients
        if (!options.json) {
          Logger.info(chalk.bold('\nChecking client installations...\n'));
        }

        for (const clientName of ALL_CLIENTS) {
          const adapter = adapterRegistry.get(clientName);
          if (!adapter) continue;

          const detection = await detector.detectClient(adapter, platform);
          const configPath = adapter.detectConfigPath(platform, projectRoot || undefined);
          const configPathStr =
            typeof configPath === 'string'
              ? configPath
              : configPath?.user || undefined;

          const configValid = configPathStr
            ? detector.validateConfigFile(configPathStr)
            : false;

          const clientResult = {
            client: clientName,
            status: detection.status,
            binaryPath: detection.binaryPath,
            appBundlePath: detection.appBundlePath,
            version: detection.version,
            configPath: configPathStr,
            configValid,
            warnings: detection.warnings,
          };

          results.clients.push(clientResult);

          // Update summary
          if (detection.status === 'found') {
            results.summary.clientsDetected++;
          } else if (detection.status === 'not-found') {
            results.summary.clientsMissing++;
          }

          if (configValid) {
            results.summary.configsValid++;
          } else if (configPathStr) {
            results.summary.configsInvalid++;
          }

          // Console output (if not JSON mode)
          if (!options.json) {
            if (detection.status === 'found') {
              const versionStr = detection.version
                ? chalk.dim(` (${detection.version})`)
                : '';
              const pathStr = detection.binaryPath || detection.appBundlePath;
              Logger.success(
                `${chalk.green('✓')} ${chalk.bold(clientName)}${versionStr} - ${chalk.dim(pathStr)}`
              );

              if (configPathStr) {
                const configStatus = configValid
                  ? chalk.green('valid')
                  : chalk.yellow('invalid');
                console.log(
                  `  Config: ${configPathStr} (${configStatus})`
                );
              }

              // Show warnings
              if (detection.warnings.length > 0 && options.verbose) {
                detection.warnings.forEach((warning) => {
                  Logger.warn(`  ${chalk.yellow('⚠')} ${warning}`);
                });
              }
            } else if (detection.status === 'not-found') {
              Logger.error(
                `${chalk.red('✗')} ${chalk.bold(clientName)} - not installed`
              );

              // Show recommendation
              const recommendation = getInstallRecommendation(clientName);
              if (recommendation) {
                console.log(`  ${chalk.dim('→')} ${chalk.dim(recommendation)}`);
              }
            } else {
              // Skipped
              console.log(
                `${chalk.gray('○')} ${chalk.bold(clientName)} - ${chalk.dim('skipped')}`
              );
            }

            console.log(''); // Blank line
          }
        }

        // Check MCP servers
        const mcpConfig = projectConfig?.mcp || userConfig?.mcp || {};

        if (Object.keys(mcpConfig).length > 0) {
          if (!options.json) {
            Logger.info(chalk.bold('Checking MCP servers...\n'));
          }

          for (const [mcpName, mcpDef] of Object.entries(mcpConfig)) {
            const commandExists = await checkMcpCommand(mcpDef.command);

            const mcpResult = {
              name: mcpName,
              command: mcpDef.command,
              available: commandExists,
            };

            results.mcpServers.push(mcpResult);

            // Update summary
            if (commandExists) {
              results.summary.mcpCommandsAvailable++;
            } else {
              results.summary.mcpCommandsMissing++;
            }

            // Console output (if not JSON mode)
            if (!options.json) {
              if (commandExists) {
                Logger.success(
                  `${chalk.green('✓')} ${chalk.bold(mcpName)} - ${chalk.dim(mcpDef.command)} ${chalk.dim('(found)')}`
                );
              } else {
                Logger.warn(
                  `${chalk.yellow('⚠')} ${chalk.bold(mcpName)} - ${chalk.dim(mcpDef.command)} ${chalk.yellow('(not found)')}`
                );

                // Show recommendation
                const recommendation = getMcpInstallRecommendation(
                  mcpDef.command
                );
                if (recommendation) {
                  console.log(`  ${chalk.dim('→')} ${chalk.dim(recommendation)}`);
                }
              }
            }
          }
        }

        // Output results
        if (options.json) {
          // JSON output
          console.log(JSON.stringify(results, null, 2));
        } else {
          // Summary
          console.log('');
          Logger.info(chalk.bold('Summary:\n'));
          console.log(
            `  Clients detected: ${chalk.green(results.summary.clientsDetected)} / ${ALL_CLIENTS.length}`
          );
          console.log(
            `  Clients missing:  ${chalk.red(results.summary.clientsMissing)}`
          );
          console.log(
            `  Configs valid:    ${chalk.green(results.summary.configsValid)}`
          );
          if (results.summary.configsInvalid > 0) {
            console.log(
              `  Configs invalid:  ${chalk.yellow(results.summary.configsInvalid)}`
            );
          }

          if (results.mcpServers.length > 0) {
            console.log('');
            console.log(
              `  MCP commands available: ${chalk.green(results.summary.mcpCommandsAvailable)} / ${results.mcpServers.length}`
            );
            if (results.summary.mcpCommandsMissing > 0) {
              console.log(
                `  MCP commands missing:   ${chalk.yellow(results.summary.mcpCommandsMissing)}`
              );
            }
          }

          console.log('');
        }

        process.exit(0);
      } catch (error) {
        const formatted = ErrorHandler.formatError(error);
        ErrorHandler.logError(formatted);
        process.exit(1);
      }
    });

  return command;
}

/**
 * Get installation recommendation for a client
 */
function getInstallRecommendation(client: ClientName): string | null {
  const recommendations: Record<ClientName, string> = {
    'claude-code':
      'Install Claude Code CLI: https://claude.com/claude-code',
    'claude-desktop':
      'Install Claude Desktop: https://claude.com/download',
    vscode: 'Install VS Code: https://code.visualstudio.com',
    cursor: 'Install Cursor: https://cursor.com',
    windsurf: 'Install Windsurf: https://codeium.com/windsurf',
    'copilot-cli':
      "Install GitHub Copilot CLI: npm install -g @githubnext/github-copilot-cli",
    'jetbrains-copilot':
      'Install JetBrains IDE with GitHub Copilot plugin',
  };

  return recommendations[client] || null;
}

/**
 * Get installation recommendation for an MCP command
 */
function getMcpInstallRecommendation(command: string): string | null {
  // Common MCP installation patterns
  if (command === 'npx') {
    return 'Install Node.js: https://nodejs.org';
  }
  if (command === 'uvx') {
    return 'Install uv: https://docs.astral.sh/uv/';
  }
  if (command.startsWith('mcp-server-')) {
    return `Try: npx -y ${command}`;
  }

  return `Ensure ${command} is installed and available in PATH`;
}
