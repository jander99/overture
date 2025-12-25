/**
 * Import Service Tests
 *
 * @module @overture/import-core/import-service.spec
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from './import-service.js';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { OutputPort } from '@overture/ports-output';
import type {
  ClaudeCodeAdapter,
  OpenCodeAdapter,
  CopilotCliAdapter,
} from '@overture/client-adapters';
import type { Platform, OvertureConfig } from '@overture/config-types';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load test fixtures
const fixturesPath = join(__dirname, '__fixtures__');

const loadFixture = <T = Record<string, unknown>>(relativePath: string): T => {
  const content = readFileSync(join(fixturesPath, relativePath), 'utf-8');
  return JSON.parse(content) as T;
};

describe('ImportService', () => {
  let service: ImportService;
  let mockFilesystem: FilesystemPort;
  let mockOutput: OutputPort;
  let mockClaudeCodeAdapter: ClaudeCodeAdapter;
  let mockOpenCodeAdapter: OpenCodeAdapter;
  let mockCopilotCliAdapter: CopilotCliAdapter;

  const platform: Platform = 'linux';
  const emptyOvertureConfig: OvertureConfig = {
    version: '1.0',
    mcp: {},
  };

  beforeEach(() => {
    mockFilesystem = {
      exists: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      mkdir: vi.fn(),
      stat: vi.fn(),
      copyFile: vi.fn(),
    } as unknown as FilesystemPort;

    mockOutput = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      debug: vi.fn(),
    } as unknown as OutputPort;

    mockClaudeCodeAdapter = {
      readFullConfig: vi.fn(),
      detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
      readConfig: vi.fn(),
      writeConfig: vi.fn(),
      cleanupDirectoryMcps: vi.fn(),
      writeFullConfig: vi.fn(),
    } as unknown as ClaudeCodeAdapter;

    mockOpenCodeAdapter = {
      readConfig: vi.fn(),
      detectConfigPath: vi.fn().mockReturnValue({
        user: '/home/user/.config/opencode/opencode.json',
        project: '/project/opencode.json',
      }),
      writeConfig: vi.fn(),
      translateFromOpenCodeEnv: vi.fn((env) => {
        // Mock translation of {env:VAR} to ${VAR}
        if (!env) return env;
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(env)) {
          result[key] = value.replace(/\{env:([^}]+)\}/g, '${$1}');
        }
        return result;
      }),
    } as unknown as OpenCodeAdapter;

    mockCopilotCliAdapter = {
      readConfig: vi.fn(),
      detectConfigPath: vi.fn().mockReturnValue({
        user: '/home/user/.config/github-copilot/mcp.json',
        project: '/project/.github/mcp.json',
      }),
      writeConfig: vi.fn(),
      schemaRootKey: 'mcpServers',
    } as unknown as CopilotCliAdapter;

    service = new ImportService(mockFilesystem, mockOutput);
  });

  describe('discoverFromClaudeCode', () => {
    it('should discover global MCPs from top-level mcpServers', async () => {
      const fixture = loadFixture('claude-code/global-only.json');
      vi.mocked(mockClaudeCodeAdapter.readFullConfig).mockResolvedValue(
        fixture,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await service.discoverFromClaudeCode(
        mockClaudeCodeAdapter,
        emptyOvertureConfig,
        platform,
      );

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result[0]).toMatchObject({
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
        suggestedScope: 'global',
        source: {
          client: 'claude-code',
          locationType: 'global',
        },
      });
    });

    it('should convert hardcoded secrets to env var references', async () => {
      const fixture = loadFixture('claude-code/global-only.json');
      vi.mocked(mockClaudeCodeAdapter.readFullConfig).mockResolvedValue(
        fixture,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await service.discoverFromClaudeCode(
        mockClaudeCodeAdapter,
        emptyOvertureConfig,
        platform,
      );

      const githubMcp = result.find((m) => m.name === 'github');
      expect(githubMcp).toBeDefined();
      expect(githubMcp?.env?.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
      expect(githubMcp?.originalEnv?.GITHUB_TOKEN).toBe(
        'ghp_1234567890123456789012345678901234567890',
      );
      expect(githubMcp?.envVarsToSet).toContain('GITHUB_TOKEN');
    });

    it('should discover directory-based MCPs from projects object', async () => {
      const fixture = loadFixture('claude-code/with-projects.json');
      vi.mocked(mockClaudeCodeAdapter.readFullConfig).mockResolvedValue(
        fixture,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await service.discoverFromClaudeCode(
        mockClaudeCodeAdapter,
        emptyOvertureConfig,
        platform,
        '/home/user/projects/my-python-app',
      );

      const pythonRepl = result.find((m) => m.name === 'python-repl');
      expect(pythonRepl).toBeDefined();
      expect(pythonRepl?.suggestedScope).toBe('project');
      expect(pythonRepl?.source.locationType).toBe('directory-override');
    });

    it('should skip MCPs already managed by Overture', async () => {
      const fixture = loadFixture('claude-code/with-mcp-json.json');
      vi.mocked(mockClaudeCodeAdapter.readFullConfig).mockResolvedValue(
        fixture,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const overtureConfig: OvertureConfig = {
        version: '1.0',
        mcp: {
          'already-managed': {
            command: 'npx',
            args: ['-y', 'mcp-server-already-managed'],
          },
        },
      };

      const result = await service.discoverFromClaudeCode(
        mockClaudeCodeAdapter,
        overtureConfig,
        platform,
        '/home/user/projects/managed-project',
      );

      expect(result.find((m) => m.name === 'already-managed')).toBeUndefined();
      expect(result.find((m) => m.name === 'unmanaged-server')).toBeDefined();
    });
  });

  describe('discoverFromOpenCode', () => {
    it('should discover MCPs from OpenCode global config', async () => {
      const fixture = loadFixture('opencode/global.json');
      const userPath = '/home/user/.config/opencode/opencode.json';

      vi.mocked(mockFilesystem.exists).mockImplementation(
        async (path) => path === userPath,
      );
      vi.mocked(mockOpenCodeAdapter.readConfig).mockResolvedValue(fixture);

      const result = await service.discoverFromOpenCode(
        mockOpenCodeAdapter,
        emptyOvertureConfig,
        platform,
      );

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.find((m) => m.name === 'filesystem')).toBeDefined();
      expect(result.find((m) => m.name === 'github')).toBeDefined();
    });

    it('should convert OpenCode {env:VAR} format to ${VAR}', async () => {
      const fixture = loadFixture('opencode/global.json');
      const userPath = '/home/user/.config/opencode/opencode.json';

      vi.mocked(mockFilesystem.exists).mockImplementation(
        async (path) => path === userPath,
      );
      vi.mocked(mockOpenCodeAdapter.readConfig).mockResolvedValue(fixture);

      const result = await service.discoverFromOpenCode(
        mockOpenCodeAdapter,
        emptyOvertureConfig,
        platform,
      );

      const githubMcp = result.find((m) => m.name === 'github');
      expect(githubMcp?.env?.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
    });
  });

  describe('discoverFromCopilotCLI', () => {
    it('should discover MCPs from Copilot CLI config', async () => {
      const fixture = loadFixture('copilot-cli/config.json');
      const userPath = '/home/user/.config/github-copilot/mcp.json';

      vi.mocked(mockFilesystem.exists).mockImplementation(
        async (path) => path === userPath,
      );
      vi.mocked(mockCopilotCliAdapter.readConfig).mockResolvedValue(fixture);

      const result = await service.discoverFromCopilotCLI(
        mockCopilotCliAdapter,
        emptyOvertureConfig,
        platform,
      );

      expect(result).toHaveLength(2);
      expect(result.find((m) => m.name === 'filesystem')).toBeDefined();
      expect(result.find((m) => m.name === 'brave-search')).toBeDefined();
    });

    it('should convert hardcoded API keys to env vars', async () => {
      const fixture = loadFixture('copilot-cli/config.json');
      const userPath = '/home/user/.config/github-copilot/mcp.json';

      vi.mocked(mockFilesystem.exists).mockImplementation(
        async (path) => path === userPath,
      );
      vi.mocked(mockCopilotCliAdapter.readConfig).mockResolvedValue(fixture);

      const result = await service.discoverFromCopilotCLI(
        mockCopilotCliAdapter,
        emptyOvertureConfig,
        platform,
      );

      const braveSearch = result.find((m) => m.name === 'brave-search');
      expect(braveSearch?.env?.BRAVE_API_KEY).toBe('${API_KEY}');
      expect(braveSearch?.originalEnv?.BRAVE_API_KEY).toBe(
        'BSA1234567890123456789012345678901234567890',
      );
      expect(braveSearch?.envVarsToSet).toContain('API_KEY');
    });
  });

  describe('importMcps', () => {
    it('should write MCPs to config file', async () => {
      const mcpsToImport = [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
          transport: 'stdio' as const,
          suggestedScope: 'global' as const,
          source: {
            client: 'claude-code' as const,
            location: '~/.claude.json',
            locationType: 'global' as const,
            filePath: '/home/user/.claude.json',
          },
        },
      ];

      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await service.importMcps(
        mcpsToImport,
        '/home/user/.config/overture/config.yaml',
        '/project/.overture/config.yaml',
        false,
      );

      expect(result.imported).toHaveLength(1);
      expect(result.scopesModified).toContain('global');
      expect(mockFilesystem.writeFile).toHaveBeenCalledWith(
        '/home/user/.config/overture/config.yaml',
        expect.stringContaining('filesystem:'),
      );
    });

    it('should handle dry run without writing files', async () => {
      const mcpsToImport = [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
          transport: 'stdio' as const,
          suggestedScope: 'global' as const,
          source: {
            client: 'claude-code' as const,
            location: '~/.claude.json',
            locationType: 'global' as const,
            filePath: '/home/user/.claude.json',
          },
        },
      ];

      const result = await service.importMcps(
        mcpsToImport,
        '/home/user/.config/overture/config.yaml',
        '/project/.overture/config.yaml',
        true, // Dry run
      );

      expect(result.imported).toHaveLength(1);
      expect(mockFilesystem.writeFile).not.toHaveBeenCalled();
    });
  });
});
