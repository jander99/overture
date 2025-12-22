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
      // Read full config including projects object
      const fullConfig = await adapter.readFullConfig(platform);

      // Top-level (global) MCPs
      if (fullConfig.mcpServers) {
        const configPaths = adapter.detectConfigPath(platform);
        const userPath =
          typeof configPaths === 'string'
            ? configPaths
            : configPaths?.user || '';

        for (const [name, config] of Object.entries(fullConfig.mcpServers)) {
          if (!overtureConfig.mcp[name]) {
            discovered.push(
              this.createDiscoveredMcp(
                name,
                config,
                {
                  client: 'claude-code',
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

      // Directory-based (project) MCPs from projects object
      if (fullConfig.projects) {
        const cwd = projectRoot || process.cwd();
        for (const [dirPath, projectConfig] of Object.entries(
          fullConfig.projects,
        )) {
          if (projectConfig.mcpServers) {
            for (const [name, config] of Object.entries(
              projectConfig.mcpServers,
            )) {
              if (!overtureConfig.mcp[name]) {
                const configPaths = adapter.detectConfigPath(platform);
                const userPath =
                  typeof configPaths === 'string'
                    ? configPaths
                    : configPaths?.user || '';

                discovered.push(
                  this.createDiscoveredMcp(
                    name,
                    config,
                    {
                      client: 'claude-code',
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
      }

      // .mcp.json (project-scoped)
      const configPaths = adapter.detectConfigPath(platform, projectRoot);
      const projectPath =
        typeof configPaths === 'string' ? '' : configPaths?.project || '';

      if (projectPath && (await this.filesystem.exists(projectPath))) {
        const projectConfig = await adapter.readConfig(projectPath);
        if (projectConfig.mcpServers) {
          for (const [name, config] of Object.entries(
            projectConfig.mcpServers,
          )) {
            if (!overtureConfig.mcp[name]) {
              discovered.push(
                this.createDiscoveredMcp(
                  name,
                  config,
                  {
                    client: 'claude-code',
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
      }
    } catch (error) {
      this.output.warn(
        `Failed to discover MCPs from Claude Code: ${(error as Error).message}`,
      );
    }

    return discovered;
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
      if (await this.filesystem.exists(configPaths.user)) {
        const userConfig = await adapter.readConfig(configPaths.user);
        if (userConfig.mcp) {
          for (const [name, config] of Object.entries(userConfig.mcp)) {
            if (!overtureConfig.mcp[name]) {
              // Convert OpenCode env format to Overture format
              const convertedEnv = adapter.translateFromOpenCodeEnv(config.env);

              discovered.push(
                this.createDiscoveredMcp(
                  name,
                  { ...config, env: convertedEnv },
                  {
                    client: 'opencode',
                    location: configPaths.user,
                    locationType: 'global',
                    filePath: configPaths.user,
                  },
                  'global',
                ),
              );
            }
          }
        }
      }

      // Project config
      if (await this.filesystem.exists(configPaths.project)) {
        const projectConfig = await adapter.readConfig(configPaths.project);
        if (projectConfig.mcp) {
          for (const [name, config] of Object.entries(projectConfig.mcp)) {
            if (!overtureConfig.mcp[name]) {
              // Convert OpenCode env format to Overture format
              const convertedEnv = adapter.translateFromOpenCodeEnv(config.env);

              discovered.push(
                this.createDiscoveredMcp(
                  name,
                  { ...config, env: convertedEnv },
                  {
                    client: 'opencode',
                    location: configPaths.project,
                    locationType: 'project',
                    filePath: configPaths.project,
                  },
                  'project',
                ),
              );
            }
          }
        }
      }
    } catch (error) {
      this.output.warn(
        `Failed to discover MCPs from OpenCode: ${(error as Error).message}`,
      );
    }

    return discovered;
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
      if (await this.filesystem.exists(configPaths.user)) {
        const userConfig = await adapter.readConfig(configPaths.user);
        const rootKey = adapter.schemaRootKey;

        if (userConfig[rootKey]) {
          for (const [name, config] of Object.entries(userConfig[rootKey])) {
            if (!overtureConfig.mcp[name]) {
              discovered.push(
                this.createDiscoveredMcp(
                  name,
                  config,
                  {
                    client: 'copilot-cli',
                    location: configPaths.user,
                    locationType: 'global',
                    filePath: configPaths.user,
                  },
                  'global',
                ),
              );
            }
          }
        }
      }

      // Project config
      if (await this.filesystem.exists(configPaths.project)) {
        const projectConfig = await adapter.readConfig(configPaths.project);
        const rootKey = adapter.schemaRootKey;

        if (projectConfig[rootKey]) {
          for (const [name, config] of Object.entries(projectConfig[rootKey])) {
            if (!overtureConfig.mcp[name]) {
              discovered.push(
                this.createDiscoveredMcp(
                  name,
                  config,
                  {
                    client: 'copilot-cli',
                    location: configPaths.project,
                    locationType: 'project',
                    filePath: configPaths.project,
                  },
                  'project',
                ),
              );
            }
          }
        }
      }
    } catch (error) {
      this.output.warn(
        `Failed to discover MCPs from Copilot CLI: ${(error as Error).message}`,
      );
    }

    return discovered;
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
    const adapters = [
      { adapter: claudeCodeAdapter, name: 'claude-code' as const },
      { adapter: openCodeAdapter, name: 'opencode' as const },
      { adapter: copilotCliAdapter, name: 'copilot-cli' as const },
    ];

    for (const { adapter, name } of adapters) {
      if (!adapter) continue;

      // Detect binary
      const binaryDetection = await this.detectClientBinary(adapter, platform);

      // Get config paths
      const configPathResult = adapter.detectConfigPath(platform, projectRoot);
      const userPath =
        typeof configPathResult === 'string'
          ? configPathResult
          : configPathResult?.user;
      const projectPath =
        typeof configPathResult === 'string'
          ? undefined
          : configPathResult?.project;

      const configPaths: ConfigPathStatus[] =
        [];

      // Check user config
      if (userPath) {
        const status = await this.checkConfigPath(userPath, 'user', adapter);
        configPaths.push(status);

        // If valid, discover MCPs
        if (status.parseStatus === 'valid') {
          try {
            const mcps = await this.discoverFromAdapter(
              adapter,
              name,
              overtureConfig,
              platform,
              projectRoot,
            );
            allDiscovered.push(...mcps);
          } catch (error) {
            // Already captured in checkConfigPath
          }
        } else if (status.parseError) {
          parseErrors.push({
            client: name,
            configPath: userPath,
            error: status.parseError,
          });
        }
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

      clients.push({
        name,
        version: binaryDetection.version,
        binaryPath: binaryDetection.binaryPath,
        detected: binaryDetection.status === 'found',
        configPaths,
      });
    }

    // Categorize MCPs
    const managed: ManagedMcpDetection[] = [];
    const unmanaged: DiscoveredMcp[] = [];
    const managedNames = Object.keys(overtureConfig.mcp);

    // Group discovered MCPs by name
    const mcpsByName = new Map<string, DiscoveredMcp[]>();
    for (const mcp of allDiscovered) {
      if (!mcpsByName.has(mcp.name)) {
        mcpsByName.set(mcp.name, []);
      }
      mcpsByName.get(mcp.name)!.push(mcp);
    }

    // Categorize each unique MCP
    for (const [mcpName, mcps] of mcpsByName.entries()) {
      if (managedNames.includes(mcpName)) {
        // Already managed
        managed.push({
          name: mcpName,
          sources: mcps.map((m) => m.source),
          inOvertureConfig: true,
        });
      } else {
        // Unmanaged - take first occurrence
        unmanaged.push(mcps[0]);
      }
    }

    // Detect conflicts
    const conflicts = detectConflicts(allDiscovered);

    // Remove conflicting MCPs from unmanaged list
    const conflictNames = new Set(conflicts.map((c) => c.name));
    const unmanagedNonConflicting = unmanaged.filter(
      (m) => !conflictNames.has(m.name),
    );

    // Calculate summary
    const summary: DetectionSummary = {
      clientsScanned: clients.length,
      totalMcps: mcpsByName.size,
      managed: managed.length,
      unmanaged: unmanagedNonConflicting.length,
      conflicts: conflicts.length,
      parseErrors: parseErrors.length,
    };

    return {
      summary,
      clients,
      mcps: {
        managed,
        unmanaged: unmanagedNonConflicting,
        conflicts,
        parseErrors,
      },
    };
  }

  /**
   * Check config file path status
   */
  private async checkConfigPath(
    path: string,
    type: 'user' | 'project',
    adapter: any,
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
  private extractParseError(
    error: Error,
  ): ParseErrorDetail {
    // Check for js-yaml error format
    if ('mark' in error && typeof error.mark === 'object') {
      const mark = error.mark as any;
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
    adapter: any,
    platform: Platform,
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
    adapter: any,
    clientName: string,
    overtureConfig: OvertureConfig,
    platform: Platform,
    projectRoot?: string,
  ): Promise<DiscoveredMcp[]> {
    // Route to appropriate discover method based on client type
    if (clientName === 'claude-code') {
      return this.discoverFromClaudeCode(
        adapter,
        overtureConfig,
        platform,
        projectRoot,
      );
    } else if (clientName === 'opencode') {
      return this.discoverFromOpenCode(
        adapter,
        overtureConfig,
        platform,
        projectRoot,
      );
    } else if (clientName === 'copilot-cli') {
      return this.discoverFromCopilotCLI(
        adapter,
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
    config: any,
    source: McpSource,
    suggestedScope: 'global' | 'project',
  ): DiscoveredMcp {
    // Convert hardcoded env vars to references
    const envConversion = convertToEnvVarReferences(config.env, name);

    return {
      name,
      command: config.command,
      args: config.args || [],
      env: envConversion.converted,
      transport: config.type || config.transport || 'stdio',
      source,
      suggestedScope,
      originalEnv: config.env,
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
    let config: any = { version: '1.0', mcp: {} };

    // Read existing config if it exists
    if (await this.filesystem.exists(configPath)) {
      const content = await this.filesystem.readFile(configPath);
      config = yaml.load(content) as any;

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
