# Importing Existing MCP Configurations

This guide explains how to migrate your existing MCP server configurations from Claude Code, GitHub Copilot CLI, and OpenCode into Overture.

## Overview

If you already have MCP servers configured in one or more AI coding tools, Overture can import them automatically, giving you a single source of truth for all your MCP configurations.

**Benefits of importing:**

- ✅ Centralized configuration management
- ✅ Sync same MCPs across all clients
- ✅ Version control your MCP setup
- ✅ Automatic environment variable detection
- ✅ Conflict detection across clients

## Prerequisites

- Overture installed: `npm install -g @overture/cli`
- At least one AI client with existing MCP configurations:
  - Claude Code with `~/.claude.json` or `.mcp.json`
  - GitHub Copilot CLI with MCP configs
  - OpenCode with MCP configs

## Quick Start

```bash
# Import from all clients at once
overture import

# Or target a specific client
overture import --client claude-code
overture import --client copilot-cli
overture import --client opencode
```

## Step-by-Step Guide

### Step 0: Scan for Existing MCPs (Recommended)

Before importing, use `--detect` mode to scan your system for existing MCP configurations without making any changes:

```bash
# Basic scan of all clients
overture import --detect

# Scan with detailed output
overture import --detect --verbose

# Scan specific client
overture import --detect --client claude-code

# Machine-readable output for CI/CD
overture import --detect --format json

# Compact table view
overture import --detect --format table
```

**What you'll see:**

```
📋 MCP Detection Report

✓ Scanned 3 clients

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Managed MCPs (already in Overture)

  filesystem (2 instances)
    ├─ claude-code: ~/.claude.json
    └─ opencode: ~/.config/opencode/opencode.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆕 Unmanaged MCPs (can be imported)

  github (claude-code)
    Config: ~/.claude.json
    Suggested scope: global

  python-repl (opencode)
    Config: opencode.json
    Suggested scope: project

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ No conflicts detected
```

**Verbose mode** shows additional details:

```bash
overture import --detect --verbose
```

```
🆕 Unmanaged MCPs

  github (claude-code)
    Config: ~/.claude.json
    Command: gh mcp
    Env: GITHUB_TOKEN
    Suggested scope: global
```

**Exit codes** for automation:

- `0` - Success, no issues
- `1` - Parse errors detected
- `2` - Conflicts detected (warning level)

**When to use:**

- **Before importing** - See what MCPs exist across all clients
- **Check for conflicts** - Identify same MCP with different configs
- **CI/CD validation** - Verify MCP configurations in automation
- **Team onboarding** - Show new members what MCPs are configured

**Why this is useful:**

1. **Non-destructive** - Read-only scan, no changes made
2. **Conflict detection** - See problems before importing
3. **Scope preview** - Understand where MCPs will be imported
4. **Parse error detection** - Find malformed configs early

### Step 1: Discover Your Existing MCPs (Interactive)

Run `overture import` to scan your system for unmanaged MCP configurations:

```bash
overture import
```

Overture will:

1. Scan all configured AI clients
2. Find MCPs not yet managed by Overture
3. Detect conflicts (same MCP, different configs)
4. Show an interactive selection UI

**Example output:**

```
🔍 Import MCPs from Client Configs

◇ Scanning client configurations...
│ Scan complete

⚠️  Conflicts Detected

MCP 'github' has conflicting configurations:
  Source 1: claude-code (~/.claude.json)
    Command: npx @modelcontextprotocol/server-github
    Args: ["--token", "hardcoded-token"]

  Source 2: copilot-cli (~/.config/github-copilot/mcp.json)
    Command: npx @modelcontextprotocol/server-github
    Args: []
    Env: {"GITHUB_TOKEN": "${GITHUB_TOKEN}"}

  Reason: Different environment variables

These MCPs cannot be imported automatically.
Please resolve conflicts manually by making the configurations match.
```

### Step 2: Select MCPs to Import

Use the interactive checkbox UI to choose which MCPs to import:

```
◆ Select MCPs to import (5 found):
  ◻ filesystem (claude-code: npx @modelcontextprotocol/server-filesystem)
  ◻ slack (claude-code: npx @anthropic/mcp-server-slack)
  ◻ nx-mcp (opencode: npx nx-mcp@latest)
  ◻ memory (copilot-cli: npx @modelcontextprotocol/server-memory)
  └ Select/deselect with ↑↓ and spacebar, confirm with enter
```

### Step 3: Review Scope Assignments

Overture automatically infers whether each MCP should be global (user-wide) or project-specific:

```
┌ Import Plan
│
│ Global scope (~/.config/overture/config.yaml):
│   • filesystem
│   • slack
│   • memory
│
│ Project scope (.overture/config.yaml):
│   • nx-mcp
└
```

**Scope inference rules:**

- Found in `~/.claude.json` top-level → **global**
- Found in `~/.config/*/` → **global**
- Found in project directory → **project**
- Found in `~/.claude.json` → `projects[/current/dir]` → **project**

### Step 4: Set Required Environment Variables

If Overture detects hardcoded secrets, you'll see a warning with instructions:

```
┌ ⚠️  Environment Variables Required
│
│ export SLACK_TOKEN="your-value-here"
│ export GITHUB_TOKEN="your-value-here"
└
```

**What happens:** Overture automatically converts hardcoded values like `"xoxb-1234..."` to environment variable references like `"${SLACK_TOKEN}"` for better security.

**Supported patterns:**

- OpenAI API keys → `${OPENAI_API_KEY}`
- GitHub tokens → `${GITHUB_TOKEN}`
- Slack tokens → `${SLACK_TOKEN}`/`${SLACK_BOT_TOKEN}`
- Anthropic keys → `${ANTHROPIC_API_KEY}`

### Step 5: Confirm and Import

Review the plan and confirm:

```
◆ Import 4 MCP(s)? (Y/n)
│ Yes
└

◇ Importing MCPs...
│ Import complete

┌ ✅ Import Results
│
│ Imported: 4
│ Skipped: 0
│ Scopes modified: global, project
└

⚠️  Remember to set the required environment variables!
```

### Step 6: Set Environment Variables

Add the required variables to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
export GITHUB_TOKEN="ghp_yourActualTokenHere"
export SLACK_TOKEN="xoxb-yourActualTokenHere"
```

Reload your shell:

```bash
source ~/.bashrc  # or ~/.zshrc
```

### Step 7: Sync to All Clients

Run `overture sync` to propagate your imported config to all clients:

```bash
overture sync
```

This will:

- Read your Overture config (now including imported MCPs)
- Generate client-specific configs for all installed clients
- Validate environment variables are set
- Write configs to each client

## Understanding What Gets Imported

### Claude Code

| Source Location                                 | Suggested Scope                                          | Notes                     |
| ----------------------------------------------- | -------------------------------------------------------- | ------------------------- |
| `~/.claude.json` → `mcpServers`                 | **global**                                               | Top-level user config     |
| `~/.claude.json` → `projects[/path].mcpServers` | **project** (if current dir) / **global** (if other dir) | Directory-based overrides |
| `.mcp.json`                                     | **project**                                              | Project-scoped config     |

**Directory-based configs:** Claude Code supports per-directory MCP configurations in `~/.claude.json`. Overture detects these and imports them appropriately.

### GitHub Copilot CLI

| Source Location                     | Suggested Scope |
| ----------------------------------- | --------------- |
| `~/.config/github-copilot/mcp.json` | **global**      |
| `.github/mcp.json`                  | **project**     |

### OpenCode

| Source Location                    | Suggested Scope |
| ---------------------------------- | --------------- |
| `~/.config/opencode/opencode.json` | **global**      |
| `./opencode.json`                  | **project**     |

**Format conversion:** OpenCode uses `{env:VAR}` syntax for environment variables. Overture automatically converts these to `${VAR}` during import and back to `{env:VAR}` during sync.

## Handling Conflicts

### What Causes Conflicts?

A conflict occurs when the **same MCP name** is found in multiple clients with **different configurations**:

- Different command paths
- Different arguments
- Different environment variables

### Resolving Conflicts

**Option 1: Manually align configurations**

Edit your client configs to make them match, then re-run import:

```bash
# Make GitHub config in both clients identical
vim ~/.claude.json
vim ~/.config/github-copilot/mcp.json

# Re-run import
overture import
```

**Option 2: Remove from one client**

Remove the MCP from one client's config, keeping only the preferred version:

```bash
# Edit config to remove duplicate
vim ~/.claude.json

# Re-run import
overture import
```

**Option 3: Import individually**

Import from one client at a time:

```bash
overture import --client claude-code
# Resolve any issues
overture import --client copilot-cli
```

## The Cleanup Command

After importing and syncing, you may have redundant configurations in Claude Code's directory-based settings. Use `overture cleanup` to remove them:

```bash
# Preview what would be cleaned
overture cleanup --dry-run

# Clean up all Overture-managed directories
overture cleanup

# Clean specific directory only
overture cleanup --directory /path/to/project
```

### What Cleanup Does

1. Scans `~/.claude.json` → `projects` for directories with `.overture/config.yaml`
2. Identifies MCPs in these directories that are managed by Overture
3. Removes only the managed MCPs from directory configs
4. Preserves unmanaged MCPs (with warnings)
5. Keeps all other directory settings intact

**Example:**

```bash
overture cleanup
```

```
🧹 Cleanup Directory-Based MCP Configs

◇ Scanning for cleanup targets...
│ Scan complete

◆ Select directories to clean up (2 found):
  ◻ /home/user/projects/my-app (Remove 3, preserve 1)
  ◻ /home/user/projects/other-app (Remove 2, preserve 0)
  └

┌ 🗑️  Cleanup Plan
│
│ /home/user/projects/my-app:
│   Remove 3 managed MCP(s):
│     • filesystem
│     • memory
│     • github
│   Preserve 1 unmanaged MCP(s):
│     • custom-debug (⚠️  not in Overture)
└

⚠️  1 unmanaged MCP(s) will be preserved (not in your Overture config)

◆ Clean up 2 directories? (Backup will be created) (y/N)
│ Yes
└

◇ Cleaning up...
│ Cleanup complete

┌ ✅ Cleanup Results
│
│ Directories cleaned: 2
│ MCPs removed: 5
│ MCPs preserved: 1
│
│ Backup created: ~/.claude.json.backup-1234567890
└
```

## Environment Variable Best Practices

### Use Defaults for Optional Values

```yaml
mcp:
  database:
    command: npx
    args: ['mcp-server-db']
    env:
      DB_HOST: '${DB_HOST:-localhost}' # Uses 'localhost' if not set
      DB_PORT: '${DB_PORT:-5432}' # Uses '5432' if not set
      DB_PASSWORD: '${DB_PASSWORD}' # Required, no default
```

### Store Secrets Securely

**Option 1: Shell profile**

```bash
# ~/.bashrc or ~/.zshrc
export GITHUB_TOKEN="ghp_..."
export OPENAI_API_KEY="sk-..."
```

**Option 2: `.env` file (with direnv)**

```bash
# Install direnv: https://direnv.net/
# Create .envrc in project
echo 'export GITHUB_TOKEN="ghp_..."' >> .envrc
direnv allow
```

**Option 3: System keychain**

```bash
# macOS Keychain
security add-generic-password -a "$USER" -s "GITHUB_TOKEN" -w "ghp_..."

# Retrieve in shell profile
export GITHUB_TOKEN=$(security find-generic-password -a "$USER" -s "GITHUB_TOKEN" -w)
```

## Troubleshooting

### "Config file is malformed"

**Problem:** A client config has invalid JSON/YAML syntax.

**Solution:**

```bash
# Validate JSON
cat ~/.claude.json | jq .

# Fix syntax errors, then re-run
overture import
```

### "Conflict detected for MCP 'xxx'"

**Problem:** Same MCP has different configs across clients.

**Solution:** See [Handling Conflicts](#handling-conflicts) above.

### "Environment variable not set"

**Problem:** Imported MCP requires an env var that isn't set.

**Solution:**

```bash
# Set the variable
export GITHUB_TOKEN="your-token"

# Verify it's set
echo $GITHUB_TOKEN

# Re-run sync
overture sync
```

### "No unmanaged MCPs found"

**Possible reasons:**

1. All MCPs are already managed by Overture ✅
2. No client configs found
3. All clients have empty configs

**Verify:**

```bash
# Check Overture config
cat ~/.config/overture/config.yaml
cat .overture/config.yaml

# Check client configs
cat ~/.claude.json
cat ~/.config/github-copilot/mcp.json
```

## Complete Workflow Example

Here's a typical import workflow:

```bash
# 1. Check what MCPs you currently have
cat ~/.claude.json

# 2. Run import
overture import

# 3. Select MCPs in the interactive UI
#    (Choose filesystem, github, memory)

# 4. Note the required env vars
#    GITHUB_TOKEN needed

# 5. Set environment variables
export GITHUB_TOKEN="ghp_yourTokenHere"

# 6. Confirm import
#    (Press Y)

# 7. Verify imported config
cat ~/.config/overture/config.yaml

# 8. Sync to all clients
overture sync

# 9. Clean up redundant Claude configs
overture cleanup --dry-run  # Preview first
overture cleanup            # Execute

# 10. Verify everything works
overture doctor
```

## Next Steps

- **Validate:** Run `overture doctor` to verify all MCPs are working
- **Version Control:** Commit your `.overture/config.yaml` to git
- **Team Setup:** Share your config with teammates
- **Explore:** Check out [Configuration Examples](../examples.md) for advanced setups

## See Also

- [User Guide](../user-guide.md) - Complete Overture documentation
- [Configuration Examples](../examples.md) - Real-world config samples
- [Roadmap](../roadmap.md) - Upcoming features
