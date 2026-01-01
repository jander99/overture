/**
 * Diagnostic Types
 *
 * Type definitions for system diagnostics including clients, git, agents, and MCP servers.
 *
 * @module @overture/diagnostics-core/types
 */

import type { ClientName, Platform } from '@overture/config-types';

/**
 * Environment information
 */
export interface EnvironmentInfo {
  platform: Platform;
  wsl2: boolean;
  projectRoot: string | null;
  userConfigPath: string;
  projectConfigPath: string | null;
}

/**
 * Client detection result
 */
export interface ClientDetection {
  binaryPath?: string;
  appBundlePath?: string;
  version: string | null;
  source: 'native' | 'config-override' | 'wsl2-fallback';
  environment?: 'wsl2';
  windowsPath?: string;
  warnings: string[];
}

/**
 * Config file validation result
 */
export interface ConfigCheckResult {
  path: string;
  valid: boolean;
  error?: string;
}

/**
 * Complete client check result
 */
export interface ClientCheckResult {
  client: ClientName;
  status: 'detected' | 'missing';
  detection: ClientDetection | null;
  config: ConfigCheckResult | null;
}

/**
 * Git sync status
 */
export interface GitSyncStatus {
  localHash: string;
  remoteHash: string;
  inSync: boolean;
}

/**
 * Git repository check result
 */
export interface GitRepoCheckResult {
  exists: boolean;
  isGitRepo: boolean;
  remote: string | null;
  syncStatus: GitSyncStatus | null;
}

/**
 * Skills directory check result
 */
export interface SkillsCheckResult {
  exists: boolean;
  path: string;
  count: number;
}

/**
 * Agents directory check result
 */
export interface AgentsCheckResult {
  scope: 'global' | 'project';
  exists: boolean;
  path: string;
  count: number;
  errors: string[];
}

/**
 * Models configuration check result
 */
export interface ModelsCheckResult {
  exists: boolean;
  path: string;
  valid: boolean;
  error: string | null;
}

/**
 * Config repository check result
 */
export interface ConfigRepoCheckResult {
  exists: boolean;
  path: string;
  git: GitRepoCheckResult | null;
  skills: SkillsCheckResult | null;
  agents: {
    global: AgentsCheckResult | null;
    project: AgentsCheckResult | null;
  };
  models: ModelsCheckResult | null;
}

/**
 * MCP server check result
 */
export interface McpServerCheck {
  name: string;
  command: string;
  available: boolean;
  source: 'global' | 'project';
}

/**
 * MCP servers check result
 */
export interface McpCheckResult {
  servers: McpServerCheck[];
  summary: {
    available: number;
    missing: number;
  };
}

/**
 * Complete diagnostic results
 */
export interface DiagnosticResults {
  environment: EnvironmentInfo;
  clients: ClientCheckResult[];
  configRepo: ConfigRepoCheckResult | null;
  mcp: McpCheckResult | null;
}

/**
 * Diagnostic summary
 */
export interface DiagnosticSummary {
  clientsDetected: number;
  clientsMissing: number;
  wsl2Detections: number;
  configsValid: number;
  configsInvalid: number;
  gitInSync: boolean | null;
  skillsFound: number;
  agentsFound: {
    global: number;
    project: number;
  };
  mcpAvailable: number;
  mcpMissing: number;
}
