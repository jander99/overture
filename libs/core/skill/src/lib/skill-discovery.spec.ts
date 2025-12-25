/**
 * Tests for Skill Discovery Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillDiscovery } from './skill-discovery.js';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import type { Stats } from '@overture/ports-filesystem';

describe('SkillDiscovery', () => {
  let mockFilesystem: FilesystemPort;
  let mockEnvironment: EnvironmentPort;
  let discovery: SkillDiscovery;

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

    discovery = new SkillDiscovery(mockFilesystem, mockEnvironment);
  });

  describe('discoverSkills()', () => {
    it('should discover skills from directory with multiple skills', async () => {
      const skillsDir = '/home/user/.config/overture/skills';

      // Mock directory exists
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      // Mock directory contents
      vi.mocked(mockFilesystem.readdir).mockResolvedValue([
        'debugging',
        'code-review',
        'not-a-skill', // No SKILL.md
      ]);

      // Mock stat calls - all are directories
      const mockStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      };
      vi.mocked(mockFilesystem.stat).mockResolvedValue(mockStats);

      // Mock SKILL.md existence
      vi.mocked(mockFilesystem.exists)
        .mockResolvedValueOnce(true) // skills dir exists
        .mockResolvedValueOnce(true) // debugging/SKILL.md exists
        .mockResolvedValueOnce(true) // code-review/SKILL.md exists
        .mockResolvedValueOnce(false); // not-a-skill/SKILL.md doesn't exist

      // Mock SKILL.md content
      vi.mocked(mockFilesystem.readFile)
        .mockResolvedValueOnce('# Debugging\n\nAdvanced debugging techniques.')
        .mockResolvedValueOnce(
          '---\ndescription: Code review best practices\n---\n\n# Code Review',
        );

      const skills = await discovery.discoverSkills();

      expect(skills).toHaveLength(2);
      expect(skills[0]).toEqual({
        name: 'debugging',
        path: `${skillsDir}/debugging/SKILL.md`,
        description: 'Advanced debugging techniques.',
      });
      expect(skills[1]).toEqual({
        name: 'code-review',
        path: `${skillsDir}/code-review/SKILL.md`,
        description: 'Code review best practices',
      });
    });

    it('should return empty array when skills directory does not exist', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const skills = await discovery.discoverSkills();

      expect(skills).toEqual([]);
    });

    it('should return empty array when skills directory is empty', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readdir).mockResolvedValue([]);

      const skills = await discovery.discoverSkills();

      expect(skills).toEqual([]);
    });

    it('should extract description from frontmatter if present', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readdir).mockResolvedValue(['test-skill']);

      const mockStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      };
      vi.mocked(mockFilesystem.stat).mockResolvedValue(mockStats);

      vi.mocked(mockFilesystem.exists)
        .mockResolvedValueOnce(true) // skills dir
        .mockResolvedValueOnce(true); // SKILL.md

      const skillContent = `---
name: test-skill
description: "This is from frontmatter"
---

# Test Skill

This is the first paragraph.`;

      vi.mocked(mockFilesystem.readFile).mockResolvedValue(skillContent);

      const skills = await discovery.discoverSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].description).toBe('This is from frontmatter');
    });

    it('should extract description from first paragraph if no frontmatter', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readdir).mockResolvedValue(['test-skill']);

      const mockStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      };
      vi.mocked(mockFilesystem.stat).mockResolvedValue(mockStats);

      vi.mocked(mockFilesystem.exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const skillContent = `# Test Skill

This is the first paragraph and should be extracted.

This is the second paragraph.`;

      vi.mocked(mockFilesystem.readFile).mockResolvedValue(skillContent);

      const skills = await discovery.discoverSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].description).toBe(
        'This is the first paragraph and should be extracted.',
      );
    });

    it('should handle malformed SKILL.md files gracefully', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readdir).mockResolvedValue(['broken-skill']);

      const mockStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      };
      vi.mocked(mockFilesystem.stat).mockResolvedValue(mockStats);

      vi.mocked(mockFilesystem.exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      vi.mocked(mockFilesystem.readFile).mockResolvedValue('');

      const skills = await discovery.discoverSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].description).toBeUndefined();
    });

    it('should use custom skills directory when provided', async () => {
      const customDir = '/custom/skills';

      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readdir).mockResolvedValue([]);

      await discovery.discoverSkills({ skillsDir: customDir });

      expect(mockFilesystem.readdir).toHaveBeenCalledWith(customDir);
    });

    it('should skip files in skills directory (only process directories)', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readdir).mockResolvedValue([
        'skill-dir',
        'readme.md', // file, not directory
      ]);

      const dirStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      };

      const fileStats: Stats = {
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date(),
      };

      vi.mocked(mockFilesystem.stat)
        .mockResolvedValueOnce(dirStats) // skill-dir
        .mockResolvedValueOnce(fileStats); // readme.md

      vi.mocked(mockFilesystem.exists)
        .mockResolvedValueOnce(true) // skills dir
        .mockResolvedValueOnce(true); // skill-dir/SKILL.md

      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Test');

      const skills = await discovery.discoverSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('skill-dir');
    });
  });

  describe('getSkill()', () => {
    it('should return skill if it exists', async () => {
      const skillPath = '/home/user/.config/overture/skills/debugging/SKILL.md';

      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue(
        '# Debugging\n\nAdvanced debugging techniques.',
      );

      const skill = await discovery.getSkill('debugging');

      expect(skill).toEqual({
        name: 'debugging',
        path: skillPath,
        description: 'Advanced debugging techniques.',
      });
    });

    it('should return null if skill does not exist', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const skill = await discovery.getSkill('nonexistent');

      expect(skill).toBeNull();
    });

    it('should use custom skills directory', async () => {
      const customDir = '/custom/skills';
      const skillPath = `${customDir}/test/SKILL.md`;

      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('# Test');

      await discovery.getSkill('test', { skillsDir: customDir });

      expect(mockFilesystem.exists).toHaveBeenCalledWith(skillPath);
    });
  });

  describe('hasSkillsDirectory()', () => {
    it('should return true if skills directory exists', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const result = await discovery.hasSkillsDirectory();

      expect(result).toBe(true);
      expect(mockFilesystem.exists).toHaveBeenCalledWith(
        '/home/user/.config/overture/skills',
      );
    });

    it('should return false if skills directory does not exist', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await discovery.hasSkillsDirectory();

      expect(result).toBe(false);
    });
  });

  describe('getSkillsDirectoryPath()', () => {
    it('should return correct path on Linux', () => {
      const path = discovery.getSkillsDirectoryPath();

      expect(path).toBe('/home/user/.config/overture/skills');
    });

    it('should return correct path on macOS', () => {
      vi.mocked(mockEnvironment.homedir).mockReturnValue('/Users/user');

      const path = discovery.getSkillsDirectoryPath();

      expect(path).toBe('/Users/user/.config/overture/skills');
    });

    it('should return correct path on Windows', () => {
      vi.mocked(mockEnvironment.homedir).mockReturnValue('C:\\Users\\user');

      const path = discovery.getSkillsDirectoryPath();

      expect(path).toBe('C:\\Users\\user/.config/overture/skills');
    });
  });

  describe('extractDescription()', () => {
    it('should extract description from frontmatter with double quotes', () => {
      const content = `---
description: "This is a description"
---

# Test`;

      const skills = new SkillDiscovery(mockFilesystem, mockEnvironment);
      const description = (
        skills as unknown as {
          extractDescription: (content: string) => string | undefined;
        }
      ).extractDescription(content);

      expect(description).toBe('This is a description');
    });

    it('should extract description from frontmatter with single quotes', () => {
      const content = `---
description: 'This is a description'
---

# Test`;

      const skills = new SkillDiscovery(mockFilesystem, mockEnvironment);
      const description = (
        skills as unknown as {
          extractDescription: (content: string) => string | undefined;
        }
      ).extractDescription(content);

      expect(description).toBe('This is a description');
    });

    it('should extract description from frontmatter without quotes', () => {
      const content = `---
description: This is a description
---

# Test`;

      const skills = new SkillDiscovery(mockFilesystem, mockEnvironment);
      const description = (
        skills as unknown as {
          extractDescription: (content: string) => string | undefined;
        }
      ).extractDescription(content);

      expect(description).toBe('This is a description');
    });

    it('should truncate long descriptions to 200 characters', () => {
      const longText = 'a'.repeat(250);
      const content = `# Test\n\n${longText}`;

      const skills = new SkillDiscovery(mockFilesystem, mockEnvironment);
      const description = (
        skills as unknown as {
          extractDescription: (content: string) => string | undefined;
        }
      ).extractDescription(content);

      expect(description).toHaveLength(200);
      expect(description?.endsWith('...')).toBe(true);
    });

    it('should return undefined for empty content', () => {
      const skills = new SkillDiscovery(mockFilesystem, mockEnvironment);
      const description = (
        skills as unknown as {
          extractDescription: (content: string) => string | undefined;
        }
      ).extractDescription('');

      expect(description).toBeUndefined();
    });

    it('should skip headings and extract first paragraph', () => {
      const content = `# Heading 1

## Heading 2

This is the first paragraph.

This is the second paragraph.`;

      const skills = new SkillDiscovery(mockFilesystem, mockEnvironment);
      const description = (
        skills as unknown as {
          extractDescription: (content: string) => string | undefined;
        }
      ).extractDescription(content);

      expect(description).toBe('This is the first paragraph.');
    });
  });
});
