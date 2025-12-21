# AGENTS.md

This file provides guidance for AI agents (GitHub Copilot, Cursor, Windsurf, etc.) working with the Overture codebase.

## Project Overview

**Overture** is a multi-platform MCP configuration orchestrator that manages Model Context Protocol (MCP) server configurations across all AI development tools from a single source of truth.

**Current Version:** v0.3.0
**Status:** Production-ready with 384 passing tests, 83%+ code coverage
**Repository:** https://github.com/overture-stack/overture

### What It Does

1. **Multi-Platform Sync** - Generates MCP configs for 3 AI clients (Claude Code, GitHub Copilot CLI, OpenCode)
2. **Binary Detection** - Automatically detects installed AI clients, versions, and validates configs
3. **User/Project Config** - Supports global (`~/.config/overture/config.yaml`) and project-specific (`.overture/config.yaml`) configurations
4. **Documentation Generation** - Creates CLAUDE.md with plugin→MCP usage guidance
5. **System Diagnostics** - `overture doctor` command for health checks and troubleshooting

## Architecture

### Tech Stack

- **Language:** TypeScript 5.x
- **Build System:** Nx 22.0.3 monorepo
- **CLI Framework:** Commander.js
- **Schema Validation:** Zod
- **Config Parsing:** js-yaml
- **Testing:** Jest (911 tests, 83%+ coverage)
- **Bundler:** esbuild

### Project Structure

```
overture/
├── apps/
│   ├── cli/              # CLI application (@overture/cli)
│   │   ├── src/
│   │   │   ├── commands/     # CLI command implementations
│   │   │   ├── core/         # Core business logic
│   │   │   ├── domain/       # Domain models and constants
│   │   │   ├── services/     # Services (detection, validation, etc.)
│   │   │   └── main.ts       # CLI entry point
│   │   └── project.json      # Nx project configuration
│   └── cli-e2e/          # End-to-end tests
├── docs/                 # Documentation
│   ├── user-guide.md
│   ├── QUICKSTART.md
│   ├── examples.md
│   ├── overture-schema.md
│   └── archive/          # Historical docs
└── dist/                 # Build output (git-ignored)
```

### Core Modules

**Commands** (`apps/cli/src/commands/`)

- `init.ts` - Initialize project configuration
- `sync.ts` - Sync MCP configs to all clients
- `doctor.ts` - System diagnostics
- `mcp-commands.ts` - MCP management (list, enable)
- `validate.ts` - Configuration validation

**Services** (`apps/cli/src/services/`)

- `binary-detector.ts` - Detect installed AI clients and versions
- `config-loader.ts` - Load and merge user/project configs
- `validator.ts` - Validate configuration schema
- `backup-manager.ts` - Backup/restore configs

**Core** (`apps/cli/src/core/`)

- `generator.ts` - Generate .mcp.json and CLAUDE.md files
- `sync-engine.ts` - Multi-client sync orchestration
- `client-adapters/` - Platform-specific adapters (7 clients)

**Domain** (`apps/cli/src/domain/`)

- `config.types.ts` - TypeScript configuration types
- `schemas.ts` - Zod validation schemas
- `constants.ts` - Project constants

## Development Workflow

### Prerequisites

- Node.js 20+
- npm 10+
- Nx CLI (installed globally or via npx)

### Common Commands

```bash
# Install dependencies
npm install

# Run all tests
nx test @overture/cli

# Run tests in watch mode
nx test @overture/cli --watch

# Run tests with coverage
nx test @overture/cli --coverage

# Build the CLI
nx build @overture/cli

# Run the CLI locally
node dist/apps/cli/main.js --help

# Lint code
nx lint @overture/cli

# Show workspace structure
nx graph
```

### Testing Strategy

**Test Framework:** Jest with TypeScript support

- **Total Tests:** 911 passing
- **Coverage:** 83%+ (branches, functions, lines)
- **Test Files:** Located alongside source files (\*.spec.ts)

**Test Categories:**

1. **Unit Tests** - Individual functions and classes
2. **Integration Tests** - Service interactions
3. **Command Tests** - CLI command execution
4. **Generator Tests** - Config and documentation generation
5. **Validation Tests** - Schema and MCP validation

**Key Test Patterns:**

- Use `vi.mock()` for external dependencies (Vitest)
- Test both success and error paths
- Validate generated outputs (JSON, Markdown)
- Mock file system operations
- Test platform-specific behavior

### Code Style

**Conventions:**

- Use descriptive variable names
- Prefer `async/await` over promises
- Use TypeScript strict mode
- Validate inputs with Zod schemas
- Handle errors gracefully with user-friendly messages

**File Organization:**

- One class/major function per file
- Co-locate tests with source (`*.spec.ts`)
- Group related functionality in directories
- Use barrel exports (`index.ts`) sparingly

### Git Workflow

**Branch Strategy:**

- `main` - Production-ready code
- `feat/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

**Commit Conventions:**

```
feat: add new feature
fix: resolve bug
docs: update documentation
refactor: restructure code
test: add/update tests
build: build system changes
chore: maintenance tasks
```

**Before Committing:**

1. Run tests: `nx test @overture/cli`
2. Run build: `nx build @overture/cli`
3. Review changes: `git diff`
4. Write descriptive commit message with body

## Key Configuration Patterns

### User Global Config (`~/.config/overture/config.yaml`)

```yaml
version: '1.0'

mcp:
  filesystem:
    command: 'npx'
    args: ['-y', '@modelcontextprotocol/server-filesystem', '${HOME}']

  memory:
    command: 'npx'
    args: ['-y', 'mcp-server-memory']

  github:
    command: 'mcp-server-github'
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}'
```

### Project Config (`.overture/config.yaml`)

```yaml
version: '1.0'

project:
  name: my-project
  type: python-backend

mcp:
  python-repl:
    command: 'uvx'
    args: ['mcp-server-python-repl']

  ruff:
    command: 'uvx'
    args: ['mcp-server-ruff']
```

### Generated Outputs

**`.mcp.json`** - Claude Code project MCP configuration
**`~/.claude.json`** - Claude Code user MCP configuration
**`.github/mcp.json`** - GitHub Copilot CLI project MCP configuration
**`~/.config/github-copilot/mcp.json`** - Copilot CLI user MCP configuration
**`opencode.json`** - OpenCode project MCP configuration
**`~/.config/opencode/opencode.json`** - OpenCode user MCP configuration
**`CLAUDE.md`** - Project guidance with plugin→MCP mappings

All configs generated from single `config.yaml` source of truth (3 clients).

**Note:** Both `.yaml` and `.yml` extensions are supported, with `.yaml` as the preferred extension. Using `.yml` will show a deprecation warning.

## Important Notes

### Always Use Nx Commands

```bash
# ✅ Correct
nx test @overture/cli
nx build @overture/cli

# ❌ Wrong
npm test
npm run build
vitest
```

### Nx Dependency Updates

Always use `nx migrate` for Nx package updates:

```bash
nx migrate latest
npm install
nx migrate --run-migrations
rm migrations.json
```

### Environment Variables

The CLI supports environment variable expansion in config files:

```yaml
env:
  GITHUB_TOKEN: '${GITHUB_TOKEN}' # Required, fails if not set
  DATABASE_URL: '${DATABASE_URL:-postgresql://localhost:5432/dev}' # With default
```

### Platform Detection

The binary detector service automatically detects installed clients:

- **CLI Detection:** Uses `which`/`where` commands
- **GUI Detection:** Checks platform-specific application paths
- **Version Extraction:** Runs `--version` flags with 5-second timeout
- **Config Validation:** Verifies JSON syntax

## Troubleshooting

### Common Issues

**Tests failing:**

- Ensure all dependencies installed: `npm install`
- Clear Nx cache: `nx reset`
- Check for TypeScript errors: `npx tsc --noEmit`

**Build failing:**

- Clear dist directory: `rm -rf dist/`
- Rebuild: `nx build @overture/cli`

**Binary detection not working:**

- Check PATH environment variable
- Verify client is actually installed
- Try with `skipBinaryDetection: true` in config

## Documentation

- **User Guide:** `docs/user-guide.md` - Comprehensive how-to
- **Quick Start:** `docs/QUICKSTART.md` - 5-minute setup
- **Examples:** `docs/examples.md` - Real-world scenarios
- **Schema:** `docs/overture-schema.md` - Configuration reference
- **Purpose:** `docs/PURPOSE.md` - Vision and roadmap

## Related Projects

- **Claude Code Workflows** (wshobson/agents) - Plugin marketplace
- **Claude Code Flow** (ruvnet/claude-code-flow) - Multi-agent execution
- **CCMem** (adestefa/ccmem) - Persistent memory MCP

See `docs/related-projects.md` for detailed analysis.

---

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
