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

Approval gate: conflict taxonomy and refusal language.

Expected result: tests prove pickable conflicts and hard-refuse conflicts are
separate states.

## Track C: read behavior surface

These slices expose the scan matrix without modifying files.

### C1. Add `overture scan --json`

Read detected agents and the canonical config, then emit the scan matrix as
machine-readable JSON.

If no canonical config exists, the command still scans agents and reports that
canonical intent is absent.

Expected result: first real implementation of the vision's Read behavior.

### C2. Add human `overture scan` output

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

## Track D: bootstrap

Bootstrap creates canonical intent from existing agents. It does not modify agent
configs.

### D1. Bootstrap planner

When no overture config exists, build a proposed canonical config from the union
of all readable agent MCP configs.

Expected result: dry-run proposal only; no writes.

### D2. Bootstrap conflict prompt

For pickable conflicts, ask the user which version should become canonical.
Offer skip-and-continue for that server.

For hard-refuse conflicts, stop and tell the user to manually fix the source
files before retrying.

Approval gate: prompt UX and skip semantics.

Expected result: interactive selection behavior covered by tests.

### D3. Bootstrap write

Write the canonical `overture.jsonc` after the plan is conflict-free or all
pickable conflicts have been resolved/skipped.

Expected result: bootstrap writes only the overture config file. It does not
modify any agent config.

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

### E2. First writer: OpenCode

Implement one writer against the preservation harness.

Use OpenCode first because it has a focused local config shape and a compact
MCP subtree.

Expected result: dry-run diff and write behavior for one agent only.

### E3. Next writers: Claude Code and GitHub Copilot CLI

Add writers for the next highest-value local agents.

Expected result: each writer passes the same preservation harness and produces
predictable dry-run output.

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
