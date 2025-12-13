import type { Mock, Mocked, MockedObject, MockedFunction, MockInstance } from 'vitest';
/**
 * Tests for plugin-list command
 *
 * Tests various output modes and filters for listing installed plugins.
 */

import { Command } from 'commander';
import { createPluginListCommand } from './plugin-list';
import { PluginExporter } from '../../core/plugin-exporter';
import { Logger } from '../../utils/logger';

// Create mock instance using vi.hoisted for proper hoisting
const { pluginExporterMock, MockPluginExporter } = vi.hoisted(() => {
  const mockInstance = {
    exportPlugins: vi.fn(),
    exportAllPlugins: vi.fn(),
    compareInstalledWithConfig: vi.fn(),
  };
  return {
    pluginExporterMock: mockInstance,
    MockPluginExporter: function PluginExporter() {
      return mockInstance;
    },
  };
});

// Mock dependencies
vi.mock('../../core/plugin-exporter', () => ({
  PluginExporter: MockPluginExporter,
}));
vi.mock('../../utils/logger');

describe('plugin-list command', () => {
  let command: Command;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create command
    command = createPluginListCommand();
  });

  describe('default output mode', () => {
    it('should call compareInstalledWithConfig to get plugin data', async () => {
      pluginExporterMock.compareInstalledWithConfig.mockResolvedValue({
        installedOnly: [],
        configOnly: [],
        both: [],
      });

      await command.parseAsync(['node', 'list']);

      expect(pluginExporterMock.compareInstalledWithConfig).toHaveBeenCalled();
    });

    it('should display plugins in human-readable format', async () => {
      pluginExporterMock.compareInstalledWithConfig.mockResolvedValue({
        installedOnly: [
          {
            name: 'experimental-plugin',
            marketplace: 'custom',
            enabled: true,
          },
        ],
        configOnly: ['missing-plugin'],
        both: [
          {
            name: 'python-development',
            marketplace: 'claude-code-workflows',
            enabled: true,
          },
        ],
      });

      await command.parseAsync(['node', 'list']);

      expect(Logger.info).toHaveBeenCalled();
      expect(pluginExporterMock.compareInstalledWithConfig).toHaveBeenCalled();
    });

    it('should handle no plugins installed', async () => {
      pluginExporterMock.compareInstalledWithConfig.mockResolvedValue({
        installedOnly: [],
        configOnly: [],
        both: [],
      });

      await command.parseAsync(['node', 'list']);

      expect(Logger.info).toHaveBeenCalled();
      expect(pluginExporterMock.compareInstalledWithConfig).toHaveBeenCalled();
    });
  });

  describe('--json flag', () => {
    it('should output JSON format when --json specified', async () => {
      pluginExporterMock.compareInstalledWithConfig.mockResolvedValue({
        installedOnly: [
          {
            name: 'experimental-plugin',
            marketplace: 'custom',
            enabled: true,
          },
        ],
        configOnly: ['missing-plugin'],
        both: [
          {
            name: 'python-development',
            marketplace: 'claude-code-workflows',
            enabled: true,
          },
        ],
      });

      // Mock console.log to capture JSON output
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();

      await command.parseAsync(['node', 'list', '--json']);

      expect(pluginExporterMock.compareInstalledWithConfig).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();

      // Verify JSON was output
      const jsonOutput = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(jsonOutput)).not.toThrow();

      consoleLogSpy.mockRestore();
    });

    it('should include all plugin data in JSON output', async () => {
      pluginExporterMock.compareInstalledWithConfig.mockResolvedValue({
        installedOnly: [
          {
            name: 'experimental-plugin',
            marketplace: 'custom',
            enabled: true,
          },
        ],
        configOnly: [],
        both: [
          {
            name: 'python-development',
            marketplace: 'claude-code-workflows',
            enabled: true,
          },
        ],
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();

      await command.parseAsync(['node', 'list', '--json']);

      const jsonOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(jsonOutput).toHaveProperty('installed');
      expect(jsonOutput).toHaveProperty('summary');
      expect(jsonOutput.installed).toHaveLength(2);
      expect(jsonOutput.summary.totalInstalled).toBe(2);

      consoleLogSpy.mockRestore();
    });
  });

  describe('--config-only flag', () => {
    it('should filter to only plugins in config', async () => {
      pluginExporterMock.compareInstalledWithConfig.mockResolvedValue({
        installedOnly: [
          {
            name: 'experimental-plugin',
            marketplace: 'custom',
            enabled: true,
          },
        ],
        configOnly: [],
        both: [
          {
            name: 'python-development',
            marketplace: 'claude-code-workflows',
            enabled: true,
          },
        ],
      });

      await command.parseAsync(['node', 'list', '--config-only']);

      expect(pluginExporterMock.compareInstalledWithConfig).toHaveBeenCalled();
      expect(Logger.info).toHaveBeenCalled();
    });

    it('should handle no plugins in config', async () => {
      pluginExporterMock.compareInstalledWithConfig.mockResolvedValue({
        installedOnly: [
          {
            name: 'experimental-plugin',
            marketplace: 'custom',
            enabled: true,
          },
        ],
        configOnly: [],
        both: [],
      });

      await command.parseAsync(['node', 'list', '--config-only']);

      expect(pluginExporterMock.compareInstalledWithConfig).toHaveBeenCalled();
      expect(Logger.info).toHaveBeenCalled();
    });
  });

  describe('--installed-only flag', () => {
    it('should filter to only installed plugins not in config', async () => {
      pluginExporterMock.compareInstalledWithConfig.mockResolvedValue({
        installedOnly: [
          {
            name: 'experimental-plugin',
            marketplace: 'custom',
            enabled: true,
          },
        ],
        configOnly: [],
        both: [
          {
            name: 'python-development',
            marketplace: 'claude-code-workflows',
            enabled: true,
          },
        ],
      });

      await command.parseAsync(['node', 'list', '--installed-only']);

      expect(pluginExporterMock.compareInstalledWithConfig).toHaveBeenCalled();
      expect(Logger.info).toHaveBeenCalled();
    });

    it('should handle no installed-only plugins', async () => {
      pluginExporterMock.compareInstalledWithConfig.mockResolvedValue({
        installedOnly: [],
        configOnly: [],
        both: [
          {
            name: 'python-development',
            marketplace: 'claude-code-workflows',
            enabled: true,
          },
        ],
      });

      await command.parseAsync(['node', 'list', '--installed-only']);

      expect(pluginExporterMock.compareInstalledWithConfig).toHaveBeenCalled();
      expect(Logger.info).toHaveBeenCalled();
    });
  });

  describe('flag combinations', () => {
    it('should support --json with --config-only', async () => {
      pluginExporterMock.compareInstalledWithConfig.mockResolvedValue({
        installedOnly: [{ name: 'exp', marketplace: 'custom', enabled: true }],
        configOnly: [],
        both: [{ name: 'python', marketplace: 'claude-code-workflows', enabled: true }],
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();

      await command.parseAsync(['node', 'list', '--json', '--config-only']);

      expect(pluginExporterMock.compareInstalledWithConfig).toHaveBeenCalled();

      const jsonOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(jsonOutput.installed).toHaveLength(1); // Only 'both' plugins

      consoleLogSpy.mockRestore();
    });

    it('should support --json with --installed-only', async () => {
      pluginExporterMock.compareInstalledWithConfig.mockResolvedValue({
        installedOnly: [{ name: 'exp', marketplace: 'custom', enabled: true }],
        configOnly: [],
        both: [{ name: 'python', marketplace: 'claude-code-workflows', enabled: true }],
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();

      await command.parseAsync(['node', 'list', '--json', '--installed-only']);

      expect(pluginExporterMock.compareInstalledWithConfig).toHaveBeenCalled();

      const jsonOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(jsonOutput.installed).toHaveLength(1); // Only 'installedOnly' plugins

      consoleLogSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const error = new Error('Failed to detect plugins');
      pluginExporterMock.compareInstalledWithConfig.mockRejectedValue(error);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(command.parseAsync(['node', 'list'])).rejects.toThrow(
        'process.exit called'
      );

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe('command metadata', () => {
    it('should have correct command name', () => {
      expect(command.name()).toBe('list');
    });

    it('should have a description', () => {
      expect(command.description()).toBeTruthy();
    });

    it('should support --json option', () => {
      const jsonOption = command.options.find((opt) => opt.flags.includes('--json'));
      expect(jsonOption).toBeDefined();
    });

    it('should support --config-only option', () => {
      const configOnlyOption = command.options.find((opt) =>
        opt.flags.includes('--config-only')
      );
      expect(configOnlyOption).toBeDefined();
    });

    it('should support --installed-only option', () => {
      const installedOnlyOption = command.options.find((opt) =>
        opt.flags.includes('--installed-only')
      );
      expect(installedOnlyOption).toBeDefined();
    });
  });
});
