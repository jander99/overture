/**
 * PluginInstaller Tests
 *
 * Tests for Claude Code plugin installation with hexagonal architecture.
 * Uses dependency injection with port mocks for testability.
 *
 * @module lib/plugin-installer.spec
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginInstaller } from './plugin-installer.js';
import type { ProcessPort, ExecResult } from '@overture/ports-process';
import type { OutputPort } from '@overture/ports-output';

// Create mock factories
function createMockProcess(commandExists = true, execResults: ExecResult[] = []): ProcessPort {
  let execIndex = 0;

  return {
    exec: vi.fn(async (command: string, args?: string[]) => {
      if (execIndex >= execResults.length) {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return execResults[execIndex++];
    }),
    commandExists: vi.fn(async () => commandExists),
  };
}

function createMockOutput(): OutputPort {
  return {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('PluginInstaller', () => {
  let process: ProcessPort;
  let output: OutputPort;
  let installer: PluginInstaller;

  beforeEach(() => {
    process = createMockProcess();
    output = createMockOutput();
    installer = new PluginInstaller(process, output);
  });

  describe('installPlugin', () => {
    describe('successful installation', () => {
      it('should install plugin successfully', async () => {
        // Arrange
        const execResults: ExecResult[] = [
          // marketplace add
          { stdout: 'Marketplace added\n', stderr: '', exitCode: 0 },
          // plugin install
          { stdout: 'Plugin installed\n', stderr: '', exitCode: 0 },
        ];
        process = createMockProcess(true, execResults);
        installer = new PluginInstaller(process, output);

        // Act
        const result = await installer.installPlugin('python-development', 'claude-code-workflows');

        // Assert
        expect(result.success).toBe(true);
        expect(result.plugin).toBe('python-development');
        expect(result.marketplace).toBe('claude-code-workflows');
        expect(result.output).toContain('Plugin installed');
        expect(output.success).toHaveBeenCalled();
      });

      it('should check Claude binary availability before installation', async () => {
        // Arrange
        const execResults: ExecResult[] = [
          { stdout: '', stderr: '', exitCode: 0 }, // marketplace add
          { stdout: '', stderr: '', exitCode: 0 }, // install
        ];
        process = createMockProcess(true, execResults);
        installer = new PluginInstaller(process, output);

        // Act
        await installer.installPlugin('test-plugin', 'test-marketplace');

        // Assert
        expect(process.commandExists).toHaveBeenCalledWith('claude');
      });

      it('should add marketplace before installing plugin', async () => {
        // Arrange
        const execResults: ExecResult[] = [
          { stdout: 'Marketplace added\n', stderr: '', exitCode: 0 },
          { stdout: 'Plugin installed\n', stderr: '', exitCode: 0 },
        ];
        process = createMockProcess(true, execResults);
        installer = new PluginInstaller(process, output);

        // Act
        await installer.installPlugin('python-development', 'claude-code-workflows');

        // Assert
        expect(process.exec).toHaveBeenCalledWith('claude', [
          'plugin',
          'marketplace',
          'add',
          'anthropics/claude-code-workflows',
        ]);
        expect(process.exec).toHaveBeenCalledWith('claude', [
          'plugin',
          'install',
          'python-development@claude-code-workflows',
        ]);
      });

      it('should continue installation if marketplace add fails', async () => {
        // Arrange: marketplace add fails, but install succeeds
        const execResults: ExecResult[] = [
          { stdout: '', stderr: 'Already added\n', exitCode: 1 },
          { stdout: 'Plugin installed\n', stderr: '', exitCode: 0 },
        ];
        process = createMockProcess(true, execResults);
        installer = new PluginInstaller(process, output);

        // Act
        const result = await installer.installPlugin('test-plugin', 'claude-code-workflows');

        // Assert
        expect(result.success).toBe(true);
        expect(output.warn).toHaveBeenCalled(); // Warning about marketplace add failure
      });
    });

    describe('dry run mode', () => {
      it('should simulate installation in dry run mode', async () => {
        // Act
        const result = await installer.installPlugin('test-plugin', 'test-marketplace', {
          dryRun: true,
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.output).toContain('[DRY RUN]');
        expect(process.exec).not.toHaveBeenCalled();
        expect(output.info).toHaveBeenCalledWith(expect.stringContaining('[DRY RUN]'));
      });

      it('should not check Claude binary in dry run mode', async () => {
        // Act
        await installer.installPlugin('test-plugin', 'test-marketplace', { dryRun: true });

        // Assert
        expect(process.commandExists).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should return error if Claude CLI not found', async () => {
        // Arrange: Claude binary not available
        process = createMockProcess(false, []);
        installer = new PluginInstaller(process, output);

        // Act
        const result = await installer.installPlugin('test-plugin', 'test-marketplace');

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('Claude CLI not found');
      });

      it('should return error for invalid plugin name', async () => {
        // Act
        const result = await installer.installPlugin('Invalid-Plugin-Name', 'test-marketplace');

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid plugin name');
      });

      it('should return error for invalid marketplace', async () => {
        // Act
        const result = await installer.installPlugin('test-plugin', '');

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid marketplace');
      });

      it('should handle installation failure', async () => {
        // Arrange: Installation command fails
        const execResults: ExecResult[] = [
          { stdout: '', stderr: '', exitCode: 0 }, // marketplace add succeeds
          { stdout: '', stderr: 'Plugin not found\n', exitCode: 1 }, // install fails
        ];
        process = createMockProcess(true, execResults);
        installer = new PluginInstaller(process, output);

        // Act
        const result = await installer.installPlugin('missing-plugin', 'claude-code-workflows');

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('Plugin not found');
        expect(output.error).toHaveBeenCalled();
      });

      it('should handle installation timeout', async () => {
        // Arrange: Installation hangs
        process = {
          exec: vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100000)); // Never resolves in time
            return { stdout: '', stderr: '', exitCode: 0 };
          }),
          commandExists: vi.fn(async () => true),
        };
        installer = new PluginInstaller(process, output);

        // Act
        const result = await installer.installPlugin('slow-plugin', 'test-marketplace', {
          timeout: 100, // Very short timeout
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
      }, 10000);
    });

    describe('marketplace handling', () => {
      it('should not add unknown marketplaces', async () => {
        // Arrange
        const execResults: ExecResult[] = [
          { stdout: 'Plugin installed\n', stderr: '', exitCode: 0 },
        ];
        process = createMockProcess(true, execResults);
        installer = new PluginInstaller(process, output);

        // Act
        await installer.installPlugin('custom-plugin', 'myorg/custom-marketplace');

        // Assert
        // Should only call exec once for install (no marketplace add)
        expect(process.exec).toHaveBeenCalledTimes(1);
        expect(process.exec).toHaveBeenCalledWith('claude', [
          'plugin',
          'install',
          'custom-plugin@myorg/custom-marketplace',
        ]);
      });
    });
  });

  describe('installPlugins', () => {
    it('should install multiple plugins sequentially', async () => {
      // Arrange
      const execResults: ExecResult[] = [
        // First plugin
        { stdout: '', stderr: '', exitCode: 0 }, // marketplace add
        { stdout: 'Plugin 1 installed\n', stderr: '', exitCode: 0 }, // install
        // Second plugin
        { stdout: '', stderr: '', exitCode: 0 }, // marketplace add
        { stdout: 'Plugin 2 installed\n', stderr: '', exitCode: 0 }, // install
      ];
      process = createMockProcess(true, execResults);
      installer = new PluginInstaller(process, output);

      // Act
      const results = await installer.installPlugins([
        ['plugin1', 'claude-code-workflows'],
        ['plugin2', 'claude-code-workflows'],
      ]);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].plugin).toBe('plugin1');
      expect(results[1].success).toBe(true);
      expect(results[1].plugin).toBe('plugin2');
    });

    it('should continue installing even if one plugin fails', async () => {
      // Arrange
      const execResults: ExecResult[] = [
        // First plugin (fails)
        { stdout: '', stderr: '', exitCode: 0 }, // marketplace add
        { stdout: '', stderr: 'Plugin not found\n', exitCode: 1 }, // install fails
        // Second plugin (succeeds)
        { stdout: '', stderr: '', exitCode: 0 }, // marketplace add
        { stdout: 'Plugin installed\n', stderr: '', exitCode: 0 }, // install
      ];
      process = createMockProcess(true, execResults);
      installer = new PluginInstaller(process, output);

      // Act
      const results = await installer.installPlugins([
        ['bad-plugin', 'claude-code-workflows'],
        ['good-plugin', 'claude-code-workflows'],
      ]);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });
  });

  describe('checkClaudeBinary', () => {
    it('should return true if Claude CLI exists', async () => {
      // Arrange
      process = createMockProcess(true, []);
      installer = new PluginInstaller(process, output);

      // Act
      const available = await installer.checkClaudeBinary();

      // Assert
      expect(available).toBe(true);
      expect(process.commandExists).toHaveBeenCalledWith('claude');
    });

    it('should return false if Claude CLI does not exist', async () => {
      // Arrange
      process = createMockProcess(false, []);
      installer = new PluginInstaller(process, output);

      // Act
      const available = await installer.checkClaudeBinary();

      // Assert
      expect(available).toBe(false);
    });
  });

  describe('static validators', () => {
    describe('isValidPluginName', () => {
      it('should accept valid plugin names', () => {
        expect(PluginInstaller.isValidPluginName('python-development')).toBe(true);
        expect(PluginInstaller.isValidPluginName('backend-development')).toBe(true);
        expect(PluginInstaller.isValidPluginName('my-plugin-v2')).toBe(true);
        expect(PluginInstaller.isValidPluginName('test_plugin')).toBe(true);
      });

      it('should reject invalid plugin names', () => {
        expect(PluginInstaller.isValidPluginName('Python-Development')).toBe(false); // uppercase
        expect(PluginInstaller.isValidPluginName('my plugin')).toBe(false); // space
        expect(PluginInstaller.isValidPluginName('my/plugin')).toBe(false); // slash
        expect(PluginInstaller.isValidPluginName('my@plugin')).toBe(false); // @
        expect(PluginInstaller.isValidPluginName('')).toBe(false); // empty
      });
    });

    describe('isValidMarketplace', () => {
      it('should accept valid marketplace identifiers', () => {
        expect(PluginInstaller.isValidMarketplace('claude-code-workflows')).toBe(true);
        expect(PluginInstaller.isValidMarketplace('anthropics/claude-code-workflows')).toBe(true);
        expect(PluginInstaller.isValidMarketplace('myorg/custom-marketplace')).toBe(true);
        expect(PluginInstaller.isValidMarketplace('./local-marketplace')).toBe(true);
        expect(PluginInstaller.isValidMarketplace('/abs/path/marketplace')).toBe(true);
      });

      it('should reject invalid marketplace identifiers', () => {
        expect(PluginInstaller.isValidMarketplace('')).toBe(false); // empty
        expect(PluginInstaller.isValidMarketplace('   ')).toBe(false); // whitespace only
      });
    });
  });
});
