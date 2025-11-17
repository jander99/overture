# MCP Client Configuration Research Report

**⚠️ ARCHIVED:** This research document is from November 2025 and describes the state of MCP configuration at that time. Some implementation details may be outdated.

**Research Date:** 2025-11-10
**Purpose:** Document MCP server configuration across multiple AI development clients to inform Overture v0.2 multi-platform support

---

## Executive Summary

This report documents MCP (Model Context Protocol) server configuration across 7 major AI development clients. Key findings:

- **6 of 7 clients** actively support MCP configuration (JetBrains is server-only)
- **Configuration formats** are mostly JSON, with minor schema variations
- **Path conventions** follow platform-specific standards (XDG on Linux, AppData on Windows, Library/Application Support on macOS)
- **Bundled MCPs** are minimal - only GitHub Copilot CLI bundles the GitHub MCP by default
- **Transport types** vary - most support stdio, some support HTTP/SSE
- **Schema inconsistency** exists between `mcpServers` (most clients) and `servers` (Visual Studio)

---

## 1. Client Configuration Matrix

### 1.1 Complete Client Comparison Table

| Client | macOS Config Location | Linux Config Location | Windows Config Location | Format | Scope Support | MCP Support |
|--------|----------------------|----------------------|------------------------|--------|---------------|-------------|
| **Claude Code** | `~/.claude.json` (global)<br>`.mcp.json` (project) | `~/.claude.json` (global)<br>`.mcp.json` (project) | `%USERPROFILE%\.claude.json` (global)<br>`.mcp.json` (project) | JSON | Global + Project | ✅ Full |
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` | `~/.config/Claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` | JSON | User only | ✅ Full (stdio)<br>⚠️ HTTP/SSE (paid tiers only) |
| **GitHub Copilot CLI** | `~/.config/mcp-config.json`<br>`~/.copilot/mcp-config.json` | `~/.config/mcp-config.json`<br>or `$XDG_CONFIG_HOME/mcp-config.json` | `%USERPROFILE%\.config\mcp-config.json` | JSON | User only | ✅ Full (bundled GitHub MCP) |
| **VS Code** (Copilot) | `.vscode/mcp.json` (workspace)<br>`~/Library/Application Support/Code/User/mcp.json` (global) | `.vscode/mcp.json` (workspace)<br>`~/.config/Code/User/mcp.json` (global) | `.vscode\mcp.json` (workspace)<br>`%APPDATA%\Code\User\mcp.json` (global) | JSON | Global + Workspace | ✅ Full (requires VS Code 1.99+) |
| **Cursor** | `~/.cursor/mcp.json` (global)<br>`.cursor/mcp.json` (project) | `~/.cursor/mcp.json` (global)<br>`.cursor/mcp.json` (project) | `%USERPROFILE%\.cursor\mcp.json` (global)<br>`.cursor\mcp.json` (project) | JSON | Global + Project | ✅ Full |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | JSON | User only | ✅ Full (stdio + HTTP) |
| **JetBrains** (IntelliJ/PyCharm) | N/A - Server mode only | N/A - Server mode only | N/A - Server mode only | N/A | N/A | ⚠️ **MCP Server** (not client)<br>Configured via Settings \| Tools \| MCP Server |

### 1.2 Configuration File Format Variations

**Standard Format (Used by most clients):**
```json
{
  "mcpServers": {
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

**Visual Studio Format (Different schema):**
```json
{
  "servers": {
    "server-name": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "server-name"]
    }
  }
}
```

**Windsurf Format (Optional HTTP):**
```json
{
  "mcpServers": {
    "remote-server": {
      "url": "https://mcp-server-url.com"
    }
  }
}
```

### 1.3 Transport Type Support by Client

| Client | stdio | HTTP | SSE | Notes |
|--------|-------|------|-----|-------|
| Claude Code | ✅ | ✅ | ✅ | All transport types supported |
| Claude Desktop | ✅ | ⚠️ | ⚠️ | HTTP/SSE only on paid plans |
| GitHub Copilot CLI | ✅ | ✅ | ✅ | Bundled GitHub MCP via HTTP |
| VS Code | ✅ | ❌ | ✅ | stdio and SSE supported |
| Cursor | ✅ | ✅ | ⚠️ | Primarily stdio, some HTTP support |
| Windsurf | ✅ | ✅ | ⚠️ | Supports streamable HTTP |
| JetBrains | ✅ | ❌ | ✅ | Exports via SSE/stdio for external clients |

---

## 2. Bundled MCP Analysis

### 2.1 Default/Bundled MCP Servers

**GitHub Copilot CLI:**
- **Bundled:** GitHub MCP server (pre-configured)
- **Purpose:** GitHub.com resource access (merge PRs, read repos, etc.)
- **Configuration:** Automatic - no manual setup required
- **Opt-out:** Use `--enable-all-github-mcp-tools` flag to expose full tool set
- **Location:** Built into Copilot CLI binary

**All Other Clients:**
- **Bundled MCPs:** None
- **Registry Support:** 
  - GitHub Copilot: GitHub MCP Registry integration
  - Windsurf: Built-in plugin store for MCP servers
  - Others: Manual configuration required

### 2.2 Pre-configured vs User-configured

| Client | Pre-configured MCPs | User Configuration Method |
|--------|---------------------|--------------------------|
| Claude Code | None | Manual JSON editing or `claude mcp add` |
| Claude Desktop | None | Manual JSON editing |
| GitHub Copilot CLI | **GitHub MCP** (bundled) | JSON editing or MCP Registry |
| VS Code | None | UI (MCP: Open User Configuration) or JSON |
| Cursor | None | Settings UI or JSON editing |
| Windsurf | None | Plugin Store UI or JSON editing |
| JetBrains | None | Settings \| Tools \| MCP Server (exports config) |

### 2.3 Implications for Overture

**Key Insight:** Only GitHub Copilot CLI bundles an MCP by default. This means:

1. **Duplication Risk is Low** - Most clients start with empty MCP configs
2. **No Conflict Resolution Needed** - GitHub MCP is specific to Copilot CLI
3. **Overture Should:**
   - **Skip GitHub MCP** when syncing to Copilot CLI (already bundled)
   - **Not add GitHub MCP** to other clients (Copilot-specific)
   - **Track bundled MCPs** per client to avoid redundant config

---

## 3. Metadata Schema Recommendation

### 3.1 Proposed MCP Server Metadata Schema

Based on client requirements, Overture should track the following metadata for each MCP:

```yaml
# ~/.config/overture.yml
mcp:
  server-name:
    # Core Configuration (required)
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-name"]
    env:
      API_KEY: "${API_KEY}"
    
    # Scope Configuration (required)
    scope: global | project
    
    # Client Configuration (optional)
    clients:
      # Client exclusions - skip syncing to these clients
      exclude:
        - github-copilot-cli  # Already bundled
        - jetbrains           # Not an MCP client
      
      # Client-specific overrides
      overrides:
        vscode:
          # VS Code uses "type" field
          type: "stdio"
        
        windsurf:
          # Windsurf has tool limit
          enabled: true
          priority: high  # Ensure it's in top 100 tools
    
    # Transport Configuration (optional)
    transport:
      - stdio
      - http
      - sse
    
    # Metadata (optional)
    metadata:
      description: "Server description"
      homepage: "https://github.com/org/repo"
      tags: ["development", "testing"]
      
    # Platform Configuration (optional)
    platforms:
      exclude:
        - windows  # Don't sync to Windows
      
      path_overrides:
        macos: "/opt/homebrew/bin/mcp-server"
        linux: "/usr/local/bin/mcp-server"
```

### 3.2 Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `command` | string | Executable to run | `"npx"` |
| `args` | array | Command arguments | `["-y", "server-name"]` |
| `scope` | enum | `global` or `project` | `"global"` |

### 3.3 Optional Fields

| Field | Type | Description | Use Case |
|-------|------|-------------|----------|
| `env` | object | Environment variables | API keys, tokens |
| `clients.exclude` | array | Skip syncing to these clients | Avoid duplicating bundled MCPs |
| `clients.overrides` | object | Client-specific config | Handle VS Code schema differences |
| `transport` | array | Supported transports | Inform client compatibility |
| `platforms.exclude` | array | Skip on these platforms | Platform-specific tools |
| `metadata` | object | Descriptive information | Documentation, discoverability |

### 3.4 Special Handling Requirements

**Client-Specific Field Mapping:**

```typescript
// Example: Converting Overture config to client-specific format
const clientAdapters = {
  vscode: (mcp) => ({
    servers: {  // Note: "servers" not "mcpServers"
      [mcp.name]: {
        type: mcp.transport[0] || "stdio",
        command: mcp.command,
        args: mcp.args,
        env: mcp.env
      }
    }
  }),
  
  claudeDesktop: (mcp) => ({
    mcpServers: {
      [mcp.name]: {
        command: mcp.command,
        args: mcp.args,
        env: mcp.env
      }
    }
  }),
  
  windsurf: (mcp) => ({
    mcpServers: {
      [mcp.name]: mcp.transport.includes('http') 
        ? { url: mcp.url }  // HTTP transport
        : { command: mcp.command, args: mcp.args, env: mcp.env }
    }
  })
};
```

---

## 4. Exclusion System Design

### 4.1 Exclusion Levels

Overture should support **three levels of exclusions**:

1. **Global Exclusions** - Skip syncing certain MCPs to specific clients globally
2. **Client Exclusions** - User-configured per-MCP exclusions
3. **Platform Exclusions** - Skip MCPs on specific operating systems

### 4.2 Global Exclusion Rules

**Built-in Exclusions (Hardcoded in Overture):**

```yaml
# Internal to Overture - not user-editable
builtin_exclusions:
  github-mcp:
    exclude_clients:
      - github-copilot-cli  # Already bundled
      reason: "Bundled by default in Copilot CLI"
  
  jetbrains-mcp:
    exclude_clients:
      - claude-code
      - claude-desktop
      - cursor
      - vscode
      - windsurf
      reason: "JetBrains MCP is a server, not consumed by other clients"
```

### 4.3 User-Configured Exclusions

**Per-MCP Exclusions:**

```yaml
# ~/.config/overture.yml
mcp:
  python-repl:
    command: "uvx"
    args: ["mcp-server-python-repl"]
    scope: global
    
    # User wants this in Claude Code only
    clients:
      include:
        - claude-code  # Whitelist approach
      # OR
      exclude:
        - claude-desktop
        - cursor
        - vscode
```

**Global Client Disablement:**

```yaml
# ~/.config/overture.yml
clients:
  windsurf:
    enabled: false  # Don't sync to Windsurf at all
  
  vscode:
    enabled: true
    max_servers: 50  # Limit number of synced servers
```

### 4.4 Platform-Specific Exclusions

```yaml
# ~/.config/overture.yml
mcp:
  sqlite:
    command: "uvx"
    args: ["mcp-server-sqlite"]
    scope: global
    
    platforms:
      exclude:
        - windows  # SQLite path issues on Windows
      
      command_overrides:
        windows: "python"  # Use different command on Windows
        windows_args: ["-m", "mcp_server_sqlite"]
```

### 4.5 Exclusion Priority

When multiple exclusions conflict:

1. **Platform exclusions** (highest priority)
2. **Client include/exclude lists**
3. **Global client disablement**
4. **Built-in exclusions** (lowest priority)

**Example Resolution:**

```yaml
mcp:
  my-server:
    platforms:
      exclude: [windows]  # Priority 1
    clients:
      exclude: [cursor]   # Priority 2
```

Result: On Windows, excluded everywhere. On macOS/Linux, excluded only from Cursor.

---

## 5. Path Override Mechanism

### 5.1 Platform Path Standards

**XDG Base Directory Specification (Linux):**

- Config: `$XDG_CONFIG_HOME` (default: `~/.config`)
- Data: `$XDG_DATA_HOME` (default: `~/.local/share`)
- Cache: `$XDG_CACHE_HOME` (default: `~/.cache`)

**macOS Standard Directories:**

- Config: `~/Library/Application Support/<AppName>`
- Cache: `~/Library/Caches/<AppName>`
- Logs: `~/Library/Logs/<AppName>`

**Windows Known Folders:**

- Roaming Config: `%APPDATA%` (e.g., `C:\Users\User\AppData\Roaming`)
- Local Config: `%LOCALAPPDATA%` (e.g., `C:\Users\User\AppData\Local`)
- Temp: `%LOCALAPPDATA%\Temp`

### 5.2 Default Path Resolution Strategy

**Overture should detect config files in this order:**

1. **Project-level** (highest priority)
   - `.mcp.json` (Claude Code, Cursor)
   - `.vscode/mcp.json` (VS Code)
   - `.cursor/mcp.json` (Cursor)

2. **User-level** (client-specific)
   - Client-specific paths (see section 1.1)

3. **Fallback to environment variables**
   - `$XDG_CONFIG_HOME/mcp-config.json` (Linux)
   - `$APPDATA/Claude/claude_desktop_config.json` (Windows)

### 5.3 User Path Overrides

Allow users to override default locations:

```yaml
# ~/.config/overture.yml
clients:
  claude-desktop:
    config_path: "/custom/path/to/claude_desktop_config.json"
  
  vscode:
    user_config_path: "~/my-vscode/mcp.json"
    workspace_config_path: "${PROJECT_ROOT}/.vscode/mcp.json"
  
  cursor:
    config_path:
      macos: "~/custom-cursor/mcp.json"
      linux: "~/.config/cursor-custom/mcp.json"
      windows: "%USERPROFILE%\\CursorCustom\\mcp.json"
```

### 5.4 Environment Variable Expansion

Support environment variable expansion in paths:

**Supported Variables:**

| Variable | Platform | Expands To | Example |
|----------|----------|------------|---------|
| `~` | All | User home directory | `~/config` → `/home/user/config` |
| `${HOME}` | All | User home directory | `${HOME}/.config` |
| `${XDG_CONFIG_HOME}` | Linux | XDG config dir (default: `~/.config`) | `${XDG_CONFIG_HOME}/mcp.json` |
| `${APPDATA}` | Windows | Roaming AppData | `${APPDATA}\Claude\config.json` |
| `${LOCALAPPDATA}` | Windows | Local AppData | `${LOCALAPPDATA}\Temp` |
| `${PROJECT_ROOT}` | All | Current project directory | `${PROJECT_ROOT}/.mcp.json` |

**Implementation Example:**

```typescript
function expandPath(path: string, platform: NodeJS.Platform): string {
  let expanded = path;
  
  // Expand tilde
  if (expanded.startsWith('~')) {
    expanded = expanded.replace('~', os.homedir());
  }
  
  // Expand environment variables
  expanded = expanded.replace(/\${(\w+)}/g, (match, varName) => {
    if (varName === 'PROJECT_ROOT') {
      return process.cwd();
    }
    return process.env[varName] || match;
  });
  
  // Platform-specific expansion
  if (platform === 'win32') {
    expanded = expanded.replace(/%(\w+)%/g, (match, varName) => {
      return process.env[varName] || match;
    });
  }
  
  return path.resolve(expanded);
}
```

### 5.5 Path Detection and Validation

**Auto-Detection Strategy:**

1. Check for explicit `config_path` override in `~/.config/overture.yml`
2. Check default locations for each client (OS-specific)
3. Check environment variable locations (`$XDG_CONFIG_HOME`, etc.)
4. If none found, use default location for `overture sync`

**Validation:**

```bash
# overture validate --verbose should report:
✓ Claude Desktop config: ~/Library/Application Support/Claude/claude_desktop_config.json (exists)
✓ Claude Code global: ~/.claude.json (exists)
✓ VS Code user config: ~/.config/Code/User/mcp.json (exists)
✗ Cursor global: ~/.cursor/mcp.json (not found - will be created)
⚠ Windsurf config: ~/.codeium/windsurf/mcp_config.json (permission denied)
```

---

## 6. Implementation Priority

### 6.1 Client Implementation Tiers

**Tier 1 (High Priority - Implement First):**

1. **Claude Code**
   - **Reason:** Overture is built for Claude Code ecosystem
   - **Complexity:** Low - simple JSON schema, well-documented
   - **Usage:** High - primary development environment for users
   - **Scope Support:** Global + Project (ideal for Overture)

2. **Claude Desktop**
   - **Reason:** Most popular Claude client for non-developers
   - **Complexity:** Low - same schema as Claude Code (`mcpServers`)
   - **Usage:** Very high - largest user base
   - **Limitation:** HTTP/SSE only on paid plans

**Tier 2 (Medium Priority - Implement Next):**

3. **Cursor**
   - **Reason:** Popular VS Code alternative with strong MCP support
   - **Complexity:** Low - uses same `mcpServers` schema
   - **Usage:** High among developers
   - **Scope Support:** Global + Project

4. **VS Code (GitHub Copilot)**
   - **Reason:** Largest developer IDE market share
   - **Complexity:** Medium - different schema (`servers` vs `mcpServers`)
   - **Usage:** Very high
   - **Limitation:** Requires VS Code 1.99+, agent mode only

**Tier 3 (Low Priority - Implement Later):**

5. **Windsurf**
   - **Reason:** Emerging IDE, growing user base
   - **Complexity:** Medium - plugin store UI + JSON, 100 tool limit
   - **Usage:** Medium (growing)
   - **Unique Feature:** HTTP transport support

6. **GitHub Copilot CLI**
   - **Reason:** CLI-focused, niche use case
   - **Complexity:** Medium - bundled GitHub MCP needs special handling
   - **Usage:** Low (specialized users)
   - **Unique Feature:** XDG Base Directory compliance

**Excluded from Implementation:**

7. **JetBrains IDEs**
   - **Reason:** JetBrains MCP is a **server**, not a client
   - **Usage:** N/A - other clients connect to JetBrains
   - **Implementation:** Not applicable for Overture

### 6.2 Complexity Analysis

| Client | Schema Complexity | Path Complexity | Special Handling | Overall Complexity |
|--------|-------------------|-----------------|------------------|-------------------|
| Claude Code | ⭐ Low | ⭐ Low | None | ⭐ Low |
| Claude Desktop | ⭐ Low | ⭐⭐ Medium | Transport limits | ⭐ Low |
| Cursor | ⭐ Low | ⭐ Low | None | ⭐ Low |
| VS Code | ⭐⭐ Medium | ⭐⭐ Medium | Schema differences | ⭐⭐ Medium |
| Windsurf | ⭐⭐ Medium | ⭐ Low | 100 tool limit, plugin store | ⭐⭐ Medium |
| GitHub Copilot CLI | ⭐⭐ Medium | ⭐⭐⭐ High | Bundled GitHub MCP, XDG | ⭐⭐⭐ High |

### 6.3 Recommended Implementation Phases

**Phase 1: Core Clients (MVP)**
- Claude Code
- Claude Desktop
- Target: Overture v0.2.0

**Phase 2: VS Code Ecosystem**
- Cursor
- VS Code (GitHub Copilot)
- Target: Overture v0.2.1

**Phase 3: Extended Support**
- Windsurf
- GitHub Copilot CLI
- Target: Overture v0.3.0

**Phase 4: Monitoring Only**
- JetBrains (document as "not applicable")

### 6.4 Testing Strategy by Client

**Claude Code:**
- Test global (`~/.claude.json`) and project (`.mcp.json`) sync
- Verify `overture sync` merges without duplication
- Test `claude mcp add` compatibility

**Claude Desktop:**
- Test stdio-only transport on free tier
- Test HTTP/SSE transport detection (paid tier)
- Verify restart reminder after config changes

**Cursor:**
- Test global (`~/.cursor/mcp.json`) and project (`.cursor/mcp.json`) sync
- Verify Settings UI reflects changes
- Test MCP tool discovery

**VS Code:**
- Test schema conversion (`mcpServers` → `servers`)
- Verify `type` field addition
- Test workspace vs user config priority
- Verify agent mode tool availability

**Windsurf:**
- Test 100 tool limit handling
- Verify plugin store doesn't conflict
- Test HTTP transport config

**GitHub Copilot CLI:**
- Test GitHub MCP exclusion (don't duplicate bundled MCP)
- Verify XDG_CONFIG_HOME override
- Test mcp-config.json vs .copilot/mcp-config.json paths

---

## 7. Additional Findings

### 7.1 Schema Versioning

**Current State:**
- No formal schema version field in `.mcp.json` files
- MCP specification itself is versioned (latest: 2025-06-18)
- Client implementations may drift from spec

**Recommendation:**
```yaml
# Future-proofing Overture config
version: "2.0"  # Overture config version

mcp_spec_version: "2025-06-18"  # MCP specification version

mcp:
  server-name:
    # ... config
```

### 7.2 Security Considerations

**Environment Variable Handling:**
- **DO:** Use `${VAR}` syntax for secrets
- **DON'T:** Hardcode API keys in config files
- **WARNING:** `.mcp.json` may be committed to git - use `.env` files

**Example:**
```json
{
  "mcpServers": {
    "github": {
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### 7.3 Merge Strategies

**Project vs Global Conflict Resolution:**

When same MCP is defined globally and per-project:

1. **Claude Code/Cursor:** Project overrides global
2. **VS Code:** Workspace overrides user
3. **Overture Recommendation:** Project always takes precedence

**Deduplication:**
```typescript
function mergeMcpConfigs(global: MCP[], project: MCP[]): MCP[] {
  const merged = new Map();
  
  // Add global MCPs
  global.forEach(mcp => merged.set(mcp.name, mcp));
  
  // Project overrides global
  project.forEach(mcp => merged.set(mcp.name, mcp));
  
  return Array.from(merged.values());
}
```

### 7.4 Client Update Mechanisms

| Client | Auto-Reload Config | Restart Required | Live Discovery |
|--------|-------------------|------------------|----------------|
| Claude Code | ✅ Yes | ❌ No | ✅ Yes |
| Claude Desktop | ❌ No | ✅ Yes (full quit) | ❌ No |
| Cursor | ⚠️ Partial | ⚠️ Sometimes | ✅ Yes |
| VS Code | ✅ Yes | ❌ No | ✅ Yes |
| Windsurf | ⚠️ Unknown | ⚠️ Unknown | ✅ Plugin Store |
| GitHub Copilot CLI | ✅ Yes | ❌ No | ❌ No |

**Overture Implications:**
- `overture sync` should notify users when restart is required
- Provide `--notify` flag to show desktop notifications

---

## 8. Recommendations for Overture v0.2

### 8.1 Core Features

**Must-Have:**
1. User global config (`~/.config/overture.yml`)
2. Client adapters for Tier 1 clients (Claude Code, Claude Desktop)
3. Path auto-detection with environment variable expansion
4. Basic exclusion system (client-level)
5. Deduplication logic (global + project merge)

**Should-Have:**
1. Client adapters for Tier 2 clients (Cursor, VS Code)
2. Platform-specific exclusions
3. Schema validation for generated configs
4. `overture audit` command to analyze current configs

**Nice-to-Have:**
1. Client adapters for Tier 3 clients (Windsurf, Copilot CLI)
2. Interactive client selection (`overture init --clients`)
3. Dry-run mode (`overture sync --dry-run`)
4. Backup/restore functionality

### 8.2 Configuration Schema for v0.2

**Proposed `~/.config/overture.yml` structure:**

```yaml
version: "2.0"

# Global client settings
clients:
  claude-code:
    enabled: true
    config_path: "~/.claude.json"  # Override default
  
  claude-desktop:
    enabled: true
    # Use default: ~/Library/Application Support/Claude/claude_desktop_config.json
  
  cursor:
    enabled: true
  
  vscode:
    enabled: false  # Don't sync to VS Code
  
  windsurf:
    enabled: false
  
  github-copilot-cli:
    enabled: false

# MCP server definitions
mcp:
  sequentialthinking:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    scope: global
    
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    scope: global
    
  python-repl:
    command: "uvx"
    args: ["mcp-server-python-repl"]
    scope: project
    clients:
      include: [claude-code, cursor]  # Only these clients
    platforms:
      exclude: [windows]  # Linux/macOS only

# Bundled MCP exclusions (built-in to Overture)
bundled_mcps:
  github:
    bundled_in: [github-copilot-cli]
    auto_exclude: true
```

### 8.3 New Commands for v0.2

**User Global Config Management:**
```bash
# Initialize user global config
overture user init

# List all configured MCPs
overture user mcp list

# Add MCP to user global config
overture user mcp add <name> --command <cmd> --args <args>

# Remove MCP from user global config
overture user mcp remove <name>

# Enable/disable clients
overture client enable vscode
overture client disable windsurf
```

**Multi-Client Sync:**
```bash
# Sync to all enabled clients
overture sync --all

# Sync to specific clients
overture sync --clients claude-code,cursor

# Dry run (show what would change)
overture sync --dry-run

# Verbose output
overture sync --verbose
```

**Audit and Validation:**
```bash
# Audit current MCP configurations across all clients
overture audit

# Validate Overture config
overture validate

# Show detected client configurations
overture client list

# Show path detection results
overture paths
```

### 8.4 Implementation Checklist

- [ ] Design `~/.config/overture.yml` schema with Zod
- [ ] Implement path detection logic (XDG, AppData, etc.)
- [ ] Create client adapter interface
- [ ] Implement Tier 1 adapters (Claude Code, Claude Desktop)
- [ ] Implement Tier 2 adapters (Cursor, VS Code)
- [ ] Build exclusion system (client, platform)
- [ ] Implement merge/deduplication logic
- [ ] Add `overture user` command group
- [ ] Add `overture client` command group
- [ ] Add `overture audit` command
- [ ] Update `overture sync` to support multi-client
- [ ] Write tests for path expansion
- [ ] Write tests for schema conversion (VS Code)
- [ ] Write tests for exclusions
- [ ] Write E2E tests for each client adapter
- [ ] Document client-specific behaviors
- [ ] Update README with v0.2 features

---

## 9. Open Questions and Research Gaps

**Questions to Resolve:**

1. **Windsurf 100 Tool Limit:**
   - How should Overture prioritize which MCPs to sync?
   - Should there be a `priority` field in config?
   - Should Overture count tools across all MCPs?

2. **VS Code Schema Differences:**
   - Should Overture validate against VS Code's `servers` schema?
   - Is there a canonical JSON schema for VS Code MCP config?

3. **Claude Desktop Paid Tier Detection:**
   - How can Overture detect if user has paid Claude plan?
   - Should HTTP/SSE MCPs be excluded by default for Claude Desktop?
   - Should Overture warn when syncing HTTP MCP to free-tier Claude Desktop?

4. **JetBrains Integration:**
   - Should Overture support *exporting* JetBrains MCP config to other clients?
   - Should `.overture/config.yaml` include JetBrains server settings?

5. **GitHub Copilot CLI Bundled MCP:**
   - Is there a way to detect if GitHub MCP is enabled/disabled?
   - Should Overture explicitly exclude or just warn?

6. **Config File Locking:**
   - What happens if multiple Overture instances run `sync` simultaneously?
   - Should Overture implement file locking?

**Further Research Needed:**

- [ ] Windsurf tool counting mechanism
- [ ] VS Code official MCP schema documentation
- [ ] Claude Desktop plan detection APIs
- [ ] GitHub Copilot CLI configuration precedence rules
- [ ] JetBrains MCP server export formats

---

## 10. Conclusion

This research provides a comprehensive foundation for implementing multi-platform MCP synchronization in Overture v0.2. Key takeaways:

1. **Schema Consistency is High** - Most clients use `mcpServers`, except VS Code
2. **Path Conventions are Predictable** - XDG/AppData/Library standards apply
3. **Bundled MCPs are Minimal** - Only GitHub Copilot CLI requires exclusion logic
4. **Implementation Complexity is Low-Medium** - Tier 1 clients are straightforward

**Next Steps:**

1. Review this research report with stakeholders
2. Finalize `~/.config/overture.yml` schema
3. Implement Tier 1 client adapters (Claude Code, Claude Desktop)
4. Build test suite for path detection and schema conversion
5. Iterate on exclusion system based on real-world usage

**References:**

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Claude Desktop MCP Documentation](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
- [GitHub Copilot MCP Documentation](https://docs.github.com/copilot/customizing-copilot/using-model-context-protocol/extending-copilot-chat-with-mcp)
- [VS Code MCP Documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/latest/)

---

**Report Prepared By:** Claude Code (Sonnet 4.5)  
**Research Date:** 2025-11-10  
**Document Version:** 1.0
