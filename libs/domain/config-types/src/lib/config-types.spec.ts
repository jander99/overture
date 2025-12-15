/**
 * Config Types Tests
 *
 * Basic type validation tests for Overture configuration types.
 * These tests verify that the TypeScript types are correctly defined
 * and can represent valid configurations.
 *
 * @module config-types.spec
 */

import { describe, it, expect } from 'vitest';
import type { OvertureConfig, McpServerConfig, ClientName } from './config.types';

describe('config-types', () => {
  describe('OvertureConfig', () => {
    it('should accept minimal valid configuration', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {},
      };

      expect(config).toBeDefined();
      expect(config.version).toBe('1.0');
      expect(config.mcp).toEqual({});
    });

    it('should accept configuration with MCP servers', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            transport: 'stdio',
          },
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            transport: 'stdio',
          },
        },
      };

      expect(config.mcp).toHaveProperty('filesystem');
      expect(config.mcp).toHaveProperty('memory');
      expect(config.mcp.filesystem?.command).toBe('npx');
    });

    it('should accept configuration with plugins', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {},
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['python-repl', 'ruff'],
          },
        },
      };

      expect(config.plugins).toBeDefined();
      expect(config.plugins?.['python-development']).toBeDefined();
      expect(config.plugins?.['python-development'].mcps).toContain('python-repl');
    });

    it('should accept configuration with sync settings', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {},
        sync: {
          skipBinaryDetection: true,
          force: false,
        },
      };

      expect(config.sync).toBeDefined();
      expect(config.sync?.skipBinaryDetection).toBe(true);
    });
  });

  describe('McpServerConfig', () => {
    it('should accept stdio transport configuration', () => {
      const mcpConfig: McpServerConfig = {
        command: 'python',
        args: ['-m', 'mcp_server'],
        transport: 'stdio',
      };

      expect(mcpConfig.command).toBe('python');
      expect(mcpConfig.transport).toBe('stdio');
    });

    it('should accept SSE transport configuration', () => {
      const mcpConfig: McpServerConfig = {
        command: 'npx',
        args: ['mcp-server-sse'],
        transport: 'sse',
        url: 'http://localhost:3000/sse',
      };

      expect(mcpConfig.transport).toBe('sse');
      expect(mcpConfig.url).toBe('http://localhost:3000/sse');
    });

    it('should accept configuration with environment variables', () => {
      const mcpConfig: McpServerConfig = {
        command: 'mcp-github',
        transport: 'stdio',
        env: {
          GITHUB_TOKEN: '${GITHUB_TOKEN}',
          GITHUB_OWNER: 'my-org',
        },
      };

      expect(mcpConfig.env).toBeDefined();
      expect(mcpConfig.env?.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
    });

    it('should accept configuration with platform-specific commands', () => {
      const mcpConfig: McpServerConfig = {
        command: 'default-command',
        transport: 'stdio',
        platforms: {
          commandOverrides: {
            win32: 'windows-command.exe',
            darwin: 'macos-command',
          },
        },
      };

      expect(mcpConfig.platforms).toBeDefined();
      expect(mcpConfig.platforms?.commandOverrides?.win32).toBe('windows-command.exe');
    });

    it('should accept configuration with excludeClients', () => {
      const mcpConfig: McpServerConfig = {
        command: 'test-cmd',
        transport: 'stdio',
        excludeClients: ['vscode', 'cursor'],
      };

      expect(mcpConfig.excludeClients).toBeDefined();
      expect(mcpConfig.excludeClients).toContain('vscode');
      expect(mcpConfig.excludeClients).toContain('cursor');
    });
  });

  describe('ClientName', () => {
    it('should accept valid client names', () => {
      const clients: ClientName[] = [
        'claude-code',
        'claude-desktop',
        'vscode',
        'cursor',
        'windsurf',
        'copilot-cli',
        'jetbrains-copilot',
      ];

      expect(clients.length).toBe(7);
      expect(clients).toContain('claude-code');
      expect(clients).toContain('vscode');
    });
  });
});
