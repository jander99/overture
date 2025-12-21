/**
 * PluginDetector Tests
 *
 * Tests for Claude Code plugin detection with hexagonal architecture.
 * Uses dependency injection with port mocks for testability.
 *
 * @module lib/plugin-detector.spec
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginDetector } from './plugin-detector.js';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import type { ClaudeSettings } from '@overture/config-types';
import { PluginError } from '@overture/errors';

// Create mock factories
function createMockFilesystem(
  files: Record<string, string> = {},
): FilesystemPort {
  const fileMap = new Map(Object.entries(files));

  return {
    readFile: vi.fn(async (path: string) => {
      const content = fileMap.get(path);
      if (content === undefined) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      return content;
    }),
    writeFile: vi.fn(async (path: string, content: string) => {
      fileMap.set(path, content);
    }),
    exists: vi.fn(async (path: string) => fileMap.has(path)),
    mkdir: vi.fn(async () => {}),
    readdir: vi.fn(async () => []),
    stat: vi.fn(async () => ({
      isFile: () => true,
      isDirectory: () => false,
      size: 0,
      mtime: new Date(),
    })),
    rm: vi.fn(async () => {}),
  };
}

function createMockEnvironment(): EnvironmentPort {
  return {
    homedir: vi.fn(() => '/home/testuser'),
    platform: vi.fn(() => 'linux'),
    env: {},
  };
}

function buildClaudeSettings(
  plugins: Record<
    string,
    {
      marketplace: string;
      enabled: boolean;
      installedAt?: string;
    }
  >,
  marketplaces: string[] = [],
): ClaudeSettings {
  return {
    plugins,
    marketplaces,
  };
}

describe('PluginDetector', () => {
  let filesystem: FilesystemPort;
  let environment: EnvironmentPort;
  let detector: PluginDetector;

  beforeEach(() => {
    environment = createMockEnvironment();
    filesystem = createMockFilesystem();
    detector = new PluginDetector(filesystem, environment);
  });

  describe('detectInstalledPlugins', () => {
    describe('valid settings', () => {
      it('should parse valid .claude/settings.json and extract plugins', async () => {
        // Arrange: Valid settings with 3 plugins
        const settings = buildClaudeSettings(
          {
            'python-development': {
              marketplace: 'claude-code-workflows',
              enabled: true,
              installedAt: '2025-01-15T10:00:00Z',
            },
            'backend-development': {
              marketplace: 'claude-code-workflows',
              enabled: false,
              installedAt: '2025-01-14T15:30:00Z',
            },
            'custom-plugin': {
              marketplace: 'myorg/custom-marketplace',
              enabled: true,
              installedAt: '2025-01-13T08:45:00Z',
            },
          },
          ['anthropics/claude-code-workflows', 'myorg/custom-marketplace'],
        );

        const settingsPath = '/home/testuser/.claude/settings.json';
        filesystem = createMockFilesystem({
          [settingsPath]: JSON.stringify(settings),
        });
        detector = new PluginDetector(filesystem, environment);

        // Act
        const plugins = await detector.detectInstalledPlugins();

        // Assert
        expect(plugins).toHaveLength(3);

        // Check first plugin
        expect(plugins[0]).toMatchObject({
          name: 'python-development',
          marketplace: 'claude-code-workflows',
          enabled: true,
          installedAt: '2025-01-15T10:00:00Z',
        });

        // Check disabled plugin
        expect(plugins[1]).toMatchObject({
          name: 'backend-development',
          marketplace: 'claude-code-workflows',
          enabled: false,
        });

        // Check custom marketplace plugin
        expect(plugins[2]).toMatchObject({
          name: 'custom-plugin',
          marketplace: 'myorg/custom-marketplace',
          enabled: true,
        });
      });

      it('should filter out disabled plugins when includeDisabled=false', async () => {
        // Arrange
        const settings = buildClaudeSettings(
          {
            'python-development': {
              marketplace: 'claude-code-workflows',
              enabled: true,
            },
            'backend-development': {
              marketplace: 'claude-code-workflows',
              enabled: false,
            },
          },
          [],
        );

        const settingsPath = '/home/testuser/.claude/settings.json';
        filesystem = createMockFilesystem({
          [settingsPath]: JSON.stringify(settings),
        });
        detector = new PluginDetector(filesystem, environment);

        // Act
        const plugins = await detector.detectInstalledPlugins({
          includeDisabled: false,
        });

        // Assert
        expect(plugins).toHaveLength(1);
        expect(plugins[0].name).toBe('python-development');
        expect(plugins[0].enabled).toBe(true);
      });

      it('should handle plugins with @ format in key', async () => {
        // Arrange: Plugin key uses "name@marketplace" format
        const settings = {
          plugins: {
            'python-development@claude-code-workflows': {
              enabled: true,
            },
          },
        };

        const settingsPath = '/home/testuser/.claude/settings.json';
        filesystem = createMockFilesystem({
          [settingsPath]: JSON.stringify(settings),
        });
        detector = new PluginDetector(filesystem, environment);

        // Act
        const plugins = await detector.detectInstalledPlugins();

        // Assert
        expect(plugins).toHaveLength(1);
        expect(plugins[0]).toMatchObject({
          name: 'python-development',
          marketplace: 'claude-code-workflows',
          enabled: true,
        });
      });
    });

    describe('error handling', () => {
      it('should return empty array when settings.json not found', async () => {
        // Arrange: No settings file exists
        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        // Act
        const plugins = await detector.detectInstalledPlugins();

        // Assert
        expect(plugins).toEqual([]);
        expect(consoleWarnSpy).toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
      });

      it('should return empty array for malformed JSON', async () => {
        // Arrange: Invalid JSON
        const settingsPath = '/home/testuser/.claude/settings.json';
        filesystem = createMockFilesystem({
          [settingsPath]: '{ invalid json',
        });
        detector = new PluginDetector(filesystem, environment);

        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        // Act
        const plugins = await detector.detectInstalledPlugins();

        // Assert
        expect(plugins).toEqual([]);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Malformed'),
        );

        consoleWarnSpy.mockRestore();
      });

      it('should return empty array when no plugins section exists', async () => {
        // Arrange: Valid JSON but no plugins section
        const settingsPath = '/home/testuser/.claude/settings.json';
        filesystem = createMockFilesystem({
          [settingsPath]: JSON.stringify({ marketplaces: [] }),
        });
        detector = new PluginDetector(filesystem, environment);

        // Act
        const plugins = await detector.detectInstalledPlugins();

        // Assert
        expect(plugins).toEqual([]);
      });

      it('should handle plugins with unknown marketplace', async () => {
        // Arrange: Settings with some valid and some plugins with unknown marketplace
        const settings = {
          plugins: {
            'valid-plugin': {
              marketplace: 'claude-code-workflows',
              enabled: true,
            },
            // Plugin with no marketplace (gets 'unknown')
            'plugin-without-marketplace': {
              enabled: true,
            },
          },
        };

        const settingsPath = '/home/testuser/.claude/settings.json';
        filesystem = createMockFilesystem({
          [settingsPath]: JSON.stringify(settings),
        });
        detector = new PluginDetector(filesystem, environment);

        // Act
        const plugins = await detector.detectInstalledPlugins();

        // Assert
        expect(plugins).toHaveLength(2);
        expect(plugins[0].name).toBe('valid-plugin');
        expect(plugins[0].marketplace).toBe('claude-code-workflows');
        expect(plugins[1].name).toBe('plugin-without-marketplace');
        expect(plugins[1].marketplace).toBe('unknown'); // Falls back to 'unknown'
      });
    });

    describe('custom settings path', () => {
      it('should use custom settings path when provided', async () => {
        // Arrange
        const customPath = '/custom/path/.claude/settings.json';
        const settings = buildClaudeSettings(
          {
            'test-plugin': {
              marketplace: 'test-marketplace',
              enabled: true,
            },
          },
          [],
        );

        filesystem = createMockFilesystem({
          [customPath]: JSON.stringify(settings),
        });
        detector = new PluginDetector(filesystem, environment);

        // Act
        const plugins = await detector.detectInstalledPlugins({
          settingsPath: customPath,
        });

        // Assert
        expect(plugins).toHaveLength(1);
        expect(plugins[0].name).toBe('test-plugin');
      });

      it('should validate custom settings path for security', async () => {
        // Arrange: Path traversal attempt
        const maliciousPath = '../../etc/passwd';

        // Act & Assert
        await expect(
          detector.detectInstalledPlugins({ settingsPath: maliciousPath }),
        ).rejects.toThrow(PluginError);
      });

      it('should reject paths with null bytes', async () => {
        // Arrange: Null byte injection attempt
        const maliciousPath = '/home/user/.claude/settings.json\0/etc/passwd';

        // Act & Assert
        await expect(
          detector.detectInstalledPlugins({ settingsPath: maliciousPath }),
        ).rejects.toThrow(PluginError);
      });
    });
  });

  describe('isPluginInstalled', () => {
    it('should return true for installed plugin', async () => {
      // Arrange
      const settings = buildClaudeSettings(
        {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
          },
        },
        [],
      );

      const settingsPath = '/home/testuser/.claude/settings.json';
      filesystem = createMockFilesystem({
        [settingsPath]: JSON.stringify(settings),
      });
      detector = new PluginDetector(filesystem, environment);

      // Act
      const isInstalled = await detector.isPluginInstalled(
        'python-development',
        'claude-code-workflows',
      );

      // Assert
      expect(isInstalled).toBe(true);
    });

    it('should return false for not installed plugin', async () => {
      // Arrange
      const settings = buildClaudeSettings({}, []);

      const settingsPath = '/home/testuser/.claude/settings.json';
      filesystem = createMockFilesystem({
        [settingsPath]: JSON.stringify(settings),
      });
      detector = new PluginDetector(filesystem, environment);

      // Act
      const isInstalled = await detector.isPluginInstalled(
        'missing-plugin',
        'some-marketplace',
      );

      // Assert
      expect(isInstalled).toBe(false);
    });

    it('should handle marketplace normalization', async () => {
      // Arrange: Plugin installed with short marketplace name
      const settings = buildClaudeSettings(
        {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
          },
        },
        [],
      );

      const settingsPath = '/home/testuser/.claude/settings.json';
      filesystem = createMockFilesystem({
        [settingsPath]: JSON.stringify(settings),
      });
      detector = new PluginDetector(filesystem, environment);

      // Act: Check with full marketplace path
      const isInstalled = await detector.isPluginInstalled(
        'python-development',
        'anthropics/claude-code-workflows',
      );

      // Assert: Should match due to normalization
      expect(isInstalled).toBe(true);
    });
  });

  describe('getDefaultSettingsPaths', () => {
    it('should return user and project settings paths', async () => {
      // Act
      const paths = await detector.getDefaultSettingsPaths();

      // Assert
      expect(paths).toHaveProperty('user');
      expect(paths).toHaveProperty('project');
      expect(paths.user).toContain('.claude/settings.json');
      expect(paths.project).toContain('.claude/settings.json');
    });
  });
});
