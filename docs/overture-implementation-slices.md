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

The product behaviors from the vision are not yet complete:

- **Read** is only partially implemented. The CLI reports current state, but it
  does not compare current state against canonical intent.
- **Bootstrap** is not implemented.
- **Apply** is not implemented.
- **Undo** is not implemented.

The next work should build the read model first. Do not start with writers.

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

**Status: E3 — Claude Code and GitHub Copilot CLI writer scaffolding landed:
real canonical-to-native conversion helpers (`toClaudeCodeMcpServer`,
`toGitHubCopilotCliMcpServer`) with inverse-normalization round-trip tests;
registry metadata aligned to `format: 'jsonc'` for Claude (user + project) and
Copilot (user + workspace) so preservation checks exercise the right surface;
Copilot workspace `.github/mcp.json` added to `mcpLocations` with workspace
precedence over the user-level file; Claude picker decision table
(project `.mcp.json` → user-top → user-projects[workspaceDir] → none) and
legacy `pickGithubCopilotCliMcpConfigTarget` removed in favor of the
writer-helper shape. The writers themselves still return
`reason: 'parse-error'` after target confirmation; the real byte-splice TDD
(`editJsoncMap`-backed splice of `mcpServers.<server>` with extension
preservation on existing entries) is deferred to a follow-up slice. Apply
remains future work.**

### E4. Remaining writers by format family

Add the rest in batches grouped by native config format:

- JSON/JSONC object-shaped agents
- TOML agents
- YAML/list-shaped agents

Expected result: each batch extends coverage without changing the writer safety
contract.

## Track F: apply behavior

Apply uses canonical intent to update clients.

### F1. Add `overture apply --dry-run`

Read canonical intent, build per-agent proposed changes, and print the diff or
summary without writing files.

Expected result: users can preview every planned change.

### F2. Add `overture apply` with backups

Before writing any agent config, create an adjacent backup of the original file.
Then apply only the canonical MCP entries to the target MCP subtree.

Expected result: real write behavior with backup creation.

### F3. Refuse settings conflicts during apply

If a target agent already has the same server name with different settings,
refuse instead of overwriting.

Expected result: apply never silently picks a winner.

## Track G: undo and auditability

Undo should be human-recoverable, not dependent on hidden state.

### G1. Apply state file

Record each apply run with enough information to identify touched files, backup
paths, hashes, and statuses.

Expected result: machine-readable state for the last apply runs.

### G2. Human-readable apply logs

Write a log per apply run that explains what changed and how to restore the
previous files manually.

Expected result: recovery path is visible with `cat`.

### G3. Restore-last helper

Optionally add a helper command that restores from the most recent successful
apply backup set.

Expected result: convenience on top of the `mv`-based recovery path, not a
replacement for it.

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
