/**
 * Configuration Builder Utilities
 *
 * Factory functions for building test configurations.
 * Reduces boilerplate in test files and provides flexible test data creation.
 *
 * @module lib/builders/config.builder
 */

/**
 * Build an MCP server configuration
 *
 * @param command - Command to execute
 * @param args - Command arguments (default: [])
 * @param env - Environment variables (default: {})
 * @param transport - Transport type (default: 'stdio')
 * @param overrides - Additional config overrides
 * @returns McpServerConfig
 *
 * @example
 * ```typescript
 * const mcp = buildMcpServer('npx', ['-y', '@org/package'], {}, 'stdio', {
 *   version: '1.0.0'
 * });
 * ```
 */
export function buildMcpServer(
  command: string,
  args: string[] = [],
  env: Record<string, string> = {},
  transport: 'stdio' | 'http' | 'sse' = 'stdio',
  overrides: Record<string, any> = {}
) {
  return {
    command,
    args,
    env,
    transport,
    ...overrides,
  };
}

/**
 * Build a client configuration
 *
 * @param enabled - Whether client is enabled (default: true)
 * @param overrides - Additional config overrides
 * @returns ClientConfig
 *
 * @example
 * ```typescript
 * const client = buildClientConfig(true, {
 *   configPath: '~/.custom/config.json'
 * });
 * ```
 */
export function buildClientConfig(
  enabled = true,
  overrides: Record<string, any> = {}
) {
  return {
    enabled,
    ...overrides,
  };
}

/**
 * Build a plugin configuration
 *
 * @param marketplace - Marketplace name (default: 'claude-code-workflows')
 * @param enabled - Whether plugin is enabled (default: true)
 * @param mcps - Associated MCP servers (default: [])
 * @returns PluginConfig
 *
 * @example
 * ```typescript
 * const plugin = buildPluginConfig('claude-code-workflows', true, ['python-repl']);
 * ```
 */
export function buildPluginConfig(
  marketplace = 'claude-code-workflows',
  enabled = true,
  mcps: string[] = []
) {
  return {
    marketplace,
    enabled,
    mcps,
  };
}

/**
 * Build sync options
 *
 * @param overrides - Config overrides
 * @returns SyncOptions
 *
 * @example
 * ```typescript
 * const sync = buildSyncOptions({
 *   backup: true,
 *   mergeStrategy: 'replace'
 * });
 * ```
 */
export function buildSyncOptions(overrides: Record<string, any> = {}) {
  return {
    backup: true,
    backupDir: '~/.config/overture/backups',
    backupRetention: 10,
    mergeStrategy: 'append' as const,
    autoDetectClients: true,
    ...overrides,
  };
}

/**
 * Build an Overture configuration
 *
 * @param options - Configuration options
 * @returns OvertureConfig
 *
 * @example
 * ```typescript
 * const config = buildConfig({
 *   version: '2.0',
 *   plugins: {
 *     'python-development': buildPluginConfig('claude-code-workflows', true, ['python-repl'])
 *   },
 *   mcp: {
 *     'python-repl': buildMcpServer('uvx', ['mcp-server-python-repl'])
 *   }
 * });
 * ```
 */
export function buildConfig(options: {
  version?: string;
  clients?: Record<string, any>;
  plugins?: Record<string, any>;
  mcp?: Record<string, any>;
  sync?: any;
  discovery?: any;
} = {}) {
  return {
    version: options.version ?? '2.0',
    clients: options.clients,
    plugins: options.plugins,
    mcp: options.mcp ?? {},
    sync: options.sync,
    discovery: options.discovery,
  };
}

/**
 * Build a user global configuration
 *
 * @param plugins - Plugin configurations (default: {})
 * @param mcp - MCP server configurations (default: {})
 * @returns OvertureConfig
 *
 * @example
 * ```typescript
 * const config = buildUserConfig(
 *   { 'python-development': buildPluginConfig() },
 *   { 'python-repl': buildMcpServer('uvx', ['mcp-server-python-repl']) }
 * );
 * ```
 */
export function buildUserConfig(
  plugins: Record<string, any> = {},
  mcp: Record<string, any> = {}
) {
  return buildConfig({
    version: '2.0',
    plugins,
    mcp,
    sync: buildSyncOptions(),
  });
}

/**
 * Build a project configuration
 *
 * @param mcp - MCP server configurations (default: {})
 * @returns OvertureConfig
 *
 * @example
 * ```typescript
 * const config = buildProjectConfig({
 *   'nx-mcp': buildMcpServer('npx', ['@jander99/nx-mcp'])
 * });
 * ```
 */
export function buildProjectConfig(mcp: Record<string, any> = {}) {
  return buildConfig({
    version: '2.0',
    mcp,
  });
}

/**
 * Build a configuration with plugins
 *
 * @param plugins - Plugin configurations
 * @param mcp - MCP server configurations (default: {})
 * @returns OvertureConfig
 *
 * @example
 * ```typescript
 * const config = buildConfigWithPlugins({
 *   'python-development': {
 *     marketplace: 'claude-code-workflows',
 *     enabled: true,
 *     mcps: ['python-repl']
 *   }
 * });
 * ```
 */
export function buildConfigWithPlugins(
  plugins: Record<string, any> = {},
  mcp: Record<string, any> = {}
) {
  return buildConfig({
    version: '2.0',
    plugins,
    mcp,
  });
}

/**
 * Build Claude settings object (from .claude/settings.json)
 *
 * @param plugins - Plugin entries (default: {})
 * @param marketplaces - Registered marketplaces (default: [])
 * @returns Claude settings object
 *
 * @example
 * ```typescript
 * const settings = buildClaudeSettings({
 *   'python-development': {
 *     marketplace: 'claude-code-workflows',
 *     enabled: true
 *   }
 * }, ['claude-code-workflows']);
 * ```
 */
export function buildClaudeSettings(
  plugins: Record<string, any> = {},
  marketplaces: string[] = []
) {
  return {
    plugins,
    marketplaces,
  };
}

/**
 * Build an installed plugin
 *
 * @param overrides - Partial plugin data to override defaults
 * @returns InstalledPlugin
 *
 * @example
 * ```typescript
 * const plugin = buildInstalledPlugin({
 *   name: 'python-development',
 *   marketplace: 'claude-code-workflows'
 * });
 * ```
 */
export function buildInstalledPlugin(overrides?: Record<string, any>) {
  return {
    name: 'test-plugin',
    marketplace: 'test-marketplace',
    enabled: true,
    installedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Build multiple installed plugins
 *
 * @param count - Number of plugins to create
 * @param baseOverrides - Base overrides applied to all plugins
 * @returns Array of installed plugins
 *
 * @example
 * ```typescript
 * const plugins = buildInstalledPlugins(3, { marketplace: 'claude-code-workflows' });
 * // Returns 3 plugins all from claude-code-workflows
 * ```
 */
export function buildInstalledPlugins(
  count: number,
  baseOverrides?: Record<string, any>
): any[] {
  return Array.from({ length: count }, (_, i) =>
    buildInstalledPlugin({
      name: `plugin-${i + 1}`,
      ...baseOverrides,
    })
  );
}

/**
 * Build an installation result
 *
 * @param overrides - Partial result data to override defaults
 * @returns InstallationResult
 *
 * @example
 * ```typescript
 * const success = buildInstallationResult({ success: true });
 * const failure = buildInstallationResult({ success: false, error: 'Plugin not found' });
 * ```
 */
export function buildInstallationResult(overrides?: Record<string, any>) {
  return {
    success: true,
    plugin: 'test-plugin',
    marketplace: 'test-marketplace',
    output: 'Plugin installed successfully\n',
    ...overrides,
  };
}

/**
 * Build a binary detection result
 *
 * @param status - Detection status (default: 'found')
 * @param overrides - Additional fields
 * @returns BinaryDetectionResult
 *
 * @example
 * ```typescript
 * const found = buildBinaryDetectionResult('found', {
 *   binaryPath: '/usr/local/bin/claude',
 *   version: '2.1.0'
 * });
 * ```
 */
export function buildBinaryDetectionResult(
  status: 'found' | 'not-found' | 'skipped' = 'found',
  overrides: Record<string, any> = {}
) {
  return {
    status,
    warnings: [],
    ...overrides,
  };
}

/**
 * Build a sync result
 *
 * @param success - Whether sync succeeded (default: true)
 * @param clientResults - Client-specific results (default: {})
 * @returns SyncResult
 *
 * @example
 * ```typescript
 * const result = buildSyncResult(true, {
 *   'claude-code': {
 *     success: true,
 *     synced: ['github', 'filesystem'],
 *     skipped: []
 *   }
 * });
 * ```
 */
export function buildSyncResult(
  success = true,
  clientResults: Record<string, any> = {}
) {
  const clients = Object.values(clientResults);
  const successfulClients = clients.filter((c: any) => c.success).length;
  const failedClients = clients.length - successfulClients;

  const allSynced = clients.flatMap((c: any) => c.synced || []);
  const allSkipped = clients.flatMap((c: any) => c.skipped || []);

  return {
    success,
    clients: clientResults,
    summary: {
      totalClients: clients.length,
      successfulClients,
      failedClients,
      totalMcps: allSynced.length + allSkipped.length,
      syncedMcps: allSynced.length,
      skippedMcps: allSkipped.length,
    },
    errors: [],
  };
}

/**
 * Build a client sync result
 *
 * @param success - Whether client sync succeeded (default: true)
 * @param synced - MCP servers synced (default: [])
 * @param skipped - MCP servers skipped (default: [])
 * @param overrides - Additional fields
 * @returns ClientSyncResult
 *
 * @example
 * ```typescript
 * const result = buildClientSyncResult(true, ['github'], ['copilot']);
 * ```
 */
export function buildClientSyncResult(
  success = true,
  synced: string[] = [],
  skipped: string[] = [],
  overrides: Record<string, any> = {}
) {
  return {
    success,
    synced,
    skipped,
    ...overrides,
  };
}
