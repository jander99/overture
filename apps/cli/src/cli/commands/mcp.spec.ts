/**
 * MCP Command Tests
 *
 * Comprehensive tests for the `overture mcp` command group.
 * Tests MCP listing, filtering, enabling/disabling, and error cases.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMcpCommand } from './mcp.js';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock.js';
import type { AppDependencies } from '../../composition-root.js';
import type { OvertureConfig } from '@overture/config-types';

describe('mcp command', () => {
  let deps: AppDependencies;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    deps = createMockAppDependencies();
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
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
      expect(deps.configLoader.loadProjectConfig).toHaveBeenCalledWith(
        process.cwd(),
      );
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
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('MCP'),
      );

      // Should display both MCPs
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('filesystem'),
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('memory'),
      );
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
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('npx'),
      );
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
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('No MCP'),
      );
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
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('memory'),
      );

      // Should NOT display project MCP (filesystem)
      const calls = vi.mocked(deps.output.info).mock.calls;
      const hasFilesystem = calls.some(
        ([msg]) => typeof msg === 'string' && msg.includes('filesystem'),
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
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('filesystem'),
      );

      // Should NOT display global MCP (memory)
      const calls = vi.mocked(deps.output.info).mock.calls;
      const hasMemory = calls.some(
        ([msg]) => typeof msg === 'string' && msg.includes('memory'),
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
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('memory'),
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('filesystem'),
      );

      // Should display scope indicators
      const calls = vi.mocked(deps.output.info).mock.calls;
      const hasGlobalIndicator = calls.some(
        ([msg]) =>
          typeof msg === 'string' &&
          (msg.includes('global') || msg.includes('Global')),
      );
      const hasProjectIndicator = calls.some(
        ([msg]) =>
          typeof msg === 'string' &&
          (msg.includes('project') || msg.includes('Project')),
      );

      expect(hasGlobalIndicator).toBe(true);
      expect(hasProjectIndicator).toBe(true);
    });

    it('should error on invalid scope value', async () => {
      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list', '--scope', 'invalid']);

      // Should display error for invalid scope
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid scope'),
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
              include: ['claude-code'], // Only for claude-code
            },
          },
        },
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const command = createMcpCommand(deps);
      await command.parseAsync([
        'node',
        'mcp',
        'list',
        '--client',
        'claude-code',
      ]);

      // Should display both MCPs (memory has no restrictions, github is for claude-code)
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('memory'),
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('github'),
      );
    });

    it('should exclude MCPs not compatible with specified client', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            clients: {
              include: ['claude-code'],
            },
          },
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            clients: {
              include: ['copilot-cli'],
            },
          },
        },
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const command = createMcpCommand(deps);
      await command.parseAsync([
        'node',
        'mcp',
        'list',
        '--client',
        'claude-code',
      ]);

      // Should only show memory (for claude-code)
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('memory'),
      );

      // Should NOT show filesystem (for cursor only)
      const calls = vi.mocked(deps.output.info).mock.calls;
      const hasFilesystem = calls.some(
        ([msg]) => typeof msg === 'string' && msg.includes('filesystem'),
      );
      expect(hasFilesystem).toBe(false);
    });

    it('should respect clients.exclude exclusions', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            clients: {
              exclude: ['copilot-cli'], // Not for cursor
            },
          },
        },
      });

      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const command = createMcpCommand(deps);
      await command.parseAsync([
        'node',
        'mcp',
        'list',
        '--client',
        'copilot-cli',
      ]);

      // Should warn about no MCPs (memory is excluded for cursor)
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('No MCP'),
      );
    });

    it('should show all MCPs when no client filter', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            clients: {
              include: ['claude-code'],
            },
          },
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            clients: {
              include: ['copilot-cli'],
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
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('memory'),
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('filesystem'),
      );
    });
  });

  describe('mcp list - error handling (Cycle 1.6)', () => {
    it('should handle config loading errors gracefully', async () => {
      const configError = new Error('Failed to load configuration');
      vi.mocked(deps.configLoader.loadUserConfig).mockRejectedValue(
        configError,
      );

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should display error message
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load'),
      );
    });

    it('should handle missing user config gracefully', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should warn about no MCPs
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('No MCP'),
      );
    });

    it('should handle user config without mcp field', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        // No mcp field - intentionally testing invalid config
      } as unknown as OvertureConfig);
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        // No mcp field - intentionally testing invalid config
      } as unknown as OvertureConfig);

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should warn about no MCPs
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('No MCP'),
      );
    });

    it('should handle project config loading errors gracefully', async () => {
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const configError = new Error('Failed to load project config');
      vi.mocked(deps.configLoader.loadProjectConfig).mockRejectedValue(
        configError,
      );

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'list']);

      // Should display error message
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load'),
      );
    });
  });

  describe('mcp enable - implementation (Cycle 1.7)', () => {
    it('should enable disabled MCP in project config', async () => {
      // Mock project config with disabled MCP
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            enabled: false,
          },
        },
      });

      // Mock filesystem write
      vi.mocked(deps.filesystem.writeFile).mockResolvedValue();

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'enable', 'memory']);

      // Should write updated config
      expect(deps.filesystem.writeFile).toHaveBeenCalled();

      // Should display success message
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('enabled'),
      );
    });

    it('should create project config if missing', async () => {
      // Mock no project config exists
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);

      // Mock user config has the MCP
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
          },
        },
      });

      // Mock pathResolver to return .overture/config.yaml path
      vi.mocked(deps.pathResolver.resolveProjectConfigPath).mockReturnValue(
        '.overture/config.yaml',
      );

      // Mock filesystem write
      vi.mocked(deps.filesystem.writeFile).mockResolvedValue();

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'enable', 'memory']);

      // Should create new config file
      expect(deps.filesystem.writeFile).toHaveBeenCalled();

      // Should display success message
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('enabled'),
      );
    });

    it('should merge with existing project config', async () => {
      // Mock project config with existing MCP
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
          },
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            enabled: false,
          },
        },
      });

      // Mock filesystem write
      vi.mocked(deps.filesystem.writeFile).mockResolvedValue();

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'enable', 'memory']);

      // Should preserve filesystem MCP in written config
      const writeCall = vi.mocked(deps.filesystem.writeFile).mock.calls[0];
      if (writeCall) {
        const writtenContent = writeCall[1];
        expect(writtenContent).toContain('filesystem');
        expect(writtenContent).toContain('memory');
      }
    });

    it('should display success message after enabling', async () => {
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            enabled: false,
          },
        },
      });

      vi.mocked(deps.filesystem.writeFile).mockResolvedValue();

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'enable', 'memory']);

      // Should display success message
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringMatching(/enabled|Memory/i),
      );
    });
  });

  describe('mcp enable - error handling (Cycle 1.8)', () => {
    it('should error when MCP not found in any config', async () => {
      // Mock no MCP in either config
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(null);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {},
      });

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'enable', 'nonexistent']);

      // Should display error
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
    });

    it('should warn when MCP is already enabled', async () => {
      // Mock project config with already enabled MCP
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            enabled: true,
          },
        },
      });

      vi.mocked(deps.filesystem.writeFile).mockResolvedValue();

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'enable', 'memory']);

      // Should warn (or still enable, but show it was already enabled)
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('already enabled'),
      );
    });

    it('should handle config write errors gracefully', async () => {
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
        version: '1.0' as const,
        mcp: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            enabled: false,
          },
        },
      });

      // Mock filesystem write to fail
      const writeError = new Error('Permission denied');
      vi.mocked(deps.filesystem.writeFile).mockRejectedValue(writeError);

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'enable', 'memory']);

      // Should display error
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied'),
      );
    });

    it('should handle config loading errors gracefully', async () => {
      const loadError = new Error('Failed to load config');
      vi.mocked(deps.configLoader.loadProjectConfig).mockRejectedValue(
        loadError,
      );

      const command = createMcpCommand(deps);
      await command.parseAsync(['node', 'mcp', 'enable', 'memory']);

      // Should display error
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load'),
      );
    });
  });
});
