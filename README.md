# Overture

Configuration management for Claude Code. Simplify your Claude Code setup with centralized configuration for MCP servers, subagents, skills, hooks, and plugins.

## Overview

Overture manages Claude Code configuration, providing a streamlined way to define and deploy settings for MCP servers and Claude Code's advanced features including subagents, skills, hooks, and plugins.

## Features

- **Unified Configuration** — Define Claude Code settings in a single, manageable format
- **MCP Server Management** — Configure Model Context Protocol servers with ease
- **Advanced Features Support** — Full support for Code's subagents, skills, hooks, and plugins
- **Single Source of Truth** — Centralized config management eliminates configuration drift

## Development Requirements

To develop Overture (not required for using it), you'll need the following MCP servers configured in Claude Code:

- **sequentialthinking** — Complex problem-solving and architectural planning
- **filesystem** — File operations and codebase management
- **context7** — Up-to-date documentation for Claude Code and dependencies
- **memory** — Cross-conversation context and architectural decision tracking
- **nx** — (Optional) Build orchestration if the project adopts a monorepo structure

See `CLAUDE.md` for detailed guidance on when and how to use each MCP server.