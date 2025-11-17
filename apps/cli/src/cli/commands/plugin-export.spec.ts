/**
 * Tests for plugin-export command
 *
 * Tests both interactive and non-interactive export modes.
 */

import { Command } from 'commander';
import { createPluginExportCommand } from './plugin-export';
import { PluginExporter } from '../../core/plugin-exporter';
import { Logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../core/plugin-exporter');
jest.mock('../../utils/logger');

describe('plugin-export command', () => {
  let command: Command;
  let mockExportPlugins: jest.Mock;
  let mockExportAllPlugins: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock export functions
    mockExportPlugins = jest.fn();
    mockExportAllPlugins = jest.fn();
    (PluginExporter as jest.MockedClass<typeof PluginExporter>).mockImplementation(() => ({
      exportPlugins: mockExportPlugins,
      exportAllPlugins: mockExportAllPlugins,
      compareInstalledWithConfig: jest.fn(),
    }) as any);

    // Create command
    command = createPluginExportCommand();
  });

  describe('interactive mode (default)', () => {
    it('should call exportPlugins with interactive: true by default', async () => {
      mockExportPlugins.mockResolvedValue(undefined);

      // Parse command without options
      await command.parseAsync(['node', 'export']);

      expect(mockExportPlugins).toHaveBeenCalledWith({
        interactive: true,
      });
    });

    it('should handle successful export in interactive mode', async () => {
      mockExportPlugins.mockResolvedValue(undefined);

      await command.parseAsync(['node', 'export']);

      expect(mockExportPlugins).toHaveBeenCalled();
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('should handle errors in interactive mode', async () => {
      const error = new Error('Export failed');
      mockExportPlugins.mockRejectedValue(error);

      // Mock process.exit to prevent test from exiting
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
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
      mockExportPlugins.mockResolvedValue(undefined);

      await command.parseAsync([
        'node',
        'export',
        '--plugin',
        'python-development',
      ]);

      expect(mockExportPlugins).toHaveBeenCalledWith({
        interactive: false,
        pluginNames: ['python-development'],
      });
    });

    it('should export multiple plugins when --plugin specified multiple times', async () => {
      mockExportPlugins.mockResolvedValue(undefined);

      await command.parseAsync([
        'node',
        'export',
        '--plugin',
        'python-development',
        '--plugin',
        'backend-development',
      ]);

      expect(mockExportPlugins).toHaveBeenCalledWith({
        interactive: false,
        pluginNames: ['python-development', 'backend-development'],
      });
    });

    it('should handle successful export with --plugin flag', async () => {
      mockExportPlugins.mockResolvedValue(undefined);

      await command.parseAsync([
        'node',
        'export',
        '--plugin',
        'python-development',
      ]);

      expect(mockExportPlugins).toHaveBeenCalled();
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('should handle errors with --plugin flag', async () => {
      const error = new Error('Plugin not found');
      mockExportPlugins.mockRejectedValue(error);

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
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
      mockExportAllPlugins.mockResolvedValue(undefined);

      await command.parseAsync(['node', 'export', '--all']);

      expect(mockExportAllPlugins).toHaveBeenCalled();
      expect(mockExportPlugins).not.toHaveBeenCalled();
    });

    it('should handle successful export with --all flag', async () => {
      mockExportAllPlugins.mockResolvedValue(undefined);

      await command.parseAsync(['node', 'export', '--all']);

      expect(mockExportAllPlugins).toHaveBeenCalled();
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('should handle errors with --all flag', async () => {
      const error = new Error('No plugins installed');
      mockExportPlugins.mockRejectedValue(error);

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
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
      mockExportAllPlugins.mockResolvedValue(undefined);

      await command.parseAsync([
        'node',
        'export',
        '--plugin',
        'python-development',
        '--all',
      ]);

      // --all should take precedence and call exportAllPlugins
      expect(mockExportAllPlugins).toHaveBeenCalled();
      expect(mockExportPlugins).not.toHaveBeenCalled();
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
      mockExportPlugins.mockRejectedValue(error);

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
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
      mockExportPlugins.mockRejectedValue(error);

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
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
