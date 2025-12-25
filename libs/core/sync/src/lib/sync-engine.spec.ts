/**
 * SyncEngine Tests
 *
 * Comprehensive tests for the sync-engine orchestration layer.
 * Tests the main sync workflows: config loading, plugin installation,
 * MCP filtering, client synchronization, backup/restore, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncEngine, type SyncEngineDeps } from './sync-engine.js';
import { createMockSyncEngineDeps } from '@overture/testing';
import type { OvertureConfig, ClientName } from '@overture/config-types';
import type { ClientAdapter } from '@overture/client-adapters';

// Mock the helper functions
vi.mock('./exclusion-filter.js', () => ({
  filterMcpsForClient: vi.fn((mcps) => mcps),
}));

vi.mock('./transport-validator.js', () => ({
  getTransportWarnings: vi.fn(() => []),
  hasTransportIssues: vi.fn(() => false),
}));

vi.mock('./client-env-service.js', () => ({
  expandEnvVarsInClientConfig: vi.fn((config) => config),
}));

vi.mock('./config-diff.js', () => ({
  generateDiff: vi.fn(() => ({ added: [], removed: [], changed: [] })),
}));

vi.mock('./mcp-detector.js', () => ({
  getUnmanagedMcps: vi.fn(() => ({})),
}));

describe('SyncEngine', () => {
  let deps: SyncEngineDeps;
  let engine: SyncEngine;
  let mockAdapter: ClientAdapter;

  beforeEach(() => {
    deps = createMockSyncEngineDeps();
    engine = new SyncEngine(deps);

    // Setup default mock adapter
    mockAdapter = {
      name: 'claude-code' as ClientName,
      schemaRootKey: 'mcpServers',
      isInstalled: vi.fn(() => true),
      detectConfigPath: vi.fn(() => '/home/user/.claude.json'),
      readConfig: vi.fn().mockResolvedValue({ mcpServers: {} }),
      writeConfig: vi.fn().mockResolvedValue(undefined),
      convertFromOverture: vi.fn((config) => ({ mcpServers: config.mcp })),
      validateTransport: vi.fn(() => true),
    } as unknown as ClientAdapter;

    vi.mocked(deps.adapterRegistry.get).mockReturnValue(mockAdapter);
  });

  describe('syncClients()', () => {
    it('should load and merge user and project configs', async () => {
      const userConfig: OvertureConfig = {
        version: '1.0',
        mcp: { 'user-mcp': { command: 'user-cmd', transport: 'stdio' } },
      };
      const projectConfig: OvertureConfig = {
        version: '1.0',
        mcp: { 'project-mcp': { command: 'project-cmd', transport: 'stdio' } },
      };

      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(userConfig);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(
        projectConfig,
      );
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(projectConfig);

      await engine.syncClients({ clients: ['claude-code'] });

      expect(deps.configLoader.loadUserConfig).toHaveBeenCalled();
      expect(deps.configLoader.loadProjectConfig).toHaveBeenCalledWith(
        '/home/user/project',
      );
      expect(deps.configLoader.mergeConfigs).toHaveBeenCalledWith(
        userConfig,
        projectConfig,
      );
    });

    it('should sync to multiple clients', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: { 'test-mcp': { command: 'test-cmd', transport: 'stdio' } },
      };

      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      // Create different adapters for each client
      const desktopAdapter: ClientAdapter = {
        name: 'claude-desktop' as ClientName,
        schemaRootKey: 'mcpServers',
        isInstalled: vi.fn(() => true),
        detectConfigPath: vi.fn(
          () => '/home/user/.config/claude-desktop/mcp.json',
        ),
        readConfig: vi.fn().mockResolvedValue({ mcpServers: {} }),
        writeConfig: vi.fn().mockResolvedValue(undefined),
        convertFromOverture: vi.fn((config) => ({ mcpServers: config.mcp })),
        validateTransport: vi.fn(() => true),
      } as unknown as ClientAdapter;

      vi.mocked(deps.adapterRegistry.get).mockImplementation((name: string) => {
        if (name === 'claude-desktop') return desktopAdapter;
        return mockAdapter;
      });

      const result = await engine.syncClients({
        clients: ['claude-code', 'claude-desktop'],
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].client).toBe('claude-code');
      expect(result.results[1].client).toBe('claude-desktop');
    });

    it('should skip plugin sync when skipPlugins is true', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: { 'test-plugin': { marketplace: 'test', enabled: true } },
        mcp: {},
      };

      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      await engine.syncClients({ clients: ['claude-code'], skipPlugins: true });

      expect(deps.pluginDetector.detectInstalledPlugins).not.toHaveBeenCalled();
      expect(deps.pluginInstaller.installPlugin).not.toHaveBeenCalled();
    });

    it('should warn when no adapters registered for clients', async () => {
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0',
        mcp: {},
      });
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);

      const result = await engine.syncClients({
        clients: ['unknown-client' as ClientName],
      });

      expect(result.warnings).toContain(
        'No adapter registered for unknown-client',
      );
    });

    it('should return error when no valid clients', async () => {
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0',
        mcp: {},
      });
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);

      const result = await engine.syncClients({
        clients: ['unknown-client' as ClientName],
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No valid clients to sync');
    });

    it('should handle config loading errors', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockRejectedValue(
        new Error('Config load failed'),
      );

      const result = await engine.syncClients({ clients: ['claude-code'] });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Config load failed');
    });

    it('should aggregate warnings and errors from all clients', async () => {
      const config: OvertureConfig = { version: '1.0', mcp: {} };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      vi.mocked(mockAdapter.writeConfig).mockRejectedValueOnce(
        new Error('Write failed'),
      );

      const result = await engine.syncClients({ clients: ['claude-code'] });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('syncClient() - single client convenience method', () => {
    it('should sync to a single client', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: { 'test-mcp': { command: 'test-cmd', transport: 'stdio' } },
      };

      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      const result = await engine.syncClient('claude-code');

      expect(result.client).toBe('claude-code');
      expect(result.success).toBe(true);
      expect(result.configPath).toBe('/home/user/.claude.json');
    });

    it('should return error result when sync fails', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockRejectedValue(
        new Error('Config not found'),
      );

      const result = await engine.syncClient('claude-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Config not found');
    });
  });

  describe('syncToClient() - binary detection', () => {
    it('should detect client binary when not skipped', async () => {
      vi.mocked(deps.binaryDetector.detectClient).mockResolvedValue({
        status: 'found',
        version: '1.0.0',
        binaryPath: '/usr/bin/claude',
        warnings: [],
      });

      await engine.syncClient('claude-code');

      expect(deps.binaryDetector.detectClient).toHaveBeenCalledWith(
        mockAdapter,
        'linux',
      );
    });

    it('should skip binary detection when skipBinaryDetection is true', async () => {
      const config: OvertureConfig = { version: '1.0', mcp: {} };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      await engine.syncClient('claude-code', { skipBinaryDetection: true });

      expect(deps.binaryDetector.detectClient).not.toHaveBeenCalled();
    });

    it('should skip client when not detected and skipUndetected is true', async () => {
      const config: OvertureConfig = { version: '1.0', mcp: {} };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      vi.mocked(deps.binaryDetector.detectClient).mockResolvedValue({
        status: 'not-found',
        warnings: [],
      });

      const result = await engine.syncClient('claude-code', {
        skipUndetected: true,
      });

      expect(result.success).toBe(true);
      expect(result.error).toBe('Skipped - client not detected on system');
      expect(mockAdapter.writeConfig).not.toHaveBeenCalled();
    });

    it('should warn but continue when client not detected and skipUndetected is false', async () => {
      const config: OvertureConfig = { version: '1.0', mcp: {} };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      vi.mocked(deps.binaryDetector.detectClient).mockResolvedValue({
        status: 'not-found',
        warnings: [],
      });

      const result = await engine.syncClient('claude-code', {
        skipUndetected: false,
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        'claude-code binary/application not detected on system. Generating config anyway.',
      );
      expect(mockAdapter.writeConfig).toHaveBeenCalled();
    });
  });

  describe('syncToClient() - transport validation', () => {
    it('should collect transport warnings', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: { 'test-mcp': { command: 'test-cmd', transport: 'sse' } },
      };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      const { getTransportWarnings } = await import('./transport-validator.js');
      vi.mocked(getTransportWarnings).mockReturnValue([
        {
          mcpName: 'test-mcp',
          transport: 'sse',
          clientName: 'claude-code' as ClientName,
          message: 'SSE transport may not be supported',
        },
      ]);

      const result = await engine.syncClient('claude-code');

      expect(result.warnings).toContain('SSE transport may not be supported');
    });

    it('should fail sync when transport issues detected without --force', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: { 'test-mcp': { command: 'test-cmd', transport: 'sse' } },
      };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      const { hasTransportIssues, getTransportWarnings } =
        await import('./transport-validator.js');
      vi.mocked(hasTransportIssues).mockReturnValue(true);
      vi.mocked(getTransportWarnings).mockReturnValue([
        {
          mcpName: 'test-mcp',
          transport: 'sse',
          clientName: 'claude-code' as ClientName,
          message: 'SSE not supported',
        },
      ]);

      const result = await engine.syncClient('claude-code', { force: false });

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Transport issues detected. Use --force to sync anyway.',
      );
    });

    it('should continue sync when transport issues detected with --force', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: { 'test-mcp': { command: 'test-cmd', transport: 'sse' } },
      };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      const { hasTransportIssues } = await import('./transport-validator.js');
      vi.mocked(hasTransportIssues).mockReturnValue(true);

      const result = await engine.syncClient('claude-code', { force: true });

      expect(result.success).toBe(true);
      expect(mockAdapter.writeConfig).toHaveBeenCalled();
    });
  });

  describe('syncToClient() - dry-run mode', () => {
    it('should write to dist/ directory in dry-run mode', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: { 'test-mcp': { command: 'test-cmd', transport: 'stdio' } },
      };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      // Mock filesystem for dry-run directory check
      vi.mocked(deps.filesystem.exists).mockResolvedValue(false);

      // Mock transport validators to avoid transport issues
      const { hasTransportIssues, getTransportWarnings } =
        await import('./transport-validator.js');
      vi.mocked(hasTransportIssues).mockReturnValue(false);
      vi.mocked(getTransportWarnings).mockReturnValue([]);

      // Reset adapter with fresh mock that doesn't throw
      const freshAdapter: ClientAdapter = {
        ...mockAdapter,
        readConfig: vi.fn().mockResolvedValue(null), // No existing config
      };
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(freshAdapter);

      const result = await engine.syncClient('claude-code', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.configPath).toContain('dist/');
      expect(deps.filesystem.mkdir).toHaveBeenCalled();
    });

    it('should not create backup in dry-run mode', async () => {
      const config: OvertureConfig = { version: '1.0', mcp: {} };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      await engine.syncClient('claude-code', { dryRun: true });

      expect(deps.backupService.backup).not.toHaveBeenCalled();
    });
  });

  describe('syncToClient() - backup and restore', () => {
    it('should create backup before writing new config', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: { 'test-mcp': { command: 'test-cmd', transport: 'stdio' } },
      };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      // Mock transport validators to avoid transport issues
      const { hasTransportIssues, getTransportWarnings } =
        await import('./transport-validator.js');
      vi.mocked(hasTransportIssues).mockReturnValue(false);
      vi.mocked(getTransportWarnings).mockReturnValue([]);

      // Reset adapter with existing config so backup is triggered
      const freshAdapter: ClientAdapter = {
        ...mockAdapter,
        readConfig: vi
          .fn()
          .mockResolvedValue({ mcpServers: { 'old-mcp': {} } }),
      };
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(freshAdapter);

      // Mock file exists so backup is triggered
      vi.mocked(deps.filesystem.exists).mockResolvedValue(true);

      const result = await engine.syncClient('claude-code');

      expect(deps.backupService.backup).toHaveBeenCalledWith(
        'claude-code',
        '/home/user/.claude.json',
      );
      expect(result.backupPath).toContain('backup');
    });

    it('should warn but continue if backup fails', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: { 'test-mcp': { command: 'test-cmd', transport: 'stdio' } },
      };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      // Mock transport validators to avoid transport issues
      const { hasTransportIssues, getTransportWarnings } =
        await import('./transport-validator.js');
      vi.mocked(hasTransportIssues).mockReturnValue(false);
      vi.mocked(getTransportWarnings).mockReturnValue([]);

      // Reset adapter with existing config so backup is triggered
      const freshAdapter: ClientAdapter = {
        ...mockAdapter,
        readConfig: vi
          .fn()
          .mockResolvedValue({ mcpServers: { 'old-mcp': {} } }),
      };
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(freshAdapter);

      // Mock file exists so backup is triggered
      vi.mocked(deps.filesystem.exists).mockResolvedValue(true);

      // Mock backup to throw error
      vi.mocked(deps.backupService.backup).mockImplementation(() => {
        throw new Error('Backup failed');
      });

      const result = await engine.syncClient('claude-code');

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Backup failed: Backup failed');
    });
  });

  describe('syncToClient() - error handling', () => {
    it('should return error when client is not installed', async () => {
      const config: OvertureConfig = { version: '1.0', mcp: {} };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      vi.mocked(mockAdapter.isInstalled).mockReturnValue(false);

      const result = await engine.syncClient('claude-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Client claude-code is not installed');
    });

    it('should return error when config path cannot be determined', async () => {
      const config: OvertureConfig = { version: '1.0', mcp: {} };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      vi.mocked(mockAdapter.detectConfigPath).mockReturnValue(null);

      const result = await engine.syncClient('claude-code');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not determine config path');
    });

    it('should handle writeConfig errors', async () => {
      const config: OvertureConfig = { version: '1.0', mcp: {} };
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(config);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(config);

      // Mock transport validators to not fail so we reach writeConfig
      const { hasTransportIssues, getTransportWarnings } =
        await import('./transport-validator.js');
      vi.mocked(hasTransportIssues).mockReturnValue(false);
      vi.mocked(getTransportWarnings).mockReturnValue([]);

      // Mock writeConfig to throw error
      vi.mocked(mockAdapter.writeConfig).mockRejectedValue(
        new Error('Permission denied'),
      );

      const result = await engine.syncClient('claude-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });
});
