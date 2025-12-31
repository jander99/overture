/**
 * Tests for Skill Copy Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillCopyService } from './skill-copy-service.js';
import { SkillDiscovery } from './skill-discovery.js';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import type { DiscoveredSkill } from '@overture/config-types';

describe('SkillCopyService', () => {
  let mockFilesystem: FilesystemPort;
  let mockEnvironment: EnvironmentPort;
  let mockDiscovery: SkillDiscovery;
  let copyService: SkillCopyService;

  const mockSkill: DiscoveredSkill = {
    name: 'debugging',
    path: '/home/user/.config/overture/skills/debugging/SKILL.md',
    directoryPath: '/home/user/.config/overture/skills/debugging',
    description: 'Advanced debugging techniques',
  };

  // Helper to set up mocks for recursive directory copy
  const setupDirectoryCopyMocks = () => {
    // Mock readdir to return just SKILL.md (simple skill with no subdirs)
    vi.mocked(mockFilesystem.readdir).mockResolvedValue(['SKILL.md']);

    // Mock stat to identify files vs directories
    vi.mocked(mockFilesystem.stat).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 100,
      mtime: new Date(),
    });

    vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill content');
    vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
    vi.mocked(mockFilesystem.mkdir).mockResolvedValue();
  };

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

    mockDiscovery = new SkillDiscovery(mockFilesystem, mockEnvironment);

    copyService = new SkillCopyService(
      mockFilesystem,
      mockEnvironment,
      mockDiscovery,
    );

    // Mock process.cwd() for project root
    vi.spyOn(process, 'cwd').mockReturnValue('/home/user/my-project');
  });

  describe('copySkillToProject()', () => {
    it('should copy skill to all three client directories in project', async () => {
      // Mock skill discovery
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      // Mock filesystem operations for directory copy
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      setupDirectoryCopyMocks();

      const results = await copyService.copySkillToProject('debugging');

      expect(results).toHaveLength(3);
      expect(results[0].client).toBe('claude-code');
      expect(results[1].client).toBe('copilot-cli');
      expect(results[2].client).toBe('opencode');

      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.skill).toBe('debugging');
      }

      // Verify mkdir called for each client
      expect(mockFilesystem.mkdir).toHaveBeenCalledTimes(3);

      // Verify writeFile called for each client (1 file per client)
      expect(mockFilesystem.writeFile).toHaveBeenCalledTimes(3);
    });

    it('should skip existing skills by default', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      // Mock that files already exist
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const results = await copyService.copySkillToProject('debugging');

      expect(results).toHaveLength(3);

      // All should be skipped
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
      }

      // Should not have written any files
      expect(mockFilesystem.writeFile).not.toHaveBeenCalled();
    });

    it('should overwrite existing skills with --force', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      setupDirectoryCopyMocks();

      const results = await copyService.copySkillToProject('debugging', {
        force: true,
      });

      expect(results).toHaveLength(3);

      // All should succeed without skipping
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.skipped).toBeUndefined();
      }

      // Should have written files (1 file per client)
      expect(mockFilesystem.writeFile).toHaveBeenCalledTimes(3);
    });

    it('should create nested directories as needed', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Debugging Skill');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      await copyService.copySkillToProject('debugging');

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

    it('should throw error if skill does not exist in config repo', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(null);

      await expect(
        copyService.copySkillToProject('nonexistent'),
      ).rejects.toThrow("Skill 'nonexistent' not found in config repo");
    });

    it('should copy only to specified client with --client flag', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Debugging Skill');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const results = await copyService.copySkillToProject('debugging', {
        clients: ['claude-code'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].client).toBe('claude-code');
    });

    it('should copy to multiple specified clients', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Debugging Skill');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const results = await copyService.copySkillToProject('debugging', {
        clients: ['claude-code', 'opencode'],
      });

      expect(results).toHaveLength(2);
      expect(results[0].client).toBe('claude-code');
      expect(results[1].client).toBe('opencode');
    });

    it('should use custom project root when provided', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      setupDirectoryCopyMocks();

      const customRoot = '/custom/project';

      await copyService.copySkillToProject('debugging', {
        projectRoot: customRoot,
        clients: ['claude-code'],
      });

      // Verify paths use custom root
      expect(mockFilesystem.mkdir).toHaveBeenCalledWith(
        `${customRoot}/.claude/skills/debugging`,
        { recursive: true },
      );

      expect(mockFilesystem.writeFile).toHaveBeenCalledWith(
        `${customRoot}/.claude/skills/debugging/SKILL.md`,
        expect.any(String),
      );
    });

    it('should use process.cwd() as default project root', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Debugging Skill');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      await copyService.copySkillToProject('debugging', {
        clients: ['claude-code'],
      });

      // Verify paths use cwd
      expect(mockFilesystem.mkdir).toHaveBeenCalledWith(
        '/home/user/my-project/.claude/skills/debugging',
        { recursive: true },
      );
    });
  });

  describe('skillExistsInProject()', () => {
    it('should return true if skill exists in project', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const exists = await copyService.skillExistsInProject(
        'debugging',
        'claude-code',
        '/home/user/my-project',
      );

      expect(exists).toBe(true);
      expect(mockFilesystem.exists).toHaveBeenCalledWith(
        '/home/user/my-project/.claude/skills/debugging/SKILL.md',
      );
    });

    it('should return false if skill does not exist in project', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const exists = await copyService.skillExistsInProject(
        'debugging',
        'claude-code',
        '/home/user/my-project',
      );

      expect(exists).toBe(false);
    });

    it('should check correct path for each client', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      await copyService.skillExistsInProject(
        'debugging',
        'copilot-cli',
        '/home/user/my-project',
      );

      expect(mockFilesystem.exists).toHaveBeenCalledWith(
        '/home/user/my-project/.github/skills/debugging/SKILL.md',
      );

      await copyService.skillExistsInProject(
        'debugging',
        'opencode',
        '/home/user/my-project',
      );

      expect(mockFilesystem.exists).toHaveBeenCalledWith(
        '/home/user/my-project/.opencode/skill/debugging/SKILL.md',
      );
    });
  });

  describe('target paths', () => {
    it('should use correct project paths for claude-code', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const results = await copyService.copySkillToProject('debugging', {
        clients: ['claude-code'],
      });

      expect(results[0].targetPath).toBe(
        '/home/user/my-project/.claude/skills/debugging/SKILL.md',
      );
    });

    it('should use correct project paths for copilot-cli', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const results = await copyService.copySkillToProject('debugging', {
        clients: ['copilot-cli'],
      });

      expect(results[0].targetPath).toBe(
        '/home/user/my-project/.github/skills/debugging/SKILL.md',
      );
    });

    it('should use correct project paths for opencode (singular skill/)', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill');
      vi.mocked(mockFilesystem.writeFile).mockResolvedValue();
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();

      const results = await copyService.copySkillToProject('debugging', {
        clients: ['opencode'],
      });

      expect(results[0].targetPath).toBe(
        '/home/user/my-project/.opencode/skill/debugging/SKILL.md',
      );
    });
  });

  describe('error handling', () => {
    it('should capture error when mkdir fails', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.mkdir).mockRejectedValue(
        new Error('Permission denied'),
      );

      const results = await copyService.copySkillToProject('debugging');

      expect(results).toHaveLength(3);

      for (const result of results) {
        expect(result.success).toBe(false);
        expect(result.error).toContain('Permission denied');
      }
    });

    it('should capture error when readFile fails', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();
      vi.mocked(mockFilesystem.readFile).mockRejectedValue(
        new Error('File not found'),
      );

      const results = await copyService.copySkillToProject('debugging');

      expect(results).toHaveLength(3);

      for (const result of results) {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should capture error when writeFile fails', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(mockSkill);

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);
      vi.mocked(mockFilesystem.mkdir).mockResolvedValue();
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Skill');
      vi.mocked(mockFilesystem.writeFile).mockRejectedValue(
        new Error('Disk full'),
      );

      const results = await copyService.copySkillToProject('debugging');

      expect(results).toHaveLength(3);

      for (const result of results) {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should include helpful error message for missing skill', async () => {
      vi.spyOn(mockDiscovery, 'getSkill').mockResolvedValue(null);

      await expect(
        copyService.copySkillToProject('missing-skill'),
      ).rejects.toThrow(
        "Skill 'missing-skill' not found in config repo. Run 'overture skill list' to see available skills.",
      );
    });
  });
});
