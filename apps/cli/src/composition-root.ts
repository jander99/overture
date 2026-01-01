/**
 * Application Composition Root
 *
 * This is the single place where all dependencies are instantiated and wired together.
 * This follows hexagonal architecture principles where:
 * - Infrastructure adapters (Node.js implementations) are created here
 * - Core services receive dependencies via constructor injection
 * - Business logic never directly imports Node.js modules
 *
 * @module composition-root
 */

import {
  NodeFilesystemAdapter,
  NodeProcessAdapter,
  NodeEnvironmentAdapter,
} from '@overture/adapters-infrastructure';
import { Logger } from '@overture/utils';
import {
  ConfigLoader,
  PathResolver,
  OVERTURE_DIR,
  CONFIG_FILE,
} from '@overture/config-core';
import { createDiscoveryService } from '@overture/discovery-core';
import { createAdapterRegistry } from '@overture/client-adapters';
import {
  PluginInstaller,
  PluginDetector,
  PluginExporter,
} from '@overture/plugin-core';
import {
  createSyncEngine,
  BackupService,
  RestoreService,
  AuditService,
} from '@overture/sync-core';
import { AgentSyncService } from '@overture/agent-core';
import { ImportService, CleanupService } from '@overture/import-core';
import {
  SkillDiscovery,
  SkillSyncService,
  SkillCopyService,
} from '@overture/skill';
import { createDiagnosticsOrchestrator } from '@overture/diagnostics-core';
import type { DiagnosticsOrchestrator } from '@overture/diagnostics-core';
import {
  EnvironmentFormatter,
  ConfigRepoFormatter,
  ClientsFormatter,
  McpFormatter,
  SummaryFormatter,
} from '@overture/formatters';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { ProcessPort, EnvironmentPort } from '@overture/ports-process';
import type { OutputPort } from '@overture/ports-output';
import type { DiscoveryService } from '@overture/discovery-core';
import type { AdapterRegistry } from '@overture/client-adapters';
import type { SyncEngine } from '@overture/sync-core';
import type { ClientName } from '@overture/config-types';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Application dependencies container.
 *
 * This is the composition root where all infrastructure adapters
 * and services are instantiated and wired together.
 */
export interface AppDependencies {
  // Infrastructure ports
  filesystem: FilesystemPort;
  process: ProcessPort;
  environment: EnvironmentPort;
  output: OutputPort;

  // Core services
  pathResolver: PathResolver;
  configLoader: ConfigLoader;
  discoveryService: DiscoveryService;
  adapterRegistry: AdapterRegistry;

  // Plugin services
  pluginDetector: PluginDetector;
  pluginInstaller: PluginInstaller;
  pluginExporter: PluginExporter;

  // Sync services
  syncEngine: SyncEngine;
  backupService: BackupService;
  restoreService: RestoreService;
  auditService: AuditService;

  // Import/Cleanup services
  importService: ImportService;
  cleanupService: CleanupService;

  // Skill services
  skillDiscovery: SkillDiscovery;
  skillSyncService: SkillSyncService;
  skillCopyService: SkillCopyService;

  // Diagnostics
  diagnosticsOrchestrator: DiagnosticsOrchestrator;
  formatters: {
    environment: EnvironmentFormatter;
    configRepo: ConfigRepoFormatter;
    clients: ClientsFormatter;
    mcp: McpFormatter;
    summary: SummaryFormatter;
  };
}

/**
 * Create and wire up all application dependencies.
 *
 * This is the single place where concrete implementations are chosen
 * and dependencies are assembled. Everything else depends on abstractions.
 *
 * @returns Container with all application dependencies
 */
export function createAppDependencies(): AppDependencies {
  // Create infrastructure adapters (these are the ONLY places Node.js is used)
  const filesystem = new NodeFilesystemAdapter();
  const process = new NodeProcessAdapter();
  const environment = new NodeEnvironmentAdapter();
  const output = new Logger(); // Logger implements OutputPort

  // Create core services with dependency injection
  const pathResolver = new PathResolver(environment, filesystem);
  const configLoader = new ConfigLoader(filesystem, pathResolver);

  // Create discovery service (requires sync fs functions for BinaryDetector)
  const discoveryService = createDiscoveryService({
    processPort: process,
    environmentPort: environment,
    fileExists: (filepath: string) => {
      try {
        fs.accessSync(filepath);
        return true;
      } catch {
        return false;
      }
    },
    readFile: (filepath: string) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- filepath is internal config path, computed safely
      return fs.readFileSync(filepath, 'utf-8');
    },
    readDir: (dirpath: string) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- dirpath is internal config path, computed safely
      return fs.readdirSync(dirpath);
    },
    isDirectory: (filepath: string) => {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- filepath is internal config path, computed safely
        return fs.statSync(filepath).isDirectory();
      } catch {
        return false;
      }
    },
    joinPath: (...paths: string[]) => path.join(...paths),
    expandTilde: (filepath: string) => {
      if (filepath.startsWith('~/')) {
        return path.join(environment.homedir(), filepath.slice(2));
      }
      return filepath;
    },
  });

  // Create adapter registry with filesystem and environment dependencies
  const adapterRegistry = createAdapterRegistry(filesystem, environment);

  // Create plugin services
  const pluginDetector = new PluginDetector(filesystem, environment);
  const pluginInstaller = new PluginInstaller(process, output);
  const pluginExporter = new PluginExporter(
    filesystem,
    output,
    pluginDetector,
    environment,
  );

  // Create sync services
  const backupService = new BackupService({
    filesystem,
    output,
    getBackupDir: () => pathResolver.getBackupDir(),
  });
  const restoreService = new RestoreService({
    filesystem,
    output,
    backupService,
  });
  const auditService = new AuditService();

  // Create sync engine with all dependencies
  // Note: SyncEngine needs synchronous findProjectRoot(), but PathResolver's is async
  // Create an adapter that provides both methods synchronously
  const pathResolverAdapter = {
    findProjectRoot: (): string | null => {
      // Synchronous version of findProjectRoot
      let currentDir = environment.env.PWD || '/';
      const root = '/';

      while (currentDir !== root) {
        const configPath = path.join(currentDir, OVERTURE_DIR, CONFIG_FILE);

        // Check if .overture/config.yaml exists at this level (sync check)
        try {
          fs.accessSync(configPath);
          return currentDir;
        } catch {
          // Not found, continue
        }

        // Move up one directory
        const parentDir = path.dirname(currentDir);

        // Prevent infinite loop if dirname returns same path
        if (parentDir === currentDir) {
          break;
        }

        currentDir = parentDir;
      }

      // Check root directory as last resort
      const rootConfigPath = path.join(root, OVERTURE_DIR, CONFIG_FILE);
      try {
        fs.accessSync(rootConfigPath);
        return root;
      } catch {
        return null;
      }
    },
    getDryRunOutputPath: (clientName: string, originalPath: string): string => {
      return pathResolver.getDryRunOutputPath(
        clientName as ClientName,
        originalPath,
      );
    },
  };

  // Skill services (created before sync engine)
  const skillDiscovery = new SkillDiscovery(filesystem, environment);
  const skillSyncService = new SkillSyncService(
    filesystem,
    environment,
    skillDiscovery,
    output,
  );
  const skillCopyService = new SkillCopyService(
    filesystem,
    environment,
    skillDiscovery,
  );

  const agentSyncService = new AgentSyncService(
    filesystem,
    output,
    environment.homedir(),
    path.join(environment.homedir(), '.config'), // Default XDG_CONFIG_HOME
  );

  const syncEngine = createSyncEngine({
    filesystem,
    process,
    output,
    environment,
    configLoader,
    adapterRegistry,
    pluginInstaller,
    pluginDetector,
    binaryDetector: discoveryService.getBinaryDetector(),
    backupService,
    pathResolver: pathResolverAdapter,
    skillSyncService,
    agentSyncService,
  });

  // Import and Cleanup services
  const importService = new ImportService(filesystem, output);
  const cleanupService = new CleanupService(filesystem, output);

  // Create diagnostics orchestrator
  const diagnosticsOrchestrator = createDiagnosticsOrchestrator({
    filesystem,
    process,
    environment,
    discoveryService,
    configLoader,
    pathResolver,
    adapterRegistry,
  });

  // Create formatters
  const formatters = {
    environment: new EnvironmentFormatter(output),
    configRepo: new ConfigRepoFormatter(output),
    clients: new ClientsFormatter(output),
    mcp: new McpFormatter(output),
    summary: new SummaryFormatter(output),
  };

  return {
    filesystem,
    process,
    environment,
    output,
    pathResolver,
    configLoader,
    discoveryService,
    adapterRegistry,
    pluginDetector,
    pluginInstaller,
    pluginExporter,
    syncEngine,
    backupService,
    restoreService,
    auditService,
    importService,
    cleanupService,
    skillDiscovery,
    skillSyncService,
    skillCopyService,
    diagnosticsOrchestrator,
    formatters,
  };
}
