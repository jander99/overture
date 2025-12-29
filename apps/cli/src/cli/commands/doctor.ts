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
  filesystem: {
    exists(path: string): Promise<boolean>;
    readFile(path: string): Promise<string>;
  },
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
 * Check if config repo exists and get its path
 */
async function checkConfigRepository(
  filesystem: {
    exists(path: string): Promise<boolean>;
  },
  environment: {
    homedir(): string;
  },
): Promise<{
  configRepoPath: string;
  skillsPath: string;
  configRepoExists: boolean;
  skillsDirExists: boolean;
}> {
  const homeDir = environment.homedir();
  const configRepoPath = `${homeDir}/.config/overture`;
  const skillsPath = `${configRepoPath}/skills`;
  const configRepoExists = await filesystem.exists(configRepoPath);
  const skillsDirExists = await filesystem.exists(skillsPath);

  return {
    configRepoPath,
    skillsPath,
    configRepoExists,
    skillsDirExists,
  };
}

/**
 * Get git remote origin URL
 */
async function getGitRemote(
  configRepoPath: string,
  process: {
    exec(
      cmd: string,
      args: string[],
    ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  },
): Promise<string | null> {
  try {
    const remoteResult = await process.exec('git', [
      '-C',
      configRepoPath,
      'remote',
      'get-url',
      'origin',
    ]);
    if (remoteResult.exitCode === 0 && remoteResult.stdout.trim()) {
      return remoteResult.stdout.trim();
    }
  } catch {
    // Ignore errors - remote might not be configured
  }
  return null;
}

/**
 * Get local git HEAD hash
 */
async function getLocalHash(
  configRepoPath: string,
  process: {
    exec(
      cmd: string,
      args: string[],
    ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  },
): Promise<string | null> {
  try {
    const localResult = await process.exec('git', [
      '-C',
      configRepoPath,
      'rev-parse',
      'HEAD',
    ]);
    if (localResult.exitCode === 0 && localResult.stdout.trim()) {
      return localResult.stdout.trim();
    }
  } catch {
    // Ignore errors - might not have any commits
  }
  return null;
}

/**
 * Get remote git HEAD hash and check sync status
 */
async function getRemoteHashAndSyncStatus(
  configRepoPath: string,
  gitRemote: string | null,
  localHash: string | null,
  process: {
    exec(
      cmd: string,
      args: string[],
    ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  },
): Promise<{ remoteHash: string | null; gitInSync: boolean }> {
  let remoteHash: string | null = null;
  let gitInSync = false;

  if (!gitRemote || !localHash) {
    return { remoteHash, gitInSync };
  }

  try {
    const lsRemoteResult = await process.exec('git', [
      '-C',
      configRepoPath,
      'ls-remote',
      'origin',
      'HEAD',
    ]);
    if (lsRemoteResult.exitCode === 0 && lsRemoteResult.stdout.trim()) {
      const match = lsRemoteResult.stdout.trim().split(/\s+/);
      if (match.length > 0) {
        remoteHash = match[0];
        gitInSync = localHash === remoteHash;
      }
    }
  } catch {
    // Ignore errors - remote might not be accessible
  }

  return { remoteHash, gitInSync };
}

/**
 * Check git repository status, remote, and sync state
 */
async function checkGitRepository(
  configRepoPath: string,
  configRepoExists: boolean,
  filesystem: {
    exists(path: string): Promise<boolean>;
  },
  process: {
    exec(
      cmd: string,
      args: string[],
    ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  },
): Promise<{
  isGitRepo: boolean;
  gitRemote: string | null;
  localHash: string | null;
  remoteHash: string | null;
  gitInSync: boolean;
}> {
  if (!configRepoExists) {
    return {
      isGitRepo: false,
      gitRemote: null,
      localHash: null,
      remoteHash: null,
      gitInSync: false,
    };
  }

  const gitDirPath = `${configRepoPath}/.git`;
  const isGitRepo = await filesystem.exists(gitDirPath);

  if (!isGitRepo) {
    return {
      isGitRepo: false,
      gitRemote: null,
      localHash: null,
      remoteHash: null,
      gitInSync: false,
    };
  }

  const gitRemote = await getGitRemote(configRepoPath, process);
  const localHash = await getLocalHash(configRepoPath, process);
  const { remoteHash, gitInSync } = await getRemoteHashAndSyncStatus(
    configRepoPath,
    gitRemote,
    localHash,
    process,
  );

  return {
    isGitRepo,
    gitRemote,
    localHash,
    remoteHash,
    gitInSync,
  };
}

/**
 * Count skills in skills directory
 */
async function countSkills(
  skillsPath: string,
  skillsDirExists: boolean,
  filesystem: {
    readdir(path: string): Promise<string[]>;
    stat(path: string): Promise<{
      isDirectory(): boolean;
      isFile(): boolean;
    }>;
    exists(path: string): Promise<boolean>;
  },
): Promise<number> {
  let skillCount = 0;

  if (!skillsDirExists) {
    return skillCount;
  }

  try {
    const entries = await filesystem.readdir(skillsPath);
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

  return skillCount;
}

/**
 * Check all installed clients
 */
async function checkClients(
  discoveryReport: {
    clients: Array<{
      client: ClientName;
      detection: {
        status: string;
        binaryPath?: string;
        appBundlePath?: string;
        version?: string;
        warnings: string[];
      };
      source: string;
      environment?: string;
      windowsPath?: string;
    }>;
  },
  adapterRegistry: {
    get(clientName: ClientName): unknown;
  },
  platform: Platform,
  projectRoot: string | null,
  filesystem: {
    exists(path: string): Promise<boolean>;
    readFile(path: string): Promise<string>;
  },
): Promise<{
  clients: Array<{
    client: string;
    status: string;
    binaryPath?: string;
    appBundlePath?: string;
    version?: string;
    configPath?: string;
    configValid: boolean;
    warnings?: string[];
    source?: string;
    environment?: string;
    windowsPath?: string;
  }>;
  summary: {
    clientsDetected: number;
    clientsMissing: number;
    wsl2Detections: number;
    configsValid: number;
    configsInvalid: number;
  };
}> {
  const clients: Array<{
    client: string;
    status: string;
    binaryPath?: string;
    appBundlePath?: string;
    version?: string;
    configPath?: string;
    configValid: boolean;
    warnings?: string[];
    source?: string;
    environment?: string;
    windowsPath?: string;
  }> = [];

  const summary = {
    clientsDetected: 0,
    clientsMissing: 0,
    wsl2Detections: 0,
    configsValid: 0,
    configsInvalid: 0,
  };

  for (const clientDiscovery of discoveryReport.clients) {
    const clientName = clientDiscovery.client;
    const detection = clientDiscovery.detection;
    const adapter = adapterRegistry.get(clientName);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- adapter is dynamic interface
    const configPath = (adapter as any)?.detectConfigPath?.(
      platform,
      projectRoot || undefined,
    );
    const configPathStr =
      typeof configPath === 'string'
        ? configPath
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- configPath is dynamic interface
          (configPath as any)?.user || undefined;

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

    clients.push(clientResult);

    // Update summary
    if (detection.status === 'found') {
      summary.clientsDetected++;
      if (clientDiscovery.source === 'wsl2-fallback') {
        summary.wsl2Detections++;
      }
    } else if (detection.status === 'not-found') {
      summary.clientsMissing++;
    }

    if (configValid) {
      summary.configsValid++;
    } else if (configPathStr) {
      summary.configsInvalid++;
    }
  }

  return {
    clients,
    summary,
  };
}

/**
 * Check all MCP servers
 */
async function checkMcpServers(
  mergedConfig: unknown,
  mcpSources: Record<string, string>,
  process: {
    commandExists(command: string): Promise<boolean>;
  },
): Promise<{
  mcpServers: Array<{
    name: string;
    command: string;
    available: boolean;
    source: string;
  }>;
  summary: {
    mcpCommandsAvailable: number;
    mcpCommandsMissing: number;
  };
}> {
  const mcpServers: Array<{
    name: string;
    command: string;
    available: boolean;
    source: string;
  }> = [];

  const summary = {
    mcpCommandsAvailable: 0,
    mcpCommandsMissing: 0,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mergedConfig is dynamic configuration object
  const mcpConfig = (mergedConfig as any)?.mcp || {};

  for (const [mcpName, mcpDef] of Object.entries(mcpConfig)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mcpDef is dynamic configuration object
    const commandExists = await process.commandExists((mcpDef as any).command);
    const source = Object.hasOwn(mcpSources, mcpName)
      ? // eslint-disable-next-line security/detect-object-injection
        mcpSources[mcpName]
      : 'unknown';

     
    const mcpResult = {
      name: mcpName,
      command: (mcpDef as any).command,
      available: commandExists,
      source,
    };

    mcpServers.push(mcpResult);

    // Update summary
    if (commandExists) {
      summary.mcpCommandsAvailable++;
    } else {
      summary.mcpCommandsMissing++;
    }
  }

  return {
    mcpServers,
    summary,
  };
}

/**
 * Output environment information to console
 */
function outputEnvironment(
  discoveryReport: {
    environment: {
      platform: Platform;
      isWSL2: boolean;
      wsl2Info?: {
        distroName?: string;
        windowsUserProfile?: string;
      };
    };
  },
  output: {
    info(message: string): void;
  },
): void {
  if (discoveryReport.environment.isWSL2) {
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
}

/**
 * Output config repository status to console
 */
function outputConfigRepoStatus(
  configRepoPath: string,
  configRepoExists: boolean,
  skillsPath: string,
  skillsDirExists: boolean,
  skillCount: number,
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  output: {
    success(message: string): void;
    warn(message: string): void;
    info(message: string): void;
  },
): void {
  output.info(chalk.bold('Checking config repository...\n'));

  if (configRepoExists) {
    output.success(
      `${chalk.green('✓')} Config repo - ${chalk.dim(configRepoPath)}`,
    );

    // Git repo status
    if (isGitRepo) {
      const hashShort = localHash ? localHash.substring(0, 7) : 'unknown';
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
          output.warn(`      ${chalk.yellow('⚠')} Remote HEAD not available`);
          console.log(
            `        ${chalk.dim('→')} ${chalk.dim('Run: git push -u origin main')}`,
          );
        }
      } else {
        output.warn(`    ${chalk.yellow('⚠')} No git remote configured`);
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

/**
 * Output client detection results to console
 */
function outputClientResults(
  clients: Array<{
    client: string;
    status: string;
    binaryPath?: string;
    appBundlePath?: string;
    version?: string;
    configPath?: string;
    configValid: boolean;
    warnings?: string[];
    source?: string;
    environment?: string;
    windowsPath?: string;
  }>,
  output: {
    success(message: string): void;
    error(message: string): void;
    warn(message: string): void;
    info(message: string): void;
  },
  verbose: boolean,
): void {
  output.info(chalk.bold('Checking client installations...\n'));

  for (const client of clients) {
    if (client.status === 'found') {
      const versionStr = client.version
        ? chalk.dim(` (${client.version})`)
        : '';
      const pathStr = client.binaryPath || client.appBundlePath;

      // Show WSL2 tag for Windows detections
      const wsl2Tag =
        client.source === 'wsl2-fallback' ? chalk.cyan(' [WSL2: Windows]') : '';

      output.success(
        `${chalk.green('✓')} ${chalk.bold(client.client)}${versionStr}${wsl2Tag} - ${chalk.dim(pathStr)}`,
      );

      if (client.configPath) {
        const configStatus = client.configValid
          ? chalk.green('valid')
          : chalk.yellow('invalid');
        console.log(`  Config: ${client.configPath} (${configStatus})`);
      }

      // Show Windows path for WSL2 detections
      if (client.windowsPath && verbose) {
        console.log(
          `  ${chalk.dim('Windows path:')} ${chalk.dim(client.windowsPath)}`,
        );
      }

      // Show warnings
      if ((client.warnings || []).length > 0 && verbose) {
        (client.warnings || []).forEach((warning) => {
          output.warn(`  ${chalk.yellow('⚠')} ${warning}`);
        });
      }
    } else if (client.status === 'not-found') {
      output.error(
        `${chalk.red('✗')} ${chalk.bold(client.client)} - not installed`,
      );

      // Show recommendation
      const recommendation = getInstallRecommendation(
        client.client as ClientName,
      );
      if (recommendation) {
        console.log(`  ${chalk.dim('→')} ${chalk.dim(recommendation)}`);
      }
    } else {
      // Skipped
      console.log(
        `${chalk.gray('○')} ${chalk.bold(client.client)} - ${chalk.dim('skipped')}`,
      );
    }

    console.log(''); // Blank line
  }
}

/**
 * Output MCP server results to console
 */
function outputMcpResults(
  mcpServers: Array<{
    name: string;
    command: string;
    available: boolean;
    source: string;
  }>,
  output: {
    success(message: string): void;
    warn(message: string): void;
    info(message: string): void;
  },
  verbose: boolean,
): void {
  if (mcpServers.length === 0) {
    return;
  }

  output.info(chalk.bold('Checking MCP servers...\n'));

  for (const mcp of mcpServers) {
    const sourceTag = verbose ? chalk.dim(` [${mcp.source}]`) : '';

    if (mcp.available) {
      output.success(
        `${chalk.green('✓')} ${chalk.bold(mcp.name)}${sourceTag} - ${chalk.dim(mcp.command)} ${chalk.dim('(found)')}`,
      );
    } else {
      output.warn(
        `${chalk.yellow('⚠')} ${chalk.bold(mcp.name)}${sourceTag} - ${chalk.dim(mcp.command)} ${chalk.yellow('(not found)')}`,
      );

      // Show recommendation
      const recommendation = getMcpInstallRecommendation(mcp.command);
      if (recommendation) {
        console.log(`  ${chalk.dim('→')} ${chalk.dim(recommendation)}`);
      }
    }
  }
}

/**
 * Output summary to console
 */
function outputSummary(
  configRepoExists: boolean,
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  skillsDirExists: boolean,
  skillCount: number,
  clientsDetected: number,
  clientsMissing: number,
  wsl2Detections: number,
  configsValid: number,
  configsInvalid: number,
  mcpCommandsAvailable: number,
  mcpCommandsMissing: number,
  totalMcpServers: number,
  output: {
    info(message: string): void;
  },
): void {
  console.log('');
  output.info(chalk.bold('Summary:\n'));

  // Config repo status
  const configRepoStatus = configRepoExists
    ? chalk.green('exists')
    : chalk.yellow('not found');
  console.log(`  Config repo:      ${configRepoStatus}`);
  if (configRepoExists) {
    const gitRepoStatus = isGitRepo ? chalk.green('yes') : chalk.yellow('no');
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
        ? chalk.dim(` (${skillCount} skill${skillCount === 1 ? '' : 's'})`)
        : '';
    console.log(`  Skills directory: ${skillsStatus}${skillCountStr}`);
  }
  console.log('');

  console.log(
    `  Clients detected: ${chalk.green(clientsDetected)} / ${ALL_CLIENTS.length}`,
  );
  console.log(`  Clients missing:  ${chalk.red(clientsMissing)}`);

  // Show WSL2 detections if any
  if (wsl2Detections > 0) {
    console.log(`  WSL2 detections:  ${chalk.cyan(wsl2Detections)}`);
  }

  console.log(`  Configs valid:    ${chalk.green(configsValid)}`);
  if (configsInvalid > 0) {
    console.log(`  Configs invalid:  ${chalk.yellow(configsInvalid)}`);
  }

  if (totalMcpServers > 0) {
    console.log('');
    console.log(
      `  MCP commands available: ${chalk.green(mcpCommandsAvailable)} / ${totalMcpServers}`,
    );
    if (mcpCommandsMissing > 0) {
      console.log(
        `  MCP commands missing:   ${chalk.yellow(mcpCommandsMissing)}`,
      );
    }
  }

  console.log('');
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
        const projectRoot = await pathResolver.findProjectRoot();
        const userConfig = await configLoader.loadUserConfig();
        const projectConfig = projectRoot
          ? await configLoader.loadProjectConfig(projectRoot)
          : null;

        const adapters = ALL_CLIENTS.map((clientName) =>
          adapterRegistry.get(clientName),
        ).filter(
          (
            adapter,
          ): adapter is import('@overture/client-adapters').ClientAdapter =>
            adapter !== undefined,
        );

        const discoveryReport = await discoveryService.discoverAll(adapters);

        // Check config repo
        const {
          configRepoPath,
          skillsPath,
          configRepoExists,
          skillsDirExists,
        } = await checkConfigRepository(filesystem, environment);

        // Check git repository
        const { isGitRepo, gitRemote, localHash, remoteHash, gitInSync } =
          await checkGitRepository(
            configRepoPath,
            configRepoExists,
            filesystem,
            process,
          );

        // Count skills
        const skillCount = await countSkills(
          skillsPath,
          skillsDirExists,
          filesystem,
        );

        // Check clients
        const clientsData = await checkClients(
          discoveryReport,
          adapterRegistry,
          platform,
          projectRoot,
          filesystem,
        );

        // Check MCP servers
        const mcpSources = configLoader.getMcpSources(
          userConfig,
          projectConfig,
        );
        const mergedConfig = configLoader.mergeConfigs(
          userConfig,
          projectConfig,
        );
        const mcpData = await checkMcpServers(
          mergedConfig,
          mcpSources,
          process,
        );

        // Build results object
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
          clients: clientsData.clients,
          mcpServers: mcpData.mcpServers,
          summary: {
            clientsDetected: clientsData.summary.clientsDetected,
            clientsMissing: clientsData.summary.clientsMissing,
            wsl2Detections: clientsData.summary.wsl2Detections,
            configsValid: clientsData.summary.configsValid,
            configsInvalid: clientsData.summary.configsInvalid,
            mcpCommandsAvailable: mcpData.summary.mcpCommandsAvailable,
            mcpCommandsMissing: mcpData.summary.mcpCommandsMissing,
          },
        };

        // Output to console or JSON
        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          outputEnvironment(discoveryReport, output);
          outputConfigRepoStatus(
            configRepoPath,
            configRepoExists,
            skillsPath,
            skillsDirExists,
            skillCount,
            isGitRepo,
            gitRemote,
            localHash,
            remoteHash,
            gitInSync,
            output,
          );
          outputClientResults(clientsData.clients, output, options.verbose);
          outputMcpResults(mcpData.mcpServers, output, options.verbose);
          outputSummary(
            configRepoExists,
            isGitRepo,
            gitRemote,
            localHash,
            remoteHash,
            gitInSync,
            skillsDirExists,
            skillCount,
            clientsData.summary.clientsDetected,
            clientsData.summary.clientsMissing,
            clientsData.summary.wsl2Detections,
            clientsData.summary.configsValid,
            clientsData.summary.configsInvalid,
            mcpData.summary.mcpCommandsAvailable,
            mcpData.summary.mcpCommandsMissing,
            mcpData.mcpServers.length,
            output,
          );
        }
      } catch (error) {
        const formatted = ErrorHandler.formatError(error);
        ErrorHandler.logError(formatted);
        throw error;
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

  return Object.hasOwn(recommendations, client)
    ? // eslint-disable-next-line security/detect-object-injection
      recommendations[client]
    : null;
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
