# Related Projects

Projects in the Claude Code and MCP server ecosystem that relate to Overture.

---

## Claude Code Plugins & Skills

### Claude Code Workflows (wshobson/agents)
**Repository**: https://github.com/wshobson/agents
**Type**: Plugin Marketplace

Production-ready marketplace with 64 plugins, 87 agents, 47 skills across 23 categories.

**Relationship to Overture**: Overture enables plugins from this marketplace to declare MCP dependencies and validates they're available.

---

### Superpowers (obra/superpowers)
**Repository**: https://github.com/obra/superpowers
**Type**: Skills Library

Comprehensive skill library for testing, debugging, collaboration, and development workflows.

**Relationship to Overture**: Overture can manage MCP dependencies for skills, ensuring required tools are available.

---

## Execution Orchestrators

### Claude Code Flow (ruvnet/claude-code-flow)
**Repository**: https://github.com/ruvnet/claude-code-flow
**Type**: Multi-Agent Execution Orchestrator

Coordinates multiple Claude agents in complex workflows with state management and task delegation.

**Relationship to Overture**: Complementary - Overture configures (static), Flow executes (runtime).

---

### Claude Squad (smtg-ai/claude-squad)
**Repository**: https://github.com/smtg-ai/claude-squad
**Type**: Multi-Agent Coordinator

Runtime coordination for agent collaboration and task distribution.

**Relationship to Overture**: Orthogonal - different problem space (runtime coordination vs configuration management).

---

## MCP Servers

### CCMem (adestefa/ccmem)
**Repository**: https://github.com/adestefa/ccmem
**Type**: Persistent Memory MCP Server

Cross-session memory for Claude Code with knowledge graph storage.

**Relationship to Overture**: Example of project-specific MCP that Overture would configure and manage.

---

## Comparison: What Each Project Does

| Project | Focus | Scope |
|---------|-------|-------|
| **wshobson/agents** | Plugin marketplace | 64 plugins for development |
| **obra/superpowers** | Skills library | Testing, debugging, workflows |
| **ruvnet/claude-code-flow** | Multi-agent execution | Runtime orchestration |
| **smtg-ai/claude-squad** | Agent coordination | Runtime collaboration |
| **adestefa/ccmem** | Persistent memory | Cross-session context |
| **Overture** | Configuration orchestration | MCP management across clients |

---

## How Overture Fits In

**Overture is configuration infrastructure** - it ensures plugins and agents have the right tools (MCPs) available.

- **Before Overture**: Install plugin → manually configure MCPs → hope they work together
- **With Overture**: Declare plugin and MCP requirements → Overture ensures everything is connected

**Complementary Stack:**
```
├── Plugins/Skills (agents, superpowers)    ← What Claude can do
├── Execution (flow, squad)                 ← How Claude executes
├── Tools (MCP servers: ccmem, github, etc) ← What tools are available
└── Configuration (Overture)                ← Ensures plugins have their tools
```

---

## Additional Resources

- **MCP Servers Registry**: https://github.com/modelcontextprotocol/servers
- **Claude Code Documentation**: https://docs.claude.com/en/docs/claude-code
- **Plugin Development**: https://github.com/wshobson/agents/blob/main/docs/plugin-builder-how-to.md

---

*Last updated: 2025-01-15 (v0.2.5)*
