/**
 * Backup Command Tests
 *
 * Comprehensive tests for `overture backup` subcommands (list, restore, cleanup).
 * Tests command options, output handling, error cases, and edge cases.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createBackupCommand } from './backup';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock';
import {
  createMockBackupMetadata,
  createMockBackups,
} from '../../test-utils/test-fixtures';
import type { AppDependencies } from '../../composition-root';
import type { BackupMetadata } from '@overture/sync-core';
import { UserCancelledError } from '@overture/utils';

// Mock chalk to avoid ANSI codes in test assertions
vi.mock('chalk', () => {
  const identity = (s: string) => s;
  const bold = Object.assign(identity, {
    cyan: identity,
    red: identity,
    blue: identity,
  });
  return {
    default: {
      bold,
      gray: identity,
      dim: identity,
      cyan: identity,
      yellow: identity,
      red: identity,
      green: identity,
      blue: identity,
      white: identity,
      magenta: identity,
    },
  };
});

// Mock Prompts and ErrorHandler modules - ErrorHandler.handleCommandError calls process.exit
// which is mocked in beforeEach to throw an error for testing
vi.mock('@overture/utils', async () => {
  const actual = await vi.importActual('@overture/utils');
  return {
    ...actual,
    Prompts: {
      confirm: vi.fn(),
    },
    // Use actual ErrorHandler - it will call process.exit which is mocked in tests
  };
});

describe('backup command', () => {
  let deps: AppDependencies;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    deps = createMockAppDependencies();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should create backup command with subcommands', () => {
    const command = createBackupCommand(deps);
    expect(command.name()).toBe('backup');
    const subcommands = command.commands;
    const subcommandNames = subcommands.map((cmd) => cmd.name());
    expect(subcommandNames).toContain('list');
    expect(subcommandNames).toContain('restore');
    expect(subcommandNames).toContain('cleanup');
  });

  describe('backup list', () => {
    it('should list all backups grouped by client', async () => {
      const backups: BackupMetadata[] = [
        createMockBackupMetadata({ client: 'claude-code' }),
        createMockBackupMetadata({
          client: 'claude-desktop',
          timestamp: '2025-01-11T15-00-00-000Z',
          size: 2048,
        }),
      ];

      vi.mocked(deps.backupService.listBackups).mockResolvedValue(backups);

      const command = createBackupCommand(deps);
      await command.parseAsync(['node', 'backup', 'list']);

      expect(deps.backupService.listBackups).toHaveBeenCalledWith(undefined);
      expect(deps.output.info).toHaveBeenCalledWith('All backups:');
      expect(deps.output.info).toHaveBeenCalledWith('Total: 2 backup(s)');
      expect(consoleLogSpy).toHaveBeenCalledWith('claude-code:');
      expect(consoleLogSpy).toHaveBeenCalledWith('claude-desktop:');
    });

    it('should filter backups by client', async () => {
      const backups: BackupMetadata[] = [
        createMockBackupMetadata({ client: 'claude-code' }),
      ];

      vi.mocked(deps.backupService.listBackups).mockResolvedValue(backups);

      const command = createBackupCommand(deps);
      await command.parseAsync([
        'node',
        'backup',
        'list',
        '--client',
        'claude-code',
      ]);

      expect(deps.backupService.listBackups).toHaveBeenCalledWith(
        'claude-code',
      );
      expect(deps.output.info).toHaveBeenCalledWith('Backups for claude-code:');
    });

    it('should warn when no backups found', async () => {
      vi.mocked(deps.backupService.listBackups).mockResolvedValue([]);

      const command = createBackupCommand(deps);
      await command.parseAsync(['node', 'backup', 'list']);

      expect(deps.output.warn).toHaveBeenCalledWith('No backups found');
    });

    it('should warn when no backups found for specific client', async () => {
      vi.mocked(deps.backupService.listBackups).mockResolvedValue([]);

      const command = createBackupCommand(deps);
      await command.parseAsync([
        'node',
        'backup',
        'list',
        '--client',
        'claude-code',
      ]);

      expect(deps.output.warn).toHaveBeenCalledWith(
        'No backups found for client: claude-code',
      );
    });
  });

  describe('backup restore', () => {
    const mockBackup = createMockBackupMetadata({ client: 'claude-code' });

    it('should restore latest backup with --latest flag', async () => {
      // Setup adapter registry mock for this test
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        validateTransport: vi.fn(),
      } as any);

      vi.mocked(deps.backupService.getLatestBackup).mockResolvedValue(
        mockBackup,
      );
      vi.mocked(deps.restoreService.restoreLatest).mockResolvedValue({
        success: true,
        backupPath: mockBackup.path,
        restoredPath: '/home/user/.claude.json',
      });

      const command = createBackupCommand(deps);
      await command.parseAsync([
        'node',
        'backup',
        'restore',
        'claude-code',
        '--latest',
        '--no-confirm',
      ]);

      expect(deps.backupService.getLatestBackup).toHaveBeenCalledWith(
        'claude-code',
      );
      expect(deps.restoreService.restoreLatest).toHaveBeenCalled();
      expect(deps.output.success).toHaveBeenCalledWith(
        'Backup restored successfully',
      );
    });

    it('should restore specific backup by timestamp', async () => {
      // Setup adapter registry mock for this test
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        validateTransport: vi.fn(),
      } as any);

      vi.mocked(deps.backupService.listBackups).mockResolvedValue([mockBackup]);
      vi.mocked(deps.restoreService.restore).mockResolvedValue({
        success: true,
        backupPath: mockBackup.path,
        restoredPath: '/home/user/.claude.json',
      });

      const command = createBackupCommand(deps);
      await command.parseAsync([
        'node',
        'backup',
        'restore',
        'claude-code',
        '2025-01-11T14-30-45-123Z',
        '--no-confirm',
      ]);

      expect(deps.backupService.listBackups).toHaveBeenCalledWith(
        'claude-code',
      );
      expect(deps.restoreService.restore).toHaveBeenCalledWith(
        'claude-code',
        '2025-01-11T14-30-45-123Z',
        '/home/user/.claude.json',
      );
      expect(deps.output.success).toHaveBeenCalledWith(
        'Backup restored successfully',
      );
    });

    it('should display backup details before restore', async () => {
      // Setup adapter registry mock for this test
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        validateTransport: vi.fn(),
      } as any);

      vi.mocked(deps.backupService.getLatestBackup).mockResolvedValue(
        mockBackup,
      );
      vi.mocked(deps.restoreService.restoreLatest).mockResolvedValue({
        success: true,
        backupPath: mockBackup.path,
        restoredPath: '/home/user/.claude.json',
      });

      const command = createBackupCommand(deps);
      await command.parseAsync([
        'node',
        'backup',
        'restore',
        'claude-code',
        '--latest',
        '--no-confirm',
      ]);

      expect(deps.output.info).toHaveBeenCalledWith('Backup details:');
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('Client: claude-code'),
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('Size:'),
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('Age:'),
      );
    });

    it('should error on unknown client', async () => {
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(undefined);
      vi.mocked(deps.adapterRegistry.getAllNames).mockReturnValue([
        'claude-code',
        'copilot-cli',
      ]);

      const command = createBackupCommand(deps);
      await expect(
        command.parseAsync([
          'node',
          'backup',
          'restore',
          'unknown-client',
          '--latest',
          '--no-confirm',
        ]),
      ).rejects.toThrow('process.exit:2');

      expect(deps.output.error).toHaveBeenCalledWith(
        'Unknown client: unknown-client',
      );
      expect(deps.output.info).toHaveBeenCalledWith('Available clients:');
    });

    it('should error when no backups found for client', async () => {
      // Setup adapter registry mock for this test
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        validateTransport: vi.fn(),
      } as any);

      vi.mocked(deps.backupService.getLatestBackup).mockResolvedValue(null);

      const command = createBackupCommand(deps);
      await expect(
        command.parseAsync([
          'node',
          'backup',
          'restore',
          'claude-code',
          '--latest',
          '--no-confirm',
        ]),
      ).rejects.toThrow('process.exit:2');

      expect(deps.output.error).toHaveBeenCalledWith(
        'No backups found for claude-code',
      );
    });

    it('should error when specific backup not found', async () => {
      // Setup adapter registry mock for this test
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        validateTransport: vi.fn(),
      } as any);

      vi.mocked(deps.backupService.listBackups).mockResolvedValue([]);

      const command = createBackupCommand(deps);
      await expect(
        command.parseAsync([
          'node',
          'backup',
          'restore',
          'claude-code',
          '2025-01-11T14-30-45-123Z',
          '--no-confirm',
        ]),
      ).rejects.toThrow('process.exit:2');

      expect(deps.output.error).toHaveBeenCalledWith(
        'Backup not found: claude-code at 2025-01-11T14-30-45-123Z',
      );
    });

    it('should exit with code 1 on restore failure', async () => {
      // Setup adapter registry mock for this test
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        validateTransport: vi.fn(),
      } as any);

      vi.mocked(deps.backupService.getLatestBackup).mockResolvedValue(
        mockBackup,
      );
      vi.mocked(deps.restoreService.restoreLatest).mockResolvedValue({
        success: false,
        backupPath: mockBackup.path,
        restoredPath: '/home/user/.claude.json',
        error: 'Permission denied',
      });

      const command = createBackupCommand(deps);
      // ErrorHandler logs errors via Logger, not deps.output
      await expect(
        command.parseAsync([
          'node',
          'backup',
          'restore',
          'claude-code',
          '--latest',
          '--no-confirm',
        ]),
      ).rejects.toThrow('process.exit:1');
    });

    describe('edge cases - timestamp formats', () => {
      beforeEach(() => {
        vi.mocked(deps.adapterRegistry.get).mockReturnValue({
          name: 'claude-code',
          detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
          readConfig: vi.fn(),
          writeConfig: vi.fn(),
          validateTransport: vi.fn(),
        } as any);
      });

      it('should handle invalid timestamp format', async () => {
        // Arrange
        vi.mocked(deps.backupService.listBackups).mockResolvedValue([]);

        const command = createBackupCommand(deps);

        // Act - throws because backup with invalid timestamp won't be found
        await expect(
          command.parseAsync([
            'node',
            'backup',
            'restore',
            'claude-code',
            'invalid-timestamp',
            '--no-confirm',
          ]),
        ).rejects.toThrow('process.exit:2');

        // Assert
        expect(deps.output.error).toHaveBeenCalledWith(
          'Backup not found: claude-code at invalid-timestamp',
        );
      });

      it('should handle timestamp with timezone offset (non-Z format)', async () => {
        // Arrange - timestamp has +00:00 instead of Z
        const invalidBackup = createMockBackupMetadata({
          client: 'claude-code',
          timestamp: '2025-01-11T14:30:45.123+00:00',
        });

        vi.mocked(deps.backupService.listBackups).mockResolvedValue([
          invalidBackup,
        ]);
        vi.mocked(deps.restoreService.restore).mockResolvedValue({
          success: true,
          backupPath: invalidBackup.path,
          restoredPath: '/home/user/.claude.json',
        });

        const command = createBackupCommand(deps);

        // Act
        await command.parseAsync([
          'node',
          'backup',
          'restore',
          'claude-code',
          '2025-01-11T14:30:45.123+00:00',
          '--no-confirm',
        ]);

        // Assert
        expect(deps.restoreService.restore).toHaveBeenCalledWith(
          'claude-code',
          '2025-01-11T14:30:45.123+00:00',
          '/home/user/.claude.json',
        );
      });

      it('should handle timestamp before Unix epoch (1970-01-01)', async () => {
        // Arrange - backup from 1969
        const oldBackup = createMockBackupMetadata({
          client: 'claude-code',
          timestamp: '1969-12-31T23-59-59-999Z',
        });

        vi.mocked(deps.backupService.listBackups).mockResolvedValue([
          oldBackup,
        ]);
        vi.mocked(deps.restoreService.restore).mockResolvedValue({
          success: true,
          backupPath: oldBackup.path,
          restoredPath: '/home/user/.claude.json',
        });

        const command = createBackupCommand(deps);

        // Act
        await command.parseAsync([
          'node',
          'backup',
          'restore',
          'claude-code',
          '1969-12-31T23-59-59-999Z',
          '--no-confirm',
        ]);

        // Assert
        expect(deps.restoreService.restore).toHaveBeenCalledWith(
          'claude-code',
          '1969-12-31T23-59-59-999Z',
          '/home/user/.claude.json',
        );
        expect(deps.output.success).toHaveBeenCalledWith(
          'Backup restored successfully',
        );
      });
    });
  });

  describe('backup cleanup', () => {
    beforeEach(() => {
      vi.mocked(deps.adapterRegistry.getAllNames).mockReturnValue([
        'claude-code',
        'claude-desktop',
      ]);
    });

    it('should cleanup all clients by default', async () => {
      vi.mocked(deps.backupService.listBackups)
        .mockResolvedValueOnce([
          { client: 'claude-code', timestamp: '1', size: 100, path: '/path1' },
          { client: 'claude-code', timestamp: '2', size: 100, path: '/path2' },
        ])
        .mockResolvedValueOnce([
          { client: 'claude-code', timestamp: '2', size: 100, path: '/path2' },
        ])
        .mockResolvedValueOnce([
          {
            client: 'claude-desktop',
            timestamp: '1',
            size: 150,
            path: '/path3',
          },
          {
            client: 'claude-desktop',
            timestamp: '2',
            size: 150,
            path: '/path4',
          },
        ])
        .mockResolvedValueOnce([
          {
            client: 'claude-desktop',
            timestamp: '2',
            size: 150,
            path: '/path4',
          },
        ]);

      const command = createBackupCommand(deps);
      await command.parseAsync(['node', 'backup', 'cleanup']);

      expect(deps.backupService.cleanupOldBackups).toHaveBeenCalledWith(
        'claude-code',
        10,
      );
      expect(deps.backupService.cleanupOldBackups).toHaveBeenCalledWith(
        'claude-desktop',
        10,
      );
      expect(deps.output.success).toHaveBeenCalledWith(
        'Cleaned up 2 backup(s)',
      );
    });

    it('should cleanup specific client with --client flag', async () => {
      vi.mocked(deps.backupService.listBackups)
        .mockResolvedValueOnce([
          { client: 'claude-code', timestamp: '1', size: 100, path: '/path1' },
          { client: 'claude-code', timestamp: '2', size: 100, path: '/path2' },
        ])
        .mockResolvedValueOnce([
          { client: 'claude-code', timestamp: '2', size: 100, path: '/path2' },
        ]);

      const command = createBackupCommand(deps);
      await command.parseAsync([
        'node',
        'backup',
        'cleanup',
        '--client',
        'claude-code',
      ]);

      expect(deps.backupService.cleanupOldBackups).toHaveBeenCalledWith(
        'claude-code',
        10,
      );
      expect(deps.backupService.cleanupOldBackups).toHaveBeenCalledTimes(1);
    });

    it('should use custom keep count with --keep flag', async () => {
      vi.mocked(deps.backupService.listBackups)
        .mockResolvedValueOnce([
          { client: 'claude-code', timestamp: '1', size: 100, path: '/path1' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const command = createBackupCommand(deps);
      await command.parseAsync(['node', 'backup', 'cleanup', '--keep', '5']);

      expect(deps.backupService.cleanupOldBackups).toHaveBeenCalledWith(
        'claude-code',
        5,
      );
    });

    it('should error on invalid keep count', async () => {
      const command = createBackupCommand(deps);
      await expect(
        command.parseAsync(['node', 'backup', 'cleanup', '--keep', 'invalid']),
      ).rejects.toThrow('process.exit:2');

      expect(deps.output.error).toHaveBeenCalledWith(
        'Keep count must be a positive integer',
      );
    });

    it('should handle no backups to cleanup', async () => {
      vi.mocked(deps.backupService.listBackups).mockResolvedValue([]);

      const command = createBackupCommand(deps);
      await command.parseAsync(['node', 'backup', 'cleanup']);

      expect(deps.output.info).toHaveBeenCalledWith('No backups to clean up');
    });
  });
});
