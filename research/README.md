# Overture Research Documentation

This directory contains comprehensive research on Claude Code's extensible features and architectural recommendations for the Overture project.

## Research Summary

**Date**: 2025-01-13
**Status**: ✅ Research Complete, Documentation Consolidated
**Active Documents**: 6 files
**Archived Documents**: 17 files (historical reference)

## Quick Start

For understanding Overture's design decisions, read in this order:
1. **[claude-md-coordination.md](./claude-md-coordination.md)** - Why we use CLAUDE.md marker patterns
2. **[symlink-configuration-model.md](./symlink-configuration-model.md)** - Why we rejected symlinks (important!)
3. **[architecture-recommendations.md](./architecture-recommendations.md)** - Key architectural decisions
4. **[overlaps-and-duplication.md](./overlaps-and-duplication.md)** - The core problem Overture solves

## Active Documentation

### High-Value Decision Documents

These documents capture critical design decisions and discoveries that shaped Overture:

1. **[claude-md-coordination.md](./claude-md-coordination.md)** (963 lines)
   - Discovery of Nx's paired-marker pattern (`<!-- start --> <!-- end -->`)
   - Why Overture uses CLAUDE.md for coordination
   - Evolution from manual to auto-generated sections
   - Decision rationale not documented elsewhere

2. **[symlink-configuration-model.md](./symlink-configuration-model.md)** (836 lines)
   - Proposed symlink-based configuration architecture (discarded)
   - **Why we rejected symlinks** in favor of direct config
   - Alternative approaches considered
   - Important for understanding "why we don't do X"

3. **[architecture-recommendations.md](./architecture-recommendations.md)** (712 lines)
   - Key architectural decisions from early design phase
   - Design principles that informed v0.1 and v0.2
   - Rationale for layered architecture, adapter pattern
   - Foundational decisions

4. **[overlaps-and-duplication.md](./overlaps-and-duplication.md)** (361 lines)
   - Analysis of configuration duplication problems across AI tools
   - **The core problem Overture solves**
   - Useful for explaining "why Overture exists"

### Reference Documentation

5. **[claude-code-components.md](./claude-code-components.md)** (~1,600 lines)
   - Consolidated research on Claude Code's 5 core component types:
     - MCP Servers (Model Context Protocol)
     - Hooks (event-driven automation)
     - Plugins (bundled collections)
     - Skills (modular capabilities)
     - Subagents (specialized AI assistants)
   - Cross-component patterns and duplication analysis
   - 35+ sources cited
   - **Note**: Consolidates 5 previously separate research files

6. **[README.md](./README.md)** (this file)
   - Navigation and context for research directory

## Archived Documents

The following documents are preserved in `archive/` for historical reference:

### Basic Component Research (Consolidated into claude-code-components.md)
1. **mcp-servers.md** (246 lines) - MCP server basics
2. **hooks.md** (152 lines) - Hooks basics
3. **plugins.md** (129 lines) - Plugins basics
4. **skills.md** (102 lines) - Skills basics
5. **subagents.md** (86 lines) - Subagents basics

### Configuration Research (Incorporated into architecture.md)
6. **configuration-files.md** (307 lines) - Claude Code config structure
7. **custom-commands.md** (518 lines) - Slash commands deep-dive
8. **directory-structure.md** (537 lines) - Abandoned Overture v0.1 external repo vision

### Implementation Planning (Superseded by actual implementation)
9. **implementation-plan.md** (1,314 lines) - v0.1 implementation plan (earlier version)
10. **user-experience.md** (777 lines) - UX research and workflows
11. **jira-workflow-example.md** (619 lines) - Example workflow integration
12. **development-mode.md** (418 lines) - Abandoned development mode concept

### Historical Decision Documents
13. **simplification-guide.md** (734 lines) - Team/enterprise feature removal
14. **SIMPLIFIED-SUMMARY.md** (602 lines) - Simplification summary
15. **theory-validation.md** (436 lines) - Plugin-centric architecture validation
16. **validation-summary.md** (274 lines) - Research completeness assessment
17. **README.md** (69 lines) - Archive index

**Total Archived**: ~7,500 lines across 17 files

See [archive/README.md](./archive/README.md) for details.

## Documentation Consolidation Summary

### What Changed (2025-01-13)

**Consolidated Files:**
- 5 component research files → `claude-code-components.md` (unified reference)

**Archived Files:**
- 12 files moved to `archive/` (basic research, abandoned designs, implementation planning)

**Result:**
- **Before**: 16 active files (~9,133 lines)
- **After**: 6 active files (~3,142 lines)
- **Reduction**: 63% fewer files, 66% fewer lines, focus on decision docs

**Benefits:**
- ✅ Critical decision docs easily accessible
- ✅ Historical context preserved in archive
- ✅ Reduced noise in main research/
- ✅ Single consolidated component reference
- ✅ Nothing lost

### What to Keep in Mind

**High-Value Documents:**
1. **claude-md-coordination.md** - Unique discovery of marker pattern approach
2. **symlink-configuration-model.md** - Why we rejected symlinks (prevents revisiting bad ideas)
3. **architecture-recommendations.md** - Foundational architectural choices
4. **overlaps-and-duplication.md** - Core problem statement

**Why These Matter:**
- Document **key decisions and discoveries**
- Explain **rejected approaches** (important for future contributors)
- Articulate **core problems** Overture solves
- Provide **context for architectural choices**

---

## Quick Links

**Project Root:**
- [Project README](../README.md)
- [PURPOSE.md](../docs/PURPOSE.md)
- [CLAUDE.md](../CLAUDE.md)

**Documentation:**
- [docs/architecture.md](../docs/architecture.md) - Complete architecture (Parts I & II)
- [docs/user-guide.md](../docs/user-guide.md) - User-facing documentation

**Archive:**
- [Archive README](./archive/README.md)
- Historical decision documents

---

**Last Updated**: 2025-01-13
**Status**: Documentation consolidated, 6 active research files
**Recommendation**: Use as reference for understanding Overture's design evolution
