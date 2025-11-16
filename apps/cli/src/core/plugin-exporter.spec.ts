/**
 * Plugin Exporter Tests
 *
 * Tests for PluginExporter service that exports installed Claude Code plugins
 * to Overture user configuration.
 *
 * @module core/plugin-exporter.spec
 */

// Mock dependencies BEFORE imports
jest.mock('fs/promises');
jest.mock('inquirer', () => ({
  default: {
    prompt: jest.fn(),
  },
  prompt: jest.fn(),
}));
jest.mock('./plugin-detector');
jest.mock('./path-resolver', () => ({
  getUserConfigPath: jest.fn(() => '/home/user/.config/overture.yml'),
}));

import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import inquirer from 'inquirer';
import { PluginExporter } from './plugin-exporter';
import { PluginDetector } from './plugin-detector';
import type { InstalledPlugin, ExportOptions } from '../domain/plugin.types';
import type { OvertureConfig } from '../domain/config.types';
import { PluginError } from '../domain/errors';
import { buildInstalledPlugin } from './__tests__/mock-builders';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;
const MockedPluginDetector = PluginDetector as jest.MockedClass<typeof PluginDetector>;

describe('PluginExporter', () => {
  let exporter: PluginExporter;
  let mockDetector: jest.Mocked<PluginDetector>;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console.log to suppress output during tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Create mock detector instance
    mockDetector = {
      detectInstalledPlugins: jest.fn(),
    } as unknown as jest.Mocked<PluginDetector>;

    // Create exporter with mock detector
    exporter = new PluginExporter(mockDetector);

    // Default fs mocks
    mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('exportPlugins', () => {
    describe('with no plugins installed', () => {
      it('should display message and return early when no plugins installed', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue([]);

        // Act
        await exporter.exportPlugins();

        // Assert
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('No plugins installed')
        );
        expect(mockInquirer.prompt).not.toHaveBeenCalled();
        expect(mockFs.writeFile).not.toHaveBeenCalled();
      });
    });

    describe('interactive mode (default)', () => {
      const installedPlugins: InstalledPlugin[] = [
        buildInstalledPlugin({
          name: 'python-development',
          marketplace: 'claude-code-workflows',
          enabled: true,
        }),
        buildInstalledPlugin({
          name: 'backend-development',
          marketplace: 'claude-code-workflows',
          enabled: true,
        }),
      ];

      it('should throw error for interactive mode (not yet implemented)', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);

        // Act & Assert
        await expect(
          exporter.exportPlugins({ interactive: true })
        ).rejects.toThrow('Interactive plugin selection not yet implemented');
      });

      it('should use interactive mode by default', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);

        // Act & Assert
        await expect(exporter.exportPlugins()).rejects.toThrow(
          'Interactive plugin selection not yet implemented'
        );
      });
    });

    describe('non-interactive mode', () => {
      const installedPlugins: InstalledPlugin[] = [
        buildInstalledPlugin({
          name: 'python-development',
          marketplace: 'claude-code-workflows',
          enabled: true,
        }),
        buildInstalledPlugin({
          name: 'backend-development',
          marketplace: 'claude-code-workflows',
          enabled: false,
        }),
        buildInstalledPlugin({
          name: 'kubernetes-operations',
          marketplace: 'custom-marketplace',
          enabled: true,
        }),
      ];

      it('should throw error when pluginNames not provided in non-interactive mode', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);

        // Act & Assert
        await expect(
          exporter.exportPlugins({ interactive: false })
        ).rejects.toThrow('Non-interactive mode requires pluginNames option');
      });

      it('should throw error when pluginNames is empty array', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);

        // Act & Assert
        await expect(
          exporter.exportPlugins({ interactive: false, pluginNames: [] })
        ).rejects.toThrow('Non-interactive mode requires pluginNames option');
      });

      it('should throw error when no plugins match provided names', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);

        // Act & Assert
        await expect(
          exporter.exportPlugins({
            interactive: false,
            pluginNames: ['non-existent-plugin', 'another-missing'],
          })
        ).rejects.toThrow(
          'No installed plugins match the provided names: non-existent-plugin, another-missing'
        );
      });

      it('should export single plugin by name', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);
        mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

        // Act
        await exporter.exportPlugins({
          interactive: false,
          pluginNames: ['python-development'],
        });

        // Assert
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          '/home/user/.config/overture.yml',
          expect.stringContaining('python-development'),
          'utf-8'
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Updated user config with 1 plugins')
        );
      });

      it('should export multiple plugins by name', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);
        mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

        // Act
        await exporter.exportPlugins({
          interactive: false,
          pluginNames: ['python-development', 'kubernetes-operations'],
        });

        // Assert
        const writeCall = mockFs.writeFile.mock.calls[0];
        const writtenYaml = writeCall[1] as string;

        expect(writtenYaml).toContain('python-development');
        expect(writtenYaml).toContain('kubernetes-operations');
        expect(writtenYaml).not.toContain('backend-development');
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Updated user config with 2 plugins')
        );
      });

      it('should include disabled plugins when explicitly specified', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);
        mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

        // Act
        await exporter.exportPlugins({
          interactive: false,
          pluginNames: ['backend-development'],
        });

        // Assert
        const writeCall = mockFs.writeFile.mock.calls[0];
        const writtenYaml = writeCall[1] as string;
        const config = yaml.load(writtenYaml) as OvertureConfig;

        expect(config.plugins?.['backend-development']).toEqual({
          marketplace: 'claude-code-workflows',
          enabled: false,
          mcps: [],
        });
      });

      it('should show confirmation message with plugin details', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);
        mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

        // Act
        await exporter.exportPlugins({
          interactive: false,
          pluginNames: ['python-development', 'kubernetes-operations'],
        });

        // Assert
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Updated user config with 2 plugins')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('python-development@claude-code-workflows')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('kubernetes-operations@custom-marketplace')
        );
      });
    });

    describe('config file handling', () => {
      const singlePlugin = [
        buildInstalledPlugin({
          name: 'python-development',
          marketplace: 'claude-code-workflows',
          enabled: true,
        }),
      ];

      it('should create new config when file does not exist', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(singlePlugin);
        mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

        // Act
        await exporter.exportPlugins({
          interactive: false,
          pluginNames: ['python-development'],
        });

        // Assert
        const writeCall = mockFs.writeFile.mock.calls[0];
        const writtenYaml = writeCall[1] as string;
        const config = yaml.load(writtenYaml) as OvertureConfig;

        expect(config.version).toBe('2.0');
        expect(config.plugins?.['python-development']).toBeDefined();
        expect(config.mcp).toEqual({});
      });

      it('should preserve existing config structure when updating', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(singlePlugin);

        const existingConfig: OvertureConfig = {
          version: '2.0',
          plugins: {
            'existing-plugin': {
              marketplace: 'other-marketplace',
              enabled: true,
              mcps: ['existing-mcp'],
            },
          },
          mcp: {
            'existing-mcp': {
              command: 'test',
              args: [],
              transport: 'stdio',
            },
          },
        };

        mockFs.readFile.mockResolvedValue(yaml.dump(existingConfig));

        // Act
        await exporter.exportPlugins({
          interactive: false,
          pluginNames: ['python-development'],
        });

        // Assert
        const writeCall = mockFs.writeFile.mock.calls[0];
        const writtenYaml = writeCall[1] as string;
        const config = yaml.load(writtenYaml) as OvertureConfig;

        expect(config.plugins?.['existing-plugin']).toBeDefined();
        expect(config.plugins?.['python-development']).toBeDefined();
        expect(config.mcp?.['existing-mcp']).toBeDefined();
      });

      it('should preserve existing mcps array when updating plugin', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(singlePlugin);

        const existingConfig: OvertureConfig = {
          version: '2.0',
          plugins: {
            'python-development': {
              marketplace: 'claude-code-workflows',
              enabled: false, // Different enabled state
              mcps: ['python-repl', 'ruff'], // Existing mcps
            },
          },
          mcp: {},
        };

        mockFs.readFile.mockResolvedValue(yaml.dump(existingConfig));

        // Act
        await exporter.exportPlugins({
          interactive: false,
          pluginNames: ['python-development'],
        });

        // Assert
        const writeCall = mockFs.writeFile.mock.calls[0];
        const writtenYaml = writeCall[1] as string;
        const config = yaml.load(writtenYaml) as OvertureConfig;

        expect(config.plugins?.['python-development'].mcps).toEqual([
          'python-repl',
          'ruff',
        ]);
        expect(config.plugins?.['python-development'].enabled).toBe(true); // Updated from installed state
      });

      it('should handle file read errors', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(singlePlugin);
        mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

        // Act & Assert
        await expect(
          exporter.exportPlugins({
            interactive: false,
            pluginNames: ['python-development'],
          })
        ).rejects.toThrow('Failed to update user config');
      });

      it('should handle file write errors', async () => {
        // Arrange
        mockDetector.detectInstalledPlugins.mockResolvedValue(singlePlugin);
        mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');
        mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

        // Act & Assert
        await expect(
          exporter.exportPlugins({
            interactive: false,
            pluginNames: ['python-development'],
          })
        ).rejects.toThrow('Failed to update user config');
      });
    });
  });

  describe('exportAllPlugins', () => {
    it('should display message and return early when no plugins installed', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue([]);

      // Act
      await exporter.exportAllPlugins();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No plugins installed')
      );
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should export all installed plugins', async () => {
      // Arrange
      const installedPlugins: InstalledPlugin[] = [
        buildInstalledPlugin({
          name: 'python-development',
          marketplace: 'claude-code-workflows',
          enabled: true,
        }),
        buildInstalledPlugin({
          name: 'backend-development',
          marketplace: 'claude-code-workflows',
          enabled: false,
        }),
        buildInstalledPlugin({
          name: 'kubernetes-operations',
          marketplace: 'custom-marketplace',
          enabled: true,
        }),
      ];

      mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);
      mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

      // Act
      await exporter.exportAllPlugins();

      // Assert
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenYaml = writeCall[1] as string;
      const config = yaml.load(writtenYaml) as OvertureConfig;

      expect(config.plugins?.['python-development']).toBeDefined();
      expect(config.plugins?.['backend-development']).toBeDefined();
      expect(config.plugins?.['kubernetes-operations']).toBeDefined();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Exported all 3 installed plugins')
      );
    });

    it('should preserve enabled state for all plugins', async () => {
      // Arrange
      const installedPlugins: InstalledPlugin[] = [
        buildInstalledPlugin({
          name: 'enabled-plugin',
          marketplace: 'test-marketplace',
          enabled: true,
        }),
        buildInstalledPlugin({
          name: 'disabled-plugin',
          marketplace: 'test-marketplace',
          enabled: false,
        }),
      ];

      mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);
      mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

      // Act
      await exporter.exportAllPlugins();

      // Assert
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenYaml = writeCall[1] as string;
      const config = yaml.load(writtenYaml) as OvertureConfig;

      expect(config.plugins?.['enabled-plugin'].enabled).toBe(true);
      expect(config.plugins?.['disabled-plugin'].enabled).toBe(false);
    });
  });

  describe('compareInstalledWithConfig', () => {
    const installedPlugins: InstalledPlugin[] = [
      buildInstalledPlugin({
        name: 'installed-only',
        marketplace: 'claude-code-workflows',
        enabled: true,
      }),
      buildInstalledPlugin({
        name: 'in-both',
        marketplace: 'claude-code-workflows',
        enabled: true,
      }),
    ];

    it('should return empty arrays when no plugins and no config', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue([]);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      // Act
      const result = await exporter.compareInstalledWithConfig();

      // Assert
      expect(result.installedOnly).toEqual([]);
      expect(result.configOnly).toEqual([]);
      expect(result.both).toEqual([]);
    });

    it('should identify plugins installed but not in config', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);
      mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

      // Act
      const result = await exporter.compareInstalledWithConfig();

      // Assert
      expect(result.installedOnly).toHaveLength(2);
      expect(result.installedOnly.map((p) => p.name)).toContain('installed-only');
      expect(result.installedOnly.map((p) => p.name)).toContain('in-both');
      expect(result.configOnly).toEqual([]);
      expect(result.both).toEqual([]);
    });

    it('should identify plugins in config but not installed', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue([]);

      const configWithPlugins: OvertureConfig = {
        version: '2.0',
        plugins: {
          'config-only-1': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
          'config-only-2': {
            marketplace: 'custom-marketplace',
            enabled: true,
            mcps: [],
          },
        },
        mcp: {},
      };

      mockFs.readFile.mockResolvedValue(yaml.dump(configWithPlugins));

      // Act
      const result = await exporter.compareInstalledWithConfig();

      // Assert
      expect(result.installedOnly).toEqual([]);
      expect(result.configOnly).toHaveLength(2);
      expect(result.configOnly).toContain('config-only-1');
      expect(result.configOnly).toContain('config-only-2');
      expect(result.both).toEqual([]);
    });

    it('should identify plugins in both installed and config', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);

      const configWithPlugins: OvertureConfig = {
        version: '2.0',
        plugins: {
          'in-both': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
          'config-only': {
            marketplace: 'custom-marketplace',
            enabled: true,
            mcps: [],
          },
        },
        mcp: {},
      };

      mockFs.readFile.mockResolvedValue(yaml.dump(configWithPlugins));

      // Act
      const result = await exporter.compareInstalledWithConfig();

      // Assert
      expect(result.installedOnly).toHaveLength(1);
      expect(result.installedOnly[0].name).toBe('installed-only');
      expect(result.configOnly).toHaveLength(1);
      expect(result.configOnly).toContain('config-only');
      expect(result.both).toHaveLength(1);
      expect(result.both[0].name).toBe('in-both');
    });

    it('should handle config file not found gracefully', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      // Act
      const result = await exporter.compareInstalledWithConfig();

      // Assert
      expect(result.installedOnly).toHaveLength(2);
      expect(result.configOnly).toEqual([]);
      expect(result.both).toEqual([]);
    });

    it('should handle malformed config file gracefully', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);
      mockFs.readFile.mockResolvedValue('invalid: yaml: [syntax');

      // Act
      const result = await exporter.compareInstalledWithConfig();

      // Assert - treats as no config plugins
      expect(result.installedOnly).toHaveLength(2);
      expect(result.configOnly).toEqual([]);
      expect(result.both).toEqual([]);
    });

    it('should handle config without plugins section', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue(installedPlugins);
      mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

      // Act
      const result = await exporter.compareInstalledWithConfig();

      // Assert
      expect(result.installedOnly).toHaveLength(2);
      expect(result.configOnly).toEqual([]);
      expect(result.both).toEqual([]);
    });
  });

  describe('YAML formatting and structure preservation', () => {
    const singlePlugin = [
      buildInstalledPlugin({
        name: 'python-development',
        marketplace: 'claude-code-workflows',
        enabled: true,
      }),
    ];

    it('should generate valid YAML with correct indentation', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue(singlePlugin);
      mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

      // Act
      await exporter.exportPlugins({
        interactive: false,
        pluginNames: ['python-development'],
      });

      // Assert
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenYaml = writeCall[1] as string;

      // Should be valid YAML
      expect(() => yaml.load(writtenYaml)).not.toThrow();

      // Should use 2-space indentation
      expect(writtenYaml).toMatch(/\n  python-development:/);
      expect(writtenYaml).toMatch(/\n    marketplace:/);
    });

    it('should preserve key order (version, plugins, mcp)', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue(singlePlugin);

      const existingConfig: OvertureConfig = {
        version: '2.0',
        plugins: {},
        mcp: {
          'test-mcp': {
            command: 'test',
            args: [],
            transport: 'stdio',
          },
        },
      };

      mockFs.readFile.mockResolvedValue(yaml.dump(existingConfig));

      // Act
      await exporter.exportPlugins({
        interactive: false,
        pluginNames: ['python-development'],
      });

      // Assert
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenYaml = writeCall[1] as string;
      const lines = writtenYaml.split('\n');

      const versionLine = lines.findIndex((l) => l.startsWith('version:'));
      const pluginsLine = lines.findIndex((l) => l.startsWith('plugins:'));
      const mcpLine = lines.findIndex((l) => l.startsWith('mcp:'));

      expect(versionLine).toBeLessThan(pluginsLine);
      expect(pluginsLine).toBeLessThan(mcpLine);
    });

    it('should use empty object notation for empty mcp section', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue(singlePlugin);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      // Act
      await exporter.exportPlugins({
        interactive: false,
        pluginNames: ['python-development'],
      });

      // Assert
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenYaml = writeCall[1] as string;
      const config = yaml.load(writtenYaml) as OvertureConfig;

      expect(config.mcp).toEqual({});
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle detector returning null/undefined gracefully', async () => {
      // Arrange
      mockDetector.detectInstalledPlugins.mockResolvedValue(null as any);

      // Act & Assert
      await expect(exporter.exportPlugins()).rejects.toThrow();
    });

    it('should handle plugins with missing marketplace field', async () => {
      // Arrange
      const invalidPlugin = {
        name: 'test-plugin',
        enabled: true,
      } as InstalledPlugin;

      mockDetector.detectInstalledPlugins.mockResolvedValue([invalidPlugin]);
      mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

      // Act
      await exporter.exportPlugins({
        interactive: false,
        pluginNames: ['test-plugin'],
      });

      // Assert - should still write config with undefined marketplace
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenYaml = writeCall[1] as string;
      const config = yaml.load(writtenYaml) as OvertureConfig;

      expect(config.plugins?.['test-plugin']).toBeDefined();
    });

    it('should handle very long plugin names', async () => {
      // Arrange
      const longName = 'a'.repeat(200);
      const pluginWithLongName = buildInstalledPlugin({
        name: longName,
        marketplace: 'test-marketplace',
        enabled: true,
      });

      mockDetector.detectInstalledPlugins.mockResolvedValue([pluginWithLongName]);
      mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

      // Act
      await exporter.exportPlugins({
        interactive: false,
        pluginNames: [longName],
      });

      // Assert
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenYaml = writeCall[1] as string;
      const config = yaml.load(writtenYaml) as OvertureConfig;

      expect(config.plugins?.[longName]).toBeDefined();
    });

    it('should handle special characters in marketplace names', async () => {
      // Arrange
      const specialPlugin = buildInstalledPlugin({
        name: 'test-plugin',
        marketplace: 'org/marketplace-with-special_chars.v2',
        enabled: true,
      });

      mockDetector.detectInstalledPlugins.mockResolvedValue([specialPlugin]);
      mockFs.readFile.mockResolvedValue('version: "2.0"\nmcp: {}');

      // Act
      await exporter.exportPlugins({
        interactive: false,
        pluginNames: ['test-plugin'],
      });

      // Assert
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenYaml = writeCall[1] as string;
      const config = yaml.load(writtenYaml) as OvertureConfig;

      expect(config.plugins?.['test-plugin'].marketplace).toBe(
        'org/marketplace-with-special_chars.v2'
      );
    });
  });
});
