# overture

`overture` is a CLI utility that scans your machine for MCP-capable LLM coding
platforms and reports the state of each platform's MCP server configuration.
The currently-shipped commands are `overture detect` (read-only inventory),
`overture config show` (print the resolved user-level `overture.jsonc`), and
`overture bootstrap` (one-time setup: writes the canonical `overture.jsonc`
on success when run without flags). `overture detect`, `overture config
show`, and `overture bootstrap --dry-run [--json]` never write or modify
any file.

`overture` is published to npm as `@jander99/overture`.

```bash
# Run without installing (uses the latest published version):
npx @jander99/overture@latest --help
```

Requires **Node.js >= 24** (the CLI's first published version targets the
Node 24 LTS baseline; local Node 25 also works).

> **Status**: the npm package shape is ready and the first publish is gated
> behind a manual approval step. See `.omo/plans/npm-npx-readiness-phase-set.md`
> for the publish-readiness phase-set.

## What it does

`overture detect` scans the host and reports which MCP-capable LLM platforms
are installed. For each platform it reports three orthogonal signals:

- `installed` — the platform app or CLI is on this machine.
- `mcpConfigured` — the user has populated the platform's expected MCP
  section in its config file (parser-backed for JSON, JSONC, and TOML
  formats).
- `mcpSupport` — whether the platform has a known MCP client surface
  (`supported`, `unsupported`, or `unknown`).

`overture config show` prints the resolved user-level `overture.jsonc` config
if present.

See [`docs/coding-platform-mcp-configurations.md`](docs/coding-platform-mcp-configurations.md)
for the per-platform catalog that drives detection.

## The `detect` command

`overture detect` is a **read-only** inventory: it never writes, syncs, or
modifies any configuration file.

It scans the host and reports which MCP-capable LLM platforms are installed,
using two complementary strategies:

- **Binary-first** (e.g. `claude`, `opencode`, `copilot`, `codex`): the
  platform is reported as installed when its canonical CLI is found on the
  process `PATH`. The CLI never spawns subprocesses; executable discovery is a
  pure filesystem scan that respects POSIX executable bits, Windows
  `PATHEXT`, and WSL-visible `.exe` entries.
- **Marker-only** (no supported agent currently uses this strategy). The platform
  would be reported as installed when a known config or extension-storage path is
  present.

For every platform the report includes three orthogonal signals:

- `installed` — the platform app/CLI is on this machine.
- `mcpConfigured` — the user has populated the expected MCP section in the
  platform's config file (parser-backed for JSON, JSONC, and TOML formats).
- `mcpSupport` — whether the platform has a known MCP client surface
  (`supported`, `unsupported`, or `unknown`).

Additional surface area:

- **Stale config** is reported via `orphanedMcpLocations`: an MCP config file
  is present for a platform that is not currently installed. Stale config alone
  never implies install.
- **Unsupported tools** are surfaced as installed inventory entries with
  `mcpSupport: unsupported` and `mcpConfigured: false`, so you can see them
  without being misled into expecting MCP sync to work. (No supported agent
  currently falls into this category.)

### Usage

```bash
# Print installed platforms, configured/unsupported/orphaned sections
overture detect

# Machine-readable: full 4-platform inventory with all additive fields
overture detect --json

# Print the resolved user-level overture config (XDG-aware)
overture config show

# Print usage and exit 0

overture detect --help
overture --help
overture help
```

The human-readable output has three sections that appear only when relevant:
"Detected MCP-capable platforms", "Installed tools without MCP support
(inventory)", and "Orphaned MCP configurations (no platform installed)". No
ANSI color is emitted; the output is plain text suitable for piping.

The JSON output is the full inventory: all 4 platform entries, including
those not installed, with flat additive fields (`detectionStrategy`,
`mcpSupport`, `executableNames`, `matchedExecutables`, `mcpConfigured`,
`matchedMcpLocations`, `orphanedMcpLocations`, `reasonCode`).

`detect` will not write to or modify any of the files it inspects, and it makes no writes anywhere.

## The `scan` command

`overture scan` is a **read-only** inspection of the relationship between the
canonical user-level `overture.jsonc` config and each installed agent's MCP
server configuration. Like `detect`, it never writes, syncs, or modifies any
configuration file — it only reports what it sees.

The command exposes the scan matrix built by the `@overture/scan-matrix`
package: the four-agent registry (claude-code, opencode, github-copilot-cli,
openai-codex) is walked in canonical order, each agent's MCP config is read
and normalized into canonical server entries, and the resulting matrix is
classified into pickable conflicts and hard refuses. A future bootstrap or
apply command will consume this matrix; today it is the first implementation
of the vision's Read behavior.

### Usage

```bash
# Print a human-readable summary (default summary shape)
overture scan

# Machine-readable: full scan matrix + conflict classification as JSON
overture scan --json

# Print usage and exit 0
overture scan --help
```

### Default summary shape

The no-flag path emits the C2 detailed report: a plain-text, sectioned view of
what the scan matrix found. It keeps the same read-only behavior, but instead
of a five-line summary it renders seven headings and their matching tables or
notes:

- `Agents`
- `Aligned servers`
- `Missing from agents`
- `Agent-only servers`
- `Pickable conflicts`
- `Hard refuses`
- `Parse errors`

Example shape:

```
Agents
...
Aligned servers
...
Missing from agents
...
Agent-only servers
...
Pickable conflicts
...
Hard refuses
...
Parse errors
...
```

When `N === 0` an additional install-suggestion block is appended that names
the four supported CLIs and the host OSes overture runs on. The summary line
becomes `Scan completed with blocking issues.` when the exit code is `1`; the
JSON pointer line is always emitted last so terminal users always know where
to go next. No ANSI color is emitted; the output is plain text suitable for
piping.

### JSON output shape

`overture scan --json` emits exactly two top-level keys (no version envelope,
no `generatedAt`, no `duration`):

```json
{
  "matrix": {
    "canonicalState": "absent",
    "canonicalProfileName": null,
    "canonicalIntent": {},
    "agents": [
      /* AgentSnapshot[] */
    ],
    "rows": [
      /* ServerStatusRow[] */
    ]
  },
  "conflicts": {
    "pickable": [
      /* PickableConflict[] */
    ],
    "hardRefuses": [
      /* HardRefuseConflict[] */
    ]
  }
}
```

- `matrix.canonicalState` is one of `absent` (no config written),
  `ready` (config + profile resolved), or `invalid-profile` (config
  present but default profile missing).
- `matrix.canonicalIntent` is `{}` when the user has not written a canonical
  config; pre-canonical users still get a meaningful inventory scan.
- `matrix.agents` is the four-agent registry in canonical order, regardless
  of how many are installed.
- `matrix.rows` is the per-server status classification (`aligned`,
  `missing-from-agent`, `extra-in-agent`, `different-settings`,
  `shape-conflict`, `parse-error`, `unsupported-agent`, `not-installed`).
- `conflicts.pickable` is populated only when canonical intent is absent:
  one entry per server-name group with at least two non-equal normalized
  candidates.
- `conflicts.hardRefuses` covers parse errors, shape conflicts, canonical
  settings drift, and same-name groups spanning both `stdio` and `remote`
  transports.

### Exit codes

| Exit code | Meaning                                                                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`       | Scan ran cleanly. No `invalid-profile` state, no `hardRefuses`. The "no agents installed" case also returns `0` because an empty inventory is a valid scan result, not an error.                                |
| `1`       | Scan ran but produced a blocking state: `matrix.canonicalState === 'invalid-profile'` OR `conflicts.hardRefuses.length > 0`. The JSON envelope is still written to stdout so consumers can inspect what failed. |
| `2`       | Usage error (unknown flag) or pre-model orchestration failure (canonical config parse / validation error, unexpected thrown error). No scan matrix is emitted to stdout; the message goes to stderr.            |

`scan` will not write to or modify any of the files it inspects, and it makes no writes anywhere.

## The `bootstrap` command

`overture bootstrap` is a **one-time setup** command: it produces the
canonical user-level `overture.jsonc` config from the agents' current MCP
server inventories and writes it to the resolved XDG path on success.

D1 is the **planner** phase of bootstrap. D2 is the **interactive conflict
prompt** phase: it walks the user through pickable conflicts one at a time
and applies the chosen candidate or `skip` in memory. D3 adds the
**write** phase: when the no-flag interactive run completes with no hard
refuses/blockers remaining, it writes the canonical `overture.jsonc`.

### Usage

```bash
# D3 one-time setup: walks pickable conflicts one at a time, then writes the
# canonical `overture.jsonc` to the resolved XDG path on success. Prints
# `Wrote config: <absolute path>` on stdout. Does NOT modify any agent config.
overture bootstrap

# Non-interactive human-readable preview of the proposed canonical config.
# Does NOT write any file.
overture bootstrap --dry-run

# Machine-readable: full proposal + conflicts + blockers. Does NOT write.
overture bootstrap --dry-run --json

# Print usage and exit 0
overture bootstrap --help
```

The no-flag `overture bootstrap` is the D3 one-time setup. It walks the user
through pickable conflicts one at a time, applies the chosen candidate or
`skip`, and on success writes the canonical `overture.jsonc` to the
resolved XDG path, printing `Wrote config: <absolute path>` on stdout. Use
`overture bootstrap --dry-run` for a non-interactive preview that does NOT
write any file. The no-flag path exits `2` when stdin is not a TTY (hint:
`Run overture bootstrap --dry-run for a non-interactive preview.`).

### Default summary shape

The no-`--json` paths emit plain-text, sectioned previews. The no-flag
interactive run writes the canonical `overture.jsonc` and prints
`Wrote config: <absolute path>` on stdout; the `--dry-run` path emits the
preview only and does NOT write any file.

- `Bootstrap proposal (dry-run)` (heading) — `--dry-run` only
- `Bootstrap proposal` (heading) — no-flag interactive run
- `Config path:` — the resolved XDG `overture.jsonc` path
- `Proposal status:` — `ready` or `blocked`
- `Target agents:` — comma-separated agent ids
- `Adopted servers:` — count + one indented bullet per adopted server
- `Pickable conflicts:` — count + bullet per pickable conflict
- `Hard refuses:` — count + bullet per hard refuse
- `Blockers:` — count + bullet per blocker (e.g. `no-readable-agents`)
- Footer (no-flag, success): `Wrote config: <absolute path>`
- Footer (`--dry-run`): `No files were written.` and `Run "overture bootstrap --dry-run --json" for machine-readable details.`

No ANSI color is emitted; the output is plain text suitable for piping.
Server details (env, headers, args) are never rendered; only redacted
fingerprints.

### JSON output shape

`overture bootstrap --dry-run --json` emits exactly three top-level keys:

```json
{
  "proposal": {
    "status": "ready | blocked",
    "configPath": "/absolute/path/to/overture.jsonc",
    "config": { "version": 1, "settings": {}, "profiles": {} },
    "adoptedServers": [
      {
        "name": "filesystem",
        "source": "single-agent | all-agents-equal",
        "agentIds": ["claude-code"]
      }
    ],
    "targetAgents": ["claude-code"]
  },
  "conflicts": {
    "pickable": [],
    "hardRefuses": []
  },
  "blockers": []
}
```

### Exit codes

| Exit code | Meaning                                                                                                                                                                                                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`       | `--help`; `--dry-run [--json]` proposal status `ready`; or no-flag interactive run with no hard refuses/blockers remaining (writes the canonical config).                                                                                                                                                                        |
| `1`       | Dry-run proposal emitted but status `blocked` (pickables, hard refuses, no readable agents, or existing valid config), OR no-flag interactive run whose plan is still blocked (hard refuses / blockers).                                                                                                                         |
| `2`       | Usage error (unknown flag), invalid flag combination (`--json` without `--dry-run`), invalid/parse-error existing canonical config, non-TTY no-flag run with at least one pickable conflict (suggests rerunning with `overture bootstrap --dry-run`), user abort during the interactive prompt, or unexpected pre-model failure. |

`bootstrap --dry-run` will not write to or modify any of the files it
inspects, and it makes no writes anywhere. D3 writes the canonical config on
success;
D4/E/F are future work.

## Repository layout

```
overture/
├── apps/
│   └── cli/              # The `@jander99/overture` CLI (entry point: src/main.ts)
├── packages/
│   ├── os/               # `@overture/os`: cross-platform OS detection
│   ├── agents/           # `@overture/agents`: per-agent MCP registry and parsers
│   └── config/           # `@overture/config`: user-level config loading and schema
├── docs/
│   ├── coding-platform-mcp-configurations.md
│   ├── overture-config.md
│   ├── overture-vision.md
│   ├── overture-implementation-slices.md
│   └── publishing.md
├── nx.json               # NX workspace configuration
└── package.json          # Yarn 4 workspaces root
```

The workspace is a Yarn 4 monorepo orchestrated by NX 22.

## Build & execute

The CLI lives in `apps/cli`. It is built with the `@nx/esbuild` executor and
shipped as a CommonJS Node bundle.

### Run in dev (one-shot)

```bash
yarn nx serve @jander99/overture
```

This builds the project and runs the output through Node.

### Build only

```bash
yarn nx build @jander99/overture
# Output: apps/cli/dist/main.js
```

### Test

```bash
yarn nx test @jander99/overture
```

### Make `overture` runnable as `npx @jander99/overture` locally

The CLI exposes a `bin` entry so you can run it via
`npx @jander99/overture` (or `overture` after `npm link`) from anywhere on
your machine without waiting for the first publish. The workflow is:

```bash
# 1. Build and create a global symlink
yarn nx run @jander99/overture:link

# 2. Run it
npx @jander99/overture
# or simply
overture

# 3. When you're done, remove the global symlink
yarn nx run @jander99/overture:unlink
```

The `link` script in `apps/cli/package.json` wraps both steps:

```json
{
  "scripts": {
    "link": "yarn nx build @jander99/overture --skip-nx-cache && npm link",
    "unlink": "npm unlink -g @jander99/overture"
  }
}
```

After editing `apps/cli/src/main.ts`, rebuild and re-link:

```bash
yarn nx run @jander99/overture:link
```

### Build configuration notes

`apps/cli/package.json` builds with `bundle: true` and `thirdParty: true` so
esbuild inlines `jsonc-parser` into the bundle. `smol-toml` is loaded at
runtime via `createRequire` and is declared as a `dependency` so `npm install`
sets up the lookup path for npm consumers. The shebang defined in
`src/main.ts` is preserved by esbuild's `bundle: true` option. The compiled
`dist/main.js` is what `npm link` (and `npx`) register as the `overture`
command.

## Requirements

- Node.js >= 24 (the CLI targets the Node 24 LTS baseline; matches
  `@types/node` after CI is bumped off Node 20)
- Yarn 4 (this repo uses Corepack via `.yarnrc.yml`)
- A POSIX shell for the `npm link` workflow
