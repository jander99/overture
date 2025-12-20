# Archive Documentation Notice

This directory contains **historical documentation** from the development of Overture.

## ⚠️ Important Notice

**These documents may contain outdated information**, including:

- **Incorrect configuration paths**: Many documents reference `~/.config/claude/mcp.json` for Claude Code's global configuration, which is **incorrect**. The actual path is `~/.claude.json`.
- **Obsolete architecture decisions**: Some design choices documented here have been superseded by newer approaches.
- **Deprecated APIs or patterns**: Code examples may use outdated APIs or patterns.

## Purpose of This Archive

These documents are preserved for:
- Historical reference and context
- Understanding the evolution of Overture's design
- Learning from past research and decision-making

## For Current Documentation

Please refer to the main documentation files in `/docs/`:
- `README.md` - Project overview
- `user-guide.md` - User guide
- `QUICKSTART.md` - Quick start guide
- `architecture.md` - Current architecture
- `examples.md` - Usage examples

Or the comprehensive audit report:
- `CONFIG-PATH-AUDIT.md` - Complete list of correct configuration paths for all clients

## Correct Configuration Paths

For reference, the correct configuration paths are:

### Claude Code
- **User (Global):** `~/.claude.json` ✅
- **Project (Repo):** `./.mcp.json` ✅

### Claude Desktop
- **User (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **User (Linux):** `~/.config/Claude/claude_desktop_config.json`
- **User (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`

### Other Clients
- **OpenCode User:** `~/.config/opencode/opencode.json`
- **OpenCode Project:** `./opencode.json`
- **Copilot CLI:** `~/.copilot/mcp-config.json`
- **Overture User:** `~/.config/overture.yml`
- **Overture Project:** `./.overture/config.yaml`

---

**Last Updated:** 2025-01-12
**Status:** Archived - May contain outdated information
