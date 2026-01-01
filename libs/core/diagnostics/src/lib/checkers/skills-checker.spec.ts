/**
 * Tests for SkillsChecker
 *
 * Verifies:
 * - Skill counting with SKILL.md files
 * - Empty directory handling
 * - Error handling (never throws)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillsChecker } from './skills-checker.js';
import type { FilesystemPort, Stats } from '@overture/ports-filesystem';

describe('SkillsChecker', () => {
  let checker: SkillsChecker;
  let mockFilesystem: FilesystemPort;

  beforeEach(() => {
    mockFilesystem = {
      exists: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      rm: vi.fn(),
    };

    checker = new SkillsChecker(mockFilesystem);
  });

  describe('countSkills', () => {
    it('should return 0 when skills directory does not exist', async () => {
      const result = await checker.countSkills(
        '/home/testuser/.config/overture/skills',
        false,
      );

      expect(result).toBe(0);
      expect(mockFilesystem.readdir).not.toHaveBeenCalled();
    });

    it('should return 0 when skills directory is empty', async () => {
      vi.mocked(mockFilesystem.readdir).mockResolvedValue([]);

      const result = await checker.countSkills(
        '/home/testuser/.config/overture/skills',
        true,
      );

      expect(result).toBe(0);
      expect(mockFilesystem.readdir).toHaveBeenCalledWith(
        '/home/testuser/.config/overture/skills',
      );
    });

    it('should count directories with SKILL.md files', async () => {
      const mockStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      };

      vi.mocked(mockFilesystem.readdir).mockResolvedValue([
        'skill1',
        'skill2',
        'skill3',
      ]);
      vi.mocked(mockFilesystem.stat).mockResolvedValue(mockStats);
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const result = await checker.countSkills(
        '/home/testuser/.config/overture/skills',
        true,
      );

      expect(result).toBe(3);
      expect(mockFilesystem.exists).toHaveBeenCalledWith(
        '/home/testuser/.config/overture/skills/skill1/SKILL.md',
      );
      expect(mockFilesystem.exists).toHaveBeenCalledWith(
        '/home/testuser/.config/overture/skills/skill2/SKILL.md',
      );
      expect(mockFilesystem.exists).toHaveBeenCalledWith(
        '/home/testuser/.config/overture/skills/skill3/SKILL.md',
      );
    });

    it('should not count directories without SKILL.md files', async () => {
      const mockStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      };

      vi.mocked(mockFilesystem.readdir).mockResolvedValue([
        'skill1',
        'not-a-skill',
        'skill2',
      ]);
      vi.mocked(mockFilesystem.stat).mockResolvedValue(mockStats);
      vi.mocked(mockFilesystem.exists)
        .mockResolvedValueOnce(true) // skill1 has SKILL.md
        .mockResolvedValueOnce(false) // not-a-skill doesn't have SKILL.md
        .mockResolvedValueOnce(true); // skill2 has SKILL.md

      const result = await checker.countSkills(
        '/home/testuser/.config/overture/skills',
        true,
      );

      expect(result).toBe(2);
    });

    it('should not count files, only directories', async () => {
      const mockDirStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      };

      const mockFileStats: Stats = {
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date(),
      };

      vi.mocked(mockFilesystem.readdir).mockResolvedValue([
        'skill1',
        'README.md',
        'skill2',
      ]);
      vi.mocked(mockFilesystem.stat)
        .mockResolvedValueOnce(mockDirStats) // skill1 is directory
        .mockResolvedValueOnce(mockFileStats) // README.md is file
        .mockResolvedValueOnce(mockDirStats); // skill2 is directory
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const result = await checker.countSkills(
        '/home/testuser/.config/overture/skills',
        true,
      );

      expect(result).toBe(2);
      expect(mockFilesystem.exists).toHaveBeenCalledTimes(2); // Only for directories
    });

    it('should handle readdir errors gracefully', async () => {
      vi.mocked(mockFilesystem.readdir).mockRejectedValue(
        new Error('Permission denied'),
      );

      const result = await checker.countSkills(
        '/home/testuser/.config/overture/skills',
        true,
      );

      expect(result).toBe(0);
    });

    it('should handle stat errors gracefully', async () => {
      vi.mocked(mockFilesystem.readdir).mockResolvedValue(['skill1', 'skill2']);
      vi.mocked(mockFilesystem.stat).mockRejectedValue(
        new Error('Stat failed'),
      );

      const result = await checker.countSkills(
        '/home/testuser/.config/overture/skills',
        true,
      );

      expect(result).toBe(0);
    });

    it('should handle exists errors gracefully and continue counting', async () => {
      const mockStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      };

      vi.mocked(mockFilesystem.readdir).mockResolvedValue([
        'skill1',
        'skill2',
        'skill3',
      ]);
      vi.mocked(mockFilesystem.stat).mockResolvedValue(mockStats);
      vi.mocked(mockFilesystem.exists)
        .mockResolvedValueOnce(true) // skill1 exists
        .mockRejectedValueOnce(new Error('Access denied')) // skill2 throws error
        .mockResolvedValueOnce(true); // skill3 exists

      const result = await checker.countSkills(
        '/home/testuser/.config/overture/skills',
        true,
      );

      // Should still count skill1 and skill3, but not skill2
      expect(result).toBe(2);
    });

    it('should handle mixed directory and file entries', async () => {
      const mockDirStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      };

      const mockFileStats: Stats = {
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date(),
      };

      vi.mocked(mockFilesystem.readdir).mockResolvedValue([
        '.gitkeep',
        'skill1',
        'notes.txt',
        'skill2',
        '.DS_Store',
      ]);
      vi.mocked(mockFilesystem.stat)
        .mockResolvedValueOnce(mockFileStats) // .gitkeep
        .mockResolvedValueOnce(mockDirStats) // skill1
        .mockResolvedValueOnce(mockFileStats) // notes.txt
        .mockResolvedValueOnce(mockDirStats) // skill2
        .mockResolvedValueOnce(mockFileStats); // .DS_Store
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const result = await checker.countSkills(
        '/home/testuser/.config/overture/skills',
        true,
      );

      expect(result).toBe(2);
    });

    it('should handle zero skills correctly', async () => {
      const mockDirStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      };

      vi.mocked(mockFilesystem.readdir).mockResolvedValue([
        'folder1',
        'folder2',
      ]);
      vi.mocked(mockFilesystem.stat).mockResolvedValue(mockDirStats);
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false); // No SKILL.md files

      const result = await checker.countSkills(
        '/home/testuser/.config/overture/skills',
        true,
      );

      expect(result).toBe(0);
    });
  });
});
