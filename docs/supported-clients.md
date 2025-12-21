# Supported Clients - Overture v0.3

**Last Updated:** 2025-01-12  
**Overture Version:** v0.3.0

---

## Overview

Overture v0.3 supports **3 AI development clients**. This represents a strategic focus on clients with:

- ✅ Native MCP support
- ✅ Clear configuration formats
- ✅ Active development and maintenance
- ✅ Project-scoped configuration capabilities

---

## Current Support Matrix

| Client                 | Status       | User Config Path                   | Project Config Path | Transports  |
| ---------------------- | ------------ | ---------------------------------- | ------------------- | ----------- |
| **Claude Code**        | ✅ Primary   | `~/.claude.json`                   | `./.mcp.json`       | stdio, http |
| **GitHub Copilot CLI** | ✅ Supported | `~/.copilot/mcp-config.json`       | N/A                 | stdio       |
| **OpenCode**           | ✅ Supported | `~/.config/opencode/opencode.json` | `./opencode.json`   | stdio, http |

---

## Feature Comparison

### Configuration Scopes

| Feature                   | Claude Code | Copilot CLI | OpenCode |
| ------------------------- | ----------- | ----------- | -------- |
| **User (Global) Config**  | ✅ Yes      | ✅ Yes      | ✅ Yes   |
| **Project (Repo) Config** | ✅ Yes      | ❌ No       | ✅ Yes   |
| **Config Merging**        | ✅ Yes      | N/A         | ✅ Yes   |

### MCP Transport Support

| Transport | Claude Code | Copilot CLI | OpenCode |
| --------- | ----------- | ----------- | -------- |
| **stdio** | ✅ Yes      | ✅ Yes      | ✅ Yes   |
| **http**  | ✅ Yes      | ❌ No       | ✅ Yes   |
| **sse**   | ✅ Yes      | ❌ No       | ❌ No    |

### Environment Variables

| Feature                | Claude Code          | Copilot CLI | OpenCode             |
| ---------------------- | -------------------- | ----------- | -------------------- |
| **Native Expansion**   | ✅ Yes               | ✅ Yes      | ✅ Yes               |
| **Default Values**     | ✅ `${VAR:-default}` | ❌ No       | ✅ `${VAR:-default}` |
| **Overture Expansion** | ⚠️ Optional          | ⚠️ Optional | ⚠️ Optional          |

---

## Dropped Support (v0.3)

The following clients were supported in earlier prototypes but **removed in v0.3**:

| Client             | Reason for Removal                                | Alternative                  |
| ------------------ | ------------------------------------------------- | ---------------------------- |
| **Claude Desktop** | Limited project config support, GUI-focused       | Use Claude Code (CLI)        |
| **Cursor**         | Custom configuration format, immature MCP support | Use VS Code with Copilot     |
| **Windsurf**       | Nascent MCP support, unclear roadmap              | Monitor for future inclusion |
| **VS Code**        | Requires custom extension, no native MCP support  | Use Copilot CLI or OpenCode  |
| **JetBrains IDEs** | Requires custom plugin, no native MCP support     | Use Claude Code or OpenCode  |

### Why We Narrowed Focus

**Before v0.3:** Overture attempted to support 7 clients, leading to:

- ❌ High maintenance burden (7 adapters to maintain)
- ❌ Complex configuration logic (many edge cases)
- ❌ Slow feature development (compatibility testing required for all)
- ❌ Inconsistent user experience (wide variance in capabilities)

**After v0.3:** Focused on 3 clients with strong MCP support:

- ✅ Lower maintenance burden (3 adapters)
- ✅ Simpler configuration (fewer edge cases)
- ✅ Faster feature development (less testing overhead)
- ✅ Consistent user experience (similar capabilities)

---

## Configuration Paths Reference

### Claude Code

**User (Global):**

```bash
~/.claude.json
```

**Project (Repository):**

```bash
./.mcp.json
```

**Format:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/workspace"
      ],
      "env": {
        "VAR": "${VAR:-default}"
      }
    }
  }
}
```

---

### GitHub Copilot CLI

**User (Global):**

```bash
~/.copilot/mcp-config.json
```

**Project:** Not supported

**Format:**

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "mcp-server-memory"]
    }
  }
}
```

**Note:** Copilot CLI only supports user-scoped configuration.

---

### OpenCode

**User (Global):**

```bash
~/.config/opencode/opencode.json
```

**Project (Repository):**

```bash
./opencode.json
```

**Format:**

```json
{
  "mcpServers": {
    "github": {
      "command": "mcp-server-github",
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## Overture Configuration

Overture uses a single source of truth to generate all 3 client configs:

**User (Global):**

```bash
~/.config/overture.yml
```

**Project (Repository):**

```bash
./.overture/config.yaml
```

**Format:**

```yaml
version: '1.0'

mcp:
  filesystem:
    command: npx
    args: ['-y', '@modelcontextprotocol/server-filesystem', '${HOME}']

  memory:
    command: npx
    args: ['-y', 'mcp-server-memory']

  github:
    command: mcp-server-github
    env:
      GITHUB_TOKEN: '${GITHUB_TOKEN}'
```

**Sync to all clients:**

```bash
overture sync
```

---

## Migration Guide

### From 7-Client Configuration

If you were using an earlier Overture version that supported 7 clients:

1. **Review your Overture config** (`~/.config/overture.yml` or `.overture/config.yaml`)
2. **Check for client-specific exclusions:**
   ```yaml
   mcp:
     my-server:
       command: my-command
       clients:
         only: [cursor, windsurf] # ⚠️ These clients no longer supported!
   ```
3. **Update to supported clients:**
   ```yaml
   mcp:
     my-server:
       command: my-command
       clients:
         only: [claude-code, copilot-cli, opencode] # ✅ Supported clients
   ```
4. **Re-sync:**
   ```bash
   overture sync
   ```

### From Manual Configuration

If you were manually editing `.claude.json`, `.copilot/mcp-config.json`, or `opencode.json`:

1. **Create Overture config:**
   ```bash
   overture init
   ```
2. **Migrate MCP servers to Overture format** (see example above)
3. **Sync to all clients:**
   ```bash
   overture sync
   ```
4. **Verify configs generated correctly:**
   ```bash
   overture doctor
   ```

---

## Future Support

We are monitoring the following clients for potential future inclusion:

| Client       | Status      | Notes                             |
| ------------ | ----------- | --------------------------------- |
| **Windsurf** | 🔍 Watching | Waiting for MCP support to mature |
| **Aider**    | 🔍 Watching | Evaluating MCP integration plans  |
| **Cody**     | 🔍 Watching | Sourcegraph's AI assistant        |

**Inclusion Criteria:**

- ✅ Native MCP protocol support
- ✅ Stable configuration format
- ✅ Active maintenance (6+ months)
- ✅ Project-scoped configuration
- ✅ Clear documentation

---

## Questions or Issues?

- **Documentation:** See [user-guide.md](./user-guide.md)
- **Examples:** See [examples.md](./examples.md)
- **Troubleshooting:** Run `overture doctor`
- **Bug Reports:** Open an issue on GitHub

---

**Last Updated:** 2025-01-12  
**Overture Version:** v0.3.0
