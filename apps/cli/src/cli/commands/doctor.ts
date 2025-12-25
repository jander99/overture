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
    environment,
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
        const projectRoot = await pathResolver.findProjectRoot();

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

        // Check config repo
        const homeDir = environment.homedir();
        const configRepoPath = `${homeDir}/.config/overture`;
        const skillsPath = `${configRepoPath}/skills`;
        const configRepoExists = await filesystem.exists(configRepoPath);
        const skillsDirExists = await filesystem.exists(skillsPath);

        // Check if config repo is a git repository
        let isGitRepo = false;
        let gitRemote: string | null = null;
        let localHash: string | null = null;
        let remoteHash: string | null = null;
        let gitInSync = false;

        if (configRepoExists) {
          const gitDirPath = `${configRepoPath}/.git`;
          isGitRepo = await filesystem.exists(gitDirPath);

          // Check for git remote and hashes if it's a git repo
          if (isGitRepo) {
            try {
              const remoteResult = await process.exec('git', [
                '-C',
                configRepoPath,
                'remote',
                'get-url',
                'origin',
              ]);
              if (remoteResult.exitCode === 0 && remoteResult.stdout.trim()) {
                gitRemote = remoteResult.stdout.trim();
              }
            } catch {
              // Ignore errors - remote might not be configured
            }

            // Get local HEAD hash
            try {
              const localResult = await process.exec('git', [
                '-C',
                configRepoPath,
                'rev-parse',
                'HEAD',
              ]);
              if (localResult.exitCode === 0 && localResult.stdout.trim()) {
                localHash = localResult.stdout.trim();
              }
            } catch {
              // Ignore errors - might not have any commits
            }

            // Get remote HEAD hash if remote exists
            if (gitRemote && localHash) {
              try {
                // Use git ls-remote to get remote HEAD without fetching
                const lsRemoteResult = await process.exec('git', [
                  '-C',
                  configRepoPath,
                  'ls-remote',
                  'origin',
                  'HEAD',
                ]);
                if (
                  lsRemoteResult.exitCode === 0 &&
                  lsRemoteResult.stdout.trim()
                ) {
                  // Output format: "hash\tHEAD" or "hash\trefs/heads/main"
                  const match = lsRemoteResult.stdout.trim().split(/\s+/);
                  if (match.length > 0) {
                    remoteHash = match[0];
                    gitInSync = localHash === remoteHash;
                  }
                }
              } catch {
                // Ignore errors - remote might not be accessible
              }
            }
          }
        }

        // Count skills in skills directory
        let skillCount = 0;
        if (skillsDirExists) {
          try {
            const entries = await filesystem.readdir(skillsPath);
            // Count directories that contain SKILL.md
            for (const entry of entries) {
              const entryPath = `${skillsPath}/${entry}`;
              const stats = await filesystem.stat(entryPath);
              if (stats.isDirectory()) {
                const skillFile = `${entryPath}/SKILL.md`;
                const hasSkillFile = await filesystem.exists(skillFile);
                if (hasSkillFile) {
                  skillCount++;
                }
              }
            }
          } catch {
            // Ignore errors - directory might not be readable
          }
        }

        const results = {
          environment: {
            platform: discoveryReport.environment.platform,
            isWSL2: discoveryReport.environment.isWSL2,
            wsl2Info: discoveryReport.environment.wsl2Info,
          },
          configRepo: {
            path: configRepoPath,
            exists: configRepoExists,
            isGitRepo,
            gitRemote,
            localHash,
            remoteHash,
            gitInSync,
            skillsDirectory: {
              path: skillsPath,
              exists: skillsDirExists,
              skillCount,
            },
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

        // Show config repo status (if not JSON mode)
        if (!options.json) {
          output.info(chalk.bold('Checking config repository...\n'));
          if (configRepoExists) {
            output.success(
              `${chalk.green('✓')} Config repo - ${chalk.dim(configRepoPath)}`,
            );

            // Git repo status
            if (isGitRepo) {
              const hashShort = localHash
                ? localHash.substring(0, 7)
                : 'unknown';
              output.success(
                `  ${chalk.green('✓')} Git repository - ${chalk.dim('initialized')} ${chalk.dim(`(${hashShort})`)}`,
              );
              if (gitRemote) {
                output.success(
                  `    ${chalk.green('✓')} Remote configured - ${chalk.dim(gitRemote)}`,
                );

                // Show sync status if we have both hashes
                if (localHash && remoteHash) {
                  if (gitInSync) {
                    output.success(
                      `      ${chalk.green('✓')} In sync with remote ${chalk.dim(`(${remoteHash.substring(0, 7)})`)}`,
                    );
                  } else {
                    output.warn(
                      `      ${chalk.yellow('⚠')} Out of sync with remote ${chalk.dim(`(${remoteHash.substring(0, 7)})`)}`,
                    );
                    console.log(
                      `        ${chalk.dim('→')} ${chalk.dim('Run: git pull or git push')}`,
                    );
                  }
                } else if (localHash && !remoteHash) {
                  output.warn(
                    `      ${chalk.yellow('⚠')} Remote HEAD not available`,
                  );
                  console.log(
                    `        ${chalk.dim('→')} ${chalk.dim('Run: git push -u origin main')}`,
                  );
                }
              } else {
                output.warn(
                  `    ${chalk.yellow('⚠')} No git remote configured`,
                );
                console.log(
                  `      ${chalk.dim('→')} ${chalk.dim('Run: git remote add origin <url>')}`,
                );
              }
            } else {
              output.warn(`  ${chalk.yellow('⚠')} Not a git repository`);
              console.log(
                `    ${chalk.dim('→')} ${chalk.dim('Run: cd ' + configRepoPath + ' && git init')}`,
              );
            }

            // Skills directory
            if (skillsDirExists) {
              const skillCountStr =
                skillCount === 0
                  ? chalk.yellow('no skills')
                  : skillCount === 1
                    ? chalk.green('1 skill')
                    : chalk.green(`${skillCount} skills`);
              output.success(
                `  ${chalk.green('✓')} Skills directory - ${chalk.dim(skillsPath)} ${chalk.dim(`(${skillCountStr})`)}`,
              );
            } else {
              output.warn(
                `  ${chalk.yellow('⚠')} Skills directory not found - ${chalk.dim(skillsPath)}`,
              );
              console.log(
                `    ${chalk.dim('→')} ${chalk.dim('Run: mkdir -p ' + skillsPath)}`,
              );
            }
          } else {
            output.warn(
              `${chalk.yellow('⚠')} Config repo not found - ${chalk.dim(configRepoPath)}`,
            );
            console.log(
              `  ${chalk.dim('→')} ${chalk.dim('Run: overture init to create config repo')}`,
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

          // Config repo status
          const configRepoStatus = configRepoExists
            ? chalk.green('exists')
            : chalk.yellow('not found');
          console.log(`  Config repo:      ${configRepoStatus}`);
          if (configRepoExists) {
            const gitRepoStatus = isGitRepo
              ? chalk.green('yes')
              : chalk.yellow('no');
            console.log(`  Git repository:   ${gitRepoStatus}`);
            if (isGitRepo) {
              const remoteStatus = gitRemote
                ? chalk.green('configured')
                : chalk.yellow('not configured');
              console.log(`  Git remote:       ${remoteStatus}`);

              if (gitRemote && localHash && remoteHash) {
                const syncStatus = gitInSync
                  ? chalk.green('in sync')
                  : chalk.yellow('out of sync');
                console.log(`  Git sync:         ${syncStatus}`);
              }
            }
            const skillsStatus = skillsDirExists
              ? chalk.green('exists')
              : chalk.yellow('not found');
            const skillCountStr =
              skillsDirExists && skillCount > 0
                ? chalk.dim(
                    ` (${skillCount} skill${skillCount === 1 ? '' : 's'})`,
                  )
                : '';
            console.log(`  Skills directory: ${skillsStatus}${skillCountStr}`);
          }
          console.log('');

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
