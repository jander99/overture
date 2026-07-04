/**
 * Contract tests for the Claude Code metadata-only MCP write (E3 slice).
 *
 * These tests cover the E3 wiring contract:
 *  1. `not-targetable` when no applicable target file exists.
 *  2. `dryRun` is honored (echoed on the result).
 *  3. The result carries no raw bytes regardless of the reason.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
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
  claudeCode,
  normalizeClaudeCodeMcpServers,
  type ClaudeCodeMcpConfig,
} from './claude-code.js';
import type { AgentMcpReadResult } from './types.js';
import { runPreservationChecks } from './writer-preservation/index.js';
import { CLAUDE_CODE_FIXTURE } from './writer-preservation/fixtures.js';

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

/**
 * Inline fixture for Claude Code user-projects config:
 * ~/.claude.json with projects[workspaceDir].mcpServers (NOT top-level mcpServers).
 *
 * NOTE: template-literal `\${` sequences are intentional — literal `${VAR}` strings
 * in the fixture must remain as literal text, not be evaluated as template expressions.
 */
const CLAUDE_CODE_USER_PROJECTS_FIXTURE = `
  // ~/.claude.json — Claude Code with workspace-scoped MCP config
  {
  "numStartups": 42,
  "hasCompletedOnboarding": true,
  "projects": {
    "\${WORKSPACE_DIR}": {
      "mcpServers": {
        "filesystem": {
          "command": "npx",
          "args": [
            "-y",
            "@modelcontextprotocol/server-filesystem",
            "/home/user/projects"
          ],
          "env": {
            "LOG_LEVEL": "info"
          }
        },
        "context7": {
          "command": "npx",
          "args": [
            "-y",
            "@upstash/context7-mcp@latest"
          ],
          "env": {
            "CONTEXT7_API_KEY": "\${CONTEXT7_API_KEY}"
          }
        }
      }
    }
  }
  }
`;

/**
 * Assumptions about `toClaudeCodeMcpServer(canonical, existing)` shape:
 * - canonical: OvertureMcpServer (canonical shape)
 * - existing: optional ClaudeCodeWritableMcpServer (native shape from config)
 * - Returns ClaudeCodeWritableMcpServer preserving extension fields from existing
 * - Todo 4 will implement the actual writer logic that calls this function
 */

/**
 * E3 byte-splice tests for claudeCode.mcp.write.
 *
 * These tests call through claudeCode.mcp.write (the registry path), not just
 * writeClaudeCodeMcpConfig directly, so the full wiring contract is exercised.
 *
 * Target selection:
 *   1. project  <workspaceDir>/.mcp.json
 *   2. user-top ~/.claude.json top-level mcpServers
 *   3. user-projects ~/.claude.json projects[workspaceDir].mcpServers
 *
 * The stub returns parse-error after confirming the target exists, so these tests
 * will fail at runtime until Todo 4 implements the real writer.
 */
describe('claudeCode.mcp.write (E3 byte-splice)', () => {
  // ----- helpers -----

  /**
  /**
   * writeAndHarness for Claude Code — mirrors opencode writeAndHarness pattern.
   *
   * Performs two real writer invocations via claudeCode.mcp.write:
   *   1. First apply → reads on-disk bytes as `written`
   *   2. Second apply → reads on-disk bytes as `rewritten`
   *
   * Then runs runPreservationChecks to verify byte-level fidelity.
   */
  async function claudeCodeWriteAndHarness(
    ctx: PathResolutionContext,
    servers: readonly { name: string; server: OvertureMcpServer }[],
    fixturePath: string,
    fixtureContent: string,
    targetPath: readonly string[],
  ): Promise<{
    caught: unknown;
    report: ReturnType<typeof runPreservationChecks>;
    written: string;
    rewritten: string;
    fixturePath: string;
  }> {
    // Seed the fixture file
    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir(join(fixturePath, '..'), { recursive: true });
    await writeFile(fixturePath, fixtureContent, 'utf-8');

    // ----- First apply -----
    let firstCaught: unknown = null;
    try {
      await claudeCode.mcp.write(ctx, { servers });
    } catch (err) {
      firstCaught = err;
    }

    let firstWritten = fixtureContent;
    try {
      firstWritten = await readFile(fixturePath, 'utf-8');
    } catch {
      // stub rejected before any IO; bytes on disk are the seeded fixture
    }

    // ----- Second apply: real second invocation for idempotency proof -----
    let secondCaught: unknown = null;
    try {
      await claudeCode.mcp.write(ctx, { servers });
    } catch (err) {
      secondCaught = err;
    }

    let secondWritten = firstWritten;
    try {
      secondWritten = await readFile(fixturePath, 'utf-8');
    } catch {
      // stub rejected before any IO during the second apply
    }

    const original = fixtureContent;
    const report = runPreservationChecks({
      format: 'jsonc',
      original,
      written: firstWritten,
      rewritten: secondWritten,
      targetPath,
    });

    // Surface first error if both threw; otherwise surface whichever threw.
    const caught = firstCaught ?? secondCaught;

    return {
      caught,
      report,
      written: firstWritten,
      rewritten: secondWritten,
      fixturePath,
    };
  }

  // ----- TARGET SELECTION: project .mcp.json -----
  describe('target selection: project .mcp.json', () => {
    it('resolves project .mcp.json when it exists', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      // Seed with valid top-level mcpServers (project-level format mirrors user-top)
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      // Stub still returns parse-error; when implemented it will return project targetPaths
      expect(result.targetPaths).toContainEqual(
        expect.objectContaining({ scope: 'project', base: 'workspace' }),
      );
    });

    it('F3: project .mcp.json divergent canonical triggers conflict refusal', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/updated/path',
        ],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      // F3: divergent settings refuse the write before byte-level
      // planning. The target resolution (project .mcp.json) still
      // surfaces; only the write is refused.
      expect(result.changed).toBe(false);
      expect(result.written).toBe(0);
      expect(result.serversWritten).toEqual([]);
      expect(result.format).toBe('jsonc');
      expect(result.resolvedPath).toBe(projectPath);
      expect(result.targetPaths).toContainEqual(
        expect.objectContaining({ scope: 'project', base: 'workspace' }),
      );
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts?.[0]?.serverName).toBe('filesystem');
    });
  });

  // ----- TARGET SELECTION: user-top ~/.claude.json -----
  describe('target selection: user-top ~/.claude.json', () => {
    it('resolves user ~/.claude.json top-level mcpServers when project absent', async () => {
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      await writeFile(userPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      expect(result.targetPaths).toContainEqual(
        expect.objectContaining({ scope: 'user', base: 'home' }),
      );
    });

    it('F3: user-top divergent canonical triggers conflict refusal', async () => {
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      await writeFile(userPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/updated/path',
        ],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      expect(result.changed).toBe(false);
      expect(result.written).toBe(0);
      expect(result.dryRun).toBe(false);
      expect(result.serversWritten).toEqual([]);
      expect(result.format).toBe('jsonc');
      expect(result.resolvedPath).toBe(userPath);
      expect(result.targetPaths).toHaveLength(1);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts?.[0]?.serverName).toBe('filesystem');
    });
  });

  // ----- TARGET SELECTION: user-projects ~/.claude.json.projects[ws].mcpServers -----
  describe('target selection: user-projects ~/.claude.json.projects[ws].mcpServers', () => {
    it('resolves user-projects when workspaceDir key exists in projects', async () => {
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      // Substitute workspace dir placeholder
      const fixtureWithWs = CLAUDE_CODE_USER_PROJECTS_FIXTURE.replace(
        '\${WORKSPACE_DIR}',
        ctx.workspaceDir,
      );
      await writeFile(userPath, fixtureWithWs, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      expect(result.targetPaths).toContainEqual(
        expect.objectContaining({ scope: 'user', base: 'home' }),
      );
    });

    it('F3: user-projects divergent canonical triggers conflict refusal', async () => {
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      const fixtureWithWs = CLAUDE_CODE_USER_PROJECTS_FIXTURE.replace(
        '\${WORKSPACE_DIR}',
        ctx.workspaceDir,
      );
      await writeFile(userPath, fixtureWithWs, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/updated/path',
        ],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      // F3: target resolved (user-projects path), but divergent
      // settings refuse the write before byte-level planning.
      expect(result.changed).toBe(false);
      expect(result.written).toBe(0);
      expect(result.serversWritten).toEqual([]);
      expect(result.format).toBe('jsonc');
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts?.[0]?.serverName).toBe('filesystem');
    });
  });

  // ----- METADATA ENVELOPE: F3 conflict refusal -----
  describe('metadata envelope: F3 conflict refusal', () => {
    it('returns written:0, changed:false, dryRun:false, conflicts populated, targetPaths, resolvedPath', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/updated'],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      // F3 supersedes the pre-F3 "changed update" envelope: divergent
      // settings now refuse the write before byte-level planning.
      expect(result.written).toBe(0);
      expect(result.changed).toBe(false);
      expect(result.dryRun).toBe(false);
      expect(result.serversWritten).toEqual([]);
      expect(result.targetPaths).toHaveLength(1);
      expect(result.format).toBe('jsonc');
      expect(result.resolvedPath).toBe(projectPath);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts?.[0]?.serverName).toBe('filesystem');
      expect(result.conflicts?.[0]?.message).toContain('canonical and agent');
      expect(result.conflicts?.[0]?.diffKeys).toContain('args');
    });
  });

  // ----- METADATA ENVELOPE: no-change -----
  describe('metadata envelope: no-change', () => {
    it('returns written:0, changed:false, reason:no-change when state matches', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      // Server state already matches fixture — update to same value is a no-op
      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/home/user/projects',
        ],
        env: { LOG_LEVEL: 'info' },
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      expect(result.written).toBe(0);
      expect(result.changed).toBe(false);
      expect(result.reason).toBe('no-change');
    });
  });

  // ----- METADATA ENVELOPE: dry-run -----
  describe('metadata envelope: dry-run', () => {
    it('F3 dry-run: divergent canonical triggers conflict refusal with dryRun flag, leaves disk unchanged', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir, readFile } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/dry-run-path',
        ],
      };
      const beforeBytes = await readFile(projectPath, 'utf-8');

      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.changed).toBe(false);
      expect(result.written).toBe(0); // no disk write occurred
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts?.[0]?.serverName).toBe('filesystem');
      expect(result.format).toBe('jsonc');
      expect(result.resolvedPath).toBe(projectPath);

      // Disk must NOT have been modified
      const afterBytes = await readFile(projectPath, 'utf-8');
      expect(afterBytes).toBe(beforeBytes);
    });
  });

  // ----- ERROR PATH: missing file -----
  describe('error path: missing file', () => {
    it('returns reason:not-targetable when no applicable target exists', async () => {
      const ctx = makeCtx();
      // scratchDir has no .mcp.json in workspace and no .claude.json in home
      const result = await claudeCode.mcp.write(ctx, { servers: [] });

      expect(result.written).toBe(0);
      expect(result.changed).toBe(false);
      expect(result.reason).toBe('not-targetable');
      expect(result.targetPaths).toEqual([]);
    });
  });

  // ----- ERROR PATH: malformed JSONC -----
  describe('error path: malformed JSONC', () => {
    it('returns reason:parse-error for malformed JSONC file', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, '{ this is not valid json }', 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      expect(result.reason).toBe('parse-error');
      expect(result.written).toBe(0);
      expect(result.changed).toBe(false);
    });

    it('returns reason:parse-error for malformed user-top JSONC', async () => {
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      await writeFile(userPath, '{ broken: json, }', 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      expect(result.reason).toBe('parse-error');
    });
  });

  // ----- ERROR PATH: non-map mcpServers container -----
  describe('error path: non-map mcpServers container', () => {
    it('returns reason:unsupported-shape when mcpServers is not an object', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      // mcpServers as a string, not an object
      await writeFile(
        projectPath,
        '{ "mcpServers": "not an object" }',
        'utf-8',
      );

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      expect(result.reason).toBe('unsupported-shape');
      expect(result.written).toBe(0);
    });

    it('returns reason:unsupported-shape for user-projects when nested mcpServers is not an object', async () => {
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      // projects[workspaceDir].mcpServers as string
      const badFixture = JSON.stringify({
        projects: {
          [ctx.workspaceDir]: { mcpServers: 'not an object' },
        },
      });
      await writeFile(userPath, badFixture, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: filesystemServer }],
      });

      expect(result.reason).toBe('unsupported-shape');
    });
  });

  // ----- ERROR PATH: missing server name -----
  describe('error path: missing server name', () => {
    it('returns reason:not-targetable when server name absent from config', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      // Try to update a server that does not exist in fixture
      const ghostServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/ghost'],
      };
      const result = await claudeCode.mcp.write(ctx, {
        servers: [{ name: 'ghost-server-not-in-fixture', server: ghostServer }],
      });

      // E3 is update-only: absent server name is not targetable
      expect(result.reason).toBe('not-targetable');
      expect(result.written).toBe(0);
    });
  });

  // ----- ERROR PATH: no targets at all -----
  describe('error path: no targets at all', () => {
    it('returns reason:not-targetable when pathContext has empty dirs', async () => {
      // EMPTY_CTX has all empty strings — no writable location possible
      const result = await claudeCode.mcp.write(EMPTY_CTX, { servers: [] });

      expect(result.reason).toBe('not-targetable');
      expect(result.targetPaths).toEqual([]);
      expect(result.written).toBe(0);
    });
  });

  // ----- E1 PRESERVATION: project -----
  describe('E1 — claudeCode.mcp.write preserves Claude JSONC (project)', () => {
    it('E3: project update passes runPreservationChecks.allPassed=true', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const updatedFilesystem: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };

      const { caught, report } = await claudeCodeWriteAndHarness(
        ctx,
        [{ name: 'filesystem', server: updatedFilesystem }],
        projectPath,
        CLAUDE_CODE_FIXTURE,
        ['mcpServers', 'filesystem'],
      );

      expect(caught).toBeNull();
      // RED phase: stub returns parse-error so allPassed will be false until Todo 4
      const failures = report.checks
        .filter((c) => !c.pass && !c.skipped)
        .map((c) => `${c.name}: ${c.details}`)
        .join('; ');
      expect(
        report.allPassed,
        `Expected all checks to pass. Failures: ${failures}`,
      ).toBe(true);
    });

    it('preserves Claude JSONC: comments outside targetPath are not stripped', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const { report } = await claudeCodeWriteAndHarness(
        ctx,
        [],
        projectPath,
        CLAUDE_CODE_FIXTURE,
        ['mcpServers', 'filesystem'],
      );
      const comments = report.checks.find((c) => c.name === 'comments');
      expect(
        comments?.pass,
        `comments check failed: ${comments?.details}`,
      ).toBe(true);
    });

    it('preserves Claude JSONC: top-level keys outside mcpServers are not deleted', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const { report } = await claudeCodeWriteAndHarness(
        ctx,
        [],
        projectPath,
        CLAUDE_CODE_FIXTURE,
        ['mcpServers', 'filesystem'],
      );
      const topLevelKeys = report.checks.find((c) => c.name === 'topLevelKeys');
      expect(
        topLevelKeys?.pass,
        `topLevelKeys check failed: ${topLevelKeys?.details}`,
      ).toBe(true);
    });

    it('preserves Claude JSONC: key order outside targetPath is not changed', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const { report } = await claudeCodeWriteAndHarness(
        ctx,
        [],
        projectPath,
        CLAUDE_CODE_FIXTURE,
        ['mcpServers', 'filesystem'],
      );
      const keyOrder = report.checks.find((c) => c.name === 'keyOrder');
      expect(
        keyOrder?.pass,
        `keyOrder check failed: ${keyOrder?.details}`,
      ).toBe(true);
    });

    it('preserves Claude JSONC: sibling mcp servers are not deleted', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const { report } = await claudeCodeWriteAndHarness(
        ctx,
        [],
        projectPath,
        CLAUDE_CODE_FIXTURE,
        ['mcpServers', 'filesystem'],
      );
      const mcpServers = report.checks.find((c) => c.name === 'mcpServers');
      expect(
        mcpServers?.pass,
        `mcpServers check failed: ${mcpServers?.details}`,
      ).toBe(true);
    });

    it('preserves Claude JSONC: whitespace and trailing newline are preserved', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const { report } = await claudeCodeWriteAndHarness(
        ctx,
        [],
        projectPath,
        CLAUDE_CODE_FIXTURE,
        ['mcpServers', 'filesystem'],
      );
      const formatting = report.checks.find((c) => c.name === 'formatting');
      expect(
        formatting?.pass,
        `formatting check failed: ${formatting?.details}`,
      ).toBe(true);
    });

    it('preserves Claude JSONC: env var placeholders survive', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const { written } = await claudeCodeWriteAndHarness(
        ctx,
        [],
        projectPath,
        CLAUDE_CODE_FIXTURE,
        ['mcpServers', 'filesystem'],
      );
      expect(written).toContain('\${CONTEXT7_API_KEY}');
    });

    it('E3: idempotency — second apply produces identical bytes', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/home/user/projects',
        ],
        env: { LOG_LEVEL: 'info' },
      };

      const {
        report,
        written: firstWritten,
        rewritten: secondWritten,
      } = await claudeCodeWriteAndHarness(
        ctx,
        [{ name: 'filesystem', server: filesystemServer }],
        projectPath,
        CLAUDE_CODE_FIXTURE,
        ['mcpServers', 'filesystem'],
      );

      // After a real second apply, bytes must be identical (idempotency)
      expect(secondWritten).toBe(firstWritten);
      const idem = report.checks.find((c) => c.name === 'idempotency');
      expect(idem?.pass, `idempotency check failed: ${idem?.details}`).toBe(
        true,
      );
    });
  });

  // ----- E1 PRESERVATION: user-projects -----
  describe('E1 — claudeCode.mcp.write preserves Claude JSONC (user-projects)', () => {
    it('E3: user-projects update passes runPreservationChecks.allPassed=true', async () => {
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      const fixtureWithWs = CLAUDE_CODE_USER_PROJECTS_FIXTURE.replace(
        '\${WORKSPACE_DIR}',
        ctx.workspaceDir,
      );
      await writeFile(userPath, fixtureWithWs, 'utf-8');

      const updatedFilesystem: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };

      const { caught, report } = await claudeCodeWriteAndHarness(
        ctx,
        [{ name: 'filesystem', server: updatedFilesystem }],
        userPath,
        fixtureWithWs,
        ['projects', ctx.workspaceDir, 'mcpServers', 'filesystem'],
      );

      expect(caught).toBeNull();
      const failures = report.checks
        .filter((c) => !c.pass && !c.skipped)
        .map((c) => `${c.name}: ${c.details}`)
        .join('; ');
      expect(
        report.allPassed,
        `Expected all checks to pass. Failures: ${failures}`,
      ).toBe(true);
    });

    it('preserves Claude JSONC: top-level keys outside projects are not deleted', async () => {
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      const fixtureWithWs = CLAUDE_CODE_USER_PROJECTS_FIXTURE.replace(
        '\${WORKSPACE_DIR}',
        ctx.workspaceDir,
      );
      await writeFile(userPath, fixtureWithWs, 'utf-8');

      const { report } = await claudeCodeWriteAndHarness(
        ctx,
        [],
        userPath,
        fixtureWithWs,
        ['projects', ctx.workspaceDir, 'mcpServers', 'filesystem'],
      );
      const topLevelKeys = report.checks.find((c) => c.name === 'topLevelKeys');
      expect(
        topLevelKeys?.pass,
        `topLevelKeys check failed: ${topLevelKeys?.details}`,
      ).toBe(true);
    });

    it('preserves Claude JSONC: sibling servers within projects[ws].mcpServers are preserved', async () => {
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      const fixtureWithWs = CLAUDE_CODE_USER_PROJECTS_FIXTURE.replace(
        '\${WORKSPACE_DIR}',
        ctx.workspaceDir,
      );
      await writeFile(userPath, fixtureWithWs, 'utf-8');

      const { report } = await claudeCodeWriteAndHarness(
        ctx,
        [],
        userPath,
        fixtureWithWs,
        ['projects', ctx.workspaceDir, 'mcpServers', 'filesystem'],
      );
      const mcpServers = report.checks.find((c) => c.name === 'mcpServers');
      expect(
        mcpServers?.pass,
        `mcpServers check failed: ${mcpServers?.details}`,
      ).toBe(true);
    });

    it('E3: user-projects idempotency — second apply produces identical bytes', async () => {
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      const fixtureWithWs = CLAUDE_CODE_USER_PROJECTS_FIXTURE.replace(
        '\${WORKSPACE_DIR}',
        ctx.workspaceDir,
      );
      await writeFile(userPath, fixtureWithWs, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/home/user/projects',
        ],
        env: { LOG_LEVEL: 'info' },
      };

      const {
        report,
        written: firstWritten,
        rewritten: secondWritten,
      } = await claudeCodeWriteAndHarness(
        ctx,
        [{ name: 'filesystem', server: filesystemServer }],
        userPath,
        fixtureWithWs,
        ['projects', ctx.workspaceDir, 'mcpServers', 'filesystem'],
      );

      expect(secondWritten).toBe(firstWritten);
      const idem = report.checks.find((c) => c.name === 'idempotency');
      expect(idem?.pass, `idempotency check failed: ${idem?.details}`).toBe(
        true,
      );
    });
  });

  // ----- REGISTRY SPY: second-apply idempotency -----
  describe('registry spy: claudeCode.mcp.write invoked exactly twice for real second-apply', () => {
    it('claudeCode.mcp.write is called exactly twice during writeAndHarness', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      await writeFile(projectPath, CLAUDE_CODE_FIXTURE, 'utf-8');

      const filesystemServer: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/home/user/projects',
        ],
        env: { LOG_LEVEL: 'info' },
      };

      // Spy on the registry writer BEFORE invoking the helper
      const writeSpy = vi.spyOn(claudeCode.mcp, 'write');

      try {
        const { report } = await claudeCodeWriteAndHarness(
          ctx,
          [{ name: 'filesystem', server: filesystemServer }],
          projectPath,
          CLAUDE_CODE_FIXTURE,
          ['mcpServers', 'filesystem'],
        );

        expect(
          writeSpy.mock.calls.length,
          `Expected claudeCode.mcp.write to be invoked exactly twice, but it was invoked ${writeSpy.mock.calls.length} time(s)`,
        ).toBe(2);

        // Sanity: the preservation report still passes for the writer
        expect(report.allPassed).toBe(true);
      } finally {
        writeSpy.mockRestore();
      }
    });
  });

  // ----- F3: conflict refusal across top-level + workspace scopes -----
  describe('F3: claudeCode.mcp.write conflict detection (workspace scope)', () => {
    /**
     * Build a Claude Code config fixture that has workspace-nested
     * `projects[workspaceDir].mcpServers` (no top-level mcpServers).
     */
    function workspaceOnlyFixture(workspaceDir: string): string {
      return JSON.stringify({
        numStartups: 42,
        hasCompletedOnboarding: true,
        projects: {
          [workspaceDir]: {
            mcpServers: {
              context7: {
                command: 'npx',
                args: ['-y', '@upstash/context7-mcp@latest'],
                env: { CONTEXT7_API_KEY: 'placeholder' },
              },
            },
          },
        },
      });
    }

    it('F3: workspace-only divergent context7 triggers conflict refusal', async () => {
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      await writeFile(
        userPath,
        workspaceOnlyFixture(ctx.workspaceDir),
        'utf-8',
      );

      const result = await claudeCode.mcp.write(ctx, {
        servers: [
          {
            name: 'context7',
            server: {
              type: 'stdio',
              command: 'npx',
              args: ['-y', 'something-else'],
            },
          },
        ],
      });

      expect(result.written).toBe(0);
      expect(result.changed).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts?.[0]?.serverName).toBe('context7');
      expect(result.conflicts?.[0]?.diffKeys).toContain('args');
    });

    it('F3: workspace overrides top-level on collision for the existing map', async () => {
      // The same server name lives in both top-level and workspace-nested
      // maps with divergent normalized shapes. The conflict check must
      // compare canonical against the WORKSPACE entry (which wins on
      // collision) — i.e., the workspace-divergent shape is what fires
      // the conflict, not the top-level one.
      const ctx = makeCtx();
      const userPath = join(ctx.homeDir, '.claude.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(userPath, '..'), { recursive: true });
      const fixtureBody = JSON.stringify({
        numStartups: 42,
        mcpServers: {
          shared: {
            command: 'top-cmd',
            args: ['top'],
          },
        },
        projects: {
          [ctx.workspaceDir]: {
            mcpServers: {
              shared: {
                command: 'ws-cmd',
                args: ['ws-1', 'ws-2'],
              },
            },
          },
        },
      });
      await writeFile(userPath, fixtureBody, 'utf-8');

      // Canonical matches the TOP-LEVEL entry exactly. With workspace-
      // overrides-top-level, the existing map uses ws-cmd; canonical
      // differs from ws-cmd (but matches top-cmd) → conflict fires
      // against the workspace entry.
      const result = await claudeCode.mcp.write(ctx, {
        servers: [
          {
            name: 'shared',
            server: { type: 'stdio', command: 'top-cmd', args: ['top'] },
          },
        ],
      });

      expect(result.conflicts).toBeDefined();
      expect(result.conflicts?.[0]?.serverName).toBe('shared');
      // workspace entry has command 'ws-cmd' vs canonical 'top-cmd' →
      // command + args both differ.
      expect(result.conflicts?.[0]?.diffKeys).toContain('command');
    });

    it('F3: top-level matching canonical proceeds byte-level (no-change)', async () => {
      const ctx = makeCtx();
      const projectPath = join(ctx.workspaceDir, '.mcp.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '..'), { recursive: true });
      const matchingFixture = JSON.stringify({
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@scope/server'],
          },
        },
      });
      await writeFile(projectPath, matchingFixture, 'utf-8');

      const result = await claudeCode.mcp.write(ctx, {
        servers: [
          {
            name: 'filesystem',
            server: {
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@scope/server'],
            },
          },
        ],
      });

      expect(result.conflicts).toBeUndefined();
      expect(result.reason).toBe('no-change');
    });
  });
});
