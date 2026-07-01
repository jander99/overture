/**
 * Contract tests for the Claude Code metadata-only MCP write (E3 slice).
 *
 * These tests cover the E3 wiring contract:
 *  1. `not-targetable` when no applicable target file exists.
 *  2. `dryRun` is honored (echoed on the result).
 *  3. The result carries no raw bytes regardless of the reason.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  writeClaudeCodeMcpConfig,
  toClaudeCodeMcpServer,
} from './claude-code-write.js';
import type {
  AgentMcpWriteInput,
  AgentMcpWriteResult,
  PathResolutionContext,
} from './types.js';
import type { OvertureMcpServer } from '@overture/config';
import {
  normalizeClaudeCodeMcpServers,
  type ClaudeCodeMcpConfig,
} from './claude-code.js';
import type { AgentMcpReadResult } from './types.js';

const EMPTY_CTX = {
  homeDir: '',
  configDir: '',
  workspaceDir: '',
  platform: 'linux' as const,
} satisfies PathResolutionContext;

let scratchDir = '';

beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'overture-claude-write-'));
});

afterEach(async () => {
  if (scratchDir) {
    await rm(scratchDir, { recursive: true, force: true });
    scratchDir = '';
  }
});

function makeCtx(): PathResolutionContext {
  return {
    homeDir: scratchDir,
    configDir: scratchDir,
    workspaceDir: join(scratchDir, 'workspace'),
    platform: 'linux',
  };
}

function makeInput(
  ctx: PathResolutionContext | undefined,
  dryRun?: boolean,
): AgentMcpWriteInput {
  return {
    servers: [],
    ...(dryRun === undefined ? {} : { dryRun }),
    ...(ctx === undefined ? {} : { pathContext: ctx }),
  };
}

describe('writeClaudeCodeMcpConfig', () => {
  it('returns not-targetable when no applicable target exists', async () => {
    const result = await writeClaudeCodeMcpConfig(
      makeCtx(),
      makeInput(undefined),
    );

    expect(result.written).toBe(0);
    expect(result.changed).toBe(false);
    expect(result.dryRun).toBe(false);
    expect(result.serversWritten).toEqual([]);
    expect(result.targetPaths).toEqual([]);
    expect(result.reason).toBe('not-targetable');
  });

  it('returns not-targetable when pathContext is omitted', async () => {
    const result = await writeClaudeCodeMcpConfig(
      EMPTY_CTX,
      makeInput(undefined),
    );

    expect(result.reason).toBe('not-targetable');
    expect(result.targetPaths).toEqual([]);
  });

  it('respects dryRun when no target', async () => {
    const result = await writeClaudeCodeMcpConfig(
      makeCtx(),
      makeInput(undefined, true),
    );

    expect(result.dryRun).toBe(true);
    expect(result.reason).toBe('not-targetable');
    expect(result.changed).toBe(false);
  });

  it('returns metadata (no raw bytes) regardless of reason', async () => {
    const result: AgentMcpWriteResult = await writeClaudeCodeMcpConfig(
      makeCtx(),
      makeInput(undefined),
    );

    const forbidden = [
      'original',
      'writtenBytes',
      'raw',
      'contents',
      'rawBytes',
      'originalBytes',
      'configText',
      'fileContents',
    ];
    const keys = Object.keys(result);
    for (const f of forbidden) {
      expect(keys).not.toContain(f);
    }

    // Strictly no string key matches /original|writtenBytes|raw|contents/i
    const rawPattern = /original|writtenBytes|raw|contents/i;
    const rawKeys = keys.filter((k) => rawPattern.test(k));
    expect(rawKeys).toHaveLength(0);
  });
});

describe('toClaudeCodeMcpServer', () => {
  it('canonical stdio round-trips: stdio → native → parse-back → equal', () => {
    const canonical: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      env: { NODE_ENV: 'production' },
    };

    const native = toClaudeCodeMcpServer(canonical);

    expect(native.type).toBe('stdio');
    if (native.type !== 'stdio') {
      throw new Error('Expected stdio server');
    }
    expect(native.command).toBe('npx');
    expect(native.args).toEqual([
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '/tmp',
    ]);
    expect(native.env).toEqual({ NODE_ENV: 'production' });

    // Simulate parse-back via normalizeClaudeCodeMcpServers
    const parsed = normalizeClaudeCodeMcpServers({
      config: { mcpServers: { srv: native } } as ClaudeCodeMcpConfig,
      nonEmpty: true,
    } satisfies AgentMcpReadResult<ClaudeCodeMcpConfig>);

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

    const native = toClaudeCodeMcpServer(canonical);

    expect(native.type).toBe('http');
    if (native.type !== 'http') {
      throw new Error('Expected http server');
    }
    expect(native.url).toBe('https://mcp.example.com/bridge');
    expect(native.headers).toEqual({ Authorization: 'Bearer token' });

    // Simulate parse-back
    const parsed = normalizeClaudeCodeMcpServers({
      config: { mcpServers: { srv: native } } as ClaudeCodeMcpConfig,
      nonEmpty: true,
    } satisfies AgentMcpReadResult<ClaudeCodeMcpConfig>);

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

    const native = toClaudeCodeMcpServer(canonical);

    expect(native.type).toBe('http');
    if (native.type !== 'http') {
      throw new Error('Expected http server');
    }
    expect(native.url).toBe('https://mcp.example.com/bridge');
    expect(Object.hasOwn(native, 'headers')).toBe(false);

    const parsed = normalizeClaudeCodeMcpServers({
      config: { mcpServers: { srv: native } } as ClaudeCodeMcpConfig,
      nonEmpty: true,
    } satisfies AgentMcpReadResult<ClaudeCodeMcpConfig>);

    expect(parsed['srv']).toEqual({
      state: 'normalized',
      server: canonical,
    });
  });

  it('extension preservation: existing stdio entry keeps unknown fields', () => {
    const canonical: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'server'],
      env: { NEW_ENV: 'value' },
    };
    const existing = {
      type: 'stdio' as const,
      command: 'old-command',
      unknownField: 'preserved',
    };

    const result = toClaudeCodeMcpServer(canonical, existing);

    expect(result.type).toBe('stdio');
    if (result.type !== 'stdio') {
      throw new Error('Expected stdio server');
    }
    expect(result.command).toBe('npx');
    expect(result.args).toEqual(['-y', 'server']);
    expect(result.env).toEqual({ NEW_ENV: 'value' });
    expect((result as Record<string, unknown>)['unknownField']).toBe(
      'preserved',
    );
  });

  it('extension preservation: existing remote entry keeps unknown fields', () => {
    const canonical: OvertureMcpServer = {
      type: 'remote',
      url: 'https://new.example.com',
      headers: { Authorization: 'Bearer new' },
    };
    const existing = {
      type: 'http' as const,
      url: 'https://old.example.com',
      headers: { Authorization: 'Bearer old' },
      unknownField: 'preserved',
    };

    const result = toClaudeCodeMcpServer(canonical, existing);

    expect(result.type).toBe('http');
    if (result.type !== 'http') {
      throw new Error('Expected http server');
    }
    expect(result.url).toBe('https://new.example.com');
    expect(result.headers).toEqual({ Authorization: 'Bearer new' });
    expect((result as Record<string, unknown>)['unknownField']).toBe(
      'preserved',
    );
  });
});
