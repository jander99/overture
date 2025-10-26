import { ProcessExecutor } from '../infrastructure/process-executor';
import { Logger } from '../utils/logger';
import { PluginInstaller, PluginInstallResult } from './plugin-installer';
import { PluginError } from '../domain/errors';

// Mock dependencies
jest.mock('../infrastructure/process-executor');
jest.mock('../utils/logger');

describe('Core: PluginInstaller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // installPlugin Tests
  // ============================================================================
  describe('installPlugin', () => {
    describe('Successful installation', () => {
      it('should install plugin successfully when claude CLI exists', async () => {
        // Arrange
        const pluginName = 'python-development';
        const marketplace = 'claude-code-workflows';

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: 'Plugin installed successfully',
          stderr: '',
          exitCode: 0,
        });

        // Act
        const result = await PluginInstaller.installPlugin(
          pluginName,
          marketplace
        );

        // Assert
        expect(result).toEqual({
          pluginName,
          marketplace,
          success: true,
          message: 'Plugin installed successfully',
        });
        expect(ProcessExecutor.commandExists).toHaveBeenCalledWith('claude');
        expect(ProcessExecutor.exec).toHaveBeenCalledWith('claude', [
          'plugin',
          'install',
          'python-development@claude-code-workflows',
        ]);
      });

      it('should execute correct command with plugin@marketplace format', async () => {
        // Arrange
        const pluginName = 'typescript-patterns';
        const marketplace = 'custom-marketplace';

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

        // Act
        await PluginInstaller.installPlugin(pluginName, marketplace);

        // Assert
        expect(ProcessExecutor.exec).toHaveBeenCalledWith('claude', [
          'plugin',
          'install',
          'typescript-patterns@custom-marketplace',
        ]);
      });

      it('should log installation progress', async () => {
        // Arrange
        const pluginName = 'test-plugin';
        const marketplace = 'test-market';

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

        // Act
        await PluginInstaller.installPlugin(pluginName, marketplace);

        // Assert
        expect(Logger.info).toHaveBeenCalledWith(
          'Installing plugin: test-plugin@test-market'
        );
      });

      it('should return PluginInstallResult with success: true', async () => {
        // Arrange
        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: 'Success',
          stderr: '',
          exitCode: 0,
        });

        // Act
        const result = await PluginInstaller.installPlugin('plugin', 'market');

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Plugin installed successfully');
      });
    });

    describe('Claude CLI not found', () => {
      it('should throw PluginError when claude CLI not found', async () => {
        // Arrange
        const pluginName = 'python-development';
        const marketplace = 'claude-code-workflows';

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(false);

        // Act & Assert
        await expect(
          PluginInstaller.installPlugin(pluginName, marketplace)
        ).rejects.toThrow(PluginError);
        await expect(
          PluginInstaller.installPlugin(pluginName, marketplace)
        ).rejects.toThrow('Claude CLI not found. Please install Claude Code first.');
      });

      it('should include plugin name in PluginError', async () => {
        // Arrange
        const pluginName = 'test-plugin';
        const marketplace = 'market';

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(false);

        // Act & Assert
        try {
          await PluginInstaller.installPlugin(pluginName, marketplace);
          fail('Should have thrown PluginError');
        } catch (error) {
          expect(error).toBeInstanceOf(PluginError);
          expect((error as PluginError).pluginName).toBe('test-plugin');
        }
      });

      it('should not execute install command when CLI not found', async () => {
        // Arrange
        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(false);

        // Act & Assert
        try {
          await PluginInstaller.installPlugin('plugin', 'market');
        } catch {
          // Expected to throw
        }

        expect(ProcessExecutor.exec).not.toHaveBeenCalled();
      });
    });

    describe('Installation failure', () => {
      it('should return failure result on non-zero exit code', async () => {
        // Arrange
        const pluginName = 'failing-plugin';
        const marketplace = 'market';

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: '',
          stderr: 'Plugin not found in marketplace',
          exitCode: 1,
        });

        // Act
        const result = await PluginInstaller.installPlugin(
          pluginName,
          marketplace
        );

        // Assert
        expect(result).toEqual({
          pluginName,
          marketplace,
          success: false,
          message: 'Plugin not found in marketplace',
        });
      });

      it('should return PluginInstallResult with success: false on failure', async () => {
        // Arrange
        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: '',
          stderr: 'Error',
          exitCode: 2,
        });

        // Act
        const result = await PluginInstaller.installPlugin('plugin', 'market');

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Error');
      });

      it('should include error message in failure result', async () => {
        // Arrange
        const errorMessage = 'Network error: connection timeout';

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: '',
          stderr: errorMessage,
          exitCode: 1,
        });

        // Act
        const result = await PluginInstaller.installPlugin('plugin', 'market');

        // Assert
        expect(result.message).toBe(errorMessage);
      });

      it('should use fallback message when stderr is empty', async () => {
        // Arrange
        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 1,
        });

        // Act
        const result = await PluginInstaller.installPlugin('plugin', 'market');

        // Assert
        expect(result.message).toBe('Installation failed');
      });
    });

    describe('Process execution errors', () => {
      it('should throw PluginError on process execution exception', async () => {
        // Arrange
        const executionError = new Error('Process spawn failed');

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockRejectedValue(executionError);

        // Act & Assert
        await expect(
          PluginInstaller.installPlugin('plugin', 'market')
        ).rejects.toThrow(PluginError);
        await expect(
          PluginInstaller.installPlugin('plugin', 'market')
        ).rejects.toThrow('Failed to install plugin: Process spawn failed');
      });

      it('should rethrow PluginError without wrapping', async () => {
        // Arrange
        const pluginError = new PluginError('Custom error', 'plugin');

        (ProcessExecutor.commandExists as jest.Mock).mockRejectedValue(
          pluginError
        );

        // Act & Assert
        await expect(
          PluginInstaller.installPlugin('plugin', 'market')
        ).rejects.toThrow(pluginError);
      });

      it('should wrap generic errors as PluginError', async () => {
        // Arrange
        const genericError = new Error('Unknown error');

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockRejectedValue(genericError);

        // Act & Assert
        try {
          await PluginInstaller.installPlugin('test-plugin', 'market');
          fail('Should have thrown PluginError');
        } catch (error) {
          expect(error).toBeInstanceOf(PluginError);
          expect((error as PluginError).message).toContain(
            'Failed to install plugin'
          );
          expect((error as PluginError).pluginName).toBe('test-plugin');
        }
      });
    });
  });

  // ============================================================================
  // installPlugins Tests
  // ============================================================================
  describe('installPlugins', () => {
    describe('Successful installation', () => {
      it('should install multiple plugins successfully', async () => {
        // Arrange
        const plugins = [
          { name: 'plugin1', marketplace: 'market1' },
          { name: 'plugin2', marketplace: 'market2' },
          { name: 'plugin3', marketplace: 'market3' },
        ];

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: 'Success',
          stderr: '',
          exitCode: 0,
        });

        // Act
        const results = await PluginInstaller.installPlugins(plugins);

        // Assert
        expect(results).toHaveLength(3);
        expect(results.every((r) => r.success)).toBe(true);
        expect(ProcessExecutor.exec).toHaveBeenCalledTimes(3);
      });

      it('should return array of results with success status', async () => {
        // Arrange
        const plugins = [
          { name: 'plugin1', marketplace: 'market' },
          { name: 'plugin2', marketplace: 'market' },
        ];

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

        // Act
        const results = await PluginInstaller.installPlugins(plugins);

        // Assert
        expect(results).toEqual([
          {
            pluginName: 'plugin1',
            marketplace: 'market',
            success: true,
            message: 'Plugin installed successfully',
          },
          {
            pluginName: 'plugin2',
            marketplace: 'market',
            success: true,
            message: 'Plugin installed successfully',
          },
        ]);
      });

      it('should aggregate all installation results', async () => {
        // Arrange
        const plugins = [
          { name: 'python-development', marketplace: 'claude-code-workflows' },
          { name: 'typescript-patterns', marketplace: 'claude-code-workflows' },
        ];

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

        // Act
        const results = await PluginInstaller.installPlugins(plugins);

        // Assert
        expect(results[0].pluginName).toBe('python-development');
        expect(results[1].pluginName).toBe('typescript-patterns');
        expect(results.every((r) => r.success)).toBe(true);
      });

      it('should handle empty plugin list', async () => {
        // Arrange
        const plugins: Array<{ name: string; marketplace: string }> = [];

        // Act
        const results = await PluginInstaller.installPlugins(plugins);

        // Assert
        expect(results).toEqual([]);
        expect(ProcessExecutor.exec).not.toHaveBeenCalled();
      });
    });

    describe('Partial failures', () => {
      it('should continue on individual plugin failures', async () => {
        // Arrange
        const plugins = [
          { name: 'success-plugin', marketplace: 'market' },
          { name: 'failing-plugin', marketplace: 'market' },
          { name: 'another-success', marketplace: 'market' },
        ];

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock)
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
          .mockResolvedValueOnce({
            stdout: '',
            stderr: 'Not found',
            exitCode: 1,
          })
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

        // Act
        const results = await PluginInstaller.installPlugins(plugins);

        // Assert
        expect(results).toHaveLength(3);
        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(false);
        expect(results[2].success).toBe(true);
      });

      it('should return array of results with mixed success/failure status', async () => {
        // Arrange
        const plugins = [
          { name: 'good-plugin', marketplace: 'market' },
          { name: 'bad-plugin', marketplace: 'market' },
        ];

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock)
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
          .mockResolvedValueOnce({
            stdout: '',
            stderr: 'Error',
            exitCode: 1,
          });

        // Act
        const results = await PluginInstaller.installPlugins(plugins);

        // Assert
        expect(results[0]).toMatchObject({
          pluginName: 'good-plugin',
          success: true,
        });
        expect(results[1]).toMatchObject({
          pluginName: 'bad-plugin',
          success: false,
          message: 'Error',
        });
      });
    });

    describe('Exception handling', () => {
      it('should catch exceptions and convert to failure results', async () => {
        // Arrange
        const plugins = [
          { name: 'plugin1', marketplace: 'market' },
          { name: 'plugin2', marketplace: 'market' },
        ];

        const claudeNotFoundError = new PluginError(
          'Claude CLI not found. Please install Claude Code first.',
          'plugin1'
        );

        (ProcessExecutor.commandExists as jest.Mock)
          .mockResolvedValueOnce(false) // First plugin fails
          .mockResolvedValueOnce(true); // Second plugin succeeds
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

        // Act
        const results = await PluginInstaller.installPlugins(plugins);

        // Assert
        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(false);
        expect(results[0].message).toContain('Claude CLI not found');
        expect(results[1].success).toBe(true);
      });

      it('should handle PluginError exceptions without stopping', async () => {
        // Arrange
        const plugins = [
          { name: 'failing-plugin', marketplace: 'market' },
          { name: 'success-plugin', marketplace: 'market' },
        ];

        (ProcessExecutor.commandExists as jest.Mock)
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true);
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

        // Act
        const results = await PluginInstaller.installPlugins(plugins);

        // Assert
        expect(results[0]).toMatchObject({
          pluginName: 'failing-plugin',
          success: false,
        });
        expect(results[1]).toMatchObject({
          pluginName: 'success-plugin',
          success: true,
        });
      });

      it('should convert generic errors to failure results', async () => {
        // Arrange
        const plugins = [{ name: 'error-plugin', marketplace: 'market' }];
        const genericError = new Error('Unexpected error');

        (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);
        (ProcessExecutor.exec as jest.Mock).mockRejectedValue(genericError);

        // Act
        const results = await PluginInstaller.installPlugins(plugins);

        // Assert
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].message).toContain('Failed to install plugin');
      });
    });
  });

  // ============================================================================
  // isPluginInstalled Tests
  // ============================================================================
  describe('isPluginInstalled', () => {
    describe('Plugin detection', () => {
      it('should return true when plugin found in list output', async () => {
        // Arrange
        const pluginName = 'python-development';
        const listOutput = `
          Available plugins:
          - python-development
          - typescript-patterns
          - react-components
        `;

        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: listOutput,
          stderr: '',
          exitCode: 0,
        });

        // Act
        const result = await PluginInstaller.isPluginInstalled(pluginName);

        // Assert
        expect(result).toBe(true);
        expect(ProcessExecutor.exec).toHaveBeenCalledWith('claude', [
          'plugin',
          'list',
        ]);
      });

      it('should return false when plugin not found', async () => {
        // Arrange
        const pluginName = 'nonexistent-plugin';
        const listOutput = `
          Available plugins:
          - python-development
          - typescript-patterns
        `;

        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: listOutput,
          stderr: '',
          exitCode: 0,
        });

        // Act
        const result = await PluginInstaller.isPluginInstalled(pluginName);

        // Assert
        expect(result).toBe(false);
      });

      it('should execute claude plugin list command', async () => {
        // Arrange
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: 'python-development',
          stderr: '',
          exitCode: 0,
        });

        // Act
        await PluginInstaller.isPluginInstalled('python-development');

        // Assert
        expect(ProcessExecutor.exec).toHaveBeenCalledWith('claude', [
          'plugin',
          'list',
        ]);
      });
    });

    describe('Safe failure mode', () => {
      it('should return false on command execution error', async () => {
        // Arrange
        const executionError = new Error('Command failed');

        (ProcessExecutor.exec as jest.Mock).mockRejectedValue(executionError);

        // Act
        const result = await PluginInstaller.isPluginInstalled('any-plugin');

        // Assert
        expect(result).toBe(false);
      });

      it('should return false when ProcessExecutor throws', async () => {
        // Arrange
        (ProcessExecutor.exec as jest.Mock).mockRejectedValue(
          new PluginError('Error')
        );

        // Act
        const result = await PluginInstaller.isPluginInstalled('plugin');

        // Assert
        expect(result).toBe(false);
      });

      it('should handle empty stdout gracefully', async () => {
        // Arrange
        (ProcessExecutor.exec as jest.Mock).mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

        // Act
        const result = await PluginInstaller.isPluginInstalled('plugin');

        // Assert
        expect(result).toBe(false);
      });
    });
  });
});
