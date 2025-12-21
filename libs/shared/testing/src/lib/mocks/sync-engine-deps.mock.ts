/**
 * SyncEngineDeps Mock Factory
 *
 * Factory function for creating complete SyncEngineDeps mocks for testing sync-engine.
 * Provides typed mocks for all dependencies injected into SyncEngine.
 *
 * @module testing/mocks/sync-engine-deps
 */

import { vi } from 'vitest';
import { createMockProcess } from './process.mock.js';
import { createMockAdapter } from './adapter.mock.js';

/**
 * Create mock SyncEngineDeps for testing
 *
 * Returns fully typed mocks with vi.fn() for all methods.
 * All methods return reasonable defaults unless overridden in tests.
 *
 * Note: Intentionally uses `any` type to avoid circular dependency with @overture/sync-core.
 * Tests import the real SyncEngineDeps type and cast the result.
 *
 * @returns Mock SyncEngineDeps with all services
 */
export function createMockSyncEngineDeps(): any {
  const mockProcess = createMockProcess();
  const mockAdapter = createMockAdapter('claude-code');

  return {
    filesystem: {
      readFile: vi.fn().mockResolvedValue(''),
      writeFile: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      mkdir: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      unlink: vi.fn().mockResolvedValue(undefined),
      copyFile: vi.fn().mockResolvedValue(undefined),
      stat: vi
        .fn()
        .mockResolvedValue({
          isFile: () => true,
          isDirectory: () => false,
        } as any),
    },
    process: mockProcess,
    output: {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      section: vi.fn(),
      nl: vi.fn(),
      skip: vi.fn(),
    },
    environment: {
      platform: vi.fn(() => 'linux'),
      homedir: vi.fn(() => '/home/user'),
      env: { HOME: '/home/user', PATH: '/usr/bin' },
      cwd: vi.fn(() => '/home/user/project'),
    },
    configLoader: {
      loadUserConfig: vi.fn().mockResolvedValue({ version: '1.0', mcp: {} }),
      loadProjectConfig: vi.fn().mockResolvedValue({ version: '1.0', mcp: {} }),
      mergeConfigs: vi.fn((user, project) => project || user),
      loadConfig: vi.fn().mockResolvedValue({ version: '1.0', mcp: {} }),
      getMcpSources: vi.fn(() => ({})),
    } as any,
    adapterRegistry: {
      get: vi.fn((name: string) => mockAdapter),
      getAllNames: vi.fn(() => ['claude-code', 'claude-desktop']),
      listAdapters: vi.fn(() => ['claude-code', 'claude-desktop']),
      getAdapter: vi.fn(() => mockAdapter),
    } as any,
    pluginInstaller: {
      installPlugin: vi.fn().mockResolvedValue({
        success: true,
        plugin: 'test-plugin',
        marketplace: 'test-marketplace',
      }),
      uninstallPlugin: vi.fn().mockResolvedValue({ success: true }),
      listInstalledPlugins: vi.fn().mockResolvedValue([]),
    } as any,
    pluginDetector: {
      detectInstalledPlugins: vi.fn().mockResolvedValue([]),
      isPluginInstalled: vi.fn().mockResolvedValue(false),
    } as any,
    binaryDetector: {
      detectClient: vi.fn().mockResolvedValue({
        status: 'found',
        version: '1.0.0',
        warnings: [],
      }),
      detectAllClients: vi.fn().mockResolvedValue([]),
    } as any,
    backupService: {
      backup: vi.fn((client: string, configPath: string) => {
        return `/home/user/.config/backups/${client}-backup.json`;
      }),
    },
    pathResolver: {
      findProjectRoot: vi.fn(() => '/home/user/project'),
      getDryRunOutputPath: vi.fn((client: string, originalPath: string) => {
        return `/home/user/project/dist/${client}-mcp.json`;
      }),
    },
  };
}

/**
 * Create mock SyncEngineDeps with custom overrides
 *
 * @param overrides - Partial overrides for specific dependencies
 * @returns Mock SyncEngineDeps with overrides applied
 *
 * Note: Intentionally uses `any` type to avoid circular dependency with @overture/sync-core.
 */
export function createMockSyncEngineDepsWithOverrides(overrides: any): any {
  const defaults = createMockSyncEngineDeps();
  return {
    ...defaults,
    ...overrides,
  };
}
