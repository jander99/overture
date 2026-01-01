# Overture

[![Tests](https://img.shields.io/badge/tests-471%20passing-brightgreen)](https://github.com/overture-stack/overture)
[![Coverage](https://img.shields.io/badge/coverage-83%25-brightgreen)](https://github.com/overture-stack/overture)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.0-blue)](CHANGELOG.md)

> **Multi-platform MCP and Agent orchestrator** - Manage Model Context Protocol (MCP) servers and AI agents across all AI development tools from a single source of truth.

Overture synchronizes MCP configurations and AI agents to **Claude Code**, **GitHub Copilot CLI**, and **OpenCode** from one unified config file, with automatic client detection, version tracking, intelligent merging, and sync status monitoring.

---

## ✨ Features

### MCP Server Management

- 🎯 **Single Source of Truth** - Manage all MCP servers in one `config.yaml` file
- 🔄 **Multi-Platform Sync** - Generates configs for 3+ AI clients automatically
- 🔍 **Auto-Detection** - Finds installed clients, versions, and validates configs
- 📊 **Smart Merging** - Preserves user settings while updating MCP configurations

### AI Agent Management

- 🤖 **Universal Agent Sync** - Write agents once, sync to all clients (Claude Code, OpenCode, Copilot CLI)
- 🔄 **Agent Sync Status** - Track which agents are in sync vs need updating
- ✅ **Agent Validation** - Automatic YAML schema and Markdown validation
- 🎨 **Client-Specific Formats** - Automatic transformation to each client's agent format

### Developer Experience

- 🩺 **Comprehensive Diagnostics** - `doctor` command shows system health and sync status
- 🛡️ **Type-Safe** - Zod schema validation with helpful error messages
- 🧪 **Well-Tested** - 471 tests with 83% code coverage
- 🏗️ **Production-Ready** - Zero security vulnerabilities, TypeScript strict mode

---

## 🚀 Quick Start

### Installation

```bash
npm install -g @overture/cli
```

### Check System Health

```bash
overture doctor
```

Shows installed AI clients, versions, configuration status, and agent sync status.

Example output:

```
Summary:
  Config repo:      exists
  Global agents:    exists (5 agents)
  Project agents:   exists (3 agents)
  Agent sync:       2 in sync, 3 need sync
  Clients detected: 3 / 3
  MCP commands available: 6 / 6
```

### Initialize Project

```bash
cd your-project
overture init
```

Creates `.overture/config.yaml` with starter configuration.

### Sync to All Clients

```bash
overture sync
```

Synchronizes MCPs and agents to all detected clients.

**MCP Configs Generated:**

- `.mcp.json` (Claude Code project config)
- `~/.claude.json` (Claude Code user config)
- `.github/mcp.json` (GitHub Copilot CLI project)
- `opencode.json` (OpenCode project config)

**Agent Files Synced:**

- `~/.claude/agents/<name>.md` (Claude Code)
- `~/.config/opencode/agent/<name>.md` (OpenCode)
- `.github/agents/<name>.agent.md` (GitHub Copilot CLI)

Skip specific sync types:

```bash
overture sync --skip-agents    # Sync only MCPs
overture sync --skip-skills    # Sync MCPs and agents, skip skills
```

---

## 📖 Documentation

- **[User Guide](docs/user-guide.md)** - Complete walkthrough with examples
- **[Architecture](docs/architecture.md)** - Technical design and patterns
- **[Configuration Schema](docs/overture-schema.md)** - Full YAML reference
- **[Examples](docs/examples.md)** - Real-world configurations
- **[Roadmap](docs/roadmap.md)** - Upcoming features

### How-To Guides

- [Add Support for New AI Client](docs/howtos/add-new-cli-client.md)
- [Import Existing MCP Configurations](docs/howtos/importing-existing-configs.md)
- [Set Up Shared Config Repository](docs/howtos/setting-up-config-repo.md)
- [Test MCP Server Changes](docs/howtos/testing-mcp-changes.md)

---

## 💡 Example Configuration

**`.overture/config.yaml`** (Project-level):

```yaml
version: '2.0'

# Project metadata
project:
  name: my-python-api
  type: python-backend

# MCP server definitions
mcp:
  # Python REPL for code execution
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    transport: stdio

  # Ruff linter integration
  ruff:
    command: uvx
    args: [mcp-server-ruff]
    transport: stdio

  # GitHub integration (exclude from Copilot CLI - it's built-in)
  github:
    command: mcp-server-github
    args: []
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}'
    transport: stdio
    clients:
      exclude: [copilot-cli]

# Sync settings
sync:
  backup: true
  backupRetention: 10
  mergeStrategy: append
```

**`~/.config/overture/config.yaml`** (User global):

```yaml
version: '2.0'

# Global MCP servers (available everywhere)
mcp:
  filesystem:
    command: npx
    args: [-y, '@modelcontextprotocol/server-filesystem', '${HOME}']
    transport: stdio

  memory:
    command: npx
    args: [-y, mcp-server-memory]
    transport: stdio

  brave-search:
    command: npx
    args: [-y, '@modelcontextprotocol/server-brave-search']
    env:
      BRAVE_API_KEY: '${BRAVE_API_KEY}'
    transport: stdio
```

Run `overture sync` and both configs merge intelligently!

### AI Agent Configuration

**`~/.config/overture/agents/coding-assistant.yaml`**:

```yaml
name: coding-assistant
model: claude-3-5-sonnet
description: Expert coding assistant for Python and TypeScript
tools:
  - filesystem
  - memory
  - github
```

**`~/.config/overture/agents/coding-assistant.md`**:

```markdown
# Coding Assistant

You are an expert software engineer specializing in Python and TypeScript.

## Guidelines

- Write clean, maintainable code following best practices
- Include comprehensive tests and documentation
- Consider performance and security implications
- Explain your reasoning for architectural decisions
```

**Model Mapping** (`~/.config/overture/models.yaml`):

```yaml
# Map logical names to client-specific model identifiers
claude-3-5-sonnet:
  claude-code: claude-3-5-sonnet-20241022
  opencode: claude-3-5-sonnet-20241022
  copilot-cli: claude-3.5-sonnet
```

Run `overture sync` to deploy agents to all clients with automatic format transformation!

---

## 🎯 Use Cases

### 1. Project-Specific Tooling

```bash
# Python project gets Python MCP servers
cd python-api && overture sync
# → Syncs python-repl, ruff, pytest

# React project gets JavaScript tooling
cd react-app && overture sync
# → Syncs eslint, prettier, typescript
```

### 2. Team Standardization

```bash
# Share .overture/config.yaml in Git
# Team members sync automatically
overture sync --no-backup
```

### 3. Multi-Client Development

```bash
# Use Claude Code for coding
# Use Copilot CLI for terminal
# Use OpenCode for exploration
# → All clients get same MCP servers
```

### 4. Environment-Specific Configs

```yaml
mcp:
  database:
    command: psql-mcp
    env:
      DATABASE_URL: '${DATABASE_URL:-postgresql://localhost:5432/dev}'
    platforms:
      exclude: [win32] # Skip on Windows
```

### 5. Multi-Agent Workflows

```bash
# Define specialized agents for different tasks
~/.config/overture/agents/
├── code-reviewer.yaml    # Code review and best practices
├── debugger.yaml         # Bug investigation and fixes
├── architect.yaml        # System design and planning
└── tester.yaml          # Test generation and coverage

# Sync all agents to every AI client
overture sync

# Check agent sync status
overture doctor --verbose
# → Shows which agents are in sync across clients
```

---

## 🛠️ Core Commands

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `overture init`     | Initialize project configuration             |
| `overture sync`     | Sync MCPs, agents, and skills to all clients |
| `overture doctor`   | System diagnostics with agent sync status    |
| `overture validate` | Validate configuration files                 |
| `overture mcp list` | List all configured MCP servers              |
| `overture user`     | Manage user global configuration             |
| `overture audit`    | Find unmanaged MCPs in client configs        |
| `overture backup`   | Backup/restore client configurations         |
| `overture import`   | Import MCPs from client configs              |

**Sync Options:**

```bash
overture sync --skip-agents      # Skip agent synchronization
overture sync --skip-skills      # Skip skill synchronization
overture sync --skip-plugins     # Skip plugin installation
overture sync --dry-run          # Preview without making changes
overture sync --detail           # Show detailed output with diffs
```

Run `overture --help` for full command reference.

---

## 🏗️ Architecture

Overture uses **hexagonal architecture** with dependency injection:

```
apps/cli/              # CLI application
├── src/
│   ├── commands/      # CLI command handlers
│   ├── core/          # Business logic
│   └── main.ts        # Entry point

libs/
├── domain/               # Core types and schemas
│   ├── config-types/     # TypeScript interfaces
│   ├── config-schema/    # Zod validation schemas
│   ├── diagnostics-types/# Diagnostic result types
│   └── errors/           # Error hierarchy
├── ports/                # Interface definitions
│   ├── filesystem/       # File operations
│   ├── process/          # Process execution
│   └── output/           # Logging and output
├── adapters/             # Infrastructure implementations
│   ├── client-adapters/  # AI client adapters
│   └── infrastructure/   # Node.js adapters
├── core/                 # Domain logic
│   ├── config/           # Config loading/merging
│   ├── sync/             # Multi-client sync engine
│   ├── discovery/        # Client detection
│   ├── diagnostics/      # System health checks
│   ├── agent/            # Agent sync and transformation
│   ├── plugin/           # Plugin management
│   ├── skill/            # Agent Skills sync
│   └── import/           # Config import
└── shared/               # Shared utilities
    ├── formatters/       # Diagnostic output formatting
    └── utils/            # Common utilities
```

**Technology Stack:**

- **Language:** TypeScript 5.9 (strict mode)
- **Build System:** Nx 22 monorepo
- **CLI Framework:** Commander.js
- **Validation:** Zod
- **Testing:** Vitest (471 tests, 83% coverage)
- **Bundler:** esbuild

---

## 🧪 Development

### Prerequisites

- Node.js 20+
- npm 10+
- Nx CLI (optional, or use `npx nx`)

### Setup

```bash
# Clone repository
git clone https://github.com/overture-stack/overture.git
cd overture

# Install dependencies
npm install

# Run tests
nx test @overture/cli

# Run tests with coverage
nx test @overture/cli --coverage

# Build CLI
nx build @overture/cli

# Run locally
node dist/apps/cli/main.js --help
```

### Testing

```bash
# Run all tests
nx test @overture/cli

# Watch mode
nx test @overture/cli --watch

# Specific test file
nx test @overture/cli --testFile=sync.spec.ts

# E2E tests
nx e2e @overture/cli-e2e
```

### Linting

```bash
# Lint all projects
nx run-many -t lint --all

# Fix auto-fixable issues
nx run-many -t lint --all --fix
```

### Code Structure

- Tests are co-located with source files (`*.spec.ts`)
- One class/major function per file
- Use dependency injection (constructor-based)
- Follow Nx module boundaries (enforced by ESLint)

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feat/amazing-feature`)
3. **Write** tests for your changes
4. **Commit** with conventional commits (`feat:`, `fix:`, `docs:`, etc.)
5. **Push** to your fork
6. **Open** a Pull Request

### Conventional Commits

```
feat: add support for Windsurf client
fix: resolve path resolution on Windows
docs: update installation instructions
test: add tests for config merging
refactor: simplify sync engine logic
```

### Code Quality Standards

- ✅ TypeScript strict mode (no `any` types)
- ✅ All tests passing (`nx test @overture/cli`)
- ✅ No ESLint errors (`nx run-many -t lint --all`)
- ✅ Code coverage maintained (>65%)
- ✅ Documentation updated

---

## 🐛 Troubleshooting

### Common Issues

**"Config file not found"**

```bash
# Initialize config first
overture init
```

**"Client not detected"**

```bash
# Check system status
overture doctor

# Force sync without detection
overture sync --skip-binary-detection
```

**"Environment variable not set"**

```yaml
# Use defaults in config
env:
  GITHUB_TOKEN: '${GITHUB_TOKEN:-your-default-token}'
```

**"Permission denied" errors**

```bash
# Check file permissions
ls -la ~/.config/overture/
chmod 644 ~/.config/overture/config.yaml
```

**"Agents not syncing"**

```bash
# Check agent sync status
overture doctor --verbose

# Verify agent files exist
ls -la ~/.config/overture/agents/

# Force sync agents only
overture sync --skip-skills

# Validate agent YAML syntax
overture validate
```

**"Agent model not found"**

```yaml
# Add model mapping to ~/.config/overture/models.yaml
claude-3-5-sonnet:
  claude-code: claude-3-5-sonnet-20241022
  opencode: claude-3-5-sonnet-20241022
  copilot-cli: claude-3.5-sonnet
```

### Debug Mode

Enable verbose logging:

```bash
DEBUG=1 overture sync
```

Shows:

- Stack traces for errors
- Detailed validation messages
- File operation logs

See [Troubleshooting Guide](docs/user-guide.md#troubleshooting) for more solutions.

---

## 📊 Project Status

**Current Version:** v0.3.0 (Production Ready)

**Test Coverage:**

- 471 passing tests
- 83% code coverage
- 35K+ lines of test code
- Comprehensive agent sync and diagnostics testing

**Security:**

- ✅ Zero known vulnerabilities
- ✅ Regular dependency updates
- ✅ TypeScript strict mode

**Roadmap Highlights:**

- Multi-repository skill sharing
- MCP marketplace integration
- VS Code extension
- Web UI for configuration

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Claude Code Team** - For the amazing AI development platform
- **Model Context Protocol** - For standardizing AI tool integrations
- **Nx Team** - For the excellent monorepo tooling
- **Community Contributors** - For feedback and bug reports

---

## 🔗 Related Projects

- [Claude Code Workflows](https://github.com/wshobson/agents) - Plugin marketplace
- [Claude Code Flow](https://github.com/ruvnet/claude-code-flow) - Multi-agent execution
- [MCP Servers](https://github.com/modelcontextprotocol/servers) - Official MCP server implementations

See [docs/related-projects.md](docs/related-projects.md) for detailed comparisons.

---

## 💬 Support

- **Documentation:** [docs/user-guide.md](docs/user-guide.md)
- **Issues:** [GitHub Issues](https://github.com/overture-stack/overture/issues)
- **Discussions:** [GitHub Discussions](https://github.com/overture-stack/overture/discussions)

---

<p align="center">
  Made with ❤️ by the Overture Team
</p>
