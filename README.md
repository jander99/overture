# Overture

> The missing orchestration layer between Claude Code plugins and MCP servers

## The Problem

Claude Code's ecosystem has two powerful but disconnected components:

**Plugins** provide specialized agents, skills, and commands:
- `python-development` adds Python experts
- `kubernetes-operations` adds k8s specialists
- `database-design` adds schema architects

**MCP Servers** provide tools and integrations:
- `python-repl` executes Python code
- `kubectl` manages k8s clusters
- `sqlite` queries databases

**But there's no connection between them.**

When you install `python-development`, there's no way for:
- The plugin to declare it needs `python-repl` MCP server
- Claude to know which MCP to use for plugin features
- The system to validate MCP servers are available
- Configuration to be project-aware (Java projects load Python MCPs unnecessarily)

## The Solution

Overture bridges plugins and MCP servers through configuration-driven orchestration.

```yaml
# .overture/config.yaml
project:
  name: my-api
  type: python-backend

# Plugins to install
plugins:
  python-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [python-repl, ruff, filesystem]

  database-design:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [sqlite, filesystem]

# MCP server configurations
mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    scope: project

  ruff:
    command: uvx
    args: [mcp-server-ruff]
    scope: project
```

```bash
overture sync
```

**Overture:**
1. Installs plugins via `claude plugin install <plugin>@<marketplace>`
2. Generates **`.mcp.json`** with project-scoped MCP servers
3. Generates **`CLAUDE.md`** with plugin↔MCP usage guidance

## How It Works

### 1. Initialize Project

```bash
overture init --type python-backend
# Creates .overture/config.yaml with starter configuration
```

### 2. Configure Plugins and MCPs

Edit `.overture/config.yaml` to declare your plugins and MCP servers:

```yaml
plugins:
  python-development:
    marketplace: claude-code-workflows
    mcps: [python-repl, ruff]

mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    scope: project
```

### 3. Sync Configuration

```bash
overture sync
```

This command:
- Installs missing plugins: `claude plugin install python-development@claude-code-workflows`
- Generates `.mcp.json` with project-scoped MCP servers
- Generates `CLAUDE.md` with plugin↔MCP mappings

### Other Commands

```bash
overture mcp list          # List all configured MCPs
overture enable mcp postgres   # Enable a disabled MCP
overture validate          # Validate configuration
```

## Generated Configuration

### `.mcp.json` (Project-scoped MCP servers)

```json
{
  "mcpServers": {
    "python-repl": {
      "command": "uvx",
      "args": ["mcp-server-python-repl"]
    },
    "sqlite": {
      "command": "uvx",
      "args": ["mcp-server-sqlite", "--db-path", "./dev.db"]
    }
  }
}
```

### `CLAUDE.md` (Usage guidance for Claude)

```markdown
## Active Plugins

- **python-development** (marketplace: claude-code-workflows)
- **database-design** (marketplace: claude-code-workflows)

## MCP Server Configuration

### Global MCP Servers
- filesystem
- context7
- memory

### Project MCP Servers
- **python-repl**
- **ruff**
- **sqlite**

## Plugin-to-MCP Mappings

### python-development
When using python-development, prefer these MCP servers:
- `python-repl` MCP
- `ruff` MCP
- `filesystem` MCP

### database-design
When using database-design, prefer these MCP servers:
- `sqlite` MCP
- `filesystem` MCP
```

**Claude reads CLAUDE.md and knows which MCPs to use for each plugin!**

## Key Features

### 🔗 Plugin-to-MCP Bridge
- Declare which MCPs each plugin uses in configuration
- Overture generates CLAUDE.md that tells Claude which tools to prefer
- Consistent tool selection across conversations

### 🎯 Project-Scoped Configuration
- Python projects load Python MCPs (python-repl, ruff)
- Java projects load Java MCPs (maven, jvm-tools)
- No unnecessary MCP servers in your project

### 🌍 Global + Project Scopes
- Global MCPs (filesystem, memory, context7) available everywhere
- Project MCPs only loaded for specific projects
- Reference global MCPs in config without redefining them

### 🤖 Automated Plugin Installation
- `overture sync` installs missing plugins via Claude CLI
- Ensures consistent environment across machines
- Just commit `.overture/config.yaml` to version control

### 📝 Generated Documentation
- CLAUDE.md guides Claude's MCP selection for each plugin
- Human-readable, version-controlled guidance
- Preserves custom edits in marked sections

### ✅ Simple Validation
- Schema validation for configuration
- Checks MCP commands exist on PATH
- Warns about undefined MCP references

## Configuration Structure

```
project/
├── .overture/
│   └── config.yaml           # Overture configuration
├── .mcp.json                 # Generated MCP config
├── CLAUDE.md                 # Generated guidance (preserved edits)
└── src/
```

Global configuration:
```
~/.config/overture/
└── config.yaml               # Global MCP servers and defaults
```

## Examples

See [docs/examples.md](docs/examples.md) for complete examples:
- Python FastAPI backend
- Java Spring Boot application
- React frontend
- Nx monorepo

## Configuration Schema

See [docs/overture-schema.md](docs/overture-schema.md) for complete schema documentation.

## Comparison

### Without Overture

**Manual Configuration:**
```bash
# Install plugin manually
/plugin install python-development

# Separately configure MCP servers in .mcp.json
vim .mcp.json  # Add python-repl, ruff, etc.

# No connection between plugins and MCPs
# Duplicate config across similar projects
# No guidance for Claude on which tools to use
```

**Claude's perspective:**
- ❌ Doesn't know which MCPs work best with which plugins
- ❌ No guidance on tool selection
- ❌ Must discover relationships through trial and error

### With Overture

**Configuration-Driven:**
```bash
# Edit .overture/config.yaml once
plugins:
  python-development:
    marketplace: claude-code-workflows
    mcps: [python-repl, ruff]

# Run sync
overture sync
# → Installs plugin via Claude CLI
# → Generates .mcp.json
# → Generates CLAUDE.md with usage guidance
```

**Claude's perspective:**
- ✅ Reads CLAUDE.md and knows which MCPs to use for each plugin
- ✅ Has explicit guidance: "When using python-development → use python-repl"
- ✅ Consistent tool selection based on project configuration
- ✅ Better user experience with appropriate tool choices

## Development Status

Overture is in active development:

- [x] Architecture design
- [x] Configuration schema
- [x] Documentation
- [ ] CLI implementation
- [ ] Plugin registry
- [ ] Configuration generator
- [ ] Validation engine

## Development Requirements

To develop Overture, configure these MCP servers:

- **sequentialthinking** — Complex problem-solving
- **filesystem** — File operations
- **context7** — Library documentation
- **memory** — Cross-conversation context
- **nx** — Monorepo management

See `CLAUDE.md` for detailed MCP usage guidance.

## Related Projects

- [wshobson/agents](https://github.com/wshobson/agents) — Comprehensive Claude plugin marketplace
- [obra/superpowers](https://github.com/obra/superpowers) — Claude skills library
- [adestefa/ccmem](https://github.com/adestefa/ccmem) — Persistent memory MCP server

See [docs/related-projects.md](docs/related-projects.md) for detailed analysis.

## License

MIT

## Contributing

Contributions welcome! This project demonstrates the need for plugin-to-MCP orchestration in the Claude Code ecosystem.
