/**
 * Doctor Command - Diagnostic Tool for Overture
 *
 * Provides comprehensive diagnostics for:
 * - Client binary/app bundle detection
 * - Client version information
 * - Config file validity
 * - MCP server command availability
 * - WSL2 environment detection
 *
 * @module cli/commands/doctor
 * @version 0.3.0
 */

import { Command } from 'commander';
import * as os from 'os';
import type { Platform, ClientName } from '@overture/config-types';
import { SUPPORTED_CLIENTS } from '@overture/config-types';
import { ErrorHandler } from '@overture/utils';
import chalk from 'chalk';
import type { AppDependencies } from '../../composition-root';

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
 * All supported client names (imported from centralized constants)
 */
const ALL_CLIENTS: readonly ClientName[] = SUPPORTED_CLIENTS;

/**
 * Validate if a config file exists and contains valid JSON
 */
async function validateConfigFile(
  filepath: string,
  filesystem: any,
): Promise<boolean> {
  try {
    const fileExists = await filesystem.exists(filepath);
    if (!fileExists) {
      return false;
    }
    const content = await filesystem.readFile(filepath);
    JSON.parse(content);
    return true;
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
export function createDoctorCommand(deps: AppDependencies): Command {
  const {
    discoveryService,
    output,
    adapterRegistry,
    configLoader,
    pathResolver,
    process,
    filesystem,
  } = deps;
  const command = new Command('doctor');

  command
    .description('Check system for installed clients and MCP servers')
    .option('--json', 'Output results as JSON')
    .option('--verbose', 'Show detailed output')
    .option('--wsl2', 'Force WSL2 detection mode')
    .option('--no-wsl2', 'Disable WSL2 detection')
    .action(async (options) => {
      try {
        const platform = getCurrentPlatform();

        // Detect project root
        const projectRoot = pathResolver.findProjectRoot();

        // Load configs
        const userConfig = await configLoader.loadUserConfig();
        const projectConfig = projectRoot
          ? await configLoader.loadProjectConfig(projectRoot)
          : null;

        // Get all adapters from registry
        const adapters = ALL_CLIENTS.map((clientName) =>
          adapterRegistry.get(clientName),
        ).filter(
          (
            adapter,
          ): adapter is import('@overture/client-adapters').ClientAdapter =>
            adapter !== undefined,
        );

        // Run discovery
        const discoveryReport = await discoveryService.discoverAll(adapters);

        const results = {
          environment: {
            platform: discoveryReport.environment.platform,
            isWSL2: discoveryReport.environment.isWSL2,
            wsl2Info: discoveryReport.environment.wsl2Info,
          },
          clients: [] as any[],
          mcpServers: [] as any[],
          summary: {
            clientsDetected: 0,
            clientsMissing: 0,
            wsl2Detections: 0,
            configsValid: 0,
            configsInvalid: 0,
            mcpCommandsAvailable: 0,
            mcpCommandsMissing: 0,
          },
        };

        // Show environment info (if not JSON mode)
        if (!options.json && discoveryReport.environment.isWSL2) {
          output.info(chalk.bold('\nEnvironment:\n'));
          console.log(
            `  Platform: ${chalk.cyan('WSL2')} (${discoveryReport.environment.wsl2Info?.distroName || 'Unknown'})`,
          );
          if (discoveryReport.environment.wsl2Info?.windowsUserProfile) {
            console.log(
              `  Windows User: ${chalk.dim(discoveryReport.environment.wsl2Info.windowsUserProfile)}`,
            );
          }
          console.log('');
        }

        // Check all clients
        if (!options.json) {
          output.info(chalk.bold('Checking client installations...\n'));
        }

        for (const clientDiscovery of discoveryReport.clients) {
          const clientName = clientDiscovery.client;
          const detection = clientDiscovery.detection;
          const adapter = adapterRegistry.get(clientName);

          const configPath = adapter?.detectConfigPath(
            platform,
            projectRoot || undefined,
          );
          const configPathStr =
            typeof configPath === 'string'
              ? configPath
              : configPath?.user || undefined;

          const configValid = configPathStr
            ? await validateConfigFile(configPathStr, filesystem)
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
            source: clientDiscovery.source,
            environment: clientDiscovery.environment,
            windowsPath: clientDiscovery.windowsPath,
          };

          results.clients.push(clientResult);

          // Update summary
          if (detection.status === 'found') {
            results.summary.clientsDetected++;
            if (clientDiscovery.source === 'wsl2-fallback') {
              results.summary.wsl2Detections++;
            }
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

              // Show WSL2 tag for Windows detections
              const wsl2Tag =
                clientDiscovery.source === 'wsl2-fallback'
                  ? chalk.cyan(' [WSL2: Windows]')
                  : '';

              output.success(
                `${chalk.green('✓')} ${chalk.bold(clientName)}${versionStr}${wsl2Tag} - ${chalk.dim(pathStr)}`,
              );

              if (configPathStr) {
                const configStatus = configValid
                  ? chalk.green('valid')
                  : chalk.yellow('invalid');
                console.log(`  Config: ${configPathStr} (${configStatus})`);
              }

              // Show Windows path for WSL2 detections
              if (clientDiscovery.windowsPath && options.verbose) {
                console.log(
                  `  ${chalk.dim('Windows path:')} ${chalk.dim(clientDiscovery.windowsPath)}`,
                );
              }

              // Show warnings
              if (detection.warnings.length > 0 && options.verbose) {
                detection.warnings.forEach((warning) => {
                  output.warn(`  ${chalk.yellow('⚠')} ${warning}`);
                });
              }
            } else if (detection.status === 'not-found') {
              output.error(
                `${chalk.red('✗')} ${chalk.bold(clientName)} - not installed`,
              );

              // Show recommendation
              const recommendation = getInstallRecommendation(clientName);
              if (recommendation) {
                console.log(`  ${chalk.dim('→')} ${chalk.dim(recommendation)}`);
              }
            } else {
              // Skipped
              console.log(
                `${chalk.gray('○')} ${chalk.bold(clientName)} - ${chalk.dim('skipped')}`,
              );
            }

            console.log(''); // Blank line
          }
        }

        // Check MCP servers - get sources to show where each MCP comes from
        const mcpSources = configLoader.getMcpSources(
          userConfig,
          projectConfig,
        );
        const mergedConfig = configLoader.mergeConfigs(
          userConfig,
          projectConfig,
        );
        const mcpConfig = mergedConfig?.mcp || {};

        if (Object.keys(mcpConfig).length > 0) {
          if (!options.json) {
            output.info(chalk.bold('Checking MCP servers...\n'));
          }

          for (const [mcpName, mcpDef] of Object.entries(mcpConfig)) {
            const commandExists = await process.commandExists(mcpDef.command);
            const source = mcpSources[mcpName] || 'unknown';

            const mcpResult = {
              name: mcpName,
              command: mcpDef.command,
              available: commandExists,
              source,
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
              const sourceTag = options.verbose
                ? chalk.dim(` [${source}]`)
                : '';

              if (commandExists) {
                output.success(
                  `${chalk.green('✓')} ${chalk.bold(mcpName)}${sourceTag} - ${chalk.dim(mcpDef.command)} ${chalk.dim('(found)')}`,
                );
              } else {
                output.warn(
                  `${chalk.yellow('⚠')} ${chalk.bold(mcpName)}${sourceTag} - ${chalk.dim(mcpDef.command)} ${chalk.yellow('(not found)')}`,
                );

                // Show recommendation
                const recommendation = getMcpInstallRecommendation(
                  mcpDef.command,
                );
                if (recommendation) {
                  console.log(
                    `  ${chalk.dim('→')} ${chalk.dim(recommendation)}`,
                  );
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
          output.info(chalk.bold('Summary:\n'));
          console.log(
            `  Clients detected: ${chalk.green(results.summary.clientsDetected)} / ${ALL_CLIENTS.length}`,
          );
          console.log(
            `  Clients missing:  ${chalk.red(results.summary.clientsMissing)}`,
          );

          // Show WSL2 detections if any
          if (results.summary.wsl2Detections > 0) {
            console.log(
              `  WSL2 detections:  ${chalk.cyan(results.summary.wsl2Detections)}`,
            );
          }

          console.log(
            `  Configs valid:    ${chalk.green(results.summary.configsValid)}`,
          );
          if (results.summary.configsInvalid > 0) {
            console.log(
              `  Configs invalid:  ${chalk.yellow(results.summary.configsInvalid)}`,
            );
          }

          if (results.mcpServers.length > 0) {
            console.log('');
            console.log(
              `  MCP commands available: ${chalk.green(results.summary.mcpCommandsAvailable)} / ${results.mcpServers.length}`,
            );
            if (results.summary.mcpCommandsMissing > 0) {
              console.log(
                `  MCP commands missing:   ${chalk.yellow(results.summary.mcpCommandsMissing)}`,
              );
            }
          }

          console.log('');
        }

        // Success - return normally (main.ts handles exit code)
      } catch (error) {
        const formatted = ErrorHandler.formatError(error);
        ErrorHandler.logError(formatted);
        throw error; // Re-throw to let main.ts handle exit code
      }
    });

  return command;
}

/**
 * Get installation recommendation for a client
 */
function getInstallRecommendation(client: ClientName): string | null {
  const recommendations: Record<ClientName, string> = {
    'claude-code': 'Install Claude Code CLI: https://claude.com/claude-code',
    'copilot-cli': 'Install GitHub Copilot CLI: npm install -g @github/copilot',
    opencode: 'Install OpenCode: https://opencode.ai',
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
