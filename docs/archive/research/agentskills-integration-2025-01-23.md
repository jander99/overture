# Agent Skills Integration Analysis for Overture

**Date:** January 23, 2025  
**Status:** Research Complete  
**Priority:** High  
**Target Release:** v0.4.0

## Executive Summary

**Agent Skills** is an open format (developed by Anthropic, adopted by 10+ AI tools) for packaging procedural knowledge, workflows, and domain expertise into portable, version-controlled folders that AI agents can discover and use on-demand. This analysis identifies 5 concrete integration opportunities for Overture to leverage Agent Skills alongside its existing MCP configuration orchestration.

---

## What is agentskills.io?

### Overview

Agent Skills is a lightweight, open standard for extending AI agent capabilities through **progressive disclosure**:

- **Discovery**: Agents load only skill metadata (name, description) at startup
- **Activation**: When relevant, agents load full SKILL.md instructions into context
- **Execution**: Agents follow instructions, optionally executing bundled scripts/resources

### Structure

```
my-skill/
├── SKILL.md          # Required: YAML frontmatter + Markdown instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation loaded on-demand
└── assets/           # Optional: templates, resources
```

### SKILL.md Format

```yaml
---
name: pdf-processing
description: Extract text and tables from PDF files, fill forms, merge documents.
license: Apache-2.0
metadata:
  author: example-org
  version: '1.0'
---
# PDF Processing Instructions
[Markdown content with step-by-step guidance]
```

### Adoption

Supported by: **OpenCode**, **Cursor**, **Amp**, **Letta**, **Goose**, **GitHub**, **VS Code**, **Claude Code**, **Claude.ai**, **OpenAI Codex**

### Key Resources

- **Specification**: https://agentskills.io/specification
- **GitHub Repo**: https://github.com/agentskills/agentskills
- **Example Skills**: https://github.com/anthropics/skills (25.8k stars)
- **Reference Library**: skills-ref Python tool for validation/generation
- **Best Practices**: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

---

## How Overture Can Utilize Agent Skills

### 1. **Generate Skills from MCP Configurations** ⭐ Top Priority

**Concept**: Auto-generate Agent Skills that document how to effectively use configured MCP servers.

**Implementation**:

- Overture reads config.yaml MCP server definitions
- For each MCP server, generate a corresponding SKILL.md with:
  - Name: `{mcp-server-name}-usage`
  - Description: When and how to use this MCP server
  - Instructions: Best practices, common commands, examples
  - References: Link to MCP server documentation

**Example**:

```yaml
# config.yaml has:
mcp:
  filesystem:
    command: 'npx'
    args: ['-y', '@modelcontextprotocol/server-filesystem', '${HOME}']
```

**Generated Skill**:

```markdown
---
name: filesystem-mcp
description: Use the filesystem MCP server for advanced file operations, directory management, and file search within allowed directories.
metadata:
  generated-by: overture
  mcp-server: filesystem
---

# Filesystem MCP Server Usage

## When to use this skill

Use when you need to perform file operations beyond basic read/write...

## Available Tools

- filesystem_read_file: Read complete file contents
- filesystem_write_file: Create or overwrite files
- filesystem_list_directory: Get directory listings
  ...
```

**Value Proposition**:

- Bridges MCP tools with procedural knowledge on how to use them
- Reduces learning curve for developers using MCP servers
- Leverages Overture's existing config knowledge

---

### 2. **Skills Directory Management & Multi-Platform Sync**

**Concept**: Extend Overture's multi-platform orchestration to manage Agent Skills alongside MCP configs.

**Implementation**:

```yaml
# Extended config.yaml schema:
version: '1.0'

mcp:
  filesystem:
    command: 'npx'
    args: ['-y', '@modelcontextprotocol/server-filesystem']

skills:
  enabled: true
  sources:
    - local: ./.overture/skills
    - registry: anthropics/skills
      include: ['pdf-processing', 'data-analysis']
```

**Sync Behavior**:

- Discover skills from local directories and registries
- Validate SKILL.md frontmatter and structure
- Copy/symlink to platform-specific directories:
  - **OpenCode**: `~/.config/opencode/skills/` or `.opencode/skills/`
  - **Claude Code**: `.claude/skills/` or `~/.claude/skills/`
  - **Cursor**: `.cursor/skills/` (TBD - verify path)

**CLI Commands**:

```bash
overture skills list              # Show all available skills
overture skills enable pdf-processing
overture skills sync              # Sync to all detected clients
overture doctor --skills          # Validate skills configuration
```

**Value Proposition**:

- Consistent skills management across AI tools
- Single source of truth for skills (like MCP configs)
- Automatic discovery and validation

---

### 3. **Enhanced CLAUDE.md as an Agent Skill**

**Concept**: Transform Overture's generated CLAUDE.md into a proper Agent Skill with frontmatter.

**Current CLAUDE.md** (Overture v0.3.0):

```markdown
# Project Configuration for Claude Code

This project uses the following MCP servers:

- **filesystem**: Access project files
- **memory**: Persistent context across conversations
  ...
```

**Enhanced as Agent Skill**:

```markdown
---
name: {project-name}-context
description: Project-specific MCP configuration, architecture guidelines, and development workflows for {project-name}.
metadata:
  project: {project-name}
  generated-by: overture
  version: "1.0"
---

# {Project Name} Development Guidance

## Available MCP Servers

This project uses the following MCP servers:

- **filesystem**: Access project files and directories
- **memory**: Maintain context across conversations
  ...

## Project-Specific Workflows

[Auto-generated from project type or user-defined templates]

## Architecture Guidelines

[Optionally include project architecture info]
```

**Location**: Save as `.claude/skills/{project-name}-context/SKILL.md`

**Value Proposition**:

- Makes project documentation discoverable via Skills system
- Agents automatically load project context when relevant
- Seamless integration with existing Overture workflow

---

### 4. **Skills Validation & Diagnostics**

**Concept**: Add Agent Skills validation to `overture doctor` diagnostics.

**Implementation**:

- Integrate **skills-ref** Python library or reimplement validation in TypeScript
- Check SKILL.md frontmatter schema compliance
- Validate file structure (references/, scripts/, assets/)
- Detect naming conflicts between skills
- Verify compatibility fields match client capabilities

**CLI Output**:

```bash
$ overture doctor --skills

✓ Found 12 skills across 3 clients
✓ All skills have valid frontmatter
⚠ Warning: 'pdf-processing' in .claude/skills/ shadows global skill
✗ Error: 'data-analysis/SKILL.md' missing required 'description' field
✓ skills-ref validation passed for 11/12 skills

Recommendations:
- Fix SKILL.md frontmatter in data-analysis
- Consider renaming local pdf-processing skill to avoid shadowing
```

**Value Proposition**:

- Prevent broken skills from degrading agent performance
- Early detection of configuration issues
- Consistent with Overture's validation philosophy

---

### 5. **Skills Marketplace CLI Integration**

**Concept**: Add marketplace/registry integration for discovering and installing community Skills.

**Implementation**:

```bash
# Discovery
overture skills search pdf
overture skills info pdf-processing

# Installation from anthropics/skills or other registries
overture skills install pdf-processing --source anthropics/skills
overture skills install myorg/custom-skill --source github

# Management
overture skills list --installed
overture skills update pdf-processing
overture skills remove pdf-processing
```

**Config Integration**:

```yaml
skills:
  sources:
    - registry: anthropics/skills
      include: ['pdf-processing', 'data-analysis']
    - registry: github:myorg/private-skills
      auth: ${GITHUB_TOKEN}
      include: ['company-branding']
```

**Value Proposition**:

- Centralized skills management (like npm, pip)
- Easy access to community-contributed skills
- Version control and updates

---

## Technical Considerations

### Dependencies

| Dependency              | Purpose                          | Status                 |
| ----------------------- | -------------------------------- | ---------------------- |
| **skills-ref** (Python) | Skill validation, XML generation | Available, MIT license |
| **js-yaml**             | YAML parsing                     | ✅ Already in Overture |
| **Git**                 | Clone skill repositories         | System dependency      |
| **TypeScript**          | Reimplement skills-ref?          | Decision needed        |

### Client Compatibility Matrix

| Client             | Skills Support | Overture Support | Priority  |
| ------------------ | -------------- | ---------------- | --------- |
| OpenCode           | ✅ Yes         | ✅ Yes           | 🔥 High   |
| Claude Code        | ✅ Yes         | ✅ Yes           | 🔥 High   |
| Cursor             | ✅ Yes         | ⚠️ Planned       | ⚠️ Medium |
| GitHub Copilot CLI | ❌ Unknown     | ✅ Yes           | ⚠️ Low    |
| VS Code            | ✅ Yes         | ❌ No            | ⚠️ Future |

### Implementation Challenges

1. **Skills Directory Paths**: Each client stores skills differently - need to research/document paths
2. **Python vs TypeScript**: skills-ref is Python; Overture is TypeScript. Options:
   - Shell out to Python CLI (simple, external dependency)
   - Reimplement in TypeScript (self-contained, more work)
   - Hybrid: TypeScript for core, Python for advanced validation
3. **Marketplace API Design**: No standard registry API exists (unlike npm) - need to design GitHub-based discovery
4. **User Education**: Skills vs MCP distinction may confuse users - need clear documentation
5. **Skills Syntax Variations**: Clients may interpret SKILL.md differently - need compatibility testing

### Architecture Integration

**Fits Overture's Existing Patterns**:

- ✅ Adapter pattern: Create `skills-client-adapters/` parallel to `client-adapters/`
- ✅ Config schema: Extend existing Zod schemas
- ✅ Sync engine: Reuse multi-platform sync logic
- ✅ Validation: Integrate with existing validator service

**New Components Needed**:

```
libs/
  core/
    skills/                    # New library
      src/
        lib/
          skills-loader.ts
          skills-validator.ts
          skills-generator.ts
          skills-sync.ts
  adapters/
    skills-adapters/          # New library
      src/
        opencode-skills-adapter.ts
        claude-code-skills-adapter.ts
        cursor-skills-adapter.ts
```

---

## Recommended Next Steps

### Phase 1: Research & Validation (Week 1-2)

1. ✅ Research complete (this document)
2. **Prototype CLAUDE.md → Agent Skill conversion**
   - Modify existing `generator.ts` to add YAML frontmatter
   - Test with Claude Code and OpenCode
3. **Document Skills directory paths**
   - Install OpenCode, Claude Code, Cursor
   - Locate where each stores skills
   - Test custom skill loading
4. **Evaluate skills-ref integration**
   - Test skills-ref CLI locally
   - Assess Python dependency impact
   - Plan TypeScript validation alternative

### Phase 2: Core Features (Week 3-6)

1. **Extend config schema** (`libs/domain/config-schema`)
   - Add `skills` section to Zod schema
   - Support `sources`, `enabled`, `include` fields
2. **Implement Skills sync** (Top 2 clients first)
   - Build OpenCode skills adapter
   - Build Claude Code skills adapter
   - Integrate with existing sync-engine
3. **Add Skills validation to doctor**
   - Implement basic SKILL.md frontmatter validation
   - Add skills checks to doctor command
4. **Generate enhanced CLAUDE.md as skill**
   - Modify `generateClaudeCodeDoc` in `generator.ts`
   - Output to `.claude/skills/{project}-context/SKILL.md`

### Phase 3: Advanced Features (Week 7-12)

1. **MCP → Skills auto-generation**
   - Create skill templates for common MCP servers
   - Generate usage skills from MCP config metadata
2. **Skills marketplace CLI**
   - Implement `overture skills` command group
   - Add GitHub-based registry integration
   - Support install/update/remove operations
3. **Skills discovery & catalog**
   - Build local skills database
   - Add search/filter capabilities
   - Generate skills inventory reports

### Phase 4: Documentation & Testing (Ongoing)

1. Update user guide with Skills integration
2. Create Skills authoring tutorial
3. Add Skills examples to docs/examples.md
4. Write integration tests for Skills sync
5. Update roadmap and changelog

---

## Key Decision Points

### Decision 1: Should Overture manage Skills?

**Recommendation**: ✅ **Yes**

- Skills and MCP are complementary (tools vs procedures)
- Overture's multi-platform orchestration applies perfectly
- Enhances value proposition for users

### Decision 2: Python dependency acceptable?

**Recommendation**: ⚠️ **Start with TypeScript, evaluate Python later**

- Keep Overture self-contained initially
- Implement basic YAML validation in TypeScript
- Consider skills-ref integration for advanced features in Phase 3

### Decision 3: Which clients to support first?

**Recommendation**: 🎯 **OpenCode + Claude Code**

- Highest overlap with current Overture user base
- Both have confirmed Skills support
- Anthropic-maintained, so reference implementations available

### Decision 4: Auto-generate MCP skills or manual only?

**Recommendation**: 🔀 **Both**

- Auto-generate basic skills for configured MCP servers (Phase 2)
- Allow users to override/customize via local skills (Phase 3)
- Provides value immediately while supporting customization

---

## Conclusion

Agent Skills integration represents a **strategic expansion** of Overture's capabilities:

**Alignment with Mission**: Overture manages MCP configs; adding Skills management is a natural extension to orchestrate _all_ AI agent configuration

**User Value**:

- Reduces friction in multi-platform AI development
- Auto-generates procedural knowledge from existing MCP configs
- Provides marketplace access to community skills

**Technical Feasibility**:

- Builds on existing architecture patterns
- Moderate complexity (simpler than MCP protocol)
- Clear implementation path

**Risk Level**: **Low-Medium**

- Skills format is stable and well-documented
- Broad industry adoption reduces obsolescence risk
- Can be implemented incrementally without breaking changes

**Recommended Action**: Proceed with **Phase 1 research & prototyping** to validate assumptions, then commit to **Phase 2 core features** for next release (v0.4.0).

---

## Additional Resources

- **Agent Skills Docs**: https://agentskills.io
- **Specification**: https://agentskills.io/specification
- **Example Skills**: https://github.com/anthropics/skills
- **Reference Library**: https://github.com/agentskills/agentskills/tree/main/skills-ref
- **Best Practices**: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- **Anthropic Blog**: https://anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
