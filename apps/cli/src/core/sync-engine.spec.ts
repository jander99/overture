/**
 * Sync Engine Tests
 *
 * Comprehensive integration tests for the sync orchestration layer.
 *
 * @module core/sync-engine.spec
 */

import { syncClients, syncClient } from './sync-engine';
import type { OvertureConfig, Platform } from '../domain/config.types';
import type { ClientAdapter } from '../adapters/client-adapter.interface';
import * as configLoader from './config-loader';
import * as adapterRegistry from '../adapters/adapter-registry';
import * as processLock from './process-lock';
import * as backupService from './backup-service';
import { PluginDetector } from './plugin-detector';
import { PluginInstaller } from './plugin-installer';
import {
  buildInstalledPlugin,
  buildUserConfig,
  buildProjectConfig,
  buildPluginConfig,
  buildInstallationResult,
} from './__tests__/mock-builders';

// Mock modules
jest.mock('./config-loader');
jest.mock('../adapters/adapter-registry', () => ({
  getAdapterForClient: jest.fn(),
}));
jest.mock('./process-lock');
jest.mock('./backup-service');
jest.mock('./plugin-detector');
jest.mock('./plugin-installer');

const mockConfigLoader = configLoader as jest.Mocked<typeof configLoader>;
const mockProcessLock = processLock as jest.Mocked<typeof processLock>;
const mockBackupService = backupService as jest.Mocked<typeof backupService>;

// Access the mocked function
const mockGetAdapterForClient = adapterRegistry.getAdapterForClient as jest.MockedFunction<
  typeof adapterRegistry.getAdapterForClient
>;

// Mock client adapter
const createMockAdapter = (
  name: string,
  installed: boolean = true,
  supportedTransports: string[] = ['stdio']
): jest.Mocked<ClientAdapter> => ({
  name: name as any,
  schemaRootKey: 'mcpServers',
  detectConfigPath: jest.fn(() => `/home/user/.config/${name}/mcp.json`),
  readConfig: jest.fn(),
  writeConfig: jest.fn(),
  convertFromOverture: jest.fn((config) => ({
    mcpServers: config.mcp,
  })),
  supportsTransport: jest.fn((t) => supportedTransports.includes(t)),
  needsEnvVarExpansion: jest.fn(() => false),
  getBinaryNames: jest.fn(() => [name]),
  getAppBundlePaths: jest.fn(() => []),
  requiresBinary: jest.fn(() => installed),
  isInstalled: jest.fn(() => installed),
});

describe('Sync Engine', () => {
  const platform: Platform = 'linux';

  const testUserConfig: OvertureConfig = {
    version: '2.0',
    mcp: {
      github: {
        command: 'gh',
        args: [],
        env: {},
        transport: 'stdio',
      },
      filesystem: {
        command: 'fs',
        args: [],
        env: {},
        transport: 'stdio',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockConfigLoader.loadUserConfig.mockResolvedValue(testUserConfig);
    mockConfigLoader.loadProjectConfig.mockResolvedValue(null);
    mockConfigLoader.mergeConfigs.mockImplementation((user, project) => user);
    mockProcessLock.acquireLock.mockResolvedValue(true);
    mockProcessLock.releaseLock.mockReturnValue();
    mockBackupService.backupClientConfig.mockReturnValue('/backup/path.json');
  });

  describe('syncClients', () => {
    it('should sync to all specified clients', async () => {
      const claudeAdapter = createMockAdapter('claude-code');
      const vscodeAdapter = createMockAdapter('vscode');

      claudeAdapter.readConfig.mockResolvedValue(null);
      vscodeAdapter.readConfig.mockResolvedValue(null);

      mockGetAdapterForClient
        .mockReturnValueOnce(claudeAdapter)
        .mockReturnValueOnce(vscodeAdapter);

      const result = await syncClients({
        clients: ['claude-code', 'vscode'],
        platform,
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].client).toBe('claude-code');
      expect(result.results[1].client).toBe('vscode');
      expect(claudeAdapter.writeConfig).toHaveBeenCalled();
      expect(vscodeAdapter.writeConfig).toHaveBeenCalled();
    });

    it('should skip clients that are not installed', async () => {
      const claudeAdapter = createMockAdapter('claude-code', true);
      const vscodeAdapter = createMockAdapter('vscode', false); // Not installed

      mockGetAdapterForClient
        .mockReturnValueOnce(claudeAdapter)
        .mockReturnValueOnce(vscodeAdapter);

      const result = await syncClients({
        clients: ['claude-code', 'vscode'],
        platform,
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true); // claude-code
      expect(result.results[1].success).toBe(false); // vscode
      expect(result.results[1].error).toContain('not installed');
    });

    it('should perform dry run without writing to actual config', async () => {
      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue({
        mcpServers: {
          old: { command: 'old', args: [] },
        },
      });

      mockGetAdapterForClient.mockReturnValue(adapter);

      const result = await syncClients({
        clients: ['claude-code'],
        dryRun: true,
        platform,
      });

      expect(result.success).toBe(true);
      expect(result.results[0].diff).toBeDefined();
      // In v0.2.1, dry-run writes to dist/ directory for debugging
      expect(adapter.writeConfig).toHaveBeenCalled();
      const writePath = adapter.writeConfig.mock.calls[0][0];
      expect(writePath).toContain('dist/');
      expect(writePath).toContain('claude-code-');
      expect(mockProcessLock.acquireLock).not.toHaveBeenCalled();
    });

    it('should acquire and release process lock', async () => {
      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);

      mockGetAdapterForClient.mockReturnValue(adapter);

      await syncClients({
        clients: ['claude-code'],
        platform,
      });

      expect(mockProcessLock.acquireLock).toHaveBeenCalledWith({ operation: 'sync' });
      expect(mockProcessLock.releaseLock).toHaveBeenCalled();
    });

    it('should fail if lock cannot be acquired', async () => {
      mockProcessLock.acquireLock.mockResolvedValue(false);

      const result = await syncClients({
        clients: ['claude-code'],
        platform,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to acquire process lock');
    });

    it('should backup existing config before writing', async () => {
      const adapter = createMockAdapter('claude-code');
      const existingConfig = {
        mcpServers: {
          old: { command: 'old', args: [] },
        },
      };
      adapter.readConfig.mockResolvedValue(existingConfig);

      mockGetAdapterForClient.mockReturnValue(adapter);

      const result = await syncClients({
        clients: ['claude-code'],
        platform,
      });

      expect(result.success).toBe(true);
      expect(mockBackupService.backupClientConfig).toHaveBeenCalledWith(
        'claude-code',
        '/home/user/.config/claude-code/mcp.json'
      );
      expect(result.results[0].backupPath).toBe('/backup/path.json');
    });

    it('should generate diff when updating existing config', async () => {
      const adapter = createMockAdapter('claude-code');
      const existingConfig = {
        mcpServers: {
          github: { command: 'old-gh', args: [] },
        },
      };
      adapter.readConfig.mockResolvedValue(existingConfig);

      mockGetAdapterForClient.mockReturnValue(adapter);

      const result = await syncClients({
        clients: ['claude-code'],
        platform,
      });

      expect(result.success).toBe(true);
      expect(result.results[0].diff).toBeDefined();
      expect(result.results[0].diff.hasChanges).toBe(true);
    });

    it('should warn about transport issues', async () => {
      const configWithHttp: OvertureConfig = {
        version: '2.0',
        mcp: {
          http: {
            command: 'http-server',
            args: [],
            env: {},
            transport: 'http',
          },
        },
      };

      mockConfigLoader.loadUserConfig.mockResolvedValue(configWithHttp);
      mockConfigLoader.mergeConfigs.mockReturnValue(configWithHttp);

      const adapter = createMockAdapter('vscode', true, ['stdio']); // Only stdio
      adapter.readConfig.mockResolvedValue(null);

      mockGetAdapterForClient.mockReturnValue(adapter);

      const result = await syncClients({
        clients: ['vscode'],
        platform,
      });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Transport issues');
      expect(result.results[0].warnings.length).toBeGreaterThan(0);
    });

    it('should force sync with transport warnings if --force used', async () => {
      const configWithHttp: OvertureConfig = {
        version: '2.0',
        mcp: {
          http: {
            command: 'http-server',
            args: [],
            env: {},
            transport: 'http',
          },
        },
      };

      mockConfigLoader.loadUserConfig.mockResolvedValue(configWithHttp);
      mockConfigLoader.mergeConfigs.mockReturnValue(configWithHttp);

      const adapter = createMockAdapter('vscode', true, ['stdio']);
      adapter.readConfig.mockResolvedValue(null);

      mockGetAdapterForClient.mockReturnValue(adapter);

      const result = await syncClients({
        clients: ['vscode'],
        force: true,
        platform,
      });

      expect(result.results[0].success).toBe(true);
      expect(result.results[0].warnings.length).toBeGreaterThan(0);
      expect(adapter.writeConfig).toHaveBeenCalled();
    });

    it('should merge user and project configs', async () => {
      const userConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          global: {
            command: 'g',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const projectConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          project: {
            command: 'p',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const merged: OvertureConfig = {
        version: '2.0',
        mcp: {
          global: userConfig.mcp.global,
          project: projectConfig.mcp.project,
        },
      };

      mockConfigLoader.loadUserConfig.mockResolvedValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockResolvedValue(projectConfig);
      mockConfigLoader.mergeConfigs.mockReturnValue(merged);

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);

      mockGetAdapterForClient.mockReturnValue(adapter);

      await syncClients({
        clients: ['claude-code'],
        projectRoot: '/project',
        platform,
      });

      expect(mockConfigLoader.loadProjectConfig).toHaveBeenCalledWith('/project');
      expect(mockConfigLoader.mergeConfigs).toHaveBeenCalledWith(userConfig, projectConfig);
    });

    it('should handle adapter loading errors', async () => {
      mockGetAdapterForClient.mockImplementation(() => {
        throw new Error('Adapter not found');
      });

      const result = await syncClients({
        clients: ['unknown-client'],
        platform,
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Could not load adapter');
    });

    it('should handle config path detection failures', async () => {
      const adapter = createMockAdapter('claude-code');
      adapter.detectConfigPath.mockReturnValue(''); // Empty path

      mockGetAdapterForClient.mockReturnValue(adapter);

      const result = await syncClients({
        clients: ['claude-code'],
        platform,
      });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Could not determine config path');
    });

    it('should handle write errors', async () => {
      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);
      adapter.writeConfig.mockRejectedValue(new Error('Write failed'));

      mockGetAdapterForClient.mockReturnValue(adapter);

      const result = await syncClients({
        clients: ['claude-code'],
        platform,
      });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Write failed');
    });

    it('should release lock even if sync fails', async () => {
      const adapter = createMockAdapter('claude-code');
      adapter.writeConfig.mockRejectedValue(new Error('Write failed'));

      mockGetAdapterForClient.mockReturnValue(adapter);

      await syncClients({
        clients: ['claude-code'],
        platform,
      });

      expect(mockProcessLock.releaseLock).toHaveBeenCalled();
    });

    it('should handle backup failures gracefully', async () => {
      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue({
        mcpServers: { old: { command: 'old', args: [] } },
      });

      mockBackupService.backupClientConfig.mockImplementation(() => {
        throw new Error('Backup failed');
      });

      mockGetAdapterForClient.mockReturnValue(adapter);

      const result = await syncClients({
        clients: ['claude-code'],
        platform,
      });

      expect(result.results[0].success).toBe(true); // Sync continues
      expect(result.results[0].warnings).toContain('Backup failed: Backup failed');
      expect(adapter.writeConfig).toHaveBeenCalled();
    });

    it('should filter by client platform exclusions', async () => {
      const configWithExclusions: OvertureConfig = {
        version: '2.0',
        mcp: {
          linux_only: {
            command: 'cmd',
            args: [],
            env: {},
            transport: 'stdio',
            platforms: {
              exclude: ['darwin', 'win32'],
            },
          },
        },
      };

      mockConfigLoader.loadUserConfig.mockResolvedValue(configWithExclusions);
      mockConfigLoader.mergeConfigs.mockReturnValue(configWithExclusions);

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);

      mockGetAdapterForClient.mockReturnValue(adapter);

      await syncClients({
        clients: ['claude-code'],
        platform: 'linux',
      });

      const writtenConfig = adapter.writeConfig.mock.calls[0][1];
      expect(writtenConfig.mcpServers.linux_only).toBeDefined();
    });

    it('should filter by client include/exclude rules', async () => {
      const configWithClientRules: OvertureConfig = {
        version: '2.0',
        mcp: {
          vscode_only: {
            command: 'cmd',
            args: [],
            env: {},
            transport: 'stdio',
            clients: {
              include: ['vscode'],
            },
          },
        },
      };

      mockConfigLoader.loadUserConfig.mockResolvedValue(configWithClientRules);
      mockConfigLoader.mergeConfigs.mockReturnValue(configWithClientRules);

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);

      mockGetAdapterForClient.mockReturnValue(adapter);

      await syncClients({
        clients: ['claude-code'],
        platform,
      });

      const writtenConfig = adapter.writeConfig.mock.calls[0][1];
      expect(writtenConfig.mcpServers.vscode_only).toBeUndefined(); // Excluded
    });
  });

  describe('syncClient', () => {
    it('should sync to a single client', async () => {
      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);

      mockGetAdapterForClient.mockReturnValue(adapter);

      const result = await syncClient('claude-code', { platform });

      expect(result.client).toBe('claude-code');
      expect(result.success).toBe(true);
      expect(adapter.writeConfig).toHaveBeenCalled();
    });

    it('should return error for failed sync', async () => {
      const adapter = createMockAdapter('claude-code', false); // Not installed

      mockGetAdapterForClient.mockReturnValue(adapter);

      const result = await syncClient('claude-code', { platform });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not installed');
    });
  });

  describe('Environment variable expansion', () => {
    it('should expand env vars for clients that need it', async () => {
      const configWithEnvVars: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: '${HOME}/bin/gh',
            args: ['${USER}'],
            env: { TOKEN: '${GITHUB_TOKEN}' },
            transport: 'stdio',
          },
        },
      };

      mockConfigLoader.loadUserConfig.mockResolvedValue(configWithEnvVars);
      mockConfigLoader.mergeConfigs.mockReturnValue(configWithEnvVars);

      const adapter = createMockAdapter('vscode');
      adapter.needsEnvVarExpansion.mockReturnValue(true);
      adapter.readConfig.mockResolvedValue(null);

      mockGetAdapterForClient.mockReturnValue(adapter);

      await syncClients({
        clients: ['vscode'],
        platform,
      });

      expect(adapter.writeConfig).toHaveBeenCalled();
      // Env vars should be expanded by expandEnvVarsInClientConfig
    });
  });

  describe('Plugin Sync Integration', () => {
    let mockDetector: jest.Mocked<PluginDetector>;
    let mockInstaller: jest.Mocked<PluginInstaller>;

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();

      // Mock PluginDetector
      mockDetector = new PluginDetector() as jest.Mocked<PluginDetector>;
      mockDetector.detectInstalledPlugins = jest.fn();
      mockDetector.isPluginInstalled = jest.fn();

      // Mock PluginInstaller
      mockInstaller = new PluginInstaller() as jest.Mocked<PluginInstaller>;
      mockInstaller.installPlugin = jest.fn();
      mockInstaller.installPlugins = jest.fn();
      mockInstaller.ensureMarketplace = jest.fn();
      mockInstaller.checkClaudeBinary = jest.fn();

      // Set up constructor mocks
      (PluginDetector as jest.MockedClass<typeof PluginDetector>).mockImplementation(
        () => mockDetector
      );
      (PluginInstaller as jest.MockedClass<typeof PluginInstaller>).mockImplementation(
        () => mockInstaller
      );
    });

    it('should sync plugins before MCP sync', async () => {
      // Arrange: User config with plugins
      const userConfig = buildUserConfig({
        'python-development': buildPluginConfig('claude-code-workflows', true, [
          'python-repl',
        ]),
        'backend-development': buildPluginConfig('claude-code-workflows', true, ['docker']),
      });

      mockConfigLoader.loadUserConfig.mockResolvedValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockResolvedValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(userConfig);

      // Mock: 1 plugin already installed, 1 missing
      mockDetector.detectInstalledPlugins.mockResolvedValue([
        buildInstalledPlugin({
          name: 'python-development',
          marketplace: 'claude-code-workflows',
        }),
      ]);

      mockInstaller.installPlugin.mockResolvedValue(
        buildInstallationResult({ success: true })
      );

      // Mock client adapter
      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Act
      const result = await syncClients({
        clients: ['claude-code'],
        platform,
      });

      // Assert: Plugin sync happened
      expect(mockDetector.detectInstalledPlugins).toHaveBeenCalled();
      expect(mockInstaller.installPlugin).toHaveBeenCalledWith(
        'backend-development',
        'claude-code-workflows',
        expect.any(Object)
      );

      // Assert: MCP sync still happened
      expect(adapter.writeConfig).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should read plugins from user global config only', async () => {
      // Arrange: User config with plugins
      const userConfig = buildUserConfig({
        'python-development': buildPluginConfig('claude-code-workflows'),
      });

      const projectConfig = buildProjectConfig('test-project', 'python-backend', {});

      mockConfigLoader.loadUserConfig.mockResolvedValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockResolvedValue(projectConfig);
      mockConfigLoader.mergeConfigs.mockReturnValue({
        ...userConfig,
        project: projectConfig.project,
      });

      mockDetector.detectInstalledPlugins.mockResolvedValue([]);
      mockInstaller.installPlugin.mockResolvedValue(
        buildInstallationResult({ success: true })
      );

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Act
      await syncClients({
        clients: ['claude-code'],
        platform,
      });

      // Assert: Plugin installation called for user config plugins
      expect(mockInstaller.installPlugin).toHaveBeenCalledWith(
        'python-development',
        'claude-code-workflows',
        expect.any(Object)
      );
    });

    it('should warn if plugins found in project config', async () => {
      // Arrange: Project config with plugins (incorrect)
      const userConfig = buildUserConfig({});
      const projectConfig = buildProjectConfig('test-project', 'python-backend', {
        'python-development': buildPluginConfig('claude-code-workflows'),
      });

      mockConfigLoader.loadUserConfig.mockResolvedValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockResolvedValue(projectConfig);
      mockConfigLoader.mergeConfigs.mockReturnValue({
        ...userConfig,
        project: projectConfig.project,
        plugins: projectConfig.plugins,
      });

      mockDetector.detectInstalledPlugins.mockResolvedValue([]);

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Spy on console.warn
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act
      const result = await syncClients({
        clients: ['claude-code'],
        platform,
      });

      // Assert: Warning displayed
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Plugin configuration found in project config')
      );

      warnSpy.mockRestore();
    });

    it('should skip already-installed plugins', async () => {
      // Arrange: All plugins already installed
      const userConfig = buildUserConfig({
        'python-development': buildPluginConfig('claude-code-workflows'),
        'backend-development': buildPluginConfig('claude-code-workflows'),
      });

      mockConfigLoader.loadUserConfig.mockResolvedValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockResolvedValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(userConfig);

      // Mock: All plugins already installed
      mockDetector.detectInstalledPlugins.mockResolvedValue([
        buildInstalledPlugin({
          name: 'python-development',
          marketplace: 'claude-code-workflows',
        }),
        buildInstalledPlugin({
          name: 'backend-development',
          marketplace: 'claude-code-workflows',
        }),
      ]);

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Act
      await syncClients({
        clients: ['claude-code'],
        platform,
      });

      // Assert: No installations attempted
      expect(mockInstaller.installPlugin).not.toHaveBeenCalled();
    });

    it('should show progress indicators during installation', async () => {
      // Arrange
      const userConfig = buildUserConfig({
        'plugin-a': buildPluginConfig('claude-code-workflows'),
        'plugin-b': buildPluginConfig('claude-code-workflows'),
        'plugin-c': buildPluginConfig('claude-code-workflows'),
      });

      mockConfigLoader.loadUserConfig.mockResolvedValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockResolvedValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(userConfig);

      mockDetector.detectInstalledPlugins.mockResolvedValue([]);
      mockInstaller.installPlugin.mockResolvedValue(
        buildInstallationResult({ success: true })
      );

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Spy on console.log
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await syncClients({
        clients: ['claude-code'],
        platform,
      });

      // Assert: Progress messages logged
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Syncing plugins'));

      logSpy.mockRestore();
    });

    it('should show summary after plugin installation', async () => {
      // Arrange
      const userConfig = buildUserConfig({
        'plugin-success': buildPluginConfig('claude-code-workflows'),
        'plugin-failure': buildPluginConfig('unknown-marketplace'),
        'plugin-skip': buildPluginConfig('claude-code-workflows'),
      });

      mockConfigLoader.loadUserConfig.mockResolvedValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockResolvedValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(userConfig);

      // Mock: 1 already installed, 1 will succeed, 1 will fail
      mockDetector.detectInstalledPlugins.mockResolvedValue([
        buildInstalledPlugin({ name: 'plugin-skip', marketplace: 'claude-code-workflows' }),
      ]);

      mockInstaller.installPlugin.mockImplementation(
        async (name: string, marketplace: string) => {
          if (name === 'plugin-success') {
            return buildInstallationResult({ success: true, plugin: name, marketplace });
          } else {
            return buildInstallationResult({
              success: false,
              plugin: name,
              marketplace,
              error: 'Marketplace not found',
            });
          }
        }
      );

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Spy on console.log
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await syncClients({
        clients: ['claude-code'],
        platform,
      });

      // Assert: Summary logged (1 installed, 1 skipped, 1 failed)
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('installed'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('skipped'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('failed'));

      logSpy.mockRestore();
    });

    it('should continue with MCP sync after plugin sync', async () => {
      // Arrange
      const userConfig = buildUserConfig({
        'python-development': buildPluginConfig('claude-code-workflows'),
      });

      mockConfigLoader.loadUserConfig.mockResolvedValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockResolvedValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(userConfig);

      mockDetector.detectInstalledPlugins.mockResolvedValue([]);
      mockInstaller.installPlugin.mockResolvedValue(
        buildInstallationResult({ success: true })
      );

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Act
      await syncClients({
        clients: ['claude-code'],
        platform,
      });

      // Assert: Both plugin and MCP sync happened
      expect(mockInstaller.installPlugin).toHaveBeenCalled();
      expect(adapter.writeConfig).toHaveBeenCalled();
    });

    it('should support --skip-plugins flag', async () => {
      // Arrange
      const userConfig = buildUserConfig({
        'python-development': buildPluginConfig('claude-code-workflows'),
      });

      mockConfigLoader.loadUserConfig.mockResolvedValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockResolvedValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(userConfig);

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Act
      await syncClients({
        clients: ['claude-code'],
        platform,
        skipPlugins: true, // Skip plugin installation
      });

      // Assert: Plugin sync skipped
      expect(mockDetector.detectInstalledPlugins).not.toHaveBeenCalled();
      expect(mockInstaller.installPlugin).not.toHaveBeenCalled();

      // Assert: MCP sync still happened
      expect(adapter.writeConfig).toHaveBeenCalled();
    });

    it('should support --dry-run for plugins', async () => {
      // Arrange
      const userConfig = buildUserConfig({
        'python-development': buildPluginConfig('claude-code-workflows'),
      });

      mockConfigLoader.loadUserConfig.mockResolvedValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockResolvedValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(userConfig);

      mockDetector.detectInstalledPlugins.mockResolvedValue([]);
      mockInstaller.installPlugin.mockResolvedValue(
        buildInstallationResult({
          success: true,
          output: '[DRY RUN] Would install: python-development@claude-code-workflows',
        })
      );

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Spy on console.log
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await syncClients({
        clients: ['claude-code'],
        platform,
        dryRun: true,
      });

      // Assert: Dry-run messages logged
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('DRY RUN'));
      expect(mockInstaller.installPlugin).toHaveBeenCalledWith(
        'python-development',
        'claude-code-workflows',
        expect.objectContaining({ dryRun: true })
      );

      logSpy.mockRestore();
    });

    it('should handle empty plugins section gracefully', async () => {
      // Arrange: No plugins in config
      const userConfig = buildUserConfig({});

      mockConfigLoader.loadUserConfig.mockResolvedValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockResolvedValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(userConfig);

      const adapter = createMockAdapter('claude-code');
      adapter.readConfig.mockResolvedValue(null);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Act
      const result = await syncClients({
        clients: ['claude-code'],
        platform,
      });

      // Assert: No plugin operations, MCP sync still works
      expect(mockDetector.detectInstalledPlugins).not.toHaveBeenCalled();
      expect(mockInstaller.installPlugin).not.toHaveBeenCalled();
      expect(adapter.writeConfig).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });
});
