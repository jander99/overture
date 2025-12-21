# Research Archive

This directory contains historical research documents that were created during the design phase but are no longer actively used. They're preserved for reference and historical context.

## Archived Documents

### Decision History

1. **simplification-guide.md** (2025-10-19)
   - Identified team/enterprise features to remove
   - Decision: Git handles all collaboration needs
   - Reason archived: Decision made, simplification completed

2. **SIMPLIFIED-SUMMARY.md** (2025-10-19)
   - Summary of architectural simplifications
   - Removed 30-40% of planned features
   - Reason archived: Changes incorporated into main docs

### Validation & Analysis

3. **validation-summary.md** (2025-10-19)
   - Research completeness assessment (95%)
   - Validated 35+ sources across all documents
   - Reason archived: Research phase complete

4. **theory-validation.md** (2025-10-19)
   - Validated plugin-as-primary-product theory
   - Identified missing components (MCP servers, slash commands)
   - Reason archived: Theory validated and incorporated

## Why These Were Archived

These documents served their purpose during the research and design phase:
- They captured decision-making processes
- They validated theories and approaches
- They guided simplification efforts

Now that decisions are made and incorporated into active documents, these serve as **historical reference only**.

## Active Documents

The following documents remain active in `/research/`:
- Core feature documentation (subagents, skills, hooks, plugins, MCP servers)
- Architecture recommendations (needs cleanup for simplification)
- Implementation plan (needs cleanup for simplification)
- User experience design (needs cleanup for simplification)
- CLAUDE.md coordination strategy
- Configuration files reference
- Overlaps and duplication analysis

## Document Lifecycle

```
Research → Validation → Decision → Implementation
    ↓          ↓          ↓            ↓
  Active    Active    Archive      Active Docs
  Docs      Docs      History      (Cleaned Up)
```

Documents move to archive when:
1. Their analysis is complete
2. Their conclusions are incorporated
3. They're no longer referenced for implementation
4. They serve only as historical context

---

**Archive Created**: 2025-10-19
**Purpose**: Preserve decision history without cluttering active documentation
