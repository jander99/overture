# MCP Servers (Model Context Protocol)

## Overview

MCP (Model Context Protocol) servers connect Claude Code to external tools, databases, repositories, browsers, and APIs. They provide the foundational integration layer that enables Claude to interact with real-world systems and data sources.

## Key Characteristics

- **Tool Integration**: Connects Claude to external systems and services
- **Standardized Protocol**: Uses the Model Context Protocol for consistent integration
- **Multiple Transport Types**: Supports stdio, HTTP, and SSE (Server-Sent Events)
- **Scoped Configuration**: Can be configured at user, project, or enterprise levels
- **Cross-Platform**: Works with Claude Code, Claude.ai, and Claude API

## Configuration

### Configuration Files

MCP servers can be configured in multiple locations:

1. **Primary Configuration**: `~/.claude.json`
   - Recommended location for most consistent behavior
   - User-level configuration

2. **Alternative Locations**:
   - `.mcp.json` in project root (project-specific)
   - `.claude/settings.json` (embedded in settings)
   - Various other locations (less recommended)

### Configuration Methods

#### 1. CLI Wizard (Default)
```bash
claude mcp add
```
Interactive wizard that guides through MCP server setup.

#### 2. Direct File Editing (Recommended)
Edit `~/.claude.json` directly for more control:

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "package-name"]
    },
    "http-server": {
      "type": "http",
      "url": "https://api.example.com/mcp"
    }
  }
}
```

#### 3. Docker Integration
Docker Desktop provides one-click MCP server setup via Docker MCP Toolkit.

### Transport Types

1. **stdio** (Standard Input/Output)
   - Most common for local tools
   - Launches process and communicates via stdin/stdout
   - Example: `npx` commands, local scripts

2. **HTTP**
   - Recommended for remote MCP servers
   - Most widely supported for cloud-based services
   - Requires URL endpoint

3. **SSE** (Server-Sent Events)
   - For streaming/real-time data
   - Less common than stdio and HTTP

### Configuration Scopes

MCP servers can be configured at three levels:

1. **User-Level**: `~/.claude.json`
   - Available across all projects
   - Personal tool integrations

2. **Project-Level**: `.mcp.json` or `.claude/settings.json`
   - Project-specific integrations
   - Can be committed for team sharing

3. **Enterprise-Level**: Managed policy settings
   - Enforced across organization
   - Takes precedence over user/project settings

## MCP Server Structure

### Basic Configuration Fields

- `type`: Transport type (`stdio`, `http`, `sse`)
- `command`: Executable command (for stdio)
- `args`: Command arguments (for stdio)
- `url`: Endpoint URL (for http/sse)
- `env`: Environment variables (optional)

### Example Configurations

**Simple stdio server:**
```json
{
  "mcpServers": {
    "sequential-thinking": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-sequentialthinking-tools"]
    }
  }
}
```

**HTTP server:**
```json
{
  "mcpServers": {
    "api-integration": {
      "type": "http",
      "url": "https://api.example.com/mcp"
    }
  }
}
```

**Server with environment:**
```json
{
  "mcpServers": {
    "database": {
      "type": "stdio",
      "command": "mcp-database",
      "args": ["--host", "localhost"],
      "env": {
        "DB_CONNECTION_STRING": "postgresql://..."
      }
    }
  }
}
```

## Tool Access in Extensions

### Subagents and MCP Tools

Subagents can specify which MCP tools they have access to:

```markdown
---
name: data-analyst
description: Analyzes data using database tools
tools:
  - database-query
  - data-export
---
```

The `/agents` command provides an interactive interface to manage tool access for subagents, listing all available MCP server tools.

### Plugins and MCP Servers

Plugins can bundle MCP servers, automatically configuring them when the plugin is installed. This ensures plugin features have access to required tools without manual setup.

## Relationship to Other Features

### MCP Servers as Foundation

MCP servers provide tools that other features use:

```
MCP Servers (provide tools)
    ↓
Subagents (use tools in isolated context)
    ↓
Skills (use tools following instructions)
    ↓
Hooks (may validate tool usage)
    ↓
Plugins (bundle servers with other features)
```

### Tool Sharing vs Duplication

**Shared Tools**: Multiple features can use the same MCP server:
- Subagent "test-engineer" uses `pytest-runner` MCP tool
- Skill "run-tests" uses same `pytest-runner` MCP tool
- Hook validates test results from `pytest-runner`

**Design Principle**: MCP servers should be configured once and shared across features, avoiding duplication of server configurations.

## Common MCP Servers

Examples from the ecosystem:

1. **Development Tools**: Git, filesystem, database access
2. **Cloud Platforms**: AWS, GCP, Azure integrations
3. **Data Sources**: APIs, web scrapers, document readers
4. **Analysis Tools**: Sequential thinking, code analysis
5. **Communication**: Slack, email, notification services

## Docker Integration

Docker Desktop includes MCP Toolkit for Claude Code:
- One-click MCP server setup
- Secure container-based execution
- Pre-configured popular servers
- Simplified dependency management

## Potential for Duplication

**MCP Server Duplication**: Same server configured multiple times:
- **Risk**: Configuring identical server at user and project level
- **Impact**: Ambiguity about which configuration is used
- **Recommendation for Overture**: Detect duplicate server names across scopes

**Tool vs Implementation**: Different MCP servers providing similar capabilities:
- **Example**: Multiple git integration servers
- **Approach**: Allow users to choose preferred implementation
- **Overture Strategy**: Support server aliases/preferences

## Cross-Tool Compatibility

### Claude Code ↔ Copilot

**Challenge**: MCP is specific to Claude ecosystem (as of 2025)
- GitHub Copilot doesn't currently support MCP protocol
- Copilot has different extension mechanisms

**Overture Strategies**:
1. **MCP as Claude-Only**: Keep MCP configurations in Claude-specific section
2. **Capability Mapping**: Map MCP tool capabilities to Copilot alternatives where possible
3. **Documentation**: Note which MCP servers have Copilot equivalents
4. **Future-Proofing**: Design schema to accommodate if Copilot adopts MCP

## Sources

1. [Connect Claude Code to tools via MCP - Claude Docs](https://docs.claude.com/en/docs/claude-code/mcp) (Official Documentation)
2. [Configuring MCP Tools in Claude Code - Scott Spence](https://scottspence.com/posts/configuring-mcp-tools-in-claude-code)
3. [Add MCP Servers to Claude Code - Setup & Configuration Guide - MCPcat](https://mcpcat.io/guides/adding-an-mcp-server-to-claude-code/)
4. [Adding MCP Servers in Claude Code - Mehmet Baykar](https://mehmetbaykar.com/posts/adding-mcp-servers-in-claude-code/)
5. [How to Setup Claude Code MCP Servers - ClaudeLog](https://claudelog.com/faqs/how-to-setup-claude-code-mcp-servers/)
6. [Add MCP Servers to Claude Code with MCP Toolkit - Docker](https://www.docker.com/blog/add-mcp-servers-to-claude-code-with-mcp-toolkit/)
7. [Claude Code MCP Server Complete Guide - Ctok](https://ctok.ai/en/claude-code-mcp-server-guide)
