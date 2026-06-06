# overture

`overture` is a CLI utility that keeps your MCP (Model Context Protocol) server
configurations in sync across every installed LLM coding platform on your
machine. Define your MCP servers once, and `overture` propagates them to the
configuration files of every detected client — Claude Code, OpenCode, VS Code /
GitHub Copilot, Cursor, Windsurf, Cline, Roo Code, Continue, Codex, Zed, Aider,
and friends.

It is the MCP analog of the "npx skills" workflow: just as `skills` syncs Agent
Skills across coding agents, `overture` syncs MCP servers.

## What it does

- **Detects** which MCP-capable LLM platforms are installed on the host by
  probing executables, IDE extensions, and configuration files.
- **Reads** your canonical MCP server definitions from a single source of
  truth.
- **Writes** equivalent entries into each platform's native configuration
  location, respecting that platform's schema and transport conventions
  (`mcpServers`, `servers`, `mcp`, `context_servers`, YAML lists, TOML
  tables, etc.).
- **Reports** drift, conflicts, and unsupported fields so you can resolve
  them explicitly instead of silently losing configuration.

See [`docs/coding-platform-mcp-configurations.md`](docs/coding-platform-mcp-configurations.md)
for the per-platform catalog that drives detection and writing logic.

## Repository layout

```
overture/
├── apps/
│   └── cli/              # The `overture` CLI (entry point: src/main.ts)
├── docs/
│   └── coding-platform-mcp-configurations.md
├── nx.json               # NX workspace configuration
└── package.json          # Yarn 4 workspaces root
```

The workspace is a Yarn 4 monorepo orchestrated by NX 22. Today only `apps/cli`
exists; additional apps and shared packages will land under `packages/`.

## Build & execute

The CLI lives in `apps/cli`. It is built with the `@nx/esbuild` executor and
shipped as a CommonJS Node bundle.

### Run in dev (one-shot)

```bash
yarn nx serve cli
```

This builds the project and runs the output through Node.

### Build only

```bash
yarn nx build cli
# Output: apps/cli/dist/main.js
```

### Test

```bash
yarn nx test cli
```

### Make `overture` runnable as `npx overture` locally

The CLI exposes a `bin` entry so you can run it via `npx overture` from
anywhere on your machine without publishing to npm. The workflow is:

```bash
# 1. Build and create a global symlink
yarn nx run cli:link

# 2. Run it
npx overture
# or simply
overture

# 3. When you're done, remove the global symlink
yarn nx run cli:unlink
```

The `link` script in `apps/cli/package.json` wraps both steps:

```json
{
  "scripts": {
    "link": "yarn nx build cli && npm link",
    "unlink": "npm unlink -g overture"
  }
}
```

After editing `apps/cli/src/main.ts`, rebuild and re-link:

```bash
yarn nx run cli:link
```

### Build configuration notes

`apps/cli/package.json` builds with `bundle: true` so esbuild preserves the
`#!/usr/bin/env node` shebang defined in `src/main.ts`. The compiled
`dist/main.js` is what `npm link` registers as the `overture` command.

## Requirements

- Node 20+ (matches `@types/node@20.19.9` in this workspace)
- Yarn 4 (this repo uses Corepack via `.yarnrc.yml`)
- A POSIX shell for the `npm link` workflow

## License

TBD
