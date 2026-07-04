/**
 * G3 — `restore-command` suite (pure helpers + dispatcher entry).
 *
 * Each case mirrors one bullet from the plan's Must-have list. Wave 1
 * created these as RED cases against the stub; Wave 2 turns cases 1-5
 * green by implementing the pure helpers + flag parser + TTY prompt
 * helper; Wave 3 turns cases 6-11 green by implementing `runRestore`'s
 * execute path (`mv -v` per pair) + the dispatcher arm in `cli.ts`.
 *
 * Cases 12-15 (CLI dispatcher regressions) live in `cli.spec.ts`.
 *
 * **Task 4 (2026-07-04)** — user verdict re-classified `missing-backup`
 * from a `skipped` outcome to a `failed` outcome. The execution loop
 * in `runRestore` now aborts the batch on the first missing-backup
 * pair, surfaces a clear stderr error per pair, writes a follow-up
 * stderr hint pointing the user at `<stateDir>/apply/`, and exits 1.
 * Case 12 below locks the new behavior: a plan with N pairs where 1
 * is `missing-backup` and N-1 are `ok` must exit 1 with no `mv`
 * shell-out fired.
 *
 * Coverage map (each `it(...)` is one Must-have bullet):
 *   1. `readRestoreSource` reads the JSON path correctly (source =
 *      'state-json', pairs match seeded `agents[*].backupPaths/targetPaths`).
 *   2. `readRestoreSource` falls back to log-tag-lines when JSON is absent
 *      (source = 'log-tag-lines', pairs projected via `readApplyLog`'s
 *      `restorePairs`).
 *   3. `buildRestorePlan` integrity check: 3 targets (A matches, B
 *      differs, C absent) → statuses `ok / mismatch / missing-backup`.
 *   4. `formatHumanRestorePlan` produces a stable 3-section rendering.
 *   5. `runRestore --dry-run` exits 0, writes plan to stdout, performs
 *      NO filesystem writes (no `child_process.spawn` invocations).
 *   6. `runRestore --yes` with all `ok` pairs: real `mv`s execute,
 *      targets restored, exit 0.
 *   7. `runRestore --yes` with a `mismatch` pair (no `--force`): exit 1,
 *      target NOT clobbered, stderr carries the rejection line.
 *   8. `runRestore --yes --force` with a `mismatch` pair: proceeds with
 *      stderr WARN, exit 0 iff every pair succeeded.
 *   9. `runRestore --run-id <other-runId>`: overrides `last.json`'s
 *      default; `--run-id` for a pruned runId exits 1 with stderr
 *      "run <id> not found in <stateDir>".
 *  10. Missing `last.json`: exit 1 with stderr "no overture apply
 *      history found in <stateDir>" + USAGE hint.
 *  11. TTY simulation: interactive `y\n` permits execution, `n\n` aborts.
 *      Uses injected prompt helper so tests don't touch real stdin.
 *  12. `runRestore --yes` with a plan that has 1 `missing-backup` pair
 *      amid N-1 `ok` pairs (user verdict 2026-07-04): exit 1; stderr
 *      carries `error: backup file missing:` AND the follow-up hint;
 *      the `ok` pairs are NOT executed (atomic whole-run semantics per
 *      gate G3-8); the spawn-call mock confirms zero `mv` shell-outs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildApplyLog, writeApplyLog } from './apply-log.js';
import { writeApplyState } from './apply-state.js';
import type { ApplyLogContent } from './apply-log.js';
import type { ApplyStateRecord } from './apply-state.js';
import {
  buildRestorePlan,
  formatHumanRestorePlan,
  readRestoreSource,
  runRestore,
} from './restore-command.js';

// F1 fix: track every `child_process.spawn` invocation across the
// suite. The ESM-sealed `node:child_process` namespace can't be mutated
// via `vi.spyOn` (project memory 49), so we use a hoisted `vi.mock`
// that wraps the real `spawn` and pushes every call into a shared
// array. Tests inspect `spawnCalls` to assert the dry-run / non-execute
// paths never fire a `mv` shell-out.
const spawnCalls: {
  command: string;
  args: readonly string[];
}[] = [];
vi.mock('node:child_process', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:child_process')>();
  return {
    ...real,
    spawn: ((
      command: string,
      args: readonly string[],
      ...rest: unknown[]
    ): unknown => {
      spawnCalls.push({ command, args });
      return (real.spawn as (...a: unknown[]) => unknown)(
        command,
        args,
        ...rest,
      );
    }) as typeof real.spawn,
  };
});

// ---------------------------------------------------------------------------
// Shared fixture helpers.
// ---------------------------------------------------------------------------

interface SeedArgs {
  readonly tmp: string;
  readonly stateDir: string;
  readonly runId: string;
  readonly backup?: string;
  readonly target?: string;
  readonly targetContent?: string;
  readonly preSha?: string;
}

function freshTmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function seedStateJsonRecord(args: SeedArgs): ApplyStateRecord {
  const target = args.target ?? join(args.tmp, 'mcp-target.json');
  const backup =
    args.backup ?? join(args.tmp, 'mcp-target.json.bak.20260704-183000123');
  // Default target content == backup content so integrity check is `ok`
  // (current target equals preWriteSha256 = the bytes the backup holds).
  // Tests that want `mismatch` override `targetContent` to diverge from the
  // backup bytes (and from preWriteSha256).
  const targetContent = args.targetContent ?? '{"old":true}\n';
  writeFileSync(target, targetContent);
  if (!existsSync(backup)) writeFileSync(backup, '{"old":true}\n');
  const preSha =
    args.preSha ?? createHash('sha256').update('{"old":true}\n').digest('hex');
  const record: ApplyStateRecord = {
    schemaVersion: 1,
    runId: args.runId,
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
        targetPaths: [target],
        backupPaths: [backup],
        preWriteSha256: preSha,
        postWriteSha256: null,
      },
    ],
  };
  return record;
}

async function seedStateJson(args: SeedArgs): Promise<{
  stateDir: string;
  runId: string;
  backup: string;
  target: string;
  targetContent: string;
}> {
  mkdirSync(args.stateDir, { recursive: true });
  const record = seedStateJsonRecord(args);
  await writeApplyState(record, args.stateDir, 10);
  // Read-back to resolve the on-disk backup/target paths (defaults above).
  const agent = record.agents[0];
  if (!agent) throw new Error('expected one agent in fixture');
  const target = agent.targetPaths[0];
  const backup = agent.backupPaths[0];
  if (!target || !backup)
    throw new Error('expected target + backup in fixture');
  const targetContent = readFileSync(target, 'utf8');
  return {
    stateDir: args.stateDir,
    runId: args.runId,
    backup,
    target,
    targetContent,
  };
}

describe('restore-command (G3 contract)', () => {
  let cleanupDirs: string[] = [];

  beforeEach(() => {
    cleanupDirs = [];
  });

  afterEach(() => {
    for (const d of cleanupDirs) {
      rmSync(d, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Case 1 — readRestoreSource JSON path
  // -------------------------------------------------------------------------

  it('readRestoreSource reads the JSON path correctly when last.json + <runId>.json exist', async () => {
    const tmp = freshTmp('g3-restore-json-');
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    const runId = '20260704-183000123-abcdef01';
    const seeded = await seedStateJson({
      tmp,
      stateDir,
      runId,
    });

    const result = await readRestoreSource(stateDir, runId);

    expect(result.source).toBe('state-json');
    expect(result.runId).toBe(runId);
    expect(result.configPath).toBe('/home/test/overture.jsonc');
    expect(result.notes).toEqual([]);
    expect(result.rawPairs).toHaveLength(1);
    const pair = result.rawPairs[0];
    if (!pair) throw new Error('expected one raw pair');
    expect(pair.agentId).toBe('claude-code');
    expect(pair.displayName).toBe('Claude Code');
    expect(pair.backup).toBe(seeded.backup);
    expect(pair.target).toBe(seeded.target);
    expect(pair.preWriteSha256).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Case 2 — readRestoreSource log-tag-lines fallback
  // -------------------------------------------------------------------------

  it('readRestoreSource falls back to log-tag-lines when JSON is absent', async () => {
    const tmp = freshTmp('g3-restore-log-');
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    mkdirSync(stateDir, { recursive: true });

    // Build a log from a record, then seed only the .log (no .json written).
    const record = seedStateJsonRecord({
      tmp,
      stateDir,
      runId: '20260704-183000123-fedcba98',
    });
    const logContent: ApplyLogContent = buildApplyLog(
      record,
      'overture@test',
      stateDir,
    );
    await writeApplyLog(logContent, stateDir, 10);

    const result = await readRestoreSource(stateDir, record.runId);

    expect(result.source).toBe('log-tag-lines');
    expect(result.runId).toBe(record.runId);
    expect(result.configPath).toBe('/home/test/overture.jsonc');
    expect(result.rawPairs).toHaveLength(1);
    const pair = result.rawPairs[0];
    if (!pair) throw new Error('expected one raw pair');
    expect(pair.agentId).toBe('claude-code');
    expect(pair.preWriteSha256).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Case 3 — buildRestorePlan integrity check
  // -------------------------------------------------------------------------

  it('buildRestorePlan evaluates ok / mismatch / missing-backup across three targets', async () => {
    const tmp = freshTmp('g3-restore-integrity-');
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    mkdirSync(stateDir, { recursive: true });

    const runId = '20260704-183000123-12345678';

    // Target A: current bytes match preWriteSha256 → `ok`.
    const targetA = join(tmp, 'target-a.json');
    const backupA = join(tmp, 'target-a.json.bak.20260704');
    const postA = createHash('sha256').update('current-a\n').digest('hex');
    writeFileSync(targetA, 'orig-a\n');
    writeFileSync(backupA, 'orig-a\n');
    // sha256OfFile() reads bytes; preWriteSha256 is the digest of `orig-a\n`.
    const preASha = createHash('sha256').update('orig-a\n').digest('hex');

    // Target B: current bytes DIFFER from preWriteSha256 → `mismatch`.
    const targetB = join(tmp, 'target-b.json');
    const backupB = join(tmp, 'target-b.json.bak.20260704');
    writeFileSync(targetB, 'edited-by-user\n');
    writeFileSync(backupB, 'orig-b\n');
    const preBSha = createHash('sha256').update('orig-b\n').digest('hex');

    // Target C: backup is absent → `missing-backup`.
    const targetC = join(tmp, 'target-c.json');
    const backupC = join(tmp, 'target-c.json.bak.20260704');
    writeFileSync(targetC, 'current-c\n');
    // No backup file created on disk → missing-backup.
    const preCSha = createHash('sha256').update('orig-c\n').digest('hex');

    const record: ApplyStateRecord = {
      schemaVersion: 1,
      runId,
      timestamp: '2026-07-04T18:30:00.123Z',
      mode: 'apply',
      profile: 'default',
      configPath: '/home/test/overture.jsonc',
      backupBeforeWrite: true,
      agents: [
        {
          agentId: 'a-agent',
          displayName: 'A Agent',
          status: 'updated',
          targetPaths: [targetA],
          backupPaths: [backupA],
          preWriteSha256: preASha,
          postWriteSha256: postA,
        },
        {
          agentId: 'b-agent',
          displayName: 'B Agent',
          status: 'updated',
          targetPaths: [targetB],
          backupPaths: [backupB],
          preWriteSha256: preBSha,
          postWriteSha256: null,
        },
        {
          agentId: 'c-agent',
          displayName: 'C Agent',
          status: 'updated',
          targetPaths: [targetC],
          backupPaths: [backupC],
          preWriteSha256: preCSha,
          postWriteSha256: null,
        },
      ],
    };
    await writeApplyState(record, stateDir, 10);

    const plan = await buildRestorePlan(stateDir, runId, new Date());

    expect(plan.source).toBe('state-json');
    expect(plan.pairs).toHaveLength(3);
    const byAgent = new Map(plan.pairs.map((p) => [p.agentId, p]));
    const a = byAgent.get('a-agent');
    const b = byAgent.get('b-agent');
    const c = byAgent.get('c-agent');
    expect(a?.integrityStatus).toBe('ok');
    expect(b?.integrityStatus).toBe('mismatch');
    expect(c?.integrityStatus).toBe('missing-backup');
    // preWriteSha256 / currentSha256 surfaces for ok + mismatch, absent for
    // missing-backup (writer-aligned zipping).
    expect(a?.preWriteSha256).toBe(preASha);
    expect(a?.currentSha256).toBe(preASha);
    expect(b?.preWriteSha256).toBe(preBSha);
    expect(b?.currentSha256).not.toBe(preBSha);
    expect(c?.preWriteSha256).toBe(preCSha);
  });

  // -------------------------------------------------------------------------
  // Case 4 — formatHumanRestorePlan stable rendering
  // -------------------------------------------------------------------------

  it('formatHumanRestorePlan produces a stable rendering with header / per-pair / footer sections', () => {
    const plan = {
      source: 'state-json' as const,
      runId: '20260704-183000123-aabbccdd',
      stateDir: '/home/test/.local/state/overture/apply',
      configPath: '/home/test/overture.jsonc',
      pairs: [
        {
          agentId: 'claude-code',
          displayName: 'Claude Code',
          backup: '/home/test/.claude.json.bak.20260704-183000123',
          target: '/home/test/.claude.json',
          integrityStatus: 'ok' as const,
          preWriteSha256: 'abc',
          currentSha256: 'abc',
        },
        {
          agentId: 'opencode',
          displayName: 'OpenCode',
          backup: '/home/test/.opencode.json.bak.20260704-183000123',
          target: '/home/test/.opencode.json',
          integrityStatus: 'mismatch' as const,
          preWriteSha256: 'def',
          currentSha256: 'fed',
        },
      ],
      notes: [],
    };
    const rendered = formatHumanRestorePlan(plan);

    // Three sections: header, per-pair block, footer.
    expect(rendered).toContain('Overture restore plan');
    expect(rendered).toContain('run id:        20260704-183000123-aabbccdd');
    expect(rendered).toContain('source:        state-json');
    expect(rendered).toContain('[claude-code] Claude Code');
    expect(rendered).toContain('status: ok');
    expect(rendered).toContain('[opencode] OpenCode');
    expect(rendered).toContain('status: mismatch');
    expect(rendered).toContain('mv -v');
    expect(rendered).toContain('pairs: 2');
    // mv -v lines use single-quoted paths (matches shellQuotePath contract).
    expect(rendered).toMatch(
      /mv -v '\/home\/test\/\.claude\.json\.bak\..*' '\/home\/test\/\.claude\.json'/,
    );
  });

  // -------------------------------------------------------------------------
  // Case 5 — runRestore --dry-run
  // -------------------------------------------------------------------------

  it('runRestore --dry-run exits 0, writes the plan, and performs no mv invocations', async () => {
    const tmp = freshTmp('g3-restore-dryrun-');
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    const runId = '20260704-183000123-00112233';
    const seeded = await seedStateJson({ tmp, stateDir, runId });
    const targetBefore = readFileSync(seeded.target, 'utf8');
    const backupBefore = readFileSync(seeded.backup, 'utf8');

    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWriter = { write: (s: string) => stdout.push(s) };
    const stderrWriter = { write: (s: string) => stderr.push(s) };

    // F1 fix: every `child_process.spawn` call is captured by the
    // hoisted `vi.mock('node:child_process', ...)` at the top of this
    // file. Snapshot the count before the call so we can prove the
    // dry-run path does NOT fire a `mv` (or any other) shell-out.
    const spawnCountBefore = spawnCalls.length;
    const code = await runRestore(['--dry-run'], stdoutWriter, stderrWriter, {
      isTTY: false,
      stateDir,
    });

    expect(code).toBe(0);
    // No filesystem writes: target and backup unchanged.
    expect(readFileSync(seeded.target, 'utf8')).toBe(targetBefore);
    expect(readFileSync(seeded.backup, 'utf8')).toBe(backupBefore);
    expect(stdout.join('')).toContain('Overture restore plan');
    expect(stdout.join('')).toContain(runId);
    expect(stdout.join('')).toContain('mv -v');
    expect(stderr.join('')).toBe('');
    // Dry-run invariant: NO new spawn calls (mv or otherwise) fired.
    const newCalls = spawnCalls.slice(spawnCountBefore);
    expect(newCalls).toEqual([]);
    const mvCalls = newCalls.filter((c) => c.command === 'mv');
    expect(mvCalls).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Case 6 — runRestore --yes all ok
  // -------------------------------------------------------------------------

  it('runRestore --yes with all ok pairs executes mv -v per pair and exits 0', async () => {
    const tmp = freshTmp('g3-restore-yes-ok-');
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    const runId = '20260704-183000123-aabbcc00';
    const seeded = await seedStateJson({ tmp, stateDir, runId });
    const backupContent = readFileSync(seeded.backup, 'utf8');

    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWriter = { write: (s: string) => stdout.push(s) };
    const stderrWriter = { write: (s: string) => stderr.push(s) };

    const code = await runRestore(['--yes'], stdoutWriter, stderrWriter, {
      isTTY: false,
      stateDir,
    });

    expect(code).toBe(0);
    // The backup should have moved into the target (overwriting current).
    expect(readFileSync(seeded.target, 'utf8')).toBe(backupContent);
    expect(existsSync(seeded.backup)).toBe(false);
    expect(stdout.join('')).toContain('Overture restore outcome');
    expect(stdout.join('')).toContain('restored: 1');
  });

  // -------------------------------------------------------------------------
  // Case 7 — runRestore --yes with a mismatch pair (no --force)
  // -------------------------------------------------------------------------

  it('runRestore --yes with a mismatch pair (no --force) exits 1 and does not clobber the target', async () => {
    const tmp = freshTmp('g3-restore-mismatch-');
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    const runId = '20260704-183000123-bbbb0001';

    const target = join(tmp, 'target.json');
    const backup = join(tmp, 'target.json.bak.20260704');
    const editedByUser = 'edited-by-user\n';
    const origBytes = 'orig\n';
    writeFileSync(target, editedByUser);
    writeFileSync(backup, origBytes);
    const preSha = createHash('sha256').update(origBytes).digest('hex');

    const record: ApplyStateRecord = {
      schemaVersion: 1,
      runId,
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
          targetPaths: [target],
          backupPaths: [backup],
          preWriteSha256: preSha,
          postWriteSha256: null,
        },
      ],
    };
    await writeApplyState(record, stateDir, 10);

    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWriter = { write: (s: string) => stdout.push(s) };
    const stderrWriter = { write: (s: string) => stderr.push(s) };

    const code = await runRestore(['--yes'], stdoutWriter, stderrWriter, {
      isTTY: false,
      stateDir,
    });

    expect(code).toBe(1);
    expect(readFileSync(target, 'utf8')).toBe(editedByUser);
    expect(existsSync(backup)).toBe(true);
    expect(stderr.join('')).toContain('refusing to restore');
  });

  // -------------------------------------------------------------------------
  // Case 8 — runRestore --yes --force with a mismatch pair
  // -------------------------------------------------------------------------

  it('runRestore --yes --force with a mismatch pair proceeds and surfaces the WARN', async () => {
    const tmp = freshTmp('g3-restore-force-');
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    const runId = '20260704-183000123-bbbb0002';

    const target = join(tmp, 'target.json');
    const backup = join(tmp, 'target.json.bak.20260704');
    const editedByUser = 'edited-by-user\n';
    const origBytes = 'orig\n';
    writeFileSync(target, editedByUser);
    writeFileSync(backup, origBytes);
    const preSha = createHash('sha256').update(origBytes).digest('hex');

    const record: ApplyStateRecord = {
      schemaVersion: 1,
      runId,
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
          targetPaths: [target],
          backupPaths: [backup],
          preWriteSha256: preSha,
          postWriteSha256: null,
        },
      ],
    };
    await writeApplyState(record, stateDir, 10);

    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWriter = { write: (s: string) => stdout.push(s) };
    const stderrWriter = { write: (s: string) => stderr.push(s) };

    const code = await runRestore(
      ['--yes', '--force'],
      stdoutWriter,
      stderrWriter,
      { isTTY: false, stateDir },
    );

    expect(code).toBe(0);
    expect(stderr.join('')).toContain('WARN: target');
    expect(stderr.join('')).toContain('restore forced');
    expect(readFileSync(target, 'utf8')).toBe(origBytes);
    expect(existsSync(backup)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 9 — runRestore --run-id override + pruned runId
  // -------------------------------------------------------------------------

  it('runRestore --run-id <id> overrides last.json; a pruned runId exits 1 with a clear stderr message', async () => {
    const tmp = freshTmp('g3-restore-runid-');
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    mkdirSync(stateDir, { recursive: true });

    // Seed a surviving runId.
    const survivingRunId = '20260704-183000123-cccc0001';
    await seedStateJson({ tmp, stateDir, runId: survivingRunId });

    // last.json points to a different (pruned) runId.
    writeFileSync(
      join(stateDir, 'last.json'),
      JSON.stringify({ runId: '20260101-000000000-deadbeef' }),
    );

    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWriter = { write: (s: string) => stdout.push(s) };
    const stderrWriter = { write: (s: string) => stderr.push(s) };

    // (a) --run-id override → reads the surviving record's runId.
    const code1 = await runRestore(
      ['--yes', '--run-id', survivingRunId],
      stdoutWriter,
      stderrWriter,
      { isTTY: false, stateDir },
    );
    expect(code1).toBe(0);

    // (b) --run-id for a pruned runId → exit 1, clear stderr.
    const code2 = await runRestore(
      ['--yes', '--run-id', '20260101-000000000-deadbeef'],
      stdoutWriter,
      stderrWriter,
      { isTTY: false, stateDir },
    );
    expect(code2).toBe(1);
    expect(stderr.join('')).toMatch(
      /run 20260101-000000000-deadbeef not found/,
    );
    expect(stderr.join('')).toContain('retention window: 10');
  });

  // -------------------------------------------------------------------------
  // Case 10 — missing last.json
  // -------------------------------------------------------------------------

  it('runRestore with no last.json exits 1 with a clear stderr message', async () => {
    const tmp = freshTmp('g3-restore-nohist-');
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    mkdirSync(stateDir, { recursive: true });
    // last.json is intentionally absent.

    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWriter = { write: (s: string) => stdout.push(s) };
    const stderrWriter = { write: (s: string) => stderr.push(s) };

    const code = await runRestore([], stdoutWriter, stderrWriter, {
      isTTY: false,
      stateDir,
    });

    expect(code).toBe(1);
    expect(stderr.join('')).toMatch(/no overture apply history found/);
    expect(stderr.join('')).toContain(stateDir);
    expect(stderr.join('')).toContain('Usage:');
  });

  // -------------------------------------------------------------------------
  // Case 11 — TTY prompt simulation
  // -------------------------------------------------------------------------

  it('runRestore TTY simulation: y permits execution, n aborts with exit 1', async () => {
    const tmp = freshTmp('g3-restore-tty-');
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    const runId = '20260704-183000123-dddd0001';
    const seeded = await seedStateJson({ tmp, stateDir, runId });
    const backupContent = readFileSync(seeded.backup, 'utf8');

    // (a) Interactive `y\n` permits execution.
    {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const stdoutWriter = { write: (s: string) => stdout.push(s) };
      const stderrWriter = { write: (s: string) => stderr.push(s) };
      const prompt = vi.fn(() => Promise.resolve('y'));

      const code = await runRestore([], stdoutWriter, stderrWriter, {
        isTTY: true,
        prompt,
        stateDir,
      });

      expect(code).toBe(0);
      expect(prompt).toHaveBeenCalledOnce();
      expect(readFileSync(seeded.target, 'utf8')).toBe(backupContent);
      expect(existsSync(seeded.backup)).toBe(false);
    }

    // (b) Interactive `n\n` aborts with exit 1; target untouched.
    {
      // Re-seed because (a) consumed the backup.
      const tmp2 = freshTmp('g3-restore-tty-n-');
      cleanupDirs.push(tmp2);
      const stateDir2 = join(tmp2, 'state', 'apply');
      const seeded2 = await seedStateJson({
        tmp: tmp2,
        stateDir: stateDir2,
        runId,
      });
      const targetContentBefore = readFileSync(seeded2.target, 'utf8');

      const stdout: string[] = [];
      const stderr: string[] = [];
      const stdoutWriter = { write: (s: string) => stdout.push(s) };
      const stderrWriter = { write: (s: string) => stderr.push(s) };
      const prompt = vi.fn(() => Promise.resolve('n'));

      const code = await runRestore([], stdoutWriter, stderrWriter, {
        isTTY: true,
        prompt,
        stateDir: stateDir2,
      });

      expect(code).toBe(1);
      expect(stderr.join('')).toContain('aborted by user');
      expect(readFileSync(seeded2.target, 'utf8')).toBe(targetContentBefore);
      expect(existsSync(seeded2.backup)).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // Case 12 — runRestore --yes with a missing-backup pair (user verdict
  // 2026-07-04). The plan has two `ok` pairs and one `missing-backup`
  // pair. The expected behavior is atomic: exit 1; stderr carries the
  // per-pair `error: backup file missing:` line AND the follow-up
  // `error: could not complete restore — backup file(s) may have been
  // consumed by a previous restore, or never existed.` hint; the
  // `ok` pairs are NOT executed (zero `mv` shell-outs); the targets
  // are NOT clobbered.
  // -------------------------------------------------------------------------

  it('runRestore --yes with a missing-backup pair exits 1, surfaces the error, and skips every mv', async () => {
    const tmp = freshTmp('g3-restore-missingbackup-');
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    const runId = '20260704-183000123-eeee0001';

    // Two `ok` pairs (targetA/backupA, targetB/backupB) and one
    // `missing-backup` pair (targetC with backupC absent on disk).
    // The plan order in `buildRestorePlan` mirrors the order the
    // agents appear in the record, so we put the missing-backup
    // agent LAST — this matches the post-fix expectation that the
    // atomic abort fires before subsequent (or, in this order,
    // preceding) pairs are visited. We deliberately also seed an
    // extra `ok` pair FIRST to prove atomicity: even the first
    // `ok` pair must NOT execute when a later pair is missing-
    // backup.
    const targetA = join(tmp, 'target-a.json');
    const backupA = join(tmp, 'target-a.json.bak.20260704');
    const targetB = join(tmp, 'target-b.json');
    const backupB = join(tmp, 'target-b.json.bak.20260704');
    const targetC = join(tmp, 'target-c.json');
    const backupC = join(tmp, 'target-c.json.bak.20260704');

    const origA = '{"old":true}\n';
    const origB = '{"old":true}\n';
    const origC = '{"old":true}\n';
    writeFileSync(targetA, origA);
    writeFileSync(backupA, origA);
    writeFileSync(targetB, origB);
    writeFileSync(backupB, origB);
    writeFileSync(targetC, origC);
    // backupC is intentionally NOT written — drives `missing-backup`.
    const preASha = createHash('sha256').update(origA).digest('hex');
    const preBSha = createHash('sha256').update(origB).digest('hex');
    const preCSha = createHash('sha256').update(origC).digest('hex');

    const record: ApplyStateRecord = {
      schemaVersion: 1,
      runId,
      timestamp: '2026-07-04T18:30:00.123Z',
      mode: 'apply',
      profile: 'default',
      configPath: '/home/test/overture.jsonc',
      backupBeforeWrite: true,
      agents: [
        {
          agentId: 'a-agent',
          displayName: 'A Agent',
          status: 'updated',
          targetPaths: [targetA],
          backupPaths: [backupA],
          preWriteSha256: preASha,
          postWriteSha256: preASha,
        },
        {
          agentId: 'b-agent',
          displayName: 'B Agent',
          status: 'updated',
          targetPaths: [targetB],
          backupPaths: [backupB],
          preWriteSha256: preBSha,
          postWriteSha256: preBSha,
        },
        {
          agentId: 'c-agent',
          displayName: 'C Agent',
          status: 'updated',
          targetPaths: [targetC],
          backupPaths: [backupC],
          preWriteSha256: preCSha,
          postWriteSha256: null,
        },
      ],
    };
    const { writeApplyState } = await import('./apply-state.js');
    mkdirSync(stateDir, { recursive: true });
    await writeApplyState(record, stateDir, 10);

    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWriter = { write: (s: string) => stdout.push(s) };
    const stderrWriter = { write: (s: string) => stderr.push(s) };

    // Snapshot the `spawn` call count BEFORE the restore. The hoisted
    // mock from the top of this file (`vi.mock('node:child_process', …)`)
    // pushes every spawn invocation into `spawnCalls`. A successful
    // `mv -v` per pair fires one spawn; the missing-backup pair must
    // abort the batch BEFORE any `mv` fires.
    const spawnCountBefore = spawnCalls.length;

    const code = await runRestore(['--yes'], stdoutWriter, stderrWriter, {
      isTTY: false,
      stateDir,
    });

    // Atomic exit code per user verdict 2026-07-04 (gate G3-8).
    expect(code).toBe(1);

    // Per-pair stderr error: every missing-backup pair emits
    // `error: backup file missing: <shellQuoted(backup)>`.
    const stderrText = stderr.join('');
    expect(stderrText).toContain(`error: backup file missing: '${backupC}'`);

    // Follow-up stderr hint points the user at `<stateDir>/apply/`.
    expect(stderrText).toContain(
      'error: could not complete restore — backup file(s) may have been',
    );
    expect(stderrText).toContain(stateDir);

    // The OkPairs must NOT have been touched (no mv fired).
    expect(readFileSync(targetA, 'utf8')).toBe(origA);
    expect(readFileSync(targetB, 'utf8')).toBe(origB);
    expect(existsSync(backupA)).toBe(true);
    expect(existsSync(backupB)).toBe(true);

    // Rendered outcome reports the missing-backup pair as `failed`
    // with reason `backup file missing`, the two blocked `ok` pairs
    // as `failed` with reason `restore aborted — another pair is
    // missing its backup`, and the summary line increments `failed`
    // to the full plan size (atomic whole-run semantics: every
    // pair is accounted for as failed, none get `restored`).
    expect(stdout.join('')).toContain('Overture restore outcome');
    expect(stdout.join('')).toContain('backup file missing');
    expect(stdout.join('')).toContain(
      'restore aborted — another pair is missing its backup',
    );
    // Summary: 0 restored, 0 skipped, 3 failed (plan size = 3).
    expect(stdout.join('')).toContain('restored: 0, skipped: 0, failed: 3');

    // Atomic invariant: ZERO new `mv` spawn calls fired during the
    // restore. The hoisted mock captured every spawn call; this
    // assert proves no shell-out happened for any pair — including
    // the two `ok` pairs ahead of the missing-backup pair in the
    // plan order. (The post-fix loop processes pairs in registry
    // order, so the first missing-backup encountered aborts the
    // batch BEFORE any subsequent or earlier pair's `mv` fires.
    // Plan-order is `a-agent`, `b-agent`, `c-agent`; `c-agent` is
    // the missing-backup pair; the earlier `a-agent` and `b-agent`
    // pairs must NOT execute.)
    const newSpawnCalls = spawnCalls.slice(spawnCountBefore);
    expect(newSpawnCalls).toEqual([]);
  });
});
