# Overture config (`overture.jsonc`)

> The user-level, declarative source of truth for `overture`. Authored
> as JSONC (tolerates comments and trailing commas), validated by Zod
> at load time, and rendered to humans via `overture config show`.

## Support matrix

| Platform | Status    | Path layout                                    |
| -------- | --------- | ---------------------------------------------- |
| Linux    | Supported | XDG (same as below)                            |
| WSL1     | Supported | XDG (treats as Linux)                          |
| WSL2     | Supported | XDG (treats as Linux)                          |
| macOS    | Supported | XDG (same as Linux; **not** `~/Library/...`)   |
| Windows  | Not in v1 | — (the CLI prints a clean message and exits 0) |

WSL1/WSL2 are indistinguishable from native Linux at the XDG resolver
level. Cross-filesystem sync (WSL Linux paths ↔ Windows-side agents)
is out of scope for v1.

## File locations

All paths are XDG-style, identical on Linux (incl. WSL) and macOS.
There is no platform-specific branch.

| Purpose | Variable             | Default                             |
| ------- | -------------------- | ----------------------------------- |
| Config  | `${XDG_CONFIG_HOME}` | `~/.config/overture/overture.jsonc` |
| State   | `${XDG_STATE_HOME}`  | `~/.local/state/overture/`          |
| Cache   | `${XDG_CACHE_HOME}`  | `~/.cache/overture/`                |

`overture` reads **only the user-level config** in v1. Project-level
configs (`./.overture.jsonc`) are explicitly out of scope. The schema
file is the only artifact the user is expected to author; the state
and cache files are machine-managed.

Verify the resolved locations on your host:

```bash
overture config show
```

When the config does not exist, the command prints the resolved
`configFile` and `configDir` paths it would have used.

## Schema (v1)

The full Zod schema lives at
[`packages/config/src/schema.ts`](../packages/config/src/schema.ts).
The `version` field is a literal `1` — future schema versions will
live in a sibling `OvertureConfigV2Schema` and dispatch on the same
field.

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/jander99/overture/main/schemas/overture.config.schema.json",
  "version": 1,

  "settings": {
    "defaultProfile": "default", // optional, default "default"
    "dryRunByDefault": true, // optional, default true
    "backupBeforeWrite": true, // optional, default true
    "conflictPolicy": "refuse", // optional: "refuse" | "prompt" | "overwrite"
  },

  "profiles": {
    "default": {
      "mcpServers": {
        // mcpServers key is canonical (matches Claude Code / OpenCode / etc.)
      },

      "sync": {
        "targets": ["claude-code", "opencode", "github-copilot-cli"],

        "disabledServers": [
          // global exclusions: server names that are never synced anywhere
        ],
      },

      "skills": [
        {
          "source": "vercel-labs/agent-skills",
          "include": ["frontend-design", "skill-creator"],
        },
        {
          "source": "mattpocock/skills",
          "include": ["grill-me", "tdd"],
        },
      ],
    },
  },
}
```

### MCP server entries

Two transport kinds, modeled as a discriminated union on `type`:

```jsonc
// Local server (spawns a child process)
"filesystem": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home"],
  "env": { "MY_VAR": "${MY_VAR}" }   // optional; ${VAR} is preserved literally
}

// Remote server (HTTP/SSE)
"context7-remote": {
  "type": "remote",
  "url": "https://mcp.context7.com/mcp",
  "headers": { "Authorization": "Bearer ${CONTEXT7_API_KEY}" }
}
```

`command` and `args` are required for `stdio`; `url` is required for
`remote`. The schema rejects entries that violate this.

### Skills

A skill install entry is a `npx skills add` invocation pre-baked:

```jsonc
{
  "source": "vercel-labs/agent-skills",
  "include": ["frontend-design", "skill-creator"],
}
```

This expands to:

```bash
npx skills add vercel-labs/agent-skills --skill frontend-design --skill skill-creator -g -y
```

`source` must be in `owner/repo` form. Full URLs and local paths are
intentionally disallowed because the first-class install flow is the
`npx skills add` shim. `include` is required and must contain at
least one skill name — installing "the whole repo" is too broad to
be a stable config target.

### Settings

All settings are optional and have defaults. `settings` itself is
optional.

| Key                 | Type                                    | Default     |
| ------------------- | --------------------------------------- | ----------- |
| `defaultProfile`    | string (must be a key under `profiles`) | `"default"` |
| `dryRunByDefault`   | boolean                                 | `true`      |
| `backupBeforeWrite` | boolean                                 | `true`      |
| `conflictPolicy`    | `"refuse" \| "prompt" \| "overwrite"`   | `"refuse"`  |

## Environment variables

| Variable          | Effect                                                 |
| ----------------- | ------------------------------------------------------ |
| `XDG_CONFIG_HOME` | Overrides the base for the user config file.           |
| `XDG_STATE_HOME`  | Overrides the base for state files.                    |
| `XDG_CACHE_HOME`  | Overrides the base for cache files.                    |
| `HOME`            | Used as the fallback for the XDG bases (linux/darwin). |

## What is NOT in the global config (v1)

By deliberate design, the following items live in **state** or
**cache** files (machine-managed, do not edit), or are absent from
v1 entirely:

- Per-agent overrides (we dropped the per-target override section
  during design; differences stay in the per-agent writer layer).
- Detected agent paths and parsed server lists (read on demand from
  the agents' own config files).
- Last sync timestamps, hashes of target files, backups, conflict
  records.
- Convergence / bidirectional sync (out of scope; `overture merge`
  is a future addition).
- Project-level / per-repo config (explicitly out of scope for v1).

## Design principles

1. **Declarative, not procedural.** The config describes _what the
   user wants_; the implementation decides _how to get there_ per
   target agent.
2. **No agent-specific quirks at the top level.** The schema uses the
   dominant `mcpServers` shape; per-agent translation lives in the
   writer layer (`packages/agents/src/<id>.ts`).
3. **Skills are installer coordinates, not local skill names.** The
   schema records where to _install from_, not what's already on
   disk. Local skill enumeration is `npx skills list`'s job.
4. **State lives elsewhere.** Anything that changes at runtime
   belongs in `${XDG_STATE_HOME}/overture/`, not in the config.
5. **JSONC, not JSON.** The file name advertises that comments and
   trailing commas are tolerated; the loader uses `jsonc-parser`.

## Examples

### Minimal

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/jander99/overture/main/schemas/overture.config.schema.json",
  "version": 1,
  "profiles": {
    "default": {
      "mcpServers": {},
      "sync": { "targets": [] },
      "skills": [],
    },
  },
}
```

### With MCP servers, sync, and skills

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/jander99/overture/main/schemas/overture.config.schema.json",
  "version": 1,
  "settings": {
    "conflictPolicy": "prompt",
    "dryRunByDefault": true,
  },
  "profiles": {
    "default": {
      "mcpServers": {
        "filesystem": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home"],
        },
        "context7": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@upstash/context7-mcp@latest"],
          "env": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" },
        },
      },
      "sync": {
        "targets": ["claude-code", "opencode", "github-copilot-cli"],
      },
      "skills": [
        {
          "source": "vercel-labs/agent-skills",
          "include": ["frontend-design", "skill-creator"],
        },
      ],
    },
  },
}
```

## Verifying

```bash
# Show the resolved config location and contents
overture config show

# (When the file does not exist, the command prints the path it would
#  have used, so you can `mkdir -p` and create one.)
```

The loader accepts JSONC: line comments (`// ...`) and trailing commas
are tolerated. Unknown top-level keys are rejected — the file must
match the schema exactly.

## See also

- [`coding-platform-mcp-configurations.md`](./coding-platform-mcp-configurations.md)
  — the per-platform catalog that drives detection.
- [`packages/config/src/schema.ts`](../packages/config/src/schema.ts)
  — the canonical Zod schema.
- [`packages/config/src/paths.ts`](../packages/config/src/paths.ts)
  — the XDG path resolver.
