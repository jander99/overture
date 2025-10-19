# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Overture is a unified configuration management tool for Claude Code and GitHub Copilot. The project aims to:

- Synchronize settings between Claude Code and GitHub Copilot
- Manage Model Context Protocol (MCP) server configurations across both platforms
- Support tool-specific features (Claude Code's subagents, skills, hooks, plugins) while maintaining Copilot compatibility
- Provide a single source of truth for AI coding assistant configuration

## Project Status

This is an early-stage project. The repository currently contains only documentation (README.md). Implementation has not yet begun.

## Architecture Considerations

When implementing this project, consider:

1. **Configuration Schema**: Design a flexible schema that accommodates both shared settings (MCP servers) and tool-specific configurations (Claude Code subagents/skills/hooks/plugins vs Copilot-specific features)

2. **File Formats**: Determine output format compatibility:
   - Claude Code uses JSON configuration files in `.claude/` directory
   - GitHub Copilot uses various configuration mechanisms

3. **Synchronization Strategy**: Decide whether Overture will:
   - Generate separate config files for each tool
   - Act as a translation layer
   - Maintain a master config with tool-specific exports

4. **MCP Server Management**: Handle MCP server configurations including server names, commands, arguments, and environment variables

5. **Version Control**: Consider how configuration changes should be tracked and versioned across different tools
