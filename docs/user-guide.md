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

Overture acts as an orchestration layer that:

1. **Connects plugins to their recommended tools** - You declare which MCP servers each plugin should use
2. **Generates project-specific configuration** - Creates `.mcp.json` with only the tools your project needs
3. **Guides Claude's tool selection** - Generates `CLAUDE.md` that tells Claude which tools to prefer for each plugin
4. **Validates your setup** - Checks that required tools are available

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

### 1. Initialize Your Project

Navigate to your project directory and run:

```bash
cd my-project
overture init
```

This creates a `.overture/config.yaml` file with basic configuration:

```yaml
version: "1.0"

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
version: "1.0"

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
    scope: project
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

These are configured in your global Claude settings (`~/.config/claude/mcp.json`) and available to all projects:

```yaml
mcp:
  filesystem:
    scope: global

  memory:
    scope: global
```

You just reference them by setting `scope: global`. No need to specify commands.

#### Project MCP Servers

These are specific to your project:

```yaml
mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    scope: project

  sqlite:
    command: uvx
    args: [mcp-server-sqlite, --db-path, ./dev.db]
    scope: project
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
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    scope: project
```

Overture will substitute `${GITHUB_TOKEN}` with the actual value from your environment.

### Disabling Components

You can disable plugins or MCP servers without removing them:

```yaml
plugins:
  testing:
    marketplace: claude-code-workflows
    enabled: false  # Plugin won't be installed
    mcps: [filesystem]

mcp:
  postgres:
    command: docker
    args: [run, -i, --rm, mcp-postgres]
    scope: project
    enabled: false  # MCP won't be configured
```

This is useful for:
- Temporarily disabling expensive or slow tools
- Keeping configuration for tools you use occasionally
- Testing with different tool combinations

## Core Commands

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

### `overture sync`

Synchronize your configuration by installing plugins and generating files.

```bash
overture sync
```

**What it does:**
1. Reads `.overture/config.yaml`
2. Installs enabled plugins via `claude plugin install`
3. Generates `.mcp.json` with project-scoped MCP servers
4. Generates or updates `CLAUDE.md` with plugin-to-MCP mappings
5. Preserves custom sections in existing `CLAUDE.md`

**When to run:**
- After editing `.overture/config.yaml`
- After cloning a repository with Overture configuration
- When switching branches that have different configurations

**Example output:**
```
Syncing Overture configuration...

Installing plugins:
✓ python-development@claude-code-workflows
✓ database-design@claude-code-workflows

Generating configuration:
✓ .mcp.json (3 MCP servers)
✓ CLAUDE.md (2 plugins, 3 MCPs)

Sync complete!
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

Global (from ~/.config/claude/mcp.json):
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
version: "1.0"

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
    scope: global

  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    scope: project

  ruff:
    command: uvx
    args: [mcp-server-ruff]
    scope: project
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
    scope: project
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
      POSTGRES_URL: "${DATABASE_URL}"
    scope: project
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
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    scope: project
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
    scope: project
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
    scope: project
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
  name: string           # Project name (required)
  type: string          # Project type (optional)
  description: string   # Project description (optional)
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
    marketplace: string    # Marketplace name (required)
    enabled: boolean      # Enable/disable plugin (default: true)
    mcps: string[]       # MCP servers this plugin uses (required)
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
    command: string              # Executable command (required for project scope)
    args: string[]              # Command arguments (optional)
    env: map<string, string>    # Environment variables (optional)
    scope: global | project     # Where configured (required)
    enabled: boolean            # Enable/disable (default: true)
```

**Common MCP Servers:**

**Python:**
- `python-repl` - Execute Python code
- `ruff` - Python linting and formatting

**JavaScript/TypeScript:**
- `node` - Node.js runtime tools
- `npm` - NPM package management
- `playwright` - Browser automation testing

**Databases:**
- `sqlite` - SQLite database queries
- `postgres` - PostgreSQL database access

**DevOps:**
- `docker` - Docker container management
- `kubernetes` - Kubernetes cluster management

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
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
      API_URL: "${GITHUB_API_URL:-https://api.github.com}"
```

You can provide defaults using `${VAR:-default}` syntax.

## Troubleshooting

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
*Auto-generated by Overture. Manual edits below will be preserved.*

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
       marketplace: claude-code-workflows  # Add this
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
       scope: project  # Must be 'global' or 'project'
   ```

3. **YAML syntax error:**
   ```
   Error: bad indentation of a mapping entry
   ```
   Check your indentation (use spaces, not tabs):
   ```yaml
   plugins:
     python-development:    # 2 spaces
       marketplace: test    # 4 spaces
       mcps: [test]        # 4 spaces
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
version: "1.0"

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
    scope: global

  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    scope: project
```

**What you get:**
- Python development expertise from Claude
- Ability to execute Python code via `python-repl`
- File operations via `filesystem`

### Example 2: Full-Stack Application

A comprehensive setup for a full-stack project:

```yaml
version: "1.0"

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
    scope: global

  # Python tools
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    scope: project

  ruff:
    command: uvx
    args: [mcp-server-ruff]
    scope: project

  # JavaScript tools
  node:
    command: node-mcp-server
    scope: project

  npm:
    command: npm-mcp-server
    scope: project

  # Database
  sqlite:
    command: uvx
    args: [mcp-server-sqlite, --db-path, ./dev.db]
    scope: project

  # DevOps
  docker:
    command: docker-mcp-server
    scope: project
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
version: "1.0"

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
    scope: global

  nx:
    scope: global

  github:
    command: mcp-server-github
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    scope: project
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
version: "1.0"

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
    scope: global

  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    scope: project

  ruff:
    command: uvx
    args: [mcp-server-ruff]
    scope: project

  # Development database (always enabled)
  sqlite:
    command: uvx
    args: [mcp-server-sqlite, --db-path, ./dev.db]
    scope: project
    enabled: true

  # Production database (enable when needed)
  postgres:
    command: docker
    args: [run, -i, --rm, mcp-postgres]
    env:
      POSTGRES_URL: "${DATABASE_URL}"
    scope: project
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
