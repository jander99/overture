# OpenCode.ai Integration Research

**Date:** 2025-12-18
**Client:** opencode
**Purpose:** Research opencode.ai capabilities and identify Overture integration opportunities

---

## Executive Summary

OpenCode.ai is an open-source AI coding agent with **comprehensive configuration capabilities** that overlap significantly with Claude Code's feature set. Unlike Claude Code, OpenCode supports:

- **AGENTS.md** (equivalent to CLAUDE.md)
- **opencode.json** (comprehensive configuration file)
- **Custom agents, tools, commands, and rules**
- **MCP client support with both local and remote servers**
- **Built-in permissions system**
- **OAuth for remote MCP servers**

**Key Finding:** Overture should extend its multi-platform support to include opencode.json patching, enabling unified MCP configuration across Claude Code AND OpenCode simultaneously.

---

## OpenCode.ai Feature Overview

### 1. Installation & Platforms

**Multiple Installation Methods:**
- Install script: `curl -fsSL https://opencode.ai/install | bash`
- Package managers: npm, Bun, pnpm, Yarn, Homebrew, Paru, Chocolatey, Scoop
- Docker containers
- Binary downloads from GitHub Releases
- IDE extensions (VSCode, desktop app)

**Platforms:**
- Terminal Interface (CLI)
- Desktop Application
- IDE Extension

### 2. Configuration System

#### Configuration File Locations & Precedence

OpenCode uses a **merge-based configuration system** (similar to Overture's design):

| Location | Scope | Precedence |
|----------|-------|------------|
| `~/.config/opencode/opencode.json` | Global | Base |
| `<project>/opencode.json` | Project | Overrides global |
| `OPENCODE_CONFIG` env var | Custom path | Highest |
| `OPENCODE_CONFIG_DIR` env var | Custom directory | Highest |

**Configuration files merge** rather than replace each other (conflicts resolved by later configs).

#### opencode.json Schema

**Full configuration options:**

```json
{
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4",
  "theme": "custom-theme-name",
  "tools": {
    "write": true,
    "bash": true,
    "edit": true,
    "read": true,
    "grep": true,
    "glob": true,
    "list": true,
    "patch": true,
    "todowrite": true,
    "todoread": true,
    "webfetch": true,
    "mymcp_*": false
  },
  "agent": {
    "my-custom-agent": {
      "description": "Agent purpose",
      "mode": "primary" | "subagent" | "all",
      "model": "anthropic/claude-opus-4",
      "temperature": 0.7,
      "max_steps": 50,
      "tools": {},
      "permissions": {},
      "prompt": "path/to/system-prompt.md"
    }
  },
  "command": {
    "my-command": {
      "template": "Command prompt with $ARGUMENTS",
      "description": "Brief explanation",
      "agent": "specific-agent-name",
      "model": "override-model",
      "subtask": true
    }
  },
  "keybinds": {},
  "formatter": {},
  "permission": {
    "edit": "ask" | "allow" | "deny",
    "bash": {
      "*": "ask",
      "git": "allow",
      "npm install": "deny"
    },
    "webfetch": "ask",
    "doom_loop": "ask",
    "external_directory": "ask"
  },
  "share": "manual" | "auto" | "disabled",
  "autoupdate": true,
  "instructions": ["path/to/instructions.md", "packages/*/AGENTS.md"],
  "mcp": {
    "server-name": {
      "type": "local" | "remote",
      "enabled": true,
      "command": ["npx", "-y", "mcp-server-name"],
      "environment": {
        "API_KEY": "{env:MY_API_KEY}"
      },
      "url": "https://remote-mcp-server.com",
      "headers": {
        "Authorization": "Bearer {env:TOKEN}"
      },
      "oauth": true
    }
  },
  "disabled_providers": ["provider-name"],
  "enabled_providers": ["provider-name"]
}
```

**Variable Substitution:**
- `{env:VARIABLE_NAME}` - Environment variable
- `{file:path/to/file}` - File contents

**Schema Validation:**
- Schema available at: `https://opencode.ai/config.json`
- IDE autocomplete and validation support

### 3. AGENTS.md Support

OpenCode uses **AGENTS.md** (equivalent to Claude Code's CLAUDE.md):

#### Initialization
- Auto-generate: `/init` command
- Manual creation supported

#### File Locations & Precedence
1. **Project-level:** `<project>/AGENTS.md` (version-controlled, team-shared)
2. **Global:** `~/.config/opencode/AGENTS.md` (personal preferences)
3. **Both merge** when both exist

#### Configuration Methods

**Three approaches:**

1. **Direct AGENTS.md** - Instructions directly in file
2. **opencode.json reference** - Use `"instructions"` field with glob patterns:
   ```json
   {
     "instructions": [
       "AGENTS.md",
       "packages/*/AGENTS.md",
       ".opencode/rules/*.md"
     ]
   }
   ```
3. **Lazy loading** - Reference external files within AGENTS.md

### 4. Agent System

OpenCode provides **two agent categories:**

#### Primary Agents
- Main assistants user interacts with directly
- Switch between agents: Tab key or custom keybinds
- Built-in: **Build** (default, full tools) and **Plan** (analysis only)

#### Subagents
- Specialized assistants invoked by primary agents
- Invocation: Automatic or via @ mentions
- Built-in: **General** (research), **Explore** (codebase exploration)

#### Agent Configuration

**Via opencode.json:**
```json
{
  "agent": {
    "security-auditor": {
      "description": "Security code reviewer",
      "mode": "subagent",
      "model": "anthropic/claude-opus-4",
      "temperature": 0.2,
      "max_steps": 30,
      "tools": {
        "write": false,
        "bash": false
      },
      "permissions": {
        "read": "allow",
        "grep": "allow"
      },
      "prompt": "security-auditor-system-prompt.md"
    }
  }
}
```

**Via markdown files:**
- Global: `~/.config/opencode/agent/*.md`
- Project: `.opencode/agent/*.md`

**Interactive creation:**
```bash
opencode agent create
# Wizard guides you through agent definition
```

### 5. Custom Commands

OpenCode supports **custom slash commands**:

#### Definition Methods

**Markdown files:**
- File location: `.opencode/command/*.md`
- Filename becomes command: `test.md` → `/test`

**opencode.json:**
```json
{
  "command": {
    "review": {
      "template": "Review these changes and suggest improvements:\n{!git log -1 --stat}",
      "description": "Review recent changes",
      "agent": "code-reviewer",
      "model": "anthropic/claude-opus-4"
    },
    "test": {
      "template": "Run tests for $1 with coverage",
      "description": "Run specific test suite"
    }
  }
}
```

#### Advanced Features

**Placeholders:**
- `$ARGUMENTS` - All arguments
- `$1`, `$2`, etc. - Positional parameters
- ``!command`` - Shell command output injection
- `@filename` - File content injection

**Example with injection:**
```json
{
  "command": {
    "pr": {
      "template": "Create PR for these changes:\n{!git diff main...HEAD}\n\nFiles changed:\n{!git diff --name-only main...HEAD}"
    }
  }
}
```

**Override built-ins:** Custom commands can override `/init`, `/undo`, `/redo`

### 6. Tools System

#### Built-in Tools

| Tool | Function |
|------|----------|
| **bash** | Execute shell commands |
| **edit** | Modify files with exact string replacements |
| **write** | Create/overwrite files |
| **read** | Read file contents with line ranges |
| **grep** | Regex search across codebase (ripgrep) |
| **glob** | File pattern matching |
| **list** | Directory contents with filtering |
| **patch** | Apply patch files |
| **todowrite/todoread** | Task list management |
| **webfetch** | Retrieve web pages |

#### Tool Configuration

**Global enable/disable:**
```json
{
  "tools": {
    "write": false,
    "bash": true,
    "mymcp_*": false
  }
}
```

**Per-agent basis:**
```json
{
  "agent": {
    "read-only-analyzer": {
      "tools": {
        "write": false,
        "bash": false,
        "edit": false
      }
    }
  }
}
```

**Wildcard patterns:** `"mymcp_*": false` disables all tools from MCP server "mymcp"

#### Custom Tools

**Definition:**
- TypeScript/JavaScript files
- Location: `.opencode/tool/` (project) or `~/.config/opencode/tool/` (global)
- Uses `tool()` helper with Zod schema validation

**Multiple exports:**
- Naming: `<filename>_<exportname>`

### 7. MCP Server Support

OpenCode has **comprehensive MCP client support**:

#### Configuration Structure

```json
{
  "mcp": {
    "server-name": {
      "type": "local" | "remote",
      "enabled": true
    }
  }
}
```

#### Local MCP Servers

```json
{
  "mcp": {
    "python-repl": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-everything"],
      "environment": {
        "API_KEY": "{env:MY_API_KEY}",
        "CONFIG": "{file:.opencode/config.json}"
      }
    }
  }
}
```

#### Remote MCP Servers

```json
{
  "mcp": {
    "remote-mcp": {
      "type": "remote",
      "url": "https://mcp-server.example.com",
      "headers": {
        "Authorization": "Bearer {env:MCP_TOKEN}"
      },
      "oauth": true
    }
  }
}
```

#### OAuth Authentication

**Automatic OAuth handling:**
- Detects 401 responses
- Initiates OAuth flow automatically
- Pre-configure credentials or disable: `"oauth": false`

#### Tool Management

**MCP servers are treated as tools:**
- Global enable/disable via `tools` section
- Per-agent override
- Wildcard pattern support: `"my-mcp*"`

**Context caveat:** "MCP servers add to your context, so you want to be careful with which ones you enable."

### 8. Permissions System

OpenCode provides **granular permission controls**:

#### Permission Levels

- **"ask"** - Prompt for approval before execution
- **"allow"** - Execute without approval
- **"deny"** - Disable tool entirely

#### Configurable Tools

```json
{
  "permission": {
    "edit": "ask",
    "bash": {
      "*": "ask",
      "git *": "allow",
      "npm install": "deny",
      "rm -rf": "deny"
    },
    "webfetch": "ask",
    "doom_loop": "ask",
    "external_directory": "ask"
  }
}
```

#### Key Features

**Bash command targeting:**
- Individual command permissions
- Wildcard patterns: `*` (zero or more chars), `?` (exactly one char)

**Agent-level overrides:**
- Global permissions can be overridden per-agent

**Defaults:**
- Most operations: `"allow"`
- `doom_loop`: `"ask"` (detects 3+ identical tool calls)
- `external_directory`: `"ask"` (operations outside working dir)

### 9. Rules System

**Rules are instructions files that shape AI behavior.**

#### Configuration Methods

1. **Direct AGENTS.md** - Instructions in file
2. **opencode.json reference:**
   ```json
   {
     "instructions": [
       "AGENTS.md",
       "packages/*/AGENTS.md"
     ]
   }
   ```
3. **Lazy loading** - Reference external files within AGENTS.md

#### Precedence Logic

1. Traverse up from current directory (local files)
2. Check global config location
3. Merge both when both exist

### 10. Additional Features

#### Themes
- Customizable visual appearance
- Configuration via `theme` field

#### Keybinds
- Custom keyboard shortcuts
- Tab key for agent switching

#### Formatters
- Code formatter configuration
- Per-language settings

#### Sharing
- **Modes:** `"manual"`, `"auto"`, `"disabled"`
- Creates shareable conversation links
- Command: `/share`

#### Auto-update
- Automatic updates: `"autoupdate": true`

#### Usage Modes
- **Plan Mode** (Tab key) - Suggest approaches without changes
- **Build Mode** - Execute actual modifications

#### Version Control
- Git integration
- Undo/Redo: `/undo`, `/redo`

---

## Comparison: OpenCode vs Claude Code

### Feature Parity Matrix

| Feature | Claude Code | OpenCode | Notes |
|---------|-------------|----------|-------|
| **Configuration Files** |
| Project config | `.mcp.json` | `opencode.json` | OpenCode has richer schema |
| Context file | `CLAUDE.md` | `AGENTS.md` | Equivalent functionality |
| Global config | `~/.config/claude/mcp.json` | `~/.config/opencode/opencode.json` | Similar precedence |
| Config merge | No | Yes | OpenCode merges configs |
| Schema validation | No | Yes | OpenCode: `opencode.ai/config.json` |
| **MCP Support** |
| MCP client | ✅ | ✅ | Both support MCP protocol |
| MCP server mode | ✅ | ❌ | Claude Code: `claude mcp serve` |
| Local MCP servers | ✅ | ✅ | Similar configuration |
| Remote MCP servers | ✅ | ✅ | OpenCode adds OAuth |
| OAuth for remote MCP | ❌ | ✅ | OpenCode unique |
| MCP tool wildcards | ❌ | ✅ | OpenCode: `"mymcp_*": false` |
| **Agent System** |
| Subagents/Task delegation | ✅ Task tool | ✅ Subagents | Similar capability |
| Custom agents | ✅ Plugins | ✅ Config/markdown | OpenCode more flexible |
| Agent modes | N/A | ✅ | Primary/subagent/all |
| Agent switching | N/A | ✅ | Tab key |
| Per-agent tools | ❌ | ✅ | OpenCode unique |
| Per-agent permissions | ❌ | ✅ | OpenCode unique |
| **Commands** |
| Slash commands | ✅ `.claude/commands/` | ✅ `.opencode/command/` | Similar |
| Command templates | ✅ Markdown | ✅ Markdown + JSON | OpenCode more flexible |
| Command arguments | ✅ | ✅ | Both support placeholders |
| Shell injection | ❌ | ✅ | OpenCode: ``!command`` |
| Override built-ins | ❌ | ✅ | OpenCode allows |
| **Tools** |
| Built-in tools | ✅ | ✅ | Similar set |
| Custom tools | ✅ Plugins | ✅ TS/JS files | OpenCode more direct |
| Tool permissions | ❌ | ✅ | OpenCode granular |
| Global tool toggle | ❌ | ✅ | OpenCode unique |
| Per-agent tool toggle | ❌ | ✅ | OpenCode unique |
| **Permissions** |
| Global permissions | ❌ | ✅ | OpenCode unique |
| Per-tool permissions | ❌ | ✅ | OpenCode: ask/allow/deny |
| Bash command permissions | ❌ | ✅ | OpenCode: individual commands |
| Agent permission overrides | ❌ | ✅ | OpenCode unique |
| **Configuration** |
| Model selection | ✅ | ✅ | Both support |
| Temperature control | ❌ | ✅ | OpenCode per-agent |
| Max steps limit | ❌ | ✅ | OpenCode cost control |
| Variable substitution | ❌ | ✅ | OpenCode: `{env:}`, `{file:}` |
| Glob patterns | ❌ | ✅ | OpenCode: instructions field |
| **Extensibility** |
| Plugin system | ✅ Rich ecosystem | ❌ | Claude Code advantage |
| Plugin marketplace | ✅ Multiple | ❌ | Claude Code advantage |
| Hooks/automation | ✅ Pre/post hooks | ❌ | Claude Code advantage |
| **Other Features** |
| Background tasks | ✅ Task tool | ❌ | Claude Code advantage |
| Web search | ✅ Built-in | ❌ | Claude Code advantage |
| Themes | ❌ | ✅ | OpenCode advantage |
| Keybinds | ❌ | ✅ | OpenCode advantage |
| Formatters | ❌ | ✅ | OpenCode advantage |
| Share conversations | ❌ | ✅ `/share` | OpenCode advantage |
| Undo/Redo | ❌ | ✅ | OpenCode advantage |
| Plan/Build modes | ❌ | ✅ | OpenCode advantage |
| Open source | ❌ | ✅ | OpenCode advantage |

### Key Differentiators

#### Claude Code Advantages
1. **Plugin ecosystem** - Rich marketplace with specialized agents
2. **Hooks system** - Pre/post automation capabilities
3. **MCP server mode** - Can act as both client AND server
4. **Background tasks** - Task tool for parallel execution
5. **Web search** - Built-in capability
6. **Official Anthropic support** - Direct integration with Claude

#### OpenCode Advantages
1. **Permissions system** - Granular control over tool access
2. **Configuration flexibility** - Rich JSON schema with merging
3. **Per-agent customization** - Tools, permissions, models per-agent
4. **OAuth support** - For remote MCP servers
5. **Variable substitution** - `{env:}`, `{file:}` patterns
6. **Open source** - Community-driven development
7. **UI features** - Themes, keybinds, modes
8. **Undo/Redo** - Built-in change management

---

## Overture Integration Opportunities

### Current Overture Features (v0.2.5)

**What Overture does today:**
1. Multi-platform MCP configuration management
2. Generates `.mcp.json` for Claude Code
3. Generates `CLAUDE.md` for Claude Code
4. User global + project config merge
5. Plugin lifecycle management
6. Backup/restore system
7. Configuration audit
8. Support for 7 clients:
   - Claude Desktop
   - Claude Code (user + project)
   - Cursor IDE
   - Windsurf IDE
   - VSCode Copilot
   - Copilot CLI
   - JetBrains Copilot

### Proposed: OpenCode.ai Integration

#### Integration Goal

**Extend Overture to manage opencode.json alongside .mcp.json**

Enable developers to:
- Declare MCP servers ONCE in Overture config
- Sync to BOTH Claude Code AND OpenCode
- Maintain consistent MCP configuration across tools
- Preserve OpenCode-specific settings (agents, permissions, etc.)

#### Implementation Approach: JSON Patching Service

**Strategy:** Selective patching rather than full generation

**Rationale:**
- OpenCode has many config fields beyond MCPs (agents, commands, tools, permissions)
- Users may have customized agents, commands, themes, etc.
- Full file generation would wipe these customizations
- **Patch only the `mcp` section** to avoid conflicts

#### Technical Design

**1. OpenCode Adapter (New)**

Create adapter: `apps/cli/src/core/adapters/opencode-adapter.ts`

```typescript
interface OpenCodeAdapter extends ClientAdapter {
  name: 'opencode';

  // Binary detection
  detect(): Promise<DetectionResult>;
  getVersion(): Promise<string>;

  // Config file paths
  getUserConfigPath(): string;        // ~/.config/opencode/opencode.json
  getProjectConfigPath(): string;     // <cwd>/opencode.json

  // JSON patching (unique to OpenCode)
  patchMcpSection(
    configPath: string,
    mcpServers: Record<string, McpServerConfig>,
    options: PatchOptions
  ): Promise<void>;

  // Validation
  validateConfig(configPath: string): Promise<ValidationResult>;
}
```

**2. JSON Patching Logic**

```typescript
interface PatchOptions {
  preserveExisting: boolean;  // Keep manually-added MCPs
  mergeStrategy: 'replace' | 'merge';  // How to handle conflicts
  backup: boolean;  // Create backup before patching
}

async function patchMcpSection(
  configPath: string,
  mcpServers: Record<string, McpServerConfig>,
  options: PatchOptions
): Promise<void> {
  // 1. Read existing opencode.json (or create if missing)
  const existing = await readJson(configPath);

  // 2. Extract current MCP section
  const currentMcps = existing.mcp || {};

  // 3. Identify Overture-managed vs manually-added MCPs
  const managedMcps = identifyManagedMcps(currentMcps);
  const manualMcps = identifyManualMcps(currentMcps);

  // 4. Apply merge strategy
  let updatedMcps = {};

  if (options.mergeStrategy === 'replace') {
    // Replace all managed MCPs, preserve manual
    updatedMcps = {
      ...manualMcps,
      ...mcpServers
    };
  } else {
    // Merge: update managed, preserve manual, add new
    updatedMcps = {
      ...manualMcps,
      ...currentMcps,
      ...mcpServers
    };
  }

  // 5. Patch only the mcp section
  const patched = {
    ...existing,
    mcp: updatedMcps
  };

  // 6. Write back (with backup)
  if (options.backup) {
    await createBackup(configPath);
  }
  await writeJson(configPath, patched);
}
```

**3. MCP Server Format Translation**

**Overture format:**
```yaml
mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    env:
      API_KEY: "${MY_API_KEY}"
```

**Translate to OpenCode format:**
```json
{
  "mcp": {
    "python-repl": {
      "type": "local",
      "enabled": true,
      "command": ["uvx", "mcp-server-python-repl"],
      "environment": {
        "API_KEY": "{env:MY_API_KEY}"
      }
    }
  }
}
```

**Translation logic:**
- Overture `command` + `args` → OpenCode `command` array
- Overture `env` → OpenCode `environment`
- Add `type: "local"` (assume local unless URL present)
- Add `enabled: true` by default
- Translate variable syntax: `"${VAR}"` → `"{env:VAR}"`

**4. AGENTS.md Generation**

**Strategy:** Generate AGENTS.md similar to CLAUDE.md

**Content:**
- Project info (from `.overture/config.yaml`)
- Active plugins
- MCP server list (global vs project)
- Plugin→MCP mappings
- Workflow instructions (if defined)

**Preservation:**
- Use HTML comment markers: `<!-- overture configuration start/end -->`
- Preserve custom sections outside markers
- Merge on regeneration

**File location:**
- Project: `<project>/AGENTS.md`
- Global: `~/.config/opencode/AGENTS.md` (optional)

#### User Workflow

**Scenario: Developer uses both Claude Code and OpenCode**

```bash
# 1. User edits Overture config
vim .overture/config.yaml

# Add MCP servers:
mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]

  ruff:
    command: uvx
    args: [mcp-server-ruff]

# 2. Sync to all clients (including OpenCode)
overture sync

# Output:
# ✓ Claude Code (user): ~/.config/claude/mcp.json
# ✓ Claude Code (project): .mcp.json
# ✓ OpenCode (user): ~/.config/opencode/opencode.json (patched mcp section)
# ✓ OpenCode (project): opencode.json (patched mcp section)
# ✓ Generated: CLAUDE.md
# ✓ Generated: AGENTS.md
```

**What gets preserved in opencode.json:**
- Custom agents
- Custom commands
- Tool permissions
- Themes, keybinds
- All non-MCP configuration

**What gets updated:**
- `mcp` section (Overture-managed servers)
- Manually-added MCPs preserved (if `--preserve-manual` flag)

#### Configuration Examples

**Overture config with OpenCode-specific options:**

```yaml
# .overture/config.yaml
version: "1.0"

project:
  name: my-app
  type: python-backend

plugins:
  python-development:
    marketplace: claude-code-workflows
    mcps: [python-repl, ruff]

mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]

  ruff:
    command: uvx
    args: [mcp-server-ruff]

# OpenCode-specific configuration (optional)
opencode:
  sync_agents_md: true  # Generate AGENTS.md
  preserve_manual_mcps: true  # Don't delete manually-added MCPs
  merge_strategy: 'merge'  # 'replace' or 'merge'
```

**Generated opencode.json (patched):**

```json
{
  "model": "anthropic/claude-sonnet-4-5",
  "agent": {
    "my-custom-agent": {
      "description": "Custom agent (preserved)",
      "mode": "subagent"
    }
  },
  "permission": {
    "bash": {
      "*": "ask"
    }
  },
  "mcp": {
    "python-repl": {
      "type": "local",
      "enabled": true,
      "command": ["uvx", "mcp-server-python-repl"]
    },
    "ruff": {
      "type": "local",
      "enabled": true,
      "command": ["uvx", "mcp-server-ruff"]
    },
    "my-manual-mcp": {
      "type": "local",
      "enabled": true,
      "command": ["custom-mcp"],
      "_comment": "Manually added, preserved by Overture"
    }
  },
  "theme": "custom-theme",
  "autoupdate": true
}
```

#### Commands

**New commands for OpenCode support:**

```bash
# Doctor: Check OpenCode installation
overture doctor
# Shows:
# - OpenCode installed: Yes (v1.2.3)
# - Config locations:
#   - User: ~/.config/opencode/opencode.json (valid JSON)
#   - Project: opencode.json (not found)

# Sync: Patch OpenCode configs
overture sync
# Output:
# ✓ OpenCode (user): Patched mcp section (2 servers)
# ✓ OpenCode (project): Patched mcp section (2 servers)
# ✓ Generated: AGENTS.md

# Sync options:
overture sync --client opencode  # Sync only OpenCode
overture sync --preserve-manual  # Keep manually-added MCPs
overture sync --merge-strategy replace  # Replace all MCPs

# Audit: Check for manually-added MCPs
overture audit --client opencode
# Output:
# OpenCode (user):
#   Overture-managed: python-repl, ruff
#   Manually-added: my-custom-mcp, legacy-server

# MCP list: Show OpenCode MCPs
overture mcp list --client opencode
# Output:
# OpenCode (user):
# - python-repl (Overture-managed)
# - ruff (Overture-managed)
# - my-custom-mcp (manual)

# Validate: Check OpenCode config
overture validate --client opencode
# Checks:
# - JSON syntax valid
# - MCP commands exist
# - Schema compliance (if schema available)
```

#### Implementation Phases

**Phase 1: Basic OpenCode Support**
- [ ] Create OpenCodeAdapter
- [ ] Binary detection (check for `opencode` in PATH)
- [ ] Version extraction
- [ ] Config path resolution
- [ ] JSON patching logic
- [ ] Format translation (Overture → OpenCode)
- [ ] Tests for patching logic

**Phase 2: Integration with Sync**
- [ ] Add OpenCode to sync command
- [ ] Implement `--client opencode` filter
- [ ] Add `--preserve-manual` flag
- [ ] Add `--merge-strategy` option
- [ ] Update sync output to show OpenCode results
- [ ] Integration tests

**Phase 3: AGENTS.md Generation**
- [ ] Create AGENTS.md generator
- [ ] HTML comment marker preservation
- [ ] Plugin→MCP mapping section
- [ ] Workflow instructions section
- [ ] Tests for generation + preservation

**Phase 4: Advanced Features**
- [ ] Audit command for manual MCPs
- [ ] MCP list filtering by client
- [ ] Validation for opencode.json
- [ ] Backup/restore for OpenCode configs
- [ ] Schema validation (if schema available)

**Phase 5: OpenCode-Specific Features**
- [ ] Remote MCP server support
- [ ] OAuth configuration translation
- [ ] Permission mapping (if applicable)
- [ ] Agent configuration (future: manage agents via Overture?)

#### Testing Strategy

**Unit Tests:**
- JSON patching logic
- Format translation (Overture → OpenCode)
- Merge strategies (replace vs merge)
- Manual MCP preservation
- Variable substitution translation

**Integration Tests:**
- End-to-end sync to opencode.json
- AGENTS.md generation + preservation
- Backup/restore for OpenCode
- Multi-client sync (Claude + OpenCode)

**E2E Tests:**
- Install OpenCode
- Create Overture config
- Sync to OpenCode
- Verify opencode.json patched correctly
- Verify custom config preserved
- Test AGENTS.md generation

#### Risks & Mitigations

**Risk 1: OpenCode schema changes**
- **Mitigation:** Monitor OpenCode releases, schema validation
- **Fallback:** Warn on unknown fields, continue with best effort

**Risk 2: User edits opencode.json directly**
- **Mitigation:** Preserve manual MCPs with `--preserve-manual`
- **Audit command:** `overture audit` shows manual vs Overture-managed

**Risk 3: Conflicting MCP definitions**
- **Mitigation:** Merge strategy options (replace vs merge)
- **User control:** `--merge-strategy` flag

**Risk 4: AGENTS.md conflicts**
- **Mitigation:** HTML comment markers for managed sections
- **Preservation:** Custom content outside markers preserved

---

## Benefits of OpenCode Integration

### For Overture Users

1. **Unified MCP Management**
   - Declare MCPs once, sync to Claude Code AND OpenCode
   - Consistent configuration across tools
   - Reduce duplication and drift

2. **Team Collaboration**
   - Commit `.overture/config.yaml` to repos
   - Team members get consistent setup for both tools
   - New members: `overture sync` and ready to go

3. **Dotfiles Integration**
   - Manage user global MCPs in `~/.config/overture.yml`
   - Sync to both `~/.config/claude/mcp.json` and `~/.config/opencode/opencode.json`
   - New machine: restore dotfiles, run `overture sync`

4. **Best of Both Worlds**
   - Use Claude Code plugins + ecosystem
   - Use OpenCode permissions + UI features
   - Same MCP servers available in both

### For OpenCode Users

1. **MCP Configuration Management**
   - Overture provides missing MCP lifecycle management
   - Audit and consolidation across projects
   - Backup/restore for configs

2. **Multi-Platform Sync**
   - Access to 7+ client configurations
   - Experiment with Claude Desktop, Cursor, etc.
   - Consistent MCP setup across all tools

3. **Documentation Generation**
   - Auto-generate AGENTS.md with plugin→MCP mappings
   - Workflow orchestration instructions
   - Project context for AI assistance

### For Ecosystem

1. **Cross-Tool Compatibility**
   - Standardize MCP configuration across AI CLIs
   - Reduce vendor lock-in
   - Enable tool switching without reconfiguration

2. **Configuration Portability**
   - Overture as "dotfiles for AI tools"
   - Version-controlled configuration
   - Reproducible AI development environments

---

## Feature Requests for OpenCode

Based on this research, features that would enhance OpenCode:

1. **MCP Lifecycle Management**
   - `opencode mcp list` - List configured MCPs
   - `opencode mcp enable/disable <name>` - Toggle MCPs
   - `opencode mcp validate` - Validate MCP commands exist

2. **Configuration Audit**
   - `opencode audit` - Find unused/invalid MCPs
   - Detection of duplicate MCPs across configs
   - Consolidation recommendations

3. **Backup/Restore**
   - Automatic backups before config changes
   - `opencode backup restore <timestamp>`
   - Keep last N backups

4. **Schema Validation**
   - Expand `https://opencode.ai/config.json` schema
   - Runtime validation with helpful errors
   - IDE autocomplete improvements

5. **Plugin System**
   - Package manager for custom agents/commands/tools
   - Plugin marketplace or registry
   - `opencode plugin install <name>`

---

## Competitive Analysis: Overture's Position

### Overture's Unique Value

**What Overture does that OpenCode doesn't:**
1. Multi-platform MCP sync (7 clients)
2. User global + project config merge
3. Plugin lifecycle management (Claude Code)
4. Configuration audit and consolidation
5. Backup/restore across all clients
6. Workflow orchestration documentation

**What OpenCode does that Overture doesn't:**
1. Execute AI assistance (Overture configures, doesn't execute)
2. Custom agents, commands, tools
3. Permissions system
4. Themes, keybinds, UI
5. Plan/Build modes
6. Undo/Redo

### Complementary Relationship

**Overture and OpenCode are complementary, not competitive:**

- **Overture** = Configuration orchestrator ("dotfiles for AI tools")
- **OpenCode** = AI coding agent (execution runtime)

**Analogy:**
- Overture : OpenCode :: Homebrew : VSCode
- Overture manages configuration, OpenCode executes tasks

**Value proposition:**
> "Use Overture to manage your MCPs across Claude Code and OpenCode. Use OpenCode's rich agent system and permissions. Best of both worlds."

---

## Recommendations

### Immediate Actions

1. **Add OpenCode to README comparison matrix**
   - Include in "AI Coding CLI Comparison Matrix"
   - Highlight OpenCode's unique features
   - Show Overture's complementary role

2. **Prototype OpenCodeAdapter**
   - Implement basic detection
   - Test JSON patching logic
   - Validate format translation

3. **Engage OpenCode community**
   - Open GitHub issue: "Integration proposal: Overture configuration management"
   - Propose collaboration on schema validation
   - Explore plugin/extension for Overture

### Medium-term Goals

1. **Ship OpenCode support in v0.3**
   - Full OpenCodeAdapter implementation
   - Sync to opencode.json
   - AGENTS.md generation
   - Documentation and examples

2. **Expand comparison docs**
   - Create docs/opencode-comparison.md
   - Include this research
   - Add integration examples

3. **Create example projects**
   - docs/examples/opencode-python-backend.md
   - docs/examples/opencode-claude-code-hybrid.md
   - Show both tools working together

### Long-term Vision

1. **Universal AI Tool Configuration Manager**
   - Support 10+ AI CLIs
   - Standard format for MCP declaration
   - Cross-tool compatibility layer

2. **Configuration Marketplace**
   - Share Overture configs for common stacks
   - "Python FastAPI" config → works with Claude Code, OpenCode, Cursor, etc.
   - Community-contributed configurations

3. **Standardization Efforts**
   - Propose MCP configuration standard
   - Work with tool vendors on common format
   - Reduce configuration fragmentation

---

## Appendix: OpenCode Resources

### Documentation
- **Main docs:** https://opencode.ai/docs/
- **Configuration:** https://opencode.ai/docs/config/
- **Agents:** https://opencode.ai/docs/agents/
- **MCP Servers:** https://opencode.ai/docs/mcp-servers/
- **Tools:** https://opencode.ai/docs/tools/
- **Commands:** https://opencode.ai/docs/commands/
- **Rules:** https://opencode.ai/docs/rules/
- **Permissions:** https://opencode.ai/docs/permissions/

### Schema
- **Config schema:** https://opencode.ai/config.json

### Installation
- **Install script:** `curl -fsSL https://opencode.ai/install | bash`
- **GitHub:** (Repository URL not found in docs, likely https://github.com/opencode-ai/opencode)

### Key Commands
- `/init` - Generate AGENTS.md
- `/connect` - Configure API keys
- `/undo` / `/redo` - Change management
- `/share` - Share conversations
- `opencode agent create` - Interactive agent setup

---

## Next Steps

1. ✅ **Research complete** - This document
2. ⏭️ **Prototype adapter** - Implement OpenCodeAdapter
3. ⏭️ **Test patching** - Validate JSON patching logic
4. ⏭️ **Update docs** - Add OpenCode to README
5. ⏭️ **Ship v0.3** - Release OpenCode support

---

**Document Status:** Initial research complete
**Last Updated:** 2025-12-18
**Author:** Claude Code (via Overture research session)
