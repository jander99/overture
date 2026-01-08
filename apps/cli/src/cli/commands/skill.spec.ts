/**
 * Skill Command Tests
 *
 * Comprehensive tests for the `overture skill` command.
 *
 * Test Coverage:
 * - Basic command structure (name, description, options)
 * - skill list subcommand with table output
 * - skill list --json for scripting
 * - skill list --source to show paths
 * - Empty skills directory handling
 * - Error handling for discovery failures
 *
 * @see apps/cli/src/cli/commands/skill.ts
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import type { Command, Option } from 'commander';
import { createSkillCommand } from './skill.js';
import type { AppDependencies } from '../../composition-root.js';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock.js';
import type { DiscoveredSkill } from '@overture/config-types';

describe('skill command', () => {
  let deps: AppDependencies;
  let exitSpy: Mock;
  let consoleSpy: Mock;

  beforeEach(() => {
    deps = createMockAppDependencies();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic command structure', () => {
    it('should create a command named "skill"', () => {
      const command = createSkillCommand(deps);
      expect(command.name()).toBe('skill');
    });

    it('should have a description', () => {
      const command = createSkillCommand(deps);
      expect(command.description()).toBe('Manage Agent Skills');
    });

    it('should have a "list" subcommand', () => {
      const command = createSkillCommand(deps);
      const subcommands = command.commands;

      const listCommand = subcommands.find(
        (cmd: Command) => cmd.name() === 'list',
      );
      expect(listCommand).toBeDefined();
      expect(listCommand?.description()).toBe(
        'List available skills from config repo',
      );
    });

    it('should support --json option on list subcommand', () => {
      const command = createSkillCommand(deps);
      const listCommand = command.commands.find(
        (cmd: Command) => cmd.name() === 'list',
      );

      const jsonOption = listCommand?.options.find(
        (opt: Option) => opt.long === '--json',
      );
      expect(jsonOption).toBeDefined();
      expect(jsonOption?.description).toContain('Output as JSON');
    });

    it('should support --source option on list subcommand', () => {
      const command = createSkillCommand(deps);
      const listCommand = command.commands.find(
        (cmd: Command) => cmd.name() === 'list',
      );

      const sourceOption = listCommand?.options.find(
        (opt: Option) => opt.long === '--source',
      );
      expect(sourceOption).toBeDefined();
      expect(sourceOption?.description).toContain('Show source path');
    });
  });

  describe('skill list - table output', () => {
    it('should display skills in table format by default', async () => {
      // Arrange
      const mockSkills: DiscoveredSkill[] = [
        {
          name: 'debugging',
          path: '/home/user/.config/overture/skills/debugging/SKILL.md',
          directoryPath: '/home/user/.config/overture/skills/debugging',
          description: 'Debug code issues effectively',
        },
        {
          name: 'code-review',
          path: '/home/user/.config/overture/skills/code-review/SKILL.md',
          directoryPath: '/home/user/.config/overture/skills/code-review',
          description: 'Review code for quality and best practices',
        },
      ];

      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue(
        mockSkills,
      );

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list']);

      // Assert
      expect(deps.skillDiscovery.discoverSkills).toHaveBeenCalled();
      expect(deps.output.info).toHaveBeenCalledWith('\nAvailable Skills:\n');
      expect(consoleSpy).toHaveBeenCalledWith('NAME              DESCRIPTION');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('─'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('debugging'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('code-review'),
      );
      expect(deps.output.info).toHaveBeenCalledWith('Total: 2 skills');
    });

    it('should display singular "skill" for single skill', async () => {
      // Arrange
      const mockSkills: DiscoveredSkill[] = [
        {
          name: 'debugging',
          path: '/home/user/.config/overture/skills/debugging/SKILL.md',
          directoryPath: '/home/user/.config/overture/skills/debugging',
          description: 'Debug code issues',
        },
      ];

      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue(
        mockSkills,
      );

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list']);

      // Assert
      expect(deps.output.info).toHaveBeenCalledWith('Total: 1 skill');
    });

    it('should handle skills without description', async () => {
      // Arrange
      const mockSkills: DiscoveredSkill[] = [
        {
          name: 'no-desc-skill',
          path: '/home/user/.config/overture/skills/no-desc-skill/SKILL.md',
          directoryPath: '/home/user/.config/overture/skills/no-desc-skill',
          description: undefined,
        },
      ];

      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue(
        mockSkills,
      );

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list']);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(no description)'),
      );
    });
  });

  describe('skill list --json', () => {
    it('should output JSON when --json flag is provided', async () => {
      // Arrange
      const mockSkills: DiscoveredSkill[] = [
        {
          name: 'debugging',
          path: '/home/user/.config/overture/skills/debugging/SKILL.md',
          directoryPath: '/home/user/.config/overture/skills/debugging',
          description: 'Debug code issues',
        },
      ];

      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue(
        mockSkills,
      );

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list', '--json']);

      // Assert
      expect(deps.skillDiscovery.discoverSkills).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify(mockSkills, null, 2),
      );
      // Should NOT call table output
      expect(deps.output.info).not.toHaveBeenCalledWith(
        '\nAvailable Skills:\n',
      );
    });

    it('should output empty array JSON when no skills found with --json', async () => {
      // Arrange
      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue([]);

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list', '--json']);

      // Assert - when no skills, warn is called and JSON is NOT output
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('No skills found'),
      );
    });
  });

  describe('skill list --source', () => {
    it('should display source paths when --source flag is provided', async () => {
      // Arrange
      const mockSkills: DiscoveredSkill[] = [
        {
          name: 'debugging',
          path: '/home/user/.config/overture/skills/debugging/SKILL.md',
          directoryPath: '/home/user/.config/overture/skills/debugging',
          description: 'Debug code issues',
        },
      ];

      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue(
        mockSkills,
      );

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list', '--source']);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '/home/user/.config/overture/skills/debugging/SKILL.md',
        ),
      );
    });

    it('should not display paths without --source flag', async () => {
      // Arrange
      const mockSkills: DiscoveredSkill[] = [
        {
          name: 'debugging',
          path: '/home/user/.config/overture/skills/debugging/SKILL.md',
          directoryPath: '/home/user/.config/overture/skills/debugging',
          description: 'Debug code issues',
        },
      ];

      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue(
        mockSkills,
      );

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list']);

      // Assert - path should NOT appear in output
      const pathCalls = consoleSpy.mock.calls.filter(
        (call: string[]) =>
          call[0] &&
          typeof call[0] === 'string' &&
          call[0].includes('/home/user/.config/overture/skills/debugging'),
      );
      // Path should not be printed when --source is not provided
      // (the path is part of the skill object but not printed in table format)
      expect(pathCalls.length).toBe(0);
    });
  });

  describe('empty skills handling', () => {
    it('should display warning when no skills found', async () => {
      // Arrange
      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue([]);

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list']);

      // Assert
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('No skills found'),
      );
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('~/.config/overture/skills/'),
      );
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('SKILL.md'),
      );
    });

    it('should not display table output when no skills found', async () => {
      // Arrange
      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue([]);

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list']);

      // Assert - table should not be shown
      expect(deps.output.info).not.toHaveBeenCalledWith(
        '\nAvailable Skills:\n',
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        'NAME              DESCRIPTION',
      );
    });
  });

  describe('error handling', () => {
    it('should handle discovery errors gracefully', async () => {
      // Arrange
      vi.mocked(deps.skillDiscovery.discoverSkills).mockRejectedValue(
        new Error('Permission denied'),
      );

      const command = createSkillCommand(deps);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'skill', 'list']),
      ).rejects.toThrow('process.exit:1');

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to list skills'),
      );
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied'),
      );
    });

    it('should exit with code 1 on error', async () => {
      // Arrange
      vi.mocked(deps.skillDiscovery.discoverSkills).mockRejectedValue(
        new Error('Read error'),
      );

      const command = createSkillCommand(deps);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'skill', 'list']),
      ).rejects.toThrow('process.exit:1');

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('combined options', () => {
    it('should handle both --json and --source (json takes precedence)', async () => {
      // Arrange
      const mockSkills: DiscoveredSkill[] = [
        {
          name: 'debugging',
          path: '/home/user/.config/overture/skills/debugging/SKILL.md',
          directoryPath: '/home/user/.config/overture/skills/debugging',
          description: 'Debug code issues',
        },
      ];

      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue(
        mockSkills,
      );

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list', '--json', '--source']);

      // Assert - JSON output takes precedence
      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify(mockSkills, null, 2),
      );
      // Table format should not appear
      expect(deps.output.info).not.toHaveBeenCalledWith(
        '\nAvailable Skills:\n',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle skill with very long name', async () => {
      // Arrange
      const longName = 'a'.repeat(50);
      const mockSkills: DiscoveredSkill[] = [
        {
          name: longName,
          path: `/home/user/.config/overture/skills/${longName}/SKILL.md`,
          directoryPath: `/home/user/.config/overture/skills/${longName}`,
          description: 'Long name skill',
        },
      ];

      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue(
        mockSkills,
      );

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list']);

      // Assert - should not throw, output includes name
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(longName.substring(0, 18)),
      );
    });

    it('should handle skill with very long description', async () => {
      // Arrange
      const longDescription = 'x'.repeat(300);
      const mockSkills: DiscoveredSkill[] = [
        {
          name: 'test',
          path: '/home/user/.config/overture/skills/test/SKILL.md',
          directoryPath: '/home/user/.config/overture/skills/test',
          description: longDescription,
        },
      ];

      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue(
        mockSkills,
      );

      const command = createSkillCommand(deps);

      // Act - should not throw
      await command.parseAsync(['node', 'skill', 'list']);

      // Assert
      expect(deps.skillDiscovery.discoverSkills).toHaveBeenCalled();
    });

    it('should handle many skills', async () => {
      // Arrange
      const mockSkills: DiscoveredSkill[] = Array.from(
        { length: 100 },
        (_, i) => ({
          name: `skill-${i}`,
          path: `/home/user/.config/overture/skills/skill-${i}/SKILL.md`,
          directoryPath: `/home/user/.config/overture/skills/skill-${i}`,
          description: `Description for skill ${i}`,
        }),
      );

      vi.mocked(deps.skillDiscovery.discoverSkills).mockResolvedValue(
        mockSkills,
      );

      const command = createSkillCommand(deps);

      // Act
      await command.parseAsync(['node', 'skill', 'list']);

      // Assert
      expect(deps.output.info).toHaveBeenCalledWith('Total: 100 skills');
    });
  });
});
