import type {
  Platform,
  OvertureConfig,
  ClientName,
  BinaryDetectionResult,
  ClientMcpServerDef,
} from '@overture/config-types';
import type {
  ClientAdapter,
  ClientMcpConfig,
  AdapterRegistry,
} from '@overture/client-adapters';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import type { BinaryDetector } from '@overture/discovery-core';
import { filterMcpsForClient } from '../exclusion-filter.js';
import {
  getTransportWarnings,
  hasTransportIssues,
} from '../transport-validator.js';
import { expandEnvVarsInClientConfig } from '../client-env-service.js';
import { generateDiff } from '../config-diff.js';
import { getUnmanagedMcps } from '../mcp-detector.js';
import type { SyncOptions, ClientSyncResult } from '../sync-engine.js';

export interface McpSyncServiceDeps {
  filesystem: FilesystemPort;
  environment: EnvironmentPort;
  adapterRegistry: AdapterRegistry;
  binaryDetector: BinaryDetector;
  backupService: {
    backup(client: ClientName, configPath: string): Promise<string>;
  };
  pathResolver: {
    getDryRunOutputPath(clientName: ClientName, originalPath: string): string;
  };
}

export class McpSyncService {
  constructor(private readonly deps: McpSyncServiceDeps) {}

  getClientAdapters(targetClients: ClientName[]): {
    clients: ClientAdapter[];
    warnings: string[];
  } {
    const clients: ClientAdapter[] = [];
    const warnings: string[] = [];

    for (const clientName of targetClients) {
      const adapter = this.deps.adapterRegistry.get(clientName);
      if (adapter) {
        clients.push(adapter);
      } else {
        warnings.push(`No adapter registered for ${clientName}`);
      }
    }

    return { clients, warnings };
  }

  async syncToAllClients(
    clients: ClientAdapter[],
    overtureConfig: OvertureConfig,
    options: SyncOptions,
    mcpSources: Record<string, 'global' | 'project'>,
  ): Promise<{
    results: ClientSyncResult[];
    warnings: string[];
    errors: string[];
  }> {
    const results: ClientSyncResult[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const platform = options.platform || this.deps.environment.platform();

    for (const client of clients) {
      const inProject = !!options.projectRoot;
      const configPathResult = client.detectConfigPath(
        platform,
        options.projectRoot,
      );

      const supportsDualConfigs =
        configPathResult !== null &&
        typeof configPathResult === 'object' &&
        configPathResult.user &&
        configPathResult.project;

      if (inProject && supportsDualConfigs) {
        const userResult = await this.syncToClient(
          client,
          overtureConfig,
          { ...options, forceConfigType: 'user' },
          mcpSources,
        );
        results.push(userResult);

        const projectResult = await this.syncToClient(
          client,
          overtureConfig,
          { ...options, forceConfigType: 'project' },
          mcpSources,
        );
        results.push(projectResult);

        for (const result of [userResult, projectResult]) {
          const { warnings: w, errors: e } =
            this.collectResultWarningsAndErrors(result, client.name);
          warnings.push(...w);
          errors.push(...e);
        }
      } else {
        const result = await this.syncToClient(
          client,
          overtureConfig,
          options,
          mcpSources,
        );
        results.push(result);

        const { warnings: w, errors: e } = this.collectResultWarningsAndErrors(
          result,
          client.name,
        );
        warnings.push(...w);
        errors.push(...e);
      }
    }

    return { results, warnings, errors };
  }

  async syncToClient(
    client: ClientAdapter,
    overtureConfig: OvertureConfig,
    options: SyncOptions,
    mcpSources?: Record<string, 'global' | 'project'>,
  ): Promise<ClientSyncResult> {
    const platform = options.platform || this.deps.environment.platform();
    const warnings: string[] = [];
    let binaryDetection: BinaryDetectionResult | undefined;

    try {
      binaryDetection = await this.performBinaryDetection(
        client,
        platform,
        options,
        overtureConfig,
        warnings,
      );

      const validationResult = this.validateClientAndGetConfigPath(
        client,
        platform,
        options,
        binaryDetection,
      );

      if ('client' in validationResult) {
        return validationResult;
      }

      const { configPath, configPathResult } = validationResult;

      const transportWarnings = getTransportWarnings(
        overtureConfig.mcp,
        client,
      );
      if (transportWarnings.length > 0) {
        warnings.push(...transportWarnings.map((w) => w.message));

        if (!options.force && hasTransportIssues(overtureConfig.mcp, client)) {
          return this.createClientSyncResult(
            client.name,
            false,
            configPath,
            binaryDetection,
            warnings,
            `Transport issues detected. Use --force to sync anyway.`,
          );
        }
      }

      const mcpsToSync = this.filterMcpsByConfigType(
        overtureConfig,
        configPath,
        configPathResult,
        options,
        mcpSources,
      );

      const filteredMcps = filterMcpsForClient(mcpsToSync, client, platform);

      let oldConfig: ClientMcpConfig | null = null;
      try {
        oldConfig = await client.readConfig(configPath);
      } catch {
        // Config doesn't exist yet
      }

      const filteredOvertureConfig: OvertureConfig = {
        ...overtureConfig,
        mcp: filteredMcps,
      };
      let newConfig = client.convertFromOverture(
        filteredOvertureConfig,
        platform,
      );

      newConfig = expandEnvVarsInClientConfig(
        newConfig,
        client,
        this.deps.environment.env,
      );

      if (oldConfig) {
        this.preserveUnmanagedMcps(
          oldConfig,
          newConfig,
          client,
          overtureConfig,
          warnings,
        );
      }

      const diff = oldConfig
        ? generateDiff(oldConfig, newConfig, client.schemaRootKey)
        : null;

      if (options.dryRun) {
        const dryRunPath = this.deps.pathResolver.getDryRunOutputPath(
          client.name,
          configPath,
        );
        await this.ensureDistDirectory(dryRunPath);
        await client.writeConfig(dryRunPath, newConfig);

        return {
          client: client.name,
          success: true,
          configPath: dryRunPath,
          diff,
          binaryDetection,
          warnings,
          mcpSources,
        };
      }

      let backupPath: string | undefined;
      if (oldConfig && (await this.deps.filesystem.exists(configPath))) {
        try {
          backupPath = await this.deps.backupService.backup(
            client.name,
            configPath,
          );
        } catch (error) {
          warnings.push(`Backup failed: ${(error as Error).message}`);
        }
      }

      await client.writeConfig(configPath, newConfig);

      return {
        client: client.name,
        success: true,
        configPath,
        diff,
        backupPath,
        binaryDetection,
        warnings,
        mcpSources,
        configType: options.forceConfigType,
      };
    } catch (error) {
      return {
        client: client.name,
        success: false,
        configPath: '',
        binaryDetection,
        warnings,
        error: (error as Error).message,
      };
    }
  }

  private async performBinaryDetection(
    client: ClientAdapter,
    platform: Platform,
    options: SyncOptions,
    overtureConfig: OvertureConfig,
    warnings: string[],
  ): Promise<BinaryDetectionResult | undefined> {
    const skipDetection =
      options.skipBinaryDetection || overtureConfig.sync?.skipBinaryDetection;

    if (!skipDetection) {
      const detection = await this.deps.binaryDetector.detectClient(
        client,
        platform,
      );

      if (detection.status === 'found' && detection.version) {
        warnings.push(
          `${client.name} detected: ${detection.version}${detection.binaryPath ? ` at ${detection.binaryPath}` : ''}`,
        );
      }

      if (detection.warnings.length > 0) {
        warnings.push(...detection.warnings);
      }

      if (detection.status === 'not-found' && !options.skipUndetected) {
        warnings.push(
          `${client.name} binary/application not detected on system. Generating config anyway.`,
        );
      }

      return detection;
    }

    return { status: 'skipped', warnings: [] };
  }

  private validateClientAndGetConfigPath(
    client: ClientAdapter,
    platform: Platform,
    options: SyncOptions,
    binaryDetection: BinaryDetectionResult | undefined,
  ):
    | {
        configPath: string;
        configPathResult: string | { user: string; project: string };
      }
    | ClientSyncResult {
    if (binaryDetection?.status === 'not-found' && options.skipUndetected) {
      return this.createClientSyncResult(
        client.name,
        true,
        '',
        binaryDetection,
        [],
        'Skipped - client not detected on system',
      );
    }

    if (!client.isInstalled(platform)) {
      return this.createClientSyncResult(
        client.name,
        false,
        '',
        binaryDetection,
        [],
        `Client ${client.name} is not installed`,
      );
    }

    const configPathResult = client.detectConfigPath(
      platform,
      options.projectRoot,
    );
    if (!configPathResult) {
      return this.createClientSyncResult(
        client.name,
        false,
        '',
        binaryDetection,
        [],
        `Could not determine config path for ${client.name}`,
      );
    }

    const configPath = this.resolveConfigPath(configPathResult, options);
    if (!configPath) {
      return this.createClientSyncResult(
        client.name,
        false,
        '',
        binaryDetection,
        [],
        `Could not determine config path for ${client.name}`,
      );
    }

    return { configPath, configPathResult };
  }

  private resolveConfigPath(
    configPathResult: string | { user: string; project: string },
    options: SyncOptions,
  ): string {
    const inProject = !!options.projectRoot;

    if (typeof configPathResult === 'string') {
      return configPathResult;
    }

    if (options.forceConfigType === 'user') {
      return configPathResult.user;
    }

    if (options.forceConfigType === 'project') {
      return configPathResult.project;
    }

    if (inProject && configPathResult.project) {
      return configPathResult.project;
    }

    return configPathResult.user;
  }

  private filterMcpsByConfigType(
    overtureConfig: OvertureConfig,
    configPath: string,
    configPathResult: string | { user: string; project: string },
    options: SyncOptions,
    mcpSources?: Record<string, 'global' | 'project'>,
  ): OvertureConfig['mcp'] {
    const inProject = !!options.projectRoot;
    const projectPath =
      typeof configPathResult === 'object' ? configPathResult.project : null;
    const userPath =
      typeof configPathResult === 'object'
        ? configPathResult.user
        : configPathResult;

    if (inProject && projectPath && configPath === projectPath) {
      return Object.fromEntries(
        Object.entries(overtureConfig.mcp).filter(
          ([mcpName]) =>
            mcpSources &&
            Object.hasOwn(mcpSources, mcpName) &&
            mcpSources[mcpName] === 'project',
        ),
      );
    }

    if (!inProject || configPath === userPath) {
      return Object.fromEntries(
        Object.entries(overtureConfig.mcp).filter(
          ([mcpName]) =>
            mcpSources &&
            Object.hasOwn(mcpSources, mcpName) &&
            mcpSources[mcpName] === 'global',
        ),
      );
    }

    return overtureConfig.mcp;
  }

  private preserveUnmanagedMcps(
    oldConfig: ClientMcpConfig,
    newConfig: ClientMcpConfig,
    client: ClientAdapter,
    overtureConfig: OvertureConfig,
    warnings: string[],
  ): void {
    const rootKey = client.schemaRootKey;

    const oldMcps =
      (Object.hasOwn(oldConfig, rootKey) ? oldConfig[rootKey] : {}) || {};
    const unmanagedMcps = getUnmanagedMcps(oldMcps, overtureConfig.mcp);

    if (Object.keys(unmanagedMcps).length > 0) {
      // eslint-disable-next-line security/detect-object-injection
      newConfig[rootKey] = {
        ...(unmanagedMcps as Record<string, ClientMcpServerDef>),
        // eslint-disable-next-line security/detect-object-injection
        ...(newConfig[rootKey] as Record<string, ClientMcpServerDef>),
      };

      const unmanagedNames = Object.keys(unmanagedMcps);
      warnings.push(
        `Preserving ${unmanagedNames.length} manually-added MCP${unmanagedNames.length === 1 ? '' : 's'}: ${unmanagedNames.join(', ')}`,
      );
      warnings.push(
        `💡 Tip: Add these to .overture/config.yaml to manage with Overture`,
      );
    }
  }

  private createClientSyncResult(
    clientName: ClientName,
    success: boolean,
    configPath: string,
    binaryDetection: BinaryDetectionResult | undefined,
    warnings: string[],
    error?: string,
  ): ClientSyncResult {
    return {
      client: clientName,
      success,
      configPath,
      binaryDetection,
      warnings,
      error,
    };
  }

  private extractCriticalWarnings(resultWarnings: string[]): string[] {
    return resultWarnings.filter(
      (w) =>
        !w.includes('detected:') ||
        w.includes('not detected') ||
        w.includes('Generating config anyway'),
    );
  }

  private collectResultWarningsAndErrors(
    result: ClientSyncResult,
    clientName: string,
  ): { warnings: string[]; errors: string[] } {
    const warnings = this.extractCriticalWarnings(result.warnings);
    const errors: string[] = [];
    if (!result.success && result.error) {
      errors.push(`${clientName}: ${result.error}`);
    }
    return { warnings, errors };
  }

  private async ensureDistDirectory(dryRunPath: string): Promise<void> {
    const distDir = dryRunPath.substring(0, dryRunPath.lastIndexOf('/'));

    if (!(await this.deps.filesystem.exists(distDir))) {
      await this.deps.filesystem.mkdir(distDir, { recursive: true });
    }
  }
}

export function createMcpSyncService(deps: McpSyncServiceDeps): McpSyncService {
  return new McpSyncService(deps);
}
