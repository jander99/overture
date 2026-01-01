# Overture Configuration Schema

## Overview

Overture bridges Claude Code plugins and MCP servers by:

1. Installing plugins via Claude CLI based on configuration
2. Generating `.mcp.json` with project-scoped MCP servers
3. Generating `CLAUDE.md` with plugin↔MCP usage guidance

## Configuration Files

### Global Configuration: `~/.config/overture/config.yml`

Defines user-level preferences and globally available MCP servers.

**Note:** MCPs defined in the user global config are automatically synced to user-level client configs (e.g., `~/.claude.json`).

```yaml
version: "1.0"

# Global MCP servers (synced to ~/.claude.json)
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
version: '1.0'

project:
  name: my-app
  type: python-backend
  description: FastAPI backend service

# Plugins to install via Claude CLI
plugins:
  python-development:
    marketplace: claude-code-workflows # Uses: claude plugin install python-development@claude-code-workflows
    enabled: true
    mcps: [python-repl, ruff, filesystem] # MCPs this plugin uses

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
      GITHUB_TOKEN: '${GITHUB_TOKEN}'

  postgres:
    command: docker
    args: [run, -i, --rm, mcp-postgres]
    env:
      POSTGRES_URL: '${DATABASE_URL}'
    enabled: false # Disabled by default, enable with: overture enable mcp postgres
```

## Schema Definitions

### Plugin Declaration

```yaml
plugin_name:
  marketplace: string # Marketplace name (e.g., claude-code-workflows)
  enabled: boolean # Whether plugin is enabled (default: true)
  mcps: string[] # List of MCP server names this plugin uses
```

### MCP Server Declaration

```yaml
mcp_server_name:
  # Execution configuration
  command: string # Executable command
  args: string[] # Command arguments (optional)
  env: map<string, string> # Environment variables (optional)

  # Metadata
  enabled: boolean # Whether server is active (default: true)
```

**Note:** Scope is implicit based on file location:

- MCPs in `~/.config/overture/config.yml` are global (synced to `~/.claude.json`)
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
  marketplace: string; // e.g., "claude-code-workflows"
  enabled?: boolean; // default: true
  mcps: string[]; // List of MCP names this plugin uses
}

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean; // default: true
  // Note: Scope is implicit based on file location
  //  - ~/.config/overture/config.yml → global
  //  - .overture/config.yaml → project
}
```

## Agent Configuration

Overture supports defining and synchronizing AI agents (subagents) across multiple AI development tools.

### Agent Directory Structure

Agents are defined using a "split source" pattern with two files per agent:

```
~/.config/overture/agents/          # Global agents
  my-agent.yaml                      # Agent configuration
  my-agent.md                        # Agent system prompt
  another-agent.yaml
  another-agent.md

.overture/agents/                    # Project-specific agents
  project-helper.yaml
  project-helper.md
```

**Important:** Both files must have matching names (e.g., `my-agent.yaml` + `my-agent.md`).

### Agent Configuration File (`.yaml`)

```yaml
name: code-reviewer
model: smart # Logical model name (resolved via models.yaml)
description: Expert code reviewer focused on best practices

# MCP tools this agent can use
tools:
  - filesystem
  - github

# Client-specific model overrides (optional)
clients:
  claude-code:
    model: claude-3-5-sonnet-20241022
  copilot-cli:
    model: gpt-4o
  opencode:
    model: claude-3-5-sonnet-20241022
```

### Agent Prompt File (`.md`)

The `.md` file contains the agent's system prompt:

```markdown
# Code Reviewer Agent

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

### Model Mapping (`~/.config/overture/models.yaml`)

Define logical model names that resolve to client-specific models:

```yaml
smart: claude-3-5-sonnet-20241022
fast: claude-3-haiku-20240307
vision: claude-3-5-sonnet-20241022
reasoning: o1-preview
```

**Usage:** Use logical names in agent YAML files, and Overture resolves them based on client capabilities.

### Agent Scope

- **Global agents** (`~/.config/overture/agents/`) - Synced to all clients
- **Project agents** (`.overture/agents/`) - Synced only to project-aware clients

**Note:** GitHub Copilot CLI only supports project-scoped agents (`.github/agents/`).

### Agent Sync Behavior

When running `overture sync`, agents are automatically:

1. Discovered from global and project directories
2. Validated (YAML syntax, required fields, matching MD files)
3. Transformed to client-specific formats:
   - **Claude Code**: `~/.claude/agents/my-agent.md` (combined YAML frontmatter + prompt)
   - **OpenCode**: `~/.config/opencode/agent/my-agent.md` (same format)
   - **Copilot CLI**: `.github/agents/my-agent.md` (project-only)

### TypeScript Schema

```typescript
interface AgentConfig {
  name: string;
  model: string; // Logical name or client-specific model ID
  description?: string;
  tools?: string[]; // MCP tool names
  clients?: {
    'claude-code'?: { model: string };
    'copilot-cli'?: { model: string };
    opencode?: { model: string };
  };
}

interface AgentDefinition {
  config: AgentConfig;
  body: string; // Markdown content from .md file
  scope: 'global' | 'project';
  sourceDir: string;
}

interface ModelMapping {
  [logicalName: string]: string; // e.g., { smart: 'claude-3-5-sonnet-20241022' }
}
```

## Common Commands

```bash
# Initialize project
overture init --type python-backend

# Check system status (includes agent validation)
overture doctor

# Sync configuration (includes agents)
overture sync

# Enable disabled MCP
overture mcp enable <name>

# List MCP servers
overture mcp list

# Validate configuration
overture validate
```

For detailed workflows and examples, see [user-guide.md](./user-guide.md) and [examples.md](./examples.md).
