/**
 * Tests for Skill Paths
 */

import { describe, it, expect } from 'vitest';
import type { ClientName } from '@overture/config-types';
import {
  getSkillPaths,
  getSkillPath,
  getSkillDirectoryPath,
} from './skill-paths.js';

describe('skill-paths', () => {
  const homeDir = '/home/user';
  const projectRoot = '/home/user/my-project';

  describe('getSkillPaths()', () => {
    describe('claude-code', () => {
      it('should return correct global and project paths', () => {
        const paths = getSkillPaths('claude-code', homeDir);

        expect(paths).toEqual({
          global: '/home/user/.claude/skills',
          project: '.claude/skills',
        });
      });

      it('should return correct paths with projectRoot', () => {
        const paths = getSkillPaths('claude-code', homeDir, projectRoot);

        expect(paths).toEqual({
          global: '/home/user/.claude/skills',
          project: '/home/user/my-project/.claude/skills',
        });
      });
    });

    describe('copilot-cli', () => {
      it('should return correct global and project paths', () => {
        const paths = getSkillPaths('copilot-cli', homeDir);

        expect(paths).toEqual({
          global: '/home/user/.github/skills',
          project: '.github/skills',
        });
      });

      it('should return correct paths with projectRoot', () => {
        const paths = getSkillPaths('copilot-cli', homeDir, projectRoot);

        expect(paths).toEqual({
          global: '/home/user/.github/skills',
          project: '/home/user/my-project/.github/skills',
        });
      });
    });

    describe('opencode', () => {
      it('should return correct global and project paths with singular skill/', () => {
        const paths = getSkillPaths('opencode', homeDir);

        expect(paths).toEqual({
          global: '/home/user/.opencode/skill', // Note: singular
          project: '.opencode/skill', // Note: singular
        });
      });

      it('should return correct paths with projectRoot', () => {
        const paths = getSkillPaths('opencode', homeDir, projectRoot);

        expect(paths).toEqual({
          global: '/home/user/.opencode/skill',
          project: '/home/user/my-project/.opencode/skill',
        });
      });
    });

    it('should handle different home directory paths', () => {
      const macHomeDir = '/Users/john';
      const paths = getSkillPaths('claude-code', macHomeDir);

      expect(paths.global).toBe('/Users/john/.claude/skills');
    });

    it('should handle Windows-style paths', () => {
      const winHomeDir = 'C:\\Users\\john';
      const paths = getSkillPaths('claude-code', winHomeDir);

      expect(paths.global).toBe('C:\\Users\\john/.claude/skills');
    });

    it('should throw error for unknown client', () => {
      expect(() => {
        getSkillPaths('unknown-client' as ClientName, homeDir);
      }).toThrow('Unknown client: unknown-client');
    });
  });

  describe('getSkillPath()', () => {
    const skillName = 'debugging';

    describe('global scope', () => {
      it('should return correct path for claude-code', () => {
        const path = getSkillPath('claude-code', skillName, 'global', homeDir);

        expect(path).toBe('/home/user/.claude/skills/debugging/SKILL.md');
      });

      it('should return correct path for copilot-cli', () => {
        const path = getSkillPath('copilot-cli', skillName, 'global', homeDir);

        expect(path).toBe('/home/user/.github/skills/debugging/SKILL.md');
      });

      it('should return correct path for opencode with singular skill/', () => {
        const path = getSkillPath('opencode', skillName, 'global', homeDir);

        expect(path).toBe('/home/user/.opencode/skill/debugging/SKILL.md');
      });
    });

    describe('project scope', () => {
      it('should return relative path without projectRoot', () => {
        const path = getSkillPath('claude-code', skillName, 'project', homeDir);

        expect(path).toBe('.claude/skills/debugging/SKILL.md');
      });

      it('should return absolute path with projectRoot', () => {
        const path = getSkillPath(
          'claude-code',
          skillName,
          'project',
          homeDir,
          projectRoot,
        );

        expect(path).toBe(
          '/home/user/my-project/.claude/skills/debugging/SKILL.md',
        );
      });
    });

    it('should handle different skill names', () => {
      const path = getSkillPath(
        'claude-code',
        'code-review',
        'global',
        homeDir,
      );

      expect(path).toBe('/home/user/.claude/skills/code-review/SKILL.md');
    });

    it('should throw error for unknown client', () => {
      expect(() => {
        getSkillPath('unknown' as ClientName, skillName, 'global', homeDir);
      }).toThrow('Unknown client');
    });
  });

  describe('getSkillDirectoryPath()', () => {
    const skillName = 'debugging';

    describe('global scope', () => {
      it('should return directory path without SKILL.md for claude-code', () => {
        const path = getSkillDirectoryPath(
          'claude-code',
          skillName,
          'global',
          homeDir,
        );

        expect(path).toBe('/home/user/.claude/skills/debugging');
      });

      it('should return directory path for copilot-cli', () => {
        const path = getSkillDirectoryPath(
          'copilot-cli',
          skillName,
          'global',
          homeDir,
        );

        expect(path).toBe('/home/user/.github/skills/debugging');
      });

      it('should return directory path for opencode', () => {
        const path = getSkillDirectoryPath(
          'opencode',
          skillName,
          'global',
          homeDir,
        );

        expect(path).toBe('/home/user/.opencode/skill/debugging');
      });
    });

    describe('project scope', () => {
      it('should return relative directory path without projectRoot', () => {
        const path = getSkillDirectoryPath(
          'claude-code',
          skillName,
          'project',
          homeDir,
        );

        expect(path).toBe('.claude/skills/debugging');
      });

      it('should return absolute directory path with projectRoot', () => {
        const path = getSkillDirectoryPath(
          'claude-code',
          skillName,
          'project',
          homeDir,
          projectRoot,
        );

        expect(path).toBe('/home/user/my-project/.claude/skills/debugging');
      });
    });

    it('should handle different skill names', () => {
      const path = getSkillDirectoryPath(
        'claude-code',
        'code-review',
        'global',
        homeDir,
      );

      expect(path).toBe('/home/user/.claude/skills/code-review');
    });

    it('should throw error for unknown client', () => {
      expect(() => {
        getSkillDirectoryPath(
          'unknown' as ClientName,
          skillName,
          'global',
          homeDir,
        );
      }).toThrow('Unknown client');
    });
  });

  describe('cross-client consistency', () => {
    it('all clients should have global paths in home directory', () => {
      const clients: Array<'claude-code' | 'copilot-cli' | 'opencode'> = [
        'claude-code',
        'copilot-cli',
        'opencode',
      ];

      for (const client of clients) {
        const paths = getSkillPaths(client, homeDir);
        expect(paths.global).toContain(homeDir);
      }
    });

    it('all clients should have project paths starting with dot-directory', () => {
      const clients: Array<'claude-code' | 'copilot-cli' | 'opencode'> = [
        'claude-code',
        'copilot-cli',
        'opencode',
      ];

      for (const client of clients) {
        const paths = getSkillPaths(client, homeDir);
        expect(paths.project).toMatch(/^\./);
      }
    });

    it('all SKILL.md paths should end with /SKILL.md', () => {
      const clients: Array<'claude-code' | 'copilot-cli' | 'opencode'> = [
        'claude-code',
        'copilot-cli',
        'opencode',
      ];

      for (const client of clients) {
        const path = getSkillPath(client, 'test', 'global', homeDir);
        expect(path).toMatch(/\/SKILL\.md$/);
      }
    });
  });
});
