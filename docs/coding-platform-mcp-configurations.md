---
title: Coding Platform MCP Configuration Locations
created: 2026-06-05T23:02:38Z
last_modified: 2026-06-05T23:02:38Z
author: Jeff Anderson
type: documentation
tags: [mcp, coding-agents, configuration, discovery]
---

# Coding Platform MCP Configuration Locations

This guide catalogs coding CLIs, IDEs, and agentic platforms that can act as MCP
clients. It focuses on two implementation questions:

1. How can an enumerator detect that the platform is installed?
2. Where does that platform store MCP server configuration, and what shape does
   that configuration take?

Existing Markdown in this repository was treated as out of date while building
this guide. The platform details below are based on current platform docs,
configuration files found on this host, and local executable/config probes.

## Cross-platform conventions

Most MCP clients follow the original Claude Desktop JSON convention:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home"],
      "env": {
        "TOKEN": "${TOKEN}"
      }
    }
  }
}
```

That convention is common, but it is not universal. A detector should not infer
support solely from a file named `mcp.json`; it should parse the platform-specific
top-level key and transport fields.

| Top-level shape                      | Platforms                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `mcpServers` JSON object             | Claude Desktop, Claude Code project config, Cursor, Windsurf, Cline, Roo Code, GitHub Copilot CLI/cloud |
| `servers` JSON object                | VS Code / GitHub Copilot Chat MCP                                                                       |
| `mcp` JSON object                    | OpenCode                                                                                                |
| `context_servers` JSON object        | Zed                                                                                                     |
| YAML document with `mcpServers` list | Continue                                                                                                |
| TOML `[mcp_servers.<name>]` tables   | OpenAI Codex                                                                                            |

Common transport fields:

- Local stdio servers usually use `command`, `args`, and optional `env`.
- Remote HTTP servers usually use `type`, `url`, optional `headers`, and
  optional OAuth or token references.
- Host applications decide which transport names they accept. Common values are
  `stdio`, `local`, `http`, `streamable-http`, `sse`, and `remote`.

## Adding a new platform

The catalog in this document is the **source of truth** for the
per-platform detection data that `overture` consumes. The
`@overture/agents` library (in `packages/agents/`) stores that data
as one file per agent under `packages/agents/src/<id>.ts`, then
aggregates them in `packages/agents/src/index.ts` (the
`platformRegistry` export in `apps/cli/src/platforms/registry.ts` is
a re-export of that aggregate). To wire a new platform into the
CLI:

1. Add a "## <Platform name>" section to the catalog below with the
   platform's installation markers, MCP config locations, executable
   names, detection strategy, and any platform-specific format notes.
2. Create `packages/agents/src/<id>.ts` in the repository.
   The file exports a single `const <camelCaseId>: AgentDefinition`
   whose body is the platform's data plus a trailing
   `mcp: notImplementedMcpHandlers('<id>')` placeholder. See
   `AGENTS.md` (search for "Adding a new MCP agent") for the full
   step-by-step, including the `continue` reserved-keyword edge case.
3. Wire the new agent into `packages/agents/src/index.ts`
   at the canonical position (the legacy `expectedIds` assertion in
   `apps/cli/src/platforms/registry.spec.ts` pins the index of every
   entry — reordering is a breaking change).
4. Add or extend a regression test under
   `apps/cli/src/platforms/registry.spec.ts` asserting the
   per-agent invariants.

Detectors and writers read this catalog and the static aggregate
together; keep the catalog and the per-agent file in lockstep.

## Detection strategy

A platform enumerator should combine executable checks, extension checks, and
configuration-file checks.

### Executable checks

Use `command -v` or an equivalent PATH lookup for CLI-first platforms:

```sh
command -v claude
command -v opencode
command -v gh
command -v codex
```

### IDE and extension checks

For VS Code-family tools, the binary alone only proves that the editor is
installed. MCP capability may come from the editor itself, GitHub Copilot Chat,
or an extension such as Claude Code.

Useful probes:

```sh
code --list-extensions
```

### Configuration-file checks

Check both global and project-local locations. Project files are especially
important because several platforms support checked-in team MCP configuration.

Suggested probe paths are listed in the catalog below.

## Local snapshot from this host

This machine had the following coding/agentic tools available on PATH during the
research pass:

| Tool       | Path                                              |
| ---------- | ------------------------------------------------- |
| `claude`   | `/home/jeff/.local/bin/claude`                    |
| `opencode` | `/home/linuxbrew/.linuxbrew/bin/opencode`         |
| `gh`       | `/home/linuxbrew/.linuxbrew/bin/gh`               |
| `codex`    | `/home/jeff/.nvm/versions/node/v25.2.1/bin/codex` |

The following MCP-related config files were present:

| File               | Platform interpretation                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `~/.claude.json`   | Claude Code local/user MCP scopes                                                                                    |
| `.mcp.json`        | Claude Code project MCP config convention                                                                            |
| `opencode.json`    | OpenCode project config with top-level `mcp`                                                                         |
| `.github/mcp.json` | GitHub Copilot repository/workspace MCP convention; verify against current Copilot CLI behavior before relying on it |

The VS Code extension list included `anthropic.claude-code`.

## Platform catalog

### Claude Code

Detection:

- Executable: `claude`
- Commands: `claude mcp list`, `claude mcp get <name>`,
  `claude mcp add ...`, `claude mcp remove <name>`
- In-session command: `/mcp`

Configuration locations:

| Scope                 | Location                                                           |
| --------------------- | ------------------------------------------------------------------ |
| Project               | `<project>/.mcp.json`                                              |
| Local project-private | `~/.claude.json`, keyed under the current project                  |
| User global           | `~/.claude.json`                                                   |
| Managed enterprise    | Enterprise-managed policy/configuration, outside normal user files |

Project format:

```json
{
  "mcpServers": {
    "shared-server": {
      "command": "/path/to/server",
      "args": [],
      "env": {}
    }
  }
}
```

Remote HTTP example:

```json
{
  "mcpServers": {
    "remote-server": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${MCP_TOKEN}"
      }
    }
  }
}
```

Notes:

- Claude Code supports local, project, and user scopes.
- `.mcp.json` supports environment expansion such as `${VAR}` and
  `${VAR:-default}` in supported fields.
- Claude Code can import Claude Desktop MCP servers.
- Claude Code can also run as an MCP server via `claude mcp serve`.

### OpenCode

Detection:

- Executable: `opencode`
- Config files: project `opencode.json` / `opencode.jsonc`, with older or
  version-specific references also using `.opencode.json`; global OpenCode
  config usually under XDG config or `~/.opencode.json`, depending on version
- Command: `opencode mcp add`

Configuration locations:

| Scope       | Location                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Project     | `<project>/opencode.json` or `<project>/opencode.jsonc`; check `.opencode.json` for host/version variants |
| User global | `~/.config/opencode/opencode.json` or `~/.opencode.json`; check `.jsonc` variants by version              |

Format uses top-level `mcp`, not `mcpServers`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "my-local-mcp-server": {
      "type": "local",
      "command": ["npx", "-y", "my-mcp-command"],
      "enabled": true,
      "environment": {
        "MY_ENV_VAR": "my_env_var_value"
      }
    }
  }
}
```

Remote format:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "remote-server": {
      "type": "remote",
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer {env:MCP_TOKEN}"
      },
      "enabled": true
    }
  }
}
```

### GitHub Copilot CLI

Detection:

- Executable: `gh`
- Confirm Copilot CLI availability with the installed GitHub CLI extensions or
  current `gh` help output.

Configuration locations:

| Scope                  | Location                                                      |
| ---------------------- | ------------------------------------------------------------- |
| User                   | `~/.copilot/mcp-config.json`; relocatable with `COPILOT_HOME` |
| Interactive management | `/mcp add` inside Copilot CLI                                 |

Format:

```json
{
  "mcpServers": {
    "local-server": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {},
      "tools": ["*"]
    },
    "remote-server": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${MCP_TOKEN}"
      },
      "tools": ["tool_a", "tool_b"]
    }
  }
}
```

Caveat: repository files such as `.github/mcp.json` appear in GitHub/Copilot MCP
workflows and were present in this repository, but current official Copilot CLI
docs identify `~/.copilot/mcp-config.json` as the user config path. Verify the
installed CLI before relying on workspace behavior.

### OpenAI Codex

Detection:

- Executable: `codex`
- Config files: `~/.codex/config.toml`, trusted project `.codex/config.toml`.

Configuration locations:

| Scope           | Location                       |
| --------------- | ------------------------------ |
| User global     | `~/.codex/config.toml`         |
| Trusted project | `<project>/.codex/config.toml` |

Format uses TOML tables:

```toml
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/home"]
enabled = true
```

Remote format:

```toml
[mcp_servers.remote_server]
url = "https://mcp.example.com/mcp"
bearer_token_env_var = "MCP_TOKEN"
enabled = true
```

Other documented options include `env`, `env_vars`, `cwd`,
`startup_timeout_sec`, `tool_timeout_sec`, `required`, `enabled_tools`,
`disabled_tools`, `http_headers`, `env_http_headers`, and OAuth-related fields.

### How `npx skills` detects installed agents

The `vercel-labs/skills` registry keeps a static list of agents in
[`src/agents.ts`](https://github.com/vercel-labs/skills/blob/main/src/agents.ts).
Its `detectInstalledAgents()` helper iterates over that registry and, for each
agent, runs an async filesystem probe (for example, checking whether the
agent's expected config directory exists). All probes are started in parallel
with `Promise.all`, and the results are filtered to keep only the agents whose
markers returned `true`. This pattern is fast and simple, but it conflates
"the agent is installed" with "the agent has a known MCP configuration
surface."

Overture intentionally separates those two concerns. An `InstallMarker`
answers "is this platform present on the machine?" while an `McpLocation`
answers "where does this platform read its MCP server list?" Keeping them
distinct lets Overture report a platform as installed even when no stable MCP
config surface has been documented yet.

## Suggested data model for Overture-style detection

A detector can represent each platform with two separate concepts:
installation evidence and configuration surface.

```ts
type PlatformId =
  type PlatformId =
  | 'claude-code'
  | 'opencode'
  | 'github-copilot-cli'
  | 'openai-codex';

type HostPlatform = 'linux' | 'darwin' | 'win32';
type DetectionConfidence = 'high' | 'medium' | 'low' | 'unsupported';
type MarkerKind = 'file' | 'directory' | 'file-or-directory';
type PathBase = 'home' | 'config' | 'workspace' | 'absolute';
type McpLocationScope =
  | 'project'
  | 'user'
  | 'profile'
  | 'repository'
  | 'managed';
type McpLocationFormat = 'json' | 'jsonc' | 'yaml' | 'toml' | 'web-settings';

interface InstallMarker {
  id: string;
  kind: MarkerKind;
  base: PathBase;
  relativePath: string;
  platforms?: HostPlatform[];
  confidence: DetectionConfidence;
  reason: string;
}

interface McpLocation {
  scope: McpLocationScope;
  base: PathBase;
  relativePath: string;
  platforms?: HostPlatform[];
  format: McpLocationFormat;
  topLevelKey?: string;
  notes?: string;
}
```

v1 Overture detection is filesystem-only and does not perform PATH lookup or
subprocess probing. `executableNames` and `extensionIds` remain useful registry
metadata, but they are not used as runtime detection probes in v1.

A platform is reported as installed when any applicable `InstallMarker` resolves to an existing path of the marker's `kind`; `matchedMarkers` carries the absolute resolved paths and the detector uses the highest-confidence matched marker reason (high > medium > low > unsupported).

Detection should report confidence separately from installation. For example,
finding `<workspace>/.vscode/mcp.json` (or the user-profile
`Code/User/mcp.json` under XDG_CONFIG_HOME) means VS Code: has a known MCP config surface, but
MCP support should remain unconfirmed until the file is actually read and
validated.

## Source links

- Model Context Protocol documentation: <https://modelcontextprotocol.io/>
- Claude Code MCP docs: <https://docs.anthropic.com/en/docs/claude-code/mcp>
- OpenCode MCP docs: <https://opencode.ai/docs/mcp-servers/>
- OpenCode config docs: <https://opencode.ai/docs/config/>
- GitHub Copilot MCP docs: <https://docs.github.com/en/copilot>
- OpenAI Codex configuration docs: <https://developers.openai.com/codex/config>
- OpenAI Codex configuration docs: <https://developers.openai.com/codex/config>
- AgentSkills reference: <https://www.skills.sh/agent>
- `vercel-labs/skills` `detectInstalledAgents` helper: <https://github.com/vercel-labs/skills/blob/main/src/agents.ts>
- `vercel-labs/skills` registry-to-README sync script: <https://github.com/vercel-labs/skills/blob/main/scripts/sync-agents.ts>

## Not Yet Implemented

- PATH lookup or subprocess probing for executable detection.
- Extension ID or registry-based installation checks.
- Reading the contents of MCP configuration files to validate schemas.

## Detection strategy and parser-backed MCP state

`overture detect` uses two complementary strategies:

- **Binary-first** (Claude Code, OpenCode, OpenAI Codex, GitHub Copilot CLI). The platform is installed when its canonical CLI is found on the process `PATH`. Discovery is a pure filesystem scan — no
- **Marker-only** (no agent currently uses this strategy; all four supported agents are binary-first). The platform would be

`detect` is **read-only**: it inspects configuration files but never writes,
modifies, or syncs them. Future commands may add writing/sync surfaces, but
this document and the CLI's current behavior only cover the inventory side.

### Stale-config false positive guardrail

A configuration file alone is not evidence of installation. If a user
uninstalls a platform but a leftover config file remains on disk, the file is reported as an **orphaned MCP configuration** rather than as evidence the platform is installed.

### Parser-backed key requirements

`mcpConfigured` is determined by parsing the configuration file and checking
that the expected top-level key/table is present and non-empty:

- JSON and JSONC files use Microsoft `jsonc-parser` with
  `{ allowTrailingComma: true, disallowComments: false }` so trailing commas
  and `//` / `/* */` comments are tolerated. A UTF-8 BOM (`\uFEFF`) at the
  start of the file is stripped before parsing.
- TOML files use `smol-toml` (loaded via `createRequire` to keep the CJS
  bundle synchronous). A UTF-8 BOM is stripped before parsing.
- Empty files, missing keys, and parse errors all produce
  `mcpConfigured: false` (with `parseError` set when parsing fails).
- Web-settings format and other non-JSON/non-TOML formats are not yet
  parsed and always report `mcpConfigured: false`.

### Reason codes

Each detection result carries a `reasonCode` so consumers can branch on the
_why_ without re-deriving it from the field set. Precedence, first match
wins:

1. `orphaned-mcp-config` — non-empty MCP config, no install evidence.
2. `mcp-configured` — installed, `mcpSupport: supported`, non-empty MCP key.
3. `unsupported-no-mcp-client` — installed, `mcpSupport: unsupported`.
4. `binary-found` — `detectionStrategy: binary-first`, installed,
   `mcpSupport` is not `unsupported`.
5. `marker-found` — `detectionStrategy: marker-only`, installed,
   `mcpSupport` is not `unsupported`.
6. `unsupported-no-local-signal` — `mcpSupport` is `unsupported`/`unknown`,
   no install evidence.
7. `parse-error` — a relevant config file could not be parsed and no
   stronger evidence applies.
8. `not-detected` — none of the above.

### Inventory completeness

The JSON output of `overture detect --json` always contains all 14 platform
entries in registry order, including those not installed, so a UI or
automation can render a complete status grid without needing to know the
list of supported IDs separately. `installed: false` is a first-class
result, not a missing entry.
