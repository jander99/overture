/**
 * DiagnosticsOrchestrator - Coordinates all diagnostic checks
 *
 * CRITICAL: Never throws errors. Always returns a complete DiagnosticsResult,
 * even if individual checks fail. This ensures the doctor command always provides
 * useful feedback to the user.
 *
 * @module diagnostics-core
 */

import type { DiscoveryService } from '@overture/discovery-core';
import type { ConfigLoader, PathResolver } from '@overture/config-core';
import type { AdapterRegistry } from '@overture/client-adapters';
import type {
  DiagnosticsResult,
  DiagnosticsOptions,
} from '@overture/diagnostics-types';
import type { ClientName, Platform } from '@overture/config-types';
import { SUPPORTED_CLIENTS } from '@overture/config-types';
import {
  ConfigRepoChecker,
  SkillsChecker,
  AgentsChecker,
  ClientsChecker,
  McpChecker,
} from './checkers/index.js';
import * as os from 'node:os';

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
 * DiagnosticsOrchestrator dependencies
 */
export interface DiagnosticsOrchestratorDeps {
  configRepoChecker: ConfigRepoChecker;
  skillsChecker: SkillsChecker;
  agentsChecker: AgentsChecker;
  clientsChecker: ClientsChecker;
  mcpChecker: McpChecker;
  discoveryService: DiscoveryService;
  configLoader: ConfigLoader;
  pathResolver: PathResolver;
  adapterRegistry: AdapterRegistry;
}

/**
 * DiagnosticsOrchestrator - Coordinates all diagnostic checks
 *
 * CRITICAL: Never throws errors. Always returns a complete DiagnosticsResult,
 * even if individual checks fail. This ensures the doctor command always provides
 * useful feedback to the user.
 */
export class DiagnosticsOrchestrator {
  constructor(private readonly deps: DiagnosticsOrchestratorDeps) {}

  /**
   * Run all diagnostics
   *
   * @param options - Diagnostic options (wsl2 mode, verbose, etc.)
   * @returns Complete diagnostics result (never throws)
   */
  async runDiagnostics(
    options: DiagnosticsOptions = {},
  ): Promise<DiagnosticsResult> {
    try {
      // Step 1: Get platform and project root
      const platform = getCurrentPlatform();
      const projectRoot = await this.deps.pathResolver.findProjectRoot();

      // Step 2: Load configs
      const userConfig = await this.deps.configLoader.loadUserConfig();
      const projectConfig = projectRoot
        ? await this.deps.configLoader.loadProjectConfig(projectRoot)
        : null;

      // Step 3: Run discovery
      const ALL_CLIENTS: readonly ClientName[] = SUPPORTED_CLIENTS;
      const adapters = ALL_CLIENTS.map((clientName) =>
        this.deps.adapterRegistry.get(clientName),
      ).filter(
        (
          adapter,
        ): adapter is import('@overture/client-adapters').ClientAdapter =>
          adapter !== undefined,
      );

      const discoveryReport =
        await this.deps.discoveryService.discoverAll(adapters);

      // Step 4: Check config repository
      const configRepo =
        await this.deps.configRepoChecker.checkConfigRepository();

      // Step 5: Check git repository
      const git = await this.deps.configRepoChecker.checkGitRepository(
        configRepo.configRepoPath,
        configRepo.configRepoExists,
      );

      // Step 6: Count skills
      const skillCount = await this.deps.skillsChecker.countSkills(
        configRepo.skillsPath,
        configRepo.skillsDirExists,
      );

      // Step 7: Check agents
      const agents = await this.deps.agentsChecker.checkAgents(
        configRepo.configRepoPath,
        configRepo.configRepoExists,
        projectRoot,
      );

      // Step 8: Check clients
      const clients = await this.deps.clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      // Step 9: Check MCP servers
      const mcpSources = this.deps.configLoader.getMcpSources(
        userConfig,
        projectConfig,
      );
      const mergedConfig = this.deps.configLoader.mergeConfigs(
        userConfig,
        projectConfig,
      );
      const mcpServers = await this.deps.mcpChecker.checkMcpServers(
        mergedConfig,
        mcpSources,
      );

      // Step 10: Build result
      return {
        environment: {
          platform: discoveryReport.environment.platform,
          isWSL2: discoveryReport.environment.isWSL2,
          wsl2Info: discoveryReport.environment.wsl2Info,
        },
        configRepo: {
          ...configRepo,
          git,
          skills: {
            skillsPath: configRepo.skillsPath,
            skillsDirExists: configRepo.skillsDirExists,
            skillCount,
          },
          agents,
        },
        clients,
        mcpServers,
        summary: {
          clientsDetected: clients.summary.clientsDetected,
          clientsMissing: clients.summary.clientsMissing,
          wsl2Detections: clients.summary.wsl2Detections,
          configsValid: clients.summary.configsValid,
          configsInvalid: clients.summary.configsInvalid,
          mcpCommandsAvailable: mcpServers.summary.mcpCommandsAvailable,
          mcpCommandsMissing: mcpServers.summary.mcpCommandsMissing,
          globalAgents: agents.globalAgentCount,
          projectAgents: agents.projectAgentCount,
          agentErrors:
            agents.globalAgentErrors.length + agents.projectAgentErrors.length,
          agentsInSync: agents.syncStatus?.inSync.length,
          agentsNeedSync: agents.syncStatus
            ? agents.syncStatus.outOfSync.length +
              agents.syncStatus.onlyInGlobal.length
            : undefined,
        },
      };
    } catch (error) {
      // CRITICAL: Never throw. Return safe defaults.
      // This ensures doctor always provides feedback, even if everything fails.
      const platform = getCurrentPlatform();
      return this.getSafeDefaultResult(platform, error);
    }
  }

  /**
   * Get safe default result when all checks fail
   */
  private getSafeDefaultResult(
    platform: Platform,
    error: unknown,
  ): DiagnosticsResult {
    return {
      environment: {
        platform,
        isWSL2: false,
      },
      configRepo: {
        configRepoPath: '',
        skillsPath: '',
        configRepoExists: false,
        skillsDirExists: false,
        git: {
          isGitRepo: false,
          gitRemote: null,
          localHash: null,
          remoteHash: null,
          gitInSync: false,
        },
        skills: {
          skillsPath: '',
          skillsDirExists: false,
          skillCount: 0,
        },
        agents: {
          globalAgentsPath: '',
          globalAgentsDirExists: false,
          globalAgentCount: 0,
          globalAgentErrors: [`Fatal error: ${(error as Error).message}`],
          projectAgentsPath: null,
          projectAgentsDirExists: false,
          projectAgentCount: 0,
          projectAgentErrors: [],
          modelsConfigPath: '',
          modelsConfigExists: false,
          modelsConfigValid: false,
          modelsConfigError: null,
        },
      },
      clients: {
        clients: [],
        summary: {
          clientsDetected: 0,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 0,
        },
      },
      mcpServers: {
        mcpServers: [],
        summary: {
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
        },
      },
      summary: {
        clientsDetected: 0,
        clientsMissing: 0,
        wsl2Detections: 0,
        configsValid: 0,
        configsInvalid: 0,
        mcpCommandsAvailable: 0,
        mcpCommandsMissing: 0,
        globalAgents: 0,
        projectAgents: 0,
        agentErrors: 1,
      },
    };
  }
}
