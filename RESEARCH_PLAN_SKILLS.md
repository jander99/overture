# Overture Skills Sync Research Plan

**Created:** December 24, 2025  
**Updated:** December 24, 2025  
**Status:** Implementation Plan Complete  
**Related:** [CLI Feature Comparison](docs/archive/research/cli-feature-comparison-2025-12-24.md) | [Implementation Plan](docs/implementation-plan-skills-sync.md)

---

## Executive Summary

This research plan outlines extending Overture to sync **Agent Skills** across all three supported CLI platforms (Claude Code, GitHub Copilot CLI, OpenCode). Since all three CLIs implement the same SKILL.md format, this is a straightforward file-sync feature—no compilation or transformation required.

### Goals

1. **Sync Skills to Global Dotfiles** — Copy SKILL.md files from Overture config repo to each CLI's skill directory
2. **Copy Skills to Projects** — Enable copying global skills into project directories for team sharing
3. **Simple File-Based Approach** — No YAML compilation; users write standard SKILL.md files directly

### Non-Goals (Separate Research)

- Custom Agents management (different formats per CLI, higher complexity)
- YAML-to-Markdown compilation
- Composable traits system

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│         Overture Config Repo (~/.config/overture/)          │
│              (git-managed, source of truth)                 │
│                                                             │
│  config.yaml          # Global MCP servers + settings       │
│  skills/              # Skill source files (SKILL.md)       │
│    └── debugging/     │                                     │
│        └── SKILL.md   │                                     │
│    └── code-review/   │                                     │
│        └── SKILL.md   │                                     │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ overture sync (includes skills)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Global Dotfiles                          │
│            (CLI-native locations, one-way sync)             │
│                                                             │
│  ~/.claude/skills/<name>/SKILL.md                           │
│  ~/.github/skills/<name>/SKILL.md                           │
│  ~/.opencode/skill/<name>/SKILL.md                          │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ overture skill cp <name>
                    │ (global → project, one-way)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Project Directory                        │
│                                                             │
│  .claude/skills/<name>/SKILL.md                             │
│  .github/skills/<name>/SKILL.md                             │
│  .opencode/skill/<name>/SKILL.md                            │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision        | Choice                                              | Rationale                                          |
| --------------- | --------------------------------------------------- | -------------------------------------------------- |
| Source format   | Native SKILL.md only                                | All CLIs use same format; no transformation needed |
| Sync direction  | One-way (repo → dotfiles → project)                 | Avoids conflict resolution complexity              |
| Copy behavior   | Skip with warning (default), `--force` to overwrite | Safe default, explicit override                    |
| Skill discovery | Directory-based (`skills/<name>/SKILL.md`)          | Matches CLI conventions                            |

---

## Phase 1: Research SKILL.md Format _(Separate Session)_

### Goal

Document the SKILL.md specification across all three CLIs to confirm format compatibility.

### Tasks

1. **Locate canonical specification**
   - Find Agent Skills spec (GitHub repo or documentation)
   - Determine if there's an official schema

2. **Document SKILL.md format**
   - Required frontmatter fields (if any)
   - Optional frontmatter fields
   - Markdown body structure
   - Examples from official documentation

3. **Confirm per-CLI compatibility**

   | Aspect         | Claude Code         | Copilot CLI         | OpenCode             |
   | -------------- | ------------------- | ------------------- | -------------------- |
   | Global path    | `~/.claude/skills/` | `~/.github/skills/` | `~/.opencode/skill/` |
   | Project path   | `.claude/skills/`   | `.github/skills/`   | `.opencode/skill/`   |
   | File structure | `<name>/SKILL.md`   | `<name>/SKILL.md`   | `<name>/SKILL.md`    |
   | Frontmatter    | ?                   | ?                   | ?                    |
   | Discovery      | ?                   | ?                   | ?                    |

### Deliverables

- SKILL.md format specification document
- Confirmation that all CLIs use identical format (or document differences)

### Breakpoint 1

**Checkpoint questions:**

- Are there any CLI-specific variations in SKILL.md format?
- Any edge cases (frontmatter, encoding, etc.) to handle?

---

## Phase 2: Design CLI Commands

### Goal

Define the user-facing CLI commands for skill management.

### Commands Overview

| Command                    | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `overture sync`            | Sync MCP configs AND skills to global dotfiles |
| `overture skill list`      | List available skills                          |
| `overture skill cp <name>` | Copy skill from global to current project      |

### 2.1 Enhanced `overture sync`

**Current behavior:** Syncs MCP configurations only

**New behavior:** Also syncs skills from `~/.config/overture/skills/` to each CLI's global skill directory

```bash
overture sync

# Output:
# Syncing MCP configurations...
#   ✓ Claude Code: ~/.claude.json
#   ✓ Copilot CLI: ~/.config/github-copilot/mcp.json
#   ✓ OpenCode: ~/.config/opencode/opencode.json
#
# Syncing skills...
#   ✓ debugging → ~/.claude/skills/, ~/.github/skills/, ~/.opencode/skill/
#   ✓ code-review → ~/.claude/skills/, ~/.github/skills/, ~/.opencode/skill/
#
# Synced 3 MCP servers, 2 skills to 3 clients
```

**New flags:**

- `--skills-only` — Only sync skills (skip MCP)
- `--mcp-only` — Only sync MCP configs (skip skills)

### 2.2 `overture skill list`

**Purpose:** List available skills from Overture config repo

```bash
overture skill list

# Output:
# NAME          DESCRIPTION
# debugging     Advanced debugging techniques
# code-review   Code review best practices
```

**Flags:**

- `--json` — Output as JSON
- `--source` — Show source path

### 2.3 `overture skill cp <name>`

**Purpose:** Copy a skill from global dotfiles into current project

```bash
overture skill cp debugging

# 1. Verify skill exists in global dotfiles
# 2. Detect which CLIs are configured for this project
# 3. Copy skill directory to each CLI's project location
# 4. Report summary

# Output:
# Copied 'debugging' skill:
#   ✓ .claude/skills/debugging/SKILL.md
#   ✓ .github/skills/debugging/SKILL.md
#   ✓ .opencode/skill/debugging/SKILL.md
```

**Flags:**

- `--force` — Overwrite if skill exists in project
- `--client <name>` — Only copy for specified client

### Deliverables

- CLI command specifications
- Flag and option definitions
- Example usage scenarios

### Breakpoint 2

**Checkpoint questions:**

- Command naming acceptable? **YES**
- Any additional flags needed? **NO**
- Should `skill cp` copy from config repo or from global dotfiles? **Config repo (source of truth)**

---

## Phase 3: Implementation Planning _(Complete)_

**Status:** Complete - See [Implementation Plan](docs/implementation-plan-skills-sync.md)

### Key Decisions Confirmed

| Decision       | Choice                                      | Rationale              |
| -------------- | ------------------------------------------- | ---------------------- |
| Skill source   | `~/.config/overture/skills/<name>/SKILL.md` | Single source of truth |
| Registration   | Auto-discovery (no config.yaml entry)       | Simpler UX             |
| Sync direction | One-way (config repo → dotfiles)            | Avoids conflicts       |
| Copy source    | Config repo (not dotfiles)                  | Source of truth        |

### Target Paths

| Client      | Global Path                         | Project Path                      |
| ----------- | ----------------------------------- | --------------------------------- |
| Claude Code | `~/.claude/skills/<name>/SKILL.md`  | `.claude/skills/<name>/SKILL.md`  |
| Copilot CLI | `~/.github/skills/<name>/SKILL.md`  | `.github/skills/<name>/SKILL.md`  |
| OpenCode    | `~/.opencode/skill/<name>/SKILL.md` | `.opencode/skill/<name>/SKILL.md` |

### Implementation Summary

- **New library:** `libs/core/skill/` with SkillDiscovery, SkillSyncService, SkillCopyService
- **New types:** `libs/domain/config-types/src/lib/skill.types.ts`
- **New commands:** `skill list`, `skill cp`
- **Enhanced:** `overture sync` includes skills, with `--skills-only` and `--mcp-only` flags
- **Effort estimate:** ~12 hours
- **Full details:** [docs/implementation-plan-skills-sync.md](docs/implementation-plan-skills-sync.md)

---

## Appendix: Reference Links

- [CLI Feature Comparison (Dec 2025)](docs/archive/research/cli-feature-comparison-2025-12-24.md)
- Agent Skills Specification: TBD (to be located in Phase 1)
- Claude Code Docs: https://docs.anthropic.com/en/docs/claude-code
- Copilot CLI Docs: https://docs.github.com/en/copilot
- OpenCode Docs: https://opencode.ai/docs/

---

## Appendix: claude-config Analysis Summary

The [jander99/claude-config](https://github.com/jander99/claude-config) repository was analyzed as prior art. Key findings:

**Relevant patterns:**

- Directory-based skill/trait organization (`traits/<category>/<name>.md`)
- Markdown files with optional YAML frontmatter
- CLI commands: `build`, `validate`, `install`, `list`

**Not applicable (out of scope):**

- YAML-to-Markdown compilation (we use native SKILL.md)
- Composable traits system (Skills standard supersedes this)
- Agent coordination graphs (Agents feature is separate research)
- Jinja2 template rendering (no transformation needed)

The main lesson: Since all three CLIs now support the same SKILL.md format, Overture's value is in **syncing files across platforms**, not transforming them.
