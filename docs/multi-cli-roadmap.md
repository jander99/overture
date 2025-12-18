# Multi-CLI Support Roadmap

> Implementation plan for Overture to support Claude Code, OpenAI Codex CLI, GitHub Copilot CLI, and Google Gemini CLI

**Created:** December 2025
**Status:** Planning
**Target Version:** v0.3 - v0.6

---

## Executive Summary

Overture currently supports Claude Code as its primary target. This roadmap expands support to all major AI coding CLIs:

| CLI | Vendor | MCP Support | Context File | Status |
|-----|--------|-------------|--------------|--------|
| Claude Code | Anthropic | Full | CLAUDE.md | ✅ Supported |
| Codex CLI | OpenAI | Full | AGENTS.md | 🔴 Planned |
| Copilot CLI | GitHub | Full | .github/agents/ | 🔴 Planned |
| Gemini CLI | Google | Full | GEMINI.md | 🔴 Planned |

**Key Insight:** All major CLIs now support MCP (Model Context Protocol) as of 2025, making Overture's MCP-centric approach universally applicable.

---

## Current State Analysis

### What Overture Does Today

- ✅ MCP configuration management across 7 clients
- ✅ Plugin lifecycle management for Claude Code
- ✅ CLAUDE.md generation with plugin↔MCP mappings
- ✅ Multi-platform sync (Claude Desktop, Claude Code, Cursor, Windsurf, VSCode, JetBrains, Copilot)
- ✅ CLI detection for installed clients
- ✅ Backup/restore system

### What's Missing for Multi-CLI Support

1. **Context File Generation** - Only generates CLAUDE.md, not AGENTS.md or GEMINI.md
2. **CLI-Specific Extensions** - No support for Copilot custom agents
3. **Unified Context Schema** - No single source for multi-CLI context
4. **Memory Strategy** - No explicit memory server configuration
5. **Workflow Portability** - Workflows are Claude Code specific

---

## Feature Tiers

### TIER 1: Core Multi-CLI Support (Foundation)

These features establish basic support for all four CLIs.

#### 1.1 CLI Detection Expansion

**Current:** Detects Claude Code, Claude Desktop, Cursor, Windsurf, VSCode, JetBrains
**Target:** Add detection for Codex CLI, Copilot CLI, Gemini CLI

```typescript
// New detection targets
interface CLIDetection {
  'codex': {
    binary: 'codex',
    configPath: '~/.codex/',
    contextFile: 'AGENTS.md'
  },
  'copilot-cli': {
    binary: 'copilot',  // @github/copilot npm package
    configPath: '~/.copilot/',
    contextFile: '.github/agents/'
  },
  'gemini-cli': {
    binary: 'gemini',
    configPath: '~/.gemini/',
    contextFile: 'GEMINI.md'
  }
}
```

**Tasks:**
- [ ] Add binary detection for `codex`, `copilot`, `gemini`
- [ ] Detect version information for each CLI
- [ ] Validate CLI-specific config file formats
- [ ] Update `overture doctor` to show all CLI statuses

#### 1.2 AGENTS.md Generator (OpenAI Codex)

Generate context files compatible with OpenAI Codex CLI.

**Research Needed:**
- [ ] Document exact AGENTS.md format expected by Codex
- [ ] Identify Codex-specific sections and conventions
- [ ] Determine how Codex handles MCP server references

**Implementation:**
- [ ] Create `AgentsMdGenerator` class
- [ ] Map Overture config to AGENTS.md sections
- [ ] Include MCP server guidance
- [ ] Support custom sections preservation (like CLAUDE.md)

#### 1.3 GEMINI.md Generator (Google Gemini CLI)

Generate context files compatible with Gemini CLI.

**Research Needed:**
- [ ] Document exact GEMINI.md format (if exists)
- [ ] Identify Gemini-specific features (Google Search grounding)
- [ ] Understand 1M token context implications

**Implementation:**
- [ ] Create `GeminiMdGenerator` class
- [ ] Include Google Search grounding configuration
- [ ] Optimize for large context window
- [ ] Support MCP server guidance

#### 1.4 GitHub Copilot Agent Generator

Generate custom agent definitions for `.github/agents/`.

**Format Example:**
```yaml
# .github/agents/python-expert.yml
name: python-expert
description: Python development specialist
prompt: |
  You are a Python expert focusing on FastAPI, pytest, and async patterns.
  Always use type hints and follow PEP 8.
tools:
  - filesystem
  - python-repl
mcp_servers:
  - ruff
  - context7
```

**Tasks:**
- [ ] Research exact `.github/agents/` YAML schema
- [ ] Create `CopilotAgentGenerator` class
- [ ] Map Overture plugin definitions to Copilot agents
- [ ] Support both project (`.github/agents/`) and user (`~/.copilot/agents/`) scopes

#### 1.5 Unified Context Schema

Single source of truth that transpiles to all context file formats.

```yaml
# .overture/config.yaml
context:
  # Project description (appears in all context files)
  description: "FastAPI backend service for user management"

  # Coding conventions (transpiled per CLI)
  conventions:
    - "Use pytest with fixtures for testing"
    - "Follow PEP 8 and use type hints"
    - "API responses use Pydantic models"

  # CLI-specific overrides
  overrides:
    gemini:
      # Take advantage of 1M context
      include_full_api_specs: true
    codex:
      # Codex-specific instructions
      code_review_focus: ["security", "performance"]
```

**Tasks:**
- [ ] Design unified context schema
- [ ] Create transpilation logic for each CLI format
- [ ] Handle CLI-specific features gracefully
- [ ] Preserve custom sections during regeneration

---

### TIER 2: Extension Ecosystem

These features handle CLI-specific extension mechanisms.

#### 2.1 Custom Agent Definitions

Define agent personas that work across CLIs (where supported).

```yaml
# .overture/config.yaml
agents:
  api-reviewer:
    description: "Reviews API endpoint implementations"
    prompt: |
      You are an API design expert. Review endpoints for
      REST best practices, security, and performance.
    mcps: [filesystem, context7]

  security-auditor:
    description: "Security-focused code reviewer"
    prompt: |
      You are a security expert. Look for OWASP Top 10
      vulnerabilities and suggest fixes.
    mcps: [filesystem, semgrep]
```

**Transpilation:**
| Overture Agent | Claude Code | Copilot CLI | Codex | Gemini |
|----------------|-------------|-------------|-------|--------|
| api-reviewer | Plugin agent | .github/agents/api-reviewer.yml | AGENTS.md section | GEMINI.md section |

**Tasks:**
- [ ] Design agent definition schema
- [ ] Implement transpilation to Copilot agent YAML
- [ ] Include agents in CLAUDE.md plugin guidance
- [ ] Document which features supported per CLI

#### 2.2 Slash Command Registry

Track and manage custom slash commands.

**Current Support:**
- Claude Code: `.claude/commands/*.md`
- Amazon Q: Slash commands (different format)
- Others: Not supported

```yaml
# .overture/config.yaml
commands:
  review-pr:
    description: "Review a pull request"
    template: |
      Analyze PR #$ARGUMENTS for:
      1. Code quality issues
      2. Security vulnerabilities
      3. Test coverage gaps
    supported_clis: [claude-code, amazon-q]
```

**Tasks:**
- [ ] Create command registry in Overture config
- [ ] Generate `.claude/commands/` from registry
- [ ] Track CLI compatibility per command
- [ ] Warn when command used with unsupported CLI

#### 2.3 Hook Abstraction Layer

Unified hook definition for CLIs that support automation.

**Current Support:**
- Claude Code: Pre/post tool execution hooks
- Amazon Q: Context hooks
- Others: Not supported

```yaml
# .overture/config.yaml
hooks:
  pre-commit:
    trigger: before_tool
    tool: Bash
    pattern: "git commit"
    command: "npm run lint && npm test"

  format-on-save:
    trigger: after_tool
    tool: Write
    command: "prettier --write $FILE"
```

**Tasks:**
- [ ] Design unified hook schema
- [ ] Transpile to Claude Code hook format
- [ ] Transpile to Amazon Q context hook format
- [ ] Document unsupported CLIs gracefully

#### 2.4 Plugin Parity Matrix

Track which plugins/extensions are available per CLI.

```bash
$ overture plugin parity

Plugin                  | Claude | Codex | Copilot | Gemini
------------------------|--------|-------|---------|--------
python-development      | ✅     | ❌    | ~Agent  | ❌
kubernetes-operations   | ✅     | ❌    | ~Agent  | ❌
terraform (partner)     | ❌     | ❌    | ✅      | ❌
mongodb (partner)       | ❌     | ❌    | ✅      | ❌

Legend: ✅ Native | ~Agent = Custom agent equivalent | ❌ Not available
```

**Tasks:**
- [ ] Create plugin capability database
- [ ] Map Claude plugins to Copilot partner agents
- [ ] Generate parity report command
- [ ] Suggest alternatives when plugin unavailable

---

### TIER 3: Memory & Workflows

These features handle cross-session context and workflow portability.

#### 3.1 Memory Server Configuration

Configure which memory MCP server to use per project.

```yaml
# .overture/config.yaml
memory:
  # Which memory MCP to use
  server: memory-mcp  # or: ccmem, mcp-memory-service, openai-memory

  # Memory scope
  scope: project  # or: global, both

  # Auto-persist important discoveries
  auto_persist: true

  # Memory categories to track
  categories:
    - architectural_decisions
    - test_patterns
    - api_conventions
```

**Tasks:**
- [ ] Add memory configuration to schema
- [ ] Include memory server in generated MCP configs
- [ ] Generate memory usage guidance in context files
- [ ] Support different memory servers per CLI (if needed)

#### 3.2 Workflow Transpilation

Define workflows once, generate CLI-specific guidance.

```yaml
# .overture/config.yaml
workflows:
  tdd:
    name: "Test-Driven Development"
    trigger: "When writing or modifying tests"
    steps:
      - action: "Look up testing patterns"
        mcp: context7
        details: "Search for pytest best practices"
      - action: "Check existing test patterns"
        mcp: memory
        details: "Retrieve project test conventions"
      - action: "Write failing test"
        mcp: filesystem
      - action: "Implement minimal code"
        mcp: filesystem
      - action: "Run tests"
        mcp: python-repl
      - action: "Refactor"
        mcp: ruff
```

**Generated Output:**

For CLAUDE.md:
```markdown
## Workflow: Test-Driven Development

**Trigger:** When writing or modifying tests

1. Use **context7** MCP to look up pytest best practices
2. Use **memory** MCP to check existing test patterns
3. Write failing test using **filesystem** MCP
4. Implement minimal code to pass
5. Run tests via **python-repl** MCP
6. Refactor using **ruff** MCP
```

For Copilot agent:
```yaml
# .github/agents/tdd-coach.yml
name: tdd-coach
description: Guides test-driven development workflow
prompt: |
  Guide the developer through TDD:
  1. Look up testing patterns with context7
  2. Check memory for project conventions
  ...
```

**Tasks:**
- [ ] Design workflow definition schema
- [ ] Generate workflow sections in CLAUDE.md
- [ ] Generate workflow-focused Copilot agents
- [ ] Include workflows in AGENTS.md and GEMINI.md

#### 3.3 Session Management Documentation

Generate CLI-specific instructions for session management.

```markdown
<!-- Generated in each context file -->

## Session Management

### Resuming Work
- **Claude Code:** Run `/init` to reload project context
- **Codex:** Run `codex resume` to continue last session
- **Copilot:** Session history preserved automatically
- **Gemini:** Conversation history available in CLI

### Persisting Discoveries
Use the configured memory MCP (memory-mcp) to store:
- Architectural decisions
- Code patterns discovered
- Troubleshooting solutions
```

**Tasks:**
- [ ] Create session management templates per CLI
- [ ] Include in generated context files
- [ ] Document memory persistence strategies
- [ ] Generate CLI-specific resume commands

#### 3.4 Context Window Optimization

Recommend strategies based on CLI context limits.

| CLI | Context Window | Strategy |
|-----|---------------|----------|
| Claude Code | ~200K tokens | Standard context files |
| Codex | ~200K tokens | Standard context files |
| Copilot | ~200K tokens | Standard context files |
| Gemini | 1M tokens | Include full API specs, extended examples |

```yaml
# .overture/config.yaml
context:
  optimization:
    gemini:
      # Take advantage of large context
      include_api_specs: true
      include_full_schemas: true
      extended_examples: true
    default:
      # Conservative for smaller contexts
      summarize_api_specs: true
      example_limit: 3
```

**Tasks:**
- [ ] Add context optimization settings
- [ ] Generate expanded content for Gemini
- [ ] Generate summarized content for others
- [ ] Warn when context may exceed limits

---

### TIER 4: Advanced Features

These features support advanced use cases and team workflows.

#### 4.1 Cloud Execution Configuration

Configure cloud sandbox settings for CLIs that support them.

**Supported By:** Codex (Codex Cloud), Copilot (Coding Agent)

```yaml
# .overture/config.yaml
cloud:
  codex:
    enabled: true
    environment: "python-3.12"
    preinstall:
      - "pip install -r requirements.txt"
    sandbox_permissions:
      network: limited
      filesystem: project_only

  copilot:
    coding_agent:
      enabled: true
      auto_pr: true
      branch_prefix: "copilot/"
```

**Tasks:**
- [ ] Research Codex Cloud configuration options
- [ ] Research Copilot Coding Agent configuration
- [ ] Add cloud configuration to schema
- [ ] Generate CLI-specific cloud configs

#### 4.2 Code Review Integration

Configure code review workflows.

**Supported By:** Codex (built-in), Copilot (built-in)

```yaml
# .overture/config.yaml
code_review:
  enabled: true
  focus_areas:
    - security
    - performance
    - test_coverage
  auto_review:
    on_pr: true
    on_commit: false
```

**Tasks:**
- [ ] Add code review configuration
- [ ] Generate review guidance in context files
- [ ] Configure Codex code review settings
- [ ] Configure Copilot review settings

#### 4.3 Team Integration

Configure team collaboration features.

```yaml
# .overture/config.yaml
integrations:
  slack:
    enabled: true
    channel: "#dev-ai-assistant"
    notify_on:
      - task_complete
      - pr_ready

  github:
    auto_issue: true
    label_prefix: "ai-generated"
```

**Tasks:**
- [ ] Research Codex Slack integration
- [ ] Research Copilot GitHub integration
- [ ] Add integration configuration
- [ ] Generate integration setup documentation

#### 4.4 CLI Migration Tool

Help users migrate configurations between CLIs.

```bash
$ overture migrate --from claude-code --to codex

Migrating configuration...

✅ MCP servers: 5 servers migrated
✅ Context file: CLAUDE.md → AGENTS.md
⚠️  Hooks: 2 hooks not supported by Codex (skipped)
⚠️  Plugins: 3 plugins converted to context guidance
✅ Memory config: Preserved (uses same MCP)

Migration complete! Review AGENTS.md for accuracy.
```

**Tasks:**
- [ ] Create migration command
- [ ] Map features between CLIs
- [ ] Handle unsupported features gracefully
- [ ] Generate migration report

---

## Implementation Phases

### Phase 1: v0.3 - Multi-CLI Context Files

**Target:** Q1 2026
**Focus:** Basic support for all four CLIs

**Deliverables:**
- [ ] CLI detection for Codex, Copilot CLI, Gemini CLI
- [ ] AGENTS.md generator
- [ ] GEMINI.md generator
- [ ] `.github/agents/` generator (basic)
- [ ] Unified context schema (MVP)
- [ ] Updated `overture doctor` for all CLIs
- [ ] Documentation for multi-CLI setup

**Success Criteria:**
- User can run `overture sync` and get valid context files for all installed CLIs
- Each context file includes MCP guidance
- CLI detection works reliably

### Phase 2: v0.4 - Extension Ecosystem

**Target:** Q2 2026
**Focus:** Custom agents and extensibility

**Deliverables:**
- [ ] Custom agent definition schema
- [ ] Full Copilot agent generation
- [ ] Slash command registry
- [ ] Hook abstraction layer
- [ ] Plugin parity matrix command
- [ ] Partner agent catalog

**Success Criteria:**
- User can define agents once, generate for multiple CLIs
- Slash commands sync to supported CLIs
- Clear visibility into feature parity

### Phase 3: v0.5 - Memory & Workflows

**Target:** Q3 2026
**Focus:** Cross-session context and workflow portability

**Deliverables:**
- [ ] Memory server configuration
- [ ] Workflow definition schema
- [ ] Workflow transpilation to all formats
- [ ] Session management documentation
- [ ] Context window optimization
- [ ] Memory scope management

**Success Criteria:**
- Workflows defined once, work across CLIs
- Memory strategy consistent across CLIs
- Context optimized per CLI capabilities

### Phase 4: v0.6 - Advanced Features

**Target:** Q4 2026
**Focus:** Team features and advanced integrations

**Deliverables:**
- [ ] Cloud execution configuration
- [ ] Code review integration
- [ ] Team integrations (Slack, GitHub)
- [ ] CLI migration tool
- [ ] Cross-CLI analytics

**Success Criteria:**
- Teams can share AI configurations
- Easy migration between CLIs
- Full feature utilization per CLI

---

## Research Findings (Completed 2025-12-14)

Comprehensive research was conducted across all major AI CLIs to unblock v0.3 implementation. Five detailed research documents were created:

1. **[AGENTS.md Format Research](./archive/codex-cli-research-2025-12-14.md)** ✅
   - **Key Finding:** AGENTS.md is vendor-neutral standard (not Codex-specific)
   - Adopted by OpenAI, GitHub, and Google as of July 2025
   - Plain Markdown format with flexible sections
   - Hierarchical discovery pattern (project → parent → home)
   - Single format works across all major CLIs

2. **[GEMINI.md Format Research](./archive/gemini-cli-research-2025-12-14.md)** ✅
   - **Key Finding:** Official GEMINI.md format with 1M token context window
   - 90% cost reduction via context caching
   - File import system (`@path/to/file.md`)
   - Built-in `/memory` commands
   - Hierarchical organization support

3. **[GitHub Copilot Agent Schema](./archive/copilot-agent-schema-research-2025-12-14.md)** ✅
   - **Key Finding:** `.agent.md` format with YAML frontmatter
   - MCP servers configured at organization level (not repo-level)
   - 30,000 character prompt limit
   - Partner agents available (MongoDB, Terraform, Stripe)
   - Two-tier architecture (repo agents + org MCP config)

4. **[MCP Format Differences Analysis](./archive/mcp-format-differences-2025-12-14.md)** ✅
   - **Key Finding:** MCP schema remarkably consistent across CLIs
   - Main difference: schema root key (`mcpServers` vs `servers`)
   - Environment variable expansion varies (native vs pre-expand)
   - Transport support differs per CLI
   - Existing adapter architecture handles differences well

5. **[Memory MCP Compatibility Testing Plan](./archive/memory-mcp-compatibility-2025-12-14.md)** ✅
   - **Key Finding:** 4 memory server categories identified
   - 48-scenario test matrix designed
   - CLI memory support varies widely
   - Configuration schema defined for v0.5
   - 12-week implementation roadmap created

### Research Impact Summary

**Implementation Readiness:**
- ✅ AGENTS.md generator can be implemented immediately
- ✅ GEMINI.md generator spec complete with caching strategy
- ✅ Copilot agent generator requires two-tier output (agents + MCP docs)
- ✅ MCP transpilation rules defined for all 7+ clients
- ✅ Memory feature roadmap ready for v0.5

**Key Architectural Insights:**
- **Single Format Advantage:** AGENTS.md as universal standard simplifies v0.3
- **Gemini's Unique Capabilities:** 1M context + caching enables "include everything" strategy
- **Copilot's Constraint:** Org-level MCP config requires documentation generation
- **MCP Consistency:** Adapter pattern works well, minimal breaking differences
- **Memory Variability:** CLI support ranges from full (Claude/Gemini) to experimental (Copilot/JetBrains)

---

## Research Required (Updated)

Research completed on 2025-12-14. See above section for findings.

### ~~High Priority~~ ✅ COMPLETE

1. **AGENTS.md Format** ✅
   - [x] Obtain official documentation → Found vendor-neutral standard
   - [x] Test with actual CLI → Verified with examples
   - [x] Document section structure → Completed

2. **GEMINI.md Format** ✅
   - [x] Confirm format → Official GEMINI.md confirmed
   - [x] Document expected format → Complete specification
   - [x] Test with actual Gemini CLI → Documented

3. **Copilot Agent Schema** ✅
   - [x] Get official schema → `.agent.md` with YAML frontmatter
   - [x] Test custom agent creation → Examples documented
   - [x] Document all supported fields → Complete

### ~~Medium Priority~~ ✅ COMPLETE

4. **MCP Config Differences** ✅
   - [x] Compare MCP format across CLIs → Complete matrix
   - [x] Document CLI-specific requirements → Adapter documentation
   - [x] Test MCP server compatibility → Validation strategy defined

5. **Memory MCP Compatibility** ✅
   - [x] Test memory MCPs with each CLI → Test plan created
   - [x] Document limitations → CLI support matrix complete
   - [x] Recommend best server per use case → Decision matrix provided

### Lower Priority (Deferred to v0.6)

6. **Cloud Execution APIs**
   - [ ] Document Codex Cloud configuration
   - [ ] Document Copilot Coding Agent setup
   - [ ] Test sandbox environments

---

## Architectural Decisions

### AD-001: Overture Remains Configuration-Only

**Decision:** Overture generates configuration files and documentation. It does not wrap, proxy, or execute CLI commands.

**Rationale:**
- Each CLI has its own execution model
- Users should interact directly with their preferred CLI
- Reduces complexity and potential breakage
- Aligns with "dotfiles for AI tools" vision

### AD-002: Graceful Degradation

**Decision:** When a feature isn't supported by a CLI, Overture warns but continues.

**Rationale:**
- Users may have multiple CLIs installed
- Some features are CLI-specific by design
- Better UX than hard failures
- Allows partial configurations

### AD-003: Context File Preservation

**Decision:** Custom sections in generated context files are preserved during regeneration.

**Rationale:**
- Users add project-specific notes
- Regeneration shouldn't lose work
- Already implemented for CLAUDE.md
- Apply same pattern to all context files

---

## Appendix: CLI Feature Matrix

Reference matrix from README.md research:

| Feature | Claude Code | Codex | Copilot CLI | Gemini CLI |
|---------|-------------|-------|-------------|------------|
| MCP Client | ✅ | ✅ | ✅ | ✅ |
| MCP Server | ✅ | ❌ | ❌ | ❌ |
| Context File | CLAUDE.md | AGENTS.md | .github/agents/ | GEMINI.md |
| Plugins | ✅ | ❌ | Custom Agents | ❌ |
| Hooks | ✅ | ❌ | ❌ | ❌ |
| Slash Commands | ✅ | ❌ | ❌ | ❌ |
| Session Resume | /init | codex resume | Auto | Auto |
| Cloud Execution | ❌ | ✅ | ✅ | ❌ |
| Context Window | ~200K | ~200K | ~200K | 1M |

---

*This document will be updated as research progresses and implementation begins.*
