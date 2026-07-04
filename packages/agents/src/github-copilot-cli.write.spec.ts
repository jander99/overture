/**
 * Contract tests for the GitHub Copilot CLI metadata-only MCP write (E3 slice).
 *
 * These tests cover the E3 wiring contract:
 *  1. `not-targetable` when no applicable target file exists.
 *  2. `dryRun` is honored (echoed on the result).
 *  3. The result carries no raw bytes regardless of the reason.
 */
import { parse as parseJsonc } from 'jsonc-parser/lib/esm/main.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  writeGitHubCopilotCliMcpConfig,
  toGitHubCopilotCliMcpServer,
} from './github-copilot-cli-write.js';
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
    expect(native.args).toEqual([
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '/tmp',
    ]);
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
    expect((result as Record<string, unknown>)['tools']).toEqual([
      'read',
      'write',
    ]);
    expect((result as Record<string, unknown>)['cwd']).toBe('/project');
    expect((result as Record<string, unknown>)['unknownField']).toBe(
      'preserved',
    );
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
    expect((result as Record<string, unknown>)['unknownField']).toBe(
      'preserved',
    );
  });
});

// ---------------------------------------------------------------------------
// E3 — githubCopilotCli.mcp.write byte-splice contract
// ---------------------------------------------------------------------------

/**
 * Assumption about `toGitHubCopilotCliMcpServer(canonical, existing)` shape:
 * - When `existing` is provided, the function MUST spread `existing`'s extension
 *   fields (e.g. `tools`, `cwd`, and any unknown JSON-compatible keys) into
 *   the returned native server so they survive a value update.
 * - The returned server uses `type: 'local'` for stdio and `type: 'http'` for remote.
 * - The canonical fields (command/args/env for local; url/headers for remote) are
 *   always written from the canonical input, overwriting any pre-existing values.
 * - Extension fields not present in `existing` are simply absent (not injected).
 */
import { githubCopilotCli } from './github-copilot-cli.js';
import { runPreservationChecks } from './writer-preservation/run.js';
import { COPILOT_CLI_FIXTURE } from './writer-preservation/fixtures.js';

// Per-test scratch directory (E3 block)
let scratchDir = '';

beforeEach(async () => {
  scratchDir = await tmp();
});

afterEach(async () => {
  if (scratchDir) {
    await rm(scratchDir, { recursive: true, force: true });
    scratchDir = '';
  }
});

/**
 * Build a PathResolutionContext pointing at the scratch directory.
 */
function makeCtx(home?: string, ws?: string): PathResolutionContext {
  return {
    homeDir: home ?? scratchDir,
    configDir: home ?? scratchDir,
    workspaceDir: ws ?? scratchDir,
    platform: 'linux' as const,
  };
}

/**
 * Seed a workspace .github/mcp.json fixture.
 */
async function seedWorkspaceFixture(
  dir: string,
  extraFields?: Record<string, Record<string, unknown>>,
): Promise<string> {
  const githubDir = join(dir, '.github');
  await mkdir(githubDir, { recursive: true });
  const fixture = parseJsonc(COPILOT_CLI_FIXTURE, [], {
    allowTrailingComma: true,
    disallowComments: false,
  }) as { mcpServers: Record<string, Record<string, unknown>> };
  if (extraFields) {
    for (const [server, val] of Object.entries(extraFields)) {
      if (
        fixture.mcpServers[server] &&
        typeof fixture.mcpServers[server] === 'object'
      ) {
        Object.assign(fixture.mcpServers[server], val);
      }
    }
  }
  const filePath = join(githubDir, 'mcp.json');
  await writeFile(filePath, JSON.stringify(fixture, null, 2), 'utf-8');
  return filePath;
}

/**
 * Seed a user .copilot/mcp-config.json fixture.
 */
async function seedUserFixture(
  dir: string,
  extraFields?: Record<string, Record<string, unknown>>,
): Promise<string> {
  const copilotDir = join(dir, '.copilot');
  await mkdir(copilotDir, { recursive: true });
  const fixture = parseJsonc(COPILOT_CLI_FIXTURE, [], {
    allowTrailingComma: true,
    disallowComments: false,
  }) as { mcpServers: Record<string, Record<string, unknown>> };
  if (extraFields) {
    for (const [server, val] of Object.entries(extraFields)) {
      if (
        fixture.mcpServers[server] &&
        typeof fixture.mcpServers[server] === 'object'
      ) {
        Object.assign(fixture.mcpServers[server], val);
      }
    }
  }
  const filePath = join(copilotDir, 'mcp-config.json');
  await writeFile(filePath, JSON.stringify(fixture, null, 2), 'utf-8');
  return filePath;
}

/**
 * Call githubCopilotCli.mcp.write twice (real second apply), then run the E1
 * preservation harness against the workspace target.
 *
 * `targetPath` is the per-server subtree path inside `runPreservationChecks`,
 * e.g. `['mcpServers', 'filesystem']`.
 */
async function writeAndHarnessWs(
  ctx: PathResolutionContext,
  servers: readonly { name: string; server: OvertureMcpServer }[],
  targetPath: readonly string[],
): Promise<{
  caught: unknown;
  report: ReturnType<typeof runPreservationChecks>;
  written: string;
  rewritten: string;
}> {
  const wsDir = ctx.workspaceDir;
  const fixturePath = join(wsDir, '.github', 'mcp.json');

  // ----- First apply -----
  let firstCaught: unknown = null;
  try {
    await githubCopilotCli.mcp.write(ctx, { servers });
  } catch (err) {
    firstCaught = err;
  }

  let firstWritten = '';
  try {
    firstWritten = await readFile(fixturePath, 'utf-8');
  } catch {
    // Stub rejected before any IO; bytes on disk are the seeded fixture
  }

  // ----- Second apply: real second invocation for idempotency proof -----
  let secondCaught: unknown = null;
  try {
    await githubCopilotCli.mcp.write(ctx, { servers });
  } catch (err) {
    secondCaught = err;
  }

  let secondWritten = firstWritten;
  try {
    secondWritten = await readFile(fixturePath, 'utf-8');
  } catch {
    // Stub rejected before any IO during the second apply
  }

  const original = await readFile(fixturePath, 'utf-8').catch(
    () => COPILOT_CLI_FIXTURE,
  );
  const report = runPreservationChecks({
    format: 'jsonc',
    original,
    written: firstWritten,
    rewritten: secondWritten,
    targetPath: targetPath as string[],
  });

  // Surface first error if both threw; otherwise surface whichever threw.
  const caught = firstCaught ?? secondCaught;

  return { caught, report, written: firstWritten, rewritten: secondWritten };
}

/**
 * Call githubCopilotCli.mcp.write twice for user-target idempotency.
 */
async function writeAndHarnessUser(
  ctx: PathResolutionContext,
  servers: readonly { name: string; server: OvertureMcpServer }[],
  targetPath: readonly string[],
): Promise<{
  caught: unknown;
  report: ReturnType<typeof runPreservationChecks>;
  written: string;
  rewritten: string;
}> {
  const homeDir = ctx.homeDir;
  const fixturePath = join(homeDir, '.copilot', 'mcp-config.json');

  let firstCaught: unknown = null;
  try {
    await githubCopilotCli.mcp.write(ctx, { servers });
  } catch (err) {
    firstCaught = err;
  }

  let firstWritten = '';
  try {
    firstWritten = await readFile(fixturePath, 'utf-8');
  } catch {
    // Stub rejected before any IO
  }

  let secondCaught: unknown = null;
  try {
    await githubCopilotCli.mcp.write(ctx, { servers });
  } catch (err) {
    secondCaught = err;
  }

  let secondWritten = firstWritten;
  try {
    secondWritten = await readFile(fixturePath, 'utf-8');
  } catch {
    // Stub rejected before any IO during the second apply
  }

  const original = await readFile(fixturePath, 'utf-8').catch(
    () => COPILOT_CLI_FIXTURE,
  );
  const report = runPreservationChecks({
    format: 'jsonc',
    original,
    written: firstWritten,
    rewritten: secondWritten,
    targetPath: targetPath as string[],
  });

  const caught = firstCaught ?? secondCaught;

  return { caught, report, written: firstWritten, rewritten: secondWritten };
}

describe('githubCopilotCli.mcp.write (E3 byte-splice)', () => {
  // -------------------------------------------------------------------------
  // Target selection
  // -------------------------------------------------------------------------

  it('workspace .github/mcp.json wins over user .copilot/mcp-config.json when both exist', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      // Seed both targets
      await seedWorkspaceFixture(ws);
      await seedUserFixture(home);
      const ctx = makeCtx(home, ws);
      const canonicalFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: canonicalFs }],
      });
      // Workspace target must be selected (workspace path present in targetPaths)
      expect(res.targetPaths).toHaveLength(1);
      expect(res.targetPaths[0].scope).toBe('project');
      expect(res.targetPaths[0].base).toBe('workspace');
      expect(res.targetPaths[0].path).toContain('.github/mcp.json');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('user .copilot/mcp-config.json is selected when workspace does not exist', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedUserFixture(home);
      const ctx = makeCtx(home, ws);
      const canonicalFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: canonicalFs }],
      });
      expect(res.targetPaths).toHaveLength(1);
      expect(res.targetPaths[0].scope).toBe('user');
      expect(res.targetPaths[0].base).toBe('home');
      expect(res.targetPaths[0].path).toContain('.copilot/mcp-config.json');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('returns not-targetable when neither workspace nor user config exists', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      const ctx = makeCtx(home, ws);
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [
          {
            name: 'filesystem',
            server: { type: 'stdio', command: 'echo', args: [] },
          },
        ],
      });
      expect(res.reason).toBe('not-targetable');
      expect(res.written).toBe(0);
      expect(res.changed).toBe(false);
      expect(res.serversWritten).toHaveLength(0);
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Metadata envelope — changed update
  // -------------------------------------------------------------------------

  it('F3: divergent canonical triggers conflict refusal with written:0, changed:false, conflicts populated', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceFixture(ws);
      const ctx = makeCtx(home, ws);
      const updatedFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/updated/path',
        ],
      };
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: updatedFs }],
      });
      // F3 supersedes the pre-F3 "changed update" envelope: divergent
      // settings refuse the write before byte-level planning.
      expect(res.written).toBe(0);
      expect(res.changed).toBe(false);
      expect(res.dryRun).toBe(false);
      expect(res.serversWritten).toEqual([]);
      expect(res.targetPaths).toHaveLength(1);
      expect(res.resolvedPath).toContain('.github/mcp.json');
      expect(res.format).toBe('jsonc');
      expect(res.conflicts).toBeDefined();
      expect(res.conflicts?.[0]?.serverName).toBe('filesystem');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Metadata envelope — no-change
  // -------------------------------------------------------------------------

  it('no-change returns written:0, reason:no-change without modifying disk', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceFixture(ws);
      const ctx = makeCtx(home, ws);
      const fixturePath = join(ws, '.github', 'mcp.json');
      const before = await readFile(fixturePath, 'utf-8');
      // Send the exact same server that's already in the fixture
      const existingFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/home/user/projects',
        ],
      };
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: existingFs }],
      });
      expect(res.reason).toBe('no-change');
      expect(res.written).toBe(0);
      expect(res.changed).toBe(false);
      const after = await readFile(fixturePath, 'utf-8');
      expect(after).toBe(before);
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Metadata envelope — dry-run
  // -------------------------------------------------------------------------

  it('F3: dry-run divergent canonical triggers conflict refusal and leaves disk unchanged', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceFixture(ws);
      const ctx = makeCtx(home, ws);
      const fixturePath = join(ws, '.github', 'mcp.json');
      const before = await readFile(fixturePath, 'utf-8');
      const updatedFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/dryrun/path'],
      };
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: updatedFs }],
        dryRun: true,
      });
      expect(res.dryRun).toBe(true);
      expect(res.written).toBe(0);
      expect(res.changed).toBe(false);
      expect(res.conflicts).toBeDefined();
      expect(res.conflicts?.[0]?.serverName).toBe('filesystem');
      expect(res.targetPaths).toHaveLength(1);
      expect(res.format).toBe('jsonc');
      const after = await readFile(fixturePath, 'utf-8');
      expect(after).toBe(before);
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Extension preservation
  // -------------------------------------------------------------------------

  it('F3: divergent canonical with native extension fields triggers conflict refusal (extensions not overwritten)', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      // Seed workspace fixture with explicit tools+cwd on filesystem entry
      await seedWorkspaceFixture(ws, {
        filesystem: {
          tools: ['read_file', 'write_file'],
          cwd: '/project/root',
        },
      });
      const ctx = makeCtx(home, ws);
      const updatedFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: updatedFs }],
      });
      // F3 refuses divergent settings — extension fields stay on disk.
      expect(res.changed).toBe(false);
      expect(res.conflicts).toBeDefined();
      const fixturePath = join(ws, '.github', 'mcp.json');
      const written = JSON.parse(await readFile(fixturePath, 'utf-8'));
      const fsEntry = written.mcpServers['filesystem'];
      expect(fsEntry.tools).toEqual(['read_file', 'write_file']);
      expect(fsEntry.cwd).toBe('/project/root');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('F3: divergent canonical with unknown JSON-compatible extensions triggers conflict refusal (extensions preserved on disk)', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceFixture(ws, {
        context7: {
          unknownField: 'preserved-value',
          anotherUnknown: 42,
        },
      });
      const ctx = makeCtx(home, ws);
      const updatedCtx7: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp@latest'],
      };
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [{ name: 'context7', server: updatedCtx7 }],
      });
      // F3 refuses divergent settings — unknown extensions stay on disk.
      expect(res.changed).toBe(false);
      expect(res.conflicts).toBeDefined();
      const fixturePath = join(ws, '.github', 'mcp.json');
      const written = JSON.parse(await readFile(fixturePath, 'utf-8'));
      const ctx7Entry = written.mcpServers['context7'];
      expect((ctx7Entry as Record<string, unknown>)['unknownField']).toBe(
        'preserved-value',
      );
      expect((ctx7Entry as Record<string, unknown>)['anotherUnknown']).toBe(42);
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Error paths
  // -------------------------------------------------------------------------

  it('missing target file returns reason:not-targetable', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      const ctx = makeCtx(home, ws);
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [
          {
            name: 'nonexistent',
            server: { type: 'stdio', command: 'echo', args: [] },
          },
        ],
      });
      expect(res.reason).toBe('not-targetable');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('malformed JSONC returns reason:parse-error', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      const githubDir = join(ws, '.github');
      await mkdir(githubDir, { recursive: true });
      // Intentionally malformed JSONC (missing quotes around "local")
      await writeFile(
        join(githubDir, 'mcp.json'),
        '{ "mcpServers": { "filesystem": { "type": local, "command": npx } } }',
        'utf-8',
      );
      const ctx = makeCtx(home, ws);
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [
          {
            name: 'filesystem',
            server: { type: 'stdio', command: 'npx', args: [] },
          },
        ],
      });
      expect(res.reason).toBe('parse-error');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('non-map mcpServers container returns reason:unsupported-shape', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      const githubDir = join(ws, '.github');
      await mkdir(githubDir, { recursive: true });
      await writeFile(
        join(githubDir, 'mcp.json'),
        JSON.stringify({ mcpServers: ['not', 'a', 'map'] }),
        'utf-8',
      );
      const ctx = makeCtx(home, ws);
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [
          {
            name: 'filesystem',
            server: { type: 'stdio', command: 'npx', args: [] },
          },
        ],
      });
      expect(res.reason).toBe('unsupported-shape');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('missing server name in target returns reason:not-targetable', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceFixture(ws);
      const ctx = makeCtx(home, ws);
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [
          {
            name: 'this-server-does-not-exist',
            server: { type: 'stdio', command: 'echo', args: [] },
          },
        ],
      });
      expect(res.reason).toBe('not-targetable');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('absent server entry maps to not-targetable (no creation)', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceFixture(ws);
      const ctx = makeCtx(home, ws);
      const fixturePath = join(ws, '.github', 'mcp.json');
      const before = await readFile(fixturePath, 'utf-8');
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [
          {
            name: 'brand-new-server',
            server: { type: 'stdio', command: 'echo', args: [] },
          },
        ],
      });
      expect(res.reason).toBe('not-targetable');
      const after = await readFile(fixturePath, 'utf-8');
      expect(after).toBe(before);
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // E1 preservation — workspace target
  // -------------------------------------------------------------------------

  it('E1 preservation: workspace target update passes runPreservationChecks.allPassed === true', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceFixture(ws);
      const ctx = makeCtx(home, ws);
      const updatedFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/updated/workspace/path',
        ],
      };
      const { caught, report } = await writeAndHarnessWs(
        ctx,
        [{ name: 'filesystem', server: updatedFs }],
        ['mcpServers', 'filesystem'],
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
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('E1 preservation: user target update passes runPreservationChecks.allPassed === true', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedUserFixture(home);
      const ctx = makeCtx(home, ws);
      const updatedFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/updated/user/path',
        ],
      };
      const { caught, report } = await writeAndHarnessUser(
        ctx,
        [{ name: 'filesystem', server: updatedFs }],
        ['mcpServers', 'filesystem'],
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
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Registry spy second-apply idempotency
  // -------------------------------------------------------------------------

  it('githubCopilotCli.mcp.write is invoked exactly twice during writeAndHarness (idempotency)', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceFixture(ws);
      const ctx = makeCtx(home, ws);
      const updatedFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/idempotency/path',
        ],
      };

      const writeSpy = vi.spyOn(githubCopilotCli.mcp, 'write');

      try {
        const {
          report,
          written: firstWritten,
          rewritten: secondWritten,
        } = await writeAndHarnessWs(
          ctx,
          [{ name: 'filesystem', server: updatedFs }],
          ['mcpServers', 'filesystem'],
        );

        expect(writeSpy.mock.calls.length).toBe(2);

        // Second invocation's on-disk bytes must match the first invocation's written bytes
        expect(secondWritten).toBe(firstWritten);

        // Sanity: the preservation report still passes identity for the workspace target
        expect(report.allPassed).toBe(true);
      } finally {
        writeSpy.mockRestore();
      }
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // F3: conflict refusal + matching-case spec
  // -------------------------------------------------------------------------

  it('F3: divergent canonical triggers conflict refusal (written:0, changed:false, conflicts populated)', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceFixture(ws);
      const ctx = makeCtx(home, ws);
      const divergentFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'pnpm',
        args: ['-y', 'different-server'],
      };
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: divergentFs }],
      });
      expect(res.written).toBe(0);
      expect(res.changed).toBe(false);
      expect(res.serversWritten).toEqual([]);
      expect(res.conflicts).toBeDefined();
      expect(res.conflicts?.[0]?.serverName).toBe('filesystem');
      expect(res.conflicts?.[0]?.diffKeys).toContain('command');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('F3: matching canonical proceeds byte-level (no-change)', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceFixture(ws);
      const ctx = makeCtx(home, ws);
      const matchingFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/home/user/projects',
        ],
      };
      const res = await githubCopilotCli.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: matchingFs }],
      });
      expect(res.conflicts).toBeUndefined();
      expect(res.reason).toBe('no-change');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });
});
