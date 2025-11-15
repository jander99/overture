# Migration Guide: v0.1 to v0.2

**Version:** 0.2.0  
**Migration Difficulty:** Easy to Moderate  
**Estimated Time:** 5-30 minutes (depending on configuration complexity)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Breaking Changes](#breaking-changes)
3. [New Features Available](#new-features-available)
4. [Migration Steps](#migration-steps)
5. [Migration Scenarios](#migration-scenarios)
6. [Troubleshooting](#troubleshooting)
7. [Command Mapping](#command-mapping)
8. [Rollback Plan](#rollback-plan)
9. [Post-Migration Checklist](#post-migration-checklist)
10. [Getting Help](#getting-help)

---

## Introduction

Overture v0.2 represents a significant evolution from v0.1, transforming from a single-client configuration tool into a comprehensive multi-client MCP orchestration platform.

### Why Migrate?

**v0.2 Benefits:**
- ✨ **Multi-Client Support** — Configure 7 AI clients from one source of truth
- ✨ **User + Project Configs** — Share global MCPs across projects, customize per-project
- ✨ **Automatic Backups** — Every sync creates timestamped backups
- ✨ **Enhanced Validation** — Transport compatibility, platform filtering, circular dependency detection
- ✨ **Audit Tools** — Detect unmanaged MCPs in client configs
- ✨ **Process Safety** — Locking prevents concurrent sync conflicts
- ✨ **Dry-Run Mode** — Preview changes before applying

### Backwards Compatibility

**⚠️ Breaking Changes:** v0.2 introduces schema changes that require manual migration. Your v0.1 config will **not** work without modification.

**Good News:** Migration is straightforward and takes 5-30 minutes depending on complexity.

---

## Breaking Changes

### 1. Config Version Field Required

**Before (v0.1):**
```yaml
mcps:
  filesystem:
    command: npx
```

**After (v0.2):**
```yaml
version: "2.0"  # ← REQUIRED

mcp:
  filesystem:
    command: npx
```

**Why:** Enables schema versioning and future migrations.

---

### 2. Transport Field Now Required

**Before (v0.1):**
```yaml
mcps:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
```

**After (v0.2):**
```yaml
mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"  # ← REQUIRED (stdio | http | sse)
```

**Why:** Enables transport validation and client compatibility checking.

**Valid Values:**
- `"stdio"` — Standard I/O (most common, widest support)
- `"http"` — HTTP/REST endpoints
- `"sse"` — Server-Sent Events

---

### 3. Scope Field Required

**Before (v0.1):**
```yaml
mcps:
  filesystem:
    command: npx
```

**After (v0.2):**
```yaml
mcp:
  filesystem:
    command: npx
    scope: "project"  # ← REQUIRED (global | project)
```

**Why:** Enables user/project config separation.

**Valid Values:**
- `"global"` — Reference to user global config (`~/.config/overture/config.yaml`)
- `"project"` — Defined and managed in project config (`.overture/config.yaml`)

---

### 4. Config File Location Changed

**Before (v0.1):**
```
project-root/
├── .overture.yaml  ← Old location
└── README.md
```

**After (v0.2):**
```
project-root/
├── .overture/
│   └── config.yaml  ← New location
└── README.md
```

**Why:** Supports future `.overture/` directory structure (templates, schemas, etc.).

---

### 5. MCP Server Schema Changed

**Before (v0.1):**
```yaml
mcps:  # ← Old key
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
```

**After (v0.2):**
```yaml
mcp:  # ← New key
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    scope: "project"
    # Optional new fields:
    env:
      FOO: "bar"
    platforms: ["darwin", "linux"]  # Filter by OS
    clients: ["claude-code", "vscode"]  # Filter by client
    excludeClients: ["cursor"]  # Exclude specific clients
```

**New Optional Fields:**
- `env` — Environment variables for MCP process
- `platforms` — Restrict to specific platforms (darwin/linux/win32)
- `clients` — Only include for specific clients
- `excludeClients` — Exclude from specific clients

---

### 6. Command Names Updated

| v0.1 Command | v0.2 Command | Changes |
|--------------|--------------|---------|
| `overture sync` | `overture sync` | Now supports `--client`, `--dry-run`, `--force` |
| `overture validate` | `overture validate` | Enhanced validation (transport, scope, circular deps) |
| `overture mcp list` | `overture mcp list` | Enhanced output with scope, transport |

**New Commands:**
- `overture user init` — Create user global config
- `overture user show` — View merged user + project config
- `overture audit` — Detect unmanaged MCPs
- `overture backup list` — List backups
- `overture backup restore` — Restore from backup

---

## New Features Available

### Multi-Client Support (7 Clients)

Configure all your AI development clients from one config:

```yaml
version: "2.0"

mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    scope: "project"
    # Automatically synced to:
    # - Claude Code (~/.config/claude/mcp.json)
    # - Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json)
    # - VS Code (.vscode/mcp.json)
    # - Cursor (.cursor/mcp.json)
    # - Windsurf (.windsurf/mcp.json)
    # - GitHub Copilot CLI (~/.github-copilot/mcp.json)
    # - JetBrains Copilot (~/.jetbrains/copilot/mcp.json)
```

**Sync to specific clients only:**
```bash
overture sync --client claude-code,vscode
```

---

### User + Project Config Separation

**User Global Config:** `~/.config/overture/config.yaml`
```yaml
version: "2.0"

mcp:
  # Common tools across all projects
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    scope: "global"  # ← Defined here
  
  github:
    command: "mcp-server-github"
    transport: "stdio"
    scope: "global"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

**Project Config:** `.overture/config.yaml`
```yaml
version: "2.0"

mcp:
  # Reference global MCPs
  filesystem:
    scope: "global"  # ← References user config
  
  github:
    scope: "global"
  
  # Project-specific MCP
  python-repl:
    command: "uvx"
    args: ["mcp-server-python-repl"]
    transport: "stdio"
    scope: "project"  # ← Defined here
```

**Benefits:**
- No duplication across projects
- Consistent global tools
- Project-specific customization
- Easier maintenance

---

### Automatic Backups

Before every sync, Overture creates timestamped backups:

```bash
overture sync

# Creates:
# ~/.config/claude/backups/mcp.json.2025-11-11T10-30-45.backup
# .vscode/backups/mcp.json.2025-11-11T10-30-45.backup
```

**List backups:**
```bash
overture backup list claude-code
```

**Restore from backup:**
```bash
overture backup restore claude-code --latest
overture backup restore vscode --timestamp 2025-11-11T10-30-45
```

---

### Enhanced Validation

**Transport Compatibility:**
```yaml
mcp:
  my-http-server:
    transport: "http"  # ← VS Code doesn't support HTTP
    # Validation warns: "HTTP transport not supported by vscode"
    excludeClients: ["vscode"]  # ← Solution
```

**Platform Filtering:**
```yaml
mcp:
  macos-only-tool:
    command: "some-mac-tool"
    transport: "stdio"
    scope: "project"
    platforms: ["darwin"]  # ← Only include on macOS
```

**Circular Dependency Detection:**
```bash
overture validate

# Detects:
# ✗ Circular dependency: mcp-a → mcp-b → mcp-a
```

---

### Audit Command

Detect MCPs in client configs that aren't managed by Overture:

```bash
overture audit

# Output:
# Unmanaged MCPs in claude-code:
#   - some-manual-mcp (not in Overture config)
#   - legacy-tool (not in Overture config)
# 
# Recommendation: Add to .overture/config.yaml or remove from client config
```

---

### Process Locking

Prevents concurrent syncs from corrupting configs:

```bash
# Terminal 1
overture sync  # Acquires lock

# Terminal 2
overture sync  # Waits or fails with "Lock held by PID 12345"
```

---

### Dry-Run Mode

Preview changes before applying:

```bash
overture sync --dry-run

# Shows:
# Would update claude-code:
#   + filesystem (stdio, project)
#   + github (stdio, global)
#   - legacy-mcp (removed)
# 
# Would update vscode:
#   + filesystem (stdio, project)
#   (github excluded - not in clients list)
```

---

## Migration Steps

### Step 1: Backup Existing Config

**Option A: Manual Backup**
```bash
# Backup current config
cp .overture.yaml .overture.yaml.backup

# Backup current client configs (optional but recommended)
cp ~/.config/claude/mcp.json ~/.config/claude/mcp.json.backup
```

**Option B: Git Commit**
```bash
git add .overture.yaml
git commit -m "backup: v0.1 config before migration to v0.2"
```

---

### Step 2: Install v0.2

```bash
# Install latest v0.2
npm install -g overture@0.2.0

# Verify version
overture --version  # Should show 0.2.x
```

---

### Step 3: Convert Config Format

#### Manual Conversion

**Before (v0.1):** `.overture.yaml`
```yaml
mcps:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
  
  memory:
    command: npx
    args: ["-y", "mcp-server-memory"]
  
  github:
    command: mcp-server-github
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

**After (v0.2):** `.overture/config.yaml`
```yaml
version: "2.0"  # ← ADD THIS

mcp:  # ← RENAME FROM "mcps"
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"  # ← ADD THIS
    scope: "project"    # ← ADD THIS
  
  memory:
    command: "npx"
    args: ["-y", "mcp-server-memory"]
    transport: "stdio"  # ← ADD THIS
    scope: "project"    # ← ADD THIS
  
  github:
    command: "mcp-server-github"
    transport: "stdio"  # ← ADD THIS
    scope: "project"    # ← ADD THIS
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

#### Conversion Checklist

For **each MCP server**, add:
1. ✅ `version: "2.0"` at top level (once)
2. ✅ Rename `mcps:` to `mcp:`
3. ✅ Add `transport: "stdio"` (or `"http"`, `"sse"` if applicable)
4. ✅ Add `scope: "project"` (or `"global"` if shared across projects)
5. ✅ Quote all string values (YAML best practice)

#### Determining Transport Type

**stdio** (most common):
- MCPs launched as child processes
- Use stdin/stdout for communication
- Example: `npx @modelcontextprotocol/server-filesystem`

**http**:
- MCPs running as HTTP servers
- Example: `http://localhost:3000/mcp`

**sse**:
- MCPs using Server-Sent Events
- Less common, check MCP documentation

**When in doubt:** Use `"stdio"` — it's the default and most widely supported.

---

### Step 4: Move Config File

```bash
# Create .overture directory
mkdir -p .overture

# Move converted config
mv .overture.yaml .overture/config.yaml

# Or if you kept backup and edited separately
# Write your converted config to .overture/config.yaml
```

---

### Step 5: Validate New Config

```bash
overture validate

# Expected output:
# ✓ Configuration is valid
# ✓ All transports are supported
# ✓ All scopes are valid
# ✓ No circular dependencies detected
```

**If validation fails:**
- Read error messages carefully
- Check [Troubleshooting](#troubleshooting) section
- Verify all required fields present

---

### Step 6: Test Sync

**Dry-run first (recommended):**
```bash
overture sync --dry-run

# Review output:
# Would update claude-code:
#   + filesystem (stdio, project)
#   + memory (stdio, project)
#   + github (stdio, project)
```

**Sync for real:**
```bash
overture sync

# Creates backups automatically
# Updates all client configs
```

**Verify results:**
```bash
# Check client config was updated
cat ~/.config/claude/mcp.json

# Or view merged config
overture user show
```

---

## Migration Scenarios

### Scenario A: Simple Project (1-3 MCPs)

**Profile:**
- Single project
- 1-3 MCP servers
- No shared configuration needs

**Migration Time:** 5-10 minutes

**Steps:**
1. Add `version: "2.0"`
2. Rename `mcps:` to `mcp:`
3. Add `transport: "stdio"` to each MCP
4. Add `scope: "project"` to each MCP
5. Move to `.overture/config.yaml`
6. Run `overture validate`
7. Run `overture sync`

**Example:**

**Before:**
```yaml
mcps:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
```

**After:**
```yaml
version: "2.0"

mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    scope: "project"
```

---

### Scenario B: Complex Project (10+ MCPs)

**Profile:**
- Single large project
- 10+ MCP servers
- Mix of common tools and project-specific tools

**Migration Time:** 15-30 minutes

**Strategy:**
- Consider splitting into user + project configs
- Move common tools (filesystem, github, memory) to user global config
- Keep project-specific MCPs in project config
- Use platform filtering if needed
- Leverage client filtering for compatibility

**Steps:**

**1. Create User Global Config:**

`~/.config/overture/config.yaml`
```yaml
version: "2.0"

mcp:
  # Common across all projects
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    scope: "global"
  
  github:
    command: "mcp-server-github"
    transport: "stdio"
    scope: "global"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
  
  memory:
    command: "npx"
    args: ["-y", "mcp-server-memory"]
    transport: "stdio"
    scope: "global"
```

**2. Update Project Config:**

`.overture/config.yaml`
```yaml
version: "2.0"

mcp:
  # Reference global MCPs
  filesystem:
    scope: "global"
  
  github:
    scope: "global"
  
  memory:
    scope: "global"
  
  # Project-specific MCPs
  python-repl:
    command: "uvx"
    args: ["mcp-server-python-repl"]
    transport: "stdio"
    scope: "project"
  
  postgres:
    command: "mcp-server-postgres"
    transport: "stdio"
    scope: "project"
    env:
      DATABASE_URL: "${DATABASE_URL}"
```

**3. Initialize User Config:**
```bash
overture user init  # Creates ~/.config/overture/config.yaml
```

**4. Test with Dry-Run:**
```bash
overture sync --dry-run

# Review: Should show global + project MCPs
```

**5. Sync:**
```bash
overture sync
```

**Benefits:**
- No duplication across future projects
- Global tools (filesystem, github) defined once
- Project config stays focused
- Easier to maintain

---

### Scenario C: Multi-Project Setup

**Profile:**
- Multiple projects using Overture
- Many shared MCPs across projects
- Project-specific customizations needed

**Migration Time:** 30-60 minutes (setup once, reuse everywhere)

**Strategy:**
- Create comprehensive user global config
- Minimize project configs to project-specific MCPs only
- Use references to global MCPs in projects

**Steps:**

**1. Identify Common MCPs Across Projects:**

Audit your projects:
```bash
# Project A
grep -A5 "mcps:" project-a/.overture.yaml

# Project B
grep -A5 "mcps:" project-b/.overture.yaml
```

**Common MCPs found:**
- filesystem (all projects)
- github (all projects)
- memory (all projects)
- sqlite (2/3 projects)

**2. Create User Global Config:**

`~/.config/overture/config.yaml`
```yaml
version: "2.0"

mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    scope: "global"
  
  github:
    command: "mcp-server-github"
    transport: "stdio"
    scope: "global"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
  
  memory:
    command: "npx"
    args: ["-y", "mcp-server-memory"]
    transport: "stdio"
    scope: "global"
  
  sqlite:
    command: "mcp-server-sqlite"
    transport: "stdio"
    scope: "global"
```

**3. Migrate Each Project:**

**Project A** (Python backend):
```yaml
version: "2.0"

mcp:
  # Global references
  filesystem:
    scope: "global"
  
  github:
    scope: "global"
  
  memory:
    scope: "global"
  
  # Project-specific
  python-repl:
    command: "uvx"
    args: ["mcp-server-python-repl"]
    transport: "stdio"
    scope: "project"
  
  postgres:
    command: "mcp-server-postgres"
    transport: "stdio"
    scope: "project"
    env:
      DATABASE_URL: "${DATABASE_URL}"
```

**Project B** (Node.js API):
```yaml
version: "2.0"

mcp:
  # Global references
  filesystem:
    scope: "global"
  
  github:
    scope: "global"
  
  memory:
    scope: "global"
  
  sqlite:
    scope: "global"
  
  # Project-specific
  npm:
    command: "npx"
    args: ["-y", "mcp-server-npm"]
    transport: "stdio"
    scope: "project"
```

**4. Sync All Projects:**
```bash
cd project-a
overture sync

cd ../project-b
overture sync
```

**Benefits:**
- Global MCPs defined once, used everywhere
- Project configs are minimal and focused
- Easy to add new projects (just reference globals)
- Consistent MCP versions across projects

---

## Troubleshooting

### Error: "version field is required"

**Symptom:**
```
✗ Configuration validation failed:
  - version field is required
```

**Solution:**
Add `version: "2.0"` at the top of your config:
```yaml
version: "2.0"  # ← Add this

mcp:
  filesystem:
    # ...
```

---

### Error: "transport field is required"

**Symptom:**
```
✗ Configuration validation failed:
  - mcp.filesystem: transport field is required
```

**Solution:**
Add `transport: "stdio"` to each MCP definition:
```yaml
mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"  # ← Add this
```

**Which transport to use?**
- **stdio** (most common) — For MCPs launched as child processes
- **http** — For MCPs running as HTTP servers
- **sse** — For Server-Sent Events (rare)

**When in doubt, use `"stdio"`.**

---

### Error: "scope field is required"

**Symptom:**
```
✗ Configuration validation failed:
  - mcp.filesystem: scope field is required
```

**Solution:**
Add `scope: "project"` or `scope: "global"` to each MCP:
```yaml
mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    scope: "project"  # ← Add this
```

**Which scope to use?**
- **project** — MCP defined in this project config (most common for first migration)
- **global** — MCP defined in user global config (use after creating `~/.config/overture/config.yaml`)

---

### Error: "Config file not found"

**Symptom:**
```
✗ Configuration file not found: .overture/config.yaml
```

**Solution:**
Ensure config is at the **new location**:
```bash
# Create directory
mkdir -p .overture

# Move config
mv .overture.yaml .overture/config.yaml

# Verify
ls -la .overture/config.yaml
```

---

### Warning: "Transport X not supported by client Y"

**Symptom:**
```
⚠ Warning: HTTP transport not supported by vscode
  - mcp.my-http-server uses transport "http"
  - vscode only supports: stdio
```

**Solution Options:**

**Option 1: Exclude client**
```yaml
mcp:
  my-http-server:
    transport: "http"
    excludeClients: ["vscode"]  # ← Exclude incompatible clients
```

**Option 2: Change transport**
```yaml
mcp:
  my-http-server:
    transport: "stdio"  # ← Use stdio instead
    command: "my-server"
```

**Option 3: Only include for compatible clients**
```yaml
mcp:
  my-http-server:
    transport: "http"
    clients: ["claude-code", "cursor"]  # ← Only include for these
```

---

### Error: "Circular dependency detected"

**Symptom:**
```
✗ Circular dependency detected:
  mcp-a → mcp-b → mcp-a
```

**Solution:**
This shouldn't happen in v0.1 to v0.2 migration (no MCP dependencies in v0.1).

If you see this, check for typos in MCP names or remove dependency declarations.

---

### Validation Passes but Sync Fails

**Symptom:**
```
✓ Configuration is valid

[Running sync...]
✗ Failed to sync claude-code: Command not found: npx
```

**Solution:**
Validation checks schema, not runtime availability.

**Fix:**
- Ensure MCP commands are on PATH
- Test command manually: `which npx`
- Install missing tools: `npm install -g npx`

---

### MCPs Not Appearing in Client

**Symptom:**
Sync completes successfully, but MCPs don't show up in Claude/VS Code/etc.

**Troubleshooting:**

**1. Verify config was written:**
```bash
# Check client config file
cat ~/.config/claude/mcp.json  # Claude Code

cat ~/.vscode/mcp.json  # VS Code (if exists)
# or
cat .vscode/mcp.json  # Project-level VS Code
```

**2. Restart client:**
- Claude Code: Restart terminal session
- VS Code: Reload window (Cmd+Shift+P → "Developer: Reload Window")
- Cursor: Restart Cursor

**3. Check client logs:**
- Look for MCP connection errors
- Verify MCP commands are actually executable

**4. Test MCP manually:**
```bash
# Test MCP command directly
npx -y @modelcontextprotocol/server-filesystem .

# Should start without errors
```

---

### Backup Restore Issues

**Symptom:**
Need to rollback to pre-migration state.

**Solution:**
```bash
# List available backups
overture backup list claude-code

# Restore latest backup
overture backup restore claude-code --latest

# Or restore specific timestamp
overture backup restore claude-code --timestamp 2025-11-11T10-30-45
```

**If backups not found:**
```bash
# Use manual backup
cp ~/.config/claude/mcp.json.backup ~/.config/claude/mcp.json

# Or git restore
git restore .overture/config.yaml
```

---

## Command Mapping

### Core Commands

| v0.1 Command | v0.2 Command | Changes |
|--------------|--------------|---------|
| `overture init` | `overture init` | ✅ Unchanged (but generates v2.0 config) |
| `overture sync` | `overture sync` | ✅ Enhanced with `--client`, `--dry-run`, `--force` |
| `overture validate` | `overture validate` | ✅ Enhanced validation (transport, scope, circular deps) |
| `overture mcp list` | `overture mcp list` | ✅ Enhanced output (shows scope, transport) |
| N/A | `overture user init` | 🆕 Create user global config |
| N/A | `overture user show` | 🆕 View merged user + project config |
| N/A | `overture audit` | 🆕 Detect unmanaged MCPs |
| N/A | `overture backup list` | 🆕 List backups for client |
| N/A | `overture backup restore` | 🆕 Restore client config from backup |

---

### Sync Command Enhancements

**v0.1:**
```bash
overture sync  # Sync to all clients
```

**v0.2:**
```bash
# Sync to all clients (default)
overture sync

# Sync to specific clients only
overture sync --client claude-code
overture sync --client claude-code,vscode,cursor

# Preview changes without applying (dry-run)
overture sync --dry-run

# Force sync (skip process lock checks)
overture sync --force

# Combine options
overture sync --client vscode --dry-run
```

---

### Validate Command Enhancements

**v0.1:**
```bash
overture validate  # Schema validation only
```

**v0.2:**
```bash
overture validate  # Enhanced validation:
                   # - Schema validation
                   # - Transport compatibility
                   # - Scope validity
                   # - Circular dependency detection
                   # - Platform filtering checks
```

---

### MCP List Enhancements

**v0.1:**
```bash
overture mcp list

# Output:
# filesystem
# github
# memory
```

**v0.2:**
```bash
overture mcp list

# Enhanced output:
# filesystem (stdio, project)
# github (stdio, global)
# memory (stdio, global)
# python-repl (stdio, project, darwin only)
```

---

### New Commands

#### User Global Config

**Initialize user config:**
```bash
overture user init

# Creates: ~/.config/overture/config.yaml
# With common MCPs pre-configured
```

**View merged config:**
```bash
overture user show

# Shows combined user + project config
# Indicates source of each MCP (user/project)
```

---

#### Audit

**Detect unmanaged MCPs:**
```bash
overture audit

# Output:
# Unmanaged MCPs in claude-code:
#   - some-manual-mcp (not in Overture config)
#   - legacy-tool (not in Overture config)
# 
# Managed MCPs:
#   ✓ filesystem
#   ✓ github
#   ✓ memory
```

**Use case:**
Find MCPs manually added to client configs that should be added to Overture config.

---

#### Backup Management

**List backups:**
```bash
overture backup list claude-code

# Output:
# Backups for claude-code:
#   2025-11-11T10-30-45 (latest)
#   2025-11-10T15-22-10
#   2025-11-09T09-15-33
```

**Restore from backup:**
```bash
# Restore latest
overture backup restore claude-code --latest

# Restore specific timestamp
overture backup restore claude-code --timestamp 2025-11-11T10-30-45

# Preview restore (dry-run)
overture backup restore claude-code --latest --dry-run
```

---

## Rollback Plan

If migration fails or causes issues, you can rollback to v0.1.

### Step 1: Restore Client Configs

**Option A: Use Overture Backups (if available)**
```bash
# Restore each client
overture backup restore claude-code --latest
overture backup restore vscode --latest
overture backup restore cursor --latest
```

**Option B: Manual Restore**
```bash
# Restore from manual backups
cp ~/.config/claude/mcp.json.backup ~/.config/claude/mcp.json
cp .vscode/mcp.json.backup .vscode/mcp.json
```

---

### Step 2: Restore v0.1 Config

**Option A: Git Restore**
```bash
git restore .overture.yaml
rm -rf .overture/  # Remove v0.2 config directory
```

**Option B: Manual Restore**
```bash
cp .overture.yaml.backup .overture.yaml
rm -rf .overture/  # Remove v0.2 config directory
```

---

### Step 3: Downgrade Overture

**Uninstall v0.2:**
```bash
npm uninstall -g overture
```

**Reinstall v0.1:**
```bash
npm install -g overture@0.1.0

# Verify version
overture --version  # Should show 0.1.x
```

---

### Step 4: Verify Rollback

**Test v0.1 commands:**
```bash
overture validate  # Should validate v0.1 config
overture sync      # Should sync to clients
```

**Check client configs:**
```bash
cat ~/.config/claude/mcp.json  # Should show v0.1 format
```

---

### Step 5: Report Issue

If you had to rollback, please report the issue:

**GitHub Issue:**
- Repository: https://github.com/yourorg/overture/issues
- Include:
  - Error messages
  - Sanitized config (remove secrets)
  - Steps to reproduce
  - Platform/OS details

---

## Post-Migration Checklist

After completing migration, verify everything works:

### Configuration Validation

- [ ] **Config validates successfully**
  ```bash
  overture validate
  # Expected: ✓ Configuration is valid
  ```

- [ ] **Config file in correct location**
  ```bash
  ls -la .overture/config.yaml
  # Should exist
  ```

- [ ] **Version field present**
  ```bash
  head -1 .overture/config.yaml
  # Should show: version: "2.0"
  ```

---

### Sync Verification

- [ ] **Sync completes without errors**
  ```bash
  overture sync
  # Expected: ✓ Successfully synced to all clients
  ```

- [ ] **Client configs generated correctly**
  ```bash
  cat ~/.config/claude/mcp.json
  # Should contain your MCPs
  ```

- [ ] **Backups created automatically**
  ```bash
  overture backup list claude-code
  # Should show timestamped backups
  ```

---

### MCP Verification

- [ ] **MCPs appear in clients**
  - Open Claude Code → Check MCP list
  - Open VS Code → Check MCP extension
  - Open Cursor → Check MCP panel

- [ ] **MCPs connect successfully**
  - Test each MCP in client
  - Verify tools are available
  - Check for connection errors

---

### Audit Check

- [ ] **No unmanaged MCPs**
  ```bash
  overture audit
  # Expected: All MCPs managed by Overture
  ```

---

### Cleanup

- [ ] **Old v0.1 config backed up**
  ```bash
  ls -la .overture.yaml.backup
  # Should exist (or committed to git)
  ```

- [ ] **Old config location cleaned up**
  ```bash
  rm .overture.yaml  # If satisfied with migration
  ```

- [ ] **Git commit migration**
  ```bash
  git add .overture/config.yaml
  git commit -m "chore: migrate Overture config to v0.2"
  ```

---

### Optional: User Global Config

If you created user global config:

- [ ] **User config validated**
  ```bash
  overture user init  # If not already created
  overture validate   # Should validate merged config
  ```

- [ ] **User show works**
  ```bash
  overture user show
  # Should show merged user + project config
  ```

- [ ] **Global MCPs referenced correctly**
  ```bash
  # Check project config
  grep "scope: \"global\"" .overture/config.yaml
  # Should show MCPs referencing user config
  ```

---

## Getting Help

### Documentation

- **Main Docs:** [docs/README.md](../README.md)
- **Configuration Schema:** [docs/v0.2-schema.md](v0.2-schema.md)
- **Architecture Guide:** [docs/v0.2-architecture.md](v0.2-architecture.md)
- **Examples:** [docs/examples/](examples/)

---

### Community Support

- **GitHub Issues:** https://github.com/yourorg/overture/issues
  - Bug reports
  - Feature requests
  - Migration problems

- **GitHub Discussions:** https://github.com/yourorg/overture/discussions
  - Questions
  - Best practices
  - Community help

---

### Reporting Migration Issues

When reporting migration problems, include:

**1. Environment Info:**
```bash
overture --version
node --version
npm --version
uname -a  # Platform info
```

**2. Sanitized Config:**
```yaml
# Remove secrets, tokens, passwords
# But preserve structure
```

**3. Error Messages:**
```
# Full error output
# Include stack traces if available
```

**4. Steps to Reproduce:**
```
1. Started with v0.1 config: ...
2. Ran migration steps: ...
3. Error occurred at: ...
```

---

### Migration Support Priority

We prioritize migration issues during the v0.2 transition period:

- **P0** — Migration completely fails (can't validate or sync)
- **P1** — Migration succeeds but breaks functionality
- **P2** — Migration succeeds with warnings
- **P3** — Questions about best practices

**Response Times:**
- P0: Within 24 hours
- P1: Within 48 hours
- P2: Within 1 week
- P3: Community support

---

## Appendix: Migration Script (Experimental)

For advanced users, we provide an experimental migration script:

**⚠️ Warning:** This script is experimental. Always backup before using.

```bash
# Download migration script
curl -O https://raw.githubusercontent.com/yourorg/overture/main/scripts/migrate-v0.1-to-v0.2.sh

# Make executable
chmod +x migrate-v0.1-to-v0.2.sh

# Run migration (dry-run first)
./migrate-v0.1-to-v0.2.sh --dry-run

# Run migration for real
./migrate-v0.1-to-v0.2.sh
```

**What it does:**
1. Backs up `.overture.yaml`
2. Creates `.overture/` directory
3. Converts config format (adds version, transport, scope)
4. Moves config to `.overture/config.yaml`
5. Runs `overture validate`
6. Optionally runs `overture sync --dry-run`

**Manual migration is still recommended** for understanding the changes.

---

## Appendix: Common Migration Patterns

### Pattern 1: Minimal Migration

**For:** Single project, no global config needs

```yaml
# Before (v0.1)
mcps:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]

# After (v0.2)
version: "2.0"
mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    scope: "project"
```

**Steps:**
1. Add version
2. Rename mcps → mcp
3. Add transport/scope
4. Move to .overture/config.yaml

---

### Pattern 2: Split User/Project

**For:** Multiple projects, shared MCPs

**User Global Config:** `~/.config/overture/config.yaml`
```yaml
version: "2.0"
mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    scope: "global"
  
  github:
    command: "mcp-server-github"
    transport: "stdio"
    scope: "global"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

**Project Config:** `.overture/config.yaml`
```yaml
version: "2.0"
mcp:
  filesystem:
    scope: "global"  # Reference
  
  github:
    scope: "global"  # Reference
  
  python-repl:
    command: "uvx"
    args: ["mcp-server-python-repl"]
    transport: "stdio"
    scope: "project"
```

**Steps:**
1. Create user global config
2. Move common MCPs to global with scope: "global"
3. Reference globals in project with scope: "global"
4. Keep project-specific MCPs in project

---

### Pattern 3: Platform-Specific MCPs

**For:** Cross-platform projects, platform-specific tools

```yaml
version: "2.0"
mcp:
  # Cross-platform MCP
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    scope: "project"
  
  # macOS-only MCP
  macos-tool:
    command: "macos-specific-tool"
    transport: "stdio"
    scope: "project"
    platforms: ["darwin"]  # Only include on macOS
  
  # Linux-only MCP
  linux-tool:
    command: "linux-specific-tool"
    transport: "stdio"
    scope: "project"
    platforms: ["linux"]  # Only include on Linux
```

**Use case:**
- Mac-specific developer tools
- Linux-specific system integrations
- Windows-specific utilities

---

### Pattern 4: Client-Specific MCPs

**For:** Projects using multiple clients, client-specific needs

```yaml
version: "2.0"
mcp:
  # Universal MCP (all clients)
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    scope: "project"
  
  # Claude Code only
  claude-specific:
    command: "claude-tool"
    transport: "stdio"
    scope: "project"
    clients: ["claude-code"]
  
  # VS Code + Cursor only
  editor-specific:
    command: "editor-tool"
    transport: "stdio"
    scope: "project"
    clients: ["vscode", "cursor"]
  
  # Exclude Windsurf (incompatible)
  almost-universal:
    command: "some-tool"
    transport: "stdio"
    scope: "project"
    excludeClients: ["windsurf"]
```

**Use case:**
- Client-specific integrations
- Compatibility workarounds
- Feature testing

---

## Conclusion

Migrating from v0.1 to v0.2 unlocks powerful multi-client orchestration capabilities while requiring minimal configuration changes.

**Key Takeaways:**
- ✅ Add `version: "2.0"`, `transport`, and `scope` to each MCP
- ✅ Move config from `.overture.yaml` to `.overture/config.yaml`
- ✅ Consider splitting into user + project configs for multi-project setups
- ✅ Use `overture validate` and `overture sync --dry-run` before committing
- ✅ Backups are created automatically

**Next Steps:**
1. Complete migration following [Migration Steps](#migration-steps)
2. Verify with [Post-Migration Checklist](#post-migration-checklist)
3. Explore [New Features](#new-features-available)
4. Consider [User Global Config](#user--project-config-separation) for multi-project setups

**Questions?** See [Getting Help](#getting-help)

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-11  
**Overture Version:** 0.2.0
