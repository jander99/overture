/**
 * Mock Builder Utilities
 *
 * Factory functions for creating test mocks and fixtures.
 * Reduces boilerplate in test files and provides consistent test data.
 *
 * @module core/__tests__/mock-builders
 */

import type { OvertureConfig, PluginConfig } from '../../domain/config.types';

/**
 * Installed Plugin interface (to be defined in plugin-detector.ts)
 */
export interface InstalledPlugin {
  name: string;
  marketplace: string;
  enabled: boolean;
  installedAt?: string;
}

/**
 * Installation Result interface (to be defined in plugin-installer.ts)
 */
export interface InstallationResult {
  success: boolean;
  plugin: string;
  marketplace: string;
  output?: string;
  error?: string;
}

/**
 * Process Execution Result
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Build mock installed plugin
 *
 * @param overrides - Partial plugin data to override defaults
 * @returns Mock InstalledPlugin
 *
 * @example
 * ```typescript
 * const plugin = buildInstalledPlugin({
 *   name: 'python-development',
 *   marketplace: 'claude-code-workflows'
 * });
 * ```
 */
export function buildInstalledPlugin(
  overrides?: Partial<InstalledPlugin>
): InstalledPlugin {
  return {
    name: 'test-plugin',
    marketplace: 'test-marketplace',
    enabled: true,
    installedAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Build multiple mock plugins
 *
 * @param count - Number of plugins to create
 * @param baseOverrides - Base overrides applied to all plugins
 * @returns Array of mock plugins
 *
 * @example
 * ```typescript
 * const plugins = buildInstalledPlugins(3, { marketplace: 'claude-code-workflows' });
 * // Returns 3 plugins all from claude-code-workflows
 * ```
 */
export function buildInstalledPlugins(
  count: number,
  baseOverrides?: Partial<InstalledPlugin>
): InstalledPlugin[] {
  return Array.from({ length: count }, (_, i) =>
    buildInstalledPlugin({
      name: `plugin-${i + 1}`,
      ...baseOverrides
    })
  );
}

/**
 * Build mock installation result
 *
 * @param overrides - Partial result data to override defaults
 * @returns Mock InstallationResult
 *
 * @example
 * ```typescript
 * const success = buildInstallationResult({ success: true });
 * const failure = buildInstallationResult({ success: false, error: 'Plugin not found' });
 * ```
 */
export function buildInstallationResult(
  overrides?: Partial<InstallationResult>
): InstallationResult {
  return {
    success: true,
    plugin: 'test-plugin',
    marketplace: 'test-marketplace',
    output: 'Plugin installed successfully\n',
    ...overrides
  };
}

/**
 * Build mock process execution result
 *
 * @param stdout - Standard output (default: '')
 * @param stderr - Standard error (default: '')
 * @param exitCode - Exit code (default: 0)
 * @returns Mock ExecResult
 *
 * @example
 * ```typescript
 * const success = buildExecResult('Success\n');
 * const failure = buildExecResult('', 'Error\n', 1);
 * ```
 */
export function buildExecResult(
  stdout: string = '',
  stderr: string = '',
  exitCode: number = 0
): ExecResult {
  return { stdout, stderr, exitCode };
}

/**
 * Build mock Overture config with plugins
 *
 * @param plugins - Plugin configurations
 * @param mcps - MCP server configurations
 * @returns Mock OvertureConfig
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
  plugins: Record<string, PluginConfig> = {},
  mcps: Record<string, any> = {}
): OvertureConfig {
  return {
    version: '2.0',
    plugins,
    mcp: mcps
  };
}

/**
 * Build user global config
 *
 * @param plugins - Plugin configurations
 * @returns User config (no project section)
 */
export function buildUserConfig(
  plugins: Record<string, PluginConfig> = {}
): OvertureConfig {
  return {
    version: '2.0',
    plugins,
    mcp: {}
  };
}

/**
 * Build project config
 *
 * @param projectName - Project name
 * @param projectType - Project type
 * @param plugins - Plugin configurations (will trigger warning)
 * @returns Project config
 */
export function buildProjectConfig(
  projectName: string = 'test-project',
  projectType: string = 'typescript-tooling',
  plugins: Record<string, PluginConfig> = {}
): OvertureConfig {
  return {
    version: '2.0',
    project: {
      name: projectName,
      type: projectType
    },
    plugins,
    mcp: {}
  };
}

/**
 * Build plugin config entry
 *
 * @param marketplace - Marketplace name
 * @param enabled - Plugin enabled status
 * @param mcps - Associated MCP servers
 * @returns PluginConfig
 */
export function buildPluginConfig(
  marketplace: string = 'claude-code-workflows',
  enabled: boolean = true,
  mcps: string[] = []
): PluginConfig {
  return {
    marketplace,
    enabled,
    mcps
  };
}

/**
 * Build Claude settings object (from .claude/settings.json)
 *
 * @param plugins - Plugin entries
 * @param marketplaces - Registered marketplaces
 * @returns Claude settings object
 */
export function buildClaudeSettings(
  plugins: Record<string, any> = {},
  marketplaces: string[] = []
) {
  return {
    plugins,
    marketplaces
  };
}
