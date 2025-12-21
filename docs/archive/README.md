# Archive Documentation

## ⚠️ Status: Cleaned Up (2025-01-12)

This archive previously contained 40+ research and implementation documents.
Most have been deleted as obsolete or consolidated into living documentation.

---

## Cleanup Summary (2025-01-12)

**Deleted:** 26 files (~435KB)

- 4 completed implementation plans (v0.1, v0.2, v0.2.5)
- 2 old migration guides
- 2 session notes
- 1 superseded research (MCP client research v1)
- 1 vision doc (extracted to roadmap.md)
- 16 deep archive research files (consolidated/superseded)

**Updated:** 3 files (reduced from 129KB to 72KB)

- Pruned unsupported clients (Cursor, Windsurf, Claude Desktop, VS Code, JetBrains)
- Added deprecation banners
- Focused on 3 supported clients only

**Kept:** 8 high-value decision documents (~182KB)

---

## What Remains

### Research Documents (Updated for 3-Client Support)

1. **copilot-agent-schema-research-2025-12-14.md** (33KB)
   - GitHub Copilot CLI schema research
   - Still valid for v0.3

2. **mcp-format-differences-2025-12-14.md** (18KB, updated)
   - MCP format differences across 3 supported clients
   - ⚠️ Contains historical 7-client info with deprecation banner

3. **mcp-client-research-v2.md** (30KB, updated)
   - Comprehensive MCP client research
   - ⚠️ Contains historical 7-client info with deprecation banner

4. **memory-mcp-compatibility-2025-12-14.md** (24KB, updated)
   - Memory MCP server compatibility testing
   - ⚠️ Contains historical 7-client info with deprecation banner

5. **multi-cli-roadmap-2025-12-18.md** (24KB)
   - Architectural decisions: AD-001, AD-002, AD-003
   - 3-client focus from the start

6. **opencode-integration-research-2025-12-18.md** (32KB)
   - OpenCode integration patterns
   - Still valid for v0.3

7. **RESEARCH_ASSESSMENT_2025_01_12.md** (16KB)
   - Assessment report that triggered this cleanup
   - Historical record

### Research Subdirectory

**High-Value Decision Documents:**

8. **research/claude-md-coordination.md** (24KB)
   - Discovery of Nx's paired-marker pattern
   - Why Overture uses CLAUDE.md for coordination
   - Unique architectural insight

9. **research/symlink-configuration-model.md** (20KB)
   - Why we rejected symlinks in favor of direct config
   - Important for preventing revisiting bad ideas

10. **research/architecture-recommendations.md** (20KB)
    - Foundational architectural decisions
    - Design principles for v0.1 and v0.2

11. **research/overlaps-and-duplication.md** (13KB)
    - The core problem Overture solves
    - Why Overture exists

12. **research/claude-code-components.md** (~40KB)
    - Consolidated component research
    - MCP servers, hooks, plugins, skills, subagents

**Archive Index:**

13. **research/archive/README.md**
    - Documents that all deep archive files were deleted
    - Explains consolidation

---

## Retention Policy

Documents are **KEPT** if they:

- ✅ Document unique discoveries (e.g., Nx marker patterns)
- ✅ Explain rejected approaches (prevents revisiting bad ideas)
- ✅ Articulate core problems Overture solves
- ✅ Contain architectural rationale not documented elsewhere

Documents are **DELETED** if they:

- ❌ Describe completed work with no future value
- ❌ Are superseded by newer research
- ❌ Reference obsolete architectures (7-client model)
- ❌ Contain only implementation details (available in git history)

---

## For Current Documentation

See `/docs/` for living documentation:

- [user-guide.md](../user-guide.md) - User guide
- [supported-clients.md](../supported-clients.md) - 3-client support matrix
- [roadmap.md](../roadmap.md) - Future plans
- [architecture.md](../architecture.md) - Current architecture
- [examples.md](../examples.md) - Usage examples
- [QUICKSTART.md](../QUICKSTART.md) - 5-minute setup

---

**Last Updated:** 2025-01-12  
**Status:** Cleaned up, focused on 3-client support
