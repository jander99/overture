# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Overture is an orchestration layer that bridges Claude Code plugins and MCP servers. The project aims to:

- **Connect Plugins to MCP Servers**: Enable plugins to declare required/recommended MCP servers
- **Generate Context-Aware Configuration**: Create project-specific `.mcp.json` files with only relevant MCPs
- **Provide Claude with Usage Guidance**: Generate `CLAUDE.md` files that guide Claude's MCP selection
- **Enable Validation**: Ensure required MCP servers are available before use
- **Reduce Configuration Duplication**: Python projects get Python MCPs; Java projects get Java MCPs

## Project Status

This project is in **active development** with architecture and documentation complete:

- [x] **Architecture Design** — Plugin-to-MCP orchestration model defined
- [x] **Configuration Schema** — YAML configuration format designed (see docs/overture-schema.md)
- [x] **Documentation** — Complete examples and schema documentation
- [x] **Nx Workspace** — Monorepo structure initialized
- [x] **CLI Implementation** — Command-line interface (overture init, sync, validate, mcp list/enable)
- [x] **Configuration Generator** — Generates .mcp.json and CLAUDE.md from config
- [x] **Validation Engine** — Validates MCP availability and configuration
- [x] **Test Suite** — Comprehensive Jest tests with 83%+ code coverage (911 tests passing)
- [ ] **E2E Tests** — End-to-end testing in apps/cli-e2e/

Current workspace structure:
```
overture/
├── apps/
│   ├── cli/              # Overture CLI application
│   └── cli-e2e/          # E2E tests for CLI
├── docs/                 # Project documentation
│   ├── overture-schema.md
│   ├── examples.md
│   └── related-projects.md
├── CLAUDE.md             # This file
└── README.md
```

## Architecture

### Core Concept

Overture solves a critical gap in the Claude Code ecosystem: **plugins and MCP servers have no awareness of each other.**

**The Problem:**
- Plugins (python-development, kubernetes-operations) provide agents/skills/commands
- MCP servers (python-repl, kubectl, sqlite) provide tools and integrations
- No mechanism connects them
- Users manually configure MCP servers without guidance
- Claude doesn't know which MCPs to prefer for which plugin features
- Configuration is duplicated across projects unnecessarily

**The Solution:**
- Project-level `.overture/config.yaml` declares plugins and MCP requirements
- Overture generates `.mcp.json` with project-appropriate MCP servers
- Overture generates `CLAUDE.md` with explicit MCP usage guidance for Claude
- Validation ensures required MCPs are available

### Configuration Flow

```
User Edits .overture/config.yaml:
  plugins:
    python-development:
      marketplace: claude-code-workflows
      mcps: [python-repl, ruff]
         ↓
User Runs: overture sync
         ↓
Overture Installs Plugins:
  claude plugin install python-development@claude-code-workflows
         ↓
Overture Generates:
  .mcp.json         → MCP server configuration (project-scoped MCPs only)
  CLAUDE.md         → Plugin↔MCP mappings for Claude
         ↓
Claude Reads CLAUDE.md:
  "When using python-development → use python-repl, ruff MCPs"
```

### Key Files

**Input:**
- `.overture/config.yaml` — User configuration (plugins + MCPs + mappings)
- `~/.config/overture/config.yaml` — Global configuration (optional)

**Output:**
- `.mcp.json` — Project-scoped MCP servers
- `CLAUDE.md` — Generated plugin↔MCP guidance (preserves custom sections)

### Example Configuration

```yaml
# .overture/config.yaml
version: "1.0"

project:
  name: my-api
  type: python-backend

# Plugins to install
plugins:
  python-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [python-repl, ruff, filesystem]

# MCP server configurations
mcp:
  filesystem:
    scope: global  # Reference to global MCP

  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    scope: project

  ruff:
    command: uvx
    args: [mcp-server-ruff]
    scope: project

  github:
    command: mcp-server-github
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    scope: project
```

## Required MCP Servers for Development

The following MCP servers are configured for working on Overture:

### sequentialthinking
**When to use**: Complex, multi-step problem-solving and architectural planning.

Use when:
- Breaking down CLI implementation into components
- Analyzing configuration schema design
- Planning plugin registry structure
- Working through validation logic
- Any task requiring systematic thinking

### filesystem
**When to use**: All file operations.

Use when:
- Reading, writing, or editing configuration files
- Creating directory structures
- Reading example configurations in docs/
- Managing generated outputs
- Working with test fixtures

### context7
**When to use**: Retrieving up-to-date library documentation.

Use when:
- Looking up Commander.js or yargs CLI API
- Finding Zod schema validation patterns
- Checking js-yaml parsing API
- Verifying Claude Code configuration formats
- Looking up Nx workspace patterns

### memory
**When to use**: Maintaining project context across conversations.

Use when:
- Tracking architectural decisions
- Recording plugin-to-MCP mappings
- Maintaining knowledge about configuration schema
- Preserving implementation patterns

### nx (nx-mcp)
**Scope**: Project-scoped (managed by Overture)
**When to use**: Monorepo management and build orchestration.

Use when:
- Running build, test, or lint tasks
- Analyzing project dependencies
- Understanding workspace structure
- Looking up Nx configuration best practices

**Important:** Always run tasks through `nx`:
- `nx build @overture/cli` (not `npm run build`)
- `nx test @overture/cli` (not direct test commands)
- Use `nx_workspace` MCP tool for workspace structure
- Use `nx_project_details` MCP tool for project-specific info
- Use `nx_docs` MCP tool for Nx documentation

**Configuration**: This MCP is configured in `.overture/config.yaml` and managed by Overture. See the Overture Project Configuration section below for details.

## MCP Usage Guidance for This Project

### When implementing CLI commands
- **Read config files** → Use `filesystem` MCP
- **Validate command arguments** → Use `context7` for CLI library docs
- **Generate .mcp.json** → Use `filesystem` to write files

### When working on plugin registry
- **Look up plugin structures** → Use `context7` for wshobson/agents repo
- **Store plugin mappings** → Use `filesystem` for registry files
- **Track MCP recommendations** → Use `memory` for cross-conversation context

### When generating CLAUDE.md
- **Read templates** → Use `filesystem`
- **Merge custom sections** → Use `filesystem` to preserve edits
- **Generate MCP guidance** → Use plugin registry + templates

### When implementing validation
- **Check command existence** → Use `filesystem` for PATH checks
- **Validate schema** → Use `context7` for Zod patterns
- **Test MCP servers** → Execute validation commands

## Development Workflow

### Starting a new feature
1. Use `nx_workspace` to understand current structure
2. Use `sequentialthinking` to break down the feature
3. Create todo list with `TodoWrite`
4. Implement with appropriate MCP tools
5. Test with `nx test @overture/cli`

### Testing changes
```bash
nx test @overture/cli          # Run unit tests
nx build @overture/cli          # Build CLI
node dist/apps/cli/main.js init # Test CLI manually
```

### Committing changes
Follow git commit message conventions from the project history:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `refactor:` for code refactoring

Include Claude Code attribution:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Working with Nx

This project uses Nx for monorepo management and build orchestration. **Always use Nx commands** instead of npm scripts or direct tool invocation.

### Nx MCP Server Tools

The Nx MCP server provides several tools for workspace management:

#### `nx_workspace`
**Purpose:** Get an overview of the entire workspace structure, projects, and dependency graph.

**When to use:**
- Starting work on the project (session start checklist)
- Understanding project relationships
- Checking for project graph errors
- Getting a high-level view of the monorepo architecture

**Example:**
```typescript
// Get full workspace overview
mcp__nx-mcp__nx_workspace()

// Filter to specific projects
mcp__nx-mcp__nx_workspace({ filter: "cli" })
mcp__nx-mcp__nx_workspace({ filter: "tag:type:app" })
```

#### `nx_project_details`
**Purpose:** Get detailed configuration for a specific project including targets, dependencies, and options.

**When to use:**
- Understanding what tasks are available for a project
- Checking project configuration before running commands
- Analyzing build/test configurations
- Understanding project dependencies

**Example:**
```typescript
// Get full project details
mcp__nx-mcp__nx_project_details({ projectName: "@overture/cli" })

// Get specific configuration path
mcp__nx-mcp__nx_project_details({
  projectName: "@overture/cli",
  filter: "targets.build"
})
```

#### `nx_docs`
**Purpose:** Retrieve up-to-date Nx documentation relevant to your query.

**When to use:**
- Questions about Nx configuration
- Learning about Nx features
- Understanding best practices
- Troubleshooting Nx issues
- **ALWAYS use this instead of assuming Nx behavior**

**Example:**
```typescript
mcp__nx-mcp__nx_docs({ userQuery: "how to configure esbuild in nx" })
mcp__nx-mcp__nx_docs({ userQuery: "nx migrate workflow" })
```

#### `nx_generators` & `nx_generator_schema`
**Purpose:** List available generators and get their schemas.

**When to use:**
- Creating new projects, libraries, or components
- Understanding generator options before scaffolding

### Nx Command Patterns

**Always use Nx commands for tasks:**

```bash
# ✅ Correct - use nx
nx build @overture/cli
nx test @overture/cli
nx test @overture/cli --watch
nx affected --target=test
nx run-many --target=build --all

# ❌ Incorrect - don't use npm scripts or direct tools
npm run build
npm test
jest
```

### Updating Nx Dependencies

**CRITICAL:** Always use `nx migrate` for Nx version updates:

```bash
# Check for available updates
nx migrate latest

# Or update to specific version
nx migrate @nx/workspace@22.1.0

# Review package.json changes
git diff package.json

# Install dependencies
npm install

# Run any generated migrations (if migrations.json exists)
nx migrate --run-migrations

# Clean up after successful migration
rm migrations.json

# Test everything works
nx build @overture/cli
nx test @overture/cli

# Commit changes
git add .
git commit -m "build(deps): update Nx to vX.Y.Z"
```

**Why `nx migrate` is required:**
- Updates all Nx packages with correct version alignment
- Pins Nx packages to exact versions (removes `^` prefix)
- Generates code migrations for breaking changes
- Updates workspace configuration automatically

### Common Nx Workflows for This Project

#### Running Tests
```bash
# Run all tests for CLI
nx test @overture/cli

# Run tests in watch mode
nx test @overture/cli --watch

# Run tests with coverage
nx test @overture/cli --coverage

# Run affected tests (only projects changed)
nx affected --target=test
```

#### Building
```bash
# Build for development
nx build @overture/cli

# Build for production
nx build @overture/cli --configuration=production

# Build all affected projects
nx affected --target=build
```

#### Analyzing Dependencies
```bash
# See dependency graph
nx graph

# See dependencies for specific project
nx graph --focus=@overture/cli

# Check circular dependencies
nx graph --affected
```

#### Workspace Information
```bash
# List all projects
nx show projects

# Show project details as JSON
nx show project @overture/cli --json

# List available plugins
nx list
```

### Nx Best Practices for Overture

1. **Always use MCP tools first** — Use `nx_workspace` and `nx_project_details` to understand structure before making changes

2. **Use `nx_docs` liberally** — Don't assume Nx behavior, especially for:
   - Configuration options
   - Migration procedures
   - Plugin capabilities
   - Build optimization

3. **Validate with Nx commands** — Before committing:
   ```bash
   nx build @overture/cli  # Ensure build works
   nx test @overture/cli   # Ensure tests pass
   nx lint @overture/cli   # Ensure code quality
   ```

4. **Use affected commands** — For efficiency in CI/CD:
   ```bash
   nx affected --target=test --base=main
   nx affected --target=build --base=main
   ```

5. **Update dependencies properly**:
   - Nx packages: Use `nx migrate`
   - Other packages: Use `npm install` or `npm update`
   - Never manually edit Nx package versions in package.json

## Workflow Quality Checklists

**IMPORTANT**: Claude should reference these checklists and **proactively remind the user** when they're not being followed. These practices improve code quality, collaboration, and knowledge retention.

### ✅ Session Start Checklist

**Claude: Check this list at the start of EVERY session**

- [ ] **Review memory graph** — Use `mcp__memory__read_graph` to understand previous context
- [ ] **Check CLAUDE.md** — Review project-specific guidance and status
- [ ] **Create task list** — Use `TodoWrite` to plan session work
- [ ] **Check git status** — Understand current branch and uncommitted changes
- [ ] **For complex tasks** — Use `sequentialthinking` MCP to break down approach
- [ ] **Identify MCP needs** — Determine which MCPs will be needed for the session

### 🏗️ During Implementation Checklist

**Claude: Remind the user when these practices aren't being followed**

- [ ] **Use TDD** — Write failing tests BEFORE implementation (red-green-refactor)
- [ ] **Use context7 for library docs** — Don't guess at API usage (commander, zod, jest, etc.)
- [ ] **Use nx_docs for Nx questions** — Don't assume Nx behavior or configuration
- [ ] **Use Nx commands** — Always use `nx test`, `nx build`, etc. (not npm scripts or direct tools)
- [ ] **Use feature branches** — Create branches for new work: `git checkout -b feat/feature-name`
- [ ] **Update TodoWrite** — Mark tasks as in_progress/completed in real-time
- [ ] **Track challenges** — Create memory entities for problems encountered and solutions found
- [ ] **Document decisions** — Create docs/adr/NNNN-decision-name.md for architectural choices

### 📝 Before Committing Checklist

**Claude: Validate this list before ANY git commit**

- [ ] **Run tests** — Execute `nx test @overture/cli` to ensure all tests pass
- [ ] **Run build** — Execute `nx build @overture/cli` to ensure clean build
- [ ] **Review diff** — Check `git diff` to ensure commit is focused (< 500 lines ideal)
- [ ] **Conventional commit** — Use proper prefix (feat:, fix:, docs:, refactor:, test:)
- [ ] **Commit message body** — Add explanation for complex changes (what and why)
- [ ] **Claude attribution** — Include Claude Code attribution footer
- [ ] **Update status** — Update CLAUDE.md checkboxes if milestone completed
- [ ] **Track metrics** — Add memory observations for coverage changes

### 🧪 After Test Run Checklist

**Claude: Execute this after running tests**

- [ ] **Track coverage** — Add memory observation with coverage metrics
  ```
  mcp__memory__add_observations({
    entityName: "Test Coverage Metrics",
    contents: ["YYYY-MM-DD: XX% core coverage, NNN tests passing"]
  })
  ```
- [ ] **Document failures** — Create memory entities for test failures and fixes
- [ ] **Update test count** — Track total test count over time

### 🎯 MCP Best Practices

**Claude: Apply these rules when selecting tools**

1. **sequentialthinking** — ALWAYS use for:
   - Complex feature planning
   - Architectural decisions
   - Multi-step problem solving
   - Breaking down large tasks

2. **context7** — ALWAYS use for:
   - Library API lookups (don't guess!)
   - Framework documentation
   - Unknown CLI tools or commands
   - Checking latest best practices

3. **memory** — ALWAYS use for:
   - Tracking implementation decisions across sessions
   - Recording challenges and solutions
   - Updating coverage metrics after tests
   - Storing dependency information

4. **Task tool** — Use for:
   - Parallel agent execution (test batches, etc.)
   - Complex multi-file operations
   - Specialized agent capabilities

### 📊 Quality Metrics Tracking

**Claude: Track these metrics in memory after each significant change**

```typescript
// Example memory update pattern
mcp__memory__add_observations({
  entityName: "Overture CLI Implementation",
  contents: [
    "YYYY-MM-DD: Coverage: XX.X% (branches), YY.Y% (functions), ZZ.Z% (lines)",
    "YYYY-MM-DD: Test count: NNN passing, 0 failing",
    "YYYY-MM-DD: Build time: X.Xs, Bundle size: YYY KB"
  ]
})
```

### 🚨 Common Anti-Patterns to Avoid

**Claude: Actively warn when detecting these patterns**

❌ **Don't:**
- Commit without running tests
- Write implementation before tests (unless prototyping)
- Guess at library APIs instead of using context7
- Bundle multiple unrelated changes in one commit
- Skip commit message bodies for complex changes
- Forget to update CLAUDE.md status after milestones
- Work directly on main branch for new features
- Skip TodoWrite for multi-step tasks
- Use npm scripts or direct tools (jest, tsc) instead of Nx commands
- Manually update Nx package versions in package.json
- Skip `nx migrate` for Nx version updates

✅ **Do:**
- Follow TDD: test first, then implementation
- Use context7 to look up correct library usage
- Create focused, single-purpose commits
- Write descriptive commit messages with bodies
- Update documentation immediately after changes
- Use feature branches for experimental work
- Track all multi-step work with TodoWrite
- Always use `nx` commands for build, test, lint tasks
- Use `nx migrate` for all Nx dependency updates
- Use `nx_docs` MCP tool before assuming Nx behavior

## Related Projects

- **wshobson/agents** — Plugin marketplace we analyzed for duplication patterns
- **obra/superpowers** — Example of skills library Overture would help manage
- **adestefa/ccmem** — Example of project-specific MCP that Overture would configure

See docs/related-projects.md for detailed analysis.

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

<!-- overture configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## Overture Project Configuration

**Project:** overture
 (typescript-tooling)

Configuration orchestrator and documentation generator for AI-assisted development ecosystem

## Configured Plugins

The following Claude Code plugins are configured for this project:

No plugins configured.

## MCP Servers

### nx-mcp (Project)

**Command:** `npx`
**Status:** ✅ Enabled

## Plugin→MCP Guidance

No plugin→MCP mappings defined.

---

*This section is managed by Overture. To preserve custom content, add it above or below the Overture markers.*


<!-- overture configuration end-->

