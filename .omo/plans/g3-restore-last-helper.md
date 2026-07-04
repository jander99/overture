# g3-restore-last-helper - Work Plan (DRAFT — awaiting gate approvals)

## TL;DR (For humans)

**What you'll get:** A new top-level `overture restore-last [--dry-run]
[--yes] [--run-id <id>]` command that consumes the G1 `<stateDir>/apply/
<runId>.json` + `<stateDir>/apply/last.json` artifacts (with the G2
`<runId>.log` `backup:` / `target:` tag lines as a fallback when the JSON
is absent) and runs the per-agent `mv -v` recovery that's already in the
log's `roll-back-all:` block. Default behavior: read `last.json` for the
most recent apply, show every `backup → target` pair, prompt for
confirmation on a TTY, then move the backup files back to their original
targets. A `--dry-run` flag previews every `mv` command without executing.
A `--run-id <id>` flag lets the user pick any surviving runId from the
retention window (default 10). A `--yes` flag suppresses the prompt and
proceeds when the pre-flight integrity check (sha256 against
`ApplyStateAgent.preWriteSha256`) passes.

**Why this approach:** The slice doc calls G3 "convenience on top of the
`mv`-based recovery path, not a replacement" — the `cat
<runId>.log | tail -n +| head -n | sh` recovery already exists. G3 just
gives it a discoverable CLI surface, an interactive confirmation gate, a
optional modification check via `preWriteSha256` (so a user who edited a
config between apply and restore isn't silently clobbered), and an audit
trail (the restore writes its own state record so future G3s can see
"this user restored run X at time Y").

The G2 `.log` parseable tag lines and the `readApplyLog` parser already
exist; G3 promotes them from "consumer-ready anchor" to "primary source"
for a fallback path. The primary source remains the G1 `ApplyStateRecord`
JSON (canonical, contains `preWriteSha256`, audit-friendly). When the JSON
is missing (e.g. legacy apply predates G1) but the `.log` exists, G3
falls back to log tag lines (no sha256 available → modification check
skipped with a warning).

The G2 plan laid the parseability groundwork: `backup: '<path>'` /
`target: '<path>'` tag lines next to prose `mv -v` commands. G3's parser
is `readApplyLog` plus a thin tag-line extractor (or reuse the existing
`readApplyLog` end-to-end and project the `restorePairs` array). The
paired `ApplyStateRecord` shape gives sha256 for the integrity check, so
the JSON-source path is preferred when both exist.

**What it will NOT do:** Modifying any writer file (`packages/agents/src/
*-write.ts`). Widening `WriteReason`, `ApplyStatus`, `ApplyResult`,
`ApplyAgentResult`, `AgentMcpWriteResult`. Adding new package dependencies
or Nx projects. Modifying any G1 spec assertion
(`apps/cli/src/apply-state.spec.ts` cases 1-6 stay byte-identical) or any
G2 spec assertion (`apps/cli/src/apply-log.spec.ts` cases 1-6 stay
byte-identical). Adding `--json` output to `restore-last`. Batched /
multi-run restoration (one runId at a time only). Auto-purge of the
applied-backup files after restoration (backups persist; user decides).
A "restart apply" or "rollback to version N" semantic — restore only
goes one direction (current → backup).

**Effort:** Small-to-medium (one new module + dispatcher arm + tests +
docs).

**Risk:** Low — additive; the existing G1 `last.json` + G2 `.log` tag
lines are the entire input surface. No writer modification, no envelope
widening, no new dependency. G3 widens `ApplyStateRecord.mode` from
`'apply'` to `'apply' | 'restore'` ONLY if the user approves gate G3-7
(write a restore-state record); without that gate G3 stays
read-only-on-disk.

---

> TL;DR (machine): Add `apps/cli/src/restore-command.ts` exporting
> `RestorePlan`, `RestorePair`, `buildRestorePlan`, `readRestoreSource`,
> `formatHumanRestorePlan`, `formatHumanRestoreOutcome`, `runRestore`.
> The CLI dispatcher in `apps/cli/src/cli.ts` gains a `restore-last` arm
> routed to `runRestore`. Tests in `apps/cli/src/restore-command.spec.ts`
> + a small `restore-command.ts` integration with the existing G1/G2
> artifacts. (Possibly) widen `ApplyStateRecord.mode` to
> `'apply' | 'restore'` so restore-history audits land on disk alongside
> the apply records — TBD per gate G3-7.

## Scope

### Must have

- **New file `apps/cli/src/restore-command.ts`** exporting:
  - `RestorePair` interface — the per-pair operating unit
    `{ agentId: string; displayName: string; backup: string; target: string; integrityStatus: 'ok' | 'mismatch' | 'unverified' | 'missing-backup' }`.
    `ok` = current sha256 of target matches `preWriteSha256` (i.e. user
    hasn't touched the file since apply). `mismatch` = file changed; the
    restore will WARN but proceed when `--force` is set. `unverified` =
    source was the G2 `.log` (no sha256 available — modification check
    skipped). `missing-backup` = backup file no longer on disk; pair
    skipped with a stdout note.
  - `RestorePlan` interface — the operational outcome
    `{ source: 'state-json' | 'log-tag-lines' | 'last-json-pointer'; runId: string; pairs: readonly RestorePair[]; notes: readonly string[]; stateDir: string; configPath: string }`.
    `source` records which path fed the plan (canonical preference:
    G1 JSON; fallback: G2 `.log` tag lines; if only `last.json` exists
    but the runId JSON is missing, the plan reports `last-json-pointer`
    with a `notes` line "state file missing, search retention" and
    returns an empty `pairs` array — caller exits with a clear error).
  - `buildRestorePlan(stateDir, runId, now): Promise<RestorePlan>` —
    reads `<stateDir>/apply/last.json` to resolve the runId when `runId`
    is omitted, then reads either the per-run `<runId>.json` (preferred)
    or the `<runId>.log` (fallback) to build the plan. Each pair
    evaluates the integrity check against the current sha256 of the
    target via `sha256OfFile`. Missing backups set
    `integrityStatus = 'missing-backup'` and surface in the notes.
  - `readRestoreSource(stateDir, runId): Promise<{ source: …; pairs: …}>`
    — pure source-reading layer over G1 `readApplyState` and G2
    `readApplyLog`. Returns the raw data without integrity evaluation so
    unit tests can pin arbitrary fixture content.
  - `formatHumanRestorePlan(plan: RestorePlan): string` — the pre-execute
    human-readable rendering: header (runId, timestamp, source,
    stateDir) → per-pair block (`agentId + status: ok/mismatch/… +
    mv -v '…' '…'`) → footer (count summary + notes). Lock the format
    in this slice.
  - `formatHumanRestoreOutcome(plan, results): string` — the post-execute
    rendering: same header → per-pair result line
    (`ok` / `skipped` / `failed: <reason>`) → summary
    (`restored: N, skipped: M, failed: K`).
  - `runRestore(args, stdout, stderr, options?)` — the dispatcher-level
    entry point. Mirrors `runApply`'s shape: flag parse → `buildRestorePlan`
    → render plan → prompt or `--yes`/`--dry-run` → execute `mv` per pair
    → return exit code (`0` when all `ok` pairs succeed and any
    `mismatch`/`unverified`/`missing-backup` pairs honor their gate;
    `1` when any restore failure or modification rejection without
    `--force`).
- **New dispatcher arm in `apps/cli/src/cli.ts`**: `restore-last` routes
  to `runRestore`. Update the `USAGE` string to advertise the new
  command. Accept one positional subcommand only — `restore-last`;
  everything else falls through to "Unknown command".
- **New flag surface on `overture restore-last`**:
  - `--dry-run` — show the plan and exit 0 without executing.
  - `--yes` — skip the interactive confirmation prompt; proceed when
    the integrity check passes, error out on `mismatch` unless
    `--force` is also present.
  - `--force` — proceed even when `mismatch` (current target file has
    been edited since apply). Logs a `WARN: target <path> was edited
    since apply; restore forced.` line to stderr.
  - `--run-id <runId>` — pick a specific runId from the retention window;
    defaults to the runId resolved by `last.json`.
  - Argument parsing mirrors `runApply` (whitelist + syntax-error
    return code `2`).
- **Tests** in `apps/cli/src/restore-command.spec.ts`:
  - **Case 1** — `readRestoreSource` reads the JSON path correctly:
    seed `<stateDir>/apply/last.json` + `<stateDir>/apply/<runId>.json`;
    expect `source: 'state-json'` and the pair list matching the seeded
    `agents[*].backupPaths/targetPaths`.
  - **Case 2** — `readRestoreSource` falls back to log-tag-lines:
    seed only `<runId>.log` (no JSON); expect
    `source: 'log-tag-lines'` and pairs projected via `readApplyLog`'s
    `restorePairs`.
  - **Case 3** — `buildRestorePlan` integrity check: seed a run with
    targets A, B, C and current sha256 of A matches `preWriteSha256`,
    B differs, C absent — expect three pairs with statuses
    `ok / mismatch / missing-backup` respectively (no `--force` →
    `mismatch` would block execution; the unit case just confirms the
    evaluation).
  - **Case 4** — `formatHumanRestorePlan` produces a stable rendering
    with the 3 sections (header, per-pair, footer). Mirror the G2
    renderer's "lock the format" contract.
  - **Case 5** — `runRestore --dry-run` exits 0, writes the plan to
    stdout, performs no filesystem writes (no actual `mv`, no per-pair
    backup paths mutated, no target files created). Pair with vitest
    `vi.spyOn(child_process, 'spawn')` to assert no `mv` invocations
    fire.
  - **Case 6** — `runRestore --yes` with all `ok` pairs: real `mv`s
    execute (via `child_process.spawn` of `mv -v`), target files
    restored, exit code 0.
  - **Case 7** — `runRestore --yes` with a `mismatch` pair: exits 1,
    target NOT clobbered, stderr carries the rejection line.
  - **Case 8** — `runRestore --yes --force` with a `mismatch` pair:
    proceeds with restore, stderr carries the WARN line, exit code 0
    iff every pair succeeded.
  - **Case 9** — `runRestore --run-id <other-runId>`: default of
    `last.json`'s runId is overridden; the chosen runId's pairs run.
    runId not in retention (e.g. `last.json` points to a runId that
    was pruned) → `last-json-pointer` source with notes "state file
    missing" and exit code 1 with a clear stderr message.
  - **Case 10** — missing `last.json`: exit code 1 with stderr "no
    overture apply history found in <stateDir>" + USAGE hint. Mirrors
    G2's "no log file was written" guardrail for the empty case.
  - **Case 11** — TTY simulation: when stdin is TTY and `--yes` is NOT
    set, the plan is rendered to stdout and a confirmation prompt
    fires; the user's "y\n" reply permits execution; "n\n" aborts.
    Use `vi.spyOn` on the prompt helper to drive both branches without
    touching real stdin.
- **Cli dispatcher integration** (covered in `apps/cli/src/cli.spec.ts`):
  - **Case 12** — `overture restore-last --help` prints the new USAGE
    block and exits 0.
  - **Case 13** — `overture restore-last --dry-run` (with a seeded
    `<stateDir>/apply/last.json` + `<stateDir>/apply/<runId>.json` in
    a temp `XDG_STATE_HOME` env override) reads the JSON, prints the
    plan, exits 0.
  - **Case 14** — `overture restore-last --unknown-flag` exits 2 with
    the USAGE block to stderr.
  - **Case 15** — `overture` with no args still exits 0 and emits the
    USAGE block (regression — dispatcher change must not break empty-
    args behavior).
- **Optional `ApplyStateRecord.mode` widening to `'apply' | 'restore'`**
  (gated by gate G3-7):
  - `apps/cli/src/apply-state.ts` — extend the literal union on line 61
    `readonly mode: 'apply'` to `'apply' | 'restore'`.
  - `BuildApplyStateRecordArgs.mode` (line 102) — same extension.
  - `readApplyState`'s `isApplyStateRecord` narrowing — accept both
    literals (no schemaVersion bump; the schema stays at `1`).
  - `writeApplyState` continues to call `pruneApplyArtifacts`; nothing
    changes there.
  - Pair retention invariant unchanged.
  - `apply-state.spec.ts` cases 1-6 stay byte-identical (no test seeds
    a `mode: 'restore'` record).
  - New test case 7: `apply-state.spec.ts` reads a seeded
    `mode: 'restore'` file and asserts `readApplyState` accepts it.
- **`docs/overture-implementation-slices.md`** G3 status block update
  (currently `docs/overture-implementation-slices.md:609-615`) — fill
  out the "Delivered" section with the implemented subsections after
  the slice ships. Mirrors the G1 / G2 delivered-block style.
- **`verify-package.mjs` smoke** (`apps/cli/scripts/verify-package.mjs`):
  add a G3 smoke AFTER the G2 smoke block — seed a G1+G2 state (a
  restore-ready `last.json` + `apply/<runId>.json` + `apply/<runId>.log`),
  then invoke `overture restore-last --dry-run`, asserting the
  rendered plan appears on stdout with the seeded pair's
  `mv -v '…' '…'` line, and asserting NO actual `mv` invocations
  fired (e.g. by snapshotting the target paths before and after the
  smoke command).

### Must NOT have (guardrails, anti-slop, scope boundaries)

- Must NOT modify any writer file (`packages/agents/src/*-write.ts`).
- Must NOT widen `WriteReason`, `ApplyStatus`, `ApplyResult`,
  `ApplyAgentResult`, `OvertureConfigSchema`, `OvertureMcpServer`,
  `AgentMcpWriteInput`, `AgentMcpWriteResult`,
  `ApplyStateAgent`, `BuildApplyStateRecordArgs` beyond the
  `mode` union extension IF gate G3-7 is approved.
- Must NOT modify `apps/cli/src/apply-state.ts` lines 211-248 (the
  `writeApplyState` atomic write and prune-orchestration logic) —
  G3 is read-only-on-disk by default. The `mode` widening (gate G3-7)
  is the only permitted apply-state touch.
- Must NOT modify `apps/cli/src/apply-log.ts` —
  `readApplyLog` / `buildApplyLog` / `renderApplyLog` / `writeApplyLog`
  / `pruneApplyArtifacts` are their final G2 shape.
- Must NOT add `--json` to `restore-last`. The restore plan IS the
  JSON envelope (the underlying `<runId>.json`); a second `--json` flag
  is redundant.
- Must NOT batch multiple runIds. One runId per invocation. A future
  slice may grow this; G3 is narrow.
- Must NOT auto-purge backup files after restore. The backups persist
  until the next `overture apply` prunes them via
  `pruneApplyArtifacts`.
- Must NOT touch `ApplyDryRunStatus`, `ApplyDryRunResult`,
  `ApplyDryRunAgentResult`. Restore has no dry-run-from-apply concept;
  `--dry-run` is a G3-internal preview of the restore plan itself.
- Must NOT add a `restore` umbrella command. Only `restore-last`. A
  `restore <runId>` is implied by `restore-last --run-id <runId>`.
- Must NOT reorder `AGENT_REGISTRY_ORDER` or change registry
  positional expectations.
- Must NOT add `settings.dryRunByDefault` honoring or any other
  cross-slice config handling.
- Must NOT introduce a new Nx project, package, or runtime dependency.
  `restore-command.ts` is a CLI-local module.
- Must NOT stage untracked `ARCHITECTURE.md`, `STRUCTURE.md`,
  `.codegraph/`, `.cortexkit/`, `.serena/`, or local evidence files.
- Must NOT fix pre-existing TypeScript or test errors outside G3-touched
  files (project memory 78).
- Must NOT modify G1 spec assertions
  (`apps/cli/src/apply-state.spec.ts` cases 1-6) unless gate G3-7
  adds Case 7, which is explicitly in scope per that gate.
- Must NOT modify G2 spec assertions
  (`apps/cli/src/apply-log.spec.ts` cases 1-6).
- Must NOT modify `apply-command.spec.ts` cases 1-33 except via
  addition (no replacement).

### Gate G3-1 — Command surface (REQUIRES USER APPROVAL)

**Proposed**: top-level `overture restore-last` with optional flags
`--dry-run`, `--yes`, `--force`, `--run-id <id>`. Matches the slice
doc's literal name and the existing flat top-level dispatcher in
`apps/cli/src/cli.ts`. `restore-last` is the only positional; no
`restore <subcommand>` group.

Alternative to flag if preferred:
- **Nested under `apply`**: `overture apply restore-last`. Rejected —
  `apply` already has its own complete flag surface
  (`--dry-run`/`--json`); nesting adds semantic conflict (a future
  `apply --dry-run` is a dry-run of apply, not of restore).
- **`overture restore`** with the helper under it as
  `restore restore-last`. Rejected — umbrella naming implies a fuller
  restore surface that G3 is intentionally NOT delivering. Keeps the
  CLI vocabulary honest.
- **`overture undo`**. Rejected — over-promises. A future bidirectional
  apply tool (`apply -R` for reverse-apply) might claim `undo`, but
  restore from backup is a different semantic (one-shot, not
  declarative).

### Gate G3-2 — Source preference: JSON vs log (REQUIRES USER APPROVAL)

**Proposed**: `readRestoreSource` tries
`<stateDir>/apply/<runId>.json` first (canonical, contains
`preWriteSha256` for integrity check). When the JSON is absent but
`<runId>.log` exists, falls back to the log's `backup:` / `target:`
tag lines via the existing `readApplyLog` parser
(`source: 'log-tag-lines'`, sha256 unavailable → integrity check
skipped, plan entries flagged `unverified`). When neither exists,
the source is `'last-json-pointer'` and `pairs` is `[]` (the caller
exits 1 with "state file missing").

Alternative to flag if preferred:
- **Log-only**, never fall back. Cleaner surface but brittle — a
  user who pre-G2 applied (no JSON) gets a confusing error. (Recommendation:
  the dual-source path; the JSON preference preserves every existing
  safety guarantee.)
- **JSON-only**, error on missing JSON. Rejected — the same pre-G2
  legacy path fails outright. (Recommendation: same as above.)

### Gate G3-3 — Run selection (REQUIRES USER APPROVAL)

**Proposed**: default reads `<stateDir>/apply/last.json`. `--run-id
<id>` overrides. If the chosen runId's files are absent (e.g. pruned
post-retention), exit 1 with stderr "run <id> not found in <stateDir>
(retention window: 10)". No listing / interactive picker for the
"choose a run" UX — that's a future slice if needed.

Alternative to flag if preferred:
- **List-all mode**: `overture restore-last --list` prints every
  surviving runId with timestamps and pair counts, exits 0. Rejected
  — the retention window is 10 (`cat <stateDir>/apply/*.json |
  jq '.runId'`) and a dedicated listing command is scope creep. If the
  user wants to see history, `overture apply` already leaves a
  retrievable trail; a future `overture apply history` may satisfy it.
- **Interactive picker (TUI)** selecting from the retention list.
  Rejected — interactive UI in this CLI is established territory
  (`overture bootstrap --dry-run --interactive`); the apply + restore
  surface stays non-interactive for scriptability.

### Gate G3-4 — Confirmation + flag interaction (REQUIRES USER APPROVAL)

**Proposed**:
- `--dry-run` → print the plan, exit 0, no filesystem effects.
- `--yes` → skip prompt. The integrity gate (`mismatch` /
  `missing-backup`) still decides whether execution proceeds — a
  `mismatch` pair WITHOUT `--force` exits 1 and does NOT run any `mv`
  (atomic whole-run semantics: any failure aborts the batch).
  `missing-backup` pairs are skipped (not failed).
- `--force` → proceeds through `mismatch` pairs with a stderr WARN.
- `--yes` and `--dry-run` together → the plan prints and exits 0
  (dry-run dominates; `--yes` is irrelevant on the dry path).
- No `--yes` and TTY (stdin is a TTY) → interactive confirmation
  prompt renders the plan, then asks `Proceed? [y/N]`. Empty / `n` /
  anything other than `y` aborts (exit 1).
- No `--yes` and stdin is NOT a TTY (e.g. CI pipe) → exit 2 with
  stderr "interactive confirmation required (TTY) — pass --yes" +
  USAGE. Mirrors `runBootstrap`'s existing interactive gate.

Alternative to flag if preferred:
- **`--yes` is implicit**, no `--yes` flag — the user just runs
  `overture restore-last` and gets the prompt. Rejected — restores
  are destructive enough to require the safety of an explicit
  opt-in for scripts (`overture restore-last --yes`).
- **Batched `mv` continues past failures**: a `mismatch` pair causes a
  WARN + the failed pair is skipped, but later `ok` pairs still
  execute. Rejected — partial state after a restore is worse than
  no state; atomic whole-run semantics give the user a clean
  rollback back to "nothing was touched".

### Gate G3-5 — Integrity check semantics (REQUIRES USER APPROVAL)

**Proposed**: for every pair coming from the JSON source, the restore
compares `sha256OfFile(<target>)` (current state on disk) against
`ApplyStateAgent.preWriteSha256` (what was there before the apply).
- Match → `integrityStatus: 'ok'` → proceeds.
- Mismatch → `integrityStatus: 'mismatch'` → plan renders the WARN;
  `--yes` alone blocks at exit 1; `--yes --force` proceeds with a
  stderr WARN. `--dry-run` always reports the status but never
  executes.
- ENOENT on the current target → `integrityStatus: 'ok'` (the file
  was deleted between apply and restore — restore is a creation, not
  a clobber; backup moves in cleanly).
- ENOENT on the backup → `integrityStatus: 'missing-backup'` →
  skip with a stdout note; restore continues for the surviving pairs.

For pairs coming from the log source (gate G3-2 fallback): no sha256
exists → `integrityStatus: 'unverified'`; restore proceeds without
comparison; a stderr WARN on `--dry-run` and `--yes` paths.

Alternative to flag if preferred:
- **No integrity check**, just run the `mv`. Rejected — the user
  could lose edits silently. The check is a 1-line `sha256OfFile`
  per target; the cost is negligible vs the safety.
- **Mtime check (mtime on the target must equal mtime at apply-time)**:
  cheaper than sha256 but unreliable (mtime can be touched by `touch`
  and by editor save patterns); sha256 is the canonical primitive
  already wired into G1.

### Gate G3-6 — Execution semantics (REQUIRES USER APPROVAL)

**Proposed**: `mv` is invoked via Node's `child_process.spawn('mv',
['-v', backup, target])` per pair, sequentially. After each `mv`:
- Exit 0 → pair `ok` in the outcome.
- Non-zero → pair `failed: <reason>` (stderr captured); restore aborts
  (atomic semantics per gate G3-4).
- ENOENT on the backup pre-`mv` → pair `skipped` with no error
  (covered by `integrityStatus: 'missing-backup'` already).

Alternative to flag if preferred:
- **`fs.rename` from Node, no child process**. Faster, but `fs.rename`
  is a true rename — it leaves the backup source gone. The G2 log
  already advertises `mv -v` semantics (the user may have copied the
  log snippet expecting standard `mv`); running `fs.rename` instead
  breaks the contract of "matched `mv -v` from the log".
- **`cp -p` to the target then `unlink` the backup**. Defensive: the
  backup survives a failed `cp` mid-write. Rejected — `mv -v` is the
  contract; a future G3.* can change the primitive if the cost
  becomes a problem.

### Gate G3-7 — Restore-state audit record (REQUIRES USER APPROVAL)

**Proposed (default OFF)**: G3 does NOT write its own state record on
disk. The `--dry-run` plan-to-stdout is the only audit; future
restorers can re-run `--dry-run <runId>` to see what happened. The
G1 `ApplyStateRecord.mode` stays `'apply'` only — no schema widening.

Alternative to flag if preferred (would mean G3 writes a record):
- **Write `<stateDir>/apply/restore-<timestamp>-<randomHex8>.json`**
  with `mode: 'restore'`. Pairs paired retention with apply records;
  gives users a paper trail ("I last restored run X at Y"). Requires:
  - `ApplyStateRecord.mode: 'apply'` widens to
    `'apply' | 'restore'`.
  - `BuildApplyStateRecordArgs.mode` widens in parallel.
  - `readApplyState`'s `isApplyStateRecord` accepts both.
  - `apply-state.spec.ts` Case 7 added: read a seeded
    `mode: 'restore'` file, assert success.
  - The new pruner `pruneApplyArtifacts` already groups by runId; the
    restore record uses a different runId format
    (`restore-<ts>-<hex>` not `<ts>-<hex>`) so the retention buckets
    stay disjoint. (Recommended if audit is desired; rejected for
    minimal slice scope.)

### Gate G3-8 — Failure semantics & exit codes

**User verdict 2026-07-04 (locked)** — `missing-backup` is a FAILURE,
not a skip. Per the user: *"If a backup is missing, it could be that
it's nonexistant (restore backup foo when foo doesn't exist) and we
can't prove one way or the other so we should error that we couldn't
complete the request as asked."* The prior "skipped" semantics were
removed in the task-4 fix commit `fix(cli): error on missing-backup in
restore-last (user verdict 2026-07-04)`.

**Locked semantics**:
- Exit 0: `--dry-run` succeeds; `--yes` succeeds with all
  restoration outcomes `ok` (the `skipped` bucket, if any, is reserved
  for non-missing-backup future slices only — today nothing emits it).
- **Exit 1 (atomic whole-run)**: at least one pair failed, including
  any `missing-backup` pair; at least one pair was `mismatch` without
  `--force`; `--run-id` not found in retention; source file missing for
  resolved runId. On missing-backup: per-pair stderr
  `error: backup file missing: <quoted-backup>` + a follow-up
  `error: could not complete restore — backup file(s) may have been
  consumed by a previous restore, or never existed. Investigate with
  \`ls <stateDir>/apply/\` before retrying.` line, then exit 1 with the
  rendered outcome reporting `failed: N` (no `ok`s emitted for the
  remaining pairs — atomic).
- Exit 2: usage error (unknown flag, missing arg, no TTY + no
  `--yes`).

**Prior (rejected) proposal** (kept below for traceability):
- Exit 0: `--dry-run` succeeds; `--yes` succeeds with all
  restoration outcomes `ok` or `missing-backup` (skipped).
- Exit 1: at least one pair failed (`failed: <reason>`); at least
  one pair was `mismatch` without `--force`; `--run-id` not found
  in retention; source file missing for resolved runId.
- Exit 2: usage error (unknown flag, missing arg, no TTY + no
  `--yes`).

Alternative to flag if preferred:
- **Failure exits 0 with stderr**. Rejected — scripts need a reliable
  exit code; restore failure should propagate.
- **Distinguish pair-level vs run-level failures** with separate
  codes. Rejected — both surface as a failed restore at the CLI
  contract level; a script can inspect the rendered outcome for
  detail.

## MCP usage policy (REQUIRED — workers must follow)

> Both `codegraph` and `serena` MCPs are wired in this session. Workers
> MUST invoke them per the policy below. Plain `Read`/`Grep`/`Edit`
> remain for new-file creation, multi-line text edits where symbol-level
> replace is awkward, and CI gate invocations (Bash). The dispatch flow:
> codegraph BEFORE Read; serena for symbol-level surgical edits.

### Codegraph — structural context lookup

- **When to invoke**: BEFORE the first `Read` of an existing source
  file, BEFORE editing an existing symbol, and BEFORE declaring the
  blast radius of a change. Use the single `codegraph_explore` tool
  with a natural-language question or a bag of symbol names; it
  returns verbatim source PLUS call paths in one call.
- **When NOT to invoke**: new files (`.codegraph/` has not indexed
  them yet — index lag is ~1s); CI scripts / shell loops; Bash
  diagnostic commands; the final verification wave's workspace gates
  (those use pinned CLI tools, not MCPs).
- **Mandatory calls per Todo**:
  - **Todo 1** — one call: `codegraph_explore("readApplyState
    readApplyLog writeApplyState sha256OfFile ApplyStateAgent")` to
    pin the G1+G2 surface and the call paths between
    `readApplyState` ↔ `pruneApplyArtifacts` ↔ `apply-state.spec.ts`.
    The result replaces ~3 separate `Read` calls and pins every
    function the worker will need to import.
  - **Todo 2** — one call: `codegraph_explore("readRestoreSource
    buildRestorePlan RestorePlan RestorePair integrityStatus")` after
    stubbing. The graph won't yet have `restore-command` symbols
    (it's a new file the worker just wrote) — but the call surfaces
    the neighboring G1+G2 symbols the worker still needs (sha256
    source path, the `<runId>.json` reader, the `readApplyLog`
    parser). Use the staleness banner as a guide: any symbol marked
    "edited since the last index sync" is one the worker should
    re-Read for accurate content.
  - **Todo 3** — two calls:
    1. `codegraph_explore("cli dispatcher apply scan bootstrap
      restore-last run args")` — pin the existing `cli.ts` arm
      structure before adding the new arm. Returns the dispatcher
      body and the `USAGE` constant in one read.
    2. After editing `cli.ts`: `codegraph_explore("cli apply
      bootstrap restore-last USAGE")` — verify the new arm's call
      path lands on `runRestore` and doesn't accidentally re-route
      an existing arm.
  - **Todo 4** — zero mandatory calls; the work is docs + smoke
    script + lint. The orchestrator can still call
    `codegraph_explore` ad-hoc to confirm no orphans (e.g. verify
    `restore-command.ts` exports are all referenced from
    `cli.ts`).

### Serena — symbol-level semantic edits

- **When to invoke**: symbol-level edits on EXISTING files — renaming,
  replacing a function body, replacing an interface body, finding
  every reference to a symbol before changing its signature. The
  `serena_initial_instructions` call is mandatory at the start of
  each worker's first task in this slice (per the Serena MCP's own
  tool description).
- **When NOT to invoke**: new file creation (Write tool is fine);
  test spec files (Vitest conventions are text-y; per-case edit
  patterns are easier to express as `Edit`); full-file rewrites
  (just `Write` the new content).
- **Mandatory calls per Todo**:
  - **Todo 1** — `serena_initial_instructions` ONCE at task start
    (per the Serena MCP rule). Then for each stub function in
    `restore-command.ts`, use `serena_replace_symbol_body` with the
    `Error('TODO G3 Wave 2: <name>')` placeholder. Confirms the
    symbol table recognizes each export.
  - **Todo 2** — for each pure helper implementation
    (`readRestoreSource`, `buildRestorePlan`,
    `formatHumanRestorePlan`, `formatHumanRestoreOutcome`), use
    `serena_replace_symbol_body` to swap the TODO stub for the real
    body. Use `serena_find_referencing_symbols` to confirm callers
    before changing any signature on a shared type
    (`RestorePair.integrityStatus` is the riskiest — it's a string
    union that the renderer + plan builder both consume).
  - **Todo 3** — `serena_insert_before_symbol` /
    `serena_insert_after_symbol` for adding the new dispatcher arm
    inside `cli.ts` (cleaner than `Edit` for additive structural
    edits in a known location). For the new `runRestore` body,
    `serena_replace_symbol_body` again.
  - **Todo 4** — optional `serena_find_symbol("G3")` /
    `serena_search_for_pattern("G3")` to confirm no stale references
    to a previous gate-rejected decision linger in code.

### Anti-patterns

- Re-verifying codegraph results with grep / Read after the call
  returns. The graph is AST-derived; trust it.
- Reaching for `Read` first on an indexed file. Always
  `codegraph_explore` first.
- Using `Edit` for symbol-body replacement when the file is indexed
  and the symbol is named. Use `serena_replace_symbol_body` so the
  change flows through the symbol table.
- Spawning new specialist sessions for read-only lookups the
  orchestrator can answer with one codegraph call.

---

## Verification strategy

> Zero human intervention - all verification is agent-executed.

- Test decision: **TDD** with Vitest. New module under
  `apps/cli/src/restore-command.ts` and spec under
  `apps/cli/src/restore-command.spec.ts`. CLI dispatcher cases added
  to `apps/cli/src/cli.spec.ts`.
- Evidence directory: `.omo/evidence/`.
- Per-task evidence naming:
  `.omo/evidence/task-<N>-g3-restore-last.<ext>`.
- Required targeted Vitest commands during TDD:
  - `yarn vitest apps/cli/src/restore-command.spec.ts --run`
  - `yarn vitest apps/cli/src/cli.spec.ts --run` (dispatcher regression)
  - `yarn vitest apps/cli/src/apply-command.spec.ts --run` (G1/G2 stay green)
  - `yarn vitest apps/cli/src/apply-state.spec.ts --run` (G1 stays green; Case 7 only if gate G3-7 approved)
  - `yarn vitest apps/cli/src/apply-log.spec.ts --run` (G2 stays green)
- Final gates use workspace-pinned commands, not RTK global tools.

## Execution strategy

### Parallel execution waves

- **Wave 1 — red tests + source reader stub**: Todo 1.
- **Wave 2 — pure rendering + integrity evaluation**: Todo 2.
- **Wave 3 — dispatcher arm + flag parser + execute path**: Todo 3.
- **Wave 4 — gates + docs + smoke**: Todo 4.

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2 | none |
| 2 | 1 | 3 | none |
| 3 | 2 | 4 | none |
| 4 | 3 | final verification | none |

## Todos

> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [ ] 1. `apps/cli/src/restore-command.spec.ts` + stub module: red tests + readRestoreSource scaffold — expect 11 cases fail against stub
  What to do / Must NOT do: Create
  `apps/cli/src/restore-command.spec.ts` mirroring the 11 cases in
  Must-have. To make those compile + fail at the assertion level
  (not import), also create a stub `apps/cli/src/restore-command.ts`
  exporting `RestorePair`, `RestorePlan`, `buildRestorePlan`,
  `readRestoreSource`, `formatHumanRestorePlan`,
  `formatHumanRestoreOutcome`, `runRestore` — every function body
  throws `Error('TODO G3 Wave 2: <name>')`. Mark the stub header
  clearly as G3 Wave 1 scaffolding to be replaced in Wave 2. Do NOT
  touch `apply-state.ts`, `apply-log.ts`, `apply-command.ts`,
  `cli.ts`, or any writer. Do NOT add new dependencies.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 2
  MCP calls (REQUIRED): `serena_initial_instructions` ONCE at task
  start (per Serena MCP rule). ONE `codegraph_explore` call:
  `"readApplyState readApplyLog writeApplyState sha256OfFile
  ApplyStateAgent"` — pins the G1+G2 surface + call paths the worker
  will import. Use `serena_replace_symbol_body` for each stub
  function (replace the placeholder body with the real `throw` body)
  so the symbol table recognizes every export. The spec file is a
  fresh write (`Write` tool, no MCP needed); the stub file's plain
  `throw` body is best written via `serena_replace_symbol_body` per
  export.
  References (executor has NO interview context - be exhaustive):
  `apps/cli/src/apply-log.ts:256-280` (`readApplyLog` parser, the
  `restorePairs` array already populated); `apps/cli/src/
  apply-state.ts:135-143` (`sha256OfFile` integrity primitive);
  `apps/cli/src/apply-state.ts:163-198` (the `ApplyStateRecord`
  shape with `targetPaths` / `backupPaths` paired); `apps/cli/src/
  apply-state.ts:237-248` (`readApplyState` reader); `apps/cli/src/
  apply-command.ts:213` (`APPLY_USAGE` constant — mirror for the
  new `RESTORE_USAGE`).
  Acceptance criteria (agent-executable):
  `yarn vitest apps/cli/src/restore-command.spec.ts --run` fails all
  11 cases against the stub; `yarn vitest apps/cli/src/apply-state
  .spec.ts --run` passes 6 cases; `yarn vitest apps/cli/src/
  apply-log.spec.ts --run` passes 6 cases; `yarn tsc -b apps/cli`
  exits 0.
  QA scenarios (name the exact tool + invocation): happy:
  `yarn vitest apps/cli/src/restore-command.spec.ts --run 2>&1 | tee
  .omo/evidence/task-1-g3-restore-last.txt`, asserting the 11 cases
  fail; failure: a missing stub export surfaces as TS2305/TS2307.
  Commit: N | grouped with Todo 3.

- [ ] 2. `apps/cli/src/restore-command.ts`: pure helpers + integrity evaluation — expect 11 cases turn green
  What to do / Must NOT do: Implement per gate G3-2:
  - `readRestoreSource(stateDir, runId)` — try JSON first via
    `readApplyState`; on ENOENT fall back to `readApplyLog`; on
    ENOENT for both, return `{ source: 'last-json-pointer', pairs:
    [] }`.
  - `buildRestorePlan(stateDir, runId, now)` — call
    `readRestoreSource`, evaluate `sha256OfFile(<target>)` against
    `preWriteSha256` per pair (skipping the check when the source is
    `log-tag-lines` → `unverified`).
  - `formatHumanRestorePlan` and `formatHumanRestoreOutcome` — pure
    string renderers, lock the format in this slice (mirrors G2's
    Case 3 contract).
  Implement per gate G3-1, G3-3, G3-5: flag whitelist
  (`--dry-run`, `--yes`, `--force`, `--run-id <id>`), TTY detection
  via `process.stdin.isTTY`, prompt helper via a thin
  `readline`-wrapped function (testable via `vi.spyOn`). Do NOT
  add the `runRestore` execution path yet (that's Wave 3). Do NOT
  touch `apply-state.ts`, `apply-log.ts`. Do NOT change G1/G2 case
  assertions.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 3.
  MCP calls (REQUIRED): one `codegraph_explore` call: `"readRestoreSource
  buildRestorePlan RestorePlan RestorePair integrityStatus"` — note
  the graph may not yet have `restore-command` symbols (new file the
  worker just wrote); use the call to refresh neighboring G1+G2
  symbols (sha256 path, `readApplyLog` parser, `readApplyState`
  reader) and watch the staleness banner. Use
  `serena_replace_symbol_body` for each helper (replace the Wave 1
  stub body with the real implementation body). Before changing
  `RestorePair.integrityStatus` (a string union consumed by both the
  renderer and the plan builder), call
  `serena_find_referencing_symbols` on each member and confirm every
  consumer is updated.
  References (executor has NO interview context - be exhaustive):
  Node docs `node:readline/promises` for `confirm`-style prompts
  (https://nodejs.org/api/readline.html); `apps/cli/src/
  apply-command.ts:1043-1054` for the existing `loadAndValidateProfile`
  pattern (mirror the validation style); `apps/cli/src/
  bootstrap-prompt.ts` for the existing interactive prompt surface
  (study, don't import).
  Acceptance criteria (agent-executable):
  `yarn vitest apps/cli/src/restore-command.spec.ts --run` passes
  cases 1-5 (the pure-logic ones; 6-11 still fail awaiting Wave 3's
  execution path); `yarn tsc -b apps/cli` exits 0.
  QA scenarios: `yarn vitest apps/cli/src/restore-command.spec.ts
  --run 2>&1 | tee .omo/evidence/task-2-g3-restore-last.txt`.
  Commit: N | grouped with Todo 3.

- [ ] 3. `apps/cli/src/restore-command.ts` (execute path) + `apps/cli/src/cli.ts` (dispatcher arm) + spec cases 6-11: execution + dispatcher cases
  What to do / Must NOT do:
  1. Implement `runRestore(args, stdout, stderr, options?)`:
     - Parse flags; resolve runId from `last.json` when omitted.
     - Build the plan; render the plan to stdout.
     - If `--dry-run` → exit 0 (no `mv`).
     - If `--yes --force` / `--yes --no-mismatch` / interactive `y`
       → spawn `mv -v` per pair sequentially. Capture exit codes.
       Stop on first failure (atomic semantics).
     - Render the outcome; exit 0 / 1 / 2 per gate G3-8.
  2. Add the dispatcher arm in `apps/cli/src/cli.ts:225-251` after
     the `bootstrap` / `apply` arms; update the `USAGE` string
     (line 127) to advertise `restore-last`.
  3. Cases 6-11 in `restore-command.spec.ts` turn green; no
     changes to cases 1-5.
  4. Optional Case 12-15 to `apps/cli/src/cli.spec.ts`: dispatcher
     regressions (`--help`, `--unknown-flag`, no-args-still-USAGE,
     end-to-end `--dry-run` smoke via `XDG_STATE_HOME`).
  Parallelization: Wave 3 | Blocked by: 2 | Blocks: 4.
  MCP calls (REQUIRED): TWO `codegraph_explore` calls — first,
  BEFORE editing `cli.ts`: `"cli dispatcher apply scan bootstrap
  restore-last run args"` to pin the existing arm structure and the
  `USAGE` constant in one read; second, AFTER editing `cli.ts`:
  `"cli apply bootstrap restore-last USAGE"` to verify the new arm's
  call path lands on `runRestore` and doesn't accidentally re-route
  an existing arm. Use `serena_insert_before_symbol` /
  `serena_insert_after_symbol` for adding the new dispatcher arm
  inside `cli.ts` (cleaner than `Edit` for additive structural edits
  in a known location); use `serena_replace_symbol_body` for the
  new `runRestore` body and any `runRestore` test scaffolding. New
  spec cases 6-11 in `restore-command.spec.ts` are additive Edit
  calls — no MCP needed for the spec file edits.
  References (executor has NO interview context - be exhaustive):
  Node docs `node:child_process` `spawn('mv', [...])` — pipe `mv`
  stdout to a captured string for the outcome; `apps/cli/src/
  cli.ts:214-251` (the existing dispatcher arms — match the
  signature); `apps/cli/src/bootstrap-command.ts` for the existing
  `runBootstrap` shape (mirror the dispatch contract).
  Acceptance criteria (agent-executable):
  `yarn vitest apps/cli/src/restore-command.spec.ts --run` passes
  all 11 cases; `yarn vitest apps/cli/src/cli.spec.ts --run` passes
  all current + new cases; other CLI tests still pass;
  `yarn tsc -b apps/cli` exits 0.
  QA scenarios: `yarn vitest apps/cli/src/restore-command.spec.ts
  --run 2>&1 | tee .omo/evidence/task-3-g3-restore-last.txt`.
  Commit: Y | `feat(cli): add overture restore-last helper (G3)`.

- [ ] 4. `docs/overture-implementation-slices.md` + `apps/cli/scripts/verify-package.mjs` + workspace gates: mark G3 delivered — expect gates green and scope holds
  What to do / Must NOT do:
  1. Update `docs/overture-implementation-slices.md:609-615` (the G3
     "Expected result" block) to a "Delivered" section mirroring
     the G1 / G2 delivered-block style (lists which gates shipped,
     which were rejected, the resulting file surface, the test
     count, and the audit-trail behavior).
  2. If gate G3-7 was approved, add Case 7 to
     `apps/cli/src/apply-state.spec.ts` and update the G1
     "Delivered" block to mention the `mode: 'restore'` widening.
     Update `README.md` if gate G3-7 affects any user-facing
     surface (it does not, by default — only when the user widens
     the union).
  3. Add a G3 smoke to `apps/cli/scripts/verify-package.mjs` after
     the G2 smoke block — seed a restore-ready
     `last.json` + `apply/<runId>.json` + `apply/<runId>.log`,
     invoke `overture restore-last --dry-run`, assert the seeded
     pair's `mv -v '…' '…'` line appears in stdout.
  4. Run all 6 workspace gates. `git diff --stat` shows only
     `restore-command.{ts,spec.ts}`, `cli.ts`, `cli.spec.ts`,
     `apply-state.ts`/`spec.ts` (only if gate G3-7), the slice
     doc, and the verify-package script.
  Parallelization: Wave 4 | Blocked by: 3 | Blocks: final verification.
  MCP calls (REQUIRED): zero mandatory codegraph calls (the work is
  docs + smoke script + lint). Optional:
  `serena_find_symbol("G3")` and/or
  `serena_search_for_pattern("G3")` to confirm no stale references to
  gate-rejected decisions linger in code; `serena_find_referencing_symbols`
  on `runRestore` to confirm every export is wired (the dispatcher
  arm should reference it; no other callers expected).
  References (executor has NO interview context - be exhaustive):
  `docs/overture-implementation-slices.md:529-607` (G2 delivered
  block — mirror the prose style); `apps/cli/scripts/
  verify-package.mjs` (existing G1/G2 smoke block — add a G3
  smoke after).
  Acceptance criteria (agent-executable): All commands exit 0:
  `yarn nx test @overture/agents --skip-nx-cache`,
  `yarn nx test @jander99/overture --skip-nx-cache`,
  `yarn nx build @jander99/overture --skip-nx-cache`,
  `yarn nx lint @jander99/overture --skip-nx-cache`,
  `yarn prettier --check .`,
  `node apps/cli/scripts/verify-package.mjs`.
  QA scenarios: `{ yarn nx test @overture/agents --skip-nx-cache
  && yarn nx test @jander99/overture --skip-nx-cache && yarn nx
  build @jander99/overture --skip-nx-cache && yarn nx lint
  @jander99/overture --skip-nx-cache && yarn prettier --check .
  && node apps/cli/scripts/verify-package.mjs; } | tee
  .omo/evidence/task-4-g3-restore-last.txt`.
  Commit: Y | `docs(cli): record G3 restore-last helper delivery`.

## Final verification wave

> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and
> wait for the user's explicit okay before declaring complete.

- [ ] F1. Plan compliance audit
  - Agent-executable check: compare final diff against this plan and
    assert every Must Have is covered and every Must NOT is respected.
    Specifically: G1 retention invariant holds (no `pruneApplyState`
    / `pruneApplyArtifacts` changes); G1 spec cases 1-6 stay
    byte-identical (unless gate G3-7 added Case 7); G2 spec cases 1-6
    stay byte-identical; `apply-command.spec.ts` cases 1-33 stay
    byte-identical (no replacement); no writer files touched.
  - **MCP usage audit**: verify the per-Todo MCP calls were made —
    `codegraph_explore` calls in Todo 1, Todo 2, Todo 3 (×2), and the
    `serena_initial_instructions` invocation at the start of the
    first worker session. Cross-check the worker's evidence logs
    (`.omo/evidence/task-*-g3-restore-last.txt`) for traces of the
    MCP calls; missing traces = audit failure for that Todo.
  - Evidence: `.omo/evidence/f1-g3-restore-last-plan-compliance.md`.
- [ ] F2. Code quality review
  - Agent-executable check: review touched TypeScript for strict
    typing, no `any`, no `unknown` casts, no `fs.rename` lurking
    around (must use `child_process.spawn('mv')` per gate G3-6),
    no `--json` flag added to `restore-last`, no broad `ApplyResult`
    widening, no `apply-state.mode` widening unless gate G3-7
    approved. Confirm Gate G3-7 audit-trail code path only fires
    when that gate is approved.
  - Evidence: `.omo/evidence/f2-g3-restore-last-code-quality.md`.
- [ ] F3. Real manual QA by agent
  - Agent-executable check: seed a tmpdir with
    `overture.jsonc` + Claude Code config + OpenCode config; run
    `overture apply`; assert `stateDir/apply/last.json` +
    `apply/<runId>.json` + `apply/<runId>.log` are all on disk;
    then run `overture restore-last --dry-run` and assert the
    rendered plan is on stdout with at least one `mv -v '…' '…'`
    line. Then run `overture restore-last --yes` and assert the
    target files are restored to their pre-apply bytes (compare
    against `ApplyStateAgent.preWriteSha256`). Then run
    `overture restore-last --yes` again — assert
    `integrityStatus: 'missing-backup'` (the backups were
    consumed) and that the command exits 1 with a clear stderr
    message rather than silently doing nothing.
    Evidence: `.omo/evidence/f3-g3-restore-last-real-qa.md`.
- [ ] F4. Scope fidelity
  - Agent-executable check: verify no writer changes, no G1/G2 spec
    modifications (Case 7 only if gate G3-7), no batched restore
    artifact, no `restore <subcommand>` umbrella, no `--json` flag on
    `restore-last`, no `apply-state.mode` widening (unless G3-7
    approved), no Nx project addition, no unrelated files staged.
  - Evidence: `.omo/evidence/f4-g3-restore-last-scope.md`.

## Commit strategy

- Work on a new branch via worktree:
  - `.worktrees/g3-restore-last` on `feat/g3-restore-last`.
- Before any PR/commit work, worker must inspect:
  - `git status --short`
  - `git diff --stat`
  - `git log --oneline -5`
  - `git worktree list`
  - `git fetch origin main` (per AGENTS.md)
- Commit groups:
  1. `feat(cli): add overture restore-last helper (G3)` — Todos 1-3
     (tests, codec, dispatcher arm).
  2. `docs(cli): record G3 restore-last helper delivery` — Todo 4.
- Stage only intended files; never stage untracked `ARCHITECTURE.md`,
  `STRUCTURE.md`, `.codegraph/`, `.cortexkit/`, `.serena/`, or local
  evidence unless explicitly requested.
- PR title recommendation: `feat(cli): add overture restore-last helper (G3)`.

## Success criteria

- `overture restore-last --help` prints a USAGE block listing
  `--dry-run`, `--yes`, `--force`, `--run-id <id>` and exits 0.
- `overture restore-last --dry-run` reads `last.json` + the resolved
  `<runId>.json`, prints the plan, exits 0, performs no `mv`
  invocations (verified via vitest `vi.spyOn` on
  `child_process.spawn`).
- `overture restore-last --yes` with all `ok` integrity checks: every
  pair succeeds, exit 0; backups are exhausted (the apply's
  `.bak.<ts>` files are gone); targets hold the pre-apply bytes.
- `overture restore-last --yes` with a `mismatch` pair without
  `--force`: exit 1, NO `mv` runs (atomic semantics), stderr carries
  the rejection line, targets untouched.
- `overture restore-last --yes --force` with a `mismatch` pair:
  proceeds, stderr carries the WARN line, exit 0 iff every pair
  succeeded.
- `overture restore-last --run-id <id>` chooses a specific runId; a
  pruned runId is rejected with a clear stderr message and exit 1.
- Missing `last.json` → exit 1 with a clear stderr message naming
  `stateDir`.
- TTY + no `--yes` → interactive prompt; `y` permits, anything else
  aborts; non-TTY + no `--yes` → exit 2 with a stderr hint.
- Fallback to log-tag-lines path when JSON absent + log present:
  plan returns `source: 'log-tag-lines'`, integrity status
  `unverified`, restore proceeds.
- Full workspace gates pass (`yarn nx test`, `yarn nx build`,
  `yarn nx lint`, `yarn prettier --check .`,
  `node apps/cli/scripts/verify-package.mjs`).
- G1 spec cases 1-6 stay byte-identical (7 added only if gate G3-7
  approved); G2 spec cases 1-6 stay byte-identical; apply-command
  spec cases 1-33 stay byte-identical.
- Slice doc G3 "Expected result" → "Delivered" block accurately
  documents the implemented surface and which gates shipped.

---

# Gate summary (awaiting approval)

Pick a verdict on each. Defaults shown match the "Proposed" text above.

| Gate | Question | Default (recommended) | Reject? Alternative? |
| --- | --- | --- | --- |
| G3-1 | Command surface | top-level `overture restore-last` | nested `apply restore-last` / umbrella `restore` / `overture undo` |
| G3-2 | Source preference | JSON first, log fallback | log-only or JSON-only |
| G3-3 | Run selection | `--run-id <id>` overrides `last.json`; no listing | add `--list` / TUI picker |
| G3-4 | Confirmation | `--dry-run` / `--yes` / `--force` + TTY prompt | implicit yes or partial-failure batched |
| G3-5 | Integrity check | sha256 vs `preWriteSha256`; `--force` overrides | no check or mtime check |
| G3-6 | Execution primitive | `child_process.spawn('mv -v', …)` per pair | `fs.rename` or `cp`+`unlink` |
| G3-7 | Audit record on disk | OFF — no schema widening, no new file | write `restore-<ts>-<hex>.json` with `mode: 'restore'` |
| G3-8 | Exit codes | 0/1/2 with atomic whole-run semantics | single code or pair-vs-run split |

Implement the plan ONLY after each gate has a verdict.
