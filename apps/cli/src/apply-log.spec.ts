/**
 * G2 — `apply-log` codec suite (pure helpers + filesystem writer).
 *
 * Locks the contract for `apps/cli/src/apply-log.ts`: the per-run log
 * codec, the `shellQuotePath` helper, the `buildApplyLog` projection, the
 * `renderApplyLog` plain-text renderer, the atomic `writeApplyLog`
 * filesystem helper, the `readApplyLog` line-prefix parser, and the
 * paired `.json` + `.log` retention GC. The orchestrator-level apply-log
 * write (`runApply` real-write branch) lives in `apply-command.spec.ts`
 * (cases 29-33 per the plan). Each case is independent of the others:
 *   - Pure-function cases (1, 2, 3) need no filesystem.
 *   - Filesystem cases (4, 5, 6) use `mkdtempSync` for isolation, with
 *     `afterEach` rm-rf cleanup mirroring the `apply-state.spec.ts` and
 *     `apply-command.spec.ts` patterns.
 *
 * Coverage map (each `it(...)` is one bullet per the plan's Must-have):
 *   1. `shellQuotePath` returns single-quoted strings; paths with spaces,
 *      `$`, `;`, `&`, `(`, `)`, or embedded `'` are quoted correctly
 *      (embedded `'` is escaped as `'\''`).
 *   2. `buildApplyLog` projects an `ApplyStateRecord` into
 *      `ApplyLogContent`. Two-agent fixture: one `updated` agent with two
 *      `(backup, target)` pairs, one `refusal` agent. Assert `restorePairs`,
 *      the per-agent reason field, and that `lastJsonPointer` matches the
 *      supplied stateDir.
 *   3. `renderApplyLog` produces a stable plain-text rendering with all 5
 *      sections in order: header containing `runId` + ISO `timestamp`;
 *      warning containing `DO NOT source this file`; per-agent blocks
 *      containing `backup:` / `target:` / `mv -v` lines; footer
 *      containing `roll-back-all:` and the last-pointer references.
 *   4. `writeApplyLog` writes atomically under a tmpdir; on-disk bytes
 *      equal `renderApplyLog(content) + '\n'`; no `.tmp-*` debris persists.
 *   5. `pruneApplyArtifacts(stateDir, 10)` keeps the 10 newest runIds
 *      paired lexically. Pre-seed 12 pairs; expect 2 oldest pairs unlinked.
 *      Sub-cases: (a) paired files; (b) `.log`-only; (c) `.json`-only.
 *   6. End-to-end — build an `ApplyStateRecord`, build the
 *      `ApplyLogContent` from it, render it, write it, read it back via
 *      `readApplyLog`, and confirm the per-agent `backup:` / `target:`
 *      tag lines are greppable from the rendered string (G3-prep contract).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

import {
  buildApplyLog,
  pruneApplyArtifacts,
  readApplyLog,
  renderApplyLog,
  shellQuotePath,
  writeApplyLog,
  type ApplyLogContent,
} from './apply-log.js';
import type { ApplyStateRecord } from './apply-state.js';

describe('apply-log (G2 contract)', () => {
  // Per-test cleanup scratchpad. Mirrors `apply-state.spec.ts` style.
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
  // Case 1 — shellQuotePath
  // -------------------------------------------------------------------------

  it('shellQuotePath single-quotes paths and escapes shell-meta characters (incl. embedded single quote)', () => {
    // Plain path — single-quoted, no escapes needed.
    expect(shellQuotePath('/home/test/.claude.json')).toBe(
      "'/home/test/.claude.json'",
    );

    // Each shell-meta char gets wrapped in single quotes (not escaped
    // individually) — the canonical portable shell-quoting approach.
    expect(shellQuotePath('/path with spaces/file.json')).toBe(
      "'/path with spaces/file.json'",
    );
    expect(shellQuotePath('/path/with$dollar/file.json')).toBe(
      "'/path/with$dollar/file.json'",
    );
    expect(shellQuotePath('/path/with;semi/file.json')).toBe(
      "'/path/with;semi/file.json'",
    );
    expect(shellQuotePath('/path/with&amp/file.json')).toBe(
      "'/path/with&amp/file.json'",
    );
    expect(shellQuotePath('/path/with(paren/file.json')).toBe(
      "'/path/with(paren/file.json'",
    );
    expect(shellQuotePath('/path/with)paren/file.json')).toBe(
      "'/path/with)paren/file.json'",
    );

    // Embedded single quote: close-quote, escape, re-open. The canonical
    // POSIX shell escape is `'\''` — literal close, escaped single, open.
    expect(shellQuotePath("/home/it's/file.json")).toBe(
      "'/home/it'\\''s/file.json'",
    );
  });

  // -------------------------------------------------------------------------
  // Case 2 — buildApplyLog projection
  // -------------------------------------------------------------------------

  it('buildApplyLog projects ApplyStateRecord into ApplyLogContent with paired restorePairs and reason', () => {
    const applyRecord: ApplyStateRecord = {
      schemaVersion: 1,
      runId: '20260704-183000123-abcdef01',
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
          targetPaths: ['/home/test/.claude.json', '/home/test/.mcp.json'],
          backupPaths: [
            '/home/test/.claude.json.bak.20260704-183000123',
            '/home/test/.mcp.json.bak.20260704-183000123',
          ],
          preWriteSha256: null,
          postWriteSha256: null,
        },
        {
          agentId: 'opencode',
          displayName: 'OpenCode',
          status: 'refusal',
          targetPaths: [],
          backupPaths: [],
          preWriteSha256: null,
          postWriteSha256: null,
          reason: 'unsupported-shape',
        },
      ],
    };

    const stateDir = '/home/test/.local/state/overture/apply';
    const content = buildApplyLog(applyRecord, 'overture@1.2.3', stateDir);

    // Top-level metadata propagates verbatim.
    expect(content.runId).toBe('20260704-183000123-abcdef01');
    expect(content.timestamp).toBe('2026-07-04T18:30:00.123Z');
    expect(content.profile).toBe('default');
    expect(content.configPath).toBe('/home/test/overture.jsonc');
    expect(content.backupBeforeWrite).toBe(true);
    expect(content.generatedBy).toBe('overture@1.2.3');

    // lastJsonPointer reflects the supplied stateDir + runId.
    expect(content.lastJsonPointer).toBe(
      `${stateDir}/20260704-183000123-abcdef01.json`,
    );

    // Entries: registry order preserved.
    expect(content.entries).toHaveLength(2);

    const updatedEntry = content.entries[0];
    expect(updatedEntry).toBeDefined();
    if (!updatedEntry) throw new Error('expected one updated ApplyLogEntry');
    expect(updatedEntry.agentId).toBe('claude-code');
    expect(updatedEntry.displayName).toBe('Claude Code');
    expect(updatedEntry.status).toBe('updated');
    expect(updatedEntry.restorePairs).toEqual([
      {
        backup: '/home/test/.claude.json.bak.20260704-183000123',
        target: '/home/test/.claude.json',
      },
      {
        backup: '/home/test/.mcp.json.bak.20260704-183000123',
        target: '/home/test/.mcp.json',
      },
    ]);

    const refusalEntry = content.entries[1];
    expect(refusalEntry).toBeDefined();
    if (!refusalEntry) throw new Error('expected one refusal ApplyLogEntry');
    expect(refusalEntry.agentId).toBe('opencode');
    expect(refusalEntry.status).toBe('refusal');
    expect(refusalEntry.restorePairs).toEqual([]);
    expect(refusalEntry.reason).toBe('unsupported-shape');
  });

  // -------------------------------------------------------------------------
  // Case 3 — renderApplyLog
  // -------------------------------------------------------------------------

  it('renderApplyLog emits the 5 sections in order with stable section markers', () => {
    const content: ApplyLogContent = {
      runId: '20260704-183000123-abcdef01',
      timestamp: '2026-07-04T18:30:00.123Z',
      profile: 'default',
      configPath: '/home/test/overture.jsonc',
      backupBeforeWrite: true,
      generatedBy: 'overture@1.2.3',
      lastJsonPointer:
        '/home/test/.local/state/overture/apply/20260704-183000123-abcdef01.json',
      entries: [
        {
          agentId: 'claude-code',
          displayName: 'Claude Code',
          status: 'updated',
          restorePairs: [
            {
              backup: '/home/test/.claude.json.bak.20260704-183000123',
              target: '/home/test/.claude.json',
            },
          ],
        },
        {
          agentId: 'opencode',
          displayName: 'OpenCode',
          status: 'refusal',
          restorePairs: [],
          reason: 'unsupported-shape',
        },
      ],
    };

    const rendered = renderApplyLog(content);

    // Header: runId + ISO timestamp.
    expect(rendered).toContain('20260704-183000123-abcdef01');
    expect(rendered).toContain('2026-07-04T18:30:00.123Z');

    // Warning: the G3-prep "DO NOT source this file" banner.
    expect(rendered).toContain('DO NOT source this file');

    // Per-agent restore block: backup:/target:/mv -v lines for the updated agent.
    expect(rendered).toContain('backup:');
    expect(rendered).toContain('target:');
    expect(rendered).toContain('mv -v');

    // Footer: roll-back-all + last-pointer reference.
    expect(rendered).toContain('roll-back-all:');
    expect(rendered).toContain('last.json');
    expect(rendered).toContain(content.lastJsonPointer);

    // Section ordering: header must precede the warning, which must precede
    // the per-agent blocks, which must precede the footer.
    const headerIdx = rendered.indexOf('Overture apply log');
    const warningIdx = rendered.indexOf('DO NOT source this file');
    const restoreIdx = rendered.indexOf('backup:');
    const footerIdx = rendered.indexOf('roll-back-all:');
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(warningIdx).toBeGreaterThan(headerIdx);
    expect(restoreIdx).toBeGreaterThan(warningIdx);
    expect(footerIdx).toBeGreaterThan(restoreIdx);
  });

  // -------------------------------------------------------------------------
  // Case 4 — writeApplyLog atomic write
  // -------------------------------------------------------------------------

  it('writeApplyLog writes atomically and on-disk bytes equal renderApplyLog(content) + newline, no tmp debris', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'g2-log-writes-'));
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    mkdirSync(stateDir, { recursive: true });

    const content: ApplyLogContent = {
      runId: '20260704-183000123-deadbeef',
      timestamp: '2026-07-04T18:30:00.123Z',
      profile: 'default',
      configPath: '/home/test/overture.jsonc',
      backupBeforeWrite: true,
      generatedBy: 'overture@1.2.3',
      lastJsonPointer: `${stateDir}/20260704-183000123-deadbeef.json`,
      entries: [
        {
          agentId: 'claude-code',
          displayName: 'Claude Code',
          status: 'updated',
          restorePairs: [
            {
              backup: '/home/test/.claude.json.bak.20260704-183000123',
              target: '/home/test/.claude.json',
            },
          ],
        },
      ],
    };

    const result = await writeApplyLog(content, stateDir, 10);

    // Exact path for the log file.
    expect(result.logPath).toBe(
      join(stateDir, '20260704-183000123-deadbeef.log'),
    );
    // Nothing to prune on a fresh dir.
    expect(result.pruned).toEqual([]);

    // On-disk bytes equal the rendered string + trailing newline.
    const onDisk = readFileSync(result.logPath, 'utf8');
    expect(onDisk).toBe(`${renderApplyLog(content)}\n`);

    // No stray .tmp-* files left behind after the atomic rename.
    const filesAfter = readdirSync(stateDir).sort();
    expect(filesAfter).toContain('20260704-183000123-deadbeef.log');
    expect(filesAfter.filter((f) => f.includes('.tmp'))).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Case 5 — pruneApplyArtifacts paired retention (a/b/c sub-cases)
  // -------------------------------------------------------------------------

  it('pruneApplyArtifacts keeps the 10 newest runIds in lockstep (.json+.log, .log-only, .json-only)', async () => {
    // ---------------------------------------------------------------------
    // Sub-case (a) — paired files (.json + .log for each runId).
    // Pre-seed 12 pairs across two timestamps; pruning to 10 must drop
    // exactly the two lexically oldest pairs (BOTH .json AND .log).
    // ---------------------------------------------------------------------
    {
      const tmp = mkdtempSync(join(tmpdir(), 'g2-log-prune-'));
      cleanupDirs.push(tmp);
      const stateDir = join(tmp, 'state', 'apply');
      mkdirSync(stateDir, { recursive: true });

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
        writeFileSync(
          join(stateDir, `${id}.log`),
          `Overture apply log\nrunId: ${id}\n`,
        );
      }
      // Pointer file — must NOT be pruned.
      writeFileSync(
        join(stateDir, 'last.json'),
        `{"runId":"${runIds[runIds.length - 1]}"}`,
      );
      expect(readdirSync(stateDir)).toHaveLength(25); // 12 json + 12 log + 1 last.json

      const pruned = await pruneApplyArtifacts(stateDir, 10);

      const remaining = readdirSync(stateDir).sort();
      // 10 json + 10 log + 1 last.json = 21.
      expect(remaining).toHaveLength(21);

      // Two lexically oldest pairs unlinked: BOTH .json AND .log.
      expect(remaining).not.toContain(`${ts1}-00000001.json`);
      expect(remaining).not.toContain(`${ts1}-00000001.log`);
      expect(remaining).not.toContain(`${ts1}-00000002.json`);
      expect(remaining).not.toContain(`${ts1}-00000002.log`);

      // last.json is preserved.
      expect(remaining).toContain('last.json');

      // The returned pruned list reports BOTH basenames per pair.
      const prunedSorted = pruned.slice().sort();
      expect(prunedSorted).toEqual(
        [
          `${ts1}-00000001.json`,
          `${ts1}-00000001.log`,
          `${ts1}-00000002.json`,
          `${ts1}-00000002.log`,
        ].sort(),
      );
    }

    // ---------------------------------------------------------------------
    // Sub-case (b) — `.log`-only files (no matching `.json`).
    // Orphan .log files (e.g. a half-completed G2 run) must still be pruned
    // using the same prefix logic.
    // ---------------------------------------------------------------------
    {
      const tmp = mkdtempSync(join(tmpdir(), 'g2-log-prune-logonly-'));
      cleanupDirs.push(tmp);
      const stateDir = join(tmp, 'state', 'apply');
      mkdirSync(stateDir, { recursive: true });

      const runIds = [
        '20260101-000000000-00000001',
        '20260101-000000000-00000002',
        '20260101-000000000-00000003',
      ];
      for (const id of runIds) {
        writeFileSync(
          join(stateDir, `${id}.log`),
          `Overture apply log\nrunId: ${id}\n`,
        );
      }
      expect(readdirSync(stateDir)).toHaveLength(3);

      // keep=1 → unlink the two oldest .log-only entries.
      const pruned = await pruneApplyArtifacts(stateDir, 1);

      const remaining = readdirSync(stateDir).sort();
      expect(remaining).toEqual([`${runIds[runIds.length - 1]}.log`]);
      expect(pruned.slice().sort()).toEqual(
        [`${runIds[0]}.log`, `${runIds[1]}.log`].sort(),
      );
    }

    // ---------------------------------------------------------------------
    // Sub-case (c) — `.json`-only files (legacy G1-only dirs).
    // Backward-compat: existing G1 directories with no logs still prune.
    // ---------------------------------------------------------------------
    {
      const tmp = mkdtempSync(join(tmpdir(), 'g2-log-prune-jsononly-'));
      cleanupDirs.push(tmp);
      const stateDir = join(tmp, 'state', 'apply');
      mkdirSync(stateDir, { recursive: true });

      const runIds = [
        '20260101-000000000-00000001',
        '20260101-000000000-00000002',
        '20260101-000000000-00000003',
      ];
      for (const id of runIds) {
        writeFileSync(join(stateDir, `${id}.json`), `{"runId":"${id}"}`);
      }
      expect(readdirSync(stateDir)).toHaveLength(3);

      // keep=1 → unlink the two oldest .json-only entries (legacy G1 dir).
      const pruned = await pruneApplyArtifacts(stateDir, 1);

      const remaining = readdirSync(stateDir).sort();
      expect(remaining).toEqual([`${runIds[runIds.length - 1]}.json`]);
      expect(pruned.slice().sort()).toEqual(
        [`${runIds[0]}.json`, `${runIds[1]}.json`].sort(),
      );
    }
  });

  // -------------------------------------------------------------------------
  // Case 6 — end-to-end (build → render → write → read → grep tag lines)
  // -------------------------------------------------------------------------

  it('end-to-end: buildApplyLog → renderApplyLog → writeApplyLog → readApplyLog round-trip; backup:/target: tag lines are greppable', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'g2-log-e2e-'));
    cleanupDirs.push(tmp);
    const stateDir = join(tmp, 'state', 'apply');
    mkdirSync(stateDir, { recursive: true });

    const applyRecord: ApplyStateRecord = {
      schemaVersion: 1,
      runId: '20260704-183000123-cafebabe',
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
          backupPaths: ['/home/test/.claude.json.bak.20260704-183000123'],
          preWriteSha256: null,
          postWriteSha256: null,
        },
      ],
    };

    const content = buildApplyLog(applyRecord, 'overture@1.2.3', stateDir);
    const rendered = renderApplyLog(content);

    // G3-prep contract: backup:/target: tag lines are greppable from the
    // rendered string. Future G3 parser does
    // `grep -E "^(backup|target): '"` to extract pairs.
    expect(rendered).toMatch(/^backup: '/m);
    expect(rendered).toMatch(/^target: '/m);

    // Round-trip: write → read.
    const writeResult = await writeApplyLog(content, stateDir, 10);
    const readBack = await readApplyLog(writeResult.logPath);

    // readApplyLog returns null on absent file; here it must return content.
    expect(readBack).not.toBeNull();
    if (!readBack) throw new Error('expected readApplyLog to return content');

    // Round-trip fidelity for the load-bearing fields.
    expect(readBack.runId).toBe(content.runId);
    expect(readBack.entries).toHaveLength(1);
    expect(readBack.entries[0]?.agentId).toBe('claude-code');
    expect(readBack.entries[0]?.restorePairs).toEqual(
      content.entries[0]?.restorePairs,
    );
  });
});
