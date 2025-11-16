/**
 * Tests for sync command
 *
 * Tests CLI flag mapping to sync engine options.
 */

import { Command } from 'commander';
import { createSyncCommand } from './sync';
import * as syncEngine from '../../core/sync-engine';
import { Logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../core/sync-engine');
jest.mock('../../utils/logger');

describe('sync command', () => {
  let command: Command;
  let mockSyncClients: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock syncClients function
    mockSyncClients = jest.spyOn(syncEngine, 'syncClients').mockResolvedValue({
      success: true,
      results: [],
      warnings: [],
      errors: [],
    });

    // Create command
    command = createSyncCommand();
  });

  describe('--skip-plugins flag', () => {
    it('should pass skipPlugins: true when --skip-plugins specified', async () => {
      await command.parseAsync(['node', 'sync', '--skip-plugins']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          skipPlugins: true,
        })
      );
    });

    it('should pass skipPlugins: false by default', async () => {
      await command.parseAsync(['node', 'sync']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          skipPlugins: false,
        })
      );
    });

    it('should work with --dry-run flag', async () => {
      await command.parseAsync(['node', 'sync', '--skip-plugins', '--dry-run']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          skipPlugins: true,
          dryRun: true,
        })
      );
    });

    it('should work with --client flag', async () => {
      await command.parseAsync(['node', 'sync', '--skip-plugins', '--client', 'claude-code']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          skipPlugins: true,
          clients: ['claude-code'],
        })
      );
    });

    it('should work with --force flag', async () => {
      await command.parseAsync(['node', 'sync', '--skip-plugins', '--force']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          skipPlugins: true,
          force: true,
        })
      );
    });
  });

  describe('--skip-undetected flag', () => {
    it('should pass skipUndetected: true by default', async () => {
      await command.parseAsync(['node', 'sync']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          skipUndetected: true,
        })
      );
    });

    it('should pass skipUndetected: false when --no-skip-undetected specified', async () => {
      await command.parseAsync(['node', 'sync', '--no-skip-undetected']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          skipUndetected: false,
        })
      );
    });

    it('should work with --dry-run flag', async () => {
      await command.parseAsync(['node', 'sync', '--no-skip-undetected', '--dry-run']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          skipUndetected: false,
          dryRun: true,
        })
      );
    });

    it('should work with --client flag', async () => {
      await command.parseAsync(['node', 'sync', '--no-skip-undetected', '--client', 'claude-code']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          skipUndetected: false,
          clients: ['claude-code'],
        })
      );
    });

    it('should work with --skip-plugins flag', async () => {
      await command.parseAsync(['node', 'sync', '--no-skip-undetected', '--skip-plugins']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          skipUndetected: false,
          skipPlugins: true,
        })
      );
    });
  });

  describe('other flags', () => {
    it('should pass dryRun when --dry-run specified', async () => {
      await command.parseAsync(['node', 'sync', '--dry-run']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: true,
        })
      );
    });

    it('should pass force when --force specified', async () => {
      await command.parseAsync(['node', 'sync', '--force']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          force: true,
        })
      );
    });

    it('should pass clients when --client specified', async () => {
      await command.parseAsync(['node', 'sync', '--client', 'claude-desktop']);

      expect(mockSyncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          clients: ['claude-desktop'],
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle sync errors', async () => {
      mockSyncClients.mockResolvedValue({
        success: false,
        results: [],
        warnings: [],
        errors: ['Sync failed'],
      });

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(command.parseAsync(['node', 'sync'])).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe('output formatting', () => {
    it('should display detected clients in detection phase', async () => {
      mockSyncClients.mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/path/to/config',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/path/to/config',
              warnings: [],
            },
            warnings: [],
          },
        ],
        warnings: [],
        errors: [],
      });

      const mockInfo = jest.spyOn(Logger, 'info');
      const mockSuccess = jest.spyOn(Logger, 'success');

      await command.parseAsync(['node', 'sync']);

      // Should show detection phase
      expect(mockSuccess).toHaveBeenCalledWith(
        expect.stringContaining('claude-code')
      );
    });

    it('should display skipped clients in detection phase', async () => {
      mockSyncClients.mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-desktop',
            success: true,
            configPath: '',
            binaryDetection: {
              status: 'not-found',
              warnings: [],
            },
            warnings: [],
            error: 'Skipped - client not detected on system',
          },
        ],
        warnings: [],
        errors: [],
      });

      const mockSkip = jest.spyOn(Logger, 'skip');

      await command.parseAsync(['node', 'sync']);

      // Should show skipped client
      expect(mockSkip).toHaveBeenCalledWith(
        expect.stringContaining('claude-desktop')
      );
    });

    it('should only show critical warnings', async () => {
      mockSyncClients.mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/path/to/config',
            binaryDetection: {
              status: 'found',
              warnings: [],
            },
            warnings: [
              'claude-code detected: 1.0.0',  // Informational - should be filtered
              'Invalid configuration error',   // Critical - should be shown
            ],
          },
        ],
        warnings: [],
        errors: [],
      });

      const mockWarn = jest.spyOn(Logger, 'warn');

      await command.parseAsync(['node', 'sync']);

      // Should only show critical warning
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid configuration error')
      );
      expect(mockWarn).not.toHaveBeenCalledWith(
        expect.stringContaining('detected: 1.0.0')
      );
    });

    it('should separate detection and sync phases', async () => {
      mockSyncClients.mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/path/to/config',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              warnings: [],
            },
            warnings: [],
          },
        ],
        warnings: [],
        errors: [],
      });

      const mockSection = jest.spyOn(Logger, 'section');

      await command.parseAsync(['node', 'sync']);

      // Should show both phases
      expect(mockSection).toHaveBeenCalledWith(
        expect.stringContaining('Detecting clients')
      );
      expect(mockSection).toHaveBeenCalledWith(
        expect.stringContaining('Syncing configurations')
      );
    });

    it('should not show sync phase if no clients detected', async () => {
      mockSyncClients.mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '',
            binaryDetection: {
              status: 'not-found',
              warnings: [],
            },
            warnings: [],
            error: 'Skipped - client not detected on system',
          },
        ],
        warnings: [],
        errors: [],
      });

      const mockSection = jest.spyOn(Logger, 'section');

      await command.parseAsync(['node', 'sync']);

      // Should show detection phase but not sync phase
      expect(mockSection).toHaveBeenCalledWith(
        expect.stringContaining('Detecting clients')
      );
      expect(mockSection).not.toHaveBeenCalledWith(
        expect.stringContaining('Syncing configurations')
      );
    });
  });

  describe('command metadata', () => {
    it('should have correct command name', () => {
      expect(command.name()).toBe('sync');
    });

    it('should have a description', () => {
      expect(command.description()).toBeTruthy();
    });

    it('should support --skip-plugins option', () => {
      const skipPluginsOption = command.options.find((opt) =>
        opt.flags.includes('--skip-plugins')
      );
      expect(skipPluginsOption).toBeDefined();
    });

    it('should support --no-skip-undetected option', () => {
      const skipUndetectedOption = command.options.find((opt) =>
        opt.flags.includes('--no-skip-undetected')
      );
      expect(skipUndetectedOption).toBeDefined();
    });

    it('should support --dry-run option', () => {
      const dryRunOption = command.options.find((opt) => opt.flags.includes('--dry-run'));
      expect(dryRunOption).toBeDefined();
    });

    it('should support --client option', () => {
      const clientOption = command.options.find((opt) => opt.flags.includes('--client'));
      expect(clientOption).toBeDefined();
    });

    it('should support --force option', () => {
      const forceOption = command.options.find((opt) => opt.flags.includes('--force'));
      expect(forceOption).toBeDefined();
    });
  });
});
