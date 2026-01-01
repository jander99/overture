/**
 * @overture/formatters
 *
 * McpFormatter unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpFormatter } from './mcp-formatter.js';
import type { OutputPort } from '@overture/ports-output';
import type { McpCheckResult } from '@overture/diagnostics-types';

describe('McpFormatter', () => {
  let output: OutputPort;
  let formatter: McpFormatter;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    output = {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    formatter = new McpFormatter(output);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('formatMcpResults', () => {
    it('should not output anything for empty MCP servers', () => {
      const mcpResult: McpCheckResult = {
        mcpServers: [],
        summary: {
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
        },
      };

      formatter.formatMcpResults(mcpResult, false);

      expect(output.info).not.toHaveBeenCalled();
    });

    it('should format available MCP server', () => {
      const mcpResult: McpCheckResult = {
        mcpServers: [
          {
            name: 'filesystem',
            command: 'npx',
            available: true,
            source: 'user',
          },
        ],
        summary: {
          mcpCommandsAvailable: 1,
          mcpCommandsMissing: 0,
        },
      };

      formatter.formatMcpResults(mcpResult, false);

      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('Checking MCP servers'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('filesystem'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('(found)'),
      );
    });

    it('should format available MCP server with source in verbose mode', () => {
      const mcpResult: McpCheckResult = {
        mcpServers: [
          {
            name: 'memory',
            command: 'npx',
            available: true,
            source: 'project',
          },
        ],
        summary: {
          mcpCommandsAvailable: 1,
          mcpCommandsMissing: 0,
        },
      };

      formatter.formatMcpResults(mcpResult, true);

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('[project]'),
      );
    });

    it('should not show source tag in non-verbose mode', () => {
      const mcpResult: McpCheckResult = {
        mcpServers: [
          {
            name: 'github',
            command: 'mcp-server-github',
            available: true,
            source: 'user',
          },
        ],
        summary: {
          mcpCommandsAvailable: 1,
          mcpCommandsMissing: 0,
        },
      };

      formatter.formatMcpResults(mcpResult, false);

      const successCalls = (output.success as ReturnType<typeof vi.fn>).mock
        .calls;
      const hasSourceTag = successCalls.some((call) =>
        String(call[0]).includes('[user]'),
      );
      expect(hasSourceTag).toBe(false);
    });

    it('should format missing MCP server with recommendation', () => {
      const mcpResult: McpCheckResult = {
        mcpServers: [
          {
            name: 'python-repl',
            command: 'uvx',
            available: false,
            source: 'project',
          },
        ],
        summary: {
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 1,
        },
      };

      formatter.formatMcpResults(mcpResult, false);

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('python-repl'),
      );
      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('(not found)'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Install uv'),
      );
    });

    it('should format missing MCP server with mcp-server-* recommendation', () => {
      const mcpResult: McpCheckResult = {
        mcpServers: [
          {
            name: 'custom',
            command: 'mcp-server-custom',
            available: false,
            source: 'user',
          },
        ],
        summary: {
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 1,
        },
      };

      formatter.formatMcpResults(mcpResult, false);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('npx -y mcp-server-custom'),
      );
    });

    it('should format multiple MCP servers', () => {
      const mcpResult: McpCheckResult = {
        mcpServers: [
          {
            name: 'filesystem',
            command: 'npx',
            available: true,
            source: 'user',
          },
          {
            name: 'memory',
            command: 'npx',
            available: true,
            source: 'user',
          },
          {
            name: 'python-repl',
            command: 'uvx',
            available: false,
            source: 'project',
          },
        ],
        summary: {
          mcpCommandsAvailable: 2,
          mcpCommandsMissing: 1,
        },
      };

      formatter.formatMcpResults(mcpResult, false);

      expect(output.success).toHaveBeenCalledTimes(2);
      expect(output.warn).toHaveBeenCalledTimes(1);
    });

    it('should format unknown command with generic recommendation', () => {
      const mcpResult: McpCheckResult = {
        mcpServers: [
          {
            name: 'custom-tool',
            command: 'custom-binary',
            available: false,
            source: 'user',
          },
        ],
        summary: {
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 1,
        },
      };

      formatter.formatMcpResults(mcpResult, false);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ensure custom-binary is installed'),
      );
    });
  });

  describe('formatMcpSummary', () => {
    it('should format MCP summary with all available', () => {
      formatter.formatMcpSummary(3, 3, 0);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(''));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP commands available:'),
      );
    });

    it('should format MCP summary with missing commands', () => {
      formatter.formatMcpSummary(3, 2, 1);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP commands missing:'),
      );
    });

    it('should not show missing commands when zero', () => {
      formatter.formatMcpSummary(3, 3, 0);

      const missingCalls = consoleSpy.mock.calls.filter((call: unknown[]) =>
        String(call[0]).includes('missing'),
      );
      expect(missingCalls).toHaveLength(0);
    });

    it('should not output anything when no MCP servers configured', () => {
      formatter.formatMcpSummary(0, 0, 0);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
