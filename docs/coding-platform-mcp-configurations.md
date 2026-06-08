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
per-platform detection data that `overture` consumes. The CLI stores
that data as one file per agent under
`apps/cli/src/platforms/agents/<id>.ts`, then aggregates them in
`apps/cli/src/platforms/agents/index.ts` (the `platformRegistry`
export in `apps/cli/src/platforms/registry.ts` is now a re-export
of that aggregate). To wire a new platform into the CLI:

1. Add a "## <Platform name>" section to the catalog below with the
   platform's installation markers, MCP config locations, executable
   names, detection strategy, and any platform-specific format notes.
2. Create `apps/cli/src/platforms/agents/<id>.ts` in the repository.
   The file exports a single `const <camelCaseId>: AgentDefinition`
   whose body is the platform's data plus a trailing
   `mcp: notImplementedMcpHandlers('<id>')` placeholder. See
   `AGENTS.md` (search for "Adding a new MCP agent") for the full
   step-by-step, including the `continue` reserved-keyword edge case.
3. Wire the new agent into `apps/cli/src/platforms/agents/index.ts`
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
command -v cursor
command -v code
command -v windsurf
command -v zed
command -v aider
```

### IDE and extension checks

For VS Code-family tools, the binary alone only proves that the editor is
installed. MCP capability may come from the editor itself, GitHub Copilot Chat,
or an extension such as Claude Code, Cline, Roo Code, or Continue.

Useful probes:

```sh
code --list-extensions
cursor --list-extensions
windsurf --list-extensions
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
| `code`     | `/mnt/c/Program Files/Microsoft VS Code/bin/code` |
| `codex`    | `/home/jeff/.nvm/versions/node/v25.2.1/bin/codex` |
| `aider`    | `/home/jeff/.local/bin/aider`                     |

The following MCP-related config files were present:

| File                                  | Platform interpretation                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `~/.claude.json`                      | Claude Code local/user MCP scopes                                                                                    |
| `.mcp.json`                           | Claude Code project MCP config convention                                                                            |
| `opencode.json`                       | OpenCode project config with top-level `mcp`                                                                         |
| `.github/mcp.json`                    | GitHub Copilot repository/workspace MCP convention; verify against current Copilot CLI behavior before relying on it |
| `~/.codeium/windsurf/mcp_config.json` | Windsurf MCP config                                                                                                  |

The VS Code extension list included `anthropic.claude-code`, but no Cline, Roo,
Continue, or Copilot extension was visible in the checked output.

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

### Claude Desktop

Detection:

- macOS app bundle or Windows application install.
- Config file existence is usually the most reliable MCP-specific signal.

Configuration locations:

| OS      | Location                                                          |
| ------- | ----------------------------------------------------------------- |
| macOS   | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json`                     |
| Linux   | No stable first-party desktop path was confirmed during research  |

Format:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me"]
    }
  }
}
```

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

### GitHub Copilot in VS Code / Copilot Chat

Detection:

- Executable/editor: `code`, `cursor`, or another VS Code-compatible host.
- VS Code extension checks may include GitHub Copilot and GitHub Copilot Chat.
- Workspace config: `.vscode/mcp.json`.

Configuration locations:

| Scope        | Location                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Workspace    | `<workspace>/.vscode/mcp.json`                                                                          |
| User/profile | Open with VS Code command `MCP: Open User Configuration`; stored in the active profile/user config area |

Format uses top-level `servers`, not `mcpServers`:

```json
{
  "servers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp"
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@microsoft/mcp-server-playwright"]
    }
  }
}
```

VS Code MCP configs may also use `inputs` and `requestInit.headers` for secrets
and request customization.

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

### GitHub Copilot coding agent / cloud agent

Detection:

- GitHub repository settings, not a local executable.
- Requires repository access and Copilot coding/cloud agent configuration access.

Configuration location:

| Scope      | Location                                                                          |
| ---------- | --------------------------------------------------------------------------------- |
| Repository | GitHub.com repository settings under Copilot coding/cloud agent MCP configuration |

Format:

```json
{
  "mcpServers": {
    "repo-server": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "TOKEN": "${COPILOT_MCP_TOKEN}"
      },
      "tools": ["memory_create_entities", "memory_search_nodes"]
    }
  }
}
```

Notes:

- Tool allowlists are important for cloud agent configurations.
- Secrets and variables used by Copilot MCP config must use the
  `COPILOT_MCP_` prefix.
- GitHub's built-in MCP server is available by default in cloud contexts.

### Cursor

Detection:

- Executable: `cursor`
- Config files: `~/.cursor/mcp.json`, `<project>/.cursor/mcp.json`
- UI: Cursor settings for MCP / Tools.

Configuration locations:

| Scope       | Location                     |
| ----------- | ---------------------------- |
| Project     | `<project>/.cursor/mcp.json` |
| User global | `~/.cursor/mcp.json`         |

Format:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {}
    }
  }
}
```

Remote servers use the same `mcpServers` map with URL/transport fields accepted
by the current Cursor release. Treat project config as higher priority than
global config when both define the same server.

### Windsurf

Detection:

- Executable: `windsurf`
- Config file: `~/.codeium/windsurf/mcp_config.json`
- UI: Windsurf Settings > Advanced Settings / Cascade MCP configuration.

Configuration location:

| Scope       | Location                              |
| ----------- | ------------------------------------- |
| User global | `~/.codeium/windsurf/mcp_config.json` |

Format follows the Claude Desktop-style `mcpServers` schema:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

Notes:

- Windsurf documentation describes stdio and remote/SSE-style server
  configuration. Remote examples may use `url` or `serverUrl` depending on doc
  version.
- Windsurf currently focuses on tools, with documented limits on exposed tools.

### Cline

Detection:

- VS Code extension. Check `code --list-extensions` for Cline extension IDs.
- `~/.cline/mcp.json` or legacy extension global-storage config file existence
  is an MCP-specific signal.

Configuration locations:

| Scope                      | Common location                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Current Cline user config  | `~/.cline/mcp.json`                                                                                             |
| Legacy Cline CLI/user data | `~/.cline/data/settings/cline_mcp_settings.json`                                                                |
| Legacy VS Code on Linux    | `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`                     |
| Legacy VS Code on macOS    | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| Legacy VS Code on Windows  | `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`                     |

Format:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {},
      "disabled": false
    }
  }
}
```

Caveat: Cline's documented path has changed over time. Prefer
`~/.cline/mcp.json` for current Cline docs, but keep the older
`cline_mcp_settings.json` probes for backward compatibility. Extension publisher
IDs and global-storage paths can vary by fork, editor, or extension generation.

### Roo Code

Detection:

- VS Code extension. Check `code --list-extensions` for Roo Code extension IDs.
- Project file: `.roo/mcp.json`.

Configuration locations:

| Scope       | Location                                                                 |
| ----------- | ------------------------------------------------------------------------ |
| Project     | `<project>/.roo/mcp.json`                                                |
| User global | Roo Code global `mcp_settings.json`, opened from the Roo MCP settings UI |

Format:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "cwd": "/home/me/project",
      "env": {},
      "alwaysAllow": [],
      "disabled": false,
      "timeout": 60,
      "watchPaths": [],
      "disabledTools": []
    }
  }
}
```

Remote format:

```json
{
  "mcpServers": {
    "remote-server": {
      "type": "streamable-http",
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${MCP_TOKEN}"
      }
    }
  }
}
```

Project config takes precedence over global config when both define the same
server name.

### Continue

Detection:

- VS Code or JetBrains extension.
- Workspace directory: `.continue/mcpServers/`.

Configuration locations:

| Scope                   | Location                                  |
| ----------------------- | ----------------------------------------- |
| Workspace YAML          | `<workspace>/.continue/mcpServers/*.yaml` |
| Workspace imported JSON | `<workspace>/.continue/mcpServers/*.json` |

Continue can import JSON files copied from supported clients into this directory;
`<workspace>/.continue/mcpServers/mcp.json` is a common imported filename.

Standalone YAML format:

```yaml
name: playwright-mcp
version: 0.0.1
schema: v1
mcpServers:
  - name: playwright
    command: npx
    args:
      - -y
      - '@microsoft/mcp-server-playwright'
```

Remote YAML format:

```yaml
name: remote-mcp
version: 0.0.1
schema: v1
mcpServers:
  - name: remote-server
    type: streamable-http
    url: https://mcp.example.com/mcp
    env:
      TOKEN: ${{ secrets.MCP_TOKEN }}
```

Continue can also copy JSON MCP files from clients such as Claude, Cursor, and
Cline into `.continue/mcpServers/`.

### Zed

Detection:

- Executable: `zed`
- Settings file opened through the `zed: open settings` command.

Configuration locations:

| Scope           | Location                                                             |
| --------------- | -------------------------------------------------------------------- |
| User settings   | Zed `settings.json`; commonly `~/.config/zed/settings.json` on Linux |
| Folder settings | `<project>/.zed/settings.json`                                       |

Format uses top-level `context_servers`:

```json
{
  "context_servers": {
    "local-mcp-server": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {}
    },
    "remote-mcp-server": {
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${MCP_TOKEN}"
      }
    }
  }
}
```

Notes:

- Zed refers to MCP servers as context servers.
- Zed supports MCP tools and prompts.
- Zed can forward configured MCP servers to external agents over ACP.

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

### Aider

Detection:

- Executable: `aider`
- Config file: `.aider.conf.yml` for Aider itself.

MCP status:

- A stable first-party MCP client configuration path was not confirmed during
  research.
- MCP support appeared in issues and pull requests, not in a stable documented
  configuration surface.

Recommendation: enumerate Aider as installed when `aider` is on PATH, but place
it in a watchlist or “no stable first-party MCP config found” bucket until its
current release docs confirm MCP client support.

## Adjacent: AgentSkills / `npx skills`

AgentSkills discovery is adjacent to this guide but not the same configuration
surface. `npx skills`-style detection can inspire platform enumeration, but MCP
server configuration should be modeled separately because MCP clients read
client-specific files such as `.mcp.json`, `opencode.json`, `.vscode/mcp.json`,
or `~/.codex/config.toml`.

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
  | 'claude-code'
  | 'claude-desktop'
  | 'opencode'
  | 'github-copilot-vscode'
  | 'github-copilot-cli'
  | 'github-copilot-cloud-agent'
  | 'cursor'
  | 'windsurf'
  | 'cline'
  | 'roo-code'
  | 'continue'
  | 'zed'
  | 'openai-codex'
  | 'aider';

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
finding `.vscode/mcp.json` means VS Code: has a known MCP config surface, but
MCP support should remain unconfirmed until the file is actually read and
validated.

## Source links

- Model Context Protocol documentation: <https://modelcontextprotocol.io/>
- Claude Code MCP docs: <https://docs.anthropic.com/en/docs/claude-code/mcp>
- OpenCode MCP docs: <https://opencode.ai/docs/mcp-servers/>
- OpenCode config docs: <https://opencode.ai/docs/config/>
- GitHub Copilot MCP docs: <https://docs.github.com/en/copilot>
- VS Code MCP docs: <https://code.visualstudio.com/docs/agent-customization/mcp-servers>
- VS Code MCP configuration reference: <https://code.visualstudio.com/docs/copilot/reference/mcp-configuration>
- Windsurf MCP docs: <https://docs.windsurf.com/windsurf/cascade/mcp>
- Cline MCP configuration docs: <https://docs.cline.bot/mcp/adding-and-configuring-servers>
- Roo Code MCP docs: <https://docs.roocode.com/features/mcp/using-mcp-in-roo>
- Continue MCP docs: <https://docs.continue.dev/customize/deep-dives/mcp>
- Zed MCP docs: <https://zed.dev/docs/ai/mcp>
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

- **Binary-first** (e.g. Claude Code, OpenCode, OpenAI Codex, GitHub Copilot
  CLI, Windsurf, Aider). The platform is installed when its canonical CLI is
  found on the process `PATH`. Discovery is a pure filesystem scan — no
  `child_process`, no `which`, no shell — that respects POSIX executable
  bits, Windows `PATHEXT`, and WSL-visible `.exe` entries.
- **Marker-only** (e.g. Claude Desktop, Cursor, Zed, Cline, Roo Code, Continue,
  GitHub Copilot VS Code, GitHub Copilot Cloud Agent). The platform is
  installed when a known config file, extension-storage path, or
  settings directory is present.

`detect` is **read-only**: it inspects configuration files but never writes,
modifies, or syncs them. Future commands may add writing/sync surfaces, but
this document and the CLI's current behavior only cover the inventory side.

### Stale-config false positive guardrail

A configuration file alone is not evidence of installation. If a user
uninstalls a platform but the user's `~/.codeium/windsurf/mcp_config.json`
(or equivalent) remains on disk, the file is reported as an **orphaned MCP
configuration** rather than as evidence the platform is installed. The
registry entry for Windsurf deliberately has zero `installMarkers` and lists
`mcpServers` only as an `mcpLocation`; the platform is binary-first on the
`windsurf` CLI.

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
