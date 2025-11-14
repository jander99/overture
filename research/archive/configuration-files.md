# Configuration Files and Directory Structure

## Overview

Claude Code uses a hierarchical configuration system with both user-level and project-level settings. The `.claude/` directory serves as the primary location for project-specific configurations, while `~/.claude/` contains user-wide settings.

## Directory Structure

### User-Level Configuration (`~/.claude/`)

```
~/.claude/
├── settings.json           # Global user preferences
├── .credentials.json       # Authentication data
├── projects/              # Conversation histories (JSONL format)
├── statsig/              # Analytics and session tracking
├── commands/             # Personal custom slash commands
├── skills/               # Personal skills
└── agents/               # Personal subagents (if supported)
```

### Project-Level Configuration (`.claude/`)

```
.claude/
├── settings.json          # Project settings (committed to source control)
├── settings.local.json    # Local settings (not committed)
├── commands/             # Project slash commands
├── skills/               # Project skills
└── agents/               # Project subagents
```

### Root-Level Files

```
project-root/
├── .claude/              # Project configuration directory
├── CLAUDE.md            # Project memory/context loaded at startup
└── .mcp.json            # MCP server configuration (alternative location)
```

### Primary MCP Configuration

```
~/.claude.json           # Primary MCP server configuration (recommended)
```

## Configuration Files

### settings.json

Contains hooks, preferences, and other configuration. Can exist at multiple levels.

**Location Precedence** (highest to lowest):
1. Enterprise managed settings (macOS: `/Library/Application Support/ClaudeCode/managed-settings.json`, Linux/WSL: `/etc/claude-code/managed-settings.json`)
2. User settings: `~/.claude/settings.json`
3. Project settings: `.claude/settings.json`
4. Local project settings: `.claude/settings.local.json`

**Example Structure:**
```json
{
  "hooks": {
    "PreToolUse": [...],
    "PostToolUse": [...],
    "UserPromptSubmit": [...],
    "SessionStart": [...]
  },
  "preferences": {
    "autoSave": true,
    "theme": "dark"
  }
}
```

### settings.local.json

Project-specific local overrides not meant for version control.

**Use Cases:**
- Personal preferences in shared projects
- Experimental configurations
- Local tool paths
- Developer-specific hooks

**Important**: Should be in `.gitignore` to prevent accidental commits.

### .claude.json / .mcp.json

MCP server configurations. `~/.claude.json` is recommended over other locations for consistency.

**Example:**
```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "package-name"],
      "env": {
        "API_KEY": "..."
      }
    }
  }
}
```

### CLAUDE.md

Project memory file loaded when Claude Code starts a session in the project.

**Contents:**
- Project architecture overview
- Build and test commands
- Development workflow
- Important patterns and conventions
- Files and directories structure (high-level)

**Purpose**: Helps Claude Code be productive quickly without needing to explore extensively.

## Configuration Hierarchy and Merging

### Precedence Order

1. **Enterprise Managed Settings** (if applicable)
   - Cannot be overridden
   - Enforces organizational policies

2. **User Settings** (`~/.claude/settings.json`)
   - Personal defaults across all projects

3. **Project Settings** (`.claude/settings.json`)
   - Team-wide standards
   - Should be committed to source control

4. **Local Project Settings** (`.claude/settings.local.json`)
   - Personal overrides for specific project
   - Not committed to source control

### Merging Behavior

Settings are merged hierarchically:
- Higher-level settings override lower-level ones
- Objects are merged (not replaced entirely)
- Arrays typically replace rather than merge

**Example**: If user settings define hooks for `PreToolUse` and project settings also define `PreToolUse` hooks, the project settings take precedence for that project.

## File Type Directories

### commands/

Contains custom slash command definitions as markdown files.

**Structure:**
```
.claude/commands/
└── review-pr.md          # /review-pr command

~/.claude/commands/
└── personal-helper.md    # Personal command available in all projects
```

**Command File Format:**
```markdown
---
description: Review a GitHub pull request
---

Instructions for reviewing PR...
```

### skills/

Contains skill definitions with `SKILL.md` files and supporting resources.

**Structure:**
```
.claude/skills/
└── generate-tests/
    ├── SKILL.md          # Skill definition
    ├── templates/        # Test templates
    └── scripts/          # Helper scripts
```

### agents/

Contains subagent definitions.

**Structure:**
```
.claude/agents/
├── test-engineer.md      # Test specialist subagent
├── code-reviewer.md      # Review specialist
└── documentation.md      # Docs specialist
```

## Configuration Best Practices

### Version Control

**Commit to Git:**
- `.claude/settings.json` (team settings)
- `.claude/commands/` (shared commands)
- `.claude/skills/` (shared skills)
- `.claude/agents/` (shared agents)
- `CLAUDE.md` (project context)
- `.mcp.json` (if using project-level MCP servers)

**Add to .gitignore:**
- `.claude/settings.local.json` (personal local settings)
- `~/.claude/` directory (user-level, not in project)

### Scope Selection

**User-Level** (`~/.claude/`):
- Personal productivity tools
- Your coding style preferences
- Cross-project utilities

**Project-Level** (`.claude/`):
- Project-specific commands
- Team conventions
- Project architecture helpers
- Shared development workflows

**Local Project** (`.claude/settings.local.json`):
- Experimental features
- Local tool configurations
- Personal overrides of team settings

## Enterprise Configuration

For organizations deploying Claude Code at scale.

### Managed Settings Locations

**macOS**: `/Library/Application Support/ClaudeCode/managed-settings.json`

**Linux/WSL**: `/etc/claude-code/managed-settings.json`

### Use Cases

- Enforce security policies
- Restrict certain tools or commands
- Configure enterprise MCP servers
- Set organizational hooks (e.g., compliance checks)

### Precedence

Managed settings always take precedence over user and project settings, ensuring policy compliance.

## Potential for Duplication

### Cross-Scope Duplication

**Risk**: Same feature configured at multiple levels
- User-level command duplicates project command
- Personal skill duplicates project skill
- User MCP server conflicts with project MCP server

**Recommendation for Overture**:
- Detect duplicate names across scopes
- Provide warnings when project config shadows user config
- Allow explicit override declarations

### File Location Ambiguity

**Risk**: Multiple valid locations for same configuration type
- MCP servers in `~/.claude.json` vs `.mcp.json`
- Hooks in `settings.json` at different levels

**Overture Strategy**:
- Establish canonical locations for each config type
- Document precedence clearly
- Provide migration tools for consolidation

## Cross-Tool Considerations

### Claude Code ↔ Copilot

**Claude Code Structure**: `.claude/` directory with JSON/Markdown configs

**Copilot Structure**: `.github/copilot-instructions.md` and VS Code settings

**Differences**:
- Claude: Rich directory structure with multiple file types
- Copilot: Simpler, fewer configuration files
- Claude: Subagents, skills, hooks (no Copilot equivalent)
- Both: Can share MCP servers (if Copilot adds support)

**Overture Approach**:
- Map compatible features (MCP servers)
- Document Claude-specific features clearly
- Provide Copilot-compatible alternatives where possible
- Maintain source of truth that generates both formats

## Sources

1. [Claude Code Configuration Guide - ClaudeLog](https://claudelog.com/configuration/)
2. [The Complete Technical Guide to Claude Code's File Formats and Architecture](https://idsc2025.substack.com/p/the-complete-technical-guide-to-claude)
3. [Introducing .claude Directory - htdocs.dev](https://htdocs.dev/posts/introducing-claude-your-ultimate-directory-for-claude-code-excellence/)
4. [Claude Code - The Missing Manual - Arthur's Blog](https://clune.org/posts/claude-code-manual/)
5. [Claude Code settings - Claude Docs](https://docs.claude.com/en/docs/claude-code/settings) (Official Documentation)
6. [Mastering Claude Code: Configuration Guide - Isomo Blog](https://jiahaoxiang2000.github.io/blog/tools/claude-code-config)
7. [Claude Code CLI Cheatsheet - Shipyard](https://shipyard.build/blog/claude-code-cheat-sheet/)
8. [Claude Code Best Practices - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
