/**
 * Import Service
 *
 * Discovers and imports unmanaged MCP configurations from AI clients.
 *
 * @module @overture/import-core/import-service
 */

import * as yaml from 'js-yaml';
import type {
  Platform,
  OvertureConfig,
  DiscoveredMcp,
  ImportDiscoveryResult,
  ImportResult,
  McpSource,
  DetectionResult,
  ClientDetectionResult,
  ConfigPathStatus,
  ParseErrorDetail,
  ParseErrorInfo,
  ManagedMcpDetection,
  DetectionSummary,
} from '@overture/config-types';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { OutputPort } from '@overture/ports-output';
import { convertToEnvVarReferences } from './env-var-converter.js';
import { detectConflicts } from './conflict-detector.js';
import type {
  ClaudeCodeAdapter,
  OpenCodeAdapter,
  CopilotCliAdapter,
} from '@overture/client-adapters';

// Constants for duplicate strings
// eslint-disable-next-line sonarjs/no-duplicate-string
const CLIENT_NAME_CLAUDE_CODE = 'claude-code' as const;
// eslint-disable-next-line sonarjs/no-duplicate-string
const CLIENT_NAME_COPILOT_CLI = 'copilot-cli' as const;

/**
 * Service for importing MCP configurations from client configs
 */
export class ImportService {
  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly output: OutputPort,
  ) {}

  /**
   * Discover all unmanaged MCPs from Claude Code
   */
  async discoverFromClaudeCode(
    adapter: ClaudeCodeAdapter,
    overtureConfig: OvertureConfig,
    platform: Platform,
    projectRoot?: string,
  ): Promise<DiscoveredMcp[]> {
    const discovered: DiscoveredMcp[] = [];

    try {
      const fullConfig = await adapter.readFullConfig(platform);

      // Discover global MCPs
      this.discoverGlobalClaudeCodeMcps(
        fullConfig,
        adapter,
        platform,
        overtureConfig,
        discovered,
      );

      // Discover directory-based MCPs
      await this.discoverDirectoryClaudeCodeMcps(
        fullConfig,
        adapter,
        platform,
        projectRoot,
        overtureConfig,
        discovered,
      );

      // Discover project MCPs
      await this.discoverProjectClaudeCodeMcps(
        adapter,
        platform,
        projectRoot,
        overtureConfig,
        discovered,
      );
    } catch (error) {
      this.output.warn(
        `Failed to discover MCPs from Claude Code: ${(error as Error).message}`,
      );
    }

    return discovered;
  }

  /**
   * Discover global MCPs from Claude Code config
   */
  private discoverGlobalClaudeCodeMcps(
    fullConfig: { mcpServers?: Record<string, unknown> },
    adapter: ClaudeCodeAdapter,
    platform: Platform,
    overtureConfig: OvertureConfig,
    discovered: DiscoveredMcp[],
  ): void {
    if (!fullConfig.mcpServers) return;

    const configPaths = adapter.detectConfigPath(platform);
    const userPath =
      typeof configPaths === 'string' ? configPaths : configPaths?.user || '';

    for (const [name, config] of Object.entries(fullConfig.mcpServers)) {
      // name comes from Object.entries - safe to check in overtureConfig.mcp
       
      if (!Object.hasOwn(overtureConfig.mcp, name)) {
        discovered.push(
          this.createDiscoveredMcp(
            name,
            config,
            {
              client: CLIENT_NAME_CLAUDE_CODE,
              location: '~/.claude.json (global)',
              locationType: 'global',
              filePath: userPath,
            },
            'global',
          ),
        );
      }
    }
  }

  /**
   * Discover directory-based MCPs from Claude Code config
   */
  private async discoverDirectoryClaudeCodeMcps(
    fullConfig: {
      projects?: Record<string, { mcpServers?: Record<string, unknown> }>;
    },
    adapter: ClaudeCodeAdapter,
    platform: Platform,
    projectRoot: string | undefined,
    overtureConfig: OvertureConfig,
    discovered: DiscoveredMcp[],
  ): Promise<void> {
    if (!fullConfig.projects) return;

    const cwd = projectRoot || process.cwd();
    const configPaths = adapter.detectConfigPath(platform);
    const userPath =
      typeof configPaths === 'string' ? configPaths : configPaths?.user || '';

    for (const [dirPath, projectConfig] of Object.entries(
      fullConfig.projects,
    )) {
      if (!projectConfig.mcpServers) continue;

      for (const [name, config] of Object.entries(projectConfig.mcpServers)) {
        // name comes from Object.entries - safe to check in overtureConfig.mcp
         
        if (!Object.hasOwn(overtureConfig.mcp, name)) {
          discovered.push(
            this.createDiscoveredMcp(
              name,
              config,
              {
                client: CLIENT_NAME_CLAUDE_CODE,
                location: `~/.claude.json → projects[${dirPath}]`,
                locationType: 'directory-override',
                filePath: userPath,
              },
              dirPath === cwd ? 'project' : 'global',
            ),
          );
        }
      }
    }
  }

  /**
   * Discover project-scoped MCPs from .mcp.json
   */
  private async discoverProjectClaudeCodeMcps(
    adapter: ClaudeCodeAdapter,
    platform: Platform,
    projectRoot: string | undefined,
    overtureConfig: OvertureConfig,
    discovered: DiscoveredMcp[],
  ): Promise<void> {
    const configPaths = adapter.detectConfigPath(platform, projectRoot);
    const projectPath =
      typeof configPaths === 'string' ? '' : configPaths?.project || '';

    if (!projectPath || !(await this.filesystem.exists(projectPath))) return;

    const projectConfig = await adapter.readConfig(projectPath);
    if (!projectConfig.mcpServers) return;

    for (const [name, config] of Object.entries(projectConfig.mcpServers)) {
      // name comes from Object.entries - safe to check in overtureConfig.mcp
       
      if (!Object.hasOwn(overtureConfig.mcp, name)) {
        discovered.push(
          this.createDiscoveredMcp(
            name,
            config,
            {
              client: CLIENT_NAME_CLAUDE_CODE,
              location: '.mcp.json',
              locationType: 'project',
              filePath: projectPath,
            },
            'project',
          ),
        );
      }
    }
  }

  /**
   * Discover all unmanaged MCPs from OpenCode
   */
  async discoverFromOpenCode(
    adapter: OpenCodeAdapter,
    overtureConfig: OvertureConfig,
    platform: Platform,
    projectRoot?: string,
  ): Promise<DiscoveredMcp[]> {
    const discovered: DiscoveredMcp[] = [];
    const configPaths = adapter.detectConfigPath(platform, projectRoot);

    if (!configPaths || typeof configPaths === 'string') {
      return discovered;
    }

    try {
      // User config
      await this.discoverOpenCodeMcpsFromPath(
        adapter,
        configPaths.user,
        'opencode',
        'global',
        overtureConfig,
        discovered,
      );

      // Project config
      await this.discoverOpenCodeMcpsFromPath(
        adapter,
        configPaths.project,
        'opencode',
        'project',
        overtureConfig,
        discovered,
      );
    } catch (error) {
      this.output.warn(
        `Failed to discover MCPs from OpenCode: ${(error as Error).message}`,
      );
    }

    return discovered;
  }

  /**
   * Discover MCPs from a specific OpenCode config path
   */
  private async discoverOpenCodeMcpsFromPath(
    adapter: OpenCodeAdapter,
    configPath: string,
    client: 'opencode',
    locationType: 'global' | 'project',
    overtureConfig: OvertureConfig,
    discovered: DiscoveredMcp[],
  ): Promise<void> {
    if (!(await this.filesystem.exists(configPath))) return;

    const config = await adapter.readConfig(configPath);
    if (!config.mcp) return;

    for (const [name, mcpConfig] of Object.entries(config.mcp)) {
      // name comes from Object.entries - safe to check in overtureConfig.mcp
       
      if (!Object.hasOwn(overtureConfig.mcp, name)) {
        const convertedEnv = adapter.translateFromOpenCodeEnv(mcpConfig.env);

        discovered.push(
          this.createDiscoveredMcp(
            name,
            { ...mcpConfig, env: convertedEnv },
            {
              client,
              location: configPath,
              locationType,
              filePath: configPath,
            },
            locationType,
          ),
        );
      }
    }
  }

  /**
   * Discover all unmanaged MCPs from Copilot CLI
   */
  async discoverFromCopilotCLI(
    adapter: CopilotCliAdapter,
    overtureConfig: OvertureConfig,
    platform: Platform,
    projectRoot?: string,
  ): Promise<DiscoveredMcp[]> {
    const discovered: DiscoveredMcp[] = [];
    const configPaths = adapter.detectConfigPath(platform, projectRoot);

    if (!configPaths || typeof configPaths === 'string') {
      return discovered;
    }

    try {
      // User config
      await this.discoverCopilotMcpsFromPath(
        adapter,
        configPaths.user,
        'global',
        overtureConfig,
        discovered,
      );

      // Project config
      await this.discoverCopilotMcpsFromPath(
        adapter,
        configPaths.project,
        'project',
        overtureConfig,
        discovered,
      );
    } catch (error) {
      this.output.warn(
        `Failed to discover MCPs from Copilot CLI: ${(error as Error).message}`,
      );
    }

    return discovered;
  }

  /**
   * Discover MCPs from a specific Copilot CLI config path
   */
  private async discoverCopilotMcpsFromPath(
    adapter: CopilotCliAdapter,
    configPath: string,
    locationType: 'global' | 'project',
    overtureConfig: OvertureConfig,
    discovered: DiscoveredMcp[],
  ): Promise<void> {
    if (!(await this.filesystem.exists(configPath))) return;

    const config = await adapter.readConfig(configPath);
    const rootKey = adapter.schemaRootKey;

    if (!Object.hasOwn(config, rootKey)) return;

    // rootKey comes from adapter.schemaRootKey - validated with Object.hasOwn
    // eslint-disable-next-line security/detect-object-injection -- rootKey from adapter schema
    const rootConfig = config[rootKey];
    if (!rootConfig) return;

    for (const [name, mcpConfig] of Object.entries(rootConfig)) {
      // name comes from Object.entries - safe to check in overtureConfig.mcp
       
      if (!Object.hasOwn(overtureConfig.mcp, name)) {
        discovered.push(
          this.createDiscoveredMcp(
            name,
            mcpConfig,
            {
              client: CLIENT_NAME_COPILOT_CLI,
              location: configPath,
              locationType,
              filePath: configPath,
            },
            locationType,
          ),
        );
      }
    }
  }

  /**
   * Discover all unmanaged MCPs across specified clients
   */
  async discoverUnmanagedMcps(
    claudeCodeAdapter: ClaudeCodeAdapter | null,
    openCodeAdapter: OpenCodeAdapter | null,
    copilotCLIAdapter: CopilotCliAdapter | null,
    overtureConfig: OvertureConfig,
    platform: Platform,
    projectRoot?: string,
  ): Promise<ImportDiscoveryResult> {
    const discovered: DiscoveredMcp[] = [];

    // Discover from each client
    if (claudeCodeAdapter) {
      const mcps = await this.discoverFromClaudeCode(
        claudeCodeAdapter,
        overtureConfig,
        platform,
        projectRoot,
      );
      discovered.push(...mcps);
    }

    if (openCodeAdapter) {
      const mcps = await this.discoverFromOpenCode(
        openCodeAdapter,
        overtureConfig,
        platform,
        projectRoot,
      );
      discovered.push(...mcps);
    }

    if (copilotCLIAdapter) {
      const mcps = await this.discoverFromCopilotCLI(
        copilotCLIAdapter,
        overtureConfig,
        platform,
        projectRoot,
      );
      discovered.push(...mcps);
    }

    // Detect conflicts
    const conflicts = detectConflicts(discovered);

    // Filter out conflicting MCPs and already managed
    const alreadyManaged = Object.keys(overtureConfig.mcp);
    const conflictNames = new Set(conflicts.map((c) => c.name));
    const nonConflictingDiscovered = discovered.filter(
      (mcp) =>
        !conflictNames.has(mcp.name) && !alreadyManaged.includes(mcp.name),
    );

    return {
      discovered: nonConflictingDiscovered,
      conflicts,
      alreadyManaged,
    };
  }

  /**
   * Perform detection scan (read-only)
   * Scans all client configs and reports status without importing
   */
  async performDetection(
    claudeCodeAdapter: ClaudeCodeAdapter | null,
    openCodeAdapter: OpenCodeAdapter | null,
    copilotCliAdapter: CopilotCliAdapter | null,
    overtureConfig: OvertureConfig,
    platform: Platform,
    projectRoot?: string,
  ): Promise<DetectionResult> {
    const clients: ClientDetectionResult[] = [];
    const parseErrors: ParseErrorInfo[] = [];
    const allDiscovered: DiscoveredMcp[] = [];

    // Detect from each client
    await this.detectFromAllClients(
      claudeCodeAdapter,
      openCodeAdapter,
      copilotCliAdapter,
      overtureConfig,
      platform,
      projectRoot,
      clients,
      parseErrors,
      allDiscovered,
    );

    // Categorize and summarize MCPs
    const { managed, unmanaged, conflicts } = this.categorizeMcps(
      allDiscovered,
      overtureConfig,
    );

    // Calculate summary
    const mcpsByName = this.groupMcpsByName(allDiscovered);
    const summary: DetectionSummary = {
      clientsScanned: clients.length,
      totalMcps: mcpsByName.size,
      managed: managed.length,
      unmanaged: unmanaged.length,
      conflicts: conflicts.length,
      parseErrors: parseErrors.length,
    };

    return {
      summary,
      clients,
      mcps: {
        managed,
        unmanaged,
        conflicts,
        parseErrors,
      },
    };
  }

  /**
   * Detect from all clients and populate results
   */
  private async detectFromAllClients(
    claudeCodeAdapter: ClaudeCodeAdapter | null,
    openCodeAdapter: OpenCodeAdapter | null,
    copilotCliAdapter: CopilotCliAdapter | null,
    overtureConfig: OvertureConfig,
    platform: Platform,
    projectRoot: string | undefined,
    clients: ClientDetectionResult[],
    parseErrors: ParseErrorInfo[],
    allDiscovered: DiscoveredMcp[],
  ): Promise<void> {
    const adapters = [
      { adapter: claudeCodeAdapter, name: 'claude-code' as const },
      { adapter: openCodeAdapter, name: 'opencode' as const },
      { adapter: copilotCliAdapter, name: 'copilot-cli' as const },
    ];

    for (const { adapter, name } of adapters) {
      if (!adapter) continue;

      const clientResult = await this.detectFromSingleClient(
        adapter,
        name,
        overtureConfig,
        platform,
        projectRoot,
        parseErrors,
        allDiscovered,
      );

      clients.push(clientResult);
    }
  }

  /**
   * Detect from a single client
   */
  private async detectFromSingleClient(
    adapter: ClaudeCodeAdapter | OpenCodeAdapter | CopilotCliAdapter,
    name: 'claude-code' | 'opencode' | 'copilot-cli',
    overtureConfig: OvertureConfig,
    platform: Platform,
    projectRoot: string | undefined,
    parseErrors: ParseErrorInfo[],
    allDiscovered: DiscoveredMcp[],
  ): Promise<ClientDetectionResult> {
    const binaryDetection = await this.detectClientBinary(adapter, platform);
    const configPathResult = adapter.detectConfigPath(platform, projectRoot);
    const userPath =
      typeof configPathResult === 'string'
        ? configPathResult
        : configPathResult?.user;
    const projectPath =
      typeof configPathResult === 'string'
        ? undefined
        : configPathResult?.project;

    const configPaths: ConfigPathStatus[] = [];

    // Check user config
    if (userPath) {
      await this.checkAndDiscoverFromPath(
        userPath,
        'user',
        adapter,
        name,
        overtureConfig,
        platform,
        projectRoot,
        configPaths,
        parseErrors,
        allDiscovered,
      );
    }

    // Check project config
    if (projectPath) {
      const status = await this.checkConfigPath(
        projectPath,
        'project',
        adapter,
      );
      configPaths.push(status);
    }

    return {
      name,
      version: binaryDetection.version,
      binaryPath: binaryDetection.binaryPath,
      detected: binaryDetection.status === 'found',
      configPaths,
    };
  }

  /**
   * Check config path and discover MCPs if valid
   */
  private async checkAndDiscoverFromPath(
    path: string,
    type: 'user' | 'project',
    adapter: ClaudeCodeAdapter | OpenCodeAdapter | CopilotCliAdapter,
    clientName: 'claude-code' | 'opencode' | 'copilot-cli',
    overtureConfig: OvertureConfig,
    platform: Platform,
    projectRoot: string | undefined,
    configPaths: ConfigPathStatus[],
    parseErrors: ParseErrorInfo[],
    allDiscovered: DiscoveredMcp[],
  ): Promise<void> {
    const status = await this.checkConfigPath(path, type, adapter);
    configPaths.push(status);

    if (status.parseStatus === 'valid') {
      try {
        const mcps = await this.discoverFromAdapter(
          adapter,
          clientName,
          overtureConfig,
          platform,
          projectRoot,
        );
        allDiscovered.push(...mcps);
      } catch (_error) {
        // Already captured in checkConfigPath
      }
    } else if (status.parseError) {
      parseErrors.push({
        client: clientName,
        configPath: path,
        error: status.parseError,
      });
    }
  }

  /**
   * Group discovered MCPs by name
   */
  private groupMcpsByName(
    allDiscovered: DiscoveredMcp[],
  ): Map<string, DiscoveredMcp[]> {
    const mcpsByName = new Map<string, DiscoveredMcp[]>();
    for (const mcp of allDiscovered) {
      if (!mcpsByName.has(mcp.name)) {
        mcpsByName.set(mcp.name, []);
      }
      const mcpList = mcpsByName.get(mcp.name);
      if (mcpList) {
        mcpList.push(mcp);
      }
    }
    return mcpsByName;
  }

  /**
   * Categorize MCPs into managed, unmanaged, and conflicts
   */
  private categorizeMcps(
    allDiscovered: DiscoveredMcp[],
    overtureConfig: OvertureConfig,
  ): {
    managed: ManagedMcpDetection[];
    unmanaged: DiscoveredMcp[];
    conflicts: ReturnType<typeof detectConflicts>;
  } {
    const managed: ManagedMcpDetection[] = [];
    const unmanaged: DiscoveredMcp[] = [];
    const managedNames = Object.keys(overtureConfig.mcp);
    const mcpsByName = this.groupMcpsByName(allDiscovered);

    // Categorize each unique MCP
    for (const [mcpName, mcps] of mcpsByName.entries()) {
      if (managedNames.includes(mcpName)) {
        managed.push({
          name: mcpName,
          sources: mcps.map((m) => m.source),
          inOvertureConfig: true,
        });
      } else {
        unmanaged.push(mcps[0]);
      }
    }

    // Detect conflicts and filter unmanaged
    const conflicts = detectConflicts(allDiscovered);
    const conflictNames = new Set(conflicts.map((c) => c.name));
    const unmanagedNonConflicting = unmanaged.filter(
      (m) => !conflictNames.has(m.name),
    );

    return {
      managed,
      unmanaged: unmanagedNonConflicting,
      conflicts,
    };
  }

  /**
   * Check config file path status
   */
  private async checkConfigPath(
    path: string,
    type: 'user' | 'project',
    adapter: ClaudeCodeAdapter | OpenCodeAdapter | CopilotCliAdapter,
  ): Promise<ConfigPathStatus> {
    const exists = await this.filesystem.exists(path);

    if (!exists) {
      return {
        path,
        type,
        exists: false,
        readable: false,
        parseStatus: 'not-found',
      };
    }

    try {
      // Try reading and parsing
      await adapter.readConfig(path);

      return {
        path,
        type,
        exists: true,
        readable: true,
        parseStatus: 'valid',
      };
    } catch (error) {
      // Parse error - extract details
      const parseError = this.extractParseError(error as Error);

      return {
        path,
        type,
        exists: true,
        readable: true,
        parseStatus: 'invalid',
        parseError,
      };
    }
  }

  /**
   * Extract parse error details from error object
   */
  private extractParseError(error: Error): ParseErrorDetail {
    // Check for js-yaml error format
    if ('mark' in error && typeof error.mark === 'object') {
      const mark = error.mark as { line?: number; column?: number };
      return {
        message: error.message,
        line: mark.line !== undefined ? mark.line + 1 : undefined,
        column: mark.column !== undefined ? mark.column + 1 : undefined,
      };
    }

    // Check for JSON parse error
    const jsonMatch = error.message.match(/at position (\d+)/);
    if (jsonMatch) {
      return {
        message: error.message,
      };
    }

    return {
      message: error.message,
    };
  }

  /**
   * Detect client binary
   */
  private async detectClientBinary(
    _adapter: ClaudeCodeAdapter | OpenCodeAdapter | CopilotCliAdapter,
    _platform: Platform,
  ): Promise<{
    status: 'found' | 'not-found';
    version?: string;
    binaryPath?: string;
  }> {
    // This is a simplified version - real implementation would use binary detector
    // For now, just return not-found
    return { status: 'not-found' };
  }

  /**
   * Discover MCPs from a specific adapter
   */
  private async discoverFromAdapter(
    adapter: ClaudeCodeAdapter | OpenCodeAdapter | CopilotCliAdapter,
    clientName: string,
    overtureConfig: OvertureConfig,
    platform: Platform,
    projectRoot?: string,
  ): Promise<DiscoveredMcp[]> {
    // Route to appropriate discover method based on client type
    if (clientName === 'claude-code') {
      return this.discoverFromClaudeCode(
        adapter as ClaudeCodeAdapter,
        overtureConfig,
        platform,
        projectRoot,
      );
    } else if (clientName === 'opencode') {
      return this.discoverFromOpenCode(
        adapter as OpenCodeAdapter,
        overtureConfig,
        platform,
        projectRoot,
      );
    } else if (clientName === 'copilot-cli') {
      return this.discoverFromCopilotCLI(
        adapter as CopilotCliAdapter,
        overtureConfig,
        platform,
        projectRoot,
      );
    }
    return [];
  }

  /**
   * Create a DiscoveredMcp from client config
   */
  private createDiscoveredMcp(
    name: string,
    config: unknown,
    source: McpSource,
    suggestedScope: 'global' | 'project',
  ): DiscoveredMcp {
    const configRecord = config as Record<string, unknown>;

    // Convert hardcoded env vars to references
    const envConversion = convertToEnvVarReferences(
      configRecord.env as Record<string, string> | undefined,
      name,
    );

    const transportValue =
      (configRecord.type as string) ||
      (configRecord.transport as string) ||
      'stdio';
    const validTransport: 'stdio' | 'http' | 'sse' =
      transportValue === 'http' || transportValue === 'sse'
        ? transportValue
        : 'stdio';

    return {
      name,
      command: (configRecord.command as string) || '',
      args: Array.isArray(configRecord.args)
        ? (configRecord.args as string[])
        : [],
      env: envConversion.converted,
      transport: validTransport,
      source,
      suggestedScope,
      originalEnv: configRecord.env as Record<string, string> | undefined,
      envVarsToSet: envConversion.varsToSet,
    };
  }

  /**
   * Import selected MCPs to Overture config
   */
  async importMcps(
    mcps: DiscoveredMcp[],
    globalConfigPath: string,
    projectConfigPath: string,
    dryRun = false,
  ): Promise<ImportResult> {
    const imported: DiscoveredMcp[] = [];
    const skipped: DiscoveredMcp[] = [];
    const envVarsToSet = new Set<string>();
    const scopesModified = new Set<'global' | 'project'>();

    // Group by scope
    const globalMcps = mcps.filter((m) => m.suggestedScope === 'global');
    const projectMcps = mcps.filter((m) => m.suggestedScope === 'project');

    // Import to global config
    if (globalMcps.length > 0) {
      try {
        await this.appendToConfig(globalConfigPath, globalMcps, dryRun);
        imported.push(...globalMcps);
        scopesModified.add('global');
        globalMcps.forEach((m) =>
          m.envVarsToSet?.forEach((v) => envVarsToSet.add(v)),
        );
      } catch (error) {
        this.output.error(
          `Failed to import to global config: ${(error as Error).message}`,
        );
        skipped.push(...globalMcps);
      }
    }

    // Import to project config
    if (projectMcps.length > 0) {
      try {
        await this.appendToConfig(projectConfigPath, projectMcps, dryRun);
        imported.push(...projectMcps);
        scopesModified.add('project');
        projectMcps.forEach((m) =>
          m.envVarsToSet?.forEach((v) => envVarsToSet.add(v)),
        );
      } catch (error) {
        this.output.error(
          `Failed to import to project config: ${(error as Error).message}`,
        );
        skipped.push(...projectMcps);
      }
    }

    return {
      imported,
      skipped,
      envVarsToSet: Array.from(envVarsToSet),
      scopesModified: Array.from(scopesModified),
    };
  }

  /**
   * Append MCPs to a config file
   */
  private async appendToConfig(
    configPath: string,
    mcps: DiscoveredMcp[],
    dryRun: boolean,
  ): Promise<void> {
    let config: {
      version: string;
      mcp: Record<
        string,
        { command: string; args: string[]; env?: Record<string, string> }
      >;
      [key: string]: unknown;
    } = { version: '1.0', mcp: {} };

    // Read existing config if it exists
    if (await this.filesystem.exists(configPath)) {
      const content = await this.filesystem.readFile(configPath);
      const loaded = yaml.load(content) as Record<string, unknown>;

      config = {
        ...loaded,
        version: (loaded.version as string) || '1.0',
        mcp: (loaded.mcp as Record<string, unknown>) || {},
      } as typeof config;

      // Ensure mcp section exists
      if (!config.mcp) {
        config.mcp = {};
      }
    }

    // Add new MCPs
    for (const mcp of mcps) {
      config.mcp[mcp.name] = {
        command: mcp.command,
        args: mcp.args,
        ...(mcp.env && Object.keys(mcp.env).length > 0 && { env: mcp.env }),
      };
    }

    if (!dryRun) {
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: -1, // Don't wrap lines
        noRefs: true, // Don't use YAML references
      });

      await this.filesystem.writeFile(configPath, yamlContent);
    }
  }
}
