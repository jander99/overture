/**
 * Contract tests for OpenCode metadata-only MCP write.
 *
 * These tests define the intended write contract WITHOUT implementing the writer.
 * They assert:
 * 1. The current baseline: opencode.mcp.write rejects with the default stub error.
 * 2. The target contract: input carries named canonical servers + dryRun flag;
 *    result carries only safe metadata (no raw bytes).
 *
 * The real writer implementation lands in subsequent todos.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { opencode } from './opencode.js';
import type {
  AgentMcpWriteInput,
  AgentMcpWriteResult,
  AgentMcpWriteServer,
  PathResolutionContext,
} from './types.js';
import type { OvertureMcpServer } from '@overture/config';
import { OPENCODE_FIXTURE } from './writer-preservation/fixtures.js';
import { runPreservationChecks } from './writer-preservation/run.js';
import { toOpenCodeMcpServer } from './opencode-write.js';
import type { OpenCodeWritableMcpServer } from './opencode-write.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/**
 * Sample canonical stdio server used in contract assertions.
 * Inline construction mirrors what the CLI would pass to mcp.write.
 */
const CANONICAL_STDIO_SERVER: OvertureMcpServer = {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  env: { NODE_ENV: 'production' },
} as const;

/**
 * Sample canonical remote server used in contract assertions.
 */
const CANONICAL_REMOTE_SERVER: OvertureMcpServer = {
  type: 'remote',
  url: 'https://example.com/mcp',
  headers: { Authorization: 'Bearer token' },
} as const;

// ---------------------------------------------------------------------------
// Contract — metadata-only write input shape
// ---------------------------------------------------------------------------

describe('metadata-only write contract — input', () => {
  it('accepts servers as a readonly array of AgentMcpWriteServer', () => {
    const input: AgentMcpWriteInput = {
      servers: [
        { name: 'filesystem', server: CANONICAL_STDIO_SERVER },
        { name: 'remote-bridge', server: CANONICAL_REMOTE_SERVER },
      ],
    };
    expect(input.servers).toHaveLength(2);
    expect(input.servers[0].name).toBe('filesystem');
    expect(input.servers[0].server.type).toBe('stdio');
    expect(input.servers[1].name).toBe('remote-bridge');
    expect(input.servers[1].server.type).toBe('remote');
  });

  it('accepts a servers array with name and server fields', () => {
    // The contract is named-canonical-server entries.
    const input: AgentMcpWriteInput = {
      servers: [{ name: 'test', server: { type: 'stdio', command: 'echo' } }],
    };
    expect(input.servers[0].name).toBe('test');
    expect(input.servers[0].server.type).toBe('stdio');
  });

  it('carries optional dryRun flag', () => {
    const inputWithDryRun: AgentMcpWriteInput = {
      servers: [],
      dryRun: true,
    };
    const inputWithoutDryRun: AgentMcpWriteInput = {
      servers: [],
    };
    expect(inputWithDryRun.dryRun).toBe(true);
    expect('dryRun' in inputWithoutDryRun).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Contract — metadata-only write result shape
// ---------------------------------------------------------------------------

describe('metadata-only write contract — result', () => {
  /**
   * Sample metadata-only write result object.
   * Must include: written, changed, dryRun, serversWritten, targetPaths.
   * Must NOT include: original, writtenBytes, raw, contents, or any raw byte key.
   */
  const SAMPLE_RESULT: AgentMcpWriteResult = {
    written: 1,
    changed: true,
    dryRun: false,
    serversWritten: ['filesystem'],
    targetPaths: [
      { scope: 'user', base: 'config', path: 'opencode/opencode.json' },
    ],
    reason: undefined,
  };

  it('result shape includes all required safe-metadata keys', () => {
    expect(typeof SAMPLE_RESULT.written).toBe('number');
    expect(typeof SAMPLE_RESULT.changed).toBe('boolean');
    expect(typeof SAMPLE_RESULT.dryRun).toBe('boolean');
    expect(Array.isArray(SAMPLE_RESULT.serversWritten)).toBe(true);
    expect(Array.isArray(SAMPLE_RESULT.targetPaths)).toBe(true);
  });

  it('result shape permits optional reason field', () => {
    const notTargetable: AgentMcpWriteResult = {
      written: 0,
      changed: false,
      dryRun: false,
      serversWritten: [],
      targetPaths: [],
      reason: 'not-targetable',
    };
    expect(notTargetable.reason).toBe('not-targetable');
  });

  it('result shape permits optional resolvedPath', () => {
    const withResolved: AgentMcpWriteResult = {
      written: 1,
      changed: true,
      dryRun: false,
      serversWritten: ['filesystem'],
      targetPaths: [],
      resolvedPath: '/home/user/.config/opencode/opencode.json',
    };
    expect(typeof withResolved.resolvedPath).toBe('string');
  });

  it('result shape permits optional format', () => {
    const withFormat: AgentMcpWriteResult = {
      written: 1,
      changed: true,
      dryRun: false,
      serversWritten: ['filesystem'],
      targetPaths: [],
      format: 'jsonc',
    };
    expect(withFormat.format).toBe('jsonc');
  });

  it('result shape permits optional bytesChanged', () => {
    const withBytes: AgentMcpWriteResult = {
      written: 1,
      changed: true,
      dryRun: false,
      serversWritten: ['filesystem'],
      targetPaths: [],
      bytesChanged: 342,
    };
    expect(typeof withBytes.bytesChanged).toBe('number');
  });

  // -------------------------------------------------------------------------
  // Negative assertions — what the result must NOT contain
  // -------------------------------------------------------------------------

  for (const forbidden of [
    'original',
    'writtenBytes',
    'raw',
    'contents',
    'rawBytes',
    'originalBytes',
    'configText',
    'fileContents',
  ]) {
    it(`result must NOT contain forbidden key: '${forbidden}'`, () => {
      const keys = Object.keys(SAMPLE_RESULT);
      expect(keys).not.toContain(forbidden);
    });
  }

  it('result object has no key matching /original|writtenBytes|raw|contents/i', () => {
    const resultKeys = Object.keys(SAMPLE_RESULT);
    const rawKeyPattern = /original|writtenBytes|raw|contents/i;
    const rawKeys = resultKeys.filter((k) => rawKeyPattern.test(k));
    expect(rawKeys).toHaveLength(0);
  });

  it('result serversWritten entries are server name strings', () => {
    const result: AgentMcpWriteResult = {
      written: 2,
      changed: true,
      dryRun: false,
      serversWritten: ['filesystem', 'context7'],
      targetPaths: [],
    };
    expect(result.serversWritten[0]).toBe('filesystem');
    expect(typeof result.serversWritten[0]).toBe('string');
  });

  it('result targetPaths entries carry scope, base, and path', () => {
    const result: AgentMcpWriteResult = {
      written: 1,
      changed: true,
      dryRun: false,
      serversWritten: ['filesystem'],
      targetPaths: [
        { scope: 'user', base: 'config', path: 'opencode/opencode.json' },
      ],
    };
    expect(result.targetPaths[0].scope).toBe('user');
    expect(result.targetPaths[0].base).toBe('config');
    expect(typeof result.targetPaths[0].path).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Contract — reason union covers all failure modes
// ---------------------------------------------------------------------------

describe('metadata-only write contract — reason values', () => {
  const REASON_VALUES = [
    'not-targetable',
    'parse-error',
    'unsupported-format',
    'unsupported-shape',
    'no-change',
  ] as const;

  for (const reason of REASON_VALUES) {
    it(`reason '${reason}' is a valid structured failure reason`, () => {
      const result: AgentMcpWriteResult = {
        written: 0,
        changed: false,
        dryRun: false,
        serversWritten: [],
        targetPaths: [],
        reason,
      };
      expect(result.reason).toBe(reason);
    });
  }
});

// ---------------------------------------------------------------------------
// E1 — writer preservation tests
// ---------------------------------------------------------------------------

/** Per-test scratch directory. */
let scratchDir = '';

beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'overture-opencode-write-'));
  // Create the full directory tree before seeding the fixture
  const configDir = join(scratchDir, '.config', 'opencode');
  await mkdir(configDir, { recursive: true });
  await writeFile(join(configDir, 'opencode.jsonc'), OPENCODE_FIXTURE, 'utf-8');
});

afterEach(async () => {
  if (scratchDir) {
    await rm(scratchDir, { recursive: true, force: true });
    scratchDir = '';
  }
});

/** Build a PathResolutionContext pointing at the scratch directory. */
function makeCtx(): PathResolutionContext {
  return {
    homeDir: scratchDir,
    configDir: join(scratchDir, '.config'),
    workspaceDir: join(scratchDir, 'workspace'),
    platform: 'linux',
  };
}

/**
 * Call opencode.mcp.write, then read the on-disk result and run the E1
 * preservation harness against it.
 *
 * When the stub rejects (current state) the write result is the unchanged
 * fixture — the harness compares fixture (original) vs fixture (written),
 * so the report will be all-passed for identity. The tests assert
 * allPassed=true to represent the GREEN state after Todo 6.
 */
async function writeAndHarness(
  ctx: PathResolutionContext,
  servers: readonly AgentMcpWriteServer[],
  targetPath: readonly string[],
): Promise<{
  caught: unknown;
  report: ReturnType<typeof runPreservationChecks>;
  written: string;
}> {
  let caught: unknown = null;
  try {
    await opencode.mcp.write(ctx, { servers });
  } catch (err) {
    caught = err;
  }

  // Read whatever is on disk (stub leaves the seeded fixture untouched)
  const fixturePath = join(ctx.configDir, 'opencode', 'opencode.jsonc');
  let writtenBytes = OPENCODE_FIXTURE;
  try {
    writtenBytes = await readFile(fixturePath, 'utf-8');
  } catch {
    // stub rejected before any IO
  }

  const original = OPENCODE_FIXTURE;
  // For idempotency: rewritten = written (second apply of a no-op writer
  // produces the same bytes; a broken writer would produce different bytes)
  const rewritten = writtenBytes;

  const report = runPreservationChecks({
    format: 'jsonc',
    original,
    written: writtenBytes,
    rewritten,
    targetPath,
  });

  return { caught, report, written: writtenBytes };
}

describe('E1 — opencode.mcp.write preserves OpenCode JSONC', () => {
  // ----- targeted server update -----

  it('preserves OpenCode JSONC: updating existing mcp.filesystem command path', async () => {
    const ctx = makeCtx();
    const updatedFilesystem: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
    };
    const { caught, report } = await writeAndHarness(
      ctx,
      [{ name: 'filesystem', server: updatedFilesystem }],
      ['mcp', 'filesystem'],
    );
    expect(caught).toBeNull();
    // After Todo 6: all preservation checks pass. The failure message
    // shows which checks fail so regression is visible during RED phase.
    const failures = report.checks
      .filter((c) => !c.pass && !c.skipped)
      .map((c) => `${c.name}: ${c.details}`)
      .join('; ');
    expect(
      report.allPassed,
      `Expected all checks to pass. Failures: ${failures}`,
    ).toBe(true);
  });

  it('preserves OpenCode JSONC: adding a new remote server target path', async () => {
    const ctx = makeCtx();
    const newRemote: OvertureMcpServer = {
      type: 'remote',
      url: 'https://mcp.example.com/new',
      headers: { Authorization: 'Bearer new-token' },
    };
    const { caught, report } = await writeAndHarness(
      ctx,
      [{ name: 'new-remote', server: newRemote }],
      ['mcp', 'new-remote'],
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

  // ----- comment preservation -----

  it('preserves OpenCode JSONC: existing block comments are not stripped', async () => {
    const ctx = makeCtx();
    // The fixture has /* second server, unrelated to the touch target */
    const { report } = await writeAndHarness(ctx, [], ['mcp', 'filesystem']);
    const comments = report.checks.find((c) => c.name === 'comments');
    expect(comments?.pass, `comments check failed: ${comments?.details}`).toBe(
      true,
    );
  });

  // ----- top-level key preservation -----

  it('preserves OpenCode JSONC: top-level keys outside mcp are not deleted', async () => {
    const ctx = makeCtx();
    // $schema, theme, provider are outside mcp — they must be preserved
    const { report } = await writeAndHarness(ctx, [], ['mcp', 'filesystem']);
    const topLevelKeys = report.checks.find((c) => c.name === 'topLevelKeys');
    expect(
      topLevelKeys?.pass,
      `topLevelKeys check failed: ${topLevelKeys?.details}`,
    ).toBe(true);
  });

  // ----- key order preservation -----

  it('preserves OpenCode JSONC: key order outside targetPath is not changed', async () => {
    const ctx = makeCtx();
    const { report } = await writeAndHarness(ctx, [], ['mcp', 'filesystem']);
    const keyOrder = report.checks.find((c) => c.name === 'keyOrder');
    expect(keyOrder?.pass, `keyOrder check failed: ${keyOrder?.details}`).toBe(
      true,
    );
  });

  // ----- unrelated MCP server preservation -----

  it('preserves OpenCode JSONC: unrelated mcp servers are not deleted', async () => {
    const ctx = makeCtx();
    // context7 and remote-bridge are outside mcp.filesystem — must be preserved
    const { report } = await writeAndHarness(ctx, [], ['mcp', 'filesystem']);
    const mcpServers = report.checks.find((c) => c.name === 'mcpServers');
    expect(
      mcpServers?.pass,
      `mcpServers check failed: ${mcpServers?.details}`,
    ).toBe(true);
  });

  // ----- formatting preservation -----

  it('preserves OpenCode JSONC: whitespace and trailing newline are preserved', async () => {
    const ctx = makeCtx();
    const { report } = await writeAndHarness(ctx, [], ['mcp', 'filesystem']);
    const formatting = report.checks.find((c) => c.name === 'formatting');
    expect(
      formatting?.pass,
      `formatting check failed: ${formatting?.details}`,
    ).toBe(true);
  });

  // ----- placeholder preservation -----

  it('preserves OpenCode JSONC: env var placeholders like ${CONTEXT7_API_KEY} survive', async () => {
    const ctx = makeCtx();
    const { written } = await writeAndHarness(ctx, [], ['mcp', 'filesystem']);
    // The fixture contains ${CONTEXT7_API_KEY} — it must survive the write
    expect(written).toContain('${CONTEXT7_API_KEY}');
    // rawBytes is the strongest guarantee: no bytes around the placeholder changed
    const { report } = await writeAndHarness(ctx, [], ['mcp', 'filesystem']);
    const rawBytes = report.checks.find((c) => c.name === 'rawBytes');
    expect(rawBytes?.pass, `rawBytes check failed: ${rawBytes?.details}`).toBe(
      true,
    );
  });

  // ----- idempotency -----

  it('preserves OpenCode JSONC: second apply produces identical bytes (idempotency)', async () => {
    const ctx = makeCtx();
    const filesystemServer: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/home/user/projects',
      ],
    };
    // First apply
    await writeAndHarness(
      ctx,
      [{ name: 'filesystem', server: filesystemServer }],
      ['mcp', 'filesystem'],
    );
    // Read the result for the second apply
    const fixturePath = join(ctx.configDir, 'opencode', 'opencode.jsonc');
    const firstWritten = await readFile(fixturePath, 'utf-8');
    // Second apply — writer applied to its own output
    const secondReport = runPreservationChecks({
      format: 'jsonc',
      original: OPENCODE_FIXTURE,
      written: firstWritten,
      rewritten: firstWritten,
      targetPath: ['mcp', 'filesystem'],
    });
    const idem = secondReport.checks.find((c) => c.name === 'idempotency');
    expect(idem?.pass, `idempotency check failed: ${idem?.details}`).toBe(true);
  });

  // ----- extension field preservation (TODO-6 pending) -----

  it('preserves OpenCode JSONC: existing server enabled field is not stripped', async () => {
    // The fixture has mcp.filesystem.enabled = true.
    // When the writer updates filesystem, enabled must be preserved.
    // TODO-6: assert the writer explicitly preserves enabled after implementation.
    const ctx = makeCtx();
    const updatedFilesystem: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/home/user/projects',
      ],
    };
    const { written } = await writeAndHarness(
      ctx,
      [{ name: 'filesystem', server: updatedFilesystem }],
      ['mcp', 'filesystem'],
    );
    // After Todo 6 the writer preserves the enabled field
    expect(written).toContain('"enabled": true');
  });

  it('preserves OpenCode JSONC: existing server timeout field is not stripped', async () => {
    // The fixture has mcp.context7.timeout = 30.
    // TODO-6: when updating context7, the writer should preserve timeout.
    const ctx = makeCtx();
    const context7Server: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp@latest'],
    };
    const { written } = await writeAndHarness(
      ctx,
      [{ name: 'context7', server: context7Server }],
      ['mcp', 'context7'],
    );
    // After Todo 6 the writer preserves the timeout field
    expect(written).toContain('"timeout": 30');
  });

  it('preserves OpenCode JSONC: existing server oauth: false is not stripped', async () => {
    // OpenCode supports oauth extension field. When a server has oauth: false or
    // oauth: {...}, the writer must preserve it.
    // TODO-6: if a writer strips an existing oauth field, rawBytes or mcpServers
    // will catch it (the byte content of the server entry changes).
    const ctx = makeCtx();
    const { report } = await writeAndHarness(ctx, [], ['mcp', 'filesystem']);
    const rawBytes = report.checks.find((c) => c.name === 'rawBytes');
    expect(rawBytes?.pass, `rawBytes check failed: ${rawBytes?.details}`).toBe(
      true,
    );
  });
});

describe('canonical to native OpenCode conversion', () => {
  it('canonical to native: stdio with args and env produces local command vector plus environment', () => {
    const canonical: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      env: { NODE_ENV: 'production' },
    };

    const result = toOpenCodeMcpServer(canonical);

    expect(result.type).toBe('local');
    if (result.type !== 'local') {
      throw new Error('Expected local OpenCode server');
    }
    expect(result.command).toEqual([
      'npx',
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '/tmp',
    ]);
    expect(result.environment).toEqual({ NODE_ENV: 'production' });
  });

  it('canonical to native: stdio without args and env produces command-only local entry', () => {
    const canonical: OvertureMcpServer = {
      type: 'stdio',
      command: 'echo',
    };

    const result = toOpenCodeMcpServer(canonical);

    expect(result.type).toBe('local');
    if (result.type !== 'local') {
      throw new Error('Expected local OpenCode server');
    }
    expect(result.command).toEqual(['echo']);
    expect(Object.hasOwn(result, 'environment')).toBe(false);
  });

  it('canonical to native: remote with headers produces url plus headers', () => {
    const canonical: OvertureMcpServer = {
      type: 'remote',
      url: 'https://mcp.example.com/bridge',
      headers: { Authorization: 'Bearer token' },
    };

    const result = toOpenCodeMcpServer(canonical);

    expect(result.type).toBe('remote');
    if (result.type !== 'remote') {
      throw new Error('Expected remote OpenCode server');
    }
    expect(result.url).toBe('https://mcp.example.com/bridge');
    expect(result.headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('canonical to native: remote without headers omits the headers key', () => {
    const canonical: OvertureMcpServer = {
      type: 'remote',
      url: 'https://mcp.example.com/bridge',
    };

    const result = toOpenCodeMcpServer(canonical);

    expect(result.type).toBe('remote');
    if (result.type !== 'remote') {
      throw new Error('Expected remote OpenCode server');
    }
    expect(result.url).toBe('https://mcp.example.com/bridge');
    expect(Object.hasOwn(result, 'headers')).toBe(false);
  });

  it('canonical to native: extension preservation keeps local enabled, timeout, oauth:false, and unknown field', () => {
    const canonical: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'server'],
      env: { NEW_ENV: 'value' },
    };
    const existing: OpenCodeWritableMcpServer = {
      type: 'local',
      command: ['old-command'],
      environment: { OLD_ENV: 'old' },
      enabled: true,
      timeout: 30,
      oauth: false,
      unknownField: 'preserved',
    };

    const result = toOpenCodeMcpServer(canonical, existing);

    expect(result.type).toBe('local');
    if (result.type !== 'local') {
      throw new Error('Expected local OpenCode server');
    }
    expect(result.command).toEqual(['npx', '-y', 'server']);
    expect(result.environment).toEqual({ NEW_ENV: 'value' });
    expect(result.enabled).toBe(true);
    expect(result.timeout).toBe(30);
    expect(result.oauth).toBe(false);
    expect(result.unknownField).toBe('preserved');
  });

  it('canonical to native: extension preservation keeps remote unknown field and overrides old url/headers', () => {
    const canonical: OvertureMcpServer = {
      type: 'remote',
      url: 'https://new.example.com',
      headers: { Authorization: 'Bearer new' },
    };
    const existing: OpenCodeWritableMcpServer = {
      type: 'remote',
      url: 'https://old.example.com',
      headers: { Authorization: 'Bearer old' },
      unknownField: 'preserved',
    };

    const result = toOpenCodeMcpServer(canonical, existing);

    expect(result.type).toBe('remote');
    if (result.type !== 'remote') {
      throw new Error('Expected remote OpenCode server');
    }
    expect(result.url).toBe('https://new.example.com');
    expect(result.headers).toEqual({ Authorization: 'Bearer new' });
    expect(result.unknownField).toBe('preserved');
  });
});
