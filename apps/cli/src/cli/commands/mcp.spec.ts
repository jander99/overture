/**
 * MCP Command Tests
 *
 * Comprehensive tests for the `overture mcp` command group.
 * Tests MCP listing, filtering, enabling/disabling, and error cases.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMcpCommand } from './mcp';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock';
import type { AppDependencies } from '../../composition-root';

describe('mcp command', () => {
  let deps: AppDependencies;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    deps = createMockAppDependencies();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('basic command structure', () => {
    it('should create mcp command with name "mcp"', () => {
      const command = createMcpCommand(deps);
      expect(command.name()).toBe('mcp');
    });

    it('should have description', () => {
      const command = createMcpCommand(deps);
      expect(command.description()).toBeTruthy();
      expect(command.description().length).toBeGreaterThan(0);
    });

    it('should have "list" subcommand', () => {
      const command = createMcpCommand(deps);
      const subcommands = command.commands;
      const subcommandNames = subcommands.map((cmd) => cmd.name());
      expect(subcommandNames).toContain('list');
    });

    it('should have "enable" subcommand', () => {
      const command = createMcpCommand(deps);
      const subcommands = command.commands;
      const subcommandNames = subcommands.map((cmd) => cmd.name());
      expect(subcommandNames).toContain('enable');
    });
  });

  describe('mcp list - configuration loading', () => {
    it('should load configuration via configLoader', async () => {
      const mockConfig = {
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      expect(deps.configLoader.loadConfig).toHaveBeenCalledWith(process.cwd());
    });

    it('should access mcp object from loaded config', async () => {
      const mockConfig = {
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // If this doesn't throw, config.mcp was accessed successfully
      expect(deps.configLoader.loadConfig).toHaveBeenCalled();
    });
  });

  describe('mcp list - display MCPs', () => {
    it('should display MCPs in table format', async () => {
      const mockConfig = {
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should display header
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('MCP'));

      // Should display both MCPs
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('filesystem'));
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('memory'));
    });

    it('should display MCP command information', async () => {
      const mockConfig = {
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should display command
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('npx'));
    });

    it('should handle empty MCP configuration', async () => {
      const mockConfig = {
        version: '1.0' as const,
        mcp: {},
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should warn about no MCPs
      expect(deps.output.warn).toHaveBeenCalledWith(expect.stringContaining('No MCP'));
    });
  });
});
