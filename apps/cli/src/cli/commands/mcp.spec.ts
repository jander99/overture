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
    it('should load user and project configs separately', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
          },
        },
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      expect(deps.configLoader.loadUserConfig).toHaveBeenCalled();
      expect(deps.configLoader.loadProjectConfig).toHaveBeenCalledWith(process.cwd());
    });

    it('should access mcp object from loaded configs', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // If this doesn't throw, config.mcp was accessed successfully
      expect(deps.configLoader.loadUserConfig).toHaveBeenCalled();
      expect(deps.configLoader.loadProjectConfig).toHaveBeenCalled();
    });
  });

  describe('mcp list - display MCPs', () => {
    it('should display MCPs in table format', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
          },
        },
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should display header
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('MCP'));

      // Should display both MCPs
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('filesystem'));
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('memory'));
    });

    it('should display MCP command information', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should display command
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('npx'));
    });

    it('should handle empty MCP configuration', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should warn about no MCPs
      expect(deps.output.warn).toHaveBeenCalledWith(expect.stringContaining('No MCP'));
    });
  });

  describe('mcp list - filter by scope (Cycle 1.4)', () => {
    it('should filter to only global MCPs when --scope global', async () => {
      // Mock user config (global MCPs)
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
          },
        },
      });

      // Mock project config (project MCPs)
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list', '--scope', 'global']);

      // Should only display global MCP (memory)
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('memory'));

      // Should NOT display project MCP (filesystem)
      const calls = vi.mocked(deps.output.info).mock.calls;
      const hasFilesystem = calls.some(([msg]) =>
        typeof msg === 'string' && msg.includes('filesystem')
      );
      expect(hasFilesystem).toBe(false);
    });

    it('should filter to only project MCPs when --scope project', async () => {
      // Mock user config (global MCPs)
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
          },
        },
      });

      // Mock project config (project MCPs)
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list', '--scope', 'project']);

      // Should only display project MCP (filesystem)
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('filesystem'));

      // Should NOT display global MCP (memory)
      const calls = vi.mocked(deps.output.info).mock.calls;
      const hasMemory = calls.some(([msg]) =>
        typeof msg === 'string' && msg.includes('memory')
      );
      expect(hasMemory).toBe(false);
    });

    it('should display all MCPs with scope indicators by default', async () => {
      // Mock user config (global MCPs)
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
          },
        },
      });

      // Mock project config (project MCPs)
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should display both MCPs
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('memory'));
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('filesystem'));

      // Should display scope indicators
      const calls = vi.mocked(deps.output.info).mock.calls;
      const hasGlobalIndicator = calls.some(([msg]) =>
        typeof msg === 'string' && (msg.includes('global') || msg.includes('Global'))
      );
      const hasProjectIndicator = calls.some(([msg]) =>
        typeof msg === 'string' && (msg.includes('project') || msg.includes('Project'))
      );

      expect(hasGlobalIndicator).toBe(true);
      expect(hasProjectIndicator).toBe(true);
    });

    it('should error on invalid scope value', async () => {
      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list', '--scope', 'invalid']);

      // Should display error for invalid scope
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid scope')
      );
    });
  });

  describe('mcp list - filter by client (Cycle 1.5)', () => {
    it('should filter MCPs when --client specified', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            // No client restrictions - available to all
          },
          github: {
            command: 'mcp-server-github',
            args: [],
            clients: {
              only: ['claude-code'], // Only for claude-code
            },
          },
        },
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list', '--client', 'claude-code']);

      // Should display both MCPs (memory has no restrictions, github is for claude-code)
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('memory'));
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('github'));
    });

    it('should exclude MCPs not compatible with specified client', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            clients: {
              only: ['claude-code'],
            },
          },
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            clients: {
              only: ['cursor'],
            },
          },
        },
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list', '--client', 'claude-code']);

      // Should only show memory (for claude-code)
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('memory'));

      // Should NOT show filesystem (for cursor only)
      const calls = vi.mocked(deps.output.info).mock.calls;
      const hasFilesystem = calls.some(([msg]) =>
        typeof msg === 'string' && msg.includes('filesystem')
      );
      expect(hasFilesystem).toBe(false);
    });

    it('should respect clients.except exclusions', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            clients: {
              except: ['cursor'], // Not for cursor
            },
          },
        },
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list', '--client', 'cursor']);

      // Should warn about no MCPs (memory is excluded for cursor)
      expect(deps.output.warn).toHaveBeenCalledWith(expect.stringContaining('No MCP'));
    });

    it('should show all MCPs when no client filter', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            clients: {
              only: ['claude-code'],
            },
          },
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            clients: {
              only: ['cursor'],
            },
          },
        },
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should show both MCPs (no filter applied)
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('memory'));
      expect(deps.output.info).toHaveBeenCalledWith(expect.stringContaining('filesystem'));
    });
  });
});
