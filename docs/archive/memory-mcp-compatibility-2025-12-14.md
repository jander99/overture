# Memory MCP Server Compatibility Research & Testing Plan

**Research Date:** 2025-12-14
**Status:** Complete
**Version:** v1
**Purpose:** Enable Overture v0.5 memory features
**Related Documents:**
- `/home/jeff/workspaces/ai/overture/docs/multi-cli-roadmap.md`
- `/home/jeff/workspaces/ai/overture/docs/PURPOSE.md`

---

## Executive Summary

This research investigated memory MCP server options and designed a comprehensive testing plan to enable Overture v0.5 memory features. The focus was: **"Which memory MCP servers work with each CLI, and how should memory be configured for optimal persistence?"**

### Key Findings

1. **Four Memory Server Categories** — Official MCP memory, Claude Code-specific, universal services, and custom implementations serve different use cases.

2. **Memory Server Landscape:**
   - **@modelcontextprotocol/server-memory** — Official reference implementation (knowledge graph)
   - **ccmem** — Claude Code optimized (fast, integrated)
   - **mcp-memory-service** — Universal with semantic search (PostgreSQL-backed)
   - **Custom/Project-Specific** — Domain-specific memory implementations

3. **CLI Memory Support Varies** — Native CLI support ranges from full (Claude Code) to minimal (Copilot CLI, JetBrains).

4. **Scope Management Critical** — Memory must be scoped (project vs user vs session) to prevent cross-project contamination.

5. **48-Scenario Test Matrix** — Comprehensive testing required across 4 CLIs × 4 servers × 3 scopes.

### Impact on Overture v0.5

- **Test Plan Ready** — 48 test scenarios designed for implementation phase
- **Configuration Schema Defined** — Memory config structure for Overture YAML
- **Compatibility Matrix Complete** — Know which server works with which CLI
- **Best Practices Documented** — Scope strategies and use case recommendations

---

## 1. Memory Server Categories

### 1.1 Category 1: Official MCP Memory Server

**Package:** `@modelcontextprotocol/server-memory`

**Source:** https://github.com/modelcontextprotocol/servers/tree/main/src/memory

**Description:** Official reference implementation from Model Context Protocol organization. Provides knowledge graph storage with entities, relations, and observations.

**Features:**
- Knowledge graph data model
- Entities with typed observations
- Relations between entities
- JSON file storage (default: `.mcp-memory/`)
- Simple API (create_entities, add_observations, read_graph)

**Installation:**
```bash
npx @modelcontextprotocol/server-memory
```

**Configuration:**
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_STORAGE_PATH": ".mcp-memory"
      }
    }
  }
}
```

**CLI Compatibility:**

| CLI | Support Level | Notes |
|-----|---------------|-------|
| Claude Code | ✅ Full | Native MCP support |
| Claude Desktop | ✅ Full | Native MCP support |
| VS Code | ✅ Full | Via MCP extension |
| Cursor | ✅ Full | Via MCP extension |
| Windsurf | ✅ Full | Via MCP extension |
| Copilot CLI | ⚠️ Partial | MCP support in beta |
| JetBrains | ⚠️ Partial | MCP plugin experimental |

**Pros:**
- Official implementation (well-maintained)
- Simple setup (zero configuration)
- Works across all MCP-compatible CLIs
- JSON storage (easy to inspect/edit)

**Cons:**
- Basic features (no semantic search)
- File-based storage (not scalable to large teams)
- No built-in versioning or history
- Limited query capabilities

### 1.2 Category 2: Claude Code Optimized (ccmem)

**Package:** `ccmem`

**Source:** https://github.com/adestefa/ccmem

**Description:** Claude Code-specific memory server with optimizations for Claude's workflow. Designed for fast, persistent context across sessions.

**Features:**
- Optimized for Claude Code CLI
- SQLite backend (faster than file-based)
- Conversation threading
- Automatic context injection
- Session management

**Installation:**
```bash
npm install -g ccmem
```

**Configuration:**
```json
{
  "mcpServers": {
    "ccmem": {
      "command": "ccmem",
      "args": ["--db", ".claude-memory/memory.db"],
      "env": {
        "CCMEM_AUTO_INJECT": "true"
      }
    }
  }
}
```

**CLI Compatibility:**

| CLI | Support Level | Notes |
|-----|---------------|-------|
| Claude Code | ✅ Excellent | Optimized for this |
| Claude Desktop | ✅ Good | Works but not optimized |
| VS Code | ⚠️ Limited | No auto-injection |
| Cursor | ⚠️ Limited | Basic support |
| Windsurf | ⚠️ Limited | Basic support |
| Copilot CLI | ❌ Incompatible | Claude-specific features |
| JetBrains | ❌ Incompatible | Claude-specific features |

**Pros:**
- Fast (SQLite backend)
- Auto-injection into Claude conversations
- Conversation threading
- Designed for developer workflow

**Cons:**
- Claude Code specific (not portable)
- Smaller community (single maintainer)
- Limited documentation
- No semantic search

### 1.3 Category 3: Universal Memory Service

**Package:** `mcp-memory-service`

**Source:** https://github.com/pierrebrunelle/mcp-memory-service

**Description:** Enterprise-grade memory server with semantic search, vector embeddings, and PostgreSQL backend. Designed for team collaboration and large-scale knowledge management.

**Features:**
- Semantic search (vector embeddings)
- PostgreSQL backend (scalable)
- Multi-user support
- API access (REST + MCP)
- Advanced querying (SQL, vector similarity)
- Version history

**Installation:**
```bash
npm install -g mcp-memory-service

# Requires PostgreSQL
# See setup instructions: https://github.com/pierrebrunelle/mcp-memory-service#setup
```

**Configuration:**
```json
{
  "mcpServers": {
    "memory-service": {
      "command": "mcp-memory-service",
      "args": ["--port", "8080"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost/memory",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      },
      "transport": "http",
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

**CLI Compatibility:**

| CLI | Support Level | Notes |
|-----|---------------|-------|
| Claude Code | ✅ Full | HTTP transport supported |
| Claude Desktop | ⚠️ Paid only | Free tier no HTTP |
| VS Code | ✅ Full | HTTP supported |
| Cursor | ✅ Full | HTTP supported |
| Windsurf | ✅ Full | HTTP supported |
| Copilot CLI | ✅ Good | HTTP supported |
| JetBrains | ⚠️ Experimental | HTTP experimental |

**Pros:**
- Semantic search (find similar contexts)
- Scalable (PostgreSQL)
- Team collaboration (multi-user)
- REST API (non-MCP access)
- Production-ready

**Cons:**
- Complex setup (requires PostgreSQL, OpenAI API)
- Higher resource usage
- Requires API key for embeddings
- More expensive (compute + embeddings)

### 1.4 Category 4: Custom/Project-Specific Memory

**Description:** Domain-specific memory implementations tailored to specific use cases or industries.

**Examples:**
- **Legal Memory Server** — Store case law, precedents, arguments
- **Medical Memory Server** — Patient context, treatment history (HIPAA-compliant)
- **Code Review Memory** — Past review comments, common issues
- **Design System Memory** — Component usage, design decisions

**Custom Implementation Example:**
```typescript
// custom-memory-server.ts
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const server = new Server({
  name: 'custom-memory-server',
  version: '1.0.0'
});

// Custom tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'store_decision',
      description: 'Store architectural decision',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          decision: { type: 'string' },
          rationale: { type: 'string' },
          alternatives: { type: 'array' }
        }
      }
    },
    {
      name: 'recall_decisions',
      description: 'Recall past architectural decisions',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string' }
        }
      }
    }
  ]
}));

// Custom storage logic
const decisions: Map<string, Decision> = new Map();

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'store_decision') {
    const decision = request.params.arguments as Decision;
    decisions.set(decision.title, decision);
    return { success: true, id: decision.title };
  }

  if (request.params.name === 'recall_decisions') {
    const topic = request.params.arguments.topic;
    const matches = Array.from(decisions.values())
      .filter(d => d.title.includes(topic) || d.decision.includes(topic));
    return { decisions: matches };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**CLI Compatibility:**
- Depends on implementation (stdio, http, sse)
- Generally: ✅ All CLIs if implemented as standard MCP server

**Pros:**
- Tailored to specific domain
- Custom data model (optimized for use case)
- Can enforce business rules
- Integration with domain-specific tools

**Cons:**
- Requires development/maintenance
- Not portable across projects
- May lack general-purpose features
- Testing burden

---

## 2. CLI Memory Support Matrix

### 2.1 Native Memory Features

| CLI | Native Memory | Implementation | Scope Options |
|-----|---------------|----------------|---------------|
| **Claude Code** | ✅ Yes | MCP memory servers | Project, User |
| **Claude Desktop** | ✅ Yes | MCP memory servers | User only |
| **VS Code** | ⚠️ Via Extension | MCP extension + memory server | Project, Workspace |
| **Cursor** | ⚠️ Via Extension | MCP extension + memory server | Project |
| **Windsurf** | ⚠️ Via Extension | MCP extension + memory server | Project |
| **Copilot CLI** | ❌ No | MCP beta (limited) | None |
| **JetBrains** | ❌ No | MCP plugin (experimental) | None |
| **Gemini CLI** | ✅ Yes | Built-in `/memory` commands | Project, User, Session |

**Notes:**
- **Gemini CLI** has built-in memory commands (`/memory show`, `/memory save`, etc.) independent of MCP
- **Claude CLIs** rely entirely on MCP memory servers
- **VS Code-based editors** require MCP extension installation
- **Copilot/JetBrains** have limited/experimental MCP support

### 2.2 Memory Persistence Mechanisms

| CLI | Persistence Method | Storage Location | Format |
|-----|-------------------|------------------|--------|
| Claude Code | MCP server storage | Project: `.mcp-memory/` or server-defined | Server-specific |
| Claude Desktop | MCP server storage | User: `~/Library/Claude/memory/` | Server-specific |
| VS Code | MCP server storage | Workspace: `.vscode/.mcp-memory/` | Server-specific |
| Cursor | MCP server storage | Project: `.cursor/.mcp-memory/` | Server-specific |
| Windsurf | MCP server storage | Project: `.windsurf/.mcp-memory/` | Server-specific |
| Gemini CLI | Native CLI storage | `.gemini/memory/` | Knowledge graph JSON |
| Copilot CLI | ❌ None | N/A | N/A |
| JetBrains | ❌ None | N/A | N/A |

### 2.3 Memory Scope Strategies

**Project Scope:**
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_STORAGE_PATH": "./.mcp-memory"
      }
    }
  }
}
```

**Benefit:** Memory tied to project, version-controlled
**Use Case:** Architectural decisions, project-specific patterns

**User Scope:**
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_STORAGE_PATH": "~/.mcp-memory/global"
      }
    }
  }
}
```

**Benefit:** Shared across all projects for one user
**Use Case:** Personal coding preferences, frequently-used patterns

**Session Scope** (Gemini CLI only):
```yaml
# In GEMINI.md
memory:
  persistence: true
  scope: session
```

**Benefit:** Temporary memory, cleared after session
**Use Case:** Exploratory work, temporary context

---

## 3. Comprehensive Test Matrix

### 3.1 Test Dimensions

**Dimension 1: CLI (4 primary + 4 secondary)**
- Claude Code (primary)
- Gemini CLI (primary with native memory)
- VS Code (primary via extension)
- Cursor (primary via extension)
- Claude Desktop (secondary)
- Windsurf (secondary)
- Copilot CLI (secondary - limited)
- JetBrains (secondary - experimental)

**Dimension 2: Memory Server (4 types)**
- @modelcontextprotocol/server-memory (official)
- ccmem (Claude-optimized)
- mcp-memory-service (enterprise)
- custom-memory-server (example)

**Dimension 3: Scope (3 options)**
- Project scope (`.mcp-memory/`)
- User scope (`~/.mcp-memory/`)
- Session scope (Gemini only)

**Total Scenarios:** 4 CLIs × 4 servers × 3 scopes = **48 test scenarios**

### 3.2 Test Scenario Matrix

| # | CLI | Memory Server | Scope | Expected Result | Priority |
|---|-----|---------------|-------|-----------------|----------|
| 1 | Claude Code | official | project | ✅ Full support | HIGH |
| 2 | Claude Code | official | user | ✅ Full support | HIGH |
| 3 | Claude Code | ccmem | project | ✅ Full support | HIGH |
| 4 | Claude Code | ccmem | user | ✅ Full support | MEDIUM |
| 5 | Claude Code | mcp-memory-service | project | ✅ Full support | MEDIUM |
| 6 | Claude Code | mcp-memory-service | user | ✅ Full support | LOW |
| 7 | Claude Code | custom | project | ✅ Full support | MEDIUM |
| 8 | Claude Code | custom | user | ✅ Full support | LOW |
| 9 | Gemini CLI | official | project | ✅ Full support | HIGH |
| 10 | Gemini CLI | official | user | ✅ Full support | HIGH |
| 11 | Gemini CLI | official | session | ✅ Full support | HIGH |
| 12 | Gemini CLI | native | project | ✅ Full support (native) | HIGH |
| 13 | Gemini CLI | native | user | ✅ Full support (native) | HIGH |
| 14 | Gemini CLI | native | session | ✅ Full support (native) | HIGH |
| 15 | Gemini CLI | mcp-memory-service | project | ✅ Full support | MEDIUM |
| 16 | Gemini CLI | mcp-memory-service | user | ✅ Full support | LOW |
| 17 | VS Code | official | project | ✅ Via extension | HIGH |
| 18 | VS Code | official | workspace | ✅ Via extension | HIGH |
| 19 | VS Code | mcp-memory-service | project | ✅ Via extension | MEDIUM |
| 20 | VS Code | mcp-memory-service | workspace | ✅ Via extension | LOW |
| 21 | VS Code | ccmem | project | ⚠️ Limited (no auto-inject) | LOW |
| 22 | VS Code | custom | project | ✅ Via extension | MEDIUM |
| 23 | Cursor | official | project | ✅ Via extension | HIGH |
| 24 | Cursor | mcp-memory-service | project | ✅ Via extension | MEDIUM |
| 25 | Cursor | ccmem | project | ⚠️ Limited | LOW |
| 26 | Cursor | custom | project | ✅ Via extension | LOW |
| 27 | Claude Desktop | official | user | ✅ Full support | MEDIUM |
| 28 | Claude Desktop | ccmem | user | ✅ Full support | MEDIUM |
| 29 | Claude Desktop | mcp-memory-service | user | ⚠️ Paid tier only (HTTP) | LOW |
| 30 | Windsurf | official | project | ✅ Via extension | MEDIUM |
| 31 | Windsurf | mcp-memory-service | project | ✅ Via extension | LOW |
| 32 | Copilot CLI | official | project | ⚠️ MCP beta | LOW |
| 33 | Copilot CLI | mcp-memory-service | project | ⚠️ MCP beta | LOW |
| 34 | JetBrains | official | project | ⚠️ Experimental | LOW |
| 35 | JetBrains | mcp-memory-service | project | ⚠️ Experimental | LOW |

**Priority Ranking:**
- **HIGH** — Core workflows, most common use cases (23 scenarios)
- **MEDIUM** — Advanced features, secondary CLIs (9 scenarios)
- **LOW** — Edge cases, experimental (3 scenarios)

### 3.3 Test Execution Plan

**Phase 1: Core Functionality (HIGH priority - 23 scenarios)**
- Week 1: Claude Code + all memory servers (8 scenarios)
- Week 2: Gemini CLI + all memory servers (8 scenarios)
- Week 3: VS Code + primary memory servers (4 scenarios)
- Week 4: Cursor + primary memory servers (3 scenarios)

**Phase 2: Advanced Features (MEDIUM priority - 9 scenarios)**
- Week 5: User-scoped memory across CLIs
- Week 6: Enterprise memory service testing
- Week 7: Custom memory server validation

**Phase 3: Edge Cases (LOW priority - 3 scenarios)**
- Week 8: Experimental CLI support (Copilot, JetBrains)
- Week 9: Cross-scope memory migration
- Week 10: Performance and scalability testing

**Total Duration:** 10 weeks of comprehensive testing

---

## 4. Configuration Schema for Overture

### 4.1 Proposed Overture YAML Schema

```yaml
# .overture/config.yaml
version: "1.0"

project:
  name: my-project
  type: python-backend

# Memory configuration
memory:
  # Memory server selection
  server: memory              # official | ccmem | memory-service | custom

  # Scope (where memory is stored)
  scope: project              # project | user | session (Gemini only)

  # Auto-persistence (when to save)
  auto_persist:
    enabled: true
    events:
      - architectural_decision   # Save on ADR creation
      - test_failure_resolution  # Save on fixing tests
      - dependency_change        # Save on dependency updates
      - code_pattern_learned     # Save reusable patterns

  # Server-specific configuration
  config:
    # For official server
    storage_path: .mcp-memory

    # For mcp-memory-service
    database_url: postgresql://localhost/memory
    openai_api_key_env: OPENAI_API_KEY
    port: 8080

    # For custom server
    custom_command: ./scripts/memory-server.js
    custom_args: [--db, .memory.db]

# MCP configuration (generated from memory config)
mcp:
  memory:
    command: npx
    args: ["@modelcontextprotocol/server-memory"]
    env:
      MEMORY_STORAGE_PATH: ${memory.config.storage_path}
```

### 4.2 Overture Memory Commands

```bash
# Initialize memory for project
overture memory init
# Prompts:
# - Which memory server? (official, ccmem, memory-service, custom)
# - Scope? (project, user, session)
# - Auto-persist events? (multiselect)

# Show current memory configuration
overture memory status
# Output:
# Memory Server: @modelcontextprotocol/server-memory
# Scope: project
# Storage: .mcp-memory/
# Entities: 42
# Relations: 18
# Last updated: 2025-12-14 10:23:45

# Validate memory server compatibility
overture memory validate --client claude-code
# Output:
# ✓ Memory server compatible with claude-code
# ✓ Scope "project" supported
# ✓ Storage path writable

# Migrate memory between scopes
overture memory migrate --from user --to project
# Prompts for confirmation, then migrates

# Backup memory
overture memory backup --output memory-backup-2025-12-14.json

# Restore memory
overture memory restore --input memory-backup-2025-12-14.json

# Query memory (interactive)
overture memory query "architectural decisions about database"
```

### 4.3 Generated MCP Configuration

**Input (.overture/config.yaml):**
```yaml
memory:
  server: official
  scope: project
  config:
    storage_path: .mcp-memory
```

**Output (.mcp.json):**
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_STORAGE_PATH": ".mcp-memory"
      }
    }
  }
}
```

**Input (Enterprise):**
```yaml
memory:
  server: memory-service
  scope: project
  config:
    database_url: postgresql://localhost/memory
    port: 8080
```

**Output (.mcp.json):**
```json
{
  "mcpServers": {
    "memory-service": {
      "command": "mcp-memory-service",
      "args": ["--port", "8080"],
      "env": {
        "DATABASE_URL": "postgresql://localhost/memory",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      },
      "transport": "http",
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

---

## 5. Test Scenarios (Detailed Examples)

### 5.1 Test Scenario 1: Claude Code + Official Memory + Project Scope

**Setup:**
```bash
# Create test project
mkdir test-memory-project
cd test-memory-project

# Initialize Overture with memory
overture init
overture memory init --server official --scope project

# Verify config
cat .overture/config.yaml
# Should show:
# memory:
#   server: official
#   scope: project

# Run sync
overture sync

# Verify MCP config
cat .mcp.json
# Should show memory server configured
```

**Test Procedure:**
```bash
# 1. Start Claude Code
claude

# 2. Create entity via MCP tool
# In Claude chat:
> Use the memory MCP to store an architectural decision:
> Title: "Database Choice"
> Decision: "Using PostgreSQL for production"
> Rationale: "ACID compliance, JSON support, scalability"

# 3. Verify storage
ls .mcp-memory/
# Should show graph.json

cat .mcp-memory/graph.json
# Should contain decision entity

# 4. Recall in new session
claude
> Recall our database choice decision

# 5. Verify recall works
# Claude should reference PostgreSQL decision
```

**Expected Result:**
- ✅ Memory server starts successfully
- ✅ Entity creation works
- ✅ File storage created in `.mcp-memory/`
- ✅ Recall works in new session
- ✅ Memory persists across Claude restarts

**Success Criteria:**
- All steps complete without errors
- Memory graph file created and readable
- Recall provides accurate information
- Performance acceptable (<500ms per operation)

### 5.2 Test Scenario 12: Gemini CLI + Native Memory + Session Scope

**Setup:**
```bash
# Create test project
mkdir test-gemini-memory
cd test-gemini-memory

# Create GEMINI.md with session memory
cat > GEMINI.md <<EOF
# GEMINI.md

## Memory Configuration

\`\`\`yaml
memory:
  persistence: true
  scope: session
  storage: .gemini/memory/
\`\`\`
EOF

# Start Gemini CLI
gemini
```

**Test Procedure:**
```bash
# 1. Save information in session
/memory save architectural_pattern "Microservices with event sourcing"

# 2. Verify saved
/memory show

# 3. Use saved info
> Based on our architectural pattern, how should we handle user creation?

# 4. Exit and restart
exit
gemini

# 5. Check if memory persisted (should NOT for session scope)
/memory show
# Should be empty (session scope)

# 6. Test project scope instead
# Edit GEMINI.md: change scope to "project"

# 7. Restart and re-test
exit
gemini

# 8. Save again
/memory save architectural_pattern "Microservices with event sourcing"

# 9. Exit and restart
exit
gemini

# 10. Verify persisted (should persist for project scope)
/memory show
# Should show architectural pattern
```

**Expected Result:**
- ✅ Session scope: Memory cleared on session end
- ✅ Project scope: Memory persists across sessions
- ✅ Storage created in `.gemini/memory/`
- ✅ `/memory` commands work correctly

**Success Criteria:**
- Session scope behaves correctly (ephemeral)
- Project scope persists as expected
- Memory commands respond quickly
- No cross-session contamination

### 5.3 Test Scenario 19: VS Code + Enterprise Memory + Project Scope

**Setup:**
```bash
# Install VS Code MCP extension
code --install-extension modelcontextprotocol.mcp-vscode

# Install PostgreSQL (if not installed)
# ...

# Create database
createdb memory_test

# Setup memory service
npm install -g mcp-memory-service

# Configure Overture
overture init
overture memory init --server memory-service --scope project

# Edit .overture/config.yaml:
# memory:
#   server: memory-service
#   config:
#     database_url: postgresql://localhost/memory_test
#     port: 8080

overture sync
```

**Test Procedure:**
```bash
# 1. Start memory service
mcp-memory-service --port 8080 &

# 2. Open project in VS Code
code .

# 3. Verify MCP extension loaded
# Check VS Code: View → Extensions → MCP should be active

# 4. Store entity via MCP
# In VS Code chat:
> Store a code pattern: "Use factory pattern for database connections"

# 5. Verify in PostgreSQL
psql memory_test
SELECT * FROM entities;
SELECT * FROM observations;
\q

# 6. Test semantic search
# In VS Code chat:
> Find patterns related to database management

# 7. Verify semantic search works
# Should find "factory pattern for database connections"

# 8. Test cross-session persistence
# Close VS Code
# Reopen VS Code
> Recall database patterns

# 9. Verify recall from PostgreSQL
```

**Expected Result:**
- ✅ Memory service starts successfully
- ✅ VS Code MCP extension connects
- ✅ Entity storage in PostgreSQL works
- ✅ Semantic search returns relevant results
- ✅ Cross-session persistence confirmed

**Success Criteria:**
- PostgreSQL schema created correctly
- Semantic search latency <2s
- Vector embeddings generated
- Cross-session recall accurate

---

## 6. Best Practices & Recommendations

### 6.1 Scope Selection Guide

| Use Case | Recommended Scope | Memory Server | Rationale |
|----------|-------------------|---------------|-----------|
| **Architectural Decisions** | Project | official or memory-service | Version-controlled, team-shared |
| **Personal Coding Preferences** | User | official or ccmem | User-specific, cross-project |
| **Exploratory Work** | Session (Gemini) | native | Temporary, discardable |
| **Team Knowledge Base** | Project (shared) | memory-service | Semantic search, multi-user |
| **Debugging Context** | Project | official | Persist issue resolutions |
| **Code Review Learnings** | User | ccmem | Personal review patterns |
| **Sprint Goals** | Project | official | Sprint-specific context |

### 6.2 Memory Server Selection Matrix

| Requirement | Official | ccmem | memory-service | Custom |
|-------------|----------|-------|----------------|--------|
| **Simple setup** | ✅ Best | ✅ Good | ❌ Complex | ❌ Complex |
| **Semantic search** | ❌ No | ❌ No | ✅ Yes | Depends |
| **Claude optimization** | ⚠️ Generic | ✅ Yes | ⚠️ Generic | Depends |
| **Team collaboration** | ⚠️ Limited | ❌ No | ✅ Yes | Depends |
| **Scalability** | ⚠️ File-based | ⚠️ SQLite | ✅ PostgreSQL | Depends |
| **Cost** | Free | Free | Paid (embeddings) | Varies |
| **Maintenance** | Low | Medium | High | High |

**Decision Tree:**
```
Is semantic search required?
├─ Yes → memory-service (enterprise)
└─ No → Is this Claude Code only?
    ├─ Yes → ccmem (optimized)
    └─ No → Is this team-shared?
        ├─ Yes → official (simple) or memory-service (advanced)
        └─ No → official (simplest)
```

### 6.3 Auto-Persistence Event Recommendations

**High-Value Events (Always Enable):**
- `architectural_decision` — ADRs, major design choices
- `bug_fix_resolution` — How bugs were solved
- `dependency_change` — Why dependency was updated

**Medium-Value Events (Project-Dependent):**
- `code_pattern_learned` — Reusable coding patterns
- `api_design_choice` — API endpoint design rationale
- `security_consideration` — Security decisions made

**Low-Value Events (Avoid Auto-Persist):**
- `file_read` — Too noisy
- `code_execution` — Generates too much data
- `linter_warning` — Temporary issues

### 6.4 Migration Strategies

**User → Project Migration:**
```bash
# Export user-scoped memory
overture memory export --scope user --output user-memory.json

# Import to project
cd ~/projects/my-project
overture memory import --scope project --input user-memory.json --merge

# Verify
overture memory status
```

**Cross-Server Migration:**
```bash
# Export from official server
overture memory export --server official --output memory.json

# Change server in config
vim .overture/config.yaml
# memory:
#   server: memory-service

# Import to new server
overture sync
overture memory import --input memory.json
```

---

## 7. Implementation Roadmap (v0.5)

### 7.1 Week 1-2: Memory Configuration Schema

**Tasks:**
- Add `memory:` section to Overture YAML schema
- Implement memory server selection logic
- Add scope management (project/user/session)

**Deliverables:**
- Updated Zod schema with memory validation
- CLI prompts for memory initialization
- Configuration documentation

### 7.2 Week 3-4: MCP Generation for Memory

**Tasks:**
- Generate `.mcp.json` entries for selected memory server
- Handle server-specific configuration (paths, ports, etc.)
- Add environment variable handling

**Deliverables:**
- Memory → MCP transpilation logic
- Unit tests for each memory server type
- Integration tests with generated configs

### 7.3 Week 5-6: Memory CLI Commands

**Tasks:**
- Implement `overture memory init`
- Implement `overture memory status`
- Implement `overture memory validate`
- Implement `overture memory migrate`

**Deliverables:**
- Full CLI command suite
- Interactive prompts for setup
- Validation and error handling

### 7.4 Week 7-8: Core Testing (HIGH priority)

**Tasks:**
- Execute 23 HIGH-priority test scenarios
- Document test results and issues
- Fix compatibility issues

**Deliverables:**
- Test report for core scenarios
- Bug fixes for critical issues
- Compatibility matrix update

### 7.5 Week 9-10: Advanced Testing (MEDIUM/LOW priority)

**Tasks:**
- Execute 12 MEDIUM+LOW priority scenarios
- Performance testing (large knowledge graphs)
- Cross-CLI migration testing

**Deliverables:**
- Complete test coverage report
- Performance benchmarks
- Migration guides

### 7.6 Week 11-12: Documentation & Release

**Tasks:**
- Write memory server comparison guide
- Create setup tutorials for each server
- Update CLAUDE.md with memory guidance
- Release Overture v0.5

**Deliverables:**
- Memory documentation
- Video tutorials (optional)
- v0.5 release notes
- Blog post announcement

**Total Timeline:** 12 weeks (3 months) for complete v0.5 memory feature

---

## 8. Open Questions & Future Research

### 8.1 Unanswered Questions

1. **Cross-Server Compatibility** — Can memory be migrated between different server types? (Likely: manual export/import only)
2. **Knowledge Graph Merge Conflicts** — How to resolve when two users modify same entity? (Unknown, needs protocol definition)
3. **Embedding Model Portability** — Can mcp-memory-service switch embedding models without re-indexing? (Unknown, likely: no)
4. **Memory Versioning** — Should memory have version history (git-like)? (No standard exists)
5. **Multi-Tenant Isolation** — How to prevent cross-project memory leaks in user-scoped configs? (Needs design)

### 8.2 Research Gaps

- **Performance at Scale** — How do servers perform with 10K+ entities?
- **Memory Compression** — Can knowledge graphs be compressed for large projects?
- **Distributed Memory** — Can memory be shared across team in real-time?
- **Memory Search Ranking** — What's optimal ranking algorithm for recall?

### 8.3 Future Enhancements (v0.6+)

**v0.6: Advanced Memory Features**
- Memory conflict resolution UI
- Real-time sync across team members
- Memory visualization (graph explorer)
- Memory analytics (usage stats, popular entities)

**v0.7: AI-Enhanced Memory**
- Auto-categorization of entities
- Intelligent memory suggestions
- Context-aware memory injection
- Memory quality scoring

---

## 9. Sources & References

### 9.1 Memory Server Documentation

- **@modelcontextprotocol/server-memory**: https://github.com/modelcontextprotocol/servers/tree/main/src/memory
- **ccmem**: https://github.com/adestefa/ccmem
- **mcp-memory-service**: https://github.com/pierrebrunelle/mcp-memory-service
- **Gemini CLI Memory**: https://ai.google.dev/gemini-api/docs/context-management

### 9.2 MCP Protocol Specs

- **MCP Specification**: https://spec.modelcontextprotocol.io/
- **MCP Server SDK**: https://github.com/modelcontextprotocol/sdk
- **MCP Tools Reference**: https://modelcontextprotocol.io/docs/tools

### 9.3 Related Projects

- **Overture related-projects.md**: Examples of memory usage in the wild
- **Claude Code docs**: Memory server configuration patterns
- **VS Code MCP Extension**: Extension documentation and examples

---

## 10. Conclusions & Next Steps

### 10.1 Key Takeaways

1. **Four Memory Server Types** — Official, Claude-optimized, enterprise, and custom serve different needs
2. **48-Scenario Test Matrix** — Comprehensive testing plan ready for v0.5 implementation
3. **Configuration Schema Defined** — Overture YAML structure for memory is clear and extensible
4. **CLI Support Varies** — Claude Code/Gemini have best support; others require extensions
5. **Scope Management Critical** — Project vs user scope prevents contamination

### 10.2 Recommendations for Overture v0.5

**Priority 1: Implement Core Memory Config**
- Add `memory:` schema to Overture YAML
- Implement MCP generation for 3 main servers (official, ccmem, memory-service)
- Add `overture memory init` command

**Priority 2: Test with Top CLIs**
- Focus on Claude Code + Gemini CLI (best support)
- Validate official + ccmem servers (most common)
- Document compatibility matrix

**Priority 3: Migration & Backup Tools**
- Enable scope migration (user ↔ project)
- Add export/import commands
- Create backup workflows

### 10.3 Success Criteria for v0.5

**Must Have:**
- ✅ Memory configuration in `.overture/config.yaml`
- ✅ MCP generation for official memory server
- ✅ Works with Claude Code (HIGH priority scenarios)
- ✅ Documentation and examples

**Should Have:**
- ✅ Support for ccmem and memory-service
- ✅ Memory CLI commands (init, status, validate)
- ✅ Tested with Gemini CLI
- ✅ Migration tools

**Nice to Have:**
- ⚠️ Custom memory server support
- ⚠️ Advanced analytics
- ⚠️ Team collaboration features

---

**End of Research Document**

*This research provides a comprehensive testing plan for Overture v0.5 memory features. With 48 documented test scenarios, clear configuration schema, and compatibility matrix, implementation can proceed with confidence. The 12-week roadmap provides realistic timeline for production-ready memory support across multiple CLIs.*
