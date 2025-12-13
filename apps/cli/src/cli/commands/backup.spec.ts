import type { Mock, Mocked, MockedObject, MockedFunction, MockInstance } from 'vitest';
// Mock chalk FIRST before any other imports
vi.mock('chalk', () => {
  // Create a function that returns the string unchanged
  const mockFn = (str: any) => String(str ?? '');

  // Build a single chainable object (avoid infinite recursion by creating once)
  const chainable: any = function(str: any) { return String(str ?? ''); };

  // Add all color methods that point back to the same chainable
  const colors = ['bold', 'blue', 'yellow', 'magenta', 'green', 'red', 'gray', 'cyan', 'dim'];
  colors.forEach(color => {
    chainable[color] = chainable;
  });

  return {
    default: chainable,
    __esModule: true,
  };
});

// Mock inquirer
vi.mock('inquirer', () => ({
  prompt: vi.fn(),
}));

import { Command } from 'commander';
import { createBackupCommand } from './backup';
import * as BackupService from '../../core/backup-service';
import * as RestoreService from '../../core/restore-service';
import { adapterRegistry } from '../../adapters/adapter-registry';
import { Logger } from '../../utils/logger';
import { Prompts } from '../../utils/prompts';
import * as PathResolver from '../../core/path-resolver';
import type { ClientName } from '../../domain/config.types';
import type { BackupMetadata } from '../../core/backup-service';
import type { RestoreResult } from '../../core/restore-service';

// Hoist Logger mock so error-handler can access it
const { LoggerMock } = vi.hoisted(() => {
  const mock = {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    nl: vi.fn(),
  };
  return { LoggerMock: mock };
});

// Mock all dependencies
vi.mock('../../core/backup-service');
vi.mock('../../core/restore-service');
vi.mock('../../utils/logger', () => ({
  Logger: LoggerMock,
}));
vi.mock('../../utils/prompts');
vi.mock('../../core/path-resolver');

// Mock error-handler to avoid chalk issues
vi.mock('../../core/error-handler', () => {
  // Create error classes with proper exit code handling
  class ConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConfigurationError';
    }
  }

  class FileSystemError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'FileSystemError';
    }
  }

  class NetworkError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NetworkError';
    }
  }

  class UserCancelledError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'UserCancelledError';
    }
  }

  class DependencyError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DependencyError';
    }
  }

  return {
    ErrorHandler: {
      handleCommandError: (error: any, command?: string, verbose?: boolean) => {
        // Log the error message using the hoisted LoggerMock
        const errorMessage = error instanceof Error ? error.message : String(error);
        LoggerMock.error(errorMessage);

        // Determine exit code based on error type
        let exitCode = 1; // Default to general error

        if (error instanceof UserCancelledError) {
          exitCode = 5; // USER_CANCELLED
        } else if (error instanceof ConfigurationError) {
          exitCode = 2; // CONFIG_ERROR
        } else if (error instanceof FileSystemError) {
          exitCode = 4; // FILESYSTEM_ERROR
        } else if ((error as any)?.exitCode !== undefined) {
          // Check for custom exitCode property
          exitCode = (error as any).exitCode;
        }

        process.exit(exitCode);
      },
    },
    ExitCode: {
      SUCCESS: 0,
      GENERAL_ERROR: 1,
      CONFIG_ERROR: 2,
      VALIDATION_ERROR: 3,
      FILESYSTEM_ERROR: 4,
      USER_CANCELLED: 5,
      UNKNOWN_ERROR: 99,
    },
    ConfigurationError,
    FileSystemError,
    NetworkError,
    UserCancelledError,
    DependencyError,
  };
});

// Mock adapter registry
vi.mock('../../adapters/adapter-registry', () => ({
  adapterRegistry: {
    get: vi.fn(),
    getAllNames: vi.fn(),
  },
}));

describe('CLI Command: backup', () => {
  let command: Command;
  let mockExit: MockInstance;
  let mockConsoleLog: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up PathResolver mock
    (PathResolver.getPlatform as Mock).mockReturnValue('linux');

    command = createBackupCommand();

    // Mock process.exit to prevent test termination
    mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit: ${code}`);
    });

    // Mock console.log for table output
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
  });

  // ============================================================================
  // backup list subcommand
  // ============================================================================
  describe('backup list', () => {
    it('should list all backups grouped by client', async () => {
      // Arrange
      const backups: BackupMetadata[] = [
        {
          client: 'claude-code',
          timestamp: '2025-01-11T14-30-00-000Z',
          path: '/backups/claude-code-2025-01-11T14-30-00-000Z.json',
          size: 1024,
        },
        {
          client: 'claude-code',
          timestamp: '2025-01-11T13-00-00-000Z',
          path: '/backups/claude-code-2025-01-11T13-00-00-000Z.json',
          size: 2048,
        },
        {
          client: 'vscode',
          timestamp: '2025-01-11T12-00-00-000Z',
          path: '/backups/vscode-2025-01-11T12-00-00-000Z.json',
          size: 4096,
        },
      ];

      (BackupService.listBackups as Mock).mockReturnValue(backups);

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      expect(BackupService.listBackups).toHaveBeenCalledWith(undefined);
      expect(Logger.info).toHaveBeenCalledWith('All backups:');
      expect(Logger.info).toHaveBeenCalledWith('Total: 3 backup(s)');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('claude-code:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('vscode:'));
    });

    it('should filter backups by client when --client flag is provided', async () => {
      // Arrange
      const backups: BackupMetadata[] = [
        {
          client: 'vscode',
          timestamp: '2025-01-11T14-30-00-000Z',
          path: '/backups/vscode-2025-01-11T14-30-00-000Z.json',
          size: 1024,
        },
      ];

      (BackupService.listBackups as Mock).mockReturnValue(backups);

      // Act
      await command.parseAsync(['node', 'overture', 'list', '--client', 'vscode']);

      // Assert
      expect(BackupService.listBackups).toHaveBeenCalledWith('vscode');
      expect(Logger.info).toHaveBeenCalledWith('Backups for vscode:');
      expect(Logger.info).toHaveBeenCalledWith('Total: 1 backup(s)');
    });

    it('should warn when no backups found', async () => {
      // Arrange
      (BackupService.listBackups as Mock).mockReturnValue([]);

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      expect(Logger.warn).toHaveBeenCalledWith('No backups found');
    });

    it('should warn when no backups found for specific client', async () => {
      // Arrange
      (BackupService.listBackups as Mock).mockReturnValue([]);

      // Act
      await command.parseAsync(['node', 'overture', 'list', '--client', 'cursor']);

      // Assert
      expect(Logger.warn).toHaveBeenCalledWith('No backups found for client: cursor');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      (BackupService.listBackups as Mock).mockImplementation(() => {
        throw new Error('Failed to read backup directory');
      });

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'list'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read backup directory')
      );
    });

    it('should display backup sizes in appropriate units', async () => {
      // Arrange
      const backups: BackupMetadata[] = [
        {
          client: 'claude-code',
          timestamp: '2025-01-11T14-30-00-000Z',
          path: '/backups/backup1.json',
          size: 512, // < 1 KB
        },
        {
          client: 'claude-code',
          timestamp: '2025-01-11T13-00-00-000Z',
          path: '/backups/backup2.json',
          size: 2048, // 2 KB
        },
        {
          client: 'claude-code',
          timestamp: '2025-01-11T12-00-00-000Z',
          path: '/backups/backup3.json',
          size: 2 * 1024 * 1024, // 2 MB
        },
      ];

      (BackupService.listBackups as Mock).mockReturnValue(backups);

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('512 B'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('2.0 KB'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('2.0 MB'));
    });
  });

  // ============================================================================
  // backup restore subcommand
  // ============================================================================
  describe('backup restore', () => {
    const mockAdapter = {
      name: 'claude-code' as ClientName,
      schemaRootKey: 'mcpServers' as const,
      detectConfigPath: vi.fn().mockReturnValue('/path/to/config.json'),
      readConfig: vi.fn(),
      writeConfig: vi.fn(),
      convertToClientConfig: vi.fn(),
      isInstalled: vi.fn().mockReturnValue(true),
    };

    beforeEach(() => {
      (adapterRegistry.get as Mock).mockReturnValue(mockAdapter);
      (adapterRegistry.getAllNames as Mock).mockReturnValue([
        'claude-code',
        'vscode',
        'cursor',
      ]);
      (PathResolver.getPlatform as Mock).mockReturnValue('linux');
    });

    it('should restore specific backup with confirmation', async () => {
      // Arrange
      const backup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-11T14-30-00-000Z',
        path: '/backups/backup.json',
        size: 1024,
      };

      const restoreResult: RestoreResult = {
        success: true,
        backupPath: '/backups/backup.json',
        restoredPath: '/path/to/config.json',
      };

      (BackupService.listBackups as Mock).mockReturnValue([backup]);
      (Prompts.confirm as Mock).mockResolvedValue(true);
      (RestoreService.restoreBackup as Mock).mockReturnValue(restoreResult);

      // Act
      await command.parseAsync([
        'node',
        'overture',
        'restore',
        'claude-code',
        '2025-01-11T14-30-00-000Z',
      ]);

      // Assert
      expect(Prompts.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Restore this backup?'),
        false
      );
      expect(RestoreService.restoreBackup).toHaveBeenCalledWith(
        'claude-code',
        '2025-01-11T14-30-00-000Z',
        '/path/to/config.json'
      );
      expect(Logger.success).toHaveBeenCalledWith('Backup restored successfully');
    });

    it('should restore latest backup with --latest flag', async () => {
      // Arrange
      const backup: BackupMetadata = {
        client: 'vscode',
        timestamp: '2025-01-11T14-30-00-000Z',
        path: '/backups/latest.json',
        size: 2048,
      };

      const restoreResult: RestoreResult = {
        success: true,
        backupPath: '/backups/latest.json',
        restoredPath: '/path/to/vscode-config.json',
      };

      (BackupService.getLatestBackup as Mock).mockReturnValue(backup);
      (Prompts.confirm as Mock).mockResolvedValue(true);
      (RestoreService.restoreLatestBackup as Mock).mockReturnValue(restoreResult);

      // Act
      await command.parseAsync([
        'node',
        'overture',
        'restore',
        'vscode',
        '--latest',
      ]);

      // Assert
      expect(BackupService.getLatestBackup).toHaveBeenCalledWith('vscode');
      expect(RestoreService.restoreLatestBackup).toHaveBeenCalledWith(
        'vscode',
        '/path/to/config.json'
      );
      expect(Logger.success).toHaveBeenCalledWith('Backup restored successfully');
    });

    it('should cancel restore when user declines confirmation', async () => {
      // Arrange
      const backup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-11T14-30-00-000Z',
        path: '/backups/backup.json',
        size: 1024,
      };

      (BackupService.listBackups as Mock).mockReturnValue([backup]);
      (Prompts.confirm as Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(
        command.parseAsync([
          'node',
          'overture',
          'restore',
          'claude-code',
          '2025-01-11T14-30-00-000Z',
        ])
      ).rejects.toThrow('process.exit: 5');

      expect(RestoreService.restoreBackup).not.toHaveBeenCalled();
    });

    it('should skip confirmation with --no-confirm flag', async () => {
      // Arrange
      const backup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-11T14-30-00-000Z',
        path: '/backups/backup.json',
        size: 1024,
      };

      const restoreResult: RestoreResult = {
        success: true,
        backupPath: '/backups/backup.json',
        restoredPath: '/path/to/config.json',
      };

      (BackupService.listBackups as Mock).mockReturnValue([backup]);
      (RestoreService.restoreBackup as Mock).mockReturnValue(restoreResult);

      // Act
      await command.parseAsync([
        'node',
        'overture',
        'restore',
        'claude-code',
        '2025-01-11T14-30-00-000Z',
        '--no-confirm',
      ]);

      // Assert
      expect(Prompts.confirm).not.toHaveBeenCalled();
      expect(RestoreService.restoreBackup).toHaveBeenCalled();
    });

    it('should error when client is unknown', async () => {
      // Arrange
      (adapterRegistry.get as Mock).mockReturnValue(undefined);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'restore', 'unknown-client', '--latest'])
      ).rejects.toThrow('process.exit: 2');

      expect(Logger.error).toHaveBeenCalledWith('Unknown client: unknown-client');
      expect(Logger.info).toHaveBeenCalledWith('Available clients:');
    });

    it('should error when no backups exist for client', async () => {
      // Arrange
      (BackupService.getLatestBackup as Mock).mockReturnValue(null);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'restore', 'claude-code', '--latest'])
      ).rejects.toThrow('process.exit: 2');

      expect(Logger.error).toHaveBeenCalledWith('No backups found for claude-code');
    });

    it('should error when specific backup not found', async () => {
      // Arrange
      (BackupService.listBackups as Mock).mockReturnValue([
        {
          client: 'claude-code',
          timestamp: '2025-01-11T10-00-00-000Z',
          path: '/backups/old.json',
          size: 1024,
        },
      ]);

      // Act & Assert
      await expect(
        command.parseAsync([
          'node',
          'overture',
          'restore',
          'claude-code',
          '2025-01-11T14-30-00-000Z',
        ])
      ).rejects.toThrow('process.exit: 2');

      expect(Logger.error).toHaveBeenCalledWith(
        'Backup not found: claude-code at 2025-01-11T14-30-00-000Z'
      );
    });

    it('should handle restore failure', async () => {
      // Arrange
      const backup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-11T14-30-00-000Z',
        path: '/backups/backup.json',
        size: 1024,
      };

      const restoreResult: RestoreResult = {
        success: false,
        backupPath: '/backups/backup.json',
        restoredPath: '/path/to/config.json',
        error: 'Failed to write file',
      };

      (BackupService.listBackups as Mock).mockReturnValue([backup]);
      (Prompts.confirm as Mock).mockResolvedValue(true);
      (RestoreService.restoreBackup as Mock).mockReturnValue(restoreResult);

      // Act & Assert
      await expect(
        command.parseAsync([
          'node',
          'overture',
          'restore',
          'claude-code',
          '2025-01-11T14-30-00-000Z',
        ])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith('Restore failed: Failed to write file');
    });

    it('should display backup details before confirmation', async () => {
      // Arrange
      const backup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-11T14-30-00-000Z',
        path: '/backups/backup.json',
        size: 1024,
      };

      (BackupService.getLatestBackup as Mock).mockReturnValue(backup);
      (Prompts.confirm as Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'restore', 'claude-code', '--latest'])
      ).rejects.toThrow('process.exit: 5');

      expect(Logger.info).toHaveBeenCalledWith('Backup details:');
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Client:'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Timestamp:'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Size:'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Age:'));
    });

    it('should indicate when restoring latest backup', async () => {
      // Arrange
      const backup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-11T14-30-00-000Z',
        path: '/backups/backup.json',
        size: 1024,
      };

      (BackupService.getLatestBackup as Mock).mockReturnValue(backup);
      (Prompts.confirm as Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'restore', 'claude-code', '--latest'])
      ).rejects.toThrow('process.exit: 5');

      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('(Most recent backup)')
      );
    });

    it('should handle exceptions during restore', async () => {
      // Arrange
      (BackupService.getLatestBackup as Mock).mockImplementation(() => {
        throw new Error('Backup directory corrupted');
      });

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'restore', 'claude-code', '--latest'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Backup directory corrupted')
      );
    });
  });

  // ============================================================================
  // backup cleanup subcommand
  // ============================================================================
  describe('backup cleanup', () => {
    beforeEach(() => {
      (adapterRegistry.getAllNames as Mock).mockReturnValue([
        'claude-code',
        'vscode',
        'cursor',
      ]);
    });

    it('should cleanup old backups for all clients', async () => {
      // Arrange
      (BackupService.listBackups as Mock)
        .mockReturnValueOnce(Array(15).fill({})) // claude-code: 15 before
        .mockReturnValueOnce(Array(10).fill({})) // claude-code: 10 after
        .mockReturnValueOnce(Array(12).fill({})) // vscode: 12 before
        .mockReturnValueOnce(Array(10).fill({})) // vscode: 10 after
        .mockReturnValueOnce([]); // cursor: 0 before (skipped, no second call)

      (BackupService.cleanupOldBackups as Mock).mockImplementation(() => {});

      // Act
      await command.parseAsync(['node', 'overture', 'cleanup']);

      // Assert
      expect(BackupService.cleanupOldBackups).toHaveBeenCalledWith('claude-code', 10);
      expect(BackupService.cleanupOldBackups).toHaveBeenCalledWith('vscode', 10);
      // cursor should be skipped (has 0 backups)
      expect(BackupService.cleanupOldBackups).not.toHaveBeenCalledWith('cursor', 10);
      expect(Logger.success).toHaveBeenCalledWith('Cleaned up 7 backup(s)');
    });

    it('should cleanup backups for specific client with --client flag', async () => {
      // Arrange
      // When --client is specified, only that client's backups are checked
      (BackupService.listBackups as Mock)
        .mockReturnValueOnce(Array(15).fill({})) // vscode: before
        .mockReturnValueOnce(Array(10).fill({})); // vscode: after

      (BackupService.cleanupOldBackups as Mock).mockImplementation(() => {});

      // Act
      await command.parseAsync(['node', 'overture', 'cleanup', '--client', 'vscode']);

      // Assert
      expect(BackupService.listBackups).toHaveBeenCalledWith('vscode');
      expect(BackupService.cleanupOldBackups).toHaveBeenCalledWith('vscode', 10);
      expect(BackupService.cleanupOldBackups).toHaveBeenCalledTimes(1);
      expect(Logger.success).toHaveBeenCalledWith('Cleaned up 5 backup(s)');
    });

    it('should support custom keep count with --keep flag', async () => {
      // Arrange
      // All clients: claude-code (10 backups), vscode & cursor (0 backups, skipped)
      (BackupService.listBackups as Mock)
        .mockReturnValueOnce(Array(10).fill({}))  // claude-code: before (10)
        .mockReturnValueOnce(Array(5).fill({}))   // claude-code: after (5)
        .mockReturnValueOnce([])                   // vscode: 0 backups (skipped)
        .mockReturnValueOnce([]);                  // cursor: 0 backups (skipped)

      (BackupService.cleanupOldBackups as Mock).mockImplementation(() => {});

      // Act
      await command.parseAsync(['node', 'overture', 'cleanup', '--keep', '5']);

      // Assert
      expect(BackupService.cleanupOldBackups).toHaveBeenCalledWith('claude-code', 5);
      expect(Logger.success).toHaveBeenCalledWith('Cleaned up 5 backup(s)');
    });

    it('should handle no backups to cleanup', async () => {
      // Arrange
      (BackupService.listBackups as Mock).mockReturnValue([]);

      // Act
      await command.parseAsync(['node', 'overture', 'cleanup']);

      // Assert
      expect(Logger.info).toHaveBeenCalledWith('No backups to clean up');
    });

    it('should error on invalid keep count', async () => {
      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'cleanup', '--keep', 'invalid'])
      ).rejects.toThrow('process.exit: 2');

      expect(Logger.error).toHaveBeenCalledWith(
        'Keep count must be a positive integer'
      );
    });

    it('should error on zero keep count', async () => {
      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'cleanup', '--keep', '0'])
      ).rejects.toThrow('process.exit: 2');

      expect(Logger.error).toHaveBeenCalledWith(
        'Keep count must be a positive integer'
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      // Arrange
      (BackupService.listBackups as Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'cleanup'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied')
      );
    });

    it('should report cleanup for each client', async () => {
      // Arrange
      (BackupService.listBackups as Mock)
        .mockReturnValueOnce(Array(15).fill({})) // claude-code before
        .mockReturnValueOnce(Array(10).fill({})) // claude-code after
        .mockReturnValueOnce(Array(8).fill({}))  // vscode before
        .mockReturnValueOnce(Array(8).fill({}))  // vscode after (no change)
        .mockReturnValueOnce([])                  // cursor before
        .mockReturnValueOnce([]);                 // cursor after

      (BackupService.cleanupOldBackups as Mock).mockImplementation(() => {});

      // Act
      await command.parseAsync(['node', 'overture', 'cleanup']);

      // Assert
      // Check that Logger.info was called with message containing the cleanup info
      const infoCalls = (Logger.info as Mock).mock.calls;
      const cleanupCall = infoCalls.find((call) =>
        call[0].includes('Removed 5 old backup(s), kept 10')
      );
      expect(cleanupCall).toBeDefined();
      expect(cleanupCall[0]).toContain('claude-code');
      // vscode should not appear (no backups removed)
      expect(Logger.success).toHaveBeenCalledWith('Cleaned up 5 backup(s)');
    });
  });

  // ============================================================================
  // Command Configuration Tests
  // ============================================================================
  describe('Command configuration', () => {
    it('should have correct command description', () => {
      expect(command.description()).toBe('Manage client MCP configuration backups');
    });

    it('should have command name "backup"', () => {
      expect(command.name()).toBe('backup');
    });

    it('should have list subcommand', () => {
      const subcommands = command.commands;
      const listCmd = subcommands.find((cmd) => cmd.name() === 'list');
      expect(listCmd).toBeDefined();
      expect(listCmd?.description()).toBe('List all backups');
    });

    it('should have restore subcommand', () => {
      const subcommands = command.commands;
      const restoreCmd = subcommands.find((cmd) => cmd.name() === 'restore');
      expect(restoreCmd).toBeDefined();
      expect(restoreCmd?.description()).toBe('Restore a backup');
    });

    it('should have cleanup subcommand', () => {
      const subcommands = command.commands;
      const cleanupCmd = subcommands.find((cmd) => cmd.name() === 'cleanup');
      expect(cleanupCmd).toBeDefined();
      expect(cleanupCmd?.description()).toContain('Remove old backups');
    });
  });
});
