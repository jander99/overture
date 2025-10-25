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
- [ ] **CLI Implementation** — Command-line interface (overture init, add, sync)
- [ ] **Plugin Registry** — Mapping of plugins to recommended MCPs
- [ ] **Configuration Generator** — Generates .mcp.json and CLAUDE.md from config
- [ ] **Validation Engine** — Validates MCP availability and configuration

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

## Implementation Guidance

### Phase 1: CLI Foundation (Current Focus)

Build the command-line interface:

**Core Commands:**
- `overture init [--type <project-type>]` — Initialize .overture/config.yaml with defaults
- `overture sync` — Install plugins + generate .mcp.json + generate CLAUDE.md
- `overture enable mcp <name>` — Enable a disabled MCP server
- `overture mcp list` — Show all configured MCPs and their status
- `overture validate` — Validate configuration schema and MCP availability

**Tech Stack:**
- TypeScript (Nx workspace already initialized)
- Commander.js for CLI
- Zod for schema validation
- js-yaml for YAML parsing
- Child process exec for `claude plugin install` commands

### Phase 2: Plugin Installer

Execute Claude CLI commands to install plugins:

```typescript
// plugin-installer.ts
export async function installPlugin(pluginName: string, marketplace: string): Promise<void> {
  const command = `claude plugin install ${pluginName}@${marketplace}`;
  await exec(command);
}

export async function syncPlugins(config: OvertureConfig): Promise<void> {
  for (const [name, plugin] of Object.entries(config.plugins)) {
    if (plugin.enabled) {
      await installPlugin(name, plugin.marketplace);
    }
  }
}
```

### Phase 3: Configuration Generators

Generate .mcp.json and CLAUDE.md from configuration:

```typescript
// mcp-json-generator.ts
export function generateMcpJson(config: OvertureConfig): McpJson {
  const mcpServers: Record<string, McpServerDef> = {};

  for (const [name, mcp] of Object.entries(config.mcp)) {
    if (mcp.scope === 'project' && mcp.enabled !== false) {
      mcpServers[name] = {
        command: mcp.command,
        args: mcp.args,
        env: mcp.env
      };
    }
  }

  return { mcpServers };
}

// claude-md-generator.ts
export function generateClaudeMd(config: OvertureConfig): string {
  // Generate plugin list
  // Generate MCP server lists (global vs project)
  // Generate plugin→MCP mappings
  // Preserve custom sections between markers
}
```

### Phase 4: Simple Validation

Basic validation for configuration and MCP availability:

```typescript
// validator.ts
export function validateConfig(config: OvertureConfig): ValidationResult {
  // Zod schema validation
  // Check plugins reference defined MCPs
  // Warn if MCP is referenced but not defined
}

export async function validateMcpCommand(mcp: McpServerConfig): Promise<boolean> {
  // Check if command exists on PATH using `which` or `where`
  const command = process.platform === 'win32' ? 'where' : 'which';
  try {
    await exec(`${command} ${mcp.command}`);
    return true;
  } catch {
    return false;
  }
}
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

### nx
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
