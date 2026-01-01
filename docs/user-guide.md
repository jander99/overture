# Overture User Guide

Welcome to Overture, the configuration management tool that connects Claude Code plugins with MCP servers. This guide will help you get started and make the most of Overture in your projects.

## Table of Contents

1. [What is Overture?](#what-is-overture)
2. [Installation](#installation)
3. [Getting Started](#getting-started)
4. [Configuration](#configuration)
5. [Core Commands](#core-commands)
6. [Common Workflows](#common-workflows)
7. [Configuration Reference](#configuration-reference)
8. [Troubleshooting](#troubleshooting)
9. [Examples](#examples)

## What is Overture?

Overture solves a fundamental problem in the Claude Code ecosystem: **plugins and MCP servers don't know about each other.**

### The Problem

When you work with Claude Code, you might install plugins like `python-development` for Python expertise, but there's no automatic way to:

- Tell Claude which MCP servers (tools) work best with each plugin
- Configure project-specific MCP servers based on your project type
- Ensure required tools are available before Claude tries to use them
- Avoid loading unnecessary MCPs (like Python tools in a Java project)

### The Solution

Overture acts as a multi-platform configuration orchestrator that:

1. **Detects installed AI clients** - Automatically finds Claude Code, GitHub Copilot CLI, and OpenCode
2. **Connects plugins to their tools** - Declares which MCP servers each plugin should use
3. **Syncs Agent Skills** - Distributes reusable instruction sets across all AI clients
4. **Generates configs for all platforms** - Syncs to all detected clients (Claude Desktop, Claude Code, VSCode, etc.)
5. **Validates your setup** - Checks that required tools and clients are available
6. **Guides Claude's tool selection** - Generates `CLAUDE.md` that tells Claude which tools to prefer

**New in v0.3.0:**

- **AI Agent Sync** - Sync subagents to all clients from one source
- **Agent Sync Status** - Track which agents are in sync vs need updating
- **Improved Diagnostics** - Enhanced `doctor` command with agent status
- **Parallel Diagnostics** - Faster system health checks with parallel execution

### How It Works

```
You edit:        .overture/config.yaml
                 ↓
You run:         overture sync
                 ↓
Overture:        1. Installs plugins
                 2. Generates .mcp.json (MCP configuration)
                 3. Generates CLAUDE.md (usage guidance for Claude)
                 ↓
Result:          Claude knows which tools to use with each plugin
```

## Installation

### Prerequisites

- Node.js (version 16 or higher)
- Claude Code CLI installed and configured
- Basic familiarity with YAML configuration files

### Install Overture

```bash
npm install -g @overture/cli
```

Verify the installation:

```bash
overture --version
```

You should see the current version number displayed.

## Getting Started

### 0. Check Your System (Recommended)

Before configuring Overture, check which AI clients are installed:

```bash
overture doctor
```

This shows:

- Which AI clients are installed (Claude Code, Claude Desktop, VSCode, Cursor, etc.)
- Client versions and locations
- Config file validity
- Available MCP commands

**Example output:**

```
✓ claude-code (v2.1.0) - /usr/local/bin/claude
  Config: ~/.claude.json (valid)

✓ copilot-cli (v1.2.0) - /usr/local/bin/copilot
  Config: ~/.config/github-copilot/mcp.json (valid)
  Note: GitHub MCP excluded (bundled by default)

✓ opencode (v0.3.0) - /usr/local/bin/opencode
  Config: ~/.config/opencode/opencode.json (valid)

All 3 supported clients detected!
```

Use `overture doctor --verbose` for detailed warnings, or `overture doctor --json` for machine-readable output.

**Why this matters**: Knowing what's installed helps you understand which clients will receive configurations when you run `overture sync`.

### 1. Initialize Your Project

Navigate to your project directory and run:

```bash
cd my-project
overture init
```

This creates a `.overture/config.yaml` file with basic configuration:

```yaml
version: '1.0'

project:
  name: my-project
  type: general

plugins: {}
mcp: {}
```

### 2. Initialize with a Project Type

If you know your project type, you can initialize with pre-configured settings:

```bash
overture init --type python-backend
```

Available project types:

- `python-backend` - Python backend with FastAPI/Django
- `java-spring` - Java Spring Boot application
- `frontend-react` - React frontend application
- `typescript-monorepo` - TypeScript monorepo with Nx
- `general` - Generic project (default)

This creates a starter configuration with recommended plugins and MCP servers for your project type.

### 3. Sync Your Configuration

After initializing, run:

```bash
overture sync
```

This command:

- Installs any configured plugins
- Generates `.mcp.json` with MCP server configuration
- Creates `CLAUDE.md` with guidance for Claude

### 4. Start Using Claude

Open your project in Claude Code. Claude will now:

- Have access to the plugins you configured
- Know which MCP servers to use with each plugin
- Follow the guidance in `CLAUDE.md` for better tool selection

## Configuration

The heart of Overture is the `.overture/config.yaml` file. This section explains how to configure your project.

### Basic Structure

```yaml
version: '1.0'

# Project information
project:
  name: my-app
  type: python-backend
  description: My awesome application

# Plugins to install
plugins:
  plugin-name:
    marketplace: marketplace-name
    enabled: true
    mcps: [mcp1, mcp2]

# MCP server configurations
mcp:
  mcp-server-name:
    command: command-to-run
    args: [arg1, arg2]
```

### Adding Plugins

Plugins are specialized AI agents that enhance Claude's capabilities. To add a plugin:

```yaml
plugins:
  python-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [python-repl, ruff, filesystem]
```

- `marketplace`: Where the plugin comes from (usually `claude-code-workflows`)
- `enabled`: Whether to install and use this plugin (default: `true`)
- `mcps`: List of MCP server names this plugin uses

### Configuring MCP Servers

MCP servers provide tools and integrations. There are two types:

#### Global MCP Servers

These are configured in your global Claude settings (`~/.claude.json`) and available to all projects:

```yaml
mcp:
  filesystem:

  memory:
```

#### Project MCP Servers

These are specific to your project:

```yaml
mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]

  sqlite:
    command: uvx
    args: [mcp-server-sqlite, --db-path, ./dev.db]
```

- `command`: The executable to run
- `args`: Arguments to pass to the command
- `scope`: Set to `project` for project-specific servers
- `env`: (Optional) Environment variables as key-value pairs
- `enabled`: (Optional) Set to `false` to disable without removing

### Environment Variables

You can use environment variables in your MCP configuration:

```yaml
mcp:
  github:
    command: mcp-server-github
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}'
```

Overture will substitute `${GITHUB_TOKEN}` with the actual value from your environment.

### AI Agents (Subagents)

AI Agents (also called subagents) are specialized AI assistants with dedicated system prompts and tool access. Agents allow you to create focused assistants for specific tasks like code review, debugging, or documentation. Overture syncs agents to all AI clients from a single source.

#### Agent Configuration Format

Agents use a "split source" pattern with two files per agent:

1. **`<agent-name>.yaml`** - Configuration (name, model, tools)
2. **`<agent-name>.md`** - System prompt and instructions

**Example: Code Review Agent**

`~/.config/overture/agents/code-reviewer.yaml`:

```yaml
name: code-reviewer
model: claude-3-5-sonnet
description: Expert code reviewer focused on best practices
tools:
  - filesystem
  - github
```

`~/.config/overture/agents/code-reviewer.md`:

```markdown
# Code Review Agent

You are an expert code reviewer with deep knowledge of software engineering best practices.

## Your Role

- Review code for bugs, security issues, and performance problems
- Suggest improvements following language-specific idioms
- Explain your reasoning clearly and concisely

## Guidelines

- Always explain WHY a change is needed, not just WHAT to change
- Prioritize security and correctness over style
- Be constructive and helpful in tone
```

#### Agent Directory Structure

Agents can be global (available everywhere) or project-specific:

```
~/.config/overture/agents/     # Global agents
  code-reviewer.yaml
  code-reviewer.md
  debugger.yaml
  debugger.md

.overture/agents/               # Project-specific agents
  api-validator.yaml
  api-validator.md
```

#### Model Mapping

Use logical model names in agent configurations and map them to client-specific models:

`~/.config/overture/models.yaml`:

```yaml
# Map logical names to client-specific model identifiers
claude-3-5-sonnet:
  claude-code: claude-3-5-sonnet-20241022
  opencode: claude-3-5-sonnet-20241022
  copilot-cli: claude-3.5-sonnet

gpt-4o:
  copilot-cli: gpt-4o
  opencode: gpt-4o
```

Then in your agent YAML:

```yaml
model: claude-3-5-sonnet # Logical name
```

Overture automatically resolves this to the correct model for each client.

#### Syncing Agents

Agents sync automatically during `overture sync`:

```bash
overture sync
```

This syncs agents to:

- `~/.claude/agents/<name>.md` (Claude Code)
- `~/.config/opencode/agent/<name>.md` (OpenCode)
- `.github/agents/<name>.agent.md` (GitHub Copilot CLI - project only)

**Note:** GitHub Copilot CLI only supports project-scoped agents.

You can skip agent sync with:

```bash
overture sync --skip-agents
```

#### Checking Agent Sync Status

Use `overture doctor` to see agent sync status:

```bash
overture doctor
```

Output shows:

```
Summary:
  Config repo:      exists
  Global agents:    exists (5 agents)
  Project agents:   exists (3 agents)
  Agent sync:       2 in sync, 3 need sync
  Clients detected: 3 / 3
```

For detailed agent-by-agent status:

```bash
overture doctor --verbose
```

#### Multi-Agent Workflows

Create specialized agents for different tasks:

```bash
# Global agents for all projects
~/.config/overture/agents/
  code-reviewer.yaml/.md    # Code review and best practices
  debugger.yaml/.md         # Bug investigation and fixes
  architect.yaml/.md        # System design and planning
  tester.yaml/.md          # Test generation and coverage

# Project-specific agents
.overture/agents/
  api-validator.yaml/.md    # Validate API contracts
  db-migrator.yaml/.md      # Database migration helper
```

After syncing, all clients can invoke these agents based on task requirements.

#### Agent Validation

Overture validates agents during sync:

- YAML syntax and required fields (name, model, description)
- Matching `.md` file exists
- Model names are valid (if using models.yaml)
- Tool names reference existing MCPs

Fix validation errors shown during `overture validate` or `overture sync`.

### Agent Skills

Agent Skills are reusable instruction sets that guide AI assistants on how to perform specific tasks. Skills are stored as `SKILL.md` files and automatically synced during `overture sync`.

#### Creating Skills

Skills live in your global config directory at `~/.config/overture/skills/<name>/SKILL.md`:

```bash
# Create a new skill directory
mkdir -p ~/.config/overture/skills/debugging

# Create the skill file
cat > ~/.config/overture/skills/debugging/SKILL.md << 'EOF'
---
name: debugging
description: Advanced debugging techniques for complex issues
---

# Debugging Skill

When asked to debug issues, follow these steps:

1. **Reproduce the issue** - Ensure you can consistently trigger the bug
2. **Isolate the problem** - Use binary search to narrow down the cause
3. **Check logs** - Look for error messages and stack traces
4. **Verify assumptions** - Test your hypotheses systematically
5. **Fix and verify** - Make the fix and confirm it resolves the issue

## Tools to Use

- Use the `read` tool to examine relevant source files
- Use the `grep` tool to search for related code
- Use the `bash` tool to run tests and verify fixes
EOF
```

#### Automatic Sync

Skills are automatically synced to all detected AI clients:

```bash
overture sync
```

This syncs skills from `~/.config/overture/skills/` to:

- `~/.claude/skills/` (Claude Code)
- `~/.github/skills/` (GitHub Copilot CLI)
- `~/.opencode/skill/` (OpenCode)

**Important:** `overture sync` **overwrites existing skills** to ensure they match your source. If you've manually customized skill files, those changes will be lost. To preserve customizations:

- Keep a backup of modified skills outside the skills directory
- Fork customized skills to a new name (e.g., `debugging-custom`)
- Track your skills in version control

You can skip skill sync with `--skip-skills`:

```bash
overture sync --skip-skills
```

#### Copying Individual Skills

To copy a single skill without syncing all skills, use `overture skill cp`:

```bash
# Copy skill (skips if already exists)
overture skill cp debugging

# Force overwrite existing skill
overture skill cp debugging --force
```

**Difference from sync:**

- `overture sync` - Overwrites all skills by default (ensures consistency)
- `overture skill cp` - Skips existing skills by default (requires `--force` to overwrite)

Use `skill cp` when you want to selectively add skills without affecting existing ones.

#### Sharing Skills with Your Team

Copy skills to your project for version control:

```bash
# Copy to project directories
overture skill cp debugging

# Commit to git
git add .claude/skills/ .github/skills/ .opencode/skill/
git commit -m "Add debugging skill"
```

Now your team will have access to the same skills when they clone the project.

#### Listing Available Skills

```bash
# List all skills
overture skill list

# Show source paths
overture skill list --source
```

### Disabling Components

You can disable plugins or MCP servers without removing them:

```yaml
plugins:
  testing:
    marketplace: claude-code-workflows
    enabled: false # Plugin won't be installed
    mcps: [filesystem]

mcp:
  postgres:
    command: docker
    args: [run, -i, --rm, mcp-postgres]
    enabled: false # MCP won't be configured
```

This is useful for:

- Temporarily disabling expensive or slow tools
- Keeping configuration for tools you use occasionally
- Testing with different tool combinations

## Core Commands

Commands are listed in typical workflow order:

1. **`overture doctor`** - Check system for installed clients
2. **`overture init`** - Initialize Overture configuration
3. **`overture import`** - Import existing MCP configs (optional)
4. **`overture sync`** - Sync configuration and skills to all clients
5. **`overture validate`** - Validate configuration
6. **`overture mcp list`** - List configured MCPs
7. **`overture skill list`** - List available Agent Skills
8. **`overture skill cp`** - Copy skill to project for team sharing
9. **`overture enable mcp`** - Enable disabled MCPs

### `overture init`

Initialize Overture configuration in your project.

```bash
overture init [--type <project-type>]
```

**Options:**

- `--type <project-type>`: Initialize with a specific project template

**Examples:**

```bash
# Basic initialization
overture init

# Initialize a Python backend project
overture init --type python-backend

# Initialize a React frontend project
overture init --type frontend-react
```

**What it does:**

- Creates `.overture/config.yaml` with starter configuration
- Uses project-specific templates if `--type` is specified
- Won't overwrite existing configuration

### `overture doctor`

Check system for installed AI clients and MCP servers.

```bash
overture doctor [--json] [--verbose]
```

**Options:**

- `--json`: Output results as JSON for automation
- `--verbose`: Show detailed warnings and recommendations

**Examples:**

```bash
# Basic diagnostics
overture doctor

# Verbose output with detailed warnings
overture doctor --verbose

# JSON output for CI/CD
overture doctor --json
```

**What it shows:**

1. **Installed AI clients** - Which clients are detected (Claude Code, Claude Desktop, VSCode, Cursor, etc.)
2. **Version information** - Client versions extracted from --version flags
3. **Config file locations** - Where each client's MCP config is located
4. **Config validity** - Whether config files are valid JSON
5. **MCP command availability** - Which MCP server commands are in PATH
6. **Installation recommendations** - Guidance for missing clients or tools

**Example output:**

```
✓ claude-code (v2.1.0) - /usr/local/bin/claude
  Config: ~/.claude.json (valid)

✗ claude-desktop - not installed
  → Install Claude Desktop: https://claude.com/download

MCP Servers:
✓ github - gh (found)
⚠ python-repl - uvx (not found)
  → Install uv: https://docs.astral.sh/uv/

Summary:
  Clients detected: 1 / 7
  MCP commands available: 1 / 2
```

**When to use:**

- **Before initial setup** - See what's already installed
- **Troubleshooting** - Diagnose why sync isn't working
- **Team onboarding** - New members check requirements
- **CI/CD validation** - Verify environment before deployment

### `overture sync`

Synchronize your configuration by installing plugins and generating files.

```bash
overture sync [--dry-run] [--client <name>] [--force]
```

**Options:**

- `--dry-run`: Preview changes without writing files (writes to dist/ for inspection)
- `--client <name>`: Sync only to specific client (e.g., claude-code, vscode)
- `--force`: Force sync even with validation warnings

**Examples:**

```bash
# Standard sync to all detected clients
overture sync

# Preview changes before applying
overture sync --dry-run

# Sync only to Claude Code
overture sync --client claude-code

# Force sync with warnings
overture sync --force
```

**What it does:**

1. Detects installed AI clients (Claude Code, Copilot CLI, OpenCode, etc.)
2. Reads `.overture/config.yaml` and discovers skills
3. Installs enabled plugins via `claude plugin install`
4. Syncs Agent Skills from `~/.config/overture/skills/` to client directories
5. Generates MCP configs for all detected clients
6. Creates backups before writing
7. Generates or updates `CLAUDE.md` with plugin-to-MCP mappings
8. Preserves custom sections in existing `CLAUDE.md`

**When to run:**

- After editing `.overture/config.yaml`
- After cloning a repository with Overture configuration
- When switching branches that have different configurations
- After installing a new AI client

**Example output (v0.2.5):**

```
Syncing MCP configurations...

Client sync results:
  ✓ claude-code:
      Detected (v2.1.0): /usr/local/bin/claude
      Config: ~/.claude.json (valid)
      Backup: ~/.config/overture/backups/claude-code/mcp.json.20250120-143022

  ✓ copilot-cli:
      Detected (v1.2.0): /usr/local/bin/copilot
      Config: ~/.config/github-copilot/mcp.json (valid)
      Note: Excluded 'github' MCP (bundled by Copilot CLI)
      Backup: ~/.config/overture/backups/copilot-cli/mcp.json.20250120-143022

  ✓ opencode:
      Detected (v0.3.0): /usr/local/bin/opencode
      Config: ~/.config/opencode/opencode.json (valid)
      Backup: ~/.config/overture/backups/opencode/opencode.json.20250120-143022

Sync complete! 3/3 clients configured successfully.
```

### `overture enable mcp`

Enable a disabled MCP server.

```bash
overture enable mcp <name>
```

**Examples:**

```bash
# Enable the postgres MCP server
overture enable mcp postgres

# Enable the playwright MCP server
overture enable mcp playwright
```

**What it does:**

1. Sets `enabled: true` in `.overture/config.yaml` for the specified MCP
2. Regenerates `.mcp.json` and `CLAUDE.md`

**Note:** The MCP server must already be defined in your configuration. This command just enables it.

### `overture mcp list`

List all configured MCP servers and their status.

```bash
overture mcp list
```

**Example output:**

```
MCP Servers:

Global (from ~/.claude.json):
  ✓ filesystem
  ✓ context7
  ✓ memory
  ✓ sequentialthinking

Project (from .mcp.json):
  ✓ python-repl        Used by: python-development
  ✓ ruff               Used by: python-development
  ✓ sqlite             Used by: database-design
  ⚠ postgres           Status: Disabled

Legend:
  ✓ Enabled and available
  ⚠ Disabled or unavailable
```

**What it shows:**

- Global vs project-scoped servers
- Enabled/disabled status
- Which plugins use each MCP server
- Warnings for disabled or misconfigured servers

### `overture import`

Import existing MCP configurations from your AI clients into Overture.

```bash
overture import [--client <name>] [--detect] [--format <type>] [--verbose]
```

**Options:**

- `--client <name>`: Import from specific client only (claude-code, copilot-cli, opencode)
- `--detect`: Read-only scan mode - show what MCPs exist without importing
- `--format <type>`: Output format for --detect mode (text, json, table)
- `--verbose`: Show detailed information in --detect mode

**Examples:**

```bash
# Interactive import from all clients
overture import

# Import from specific client
overture import --client claude-code

# Scan for existing MCPs (read-only)
overture import --detect

# Detailed scan with full MCP info
overture import --detect --verbose

# JSON output for CI/CD
overture import --detect --format json

# Compact table view
overture import --detect --format table
```

**What it does:**

**Normal mode** (interactive import):

1. Scans all installed AI clients for MCP configurations
2. Identifies unmanaged MCPs (not yet in Overture)
3. Detects conflicts (same MCP, different configs)
4. Shows interactive selection UI
5. Imports selected MCPs to Overture config
6. Converts hardcoded secrets to environment variables

**Detect mode** (`--detect` flag):

1. Scans all clients for MCP configurations
2. Categorizes MCPs:
   - **Managed** - Already in your Overture config
   - **Unmanaged** - Can be imported
   - **Conflicts** - Same name, different configs across clients
   - **Parse errors** - Malformed configuration files
3. Shows suggested scope (global vs project)
4. No changes made to any files (read-only)
5. Exit codes for automation (0=ok, 1=parse errors, 2=conflicts)

**Example output (detect mode):**

```
📋 MCP Detection Report

✓ Scanned 3 clients

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Managed MCPs (2)

  filesystem, memory

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆕 Unmanaged MCPs (3)

  github, python-repl, ruff

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ No conflicts detected
```

**When to use:**

- **Migrating to Overture** - Import existing MCP setups
- **Before importing** - Use `--detect` to see what exists
- **CI/CD validation** - Check for config issues (`--format json`)
- **Team sync** - Ensure everyone has same MCPs configured

**See also:** [Importing Guide](../docs/howtos/importing-existing-configs.md) for detailed workflows

### `overture skill list`

List available Agent Skills from your config repository.

```bash
# List all skills
overture skill list

# List with source paths
overture skill list --source

# Output as JSON
overture skill list --json
```

Agent Skills are specialized instructions that guide AI assistants on how to perform specific tasks. Skills are stored as `SKILL.md` files in `~/.config/overture/skills/<name>/SKILL.md`.

**Example output:**

```
Available Skills:

NAME              DESCRIPTION
────────────────────────────────────────────────────────────────────────────────
debugging         Advanced debugging techniques for complex issues
code-review       Code review best practices and checklists
testing           Testing strategies and TDD workflows

Total: 3 skills
```

### `overture skill cp`

Copy a skill from your config repository to the current project.

```bash
# Copy skill to project (for team sharing)
overture skill cp debugging

# Copy with force overwrite
overture skill cp debugging --force

# Copy for specific client only
overture skill cp debugging --client claude-code
```

**What it does:**

1. Reads the skill from `~/.config/overture/skills/<name>/SKILL.md`
2. Copies it to project directories:
   - `.claude/skills/<name>/SKILL.md` (Claude Code)
   - `.github/skills/<name>/SKILL.md` (Copilot CLI)
   - `.opencode/skill/<name>/SKILL.md` (OpenCode)
3. Can be committed to version control for team sharing

**When to use:**

- Sharing skills with your team via git
- Creating project-specific skills that differ from global ones
- Documenting project-specific workflows

**Example output:**

```
Copied 'debugging' skill to project:

  ✓ .claude/skills/debugging/SKILL.md
  ✓ .github/skills/debugging/SKILL.md
  ✓ .opencode/skill/debugging/SKILL.md
```

### `overture validate`

Validate your Overture configuration.

```bash
overture validate
```

**What it checks:**

1. **Schema validation** - Ensures `.overture/config.yaml` follows the correct format
2. **MCP command availability** - Checks if MCP commands exist on your system PATH
3. **Reference integrity** - Warns if plugins reference MCP servers that aren't defined
4. **Plugin marketplace** - Verifies marketplace names are valid

**Example output:**

```
Validating configuration...

✓ Configuration schema is valid
✓ All plugin references are defined
⚠ Warning: MCP command 'docker-mcp-server' not found on PATH
✗ Error: Plugin 'testing' references undefined MCP 'jest-runner'

Summary: 2 warnings, 1 error
```

**Exit codes:**

- `0` - Validation passed (may have warnings)
- `1` - Validation failed with errors

## Common Workflows

### Setting Up a Python Project

Let's walk through setting up Overture for a Python FastAPI project.

#### Step 1: Initialize with Python Template

```bash
cd my-fastapi-project
overture init --type python-backend
```

This creates a `.overture/config.yaml` with Python-specific plugins:

```yaml
version: '1.0'

project:
  name: my-fastapi-project
  type: python-backend

plugins:
  python-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [python-repl, ruff, filesystem]

mcp:
  filesystem:

  python-repl:
    command: uvx
    args: [mcp-server-python-repl]

  ruff:
    command: uvx
    args: [mcp-server-ruff]
```

#### Step 2: Add Database Support

Edit `.overture/config.yaml` to add database tools:

```yaml
plugins:
  # ... existing plugins ...

  database-design:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [sqlite, filesystem]

mcp:
  # ... existing MCPs ...

  sqlite:
    command: uvx
    args: [mcp-server-sqlite, --db-path, ./dev.db]
```

#### Step 3: Sync Configuration

```bash
overture sync
```

This installs the plugins and generates your configuration files.

#### Step 4: Verify Setup

Check that everything is configured:

```bash
overture mcp list
```

You should see all your MCP servers listed and enabled.

#### Step 5: Optional - Add PostgreSQL for Production

For production database access, add PostgreSQL but keep it disabled by default:

```yaml
mcp:
  # ... existing MCPs ...

  postgres:
    command: docker
    args: [run, -i, --rm, mcp-postgres]
    env:
      POSTGRES_URL: '${DATABASE_URL}'
    enabled: false
```

When you need to work with the production database:

```bash
overture enable mcp postgres
```

### Adding MCP Servers to an Existing Project

Let's say you have an existing project and want to add GitHub integration.

#### Step 1: Add the GitHub Plugin

Edit `.overture/config.yaml`:

```yaml
plugins:
  # ... existing plugins ...

  git-pr-workflows:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [github, filesystem]
```

#### Step 2: Configure the GitHub MCP Server

Add the MCP server configuration:

```yaml
mcp:
  # ... existing MCPs ...

  github:
    command: mcp-server-github
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}'
```

#### Step 3: Set Your GitHub Token

Make sure your environment has the `GITHUB_TOKEN` variable:

```bash
export GITHUB_TOKEN="ghp_your_token_here"
```

Or add it to your shell profile (`.bashrc`, `.zshrc`, etc.).

#### Step 4: Sync and Verify

```bash
overture sync
overture validate
```

The validate command will warn you if the `GITHUB_TOKEN` environment variable isn't set.

### Managing Plugins Across Team Members

Overture configuration can be committed to version control, making it easy to share setups across your team.

#### Step 1: Commit Configuration

```bash
git add .overture/config.yaml
git commit -m "Add Overture configuration for Python development"
git push
```

**What NOT to commit:**

- `.mcp.json` - This is generated locally
- `CLAUDE.md` - This is generated, but you may want to commit custom sections
- Environment variables or secrets

#### Step 2: Team Members Clone and Sync

When a team member clones the repository:

```bash
git clone https://github.com/yourteam/project.git
cd project
overture sync
```

This installs all the configured plugins and sets up their local environment.

#### Step 3: Update Configuration

When you update `.overture/config.yaml`:

```bash
# Update the config
vim .overture/config.yaml

# Test locally
overture sync
overture validate

# Commit and push
git add .overture/config.yaml
git commit -m "Add testing plugin"
git push
```

Team members just need to run:

```bash
git pull
overture sync
```

### Working with Multiple Projects

You might work on different types of projects. Overture makes it easy to maintain different configurations.

#### Project 1: Python API

```yaml
# python-api/.overture/config.yaml
plugins:
  python-development:
    marketplace: claude-code-workflows
    mcps: [python-repl, ruff]

  database-design:
    marketplace: claude-code-workflows
    mcps: [sqlite]

mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
  # ... more Python MCPs
```

#### Project 2: React Frontend

```yaml
# react-app/.overture/config.yaml
plugins:
  javascript-typescript:
    marketplace: claude-code-workflows
    mcps: [node, npm]

  frontend-development:
    marketplace: claude-code-workflows
    mcps: [filesystem]

mcp:
  node:
    command: node-mcp-server
  # ... more JavaScript MCPs
```

#### Benefits:

- Each project loads only relevant plugins and tools
- No Python tools loaded in your React project
- No JavaScript tools loaded in your Python project
- Claude gets appropriate guidance for each project context
- Faster startup and less memory usage

## Configuration Reference

### Project Section

```yaml
project:
  name: string # Project name (required)
  type: string # Project type (optional)
  description: string # Project description (optional)
```

**Project Types:**

- `python-backend` - Python backend service
- `java-spring` - Java Spring Boot application
- `frontend-react` - React frontend application
- `typescript-monorepo` - TypeScript monorepo
- `general` - Generic project type

### Plugin Configuration

```yaml
plugins:
  <plugin-name>:
    marketplace: string # Marketplace name (required)
    enabled: boolean # Enable/disable plugin (default: true)
    mcps: string[] # MCP servers this plugin uses (required)
```

**Common Plugins:**

- `python-development` - Python language support and tooling
- `javascript-typescript` - JavaScript/TypeScript support
- `backend-development` - Backend architecture and API design
- `frontend-development` - Frontend frameworks and UI
- `database-design` - Database schema and SQL
- `testing` - Testing strategies and frameworks
- `git-pr-workflows` - Git and pull request workflows

### MCP Server Configuration

```yaml
mcp:
  <mcp-name>:
    command: string # Executable command (required for project scope)
    args: string[] # Command arguments (optional)
    env: map<string, string> # Environment variables (optional)
    enabled: boolean # Enable/disable (default: true)
```

**Common MCP Servers:**

**Python:**

- `python-repl` - Execute Python code
- `ruff` - Python linting and formatting

**JavaScript/TypeScript:**

- Check https://github.com/modelcontextprotocol/servers for available Node.js MCPs

**Databases:**

- `sqlite` - SQLite database queries (via mcp-server-sqlite)
- `postgres` - PostgreSQL database access (via mcp-server-postgres)

**DevOps:**

- Check https://github.com/modelcontextprotocol/servers for Docker/K8s MCPs

**Version Control:**

- `github` - GitHub API access
- `gitlab` - GitLab API access

**Universal:**

- `filesystem` - File operations (usually global)
- `context7` - Documentation retrieval (usually global)
- `memory` - Cross-conversation memory (usually global)

### Environment Variable Substitution

Use `${VARIABLE_NAME}` syntax in any string value:

```yaml
mcp:
  github:
    command: mcp-server-github
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}'
      API_URL: '${GITHUB_API_URL:-https://api.github.com}'
```

You can provide defaults using `${VAR:-default}` syntax.

## Troubleshooting

### Debug Mode

Enable debug mode to see detailed error information and stack traces:

```bash
DEBUG=1 overture sync
```

**What Debug Mode Shows:**

- Full stack traces for errors
- Detailed validation messages
- File operation logs
- Internal state information

**When to Use Debug Mode:**

- Investigating sync failures
- Reporting bugs (include debug output)
- Understanding why a config isn't loading
- Tracking down file permission issues

**Example:**

```bash
# Normal mode (concise errors)
$ overture sync
✗ Config file not found: /path/to/config.yaml

# Debug mode (detailed stack traces)
$ DEBUG=1 overture sync
→ Loading config from /path/to/config.yaml
✗ Config file not found: /path/to/config.yaml
  Error: ENOENT: no such file or directory
    at Object.readFileSync (node:fs:441:20)
    at ConfigLoader.loadUserConfig (/path/to/config-loader.ts:123:45)
    ...
```

### Configuration Not Loading

**Problem:** Changes to `.overture/config.yaml` don't take effect.

**Solution:**

```bash
overture sync
```

You must run `sync` after editing the configuration to regenerate `.mcp.json` and `CLAUDE.md`.

### MCP Server Command Not Found

**Problem:** Validation shows "command not found" errors.

**Solution:**

1. Check if the command is installed:

   ```bash
   which uvx
   # or
   which docker
   ```

2. Install missing commands:

   ```bash
   # For uvx (Python tools)
   pip install uv

   # For Docker
   # Install from docker.com
   ```

3. Verify the command path:
   ```bash
   overture validate
   ```

### Plugin Installation Fails

**Problem:** `overture sync` fails to install a plugin.

**Solution:**

1. Check if Claude CLI is installed:

   ```bash
   claude --version
   ```

2. Try installing the plugin manually:

   ```bash
   claude plugin install <plugin-name>@<marketplace>
   ```

3. Check the marketplace name is correct:
   - Most plugins use `claude-code-workflows`
   - Check the plugin documentation for the correct marketplace

### Environment Variables Not Substituted

**Problem:** Environment variables like `${GITHUB_TOKEN}` appear literally in `.mcp.json`.

**Solution:**

1. Ensure the variable is set:

   ```bash
   echo $GITHUB_TOKEN
   ```

2. Set the variable in your shell:

   ```bash
   export GITHUB_TOKEN="your-token-here"
   ```

3. Add to your shell profile for persistence:

   ```bash
   echo 'export GITHUB_TOKEN="your-token-here"' >> ~/.bashrc
   source ~/.bashrc
   ```

4. Re-run sync:
   ```bash
   overture sync
   ```

### Disabled MCP Still Showing in CLAUDE.md

**Problem:** A disabled MCP appears in the generated `CLAUDE.md`.

**Solution:**

Disabled MCPs are intentionally shown in `CLAUDE.md` with a warning marker. This helps you remember they're available but not active.

To completely remove an MCP from `CLAUDE.md`, delete it from `.overture/config.yaml`:

```yaml
mcp:
  # Remove this entire block
  # postgres:
  #   command: docker
  #   ...
```

Then run:

```bash
overture sync
```

### Custom CLAUDE.md Edits Getting Overwritten

**Problem:** Manual edits to `CLAUDE.md` are lost when running `overture sync`.

**Solution:**

Overture preserves content between `<!-- overture:custom -->` and `<!-- /overture:custom -->` markers.

Add your custom content in this section:

```markdown
---

_Auto-generated by Overture. Manual edits below will be preserved._

<!-- overture:custom -->

## My Custom Notes

This section won't be overwritten by `overture sync`.

<!-- /overture:custom -->
```

Content outside these markers will be regenerated on each sync.

### Schema Validation Errors

**Problem:** `overture validate` reports schema errors.

**Solution:**

Common schema errors:

1. **Missing required field:**

   ```
   Error: plugins.python-development.marketplace is required
   ```

   Add the missing field:

   ```yaml
   plugins:
     python-development:
       marketplace: claude-code-workflows # Add this
       mcps: [python-repl]
   ```

2. **Invalid scope value:**

   ```
   Error: mcp.python-repl.scope must be 'global' or 'project'
   ```

   Fix the scope value:

   ```yaml
   mcp:
     python-repl:
   ```

3. **YAML syntax error:**
   ```
   Error: bad indentation of a mapping entry
   ```
   Check your indentation (use spaces, not tabs):
   ```yaml
   plugins:
     python-development: # 2 spaces
       marketplace: test # 4 spaces
       mcps: [test] # 4 spaces
   ```

### Agents Not Syncing

**Problem:** Agents aren't appearing in AI clients after `overture sync`.

**Solutions:**

1. **Check agent sync status:**

   ```bash
   overture doctor --verbose
   ```

   Look for agent sync status and any validation errors.

2. **Verify agent files exist:**

   ```bash
   ls -la ~/.config/overture/agents/
   ```

   Each agent needs both `.yaml` and `.md` files with matching names.

3. **Validate agent configuration:**

   ```bash
   overture validate
   ```

   Fix any YAML syntax errors or missing required fields.

4. **Force sync agents only:**

   ```bash
   overture sync --skip-skills
   ```

   Skips skills and focuses on agent sync.

### Agent Model Not Found

**Problem:** Error about model not being available for a client.

**Solution:**

Add model mapping to `~/.config/overture/models.yaml`:

```yaml
claude-3-5-sonnet:
  claude-code: claude-3-5-sonnet-20241022
  opencode: claude-3-5-sonnet-20241022
  copilot-cli: claude-3.5-sonnet

gpt-4o:
  copilot-cli: gpt-4o
  opencode: gpt-4o
```

Or use client-specific model overrides in agent YAML:

```yaml
name: my-agent
model: claude-3-5-sonnet # Default
clients:
  copilot-cli:
    model: gpt-4o # Override for Copilot CLI
```

### Agent Validation Fails

**Problem:** Agent validation errors during sync.

**Common Issues:**

1. **Missing .md file:**

   ```
   Error: Agent 'code-reviewer' missing prompt file: code-reviewer.md
   ```

   Create matching `.md` file:

   ```bash
   touch ~/.config/overture/agents/code-reviewer.md
   ```

2. **Invalid YAML syntax:**

   ```
   Error: Failed to parse agent-name.yaml
   ```

   Check YAML syntax - common issues:
   - Use spaces, not tabs for indentation
   - Quote special characters in strings
   - Check array syntax: `[item1, item2]` or multi-line

3. **Missing required fields:**

   ```
   Error: Agent 'my-agent' missing required field: name
   ```

   Add required fields to YAML:

   ```yaml
   name: my-agent # Required
   model: claude-3-5-sonnet # Required
   description: Agent description # Required
   ```

### Getting Help

If you're still having trouble:

1. Check the configuration schema documentation: `docs/overture-schema.md`
2. Look at example configurations: `docs/examples.md`
3. Run validation to see specific errors: `overture validate`
4. Check the GitHub issues for similar problems
5. Open a new issue with your configuration and error output

## Examples

### Example 1: Simple Python Project

A minimal Python project setup:

```yaml
version: '1.0'

project:
  name: python-scripts
  type: python-backend

plugins:
  python-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [python-repl, filesystem]

mcp:
  filesystem:

  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
```

**What you get:**

- Python development expertise from Claude
- Ability to execute Python code via `python-repl`
- File operations via `filesystem`

### Example 2: Full-Stack Application

A comprehensive setup for a full-stack project:

```yaml
version: '1.0'

project:
  name: fullstack-app
  type: python-backend
  description: React frontend with FastAPI backend

plugins:
  # Backend
  python-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [python-repl, ruff, filesystem]

  backend-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [docker, filesystem]

  # Frontend
  javascript-typescript:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [node, npm, filesystem]

  # Database
  database-design:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [sqlite, filesystem]

  # Testing
  testing:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [filesystem]

mcp:
  # Global tools
  filesystem:

  # Python tools
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]

  ruff:
    command: uvx
    args: [mcp-server-ruff]

  # Database
  sqlite:
    command: uvx
    args: [mcp-server-sqlite, --db-path, ./dev.db]

  # Note: JavaScript/Node and Docker MCP servers would be configured here
  # when available. Check https://github.com/modelcontextprotocol/servers
  # for the latest list of official MCP servers.
```

**What you get:**

- Full backend and frontend development support
- Database design and query capabilities
- Testing expertise
- Docker container management
- All tools properly mapped to their respective plugins

### Example 3: Monorepo with Nx

For TypeScript monorepos managed with Nx:

```yaml
version: '1.0'

project:
  name: my-monorepo
  type: typescript-monorepo
  description: Multi-package TypeScript monorepo

plugins:
  javascript-typescript:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [filesystem, nx]

  testing:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [filesystem]

  git-pr-workflows:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [github, filesystem]

mcp:
  filesystem:

  nx:

  github:
    command: mcp-server-github
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}'
```

**What you get:**

- TypeScript development support
- Nx workspace management
- Testing capabilities across the monorepo
- Git and GitHub workflow automation
- Proper tool routing for monorepo structure

### Example 4: Development vs Production Configurations

Use disabled MCPs to maintain different configurations:

```yaml
version: '1.0'

project:
  name: production-api
  type: python-backend

plugins:
  python-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [python-repl, ruff, filesystem]

  database-design:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [sqlite, postgres, filesystem]

mcp:
  filesystem:

  python-repl:
    command: uvx
    args: [mcp-server-python-repl]

  ruff:
    command: uvx
    args: [mcp-server-ruff]

  # Development database (always enabled)
  sqlite:
    command: uvx
    args: [mcp-server-sqlite, --db-path, ./dev.db]
    enabled: true

  # Production database (enable when needed)
  postgres:
    command: docker
    args: [run, -i, --rm, mcp-postgres]
    env:
      POSTGRES_URL: '${DATABASE_URL}'
    enabled: false
```

**Usage:**

Development (default):

```bash
overture sync
# Uses SQLite for local development
```

Production access:

```bash
export DATABASE_URL="postgresql://..."
overture enable mcp postgres
# Now can access production database
```

---

## Next Steps

Now that you understand Overture, try these next steps:

1. **Initialize your first project** - Run `overture init` in a project directory
2. **Explore project templates** - Try different project types with `--type`
3. **Customize your configuration** - Edit `.overture/config.yaml` for your needs
4. **Share with your team** - Commit configuration to version control
5. **Learn more** - Check out the schema documentation and examples

For more detailed information:

- Configuration schema: `docs/overture-schema.md`
- Example configurations: `docs/examples.md`
- Project README: `README.md`

Happy orchestrating!
