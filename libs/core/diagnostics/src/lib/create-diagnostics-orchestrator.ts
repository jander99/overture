/**
 * Factory function to create DiagnosticsOrchestrator with all dependencies
 *
 * @module diagnostics-core
 */

import type { FilesystemPort } from '@overture/ports-filesystem';
import type { ProcessPort, EnvironmentPort } from '@overture/ports-process';
import type { DiscoveryService } from '@overture/discovery-core';
import type { ConfigLoader, PathResolver } from '@overture/config-core';
import type { AdapterRegistry } from '@overture/client-adapters';
import {
  DiagnosticsOrchestrator,
  type DiagnosticsOrchestratorDeps,
} from './diagnostics-orchestrator.js';
import {
  ConfigRepoChecker,
  SkillsChecker,
  AgentsChecker,
  ClientsChecker,
  McpChecker,
} from './checkers/index.js';

/**
 * Factory dependencies (from composition root)
 */
export interface CreateDiagnosticsOrchestratorDeps {
  filesystem: FilesystemPort;
  process: ProcessPort;
  environment: EnvironmentPort;
  discoveryService: DiscoveryService;
  configLoader: ConfigLoader;
  pathResolver: PathResolver;
  adapterRegistry: AdapterRegistry;
}

/**
 * Create DiagnosticsOrchestrator with all dependencies wired up
 */
export function createDiagnosticsOrchestrator(
  deps: CreateDiagnosticsOrchestratorDeps,
): DiagnosticsOrchestrator {
  const configRepoChecker = new ConfigRepoChecker(
    deps.filesystem,
    deps.process,
    deps.environment,
  );

  const skillsChecker = new SkillsChecker(deps.filesystem);

  const agentsChecker = new AgentsChecker(deps.filesystem);

  const clientsChecker = new ClientsChecker(
    deps.filesystem,
    deps.adapterRegistry,
  );

  const mcpChecker = new McpChecker(deps.process);

  const orchestratorDeps: DiagnosticsOrchestratorDeps = {
    configRepoChecker,
    skillsChecker,
    agentsChecker,
    clientsChecker,
    mcpChecker,
    discoveryService: deps.discoveryService,
    configLoader: deps.configLoader,
    pathResolver: deps.pathResolver,
    adapterRegistry: deps.adapterRegistry,
  };

  return new DiagnosticsOrchestrator(orchestratorDeps);
}
