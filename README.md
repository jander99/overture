# Overture

[![Tests](https://img.shields.io/badge/tests-296%20passing-brightgreen)](https://github.com/overture-stack/overture)
[![Coverage](https://img.shields.io/badge/coverage-69%25-yellow)](https://github.com/overture-stack/overture)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.0-blue)](CHANGELOG.md)

> **Multi-platform MCP configuration orchestrator** - Manage Model Context Protocol (MCP) servers across all AI development tools from a single source of truth.

Overture synchronizes MCP configurations to **Claude Code**, **GitHub Copilot CLI**, and **OpenCode** from one unified config file, with automatic client detection, version tracking, and intelligent merging.

---

## ✨ Features

- 🎯 **Single Source of Truth** - Manage all MCP servers in one `config.yaml` file
- 🔄 **Multi-Platform Sync** - Generates configs for 3+ AI clients automatically
- 🔍 **Auto-Detection** - Finds installed clients, versions, and validates configs
- 📊 **Smart Merging** - Preserves user settings while updating MCP configurations
- 🛡️ **Type-Safe** - Zod schema validation with helpful error messages
- 🧪 **Well-Tested** - 296 tests with 69% code coverage
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

Shows installed AI clients, versions, and configuration status.

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

Generates platform-specific configs:

- `.mcp.json` (Claude Code project config)
- `~/.claude.json` (Claude Code user config)
- `.github/mcp.json` (GitHub Copilot CLI project)
- `opencode.json` (OpenCode project config)

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

---

## 🛠️ Core Commands

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `overture init`     | Initialize project configuration      |
| `overture sync`     | Sync MCP configs to all clients       |
| `overture doctor`   | System diagnostics and health check   |
| `overture validate` | Validate configuration files          |
| `overture mcp list` | List all configured MCP servers       |
| `overture user`     | Manage user global configuration      |
| `overture audit`    | Find unmanaged MCPs in client configs |
| `overture backup`   | Backup/restore client configurations  |
| `overture import`   | Import MCPs from client configs       |

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
├── domain/            # Core types and schemas
│   ├── config-types/  # TypeScript interfaces
│   ├── config-schema/ # Zod validation schemas
│   └── errors/        # Error hierarchy
├── ports/             # Interface definitions
│   ├── filesystem/    # File operations
│   ├── process/       # Process execution
│   └── output/        # Logging and output
├── adapters/          # Infrastructure implementations
│   ├── client-adapters/  # AI client adapters
│   └── infrastructure/   # Node.js adapters
└── core/              # Domain logic
    ├── config/        # Config loading/merging
    ├── sync/          # Multi-client sync engine
    ├── discovery/     # Client detection
    ├── plugin/        # Plugin management
    ├── skill/         # Agent Skills sync
    └── import/        # Config import
```

**Technology Stack:**

- **Language:** TypeScript 5.9 (strict mode)
- **Build System:** Nx 22 monorepo
- **CLI Framework:** Commander.js
- **Validation:** Zod
- **Testing:** Vitest (296 tests, 69% coverage)
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

- 296 passing tests
- 69% code coverage (targeting 80%)
- 28K+ lines of test code

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
