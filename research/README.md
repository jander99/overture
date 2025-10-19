# Overture Research Documentation

This directory contains comprehensive research on Claude Code's extensible features and architectural recommendations for the Overture project.

## Research Summary

**Date**: 2025-10-19
**Status**: ✅ Research Complete, Documentation Simplified
**Active Documents**: 12 files
**Archived Documents**: 4 files (historical reference)

## Quick Start

For implementation, read in this order:
1. **[implementation-plan.md](./implementation-plan.md)** - Technology stack and Nx architecture
2. **[architecture-recommendations.md](./architecture-recommendations.md)** - Detailed system design
3. **[claude-md-coordination.md](./claude-md-coordination.md)** - CLAUDE.md as coordination hub
4. **[user-experience.md](./user-experience.md)** - CLI and workflow design

## Documentation Status

### ✅ Ready for Implementation
Core technical documentation with sound architectural decisions:

1. **[implementation-plan.md](./implementation-plan.md)** (45KB)
   - Node.js + TypeScript + Nx architecture
   - Everything-as-Nx-project model
   - Generators and executors design
   - Smart rebuilds and dependency management
   - **Note**: Contains some team/enterprise references to remove

2. **[architecture-recommendations.md](./architecture-recommendations.md)** (20KB)
   - Complete architectural design
   - YAML schema with examples
   - Dependency resolution strategy
   - 4-phase implementation roadmap
   - **Note**: Contains enterprise sections to remove

3. **[claude-md-coordination.md](./claude-md-coordination.md)** (22KB)
   - CLAUDE.md as universal coordination mechanism
   - Deduplication patterns
   - Copilot sync strategy
   - Token optimization
   - **Note**: Contains team coordination language to simplify

4. **[user-experience.md](./user-experience.md)** (18KB)
   - Complete UX design
   - CLI interface specification
   - User workflows and journeys
   - Configuration architecture
   - **Note**: Contains team persona and workflows to remove

5. **[overlaps-and-duplication.md](./overlaps-and-duplication.md)** (13KB)
   - Cross-feature overlap analysis
   - Design principles for avoiding duplication
   - Composition over copying patterns
   - Conflict detection strategies

### 📚 Reference Documentation
Feature-specific documentation (stable, no changes needed):

6. **[subagents.md](./subagents.md)** (3.8KB)
   - Specialized AI assistants with isolated context
   - Configuration: `.claude/agents/`
   - Format: Markdown with YAML frontmatter
   - 6 sources cited

7. **[skills.md](./skills.md)** (4.6KB)
   - Modular capabilities with instructions and resources
   - Configuration: `~/.claude/skills/`, `.claude/skills/`
   - Format: `SKILL.md` + supporting files
   - 7 sources cited

8. **[hooks.md](./hooks.md)** (5.5KB)
   - Event-driven automation triggers
   - Configuration: `settings.json` at multiple scopes
   - Events: PreToolUse, PostToolUse, UserPromptSubmit, SessionStart, Notification, Stop
   - 8 sources cited

9. **[plugins.md](./plugins.md)** (5.4KB)
   - Bundled collections of features (public beta Oct 2025)
   - Installation: `/plugin` command
   - Components: subagents, skills, MCP servers, hooks, slash commands
   - 4 sources cited

10. **[mcp-servers.md](./mcp-servers.md)** (7.3KB)
    - Tool integrations via Model Context Protocol
    - Configuration: `~/.claude.json`, `.mcp.json`
    - Transports: stdio, HTTP, SSE
    - 7 sources cited

11. **[configuration-files.md](./configuration-files.md)** (8.8KB)
    - Directory structure and settings hierarchy
    - User-level: `~/.claude/`
    - Project-level: `.claude/`
    - 8 sources cited
    - **Note**: Contains enterprise precedence rules to simplify

## Simplified Architecture (Key Changes)

### Configuration Hierarchy: 2 Levels (Not 4)

**Simplified:**
```
Project Settings (.overture/ in project)
    ↓
User Settings (~/.overture/)
```

**Removed:**
- ❌ Enterprise managed settings
- ❌ Team-specific configuration
- ❌ Complex precedence rules

### Sharing = Git

No special "team" features needed:
- **Share your config**: `git push`
- **Use someone's config**: `git clone`
- **Contribute**: Standard git PR workflow

### What Overture Does

**In Scope:**
- Generate plugin structures
- Validate configurations
- Build plugins
- Sync to Claude Code / Copilot
- Generate CLAUDE.md
- Detect duplication
- Smart rebuilds (Nx)

**Out of Scope:**
- ~~Team management~~ (git handles this)
- ~~Enterprise features~~
- ~~Collaboration tools~~ (git provides)
- ~~Profile management~~

## Archived Documents

The following documents are preserved in `archive/` for historical reference:

1. **[archive/simplification-guide.md](./archive/simplification-guide.md)**
   - Decision document for removing team/enterprise features
   - Identified 30-40% scope reduction
   - Archived: Decision made and incorporated

2. **[archive/SIMPLIFIED-SUMMARY.md](./archive/SIMPLIFIED-SUMMARY.md)**
   - Summary of architectural simplifications
   - Quick reference for what changed
   - Archived: Changes incorporated into active docs

3. **[archive/validation-summary.md](./archive/validation-summary.md)**
   - Research completeness assessment
   - Validated 35+ sources
   - Archived: Research phase complete

4. **[archive/theory-validation.md](./archive/theory-validation.md)**
   - Validated plugin-as-primary-product theory
   - Identified missing components (MCP servers, slash commands)
   - Archived: Theory validated and incorporated

See [archive/README.md](./archive/README.md) for details.

## Key Findings Summary

### 1. Plugin Composition (Validated ✅)

Plugins bundle **5 component types**:
1. MCP Servers (foundation - provide tools)
2. Subagents (specialized AI agents)
3. Skills (modular capabilities)
4. Slash Commands (user-invoked workflows)
5. Hooks (event-driven automation)

### 2. Technology Stack Decision (✅)

**Node.js + TypeScript + Nx + PNPM**

Why: Nx is perfect for dependency graph management and smart rebuilds. Everything-as-a-project model maps directly to our domain.

### 3. CLAUDE.md as Coordination Hub (✅)

Use CLAUDE.md as single source of truth:
- Project conventions
- Tool documentation
- Architecture overview
- Commands and workflows

Generate `copilot-instructions.md` from CLAUDE.md.

### 4. Simplified Configuration (✅)

Two levels only:
- User preferences (`~/.overture/`)
- Project settings (`.overture/` - committed to git)

Git handles all sharing and collaboration.

### 5. Nx Architecture (✅)

Each component is an Nx project:
- Automatic dependency tracking
- Smart rebuilds (only changed components)
- Parallel builds
- Local caching
- Visual dependency graph

## Implementation Phases

**Phase 1** (Weeks 1-4): Core Nx workspace + CLI + generators
**Phase 2** (Weeks 5-8): Smart dependencies + affected builds
**Phase 3** (Weeks 9-12): CLAUDE.md generation + sync
**Phase 4** (Weeks 13-16): Polish + distribution (NPM, Homebrew)

## Research Methodology

1. **Parallel Search**: 5+ simultaneous web searches
2. **Source Diversity**: Official docs + community guides + GitHub
3. **Structured Documentation**: Consistent template for features
4. **Cross-Cutting Analysis**: Identified overlaps and patterns
5. **Theory Validation**: Tested plugin-centric architecture
6. **Simplification**: Removed 30-40% scope (team/enterprise features)

## Sources

**Total**: 35+ unique sources across all documents

**Quality**: All official documentation cited, cross-referenced with community examples

**Validation**: High confidence, ready for implementation

## Next Steps

1. ✅ Research complete
2. ✅ Architecture validated
3. ✅ Documentation simplified
4. ⏳ Clean up team/enterprise references in main docs (optional before starting)
5. ⏳ Set up initial Nx workspace
6. ⏳ Begin Phase 1 implementation

## Document Maintenance Notes

### Documents needing cleanup (low priority):
- `implementation-plan.md` - Remove Nx Cloud team caching sections
- `architecture-recommendations.md` - Remove enterprise configuration sections
- `user-experience.md` - Remove team lead persona and workflows
- `configuration-files.md` - Simplify precedence to 2 levels
- `claude-md-coordination.md` - Simplify "team" language to "git"

These cleanups are **cosmetic** - the core technical designs are sound. Can be done during or after Phase 1 implementation.

---

## Quick Links

**Project Root:**
- [Project README](../README.md)
- [VISION.md](../VISION.md)
- [CLAUDE.md](../CLAUDE.md)

**Archive:**
- [Archive README](./archive/README.md)
- Historical decision documents

---

**Last Updated**: 2025-10-19
**Status**: Documentation simplified and ready for implementation
**Recommendation**: Begin Phase 1 (Nx workspace setup)
