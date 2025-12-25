# Agent Client Protocol (ACP) Integration Analysis for Overture

**Date:** January 23, 2025  
**Status:** Research Complete  
**Priority:** Low (Monitor for future consideration)  
**Relevance to Overture:** Complementary Technology (not direct integration)

---

## Executive Summary

The **Agent Client Protocol (ACP)** is a standardization effort by Zed Industries and JetBrains to enable interoperability between AI coding agents (like Claude Code, Gemini CLI, OpenCode) and code editors/IDEs (like Zed, JetBrains, Neovim).

**Key Finding:** ACP and MCP are **complementary, not competing** protocols that operate at different layers:

- **MCP** = Tools & Data access (agent → external services)
- **ACP** = Agent ↔ Editor communication (UI/UX layer)

**Overture's Role:** ACP doesn't directly conflict with or replace Overture's mission. However, ACP's **MCP server configuration passthrough** mechanism creates an indirect integration opportunity where Overture-managed MCP configs could flow through ACP-compatible editors to ACP-compatible agents.

---

## What is Agent Client Protocol (ACP)?

### Overview

ACP is a JSON-RPC 2.0 based protocol that standardizes communication between:

- **Clients (Editors/IDEs):** Zed, JetBrains, Neovim, Emacs, Obsidian
- **Agents (AI Coding Assistants):** Claude Code, OpenCode, Gemini CLI, Goose, Codex CLI, and 17+ others

### Problem It Solves

Similar to how LSP (Language Server Protocol) standardized language server integration, ACP standardizes agent-editor integration:

- **Before ACP:** Each agent needed custom integrations for each editor
- **After ACP:** Agents implementing ACP work with any ACP-compatible editor

### Design Principles

1. **MCP-Friendly:** Reuses MCP types and JSON-RPC patterns where possible
2. **UX-First:** Designed for rich agent interaction UX (diffs, tool calls, plans, terminals)
3. **Trusted Environment:** Assumes trusted agents with controlled tool access

### Transport

- Primary transport: **stdio** (agent runs as subprocess of editor)
- Communication: Bidirectional JSON-RPC 2.0 over stdin/stdout
- Support for concurrent sessions within a single agent connection

---

## Key Concepts & Architecture

### Communication Flow

```
┌─────────────┐     ACP (JSON-RPC)     ┌─────────────┐
│   Editor    │ ◄─────────────────────► │    Agent    │
│  (Client)   │     stdio transport     │  (Server)   │
└─────────────┘                         └─────────────┘
                                               │
                                               │ MCP (JSON-RPC)
                                               ▼
                                        ┌─────────────┐
                                        │ MCP Servers │
                                        └─────────────┘
```

### Core Protocol Components

| Component          | Description                                               |
| ------------------ | --------------------------------------------------------- |
| **Initialization** | Version negotiation, capability exchange                  |
| **Session Setup**  | Create/load conversation sessions with MCP server configs |
| **Prompt Turn**    | User message → Agent processing → Response streaming      |
| **Tool Calls**     | Agent reports tool execution, requests permissions        |
| **File System**    | Client-provided file read/write capabilities              |
| **Terminals**      | Client-provided terminal execution                        |
| **Agent Plans**    | Task planning and progress reporting                      |
| **Session Modes**  | Switch agent operating modes                              |
| **Slash Commands** | Agent-advertised commands                                 |

### MCP Integration in ACP

**Critical insight:** ACP includes MCP server configuration as part of session setup:

```json
{
  "jsonrpc": "2.0",
  "method": "session/new",
  "params": {
    "cwd": "/home/user/project",
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "/path/to/mcp-server",
        "args": ["--stdio"],
        "env": [{ "name": "API_KEY", "value": "secret123" }]
      }
    ]
  }
}
```

**Transport support for MCP within ACP:**

- **stdio:** Required for all agents
- **HTTP:** Optional capability (`mcpCapabilities.http`)
- **SSE:** Optional, deprecated in MCP spec

---

## ACP vs MCP Comparison

| Aspect            | MCP                                                | ACP                                             |
| ----------------- | -------------------------------------------------- | ----------------------------------------------- |
| **Purpose**       | Connect AI to tools/data sources                   | Connect agents to editors                       |
| **Relationship**  | Tool provider → Agent                              | Agent ↔ Editor UI                               |
| **Protocol**      | JSON-RPC 2.0                                       | JSON-RPC 2.0                                    |
| **Transport**     | stdio, HTTP, SSE                                   | stdio (HTTP draft)                              |
| **Session Model** | Stateless tool invocation                          | Stateful conversation sessions                  |
| **Configuration** | Per-client config files                            | Passed from client at session creation          |
| **Scope**         | External capabilities (filesystem, memory, GitHub) | UX interactions (diffs, terminals, permissions) |

### Complementary Relationship

```
┌──────────────────────────────────────────────────────────────┐
│                        User Workflow                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────┐     ACP      ┌──────────┐     MCP     ┌─────┐│
│   │  Editor  │────────────►│  Agent   │────────────►│Tools││
│   │  (Zed)   │◄────────────│(Claude)  │◄────────────│     ││
│   └──────────┘             └──────────┘             └─────┘│
│        │                                                     │
│        │ reads configs from                                  │
│        ▼                                                     │
│   ┌──────────┐                                               │
│   │ Overture │ ◄── Single source of truth for MCP configs   │
│   │ configs  │                                               │
│   └──────────┘                                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Key Insight:** MCP and ACP operate at different layers:

- **MCP:** Agent ↔ External Tools (what tools the agent can use)
- **ACP:** Editor ↔ Agent (how the agent communicates with the user)

---

## Ecosystem Adoption

### ACP-Compatible Agents (17+)

| Agent               | Notes                 |
| ------------------- | --------------------- |
| **Claude Code**     | Via Zed's SDK adapter |
| **OpenCode**        | Native support        |
| **Gemini CLI**      | Native support        |
| **Codex CLI**       | Via Zed's adapter     |
| **Goose**           | Block's agent         |
| **Augment Code**    | Native support        |
| **JetBrains Junie** | Coming soon           |
| **Kimi CLI**        | Moonshot AI           |
| **Mistral Vibe**    | Mistral AI            |
| **OpenHands**       | Community agent       |
| **Qwen Code**       | Alibaba               |

### ACP-Compatible Clients (15+)

| Client        | Notes                                  |
| ------------- | -------------------------------------- |
| **Zed**       | Primary sponsor                        |
| **JetBrains** | Primary sponsor                        |
| **Neovim**    | Via CodeCompanion, avante.nvim plugins |
| **Emacs**     | Via agent-shell.el                     |
| **Obsidian**  | Via Agent Client plugin                |
| **marimo**    | Python notebook                        |
| **DuckDB**    | Via extension                          |

---

## Integration Opportunities for Overture

### Analysis: Where Does Overture Fit?

Overture currently orchestrates **MCP server configurations** for:

- Claude Code (`.mcp.json`, `~/.claude.json`)
- GitHub Copilot CLI (`~/.copilot/mcp-config.json`)
- OpenCode (`opencode.json`, `~/.config/opencode/opencode.json`)

ACP introduces a **new configuration flow**:

1. Editor reads MCP configs from somewhere (its own settings or config files)
2. Editor passes MCP server configs to Agent via ACP `session/new`
3. Agent connects to MCP servers

**Question:** Where do editors get their MCP configs from?

---

### Integration Opportunity 1: ACP-Compatible Client Adapters

**Concept:** Add Overture adapters for ACP-compatible editors (Zed, JetBrains)

**Current State:**

- Zed reads MCP configs from `~/.config/zed/settings.json` (mcp_servers section)
- JetBrains reads from IDE-specific settings

**Overture Opportunity:**

```yaml
# Extended config.yaml
version: '1.0'

mcp:
  filesystem:
    command: 'npx'
    args: ['-y', '@modelcontextprotocol/server-filesystem']

# New: Sync to ACP-compatible editors
acp_clients:
  zed:
    enabled: true
    config_path: ~/.config/zed/settings.json
  jetbrains:
    enabled: true
    config_path: ~/.config/JetBrains/IntelliJIdea2024.2/options/
```

**Value:** Single source of truth extends to ACP-compatible editors

**Priority:** Medium - Requires research into Zed/JetBrains config formats

---

### Integration Opportunity 2: Document ACP in CLAUDE.md

**Concept:** When generating project documentation, note ACP compatibility

```markdown
# MCP Configuration (CLAUDE.md)

## Available MCP Servers

This project uses the following MCP servers (managed by Overture):

- **filesystem**: File system access
- **memory**: Persistent knowledge graph

## ACP Compatibility

These MCP servers are configured for:

- Direct use by Claude Code, OpenCode (native MCP support)
- Passthrough via ACP-compatible editors (Zed, JetBrains)
  when using ACP agents like Gemini CLI or Goose
```

**Value:** Educates users about ACP as complementary technology

**Priority:** Low - Documentation enhancement only

---

### Integration Opportunity 3: ACP Agent Detection in `overture doctor`

**Concept:** Detect installed ACP-compatible agents in diagnostics

```bash
$ overture doctor

ACP-Compatible Agents:
✓ Claude Code (via claude-code-acp adapter)
✓ OpenCode (native ACP support)
✓ Gemini CLI (native ACP support)
⚠ Goose (ACP support available, not detected)

ACP-Compatible Editors:
✓ Zed (v0.170.0) - MCP config at ~/.config/zed/settings.json
⚠ JetBrains - Requires manual MCP configuration

Recommendations:
- Consider syncing MCP configs to Zed for use with ACP agents
```

**Value:** Helps users understand their ACP/MCP ecosystem

**Priority:** Low - Nice-to-have diagnostic feature

---

### Integration Opportunity 4: MCP→ACP Config Transformer

**Concept:** Generate ACP-compatible MCP server stanzas from Overture configs

**ACP MCP Server Format (different from client configs):**

```json
{
  "mcpServers": [
    {
      "name": "filesystem",
      "command": "/absolute/path/to/npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": [{ "name": "HOME", "value": "/home/user" }]
    }
  ]
}
```

**Differences from Claude Code format:**

- `env` is array of `{name, value}` objects, not a plain object
- `command` typically needs absolute path

**Value:** Enables Overture to generate configs for Zed's MCP settings

**Priority:** Medium - Useful for Zed integration

---

### Integration Opportunity 5: ACP Agent Registry Knowledge

**Concept:** Maintain knowledge of which agents support ACP

```yaml
# Internal registry (for doctor command, documentation)
agents:
  claude-code:
    acp_support: true
    acp_native: false # requires adapter
    mcp_support: true
  opencode:
    acp_support: true
    acp_native: true
    mcp_support: true
  gemini-cli:
    acp_support: true
    acp_native: true
    mcp_support: true
```

**Value:** Helps users choose tools, enhances diagnostics

**Priority:** Low - Internal knowledge base

---

## What ACP Does NOT Change for Overture

1. **MCP Config Format:** Overture's core mission (generating `.mcp.json`, `opencode.json`, etc.) remains unchanged

2. **Direct Agent Support:** Claude Code, OpenCode, GitHub Copilot CLI still read their own config files - ACP doesn't change this

3. **Project Config Pattern:** `.overture/config.yaml` → client configs is still the right model

4. **Skills Integration:** Agent Skills research remains valid and complementary

---

## Technical Considerations

### Dependencies (if implementing ACP support)

| Dependency                 | Purpose                 | Status                |
| -------------------------- | ----------------------- | --------------------- |
| `@agentclientprotocol/sdk` | TypeScript ACP types    | npm package available |
| Zed settings parser        | Read/write Zed config   | Custom implementation |
| JetBrains config parser    | Read/write IDE settings | Complex, XML-based    |

### Challenges

1. **Config Location Variance:** Each ACP client stores MCP configs differently
2. **Format Differences:** ACP's MCP server format differs from client-native formats
3. **Dynamic vs Static:** ACP passes MCP configs at session start; Overture generates static files
4. **Editor Focus:** ACP is primarily for editor integration, not CLI tools

---

## Recommended Next Steps

### Phase 1: Monitor & Document (Immediate)

1. **Add ACP to related-projects.md** - Document as complementary technology
2. **Update roadmap** - Note ACP as future consideration for editor integrations
3. **No code changes needed** - ACP doesn't impact current functionality

### Phase 2: Zed Adapter (v0.5.0, if demand exists)

1. Research Zed's `settings.json` MCP configuration format
2. Implement Zed client adapter in `libs/adapters/client-adapters/`
3. Add Zed to `overture sync` target clients
4. Test with ACP agents (Gemini CLI, Goose)

### Phase 3: JetBrains Adapter (v0.6.0+)

1. Research JetBrains AI Assistant MCP configuration
2. Implement adapter (likely complex due to XML settings)
3. Add to supported clients

---

## Key Decision Points

### Decision 1: Should Overture support ACP-compatible editors?

**Recommendation:** ⚠️ **Monitor, don't prioritize**

- ACP is valuable for editor integration, but Overture's core users are CLI-focused
- Zed adoption is growing but still niche compared to VS Code
- Wait for user demand before implementing

### Decision 2: Should Overture become an ACP client or agent?

**Recommendation:** ❌ **No**

- Overture is a configuration tool, not an AI agent or editor
- No value in implementing ACP client/agent interfaces

### Decision 3: Should Overture-generated configs work with ACP?

**Recommendation:** ✅ **Yes, inherently**

- Overture-generated configs for Claude Code and OpenCode already work
- These agents can be used via ACP (with adapters) without changes
- No Overture modifications required

---

## Conclusion

**ACP and Overture serve different purposes:**

| Aspect      | ACP                                 | Overture                               |
| ----------- | ----------------------------------- | -------------------------------------- |
| **Purpose** | Agent ↔ Editor communication        | MCP config orchestration               |
| **Scope**   | Protocol specification              | Configuration tool                     |
| **Users**   | Editor developers, agent developers | AI power users, developers             |
| **Overlap** | MCP server configs passed via ACP   | MCP server configs generated from YAML |

**Bottom Line:** ACP is a valuable protocol that enhances the AI coding ecosystem, but it doesn't create urgent integration needs for Overture. The main opportunity is extending Overture to support ACP-compatible **editors** (Zed, JetBrains) as additional sync targets, which would be a natural extension of the existing multi-platform sync architecture.

**Current Recommendation:** Document ACP as a related technology, monitor adoption, and consider Zed adapter in v0.5.0 if user demand materializes.

---

## Resources

- **ACP Specification:** https://agentclientprotocol.com
- **ACP GitHub:** https://github.com/agentclientprotocol/agent-client-protocol
- **TypeScript SDK:** https://www.npmjs.com/package/@agentclientprotocol/sdk
- **Supported Agents:** https://agentclientprotocol.com/overview/agents
- **Supported Clients:** https://agentclientprotocol.com/overview/clients
- **Protocol Schema:** https://agentclientprotocol.com/protocol/schema
- **Zed Industries:** https://zed.dev
- **JetBrains ACP Docs:** https://www.jetbrains.com/help/ai-assistant/acp.html
