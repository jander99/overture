/**
 * Plugin Installer Tests
 *
 * Comprehensive tests for plugin installation functionality.
 * Tests cover installation, marketplace handling, error scenarios, and validation.
 *
 * @module core/plugin-installer.spec
 */

import { PluginInstaller } from './plugin-installer';
import { ProcessExecutor } from '../infrastructure/process-executor';
import { BinaryDetector } from './binary-detector';
import { MarketplaceRegistry } from '../domain/marketplace-registry';

// Mock dependencies
jest.mock('../infrastructure/process-executor');
jest.mock('./binary-detector');

const mockProcessExecutor = ProcessExecutor as jest.Mocked<typeof ProcessExecutor>;
const mockBinaryDetector = BinaryDetector as jest.MockedClass<typeof BinaryDetector>;

describe('PluginInstaller', () => {
  let installer: PluginInstaller;

  beforeEach(() => {
    jest.clearAllMocks();
    installer = new PluginInstaller();
  });

  describe('installPlugin', () => {
    describe('successful installation', () => {
      it('should install plugin successfully with known marketplace', async () => {
        // Mock Claude binary is available
        const mockDetector = {
          detectBinary: jest.fn().mockResolvedValue({ found: true }),
        };
        mockBinaryDetector.mockImplementation(() => mockDetector as any);

        // Mock marketplace add command
        mockProcessExecutor.exec
          .mockResolvedValueOnce({
            stdout: 'Marketplace added successfully',
            stderr: '',
            exitCode: 0,
          })
          // Mock install command
          .mockResolvedValueOnce({
            stdout: 'Plugin python-development installed successfully',
            stderr: '',
            exitCode: 0,
          });

        const result = await installer.installPlugin(
          'python-development',
          'claude-code-workflows'
        );

        expect(result.success).toBe(true);
        expect(result.plugin).toBe('python-development');
        expect(result.marketplace).toBe('claude-code-workflows');
        expect(result.output).toContain('installed successfully');
        expect(result.error).toBeUndefined();

        // Verify commands were called
        expect(mockProcessExecutor.exec).toHaveBeenCalledWith('claude', [
          'plugin',
          'marketplace',
          'add',
          'anthropics/claude-code-workflows',
        ]);
        expect(mockProcessExecutor.exec).toHaveBeenCalledWith('claude', [
          'plugin',
          'install',
          'python-development@claude-code-workflows',
        ]);
      });

      it('should install plugin with unknown marketplace (skip marketplace add)', async () => {
        const mockDetector = {
          detectBinary: jest.fn().mockResolvedValue({ found: true }),
        };
        mockBinaryDetector.mockImplementation(() => mockDetector as any);

        mockProcessExecutor.exec.mockResolvedValueOnce({
          stdout: 'Plugin custom-plugin installed successfully',
          stderr: '',
          exitCode: 0,
        });

        const result = await installer.installPlugin(
          'custom-plugin',
          'myorg/custom-marketplace'
        );

        expect(result.success).toBe(true);
        expect(result.plugin).toBe('custom-plugin');
        expect(result.marketplace).toBe('myorg/custom-marketplace');

        // Should NOT call marketplace add for unknown marketplace
        expect(mockProcessExecutor.exec).toHaveBeenCalledTimes(1);
        expect(mockProcessExecutor.exec).toHaveBeenCalledWith('claude', [
          'plugin',
          'install',
          'custom-plugin@myorg/custom-marketplace',
        ]);
      });

      it('should install plugin when marketplace add fails but installation succeeds', async () => {
        const mockDetector = {
          detectBinary: jest.fn().mockResolvedValue({ found: true }),
        };
        mockBinaryDetector.mockImplementation(() => mockDetector as any);

        // Mock console.warn to suppress output
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        // Mock marketplace add fails
        mockProcessExecutor.exec
          .mockResolvedValueOnce({
            stdout: '',
            stderr: 'Marketplace already exists',
            exitCode: 1,
          })
          // But install succeeds
          .mockResolvedValueOnce({
            stdout: 'Plugin installed successfully',
            stderr: '',
            exitCode: 0,
          });

        const result = await installer.installPlugin(
          'backend-development',
          'claude-code-workflows'
        );

        expect(result.success).toBe(true);
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
      });
    });

    describe('Claude binary not found', () => {
      it('should return error when Claude CLI is not found', async () => {
        const mockDetector = {
          detectBinary: jest.fn().mockResolvedValue({ found: false }),
        };
        mockBinaryDetector.mockImplementation(() => mockDetector as any);

        const result = await installer.installPlugin(
          'python-development',
          'claude-code-workflows'
        );

        expect(result.success).toBe(false);
        expect(result.plugin).toBe('python-development');
        expect(result.marketplace).toBe('claude-code-workflows');
        expect(result.error).toContain('Claude CLI not found');
        expect(result.error).toContain('https://claude.com/claude-code');

        // Should not attempt installation
        expect(mockProcessExecutor.exec).not.toHaveBeenCalled();
      });
    });

    describe('installation failure', () => {
      it('should return error result when installation fails', async () => {
        const mockDetector = {
          detectBinary: jest.fn().mockResolvedValue({ found: true }),
        };
        mockBinaryDetector.mockImplementation(() => mockDetector as any);

        mockProcessExecutor.exec
          .mockResolvedValueOnce({
            stdout: '',
            stderr: '',
            exitCode: 0,
          })
          .mockResolvedValueOnce({
            stdout: '',
            stderr: 'Plugin not found in marketplace',
            exitCode: 1,
          });

        const result = await installer.installPlugin(
          'nonexistent-plugin',
          'claude-code-workflows'
        );

        expect(result.success).toBe(false);
        expect(result.plugin).toBe('nonexistent-plugin');
        expect(result.error).toBe('Plugin not found in marketplace');
      });

      it('should handle command execution errors', async () => {
        const mockDetector = {
          detectBinary: jest.fn().mockResolvedValue({ found: true }),
        };
        mockBinaryDetector.mockImplementation(() => mockDetector as any);

        mockProcessExecutor.exec.mockRejectedValue(
          new Error('Command not found: claude')
        );

        const result = await installer.installPlugin(
          'python-development',
          'claude-code-workflows'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Command not found: claude');
      });
    });

    describe('dry-run mode', () => {
      it('should simulate installation without executing commands', async () => {
        const result = await installer.installPlugin(
          'python-development',
          'claude-code-workflows',
          { dryRun: true }
        );

        expect(result.success).toBe(true);
        expect(result.plugin).toBe('python-development');
        expect(result.marketplace).toBe('claude-code-workflows');
        expect(result.output).toContain('[DRY RUN]');
        expect(result.output).toContain(
          'python-development@claude-code-workflows'
        );

        // Should not call any commands
        expect(mockProcessExecutor.exec).not.toHaveBeenCalled();
      });

      it('should not check binary availability in dry-run mode', async () => {
        await installer.installPlugin(
          'python-development',
          'claude-code-workflows',
          { dryRun: true }
        );

        expect(mockBinaryDetector).not.toHaveBeenCalled();
      });
    });

    describe('timeout handling', () => {
      it('should timeout if installation takes too long', async () => {
        const mockDetector = {
          detectBinary: jest.fn().mockResolvedValue({ found: true }),
        };
        mockBinaryDetector.mockImplementation(() => mockDetector as any);

        // Mock marketplace add succeeds quickly
        mockProcessExecutor.exec.mockResolvedValueOnce({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

        // Mock install command that never resolves
        mockProcessExecutor.exec.mockImplementation(
          (cmd, args) =>
            new Promise((resolve) => {
              if (args.includes('install')) {
                // Never resolve
              } else {
                resolve({ stdout: '', stderr: '', exitCode: 0 });
              }
            })
        );

        const result = await installer.installPlugin(
          'slow-plugin',
          'claude-code-workflows',
          { timeout: 100 } // Very short timeout
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Installation timeout');
      }, 10000);

      it('should use default timeout when not specified', async () => {
        const mockDetector = {
          detectBinary: jest.fn().mockResolvedValue({ found: true }),
        };
        mockBinaryDetector.mockImplementation(() => mockDetector as any);

        mockProcessExecutor.exec.mockResolvedValue({
          stdout: 'Plugin installed successfully',
          stderr: '',
          exitCode: 0,
        });

        const result = await installer.installPlugin(
          'python-development',
          'claude-code-workflows'
        );

        expect(result.success).toBe(true);
      });
    });

    describe('command output capture', () => {
      it('should capture stdout when installation succeeds', async () => {
        const mockDetector = {
          detectBinary: jest.fn().mockResolvedValue({ found: true }),
        };
        mockBinaryDetector.mockImplementation(() => mockDetector as any);

        mockProcessExecutor.exec.mockResolvedValue({
          stdout: 'Installing plugin...\nPlugin installed successfully!',
          stderr: '',
          exitCode: 0,
        });

        const result = await installer.installPlugin(
          'python-development',
          'claude-code-workflows'
        );

        expect(result.output).toContain('Installing plugin');
        expect(result.output).toContain('successfully');
      });

      it('should capture stderr when installation fails', async () => {
        const mockDetector = {
          detectBinary: jest.fn().mockResolvedValue({ found: true }),
        };
        mockBinaryDetector.mockImplementation(() => mockDetector as any);

        mockProcessExecutor.exec.mockResolvedValue({
          stdout: 'Attempting installation...',
          stderr: 'Error: Network connection failed',
          exitCode: 1,
        });

        const result = await installer.installPlugin(
          'python-development',
          'claude-code-workflows'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Error: Network connection failed');
        expect(result.output).toBe('Attempting installation...');
      });
    });
  });

  describe('ensureMarketplace', () => {
    it('should add known marketplace via Claude CLI', async () => {
      mockProcessExecutor.exec.mockResolvedValue({
        stdout: 'Marketplace added successfully',
        stderr: '',
        exitCode: 0,
      });

      await installer.ensureMarketplace('claude-code-workflows');

      expect(mockProcessExecutor.exec).toHaveBeenCalledWith('claude', [
        'plugin',
        'marketplace',
        'add',
        'anthropics/claude-code-workflows',
      ]);
    });

    it('should skip unknown marketplace', async () => {
      await installer.ensureMarketplace('myorg/custom-marketplace');

      expect(mockProcessExecutor.exec).not.toHaveBeenCalled();
    });

    it('should handle marketplace add errors gracefully', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockProcessExecutor.exec.mockResolvedValue({
        stdout: '',
        stderr: 'Marketplace already exists',
        exitCode: 1,
      });

      await installer.ensureMarketplace('claude-code-workflows');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Marketplace add returned non-zero exit')
      );

      warnSpy.mockRestore();
    });

    it('should handle marketplace add exceptions gracefully', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockProcessExecutor.exec.mockRejectedValue(
        new Error('Command execution failed')
      );

      await installer.ensureMarketplace('claude-code-workflows');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to add marketplace')
      );

      warnSpy.mockRestore();
    });
  });

  describe('checkClaudeBinary', () => {
    it('should return true when Claude CLI is available', async () => {
      const mockDetector = {
        detectBinary: jest.fn().mockResolvedValue({ found: true }),
      };
      mockBinaryDetector.mockImplementation(() => mockDetector as any);

      const result = await installer.checkClaudeBinary();

      expect(result).toBe(true);
      expect(mockDetector.detectBinary).toHaveBeenCalledWith('claude');
    });

    it('should return false when Claude CLI is not available', async () => {
      const mockDetector = {
        detectBinary: jest.fn().mockResolvedValue({ found: false }),
      };
      mockBinaryDetector.mockImplementation(() => mockDetector as any);

      const result = await installer.checkClaudeBinary();

      expect(result).toBe(false);
    });

    it('should return false when detection throws error', async () => {
      const mockDetector = {
        detectBinary: jest.fn().mockRejectedValue(new Error('Detection failed')),
      };
      mockBinaryDetector.mockImplementation(() => mockDetector as any);

      const result = await installer.checkClaudeBinary();

      expect(result).toBe(false);
    });
  });

  describe('installPlugins', () => {
    it('should install multiple plugins sequentially', async () => {
      const mockDetector = {
        detectBinary: jest.fn().mockResolvedValue({ found: true }),
      };
      mockBinaryDetector.mockImplementation(() => mockDetector as any);

      mockProcessExecutor.exec.mockResolvedValue({
        stdout: 'Plugin installed successfully',
        stderr: '',
        exitCode: 0,
      });

      const results = await installer.installPlugins([
        ['python-development', 'claude-code-workflows'],
        ['backend-development', 'claude-code-workflows'],
        ['custom-plugin', 'myorg/custom'],
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[0].plugin).toBe('python-development');
      expect(results[1].success).toBe(true);
      expect(results[1].plugin).toBe('backend-development');
      expect(results[2].success).toBe(true);
      expect(results[2].plugin).toBe('custom-plugin');
    });

    it('should continue installing after failure', async () => {
      const mockDetector = {
        detectBinary: jest.fn().mockResolvedValue({ found: true }),
      };
      mockBinaryDetector.mockImplementation(() => mockDetector as any);

      mockProcessExecutor.exec
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        // First install succeeds
        .mockResolvedValueOnce({
          stdout: 'Plugin installed',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        // Second install fails
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'Plugin not found',
          exitCode: 1,
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        // Third install succeeds
        .mockResolvedValueOnce({
          stdout: 'Plugin installed',
          stderr: '',
          exitCode: 0,
        });

      const results = await installer.installPlugins([
        ['plugin-1', 'claude-code-workflows'],
        ['nonexistent', 'claude-code-workflows'],
        ['plugin-3', 'claude-code-workflows'],
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should support dry-run mode for batch installation', async () => {
      const results = await installer.installPlugins(
        [
          ['python-development', 'claude-code-workflows'],
          ['backend-development', 'claude-code-workflows'],
        ],
        { dryRun: true }
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].output).toContain('[DRY RUN]');
      expect(results[1].success).toBe(true);
      expect(results[1].output).toContain('[DRY RUN]');

      expect(mockProcessExecutor.exec).not.toHaveBeenCalled();
    });
  });

  describe('isValidPluginName', () => {
    it('should accept valid plugin names', () => {
      expect(PluginInstaller.isValidPluginName('python-development')).toBe(
        true
      );
      expect(PluginInstaller.isValidPluginName('backend-dev')).toBe(true);
      expect(PluginInstaller.isValidPluginName('my-plugin-v2')).toBe(true);
      expect(PluginInstaller.isValidPluginName('plugin_name')).toBe(true);
      expect(PluginInstaller.isValidPluginName('p')).toBe(true);
      expect(PluginInstaller.isValidPluginName('plugin123')).toBe(true);
    });

    it('should reject invalid plugin names', () => {
      expect(PluginInstaller.isValidPluginName('Python-Development')).toBe(
        false
      );
      expect(PluginInstaller.isValidPluginName('plugin name')).toBe(false);
      expect(PluginInstaller.isValidPluginName('plugin@marketplace')).toBe(
        false
      );
      expect(PluginInstaller.isValidPluginName('')).toBe(false);
      expect(PluginInstaller.isValidPluginName('-plugin')).toBe(false);
      expect(PluginInstaller.isValidPluginName('plugin/')).toBe(false);
    });
  });

  describe('isValidMarketplace', () => {
    it('should accept valid marketplace shortcuts', () => {
      expect(PluginInstaller.isValidMarketplace('claude-code-workflows')).toBe(
        true
      );
      expect(PluginInstaller.isValidMarketplace('my-marketplace')).toBe(true);
      expect(PluginInstaller.isValidMarketplace('marketplace_name')).toBe(true);
    });

    it('should accept valid GitHub paths', () => {
      expect(
        PluginInstaller.isValidMarketplace('anthropics/claude-code-workflows')
      ).toBe(true);
      expect(PluginInstaller.isValidMarketplace('myorg/custom-marketplace')).toBe(
        true
      );
      expect(PluginInstaller.isValidMarketplace('org123/repo456')).toBe(true);
    });

    it('should accept valid local paths', () => {
      expect(PluginInstaller.isValidMarketplace('./local-marketplace')).toBe(
        true
      );
      expect(PluginInstaller.isValidMarketplace('/abs/path/marketplace')).toBe(
        true
      );
      expect(PluginInstaller.isValidMarketplace('../marketplace')).toBe(true);
    });

    it('should reject invalid marketplace identifiers', () => {
      expect(PluginInstaller.isValidMarketplace('')).toBe(false);
      expect(PluginInstaller.isValidMarketplace('   ')).toBe(false);
      expect(PluginInstaller.isValidMarketplace('org/repo/extra')).toBe(false);
    });
  });

  describe('MarketplaceRegistry integration', () => {
    it('should resolve marketplace shortcuts before installation', async () => {
      const mockDetector = {
        detectBinary: jest.fn().mockResolvedValue({ found: true }),
      };
      mockBinaryDetector.mockImplementation(() => mockDetector as any);

      const resolveSpy = jest.spyOn(MarketplaceRegistry, 'resolveMarketplace');
      const isKnownSpy = jest.spyOn(MarketplaceRegistry, 'isKnownMarketplace');

      mockProcessExecutor.exec.mockResolvedValue({
        stdout: 'Success',
        stderr: '',
        exitCode: 0,
      });

      await installer.installPlugin(
        'python-development',
        'claude-code-workflows'
      );

      expect(isKnownSpy).toHaveBeenCalledWith('claude-code-workflows');
      expect(resolveSpy).toHaveBeenCalledWith('claude-code-workflows');

      // Verify full path was used
      expect(mockProcessExecutor.exec).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['anthropics/claude-code-workflows'])
      );
    });

    it('should use marketplace identifier as-is for unknown marketplaces', async () => {
      const mockDetector = {
        detectBinary: jest.fn().mockResolvedValue({ found: true }),
      };
      mockBinaryDetector.mockImplementation(() => mockDetector as any);

      mockProcessExecutor.exec.mockResolvedValue({
        stdout: 'Success',
        stderr: '',
        exitCode: 0,
      });

      await installer.installPlugin('custom-plugin', 'myorg/custom');

      // Should use marketplace as-is (no marketplace add call)
      expect(mockProcessExecutor.exec).toHaveBeenCalledWith('claude', [
        'plugin',
        'install',
        'custom-plugin@myorg/custom',
      ]);
    });
  });

  describe('Security - Input Validation', () => {
    it('should reject plugin names with command injection attempts', async () => {
      const result = await installer.installPlugin(
        'plugin; rm -rf /',
        'claude-code-workflows'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plugin name');
      expect(mockProcessExecutor.exec).not.toHaveBeenCalled();
    });

    it('should reject plugin names with shell metacharacters', async () => {
      const invalidNames = [
        'plugin && malicious',
        'plugin | malicious',
        'plugin$(whoami)',
        'plugin`whoami`',
        'plugin > /etc/passwd',
        'plugin < /etc/passwd',
      ];

      for (const invalidName of invalidNames) {
        const result = await installer.installPlugin(invalidName, 'test-marketplace');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid plugin name');
      }

      expect(mockProcessExecutor.exec).not.toHaveBeenCalled();
    });

    it('should reject marketplace identifiers with command injection', async () => {
      const result = await installer.installPlugin(
        'valid-plugin',
        'marketplace; rm -rf /'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid marketplace');
      expect(mockProcessExecutor.exec).not.toHaveBeenCalled();
    });

    it('should reject empty plugin names', async () => {
      const result = await installer.installPlugin('', 'claude-code-workflows');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plugin name');
    });

    it('should reject empty marketplace identifiers', async () => {
      const result = await installer.installPlugin('valid-plugin', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid marketplace');
    });

    it('should allow valid plugin names with hyphens and underscores', async () => {
      const mockDetector = {
        detectBinary: jest.fn().mockResolvedValue({ found: true }),
      };
      mockBinaryDetector.mockImplementation(() => mockDetector as any);

      mockProcessExecutor.exec.mockResolvedValue({
        stdout: 'Success',
        stderr: '',
        exitCode: 0,
      });

      const result = await installer.installPlugin(
        'valid-plugin-name_123',
        'claude-code-workflows'
      );

      expect(result.success).toBe(true);
    });

    it('should allow valid GitHub-style marketplace identifiers', async () => {
      const mockDetector = {
        detectBinary: jest.fn().mockResolvedValue({ found: true }),
      };
      mockBinaryDetector.mockImplementation(() => mockDetector as any);

      mockProcessExecutor.exec.mockResolvedValue({
        stdout: 'Success',
        stderr: '',
        exitCode: 0,
      });

      const result = await installer.installPlugin(
        'valid-plugin',
        'org/repo'
      );

      expect(result.success).toBe(true);
    });
  });
});
