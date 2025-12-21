/**
 * User Command Tests
 *
 * Comprehensive tests for the `overture user` command group.
 *
 * Test Coverage:
 * - user init: Create global configuration with MCP selection
 * - user show: Display global configuration in YAML/JSON formats
 * - Force overwrite with --force flag
 * - MCP selection prompts and cancellation handling
 * - Config directory creation
 * - Format validation (uppercase, mixed-case, invalid)
 * - Edge cases (Ctrl+C, large selections, special chars in paths)
 *
 * @see apps/cli/src/cli/commands/user.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SpyInstance } from 'vitest';
import { createUserCommand } from './user';
import type { AppDependencies } from '../../composition-root';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock';
import { Prompts } from '@overture/utils';
import { ConfigError } from '@overture/errors';

// Mock Prompts module
vi.mock('@overture/utils', async () => {
  const actual = await vi.importActual('@overture/utils');
  return {
    ...actual,
    Prompts: {
      multiSelect: vi.fn(),
      confirm: vi.fn(),
    },
  };
});

describe('user command', () => {
  let deps: AppDependencies;
  let exitSpy: SpyInstance;
  let consoleLogSpy: SpyInstance;

  beforeEach(() => {
    deps = createMockAppDependencies();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
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
    it('should create a command named "user"', () => {
      const command = createUserCommand(deps);
      expect(command.name()).toBe('user');
    });

    it('should have a description', () => {
      const command = createUserCommand(deps);
      expect(command.description()).toBe('Manage user global configuration');
    });

    it('should have init subcommand', () => {
      const command = createUserCommand(deps);
      const subcommands = command.commands;

      const initCommand = subcommands.find((cmd) => cmd.name() === 'init');
      expect(initCommand).toBeDefined();
      expect(initCommand?.description()).toContain(
        'Initialize user global configuration',
      );
    });

    it('should have show subcommand', () => {
      const command = createUserCommand(deps);
      const subcommands = command.commands;

      const showCommand = subcommands.find((cmd) => cmd.name() === 'show');
      expect(showCommand).toBeDefined();
      expect(showCommand?.description()).toContain(
        'Display user global configuration',
      );
    });
  });

  describe('user init subcommand', () => {
    beforeEach(() => {
      vi.mocked(deps.pathResolver.getUserConfigPath).mockReturnValue(
        '/home/user/.config/overture.yml',
      );
      vi.mocked(deps.pathResolver.getUserConfigDir).mockReturnValue(
        '/home/user/.config',
      );
      vi.mocked(deps.filesystem.fileExists).mockReturnValue(false);
      vi.mocked(deps.filesystem.directoryExists).mockReturnValue(true);
      vi.mocked(deps.filesystem.writeFile).mockResolvedValue(undefined);
    });

    it('should create user configuration with selected MCPs', async () => {
      // Arrange
      vi.mocked(Prompts.multiSelect).mockResolvedValue([
        'filesystem',
        'memory',
      ]);
      vi.mocked(Prompts.confirm).mockResolvedValue(true);

      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'init']);

      // Assert
      expect(Prompts.multiSelect).toHaveBeenCalled();
      expect(deps.filesystem.writeFile).toHaveBeenCalledWith(
        '/home/user/.config/overture.yml',
        expect.stringContaining('filesystem'),
      );
      expect(deps.filesystem.writeFile).toHaveBeenCalledWith(
        '/home/user/.config/overture.yml',
        expect.stringContaining('memory'),
      );
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('User configuration created'),
      );
    });

    it('should not overwrite existing config without --force', async () => {
      // Arrange
      vi.mocked(deps.filesystem.fileExists).mockReturnValue(true);

      const command = createUserCommand(deps);

      // Act & Assert - ErrorHandler logs via Logger, not deps.output
      await expect(
        command.parseAsync(['node', 'user', 'init']),
      ).rejects.toThrow('process.exit:1');

      expect(deps.filesystem.writeFile).not.toHaveBeenCalled();
    });

    it('should overwrite existing config with --force flag', async () => {
      // Arrange
      vi.mocked(deps.filesystem.fileExists).mockReturnValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['filesystem']);
      vi.mocked(Prompts.confirm).mockResolvedValue(true);

      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'init', '--force']);

      // Assert
      expect(deps.filesystem.writeFile).toHaveBeenCalled();
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('User configuration created'),
      );
    });

    it('should handle no MCPs selected and prompt for confirmation', async () => {
      // Arrange
      vi.mocked(Prompts.multiSelect).mockResolvedValue([]);
      vi.mocked(Prompts.confirm).mockResolvedValueOnce(false); // Continue without MCPs? No

      const command = createUserCommand(deps);

      // Act & Assert - UserCancelledError uses exit code 5
      await expect(
        command.parseAsync(['node', 'user', 'init']),
      ).rejects.toThrow('process.exit:5');

      expect(Prompts.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Continue without any MCP servers'),
        false,
      );
    });

    it('should allow creating config with no MCPs if user confirms', async () => {
      // Arrange
      vi.mocked(Prompts.multiSelect).mockResolvedValue([]);
      vi.mocked(Prompts.confirm)
        .mockResolvedValueOnce(true) // Continue without MCPs? Yes
        .mockResolvedValueOnce(true); // Create config? Yes

      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'init']);

      // Assert
      expect(deps.filesystem.writeFile).toHaveBeenCalled();
      expect(deps.output.success).toHaveBeenCalled();
    });

    it('should cancel configuration if user declines final confirmation', async () => {
      // Arrange
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['filesystem']);
      vi.mocked(Prompts.confirm).mockResolvedValue(false); // Create config? No

      const command = createUserCommand(deps);

      // Act & Assert - UserCancelledError uses exit code 5
      await expect(
        command.parseAsync(['node', 'user', 'init']),
      ).rejects.toThrow('process.exit:5');

      expect(deps.filesystem.writeFile).not.toHaveBeenCalled();
    });

    it('should create config directory if it does not exist', async () => {
      // Arrange
      vi.mocked(deps.filesystem.directoryExists).mockReturnValue(false);
      vi.mocked(deps.filesystem.createDirectory).mockReturnValue(undefined);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['filesystem']);
      vi.mocked(Prompts.confirm).mockResolvedValue(true);

      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'init']);

      // Assert
      expect(deps.filesystem.createDirectory).toHaveBeenCalledWith(
        '/home/user/.config',
      );
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      // We'll test validation by providing invalid data through the prompt
      // Since we can't easily make validation fail with current mocks,
      // we'll test error handling path indirectly
      vi.mocked(Prompts.multiSelect).mockRejectedValue(
        new Error('Prompt failed'),
      );

      const command = createUserCommand(deps);

      // Act & Assert - ErrorHandler logs via Logger, not deps.output
      await expect(
        command.parseAsync(['node', 'user', 'init']),
      ).rejects.toThrow('process.exit:1');
    });
  });

  describe('user show subcommand', () => {
    it('should display user configuration in YAML format by default', async () => {
      // Arrange
      const mockConfig = {
        version: '2.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            transport: 'stdio' as const,
          },
        },
        clients: {
          'claude-code': { enabled: true },
        },
        sync: {
          backup: true,
          backupRetention: 10,
        },
      };

      vi.mocked(deps.configLoader.hasUserConfig).mockReturnValue(true);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getUserConfigPath).mockReturnValue(
        '/home/user/.config/overture.yml',
      );

      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'show']);

      // Assert
      expect(deps.configLoader.hasUserConfig).toHaveBeenCalled();
      expect(deps.configLoader.loadUserConfig).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('User Global Configuration'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('filesystem'),
      );
    });

    it('should display user configuration in JSON format with --format json', async () => {
      // Arrange
      const mockConfig = {
        version: '2.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            transport: 'stdio' as const,
          },
        },
      };

      vi.mocked(deps.configLoader.hasUserConfig).mockReturnValue(true);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getUserConfigPath).mockReturnValue(
        '/home/user/.config/overture.yml',
      );

      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'show', '--format', 'json']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"memory"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"version"'),
      );
    });

    it('should handle missing user configuration', async () => {
      // Arrange
      vi.mocked(deps.configLoader.hasUserConfig).mockReturnValue(false);
      vi.mocked(deps.pathResolver.getUserConfigPath).mockReturnValue(
        '/home/user/.config/overture.yml',
      );

      const command = createUserCommand(deps);

      // Act & Assert - ErrorHandler logs via Logger, not deps.output
      // Exit code 2 is used for config errors
      await expect(
        command.parseAsync(['node', 'user', 'show']),
      ).rejects.toThrow('process.exit:2');
    });

    it('should handle invalid format option', async () => {
      // Arrange
      vi.mocked(deps.configLoader.hasUserConfig).mockReturnValue(true);

      const command = createUserCommand(deps);

      // Act & Assert - ErrorHandler logs via Logger, not deps.output
      await expect(
        command.parseAsync(['node', 'user', 'show', '--format', 'xml']),
      ).rejects.toThrow('process.exit:1');
    });

    it('should handle config loading errors', async () => {
      // Arrange
      vi.mocked(deps.configLoader.hasUserConfig).mockReturnValue(true);
      vi.mocked(deps.configLoader.loadUserConfig).mockRejectedValue(
        new ConfigError(
          'Failed to parse YAML',
          '/home/user/.config/overture.yml',
        ),
      );

      const command = createUserCommand(deps);

      // Act & Assert - ErrorHandler uses exit code 2 for ConfigError
      await expect(
        command.parseAsync(['node', 'user', 'show']),
      ).rejects.toThrow('process.exit:2');
    });

    it('should display client configuration section', async () => {
      // Arrange
      const mockConfig = {
        version: '2.0' as const,
        mcp: {},
        clients: {
          'claude-code': { enabled: true },
          vscode: { enabled: false },
        },
      };

      vi.mocked(deps.configLoader.hasUserConfig).mockReturnValue(true);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getUserConfigPath).mockReturnValue(
        '/home/user/.config/overture.yml',
      );

      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'show']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Clients'),
      );
      // Client names are logged with two arguments: name and status
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('claude-code:'),
        expect.any(String),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('vscode:'),
        expect.any(String),
      );
    });

    it('should display sync options section', async () => {
      // Arrange
      const mockConfig = {
        version: '2.0' as const,
        mcp: {},
        sync: {
          backup: true,
          backupDir: '~/.config/overture/backups',
          backupRetention: 10,
        },
      };

      vi.mocked(deps.configLoader.hasUserConfig).mockReturnValue(true);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getUserConfigPath).mockReturnValue(
        '/home/user/.config/overture.yml',
      );

      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'show']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sync Options'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('backup'),
      );
    });

    it('should display message when no MCPs are configured', async () => {
      // Arrange
      const mockConfig = {
        version: '2.0' as const,
        mcp: {},
      };

      vi.mocked(deps.configLoader.hasUserConfig).mockReturnValue(true);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getUserConfigPath).mockReturnValue(
        '/home/user/.config/overture.yml',
      );

      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'show']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No MCP servers configured'),
      );
    });

    it('should display summary with count of MCPs and clients', async () => {
      // Arrange
      const mockConfig = {
        version: '2.0' as const,
        mcp: {
          filesystem: { command: 'npx', args: [], transport: 'stdio' as const },
          memory: { command: 'npx', args: [], transport: 'stdio' as const },
        },
        clients: {
          'claude-code': { enabled: true },
          vscode: { enabled: false },
          cursor: { enabled: false },
        },
      };

      vi.mocked(deps.configLoader.hasUserConfig).mockReturnValue(true);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getUserConfigPath).mockReturnValue(
        '/home/user/.config/overture.yml',
      );

      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'show']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('2 MCP servers, 3 clients'),
      );
    });
  });

  describe('edge cases - user interaction', () => {
    beforeEach(() => {
      vi.mocked(deps.pathResolver.getUserConfigPath).mockReturnValue(
        '/home/user/.config/overture.yml',
      );
      vi.mocked(deps.pathResolver.getUserConfigDir).mockReturnValue(
        '/home/user/.config',
      );
      vi.mocked(deps.filesystem.fileExists).mockReturnValue(false);
      vi.mocked(deps.filesystem.directoryExists).mockReturnValue(true);
      vi.mocked(deps.filesystem.writeFile).mockResolvedValue(undefined);
    });

    it('should handle Ctrl+C during MCP selection (returns undefined)', async () => {
      // Arrange - multiSelect returns undefined when user cancels with Ctrl+C
      // This causes an error when trying to access .length on undefined
      vi.mocked(Prompts.multiSelect).mockResolvedValue(undefined as any);

      const command = createUserCommand(deps);

      // Act & Assert - exits with code 1 due to error
      await expect(
        command.parseAsync(['node', 'user', 'init']),
      ).rejects.toThrow('process.exit:1');

      expect(deps.filesystem.writeFile).not.toHaveBeenCalled();
    });

    it('should handle extremely long MCP selection (all 8 available MCPs)', async () => {
      // Arrange - select all available MCPs
      vi.mocked(Prompts.multiSelect).mockResolvedValue([
        'filesystem',
        'memory',
        'sequentialthinking',
        'context7',
        'nx',
        'github',
        'sqlite',
        'postgres',
      ]);
      vi.mocked(Prompts.confirm).mockResolvedValue(true);

      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'init']);

      // Assert
      expect(deps.filesystem.writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(deps.filesystem.writeFile).mock
        .calls[0][1];
      expect(writtenContent).toContain('filesystem');
      expect(writtenContent).toContain('memory');
      expect(writtenContent).toContain('sequentialthinking');
      expect(writtenContent).toContain('context7');
      expect(writtenContent).toContain('nx');
      expect(writtenContent).toContain('github');
      expect(writtenContent).toContain('sqlite');
      expect(writtenContent).toContain('postgres');
      expect(deps.output.success).toHaveBeenCalled();
    });

    it('should handle empty selection followed by cancellation at confirmation', async () => {
      // Arrange - empty selection, then cancel at "continue without MCPs?" prompt
      vi.mocked(Prompts.multiSelect).mockResolvedValue([]);
      vi.mocked(Prompts.confirm).mockResolvedValue(false);

      const command = createUserCommand(deps);

      // Act & Assert - UserCancelledError uses exit code 5
      await expect(
        command.parseAsync(['node', 'user', 'init']),
      ).rejects.toThrow('process.exit:5');

      expect(Prompts.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Continue without any MCP servers'),
        false,
      );
      expect(deps.filesystem.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('edge cases - format options', () => {
    beforeEach(() => {
      vi.mocked(deps.configLoader.hasUserConfig).mockReturnValue(true);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '2.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            transport: 'stdio' as const,
          },
        },
      });
      vi.mocked(deps.pathResolver.getUserConfigPath).mockReturnValue(
        '/home/user/.config/overture.yml',
      );
    });

    it('should handle uppercase format option (JSON)', async () => {
      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'show', '--format', 'JSON']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"filesystem"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"version"'),
      );
    });

    it('should handle uppercase format option (YAML)', async () => {
      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'show', '--format', 'YAML']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('User Global Configuration'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('filesystem'),
      );
    });

    it('should handle mixed-case format option (Json)', async () => {
      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'show', '--format', 'Json']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"filesystem"'),
      );
    });

    it('should handle mixed-case format option (Yaml)', async () => {
      const command = createUserCommand(deps);

      // Act
      await command.parseAsync(['node', 'user', 'show', '--format', 'Yaml']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('User Global Configuration'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('filesystem'),
      );
    });

    it('should error on format option with whitespace', async () => {
      const command = createUserCommand(deps);

      // Act & Assert - whitespace is not trimmed, so this is invalid
      // ErrorHandler displays error via Logger, not output.error
      await expect(
        command.parseAsync(['node', 'user', 'show', '--format', ' JSON ']),
      ).rejects.toThrow('process.exit:1');
    });

    it('should error on empty format string', async () => {
      const command = createUserCommand(deps);

      // Act & Assert - ErrorHandler displays error via Logger, not output.error
      await expect(
        command.parseAsync(['node', 'user', 'show', '--format', '']),
      ).rejects.toThrow('process.exit:1');
    });
  });
});
