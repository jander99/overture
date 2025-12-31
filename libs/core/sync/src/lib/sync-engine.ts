/**
 * Sync Engine - Orchestrates MCP Configuration Synchronization
 *
 * Main orchestration layer for v0.2 multi-client sync workflow with dependency injection.
 * This is the refactored version that uses hexagonal architecture with injected dependencies.
 *
 * @module @overture/sync-core/sync-engine
 * @version 3.0
 */

import type {
  Platform,
  OvertureConfig,
  ClientName,
  BinaryDetectionResult,
  PluginSyncResult,
  InstallationResult,
  ClientMcpServerDef,
  SkillSyncResult,
  SkillSyncSummary,
  AgentSyncResult,
  AgentSyncSummary,
} from '@overture/config-types';
import type {
  ClientAdapter,
  ClientMcpConfig,
  AdapterRegistry,
} from '@overture/client-adapters';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { ProcessPort, EnvironmentPort } from '@overture/ports-process';
import type { OutputPort } from '@overture/ports-output';
import type { ConfigLoader } from '@overture/config-core';
import type { PluginInstaller, PluginDetector } from '@overture/plugin-core';
import type { BinaryDetector } from '@overture/discovery-core';
import type { SkillSyncService } from '@overture/skill';
import type { AgentSyncService } from '@overture/agent-core';
import { filterMcpsForClient } from './exclusion-filter.js';
import {
  getTransportWarnings,
  hasTransportIssues,
} from './transport-validator.js';
import { expandEnvVarsInClientConfig } from './client-env-service.js';
import { generateDiff } from './config-diff.js';
import { getUnmanagedMcps } from './mcp-detector.js';
import {
  validateConfigEnvVars,
  formatEnvVarWarnings,
} from './env-var-validator.js';

/**
 * Sync options
 */
export interface SyncOptions {
  /** Clients to sync (default: all installed) */
  clients?: ClientName[];
  /** Dry run - show what would change without writing */
  dryRun?: boolean;
  /** Force sync even with transport warnings */
  force?: boolean;
  /** Project root directory (optional, auto-detected if not provided) */
  projectRoot?: string;
  /** Platform override (defaults to current platform) */
  platform?: Platform;
  /** Skip binary detection for clients */
  skipBinaryDetection?: boolean;
  /** Skip plugin installation (default: false) */
  skipPlugins?: boolean;
  /** Skip clients that are not detected on system (default: true) */
  skipUndetected?: boolean;
  /** Show detailed output including diffs, plugin plans, and all warnings */
  detail?: boolean;
  /** Skip skill synchronization (default: false) */
  skipSkills?: boolean;
  /** Skip agent synchronization (default: false) */
  skipAgents?: boolean;
  /** Force sync to specific config type (internal use for dual-sync) */
  forceConfigType?: 'user' | 'project';
}

/**
 * Sync result for a single client
 */
export interface ClientSyncResult {
  client: ClientName;
  success: boolean;
  configPath: string;
  diff?: {
    added: string[];
    modified: Array<{
      name: string;
      type: string;
      oldValue?: unknown;
      newValue?: unknown;
    }>;
    removed: string[];
    unchanged: string[];
    hasChanges: boolean;
  } | null;
  backupPath?: string;
  binaryDetection?: BinaryDetectionResult;
  warnings: string[];
  error?: string;
  /** Maps MCP server names to their source ('global' | 'project') */
  mcpSources?: Record<string, 'global' | 'project'>;
  /** Config type synced (for dual-sync display) */
  configType?: 'user' | 'project';
}

/**
 * Overall sync result
 */
export interface SyncResult {
  success: boolean;
  results: ClientSyncResult[];
  warnings: string[];
  errors: string[];
  pluginSyncDetails?: {
    configured: number;
    installed: number;
    toInstall: Array<{ name: string; marketplace: string }>;
  };
  skillSyncSummary?: SkillSyncSummary;
  agentSyncSummary?: AgentSyncSummary;
}

/**
 * Dependencies required by SyncEngine
 *
 * All services and ports injected via constructor for testability and decoupling.
 */
export interface SyncEngineDeps {
  /** Filesystem operations port */
  filesystem: FilesystemPort;
  /** Process execution port */
  process: ProcessPort;
  /** Output/logging port */
  output: OutputPort;
  /** Environment information port */
  environment: EnvironmentPort;
  /** Configuration loader service */
  configLoader: ConfigLoader;
  /** Client adapter registry */
  adapterRegistry: AdapterRegistry;
  /** Plugin installer service */
  pluginInstaller: PluginInstaller;
  /** Plugin detector service */
  pluginDetector: PluginDetector;
  /** Binary detector service */
  binaryDetector: BinaryDetector;
  /** Backup service */
  backupService: {
    backup(client: ClientName, configPath: string): Promise<string>;
  };
  /** Path resolver */
  pathResolver: {
    findProjectRoot(): string | null;
    getDryRunOutputPath(clientName: ClientName, originalPath: string): string;
  };
  /** Skill sync service (optional) */
  skillSyncService?: SkillSyncService;
  /** Agent sync service (optional) */
  agentSyncService?: AgentSyncService;
}

/**
 * Sync Engine with Dependency Injection
 *
 * Orchestrates the entire MCP synchronization workflow using injected dependencies.
 * This design enables:
 * - Easy testing with mocked dependencies
 * - Flexible deployment with different adapters
 * - Clear separation of concerns
 * - No direct Node.js API dependencies
 */
export class SyncEngine {
  // Default clients list - extracted as constant to avoid duplication
  private static readonly DEFAULT_CLIENTS: ClientName[] = [
    'claude-code',
    'copilot-cli',
    'opencode',
  ];

  constructor(private deps: SyncEngineDeps) {}

  /**
   * Load and validate all configurations
   */
  private async loadConfigurations(options: SyncOptions): Promise<{
    userConfig: OvertureConfig | null;
    projectConfig: OvertureConfig | null;
    overtureConfig: OvertureConfig;
    mcpSources: Record<string, 'global' | 'project'>;
    warnings: string[];
    detectedProjectRoot: string | null;
  }> {
    const warnings: string[] = [];

    // Auto-detect project root if not provided
    const detectedProjectRoot =
      options.projectRoot || this.deps.pathResolver.findProjectRoot();

    // Load configurations
    const userConfig = await this.deps.configLoader.loadUserConfig();
    const projectConfig = detectedProjectRoot
      ? await this.deps.configLoader.loadProjectConfig(detectedProjectRoot)
      : null;

    // Merge configs (project overrides user)
    const overtureConfig = this.deps.configLoader.mergeConfigs(
      userConfig,
      projectConfig,
    );

    // Check for config warnings (invalid/deprecated keys)
    const configWarnings = this.validateConfigForWarnings(
      userConfig,
      projectConfig,
    );
    warnings.push(...configWarnings);

    // Validate environment variables
    const envVarWarnings = validateConfigEnvVars(
      overtureConfig,
      this.deps.environment.env,
    );
    if (envVarWarnings.length > 0) {
      warnings.push(...envVarWarnings);
      // Show formatted warnings to user
      const formatted = formatEnvVarWarnings(envVarWarnings);
      if (formatted) {
        this.deps.output.warn(formatted);
      }
    }

    // Get MCP sources (user vs project)
    const mcpSources = this.deps.configLoader.getMcpSources(
      userConfig,
      projectConfig,
    );

    return {
      userConfig,
      projectConfig,
      overtureConfig,
      mcpSources,
      warnings,
      detectedProjectRoot,
    };
  }

  /**
   * Sync plugins and skills
   */
  private async syncPluginsAndSkills(
    userConfig: OvertureConfig | null,
    projectConfig: OvertureConfig | null,
    targetClients: ClientName[],
    options: SyncOptions,
  ): Promise<{
    pluginSyncResult: PluginSyncResult | undefined;
    skillSyncSummary: SkillSyncSummary | undefined;
    agentSyncSummary: AgentSyncSummary | undefined;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    let pluginSyncResult: PluginSyncResult | undefined;
    let skillSyncSummary: SkillSyncSummary | undefined;
    let agentSyncSummary: AgentSyncSummary | undefined;

    // 1. Sync plugins first (before MCP sync)
    if (!options.skipPlugins) {
      try {
        pluginSyncResult = await this.syncPlugins(
          userConfig,
          projectConfig,
          options,
        );
      } catch (error) {
        // Log plugin sync errors but don't fail the entire sync
        const errorMsg = `Plugin sync failed: ${(error as Error).message}`;
        this.deps.output.warn(`⚠️  ${errorMsg}`);
        warnings.push(errorMsg);
      }
    }

    // 2. Sync skills (after plugins, before MCP)
    if (!options.skipSkills && this.deps.skillSyncService) {
      try {
        skillSyncSummary = await this.deps.skillSyncService.syncSkills({
          force: true, // Always overwrite - sync is source of truth
          clients: targetClients as ClientName[],
          dryRun: options.dryRun,
        });

        // Log warnings if any skills failed
        if (skillSyncSummary.failed > 0) {
          const failedSkills = skillSyncSummary.results
            .filter((r: SkillSyncResult) => !r.success)
            .map((r: SkillSyncResult) => r.skill);
          warnings.push(
            `Failed to sync ${skillSyncSummary.failed} skill(s): ${failedSkills.join(', ')}`,
          );
        }
      } catch (error) {
        // Log skill sync errors but don't fail the entire sync
        const errorMsg = `Skill sync failed: ${(error as Error).message}`;
        this.deps.output.warn(`⚠️  ${errorMsg}`);
        warnings.push(errorMsg);
      }
    }

    // 3. Sync agents
    if (!options.skipAgents && this.deps.agentSyncService) {
      try {
        agentSyncSummary = await this.deps.agentSyncService.syncAgents({
          projectRoot: options.projectRoot,
          clients: targetClients as ClientName[],
          dryRun: options.dryRun,
        });

        if (agentSyncSummary.failed > 0) {
          const failedAgents = agentSyncSummary.results
            .filter((r: AgentSyncResult) => !r.success)
            .map((r: AgentSyncResult) => r.agent);
          warnings.push(
            `Failed to sync ${agentSyncSummary.failed} agent(s): ${failedAgents.join(', ')}`,
          );
        }
      } catch (error) {
        const errorMsg = `Agent sync failed: ${(error as Error).message}`;
        this.deps.output.warn(`⚠️  ${errorMsg}`);
        warnings.push(errorMsg);
      }
    }

    return { pluginSyncResult, skillSyncSummary, agentSyncSummary, warnings };
  }

  /**
   * Get validated client adapters from registry
   */
  private getClientAdapters(targetClients: ClientName[]): {
    clients: ClientAdapter[];
    warnings: string[];
  } {
    const clients: ClientAdapter[] = [];
    const warnings: string[] = [];

    for (const clientName of targetClients) {
      const adapter = this.deps.adapterRegistry.get(clientName as ClientName);
      if (adapter) {
        clients.push(adapter);
      } else {
        warnings.push(`No adapter registered for ${clientName}`);
      }
    }

    return { clients, warnings };
  }

  /**
   * Extract critical warnings from sync result
   */
  private extractCriticalWarnings(resultWarnings: string[]): string[] {
    return resultWarnings.filter(
      (w) =>
        !w.includes('detected:') ||
        w.includes('not detected') ||
        w.includes('Generating config anyway'),
    );
  }

  /**
   * Collect warnings and errors from sync result
   */
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

  /**
   * Sync to all clients (handles both dual-config and single-config modes)
   */
  private async syncToAllClients(
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
        // Sync global MCPs to user config
        const userResult = await this.syncToClient(
          client,
          overtureConfig,
          { ...options, forceConfigType: 'user' },
          mcpSources,
        );
        results.push(userResult);

        // Sync project MCPs to project config
        const projectResult = await this.syncToClient(
          client,
          overtureConfig,
          { ...options, forceConfigType: 'project' },
          mcpSources,
        );
        results.push(projectResult);

        // Collect warnings and errors from both
        for (const result of [userResult, projectResult]) {
          const { warnings: w, errors: e } =
            this.collectResultWarningsAndErrors(result, client.name);
          warnings.push(...w);
          errors.push(...e);
        }
      } else {
        // Single config sync (not in project or client doesn't support dual configs)
        const result = await this.syncToClient(
          client,
          overtureConfig,
          options,
          mcpSources,
        );
        results.push(result);

        // Collect warnings and errors
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

  /**
   * Build plugin sync details for detail mode
   */
  private async buildPluginSyncDetails(
    userConfig: OvertureConfig | null,
    pluginSyncResult: PluginSyncResult,
  ): Promise<SyncResult['pluginSyncDetails']> {
    // Get plugins from user config to calculate "to install"
    const configuredPlugins = userConfig?.plugins || {};
    const pluginNames = Object.keys(configuredPlugins);

    // Calculate plugins to install
    const installedPlugins =
      await this.deps.pluginDetector.detectInstalledPlugins();
    const installedSet = new Set(
      installedPlugins.map((p) => `${p.name}@${p.marketplace}`),
    );
    const toInstall: Array<{ name: string; marketplace: string }> = [];

    for (const name of pluginNames) {
      if (Object.hasOwn(configuredPlugins, name)) {
        // eslint-disable-next-line security/detect-object-injection -- name from pluginNames, safe iteration
        const config = configuredPlugins[name];
        const key = `${name}@${config.marketplace}`;
        if (!installedSet.has(key)) {
          toInstall.push({ name, marketplace: config.marketplace });
        }
      }
    }

    return {
      configured: pluginNames.length,
      installed: pluginSyncResult.skipped,
      toInstall,
    };
  }

  /**
   * Sync MCP configuration to multiple clients
   *
   * Main entry point for the sync engine. Orchestrates the entire sync workflow.
   */
  async syncClients(options: SyncOptions = {}): Promise<SyncResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Step 1: Load and validate all configurations
      const {
        userConfig,
        projectConfig,
        overtureConfig,
        mcpSources,
        warnings: configWarnings,
        detectedProjectRoot,
      } = await this.loadConfigurations(options);
      warnings.push(...configWarnings);

      // Prepare sync options with detected project root
      const syncOptionsWithProject: SyncOptions = {
        ...options,
        projectRoot: detectedProjectRoot || undefined,
      };

      // Determine which clients to sync
      const targetClients = options.clients || SyncEngine.DEFAULT_CLIENTS;

      // Step 2: Sync plugins, skills, and agents
      const {
        pluginSyncResult,
        skillSyncSummary,
        agentSyncSummary,
        warnings: syncWarnings,
      } = await this.syncPluginsAndSkills(
        userConfig,
        projectConfig,
        targetClients,
        syncOptionsWithProject,
      );
      warnings.push(...syncWarnings);

      // Step 3: Get validated client adapters
      const { clients, warnings: adapterWarnings } =
        this.getClientAdapters(targetClients);
      warnings.push(...adapterWarnings);

      if (clients.length === 0) {
        return {
          success: false,
          results: [],
          warnings,
          errors: ['No valid clients to sync'],
        };
      }

      // Step 4: Sync to all clients
      const {
        results,
        warnings: clientWarnings,
        errors: clientErrors,
      } = await this.syncToAllClients(
        clients,
        overtureConfig,
        syncOptionsWithProject,
        mcpSources,
      );
      warnings.push(...clientWarnings);
      errors.push(...clientErrors);

      const success = results.every((r) => r.success);

      // Step 5: Build plugin sync details (if detail mode)
      const pluginSyncDetails =
        options.detail && pluginSyncResult
          ? await this.buildPluginSyncDetails(userConfig, pluginSyncResult)
          : undefined;

      return {
        success,
        results,
        warnings,
        errors,
        pluginSyncDetails,
        skillSyncSummary,
        agentSyncSummary,
      };
    } catch (error) {
      errors.push((error as Error).message);
      return {
        success: false,
        results: [],
        warnings,
        errors,
      };
    }
  }

  /**
   * Sync to a single client (convenience method)
   */
  async syncClient(
    client: ClientName,
    options: SyncOptions = {},
  ): Promise<ClientSyncResult> {
    const result = await this.syncClients({ ...options, clients: [client] });
    return (
      result.results[0] || {
        client,
        success: false,
        configPath: '',
        warnings: result.warnings,
        error: result.errors[0] || 'Unknown error',
      }
    );
  }

  /**
   * Perform binary detection and update warnings
   */
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

      // Add version info to warnings if detected
      if (detection.status === 'found' && detection.version) {
        warnings.push(
          `${client.name} detected: ${detection.version}${detection.binaryPath ? ` at ${detection.binaryPath}` : ''}`,
        );
      }

      // Add detection warnings
      if (detection.warnings.length > 0) {
        warnings.push(...detection.warnings);
      }

      // If binary not found but skipUndetected is false, add warning but continue
      if (detection.status === 'not-found' && !options.skipUndetected) {
        warnings.push(
          `${client.name} binary/application not detected on system. Generating config anyway.`,
        );
      }

      return detection;
    }

    return {
      status: 'skipped',
      warnings: [],
    };
  }

  /**
   * Determine config path based on project context
   */
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

  /**
   * Filter MCPs based on config type (user vs project)
   */
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
      // Project config: only include MCPs from project source
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
      // User config: only include MCPs from global source
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

  /**
   * Preserve manually-added MCPs and add warnings
   */
  private preserveUnmanagedMcps(
    oldConfig: ClientMcpConfig,
    newConfig: ClientMcpConfig,
    client: ClientAdapter,
    overtureConfig: OvertureConfig,
    warnings: string[],
  ): void {
    const rootKey = client.schemaRootKey;
    // rootKey comes from client.schemaRootKey - validated with Object.hasOwn

    const oldMcps =
      (Object.hasOwn(oldConfig, rootKey) ? oldConfig[rootKey] : {}) || {};
    const unmanagedMcps = getUnmanagedMcps(oldMcps, overtureConfig.mcp);

    if (Object.keys(unmanagedMcps).length > 0) {
      // Merge: Overture-managed MCPs + preserved manually-added MCPs
      // eslint-disable-next-line security/detect-object-injection -- rootKey from client schema
      newConfig[rootKey] = {
        ...(unmanagedMcps as Record<string, ClientMcpServerDef>),
        // eslint-disable-next-line security/detect-object-injection -- rootKey from client schema
        ...(newConfig[rootKey] as Record<string, ClientMcpServerDef>),
      };

      // Warn user about preserved MCPs
      const unmanagedNames = Object.keys(unmanagedMcps);
      warnings.push(
        `Preserving ${unmanagedNames.length} manually-added MCP${unmanagedNames.length === 1 ? '' : 's'}: ${unmanagedNames.join(', ')}`,
      );
      warnings.push(
        `💡 Tip: Add these to .overture/config.yaml to manage with Overture`,
      );
    }
  }

  /**
   * Create early return result for client sync
   */
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

  /**
   * Validate client installation and get config path
   */
  private validateClientAndGetConfigPath(
    client: ClientAdapter,
    platform: Platform,
    options: SyncOptions,
    binaryDetection: BinaryDetectionResult | undefined,
    _warnings: string[],
  ):
    | {
        configPath: string;
        configPathResult: string | { user: string; project: string };
      }
    | ClientSyncResult {
    // If binary not found and skipUndetected is enabled, skip this client
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

    // Check if client is installed (config path check)
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

    // Detect config path
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

    // Determine which config path to use
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

  /**
   * Sync MCP configuration to a single client (internal)
   */
  private async syncToClient(
    client: ClientAdapter,
    overtureConfig: OvertureConfig,
    options: SyncOptions,
    mcpSources?: Record<string, 'global' | 'project'>,
  ): Promise<ClientSyncResult> {
    const platform = options.platform || this.deps.environment.platform();
    const warnings: string[] = [];
    let binaryDetection: BinaryDetectionResult | undefined;

    try {
      // Binary detection (if not skipped)
      binaryDetection = await this.performBinaryDetection(
        client,
        platform,
        options,
        overtureConfig,
        warnings,
      );

      // Validate client installation and get config path
      const validationResult = this.validateClientAndGetConfigPath(
        client,
        platform,
        options,
        binaryDetection,
        warnings,
      );

      // If validation returned an early exit result, return it
      if ('client' in validationResult) {
        return validationResult;
      }

      const { configPath, configPathResult } = validationResult;

      // Check for transport issues on ALL MCPs (before filtering)
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

      // Filter MCPs for this client based on config type (user vs project)
      const mcpsToSync = this.filterMcpsByConfigType(
        overtureConfig,
        configPath,
        configPathResult,
        options,
        mcpSources,
      );

      const filteredMcps = filterMcpsForClient(mcpsToSync, client, platform);

      // Read existing config (if exists)
      let oldConfig: ClientMcpConfig | null = null;
      try {
        oldConfig = await client.readConfig(configPath);
      } catch {
        // Config doesn't exist yet - that's ok
      }

      // Convert Overture config to client format
      const filteredOvertureConfig: OvertureConfig = {
        ...overtureConfig,
        mcp: filteredMcps,
      };
      let newConfig = client.convertFromOverture(
        filteredOvertureConfig,
        platform,
      );

      // Apply environment variable expansion if client needs it
      newConfig = expandEnvVarsInClientConfig(
        newConfig,
        client,
        this.deps.environment.env,
      );

      // Preserve manually-added MCPs (not in Overture config)
      if (oldConfig) {
        this.preserveUnmanagedMcps(
          oldConfig,
          newConfig,
          client,
          overtureConfig,
          warnings,
        );
      }

      // Generate diff
      const diff = oldConfig
        ? generateDiff(oldConfig, newConfig, client.schemaRootKey)
        : null;

      // Dry run - write to dist/ directory for debugging
      if (options.dryRun) {
        const dryRunPath = this.deps.pathResolver.getDryRunOutputPath(
          client.name,
          configPath,
        );
        await this.ensureDistDirectory();
        await client.writeConfig(dryRunPath, newConfig);

        return {
          client: client.name,
          success: true,
          configPath: dryRunPath, // Return dist/ path
          diff,
          binaryDetection,
          warnings,
          mcpSources,
        };
      }

      // Backup existing config (if exists and file actually exists on disk)
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

      // Write new config
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

  /**
   * Sync plugins from user config (internal)
   */
  private async syncPlugins(
    userConfig: OvertureConfig | null,
    projectConfig: OvertureConfig | null,
    options: SyncOptions,
  ): Promise<PluginSyncResult> {
    const dryRun = options.dryRun ?? false;

    // Warn if plugins found in project config
    if (
      projectConfig?.plugins &&
      Object.keys(projectConfig.plugins).length > 0
    ) {
      const pluginNames = Object.keys(projectConfig.plugins).join(', ');
      this.deps.output.warn(
        '⚠️  Warning: Plugin configuration found in project config',
      );
      this.deps.output.warn(`    Plugins found: ${pluginNames}`);
      this.deps.output.warn('    Claude Code plugins are installed globally');
      this.deps.output.warn('    Move to ~/.config/overture.yml');
    }

    // Get plugins from user config only
    const configuredPlugins = userConfig?.plugins || {};
    const pluginNames = Object.keys(configuredPlugins);

    // No plugins configured - skip
    if (pluginNames.length === 0) {
      return {
        totalPlugins: 0,
        installed: 0,
        skipped: 0,
        failed: 0,
        results: [],
        warnings: [],
      };
    }

    // Detect installed plugins
    const installedPlugins =
      await this.deps.pluginDetector.detectInstalledPlugins();

    // Build set of installed plugin keys (name@marketplace)
    const installedSet = new Set(
      installedPlugins.map((p) => `${p.name}@${p.marketplace}`),
    );

    // Calculate missing plugins
    const missingPlugins: Array<{ name: string; marketplace: string }> = [];
    const skippedPlugins: string[] = [];

    for (const name of pluginNames) {
      if (Object.hasOwn(configuredPlugins, name)) {
        const config = configuredPlugins[name];
        const key = `${name}@${config.marketplace}`;

        if (installedSet.has(key)) {
          skippedPlugins.push(key);
        } else {
          missingPlugins.push({ name, marketplace: config.marketplace });
        }
      }
    }

    // Show sync status
    if (dryRun) {
      this.deps.output.info(
        '\n🔍 DRY RUN: Syncing plugins from user config...',
      );
    } else {
      this.deps.output.info('\n🔍 Syncing plugins from user config...');
    }

    this.deps.output.info(
      `📋 Found ${pluginNames.length} plugins in config, ${installedPlugins.length} already installed`,
    );

    // No missing plugins - skip
    if (missingPlugins.length === 0) {
      this.deps.output.info('✅ All plugins already installed\n');
      return {
        totalPlugins: pluginNames.length,
        installed: 0,
        skipped: skippedPlugins.length,
        failed: 0,
        results: [],
        warnings: [],
      };
    }

    // Install missing plugins
    this.deps.output.info(
      `\n Installing ${missingPlugins.length} missing plugins:`,
    );

    const results: InstallationResult[] = [];

    for (const { name, marketplace } of missingPlugins) {
      const result = await this.deps.pluginInstaller.installPlugin(
        name,
        marketplace,
        {
          dryRun,
        },
      );
      results.push(result);
    }

    // Calculate summary
    const installed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Show summary
    this.deps.output.info(
      `\n📦 Plugin sync: ${installed} installed, ${skippedPlugins.length} skipped, ${failed} failed\n`,
    );

    // Show failures if any
    if (failed > 0) {
      this.deps.output.info('⚠️  Failed installations:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          this.deps.output.info(`   • ${r.plugin}@${r.marketplace}`);
          if (r.error) {
            this.deps.output.info(`     Error: ${r.error}`);
          }
        });
      this.deps.output.info('');
    }

    return {
      totalPlugins: pluginNames.length,
      installed,
      skipped: skippedPlugins.length,
      failed,
      results,
      warnings: [],
    };
  }

  /**
   * Validate a single config for warnings
   */
  private validateSingleConfigForWarnings(
    config: OvertureConfig,
    configType: 'User' | 'Project',
    configPath: string,
    validClients: Set<string>,
  ): string[] {
    const warnings: string[] = [];

    // Check version field
    if (config.version !== '1.0') {
      warnings.push(
        `${configType} config has version '${config.version}' but should be '1.0'. ` +
          `Update ${configPath} to use version: "1.0"`,
      );
    }

    // Check for invalid client names
    if (config.clients) {
      const invalidClients = Object.keys(config.clients).filter(
        (client) => !validClients.has(client),
      );
      if (invalidClients.length > 0) {
        warnings.push(
          `${configType} config references unsupported clients: ${invalidClients.join(', ')}. ` +
            `Valid clients are: ${Array.from(validClients).join(', ')}. ` +
            `Remove these from the 'clients' section in ${configPath}`,
        );
      }
    }

    return warnings;
  }

  /**
   * Validate configuration for warnings (non-breaking issues)
   *
   * Checks for deprecated or invalid keys that should be updated
   * but don't break functionality.
   */
  private validateConfigForWarnings(
    userConfig: OvertureConfig | null,
    projectConfig: OvertureConfig | null,
  ): string[] {
    const warnings: string[] = [];
    const validClients = new Set<string>(SyncEngine.DEFAULT_CLIENTS);

    if (userConfig) {
      warnings.push(
        ...this.validateSingleConfigForWarnings(
          userConfig,
          'User',
          '~/.config/overture.yml',
          validClients,
        ),
      );
    }

    if (projectConfig) {
      warnings.push(
        ...this.validateSingleConfigForWarnings(
          projectConfig,
          'Project',
          '.overture/config.yaml',
          validClients,
        ),
      );
    }

    return warnings;
  }

  /**
   * Ensure dist/ directory exists for dry-run output
   */
  private async ensureDistDirectory(): Promise<void> {
    const distPath = this.deps.pathResolver.getDryRunOutputPath(
      'claude-code' as ClientName,
      '/temp/config.json',
    );
    const distDir = distPath.substring(0, distPath.lastIndexOf('/'));

    if (!(await this.deps.filesystem.exists(distDir))) {
      await this.deps.filesystem.mkdir(distDir, { recursive: true });
    }
  }
}

/**
 * Factory function to create SyncEngine with dependencies
 */
export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  return new SyncEngine(deps);
}
