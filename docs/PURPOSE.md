# Overture Purpose & Vision

## The Problem

Developers using AI-assisted development tools face **configuration chaos**:

### The Configuration Mess

- **Multiple AI tools** with separate configs:
  - Claude Desktop: `~/Library/Application Support/Claude/mcp.json`
  - Claude Code user: `~/.claude.json`
  - Claude Code project: `./.mcp.json`
  - GitHub Copilot CLI: (various locations)
  - VSCode/IntelliJ Copilot: extension settings

- **No single source of truth**:
  - Same MCP server configured 3 different ways
  - Outdated configs from experiments lingering
  - Duplicates across user/project levels
  - No way to sync configs across machines

- **No plugin-to-tool coordination**:
  - Install `python-development` plugin → manually configure `python-repl` MCP
  - No guidance on which MCPs enhance which plugins
  - Claude doesn't know "use memory MCP to persist discoveries"
  - Teams can't share "this is how we use AI on this project"

### The Documentation Gap

Project-generated `CLAUDE.md` files are minimal:
- "Here's what we found via grep" - basic codebase info
- No workflow guidance
- No MCP usage instructions
- No agent/skill orchestration patterns
- No team best practices

## What Overture Is (Current Implementation)

**Overture v0.2.5 is a comprehensive multi-platform MCP configuration orchestrator with intelligent client detection.**

Currently implemented (911/911 tests passing, 83%+ coverage):
- ✅ User global config (`~/.config/overture/config.yml`)
- ✅ Project-level config (`.overture/config.yaml`)
- ✅ User/project config merging with proper precedence
- ✅ Multi-platform sync for 7 AI development clients
- ✅ **Intelligent binary detection** - Automatically detects installed clients, versions, validates configs
- ✅ **System diagnostics** - `overture doctor` command for health checks and troubleshooting
- ✅ **Version extraction** - Captures client versions via --version flags
- ✅ Backup/restore system with retention policy
- ✅ Config audit to detect unmanaged MCPs
- ✅ Install Claude Code plugins via `claude plugin install`
- ✅ Generate platform-specific MCP configs
- ✅ Generate `CLAUDE.md` with plugin→MCP mappings
- ✅ Schema validation and MCP availability checks
- ✅ Transport validation and platform filtering
- ✅ Process locking for safe concurrent operations

**Scope:** 7 AI clients (Claude Code, Claude Desktop, Cursor, Windsurf, VSCode, Copilot CLI, JetBrains), user global + project configs, multi-platform sync, intelligent detection.

**Value:** Single source of truth for MCP configuration across all AI development tools, eliminating duplication and drift. Automatic detection ensures configs are generated appropriately for installed clients.

## What Overture Should Be (Intended Vision)

**Overture is a configuration orchestrator and documentation generator for the entire AI-assisted development ecosystem.**

### Three Pillars

#### Pillar 1: Multi-Platform MCP Configuration Manager

**Problem:** MCP servers configured inconsistently across multiple AI tools and config levels.

**Solution:**
- **Single source of truth:** `~/.config/overture/config.yml` (user global) + `.overture/config.yaml` (project)
- **Multi-platform sync:** Generate configs for Claude Desktop, Claude Code, Copilot CLI, VSCode, IntelliJ
- **Smart precedence:** User global MCPs override project duplicates (no duplication)
- **Format adapters:** Translate Overture config → platform-specific formats
- **Audit & cleanup:** Scan existing configs, report conflicts, consolidate

**Example workflow:**
```bash
# User declares canonical MCP config once
~/.config/overture/config.yml:
  github: { command: mcp-github }
  memory: { command: mcp-memory }

# Project declares additional needs
.overture/config.yaml:
  python-repl: { command: uvx, args: [mcp-server-python-repl] }

# Sync to all platforms
overture sync
→ Updates Claude Desktop mcp.json
→ Updates Claude Code user config
→ Updates Claude Code project .mcp.json (only python-repl, not github)
→ Updates Copilot configs (if installed)
```

**Dotfiles integration:** Commit `~/.config/overture/config.yml` to dotfiles repo for machine portability.

#### Pillar 2: Claude Code Plugin Lifecycle Manager

**Problem:** Plugins installed globally but only needed for specific projects. No precedence model.

**Solution:**
- **User/project precedence:** User can have global plugins; project can declare additional plugins
- **Smart installation:** Only install plugins not already in user global config
- **Activation context:** Document which plugins are "active" for this project in `CLAUDE.md`
- **Version management:** (future) Pin plugin versions per project

**Example:**
```yaml
# User global: ~/.config/overture/config.yml
plugins:
  python-development:
    marketplace: claude-code-workflows

# Project: .overture/config.yaml
plugins:
  python-development:
    marketplace: claude-code-workflows
    # Note: Already installed globally

  kubernetes-operations:
    marketplace: claude-code-workflows
    # Note: Project-specific plugin
```

**Generated CLAUDE.md:**
```markdown
## Active Plugins for This Project
- python-development (from user global config)
- kubernetes-operations (project-specific)
```

#### Pillar 3: AI Context Documentation Generator

**Problem:** Basic `CLAUDE.md` files don't capture workflows, MCP usage patterns, or orchestration strategies.

**Solution:**
- **Enhanced templates:** User-defined workflow instructions
- **MCP usage guidance:** "When using context7, distill summaries into memory"
- **Agent/Skill → MCP mappings:** (research-heavy) Connect plugin agents to optimal MCPs
- **Team best practices:** Codify "how we use AI on this project"

**Example configuration:**
```yaml
# .overture/config.yaml
documentation:
  workflows:
    - name: "TDD with AI assistance"
      trigger: "When writing tests"
      instructions: |
        1. Use context7 MCP to look up testing library best practices
        2. Use memory MCP to check previous test patterns in this project
        3. Use python-repl MCP to validate test assertions
        4. Store new patterns in memory for future reference

    - name: "API implementation"
      trigger: "When implementing API endpoints"
      instructions: |
        1. Use context7 to fetch latest FastAPI documentation
        2. Use memory to retrieve project API design patterns
        3. Use ruff MCP for linting as you code

  agent_mcp_mappings:
    python-development:python-pro:
      mcps:
        memory: "Persist architectural decisions and patterns discovered"
        context7: "Always look up latest library docs before implementing"
        python-repl: "Validate complex logic before committing"
```

**Generated CLAUDE.md** includes rich workflow instructions that orchestrate multiple MCPs together.

### Stitching It Together: The Magic

When Overture configuration declares:
```yaml
plugins:
  python-development:
    mcps: [memory, context7, python-repl]

documentation:
  workflows:
    - name: "Research-driven development"
      instructions: |
        1. context7: Look up latest docs
        2. memory: Store distilled summary
        3. python-repl: Validate approach
```

The generated `CLAUDE.md` tells Claude:
```markdown
## Workflow: Research-driven development

When researching a new library:
1. Use **context7 MCP** to fetch up-to-date documentation
2. Use **memory MCP** to persist a distilled summary for future sessions
3. Use **python-repl MCP** to validate your understanding with code

This creates a learning loop where each library researched enriches the project memory.
```

**This is the value-add:** Overture doesn't just configure tools—it teaches Claude how to USE them together effectively.

## Scope Boundaries

### ✅ In Scope

1. **Configuration management:**
   - MCP server configs across multiple platforms
   - Plugin installation and precedence
   - User global vs project-specific settings

2. **Documentation generation:**
   - Enhanced `CLAUDE.md` and `AGENTS.md` files
   - Workflow instructions
   - MCP usage patterns
   - Team best practices

3. **Multi-platform support:**
   - Claude Desktop
   - Claude Code (user + project)
   - GitHub Copilot CLI
   - VSCode/IntelliJ Copilot (if config exposed)

4. **Dotfiles integration:**
   - `~/.config/overture/config.yml` can be version-controlled
   - Machine portability

### ❌ Out of Scope

1. **Execution orchestration:** Overture is NOT an execution engine like Claude Code Flow
2. **Multi-agent coordination:** NOT a runtime coordinator like Claude Squad
3. **Workflow execution:** NOT a task runner—it generates INSTRUCTIONS for Claude to follow
4. **Plugin marketplace:** NOT a registry or marketplace itself
5. **Plugin development:** NOT a plugin authoring framework

**Overture is a configuration and documentation tool, not an execution platform.**

## Phased Roadmap

### Phase 1: Foundation (v0.1)
- [x] Basic CLI infrastructure
- [x] Project-level config for Claude Code
- [x] Plugin installation via Claude CLI
- [x] Basic .mcp.json generation
- [x] Simple CLAUDE.md templates
- [x] Validation engine

**Status:** ✅ COMPLETE (98%+ test coverage)

### Phase 2: Multi-Platform MCP Manager (v0.2)
- [x] User global config: `~/.config/overture/config.yml`
- [x] User/project precedence and deduplication
- [x] Multi-platform adapters:
  - [x] Claude Desktop
  - [x] Claude Code (user + project config)
  - [x] Cursor IDE
  - [x] Windsurf IDE
  - [x] VSCode Copilot
  - [x] Copilot CLI
  - [x] JetBrains Copilot
- [x] Config audit command: `overture audit`
- [x] Backup/restore commands: `overture backup`
- [x] Multi-client sync engine with process locking
- [x] Transport validation and filtering
- [x] Platform-specific path resolution

**Status:** ✅ COMPLETE (873/873 tests passing, 83%+ code coverage)

**Goal:** Eliminate MCP configuration duplication across platforms. ✅ ACHIEVED

### Phase 2.5: Intelligent Client Detection (v0.2.5)
- [x] Binary detection service (CLI binaries + GUI applications)
- [x] Version extraction via --version flags
- [x] Config file JSON validation
- [x] Doctor command for system diagnostics
  - [x] Show installed clients and versions
  - [x] Validate config files
  - [x] Check MCP command availability
  - [x] JSON output mode
- [x] Enhanced sync output with detection results
- [x] "Warn but allow" approach (generate configs even if client not detected)
- [x] skipBinaryDetection flag for CI/CD environments

**Status:** ✅ COMPLETE (911/911 tests passing, 83%+ code coverage)

**Goal:** Automatic client detection with intelligent fallback behavior. ✅ ACHIEVED

## Technical Decisions

### CLAUDE.md Injection Pattern

**Decision:** Use paired HTML comment markers for managed sections (Nx MCP pattern)

**Pattern:**
```markdown
<!-- overture configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

[Overture-managed content]

<!-- overture configuration end-->
```

**Rationale:**

1. **Ecosystem consistency** - Nx MCP server already uses this pattern, creating precedent
2. **Multi-tool friendly** - Multiple tools can inject non-overlapping sections safely
3. **Non-destructive** - Clear boundaries prevent accidental user content overwrites
4. **Tool namespacing** - `overture configuration` prefix avoids conflicts with other tools
5. **Conventional** - Follows established HTML comment conventions

**Alternatives considered:**

1. **Split-point marker** (original v0.1 approach):
   ```markdown
   <!-- Custom sections below this comment will be preserved -->
   ```
   - ❌ Less robust - assumes linear structure (managed above, custom below)
   - ❌ Cannot handle multiple tools injecting sections
   - ❌ Less clear about what's managed vs user-written

2. **XML-style tags**:
   ```markdown
   <overture:managed>
   </overture:managed>
   ```
   - ❌ Not valid markdown comments
   - ❌ May interfere with markdown rendering

3. **JSON frontmatter**:
   - ❌ Changes file format significantly
   - ❌ Not human-friendly
   - ❌ Breaks existing CLAUDE.md files

**Implementation:**
- `apps/cli/src/domain/constants.ts` - Marker constants
- `apps/cli/src/core/generator.ts` - `updateManagedSection()` method
- `apps/cli/src/core/generator.spec.ts` - 37 tests covering all edge cases
- Research documented in `research/claude-md-coordination.md` (from agent)

**Placement strategy:** Append at end of file to avoid disrupting user-written content.

**Migration:** Old split-point pattern detected and handled gracefully by appending new section.

## Success Metrics

Overture succeeds when:

1. **Configuration simplicity:**
   - Developers declare config ONCE in `~/.config/overture/config.yml`
   - `overture sync` updates ALL AI tool configs automatically
   - No manual editing of platform-specific config files

2. **Team alignment:**
   - Teams commit `.overture/config.yaml` to repos
   - New team members run `overture sync` and get consistent setup
   - AI tool usage patterns documented and shared

3. **AI effectiveness:**
   - Claude/Copilot read enhanced `CLAUDE.md`/`AGENTS.md`
   - MCPs used appropriately and orchestrated together
   - Developers report better AI assistance due to better guidance

4. **Ecosystem adoption:**
   - Plugin authors include recommended MCP configs in docs
   - MCP server authors provide Overture config snippets
   - "Just add this to your .overture/config.yaml" becomes common pattern

## Non-Goals (Important!)

- **NOT a replacement for Claude Code:** Overture enhances Claude Code, doesn't replace it
- **NOT a new plugin system:** Works with existing Claude Code plugin marketplace
- **NOT a new MCP protocol:** Works with existing MCP servers
- **NOT a new AI tool:** Overture configures existing AI tools, doesn't provide AI itself

**Overture is infrastructure—the plumbing that makes AI tools work better together.**

## Related Work

- **Dotfiles managers** (chezmoi, yadm): Overture is "dotfiles for AI configs"
- **Claude Code Flow:** Execution orchestrator (Overture generates docs, Flow executes)
- **Claude Squad:** Runtime multi-agent coordinator (Overture configures, Squad coordinates)
- **Plugin marketplaces:** Overture consumes plugins, doesn't host them

**Unique position:** Overture is the ONLY tool focused on multi-platform AI configuration management + documentation generation.

## Why This Matters

As AI-assisted development becomes standard, developers will use multiple tools:
- Claude Code for complex tasks
- Copilot for inline suggestions
- ChatGPT/Claude for research
- Multiple MCP servers for specialized capabilities

**Without Overture:**
- Configuration hell across tools
- Manual duplication and drift
- No shared team practices
- AI tools don't know how to work together

**With Overture:**
- Single source of truth for config
- Automatic sync across platforms
- Documented workflows and patterns
- AI tools orchestrated effectively

**Overture turns AI tool chaos into AI tool harmony.**
