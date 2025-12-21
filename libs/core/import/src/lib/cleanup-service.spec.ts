/**
 * Cleanup Service Tests
 *
 * @module @overture/import-core/cleanup-service.spec
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CleanupService } from './cleanup-service.js';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { OutputPort } from '@overture/ports-output';
import type { ClaudeCodeAdapter } from '@overture/client-adapters';
import type {
  Platform,
  OvertureConfig,
  ClaudeCodeFullConfig,
} from '@overture/config-types';

describe('CleanupService', () => {
  let service: CleanupService;
  let mockFilesystem: FilesystemPort;
  let mockOutput: OutputPort;
  let mockClaudeCodeAdapter: ClaudeCodeAdapter;

  const platform: Platform = 'linux';

  beforeEach(() => {
    mockFilesystem = {
      exists: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      mkdir: vi.fn(),
      stat: vi.fn(),
      copyFile: vi.fn(),
    } as unknown as FilesystemPort;

    mockOutput = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      debug: vi.fn(),
    } as unknown as OutputPort;

    mockClaudeCodeAdapter = {
      readFullConfig: vi.fn(),
      detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
      readConfig: vi.fn(),
      writeConfig: vi.fn(),
      cleanupDirectoryMcps: vi.fn(),
      writeFullConfig: vi.fn(),
    } as unknown as ClaudeCodeAdapter;

    service = new CleanupService(mockFilesystem, mockOutput);
  });

  describe('findCleanupTargets', () => {
    it('should find directories with Overture configs and managed MCPs', async () => {
      const fullConfig: ClaudeCodeFullConfig = {
        mcpServers: {},
        projects: {
          '/home/user/project1': {
            mcpServers: {
              'filesystem': {
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
              },
              'memory': {
                command: 'npx',
                args: ['-y', 'mcp-server-memory'],
              },
            },
          },
          '/home/user/project2': {
            mcpServers: {
              'unmanaged-mcp': {
                command: 'some-command',
                args: [],
              },
            },
          },
        },
      };

      const overtureConfig: OvertureConfig = {
        version: '1.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
          },
          memory: {
            command: 'npx',
            args: ['-y', 'mcp-server-memory'],
          },
        },
      };

      vi.mocked(mockClaudeCodeAdapter.readFullConfig).mockResolvedValue(fullConfig);
      vi.mocked(mockFilesystem.exists).mockImplementation(async (path) => {
        // Both projects have Overture configs
        return path.includes('.overture/config.yaml');
      });

      const targets = await service.findCleanupTargets(
        mockClaudeCodeAdapter,
        platform,
        overtureConfig,
      );

      expect(targets).toHaveLength(1); // Only project1 has managed MCPs
      expect(targets[0]).toMatchObject({
        directory: '/home/user/project1',
        hasOvertureConfig: true,
        mcpsToRemove: ['filesystem', 'memory'],
        mcpsToPreserve: [],
      });
    });

    it('should skip directories without Overture configs', async () => {
      const fullConfig: ClaudeCodeFullConfig = {
        projects: {
          '/home/user/project-no-overture': {
            mcpServers: {
              'filesystem': {
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
              },
            },
          },
        },
      };

      const overtureConfig: OvertureConfig = {
        version: '1.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
          },
        },
      };

      vi.mocked(mockClaudeCodeAdapter.readFullConfig).mockResolvedValue(fullConfig);
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false); // No Overture config

      const targets = await service.findCleanupTargets(
        mockClaudeCodeAdapter,
        platform,
        overtureConfig,
      );

      expect(targets).toHaveLength(0);
    });

    it('should identify MCPs to preserve (not in Overture)', async () => {
      const fullConfig: ClaudeCodeFullConfig = {
        projects: {
          '/home/user/mixed-project': {
            mcpServers: {
              'managed-mcp': {
                command: 'managed-command',
                args: [],
              },
              'unmanaged-mcp': {
                command: 'unmanaged-command',
                args: [],
              },
            },
          },
        },
      };

      const overtureConfig: OvertureConfig = {
        version: '1.0',
        mcp: {
          'managed-mcp': {
            command: 'managed-command',
            args: [],
          },
        },
      };

      vi.mocked(mockClaudeCodeAdapter.readFullConfig).mockResolvedValue(fullConfig);
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const targets = await service.findCleanupTargets(
        mockClaudeCodeAdapter,
        platform,
        overtureConfig,
      );

      expect(targets).toHaveLength(1);
      expect(targets[0]).toMatchObject({
        mcpsToRemove: ['managed-mcp'],
        mcpsToPreserve: ['unmanaged-mcp'],
      });
    });

    it('should skip directories with only unmanaged MCPs', async () => {
      const fullConfig: ClaudeCodeFullConfig = {
        projects: {
          '/home/user/unmanaged-only': {
            mcpServers: {
              'custom-mcp': {
                command: 'custom',
                args: [],
              },
            },
          },
        },
      };

      const overtureConfig: OvertureConfig = {
        version: '1.0',
        mcp: {
          'different-mcp': {
            command: 'different',
            args: [],
          },
        },
      };

      vi.mocked(mockClaudeCodeAdapter.readFullConfig).mockResolvedValue(fullConfig);
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const targets = await service.findCleanupTargets(
        mockClaudeCodeAdapter,
        platform,
        overtureConfig,
      );

      expect(targets).toHaveLength(0); // No managed MCPs to remove
    });

    it('should handle configs with no projects', async () => {
      const fullConfig: ClaudeCodeFullConfig = {
        mcpServers: {
          global: {
            command: 'global-command',
            args: [],
          },
        },
      };

      const overtureConfig: OvertureConfig = {
        version: '1.0',
        mcp: {},
      };

      vi.mocked(mockClaudeCodeAdapter.readFullConfig).mockResolvedValue(fullConfig);

      const targets = await service.findCleanupTargets(
        mockClaudeCodeAdapter,
        platform,
        overtureConfig,
      );

      expect(targets).toHaveLength(0);
    });
  });

  describe('executeCleanup', () => {
    it('should create backup and execute cleanup', async () => {
      const targets = [
        {
          directory: '/home/user/project1',
          hasOvertureConfig: true,
          filePath: '/home/user/.claude.json',
          mcpsToRemove: ['filesystem', 'memory'],
          mcpsToPreserve: [],
        },
      ];

      vi.mocked(mockFilesystem.readFile).mockResolvedValue('{"mock":"config"}');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockClaudeCodeAdapter.cleanupDirectoryMcps).mockResolvedValue();

      const result = await service.executeCleanup(
        mockClaudeCodeAdapter,
        platform,
        targets,
        false, // Not dry run
      );

      expect(result.directoriesCleaned).toEqual(['/home/user/project1']);
      expect(result.mcpsRemoved).toBe(2);
      expect(result.mcpsPreserved).toHaveLength(0);
      expect(result.backupPath).toMatch(/\.claude\.json\.backup-\d+/);

      // Verify backup was created
      expect(mockFilesystem.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.backup-\d+$/),
        '{"mock":"config"}',
      );

      // Verify cleanup was executed
      expect(mockClaudeCodeAdapter.cleanupDirectoryMcps).toHaveBeenCalledWith(
        platform,
        targets,
      );
    });

    it('should handle dry run without writing files', async () => {
      const targets = [
        {
          directory: '/home/user/project1',
          hasOvertureConfig: true,
          filePath: '/home/user/.claude.json',
          mcpsToRemove: ['filesystem'],
          mcpsToPreserve: [],
        },
      ];

      const result = await service.executeCleanup(
        mockClaudeCodeAdapter,
        platform,
        targets,
        true, // Dry run
      );

      expect(result.directoriesCleaned).toEqual(['/home/user/project1']);
      expect(result.mcpsRemoved).toBe(1);
      expect(result.backupPath).toBe('');

      // Verify no files were written
      expect(mockFilesystem.writeFile).not.toHaveBeenCalled();
      expect(mockClaudeCodeAdapter.cleanupDirectoryMcps).not.toHaveBeenCalled();
    });

    it('should warn about preserved MCPs', async () => {
      const targets = [
        {
          directory: '/home/user/project1',
          hasOvertureConfig: true,
          filePath: '/home/user/.claude.json',
          mcpsToRemove: ['managed'],
          mcpsToPreserve: ['unmanaged1', 'unmanaged2'],
        },
      ];

      vi.mocked(mockFilesystem.readFile).mockResolvedValue('{}');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();

      const result = await service.executeCleanup(
        mockClaudeCodeAdapter,
        platform,
        targets,
        false,
      );

      expect(result.mcpsPreserved).toHaveLength(2);
      expect(result.mcpsPreserved).toEqual([
        { directory: '/home/user/project1', mcpName: 'unmanaged1' },
        { directory: '/home/user/project1', mcpName: 'unmanaged2' },
      ]);

      expect(mockOutput.warn).toHaveBeenCalledWith(
        expect.stringContaining('Preserved 2 unmanaged MCP(s)'),
      );
    });

    it('should handle empty targets array', async () => {
      const result = await service.executeCleanup(
        mockClaudeCodeAdapter,
        platform,
        [],
        false,
      );

      expect(result).toEqual({
        directoriesCleaned: [],
        mcpsRemoved: 0,
        mcpsPreserved: [],
        backupPath: '',
      });

      expect(mockFilesystem.writeFile).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const targets = [
        {
          directory: '/home/user/project1',
          hasOvertureConfig: true,
          filePath: '/home/user/.claude.json',
          mcpsToRemove: ['filesystem'],
          mcpsToPreserve: [],
        },
      ];

      vi.mocked(mockFilesystem.readFile).mockRejectedValue(
        new Error('File not found'),
      );

      await expect(
        service.executeCleanup(mockClaudeCodeAdapter, platform, targets, false),
      ).rejects.toThrow('File not found');

      expect(mockOutput.error).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup failed'),
      );
    });
  });
});
