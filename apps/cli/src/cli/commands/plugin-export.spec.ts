import type { Mock, Mocked, MockedObject, MockedFunction, MockInstance } from 'vitest';
/**
 * Tests for plugin-export command
 *
 * Tests both interactive and non-interactive export modes.
 */

import { Command } from 'commander';
import { createPluginExportCommand } from './plugin-export';
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

describe('plugin-export command', () => {
  let command: Command;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create command
    command = createPluginExportCommand();
  });

  describe('interactive mode (default)', () => {
    it('should call exportPlugins with interactive: true by default', async () => {
      pluginExporterMock.exportPlugins.mockResolvedValue(undefined);

      // Parse command without options
      await command.parseAsync(['node', 'export']);

      expect(pluginExporterMock.exportPlugins).toHaveBeenCalledWith({
        interactive: true,
      });
    });

    it('should handle successful export in interactive mode', async () => {
      pluginExporterMock.exportPlugins.mockResolvedValue(undefined);

      await command.parseAsync(['node', 'export']);

      expect(pluginExporterMock.exportPlugins).toHaveBeenCalled();
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('should handle errors in interactive mode', async () => {
      const error = new Error('Export failed');
      pluginExporterMock.exportPlugins.mockRejectedValue(error);

      // Mock process.exit to prevent test from exiting
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(
        command.parseAsync(['node', 'overture', 'plugin', 'export'])
      ).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe('non-interactive mode with --plugin flag', () => {
    it('should export single plugin when --plugin specified once', async () => {
      pluginExporterMock.exportPlugins.mockResolvedValue(undefined);

      await command.parseAsync([
        'node',
        'export',
        '--plugin',
        'python-development',
      ]);

      expect(pluginExporterMock.exportPlugins).toHaveBeenCalledWith({
        interactive: false,
        pluginNames: ['python-development'],
      });
    });

    it('should export multiple plugins when --plugin specified multiple times', async () => {
      pluginExporterMock.exportPlugins.mockResolvedValue(undefined);

      await command.parseAsync([
        'node',
        'export',
        '--plugin',
        'python-development',
        '--plugin',
        'backend-development',
      ]);

      expect(pluginExporterMock.exportPlugins).toHaveBeenCalledWith({
        interactive: false,
        pluginNames: ['python-development', 'backend-development'],
      });
    });

    it('should handle successful export with --plugin flag', async () => {
      pluginExporterMock.exportPlugins.mockResolvedValue(undefined);

      await command.parseAsync([
        'node',
        'export',
        '--plugin',
        'python-development',
      ]);

      expect(pluginExporterMock.exportPlugins).toHaveBeenCalled();
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('should handle errors with --plugin flag', async () => {
      const error = new Error('Plugin not found');
      pluginExporterMock.exportPlugins.mockRejectedValue(error);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(
        command.parseAsync([
          'node',
          'overture',
          'plugin',
          'export',
          '--plugin',
          'unknown-plugin',
        ])
      ).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe('--all flag', () => {
    it('should export all plugins when --all specified', async () => {
      pluginExporterMock.exportAllPlugins.mockResolvedValue(undefined);

      await command.parseAsync(['node', 'export', '--all']);

      expect(pluginExporterMock.exportAllPlugins).toHaveBeenCalled();
      expect(pluginExporterMock.exportPlugins).not.toHaveBeenCalled();
    });

    it('should handle successful export with --all flag', async () => {
      pluginExporterMock.exportAllPlugins.mockResolvedValue(undefined);

      await command.parseAsync(['node', 'export', '--all']);

      expect(pluginExporterMock.exportAllPlugins).toHaveBeenCalled();
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('should handle errors with --all flag', async () => {
      const error = new Error('No plugins installed');
      pluginExporterMock.exportPlugins.mockRejectedValue(error);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(
        command.parseAsync(['node', 'overture', 'plugin', 'export', '--all'])
      ).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe('flag conflicts', () => {
    it('should handle --plugin and --all together (--all takes precedence)', async () => {
      pluginExporterMock.exportAllPlugins.mockResolvedValue(undefined);

      await command.parseAsync([
        'node',
        'export',
        '--plugin',
        'python-development',
        '--all',
      ]);

      // --all should take precedence and call exportAllPlugins
      expect(pluginExporterMock.exportAllPlugins).toHaveBeenCalled();
      expect(pluginExporterMock.exportPlugins).not.toHaveBeenCalled();
    });
  });

  describe('command metadata', () => {
    it('should have correct command name', () => {
      expect(command.name()).toBe('export');
    });

    it('should have a description', () => {
      expect(command.description()).toBeTruthy();
    });

    it('should support --plugin option', () => {
      const pluginOption = command.options.find((opt) =>
        opt.flags.includes('--plugin')
      );
      expect(pluginOption).toBeDefined();
    });

    it('should support --all option', () => {
      const allOption = command.options.find((opt) => opt.flags.includes('--all'));
      expect(allOption).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle PluginError gracefully', async () => {
      const error = new Error('No installed plugins match the provided names');
      error.name = 'PluginError';
      pluginExporterMock.exportPlugins.mockRejectedValue(error);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(
        command.parseAsync(['node', 'export', '--plugin', 'nonexistent'])
      ).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle generic errors gracefully', async () => {
      const error = new Error('Unexpected error');
      pluginExporterMock.exportPlugins.mockRejectedValue(error);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(
        command.parseAsync(['node', 'overture', 'plugin', 'export'])
      ).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });
});
