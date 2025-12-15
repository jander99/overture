/**
 * AppDependencies Mock Factory
 *
 * Factory function for creating complete AppDependencies mocks for testing CLI commands.
 * Provides typed mocks for all dependencies injected into CLI commands.
 *
 * @module test-utils/app-dependencies.mock
 */

import { vi } from 'vitest';
import type { AppDependencies } from '../composition-root';

/**
 * Create a mock AppDependencies container for testing
 *
 * Returns fully typed mocks with vi.fn() for all methods.
 * All methods return reasonable defaults unless overridden in tests.
 *
 * @returns Mock AppDependencies with all services
 *
 * @example
 * ```typescript
 * import { vi } from 'vitest';
 * import { createMockAppDependencies } from '../test-utils/app-dependencies.mock';
 * import { createSyncCommand } from './sync';
 *
 * describe('sync command', () => {
 *   let deps: AppDependencies;
 *
 *   beforeEach(() => {
 *     deps = createMockAppDependencies();
 *   });
 *
 *   it('should sync all clients by default', async () => {
 *     vi.mocked(deps.syncEngine.sync).mockResolvedValue({
 *       success: true,
 *       results: [],
 *       errors: [],
 *     });
 *
 *     const command = createSyncCommand(deps);
 *     await command.parseAsync(['node', 'overture', 'sync']);
 *
 *     expect(deps.syncEngine.sync).toHaveBeenCalledWith({
 *       clients: undefined,
 *       dryRun: false,
 *       force: false,
 *       skipPlugins: false,
 *       skipUndetected: true,
 *     });
 *   });
 * });
 * ```
 */
export function createMockAppDependencies(): AppDependencies {
  return {
    // Infrastructure ports
    filesystem: {
      readFile: vi.fn().mockResolvedValue(''),
      writeFile: vi.fn().mockResolvedValue(undefined),
      fileExists: vi.fn().mockResolvedValue(false),
      ensureDir: vi.fn().mockResolvedValue(undefined),
      readDir: vi.fn().mockResolvedValue([]),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      copyFile: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any),
    },

    process: {
      exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
      commandExists: vi.fn().mockResolvedValue(true),
    },

    environment: {
      platform: vi.fn().mockReturnValue('linux' as const),
      homedir: vi.fn().mockReturnValue('/home/user'),
      env: { HOME: '/home/user', PATH: '/usr/bin' },
      cwd: vi.fn().mockReturnValue('/home/user/project'),
    },

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

    // Core services
    pathResolver: {
      resolveUserConfigPath: vi.fn().mockReturnValue('/home/user/.config/overture.yml'),
      resolveProjectConfigPath: vi.fn().mockReturnValue('/home/user/project/.overture/config.yaml'),
      resolveGlobalMcpPath: vi.fn().mockReturnValue('/home/user/.config/claude/mcp.json'),
      resolveProjectMcpPath: vi.fn().mockReturnValue('/home/user/project/.mcp.json'),
    } as any,

    configLoader: {
      loadUserConfig: vi.fn().mockResolvedValue({ version: '1.0', mcp: {} }),
      loadProjectConfig: vi.fn().mockResolvedValue({ version: '1.0', mcp: {} }),
      mergeConfigs: vi.fn().mockReturnValue({ version: '1.0', mcp: {} }),
    } as any,

    discoveryService: {
      detectClient: vi.fn().mockResolvedValue({
        status: 'found',
        version: '1.0.0',
        configPath: '/home/user/.config/claude/mcp.json',
      }),
      detectAllClients: vi.fn().mockResolvedValue([]),
    } as any,

    adapterRegistry: {
      getAdapter: vi.fn().mockReturnValue({
        name: 'claude-code',
        readConfig: vi.fn().mockResolvedValue({}),
        writeConfig: vi.fn().mockResolvedValue(undefined),
        validateTransport: vi.fn().mockReturnValue(true),
      }),
      listAdapters: vi.fn().mockReturnValue(['claude-code', 'claude-desktop']),
    } as any,

    // Plugin services
    pluginDetector: {
      detectInstalledPlugins: vi.fn().mockResolvedValue([]),
      isPluginInstalled: vi.fn().mockResolvedValue(false),
    } as any,

    pluginInstaller: {
      installPlugin: vi.fn().mockResolvedValue({ success: true }),
      uninstallPlugin: vi.fn().mockResolvedValue({ success: true }),
      listInstalledPlugins: vi.fn().mockResolvedValue([]),
    } as any,

    pluginExporter: {
      exportPluginList: vi.fn().mockResolvedValue(undefined),
    } as any,

    // Sync services
    syncEngine: {
      sync: vi.fn().mockResolvedValue({
        success: true,
        results: [],
        errors: [],
      }),
    } as any,

    backupService: {
      backup: vi.fn().mockResolvedValue({
        success: true,
        backupPath: '/home/user/.config/claude/backups/2024-01-01T00-00-00.json',
        timestamp: '2024-01-01T00:00:00.000Z',
      }),
      list: vi.fn().mockResolvedValue([]),
      restore: vi.fn().mockResolvedValue({ success: true }),
      delete: vi.fn().mockResolvedValue({ success: true }),
    } as any,

    restoreService: {
      restore: vi.fn().mockResolvedValue({ success: true }),
      listBackups: vi.fn().mockResolvedValue([]),
    } as any,

    auditService: {
      audit: vi.fn().mockResolvedValue({
        success: true,
        issues: [],
        warnings: [],
      }),
    } as any,
  };
}

/**
 * Create a mock AppDependencies with custom overrides
 *
 * @param overrides - Partial overrides for specific dependencies
 * @returns Mock AppDependencies with overrides applied
 *
 * @example
 * ```typescript
 * const deps = createMockAppDependenciesWithOverrides({
 *   syncEngine: {
 *     sync: vi.fn().mockResolvedValue({ success: false, errors: ['Failed'] })
 *   }
 * });
 * ```
 */
export function createMockAppDependenciesWithOverrides(
  overrides: Partial<AppDependencies>
): AppDependencies {
  const defaults = createMockAppDependencies();
  return {
    ...defaults,
    ...overrides,
  };
}
