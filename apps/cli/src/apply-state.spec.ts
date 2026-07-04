/**
 * G1 + G2 — `apply-state` codec suite (pure helpers + filesystem writer).
 *
 * Locks the contract for `apps/cli/src/apply-state.ts`: the per-run state
 * codec, the `readApplyState` round-trip, and the retention GC. The
 * orchestrator-level apply-state recording (pre-discovery, post-hash,
 * `writeApplyState` best-effort) lives in `apply-command.spec.ts`.
 * Each case is independent of the others:
 *   - Pure-function cases (1, 2, 3) need no filesystem.
 *   - Filesystem cases (4, 5, 6) use `mkdtempSync` for isolation, with
 *     `afterEach` rm-rf cleanup mirroring the existing
 *     `apply-command.spec.ts` pattern.
 *
 * Coverage map (each `it(...)` is one bullet per the plan's Must-have):
 *   1. `sha256OfFile` returns the canonical hex digest for a known fixture
 *      and `null` for missing paths.
 *   2. `generateRunId` returns `<formatBackupTimestamp>-<8hex>` and two
 *      calls produce different suffixes.
 *   3. `buildApplyStateRecord` projects an `ApplyResult`-like input into
 *      an `ApplyStateRecord` with per-agent fields populated correctly.
 *   4. `writeApplyState` writes both files atomically under a tmpdir;
 *      `readApplyState` round-trips byte-identically.
 *   5. `pruneApplyArtifacts(stateDir, 10)` keeps the 10 most recent
 *      per-run PAIRS (lexical by runId, G2 paired retention) and unlinks
 *      BOTH the `.json` AND `.log` for the 2 oldest runIds. Pre-seeded
 *      12 paired files spanning two timestamps.
 *   6. `pruneApplyState(stateDir, 0)` unlinks every per-run `.json` (G1
 *      backward-compat wrapper behavior preserved).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AgentMcpWriteResult } from '@overture/agents';

/**
 * Inferred shape of one entry in `AgentMcpWriteResult.targetPaths`. Mirrors
 * `apps/cli/src/apply-command.ts` line 657 (`type WriteTargetPath`); avoids
 * importing `TargetPath` from `@overture/agents` directly because that
 * surface re-exports the writer-preservation `TargetPath` (a
 * `readonly string[]`) rather than the structural one with `scope`/`base`/
 * `path`.
 */
type AgentTargetPath = AgentMcpWriteResult['targetPaths'][number];

import {
  formatBackupTimestamp,
  type ApplyAgentResult,
} from './apply-command.js';
import {
  buildApplyStateRecord,
  generateRunId,
  pruneApplyArtifacts,
  pruneApplyState,
  readApplyState,
  sha256OfFile,
  writeApplyState,
  type ApplyStateRecord,
  type BuildApplyStateRecordArgs,
} from './apply-state.js';

describe('apply-state (G1 contract)', () => {
  // Per-test cleanup scratchpad. Mirrors `apply-command.spec.ts` style.
  let cleanupDirs: string[] = [];

  beforeEach(() => {
    cleanupDirs = [];
  });

  afterEach(() => {
    for (const d of cleanupDirs) {
      rmSync(d, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Case 1 — sha256OfFile
  // -------------------------------------------------------------------------

  it('sha256OfFile returns the canonical hex digest for a known fixture and null for missing paths', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'g1-state-fixture-'));
    cleanupDirs.push(tmp);
    const target = join(tmp, 'sample.txt');
    const fixture = 'hello overture\n';
    writeFileSync(target, fixture);
    const expected = createHash('sha256').update(fixture).digest('hex');

    const present = await sha256OfFile(target);
    expect(present).toBe(expected);

    const missing = await sha256OfFile(join(tmp, 'does-not-exist.txt'));
    expect(missing).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Case 2 — generateRunId
  // -------------------------------------------------------------------------

  it('generateRunId returns <formatBackupTimestamp>-<8hex> with two calls producing different suffixes', () => {
    const now = new Date('2026-07-04T18:30:00.123Z');
    const tsPart = formatBackupTimestamp(now);
    const a = generateRunId(now);
    const b = generateRunId(now);

    // Shape: <formatBackupTimestamp>-<8hex>.
    expect(a).toMatch(new RegExp(`^${tsPart}-[0-9a-f]{8}$`));
    expect(b).toMatch(new RegExp(`^${tsPart}-[0-9a-f]{8}$`));

    // Different 8-hex suffixes (randomness check).
    const aSuffix = a.slice(tsPart.length + 1);
    const bSuffix = b.slice(tsPart.length + 1);
    expect(aSuffix).not.toBe(bSuffix);
  });

  // -------------------------------------------------------------------------
  // Case 3 — buildApplyStateRecord
  // -------------------------------------------------------------------------

  it('buildApplyStateRecord projects ApplyAgentResult into ApplyStateRecord with per-agent fields', () => {
    const targets: AgentTargetPath[] = [
      { scope: 'user', base: 'home', path: '/home/test/.claude.json' },
      { scope: 'user', base: 'home', path: '/home/test/.mcp.json' },
    ];
    const writerResult: AgentMcpWriteResult = {
      written: 2,
      changed: true,
      dryRun: false,
      serversWritten: ['filesystem'],
      targetPaths: targets,
    };
    const agentResult: ApplyAgentResult = {
      agentId: 'claude-code',
      displayName: 'Claude Code',
      status: 'updated',
      result: writerResult,
      backupPaths: ['/home/test/.claude.json.bak.20260704-183000123'],
    };
    const args: BuildApplyStateRecordArgs = {
      runId: '20260704-183000123-abcdef01',
      now: new Date('2026-07-04T18:30:00.123Z'),
      mode: 'apply',
      profileName: 'default',
      configPath: '/home/test/overture.jsonc',
      backupBeforeWrite: true,
      ctx: {
        homeDir: '/home/test',
        configDir: '/home/test/.config',
        workspaceDir: '/home/test/ws',
        platform: 'linux',
      },
      perAgent: [
        {
          agentResult,
          preSnapshots: [
            '1111111111111111111111111111111111111111111111111111111111111111',
            '2222222222222222222222222222222222222222222222222222222222222222',
          ],
          postSnapshots: [
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          ],
        },
      ],
    };

    const record = buildApplyStateRecord(args);

    expect(record).toMatchObject({
      schemaVersion: 1,
      runId: '20260704-183000123-abcdef01',
      mode: 'apply',
      profile: 'default',
      configPath: '/home/test/overture.jsonc',
      backupBeforeWrite: true,
    });
    expect(record.agents).toHaveLength(1);
    const agent = record.agents[0];
    expect(agent).toBeDefined();
    if (!agent) throw new Error('expected one ApplyStateAgent');
    expect(agent.agentId).toBe('claude-code');
    expect(agent.displayName).toBe('Claude Code');
    expect(agent.status).toBe('updated');
    expect(agent.targetPaths).toEqual([
      '/home/test/.claude.json',
      '/home/test/.mcp.json',
    ]);
    expect(agent.backupPaths).toEqual([
      '/home/test/.claude.json.bak.20260704-183000123',
    ]);
    expect(agent.preWriteSha256).toBe(
      '1111111111111111111111111111111111111111111111111111111111111111',
    );
    expect(agent.postWriteSha256).toBe(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
  });

  // -------------------------------------------------------------------------
  // Case 4 — writeApplyState + readApplyState round-trip
  // -------------------------------------------------------------------------

  it('writeApplyState writes both files atomically and readApplyState round-trips byte-identically', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'g1-state-writes-'));
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    mkdirSync(stateDir, { recursive: true });

    const record: ApplyStateRecord = {
      schemaVersion: 1,
      runId: '20260704-183000123-deadbeef',
      timestamp: '2026-07-04T18:30:00.123Z',
      mode: 'apply',
      profile: 'default',
      configPath: '/home/test/overture.jsonc',
      backupBeforeWrite: true,
      agents: [
        {
          agentId: 'claude-code',
          displayName: 'Claude Code',
          status: 'updated',
          targetPaths: ['/home/test/.claude.json'],
          backupPaths: [],
          preWriteSha256: null,
          postWriteSha256: null,
        },
      ],
    };

    const result = await writeApplyState(record, stateDir, 10);

    // Exact paths for both artifacts.
    expect(result.recordPath).toBe(
      join(stateDir, '20260704-183000123-deadbeef.json'),
    );
    expect(result.pointerPath).toBe(join(stateDir, 'last.json'));
    // Nothing to prune on a fresh dir.
    expect(result.pruned).toEqual([]);

    // Both files exist and are non-empty.
    expect(readFileSync(result.recordPath, 'utf8').length).toBeGreaterThan(0);
    expect(readFileSync(result.pointerPath, 'utf8').length).toBeGreaterThan(0);

    // No stray .tmp-* files left behind after the atomic rename.
    const filesAfter = readdirSync(stateDir).sort();
    expect(filesAfter).toContain('20260704-183000123-deadbeef.json');
    expect(filesAfter).toContain('last.json');
    expect(filesAfter.filter((f) => f.includes('.tmp'))).toEqual([]);

    // Round-trip: re-serializing readApplyState's output must produce the
    // exact bytes on disk.
    const onDisk = readFileSync(result.recordPath, 'utf8');
    const readBack = await readApplyState(result.recordPath);
    expect(JSON.stringify(readBack)).toBe(onDisk);
  });

  // -------------------------------------------------------------------------
  // Case 5 — pruneApplyArtifacts keeps the 10 newest per-run pairs
  // (G2 promotion: paired `.json` + `.log` retention, replacing G1's
  // `.json`-only pruneApplyState. The original Case 5 fixture + assertion
  // shape is preserved, with `.log` files added 1:1 against the `.json`
  // files. The returned `pruned` list contains BOTH basenames per pair.)
  // -------------------------------------------------------------------------

  it('pruneApplyArtifacts(stateDir, 10) keeps the 10 most recent per-run pairs and unlinks both .json + .log for the rest', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'g1-state-prune-'));
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    mkdirSync(stateDir, { recursive: true });

    // 12 fixture files across two timestamps. ts1-* lexically < ts2-*.
    // Pruning to 10 must drop exactly the two lexically oldest (ts1-01, ts1-02).
    const ts1 = '20260101-000000000';
    const ts2 = '20260102-000000000';
    const runIds = [
      `${ts1}-00000001`,
      `${ts1}-00000002`,
      `${ts1}-00000003`,
      `${ts1}-00000004`,
      `${ts1}-00000005`,
      `${ts1}-00000006`,
      `${ts2}-00000007`,
      `${ts2}-00000008`,
      `${ts2}-00000009`,
      `${ts2}-0000000a`,
      `${ts2}-0000000b`,
      `${ts2}-0000000c`,
    ];
    for (const id of runIds) {
      writeFileSync(join(stateDir, `${id}.json`), `{"runId":"${id}"}`);
      // G2: each .json is paired with a .log. The pruner unlinks BOTH.
      writeFileSync(
        join(stateDir, `${id}.log`),
        `Overture apply log\nrunId: ${id}\n`,
      );
    }
    expect(readdirSync(stateDir)).toHaveLength(24); // 12 json + 12 log

    const pruned = await pruneApplyArtifacts(stateDir, 10);

    const remaining = readdirSync(stateDir).sort();
    expect(remaining).toHaveLength(20); // 10 json + 10 log
    // Two lexically oldest pairs removed (BOTH .json AND .log per pair).
    expect(remaining).not.toContain(`${ts1}-00000001.json`);
    expect(remaining).not.toContain(`${ts1}-00000001.log`);
    expect(remaining).not.toContain(`${ts1}-00000002.json`);
    expect(remaining).not.toContain(`${ts1}-00000002.log`);
    // The remaining 20 are exactly the lexically newest 10 runIds x 2.
    const expectedRemaining = [
      ...runIds
        .slice()
        .sort()
        .slice(-10)
        .map((id) => `${id}.json`),
      ...runIds
        .slice()
        .sort()
        .slice(-10)
        .map((id) => `${id}.log`),
    ].sort();
    expect(remaining).toEqual(expectedRemaining);
    // The returned pruned list reports BOTH basenames per pair.
    expect(pruned.slice().sort()).toEqual([
      `${ts1}-00000001.json`,
      `${ts1}-00000001.log`,
      `${ts1}-00000002.json`,
      `${ts1}-00000002.log`,
    ]);
  });

  // -------------------------------------------------------------------------
  // Case 6 — pruneApplyState(stateDir, 0) unlinks everything
  // -------------------------------------------------------------------------

  it('pruneApplyState(stateDir, 0) unlinks every per-run file', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'g1-state-prune0-'));
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    mkdirSync(stateDir, { recursive: true });

    writeFileSync(
      join(stateDir, '20260101-000000000-aaaaaaaa.json'),
      '{"runId":"20260101-000000000-aaaaaaaa"}',
    );
    writeFileSync(
      join(stateDir, '20260102-000000000-bbbbbbbb.json'),
      '{"runId":"20260102-000000000-bbbbbbbb"}',
    );
    writeFileSync(
      join(stateDir, '20260103-000000000-cccccccc.json'),
      '{"runId":"20260103-000000000-cccccccc"}',
    );

    const pruned = await pruneApplyState(stateDir, 0);

    expect(readdirSync(stateDir)).toEqual([]);
    expect(pruned.slice().sort()).toEqual([
      '20260101-000000000-aaaaaaaa.json',
      '20260102-000000000-bbbbbbbb.json',
      '20260103-000000000-cccccccc.json',
    ]);
  });

  // -------------------------------------------------------------------------
  // Case 7 — buildApplyStateRecord resolves relative targetPaths (G3 fix).
  // OpenCode / Codex writers emit `targetPaths[*].path` as the raw
  // `loc.relativePath`; the apply-time `PathResolutionContext` is the only
  // anchor that can turn those into absolutes. The persisted record must
  // hold the resolved absolute path so the G3 `restore-last` helper can
  // `mv` against it without guessing the apply-time cwd. Absolute inputs
  // are idempotent (resolveTargetBase passes them through).
  // -------------------------------------------------------------------------

  it('buildApplyStateRecord resolves relative targetPaths against ctx (G3 F3 fix)', () => {
    const targets: AgentTargetPath[] = [
      // OpenCode convention: relative path with a `base` hint.
      { scope: 'project', base: 'workspace', path: 'opencode/opencode.json' },
      // Codex convention: also relative, but anchored against home.
      { scope: 'user', base: 'home', path: '.codex/config.toml' },
      // Claude / Copilot convention: already absolute (idempotent pass-through).
      { scope: 'user', base: 'home', path: '/home/test/.claude.json' },
    ];
    const writerResult: AgentMcpWriteResult = {
      written: 3,
      changed: true,
      dryRun: false,
      serversWritten: ['filesystem'],
      targetPaths: targets,
    };
    const agentResult: ApplyAgentResult = {
      agentId: 'mixed',
      displayName: 'Mixed Agents',
      status: 'updated',
      result: writerResult,
      backupPaths: [
        '/tmp/ws/opencode/opencode.json.bak.20260704-200000000',
        '/home/test/.codex/config.toml.bak.20260704-200000000',
        '/home/test/.claude.json.bak.20260704-200000000',
      ],
    };
    const ctx = {
      homeDir: '/home/test',
      configDir: '/home/test/.config',
      workspaceDir: '/tmp/ws',
      platform: 'linux' as const,
    };
    const args: BuildApplyStateRecordArgs = {
      runId: '20260704-200000000-deadbeef',
      now: new Date('2026-07-04T20:00:00.000Z'),
      mode: 'apply',
      profileName: 'default',
      configPath: '/home/test/overture.jsonc',
      backupBeforeWrite: true,
      ctx,
      perAgent: [
        {
          agentResult,
          preSnapshots: ['aaaa', 'bbbb', 'cccc'],
          postSnapshots: ['dddd', 'eeee', 'ffff'],
        },
      ],
    };

    const record = buildApplyStateRecord(args);

    expect(record.agents).toHaveLength(1);
    const agent = record.agents[0];
    if (!agent) throw new Error('expected one ApplyStateAgent');
    // Each writer-style relative path resolves against its declared base.
    expect(agent.targetPaths).toEqual([
      '/tmp/ws/opencode/opencode.json',
      '/home/test/.codex/config.toml',
      '/home/test/.claude.json',
    ]);
    // backupPaths stay whatever the writer/orchestrator produced (untouched).
    expect(agent.backupPaths).toEqual([
      '/tmp/ws/opencode/opencode.json.bak.20260704-200000000',
      '/home/test/.codex/config.toml.bak.20260704-200000000',
      '/home/test/.claude.json.bak.20260704-200000000',
    ]);
  });
});
