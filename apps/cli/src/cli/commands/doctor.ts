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
import type {
  Platform,
  ClientName,
  OvertureConfig,
} from '@overture/config-types';
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
 * Check agent directories and validate agent files
 */
async function checkAgents(
  configRepoPath: string,
  configRepoExists: boolean,
  projectRoot: string | null,
  filesystem: {
    exists(path: string): Promise<boolean>;
    readdir(path: string): Promise<string[]>;
    readFile(path: string): Promise<string>;
  },
): Promise<{
  globalAgentsPath: string;
  globalAgentsDirExists: boolean;
  globalAgentCount: number;
  globalAgentErrors: string[];
  projectAgentsPath: string | null;
  projectAgentsDirExists: boolean;
  projectAgentCount: number;
  projectAgentErrors: string[];
  modelsConfigPath: string;
  modelsConfigExists: boolean;
  modelsConfigValid: boolean;
  modelsConfigError: string | null;
}> {
  const globalAgentsPath = `${configRepoPath}/agents`;
  const modelsConfigPath = `${configRepoPath}/models.yaml`;

  const globalAgentsDirExists =
    configRepoExists && (await filesystem.exists(globalAgentsPath));
  const modelsConfigExists =
    configRepoExists && (await filesystem.exists(modelsConfigPath));

  // Validate global agents
  const { agentCount: globalAgentCount, errors: globalAgentErrors } =
    await validateAgents(globalAgentsPath, globalAgentsDirExists, filesystem);

  // Validate project agents (if in a project)
  let projectAgentsPath: string | null = null;
  let projectAgentsDirExists = false;
  let projectAgentCount = 0;
  let projectAgentErrors: string[] = [];

  if (projectRoot) {
    projectAgentsPath = `${projectRoot}/.overture/agents`;
    projectAgentsDirExists = await filesystem.exists(projectAgentsPath);
    const projectAgentData = await validateAgents(
      projectAgentsPath,
      projectAgentsDirExists,
      filesystem,
    );
    projectAgentCount = projectAgentData.agentCount;
    projectAgentErrors = projectAgentData.errors;
  }

  // Validate models.yaml
  let modelsConfigValid = false;
  let modelsConfigError: string | null = null;

  if (modelsConfigExists) {
    try {
      const content = await filesystem.readFile(modelsConfigPath);
      // Try parsing as YAML
      const yaml = await import('js-yaml');
      const parsed = yaml.load(content);

      // Basic validation - should be an object
      if (typeof parsed !== 'object' || parsed === null) {
        modelsConfigError = 'models.yaml must contain a YAML object';
      } else {
        modelsConfigValid = true;
      }
    } catch (error) {
      modelsConfigError = (error as Error).message;
    }
  }

  return {
    globalAgentsPath,
    globalAgentsDirExists,
    globalAgentCount,
    globalAgentErrors,
    projectAgentsPath,
    projectAgentsDirExists,
    projectAgentCount,
    projectAgentErrors,
    modelsConfigPath,
    modelsConfigExists,
    modelsConfigValid,
    modelsConfigError,
  };
}

/**
 * Validate agent YAML/MD pairs in a directory
 */
async function validateAgents(
  agentsPath: string,
  agentsDirExists: boolean,
  filesystem: {
    readdir(path: string): Promise<string[]>;
    exists(path: string): Promise<boolean>;
    readFile(path: string): Promise<string>;
  },
): Promise<{ agentCount: number; errors: string[] }> {
  const errors: string[] = [];
  let agentCount = 0;

  if (!agentsDirExists) {
    return { agentCount, errors };
  }

  try {
    const files = await filesystem.readdir(agentsPath);
    const yamlFiles = files.filter(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
    );

    for (const yamlFile of yamlFiles) {
      const name = yamlFile.replace(/\.ya?ml$/, '');
      const mdFile = `${name}.md`;

      const yamlPath = `${agentsPath}/${yamlFile}`;
      const mdPath = `${agentsPath}/${mdFile}`;

      // Check if corresponding .md file exists
      const hasMdFile = await filesystem.exists(mdPath);
      if (!hasMdFile) {
        errors.push(`${yamlFile}: Missing corresponding ${mdFile} file`);
        continue;
      }

      // Validate YAML syntax
      try {
        const yamlContent = await filesystem.readFile(yamlPath);
        const yaml = await import('js-yaml');
        const parsed = yaml.load(yamlContent);

        // Basic validation - should have a 'name' field
        if (typeof parsed !== 'object' || parsed === null) {
          errors.push(`${yamlFile}: Invalid YAML structure`);
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(parsed as any).name) {
          errors.push(`${yamlFile}: Missing required 'name' field`);
          continue;
        }

        // Successfully validated
        agentCount++;
      } catch (error) {
        errors.push(`${yamlFile}: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    errors.push(`Failed to read agents directory: ${(error as Error).message}`);
  }

  return { agentCount, errors };
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
  mergedConfig: OvertureConfig | null,
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

  const mcpConfig = mergedConfig?.mcp || {};

  for (const [mcpName, mcpDef] of Object.entries(mcpConfig)) {
    const commandExists = await process.commandExists(mcpDef.command);
    const source = Object.hasOwn(mcpSources, mcpName)
      ? // eslint-disable-next-line security/detect-object-injection
        mcpSources[mcpName]
      : 'unknown';

    const mcpResult = {
      name: mcpName,
      command: mcpDef.command,
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
 * Display git sync status (in sync vs out of sync)
 */
function outputGitSyncStatus(
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  output: {
    success(message: string): void;
    warn(message: string): void;
  },
): void {
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
}

/**
 * Display git repository status (initialized, remote configured, etc.)
 */
function outputGitRepoStatus(
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  configRepoPath: string,
  output: {
    success(message: string): void;
    warn(message: string): void;
  },
): void {
  if (isGitRepo) {
    const hashShort = localHash ? localHash.substring(0, 7) : 'unknown';
    output.success(
      `  ${chalk.green('✓')} Git repository - ${chalk.dim('initialized')} ${chalk.dim(`(${hashShort})`)}`,
    );
    if (gitRemote) {
      output.success(
        `    ${chalk.green('✓')} Remote configured - ${chalk.dim(gitRemote)}`,
      );
      outputGitSyncStatus(localHash, remoteHash, gitInSync, output);
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
}

/**
 * Display skills directory status
 */
function outputSkillsStatus(
  skillsDirExists: boolean,
  skillsPath: string,
  skillCount: number,
  output: {
    success(message: string): void;
    warn(message: string): void;
  },
): void {
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
}

/**
 * Display agents directory status
 */
function outputAgentsStatus(
  agentsDirExists: boolean,
  agentsPath: string,
  agentCount: number,
  agentErrors: string[],
  scope: 'Global' | 'Project',
  output: {
    success(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  },
  verbose: boolean,
): void {
  if (agentsDirExists) {
    const agentCountStr =
      agentCount === 0
        ? chalk.yellow('no agents')
        : agentCount === 1
          ? chalk.green('1 agent')
          : chalk.green(`${agentCount} agents`);

    const hasErrors = agentErrors.length > 0;

    if (hasErrors) {
      output.warn(
        `  ${chalk.yellow('⚠')} ${scope} agents - ${chalk.dim(agentsPath)} ${chalk.dim(`(${agentCountStr}, ${chalk.yellow(agentErrors.length + ' error' + (agentErrors.length === 1 ? '' : 's'))})`)}`,
      );

      if (verbose) {
        agentErrors.forEach((error) => {
          console.log(`    ${chalk.red('✗')} ${chalk.dim(error)}`);
        });
      }
    } else {
      output.success(
        `  ${chalk.green('✓')} ${scope} agents - ${chalk.dim(agentsPath)} ${chalk.dim(`(${agentCountStr})`)}`,
      );
    }
  } else {
    output.warn(
      `  ${chalk.yellow('⚠')} ${scope} agents directory not found - ${chalk.dim(agentsPath)}`,
    );
    console.log(
      `    ${chalk.dim('→')} ${chalk.dim('Run: mkdir -p ' + agentsPath)}`,
    );
  }
}

/**
 * Display models.yaml status
 */
function outputModelsConfigStatus(
  modelsConfigExists: boolean,
  modelsConfigPath: string,
  modelsConfigValid: boolean,
  modelsConfigError: string | null,
  output: {
    success(message: string): void;
    warn(message: string): void;
  },
): void {
  if (modelsConfigExists) {
    if (modelsConfigValid) {
      output.success(
        `  ${chalk.green('✓')} Model mappings - ${chalk.dim(modelsConfigPath)}`,
      );
    } else {
      output.warn(
        `  ${chalk.yellow('⚠')} Model mappings - ${chalk.dim(modelsConfigPath)} ${chalk.yellow('(invalid)')}`,
      );
      if (modelsConfigError) {
        console.log(`    ${chalk.dim('→')} ${chalk.dim(modelsConfigError)}`);
      }
    }
  } else {
    output.warn(
      `  ${chalk.yellow('⚠')} Model mappings not found - ${chalk.dim(modelsConfigPath)}`,
    );
    console.log(
      `    ${chalk.dim('→')} ${chalk.dim('Optional: Create models.yaml to define agent model mappings')}`,
    );
  }
}

/**
 * Display config repository not found message
 */
function outputConfigRepoNotFound(
  configRepoPath: string,
  output: {
    warn(message: string): void;
  },
): void {
  output.warn(
    `${chalk.yellow('⚠')} Config repo not found - ${chalk.dim(configRepoPath)}`,
  );
  console.log(
    `  ${chalk.dim('→')} ${chalk.dim('Run: overture init to create config repo')}`,
  );
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
  globalAgentsPath: string,
  globalAgentsDirExists: boolean,
  globalAgentCount: number,
  globalAgentErrors: string[],
  modelsConfigPath: string,
  modelsConfigExists: boolean,
  modelsConfigValid: boolean,
  modelsConfigError: string | null,
  output: {
    success(message: string): void;
    warn(message: string): void;
    info(message: string): void;
    error(message: string): void;
  },
  verbose: boolean,
): void {
  output.info(chalk.bold('Checking config repository...\n'));

  if (configRepoExists) {
    output.success(
      `${chalk.green('✓')} Config repo - ${chalk.dim(configRepoPath)}`,
    );
    outputGitRepoStatus(
      isGitRepo,
      gitRemote,
      localHash,
      remoteHash,
      gitInSync,
      configRepoPath,
      output,
    );
    outputSkillsStatus(skillsDirExists, skillsPath, skillCount, output);
    outputAgentsStatus(
      globalAgentsDirExists,
      globalAgentsPath,
      globalAgentCount,
      globalAgentErrors,
      'Global',
      output,
      verbose,
    );
    outputModelsConfigStatus(
      modelsConfigExists,
      modelsConfigPath,
      modelsConfigValid,
      modelsConfigError,
      output,
    );
  } else {
    outputConfigRepoNotFound(configRepoPath, output);
  }

  console.log('');
}

/**
 * Output client config status
 */
function outputClientConfig(client: {
  configPath?: string;
  configValid: boolean;
}): void {
  if (client.configPath) {
    const configStatus = client.configValid
      ? chalk.green('valid')
      : chalk.yellow('invalid');
    console.log(`  Config: ${client.configPath} (${configStatus})`);
  }
}

/**
 * Output Windows path for WSL2 detections
 */
function outputWindowsPath(
  client: {
    windowsPath?: string;
  },
  verbose: boolean,
): void {
  if (client.windowsPath && verbose) {
    console.log(
      `  ${chalk.dim('Windows path:')} ${chalk.dim(client.windowsPath)}`,
    );
  }
}

/**
 * Output client warnings
 */
function outputClientWarnings(
  client: {
    warnings?: string[];
  },
  output: {
    warn(message: string): void;
  },
  verbose: boolean,
): void {
  if ((client.warnings || []).length > 0 && verbose) {
    (client.warnings || []).forEach((warning) => {
      output.warn(`  ${chalk.yellow('⚠')} ${warning}`);
    });
  }
}

/**
 * Output found client status
 */
function outputFoundClient(
  client: {
    client: string;
    version?: string;
    source?: string;
    binaryPath?: string;
    appBundlePath?: string;
    configPath?: string;
    configValid: boolean;
    windowsPath?: string;
    warnings?: string[];
  },
  output: {
    success(message: string): void;
    warn(message: string): void;
  },
  verbose: boolean,
): void {
  const versionStr = client.version ? chalk.dim(` (${client.version})`) : '';
  const pathStr = client.binaryPath || client.appBundlePath;
  const wsl2Tag =
    client.source === 'wsl2-fallback' ? chalk.cyan(' [WSL2: Windows]') : '';

  output.success(
    `${chalk.green('✓')} ${chalk.bold(client.client)}${versionStr}${wsl2Tag} - ${chalk.dim(pathStr)}`,
  );

  outputClientConfig(client);
  outputWindowsPath(client, verbose);
  outputClientWarnings(client, output, verbose);
}

/**
 * Output missing client status
 */
function outputMissingClient(
  client: {
    client: string;
  },
  output: {
    error(message: string): void;
  },
): void {
  output.error(
    `${chalk.red('✗')} ${chalk.bold(client.client)} - not installed`,
  );

  const recommendation = getInstallRecommendation(client.client as ClientName);
  if (recommendation) {
    console.log(`  ${chalk.dim('→')} ${chalk.dim(recommendation)}`);
  }
}

/**
 * Output skipped client status
 */
function outputSkippedClient(client: { client: string }): void {
  console.log(
    `${chalk.gray('○')} ${chalk.bold(client.client)} - ${chalk.dim('skipped')}`,
  );
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
    switch (client.status) {
      case 'found':
        outputFoundClient(client, output, verbose);
        break;
      case 'not-found':
        outputMissingClient(client, output);
        break;
      default:
        outputSkippedClient(client);
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
 * Output git sync summary
 */
function outputGitSyncSummary(
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
): void {
  if (gitRemote && localHash && remoteHash) {
    const syncStatus = gitInSync
      ? chalk.green('in sync')
      : chalk.yellow('out of sync');
    console.log(`  Git sync:         ${syncStatus}`);
  }
}

/**
 * Output git repository summary
 */
function outputGitRepoSummary(
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
): void {
  const gitRepoStatus = isGitRepo ? chalk.green('yes') : chalk.yellow('no');
  console.log(`  Git repository:   ${gitRepoStatus}`);
  if (isGitRepo) {
    const remoteStatus = gitRemote
      ? chalk.green('configured')
      : chalk.yellow('not configured');
    console.log(`  Git remote:       ${remoteStatus}`);
    outputGitSyncSummary(gitRemote, localHash, remoteHash, gitInSync);
  }
}

/**
 * Output skills directory summary
 */
function outputSkillsSummary(
  skillsDirExists: boolean,
  skillCount: number,
): void {
  const skillsStatus = skillsDirExists
    ? chalk.green('exists')
    : chalk.yellow('not found');
  const skillCountStr =
    skillsDirExists && skillCount > 0
      ? chalk.dim(` (${skillCount} skill${skillCount === 1 ? '' : 's'})`)
      : '';
  console.log(`  Skills directory: ${skillsStatus}${skillCountStr}`);
}

/**
 * Output agents summary
 */
function outputAgentsSummary(
  globalAgentsDirExists: boolean,
  globalAgentCount: number,
  globalAgentErrors: string[],
  projectAgentsDirExists: boolean,
  projectAgentCount: number,
  projectAgentErrors: string[],
  modelsConfigExists: boolean,
  modelsConfigValid: boolean,
): void {
  const globalAgentsStatus = globalAgentsDirExists
    ? chalk.green('exists')
    : chalk.yellow('not found');
  const globalAgentCountStr =
    globalAgentsDirExists && globalAgentCount > 0
      ? chalk.dim(
          ` (${globalAgentCount} agent${globalAgentCount === 1 ? '' : 's'})`,
        )
      : '';
  const globalErrorsStr =
    globalAgentErrors.length > 0
      ? chalk.yellow(
          ` - ${globalAgentErrors.length} error${globalAgentErrors.length === 1 ? '' : 's'}`,
        )
      : '';
  console.log(
    `  Global agents:    ${globalAgentsStatus}${globalAgentCountStr}${globalErrorsStr}`,
  );

  if (projectAgentsDirExists || projectAgentCount > 0) {
    const projectAgentsStatus = projectAgentsDirExists
      ? chalk.green('exists')
      : chalk.yellow('not found');
    const projectAgentCountStr =
      projectAgentsDirExists && projectAgentCount > 0
        ? chalk.dim(
            ` (${projectAgentCount} agent${projectAgentCount === 1 ? '' : 's'})`,
          )
        : '';
    const projectErrorsStr =
      projectAgentErrors.length > 0
        ? chalk.yellow(
            ` - ${projectAgentErrors.length} error${projectAgentErrors.length === 1 ? '' : 's'}`,
          )
        : '';
    console.log(
      `  Project agents:   ${projectAgentsStatus}${projectAgentCountStr}${projectErrorsStr}`,
    );
  }

  const modelsStatus = modelsConfigExists
    ? modelsConfigValid
      ? chalk.green('valid')
      : chalk.yellow('invalid')
    : chalk.dim('not configured');
  console.log(`  Model mappings:   ${modelsStatus}`);
}

/**
 * Output config repository summary
 */
function outputConfigRepoSummary(
  configRepoExists: boolean,
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  skillsDirExists: boolean,
  skillCount: number,
  globalAgentsDirExists: boolean,
  globalAgentCount: number,
  globalAgentErrors: string[],
  projectAgentsDirExists: boolean,
  projectAgentCount: number,
  projectAgentErrors: string[],
  modelsConfigExists: boolean,
  modelsConfigValid: boolean,
): void {
  const configRepoStatus = configRepoExists
    ? chalk.green('exists')
    : chalk.yellow('not found');
  console.log(`  Config repo:      ${configRepoStatus}`);
  if (configRepoExists) {
    outputGitRepoSummary(
      isGitRepo,
      gitRemote,
      localHash,
      remoteHash,
      gitInSync,
    );
    outputSkillsSummary(skillsDirExists, skillCount);
    outputAgentsSummary(
      globalAgentsDirExists,
      globalAgentCount,
      globalAgentErrors,
      projectAgentsDirExists,
      projectAgentCount,
      projectAgentErrors,
      modelsConfigExists,
      modelsConfigValid,
    );
  }
}

/**
 * Output clients summary
 */
function outputClientsSummary(
  clientsDetected: number,
  clientsMissing: number,
  wsl2Detections: number,
): void {
  console.log(
    `  Clients detected: ${chalk.green(clientsDetected)} / ${ALL_CLIENTS.length}`,
  );
  console.log(`  Clients missing:  ${chalk.red(clientsMissing)}`);

  if (wsl2Detections > 0) {
    console.log(`  WSL2 detections:  ${chalk.cyan(wsl2Detections)}`);
  }
}

/**
 * Output configs summary
 */
function outputConfigsSummary(
  configsValid: number,
  configsInvalid: number,
): void {
  console.log(`  Configs valid:    ${chalk.green(configsValid)}`);
  if (configsInvalid > 0) {
    console.log(`  Configs invalid:  ${chalk.yellow(configsInvalid)}`);
  }
}

/**
 * Output MCP servers summary
 */
function outputMcpSummary(
  totalMcpServers: number,
  mcpCommandsAvailable: number,
  mcpCommandsMissing: number,
): void {
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
  globalAgentsDirExists: boolean,
  globalAgentCount: number,
  globalAgentErrors: string[],
  projectAgentsDirExists: boolean,
  projectAgentCount: number,
  projectAgentErrors: string[],
  modelsConfigExists: boolean,
  modelsConfigValid: boolean,
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

  outputConfigRepoSummary(
    configRepoExists,
    isGitRepo,
    gitRemote,
    localHash,
    remoteHash,
    gitInSync,
    skillsDirExists,
    skillCount,
    globalAgentsDirExists,
    globalAgentCount,
    globalAgentErrors,
    projectAgentsDirExists,
    projectAgentCount,
    projectAgentErrors,
    modelsConfigExists,
    modelsConfigValid,
  );
  console.log('');

  outputClientsSummary(clientsDetected, clientsMissing, wsl2Detections);
  outputConfigsSummary(configsValid, configsInvalid);
  outputMcpSummary(totalMcpServers, mcpCommandsAvailable, mcpCommandsMissing);

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

        // Check agents
        const agentsData = await checkAgents(
          configRepoPath,
          configRepoExists,
          projectRoot,
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
            agentsDirectory: {
              global: {
                path: agentsData.globalAgentsPath,
                exists: agentsData.globalAgentsDirExists,
                agentCount: agentsData.globalAgentCount,
                errors: agentsData.globalAgentErrors,
              },
              project: projectRoot
                ? {
                    path: agentsData.projectAgentsPath,
                    exists: agentsData.projectAgentsDirExists,
                    agentCount: agentsData.projectAgentCount,
                    errors: agentsData.projectAgentErrors,
                  }
                : null,
            },
            modelsConfig: {
              path: agentsData.modelsConfigPath,
              exists: agentsData.modelsConfigExists,
              valid: agentsData.modelsConfigValid,
              error: agentsData.modelsConfigError,
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
            globalAgents: agentsData.globalAgentCount,
            projectAgents: agentsData.projectAgentCount,
            agentErrors:
              agentsData.globalAgentErrors.length +
              agentsData.projectAgentErrors.length,
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
            agentsData.globalAgentsPath,
            agentsData.globalAgentsDirExists,
            agentsData.globalAgentCount,
            agentsData.globalAgentErrors,
            agentsData.modelsConfigPath,
            agentsData.modelsConfigExists,
            agentsData.modelsConfigValid,
            agentsData.modelsConfigError,
            output,
            options.verbose,
          );
          if (projectRoot && agentsData.projectAgentsDirExists) {
            output.info(chalk.bold('Checking project agents...\n'));
            outputAgentsStatus(
              agentsData.projectAgentsDirExists,
              agentsData.projectAgentsPath!,
              agentsData.projectAgentCount,
              agentsData.projectAgentErrors,
              'Project',
              output,
              options.verbose,
            );
            console.log('');
          }
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
            agentsData.globalAgentsDirExists,
            agentsData.globalAgentCount,
            agentsData.globalAgentErrors,
            agentsData.projectAgentsDirExists,
            agentsData.projectAgentCount,
            agentsData.projectAgentErrors,
            agentsData.modelsConfigExists,
            agentsData.modelsConfigValid,
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
