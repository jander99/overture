import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpChecker } from './mcp-checker.js';
import type { ProcessPort } from '@overture/ports-process';
import type { OvertureConfig } from '@overture/config-types';

describe('McpChecker', () => {
  let mcpChecker: McpChecker;
  let mockProcess: ProcessPort;

  beforeEach(() => {
    mockProcess = {
      exec: vi.fn(),
      commandExists: vi.fn(),
    };

    mcpChecker = new McpChecker(mockProcess);
  });

  describe('checkMcpServers', () => {
    it('should check available MCP servers', async () => {
      const mergedConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
          },
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const mcpSources = {
        filesystem: 'user',
        github: 'project',
      };

      vi.mocked(mockProcess.commandExists)
        .mockResolvedValueOnce(true) // npx exists
        .mockResolvedValueOnce(true); // mcp-server-github exists

      const result = await mcpChecker.checkMcpServers(mergedConfig, mcpSources);

      expect(result.mcpServers).toHaveLength(2);
      expect(result.mcpServers[0]).toEqual({
        name: 'filesystem',
        command: 'npx',
        available: true,
        source: 'user',
      });
      expect(result.mcpServers[1]).toEqual({
        name: 'github',
        command: 'mcp-server-github',
        available: true,
        source: 'project',
      });

      expect(result.summary).toEqual({
        mcpCommandsAvailable: 2,
        mcpCommandsMissing: 0,
      });
    });

    it('should check missing MCP servers', async () => {
      const mergedConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
          },
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const mcpSources = {
        filesystem: 'user',
        github: 'project',
      };

      vi.mocked(mockProcess.commandExists)
        .mockResolvedValueOnce(false) // npx missing
        .mockResolvedValueOnce(false); // mcp-server-github missing

      const result = await mcpChecker.checkMcpServers(mergedConfig, mcpSources);

      expect(result.mcpServers).toHaveLength(2);
      expect(result.mcpServers[0]).toEqual({
        name: 'filesystem',
        command: 'npx',
        available: false,
        source: 'user',
      });
      expect(result.mcpServers[1]).toEqual({
        name: 'github',
        command: 'mcp-server-github',
        available: false,
        source: 'project',
      });

      expect(result.summary).toEqual({
        mcpCommandsAvailable: 0,
        mcpCommandsMissing: 2,
      });
    });

    it('should check mixed availability', async () => {
      const mergedConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
          },
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {},
            transport: 'stdio',
          },
          memory: {
            command: 'mcp-server-memory',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const mcpSources = {
        filesystem: 'user',
        github: 'project',
        memory: 'user',
      };

      vi.mocked(mockProcess.commandExists)
        .mockResolvedValueOnce(true) // npx exists
        .mockResolvedValueOnce(false) // mcp-server-github missing
        .mockResolvedValueOnce(true); // mcp-server-memory exists

      const result = await mcpChecker.checkMcpServers(mergedConfig, mcpSources);

      expect(result.mcpServers).toHaveLength(3);
      expect(result.mcpServers[0].available).toBe(true);
      expect(result.mcpServers[1].available).toBe(false);
      expect(result.mcpServers[2].available).toBe(true);

      expect(result.summary).toEqual({
        mcpCommandsAvailable: 2,
        mcpCommandsMissing: 1,
      });
    });

    it('should handle no MCP config (null mergedConfig)', async () => {
      const result = await mcpChecker.checkMcpServers(null, {});

      expect(result.mcpServers).toHaveLength(0);
      expect(result.summary).toEqual({
        mcpCommandsAvailable: 0,
        mcpCommandsMissing: 0,
      });
    });

    it('should handle empty MCP config', async () => {
      const mergedConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const result = await mcpChecker.checkMcpServers(mergedConfig, {});

      expect(result.mcpServers).toHaveLength(0);
      expect(result.summary).toEqual({
        mcpCommandsAvailable: 0,
        mcpCommandsMissing: 0,
      });
    });

    it('should handle undefined mcp field', async () => {
      const mergedConfig = {
        version: '2.0',
      } as OvertureConfig;

      const result = await mcpChecker.checkMcpServers(mergedConfig, {});

      expect(result.mcpServers).toHaveLength(0);
      expect(result.summary).toEqual({
        mcpCommandsAvailable: 0,
        mcpCommandsMissing: 0,
      });
    });

    it('should use "unknown" source for MCP not in sources', async () => {
      const mergedConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const mcpSources = {}; // Empty sources

      vi.mocked(mockProcess.commandExists).mockResolvedValue(true);

      const result = await mcpChecker.checkMcpServers(mergedConfig, mcpSources);

      expect(result.mcpServers[0]).toEqual({
        name: 'filesystem',
        command: 'npx',
        available: true,
        source: 'unknown',
      });
    });

    it('should handle complex MCP server definitions', async () => {
      const mergedConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          'python-repl': {
            command: 'uvx',
            args: ['mcp-server-python-repl'],
            env: {
              PYTHON_PATH: '/usr/bin/python3',
            },
            transport: 'stdio',
          },
          'custom-http-server': {
            command: 'node',
            args: ['server.js'],
            env: {},
            transport: 'http',
          },
        },
      };

      const mcpSources = {
        'python-repl': 'project',
        'custom-http-server': 'user',
      };

      vi.mocked(mockProcess.commandExists)
        .mockResolvedValueOnce(true) // uvx exists
        .mockResolvedValueOnce(true); // node exists

      const result = await mcpChecker.checkMcpServers(mergedConfig, mcpSources);

      expect(result.mcpServers).toHaveLength(2);
      expect(result.mcpServers[0]).toEqual({
        name: 'python-repl',
        command: 'uvx',
        available: true,
        source: 'project',
      });
      expect(result.mcpServers[1]).toEqual({
        name: 'custom-http-server',
        command: 'node',
        available: true,
        source: 'user',
      });
    });

    it('should handle commandExists rejections gracefully', async () => {
      const mergedConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const mcpSources = {
        filesystem: 'user',
      };

      // commandExists should never reject, but if it does we want to handle it
      vi.mocked(mockProcess.commandExists).mockRejectedValue(
        new Error('Command check failed'),
      );

      await expect(
        mcpChecker.checkMcpServers(mergedConfig, mcpSources),
      ).rejects.toThrow('Command check failed');
    });

    it('should maintain order of MCP servers from config', async () => {
      const mergedConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          alpha: {
            command: 'alpha-cmd',
            args: [],
            env: {},
            transport: 'stdio',
          },
          beta: {
            command: 'beta-cmd',
            args: [],
            env: {},
            transport: 'stdio',
          },
          gamma: {
            command: 'gamma-cmd',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const mcpSources = {
        alpha: 'user',
        beta: 'project',
        gamma: 'user',
      };

      vi.mocked(mockProcess.commandExists).mockResolvedValue(true);

      const result = await mcpChecker.checkMcpServers(mergedConfig, mcpSources);

      expect(result.mcpServers.map((s) => s.name)).toEqual([
        'alpha',
        'beta',
        'gamma',
      ]);
    });

    it('should correctly identify sources', async () => {
      const mergedConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          'user-mcp': {
            command: 'user-cmd',
            args: [],
            env: {},
            transport: 'stdio',
          },
          'project-mcp': {
            command: 'project-cmd',
            args: [],
            env: {},
            transport: 'stdio',
          },
          'unknown-mcp': {
            command: 'unknown-cmd',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const mcpSources = {
        'user-mcp': 'user',
        'project-mcp': 'project',
        // 'unknown-mcp' intentionally not in sources
      };

      vi.mocked(mockProcess.commandExists).mockResolvedValue(true);

      const result = await mcpChecker.checkMcpServers(mergedConfig, mcpSources);

      expect(result.mcpServers[0].source).toBe('user');
      expect(result.mcpServers[1].source).toBe('project');
      expect(result.mcpServers[2].source).toBe('unknown');
    });

    it('should handle special characters in MCP names', async () => {
      const mergedConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          'mcp-server-test': {
            command: 'test-cmd',
            args: [],
            env: {},
            transport: 'stdio',
          },
          '@scope/package': {
            command: 'scoped-cmd',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const mcpSources = {
        'mcp-server-test': 'user',
        '@scope/package': 'user',
      };

      vi.mocked(mockProcess.commandExists).mockResolvedValue(true);

      const result = await mcpChecker.checkMcpServers(mergedConfig, mcpSources);

      expect(result.mcpServers).toHaveLength(2);
      expect(result.mcpServers[0].name).toBe('mcp-server-test');
      expect(result.mcpServers[1].name).toBe('@scope/package');
    });

    it('should handle large number of MCP servers', async () => {
      const mcpConfig: Record<string, any> = {};
      const mcpSources: Record<string, string> = {};

      // Create 50 MCP servers
      for (let i = 0; i < 50; i++) {
        mcpConfig[`mcp-${i}`] = {
          command: `cmd-${i}`,
          args: [],
          env: {},
          transport: 'stdio',
        };
        mcpSources[`mcp-${i}`] = i % 2 === 0 ? 'user' : 'project';
      }

      const mergedConfig: OvertureConfig = {
        version: '2.0',
        mcp: mcpConfig,
      };

      // Mock half as available, half as missing
      vi.mocked(mockProcess.commandExists).mockImplementation(
        async () => Math.random() > 0.5,
      );

      const result = await mcpChecker.checkMcpServers(mergedConfig, mcpSources);

      expect(result.mcpServers).toHaveLength(50);
      expect(
        result.summary.mcpCommandsAvailable + result.summary.mcpCommandsMissing,
      ).toBe(50);
    });
  });
});
