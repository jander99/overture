/**
 * Contract tests for the OpenAI Codex metadata-only MCP write (E4 slice).
 *
 * These tests cover the E4 wiring contract:
 *  1. Target selection: user config wins over workspace when both exist.
 *  2. `not-targetable` when no applicable target file exists.
 *  3. `unsupported-shape` when mcp_servers is not a table.
 *  4. `dryRun` is honored (echoed on the result).
 *  5. The result carries no raw bytes regardless of the reason.
 *  6. E1 preservation: extension fields survive a server value update.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openaiCodex } from './openai-codex.js';
import type { OpenAICodexMcpConfig } from './openai-codex.js';
import type { PathResolutionContext } from './types.js';
import type { OvertureMcpServer } from '@overture/config';
import { runPreservationChecks } from './writer-preservation/run.js';
import { CODEX_FIXTURE } from './writer-preservation/fixtures.js';

// ---------------------------------------------------------------------------
// Per-test scratch directory
// ---------------------------------------------------------------------------

let scratchDir = '';

async function tmp(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'codex-write-'));
}

beforeEach(async () => {
  scratchDir = await tmp();
});

afterEach(async () => {
  if (scratchDir) {
    await rm(scratchDir, { recursive: true, force: true });
    scratchDir = '';
  }
});

// ---------------------------------------------------------------------------
// Context helper
// ---------------------------------------------------------------------------

function makeCtx(home?: string, ws?: string): PathResolutionContext {
  return {
    homeDir: home ?? scratchDir,
    configDir: home ?? scratchDir,
    workspaceDir: ws ?? scratchDir,
    platform: 'linux' as const,
  };
}

// ---------------------------------------------------------------------------
// Config seed helpers
// ---------------------------------------------------------------------------

/**
 * Seed a user .codex/config.toml file.
 */
async function seedUserConfig(dir: string, contents: string): Promise<string> {
  const codexDir = join(dir, '.codex');
  await mkdir(codexDir, { recursive: true });
  const filePath = join(codexDir, 'config.toml');
  await writeFile(filePath, contents, 'utf-8');
  return filePath;
}

/**
 * Seed a workspace .codex/config.toml file.
 */
async function seedWorkspaceConfig(
  dir: string,
  contents: string,
): Promise<string> {
  const codexDir = join(dir, '.codex');
  await mkdir(codexDir, { recursive: true });
  const filePath = join(codexDir, 'config.toml');
  await writeFile(filePath, contents, 'utf-8');
  return filePath;
}

// ---------------------------------------------------------------------------
// Write-and-harness helpers (user target)
// ---------------------------------------------------------------------------

async function codexWriteAndHarnessUser(
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
  const fixturePath = join(homeDir, '.codex', 'config.toml');

  // ----- First apply -----
  let firstCaught: unknown = null;
  try {
    await openaiCodex.mcp.write(ctx, { servers });
  } catch (err) {
    firstCaught = err;
  }

  let firstWritten = '';
  try {
    firstWritten = await readFile(fixturePath, 'utf-8');
  } catch {
    // Stub rejected before any IO
  }

  // ----- Second apply: idempotency proof -----
  let secondCaught: unknown = null;
  try {
    await openaiCodex.mcp.write(ctx, { servers });
  } catch (err) {
    secondCaught = err;
  }

  let secondWritten = firstWritten;
  try {
    secondWritten = await readFile(fixturePath, 'utf-8');
  } catch {
    // Stub rejected before any IO during second apply
  }

  const original = await readFile(fixturePath, 'utf-8').catch(
    () => CODEX_FIXTURE,
  );
  const report = runPreservationChecks({
    format: 'toml',
    original,
    written: firstWritten,
    rewritten: secondWritten,
    targetPath: targetPath as string[],
  });

  const caught = firstCaught ?? secondCaught;
  return { caught, report, written: firstWritten, rewritten: secondWritten };
}

// ---------------------------------------------------------------------------
// Write-and-harness helpers (workspace target)
// ---------------------------------------------------------------------------

async function codexWriteAndHarnessWorkspace(
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
  const fixturePath = join(wsDir, '.codex', 'config.toml');

  // ----- First apply -----
  let firstCaught: unknown = null;
  try {
    await openaiCodex.mcp.write(ctx, { servers });
  } catch (err) {
    firstCaught = err;
  }

  let firstWritten = '';
  try {
    firstWritten = await readFile(fixturePath, 'utf-8');
  } catch {
    // Stub rejected before any IO
  }

  // ----- Second apply: idempotency proof -----
  let secondCaught: unknown = null;
  try {
    await openaiCodex.mcp.write(ctx, { servers });
  } catch (err) {
    secondCaught = err;
  }

  let secondWritten = firstWritten;
  try {
    secondWritten = await readFile(fixturePath, 'utf-8');
  } catch {
    // Stub rejected before any IO during second apply
  }

  const original = await readFile(fixturePath, 'utf-8').catch(
    () => CODEX_FIXTURE,
  );
  const report = runPreservationChecks({
    format: 'toml',
    original,
    written: firstWritten,
    rewritten: secondWritten,
    targetPath: targetPath as string[],
  });

  const caught = firstCaught ?? secondCaught;
  return { caught, report, written: firstWritten, rewritten: secondWritten };
}

// ---------------------------------------------------------------------------
// E4 — openaiCodex.mcp.write byte-splice contract
// ---------------------------------------------------------------------------

describe('openaiCodex.mcp.write (E4 byte-splice)', () => {
  // -------------------------------------------------------------------------
  // Target selection
  // -------------------------------------------------------------------------

  it('user-before-workspace: user config wins when both exist', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedUserConfig(home, CODEX_FIXTURE);
      await seedWorkspaceConfig(ws, CODEX_FIXTURE);
      const ctx = makeCtx(home, ws);
      const canonicalFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const res = await openaiCodex.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: canonicalFs }],
      });
      // User target must be selected (scope === 'user')
      expect(res.targetPaths).toHaveLength(1);
      expect(res.targetPaths[0].scope).toBe('user');
      expect(res.targetPaths[0].base).toBe('home');
      expect(res.targetPaths[0].path).toContain('.codex/config.toml');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('workspace fallback: workspace config selected when user does not exist', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceConfig(ws, CODEX_FIXTURE);
      const ctx = makeCtx(home, ws);
      const canonicalFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      };
      const res = await openaiCodex.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: canonicalFs }],
      });
      expect(res.targetPaths).toHaveLength(1);
      expect(res.targetPaths[0].scope).toBe('project');
      expect(res.targetPaths[0].base).toBe('workspace');
      expect(res.targetPaths[0].path).toContain('.codex/config.toml');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('not-targetable when neither user nor workspace config exists', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      const ctx = makeCtx(home, ws);
      const res = await openaiCodex.mcp.write(ctx, {
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

  it('not-targetable when user config file is empty', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedUserConfig(home, '');
      await seedWorkspaceConfig(ws, CODEX_FIXTURE);
      const ctx = makeCtx(home, ws);
      const res = await openaiCodex.mcp.write(ctx, {
        servers: [
          {
            name: 'filesystem',
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

  it('not-targetable when mcp_servers table is missing', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      // Workspace exists but has no mcp_servers table; user config absent.
      // Use a minimal TOML without any [mcp_servers.*] table.
      await seedWorkspaceConfig(
        ws,
        '# config without mcp_servers\nmodel = "gpt-5"\n\n[sandbox]\nmode = "workspace-write"\n',
      );
      const ctx = makeCtx(home, ws);
      const res = await openaiCodex.mcp.write(ctx, {
        servers: [
          {
            name: 'filesystem',
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

  it('unsupported-shape when mcp_servers is a scalar string', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      const badToml = 'mcp_servers = "not a table"';
      await seedUserConfig(home, badToml);
      const ctx = makeCtx(home, ws);
      const res = await openaiCodex.mcp.write(ctx, {
        servers: [
          {
            name: 'filesystem',
            server: { type: 'stdio', command: 'echo', args: [] },
          },
        ],
      });
      expect(res.reason).toBe('unsupported-shape');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  it('not-targetable when requested server is absent from config', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedUserConfig(home, CODEX_FIXTURE);
      const ctx = makeCtx(home, ws);
      const res = await openaiCodex.mcp.write(ctx, {
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

  // -------------------------------------------------------------------------
  // Metadata envelope — dry-run
  // -------------------------------------------------------------------------

  it('dry-run leaves disk unchanged', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedUserConfig(home, CODEX_FIXTURE);
      const ctx = makeCtx(home, ws);
      const fixturePath = join(home, '.codex', 'config.toml');
      const before = await readFile(fixturePath, 'utf-8');
      const updatedFs: OvertureMcpServer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/dryrun/path'],
      };
      const res = await openaiCodex.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: updatedFs }],
        dryRun: true,
      });
      expect(res.dryRun).toBe(true);
      expect(res.written).toBe(1);
      expect(res.changed).toBe(true);
      expect(res.serversWritten).toEqual(['filesystem']);
      expect(res.targetPaths).toHaveLength(1);
      expect(res.format).toBe('toml');
      expect(res.bytesChanged).toBeGreaterThan(0);
      const after = await readFile(fixturePath, 'utf-8');
      expect(after).toBe(before);
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Metadata envelope — no-change
  // -------------------------------------------------------------------------

  it('no-change returns no-change metadata without modifying disk', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedUserConfig(home, CODEX_FIXTURE);
      const ctx = makeCtx(home, ws);
      const fixturePath = join(home, '.codex', 'config.toml');
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
      const res = await openaiCodex.mcp.write(ctx, {
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
  // Metadata envelope — changed update (stdio)
  // -------------------------------------------------------------------------

  it('changed stdio update returns full metadata (format: toml)', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedUserConfig(home, CODEX_FIXTURE);
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
      const res = await openaiCodex.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: updatedFs }],
      });
      expect(res.written).toBe(1);
      expect(res.changed).toBe(true);
      expect(res.dryRun).toBe(false);
      expect(res.serversWritten).toEqual(['filesystem']);
      expect(res.targetPaths).toHaveLength(1);
      expect(res.resolvedPath).toContain('.codex/config.toml');
      expect(res.format).toBe('toml');
      expect(res.bytesChanged).toBeGreaterThan(0);
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Metadata envelope — changed update (remote)
  // -------------------------------------------------------------------------

  it('changed remote update returns full metadata (format: toml)', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedUserConfig(home, CODEX_FIXTURE);
      const ctx = makeCtx(home, ws);
      const updatedRemote: OvertureMcpServer = {
        type: 'remote',
        url: 'https://mcp.example.com/new-bridge',
        headers: { Authorization: 'Bearer new-token' },
      };
      const res = await openaiCodex.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: updatedRemote }],
      });
      expect(res.written).toBe(1);
      expect(res.changed).toBe(true);
      expect(res.dryRun).toBe(false);
      expect(res.serversWritten).toEqual(['filesystem']);
      expect(res.targetPaths).toHaveLength(1);
      expect(res.format).toBe('toml');
      expect(res.bytesChanged).toBeGreaterThan(0);
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // E1 preservation — user target
  // -------------------------------------------------------------------------

  it('E1 preservation: stdio update user target passes runPreservationChecks', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedUserConfig(home, CODEX_FIXTURE);
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
      const { caught, report } = await codexWriteAndHarnessUser(
        ctx,
        [{ name: 'filesystem', server: updatedFs }],
        ['mcp_servers', 'filesystem'],
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

  it('E1 preservation: remote update user target passes runPreservationChecks', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedUserConfig(home, CODEX_FIXTURE);
      const ctx = makeCtx(home, ws);
      const updatedRemote: OvertureMcpServer = {
        type: 'remote',
        url: 'https://mcp.example.com/updated-remote',
        headers: { Authorization: 'Bearer updated-token' },
      };
      const { caught, report } = await codexWriteAndHarnessUser(
        ctx,
        [{ name: 'filesystem', server: updatedRemote }],
        ['mcp_servers', 'filesystem'],
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
  // Registry spy — second-apply idempotency
  // -------------------------------------------------------------------------

  it('registry spy: openaiCodex.mcp.write invoked exactly twice in codexWriteAndHarnessWorkspace', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      await seedWorkspaceConfig(ws, CODEX_FIXTURE);
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

      const writeSpy = vi.spyOn(openaiCodex.mcp, 'write');

      try {
        const {
          report,
          written: firstWritten,
          rewritten: secondWritten,
        } = await codexWriteAndHarnessWorkspace(
          ctx,
          [{ name: 'filesystem', server: updatedFs }],
          ['mcp_servers', 'filesystem'],
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
  // Non-contiguous descendant layout
  // -------------------------------------------------------------------------

  it('non-contiguous descendant layout returns unsupported-shape', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      // TOML where mcp_servers.foo has a sibling bar that comes after it,
      // but foo also has a descendant foo.env that appears after bar.
      // The harness range stops at bar, so foo.env is outside the contiguous range.
      const nestedToml = `
[sandbox]
mode = "workspace-write"

[mcp_servers.foo]
command = "npx"
args = ["-y", "foo-mcp"]

[mcp_servers.bar]
command = "npx"
args = ["-y", "bar-mcp"]

[mcp_servers.foo.env]
FOO_API_KEY = "\${FOO_API_KEY}"
`;
      await seedUserConfig(home, nestedToml);
      const ctx = makeCtx(home, ws);
      const res = await openaiCodex.mcp.write(ctx, {
        servers: [
          {
            name: 'foo',
            server: { type: 'stdio', command: 'npx', args: ['-y', 'foo-mcp'] },
          },
        ],
      });
      expect(res.reason).toBe('unsupported-shape');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Transport switch drops incompatible fields
  // -------------------------------------------------------------------------

  it('transport switch drops incompatible fields', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      // Seed with a stdio server entry
      await seedUserConfig(home, CODEX_FIXTURE);
      const ctx = makeCtx(home, ws);
      // Switch filesystem from stdio to remote
      const remoteServer: OvertureMcpServer = {
        type: 'remote',
        url: 'https://mcp.example.com/bridge',
      };
      const res = await openaiCodex.mcp.write(ctx, {
        servers: [{ name: 'filesystem', server: remoteServer }],
      });
      expect(res.changed).toBe(true);
      expect(res.written).toBe(1);
      // After transport switch, the written entry should have url but not command/args
      const fixturePath = join(home, '.codex', 'config.toml');
      const written = await readFile(fixturePath, 'utf-8');
      expect(written).toContain('url');
      // Verify the filesystem block specifically has no command = (not just any server in the file)
      const filesystemBlock =
        written
          .split('[mcp_servers.filesystem]')[1]
          ?.split(/\[mcp_servers\.\w+\]/)[0] ?? '';
      expect(filesystemBlock).not.toMatch(/^\s*command\s*=/m);
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });
});
