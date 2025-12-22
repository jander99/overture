# Overture Quick Start

Get up and running with Overture in 5 minutes.

## What is Overture?

Overture manages MCP (Model Context Protocol) server configurations across all your AI development tools—Claude Desktop, Claude Code, VSCode, Cursor, and more—from a single source of truth.

**Problem:** Same MCP servers configured differently across 7 different AI tools
**Solution:** Declare once, sync everywhere

---

## 1. Install

```bash
npm install -g @overture/cli

# Verify installation
overture --version
```

---

## 2. Check Your System

Before configuring, see what's installed:

```bash
overture doctor
```

**Example output:**

```
✓ claude-code (v2.1.0) - /usr/local/bin/claude
  Config: ~/.claude.json (valid)

✗ claude-desktop - not installed
  → Install Claude Desktop: https://claude.com/download

✓ vscode - /usr/bin/code
  Config: ~/.vscode/mcp.json (valid)
```

This shows:

- Which AI clients are installed
- Their versions and locations
- Config file validity
- What's missing

---

## 3. Initialize

### Option A: Project-Only Setup (Recommended for most users)

```bash
cd my-project
overture init --type python-backend
```

This creates `.overture/config.yaml` in your project.

### Option B: User Global + Project Setup (Advanced)

```bash
# User global config (MCPs available to all projects)
overture user init

# Project config (project-specific MCPs)
cd my-project
overture init --type python-backend
```

User global MCPs are shared across all projects. Project MCPs are project-specific.

---

## 4. Configure

Edit `.overture/config.yaml`:

```yaml
version: '1.0'

project:
  name: my-api
  type: python-backend

# MCP server configurations
mcp:
  # GitHub integration
  github:
    command: gh
    args: [mcp]
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}'

  # Python REPL for code execution
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]

  # Ruff linter
  ruff:
    command: uvx
    args: [mcp-server-ruff]
```

---

## 5. Sync

```bash
overture sync
```

This:

1. ✅ Detects which AI clients are installed
2. ✅ Generates configs for all detected clients
3. ✅ Backs up existing configs
4. ✅ Shows detection results and paths

**Example output:**

```
Syncing MCP configurations...

Client sync results:
  ✓ claude-code:
      Detected (v2.1.0): /usr/local/bin/claude
      Config: ~/.claude.json (valid)
      Backup: ~/.config/overture/backups/claude-code/mcp.json.20250115-123456

  ✗ claude-desktop:
      Not detected (config will still be generated)
      Config: ~/Library/Application Support/Claude/mcp.json

Sync complete!
```

---

## 6. Verify

Check that your MCP servers are working:

```bash
# For Claude Code
claude

# For VSCode
code

# Check generated configs
cat ~/.claude.json
cat .mcp.json
```

---

## Importing Existing Configurations

If you already have MCP servers configured in your AI clients, you can import them:

```bash
# Scan for existing MCPs (read-only)
overture import --detect

# Scan with detailed output
overture import --detect --verbose

# Import interactively (after reviewing with --detect)
overture import
```

**What you'll see:**

```
📋 MCP Detection Report

✓ Scanned 3 clients

🆕 Unmanaged MCPs (5)
  github, python-repl, ruff, memory, filesystem
```

**See also:** [Importing Guide](../docs/howtos/importing-existing-configs.md) for detailed instructions

---

## Common Workflows

### Adding a New MCP Server

1. Edit `.overture/config.yaml`:

   ```yaml
   mcp:
     new-server:
       command: my-command
       args: [arg1, arg2]
   ```

2. Sync:
   ```bash
   overture sync
   ```

### Syncing to Specific Client

```bash
# Sync only to Claude Code
overture sync --client claude-code

# Sync only to VSCode
overture sync --client vscode
```

### Preview Changes

```bash
# Dry-run mode - shows what would change
overture sync --dry-run

# Configs written to dist/ for inspection
cat dist/claude-code-mcp.json
```

### Troubleshooting

```bash
# See detailed diagnostics
overture doctor --verbose

# JSON output for automation
overture doctor --json
```

---

## Multi-Platform Support

Overture automatically detects and syncs to these clients:

| Client             | Detection                         | Config Location                                    |
| ------------------ | --------------------------------- | -------------------------------------------------- |
| **Claude Code**    | CLI: `claude`                     | `~/.claude.json` (user)<br>`./.mcp.json` (project) |
| **Claude Desktop** | macOS: `/Applications/Claude.app` | `~/Library/Application Support/Claude/mcp.json`    |
| **VSCode**         | CLI: `code`                       | `~/.vscode/extensions/.../mcp.json`                |
| **Cursor**         | CLI: `cursor`                     | `~/.cursor/mcp.json`                               |
| **Windsurf**       | App bundle (platform-specific)    | Platform-specific                                  |
| **Copilot CLI**    | CLI: `copilot`                    | Various locations                                  |
| **JetBrains**      | IDE binaries                      | IDE-specific paths                                 |

---

## Next Steps

### Learn More

- **Full User Guide:** [docs/user-guide.md](./user-guide.md) - Comprehensive how-to
- **Configuration Schema:** [docs/overture-schema.md](./overture-schema.md) - All config options
- **Examples:** [docs/examples.md](./examples.md) - Real-world scenarios
- **Migration Guide:** [docs/migration-v0.2-to-v0.2.5.md](./migration-v0.2-to-v0.2.5.md) - Upgrading from older versions

### Advanced Features

**User Global Config:**

```bash
# Create user global config
overture user init

# Edit ~/.config/overture/config.yml
# MCPs here are available to all projects
```

**CI/CD Integration:**

```yaml
# .overture/config.yaml
skipBinaryDetection: true  # Don't check for installed clients

# GitHub Actions
- run: overture sync --dry-run
```

**Platform Filtering:**

```yaml
mcp:
  linux-only:
    command: cmd
    platforms:
      exclude: [darwin, win32]
```

**Client Filtering:**

```yaml
mcp:
  vscode-only:
    command: cmd
    clients:
      include: [vscode]
```

---

## Getting Help

- **Documentation:** [Full docs](./README.md)
- **GitHub Issues:** [Report bugs](https://github.com/overture-stack/overture/issues)
- **Examples:** [See examples.md](./examples.md)

---

## Quick Reference

```bash
# System diagnostics
overture doctor [--json] [--verbose]

# Initialize
overture init [--type <project-type>]
overture user init

# Sync configuration
overture sync [--dry-run] [--client <name>] [--force]

# Validate configuration
overture validate

# List MCP servers
overture mcp list

# Enable disabled MCP
overture mcp enable <name>
```

---

**You're ready to go!** 🚀

Start with `overture doctor` to see what's installed, then `overture init` to get started.
