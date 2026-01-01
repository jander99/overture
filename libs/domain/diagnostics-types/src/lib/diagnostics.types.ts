/**
 * @overture/diagnostics-types
 *
 * Type definitions for diagnostic checks and results.
 * Zero runtime dependencies - types only.
 */

import type { Platform } from '@overture/config-types';

/**
 * Environment check result (platform, WSL2 detection)
 */
export interface EnvironmentCheckResult {
  platform: Platform;
  isWSL2: boolean;
  wsl2Info?: {
    distroName?: string;
    windowsUserProfile?: string;
  };
}

/**
 * Config repository check result
 */
export interface ConfigRepoCheckResult {
  configRepoPath: string;
  skillsPath: string;
  configRepoExists: boolean;
  skillsDirExists: boolean;
}

/**
 * Git repository check result
 */
export interface GitCheckResult {
  isGitRepo: boolean;
  gitRemote: string | null;
  localHash: string | null;
  remoteHash: string | null;
  gitInSync: boolean;
}

/**
 * Skills directory check result
 */
export interface SkillsCheckResult {
  skillsPath: string;
  skillsDirExists: boolean;
  skillCount: number;
}

/**
 * Agent sync status information
 */
export interface AgentSyncStatus {
  /**
   * Whether sync has been initialized (at least one sync operation occurred)
   */
  isInitialized: boolean;

  /**
   * Agent names found in global directory
   */
  globalAgents: string[];

  /**
   * Agent names found in project directory
   */
  projectAgents: string[];

  /**
   * Agents that exist in both global and project with matching content
   */
  inSync: string[];

  /**
   * Agents that exist in both but have different content
   */
  outOfSync: string[];

  /**
   * Agents that only exist in global (not yet synced to project)
   */
  onlyInGlobal: string[];

  /**
   * Agents that only exist in project (not in global - may be custom)
   */
  onlyInProject: string[];
}

/**
 * Agents directory check result
 */
export interface AgentsCheckResult {
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
  syncStatus?: AgentSyncStatus;
}

/**
 * Single client check result
 */
export interface ClientCheckResult {
  client: string;
  status: 'found' | 'not-found' | 'skipped';
  binaryPath?: string;
  appBundlePath?: string;
  version?: string;
  configPath?: string;
  configValid: boolean;
  warnings?: string[];
  source?: string;
  environment?: string;
  windowsPath?: string;
}

/**
 * All clients check result
 */
export interface ClientsCheckResult {
  clients: ClientCheckResult[];
  summary: {
    clientsDetected: number;
    clientsMissing: number;
    wsl2Detections: number;
    configsValid: number;
    configsInvalid: number;
  };
}

/**
 * Single MCP server check result
 */
export interface McpServerCheckResult {
  name: string;
  command: string;
  available: boolean;
  source: string;
}

/**
 * All MCP servers check result
 */
export interface McpCheckResult {
  mcpServers: McpServerCheckResult[];
  summary: {
    mcpCommandsAvailable: number;
    mcpCommandsMissing: number;
  };
}

/**
 * Overall diagnostics summary
 */
export interface DiagnosticsSummary {
  clientsDetected: number;
  clientsMissing: number;
  wsl2Detections: number;
  configsValid: number;
  configsInvalid: number;
  mcpCommandsAvailable: number;
  mcpCommandsMissing: number;
  globalAgents: number;
  projectAgents: number;
  agentErrors: number;
  agentsInSync?: number;
  agentsNeedSync?: number;
}

/**
 * Complete diagnostics result
 */
export interface DiagnosticsResult {
  environment: EnvironmentCheckResult;
  configRepo: ConfigRepoCheckResult & {
    git: GitCheckResult;
    skills: SkillsCheckResult;
    agents: AgentsCheckResult;
  };
  clients: ClientsCheckResult;
  mcpServers: McpCheckResult;
  summary: DiagnosticsSummary;
}

/**
 * Diagnostics options
 */
export interface DiagnosticsOptions {
  wsl2?: boolean;
  verbose?: boolean;
  json?: boolean;
}
