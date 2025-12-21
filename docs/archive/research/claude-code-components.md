# Claude Code Components Research

## Overview

This document provides comprehensive research on the core extensibility components of Claude Code. These components form the building blocks of Claude Code's ecosystem and were analyzed during Overture's design phase to understand configuration patterns, potential duplication, and integration opportunities.

The five core component types are:

1. **MCP Servers** - Tool integration layer (Model Context Protocol)
2. **Hooks** - Event-driven automation triggers
3. **Plugins** - Bundled collections of multiple components
4. **Skills** - Modular capabilities invoked by Claude
5. **Subagents** - Specialized AI assistants with isolated context

---

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

---

# Hooks

## Overview

Hooks are event-driven automation triggers in Claude Code that execute shell commands in response to specific events like tool usage, notifications, session start, or user prompt submission. They enable workflow automation and integration with external tools.

## Key Characteristics

- **Event-Driven**: Automatically triggered by specific Claude Code events
- **Shell Command Execution**: Runs arbitrary shell commands or scripts
- **Pattern Matching**: Can filter events based on tool names or other criteria
- **Environment Context**: Has access to project directory via environment variables

## Configuration

### Locations

Hooks can be configured in three different settings files, listed by precedence:

1. **User Settings**: `~/.claude/settings.json`
   - Global hooks that run on any project
   - Personal to the user

2. **Project Settings**: `.claude/settings.json`
   - Project-specific hooks
   - Should be committed for team sharing

3. **Local Project Settings**: `.claude/settings.local.json`
   - Local overrides not meant to be committed
   - Personal experimentation and local tooling

### JSON Structure

Hooks are defined in the `hooks` object within settings files:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "commands": ["echo 'About to run bash command'"]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "commands": ["echo 'Tool completed: $CLAUDE_TOOL_NAME'"]
      }
    ],
    "UserPromptSubmit": [
      {
        "commands": ["echo 'User submitted: $CLAUDE_USER_PROMPT'"]
      }
    ],
    "SessionStart": [
      {
        "commands": ["echo 'Session started in $CLAUDE_PROJECT_DIR'"]
      }
    ]
  }
}
```

### Hook Events

Available event types:

1. **PreToolUse**: Before a tool runs
2. **PostToolUse**: After a tool completes successfully
3. **Notification**: When Claude sends an alert
4. **Stop**: When the AI agent finishes its response
5. **UserPromptSubmit**: When user submits a prompt
6. **SessionStart**: When a new session begins

### Configuration Fields

- `matcher`: (Optional) Pattern for filtering tool names (supports wildcards like `*`)
- `commands`: Array of shell commands to execute

### Environment Variables

Hooks have access to environment variables:

- `CLAUDE_PROJECT_DIR`: The current project directory
- `CLAUDE_TOOL_NAME`: Name of the tool being used (for tool-related hooks)
- `CLAUDE_USER_PROMPT`: User's submitted prompt (for UserPromptSubmit hook)

## Interactive Management

### /hooks Command

Use the interactive `/hooks` command to configure hooks through a menu interface:

- Lists all available hooks
- Easier than manually editing JSON
- Changes made via `/hooks` require review for security

**Important**: Direct edits to hooks in settings files don't take effect immediately and require review in the `/hooks` menu for changes to apply.

## Use Cases

Common hook applications:

1. **Pre-commit Validation**: Run linters or tests before git commits
2. **Notification Integration**: Send messages to Slack/Discord on events
3. **Logging**: Track tool usage or session activity
4. **Automated Formatting**: Format code after writes
5. **Security Scanning**: Check for secrets or vulnerabilities
6. **CI/CD Integration**: Trigger builds or deployments

## Potential for Duplication

**Hooks vs Skills**: Hooks that perform task-specific work might overlap with skills:

- **Hooks**: Event-driven, always execute when triggered
- **Skills**: Claude decides when to invoke based on relevance
- **Overlap Risk**: A hook that formats code on PostToolUse might duplicate a "code-formatting" skill

**Hooks vs Subagents**: Complex hooks that make decisions might duplicate subagent logic:

- **Hooks**: Simple shell command execution
- **Subagents**: Full AI reasoning with context
- **Design Principle**: Hooks should be simple automation, not complex decision-making

**Recommendation for Overture**:

- Hooks are implementation-specific (shell commands differ across systems)
- Consider extracting hook "intent" vs exact commands
- Allow hooks to invoke skills or trigger subagents for complex logic
- Keep hooks as thin automation layer

## Security Considerations

- Hooks execute arbitrary shell commands with project access
- Direct file edits require review in `/hooks` menu
- Be cautious with hooks from untrusted sources
- Local settings file can override for local-only experimental hooks

## Sources

1. [Hooks reference - Claude Docs](https://docs.claude.com/en/docs/claude-code/hooks) (Official Documentation)
2. [Claude Code Hooks - GitButler Docs](https://docs.gitbutler.com/features/ai-integration/claude-code-hooks)
3. [Demystifying Claude Code Hooks - Aaron Brethorst](https://www.brethorsting.com/blog/2025/08/demystifying-claude-code-hooks/)
4. [GitHub - disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery)
5. [A complete guide to hooks in Claude Code - eesel AI](https://www.eesel.ai/blog/hooks-in-claude-code)
6. [Automate Your AI Workflows with Claude Code Hooks - Butler's Log](https://blog.gitbutler.com/automate-your-ai-workflows-with-claude-code-hooks)
7. [How I'm Using Claude Code Hooks To Fully Automate My Workflow - Medium](https://medium.com/@joe.njenga/use-claude-code-hooks-newest-feature-to-fully-automate-your-workflow-341b9400cfbe)
8. [Complete Guide: Creating Claude Code Hooks - Suite Insider](https://suiteinsider.com/complete-guide-creating-claude-code-hooks/)

---

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

---

# Skills

## Overview

Skills are modular capabilities that extend Claude's functionality through organized folders containing instructions, scripts, and resources. Each Skill consists of a `SKILL.md` file with instructions that Claude reads when relevant, plus optional supporting files like scripts and templates.

## Key Characteristics

- **Model-Invoked**: Claude autonomously decides when to use skills based on your request and the skill's description
- **Cross-Platform**: Skills work across Claude apps, Claude Code, and the Anthropic API
- **Self-Contained**: Each skill is a folder with all necessary resources
- **Different from Slash Commands**: Skills are automatically invoked by Claude; slash commands are manually triggered by users

## Configuration

### Locations

Skills can be stored in two locations:

1. **Personal Skills**: `~/.claude/skills/my-skill/SKILL.md`
   - Available across all projects
   - Personal to the user

2. **Project Skills**: `.claude/skills/my-skill/SKILL.md`
   - Specific to a project
   - Can be checked into version control for team sharing

### File Structure

```
.claude/skills/my-skill/
├── SKILL.md          # Required: Main skill definition
├── scripts/          # Optional: Helper scripts
├── templates/        # Optional: Code templates
└── resources/        # Optional: Additional files
```

### SKILL.md Format

The `SKILL.md` file uses YAML frontmatter followed by detailed instructions:

```markdown
---
name: Generating Commit Messages
description: Generates clear commit messages from git diffs. Use when writing commit messages or reviewing staged changes.
---

# Skill Instructions

[Detailed instructions for Claude on how to perform this skill]
[Best practices, examples, templates]
[Any specific patterns or approaches to use]
```

### Frontmatter Fields

- `name`: Display name for the skill
- `description`: Brief description that helps Claude decide when to invoke the skill

### Body Content

The markdown body contains:

- Detailed instructions for performing the skill
- Examples and templates
- Best practices and patterns
- Any context needed to execute the skill effectively

## How Skills Work

1. **Automatic Detection**: Claude scans skill descriptions when processing user requests
2. **Relevance Matching**: Claude determines if a skill is relevant to the current task
3. **Loading**: When relevant, Claude loads the skill's instructions
4. **Execution**: Claude follows the skill's guidance to complete the task

## Potential for Duplication

**Skills vs Subagents**: Skills can overlap with subagent capabilities:

- **Skills**: Instructions loaded into Claude's current context when relevant
- **Subagents**: Separate AI instance with isolated context and dedicated tools
- **Overlap Risk**: A "generate-tests" skill could duplicate a "test-engineer" subagent's purpose

**Skills vs Hooks**: Skills that trigger on specific events might overlap with hooks:

- **Skills**: Claude decides when to invoke based on task relevance
- **Hooks**: Automatically triggered by specific events (tool use, user submit, etc.)
- **Overlap Risk**: A "pre-commit-validation" skill might overlap with a pre-tool-use hook

**Recommendation for Overture**:

- Allow skills to be referenced in subagent definitions (avoid duplicating instructions)
- Detect when skill descriptions match subagent purposes
- Consider skills as "lightweight" capabilities vs subagents as "heavyweight" isolated workers
- Skills should be used for instructions/guidance, subagents for full delegation

## Recent Updates (October 2025)

Claude introduced Skills as a way to improve how it performs specific tasks. Skills are now available across all Claude interfaces including Claude.ai, Claude Code, and the API.

## Sources

1. [Agent Skills - Claude Docs](https://docs.claude.com/en/docs/claude-code/skills) (Official Documentation)
2. [Equipping agents for the real world with Agent Skills - Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
3. [Skills for Claude!](https://blog.fsck.com/2025/10/16/skills-for-claude/)
4. [Claude Skills: Customize AI for your workflows - Anthropic](https://www.anthropic.com/news/skills)
5. [What Are Claude Skills? Simple Guide - Skywork AI](https://skywork.ai/blog/ai-agent/claude-skills-guide-non-developers/)
6. [How to Create and Use Skills in Claude and Claude Code - Apidog](https://apidog.com/blog/claude-skills/)
7. [Supercharge ADK Development with Claude Code Skills - Medium](https://medium.com/@kazunori279/supercharge-adk-development-with-claude-code-skills-d192481cbe72)

---

# Subagents

## Overview

Subagents are specialized AI assistants in Claude Code that can be invoked to handle specific types of tasks. They enable more efficient problem-solving by providing task-specific configurations with customized system prompts, tools, and a separate context window.

## Key Characteristics

- **Independent Context**: Each subagent operates in its own context window, preventing pollution of the main conversation
- **Specialized Expertise**: Pre-configured AI personalities with specific roles and capabilities
- **Delegation Model**: Claude Code can delegate tasks to subagents when it encounters work matching their expertise
- **Tool Access**: Subagents can have their own set of MCP tools, different from the main agent

## Configuration

### Location

- **Project-Level**: `.claude/agents/` within your project
- Subagent files are automatically detected and loaded by Claude Code

### File Structure

Subagent configuration files use Markdown with YAML frontmatter:

```markdown
---
name: subagent-name
description: Brief description of capabilities
tools: List of MCP tools used
---

Role definition and expertise...
[Detailed instructions for the subagent's behavior]
```

### Frontmatter Fields

- `name`: Identifier for the subagent
- `description`: Brief description of capabilities (used for task matching)
- `tools`: List of MCP tools the subagent has access to

### Body Content

The markdown body after the frontmatter contains:

- Role definition
- Expertise areas
- Behavioral instructions
- Task-specific guidelines
- Any context the subagent needs to operate effectively

## Tool Management

Use the `/agents` command to modify tool access through an interactive interface that lists all available tools, including any connected MCP server tools.

## Creation Best Practices

- **Generate Initial Version**: Anthropic recommends generating your initial subagent with Claude and then iterating
- **Personalize**: Customize the generated subagent to fit your specific needs
- **Focus on Specificity**: Make subagents highly specialized rather than general-purpose

## Potential for Duplication

**Skills vs Subagents**: Subagents may possess the same capabilities as first-class Skills. Key differences:

- **Skills**: Model-invoked, Claude decides when to use them based on task
- **Subagents**: Delegated to with full context isolation and separate tool access
- **Overlap Risk**: A skill for "writing tests" could overlap with a "test-engineer" subagent

**Recommendation**: When designing Overture's configuration system, consider:

- Detecting when a subagent's description matches a skill's purpose
- Allowing skills to be referenced within subagent configurations
- Providing warnings when creating redundant capabilities

## Availability

Claude Code Subagents became generally available in 2025, enabling developers to create independent, task-specific AI agents.

## Community Resources

- Large collection of community-created subagents available on GitHub
- Repositories containing 60+ specialized subagents organized by domain
- Examples: https://github.com/VoltAgent/awesome-claude-code-subagents

## Sources

1. [Subagents - Claude Docs](https://docs.claude.com/en/docs/claude-code/sub-agents) (Official Documentation)
2. [Claude Code Subagents Enable Modular AI Workflows - InfoQ](https://www.infoq.com/news/2025/08/claude-code-subagents/)
3. [Claude Code Frameworks & Sub-Agents: The Complete 2025 Developer's Guide](https://medianeth.dev/blog/claude-code-frameworks-subagents-2025)
4. [GitHub - VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents)
5. [ClaudeLog - Custom Agents](https://claudelog.com/mechanics/custom-agents/)
6. [Claude Code: Subagent Deep Dive](https://cuong.io/blog/2025/06/24-claude-code-subagent-deep-dive)

---

# Cross-Component Patterns and Insights

## Dependency Hierarchy

The components form a natural dependency hierarchy:

```
Level 0: MCP Servers (foundational tool layer)
    ↓
Level 1: Hooks (event-driven automation using tools)
    ↓
Level 2: Skills (reusable instructions using tools)
    ↓
Level 3: Subagents (specialized agents using tools and skills)
    ↓
Level 4: Plugins (bundles of all component types)
```

## Common Duplication Patterns

Across all component types, several duplication risks emerge:

1. **Functional Overlap**: Different component types solving the same problem
   - Example: A hook that runs tests, a skill that generates tests, and a subagent that manages testing

2. **Scope Duplication**: Same component at multiple configuration levels
   - Example: User-level and project-level hooks both formatting code

3. **Implementation Redundancy**: Multiple components with identical underlying logic
   - Example: Three different MCP servers all providing git integration

## Design Principles for Overture

Based on this research, Overture should:

1. **Detect Cross-Component Duplication**: Identify when multiple component types provide overlapping functionality
2. **Respect Component Boundaries**: Preserve the distinct purposes of each component type
3. **Enable Composition**: Allow components to reference each other (skills in subagents, MCP servers in plugins)
4. **Warn on Conflicts**: Alert users when configurations shadow or conflict with each other
5. **Track Origins**: Remember which components come from plugins vs manual configuration

## Evolution of Claude Code Ecosystem

The component system has evolved rapidly:

- **2024**: MCP protocol introduced, basic hook support
- **2025**: Skills, Subagents, and Plugins all released
- **Future**: Likely continued standardization and tooling improvements

This rapid evolution means configuration management tools like Overture need to be flexible and forward-compatible.

---

_This document was compiled from individual component research files as part of Overture's documentation consolidation effort. Last updated: 2025-01-13_
