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

// Mock modules
jest.mock('./config-loader');
jest.mock('../adapters/adapter-registry', () => ({
  getAdapterForClient: jest.fn(),
}));
jest.mock('./process-lock');
jest.mock('./backup-service');

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
});
