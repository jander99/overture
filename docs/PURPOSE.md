# Overture Purpose & Vision

## The Problem

Developers using AI-assisted development tools face **configuration chaos**:

### The Configuration Mess

- **Multiple AI tools** with separate configs:
  - Claude Desktop: `~/Library/Application Support/Claude/mcp.json`
  - Claude Code user: `~/.config/claude/mcp.json`
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

**Overture v0.1 is a basic configuration-driven bridge for Claude Code.**

Currently implemented (98%+ coverage):
- ✅ Read `.overture/config.yaml` (project-level only)
- ✅ Install Claude Code plugins via `claude plugin install`
- ✅ Generate project `.mcp.json` with project-scoped MCPs
- ✅ Generate basic `CLAUDE.md` with plugin→MCP mappings
- ✅ Schema validation and basic MCP command checks

**Scope:** Claude Code only, project-level config only, basic templates only.

**Value:** Eliminates manual plugin installation + MCP configuration duplication across similar projects.

## What Overture Should Be (Intended Vision)

**Overture is a configuration orchestrator and documentation generator for the entire AI-assisted development ecosystem.**

### Three Pillars

#### Pillar 1: Multi-Platform MCP Configuration Manager

**Problem:** MCP servers configured inconsistently across multiple AI tools and config levels.

**Solution:**
- **Single source of truth:** `~/.config/overture.yml` (user global) + `.overture.yml` (project)
- **Multi-platform sync:** Generate configs for Claude Desktop, Claude Code, Copilot CLI, VSCode, IntelliJ
- **Smart precedence:** User global MCPs override project duplicates (no duplication)
- **Format adapters:** Translate Overture config → platform-specific formats
- **Audit & cleanup:** Scan existing configs, report conflicts, consolidate

**Example workflow:**
```bash
# User declares canonical MCP config once
~/.config/overture.yml:
  github: { command: mcp-github, scope: global }
  memory: { command: mcp-memory, scope: global }

# Project declares additional needs
.overture.yml:
  python-repl: { command: uvx, args: [mcp-server-python-repl] }
  github: { scope: global }  # Reference, not redefinition

# Sync to all platforms
overture sync
→ Updates Claude Desktop mcp.json
→ Updates Claude Code user config
→ Updates Claude Code project .mcp.json (only python-repl, not github)
→ Updates Copilot configs (if installed)
```

**Dotfiles integration:** Commit `~/.config/overture.yml` to dotfiles repo for machine portability.

#### Pillar 2: Claude Code Plugin Lifecycle Manager

**Problem:** Plugins installed globally but only needed for specific projects. No precedence model.

**Solution:**
- **User/project precedence:** User can have global plugins; project can declare additional plugins
- **Smart installation:** Only install plugins not already in user global config
- **Activation context:** Document which plugins are "active" for this project in `CLAUDE.md`
- **Version management:** (future) Pin plugin versions per project

**Example:**
```yaml
# User global: ~/.config/overture.yml
plugins:
  python-development:
    marketplace: claude-code-workflows
    scope: global

# Project: .overture.yml
plugins:
  python-development:
    marketplace: claude-code-workflows
    scope: global  # Reference only, already installed

  kubernetes-operations:
    marketplace: claude-code-workflows
    scope: project  # Install only when working on this project
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
# .overture.yml
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
   - `~/.config/overture.yml` can be version-controlled
   - Machine portability

### ❌ Out of Scope

1. **Execution orchestration:** Overture is NOT an execution engine like Claude Code Flow
2. **Multi-agent coordination:** NOT a runtime coordinator like Claude Squad
3. **Workflow execution:** NOT a task runner—it generates INSTRUCTIONS for Claude to follow
4. **Plugin marketplace:** NOT a registry or marketplace itself
5. **Plugin development:** NOT a plugin authoring framework

**Overture is a configuration and documentation tool, not an execution platform.**

## Phased Roadmap

### Phase 1: Foundation (Current - v0.1)
- [x] Basic CLI infrastructure
- [x] Project-level config for Claude Code
- [x] Plugin installation via Claude CLI
- [x] Basic .mcp.json generation
- [x] Simple CLAUDE.md templates
- [x] Validation engine

**Status:** ✅ COMPLETE (98%+ test coverage)

### Phase 2: Multi-Platform MCP Manager (v0.2)
- [ ] User global config: `~/.config/overture.yml`
- [ ] User/project precedence and deduplication
- [ ] Multi-platform adapters:
  - [ ] Claude Desktop
  - [ ] Claude Code user config
  - [ ] Copilot CLI (research needed)
  - [ ] VSCode Copilot (if exposed)
  - [ ] IntelliJ Copilot (if exposed)
- [ ] Config audit command: `overture audit`
- [ ] Config consolidation: `overture consolidate`

**Goal:** Eliminate MCP configuration duplication across platforms.

### Phase 3: Enhanced Documentation (v0.3)
- [ ] Template system for workflows
- [ ] User-defined MCP usage patterns
- [ ] Team best practices in config
- [ ] AGENTS.md generation for Copilot
- [ ] Workflow validation and linting

**Goal:** Generate rich, actionable AI guidance beyond basic project info.

### Phase 4: Intelligent Mappings (v0.4 - Research Phase)
- [ ] Plugin agent/skill metadata extraction
- [ ] Agent capability registry
- [ ] Automatic agent→MCP recommendations
- [ ] Community-driven mapping database
- [ ] ML-based usage pattern analysis (ambitious)

**Goal:** Automatically suggest optimal MCP configurations for plugins.

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
   - Developers declare config ONCE in `~/.config/overture.yml`
   - `overture sync` updates ALL AI tool configs automatically
   - No manual editing of platform-specific config files

2. **Team alignment:**
   - Teams commit `.overture.yml` to repos
   - New team members run `overture sync` and get consistent setup
   - AI tool usage patterns documented and shared

3. **AI effectiveness:**
   - Claude/Copilot read enhanced `CLAUDE.md`/`AGENTS.md`
   - MCPs used appropriately and orchestrated together
   - Developers report better AI assistance due to better guidance

4. **Ecosystem adoption:**
   - Plugin authors include recommended MCP configs in docs
   - MCP server authors provide Overture config snippets
   - "Just add this to your .overture.yml" becomes common pattern

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
