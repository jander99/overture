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
