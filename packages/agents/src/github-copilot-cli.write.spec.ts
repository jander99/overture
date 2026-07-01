/**
 * Contract tests for the GitHub Copilot CLI metadata-only MCP write (E3 slice).
 *
 * These tests cover the E3 wiring contract:
 *  1. `not-targetable` when no applicable target file exists.
 *  2. `dryRun` is honored (echoed on the result).
 *  3. The result carries no raw bytes regardless of the reason.
 */
import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeGitHubCopilotCliMcpConfig, toGitHubCopilotCliMcpServer } from './github-copilot-cli-write.js';
import type { PathResolutionContext } from './types.js';
import type { OvertureMcpServer } from '@overture/config';
import {
  normalizeGitHubCopilotCliMcpServers,
  type GitHubCopilotCliMcpConfig,
} from './github-copilot-cli.js';
import type { AgentMcpReadResult } from './types.js';

const EMPTY_CTX = {
  homeDir: '',
  configDir: '',
  workspaceDir: '',
  platform: 'linux' as const,
} satisfies PathResolutionContext;

async function tmp(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'copilot-write-'));
}

describe('writeGitHubCopilotCliMcpConfig', () => {
  it('returns not-targetable when no pathContext', async () => {
    const res = await writeGitHubCopilotCliMcpConfig(EMPTY_CTX, {
      servers: [],
    });
    expect(res.reason).toBe('not-targetable');
    expect(res.written).toBe(0);
    expect(res.changed).toBe(false);
  });

  it('returns not-targetable when neither workspace nor user config exists', async () => {
    const home = await tmp();
    try {
      const ctx = {
        homeDir: home,
        configDir: home,
        workspaceDir: '/nonexistent',
        platform: 'linux' as const,
      };
      const res = await writeGitHubCopilotCliMcpConfig(ctx, {
        servers: [],
      });
      expect(res.reason).toBe('not-targetable');
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it('returns metadata-only result (no raw bytes)', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      const copilotDir = join(home, '.copilot');
      await mkdir(copilotDir, { recursive: true });
      const userConfig = join(copilotDir, 'mcp-config.json');
      await writeFile(userConfig, '{"mcpServers":{}}');
      const ctx = {
        homeDir: home,
        configDir: home,
        workspaceDir: ws,
        platform: 'linux' as const,
      };
      const res = await writeGitHubCopilotCliMcpConfig(ctx, {
        servers: [],
        dryRun: true,
      });
      expect(res.dryRun).toBe(true);
      // No raw bytes field; only metadata.
      expect(
        (res as unknown as { original?: unknown }).original,
      ).toBeUndefined();
      expect(
        (res as unknown as { written_bytes?: unknown }).written_bytes,
      ).toBeUndefined();
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });
});

describe('toGitHubCopilotCliMcpServer', () => {
  it('canonical stdio round-trips: stdio → native → parse-back → equal', () => {
    const canonical: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      env: { NODE_ENV: 'production' },
    };

    const native = toGitHubCopilotCliMcpServer(canonical);

    expect(native.type).toBe('local');
    if (native.type !== 'local') {
      throw new Error('Expected local server');
    }
    expect(native.command).toBe('npx');
    expect(native.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
    expect(native.env).toEqual({ NODE_ENV: 'production' });

    const parsed = normalizeGitHubCopilotCliMcpServers({
      config: { mcpServers: { srv: native } } as GitHubCopilotCliMcpConfig,
      nonEmpty: true,
    } satisfies AgentMcpReadResult<GitHubCopilotCliMcpConfig>);

    expect(parsed['srv']).toEqual({
      state: 'normalized',
      server: canonical,
    });
  });

  it('canonical remote round-trips: remote → native → parse-back → equal', () => {
    const canonical: OvertureMcpServer = {
      type: 'remote',
      url: 'https://mcp.example.com/bridge',
      headers: { Authorization: 'Bearer token' },
    };

    const native = toGitHubCopilotCliMcpServer(canonical);

    expect(native.type).toBe('http');
    if (native.type !== 'http') {
      throw new Error('Expected http server');
    }
    expect(native.url).toBe('https://mcp.example.com/bridge');
    expect(native.headers).toEqual({ Authorization: 'Bearer token' });

    const parsed = normalizeGitHubCopilotCliMcpServers({
      config: { mcpServers: { srv: native } } as GitHubCopilotCliMcpConfig,
      nonEmpty: true,
    } satisfies AgentMcpReadResult<GitHubCopilotCliMcpConfig>);

    expect(parsed['srv']).toEqual({
      state: 'normalized',
      server: canonical,
    });
  });

  it('canonical remote without headers round-trips correctly', () => {
    const canonical: OvertureMcpServer = {
      type: 'remote',
      url: 'https://mcp.example.com/bridge',
    };

    const native = toGitHubCopilotCliMcpServer(canonical);

    expect(native.type).toBe('http');
    if (native.type !== 'http') {
      throw new Error('Expected http server');
    }
    expect(native.url).toBe('https://mcp.example.com/bridge');
    expect(Object.hasOwn(native, 'headers')).toBe(false);

    const parsed = normalizeGitHubCopilotCliMcpServers({
      config: { mcpServers: { srv: native } } as GitHubCopilotCliMcpConfig,
      nonEmpty: true,
    } satisfies AgentMcpReadResult<GitHubCopilotCliMcpConfig>);

    expect(parsed['srv']).toEqual({
      state: 'normalized',
      server: canonical,
    });
  });

  it('extension preservation: existing local entry keeps tools and cwd', () => {
    const canonical: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'server'],
      env: { NEW_ENV: 'value' },
    };
    const existing = {
      type: 'local' as const,
      command: 'old-command',
      tools: ['read', 'write'],
      cwd: '/project',
      unknownField: 'preserved',
    };

    const result = toGitHubCopilotCliMcpServer(canonical, existing);

    expect(result.type).toBe('local');
    if (result.type !== 'local') {
      throw new Error('Expected local server');
    }
    expect(result.command).toBe('npx');
    expect(result.args).toEqual(['-y', 'server']);
    expect(result.env).toEqual({ NEW_ENV: 'value' });
    expect((result as Record<string, unknown>)['tools']).toEqual(['read', 'write']);
    expect((result as Record<string, unknown>)['cwd']).toBe('/project');
    expect((result as Record<string, unknown>)['unknownField']).toBe('preserved');
  });

  it('extension preservation: existing remote entry keeps tools and unknown fields', () => {
    const canonical: OvertureMcpServer = {
      type: 'remote',
      url: 'https://new.example.com',
      headers: { Authorization: 'Bearer new' },
    };
    const existing = {
      type: 'http' as const,
      url: 'https://old.example.com',
      headers: { Authorization: 'Bearer old' },
      tools: ['read'],
      unknownField: 'preserved',
    };

    const result = toGitHubCopilotCliMcpServer(canonical, existing);

    expect(result.type).toBe('http');
    if (result.type !== 'http') {
      throw new Error('Expected http server');
    }
    expect(result.url).toBe('https://new.example.com');
    expect(result.headers).toEqual({ Authorization: 'Bearer new' });
    expect((result as Record<string, unknown>)['tools']).toEqual(['read']);
    expect((result as Record<string, unknown>)['unknownField']).toBe('preserved');
  });
});
