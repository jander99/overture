# Overture implementation slices

This document records the small, reviewable chunks that move overture from the
current read-only substrate toward the product described in
[`docs/overture-vision.md`](overture-vision.md).

The vision document is the product contract. This document is mechanical: it
names the seams, suggests PR-sized chunks, and marks the decision gates that
should be approved before implementation crosses a boundary.

## Current baseline

The codebase already has useful foundations:

- `overture detect` performs read-only platform inventory.
- `overture config show` loads and prints the user-level overture config.
- `@overture/config` owns XDG path resolution, JSONC loading, and Zod schema
  validation.
- `@overture/agents` owns the per-agent registry, MCP config locations,
  parser-backed reads, typed config shapes, and server-list parsers.

The product behaviors from the vision are not yet complete: none. Bootstrap,
apply, and undo have shipped — see the section `## Track D`, `## Track E`,
`## Track F`, `## Track G` below.

## Slicing rules

Use these rules to keep future work small and reviewable:

- Each slice should be independently testable.
- Read-only slices come before write slices.
- Model slices come before CLI rendering slices.
- Writer work must not begin until the preservation harness exists.
- Prompts and conflict behavior need explicit approval before implementation.
- Skills remain inert unless a future plan explicitly reopens that scope.

## Track A: documentation alignment

These slices are independent and safe to do at any time.

### A1. Align README with shipped state

**Status: completed in PR #106.**

Update public docs so they do not claim sync/apply behavior that has not shipped.
The current shipped surface is `detect` and `config show`.

Expected result: README describes current behavior accurately while still naming
the intended direction.

### A2. Quiet skills in config docs

**Status: completed.**

Keep schema support for `skills`, but document that it is reserved/inert today.
Overture does not install, update, or remove Agent Skills.

Expected result: config docs match the vision's out-of-scope statement.

## Track B: read model foundation

These slices create the product object that later commands use.

### B1. Define the scan matrix model

**Status: completed.**

Create an internal model for comparing agents, canonical intent, and server
entries.

The model should represent at least:

- agent id and display name
- detected agent state
- MCP read/parse state
- canonical server name
- per-agent server presence
- status classification
- error/refusal reason when applicable

Candidate status values:

- `aligned`
- `missing-from-agent`
- `extra-in-agent`
- `different-settings`
- `shape-conflict`
- `parse-error`
- `unsupported-agent`
- `not-installed`

Approval gate: status vocabulary and meanings.

Expected result: a pure model with tests and no CLI output changes.

Delivered: the `@overture/scan-matrix` package in `packages/scan-matrix/`
exports `BuildScanMatrixInput`, `CompareAgentEntriesInput`, `AgentScanInput`,
`AgentSnapshot`, `NormalizedAgentServer`, `ScanMatrix`, `ServerStatusRow`,
`ServerStatus`, `AgentReadState`, `serverSettingsEqual`, `compareAgentEntries`,
`buildScanMatrix`, and `DEFAULT_REGISTRY_ORDER`. The status vocabulary
approved here is now enforced by the package's type and runtime tests
(`packages/scan-matrix/src/scan-matrix.spec.ts` plus the colocated
`scope-guards.spec.ts` anti-scope guards). The implementation source has no
I/O, no MCP config readers/parsers, and no output formatters; canonical vs
agent equality is a post-normalization field-exact byte compare
(`serverSettingsEqual`). B2 can consume the `NormalizedAgentServer` contract
to supply post-normalized `OvertureMcpServer` values without changing B1.

### B2. Normalize agent MCP configs into canonical server entries

Add a new optional handler `mcp.normalize` on `AgentMcpHandlers` that converts
each supported agent's native MCP shape into canonical `OvertureMcpServer`
entries. The handler is implemented per agent inside `@overture/agents` (the
existing `mcp.parseServers` handler stays separate — it renders the display
path; `mcp.normalize` is the canonical path for comparison).

Per-agent implementations live in `packages/agents/src/<id>.ts` for
claude-code, opencode, github-copilot-cli, and openai-codex. The agents
package depends on `@overture/config` for the `OvertureMcpServer` type
only — no `@overture/scan-matrix` import (scan-matrix already imports
`McpSupport` from agents; a reverse import would close a package cycle).

Shared normalization helpers and the canonical shape-conflict reason strings
live in `packages/agents/src/normalize-mcp-config.ts`. Per-agent normalizers are
wired into the registry through `asRegistryNormalizeHandler<TConfig>(handler)`
so the heterogeneous `AgentMcpHandlers.normalize` slot stays non-generic
while per-agent functions preserve their typed input shape.

Approval gate: the `mcp.normalize` handler interface and the
agents-package-as-home decision.

Expected result: fixture-backed `mcp.normalize` per agent, with no CLI
surface change. `@overture/scan-matrix` continues to receive canonical
entries unchanged.

**Status: completed.**

### B3. Classify conflicts

Add conflict classification on top of canonicalized entries.

Rules:

- Same server name, same shape, different settings is a pickable conflict during
  bootstrap.
- Same server name with type/shape mismatch is a hard refuse.
- Parse errors are hard refuses until the user fixes the source file.

**Status: completed.**

Approval gate: conflict taxonomy and refusal language.

Expected result: tests prove pickable conflicts and hard-refuse conflicts are
separate states.

Delivered: the `@overture/scan-matrix` package gains a pure, deterministic
`classifyConflicts(matrix: ScanMatrix): ConflictClassification` function plus
five exported types — `ConflictClassification`, `PickableConflict`,
`PickableConflictCandidate`, `HardRefuseConflict`, and `HardRefuseReason`.
The classifier populates `hardRefuses` with one entry per parse-error
`AgentSnapshot`, per `shape-conflict` row, per `different-settings` row in
canonical-ready mode (`canonical-settings-drift`), and per same-name
`extra-in-agent` group spanning both `stdio` and `remote`
(`mixed-transport-types`). It populates `pickable` only when canonical
intent is absent: one `PickableConflict` per server-name group with at
least two non-equal normalized candidates. Output is JSON-serializable
plain data; ordering is deterministic (`pickable` by server name,
candidates by matrix agent order; `hardRefuses` by reason, server name,
agent id). C1 (`overture scan --json`), C2 (human `overture scan`), and
D2 (bootstrap prompt) consume this contract; B3 implements no CLI,
prompt, writer, or `conflictPolicy` behavior. Purity guards in
`packages/scan-matrix/src/scope-guards.spec.ts` keep the classifier free
of I/O, renderers, async, `JSON.stringify`, and per-agent branches.

## Track C: read behavior surface

These slices expose the scan matrix without modifying files.

### C1. Add `overture scan --json`

Read detected agents and the canonical config, then emit the scan matrix as
machine-readable JSON.

If no canonical config exists, the command still scans agents and reports that
canonical intent is absent.

Expected result: first real implementation of the vision's Read behavior.

**Status: completed.**

Delivered: commits `d0125bbc`, `6ef584f8`, `7202c7ba`, `b43159a0`, `9981b24d`
on branch `feat/c1-scan-json` ship the C1 adapter. The `@overture/scan-matrix`
B1 model is now wired into the CLI through `apps/cli/src/scan.ts`, which
exposes a pure `buildScanJsonOutput({ ctx, config })` returning a
`ScanJsonOutput = { matrix: ScanMatrix, conflicts: ConflictClassification }`
envelope (no `version` / `generatedAt` / `duration` fields, by design — see
the `ScanJsonOutput` doc comment). The CLI dispatch in
`apps/cli/src/cli.ts::runScan` covers three exit codes: `0` for a clean scan
(empty inventory included), `1` when
`matrix.canonicalState === 'invalid-profile'` or
`conflicts.hardRefuses.length > 0` (the JSON envelope is still written to
stdout), and `2` for usage errors and pre-model orchestration failures (no
matrix emitted). The default-summary human renderer
(`formatHumanScanSummary`) always emits five lines (status, agent count,
canonical state, hard-refuse count, `scan --json` pointer), with an extra
install-suggestion block when zero agents are detected. Acceptance notes:
`yarn nx test @jander99/overture` covers both exit-code branches in
`apps/cli/src/scan.spec.ts` and the default-summary contract; the package
smoke `apps/cli/scripts/verify-package.mjs` exercises `scan --json` against
the installed tarball, asserts the top-level `{ matrix, conflicts }` shape,
the `matrix` keys (`agents`, `canonicalState`, `canonicalIntent`,
`canonicalProfileName`, `rows`), and the `conflicts` keys (`pickable`,
`hardRefuses`); and `yarn prettier --check .` plus `yarn nx lint
@jander99/overture` keep the docs and code style in CI shape.

### C2. Add human `overture scan` output

**Status: completed.**

Render the same scan matrix for humans.

The output should show:

- installed/configured agents
- servers already aligned
- servers missing from each agent
- servers present only in an agent
- conflicts and hard refuses
- parse errors

Expected result: read-only human report that explains what overture sees without
changing anything.

Delivered: the C2 human renderer now ships in the CLI default `overture scan`
path, with the installed-package smoke in `apps/cli/scripts/verify-package.mjs`
covering both `scan --json` and the no-flag detailed report. The sectioned
output is documented in the root README, stays read-only, and keeps JSON output
unchanged for machine consumers. Key commits on this branch were `0b18ab11`
(add detailed human rendering), `822e671d` (wire the default human scan path),
`f90621df` (lock the report categories), and `159ffc8b` (redact fingerprints).
Key verification for this slice came from the existing `yarn nx test
@jander99/overture` / `yarn nx test @overture/scan-matrix` passes, plus
`yarn prettier --check README.md docs/overture-implementation-slices.md apps/cli/scripts/verify-package.mjs`.

## Track D: bootstrap

Bootstrap creates canonical intent from existing agents. It does not modify agent
configs.

### D1. Bootstrap planner (D1 — shipped on feat/d1-bootstrap-planner)

When no overture config exists, build a proposed canonical config from the union
of all readable agent MCP configs.

Expected result: dry-run proposal only; no writes.

D1 ships `overture bootstrap --dry-run [--json]` as a read-only preview. D2
will add the interactive prompt UX, and D3 will add the write step.

**Status: completed on feat/d1-bootstrap-planner.**

### D2. Bootstrap conflict prompt

For pickable conflicts, ask the user which version should become canonical.
Offer skip-and-continue for that server.

For hard-refuse conflicts, stop and tell the user to manually fix the source
files before retrying.

Approval gate: prompt UX and skip semantics.

Expected result: interactive selection behavior covered by tests.

D2 implementation merged in this PR (2026-06-23).
QY|

### D3. Bootstrap write

Write the canonical `overture.jsonc` after the plan is conflict-free or all
pickable conflicts have been resolved/skipped.

Expected result: bootstrap writes only the overture config file. It does not
modify any agent config.

**Status: completed on feat/d3-bootstrap-write.**

## Track E: write safety

These slices must precede real apply behavior.

### E1. Writer preservation harness

Build a test harness proving that writers preserve every byte outside the target
MCP subtree.

The harness should cover:

- comments
- formatting
- key order
- unrelated config keys
- unrelated MCP servers
- repeated dry-run/apply cycles

Approval gate: preservation test contract.

Expected result: no production writer yet, but future writers have a required
safety gate.
**Status: completed on feat/agents-e1-writer-preservation (commit fbdc67ae, PR #121).** The harness lives in `packages/agents/src/writer-preservation/` and is enforced by `packages/agents/src/writer-preservation/contract.spec.ts`; the byte-level mutators are exercised by `byte-mutators.spec.ts` and `run-preservation-checks.spec.ts`.

### E2. First writer: OpenCode

Implement one writer against the preservation harness.

Use OpenCode first because it has a focused local config shape and a compact
MCP subtree.

Expected result: dry-run diff and write behavior for one agent only.
**Status: DONE — delivered on feat/e2-opencode-writer (this branch).** Implements the OpenCode writer against the E1 preservation harness and adds it to the agent registry. Adds `packages/agents/src/opencode-write.ts` plus `opencode.write.spec.ts` (42 tests), wires `parseServers` and the writer into `packages/agents/src/opencode.ts`, expands the registry surface in `packages/agents/src/types.ts`, and extends `packages/agents/src/writer-preservation/checks.ts` with the E2 coverage. The `apps/cli` side adds `scan.spec.ts` coverage for `AgentSnapshot.servers` so the new writer surfaces in `overture scan` output. Dry-run diff and write behavior for one agent (OpenCode) only; F-track apply behavior remains future work.

### E3. Next writers: Claude Code and GitHub Copilot CLI

Add writers for the next highest-value local agents.

Expected result: each writer passes the same preservation harness and produces
predictable dry-run output.

**Status: E3 — Claude Code and GitHub Copilot CLI byte-splice writers
complete. Both writers use `editJsoncMap` as the byte-splice primitive
(value-node-only replacement, preserving the property key and surrounding
whitespace) and pass the E1 writer-preservation harness for every happy-path
update (comments, top-level keys, key order, sibling servers, formatting,
env placeholders, extension fields, trailing newline, idempotency, rawBytes
check). Writers honor dry-run (planned metadata without disk write), no-change
(byte-equal canonical returns `reason: 'no-change'`), and stable `WriteReason`
mapping (`parse-error` | `unsupported-shape` | `not-targetable` | `no-change`).
E3 is update-only: no missing-file, missing-container, or missing-server
creation. Apply behavior remains future work; E4 (TOML/YAML writers, OpenAI
Codex) is the next slice.**

### E4. Remaining writers by format family

Add the rest in batches grouped by native config format:

- JSON/JSONC object-shaped agents
- TOML agents
- YAML/list-shaped agents

Expected result: each batch extends coverage without changing the writer safety
contract.

**Status: completed on feat/e4-openai-codex-toml-writer (this slice).** Delivered the OpenAI Codex TOML update-only writer against the E1 writer-preservation harness. The writer is an E3-style byte splice (no whole-document TOML reserialization) that preserves comments, key order, and unrelated top-level Codex config; native Codex extension fields (`env_vars`, `enabled_tools`, `disabled_tools`, `scopes`, `startup_timeout_sec`, `tool_timeout_sec`, `oauth_resource`, `required`, `enabled`, `bearer_token_env_var`, `cwd`, `env_http_headers`, `http_headers`, `url`, `command`, `args`, `env`) are preserved when compatible, and incompatible transport fields are intentionally dropped on transport switch. New harness coverage in `packages/agents/src/writer-preservation/` now treats descendant server subtables (e.g. `[mcp_servers.context7.env]`) as inside the touched server target, including bare-key and quoted-key table headers (`[mcp_servers."server.with.dot"]`); a quoted-key fixture ships with `CODEX_FIXTURE`. Non-contiguous target-descendant layouts are refused at the writer level as `unsupported-shape` (the harness is intentionally single-range). E4 is update-only: no missing-file, missing-container, or missing-server creation, no apply/backup/undo surface. Next slice: **F1 (`overture apply --dry-run`)**.

## Track F: apply behavior

Apply uses canonical intent to update clients.

### F1. Add `overture apply --dry-run`

Read canonical intent, build per-agent proposed changes, and print the diff or
summary without writing files.

Expected result: users can preview every planned change.

**Status: completed on feat/f1-apply-dry-run.** F2 (real writes + backups),
F3 (refusal of settings drift), G1 (state file), G2 (human logs), and G3
(restore-last) all shipped afterwards; see their entries below. Delivered
the `overture apply --dry-run [--json]` preview command. The orchestrator loads
the canonical `overture.jsonc`, picks the active profile by
`settings.defaultProfile` (default `'default'`), filters servers against
`profile.sync.disabledServers`, then iterates `profile.sync.targets` in order
calling each per-agent `mcp.write` handler with `dryRun: true`. Results are
aggregated into a `ApplyDryRunResult` envelope (profile, configPath,
disabledServers, results) and rendered as either JSON or a per-agent human
report. Every result is metadata-only — no raw original or written config
bytes are exposed. Exit code 0 means clean or no-change across all targets;
exit code 1 means at least one target refused (not-targetable, parse-error,
unsupported-shape, unsupported-format, or conflict); exit code 2 means
usage error. F1 is read-only by construction: the writers short-circuit on
`dryRun: true` and every seeded agent config file is byte-identical before
vs after the preview.

### F2. Add `overture apply` with backups

Before writing any agent config, create an adjacent backup of the original file.
Then apply only the canonical MCP entries to the target MCP subtree.

Expected result: real write behavior with backup creation.

**Status: completed on feat/f2-apply-with-backups (this slice).** Delivered
the `overture apply` real-write path with adjacent timestamped backups.
Each per-agent write runs in two passes: Pass 1 (`dryRun: true`) discovers
the target paths and change decision; if Pass 1 plans an update, the
orchestrator snapshots each target via `fs.copyFile` to
`<target>.bak.<YYYYMMDD-HHmmssSSS>` with a `-<randomHex(4)>` collision
suffix (3 retries); only then does Pass 2 (`dryRun: false`) perform the
real write. `settings.backupBeforeWrite` (default `true`) gates the
backup step — when `false`, Pass 2 runs without a snapshot. Refusal
statuses (`not-targetable`, `parse-error`, `unsupported-shape`,
`unsupported-format`) skip both the backup step and Pass 2. Backup
failures surface as a CLI-local `status: 'backup-failed'` (never widening
`WriteReason` in `@overture/agents`). The new `ApplyResult` envelope
(profile, configPath, disabledServers, backupBeforeWrite, results) is
human-only per gate F2-4 — `--json` stays dry-run-only. Conflict refusal
(F3) and the G-track (state file + restore + human logs) remain future
work.

> **Retroactive fixes shipped alongside this slice.** Restoring the
> Case 14 real-write happy path to cover both Claude and OpenCode
> surfaced two latent bugs in the OpenCode writer + E1 preservation
> harness that the F1 dry-run contract masked:
>
> 1. `packages/agents/src/opencode-write.ts::findServerPropertyRange`
>    returned a range that covered the entire property (key + value +
>    trailing comma), and the caller spliced `JSON.stringify(value)`
>    over it — so the property key was dropped on every existing-entry
>    update, leaving the document malformed. Narrowed the range to the
>    value node only (matches the E3 sibling `jsonc-map-write.ts`).
>    Also added a `local` branch to `toOpenCodeMcpServer` so a stdio
>    canonical pre-converted to `{type: 'local', command: [...]}` is
>    not re-classified as `remote` when `planEdits` re-invokes the
>    helper for extension preservation.
> 2. `packages/agents/src/writer-preservation/checks.ts::compareContainerKeyOrder`
>    computed `expected = common.map((_, i) => i)` (ascending indices),
>    which only fires when the relative order of common keys changes —
>    not when the relative order is preserved but the position within a
>    larger container shifts. Now `expected = common.map((k) => origKeys.indexOf(k))`,
>    matching the original parsed order.

### F3. Refuse settings conflicts during apply

If a target agent already has the same server name with different settings,
refuse instead of overwriting.

Expected result: apply never silently picks a winner.

**Status: completed on feat/f3-conflict-refusal (this slice).** Delivered
F3's `overture apply` settings-drift refusal. New CLI-local `'conflict'`
member on `ApplyStatus` / `ApplyDryRunStatus` (`WriteReason` in
`@overture/agents` unchanged); the `ServerConflict` shape lives in
`@overture/agents/types.ts` and is exported via `@overture/agents/index.ts`;
the `detectCanonicalSettingsDrift` helper in
`packages/agents/src/parse-mcp-servers.ts` compares two
`ReadonlyMap<serverName, AgentNormalizedMcpServer>` snapshots and is wired
into all four production per-agent writers (OpenCode, Claude Code with its
workspace-nested `projects[workspaceDir].mcpServers`, GitHub Copilot CLI,
OpenAI Codex). The orchestrator short-circuits before backup + Pass 2 via
the existing `'would-update'`-exclusive gate; `formatHumanApply` and
`formatHumanApplyDryRun` render a `Conflicts:` block; the dry-run JSON
envelope carries `AgentMcpWriteResult.conflicts`; `reasonDetail` policy
pinned to synthesized refusals only. Five commits on
`feat/f3-conflict-refusal` (`2397d82d` type contract,
`684079fb` detector, `f8e3eb08` writer integration, `1e060a4b` orchestrator
refusal, slice-doc/smoke commit). Plan:
`.omo/plans/f3-conflict-refusal.md`.

## Track G: undo and auditability

Undo should be human-recoverable, not dependent on hidden state.

### G1. Apply state file

Record each apply run with enough information to identify touched files, backup
paths, hashes, and statuses.

Expected result: machine-readable state for the last apply runs.

**Delivered: shipped 2026-07-04 (PR #TBD) on feat/g1-apply-state-file.**
Records each `overture apply` real-write run to a per-run JSON file under
`stateDir/apply/<runId>.json` plus a pointer file at
`stateDir/apply/last.json`. `stateDir` resolves via
`defaultOverturePaths()` — `$XDG_STATE_HOME/overture` when set, else
`~/.local/state/overture` — so the XDG invariant from project memory 72
is honored. The per-run schema (`ApplyStateRecord`) is parallel to
`ApplyResult` rather than an extension: a state file written today
remains parseable after future schema changes to the live envelope.
Records carry `schemaVersion: 1`, `runId`
(`<formatBackupTimestamp>-<randomHex8>`, lexically sortable),
ISO 8601 UTC `timestamp`, `mode: 'apply'`, `profile`, `configPath`, an
echo of effective `backupBeforeWrite`, and per-agent entries with
`agentId`, `displayName`, `status` (stored as `string` so a future
`ApplyStatus` widening does not invalidate old records), `targetPaths`,
`backupPaths`, `preWriteSha256` / `postWriteSha256`, and optional
`reason` (mirroring `ApplyAgentResult.reasonDetail`). Hash strategy is
SHA-256 (Node `crypto.createHash`, lowercase hex, 64 chars) — `null`
when the target file was absent before or after the write so
"file did not exist" is distinguishable from "file existed with empty
content". Retention is bounded to the 10 most recent per-run files:
`pruneApplyState` lexically sorts `apply/*.json` (the pointer file and
any stale `*.tmp-*` are excluded by the `*.json && name !== 'last.json'`
filter), unlinks the oldest so the surviving count equals `keep`
(default 10), and runs at the end of every successful write. GC runs
in the `writeApplyState` call after the per-run file is on disk and
the pointer file is updated; `last.json` is never pruned. Dry-run runs
produce no state file — the `--dry-run` branch in `runApply` short-
circuits before `recordApplyStateBestEffort`, matching gate G1-4.
State-write failures are best-effort: the helper swallows its own
errors after emitting a single `warning: failed to write apply state:`
line to `stderr`, and the apply exit code is preserved (a state-write
failure cannot retroactively make a successful apply exit non-zero).
Implementation lives in the new CLI-local module
`apps/cli/src/apply-state.ts` (codec + atomic writer + GC), with the
orchestrator hook in `apps/cli/src/apply-command.ts` — `runApply`
captures `defaultOverturePaths()` once at the top of the real-write
branch, runs a pre-discovery `mcp.write` pass to resolve target paths
and pre-write hashes BEFORE the existing `applyToAgentReal` loop, then
calls `recordApplyStateBestEffort(...)` after the human report is
emitted. No writer files were modified, `ApplyResult` /
`ApplyAgentResult` / `ApplyStatus` / `WriteReason` were not widened,
no Nx project was added, and the `--dry-run --json` envelope is
byte-identical to its pre-G1 shape. G2 (human-readable apply logs on
disk) and G3 (`overture restore-last` helper, plus consumer for the
state file) remain future work.

### G2. Human-readable apply logs

Write a log per apply run that explains what changed and how to restore the
previous files manually.

Expected result: recovery path is visible with `cat`.

**Delivered: shipped 2026-07-04 (PR #TBD) on feat/g2-apply-logs.** Writes a
human-readable recovery log to `<stateDir>/apply/<runId>.log` adjacent to
each G1 state record, sharing the same `last.json` pointer schema.
`stateDir` resolves through the same `defaultOverturePaths()` path the G1
record uses — `$XDG_STATE_HOME/overture` when set, else
`~/.local/state/overture` — so the XDG invariant from project memory 72
is honored and the G1/G2 artifacts always land side-by-side. The log is a
plain-text 5-section document: **header** opens with an 80-character `=`
separator and `Overture apply log` followed by the runId, ISO timestamp,
profile name, config path, an echo of effective `backupBeforeWrite`, and
`generated by: overture@<cli-version>` (the cli version is read at
runtime from `apps/cli/package.json` via the existing
`createRequire(__filename)` pattern, falling back to `"overture"` when
unavailable); **warning** follows as an 80-character `#` separator
framing `DO NOT source this file — read it and run individual commands.`
so the user never sources the file in a shell by accident; **per-agent
blocks** are emitted in registry order — for every agent the renderer
emits `[agentId] displayName` + `status: <value>`, then for each
`(backup, target)` pair emits three lines — `backup: '<path>'`, `target:
'<path>'`, and `mv -v '<backup>' '<target>'`; the `backup:` / `target:`
tag lines are the G3-prep parse anchors and the `mv -v` lines are the
recovery snippets, so non-`updated` agents render a one-liner with
their status and (when present) refusal reason but no restore commands;
**footer** is an 80-character `=` separator around `Roll-back all (read
first, run after review)`, a `roll-back-all:` marker, a generation
comment with the run timestamp, and every per-agent `mv -v` line in
reverse-agent order so a user can copy-paste the whole block to revert
every change in one shot (the markers are always present so the file is
structurally consistent even when no agent was updated);
**last-pointer references** close the file as an 80-character `-`
separator around `log:`, `state:`, and `pointer:` absolute paths pointing
at the sibling `<runId>.log`, the sibling `<runId>.json`, and the
`last.json` pointer respectively. Paths are single-quoted; embedded `'`
is escaped as `'\''` (the canonical POSIX `close + escaped + open`
sequence) so paths containing spaces, `$`, `;`, `&`, `(`, `)`, and `'`
survive shell-sourcing never, since the warning forbids it anyway.
Lockstep retention with G1 is enforced by promoting G1's `pruneApplyState`
to `pruneApplyArtifacts` in `apps/cli/src/apply-state.ts`: the helper now
reads `<stateDir>/apply/*.{json,log}`, groups by basename-without-extension
so the `.json` and `.log` for the same `<runId>` are unlinked together,
lexically sorts (the runId encodes a sortable backup timestamp), keeps
the newest `keep` runIds (default 10), and unlinks the rest; `last.json`
is never pruned. `writeApplyState` calls the renamed function;
`apps/cli/src/apply-state.spec.ts` Case 5 was extended to seed 12 paired
`.json` + `.log` files and assert the 2 oldest pairs are unlinked,
while cases 1-4, 6 stay byte-identical. The atomic write mirrors G1's
inline pattern: `open → writeFile → fsync → close → rename`, with a
unique `.tmp-<hex>` temp path that is unlinked on failure (no shared
`atomicWriteFile` helper per the plan's YAGNI guardrail — the two inline
copies are independent and small). Real writes emit a log; `overture
apply --dry-run` produces no log (the dry-run branch in `runApply`
short-circuits before the log hook, matching gate G2-4's
`--dry-run`-exclusive invariant). Log-write failures are best-effort
and independent from G1's try/catch — a single stderr warning
`warning: failed to write apply log: <err>` fires on rejection, the
apply exit code is preserved, and the G1 state-write success path is
unaffected (`writeApplyState` and `writeApplyLog` each own their own
try/catch boundary). Implementation lives in the new CLI-local module
`apps/cli/src/apply-log.ts` — `ApplyLogEntry` and `ApplyLogContent`
types (per gates G2-1 / G2-3), `shellQuotePath`, `buildApplyLog`
(projects an `ApplyStateRecord` into the structured document,
pairing `targetPaths[i]` with `backupPaths[i]`), `renderApplyLog` (the
pure 5-section plain-text renderer), `writeApplyLog` (the atomic
writer + GC via `pruneApplyArtifacts`), `readApplyLog` (the line-prefix
parser that round-trips through the tag-line anchors), and the
re-exported `pruneApplyArtifacts` (paired JSON+log GC). The
orchestrator hook lives in `apps/cli/src/apply-command.ts` —
`recordApplyStateBestEffort` was refactored to return
`Promise<ApplyStateRecord | null>` so `runApply`'s real-write branch
can thread the same record into `buildApplyLog(... stateDir)` and
`writeApplyLog(...)` next to G1's `writeApplyState(...)` call. No
writer files were modified, `ApplyResult` / `ApplyAgentResult` /
`ApplyStatus` / `WriteReason` / `ApplyStateRecord` / `ApplyStateAgent`
were not widened, no Nx project was added, no `apply restore`
subcommand or `--log-format` flag was introduced, and G1's spec cases
24-28 plus the F1/F2/F3 spec cases 1-23 stay byte-identical (only G1's
Case 5 fixture was enhanced per the plan's Must-have). G3 (`overture
restore-last` helper, consumer for the `backup:` / `target:` tag lines
and the `mv -v` recovery snippet) remains future work.

### G3. Restore-last helper

**Delivered: shipped 2026-07-04 (commit `862a417a`) on `feat/g3-restore-last`.**
Adds `overture restore-last`, a convenience on top of the `mv`-based recovery
path the G2 logs advertise — not a replacement for it. The new CLI-local
module `apps/cli/src/restore-command.ts` exports `RestorePair`,
`RestorePlan`, `RestoreOutcome`, `RestoreOutcomeStatus`, `RunRestoreOptions`,
`readRestoreSource`, `buildRestorePlan`, `formatHumanRestorePlan`,
`formatHumanRestoreOutcome`, `runRestore`, and the `RESTORE_USAGE` banner;
the dispatcher arm in `apps/cli/src/cli.ts` routes `restore-last` to
`runRestore(...)` and the top-level USAGE block lists it alongside `detect` /
`apply` / `bootstrap` / `scan`. **Command surface:**
`overture restore-last [--dry-run] [--yes] [--force] [--run-id <id>]`.
`--help` / `-h` print the USAGE block (exit 0); unknown flags exit 2 and
emit `Unknown flag: <arg>` + USAGE on stderr. **Source preference**
(gate G3-1) — `readRestoreSource` tries `<stateDir>/apply/<runId>.json`
first (the G1 canonical record, carrying `preWriteSha256`), falls back to
`<stateDir>/apply/<runId>.log` parsed through the G2 tag-line codec
(`backup:` / `target:` lines, no sha256), and returns
`source: 'last-json-pointer'` with `pairs: []` when neither exists —
`last.json` is resolved through a small `readLastJsonPointer` helper. Empty
plan sentinel is intentional: the caller exits 1 with a clear stderr
message rather than guessing. **Integrity check** (gate G3-5) —
`buildRestorePlan` SHA-256s each `<target>` via `sha256OfFile` (reused from
`apply-state.ts`) and compares against the G1 record's `preWriteSha256`,
producing a four-way `integrityStatus`: `ok` when the current bytes match
`preWriteSha256` _or_ the target is absent on disk (the restore is a
creation, not a clobber — per gate G3-5 the backup moves in cleanly);
`mismatch` when bytes diverge (or `preWriteSha256` is `null`, the
best-effort-skip case the G1 recorder uses when the pre-write hash
couldn't be captured); `missing-backup` when the writer-aligned
`backupPaths` slot is empty or the `.bak.<ts>` file is gone; `unverified`
for the log-tag-lines source (no reference sha256 available). The plan
type carries `preWriteSha256` and `currentSha256` explicitly as
`string | null | undefined` so "absent" is distinguishable from "empty
bytes" without sentinel strings. `--force` short-circuits the `mismatch`
gate (emitting `WARN: target ... was edited since apply; restore forced.`
to stderr per pair) but never overrides a real `mv` failure. **Execution**
(gate G3-6) — `runRestore` spawns `child_process.spawn('mv', ['-v',
backup, target])` per pair via a lazy `spawnMvVerbose` helper (stdout +
stderr captured, exit code resolved on `'close'`); the on-disk contract
the G2 log advertises is matched verbatim — never `fs.rename` — so a user
copying `mv -v` lines out of an apply log and a user running
`overture restore-last` see the same tool emit the same `-v` line. Pairs
execute sequentially; the first `mv` exit ≠ 0 aborts the batch and the
partial `RestoreOutcome[]` is rendered — atomic whole-run semantics per
gate G3-8. **Exit codes** (gate G3-8): `0` on a clean dry-run _or_ a
fully successful restore, `1` on a refused restore (no history / pruned
runId / blocked mismatch without `--force` / `N` at the prompt / a
mid-batch `mv` failure), `2` on usage errors (missing value for
`--run-id`, unknown flag, non-TTY interactive confirm without `--yes`).
**Flag / TTY interaction** (gate G3-4): without `--yes`, the dispatcher
prompts `Proceed? [y/N] ` only when `process.stdin.isTTY === true`
(overridable via `RunRestoreOptions.isTTY` for tests); non-TTY + no
`--yes` exits 2 with `interactive confirmation required (TTY) — pass
--yes`. The `prompt` option on `RunRestoreOptions` is the test-injection
seam; the production path is `createStdinConfirmPrompt`, lazy-imported
from `node:readline/promises` so the readline bundle stays out of the
unit-test path. **Gate verdicts locked**: G3-1 top-level dispatch
(USAGE + flag parsing + runId resolution from `last.json`), G3-2
JSON→log tag-line fallback, G3-3 `--run-id` override of `last.json`
(pruned runIds emit `run <id> not found in <stateDir> (retention window:
10)` and exit 1), G3-4 flags + TTY (`--yes` skips prompt; non-TTY
without `--yes` is a usage error → 2), G3-5 sha256 integrity
(`ok` / `mismatch` / `missing-backup` / `unverified`), G3-6 `spawn mv -v`
(not `fs.rename`), **G3-7 OFF** — no audit record, no
`ApplyStateRecord.mode` widening, G3 is read-only on disk; G3-8 atomic
0/1/2 exit semantics with mid-batch abort. **Tests:** 11 cases in
`apps/cli/src/restore-command.spec.ts` — Case 1
`readRestoreSource` JSON path, Case 2 log-tag-lines fallback, Case 3
`buildRestorePlan` integrity matrix (`ok` / `mismatch` /
`missing-backup`), Case 4 `formatHumanRestorePlan` stable rendering
(header / per-pair / footer), Case 5 `runRestore --dry-run`, Case 6
`runRestore --yes` with all `ok` pairs, Case 7 `runRestore --yes` with a
`mismatch` pair (no `--force`) — exit 1 + no clobber, Case 8
`runRestore --yes --force` with a `mismatch` pair — proceeds + WARN,
Case 9 `runRestore --run-id` override + pruned runId, Case 10 no
`last.json`, Case 11 TTY prompt simulation (`y` proceeds, `n` aborts);
plus 4 cases in `apps/cli/src/cli.spec.ts` — Cases 12-15 in the
`run: restore-last dispatcher (G3)` block (`--help` exits 0 with USAGE,
`--dry-run` end-to-end through the dispatcher with `XDG_STATE_HOME`
override and seed data, `--unknown-flag` exits 2 with USAGE on stderr,
and a no-args regression guard so the new dispatcher arm doesn't break
the empty-args USAGE render). **Files touched (this commit, only):**
`apps/cli/src/restore-command.ts`, `apps/cli/src/restore-command.spec.ts`,
`apps/cli/src/cli.ts`, `apps/cli/src/cli.spec.ts`. **Spec invariants
preserved** — apply-state cases 1-6 stay byte-identical, apply-log cases
1-6 stay byte-identical, apply-command cases 1-33 stay byte-identical;
the G1 `ApplyStateRecord` / `ApplyStateAgent` shapes and the G2
`ApplyLogEntry` / `ApplyLogContent` shapes are unchanged; no writer file
in `packages/agents/src/*` was modified, no Nx project was added, no
`--log-format` flag or `apply restore` subcommand exists, `ApplyResult`
/ `ApplyAgentResult` / `ApplyStatus` / `WriteReason` were not widened,
and the `--dry-run --json` envelope for `overture apply` is byte-
identical to its pre-G3 shape. Backups persist after a successful
restore — the next `overture apply` will prune them via G1's lockstep
`pruneApplyArtifacts`.

## Recommended execution order

1. A1. Align README with shipped state
2. A2. Quiet skills in config docs
3. B1. Define the scan matrix model
4. B2. Normalize agent MCP configs into canonical server entries
5. B3. Classify conflicts
6. C1. Add `overture scan --json`
7. C2. Add human `overture scan` output
8. D1. Bootstrap planner
9. D2. Bootstrap conflict prompt
10. D3. Bootstrap write
11. E1. Writer preservation harness
12. E2. First writer: OpenCode
13. E3. Next writers: Claude Code and GitHub Copilot CLI
14. E4. Remaining writers by format family
15. F1. Add `overture apply --dry-run`
16. F2. Add `overture apply` with backups
17. F3. Refuse settings conflicts during apply
18. G1. Apply state file
19. G2. Human-readable apply logs
20. G3. Restore-last helper

## First approval gates

Before implementation resumes, resolve these gates in order:

1. Scan matrix vocabulary.
2. Conflict taxonomy and refusal language.
3. Bootstrap prompt UX and skip semantics.
4. Writer preservation contract.
5. Apply dry-run output shape.

Once those are settled, the implementation can proceed in small PRs without
re-litigating the product model on every slice.
