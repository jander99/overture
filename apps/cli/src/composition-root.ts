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

import { NodeFilesystemAdapter } from '@overture/adapters-infrastructure';
import { NodeProcessAdapter } from '@overture/adapters-infrastructure';
import { NodeEnvironmentAdapter } from '@overture/adapters-infrastructure';
import { Logger } from '@overture/utils';
import { ConfigLoader, PathResolver } from '@overture/config-core';
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
import { ImportService, CleanupService } from '@overture/import-core';
import {
  SkillDiscovery,
  SkillSyncService,
  SkillCopyService,
} from '@overture/skill';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { ProcessPort, EnvironmentPort } from '@overture/ports-process';
import type { OutputPort } from '@overture/ports-output';
import type { DiscoveryService } from '@overture/discovery-core';
import type { AdapterRegistry } from '@overture/client-adapters';
import type { SyncEngine } from '@overture/sync-core';
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
    readFile: (filepath: string) => fs.readFileSync(filepath, 'utf-8'),
    readDir: (dirpath: string) => fs.readdirSync(dirpath),
    isDirectory: (filepath: string) => {
      try {
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
  const restoreService = new RestoreService(filesystem, output);
  const auditService = new AuditService(filesystem, output);

  // Create sync engine with all dependencies
  // Note: SyncEngine needs synchronous findProjectRoot(), but PathResolver's is async
  // Create an adapter that provides both methods synchronously
  const pathResolverAdapter = {
    findProjectRoot: (): string | null => {
      // Synchronous version of findProjectRoot
      let currentDir = environment.env.PWD || '/';
      const root = '/';

      while (currentDir !== root) {
        const configPath = path.join(currentDir, '.overture', 'config.yaml');

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
      const rootConfigPath = path.join(root, '.overture', 'config.yaml');
      try {
        fs.accessSync(rootConfigPath);
        return root;
      } catch {
        return null;
      }
    },
    getDryRunOutputPath: (clientName: string, originalPath: string): string => {
      return pathResolver.getDryRunOutputPath(clientName as any, originalPath);
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
  });

  // Import and Cleanup services
  const importService = new ImportService(filesystem, output);
  const cleanupService = new CleanupService(filesystem, output);

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
  };
}
