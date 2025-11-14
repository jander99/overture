# Plugins

## Overview

Plugins are custom collections that bundle slash commands, agents (subagents), MCP servers, and hooks into a single installable package. They represent the highest-level abstraction for extending Claude Code, allowing complex functionality to be distributed and installed with a single command.

## Key Characteristics

- **Bundled Features**: Combines multiple extension types (commands, agents, MCP servers, hooks)
- **Single-Command Installation**: Install with `/plugin` command
- **Cross-Platform**: Works across terminal and VS Code
- **Automatic Dependencies**: Bundled MCP servers are automatically configured when plugin is enabled
- **Public Beta**: Released in 2025, available to all Claude Code users

## Configuration

### Installation

Plugins are installed using the `/plugin` command:
```
/plugin install <plugin-name>
```

### Plugin Structure

A plugin can contain:

1. **Slash Commands**: Custom commands in `.claude/commands/`
2. **Subagents**: Specialized agents in `.claude/agents/`
3. **MCP Servers**: Tool integrations (auto-configured)
4. **Hooks**: Event-driven automation
5. **Skills**: Modular capabilities (likely supported)

### Plugin Bundle Format

While the exact format isn't fully documented yet, plugins appear to package:
- Configuration files for each component type
- MCP server definitions that auto-configure
- Metadata for plugin identification and versioning

## How Plugins Work

1. **Discovery**: Users find plugins via community repositories or documentation
2. **Installation**: `/plugin install` command downloads and configures the plugin
3. **Integration**: Plugin components are added to appropriate `.claude/` directories
4. **Activation**: MCP servers and hooks are automatically enabled
5. **Usage**: Slash commands and agents become immediately available

## Relationship to Other Features

### Plugins as Containers

Plugins act as containers for other Claude Code features:

```
Plugin
├── Slash Commands (user-invoked)
├── Subagents (delegated tasks with isolated context)
├── Skills (model-invoked capabilities)
├── MCP Servers (tool integrations)
└── Hooks (event-driven automation)
```

### Dependency Management

- **MCP Servers**: Plugins can bundle MCP servers, automatically providing tools and integrations when enabled
- **Cross-Feature Coordination**: A plugin might include a subagent that uses tools from a bundled MCP server, triggered by a slash command, with hooks for validation

## Potential for Duplication

**Plugins vs Manual Configuration**: Plugins automate what users could configure manually:
- **Plugin Approach**: Single install command, pre-configured components
- **Manual Approach**: Individual configuration of each component type
- **Design Goal**: Plugins eliminate duplication by bundling related components

**Inter-Plugin Conflicts**: Multiple plugins might provide overlapping functionality:
- **Conflict Risk**: Two plugins both providing git-related subagents or commands
- **Namespace Management**: Plugin system likely handles command/agent name conflicts
- **Recommendation for Overture**: Track which features come from which plugin to avoid conflicts

## Use Cases

Common plugin scenarios:

1. **Language Ecosystems**: Python plugin with linter, test runner, package manager MCP servers
2. **Framework Support**: React plugin with component generator commands, testing agents, build hooks
3. **Team Standards**: Organization-specific coding standards, hooks, and agents
4. **Cloud Platform Integration**: AWS/GCP/Azure plugins with platform-specific tools and commands

## Design Implications for Overture

### Plugin-Aware Configuration

Overture should consider:

1. **Plugin Detection**: Identify when features come from plugins vs manual configuration
2. **Atomic Installation**: Preserve plugin atomicity when syncing (don't split plugin components)
3. **Version Tracking**: Track plugin versions separately from individual component versions
4. **Dependency Resolution**: Handle plugins that depend on specific MCP servers or other plugins

### Cross-Tool Plugin Support

**Challenge**: GitHub Copilot doesn't have an equivalent plugin system (as of 2025)

**Strategies**:
- **Decomposition**: Expand plugins into constituent parts for Copilot
- **Metadata Preservation**: Track plugin origin for potential future Copilot plugin support
- **Partial Sync**: Sync compatible components only (e.g., MCP servers) while noting unsupported features

## Community and Distribution

- Public beta indicates growing plugin ecosystem
- Likely repository/marketplace for plugin discovery
- Community-created plugins similar to subagent repositories
- Plugin format may standardize over time

## Sources

1. [Customize Claude Code with plugins - Anthropic](https://www.anthropic.com/news/claude-code-plugins) (Official Announcement)
2. [Add MCP Servers to Claude Code with MCP Toolkit - Docker](https://www.docker.com/blog/add-mcp-servers-to-claude-code-with-mcp-toolkit/)
3. [MCP Server Manager for Claude Code - LobeHub](https://lobehub.com/mcp/yourusername-mcp-server-manager)
4. [Claude Code MCP Server Complete Guide - Ctok](https://ctok.ai/en/claude-code-mcp-server-guide)

## Research Notes

- Plugin feature is relatively new (2025), documentation still evolving
- Exact plugin format and structure not fully documented
- Plugin system appears to build on existing extension mechanisms
- Future updates likely to expand plugin capabilities and documentation
