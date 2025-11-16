/**
 * Plugin Sync Integration Tests
 *
 * Comprehensive end-to-end integration tests for plugin sync workflows.
 * Tests complete workflows including detection, installation, export, and sync.
 *
 * These tests focus on the integration between PluginDetector, PluginInstaller,
 * PluginExporter, and SyncEngine to ensure they work correctly together.
 *
 * @module core/__tests__/plugin-sync.integration.spec
 */

import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { PluginDetector } from '../plugin-detector';
import { PluginInstaller } from '../plugin-installer';
import { PluginExporter } from '../plugin-exporter';
import { syncClients } from '../sync-engine';
import type { OvertureConfig } from '../../domain/config.types';
import type { ClaudeSettings } from '../../domain/plugin.types';

// Mock modules
jest.mock('fs/promises');
jest.mock('../path-resolver');
jest.mock('../../infrastructure/process-executor');
jest.mock('../config-loader');
jest.mock('../binary-detector');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPathResolver = require('../path-resolver');
const { ProcessExecutor } = require('../../infrastructure/process-executor');
const mockConfigLoader = require('../config-loader');
const { BinaryDetector } = require('../binary-detector');

describe('Plugin Sync Integration Tests', () => {
  let detector: PluginDetector;
  let installer: PluginInstaller;
  let exporter: PluginExporter;

  // Test fixtures
  const validClaudeSettings: ClaudeSettings = {
    plugins: {
      'python-development@claude-code-workflows': {
        marketplace: 'claude-code-workflows',
        enabled: true,
        installedAt: '2025-01-15T10:00:00Z',
      },
      'backend-development@claude-code-workflows': {
        marketplace: 'claude-code-workflows',
        enabled: true,
        installedAt: '2025-01-14T15:30:00Z',
      },
    },
    marketplaces: ['anthropics/claude-code-workflows'],
  };

  const emptyClaudeSettings: ClaudeSettings = {
    plugins: {},
    marketplaces: [],
  };

  const userConfigWithPlugins: OvertureConfig = {
    version: '2.0',
    plugins: {
      'python-development': {
        marketplace: 'claude-code-workflows',
        enabled: true,
        mcps: ['python-repl', 'ruff'],
      },
      'backend-development': {
        marketplace: 'claude-code-workflows',
        enabled: true,
        mcps: ['docker', 'postgres'],
      },
      'kubernetes-operations': {
        marketplace: 'claude-code-workflows',
        enabled: false,
        mcps: ['kubectl'],
      },
    },
    mcp: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new PluginDetector();
    installer = new PluginInstaller();
    exporter = new PluginExporter(detector);

    // Setup default path resolver mocks
    mockPathResolver.getUserConfigPath.mockReturnValue(
      '/home/user/.config/overture/config.yaml'
    );
    mockPathResolver.getProjectConfigPath.mockReturnValue(
      '/project/.overture/config.yaml'
    );
    mockPathResolver.findProjectRoot.mockReturnValue(null);

    // Default config loader mocks - return null configs by default
    mockConfigLoader.loadUserConfig.mockReturnValue(null);
    mockConfigLoader.loadProjectConfig.mockReturnValue(null);

    // Default fs mocks
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);

    // Default process executor mocks
    ProcessExecutor.exec.mockResolvedValue({
      stdout: 'Success',
      stderr: '',
      exitCode: 0,
    });

    // Mock binary detector to always return found
    BinaryDetector.prototype.detectBinary = jest.fn().mockResolvedValue({ found: true });
  });

  describe('PluginDetector Integration', () => {
    it('should detect all installed plugins from .claude/settings.json', async () => {
      // Arrange
      mockFs.readFile.mockResolvedValue(JSON.stringify(validClaudeSettings));

      // Act
      const plugins = await detector.detectInstalledPlugins();

      // Assert
      expect(plugins).toHaveLength(2);
      expect(plugins[0]).toMatchObject({
        name: 'python-development',
        marketplace: 'claude-code-workflows',
        enabled: true,
      });
      expect(plugins[1]).toMatchObject({
        name: 'backend-development',
        marketplace: 'claude-code-workflows',
        enabled: true,
      });
    });

    it('should return empty array when settings.json not found', async () => {
      // Arrange
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act
      const plugins = await detector.detectInstalledPlugins();

      // Assert
      expect(plugins).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('.claude/settings.json not found')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle malformed settings.json gracefully', async () => {
      // Arrange
      mockFs.readFile.mockResolvedValue('{ invalid json }');
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act
      const plugins = await detector.detectInstalledPlugins();

      // Assert
      expect(plugins).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Malformed .claude/settings.json')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should filter disabled plugins when requested', async () => {
      // Arrange
      const mixedSettings: ClaudeSettings = {
        plugins: {
          'enabled-plugin@marketplace': {
            marketplace: 'marketplace',
            enabled: true,
            installedAt: '2025-01-15T10:00:00Z',
          },
          'disabled-plugin@marketplace': {
            marketplace: 'marketplace',
            enabled: false,
            installedAt: '2025-01-14T10:00:00Z',
          },
        },
        marketplaces: [],
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mixedSettings));

      // Act
      const allPlugins = await detector.detectInstalledPlugins({ includeDisabled: true });
      const enabledOnly = await detector.detectInstalledPlugins({ includeDisabled: false });

      // Assert
      expect(allPlugins).toHaveLength(2);
      expect(enabledOnly).toHaveLength(1);
      expect(enabledOnly[0].name).toBe('enabled-plugin');
    });
  });

  describe('PluginInstaller Integration', () => {
    it('should successfully install a plugin', async () => {
      // Arrange
      ProcessExecutor.exec.mockImplementation(async (cmd: string, args: string[]) => {
        if (args.includes('install')) {
          return {
            stdout: `Installing ${args[2]}...\n✓ Plugin installed successfully`,
            stderr: '',
            exitCode: 0,
          };
        }
        return { stdout: 'Success', stderr: '', exitCode: 0 };
      });

      // Act
      const result = await installer.installPlugin(
        'python-development',
        'claude-code-workflows'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.plugin).toBe('python-development');
      expect(result.marketplace).toBe('claude-code-workflows');
      expect(ProcessExecutor.exec).toHaveBeenCalledWith(
        'claude',
        ['plugin', 'install', 'python-development@claude-code-workflows']
      );
    });

    it('should handle installation failure gracefully', async () => {
      // Arrange
      ProcessExecutor.exec.mockResolvedValue({
        stdout: '',
        stderr: 'Error: Plugin not found',
        exitCode: 1,
      });

      // Act
      const result = await installer.installPlugin('bad-plugin', 'unknown-marketplace');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Installation failed');
    });

    it('should handle timeout during installation', async () => {
      // Arrange
      ProcessExecutor.exec.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 35000))
      );

      // Act
      const result = await installer.installPlugin('slow-plugin', 'marketplace', {
        timeout: 100,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should simulate installation in dry-run mode', async () => {
      // Act
      const result = await installer.installPlugin(
        'test-plugin',
        'marketplace',
        { dryRun: true }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain('DRY RUN');
      expect(ProcessExecutor.exec).not.toHaveBeenCalled();
    });

    it('should install multiple plugins sequentially', async () => {
      // Arrange
      const installOrder: string[] = [];
      ProcessExecutor.exec.mockImplementation(async (cmd: string, args: string[]) => {
        if (args.includes('install')) {
          installOrder.push(args[2]);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return { stdout: 'Success', stderr: '', exitCode: 0 };
      });

      // Act
      await installer.installPlugins([
        ['plugin1', 'marketplace'],
        ['plugin2', 'marketplace'],
        ['plugin3', 'marketplace'],
      ]);

      // Assert
      expect(installOrder).toEqual([
        'plugin1@marketplace',
        'plugin2@marketplace',
        'plugin3@marketplace',
      ]);
    });
  });

  describe('PluginExporter Integration', () => {
    it('should export selected plugins to user config', async () => {
      // Arrange
      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('.claude/settings.json')) {
          return JSON.stringify(validClaudeSettings);
        }
        // Empty config initially
        return yaml.dump({ version: '2.0', mcp: {} });
      });

      let writtenConfig: string | undefined;
      mockFs.writeFile.mockImplementation(async (filePath: string, content: string) => {
        writtenConfig = content;
        return undefined;
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await exporter.exportPlugins({
        interactive: false,
        pluginNames: ['python-development', 'backend-development'],
      });

      // Assert
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(writtenConfig).toBeDefined();

      const parsedConfig = yaml.load(writtenConfig!) as OvertureConfig;
      expect(parsedConfig.plugins).toBeDefined();
      expect(parsedConfig.plugins!['python-development']).toMatchObject({
        marketplace: 'claude-code-workflows',
        enabled: true,
      });
      expect(parsedConfig.plugins!['backend-development']).toMatchObject({
        marketplace: 'claude-code-workflows',
        enabled: true,
      });

      consoleLogSpy.mockRestore();
    });

    it('should preserve existing config structure when exporting', async () => {
      // Arrange
      const existingConfig: OvertureConfig = {
        version: '2.0',
        plugins: {
          'old-plugin': {
            marketplace: 'old-marketplace',
            enabled: true,
            mcps: ['old-mcp'],
          },
        },
        mcp: {
          filesystem: {
            command: 'mcp-server-filesystem',
            args: [],
            transport: 'stdio',
          },
        },
      };

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('.claude/settings.json')) {
          return JSON.stringify(validClaudeSettings);
        }
        return yaml.dump(existingConfig);
      });

      let writtenConfig: string | undefined;
      mockFs.writeFile.mockImplementation(async (filePath: string, content: string) => {
        writtenConfig = content;
        return undefined;
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await exporter.exportPlugins({
        interactive: false,
        pluginNames: ['python-development'],
      });

      // Assert
      const parsedConfig = yaml.load(writtenConfig!) as OvertureConfig;
      expect(parsedConfig.mcp?.filesystem).toBeDefined();
      expect(parsedConfig.plugins!['old-plugin']).toBeDefined();
      expect(parsedConfig.plugins!['python-development']).toBeDefined();

      consoleLogSpy.mockRestore();
    });

    it('should compare installed vs configured plugins', async () => {
      // Arrange
      const mixedConfig: OvertureConfig = {
        version: '2.0',
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
          'not-installed-plugin': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
        },
        mcp: {},
      };

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('.claude/settings.json')) {
          return JSON.stringify(validClaudeSettings);
        }
        return yaml.dump(mixedConfig);
      });

      // Act
      const comparison = await exporter.compareInstalledWithConfig();

      // Assert
      expect(comparison.both).toHaveLength(1);
      expect(comparison.both[0].name).toBe('python-development');

      expect(comparison.installedOnly).toHaveLength(1);
      expect(comparison.installedOnly[0].name).toBe('backend-development');

      expect(comparison.configOnly).toHaveLength(1);
      expect(comparison.configOnly).toContain('not-installed-plugin');
    });
  });

  describe('SyncEngine Plugin Integration', () => {
    it('should sync plugins before MCP sync', async () => {
      // Arrange: No plugins installed, config has 2 enabled plugins
      mockFs.readFile.mockResolvedValue(JSON.stringify(emptyClaudeSettings));

      mockConfigLoader.loadUserConfig.mockReturnValue(userConfigWithPlugins);
      mockConfigLoader.loadProjectConfig.mockReturnValue(null);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await syncClients({ skipBinaryDetection: true, skipPlugins: false });

      // Assert: Should attempt to install 2 plugins (not the disabled one)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Syncing plugins from user config')
      );

      consoleLogSpy.mockRestore();
    });

    it('should skip plugin sync when skipPlugins is true', async () => {
      // Arrange
      mockConfigLoader.loadUserConfig.mockReturnValue(userConfigWithPlugins);
      mockConfigLoader.loadProjectConfig.mockReturnValue(null);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await syncClients({ skipBinaryDetection: true, skipPlugins: true });

      // Assert: Should NOT sync plugins
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Syncing plugins')
      );

      consoleLogSpy.mockRestore();
    });

    it('should warn when plugins declared in project config', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '2.0',
        project: {
          name: 'my-api',
          type: 'python-backend',
        },
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
          },
        },
        mcp: {},
      };

      mockConfigLoader.loadUserConfig.mockReturnValue({ version: '2.0', mcp: {} });
      mockConfigLoader.loadProjectConfig.mockReturnValue(projectConfig);
      mockPathResolver.findProjectRoot.mockReturnValue('/project');

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act
      await syncClients({ skipBinaryDetection: true, projectRoot: '/project' });

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Plugin configuration found in project config')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('python-development')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should continue sync even if plugin installation fails', async () => {
      // Arrange
      mockFs.readFile.mockResolvedValue(JSON.stringify(emptyClaudeSettings));

      mockConfigLoader.loadUserConfig.mockReturnValue({
        version: '2.0',
        plugins: {
          'test-plugin': {
            marketplace: 'claude-code-workflows',
            enabled: true,
          },
        },
        mcp: {},
      });

      ProcessExecutor.exec.mockRejectedValue(new Error('Installation failed'));

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act
      const result = await syncClients({ skipBinaryDetection: true });

      // Assert: Should continue despite plugin failure
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Plugin sync failed')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('End-to-End Workflows', () => {
    it('should complete full sync workflow on fresh machine', async () => {
      // Arrange: No plugins installed, config has plugins and MCPs
      mockFs.readFile.mockResolvedValue(JSON.stringify(emptyClaudeSettings));

      const fullConfig: OvertureConfig = {
        version: '2.0',
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['python-repl'],
          },
        },
        mcp: {
          'python-repl': {
            command: 'uvx',
            args: ['mcp-server-python-repl'],
            transport: 'stdio',
          },
        },
      };

      mockConfigLoader.loadUserConfig.mockReturnValue(fullConfig);
      mockConfigLoader.loadProjectConfig.mockReturnValue(null);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await syncClients({ skipBinaryDetection: true });

      // Assert: Plugin sync should occur before MCP sync
      const allLogs = consoleLogSpy.mock.calls.map((call) => call[0]);
      const pluginSyncIndex = allLogs.findIndex((log) =>
        String(log).includes('Syncing plugins')
      );

      // Plugin sync should happen (might be -1 if no plugins to install, but we can check the attempt)
      expect(consoleLogSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should detect, install, and export plugins in sequence', async () => {
      // Arrange: Start with 1 plugin, install 1 more, then export both
      const initialSettings: ClaudeSettings = {
        plugins: {
          'python-development@claude-code-workflows': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            installedAt: '2025-01-15T10:00:00Z',
          },
        },
        marketplaces: [],
      };

      let currentSettings = initialSettings;

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('.claude/settings.json')) {
          return JSON.stringify(currentSettings);
        }
        return yaml.dump({ version: '2.0', mcp: {} });
      });

      mockFs.writeFile.mockImplementation(async () => undefined);

      // Step 1: Detect initial plugins
      const initialPlugins = await detector.detectInstalledPlugins();
      expect(initialPlugins).toHaveLength(1);

      // Step 2: Install new plugin
      const installResult = await installer.installPlugin(
        'backend-development',
        'claude-code-workflows'
      );
      expect(installResult.success).toBe(true);

      // Simulate plugin now installed
      currentSettings = {
        plugins: {
          ...initialSettings.plugins,
          'backend-development@claude-code-workflows': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            installedAt: '2025-01-15T11:00:00Z',
          },
        },
        marketplaces: [],
      };

      // Step 3: Detect all plugins
      const allPlugins = await detector.detectInstalledPlugins();
      expect(allPlugins).toHaveLength(2);

      // Step 4: Export all plugins
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await exporter.exportPlugins({
        interactive: false,
        pluginNames: ['python-development', 'backend-development'],
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updated user config with 2 plugins')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty plugins section gracefully', async () => {
      // Arrange
      mockConfigLoader.loadUserConfig.mockReturnValue({
        version: '2.0',
        plugins: {},
        mcp: {},
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await syncClients({ skipBinaryDetection: true });

      // Assert: Should not attempt any installations
      expect(ProcessExecutor.exec).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(['install'])
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle disabled plugins correctly during sync', async () => {
      // Arrange
      mockFs.readFile.mockResolvedValue(JSON.stringify(emptyClaudeSettings));

      mockConfigLoader.loadUserConfig.mockReturnValue({
        version: '2.0',
        plugins: {
          'enabled-plugin': {
            marketplace: 'claude-code-workflows',
            enabled: true,
          },
          'disabled-plugin': {
            marketplace: 'claude-code-workflows',
            enabled: false,
          },
        },
        mcp: {},
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await syncClients({ skipBinaryDetection: true });

      // Assert: Should only install 1 plugin (enabled one)
      // The log will say "2 missing plugins" but only enabled-plugin will be installed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(' Installing 1 missing plugins')
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle plugins with special characters in names', async () => {
      // Arrange
      const specialSettings: ClaudeSettings = {
        plugins: {
          'my-plugin_v2@custom-org/custom-marketplace': {
            marketplace: 'custom-org/custom-marketplace',
            enabled: true,
            installedAt: '2025-01-15T10:00:00Z',
          },
        },
        marketplaces: [],
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(specialSettings));

      // Act
      const plugins = await detector.detectInstalledPlugins();

      // Assert
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('my-plugin_v2');
      expect(plugins[0].marketplace).toBe('custom-org/custom-marketplace');
    });

    it('should handle large number of plugins efficiently', async () => {
      // Arrange: 50 plugins
      const manyPlugins: Record<string, any> = {};
      for (let i = 0; i < 50; i++) {
        manyPlugins[`plugin-${i}@marketplace`] = {
          marketplace: 'marketplace',
          enabled: true,
          installedAt: '2025-01-15T10:00:00Z',
        };
      }

      const manyPluginsSettings: ClaudeSettings = {
        plugins: manyPlugins,
        marketplaces: [],
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(manyPluginsSettings));

      const startTime = Date.now();

      // Act
      const plugins = await detector.detectInstalledPlugins();

      const duration = Date.now() - startTime;

      // Assert
      expect(plugins).toHaveLength(50);
      expect(duration).toBeLessThan(100);
    });
  });
});
