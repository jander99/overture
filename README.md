# overture

`overture` is a CLI utility that scans your machine for MCP-capable LLM coding
platforms and reports the state of each platform's MCP server configuration.

The currently-shipped commands are `overture detect` (read-only inventory)
and `overture config show` (print the resolved user-level `overture.jsonc`).
No command writes, syncs, or modifies any configuration file.

## Install

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

- **Binary-first** (e.g. `claude`, `opencode`, `codex`, `copilot`, `aider`): the
  platform is reported as installed when its canonical CLI is found on the
  process `PATH`. The CLI never spawns subprocesses; executable discovery is a
  pure filesystem scan that respects POSIX executable bits, Windows
  `PATHEXT`, and WSL-visible `.exe` entries.
- **Marker-only** (e.g. Cursor, Zed, Cline, Roo Code, Continue, GitHub Copilot
  VS Code, GitHub Copilot Cloud Agent): the platform is reported as installed
  when a known config or extension-storage path is present.

For every platform the report includes three orthogonal signals:

- `installed` — the platform app/CLI is on this machine.
- `mcpConfigured` — the user has populated the expected MCP section in the
  platform's config file (parser-backed for JSON, JSONC, and TOML formats).
- `mcpSupport` — whether the platform has a known MCP client surface
  (`supported`, `unsupported`, or `unknown`).

Additional surface area:

- **Stale config** is reported via `orphanedMcpLocations`: an MCP config file
  is present for a platform that is not currently installed (e.g. a leftover
  `~/.codeium/windsurf/mcp_config.json` from a previous Windsurf install).
  Stale config alone never implies install.
- **Unsupported tools** (e.g. Aider has a CLI but no first-party MCP client
  surface in v1) are surfaced as installed inventory entries with
  `mcpSupport: unsupported` and `mcpConfigured: false`, so you can see them
  without being misled into expecting MCP sync to work.

### Usage

```bash
# Print installed platforms, configured/unsupported/orphaned sections
overture detect

# Machine-readable: full 14-platform inventory with all additive fields
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

The JSON output is the full inventory: all 14 platform entries, including
those not installed, with flat additive fields (`detectionStrategy`,
`mcpSupport`, `executableNames`, `matchedExecutables`, `mcpConfigured`,
`matchedMcpLocations`, `orphanedMcpLocations`, `reasonCode`).

`detect` will not write to or modify any of the files it inspects, and it makes no writes anywhere.

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
