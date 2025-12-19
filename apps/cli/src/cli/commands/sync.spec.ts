/**
 * Sync Command Tests
 *
 * Comprehensive tests for the `overture sync` command.
 * Tests command options, output handling, error cases, and edge cases.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createSyncCommand } from './sync';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock';
import type { AppDependencies } from '../../composition-root';

describe('sync command', () => {
  let deps: AppDependencies;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    deps = createMockAppDependencies();
    // Mock process.exit to throw an error for test assertions
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    // Clear console.error to avoid Commander error output during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  describe('basic functionality', () => {
    it('should sync all clients by default', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.config/claude/mcp.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.config/claude/mcp.json',
            },
            warnings: [],
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.syncEngine.sync).toHaveBeenCalledWith({
        clients: undefined,
        dryRun: false,
        force: false,
        skipPlugins: false,
        skipUndetected: true,
      });
      expect(deps.output.success).toHaveBeenCalledWith('Sync complete!');
      // Note: Commander may call process.exit during error handling, but the test should still pass
    });

    it('should sync specific client when --client is provided', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-desktop',
            success: true,
            configPath: '/home/user/.config/Claude/mcp.json',
            binaryDetection: {
              status: 'found',
              version: '2.0.0',
              configPath: '/home/user/.config/Claude/mcp.json',
            },
            warnings: [],
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--client', 'claude-desktop']);

      expect(deps.syncEngine.sync).toHaveBeenCalledWith({
        clients: ['claude-desktop'],
        dryRun: false,
        force: false,
        skipPlugins: false,
        skipUndetected: true,
      });
      expect(deps.output.info).toHaveBeenCalledWith('Syncing for client: claude-desktop');
    });

    it('should enable dry-run mode when --dry-run is provided', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--dry-run']);

      expect(deps.syncEngine.sync).toHaveBeenCalledWith({
        clients: undefined,
        dryRun: true,
        force: false,
        skipPlugins: false,
        skipUndetected: true,
      });
      expect(deps.output.info).toHaveBeenCalledWith('Running in dry-run mode - no changes will be made');
    });

    it('should enable force mode when --force is provided', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--force']);

      expect(deps.syncEngine.sync).toHaveBeenCalledWith({
        clients: undefined,
        dryRun: false,
        force: true,
        skipPlugins: false,
        skipUndetected: true,
      });
    });

    it('should skip plugins when --skip-plugins is provided', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--skip-plugins']);

      expect(deps.syncEngine.sync).toHaveBeenCalledWith({
        clients: undefined,
        dryRun: false,
        force: false,
        skipPlugins: true,
        skipUndetected: true,
      });
    });

    it('should sync undetected clients when --no-skip-undetected is provided', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--no-skip-undetected']);

      expect(deps.syncEngine.sync).toHaveBeenCalledWith({
        clients: undefined,
        dryRun: false,
        force: false,
        skipPlugins: false,
        skipUndetected: false,
      });
    });

    it('should combine multiple options correctly', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync([
        'node',
        'sync',
        '--client',
        'claude-code',
        '--dry-run',
        '--force',
        '--skip-plugins',
      ]);

      expect(deps.syncEngine.sync).toHaveBeenCalledWith({
        clients: ['claude-code'],
        dryRun: true,
        force: true,
        skipPlugins: true,
        skipUndetected: true,
      });
    });
  });

  describe('output handling', () => {
    it('should display detection summary for detected clients', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.config/claude/mcp.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.config/claude/mcp.json',
            },
            warnings: [],
          },
          {
            client: 'claude-desktop',
            success: true,
            configPath: '/home/user/.config/Claude/mcp.json',
            binaryDetection: {
              status: 'found',
              version: '2.0.0',
              configPath: '/home/user/.config/Claude/mcp.json',
            },
            warnings: [],
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.section).toHaveBeenCalledWith('🔍 Detecting clients...');
      expect(deps.output.success).toHaveBeenCalledWith(
        'claude-code (v1.0.0) → /home/user/.config/claude/mcp.json'
      );
      expect(deps.output.success).toHaveBeenCalledWith(
        'claude-desktop (v2.0.0) → /home/user/.config/Claude/mcp.json'
      );
    });

    it('should display detection summary for skipped clients', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'cursor',
            success: false,
            error: 'Skipped - client not detected on system',
            binaryDetection: {
              status: 'not-found',
            },
            warnings: [],
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.skip).toHaveBeenCalledWith('cursor - not detected, skipped');
    });

    it('should display warning for undetected but synced clients', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'windsurf',
            success: true,
            configPath: '/home/user/.config/windsurf/mcp.json',
            binaryDetection: {
              status: 'not-found',
            },
            warnings: [],
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.warn).toHaveBeenCalledWith(
        'windsurf - not detected but config will be generated → /home/user/.config/windsurf/mcp.json'
      );
    });

    it('should display sync summary for synced clients', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.config/claude/mcp.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.config/claude/mcp.json',
            },
            warnings: [],
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.section).toHaveBeenCalledWith('⚙️  Syncing configurations...');
      expect(deps.output.success).toHaveBeenCalledWith('claude-code - synchronized');
    });

    it('should display error message for failed sync', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: false,
            error: 'Permission denied',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.config/claude/mcp.json',
            },
            warnings: [],
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.error).toHaveBeenCalledWith('claude-code - sync failed');
    });

    it('should display critical warnings only', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.config/claude/mcp.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.config/claude/mcp.json',
            },
            warnings: [
              'Invalid config found',
              'Python not detected on system', // Non-critical, should be filtered
              'Permission error accessing file', // Critical
            ],
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.section).toHaveBeenCalledWith('⚠️  Warnings:');
      expect(deps.output.warn).toHaveBeenCalledWith('  - claude-code: Invalid config found');
      expect(deps.output.warn).toHaveBeenCalledWith('  - claude-code: Permission error accessing file');
      // Should NOT warn about "Python not detected" (informational)
      expect(deps.output.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Python not detected')
      );
    });

    it('should display tips separately from warnings', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.config/claude/mcp.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.config/claude/mcp.json',
            },
            warnings: ['💡 Tip: Run overture doctor for more details'],
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      // When there are no critical warnings, tips section is shown
      expect(deps.output.section).toHaveBeenCalledWith('💡 Tips:');
      expect(deps.output.info).toHaveBeenCalledWith(
        '  💡 Tip: Run overture doctor for more details'
      );
    });

    it('should display global errors', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: false,
        results: [],
        errors: ['Failed to load config', 'Missing required field'],
      });

      const command = createSyncCommand(deps);
      await expect(command.parseAsync(['node', 'sync'])).rejects.toThrow('process.exit:1');

      expect(deps.output.section).toHaveBeenCalledWith('❌ Errors:');
      expect(deps.output.error).toHaveBeenCalledWith('  - Failed to load config');
      expect(deps.output.error).toHaveBeenCalledWith('  - Missing required field');
    });
  });

  describe('error handling', () => {
    it('should handle sync engine errors gracefully', async () => {
      vi.mocked(deps.syncEngine.sync).mockRejectedValue(new Error('Sync engine failure'));

      const command = createSyncCommand(deps);
      await expect(command.parseAsync(['node', 'sync'])).rejects.toThrow('process.exit:1');

      expect(deps.output.error).toHaveBeenCalledWith('Sync failed: Sync engine failure');
    });

    it('should handle unknown errors', async () => {
      vi.mocked(deps.syncEngine.sync).mockRejectedValue('Unknown error');

      const command = createSyncCommand(deps);
      await expect(command.parseAsync(['node', 'sync'])).rejects.toThrow('process.exit:1');

      expect(deps.output.error).toHaveBeenCalledWith('Sync failed with unknown error');
    });

    it('should display stack trace in debug mode', async () => {
      process.env.DEBUG = '1';
      const error = new Error('Test error');
      error.stack = 'Stack trace here';
      vi.mocked(deps.syncEngine.sync).mockRejectedValue(error);

      const command = createSyncCommand(deps);
      await expect(command.parseAsync(['node', 'sync'])).rejects.toThrow('process.exit:1');

      expect(deps.output.debug).toHaveBeenCalledWith('Stack trace here');

      delete process.env.DEBUG;
    });

    it('should exit with code 1 when sync fails', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: false,
        results: [],
        errors: ['Sync failed'],
      });

      const command = createSyncCommand(deps);
      await expect(command.parseAsync(['node', 'sync'])).rejects.toThrow('process.exit:1');

      expect(deps.output.error).toHaveBeenCalledWith('Sync completed with errors');
    });

    it('should exit with code 0 when sync succeeds', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.success).toHaveBeenCalledWith('Sync complete!');
      // Note: Commander may call process.exit during error handling, but the test should still pass
    });
  });

  describe('edge cases', () => {
    it('should handle no detected clients', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.success).toHaveBeenCalledWith('Sync complete!');
      // Should not display sync summary section if no clients
      expect(deps.output.section).toHaveBeenCalledWith('🔍 Detecting clients...');
      expect(deps.output.section).not.toHaveBeenCalledWith('⚙️  Syncing configurations...');
    });

    it('should handle mixed detection results', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.config/claude/mcp.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.config/claude/mcp.json',
            },
            warnings: [],
          },
          {
            client: 'cursor',
            success: false,
            error: 'Skipped - client not detected on system',
            binaryDetection: {
              status: 'not-found',
            },
            warnings: [],
          },
          {
            client: 'windsurf',
            success: true,
            configPath: '/home/user/.config/windsurf/mcp.json',
            binaryDetection: {
              status: 'not-found',
            },
            warnings: [],
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--no-skip-undetected']);

      // Detected and synced
      expect(deps.output.success).toHaveBeenCalledWith(
        'claude-code (v1.0.0) → /home/user/.config/claude/mcp.json'
      );
      // Not detected but synced
      expect(deps.output.warn).toHaveBeenCalledWith(
        'windsurf - not detected but config will be generated → /home/user/.config/windsurf/mcp.json'
      );
      // Skipped
      expect(deps.output.skip).toHaveBeenCalledWith('cursor - not detected, skipped');
    });

    it('should handle clients without version information', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.config/claude/mcp.json',
            binaryDetection: {
              status: 'found',
              configPath: '/home/user/.config/claude/mcp.json',
              // No version
            },
            warnings: [],
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      // Should display without version
      expect(deps.output.success).toHaveBeenCalledWith(
        'claude-code → /home/user/.config/claude/mcp.json'
      );
    });

    it('should deduplicate tips', async () => {
      vi.mocked(deps.syncEngine.sync).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.config/claude/mcp.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.config/claude/mcp.json',
            },
            warnings: ['💡 Tip: Run overture doctor'],
          },
          {
            client: 'claude-desktop',
            success: true,
            configPath: '/home/user/.config/Claude/mcp.json',
            binaryDetection: {
              status: 'found',
              version: '2.0.0',
              configPath: '/home/user/.config/Claude/mcp.json',
            },
            warnings: ['💡 Tip: Run overture doctor'], // Same tip
          },
        ],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      // Tip should only be displayed once
      const tipCalls = vi
        .mocked(deps.output.info)
        .mock.calls.filter((call) => call[0].includes('💡 Tip:'));
      expect(tipCalls).toHaveLength(1);
    });
  });
});
