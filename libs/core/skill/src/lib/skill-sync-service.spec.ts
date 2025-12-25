/**
 * Tests for Skill Sync Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillSyncService } from './skill-sync-service.js';
import { SkillDiscovery } from './skill-discovery.js';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import type { OutputPort } from '@overture/ports-output';
import type { DiscoveredSkill } from '@overture/config-types';

describe('SkillSyncService', () => {
  let mockFilesystem: FilesystemPort;
  let mockEnvironment: EnvironmentPort;
  let mockOutput: OutputPort;
  let mockDiscovery: SkillDiscovery;
  let syncService: SkillSyncService;

  const mockSkills: DiscoveredSkill[] = [
    {
      name: 'debugging',
      path: '/home/user/.config/overture/skills/debugging/SKILL.md',
      description: 'Advanced debugging techniques',
    },
    {
      name: 'code-review',
      path: '/home/user/.config/overture/skills/code-review/SKILL.md',
      description: 'Code review best practices',
    },
  ];

  beforeEach(() => {
    mockFilesystem = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exists: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      rm: vi.fn(),
    };

    mockEnvironment = {
      platform: vi.fn().mockReturnValue('linux'),
      homedir: vi.fn().mockReturnValue('/home/user'),
      env: {},
    };

    mockOutput = {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockDiscovery = new SkillDiscovery(mockFilesystem, mockEnvironment);

    syncService = new SkillSyncService(
      mockFilesystem,
      mockEnvironment,
      mockDiscovery,
      mockOutput,
    );
  });

  describe('syncSkills()', () => {
    it('should sync multiple skills to multiple clients', async () => {
      // Mock discovery
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue(mockSkills);

      // Mock filesystem operations
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false); // Skills don't exist yet
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill content');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const summary = await syncService.syncSkills();

      expect(summary.total).toBe(2); // 2 skills
      expect(summary.synced).toBe(6); // 2 skills × 3 clients = 6
      expect(summary.skipped).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.results).toHaveLength(6);

      // Verify mkdir was called for each client/skill combo
      expect(mockFilesystem.mkdir).toHaveBeenCalledTimes(6);

      // Verify writeFile was called for each client/skill combo
      expect(mockFilesystem.writeFile).toHaveBeenCalledTimes(6);
    });

    it('should skip existing skills by default', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      // Mock that skills already exist
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const summary = await syncService.syncSkills();

      expect(summary.total).toBe(1);
      expect(summary.synced).toBe(0);
      expect(summary.skipped).toBe(3); // Skipped for all 3 clients
      expect(summary.failed).toBe(0);

      // Should not have written any files
      expect(mockFilesystem.writeFile).not.toHaveBeenCalled();
    });

    it('should overwrite existing skills with --force', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill content');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const summary = await syncService.syncSkills({ force: true });

      expect(summary.total).toBe(1);
      expect(summary.synced).toBe(3); // Synced to all 3 clients
      expect(summary.skipped).toBe(0);
      expect(summary.failed).toBe(0);

      // Should have written files
      expect(mockFilesystem.writeFile).toHaveBeenCalledTimes(3);
    });

    it('should create target directories if they do not exist', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill content');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      await syncService.syncSkills();

      // Verify mkdir was called with recursive option
      expect(mockFilesystem.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.claude/skills/debugging'),
        { recursive: true },
      );
      expect(mockFilesystem.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.github/skills/debugging'),
        { recursive: true },
      );
      expect(mockFilesystem.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.opencode/skill/debugging'),
        { recursive: true },
      );
    });

    it('should handle missing source skill gracefully', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockRejectedValue(
        new Error('File not found'),
      );
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const summary = await syncService.syncSkills();

      expect(summary.total).toBe(1);
      expect(summary.synced).toBe(0);
      expect(summary.skipped).toBe(0);
      expect(summary.failed).toBe(3); // Failed for all 3 clients

      // Check that errors are captured
      for (const result of summary.results) {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should return empty summary when no skills directory', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([]);

      const summary = await syncService.syncSkills();

      expect(summary.total).toBe(0);
      expect(summary.synced).toBe(0);
      expect(summary.skipped).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.results).toEqual([]);
    });

    it('should sync only to specified clients', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill content');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const summary = await syncService.syncSkills({
        clients: ['claude-code'],
      });

      expect(summary.total).toBe(1);
      expect(summary.synced).toBe(1); // Only Claude Code
      expect(summary.results).toHaveLength(1);
      expect(summary.results[0].client).toBe('claude-code');
    });

    it('should perform dry run without writing files', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const summary = await syncService.syncSkills({ dryRun: true });

      expect(summary.total).toBe(1);
      expect(summary.synced).toBe(3);

      // Should not have written any files
      expect(mockFilesystem.writeFile).not.toHaveBeenCalled();
      expect(mockFilesystem.mkdir).not.toHaveBeenCalled();

      // Should have logged dry run messages
      expect(mockOutput.info).toHaveBeenCalledWith(
        expect.stringContaining('[DRY RUN]'),
      );
    });

    it('should log dry run message for overwrite scenario', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const summary = await syncService.syncSkills({
        dryRun: true,
        force: true,
      });

      expect(summary.total).toBe(1);
      expect(summary.synced).toBe(3);

      // Should have logged dry run overwrite messages
      expect(mockOutput.info).toHaveBeenCalledWith(
        expect.stringContaining('[DRY RUN] Would overwrite:'),
      );
    });
  });

  describe('syncSkill()', () => {
    it('should sync single skill to all clients', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill content');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const results = await syncService.syncSkill(mockSkills[0]);

      expect(results).toHaveLength(3);
      expect(results[0].client).toBe('claude-code');
      expect(results[1].client).toBe('copilot-cli');
      expect(results[2].client).toBe('opencode');

      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.skill).toBe('debugging');
      }
    });

    it('should sync to specific clients only', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill content');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const results = await syncService.syncSkill(mockSkills[0], {
        clients: ['copilot-cli', 'opencode'],
      });

      expect(results).toHaveLength(2);
      expect(results[0].client).toBe('copilot-cli');
      expect(results[1].client).toBe('opencode');
    });
  });

  describe('target paths', () => {
    it('should use correct paths for claude-code', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const summary = await syncService.syncSkills({
        clients: ['claude-code'],
      });

      const result = summary.results[0];
      expect(result.targetPath).toBe(
        '/home/user/.claude/skills/debugging/SKILL.md',
      );

      // Verify mkdir was called with correct directory
      expect(mockFilesystem.mkdir).toHaveBeenCalledWith(
        '/home/user/.claude/skills/debugging',
        { recursive: true },
      );
    });

    it('should use correct paths for copilot-cli', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const summary = await syncService.syncSkills({
        clients: ['copilot-cli'],
      });

      const result = summary.results[0];
      expect(result.targetPath).toBe(
        '/home/user/.github/skills/debugging/SKILL.md',
      );
    });

    it('should use correct paths for opencode (singular skill/)', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const summary = await syncService.syncSkills({
        clients: ['opencode'],
      });

      const result = summary.results[0];
      expect(result.targetPath).toBe(
        '/home/user/.opencode/skill/debugging/SKILL.md',
      );
    });
  });

  describe('error handling', () => {
    it('should capture error message when mkdir fails', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.mkdir).mockRejectedValue(
        new Error('Permission denied'),
      );

      const summary = await syncService.syncSkills();

      expect(summary.failed).toBe(3);

      for (const result of summary.results) {
        expect(result.success).toBe(false);
        expect(result.error).toContain('Permission denied');
      }
    });

    it('should capture error message when writeFile fails', async () => {
      vi.spyOn(mockDiscovery, 'discoverSkills').mockResolvedValue([
        mockSkills[0],
      ]);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill');
      vi.mocked(mockFilesystem.writeFile).mockRejectedValue(
        new Error('Disk full'),
      );

      const summary = await syncService.syncSkills();

      expect(summary.failed).toBe(3);

      for (const result of summary.results) {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });
});
