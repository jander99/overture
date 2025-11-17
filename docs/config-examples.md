# Overture Configuration Examples

This document provides comprehensive configuration examples for Overture v0.2.5.

## Table of Contents

1. [Minimal Configuration](#1-minimal-configuration)
2. [User Global Configuration](#2-user-global-configuration)
3. [Python Development Project](#3-python-development-project)
4. [Platform-Specific Overrides](#4-platform-specific-overrides)
5. [Client Filtering](#5-client-filtering)
6. [Multi-Language Monorepo](#6-multi-language-monorepo)
7. [Environment Variable Patterns](#7-environment-variable-patterns)
8. [Advanced Client Overrides](#8-advanced-client-overrides)
9. [CI/CD Configuration](#9-cicd-configuration)

---

## 1. Minimal Configuration

The simplest possible Overture configuration with a single MCP server.

**File:** `.overture/config.yaml`

```yaml
version: "1.0"

mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
```

**What it does:**
- Defines a single filesystem MCP server
- Uses npx to run the server
- Scopes to current project directory (`.`)
- Syncs to all enabled clients

**Generated Claude Code config:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "env": {}
    }
  }
}
```

---

## 2. User Global Configuration

A comprehensive user-level configuration with global MCPs and client settings.

**File:** `~/.config/overture.yml`

```yaml
version: "1.0"

# Client-specific settings
clients:
  claude-code:
    enabled: true
  
  claude-desktop:
    enabled: true
  
  vscode:
    enabled: true
    configPath: "~/.continue/config.json"
  
  cursor:
    enabled: true
  
  windsurf:
    enabled: false  # Not using Windsurf
  
  copilot-cli:
    enabled: false  # Copilot CLI bundles its own MCPs
  
  jetbrains-copilot:
    enabled: false

# Global MCP servers (available in all projects)
mcp:
  # File operations
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "${HOME}"]
    transport: "stdio"
    metadata:
      description: "File system access for home directory"
      homepage: "https://github.com/modelcontextprotocol/servers"

  # Long-term memory
  memory:
    command: "npx"
    args: ["-y", "mcp-server-memory"]
    transport: "stdio"
    metadata:
      description: "Persistent memory across conversations"

  # Sequential thinking
  sequentialthinking:
    command: "npx"
    args: ["-y", "mcp-server-sequential-thinking"]
    transport: "stdio"

  # Documentation lookup
  context7:
    command: "npx"
    args: ["-y", "context7-mcp"]
    transport: "stdio"
    env:
      CONTEXT7_API_KEY: "${CONTEXT7_API_KEY}"

  # GitHub integration
  github:
    command: "mcp-server-github"
    args: []
    transport: "stdio"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    metadata:
      description: "GitHub API access (issues, PRs, repos)"
      homepage: "https://github.com/modelcontextprotocol/servers"

# Synchronization settings
sync:
  backup: true
  backupDir: "~/.config/overture/backups"
  backupRetention: 10
  mergeStrategy: "append"
  autoDetectClients: true
```

**What it does:**
- Enables Claude Code, Claude Desktop, VS Code, and Cursor
- Configures 5 global MCPs available in all projects
- Sets up environment variable expansion for API keys
- Configures backup settings
- Uses append strategy to preserve user customizations

---

## 3. Python Development Project

A project-specific configuration for Python development with testing and linting tools.

**File:** `.overture/config.yaml`

```yaml
version: "1.0"

mcp:
  # Python REPL for code execution
  python-repl:
    command: "uvx"
    args: ["mcp-server-python-repl"]
    transport: "stdio"
    platforms:
      exclude: ["win32"]  # uvx not reliable on Windows
      commandOverrides:
        darwin: "/opt/homebrew/bin/uvx"
        linux: "/usr/local/bin/uvx"
    metadata:
      description: "Python REPL for code execution and testing"
      tags: ["python", "repl", "testing"]

  # Ruff linter/formatter
  ruff:
    command: "uvx"
    args: ["mcp-server-ruff"]
    transport: "stdio"
    platforms:
      exclude: ["win32"]
    metadata:
      description: "Python linting and formatting via Ruff"
      tags: ["python", "linting", "formatting"]

  # Pytest test runner
  pytest:
    command: "uvx"
    args: ["mcp-server-pytest", "--project", "."]
    transport: "stdio"
    env:
      PYTEST_ADDOPTS: "${PYTEST_ADDOPTS:--v}"

# Only sync to Claude Code and Cursor (developers' primary tools)
clients:
  enabledClients: ["claude-code", "cursor"]

sync:
  backup: true
  excludeMcps: []
```

**What it does:**
- Configures Python development MCPs (REPL, linting, testing)
- Excludes Windows platform for uvx-based MCPs
- Overrides uvx paths for macOS and Linux
- Only syncs to Claude Code and Cursor (not VS Code or others)
- Allows pytest options via environment variable

---

## 4. Platform-Specific Overrides

Configuration demonstrating platform-specific command and argument overrides.

**File:** `.overture/config.yaml`

```yaml
version: "1.0"

mcp:
  # PostgreSQL database access with platform-specific psql paths
  postgres:
    command: "npx"
    args: ["@modelcontextprotocol/server-postgres"]
    transport: "stdio"
    env:
      DATABASE_URL: "${DATABASE_URL}"
    platforms:
      commandOverrides:
        win32: "npx.cmd"  # Windows requires .cmd extension
        darwin: "/opt/homebrew/bin/npx"  # Homebrew path on macOS
      argsOverrides:
        win32: ["--experimental-modules", "@modelcontextprotocol/server-postgres"]
    metadata:
      description: "PostgreSQL database access via MCP"

  # Docker operations with platform-specific docker paths
  docker:
    command: "docker-mcp-server"
    args: []
    transport: "stdio"
    platforms:
      exclude: ["win32"]  # Windows Docker requires different setup
      commandOverrides:
        darwin: "/usr/local/bin/docker-mcp-server"
        linux: "/usr/bin/docker-mcp-server"

  # Windows-specific MCPs
  powershell:
    command: "mcp-server-powershell"
    args: []
    transport: "stdio"
    platforms:
      exclude: ["darwin", "linux"]  # Windows only
    metadata:
      description: "PowerShell execution for Windows automation"

  # macOS-specific MCPs
  macos-shortcuts:
    command: "mcp-server-macos-shortcuts"
    args: []
    transport: "stdio"
    platforms:
      exclude: ["linux", "win32"]  # macOS only
    metadata:
      description: "macOS Shortcuts automation"
```

**What it does:**
- Demonstrates platform exclusions (`exclude: ["win32"]`)
- Shows command overrides per platform
- Shows args overrides per platform
- Includes platform-specific MCPs (PowerShell for Windows, Shortcuts for macOS)

---

## 5. Client Filtering

Configuration demonstrating client inclusion/exclusion patterns.

**File:** `.overture/config.yaml`

```yaml
version: "1.0"

mcp:
  # HTTP transport - not supported by all clients
  github-http:
    command: "mcp-server-github"
    args: ["--transport", "http", "--port", "3000"]
    transport: "http"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    clients:
      exclude: ["vscode", "jetbrains-copilot"]  # Only stdio supported
    metadata:
      description: "GitHub API via HTTP transport"

  # Stdio transport - universal compatibility
  github-stdio:
    command: "mcp-server-github"
    args: []
    transport: "stdio"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    metadata:
      description: "GitHub API via stdio transport"

  # Only for Claude clients
  claude-specific:
    command: "mcp-server-claude-extensions"
    args: []
    transport: "stdio"
    clients:
      include: ["claude-code", "claude-desktop"]  # Whitelist Claude only
    metadata:
      description: "Claude-specific extensions and tools"

  # Exclude Copilot CLI (bundles its own GitHub MCP)
  github-bundled:
    command: "mcp-server-github"
    args: []
    transport: "stdio"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    clients:
      exclude: ["copilot-cli"]  # Copilot bundles this
    metadata:
      description: "GitHub integration (excluded from Copilot CLI)"

  # Only for JetBrains
  jetbrains-tools:
    command: "mcp-server-jetbrains"
    args: []
    transport: "stdio"
    clients:
      include: ["jetbrains-copilot"]  # JetBrains only
    metadata:
      description: "JetBrains-specific IDE integrations"
```

**What it does:**
- Demonstrates `clients.exclude` for blacklisting clients
- Demonstrates `clients.include` for whitelisting clients
- Shows transport compatibility filtering
- Prevents duplication when clients bundle MCPs

---

## 6. Multi-Language Monorepo

A comprehensive configuration for a large monorepo with multiple languages and tools.

**File:** `.overture/config.yaml`

```yaml
version: "1.0"

mcp:
  # ============================================================================
  # Universal Tools
  # ============================================================================

  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    metadata:
      description: "File system access for entire monorepo"
      tags: ["universal", "filesystem"]

  github:
    command: "mcp-server-github"
    args: []
    transport: "stdio"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    metadata:
      description: "GitHub integration for issues, PRs, and repo management"
      tags: ["universal", "vcs"]

  nx:
    command: "npx"
    args: ["-y", "nx-mcp-server"]
    transport: "stdio"
    metadata:
      description: "Nx monorepo management and build orchestration"
      tags: ["universal", "build", "monorepo"]

  # ============================================================================
  # Python Tools
  # ============================================================================

  python-repl:
    command: "uvx"
    args: ["mcp-server-python-repl"]
    transport: "stdio"
    platforms:
      exclude: ["win32"]
    metadata:
      description: "Python REPL for backend services"
      tags: ["python", "repl"]

  ruff:
    command: "uvx"
    args: ["mcp-server-ruff"]
    transport: "stdio"
    platforms:
      exclude: ["win32"]
    metadata:
      description: "Python linting and formatting"
      tags: ["python", "linting"]

  pytest:
    command: "uvx"
    args: ["mcp-server-pytest", "--project", "apps/api"]
    transport: "stdio"
    env:
      PYTEST_ADDOPTS: "-v --cov"
    metadata:
      description: "Python testing for API services"
      tags: ["python", "testing"]

  # ============================================================================
  # JavaScript/TypeScript Tools
  # ============================================================================

  typescript-language-server:
    command: "npx"
    args: ["-y", "mcp-server-typescript"]
    transport: "stdio"
    metadata:
      description: "TypeScript language server integration"
      tags: ["typescript", "language-server"]

  eslint:
    command: "npx"
    args: ["-y", "mcp-server-eslint", "--project", "."]
    transport: "stdio"
    metadata:
      description: "ESLint for JavaScript/TypeScript linting"
      tags: ["javascript", "typescript", "linting"]

  # ============================================================================
  # Database Tools
  # ============================================================================

  postgres:
    command: "npx"
    args: ["@modelcontextprotocol/server-postgres"]
    transport: "stdio"
    env:
      DATABASE_URL: "${DATABASE_URL}"
    platforms:
      commandOverrides:
        win32: "npx.cmd"
    clients:
      overrides:
        vscode:
          env:
            DATABASE_URL: "postgresql://localhost:5432/dev"
        cursor:
          env:
            DATABASE_URL: "postgresql://localhost:5432/test"
    metadata:
      description: "PostgreSQL database access"
      tags: ["database", "postgres"]

  sqlite:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "./local.db"]
    transport: "stdio"
    metadata:
      description: "SQLite for local development databases"
      tags: ["database", "sqlite"]

  # ============================================================================
  # DevOps Tools
  # ============================================================================

  docker:
    command: "docker-mcp-server"
    args: []
    transport: "stdio"
    platforms:
      exclude: ["win32"]
    metadata:
      description: "Docker container management"
      tags: ["devops", "containers"]

  kubernetes:
    command: "kubectl-mcp-server"
    args: ["--context", "dev-cluster"]
    transport: "stdio"
    env:
      KUBECONFIG: "${KUBECONFIG:-~/.kube/config}"
    metadata:
      description: "Kubernetes cluster management"
      tags: ["devops", "kubernetes"]

# Client configuration
clients:
  enabledClients: ["claude-code", "vscode", "cursor"]

# Sync settings
sync:
  backup: true
  backupRetention: 15
  excludeMcps: []  # Include all MCPs
```

**What it does:**
- Organizes MCPs by category (Universal, Python, JS/TS, Database, DevOps)
- Configures 13 different MCP servers for multi-language development
- Uses platform exclusions for platform-specific tools
- Configures client-specific database URLs for different environments
- Includes metadata for documentation and discovery
- Syncs to three primary clients: Claude Code, VS Code, Cursor

---

## 7. Environment Variable Patterns

Examples of environment variable expansion patterns.

**File:** `.overture/config.yaml`

```yaml
version: "1.0"

mcp:
  # Simple expansion (required variable)
  github:
    command: "mcp-server-github"
    args: []
    transport: "stdio"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"  # Error if not set

  # Expansion with default value
  postgres:
    command: "npx"
    args: ["@modelcontextprotocol/server-postgres"]
    transport: "stdio"
    env:
      DATABASE_URL: "${DATABASE_URL:-postgresql://localhost:5432/dev}"
      MAX_CONNECTIONS: "${MAX_CONNECTIONS:-10}"
      TIMEOUT: "${TIMEOUT:-30000}"

  # Multiple environment variables
  aws-tools:
    command: "mcp-server-aws"
    args: []
    transport: "stdio"
    env:
      AWS_ACCESS_KEY_ID: "${AWS_ACCESS_KEY_ID}"
      AWS_SECRET_ACCESS_KEY: "${AWS_SECRET_ACCESS_KEY}"
      AWS_REGION: "${AWS_REGION:-us-east-1}"
      AWS_PROFILE: "${AWS_PROFILE:-default}"

  # Boolean flags
  debug-logger:
    command: "mcp-server-logger"
    args: []
    transport: "stdio"
    env:
      DEBUG: "${DEBUG:-false}"
      LOG_LEVEL: "${LOG_LEVEL:-info}"
      VERBOSE: "${VERBOSE:-false}"

  # Path expansions
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "${WORKSPACE:-${HOME}/workspace}"]
    transport: "stdio"

  # API configuration
  openai:
    command: "mcp-server-openai"
    args: []
    transport: "stdio"
    env:
      OPENAI_API_KEY: "${OPENAI_API_KEY}"
      OPENAI_ORG_ID: "${OPENAI_ORG_ID:-}"  # Optional, empty string if not set
      OPENAI_BASE_URL: "${OPENAI_BASE_URL:-https://api.openai.com/v1}"
      OPENAI_MODEL: "${OPENAI_MODEL:-gpt-4}"
```

**What it does:**
- Shows simple expansion (`${VAR}`)
- Shows expansion with defaults (`${VAR:-default}`)
- Demonstrates multiple env vars per MCP
- Shows boolean flags via environment variables
- Shows path expansion patterns
- Shows optional variables (empty string default)

---

## 8. Advanced Client Overrides

Complex client-specific override patterns.

**File:** `.overture/config.yaml`

```yaml
version: "1.0"

mcp:
  # Different database per client
  postgres:
    command: "npx"
    args: ["@modelcontextprotocol/server-postgres"]
    transport: "stdio"
    env:
      DATABASE_URL: "${DATABASE_URL}"
    clients:
      overrides:
        claude-code:
          env:
            DATABASE_URL: "postgresql://localhost:5432/prod_readonly"
        vscode:
          env:
            DATABASE_URL: "postgresql://localhost:5432/dev"
        cursor:
          env:
            DATABASE_URL: "postgresql://localhost:5432/test"

  # Different GitHub tokens per client (personal vs work)
  github:
    command: "mcp-server-github"
    args: []
    transport: "stdio"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"  # Personal token
    clients:
      overrides:
        jetbrains-copilot:
          env:
            GITHUB_TOKEN: "${GITHUB_WORK_TOKEN}"  # Work token for JetBrains

  # Different commands per client
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"
    clients:
      overrides:
        claude-code:
          args: ["-y", "@modelcontextprotocol/server-filesystem", "${HOME}/projects"]
        vscode:
          args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
        cursor:
          args: ["-y", "@modelcontextprotocol/server-filesystem", "./src"]

  # Transport overrides per client
  api-server:
    command: "mcp-api-server"
    args: ["--port", "3000"]
    transport: "http"
    clients:
      overrides:
        vscode:
          transport: "stdio"  # VS Code doesn't support HTTP well
          args: []  # Remove port argument for stdio
      exclude: ["jetbrains-copilot"]  # JetBrains doesn't support HTTP at all

  # Complex multi-override
  cloud-tools:
    command: "mcp-server-cloud"
    args: ["--provider", "aws"]
    transport: "stdio"
    env:
      CLOUD_PROVIDER: "${CLOUD_PROVIDER:-aws}"
      CLOUD_REGION: "${CLOUD_REGION:-us-east-1}"
    platforms:
      commandOverrides:
        win32: "npx.cmd"
      argsOverrides:
        win32: ["--provider", "azure", "--windows-mode"]
    clients:
      overrides:
        claude-code:
          env:
            CLOUD_PROVIDER: "aws"
            CLOUD_REGION: "us-east-1"
        vscode:
          env:
            CLOUD_PROVIDER: "gcp"
            CLOUD_REGION: "us-central1"
        jetbrains-copilot:
          args: ["--provider", "azure"]
          env:
            CLOUD_PROVIDER: "azure"
            CLOUD_REGION: "eastus"
```

**What it does:**
- Shows per-client database URLs
- Shows per-client API tokens (personal vs work)
- Shows per-client command arguments
- Shows transport overrides per client
- Demonstrates combining platform + client overrides
- Shows complex multi-level override scenarios

---

## 9. CI/CD Configuration

Configuration for continuous integration environments where binary detection should be skipped.

**File:** `.overture/config.yaml`

```yaml
version: "1.0"

# Skip binary detection in CI/CD environments
skipBinaryDetection: true

mcp:
  github:
    command: "gh"
    args: ["mcp"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"

  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
```

**GitHub Actions Workflow:**

```yaml
name: Generate MCP Configs

on:
  pull_request:
  push:
    branches: [main]

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Overture
        run: npm install -g @overture/cli

      - name: Generate configs (dry-run)
        run: overture sync --dry-run
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Validate generated configs
        run: |
          cat dist/claude-code-mcp.json
          cat dist/claude-desktop-mcp.json
```

**What it does:**
- `skipBinaryDetection: true` - Prevents Overture from checking for installed AI clients
- Generates configs for all clients regardless of whether they're installed
- Useful in CI/CD where clients aren't installed but config validation is needed
- `--dry-run` outputs configs to `dist/` for inspection without modifying system files

**GitLab CI Example:**

```yaml
validate-mcp-config:
  stage: test
  image: node:20
  script:
    - npm install -g @overture/cli
    - overture sync --dry-run
    - overture validate
  artifacts:
    paths:
      - dist/
    expire_in: 1 week
```

---

## Configuration Templates by Project Type

### Web Frontend (React/Vue/Angular)

```yaml
version: "1.0"

mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"

  typescript-language-server:
    command: "npx"
    args: ["-y", "mcp-server-typescript"]
    transport: "stdio"

  eslint:
    command: "npx"
    args: ["-y", "mcp-server-eslint"]
    transport: "stdio"

  github:
    command: "mcp-server-github"
    transport: "stdio"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

### Backend API (Python FastAPI/Django)

```yaml
version: "1.0"

mcp:
  python-repl:
    command: "uvx"
    args: ["mcp-server-python-repl"]
    transport: "stdio"
    platforms:
      exclude: ["win32"]

  ruff:
    command: "uvx"
    args: ["mcp-server-ruff"]
    transport: "stdio"

  postgres:
    command: "npx"
    args: ["@modelcontextprotocol/server-postgres"]
    transport: "stdio"
    env:
      DATABASE_URL: "${DATABASE_URL}"

  github:
    command: "mcp-server-github"
    transport: "stdio"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

### Full-Stack Monorepo (Nx/Turborepo)

```yaml
version: "1.0"

mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    transport: "stdio"

  nx:
    command: "npx"
    args: ["-y", "nx-mcp-server"]
    transport: "stdio"

  typescript-language-server:
    command: "npx"
    args: ["-y", "mcp-server-typescript"]
    transport: "stdio"

  postgres:
    command: "npx"
    args: ["@modelcontextprotocol/server-postgres"]
    transport: "stdio"
    env:
      DATABASE_URL: "${DATABASE_URL}"

  github:
    command: "mcp-server-github"
    transport: "stdio"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

---

## Best Practices

### 1. Organize MCPs by File Location (Implicit Scoping)
- Global MCPs in `~/.config/overture.yml` for MCPs used across all projects (filesystem, memory, github)
- Project-specific MCPs in `.overture/config.yaml` for project-specific MCPs (databases, language servers)
- Note: As of Overture v2.0, the `scope` field has been removed. Scope is implicit based on file location.

### 2. Leverage Environment Variables
- Store secrets in environment variables, not config files
- Use defaults for non-sensitive configuration (`${VAR:-default}`)
- Use `.env` files for local development

### 3. Platform Exclusions
- Exclude platforms where tools don't work (`uvx` on Windows)
- Use platform overrides for different installation paths

### 4. Client Filtering
- Exclude clients that don't support a transport type
- Use whitelisting (`include`) when MCP is client-specific
- Avoid duplication when clients bundle MCPs (Copilot CLI)

### 5. Metadata for Documentation
- Add descriptions to help others understand MCP purpose
- Include homepage links for further reading
- Use tags for categorization and filtering

### 6. Backup Configuration
- Always enable backups (`sync.backup: true`)
- Increase retention for production systems
- Test restore process periodically

### 7. Testing Configuration
- Use `overture validate` before committing
- Test on all target platforms
- Verify client exclusions work as expected

---

## Common Pitfalls

### ❌ Missing Transport Field
```yaml
# WRONG - transport is required in v2.0
mcp:
  github:
    command: "mcp-server-github"
```

```yaml
# CORRECT
mcp:
  github:
    command: "mcp-server-github"
    transport: "stdio"  # Required!
```

### ❌ Using Both Include and Exclude
```yaml
# WRONG - mutually exclusive
mcp:
  github:
    clients:
      include: ["claude-code"]
      exclude: ["vscode"]  # Conflict!
```

```yaml
# CORRECT - use one or the other
mcp:
  github:
    clients:
      include: ["claude-code", "cursor"]  # Whitelist
```

### ❌ Platform-Specific Paths Without Overrides
```yaml
# WRONG - hard-coded macOS path
mcp:
  python:
    command: "/opt/homebrew/bin/python3"  # Breaks on Linux/Windows
```

```yaml
# CORRECT - use overrides
mcp:
  python:
    command: "python3"  # Default
    platforms:
      commandOverrides:
        darwin: "/opt/homebrew/bin/python3"
        win32: "python"
```

### ❌ Secrets in Config Files
```yaml
# WRONG - hard-coded token
mcp:
  github:
    env:
      GITHUB_TOKEN: "ghp_abc123xyz"  # Never hard-code secrets!
```

```yaml
# CORRECT - use environment variables
mcp:
  github:
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"  # Reads from environment
```

---

## Additional Resources

- [Configuration Schema](./overture-schema.md) - Schema definitions and TypeScript interfaces
- [User Guide](./user-guide.md) - Complete guide to using Overture
- [Quick Start](./QUICKSTART.md) - Get started in 5 minutes
- [Examples](./examples.md) - Real-world usage examples
- [MCP Server Directory](https://github.com/modelcontextprotocol/servers) - Official MCP servers
