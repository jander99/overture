# Overture

> Transforms maintainable YAML/Markdown configurations into Claude Code's native JSON format, providing validation, templating, and environment management as a single source of truth.

## Overview

Overture manages Claude Code configuration through a symlink-based model where configuration lives in a version-controlled repository and generates Claude Code's native files. This provides:

- **Separation of Concerns** — Config repo separate from projects
- **Reusability** — One config repo serves multiple projects
- **Team Sharing** — Version control and distribute configurations via git
- **Clean Projects** — No config clutter in project directories

## How It Works

```bash
# Config repo (version controlled)
~/overture-configs/
  config.yaml
  mcp-servers.yaml
  hooks.yaml
  commands/
  agents/
  skills/

# In your project
~/projects/my-app/
  .overture -> ~/overture-configs/  # Symlink to config
  .claude/                          # Generated (gitignored)
  src/

# Generate Claude Code configuration
cd ~/projects/my-app
overture generate  # Follows symlink, creates .claude/
```

## Features

- **YAML-Based Configuration** — Cleaner, more maintainable than JSON
- **Variable Substitution** — Environment variables, git context, project paths
- **Environment Profiles** — Different configs for dev/staging/production
- **Validation** — Syntax, schema, semantic, and runtime validation
- **Templating** — Reusable templates and file inclusion
- **Hooks & Automation** — Event-driven workflows with validation guardrails
- **Full Claude Code Support** — Commands, agents, skills, hooks, MCP servers, plugins

## Development Requirements

To develop Overture (not required for using it), you'll need the following MCP servers configured in Claude Code:

- **sequentialthinking** — Complex problem-solving and architectural planning
- **filesystem** — File operations and codebase management
- **context7** — Up-to-date documentation for Claude Code and dependencies
- **memory** — Cross-conversation context and architectural decision tracking
- **nx** — (Optional) Build orchestration if the project adopts a monorepo structure

See `CLAUDE.md` for detailed guidance on when and how to use each MCP server.