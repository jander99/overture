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
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.claude.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.claude.json',
            },
            warnings: [],
          },
        ],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.syncEngine.syncClients).toHaveBeenCalledWith({
        clients: undefined,
        dryRun: false,
        force: false,
        skipPlugins: false,
        skipUndetected: true,
        detail: false,
      });
      expect(deps.output.success).toHaveBeenCalledWith('Sync complete!');
      // Note: Commander may call process.exit during error handling, but the test should still pass
    });

    it('should sync specific client when --client is provided', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
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
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--client', 'claude-desktop']);

      expect(deps.syncEngine.syncClients).toHaveBeenCalledWith({
        clients: ['claude-desktop'],
        dryRun: false,
        force: false,
        skipPlugins: false,
        skipUndetected: true,
        detail: false,
      });
      expect(deps.output.info).toHaveBeenCalledWith('Syncing for client: claude-desktop');
    });

    it('should enable dry-run mode when --dry-run is provided', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--dry-run']);

      expect(deps.syncEngine.syncClients).toHaveBeenCalledWith({
        clients: undefined,
        dryRun: true,
        force: false,
        skipPlugins: false,
        skipUndetected: true,
        detail: false,
      });
      expect(deps.output.info).toHaveBeenCalledWith('Running in dry-run mode - no changes will be made');
    });

    it('should enable force mode when --force is provided', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--force']);

      expect(deps.syncEngine.syncClients).toHaveBeenCalledWith({
        clients: undefined,
        dryRun: false,
        force: true,
        skipPlugins: false,
        skipUndetected: true,
        detail: false,
      });
    });

    it('should skip plugins when --skip-plugins is provided', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--skip-plugins']);

      expect(deps.syncEngine.syncClients).toHaveBeenCalledWith({
        clients: undefined,
        dryRun: false,
        force: false,
        skipPlugins: true,
        skipUndetected: true,
        detail: false,
      });
    });

    it('should sync undetected clients when --no-skip-undetected is provided', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--no-skip-undetected']);

      expect(deps.syncEngine.syncClients).toHaveBeenCalledWith({
        clients: undefined,
        dryRun: false,
        force: false,
        skipPlugins: false,
        skipUndetected: false,
        detail: false,
      });
    });

    it('should combine multiple options correctly', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [],
        warnings: [],
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

      expect(deps.syncEngine.syncClients).toHaveBeenCalledWith({
        clients: ['claude-code'],
        dryRun: true,
        force: true,
        skipPlugins: true,
        skipUndetected: true,
        detail: false,
      });
    });
  });

  describe('output handling', () => {
    it('should display detection summary for detected clients', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.claude.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.claude.json',
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
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.section).toHaveBeenCalledWith('🔍 Detecting clients...');
      expect(deps.output.success).toHaveBeenCalledWith(
        'claude-code (v1.0.0) → /home/user/.claude.json'
      );
      expect(deps.output.success).toHaveBeenCalledWith(
        'claude-desktop (v2.0.0) → /home/user/.config/Claude/mcp.json'
      );
    });

    it('should display detection summary for skipped clients', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
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
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.skip).toHaveBeenCalledWith('cursor - not detected, skipped');
    });

    it('should display warning for undetected but synced clients', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
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
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.warn).toHaveBeenCalledWith(
        'windsurf - not detected but config will be generated → /home/user/.config/windsurf/mcp.json'
      );
    });

    it('should display sync summary for synced clients', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.claude.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.claude.json',
            },
            warnings: [],
          },
        ],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.section).toHaveBeenCalledWith('⚙️  Syncing configurations...');
      expect(deps.output.success).toHaveBeenCalledWith('claude-code - synchronized');
    });

    it('should display error message for failed sync', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: false,
            error: 'Permission denied',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.claude.json',
            },
            warnings: [],
          },
        ],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      expect(deps.output.error).toHaveBeenCalledWith('claude-code - sync failed');
    });

    it('should display critical warnings only', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.claude.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.claude.json',
            },
            warnings: [
              'Invalid config found',
              'Python not detected on system', // Non-critical, should be filtered
              'Permission error accessing file', // Critical
            ],
          },
        ],
        warnings: [],
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
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.claude.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.claude.json',
            },
            warnings: ['💡 Tip: Run overture doctor for more details'],
          },
        ],
        warnings: [],
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
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: false,
        results: [],
        warnings: [],
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
      vi.mocked(deps.syncEngine.syncClients).mockRejectedValue(new Error('Sync engine failure'));

      const command = createSyncCommand(deps);
      await expect(command.parseAsync(['node', 'sync'])).rejects.toThrow('process.exit:1');

      expect(deps.output.error).toHaveBeenCalledWith('Sync failed: Sync engine failure');
    });

    it('should handle unknown errors', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockRejectedValue('Unknown error');

      const command = createSyncCommand(deps);
      await expect(command.parseAsync(['node', 'sync'])).rejects.toThrow('process.exit:1');

      expect(deps.output.error).toHaveBeenCalledWith('Sync failed with unknown error');
    });

    it('should display stack trace in debug mode', async () => {
      process.env.DEBUG = '1';
      const error = new Error('Test error');
      error.stack = 'Stack trace here';
      vi.mocked(deps.syncEngine.syncClients).mockRejectedValue(error);

      const command = createSyncCommand(deps);
      await expect(command.parseAsync(['node', 'sync'])).rejects.toThrow('process.exit:1');

      expect(deps.output.debug).toHaveBeenCalledWith('Stack trace here');

      delete process.env.DEBUG;
    });

    it('should exit with code 1 when sync fails', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: false,
        results: [],
        warnings: [],
        errors: ['Sync failed'],
      });

      const command = createSyncCommand(deps);
      await expect(command.parseAsync(['node', 'sync'])).rejects.toThrow('process.exit:1');

      expect(deps.output.error).toHaveBeenCalledWith('Sync completed with errors');
    });

    it('should exit with code 0 when sync succeeds', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [],
        warnings: [],
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
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [],
        warnings: [],
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
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.claude.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.claude.json',
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
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--no-skip-undetected']);

      // Detected and synced
      expect(deps.output.success).toHaveBeenCalledWith(
        'claude-code (v1.0.0) → /home/user/.claude.json'
      );
      // Not detected but synced
      expect(deps.output.warn).toHaveBeenCalledWith(
        'windsurf - not detected but config will be generated → /home/user/.config/windsurf/mcp.json'
      );
      // Skipped
      expect(deps.output.skip).toHaveBeenCalledWith('cursor - not detected, skipped');
    });

    it('should handle clients without version information', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.claude.json',
            binaryDetection: {
              status: 'found',
              configPath: '/home/user/.claude.json',
              // No version
            },
            warnings: [],
          },
        ],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync']);

      // Should display without version
      expect(deps.output.success).toHaveBeenCalledWith(
        'claude-code → /home/user/.claude.json'
      );
    });

    it('should deduplicate tips', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.claude.json',
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.claude.json',
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
        warnings: [],
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

  describe('detail mode', () => {
    it('should pass detail option when --detail flag is provided', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [],
        warnings: [],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--detail']);

      expect(deps.syncEngine.syncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: true,
        })
      );
    });

    it('should show plugin sync details when detail mode is enabled', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [],
        warnings: [],
        warnings: [],
        errors: [],
        pluginSyncDetails: {
          configured: 3,
          installed: 1,
          toInstall: [
            { name: 'plugin-a', marketplace: 'marketplace-1' },
            { name: 'plugin-b', marketplace: 'marketplace-2' },
          ],
        },
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--detail']);

      expect(deps.output.section).toHaveBeenCalledWith('📦 Plugin Sync Plan:');
      expect(deps.output.info).toHaveBeenCalledWith('  Configured: 3 plugins');
      expect(deps.output.info).toHaveBeenCalledWith('  Already installed: 1');
      expect(deps.output.info).toHaveBeenCalledWith('  To install: 2');
      expect(deps.output.info).toHaveBeenCalledWith('    - plugin-a@marketplace-1');
      expect(deps.output.info).toHaveBeenCalledWith('    - plugin-b@marketplace-2');
    });

    it('should show all informational warnings in detail mode', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.claude.json',
            warnings: [
              'claude-code detected: 1.0.0',
              'Invalid configuration detected',
            ],
          },
        ],
        warnings: [],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--detail']);

      expect(deps.output.warn).toHaveBeenCalledWith('Critical:');
      expect(deps.output.warn).toHaveBeenCalledWith('  - claude-code: Invalid configuration detected');
      expect(deps.output.info).toHaveBeenCalledWith('Informational:');
      expect(deps.output.info).toHaveBeenCalledWith('  - claude-code: claude-code detected: 1.0.0');
    });

    it('should show backup paths in detail mode', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [
          {
            client: 'claude-code',
            success: true,
            configPath: '/home/user/.claude.json',
            backupPath: '/home/user/.config/overture/backups/claude-code-2024-01-01.json',
            warnings: [],
          },
          {
            client: 'claude-desktop',
            success: true,
            configPath: '/home/user/.config/Claude/mcp.json',
            backupPath: '/home/user/.config/overture/backups/claude-desktop-2024-01-01.json',
            warnings: [],
          },
        ],
        warnings: [],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--detail']);

      expect(deps.output.section).toHaveBeenCalledWith('💾 Backups:');
      expect(deps.output.info).toHaveBeenCalledWith('  claude-code: /home/user/.config/overture/backups/claude-code-2024-01-01.json');
      expect(deps.output.info).toHaveBeenCalledWith('  claude-desktop: /home/user/.config/overture/backups/claude-desktop-2024-01-01.json');
    });

    it('should work with --dry-run and --detail together', async () => {
      vi.mocked(deps.syncEngine.syncClients).mockResolvedValue({
        success: true,
        results: [],
        warnings: [],
        warnings: [],
        errors: [],
      });

      const command = createSyncCommand(deps);
      await command.parseAsync(['node', 'sync', '--dry-run', '--detail']);

      expect(deps.syncEngine.syncClients).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: true,
          detail: true,
        })
      );
      expect(deps.output.info).toHaveBeenCalledWith('Running in dry-run mode - no changes will be made');
    });
  });
});
