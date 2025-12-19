/**
 * Init Command Tests
 *
 * Comprehensive tests for the `overture init` command.
 *
 * Test Coverage:
 * - Create new project configuration at .overture/config.yaml
 * - Force overwrite with --force flag
 * - .overture directory creation when missing
 * - Helpful comments and next steps in generated config
 * - Default claude-code client enablement
 * - Error handling (write errors, directory creation failures)
 * - Edge cases (paths with spaces, Unicode, emoji, special chars)
 *
 * @see apps/cli/src/cli/commands/init.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SpyInstance } from 'vitest';
import { createInitCommand } from './init';
import type { AppDependencies } from '../../composition-root';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock';

describe('init command', () => {
  let deps: AppDependencies;
  let exitSpy: SpyInstance;
  let cwdSpy: SpyInstance;

  beforeEach(() => {
    deps = createMockAppDependencies();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/home/user/project');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('basic command structure', () => {
    it('should create a command named "init"', () => {
      const command = createInitCommand(deps);
      expect(command.name()).toBe('init');
    });

    it('should have a description', () => {
      const command = createInitCommand(deps);
      expect(command.description()).toBe('Initialize .overture/config.yaml with defaults');
    });

    it('should have --force option', () => {
      const command = createInitCommand(deps);
      const options = command.options;

      const forceOption = options.find((opt) => opt.long === '--force');
      expect(forceOption).toBeDefined();
      expect(forceOption?.description).toContain('Overwrite existing configuration');
    });
  });

  describe('config initialization', () => {
    beforeEach(() => {
      vi.mocked(deps.pathResolver.resolveProjectConfig).mockReturnValue(
        '/home/user/project/.overture/config.yaml'
      );
      vi.mocked(deps.pathResolver.getProjectOvertureDir).mockReturnValue(
        '/home/user/project/.overture'
      );
      vi.mocked(deps.filesystem.fileExists).mockReturnValue(false);
      vi.mocked(deps.filesystem.directoryExists).mockReturnValue(true);
      vi.mocked(deps.filesystem.writeFile).mockResolvedValue(undefined);
    });

    it('should create new config when none exists', async () => {
      const command = createInitCommand(deps);

      await command.parseAsync(['node', 'init']);

      expect(deps.pathResolver.resolveProjectConfig).toHaveBeenCalledWith('/home/user/project');
      expect(deps.filesystem.writeFile).toHaveBeenCalledWith(
        '/home/user/project/.overture/config.yaml',
        expect.stringContaining('version: "2.0"')
      );
      expect(deps.output.success).toHaveBeenCalledWith('Configuration created!');
    });

    it('should include helpful comments in config', async () => {
      const command = createInitCommand(deps);

      await command.parseAsync(['node', 'init']);

      const writtenContent = vi.mocked(deps.filesystem.writeFile).mock.calls[0][1];
      expect(writtenContent).toContain('# Overture Configuration (v0.2)');
      expect(writtenContent).toContain('# Multi-client MCP configuration orchestrator');
      expect(writtenContent).toContain('# Supported clients:');
      expect(writtenContent).toContain('claude-code');
    });

    it('should include claude-code client by default', async () => {
      const command = createInitCommand(deps);

      await command.parseAsync(['node', 'init']);

      const writtenContent = vi.mocked(deps.filesystem.writeFile).mock.calls[0][1];
      expect(writtenContent).toContain('claude-code:');
      expect(writtenContent).toContain('enabled: true');
    });

    it('should create .overture directory if missing', async () => {
      vi.mocked(deps.filesystem.directoryExists).mockReturnValue(false);

      const command = createInitCommand(deps);

      await command.parseAsync(['node', 'init']);

      expect(deps.filesystem.createDirectory).toHaveBeenCalledWith(
        '/home/user/project/.overture'
      );
    });

    it('should not create directory if it exists', async () => {
      vi.mocked(deps.filesystem.directoryExists).mockReturnValue(true);

      const command = createInitCommand(deps);

      await command.parseAsync(['node', 'init']);

      expect(deps.filesystem.createDirectory).not.toHaveBeenCalled();
    });

    it('should display next steps after creation', async () => {
      const command = createInitCommand(deps);

      await command.parseAsync(['node', 'init']);

      expect(deps.output.info).toHaveBeenCalledWith('Next steps:');
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('Edit .overture/config.yaml')
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('overture sync')
      );
    });

    it('should show config location after creation', async () => {
      const command = createInitCommand(deps);

      await command.parseAsync(['node', 'init']);

      expect(deps.output.info).toHaveBeenCalledWith(
        'Location: /home/user/project/.overture/config.yaml'
      );
    });
  });

  describe('existing config handling', () => {
    beforeEach(() => {
      vi.mocked(deps.pathResolver.resolveProjectConfig).mockReturnValue(
        '/home/user/project/.overture/config.yaml'
      );
      vi.mocked(deps.pathResolver.getProjectOvertureDir).mockReturnValue(
        '/home/user/project/.overture'
      );
      vi.mocked(deps.filesystem.directoryExists).mockReturnValue(true);
    });

    it('should not overwrite existing config without --force', async () => {
      vi.mocked(deps.filesystem.fileExists).mockReturnValue(true);

      const command = createInitCommand(deps);

      await expect(command.parseAsync(['node', 'init'])).rejects.toThrow('process.exit:1');

      expect(deps.output.error).toHaveBeenCalledWith('Configuration already exists');
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('Use --force to overwrite')
      );
      expect(deps.filesystem.writeFile).not.toHaveBeenCalled();
    });

    it('should overwrite existing config with --force flag', async () => {
      vi.mocked(deps.filesystem.fileExists).mockReturnValue(true);
      vi.mocked(deps.filesystem.writeFile).mockResolvedValue(undefined);

      const command = createInitCommand(deps);

      await command.parseAsync(['node', 'init', '--force']);

      expect(deps.filesystem.writeFile).toHaveBeenCalled();
      expect(deps.output.success).toHaveBeenCalledWith('Configuration created!');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      vi.mocked(deps.pathResolver.resolveProjectConfig).mockReturnValue(
        '/home/user/project/.overture/config.yaml'
      );
      vi.mocked(deps.pathResolver.getProjectOvertureDir).mockReturnValue(
        '/home/user/project/.overture'
      );
      vi.mocked(deps.filesystem.fileExists).mockReturnValue(false);
      vi.mocked(deps.filesystem.directoryExists).mockReturnValue(true);
    });

    it('should handle write errors gracefully', async () => {
      vi.mocked(deps.filesystem.writeFile).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const command = createInitCommand(deps);

      await expect(command.parseAsync(['node', 'init'])).rejects.toThrow('process.exit:1');

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize configuration')
      );
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied')
      );
    });

    it('should handle directory creation errors', async () => {
      vi.mocked(deps.filesystem.directoryExists).mockReturnValue(false);
      vi.mocked(deps.filesystem.createDirectory).mockImplementation(() => {
        throw new Error('Cannot create directory');
      });

      const command = createInitCommand(deps);

      await expect(command.parseAsync(['node', 'init'])).rejects.toThrow('process.exit:1');

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize configuration')
      );
    });
  });

  describe('config structure validation', () => {
    beforeEach(() => {
      vi.mocked(deps.pathResolver.resolveProjectConfig).mockReturnValue(
        '/home/user/project/.overture/config.yaml'
      );
      vi.mocked(deps.pathResolver.getProjectOvertureDir).mockReturnValue(
        '/home/user/project/.overture'
      );
      vi.mocked(deps.filesystem.fileExists).mockReturnValue(false);
      vi.mocked(deps.filesystem.directoryExists).mockReturnValue(true);
      vi.mocked(deps.filesystem.writeFile).mockResolvedValue(undefined);
    });

    it('should create valid YAML structure', async () => {
      const command = createInitCommand(deps);

      await command.parseAsync(['node', 'init']);

      const writtenContent = vi.mocked(deps.filesystem.writeFile).mock.calls[0][1];

      // Should have version
      expect(writtenContent).toContain('version:');

      // Should have mcp section
      expect(writtenContent).toContain('mcp:');

      // Should have clients section
      expect(writtenContent).toContain('clients:');
    });

    it('should have empty MCP section with comments', async () => {
      const command = createInitCommand(deps);

      await command.parseAsync(['node', 'init']);

      const writtenContent = vi.mocked(deps.filesystem.writeFile).mock.calls[0][1];

      // MCP section should be empty (no actual servers configured)
      expect(writtenContent).toContain('mcp: {}');
    });
  });

  describe('edge cases - special characters in paths', () => {
    beforeEach(() => {
      vi.mocked(deps.filesystem.fileExists).mockReturnValue(false);
      vi.mocked(deps.filesystem.directoryExists).mockReturnValue(true);
      vi.mocked(deps.filesystem.writeFile).mockResolvedValue(undefined);
    });

    it('should handle project paths with spaces', async () => {
      // Arrange
      const pathWithSpaces = '/home/user/my project folder/.overture/config.yaml';
      vi.mocked(deps.pathResolver.resolveProjectConfig).mockReturnValue(pathWithSpaces);
      vi.mocked(deps.pathResolver.getProjectOvertureDir).mockReturnValue(
        '/home/user/my project folder/.overture'
      );
      cwdSpy.mockReturnValue('/home/user/my project folder');

      const command = createInitCommand(deps);

      // Act
      await command.parseAsync(['node', 'init']);

      // Assert
      expect(deps.filesystem.writeFile).toHaveBeenCalledWith(
        pathWithSpaces,
        expect.any(String)
      );
      expect(deps.output.success).toHaveBeenCalledWith('Configuration created!');
      expect(deps.output.info).toHaveBeenCalledWith(
        `Location: ${pathWithSpaces}`
      );
    });

    it('should handle project paths with Unicode characters', async () => {
      // Arrange
      const unicodePath = '/home/user/プロジェクト/.overture/config.yaml';
      vi.mocked(deps.pathResolver.resolveProjectConfig).mockReturnValue(unicodePath);
      vi.mocked(deps.pathResolver.getProjectOvertureDir).mockReturnValue(
        '/home/user/プロジェクト/.overture'
      );
      cwdSpy.mockReturnValue('/home/user/プロジェクト');

      const command = createInitCommand(deps);

      // Act
      await command.parseAsync(['node', 'init']);

      // Assert
      expect(deps.filesystem.writeFile).toHaveBeenCalledWith(
        unicodePath,
        expect.any(String)
      );
      expect(deps.output.success).toHaveBeenCalledWith('Configuration created!');
    });

    it('should handle project paths with emoji characters', async () => {
      // Arrange
      const emojiPath = '/home/user/my-app-🚀/.overture/config.yaml';
      vi.mocked(deps.pathResolver.resolveProjectConfig).mockReturnValue(emojiPath);
      vi.mocked(deps.pathResolver.getProjectOvertureDir).mockReturnValue(
        '/home/user/my-app-🚀/.overture'
      );
      cwdSpy.mockReturnValue('/home/user/my-app-🚀');

      const command = createInitCommand(deps);

      // Act
      await command.parseAsync(['node', 'init']);

      // Assert
      expect(deps.filesystem.writeFile).toHaveBeenCalledWith(
        emojiPath,
        expect.any(String)
      );
      expect(deps.output.success).toHaveBeenCalledWith('Configuration created!');
    });

    it('should handle paths with special characters (dashes, underscores, dots)', async () => {
      // Arrange
      const specialPath = '/home/user/my-app_v1.2.3/.overture/config.yaml';
      vi.mocked(deps.pathResolver.resolveProjectConfig).mockReturnValue(specialPath);
      vi.mocked(deps.pathResolver.getProjectOvertureDir).mockReturnValue(
        '/home/user/my-app_v1.2.3/.overture'
      );
      cwdSpy.mockReturnValue('/home/user/my-app_v1.2.3');

      const command = createInitCommand(deps);

      // Act
      await command.parseAsync(['node', 'init']);

      // Assert
      expect(deps.filesystem.writeFile).toHaveBeenCalledWith(
        specialPath,
        expect.any(String)
      );
      expect(deps.output.success).toHaveBeenCalledWith('Configuration created!');
    });
  });
});
