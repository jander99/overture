/**
 * Plugin Command Tests
 *
 * Comprehensive tests for the `overture plugin` command group.
 *
 * Test Coverage:
 * - plugin list: Display installed plugins with filtering options
 * - plugin export: Export plugin configurations (all or specific)
 * - Filtering with --config-only and --installed-only flags
 * - JSON output format
 * - Summary statistics
 * - Multiple plugin export with repeated --plugin flags
 * - Error handling for nonexistent plugins
 *
 * @see apps/cli/src/cli/commands/plugin.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SpyInstance } from 'vitest';
import { createPluginCommand } from './plugin';
import type { AppDependencies } from '../../composition-root';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock';

describe('plugin command', () => {
  let deps: AppDependencies;
  let _exitSpy: SpyInstance;
  let consoleLogSpy: SpyInstance;

  beforeEach(() => {
    deps = createMockAppDependencies();
    _exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('basic command structure', () => {
    it('should create a command named "plugin"', () => {
      const command = createPluginCommand(deps);
      expect(command.name()).toBe('plugin');
    });

    it('should have a description', () => {
      const command = createPluginCommand(deps);
      expect(command.description()).toBe('Manage Claude Code plugins');
    });

    it('should have list subcommand', () => {
      const command = createPluginCommand(deps);
      const subcommands = command.commands;

      const listCommand = subcommands.find((cmd) => cmd.name() === 'list');
      expect(listCommand).toBeDefined();
      expect(listCommand?.description()).toContain('List installed');
    });

    it('should have export subcommand', () => {
      const command = createPluginCommand(deps);
      const subcommands = command.commands;

      const exportCommand = subcommands.find((cmd) => cmd.name() === 'export');
      expect(exportCommand).toBeDefined();
      expect(exportCommand?.description()).toContain('Export installed');
    });
  });

  describe('plugin list subcommand', () => {
    beforeEach(() => {
      // Mock plugin comparison data
      vi.mocked(
        deps.pluginExporter.compareInstalledWithConfig,
      ).mockResolvedValue({
        both: [
          {
            name: 'python-development',
            marketplace: 'claude-code-workflows',
            enabled: true,
            installedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        installedOnly: [
          {
            name: 'kubernetes-operations',
            marketplace: 'claude-code-workflows',
            enabled: false,
            installedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        configOnly: [],
      });
    });

    it('should list all installed plugins by default', async () => {
      const command = createPluginCommand(deps);

      await command.parseAsync(['node', 'plugin', 'list']);

      expect(deps.pluginExporter.compareInstalledWithConfig).toHaveBeenCalled();
      expect(deps.output.info).toHaveBeenCalledWith(
        'Installed Claude Code Plugins:',
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('python-development'),
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('kubernetes-operations'),
      );
    });

    it('should filter plugins with --config-only flag', async () => {
      const command = createPluginCommand(deps);

      await command.parseAsync(['node', 'plugin', 'list', '--config-only']);

      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('python-development'),
      );
      // kubernetes-operations should not be shown (installedOnly)
      const infoCalls = vi.mocked(deps.output.info).mock.calls;
      const hasK8s = infoCalls.some((call) =>
        call[0]?.includes('kubernetes-operations'),
      );
      expect(hasK8s).toBe(false);
    });

    it('should filter plugins with --installed-only flag', async () => {
      const command = createPluginCommand(deps);

      await command.parseAsync(['node', 'plugin', 'list', '--installed-only']);

      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('kubernetes-operations'),
      );
      // python-development should not be shown (in both)
      const infoCalls = vi.mocked(deps.output.info).mock.calls;
      const hasPython = infoCalls.some((call) =>
        call[0]?.includes('python-development'),
      );
      expect(hasPython).toBe(false);
    });

    it('should output JSON format with --json flag', async () => {
      const command = createPluginCommand(deps);

      await command.parseAsync(['node', 'plugin', 'list', '--json']);

      expect(consoleLogSpy).toHaveBeenCalled();
      const jsonOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(jsonOutput);

      expect(parsed).toHaveProperty('installed');
      expect(parsed).toHaveProperty('summary');
      expect(parsed.installed).toHaveLength(2);
      expect(parsed.summary.totalInstalled).toBe(2);
      expect(parsed.summary.inConfig).toBe(1);
    });

    it('should display summary statistics', async () => {
      const command = createPluginCommand(deps);

      await command.parseAsync(['node', 'plugin', 'list']);

      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining(
          '📊 Summary: 2 plugin(s) installed, 1 in config',
        ),
      );
    });

    it('should show tips when plugins not in config', async () => {
      const command = createPluginCommand(deps);

      await command.parseAsync(['node', 'plugin', 'list']);

      expect(deps.output.info).toHaveBeenCalledWith('💡 Tips:');
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('overture plugin export'),
      );
    });

    it('should handle no plugins found', async () => {
      vi.mocked(
        deps.pluginExporter.compareInstalledWithConfig,
      ).mockResolvedValue({
        both: [],
        installedOnly: [],
        configOnly: [],
      });

      const command = createPluginCommand(deps);

      await command.parseAsync(['node', 'plugin', 'list']);

      expect(deps.output.info).toHaveBeenCalledWith(
        '  No plugins found matching filter criteria.',
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(
        deps.pluginExporter.compareInstalledWithConfig,
      ).mockRejectedValue(new Error('Failed to read plugins'));

      const command = createPluginCommand(deps);

      await expect(
        command.parseAsync(['node', 'plugin', 'list']),
      ).rejects.toThrow('process.exit:1');
    });
  });

  describe('plugin export subcommand', () => {
    beforeEach(() => {
      vi.mocked(deps.pluginExporter.exportAllPlugins).mockResolvedValue(
        undefined,
      );
      vi.mocked(deps.pluginExporter.exportPlugins).mockResolvedValue(undefined);
    });

    it('should export in interactive mode by default', async () => {
      const command = createPluginCommand(deps);

      await command.parseAsync(['node', 'plugin', 'export']);

      expect(deps.output.info).toHaveBeenCalledWith(
        'Starting interactive plugin export...',
      );
      expect(deps.pluginExporter.exportPlugins).toHaveBeenCalledWith({
        interactive: true,
      });
    });

    it('should export all plugins with --all flag', async () => {
      const command = createPluginCommand(deps);

      await command.parseAsync(['node', 'plugin', 'export', '--all']);

      expect(deps.output.info).toHaveBeenCalledWith(
        'Exporting all installed plugins...',
      );
      expect(deps.pluginExporter.exportAllPlugins).toHaveBeenCalled();
    });

    it('should export specific plugins with --plugin flag', async () => {
      const command = createPluginCommand(deps);

      await command.parseAsync([
        'node',
        'plugin',
        'export',
        '--plugin',
        'python-development',
      ]);

      expect(deps.output.info).toHaveBeenCalledWith('Exporting 1 plugin(s)...');
      expect(deps.pluginExporter.exportPlugins).toHaveBeenCalledWith({
        interactive: false,
        pluginNames: ['python-development'],
      });
    });

    it('should support multiple --plugin flags', async () => {
      const command = createPluginCommand(deps);

      await command.parseAsync([
        'node',
        'plugin',
        'export',
        '--plugin',
        'python-development',
        '--plugin',
        'kubernetes-operations',
      ]);

      expect(deps.output.info).toHaveBeenCalledWith('Exporting 2 plugin(s)...');
      expect(deps.pluginExporter.exportPlugins).toHaveBeenCalledWith({
        interactive: false,
        pluginNames: ['python-development', 'kubernetes-operations'],
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(deps.pluginExporter.exportAllPlugins).mockRejectedValue(
        new Error('Failed to export plugins'),
      );

      const command = createPluginCommand(deps);

      await expect(
        command.parseAsync(['node', 'plugin', 'export', '--all']),
      ).rejects.toThrow('process.exit:1');
    });
  });

  describe('negative test cases', () => {
    it('should handle export when both --all and --plugin flags are provided', async () => {
      // The command allows both flags - it's up to the service to handle this case
      vi.mocked(deps.pluginExporter.exportAllPlugins).mockResolvedValue(
        undefined,
      );

      const command = createPluginCommand(deps);

      // Act - command executes successfully, choosing --all over --plugin
      await command.parseAsync([
        'node',
        'plugin',
        'export',
        '--all',
        '--plugin',
        'python-development',
      ]);

      // Assert - --all takes precedence, so exportAllPlugins should be called
      expect(deps.pluginExporter.exportAllPlugins).toHaveBeenCalled();
      expect(deps.pluginExporter.exportPlugins).not.toHaveBeenCalled();
    });

    it('should handle non-existent plugin name gracefully', async () => {
      vi.mocked(deps.pluginExporter.exportPlugins).mockRejectedValue(
        new Error('Plugin not found: nonexistent-plugin'),
      );

      const command = createPluginCommand(deps);

      // Act & Assert
      await expect(
        command.parseAsync([
          'node',
          'plugin',
          'export',
          '--plugin',
          'nonexistent-plugin',
        ]),
      ).rejects.toThrow('process.exit:1');
    });

    it('should handle multiple nonexistent plugins', async () => {
      vi.mocked(deps.pluginExporter.exportPlugins).mockRejectedValue(
        new Error('Plugins not found: plugin1, plugin2'),
      );

      const command = createPluginCommand(deps);

      // Act & Assert
      await expect(
        command.parseAsync([
          'node',
          'plugin',
          'export',
          '--plugin',
          'plugin1',
          '--plugin',
          'plugin2',
        ]),
      ).rejects.toThrow('process.exit:1');
    });
  });
});
