# Overture Configuration Schema

## Overview

Overture bridges Claude Code plugins and MCP servers by:
1. Installing plugins via Claude CLI based on configuration
2. Generating `.mcp.json` with project-scoped MCP servers
3. Generating `CLAUDE.md` with plugin↔MCP usage guidance

## Configuration Files

### Global Configuration: `~/.config/overture/config.yaml`

Defines user-level preferences and globally available MCP servers.

**Note:** MCPs defined in this file are automatically treated as global scope (synced to `~/.config/claude/mcp.json`).

```yaml
version: "1.0"

# Global MCP servers (synced to ~/.config/claude/mcp.json)
mcp:
  filesystem:
    command: npx
    args: [-y, @modelcontextprotocol/server-filesystem, /home/user]

  memory:
    command: npx
    args: [-y, @modelcontextprotocol/server-memory]

  context7:
    command: npx
    args: [-y, @context7/server]

# Default plugins for new projects
default_plugins:
  - code-review-ai
  - git-pr-workflows
```

### Project Configuration: `<project>/.overture/config.yaml`

Declares which plugins to install and which MCP servers to configure.

**Note:** MCPs defined in this file are automatically treated as project scope (synced to `.mcp.json`).

```yaml
version: "1.0"

project:
  name: my-app
  type: python-backend
  description: FastAPI backend service

# Plugins to install via Claude CLI
plugins:
  python-development:
    marketplace: claude-code-workflows  # Uses: claude plugin install python-development@claude-code-workflows
    enabled: true
    mcps: [python-repl, ruff, filesystem]  # MCPs this plugin uses

  backend-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [filesystem, docker]

# MCP server configurations (synced to .mcp.json)
mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]

  ruff:
    command: uvx
    args: [mcp-server-ruff]

  docker:
    command: docker-mcp-server

  github:
    command: mcp-server-github
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"

  postgres:
    command: docker
    args: [run, -i, --rm, mcp-postgres]
    env:
      POSTGRES_URL: "${DATABASE_URL}"
    enabled: false  # Disabled by default, enable with: overture enable mcp postgres
```

## Schema Definitions

### Plugin Declaration

```yaml
plugin_name:
  marketplace: string         # Marketplace name (e.g., claude-code-workflows)
  enabled: boolean           # Whether plugin is enabled (default: true)
  mcps: string[]            # List of MCP server names this plugin uses
```

### MCP Server Declaration

```yaml
mcp_server_name:
  # Execution configuration
  command: string              # Executable command
  args: string[]              # Command arguments (optional)
  env: map<string, string>    # Environment variables (optional)

  # Metadata
  enabled: boolean            # Whether server is active (default: true)
```

**Note:** Scope is implicit based on file location:
- MCPs in `~/.config/overture/config.yaml` are global (synced to `~/.config/claude/mcp.json`)
- MCPs in `.overture/config.yaml` are project-scoped (synced to `.mcp.json`)

## Generated CLAUDE.md Structure

Overture generates CLAUDE.md with the following sections (injected between HTML comment markers):

- **Project Info** - Name, type, description
- **Active Plugins** - Enabled plugins with marketplace info
- **MCP Server Configuration** - Lists global vs project-scoped MCPs
- **Plugin→MCP Mappings** - Tells Claude which MCPs to use for each plugin

The managed section is wrapped in:
```html
<!-- overture configuration start-->
...generated content...
<!-- overture configuration end-->
```

Custom content outside these markers is preserved during regeneration.

## TypeScript Schema

```typescript
interface OvertureConfig {
  version: string;
  project?: ProjectConfig;
  plugins: Record<string, PluginConfig>;
  mcp: Record<string, McpServerConfig>;
}

interface ProjectConfig {
  name: string;
  type?: string;
  description?: string;
}

interface PluginConfig {
  marketplace: string;      // e.g., "claude-code-workflows"
  enabled?: boolean;        // default: true
  mcps: string[];          // List of MCP names this plugin uses
}

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;        // default: true
  // Note: Scope is implicit based on file location
  //  - ~/.config/overture/config.yaml → global
  //  - .overture/config.yaml → project
}
```

## Common Commands

```bash
# Initialize project
overture init --type python-backend

# Check system status
overture doctor

# Sync configuration
overture sync

# Enable disabled MCP
overture mcp enable <name>

# List MCP servers
overture mcp list

# Validate configuration
overture validate
```

For detailed workflows and examples, see [user-guide.md](./user-guide.md) and [examples.md](./examples.md).
