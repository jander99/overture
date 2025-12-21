# MCP Client Configuration Research Report v2

> ⚠️ **OVERTURE v0.3 SUPPORTS 3 CLIENTS ONLY**
>
> This document contains research on 7 clients. Overture v0.3 **ONLY supports**:
>
> - ✅ Claude Code (primary)
> - ✅ GitHub Copilot CLI
> - ✅ OpenCode
>
> Sections on **Cursor, Windsurf, Claude Desktop, VS Code, JetBrains** are **HISTORICAL ONLY**.
> Do NOT use this info for implementation.
>
> **Last Validated:** 2025-11-11 (7-client version)  
> **Updated:** 2025-01-12 (3-client deprecation notice)

---

**Research Date:** 2025-11-11  
**Previous Version:** 2025-11-10 (v1)  
**Purpose:** Comprehensive research update based on user feedback to inform Overture v0.2 multi-platform support

---

## Executive Summary

This v2 research document addresses critical gaps from v1 and incorporates user feedback on:

1. **JetBrains GitHub Copilot Plugin** - Clarified as the Copilot plugin within JetBrains IDEs (not JetBrains MCP server)
2. **Environment Variable Support** - Investigated whether `${VAR}` expansion works across clients
3. **Configuration Design Patterns** - MCP-centric vs client-centric approaches
4. **File Organization Strategy** - Single file vs multiple files for Overture config
5. **Version Management** - How to handle MCP server versioning
6. **Transport Requirements** - Making transport a required field
7. **GitHub Copilot CLI Bundled MCP** - How to configure the bundled GitHub MCP

**Key Changes from v1:**

- JetBrains Copilot plugin added as supported client (uses `.vscode/mcp.json`)
- Environment variable expansion documented with client-specific support matrix
- Transport field recommended as required in Overture config
- Configuration design recommendations (MCP-centric preferred)
- File organization recommendation (single file for v0.2, split later)
- Version management strategy defined
- Updated implementation priority (Claude Code > Claude Desktop > VS Code > JetBrains Copilot)

---

## 1. Updated Client Configuration Matrix

### 1.1 Complete Client Comparison Table (Updated)

| Client                                | macOS Config Location                                                                         | Linux Config Location                                                     | Windows Config Location                                                                                   | Format | Scope Support              | MCP Support                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ | -------------------------- | ------------------------------------------------ |
| **Claude Code**                       | `~/.claude.json` (global)<br>`.mcp.json` (project)                                            | `~/.claude.json` (global)<br>`.mcp.json` (project)                        | `%USERPROFILE%\.claude.json` (global)<br>`.mcp.json` (project)                                            | JSON   | Global + Project           | ✅ Full                                          |
| **Claude Desktop**                    | `~/Library/Application Support/Claude/claude_desktop_config.json`                             | `~/.config/Claude/claude_desktop_config.json`                             | `%APPDATA%\Claude\claude_desktop_config.json`                                                             | JSON   | User only                  | ✅ Full (stdio)<br>⚠️ HTTP/SSE (paid tiers only) |
| **VS Code** (Copilot)                 | `.vscode/mcp.json` (workspace)<br>`~/Library/Application Support/Code/User/mcp.json` (global) | `.vscode/mcp.json` (workspace)<br>`~/.config/Code/User/mcp.json` (global) | `.vscode\mcp.json` (workspace)<br>`%APPDATA%\Code\User\mcp.json` (global)                                 | JSON   | Global + Workspace         | ✅ Full (requires VS Code 1.99+)                 |
| **JetBrains** (GitHub Copilot plugin) | `.vscode/mcp.json` (workspace)                                                                | `.vscode/mcp.json` (workspace)                                            | `.vscode/mcp.json` (workspace)<br>`%LOCALAPPDATA%\github-copilot\intellij\mcp.json` (user - Windows only) | JSON   | Workspace + User (Windows) | ✅ Full (via Copilot plugin)                     |
| **GitHub Copilot CLI**                | `~/.config/mcp-config.json`<br>`~/.copilot/mcp-config.json`                                   | `~/.config/mcp-config.json`<br>or `$XDG_CONFIG_HOME/mcp-config.json`      | `%USERPROFILE%\.config\mcp-config.json`                                                                   | JSON   | User only                  | ✅ Full (bundled GitHub MCP)                     |
| **Cursor**                            | `~/.cursor/mcp.json` (global)<br>`.cursor/mcp.json` (project)                                 | `~/.cursor/mcp.json` (global)<br>`.cursor/mcp.json` (project)             | `%USERPROFILE%\.cursor\mcp.json` (global)<br>`.cursor\mcp.json` (project)                                 | JSON   | Global + Project           | ✅ Full                                          |
| **Windsurf**                          | `~/.codeium/windsurf/mcp_config.json`                                                         | `~/.codeium/windsurf/mcp_config.json`                                     | `%USERPROFILE%\.codeium\windsurf\mcp_config.json`                                                         | JSON   | User only                  | ✅ Full (stdio + HTTP)                           |

### 1.2 JetBrains GitHub Copilot Plugin Details (NEW)

**Critical Clarification:** The user is referring to the **GitHub Copilot plugin inside JetBrains IDEs** (IntelliJ IDEA, PyCharm, WebStorm, etc.), NOT the JetBrains MCP server.

**Configuration Paths:**

- **Workspace (all platforms):** `.vscode/mcp.json`
  - Yes, JetBrains Copilot plugin uses VS Code's convention
  - Allows sharing MCP config across VS Code and JetBrains in same project
- **User-level (Windows only - confirmed):** `%LOCALAPPDATA%\github-copilot\intellij\mcp.json`
  - Example: `C:\Users\Username\AppData\Local\github-copilot\intellij\mcp.json`
- **User-level (macOS - needs research):** Likely `~/Library/Application Support/github-copilot/intellij/mcp.json` (unconfirmed)
- **User-level (Linux - needs research):** Likely `~/.local/share/github-copilot/intellij/mcp.json` or `~/.config/github-copilot/intellij/mcp.json` (unconfirmed)

**Configuration Format:**

Uses the `servers` schema (same as VS Code):

```json
{
  "servers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-name"],
      "env": {
        "API_KEY": "value"
      }
    }
  }
}
```

**IDE Variations:**

The path does NOT differ between:

- JetBrains Toolbox installations
- Direct IDE installations
- Different JetBrains IDEs (IntelliJ, PyCharm, WebStorm)

All use the same GitHub Copilot plugin, which has a single config path.

**Agent Mode:**

MCP support requires GitHub Copilot's "agent mode" to be enabled. Access via:

1. Copilot icon → "Open Chat"
2. Ensure agent mode is active
3. Click tools icon → "Configure your MCP server" → "Add MCP Tools"

**Overture Implications:**

- JetBrains Copilot should use the **VS Code adapter** for workspace config
- Need separate adapter for user-level config (Windows path confirmed, macOS/Linux research needed)
- Schema is identical to VS Code (`servers` not `mcpServers`)
- Should detect JetBrains IDE presence to enable this client

---

## 2. Environment Variable Support Analysis (NEW)

### 2.1 Environment Variable Expansion Support Matrix

| Client                 | `${VAR}` Syntax                 | `$VAR` Syntax | `%VAR%` Syntax | Expansion Scope                     | Works?         |
| ---------------------- | ------------------------------- | ------------- | -------------- | ----------------------------------- | -------------- |
| **Claude Code**        | ✅ Yes                          | ❌ No         | ❌ No          | `command`, `args`, `env` values     | ✅ **YES**     |
| **Claude Desktop**     | ⚠️ Partial                      | ❌ No         | ❌ No          | `env` values only                   | ⚠️ **MAYBE**   |
| **VS Code**            | ❌ No (native)                  | ❌ No         | ❌ No          | None (use `inputs` instead)         | ❌ **NO**      |
| **JetBrains Copilot**  | ❌ No (assumed same as VS Code) | ❌ No         | ❌ No          | None (use `inputs` instead)         | ❌ **NO**      |
| **GitHub Copilot CLI** | ✅ Yes (v0.0.340+)              | ❌ No         | ❌ No          | `command`, `args`, `env`, `headers` | ✅ **YES**     |
| **Cursor**             | ⚠️ Unknown                      | ❌ No         | ❌ No          | Unknown                             | ⚠️ **UNKNOWN** |
| **Windsurf**           | ⚠️ Unknown                      | ❌ No         | ❌ No          | Unknown                             | ⚠️ **UNKNOWN** |

### 2.2 Syntax Standards

**Standard Syntax:** `${VARIABLE_NAME}`

**Optional Default Value:** `${VARIABLE_NAME:-default_value}`

**Examples:**

```json
{
  "mcpServers": {
    "github": {
      "command": "${GITHUB_MCP_PATH:-npx}",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "API_BASE_URL": "${API_BASE_URL:-https://api.github.com}"
      }
    }
  }
}
```

### 2.3 Client-Specific Behavior

#### Claude Code (.mcp.json)

**Status:** ✅ **CONFIRMED WORKING**

**Expansion Scope:**

- `command` paths
- `args` array values
- `env` object values

**Documentation:** https://docs.anthropic.com/en/docs/claude-code/mcp

**Example:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "${MCP_BIN_PATH}/mcp-server-filesystem",
      "args": ["${PROJECT_ROOT}"],
      "env": {
        "ALLOWED_DIRS": "${ALLOWED_DIRS}"
      }
    }
  }
}
```

#### Claude Desktop (claude_desktop_config.json)

**Status:** ⚠️ **PARTIAL / UNCONFIRMED**

**Known Issue:** GitHub issue #1254 reports environment variables from `env` section not being passed to MCP servers in some cases.

**User Experience:** User reported trying `"API_KEY": "${CONTEXT7_API_KEY}"` and it didn't work (could be user error or bug).

**Recommendation:** Test thoroughly before relying on env var expansion in Claude Desktop.

**Possible Workaround:** Hardcode values or use alternative secret management.

#### GitHub Copilot CLI (mcp-config.json)

**Status:** ✅ **CONFIRMED WORKING (v0.0.340+)**

**Documentation:** As of version 0.0.340, environment variables in MCP server configurations must use explicit `${VAR}` syntax.

**Expansion Scope:**

- `command` and `args`
- `env` object
- `headers` for HTTP/SSE servers

**Example:**

```json
{
  "mcpServers": {
    "api-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

#### VS Code / JetBrains Copilot (mcp.json)

**Status:** ❌ **NOT SUPPORTED NATIVELY**

**Alternative:** Use VS Code `inputs` feature:

```json
{
  "inputs": [
    {
      "id": "api-key",
      "type": "promptString",
      "description": "Enter API Key",
      "password": true
    }
  ],
  "servers": {
    "github": {
      "command": "mcp-server-github",
      "args": [],
      "env": {
        "API_KEY": "${input:api-key}"
      }
    }
  }
}
```

**Limitation:** Prompts user every time (not ideal for automated workflows).

**Feature Request:** GitHub issue #264448 requests native env var support in VS Code mcp.json.

**Workaround:** Use `envmcp` package:

```json
{
  "servers": {
    "github": {
      "command": "envmcp",
      "args": ["mcp-server-github"]
    }
  }
}
```

Then create `.env.mcp`:

```
GITHUB_TOKEN=ghp_your_token_here
```

### 2.4 Overture Environment Variable Strategy

**Problem:** Inconsistent env var support across clients means Overture can't rely on `${VAR}` expansion everywhere.

**Solution Options:**

#### Option A: Client-Aware Expansion (RECOMMENDED)

Overture performs expansion BEFORE writing client config:

```yaml
# ~/.config/overture.yml
mcp:
  github:
    command: 'mcp-server-github'
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}' # Overture config uses ${VAR}
```

When syncing:

- **Claude Code:** Write `${GITHUB_TOKEN}` (client expands it)
- **Claude Desktop:** Write `${GITHUB_TOKEN}` (client might expand it)
- **VS Code:** Read `process.env.GITHUB_TOKEN` and write literal value
- **Copilot CLI:** Write `${GITHUB_TOKEN}` (client expands it)

**Implementation:**

```typescript
function generateClientConfig(mcp: McpConfig, client: Client): ClientConfig {
  if (client.supportsEnvExpansion) {
    // Write ${VAR} syntax as-is
    return { ...mcp };
  } else {
    // Expand now using process.env
    return {
      ...mcp,
      command: expandEnvVars(mcp.command),
      args: mcp.args.map(expandEnvVars),
      env: Object.fromEntries(
        Object.entries(mcp.env).map(([k, v]) => [k, expandEnvVars(v)]),
      ),
    };
  }
}
```

#### Option B: Secrets File (ALTERNATIVE)

Use a separate `~/.config/overture/secrets.yml` (gitignored):

```yaml
# ~/.config/overture/secrets.yml (gitignored)
secrets:
  GITHUB_TOKEN: 'ghp_actual_token_here'
  CONTEXT7_API_KEY: 'key_here'
```

```yaml
# ~/.config/overture.yml (can be committed)
mcp:
  github:
    command: 'mcp-server-github'
    env:
      GITHUB_TOKEN: '!secret GITHUB_TOKEN' # Reference to secrets file
```

Overture injects actual values when syncing.

**Pros:**

- Works regardless of client env var support
- Secrets never in version control
- Single source of truth for secrets

**Cons:**

- Another file to manage
- Overture becomes secret manager (scope creep?)

#### Option C: .env Integration

Overture reads `.env` file (gitignored) and injects values:

```bash
# .env (gitignored)
GITHUB_TOKEN=ghp_token_here
CONTEXT7_API_KEY=key_here
```

```yaml
# ~/.config/overture.yml
mcp:
  github:
    command: 'mcp-server-github'
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}' # From .env
```

Overture uses dotenv library to load `.env` before syncing.

**Pros:**

- Standard pattern (.env files)
- Works with existing workflows
- Gitignore prevents secrets in VCS

**Cons:**

- Requires .env in multiple locations (user + project)
- Not all clients support .env

### 2.5 Recommendation

**For v0.2:** Use **Option A (Client-Aware Expansion)**.

**Rationale:**

- Minimal scope (no secrets management complexity)
- Respects client capabilities
- Allows env vars where supported (Claude Code, Copilot CLI)
- Falls back to literal expansion where not supported (VS Code)

**For v0.3+:** Consider adding **Option B (Secrets File)** as optional feature if user feedback indicates need.

---

## 3. Configuration Design: MCP-Centric vs Client-Centric (NEW)

### 3.1 Design Pattern Comparison

#### Option A: MCP-Centric (CURRENT APPROACH)

**Config Structure:**

```yaml
mcp:
  github:
    command: mcp-server-github
    clients:
      include: [claude-code, cursor]
      exclude: [copilot-cli]
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}'
```

**Pros:**

- ✅ Natural mental model: "What MCPs do I have, and where should they go?"
- ✅ Scales better with many MCPs (100+ MCPs vs 10 clients)
- ✅ Easy to add/remove MCPs
- ✅ Follows package manager patterns (npm, apt, brew)
- ✅ Client inclusion/exclusion is optional metadata

**Cons:**

- ❌ Verbose if many clients need exclusions
- ❌ Repetitive `include`/`exclude` for related MCPs

#### Option B: Client-Centric

**Config Structure:**

```yaml
clients:
  claude-code:
    mcps:
      include: [github, memory, python-repl]
      exclude: [docker]

  cursor:
    mcps:
      include: [github, memory]
      exclude: [python-repl, docker]

  vscode:
    mcps:
      include: [memory]
```

**Pros:**

- ✅ Clear view of what each client gets
- ✅ Easy to compare client configs
- ✅ Natural for "client-first" thinking

**Cons:**

- ❌ Massive duplication: Most MCPs go to ALL clients
- ❌ Harder to maintain: Change MCP name = update in 6 places
- ❌ Counter-intuitive: Users think in terms of MCPs, not clients
- ❌ Doesn't scale: 100 MCPs × 6 clients = 600 entries

### 3.2 Hybrid Approach (BEST OF BOTH)

**Config Structure:**

```yaml
# Global defaults
defaults:
  clients: [claude-code, claude-desktop, cursor, vscode] # All MCPs go here by default

# MCP definitions (MCP-centric)
mcp:
  # Most MCPs use defaults
  github:
    command: mcp-server-github
    # No clients specified = uses defaults (all clients)

  memory:
    command: mcp-server-memory
    # No clients specified = uses defaults (all clients)

  # Specialized MCP with exclusions
  python-repl:
    command: uvx mcp-server-python-repl
    clients:
      exclude: [copilot-cli] # Don't need Python REPL in CLI

  # Project-specific MCP
  project-db:
    command: mcp-server-sqlite
    clients:
      include: [claude-code] # Only in Claude Code

# Client overrides (client-centric exceptions)
clients:
  windsurf:
    max_servers: 100 # Tool limit
    priority_mcps: [memory, github, filesystem] # Ensure these are included

  claude-desktop:
    exclude_transports: [http, sse] # Free tier limitation
```

**Best of Both:**

- MCP-centric for most configs (DRY principle)
- Client-centric for client-specific constraints
- Defaults minimize repetition
- Clear override mechanism

### 3.3 Real-World Example Comparison

**Scenario:** User has 10 MCPs, wants 8 in all clients, 2 specialized.

#### MCP-Centric:

```yaml
mcp:
  github: { command: mcp-server-github }
  memory: { command: mcp-server-memory }
  filesystem: { command: mcp-server-filesystem }
  context7: { command: mcp-server-context7 }
  sqlite: { command: mcp-server-sqlite }
  python-repl: { command: mcp-server-python-repl }
  ruff: { command: mcp-server-ruff }
  docker: { command: mcp-server-docker }

  # Specialized
  kubernetes:
    command: mcp-server-k8s
    clients:
      include: [claude-code] # Only in Claude Code

  local-db:
    command: mcp-server-postgres
    clients:
      include: [claude-code, cursor] # Only in these two
```

**Lines of config:** ~20

#### Client-Centric:

```yaml
clients:
  claude-code:
    mcps:
      [
        github,
        memory,
        filesystem,
        context7,
        sqlite,
        python-repl,
        ruff,
        docker,
        kubernetes,
        local-db,
      ]

  claude-desktop:
    mcps:
      [github, memory, filesystem, context7, sqlite, python-repl, ruff, docker]

  cursor:
    mcps:
      [
        github,
        memory,
        filesystem,
        context7,
        sqlite,
        python-repl,
        ruff,
        docker,
        local-db,
      ]

  vscode:
    mcps:
      [github, memory, filesystem, context7, sqlite, python-repl, ruff, docker]

  copilot-cli:
    mcps:
      [github, memory, filesystem, context7, sqlite, python-repl, ruff, docker]

  windsurf:
    mcps:
      [github, memory, filesystem, context7, sqlite, python-repl, ruff, docker]
```

**Lines of config:** ~12 + massive duplication

**Maintenance cost:** Change MCP name → update in 6 places.

### 3.4 Recommendation

**Use Hybrid MCP-Centric with Defaults** (Option A + enhancements).

**Rationale:**

1. **Scales better:** Most configs are "all clients" (use defaults)
2. **Less duplication:** Define MCP once, include everywhere
3. **Easier maintenance:** Change MCP name in one place
4. **Follows conventions:** Package managers (npm, cargo, pip) are package-centric, not platform-centric
5. **Natural mental model:** "I have these MCPs, some are specialized"

**Implementation in v0.2:**

```yaml
# ~/.config/overture.yml
version: '2.0'

# Default clients for all MCPs (unless overridden)
defaults:
  clients: [claude-code, claude-desktop, cursor, vscode]

# MCP definitions (MCP-centric)
mcp:
  github:
    command: mcp-server-github
    # Uses defaults: all 4 clients

  python-repl:
    command: uvx mcp-server-python-repl
    clients:
      exclude: [vscode] # Override defaults

# Client-specific settings
clients:
  windsurf:
    enabled: false # Don't sync to Windsurf at all
```

---

## 4. File Organization Strategy (NEW)

### 4.1 Options Analysis

#### Option A: Single File (SIMPLE)

```
~/.config/overture.yml
```

**Contents:** All config in one place (MCPs, clients, plugins, secrets refs).

**Pros:**

- ✅ Simple: One file to edit
- ✅ Easy to read: See everything at once
- ✅ Familiar: Most dotfiles use single files (.gitconfig, .zshrc)
- ✅ Easier to sync: Dotfiles repos commit single file

**Cons:**

- ❌ Large file: 50+ MCPs = hundreds of lines
- ❌ No secrets isolation: `env` vars mixed with config
- ❌ Hard to organize: All concerns in one file

#### Option B: Multiple Files (ORGANIZED)

```
~/.config/overture/
├── config.yml           # Main config (clients, defaults)
├── mcp-servers.yml      # MCP definitions
├── plugins.yml          # Plugin configurations
├── workflows.yml        # Workflow templates (v0.3+)
└── secrets.yml          # Secrets (gitignored)
```

**Pros:**

- ✅ Organized: Separation of concerns
- ✅ Secrets isolation: `secrets.yml` gitignored separately
- ✅ Scalable: Easier to manage 100+ MCPs in dedicated file
- ✅ Modular: Can version control some files, not others

**Cons:**

- ❌ Complex: Multiple files to manage
- ❌ Hard to sync: Dotfiles repos need multiple files
- ❌ Cognitive overhead: "Where does this config go?"
- ❌ Reference complexity: Cross-file references needed

### 4.2 Hybrid Option (RECOMMENDED)

**For v0.2:** Start with **Single File** (`~/.config/overture.yml`).

**For v0.3+:** Split when file becomes unwieldy (~500 lines?).

**Rationale:**

- Single file is simpler for early adopters
- Easier to document and explain
- Dotfiles integration is straightforward
- Can migrate to multiple files without breaking changes

**Migration Path:**

```yaml
# ~/.config/overture.yml (v0.2)
version: '2.0'
mcp: { ... }
clients: { ... }
```

Later:

```yaml
# ~/.config/overture/config.yml (v0.3+)
version: '3.0'
import:
  - mcp-servers.yml
  - secrets.yml
```

### 4.3 Secrets Handling in Single File

**Problem:** Secrets in `~/.config/overture.yml` are committed to dotfiles repos.

**Solution:** Use environment variable references in config, actual values in environment:

```yaml
# ~/.config/overture.yml (safe to commit)
mcp:
  github:
    command: mcp-server-github
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}' # Reference, not value
```

```bash
# ~/.zshrc or ~/.bashrc (actual secrets)
export GITHUB_TOKEN="ghp_actual_token_here"
export CONTEXT7_API_KEY="key_here"
```

**Alternative:** Use separate `.env` file:

```yaml
# ~/.config/overture.yml
env_file: '~/.config/overture.env' # Gitignored
```

```bash
# ~/.config/overture.env (gitignored)
GITHUB_TOKEN=ghp_token_here
CONTEXT7_API_KEY=key_here
```

### 4.4 Recommendation

**For v0.2:** Single file (`~/.config/overture.yml`) with env var references.

**For v0.3:** Add optional `env_file` support.

**For v0.4+:** Consider multi-file split if user feedback indicates need.

---

## 5. Version Management Design (NEW)

### 5.1 MCP Server Versioning Options

#### Option A: Separate Version Field (RECOMMENDED)

```yaml
mcp:
  filesystem:
    command: npx
    args: ['-y']
    package: '@modelcontextprotocol/server-filesystem'
    version: '1.2.3'
```

**Generated command:** `npx -y @modelcontextprotocol/server-filesystem@1.2.3`

**Pros:**

- ✅ Explicit: Version is clearly separated
- ✅ Manageable: Easy to update versions programmatically
- ✅ Queryable: `overture outdated` can check version mismatches
- ✅ Lockfile support: Can generate `overture.lock` with exact versions

**Cons:**

- ❌ Package manager specific: Assumes `@package@version` syntax
- ❌ Redundant: Version info in two places (package + version field)

#### Option B: Version in Args

```yaml
mcp:
  filesystem:
    command: npx
    args: ['-y', '@modelcontextprotocol/server-filesystem@1.2.3']
```

**Pros:**

- ✅ Simple: One field
- ✅ Flexible: Works with any command structure
- ✅ Explicit: Exactly what gets executed

**Cons:**

- ❌ Hard to parse: Need regex to extract version
- ❌ No programmatic updates: Can't easily change version
- ❌ No `overture outdated` command: Can't detect version drift

#### Option C: Optional Version Field with Defaults

```yaml
mcp:
  filesystem:
    command: npx
    args: ['-y', '@modelcontextprotocol/server-filesystem']
    version: 'latest' # Or "1.2.3", "^1.0.0", etc.
```

**Behavior:**

- `version: "latest"` → `npx -y @modelcontextprotocol/server-filesystem` (no @version)
- `version: "1.2.3"` → `npx -y @modelcontextprotocol/server-filesystem@1.2.3`
- No `version` field → defaults to `"latest"`

**Pros:**

- ✅ Flexible: Version optional
- ✅ Explicit when needed: Pin versions for stability
- ✅ Manageable: Programmatic version updates possible

**Cons:**

- ❌ Package manager specific: Assumes npm/pip versioning syntax
- ❌ Complex: Need to parse package managers (npm vs pip vs cargo)

### 5.2 Version Syntax Standards

**NPM (JavaScript):**

```yaml
version: "1.2.3"        # Exact
version: "^1.2.3"       # Compatible (1.x.x, >= 1.2.3)
version: "~1.2.3"       # Patch updates (1.2.x)
version: "latest"       # Latest stable
```

**PyPI (Python):**

```yaml
version: "1.2.3"        # Exact
version: ">=1.2.3"      # Minimum
version: "~=1.2.3"      # Compatible (~= 1.2.3 means >= 1.2.3, < 1.3.0)
version: "latest"       # Latest stable
```

**Cargo (Rust):**

```yaml
version: "1.2.3"        # Exact
version: "^1.2.3"       # Compatible
version: "*"            # Latest
```

### 5.3 Implementation Strategy

**Recommended Approach:** Option C (Optional Version Field with Defaults)

**Config Schema:**

```yaml
mcp:
  filesystem:
    command: npx
    args: ['-y', '@modelcontextprotocol/server-filesystem']
    version: '1.2.3' # Optional, defaults to "latest"
    package_manager: npm # Optional, auto-detected from command
```

**Generation Logic:**

```typescript
function generateCommand(mcp: McpConfig): string[] {
  const baseArgs = [...mcp.args];

  if (mcp.version && mcp.version !== 'latest') {
    // Inject version into package name
    const packageIndex = baseArgs.findIndex((arg) => arg.startsWith('@'));
    if (packageIndex >= 0) {
      baseArgs[packageIndex] = `${baseArgs[packageIndex]}@${mcp.version}`;
    }
  }

  return [mcp.command, ...baseArgs];
}
```

**Lock File Support (v0.3+):**

Generate `overture.lock`:

```yaml
# overture.lock
lockfile_version: 1
generated: 2025-11-11T12:00:00Z

mcp:
  filesystem:
    package: '@modelcontextprotocol/server-filesystem'
    version: '1.2.3'
    resolved: 'https://registry.npmjs.org/@modelcontextprotocol/server-filesystem/-/server-filesystem-1.2.3.tgz'
    integrity: 'sha512-...'
```

**Outdated Detection (v0.3+):**

```bash
overture outdated

Package                                Current    Latest
@modelcontextprotocol/server-filesystem 1.2.3      1.3.0
mcp-server-memory                       2.0.0      2.1.1
```

### 5.4 Recommendation

**For v0.2:** Support optional `version` field, default to "latest" (no version suffix).

**For v0.3:** Add lockfile generation and `overture outdated` command.

**For v0.4:** Add `overture update` to bump versions automatically.

---

## 6. Transport Handling: Required Field (NEW)

### 6.1 Transport Types

**Standard MCP Transports:**

1. **stdio** - Standard input/output (most common)
2. **http** - HTTP with optional SSE streaming (modern standard)
3. **sse** - Server-Sent Events (legacy, deprecated in spec 2024-11-05)

### 6.2 Transport Support by Client

| Client            | stdio | http         | sse          | Default |
| ----------------- | ----- | ------------ | ------------ | ------- |
| Claude Code       | ✅    | ✅           | ✅           | stdio   |
| Claude Desktop    | ✅    | ⚠️ Paid only | ⚠️ Paid only | stdio   |
| VS Code           | ✅    | ❌           | ✅           | stdio   |
| JetBrains Copilot | ✅    | ❌           | ✅           | stdio   |
| Copilot CLI       | ✅    | ✅           | ✅           | stdio   |
| Cursor            | ✅    | ✅           | ⚠️ Unknown   | stdio   |
| Windsurf          | ✅    | ✅           | ⚠️ Unknown   | stdio   |

### 6.3 Current Problem: Implicit Transport

**VS Code Schema Requires `type` Field:**

```json
{
  "servers": {
    "github": {
      "type": "stdio", // REQUIRED in VS Code
      "command": "mcp-server-github",
      "args": []
    }
  }
}
```

**Other Clients Assume stdio if Not Specified:**

```json
{
  "mcpServers": {
    "github": {
      // No type field needed - assumes stdio
      "command": "mcp-server-github",
      "args": []
    }
  }
}
```

**Problem:** Overture needs to know transport to generate correct schema per client.

### 6.4 Solution: Required Transport Field

**Overture Config Schema:**

```yaml
mcp:
  github:
    command: mcp-server-github
    transport: stdio # REQUIRED
    args: []

  remote-server:
    url: https://mcp-server.example.com
    transport: http # REQUIRED
```

**Validation:**

```typescript
const TransportSchema = z.enum(['stdio', 'http', 'sse']);

const McpServerSchema = z.discriminatedUnion('transport', [
  z.object({
    transport: z.literal('stdio'),
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  }),
  z.object({
    transport: z.enum(['http', 'sse']),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
  }),
]);
```

**Client Adapter Logic:**

```typescript
function generateClientConfig(mcp: McpConfig, client: Client): ClientConfig {
  // VS Code requires type field
  if (client === 'vscode' || client === 'jetbrains-copilot') {
    return {
      type: mcp.transport, // Add type field
      ...mcp,
    };
  }

  // Claude Desktop free tier excludes http/sse
  if (
    client === 'claude-desktop' &&
    !user.isPaid &&
    mcp.transport !== 'stdio'
  ) {
    console.warn(
      `Skipping ${mcp.name}: Claude Desktop free tier only supports stdio`,
    );
    return null; // Skip this MCP
  }

  // Other clients don't need type field
  return mcp;
}
```

### 6.5 Transport Validation Rules

**Rule 1: VS Code / JetBrains Copilot**

- Require `type` field in generated config
- Validate transport is supported (stdio, sse only)
- Error if http transport specified (not supported)

**Rule 2: Claude Desktop**

- Warn if http/sse transport on free tier
- Allow stdio always
- Check user tier (if detectable)

**Rule 3: Windsurf**

- Support stdio and http
- Validate against tool limit (100 tools)

**Rule 4: All Clients**

- Validate transport is in enum (stdio, http, sse)
- Error if unsupported transport for client

### 6.6 Recommendation

**For v0.2:** Make `transport` a required field in Overture config.

**Rationale:**

1. Eliminates client schema differences
2. Enables validation before sync
3. Makes transport explicit (better UX)
4. Allows client-specific filtering (free tier Claude Desktop)

**Implementation:**

```yaml
# ~/.config/overture.yml
mcp:
  github:
    transport: stdio # REQUIRED
    command: mcp-server-github
    args: []
```

**Error if missing:**

```bash
overture validate
❌ Error: MCP "github" missing required field: transport
   Valid values: stdio, http, sse
```

---

## 7. GitHub Copilot CLI Bundled MCP Configuration (NEW)

### 7.1 Bundled GitHub MCP Details

**Status:** GitHub Copilot CLI ships with the GitHub MCP server pre-configured.

**Capabilities:**

- Merge pull requests
- Search issues
- Read repository contents
- Interact with GitHub.com resources

**Config Location:** `~/.config/mcp-config.json` (or `~/.copilot/mcp-config.json`)

**Pre-configured by default:** No manual setup required.

### 7.2 GITHUB_TOOLSETS Environment Variable

**Purpose:** Controls which GitHub MCP tools are exposed.

**Research Finding:** Not explicitly documented in web search results, but mentioned in passing.

**Hypothesis:** Likely a feature flag to enable/disable specific GitHub MCP tool categories.

**Needs Further Research:**

- What are valid GITHUB_TOOLSETS values?
- How does it affect MCP behavior?
- Is it required or optional?

### 7.3 User Configuration of Bundled GitHub MCP

**User Feedback:** "Even though GitHub Copilot CLI bundles GitHub MCP, we should configure it."

**Rationale:**

- Customize GitHub API base URL
- Add authentication tokens
- Configure GitHub Enterprise endpoints
- Enable/disable specific tool sets

**Example Custom Config:**

```yaml
# ~/.config/overture.yml
mcp:
  github:
    command: mcp-server-github # Override bundled config
    transport: http
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}'
      GITHUB_API_URL: 'https://github.example.com/api/v3'
      GITHUB_TOOLSETS: 'issues,pulls,repos' # Hypothesis
    clients:
      include: [copilot-cli, claude-code] # Add to both clients
```

### 7.4 Overture Behavior with Bundled MCPs

**Question:** Should Overture treat bundled GitHub MCP as:

1. **Pre-configured** - Add to other clients, don't modify Copilot CLI config
2. **User-configurable** - Allow overriding bundled config in Copilot CLI

**Recommendation:** **User-configurable** (Option 2)

**Rationale:**

- Users may need custom GitHub Enterprise endpoints
- Token management needs consistency across clients
- Toolsets may need fine-tuning

**Implementation:**

```yaml
# Built-in exclusion (Overture internal logic)
builtin_exclusions:
  github:
    skip_default_in: [copilot-cli]
    reason: 'Bundled by default, but user can override'
```

**Behavior:**

- **If user defines github MCP in Overture config:**
  - Sync to Copilot CLI (override bundled config)
  - Sync to other clients as well

- **If user does NOT define github MCP:**
  - Skip syncing to Copilot CLI (use bundled config)
  - Don't add to other clients

**User Control:**

```yaml
# User explicitly wants bundled GitHub MCP in all clients
mcp:
  github:
    bundled_in: [copilot-cli] # Reference bundled config
    command: mcp-server-github # Explicit for other clients
    transport: http
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}'
```

### 7.5 Detection Strategy

**Challenge:** How does Overture know GitHub MCP is bundled in Copilot CLI?

**Solution:** Hardcoded knowledge in Overture:

```typescript
const BUNDLED_MCPS: Record<string, string[]> = {
  github: ['copilot-cli'],
  // Future: Other clients may bundle MCPs
};

function isBundled(mcpName: string, client: string): boolean {
  return BUNDLED_MCPS[mcpName]?.includes(client) ?? false;
}
```

**Validation Command:**

```bash
overture audit

Bundled MCPs:
  ✓ GitHub MCP in GitHub Copilot CLI (bundled by default)
  ⚠ GitHub MCP also configured in user config (will override bundled)
```

### 7.6 Recommendation

**For v0.2:**

- Hardcode GitHub MCP as bundled in Copilot CLI
- Allow user override if explicitly defined in config
- Warn in `overture audit` if overriding bundled MCP

**For v0.3:**

- Research GITHUB_TOOLSETS environment variable
- Add documentation for GitHub Enterprise configuration
- Consider auto-detection of bundled MCPs

---

## 8. Updated Implementation Priority (NEW)

### 8.1 Revised Client Priority

**Changes from v1:**

- JetBrains GitHub Copilot plugin moved to Tier 2 (now supported)
- Priority order updated based on user needs

**New Priority Order:**

1. **Claude Code** (Tier 1)
2. **Claude Desktop** (Tier 1)
3. **VS Code (GitHub Copilot)** (Tier 2)
4. **JetBrains (GitHub Copilot plugin)** (Tier 2) - **NEW**
5. **GitHub Copilot CLI** (Tier 2) - **MOVED UP**
6. **Cursor** (Tier 3)
7. **Windsurf** (Tier 3)

**Rationale:**

- JetBrains has large developer base, should be prioritized
- GitHub Copilot CLI moved up due to bundled MCP research needs
- Cursor/Windsurf deferred to later (smaller user bases)

### 8.2 Tier 1 Clients (MVP - Overture v0.2.0)

#### Claude Code

**Priority:** 🔥 Highest  
**Complexity:** ⭐ Low  
**Schema:** `mcpServers` (standard)  
**Env Vars:** ✅ Supported (`${VAR}`)  
**Transport:** stdio, http, sse (all supported)  
**Scope:** Global + Project

**Implementation Notes:**

- Already implemented in v0.1 (project-level)
- v0.2 adds user-level config (`~/.claude.json`)
- No schema conversion needed
- Env var expansion works natively

#### Claude Desktop

**Priority:** 🔥 Highest  
**Complexity:** ⭐ Low  
**Schema:** `mcpServers` (standard)  
**Env Vars:** ⚠️ Partial support (test needed)  
**Transport:** stdio only (free tier), http/sse (paid tier)  
**Scope:** User only

**Implementation Notes:**

- Same schema as Claude Code (easy adapter reuse)
- Need to handle transport limitations on free tier
- Requires restart after config changes (notify user)
- Env var expansion may not work (needs testing)

### 8.3 Tier 2 Clients (Overture v0.2.1)

#### VS Code (GitHub Copilot)

**Priority:** 🔸 High  
**Complexity:** ⭐⭐ Medium  
**Schema:** `servers` (different from standard)  
**Env Vars:** ❌ Not supported (use `inputs` or expand in Overture)  
**Transport:** stdio, sse (http not supported)  
**Scope:** Global + Workspace

**Implementation Notes:**

- Schema conversion required (`mcpServers` → `servers`)
- Add `type` field (required by VS Code)
- Env var expansion in Overture (client doesn't support `${VAR}`)
- Validate transport (http not supported)

#### JetBrains (GitHub Copilot plugin)

**Priority:** 🔸 High (NEW)  
**Complexity:** ⭐⭐ Medium  
**Schema:** `servers` (same as VS Code)  
**Env Vars:** ❌ Not supported (same as VS Code)  
**Transport:** stdio, sse (http not supported)  
**Scope:** Workspace + User (Windows only confirmed)

**Implementation Notes:**

- **Reuse VS Code adapter** for workspace config (`.vscode/mcp.json`)
- Separate adapter for user-level config (Windows path confirmed)
- Need research for macOS/Linux user config paths
- Agent mode must be enabled (validation check?)

**Path Detection:**

```typescript
function detectJetBrainsCopilotPaths(): ClientPaths {
  const workspace = path.join(projectRoot, '.vscode', 'mcp.json');

  if (process.platform === 'win32') {
    const user = path.join(
      process.env.LOCALAPPDATA,
      'github-copilot',
      'intellij',
      'mcp.json',
    );
    return { workspace, user };
  }

  // macOS/Linux: Research needed
  return { workspace };
}
```

#### GitHub Copilot CLI

**Priority:** 🔸 High (MOVED UP from Tier 3)  
**Complexity:** ⭐⭐ Medium  
**Schema:** `mcpServers` (standard)  
**Env Vars:** ✅ Supported (`${VAR}`)  
**Transport:** stdio, http, sse (all supported)  
**Scope:** User only

**Implementation Notes:**

- XDG Base Directory compliance (check `$XDG_CONFIG_HOME`)
- Bundled GitHub MCP needs special handling
- Env var expansion works natively
- Path detection: `~/.config/mcp-config.json` or `~/.copilot/mcp-config.json`

**Bundled MCP Handling:**

```typescript
function syncToCopilotCli(mcps: McpConfig[]): void {
  const filtered = mcps.filter((mcp) => {
    if (mcp.name === 'github' && !mcp.userDefined) {
      console.log('Skipping github MCP (bundled in Copilot CLI)');
      return false;
    }
    return true;
  });

  writeCopilotCliConfig(filtered);
}
```

### 8.4 Tier 3 Clients (Overture v0.3.0)

#### Cursor

**Priority:** 🔹 Medium  
**Complexity:** ⭐ Low  
**Schema:** `mcpServers` (standard)  
**Env Vars:** ⚠️ Unknown (needs testing)  
**Transport:** stdio, http (sse unknown)  
**Scope:** Global + Project

**Implementation Notes:**

- Same schema as Claude Code (adapter reuse)
- Test env var expansion support
- Settings UI should reflect changes

#### Windsurf

**Priority:** 🔹 Medium  
**Complexity:** ⭐⭐ Medium  
**Schema:** `mcpServers` (standard)  
**Env Vars:** ⚠️ Unknown (needs testing)  
**Transport:** stdio, http (sse unknown)  
**Scope:** User only

**Implementation Notes:**

- 100 tool limit (need prioritization logic)
- Plugin store UI (check for conflicts?)
- HTTP transport supported (test implementation)

### 8.5 Implementation Roadmap

**Overture v0.2.0 (MVP):**

- [x] v0.1 features (already complete)
- [ ] User global config (`~/.config/overture.yml`)
- [ ] Claude Code user config sync
- [ ] Claude Desktop adapter
- [ ] User/project precedence logic
- [ ] Basic exclusion system
- [ ] Transport validation
- [ ] Env var expansion (client-aware)

**Overture v0.2.1 (Extended):**

- [ ] VS Code adapter (schema conversion)
- [ ] JetBrains Copilot adapter (reuse VS Code adapter + user config)
- [ ] GitHub Copilot CLI adapter (bundled MCP handling)
- [ ] Path detection for all Tier 2 clients
- [ ] `overture audit` command

**Overture v0.3.0 (Full Support):**

- [ ] Cursor adapter
- [ ] Windsurf adapter (with tool limit handling)
- [ ] Version management (lockfile)
- [ ] `overture outdated` command
- [ ] Enhanced documentation templates

---

## 9. Adapter Interface Design (NEW)

### 9.1 Adapter Pattern

**Goal:** Isolate client-specific logic into adapters.

**Interface:**

```typescript
interface ClientAdapter {
  name: string;

  // Path detection
  detectConfigPaths(): ClientPaths;

  // Schema conversion
  convertToClientSchema(mcps: McpConfig[]): ClientConfig;

  // Capabilities
  supportsEnvExpansion(): boolean;
  supportedTransports(): Transport[];
  requiresRestart(): boolean;

  // Validation
  validate(config: ClientConfig): ValidationResult;

  // Read/Write
  readConfig(path: string): ClientConfig | null;
  writeConfig(path: string, config: ClientConfig): void;

  // Merge
  mergeConfigs(global: McpConfig[], project: McpConfig[]): McpConfig[];
}
```

### 9.2 Adapter Implementations

#### ClaudeCodeAdapter

```typescript
class ClaudeCodeAdapter implements ClientAdapter {
  name = 'claude-code';

  detectConfigPaths(): ClientPaths {
    return {
      global: path.join(os.homedir(), '.claude.json'),
      project: path.join(process.cwd(), '.mcp.json'),
    };
  }

  convertToClientSchema(mcps: McpConfig[]): ClientConfig {
    return {
      mcpServers: Object.fromEntries(
        mcps.map((mcp) => [
          mcp.name,
          {
            command: mcp.command,
            args: mcp.args,
            env: mcp.env,
          },
        ]),
      ),
    };
  }

  supportsEnvExpansion(): boolean {
    return true; // ${VAR} works
  }

  supportedTransports(): Transport[] {
    return ['stdio', 'http', 'sse'];
  }

  requiresRestart(): boolean {
    return false; // Auto-reloads
  }
}
```

#### ClaudeDesktopAdapter

```typescript
class ClaudeDesktopAdapter extends ClaudeCodeAdapter {
  name = 'claude-desktop';

  detectConfigPaths(): ClientPaths {
    const platform = process.platform;
    let configPath: string;

    if (platform === 'darwin') {
      configPath = path.join(
        os.homedir(),
        'Library/Application Support/Claude/claude_desktop_config.json',
      );
    } else if (platform === 'win32') {
      configPath = path.join(
        process.env.APPDATA!,
        'Claude/claude_desktop_config.json',
      );
    } else {
      configPath = path.join(
        os.homedir(),
        '.config/Claude/claude_desktop_config.json',
      );
    }

    return { global: configPath };
  }

  supportsEnvExpansion(): boolean {
    return false; // Questionable, needs testing
  }

  supportedTransports(): Transport[] {
    // Check if user has paid plan (how?)
    const isPaid = detectClaudePlan();
    return isPaid ? ['stdio', 'http', 'sse'] : ['stdio'];
  }

  requiresRestart(): boolean {
    return true; // Full quit required
  }
}
```

#### VSCodeAdapter

```typescript
class VSCodeAdapter implements ClientAdapter {
  name = 'vscode';

  detectConfigPaths(): ClientPaths {
    const platform = process.platform;
    let userConfig: string;

    if (platform === 'darwin') {
      userConfig = path.join(
        os.homedir(),
        'Library/Application Support/Code/User/mcp.json',
      );
    } else if (platform === 'win32') {
      userConfig = path.join(process.env.APPDATA!, 'Code/User/mcp.json');
    } else {
      userConfig = path.join(os.homedir(), '.config/Code/User/mcp.json');
    }

    return {
      global: userConfig,
      workspace: path.join(process.cwd(), '.vscode/mcp.json'),
    };
  }

  convertToClientSchema(mcps: McpConfig[]): ClientConfig {
    return {
      servers: Object.fromEntries(
        // Note: "servers" not "mcpServers"
        mcps.map((mcp) => [
          mcp.name,
          {
            type: mcp.transport, // Add type field (required)
            command: mcp.command,
            args: mcp.args,
            env: this.expandEnvVars(mcp.env), // Expand here, client doesn't support ${VAR}
          },
        ]),
      ),
    };
  }

  supportsEnvExpansion(): boolean {
    return false; // Must expand in Overture
  }

  supportedTransports(): Transport[] {
    return ['stdio', 'sse']; // http not supported
  }

  requiresRestart(): boolean {
    return false; // Auto-reloads
  }

  private expandEnvVars(env: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(env).map(([k, v]) => [k, this.replaceEnvVars(v)]),
    );
  }

  private replaceEnvVars(value: string): string {
    return value.replace(/\${(\w+)}/g, (match, varName) => {
      return process.env[varName] || match;
    });
  }
}
```

#### JetBrainsCopilotAdapter

```typescript
class JetBrainsCopilotAdapter extends VSCodeAdapter {
  name = 'jetbrains-copilot';

  detectConfigPaths(): ClientPaths {
    const workspace = path.join(process.cwd(), '.vscode/mcp.json');

    if (process.platform === 'win32') {
      const user = path.join(
        process.env.LOCALAPPDATA!,
        'github-copilot/intellij/mcp.json',
      );
      return { workspace, user };
    }

    // macOS/Linux: Research needed
    // TODO: Find macOS and Linux paths
    return { workspace };
  }

  // Inherit schema conversion, env expansion, etc. from VSCodeAdapter
}
```

#### CopilotCLIAdapter

```typescript
class CopilotCLIAdapter implements ClientAdapter {
  name = 'copilot-cli';

  detectConfigPaths(): ClientPaths {
    const xdgConfig =
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');

    const paths = [
      path.join(xdgConfig, 'mcp-config.json'),
      path.join(os.homedir(), '.copilot/mcp-config.json'),
    ];

    // Return first existing path, or default to XDG path
    const existingPath = paths.find((p) => fs.existsSync(p));
    return { global: existingPath || paths[0] };
  }

  convertToClientSchema(mcps: McpConfig[]): ClientConfig {
    // Filter out bundled GitHub MCP if user didn't explicitly define it
    const filtered = mcps.filter((mcp) => {
      if (mcp.name === 'github' && !mcp.userDefined) {
        return false; // Skip bundled MCP
      }
      return true;
    });

    return {
      mcpServers: Object.fromEntries(
        filtered.map((mcp) => [
          mcp.name,
          {
            command: mcp.command,
            args: mcp.args,
            env: mcp.env,
          },
        ]),
      ),
    };
  }

  supportsEnvExpansion(): boolean {
    return true; // ${VAR} works
  }

  supportedTransports(): Transport[] {
    return ['stdio', 'http', 'sse'];
  }

  requiresRestart(): boolean {
    return false; // Auto-reloads
  }
}
```

### 9.3 Adapter Registry

```typescript
class AdapterRegistry {
  private adapters = new Map<string, ClientAdapter>();

  register(adapter: ClientAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): ClientAdapter | undefined {
    return this.adapters.get(name);
  }

  all(): ClientAdapter[] {
    return Array.from(this.adapters.values());
  }

  detect(): ClientAdapter[] {
    return this.all().filter((adapter) => {
      const paths = adapter.detectConfigPaths();
      return Object.values(paths).some((p) => p && fs.existsSync(p));
    });
  }
}

// Usage
const registry = new AdapterRegistry();
registry.register(new ClaudeCodeAdapter());
registry.register(new ClaudeDesktopAdapter());
registry.register(new VSCodeAdapter());
registry.register(new JetBrainsCopilotAdapter());
registry.register(new CopilotCLIAdapter());

// Detect installed clients
const installedClients = registry.detect();
console.log(
  'Detected clients:',
  installedClients.map((c) => c.name),
);
```

### 9.4 Sync Orchestration

```typescript
async function syncAllClients(
  overtureConfig: OvertureConfig,
  registry: AdapterRegistry,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const adapter of registry.all()) {
    // Check if client is enabled
    if (!overtureConfig.clients[adapter.name]?.enabled) {
      continue;
    }

    // Get MCPs for this client
    const mcps = filterMcpsForClient(
      overtureConfig.mcp,
      adapter.name,
      overtureConfig.defaults,
    );

    // Filter by transport support
    const supportedMcps = mcps.filter((mcp) =>
      adapter.supportedTransports().includes(mcp.transport),
    );

    // Convert to client schema
    const clientConfig = adapter.convertToClientSchema(supportedMcps);

    // Validate
    const validation = adapter.validate(clientConfig);
    if (!validation.valid) {
      results.push({
        client: adapter.name,
        success: false,
        errors: validation.errors,
      });
      continue;
    }

    // Write config
    const paths = adapter.detectConfigPaths();
    for (const [scope, path] of Object.entries(paths)) {
      if (path) {
        adapter.writeConfig(path, clientConfig);
      }
    }

    results.push({ client: adapter.name, success: true });
  }

  return results;
}
```

---

## 10. Backup & Diff Strategy (NEW)

### 10.1 Why Backup?

**Problem:** `overture sync` modifies existing client configs. If something goes wrong, users lose their manual configs.

**Solution:** Backup before changes, allow restore, show diffs.

### 10.2 Backup Strategy

**Backup Location:** `~/.config/overture/backups/`

**Naming Convention:** `{client}-{timestamp}.json`

**Example:**

```
~/.config/overture/backups/
├── claude-code-2025-11-11T12-00-00.json
├── claude-desktop-2025-11-11T12-00-05.json
├── vscode-2025-11-11T12-00-10.json
└── ...
```

**Retention:** Keep last 10 backups per client.

### 10.3 Diff Before Sync

**Show user what will change:**

```bash
overture sync --dry-run

Changes to claude-code (~/.claude.json):
+ Added: memory MCP
+ Added: context7 MCP
~ Modified: github MCP (updated env.GITHUB_TOKEN)
- Removed: (none)

Changes to claude-desktop:
+ Added: memory MCP
+ Added: context7 MCP

Changes to vscode:
+ Added: memory MCP (with type: "stdio")
```

**Implementation:**

```typescript
function diffConfigs(before: ClientConfig, after: ClientConfig): ConfigDiff {
  const diff: ConfigDiff = {
    added: [],
    modified: [],
    removed: [],
  };

  const beforeServers = before.mcpServers || before.servers || {};
  const afterServers = after.mcpServers || after.servers || {};

  // Find added
  for (const name of Object.keys(afterServers)) {
    if (!beforeServers[name]) {
      diff.added.push(name);
    }
  }

  // Find modified
  for (const name of Object.keys(afterServers)) {
    if (beforeServers[name]) {
      if (!deepEqual(beforeServers[name], afterServers[name])) {
        diff.modified.push({
          name,
          changes: getChanges(beforeServers[name], afterServers[name]),
        });
      }
    }
  }

  // Find removed
  for (const name of Object.keys(beforeServers)) {
    if (!afterServers[name]) {
      diff.removed.push(name);
    }
  }

  return diff;
}
```

### 10.4 Restore Command

```bash
# List backups
overture backup list

Backups:
  claude-code:
    - 2025-11-11 12:00:00 (1.2KB)
    - 2025-11-10 15:30:00 (1.1KB)
    - 2025-11-09 09:15:00 (1.0KB)

  claude-desktop:
    - 2025-11-11 12:00:05 (800B)
    - 2025-11-10 15:30:10 (750B)

# Restore specific backup
overture backup restore claude-code --timestamp 2025-11-11T12:00:00

# Restore latest backup
overture backup restore claude-code --latest

# Restore all clients to latest
overture backup restore --all --latest
```

**Implementation:**

```typescript
async function restoreBackup(client: string, timestamp: string): Promise<void> {
  const backupPath = path.join(BACKUP_DIR, `${client}-${timestamp}.json`);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`);
  }

  const adapter = registry.get(client);
  const paths = adapter.detectConfigPaths();
  const backup = fs.readFileSync(backupPath, 'utf-8');

  // Restore to all paths
  for (const path of Object.values(paths)) {
    if (path) {
      fs.writeFileSync(path, backup);
      console.log(`✓ Restored ${client} to ${path}`);
    }
  }
}
```

### 10.5 Merge vs Replace

**Options when syncing:**

1. **Replace** - Overwrite entire client config (destructive)
2. **Merge** - Add Overture MCPs, keep user's custom MCPs (safe)

**Recommended:** **Merge** (default)

**Implementation:**

```typescript
function mergeClientConfig(
  existing: ClientConfig,
  overture: ClientConfig,
  mode: 'merge' | 'replace',
): ClientConfig {
  if (mode === 'replace') {
    return overture;
  }

  // Merge mode: Combine existing + overture
  const existingServers = existing.mcpServers || existing.servers || {};
  const overtureServers = overture.mcpServers || overture.servers || {};

  return {
    mcpServers: {
      ...existingServers, // Keep user's custom MCPs
      ...overtureServers, // Overture MCPs win if conflict
    },
  };
}
```

**User Control:**

```bash
# Default: merge
overture sync

# Replace existing config (destructive)
overture sync --replace

# Show diff before merging
overture sync --dry-run
```

---

## 11. Audit Command Design (NEW)

### 11.1 Purpose

**Goal:** Report MCPs configured in clients but NOT in Overture config.

**Use Case:** User manually added MCPs to clients. Overture should detect this and suggest consolidation.

### 11.2 Audit Output

```bash
overture audit

Auditing MCP configurations across clients...

✓ Claude Code (~/.claude.json)
  Overture-managed: github, memory, filesystem
  User-managed: custom-mcp (not in Overture config)

✓ Claude Desktop
  Overture-managed: github, memory, filesystem
  User-managed: (none)

✓ VS Code (.vscode/mcp.json)
  Overture-managed: memory
  User-managed: docker, kubernetes (not in Overture config)

⚠ Cursor (~/.cursor/mcp.json)
  File not found (client not configured)

Recommendations:
  - Add custom-mcp to Overture config: overture add custom-mcp
  - Add docker to Overture config: overture add docker
  - Add kubernetes to Overture config: overture add kubernetes
```

### 11.3 Implementation

```typescript
interface AuditResult {
  client: string;
  configPath: string;
  overtureManaged: string[];
  userManaged: string[];
  errors: string[];
}

async function auditClients(
  overtureConfig: OvertureConfig,
  registry: AdapterRegistry,
): Promise<AuditResult[]> {
  const results: AuditResult[] = [];
  const overtureMcps = new Set(Object.keys(overtureConfig.mcp));

  for (const adapter of registry.all()) {
    const paths = adapter.detectConfigPaths();

    for (const [scope, configPath] of Object.entries(paths)) {
      if (!configPath || !fs.existsSync(configPath)) {
        continue;
      }

      const clientConfig = adapter.readConfig(configPath);
      if (!clientConfig) {
        results.push({
          client: adapter.name,
          configPath,
          overtureManaged: [],
          userManaged: [],
          errors: ['Failed to parse config'],
        });
        continue;
      }

      const clientMcps = new Set(
        Object.keys(clientConfig.mcpServers || clientConfig.servers || {}),
      );

      const overtureManaged = Array.from(clientMcps).filter((name) =>
        overtureMcps.has(name),
      );

      const userManaged = Array.from(clientMcps).filter(
        (name) => !overtureMcps.has(name),
      );

      results.push({
        client: adapter.name,
        configPath,
        overtureManaged,
        userManaged,
        errors: [],
      });
    }
  }

  return results;
}
```

### 11.4 Consolidation Command

**Help user move user-managed MCPs into Overture config:**

```bash
overture consolidate

Found 3 user-managed MCPs across clients:
  1. custom-mcp (in claude-code)
  2. docker (in vscode)
  3. kubernetes (in vscode)

Import these into Overture config? (y/n): y

Reading MCP definitions from client configs...
✓ Added custom-mcp to ~/.config/overture.yml
✓ Added docker to ~/.config/overture.yml
✓ Added kubernetes to ~/.config/overture.yml

Run 'overture sync' to sync these MCPs to all enabled clients.
```

**Implementation:**

```typescript
async function consolidate(
  overtureConfigPath: string,
  auditResults: AuditResult[],
  registry: AdapterRegistry,
): Promise<void> {
  const overtureConfig = loadOvertureConfig(overtureConfigPath);
  let added = 0;

  for (const result of auditResults) {
    const adapter = registry.get(result.client);
    const clientConfig = adapter.readConfig(result.configPath);

    for (const mcpName of result.userManaged) {
      const mcpDef =
        clientConfig.mcpServers[mcpName] || clientConfig.servers[mcpName];

      // Convert client schema back to Overture schema
      const overtureMcp: McpConfig = {
        command: mcpDef.command,
        args: mcpDef.args || [],
        env: mcpDef.env || {},
        transport: mcpDef.type || 'stdio', // Infer from type field
        scope: 'global', // Default to global
      };

      overtureConfig.mcp[mcpName] = overtureMcp;
      added++;
    }
  }

  saveOvertureConfig(overtureConfigPath, overtureConfig);
  console.log(`✓ Added ${added} MCPs to Overture config`);
}
```

---

## 12. Process Locking (NEW)

### 12.1 Problem

**Scenario:** User runs `overture sync` in two terminals simultaneously.

**Risk:**

- Race condition writing to same config files
- Corrupted JSON files
- Lost changes

### 12.2 Solution: File Locking

**Lockfile Location:** `~/.config/overture/.lock`

**Behavior:**

- `overture sync` creates lockfile before writing
- Other `overture sync` processes wait or fail
- Lockfile removed after sync completes

### 12.3 Implementation

```typescript
import lockfile from 'proper-lockfile';

const LOCK_PATH = path.join(os.homedir(), '.config/overture/.lock');

async function sync(config: OvertureConfig): Promise<void> {
  let release: () => void;

  try {
    // Acquire lock (wait up to 10 seconds)
    release = await lockfile.lock(LOCK_PATH, {
      stale: 10000, // Lockfile expires after 10s
      retries: {
        retries: 5,
        minTimeout: 1000,
        maxTimeout: 3000,
      },
    });

    console.log('Acquired lock, syncing...');

    // Perform sync
    await syncAllClients(config, registry);
  } catch (err) {
    if (err.code === 'ELOCKED') {
      console.error(
        'Another Overture process is already running. Please wait.',
      );
      process.exit(1);
    }
    throw err;
  } finally {
    // Release lock
    if (release) {
      await release();
    }
  }
}
```

### 12.4 User Experience

**Normal case:**

```bash
overture sync
Syncing MCP configurations...
✓ Claude Code
✓ Claude Desktop
Done.
```

**Conflict case:**

```bash
# Terminal 1
overture sync
Syncing MCP configurations...

# Terminal 2 (simultaneous)
overture sync
Another Overture process is already running. Please wait.
```

---

## 13. Updated Recommendations for Overture v0.2

### 13.1 Must-Have Features

1. **User Global Config**
   - Location: `~/.config/overture.yml`
   - Single file (not split)
   - MCP-centric schema with defaults

2. **Tier 1 Client Adapters**
   - Claude Code (global + project)
   - Claude Desktop (with transport limits)

3. **Environment Variable Handling**
   - Client-aware expansion
   - `${VAR}` syntax supported where possible
   - Literal expansion for VS Code/JetBrains

4. **Transport Validation**
   - Required `transport` field in Overture config
   - Validate against client capabilities
   - Warn on unsupported transports

5. **Backup & Diff**
   - Backup before sync
   - Show diff with `--dry-run`
   - Restore command

6. **Process Locking**
   - Prevent concurrent sync
   - Clear error messages

### 13.2 Should-Have Features

1. **Tier 2 Client Adapters**
   - VS Code (schema conversion)
   - JetBrains Copilot (reuse VS Code adapter)
   - GitHub Copilot CLI (bundled MCP handling)

2. **Audit Command**
   - Detect user-managed MCPs
   - Suggest consolidation

3. **Version Management**
   - Optional `version` field
   - Defaults to "latest"

### 13.3 Nice-to-Have Features

1. **Consolidate Command**
   - Import user-managed MCPs into Overture config

2. **Tier 3 Client Adapters**
   - Cursor
   - Windsurf (with tool limit)

3. **Enhanced Validation**
   - Check MCP command existence
   - Warn on Claude Desktop free tier HTTP transports

### 13.4 Deferred to v0.3+

1. **Lockfile generation** (`overture.lock`)
2. **`overture outdated` command**
3. **Multi-file config** (split into multiple YAML files)
4. **Secrets management** (dedicated secrets file)
5. **Enhanced documentation templates**

---

## 14. Open Questions and Research Gaps

### 14.1 Critical Research Needed

1. **JetBrains Copilot Plugin User Config Paths**
   - ✅ Windows: `%LOCALAPPDATA%\github-copilot\intellij\mcp.json` (confirmed)
   - ❓ macOS: Likely `~/Library/Application Support/github-copilot/intellij/mcp.json` (unconfirmed)
   - ❓ Linux: Likely `~/.local/share/github-copilot/intellij/mcp.json` or `~/.config/github-copilot/intellij/mcp.json` (unconfirmed)

2. **Claude Desktop Environment Variable Support**
   - ❓ Does `${VAR}` expansion work reliably?
   - ❓ GitHub issue #1254 reports problems - is this resolved?
   - 🧪 **Action:** Test in Claude Desktop before v0.2 release

3. **Cursor Environment Variable Support**
   - ❓ Does `${VAR}` syntax work?
   - 🧪 **Action:** Test in Cursor

4. **Windsurf Environment Variable Support**
   - ❓ Does `${VAR}` syntax work?
   - 🧪 **Action:** Test in Windsurf

5. **GitHub Copilot CLI GITHUB_TOOLSETS**
   - ❓ What are valid values?
   - ❓ How does it affect bundled GitHub MCP?
   - 📚 **Action:** Research GitHub Copilot CLI docs

### 14.2 Questions to Resolve

1. **Claude Desktop Paid Tier Detection**
   - How can Overture detect if user has paid Claude plan?
   - Should Overture warn when syncing HTTP MCP to free-tier Claude Desktop?
   - **Workaround:** Ask user to set `claude_plan: free|paid` in config

2. **Windsurf Tool Limit Prioritization**
   - How should Overture prioritize which MCPs to sync (limit: 100 tools)?
   - Should there be a `priority` field?
   - Should Overture count tools per MCP?

3. **VS Code Schema Validation**
   - Is there a canonical JSON schema for VS Code MCP config?
   - Should Overture validate against it?

4. **Config File Permissions**
   - What if `~/.config/overture.yml` has wrong permissions?
   - Should Overture validate file permissions?

5. **Cross-Platform Testing**
   - How to test Overture on all platforms (Windows, macOS, Linux)?
   - Should there be CI/CD tests for each platform?

### 14.3 Future Research Topics

1. **Agent → MCP Automatic Mappings (v0.4)**
   - Extract agent/skill metadata from plugins
   - Build community-driven mappings database
   - ML-based usage pattern analysis

2. **Multi-Tenant Support**
   - Team-level Overture configs (shared across team members)
   - Organization-level MCP server configs

3. **MCP Registry Integration**
   - Fetch MCP definitions from public registry
   - `overture install <mcp-name>` downloads from registry

4. **IDE Extensions**
   - VS Code extension for Overture
   - JetBrains plugin for Overture
   - GUI for managing Overture config

---

## 15. Conclusion

This v2 research report addresses critical gaps from v1 and provides actionable recommendations for Overture v0.2 implementation.

**Key Takeaways:**

1. **JetBrains Copilot plugin is supported** - Uses `.vscode/mcp.json` for workspace config (same as VS Code adapter)
2. **Environment variable support is inconsistent** - Overture should expand client-side where not supported
3. **MCP-centric config design scales better** - Use hybrid approach with defaults
4. **Single file for v0.2, split later** - Start simple, add complexity as needed
5. **Transport should be required** - Eliminates client schema ambiguities
6. **Version management should be optional** - Defaults to "latest"
7. **Backup before sync is critical** - Prevent data loss from misconfiguration
8. **Process locking prevents race conditions** - Use file-based locking

**Implementation Priority for v0.2:**

1. Claude Code (complete in v0.1, add user config)
2. Claude Desktop (new adapter)
3. VS Code (schema conversion)
4. JetBrains Copilot (reuse VS Code adapter)
5. GitHub Copilot CLI (bundled MCP handling)

**Next Steps:**

1. Finalize `~/.config/overture.yml` schema with Zod
2. Implement adapter interface and Tier 1 adapters
3. Build backup/restore functionality
4. Add process locking
5. Test environment variable expansion across clients
6. Research JetBrains Copilot macOS/Linux paths
7. Implement audit and consolidate commands

---

**Report Prepared By:** Claude Code (Sonnet 4.5)  
**Research Date:** 2025-11-11  
**Document Version:** 2.0  
**Previous Version:** 2025-11-10 (v1.0)
