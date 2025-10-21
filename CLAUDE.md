# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Overture is a configuration management tool for Claude Code. The project aims to:

- Manage Model Context Protocol (MCP) server configurations
- Support Claude Code's advanced features (subagents, skills, hooks, plugins)
- Provide a single source of truth for Claude Code configuration

## Project Status

This is an early-stage project. The repository currently contains only documentation (README.md). Implementation has not yet begun.

## Architecture Considerations

When implementing this project, consider:

1. **Configuration Schema**: Design a flexible schema that accommodates MCP servers and Claude Code-specific features (subagents, skills, hooks, plugins)

2. **File Formats**:
   - Claude Code uses JSON configuration files in `.claude/` directory
   - Determine how Overture will generate or transform these configurations

3. **Configuration Strategy**: Decide whether Overture will:
   - Generate Claude Code config files directly
   - Act as a validation and management layer
   - Maintain a master config with templating capabilities

4. **MCP Server Management**: Handle MCP server configurations including server names, commands, arguments, and environment variables

5. **Version Control**: Consider how configuration changes should be tracked and versioned

6. **Project-Scoped MCP Servers**: Support `.mcp.json` files for project-specific MCP server configurations:
   - Define project-level MCP servers that can be version controlled and shared with teams
   - Establish precedence rules between user-scope and project-scope configurations
   - Handle merging strategies when both scopes define the same server
   - Enable projects to declare required MCP servers as dependencies
   - Consider how project-scoped servers integrate with Claude Code's existing configuration system

## Required MCP Servers for Development

The following MCP servers are required for development work on Overture (not for using Overture). These servers provide essential capabilities for working with this codebase:

### sequentialthinking
**When to use**: For complex, multi-step problem-solving that requires careful analysis and planning.

Use this server when:
- Breaking down complex architectural decisions into logical steps
- Analyzing configuration schema design options
- Planning configuration management strategies
- Working through edge cases in configuration validation
- Any task requiring systematic thinking and revision of assumptions

### filesystem
**When to use**: For all file operations in the project.

Use this server when:
- Reading, writing, or editing configuration files
- Creating directory structures for test fixtures
- Searching for files or patterns across the codebase
- Managing generated configuration outputs
- Working with example configurations

### context7
**When to use**: For retrieving up-to-date documentation for libraries and frameworks.

Use this server when:
- Looking up Claude Code configuration file formats and options
- Finding documentation on MCP server setup and configuration
- Checking API references for external dependencies
- Verifying current best practices for Claude Code configuration

### memory
**When to use**: For maintaining project context and relationships across conversations.

Use this server when:
- Tracking architectural decisions and their rationales
- Maintaining relationships between configuration concepts
- Recording Claude Code feature mappings
- Building knowledge about configuration schema design
- Preserving context about configuration management strategies

### nx
**When to use**: If the project adopts Nx for monorepo management (future consideration).

Use this server when:
- Setting up build and task orchestration
- Managing multiple packages or plugins
- Configuring project-level tooling
- Working with Nx-specific configuration

**Note**: The nx server is listed for potential future use if Overture grows into a monorepo structure or needs advanced build orchestration.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors


<!-- nx configuration end-->