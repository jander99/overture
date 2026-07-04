# F3 — G3 real manual QA re-run (post-fix, post-user-verdict)

**Verdict: PASS** — `rc=0` (all 35 assertions across 9 steps, 0 FAIL)

Reconciled from Wave-4 task-4 run on 2026-07-04 after the user verdict
that re-classified `missing-backup` from a `skipped` outcome to a
`failed` outcome (see `.omo/plans/g3-restore-last-helper.md` gate G3-8
for the annotation).

## Pre-flight (PASS)

- `4b0e3898 fix(cli): resolve absolute paths in apply state record
  + G3 review fixes` is the prior-task HEAD on `feat/g3-restore-last`.
- Post-fix HEAD (this run): `fix(cli): error on missing-backup in
  restore-last (user verdict 2026-07-04)`.
- Build artifact present and `restore-last` advertised in USAGE.
- F3 driver updated to honour the `--yes --force` precondition the
  integrity check requires for post-apply restores (Step 5 / Step 6
  / Step 8); Step 9 pair-count regex broadened to match
  `ok|mismatch|missing-backup` instead of `ok` only (matches the
  reality of every post-apply dry-run in this slice).

## Per-step results

| Step | Result | Detail |
|---|---|---|
| 1 | PASS | Seeded tmpdir with opencode config |
| 2a | PASS | `apply --json` literal exits 2 per F2-4 gate |
| 2b | PASS | Real `apply` succeeds; writes state JSON + log + backup; **absolute targetPaths (Fix A confirmed)** |
| 3 | PASS | `restore-last --dry-run` renders absolute `mv -v` target |
| 4 | PASS | sha256 baseline captured |
| 5 | PASS | `restore-last --yes --force` succeeds (target restored, backup consumed, `restored: 1, skipped: 0, failed: 0` summary) |
| 6 | **PASS** | Re-run `restore-last --yes --force` returns **exit 1** with `error: backup file missing:` + `error: could not complete restore …` on stderr; **summary `restored: 0, skipped: 0, failed: 1`** — user verdict 2026-07-04 |
| 7 | PASS | `--run-id nonexistent` → exit 1 with clean stderr |
| 8 | PASS | `--run-id <valid> --yes --force` → exit 1, stderr carries `error: backup file missing:` (valid runId's backups consumed in Step 5) |
| 9 | PASS | 12-apply retention stress holds; G1 invariant preserved |

**Total: 35/35 assertions PASS, 0 FAIL** (Required Steps 1-7: PASS;
Optional Steps 8-9: PASS).

## Steps 5 + 6 verbatim (the load-bearing flow)

### Step 5 — `restore-last --yes --force`

```
$ node $BUNDLE restore-last --yes --force
exit: 0
stdout:
========================================================================
Overture restore plan
========================================================================
run id:        20260704-201754118-35021572
source:        state-json
state dir:     <tmp>/.local/state/overture/apply
config path:   <tmp>/.config/overture/overture.jsonc

[opencode] OpenCode
  status: mismatch
  mv -v '<tmp>/.config/opencode/opencode.json.bak.20260704-201754118' '<tmp>/.config/opencode/opencode.json'

------------------------------------------------------------------------
pairs: 1
========================================================================
Overture restore outcome
========================================================================
run id:        20260704-201754118-35021572
source:        state-json

[opencode] OpenCode
  ok

------------------------------------------------------------------------
restored: 1, skipped: 0, failed: 0

stderr:
WARN: target '<tmp>/.config/opencode/opencode.json' was edited since apply; restore forced.
```

Backup file `opencode.json.bak.20260704-201754118` consumed (gone).

### Step 6 — `restore-last --yes --force` (re-run, missing-backup)

```
$ node $BUNDLE restore-last --yes --force
exit: 1
stdout:
========================================================================
Overture restore plan
========================================================================
run id:        20260704-201754118-35021572
source:        state-json
state dir:     <tmp>/.local/state/overture/apply
config path:   <tmp>/.config/overture/overture.jsonc

[opencode] OpenCode
  status: missing-backup
  mv -v '<tmp>/.config/opencode/opencode.json.bak.20260704-201754118' '<tmp>/.config/opencode/opencode.json'

------------------------------------------------------------------------
pairs: 1
========================================================================
Overture restore outcome
========================================================================
run id:        20260704-201754118-35021572
source:        state-json

[opencode] OpenCode
  failed: backup file missing

------------------------------------------------------------------------
restored: 0, skipped: 0, failed: 1

stderr:
error: backup file missing: '<tmp>/.config/opencode/opencode.json.bak.20260704-201754118'
error: could not complete restore — backup file(s) may have been consumed by a previous restore, or never existed. Investigate with `ls <tmp>/.local/state/overture/apply/` before retrying.
```

## User verdict 2026-07-04 (locked)

Per the user, record-keeping:

> "If a backup is missing, it could be that it's nonexistant
> (restore backup foo when foo doesn't exist) and we can't prove
> one way or the other so we should error that we couldn't complete
> the request as asked."

Implementation: gate G3-8 in `.omo/plans/g3-restore-last-helper.md`
now classifies `missing-backup` pairs as `failed`, not `skipped`.
The restore-command `runRestore` execution loop pre-scans the plan
for any `missing-backup` pair and refuses to issue any `mv`
shell-out when found (atomic whole-run semantics per gate G3-8).
The result is the Step 6 output above: exit 1, per-pair stderr
error + follow-up investigation hint, summary `failed: 1`.

## Verdict

PASS on every dimension:

1. Step 5 (apply → restore-last end-to-end): exit 0, target
   restored, backup consumed.
2. Step 6 (re-run on consumed backup): exit 1, stderr carries both
   required error lines, summary `restored: 0, skipped: 0, failed:
   1`. The user verdict 2026-07-04 is satisfied.
3. Steps 7-9 (run-id ghost, valid-runid, retention stress): all PASS.
4. Workspace gates (`nx test`, `nx build`, `nx lint`, `prettier
   --check .`, `verify-package.mjs`) all RC=0.

The pre-fix Step 6 failure (`exit 0` instead of exit 1) is resolved.

rc=0
