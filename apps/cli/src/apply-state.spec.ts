/**
 * G1 — `apply-state` module tests (RED phase).
 *
 * TDD red phase per `.omo/plans/g1-apply-state-file.md` Todo 1. These cases
 * lock the contract for `apps/cli/src/apply-state.ts` before Wave 2 lands.
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
 *   5. `pruneApplyState(stateDir, 10)` keeps the 10 most recent per-run
 *      files (lexical by runId) and unlinks the rest. Pre-seeded 12 files
 *      spanning two timestamps; oldest 2 must be removed.
 *   6. `pruneApplyState(stateDir, 0)` unlinks everything.
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
      profile: {
        mcpServers: {},
        sync: { targets: ['claude-code'], disabledServers: [] },
        skills: [],
      },
      configPath: '/home/test/overture.jsonc',
      backupBeforeWrite: true,
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
  // Case 5 — pruneApplyState keeps the 10 newest per-run files
  // -------------------------------------------------------------------------

  it('pruneApplyState(stateDir, 10) keeps the 10 most recent per-run files and unlinks the rest', async () => {
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
    }
    expect(readdirSync(stateDir)).toHaveLength(12);

    const pruned = await pruneApplyState(stateDir, 10);

    const remaining = readdirSync(stateDir).sort();
    expect(remaining).toHaveLength(10);
    // Two lexically oldest removed.
    expect(remaining).not.toContain(`${ts1}-00000001.json`);
    expect(remaining).not.toContain(`${ts1}-00000002.json`);
    // The remaining 10 are exactly the lexically newest 10 runIds.
    const expectedRemaining = runIds
      .slice()
      .sort()
      .slice(-10)
      .map((id) => `${id}.json`);
    expect(remaining).toEqual(expectedRemaining);
    // The returned pruned list reports the basenames that were unlinked.
    expect(pruned.slice().sort()).toEqual([
      `${ts1}-00000001.json`,
      `${ts1}-00000002.json`,
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
});
