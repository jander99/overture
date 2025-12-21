/**
 * @overture/testing Library Tests
 *
 * Tests for the testing utilities themselves to ensure they work correctly.
 *
 * @module lib/testing.spec
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';

// Import all utilities
import {
  // Filesystem mocks
  createMockFs,
  configureMockFsExists,
  configureMockFsReadFile,
  configureMockFsWriteFile,
  configureMockFsMkdir,
  configureAllFsMocks,
  // Process mocks
  buildExecResult,
  createMockProcess,
  createSuccessProcess,
  createFailureProcess,
  resetMockProcess,
  addMockResults,
  // Adapter mocks
  createMockAdapter,
  createDetectedAdapter,
  createUndetectedAdapter,
  createDisabledAdapter,
  resetAdapterHistory,
  getLastWrittenConfig,
  // Platform mocks
  createLinuxPlatform,
  createMacOSPlatform,
  createWindowsPlatform,
  createWSL2Platform,
  configureMockOs,
  mockLinuxPlatform,
  // Fixtures
  validUserConfig,
  validProjectConfig,
  configWithPlugins,
  minimalConfig,
  // Builders
  buildMcpServer,
  buildClientConfig,
  buildPluginConfig,
  buildSyncOptions,
  buildConfig,
  buildUserConfig,
  buildProjectConfig,
  buildConfigWithPlugins,
  buildClaudeSettings,
  buildInstalledPlugin,
  buildInstalledPlugins,
  buildInstallationResult,
  buildBinaryDetectionResult,
  buildSyncResult,
  buildClientSyncResult,
} from '../index';

describe('@overture/testing', () => {
  describe('Filesystem Mocks', () => {
    it('should create mock filesystem', () => {
      const mockFs = createMockFs({ '/test/file.txt': 'content' }, ['/test']);

      expect(mockFs.files.has('/test/file.txt')).toBe(true);
      expect(mockFs.files.get('/test/file.txt')).toBe('content');
      expect(mockFs.directories.has('/test')).toBe(true);
    });

    it('should configure exists mock', () => {
      const mockFs = createMockFs({ '/test/file.txt': 'content' });
      const existsMock = vi.fn();

      configureMockFsExists(mockFs, existsMock);

      existsMock('/test/file.txt');
      expect(existsMock).toHaveBeenCalledWith('/test/file.txt');
      expect(existsMock('/test/file.txt')).toBe(true);
      expect(existsMock('/nonexistent')).toBe(false);
    });

    it('should configure readFile mock', () => {
      const mockFs = createMockFs({ '/test/file.txt': 'content' });
      const readMock = vi.fn();

      configureMockFsReadFile(mockFs, readMock);

      expect(readMock('/test/file.txt')).toBe('content');
      expect(() => readMock('/nonexistent')).toThrow('ENOENT');
    });

    it('should configure writeFile mock', () => {
      const mockFs = createMockFs();
      const writeMock = vi.fn();

      configureMockFsWriteFile(mockFs, writeMock);

      writeMock('/new/file.txt', 'new content');
      expect(mockFs.files.get('/new/file.txt')).toBe('new content');
    });

    it('should configure mkdir mock', () => {
      const mockFs = createMockFs();
      const mkdirMock = vi.fn();

      configureMockFsMkdir(mockFs, mkdirMock);

      mkdirMock('/new/dir');
      expect(mockFs.directories.has('/new/dir')).toBe(true);
    });
  });

  describe('Process Mocks', () => {
    it('should build exec result', () => {
      const result = buildExecResult('stdout', 'stderr', 1);

      expect(result).toEqual({
        stdout: 'stdout',
        stderr: 'stderr',
        exitCode: 1,
      });
    });

    it('should create mock process', async () => {
      const mockProcess = createMockProcess([
        buildExecResult('output1'),
        buildExecResult('output2'),
      ]);

      const result1 = await mockProcess.execute('cmd', ['arg1']);
      expect(result1.stdout).toBe('output1');
      expect(mockProcess.history).toHaveLength(1);

      const result2 = await mockProcess.execute('cmd', ['arg2']);
      expect(result2.stdout).toBe('output2');
      expect(mockProcess.history).toHaveLength(2);
    });

    it('should throw when mock process queue exhausted', async () => {
      const mockProcess = createMockProcess([buildExecResult('only one')]);

      await mockProcess.execute('cmd', []);
      await expect(mockProcess.execute('cmd', [])).rejects.toThrow(
        'No more mock results available',
      );
    });

    it('should create success process', async () => {
      const mockProcess = createSuccessProcess('success output');
      const result = await mockProcess.execute('cmd', []);

      expect(result.stdout).toBe('success output');
      expect(result.exitCode).toBe(0);
    });

    it('should create failure process', async () => {
      const mockProcess = createFailureProcess('error message', 2);
      const result = await mockProcess.execute('cmd', []);

      expect(result.stderr).toBe('error message');
      expect(result.exitCode).toBe(2);
    });

    it('should reset mock process', async () => {
      const mockProcess = createMockProcess([buildExecResult('test')]);
      await mockProcess.execute('cmd', []);

      expect(mockProcess.history).toHaveLength(1);

      resetMockProcess(mockProcess);

      expect(mockProcess.history).toHaveLength(0);
      expect(mockProcess.currentIndex).toBe(0);
    });

    it('should add more results to mock process', async () => {
      const mockProcess = createMockProcess([buildExecResult('first')]);

      addMockResults(mockProcess, [buildExecResult('second')]);

      const result1 = await mockProcess.execute('cmd', []);
      expect(result1.stdout).toBe('first');

      const result2 = await mockProcess.execute('cmd', []);
      expect(result2.stdout).toBe('second');
    });
  });

  describe('Adapter Mocks', () => {
    it('should create mock adapter', async () => {
      const adapter = createMockAdapter('test-client', {
        enabled: true,
        isDetected: true,
        config: { test: 'value' },
      });

      expect(adapter.name).toBe('test-client');
      expect(await adapter.detect()).toBe(true);
      expect(await adapter.readConfig()).toEqual({ test: 'value' });
    });

    it('should create detected adapter', async () => {
      const adapter = createDetectedAdapter('claude-code', {
        mcpServers: {},
      });

      expect(await adapter.detect()).toBe(true);
      expect(adapter.configPath).toBeTruthy();
    });

    it('should create undetected adapter', async () => {
      const adapter = createUndetectedAdapter('cursor');

      expect(await adapter.detect()).toBe(false);
      expect(adapter.configPath).toBeUndefined();
    });

    it('should create disabled adapter', () => {
      const adapter = createDisabledAdapter('windsurf');

      expect(adapter.enabled).toBe(false);
    });

    it('should track write history', async () => {
      const adapter = createMockAdapter();

      await adapter.writeConfig({ test: 'value1' });
      await adapter.writeConfig({ test: 'value2' });

      expect(adapter.writeHistory).toHaveLength(2);
      expect(getLastWrittenConfig(adapter)).toEqual({ test: 'value2' });
    });

    it('should reset adapter history', async () => {
      const adapter = createMockAdapter();
      await adapter.writeConfig({ test: 'value' });

      resetAdapterHistory(adapter);

      expect(adapter.writeHistory).toHaveLength(0);
      expect(getLastWrittenConfig(adapter)).toBeUndefined();
    });
  });

  describe('Platform Mocks', () => {
    it('should create Linux platform', () => {
      const platform = createLinuxPlatform('/home/testuser');

      expect(platform.platform).toBe('linux');
      expect(platform.homedir).toBe('/home/testuser');
      expect(platform.tmpdir).toBe('/tmp');
    });

    it('should create macOS platform', () => {
      const platform = createMacOSPlatform('/Users/testuser');

      expect(platform.platform).toBe('darwin');
      expect(platform.homedir).toBe('/Users/testuser');
    });

    it('should create Windows platform', () => {
      const platform = createWindowsPlatform('C:\\Users\\testuser');

      expect(platform.platform).toBe('win32');
      expect(platform.homedir).toBe('C:\\Users\\testuser');
    });

    it('should create WSL2 platform', () => {
      const platform = createWSL2Platform('/home/testuser');

      expect(platform.platform).toBe('linux');
      expect(platform.hostname).toBe('test-wsl2');
    });
  });

  describe('Config Fixtures', () => {
    it('should provide valid user config', () => {
      expect(validUserConfig.version).toBe('2.0');
      expect(validUserConfig.clients).toBeDefined();
      expect(validUserConfig.mcp).toBeDefined();
      expect(validUserConfig.sync).toBeDefined();
    });

    it('should provide valid project config', () => {
      expect(validProjectConfig.version).toBe('2.0');
      expect(validProjectConfig.mcp).toBeDefined();
    });

    it('should provide config with plugins', () => {
      expect(configWithPlugins.plugins).toBeDefined();
      expect(Object.keys(configWithPlugins.plugins!)).toContain(
        'python-development',
      );
    });

    it('should provide minimal config', () => {
      expect(minimalConfig.version).toBe('2.0');
      expect(minimalConfig.mcp).toEqual({});
    });
  });

  describe('Config Builders', () => {
    it('should build MCP server', () => {
      const mcp = buildMcpServer('npx', ['-y', 'package'], {}, 'stdio', {
        version: '1.0.0',
      });

      expect(mcp.command).toBe('npx');
      expect(mcp.args).toEqual(['-y', 'package']);
      expect(mcp.transport).toBe('stdio');
      expect(mcp.version).toBe('1.0.0');
    });

    it('should build client config', () => {
      const client = buildClientConfig(true, { configPath: '~/.custom' });

      expect(client.enabled).toBe(true);
      expect(client.configPath).toBe('~/.custom');
    });

    it('should build plugin config', () => {
      const plugin = buildPluginConfig('claude-code-workflows', true, [
        'python-repl',
      ]);

      expect(plugin.marketplace).toBe('claude-code-workflows');
      expect(plugin.enabled).toBe(true);
      expect(plugin.mcps).toEqual(['python-repl']);
    });

    it('should build sync options', () => {
      const sync = buildSyncOptions({ backup: false });

      expect(sync.backup).toBe(false);
      expect(sync.mergeStrategy).toBe('append');
    });

    it('should build full config', () => {
      const config = buildConfig({
        version: '2.0',
        mcp: {
          github: buildMcpServer('mcp-server-github', [], {}, 'stdio'),
        },
      });

      expect(config.version).toBe('2.0');
      expect(config.mcp.github).toBeDefined();
    });

    it('should build user config', () => {
      const config = buildUserConfig({}, {});

      expect(config.version).toBe('2.0');
      expect(config.sync).toBeDefined();
    });

    it('should build project config', () => {
      const config = buildProjectConfig({
        'nx-mcp': buildMcpServer('npx', ['@jander99/nx-mcp']),
      });

      expect(config.version).toBe('2.0');
      expect(config.mcp['nx-mcp']).toBeDefined();
    });

    it('should build config with plugins', () => {
      const config = buildConfigWithPlugins({
        'python-development': buildPluginConfig(),
      });

      expect(config.plugins).toBeDefined();
    });

    it('should build Claude settings', () => {
      const settings = buildClaudeSettings({ 'test-plugin': {} }, [
        'claude-code-workflows',
      ]);

      expect(settings.plugins).toBeDefined();
      expect(settings.marketplaces).toContain('claude-code-workflows');
    });

    it('should build installed plugin', () => {
      const plugin = buildInstalledPlugin({
        name: 'python-development',
        marketplace: 'claude-code-workflows',
      });

      expect(plugin.name).toBe('python-development');
      expect(plugin.marketplace).toBe('claude-code-workflows');
      expect(plugin.installedAt).toBeDefined();
    });

    it('should build multiple installed plugins', () => {
      const plugins = buildInstalledPlugins(3, {
        marketplace: 'claude-code-workflows',
      });

      expect(plugins).toHaveLength(3);
      expect(plugins[0].marketplace).toBe('claude-code-workflows');
    });

    it('should build installation result', () => {
      const result = buildInstallationResult({ success: true });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should build binary detection result', () => {
      const result = buildBinaryDetectionResult('found', {
        binaryPath: '/usr/local/bin/claude',
        version: '2.1.0',
      });

      expect(result.status).toBe('found');
      expect(result.binaryPath).toBe('/usr/local/bin/claude');
    });

    it('should build sync result', () => {
      const result = buildSyncResult(true, {
        'claude-code': buildClientSyncResult(true, ['github'], []),
      });

      expect(result.success).toBe(true);
      expect(result.summary.totalClients).toBe(1);
      expect(result.summary.successfulClients).toBe(1);
    });

    it('should build client sync result', () => {
      const result = buildClientSyncResult(true, ['github'], ['copilot']);

      expect(result.success).toBe(true);
      expect(result.synced).toEqual(['github']);
      expect(result.skipped).toEqual(['copilot']);
    });
  });

  describe('Integration: Full Mock Setup', () => {
    let mockFs: ReturnType<typeof createMockFs>;
    let mockProcess: ReturnType<typeof createMockProcess>;
    let mockAdapter: ReturnType<typeof createMockAdapter>;

    beforeEach(() => {
      mockFs = createMockFs({ '/config/overture.yml': 'version: "2.0"' }, [
        '/config',
      ]);

      mockProcess = createMockProcess([
        buildExecResult('Plugin installed successfully\n'),
      ]);

      mockAdapter = createDetectedAdapter('claude-code', {
        mcpServers: {},
      });
    });

    it('should work together in test scenarios', async () => {
      // Filesystem
      expect(mockFs.files.has('/config/overture.yml')).toBe(true);

      // Process
      const execResult = await mockProcess.execute('claude', [
        'plugin',
        'install',
      ]);
      expect(execResult.stdout).toContain('installed');

      // Adapter
      const detected = await mockAdapter.detect();
      expect(detected).toBe(true);

      await mockAdapter.writeConfig({ mcpServers: { github: {} } });
      const lastConfig = getLastWrittenConfig(mockAdapter);
      expect(lastConfig?.mcpServers).toBeDefined();
    });
  });
});
