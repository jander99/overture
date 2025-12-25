# AI Coding CLI Feature Comparison

**Research Date:** December 24, 2025  
**Sources:** Official documentation from each vendor  
**Status:** Fresh research to update Overture's comparison matrix

---

## Executive Summary

This research documents the current feature sets of the three CLI coding tools supported by Overture:

1. **Claude Code** (Anthropic)
2. **GitHub Copilot CLI** (GitHub)
3. **OpenCode** (SST/Anomaly)

Key findings:

- **All three now support Agent Skills** - This is a new development since the previous matrix
- **GitHub Copilot CLI is a completely new product** - The old `gh copilot` extension has been retired
- **OpenCode has matured significantly** - Now includes ACP support, LSP integration, and comprehensive agent system

---

## Claude Code

**Documentation:** https://code.claude.com/docs/en/overview  
**Product Page:** https://www.anthropic.com/product/claude-code

### Core Capabilities

| Feature                   | Status      | Notes                                        |
| ------------------------- | ----------- | -------------------------------------------- |
| MCP Client Support        | ✅ Full     | Supports local and remote MCP servers        |
| MCP Server Mode           | ✅ Yes      | Can run as MCP server via `claude mcp serve` |
| Subagents/Task Delegation | ✅ Built-in | Task tool for delegation                     |
| Background/Async Tasks    | ✅ Yes      | Via Task tool                                |
| Web & iOS Access          | ✅ Yes      | Research preview for browser and iOS         |
| Slack Integration         | ✅ Yes      | Beta - kick off coding tasks from Slack      |

### Memory & Context

| Feature               | Status       | Notes                                                         |
| --------------------- | ------------ | ------------------------------------------------------------- |
| Session Persistence   | ✅ Yes       | `/init`, CLAUDE.md                                            |
| Cross-Session Memory  | ✅ Yes       | Via MCP servers                                               |
| Project Context Files | ✅ Yes       | CLAUDE.md, .mcp.json                                          |
| Custom Instructions   | ✅ Yes       | `.github/copilot-instructions.md`, path-specific instructions |
| Context Window        | ~200K tokens | Standard Claude context                                       |

### Extensibility

| Feature                  | Status | Notes                                                                  |
| ------------------------ | ------ | ---------------------------------------------------------------------- |
| Agent Skills             | ✅ Yes | `.github/skills/` or `.claude/skills/` directories with SKILL.md files |
| Custom Slash Commands    | ✅ Yes | `.claude/commands/` directory                                          |
| Pre/Post Hooks           | ✅ Yes | Automation hooks available                                             |
| Plugin System            | ✅ Yes | `claude plugin` command                                                |
| MCP Server Configuration | ✅ Yes | `mcp-config.json` in `~/.copilot`                                      |

### Development Features

| Feature            | Status      | Notes                      |
| ------------------ | ----------- | -------------------------- |
| Code Review        | ✅ Yes      | Via commands               |
| Web Search         | ✅ Built-in | Native capability          |
| File Operations    | ✅ Native   | Built-in tools             |
| Git Integration    | ✅ Native   | Full git support           |
| GitHub Integration | ✅ Via MCP  | GitHub MCP server included |

### Platform & Access

| Feature         | Status                                                | Notes                                               |
| --------------- | ----------------------------------------------------- | --------------------------------------------------- |
| Open Source     | ❌ No                                                 | Closed source                                       |
| Free Tier       | ❌ No                                                 | Requires Pro ($17-20/mo), Max ($100-200/mo), or API |
| IDE Integration | ✅ Yes                                                | VS Code, JetBrains, Cursor, Windsurf                |
| Terminal        | ✅ Yes                                                | Primary interface                                   |
| Platforms       | macOS, Linux, Windows (WSL + experimental PowerShell) |                                                     |

### MCP Configuration

| Setting             | Value                  |
| ------------------- | ---------------------- |
| User Config Path    | `~/.claude.json`       |
| Project Config Path | `./.mcp.json`          |
| Schema Root Key     | `mcpServers`           |
| Env Var Support     | Native `${VAR}` syntax |

---

## GitHub Copilot CLI

**Documentation:** https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli  
**Status:** Public Preview (replaced retired `gh copilot` extension)

### Core Capabilities

| Feature                   | Status  | Notes                                       |
| ------------------------- | ------- | ------------------------------------------- |
| MCP Client Support        | ✅ Full | Local and remote MCP servers                |
| MCP Server Mode           | ❌ No   | Client only                                 |
| Subagents/Task Delegation | ✅ Yes  | `/delegate` command to Copilot coding agent |
| Background/Async Tasks    | ✅ Yes  | Via `/delegate` to coding agent             |
| Interactive Mode          | ✅ Yes  | Default mode with `copilot` command         |
| Programmatic Mode         | ✅ Yes  | `-p` or `--prompt` for scripting            |

### Memory & Context

| Feature               | Status       | Notes                                                                     |
| --------------------- | ------------ | ------------------------------------------------------------------------- |
| Session Persistence   | ✅ Yes       | `--resume` and `--continue` options                                       |
| Cross-Session Memory  | ✅ Yes       | Via MCP servers                                                           |
| Project Context Files | ✅ Yes       | `.github/agents/`, `.github/mcp.json`                                     |
| Custom Instructions   | ✅ Yes       | `.github/copilot-instructions.md`, path-specific `.instructions.md` files |
| Context Window        | ~200K tokens | Standard context                                                          |

### Extensibility

| Feature               | Status | Notes                                                         |
| --------------------- | ------ | ------------------------------------------------------------- |
| Agent Skills          | ✅ Yes | `.github/skills/` or `.claude/skills/` directories - **NEW!** |
| Custom Slash Commands | ❌ No  | Not supported                                                 |
| Custom Agents         | ✅ Yes | `.github/agents/` directory with Markdown agent profiles      |
| MCP Servers           | ✅ Yes | `/mcp add` command, GitHub MCP built-in                       |
| Tool Approval Options | ✅ Yes | `--allow-all-tools`, `--allow-tool`, `--deny-tool`            |

### Development Features

| Feature            | Status      | Notes                                            |
| ------------------ | ----------- | ------------------------------------------------ |
| Code Review        | ✅ Built-in | Deep PR integration                              |
| Web Search         | ✅ Yes      | Via GitHub integration                           |
| File Operations    | ✅ Native   | With approval system                             |
| Git Integration    | ✅ Deep     | Native git and gh commands                       |
| GitHub Integration | ✅ Deep     | Built-in GitHub MCP server, PRs, issues, Actions |

### Platform & Access

| Feature         | Status                                               | Notes                                               |
| --------------- | ---------------------------------------------------- | --------------------------------------------------- |
| Open Source     | ❌ No                                                | Closed source                                       |
| Free Tier       | ❌ No                                                | Requires Copilot Pro, Pro+, Business, or Enterprise |
| IDE Integration | ✅ Yes                                               | VS Code, JetBrains (via Copilot extension)          |
| Terminal        | ✅ Yes                                               | `copilot` command                                   |
| Platforms       | Linux, macOS, Windows (WSL, experimental PowerShell) |                                                     |

### MCP Configuration

| Setting             | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| User Config Path    | `~/.config/github-copilot/mcp.json` (via CLI: `~/.copilot/mcp-config.json`) |
| Project Config Path | `./.github/mcp.json`                                                        |
| Schema Root Key     | `mcpServers`                                                                |
| Env Var Support     | Native `${VAR}` syntax                                                      |
| Special Behavior    | Built-in GitHub MCP (Overture auto-excludes 'github' to prevent conflicts)  |

### Security Features

| Feature               | Status | Notes                                          |
| --------------------- | ------ | ---------------------------------------------- |
| Trusted Directories   | ✅ Yes | Must confirm trust before operations           |
| Tool Approval         | ✅ Yes | Per-command or per-session approval            |
| Programmatic Approval | ✅ Yes | `--allow-all-tools`, `--deny-tool 'shell(rm)'` |

---

## OpenCode

**Documentation:** https://opencode.ai/docs/  
**GitHub:** https://github.com/sst/opencode  
**Status:** Production (version 1.0+)

### Core Capabilities

| Feature                   | Status  | Notes                                       |
| ------------------------- | ------- | ------------------------------------------- |
| MCP Client Support        | ✅ Full | Local and remote MCP servers with OAuth     |
| MCP Server Mode           | ❌ No   | Client only                                 |
| Subagents/Task Delegation | ✅ Yes  | Built-in subagent system (General, Explore) |
| Background/Async Tasks    | ❌ No   | Not currently supported                     |
| TUI Interface             | ✅ Yes  | Primary interface with rich theming         |
| CLI Mode                  | ✅ Yes  | `opencode` command                          |
| IDE Extension             | ✅ Yes  | VS Code extension available                 |
| Desktop App               | ✅ Yes  | Available                                   |

### Memory & Context

| Feature               | Status       | Notes                                      |
| --------------------- | ------------ | ------------------------------------------ |
| Session Persistence   | ✅ Yes       | `/init`, AGENTS.md                         |
| Cross-Session Memory  | ✅ Yes       | Via MCP servers                            |
| Project Context Files | ✅ Yes       | AGENTS.md, opencode.json                   |
| Custom Instructions   | ✅ Yes       | Rules files, agent-level prompts           |
| Conversation Sharing  | ✅ Yes       | `/share` command generates shareable links |
| Context Window        | ~200K tokens | Varies by provider                         |

### Extensibility

| Feature               | Status | Notes                                                       |
| --------------------- | ------ | ----------------------------------------------------------- |
| Agent Skills          | ✅ Yes | `.opencode/skill/` or `.claude/skills/` with SKILL.md files |
| Custom Slash Commands | ✅ Yes | `.opencode/command/` directory or JSON config               |
| Custom Agents         | ✅ Yes | Markdown or JSON, primary and subagent modes                |
| Custom Tools          | ✅ Yes | Define custom tools in config                               |
| Plugin System         | ✅ Yes | SDK for building plugins                                    |
| LSP Integration       | ✅ Yes | Language Server Protocol support                            |
| ACP Support           | ✅ Yes | Agent Communication Protocol                                |

### Development Features

| Feature         | Status     | Notes                             |
| --------------- | ---------- | --------------------------------- |
| Code Review     | ✅ Yes     | Via commands and Plan agent       |
| Web Search      | ✅ Via MCP | Context7, grep.app, etc.          |
| File Operations | ✅ Native  | Built-in tools with permissions   |
| Git Integration | ✅ Native  | Full git support                  |
| GitHub/GitLab   | ✅ Yes     | Dedicated docs for both platforms |

### Agent System

| Agent   | Mode     | Description                               |
| ------- | -------- | ----------------------------------------- |
| Build   | Primary  | Default agent with all tools enabled      |
| Plan    | Primary  | Read-only analysis, no file modifications |
| General | Subagent | Research and multi-step tasks             |
| Explore | Subagent | Fast codebase exploration                 |

### Platform & Access

| Feature         | Status                | Notes                               |
| --------------- | --------------------- | ----------------------------------- |
| Open Source     | ✅ Yes                | MIT License                         |
| Free Tier       | ✅ Yes                | Fully free (bring your own API key) |
| Zen (Hosted)    | ✅ Yes                | Optional managed model access       |
| IDE Integration | ✅ Yes                | VS Code, Desktop app                |
| Terminal        | ✅ Yes                | TUI and CLI modes                   |
| Platforms       | Linux, macOS, Windows | Full support                        |

### MCP Configuration

| Setting             | Value                              |
| ------------------- | ---------------------------------- | ------------------------------------------------ |
| User Config Path    | `~/.config/opencode/opencode.json` |
| Project Config Path | `./opencode.json`                  |
| Schema Root Key     | `mcp`                              |
| Env Var Support     | `{env:VAR}` syntax                 |
| OAuth Support       | ✅ Yes                             | Automatic OAuth with dynamic client registration |
| Remote MCP          | ✅ Yes                             | Full support with headers                        |

### Permission System

| Feature               | Status | Notes                               |
| --------------------- | ------ | ----------------------------------- |
| Granular Permissions  | ✅ Yes | Per-tool (edit, bash, webfetch)     |
| Permission Levels     | ✅ Yes | ask, allow, deny                    |
| Per-Agent Permissions | ✅ Yes | Override global per agent           |
| Bash Command Patterns | ✅ Yes | Glob patterns for specific commands |
| Skill Permissions     | ✅ Yes | Control skill access per agent      |

---

## Updated Comparison Matrix

| Feature                   | Claude Code             | GitHub Copilot CLI                   | OpenCode                           |
| ------------------------- | ----------------------- | ------------------------------------ | ---------------------------------- |
| **Core Capabilities**     |
| MCP Client Support        | ✅ Full                 | ✅ Full                              | ✅ Full                            |
| MCP Server Mode           | ✅ `claude mcp serve`   | ❌                                   | ❌                                 |
| Subagents/Task Delegation | ✅ Task tool            | ✅ `/delegate`                       | ✅ Subagent system                 |
| Background/Async Tasks    | ✅ Task tool            | ✅ Coding agent                      | ❌                                 |
| **Memory & Context**      |
| Session Persistence       | ✅ `/init`, CLAUDE.md   | ✅ `--resume`, `--continue`          | ✅ `/init`, AGENTS.md              |
| Cross-Session Memory      | ✅ Via MCP              | ✅ Via MCP                           | ✅ Via MCP                         |
| Project Context Files     | ✅ CLAUDE.md, .mcp.json | ✅ .github/agents/, .github/mcp.json | ✅ AGENTS.md, opencode.json        |
| **Extensibility**         |
| **Agent Skills**          | ✅ `.github/skills/`    | ✅ `.github/skills/`                 | ✅ `.opencode/skill/`              |
| Custom Slash Commands     | ✅ `.claude/commands/`  | ❌                                   | ✅ `.opencode/command/`            |
| Custom Agents             | ✅ Via plugins          | ✅ `.github/agents/`                 | ✅ Markdown/JSON config            |
| Hooks/Automation          | ✅ Pre/post hooks       | ❌                                   | ❌                                 |
| Plugin System             | ✅ `claude plugin`      | ✅ Custom agents                     | ✅ SDK + plugins                   |
| **Development Features**  |
| Code Review               | ✅ Via commands         | ✅ Built-in                          | ✅ Plan agent                      |
| Web Search                | ✅ Built-in             | ✅ Via GitHub                        | ✅ Via MCP                         |
| File Operations           | ✅ Native               | ✅ Native                            | ✅ Native                          |
| Git Integration           | ✅ Native               | ✅ Deep GitHub                       | ✅ Native                          |
| **Platform & Access**     |
| Open Source               | ❌                      | ❌                                   | ✅                                 |
| Free Tier                 | ❌ Subscription         | ❌ Subscription                      | ✅ Full (BYOK)                     |
| IDE Integration           | ✅ VS Code, JetBrains   | ✅ VS Code, JetBrains                | ✅ VS Code, Desktop                |
| **MCP Configuration**     |
| User Config Path          | `~/.claude.json`        | `~/.config/github-copilot/mcp.json`  | `~/.config/opencode/opencode.json` |
| Project Config Path       | `./.mcp.json`           | `./.github/mcp.json`                 | `./opencode.json`                  |
| Schema Root Key           | `mcpServers`            | `mcpServers`                         | `mcp`                              |
| Env Var Support           | `${VAR}`                | `${VAR}`                             | `{env:VAR}`                        |

---

## Key Changes Since Last Research

### Claude Code

- Added Slack integration (beta)
- Added web and iOS access (research preview)
- Skills support is now documented

### GitHub Copilot CLI

- **Complete product replacement** - The `gh copilot` extension has been retired
- New standalone `copilot` command with full agentic capabilities
- **Agent Skills support added** - Uses same `.github/skills/` format
- Custom agents via `.github/agents/` directory
- `/delegate` command to hand off to Copilot coding agent
- Trusted directories and tool approval system
- Session resume with `--resume` and `--continue`

### OpenCode

- Now at version 1.0+
- Full Agent Skills support (`.opencode/skill/` and `.claude/skills/` compatible)
- ACP (Agent Communication Protocol) support
- LSP server integration
- OAuth support for remote MCP servers
- Comprehensive permission system with glob patterns
- Custom tools via config
- Plugin SDK available
- Conversation sharing with `/share`

---

## Recommendations for Overture

1. **Update the README comparison matrix** with the new Agent Skills row showing all three support it
2. **Note the Copilot CLI retirement** - The old `gh copilot` is deprecated
3. **Consider Copilot CLI config path changes** - The CLI uses `~/.copilot/` for its config
4. **Add OpenCode's new features** to documentation - OAuth, ACP, LSP, plugins
5. **Skills compatibility** - All three use compatible SKILL.md format; Overture could potentially generate these

---

## Sources

- Claude Code: https://code.claude.com/docs/en/overview, https://www.anthropic.com/product/claude-code
- GitHub Copilot CLI: https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli, https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli
- OpenCode: https://opencode.ai/docs/, https://opencode.ai/docs/skills, https://opencode.ai/docs/commands, https://opencode.ai/docs/agents, https://opencode.ai/docs/mcp-servers
