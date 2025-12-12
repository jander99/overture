# Overture

> Configuration orchestrator and documentation generator for AI-assisted development

**Overture eliminates configuration chaos across AI development tools.**

Declare your AI tool setup once. Sync everywhere. Work better together.

---

## The Problem

Developers using AI-assisted tools face **configuration chaos**:

### Multiple AI Tools, Multiple Configs
- **Claude Desktop** → `~/Library/Application Support/Claude/mcp.json`
- **Claude Code** (user) → `~/.config/claude/mcp.json`
- **Claude Code** (project) → `./.mcp.json`
- **GitHub Copilot CLI** → Various locations
- **VSCode/IntelliJ Copilot** → Extension settings

### The Pain Points
- ❌ Same MCP server configured in 3 different places, 3 different ways
- ❌ Outdated configs from experiments lingering everywhere
- ❌ Install `python-development` plugin → manually configure `python-repl` MCP separately
- ❌ No way to know which MCPs enhance which plugins
- ❌ Can't share team AI workflows in version control
- ❌ Claude/Copilot don't know "use memory to persist discoveries"

**You've been experimenting with AI tools. Your config is a mess. Overture fixes it.**

---

## The Solution: Three Pillars

### 1. 🔧 Multi-Platform MCP Configuration Manager

**Single source of truth across all AI tools.**

Declare MCP servers once in `~/.config/overture.yml`. Sync everywhere.

```yaml
# ~/.config/overture.yml - Your canonical AI config
mcp:
  github:
    command: mcp-server-github
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"

  memory:
    command: mcp-server-memory
```

```bash
overture sync
→ Updates Claude Desktop config
→ Updates Claude Code user config
→ Updates Claude Code project .mcp.json (only unique MCPs)
→ Updates Copilot configs (if installed)
```

**Smart deduplication:** Project configs reference global MCPs without redefining them.

```yaml
# my-project/.overture.yml
mcp:
  github:

  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
```

**Dotfiles integration:** Commit `~/.config/overture.yml` to your dotfiles repo. New machine? `overture sync` and you're ready.

---

### 2. 🔌 Plugin Lifecycle Manager

**User global + project-specific plugins with smart precedence.**

```yaml
# ~/.config/overture.yml
plugins:
  python-development:
    marketplace: claude-code-workflows

# my-project/.overture.yml
plugins:
  python-development:

  kubernetes-operations:
    marketplace: claude-code-workflows
```

```bash
overture sync
→ Skips python-development (already installed globally)
→ Installs kubernetes-operations for this project only
→ Updates CLAUDE.md: "Active plugins for this project: [...]"
```

**Team alignment:** Commit `.overture.yml` to project repos. New team members run `overture sync` and get the exact plugin setup.

---

### 3. 📝 AI Context Documentation Generator

**Generate rich CLAUDE.md/AGENTS.md files with workflow orchestration.**

Move beyond "here's what we found via grep" to **actionable AI guidance**.

```yaml
# .overture.yml
documentation:
  workflows:
    - name: "TDD with AI assistance"
      trigger: "When writing tests"
      instructions: |
        1. Use context7 MCP to look up testing library best practices
        2. Use memory MCP to check previous test patterns in this project
        3. Use python-repl MCP to validate test assertions
        4. Store new patterns in memory for future reference

    - name: "API implementation with research"
      trigger: "When implementing API endpoints"
      instructions: |
        1. Use context7 to fetch latest FastAPI documentation
        2. Use memory to retrieve project API design patterns
        3. Use ruff MCP for linting as you code
        4. Persist architectural decisions in memory

  agent_mcp_mappings:
    python-development:python-pro:
      mcps:
        memory: "Persist architectural decisions and patterns discovered"
        context7: "Always look up latest library docs before implementing"
        python-repl: "Validate complex logic before committing"
```

**Generated CLAUDE.md includes:**
- Active plugins for this project
- Global vs project MCPs
- **Workflow instructions that orchestrate multiple MCPs together**
- Agent/skill → MCP usage guidance

**This is the magic:** Overture teaches Claude **how to use your tools together**, not just which tools exist.

---

## Quick Start

### Current Version (v0.2.5 - Available Now)

Overture v0.2.5 provides comprehensive multi-platform MCP configuration management with intelligent client detection:

```bash
# Install Overture
npm install -g @overture/cli

# Check which AI clients are installed
overture doctor
# → Detects installed clients (Claude Code, Claude Desktop, VSCode, etc.)
# → Shows version information
# → Validates existing config files
# → Lists available MCP commands

# Initialize user global config (optional)
overture user init

# Initialize your project
cd my-project
overture init --type python-backend

# Edit .overture/config.yaml to add plugins and MCPs
vim .overture/config.yaml

# Sync configuration across all AI tools
overture sync
# → Detects installed clients automatically
# → Installs plugins via Claude CLI
# → Generates/updates configs for all detected clients
# → Creates backups before changes
# → Generates CLAUDE.md
# → Warns but continues if client not detected (you can install later)
```

**What v0.2.5 includes:**
- ✅ User global configuration (`~/.config/overture.yml`)
- ✅ Project-level configuration (`.overture/config.yaml`)
- ✅ Multi-platform sync (7 clients supported)
- ✅ **Intelligent binary detection** - Automatically detects installed clients, versions, and validates configs
- ✅ **Diagnostics command** (`overture doctor`) - Comprehensive system diagnostics
- ✅ Config audit and consolidation
- ✅ Backup/restore system
- ✅ Plugin installation and management
- ✅ Validation (`overture validate`)
- ✅ **911 tests passing (100%), 83%+ code coverage**

---

## Example: Python Backend Project

```yaml
# .overture/config.yaml
version: "1.0"

project:
  name: my-fastapi-backend
  type: python-backend

plugins:
  python-development:
    marketplace: claude-code-workflows
    mcps: [python-repl, ruff, filesystem]

  backend-development:
    marketplace: claude-code-workflows
    mcps: [filesystem, docker]

mcp:
  # Global MCP (reference only)
  filesystem:

  # Project-specific MCPs
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]

  ruff:
    command: uvx
    args: [mcp-server-ruff]

  docker:
    command: docker-mcp-server
```

```bash
overture sync
```

**Generated `.mcp.json`:**
```json
{
  "mcpServers": {
    "python-repl": {
      "command": "uvx",
      "args": ["mcp-server-python-repl"]
    },
    "ruff": {
      "command": "uvx",
      "args": ["mcp-server-ruff"]
    },
    "docker": {
      "command": "docker-mcp-server"
    }
  }
}
```

**Generated `CLAUDE.md`** includes plugin→MCP mappings:
```markdown
## Active Plugins
- python-development
- backend-development

## MCP Servers
### Global: filesystem
### Project: python-repl, ruff, docker

## Plugin-to-MCP Mappings
When using python-development → use python-repl, ruff, filesystem
When using backend-development → use filesystem, docker
```

---

## Commands

### System Diagnostics

```bash
# Check which AI clients are installed
overture doctor
# Shows:
# - Installed clients (Claude Code, Claude Desktop, VSCode, Cursor, etc.)
# - Version information for each client
# - Config file locations and validity
# - Available MCP server commands

# Options:
overture doctor --json          # Output as JSON
overture doctor --verbose       # Show detailed warnings
```

### Configuration Management

```bash
# Initialize project configuration
overture init [--type <type>]

# Initialize user global configuration
overture user init

# Show user global configuration
overture user show [--json]

# Sync configuration (install plugins + generate configs)
overture sync
# - Automatically detects installed AI clients
# - Generates configs only for detected clients
# - Warns if client not found but continues (install later)
# - Shows binary detection results for each client
# - Preserves manually-added MCPs

# Options:
overture sync --dry-run         # Preview changes without writing
overture sync --client <name>   # Sync only specific client
overture sync --force           # Force sync even with warnings

# Validate configuration
overture validate
```

### MCP Management

```bash
# List all MCP servers (Overture-managed + manually-added)
overture mcp list
# Options:
overture mcp list --source manual      # Show only manually-added MCPs
overture mcp list --source overture    # Show only Overture-managed MCPs
overture mcp list --scope global       # Show only global MCPs
overture mcp list --scope project      # Show only project MCPs
overture mcp list --client <name>      # Filter by client

# Enable a disabled MCP
overture mcp enable <name>

# Audit for unmanaged MCPs in client configs
overture audit [--client <name>]
```

### Plugin Management

```bash
# List installed Claude Code plugins
overture plugin list [--json]

# Export installed plugins to user config
overture plugin export [--dry-run]
```

### Backup Management

```bash
# List all backups
overture backup list [--client <name>]

# Restore a backup
overture backup restore <client> [timestamp]

# Clean up old backups (keep last 10 per client)
overture backup cleanup [--dry-run]
```

---

## Roadmap

### v0.1 - Foundation ✅ COMPLETE
- [x] Project-level config for Claude Code
- [x] Plugin installation via Claude CLI
- [x] Basic .mcp.json generation
- [x] Simple CLAUDE.md templates
- [x] Validation engine
- [x] 98%+ test coverage

### v0.2 - Multi-Platform MCP Manager ✅ COMPLETE
- [x] User global config (`~/.config/overture.yml`)
- [x] User/project precedence and deduplication
- [x] Multi-platform adapters:
  - [x] Claude Desktop
  - [x] Claude Code (user + project config)
  - [x] Cursor IDE
  - [x] Windsurf IDE
  - [x] VSCode Copilot
  - [x] Copilot CLI
  - [x] JetBrains Copilot
- [x] Config audit: `overture audit`
- [x] Backup/restore: `overture backup`
- [x] Multi-client sync engine

### v0.2.5 - Intelligent Client Detection ✅ COMPLETE
- [x] Binary detection service
  - [x] Detect CLI binaries in PATH
  - [x] Detect GUI application bundles
  - [x] Extract version information
  - [x] Validate config file JSON
- [x] `overture doctor` diagnostics command
  - [x] Show installed clients and versions
  - [x] Validate config files
  - [x] Check MCP command availability
  - [x] JSON output mode
- [x] Enhanced sync output
  - [x] Show detection results per client
  - [x] "Warn but allow" approach (generate configs even if client not detected)
- [x] 911 tests passing (100%), 83%+ code coverage

---

## Configuration Structure

```
# User global (dotfiles)
~/.config/
└── overture.yml              # Canonical user MCP config

# Project
my-project/
├── .overture/
│   └── config.yaml           # Project Overture config
├── .mcp.json                 # Generated (Claude Code project)
├── CLAUDE.md                 # Generated AI guidance
└── src/
```

---

## Why Overture?

### Without Overture
**Configuration Hell:**
- Install `python-development` plugin manually
- Separately configure `python-repl` MCP in `.mcp.json`
- Repeat for Claude Desktop, Copilot, etc.
- Duplicate config across similar projects
- No guidance for Claude on which tools to use together
- Config drift across machines

**Claude's perspective:**
- ❌ Doesn't know which MCPs work best with which plugins
- ❌ No workflow orchestration guidance
- ❌ Trial and error to discover tool combinations

### With Overture
**Configuration Harmony:**
- Declare config ONCE in `~/.config/overture.yml`
- `overture sync` updates ALL platforms automatically
- Project configs reference globals (no duplication)
- Commit `.overture.yml` to version control
- Team members get consistent setup

**Claude's perspective:**
- ✅ Reads CLAUDE.md and knows which MCPs to use
- ✅ Has workflow instructions: "context7 → memory → python-repl"
- ✅ Better AI assistance through better guidance

**Overture turns AI tool chaos into AI tool harmony.**

---

## Documentation

### User Guides
- **[Purpose & Vision](docs/PURPOSE.md)** - Detailed vision, scope, and roadmap
- **[Configuration Schema](docs/overture-schema.md)** - Full configuration reference
- **[Examples](docs/examples.md)** - Complete examples for different project types

### Project Documentation
- **[Implementation Plan](docs/implementation-plan.md)** - Development milestones
- **[Related Projects](docs/related-projects.md)** - Ecosystem analysis

### Design & Research
- **[Architecture Research](docs/architecture.md)** - Claude Code architecture deep-dive

---

## What Overture Is

- ✅ **Configuration orchestrator** — "Dotfiles for AI tool configs"
- ✅ **Documentation generator** — Enhanced CLAUDE.md/AGENTS.md with workflows
- ✅ **Infrastructure tool** — Plumbing that makes AI tools work together

## What Overture Is NOT

- ❌ **NOT an execution orchestrator** (like Claude Code Flow)
- ❌ **NOT a runtime coordinator** (like Claude Squad)
- ❌ **NOT a plugin marketplace** (uses existing marketplaces)
- ❌ **NOT a plugin authoring framework**

**Overture configures. Other tools execute.**

---

## AI Coding CLI Comparison Matrix

This comparison uses Claude Code as the baseline and compares features across major AI coding CLIs as of December 2025.

| Feature | Claude Code | OpenAI Codex | GitHub Copilot CLI | Gemini CLI | Cursor CLI | Windsurf | Amazon Q CLI |
|---------|-------------|--------------|-------------------|------------|------------|----------|--------------|
| **Core Capabilities** |
| MCP Client Support | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| MCP Server Mode | ✅ `claude mcp serve` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Subagents/Task Delegation | ✅ Built-in | ✅ Via `/delegate` | ✅ Via `/delegate` | ✅ ReAct loop | ✅ Agent mode | ✅ Cascade | ✅ Agent mode |
| Background/Async Tasks | ✅ Task tool | ✅ Cloud sandbox | ✅ Coding agent | ❌ | ✅ Background agents | ❌ | ✅ Background |
| **Memory & Context** |
| Session Persistence | ✅ `/init`, CLAUDE.md | ✅ `codex resume` | ✅ Session history | ✅ Conversation history | ✅ `cursor resume` | ✅ Auto-save | ✅ `q chat --resume` |
| Cross-Session Memory | ✅ Via MCP servers | ✅ Via MCP | ✅ Via MCP | ✅ Via MCP | ✅ Built-in Memories | ✅ Auto-Memories | ✅ Via MCP |
| Project Context Files | ✅ CLAUDE.md | ✅ AGENTS.md | ✅ `.github/agents/` | ✅ GEMINI.md | ✅ `.cursorrules` | ✅ Rules | ✅ Context files |
| Context Window | ~200K tokens | ~200K tokens | ~200K tokens | 1M tokens | ~200K tokens | ~200K tokens | ~200K tokens |
| **Extensibility** |
| Hooks/Automation | ✅ Pre/post hooks | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Context hooks |
| Custom Slash Commands | ✅ `.claude/commands/` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Slash commands |
| Plugin System | ✅ `claude plugin` | ❌ | ✅ Custom agents | ❌ | ✅ Extensions | ✅ Extensions | ❌ |
| **Development Features** |
| Code Review | ✅ Via commands | ✅ Built-in | ✅ Built-in | ✅ Agent mode | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| Web Search | ✅ Built-in | ✅ Built-in | ✅ Via GitHub | ✅ Google Search | ✅ Via MCP | ✅ Built-in | ✅ Built-in |
| File Operations | ✅ Native tools | ✅ Native tools | ✅ Native tools | ✅ Native tools | ✅ Native tools | ✅ Native tools | ✅ Native tools |
| Git Integration | ✅ Native | ✅ Native | ✅ Deep GitHub | ✅ Native | ✅ Native | ✅ Native | ✅ AWS CodeCommit |
| **Platform & Access** |
| Open Source | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ (transitioning) |
| Free Tier | ❌ | ✅ (with Plus) | ❌ | ✅ 1000 req/day | ❌ | ✅ Limited | ✅ Free tier |
| IDE Integration | ✅ VS Code, JetBrains | ✅ VS Code, Cursor | ✅ VS Code, JetBrains | ✅ VS Code | ✅ Native IDE | ✅ Native IDE | ✅ VS Code, JetBrains |
| Cloud Execution | ❌ Local only | ✅ Codex Cloud | ✅ Coding agent | ❌ Local only | ❌ Local only | ❌ Local only | ✅ AWS integration |

### Key Differentiators

**Claude Code** ([docs](https://docs.anthropic.com/en/docs/claude-code))
- Only CLI that can run as both MCP client AND server
- Rich plugin ecosystem with hooks for automation
- Project-scoped configuration via `.mcp.json`

**OpenAI Codex CLI** ([GitHub](https://github.com/openai/codex))
- Cloud sandbox execution for isolated tasks
- Integrated code review with GPT-5-Codex
- Slack integration for team delegation

**GitHub Copilot CLI** ([docs](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli))
- Deep GitHub integration (PRs, issues, repos)
- Partner-built agents (Terraform, MongoDB, etc.)
- `/delegate` for async background work

**Gemini CLI** ([GitHub](https://github.com/google-gemini/gemini-cli))
- 1M token context window
- Google Search grounding built-in
- Generous free tier (1000 requests/day)

**Cursor CLI** ([docs](https://cursor.com/cli))
- Built-in persistent memory system
- Browser integration via MCP
- Permission controls via `cli-config.json`

**Windsurf** ([docs](https://docs.windsurf.com))
- Cascade agent with built-in planning
- Auto-generate memories from conversations
- Turbo mode for auto-executing commands
- Gartner Magic Quadrant Leader 2025

**Amazon Q Developer CLI** ([GitHub](https://github.com/aws/amazon-q-developer-cli))
- Deep AWS service integration
- Transitioning to Kiro CLI
- Context hooks for dynamic context injection

### MCP Adoption Timeline

The Model Context Protocol has become the standard for AI tool extensibility:
- **March 2025**: OpenAI adopted MCP across ChatGPT
- **April 2025**: Google confirmed MCP support for Gemini
- **2025**: All major CLIs now support MCP as clients

---

## Related Projects

- [wshobson/agents](https://github.com/wshobson/agents) — Claude plugin marketplace
- [ruvnet/claude-code-flow](https://github.com/ruvnet/claude-code-flow) — Multi-agent execution orchestrator
- [smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad) — Multi-agent coordinator
- [obra/superpowers](https://github.com/obra/superpowers) — Claude skills library
- [adestefa/ccmem](https://github.com/adestefa/ccmem) — Persistent memory MCP

See [docs/related-projects.md](docs/related-projects.md) for detailed ecosystem analysis.

---

## Contributing

Contributions welcome!

**Focus areas:**
- Documentation improvements
- Bug fixes and feature requests
- Feature enhancements

---

## License

MIT

---

## Status

**Current:** v0.2.5 - Intelligent Client Detection complete (911/911 tests passing, 83%+ code coverage)
