# Related Projects

This document tracks GitHub repositories and projects related to Claude Code configuration, MCP servers, and the broader Claude Code ecosystem.

## Claude Code Workflows (wshobson/agents)

**Repository**: https://github.com/wshobson/agents

**Type**: Comprehensive Plugin Marketplace

**Description**: A production-ready plugin marketplace for Claude Code with 64 plugins, 87 specialized agents, 47 skills, and 44 development tools organized into 23 categories.

### Key Features

- **Extensive Plugin Catalog**: Covers development, infrastructure, security, languages, AI/ML, data, and business domains
- **Self-Contained Plugins**: Each plugin includes agents, commands, and skills as isolated packages
- **Token Efficiency**: "Load only what you need" philosophy with minimal token overhead
- **Modular Design**: Single-purpose plugins that remain composable for complex workflows

### Plugin Structure

```
plugin-name/
├── agents/          # Specialized AI experts
├── commands/        # Tools and workflows
└── skills/          # Knowledge packages
```

### Architecture Insights

**Strengths:**
- Clear plugin boundaries and isolation
- Easy installation via `/plugin install`
- Well-organized by category and function
- Progressive disclosure (metadata → instructions → resources)

**Challenges Identified:**
- **Skill Duplication**: Testing patterns repeated across python-development, javascript-typescript, and developer-essentials with similar structures but separate implementations
- **No MCP Integration**: Plugins cannot declare MCP dependencies or requirements
- **Maintenance Overhead**: Updating common patterns requires changes across multiple plugins
- **No Validation**: No mechanism to ensure required tools/MCPs are available

### Relationship to Overture

This marketplace analysis directly informed Overture's design:

**Problems Overture Addresses:**
1. **Conceptual Duplication**: Multiple plugins have testing-patterns, architecture-patterns skills with similar structures but no shared source
2. **Missing MCP Links**: database-design plugin has no way to declare it needs sqlite/postgres MCPs
3. **No Context Awareness**: Installing kubernetes-operations doesn't validate kubectl is available
4. **Manual Discovery**: Users must separately discover and configure MCP servers

**How Overture Helps:**
- Maintains plugin-to-MCP registry mapping plugins to recommended servers
- Generates project-appropriate configurations (Python projects don't load Java plugin MCPs)
- Validates MCP dependencies when installing plugins
- Provides Claude with explicit guidance on which MCPs to use with which plugins

**Complementary Value:**
- wshobson/agents provides the plugin ecosystem
- Overture provides the orchestration layer connecting plugins to MCP servers
- Together: Complete, validated development environment

---

## Superpowers

**Repository**: https://github.com/obra/superpowers

**Type**: Claude Code Skills Library / Plugin

**Description**: A comprehensive plugin that enhances Claude Code with a curated library of proven engineering techniques and workflows.

### Key Features

- **Testing**: Test-driven development, async testing patterns, anti-pattern avoidance
- **Debugging**: Systematic 4-phase root cause analysis and verification methods
- **Collaboration**: Brainstorming, planning, code review, parallel agent workflows
- **Development**: Git worktrees, branch finishing, subagent-driven iteration
- **Meta**: Guidance for creating, testing, and sharing new skills

### Core Commands

- `/superpowers:brainstorm` - Interactive design refinement
- `/superpowers:write-plan` - Structured implementation planning
- `/superpowers:execute-plan` - Batched execution with checkpoints

### Philosophy

Emphasizes systematic approaches over ad-hoc solutions, test-driven development, and verification over assumptions. Works at the problem domain level rather than jumping to implementation.

### Installation

Available via the Claude Code plugin marketplace. Integrates with Claude Code's native skills system.

### Relationship to Overture

Superpowers demonstrates a well-structured plugin providing agents and skills. Overture would enhance the Superpowers experience by:
- Automatically configuring recommended MCP servers when Superpowers is installed
- Generating CLAUDE.md guidance on which MCPs to use with Superpowers workflows
- Ensuring required MCP dependencies (like filesystem) are available
- Providing context-aware configuration (e.g., project-specific settings)

## Claude Skills Collection

**Repository**: https://github.com/abubakarsiddik31/claude-skills-collection

**Type**: Curated Directory / Awesome List

**Description**: A curated GitHub repository that aggregates official and community-built Claude Skills, serving as a discovery and reference guide for the Claude Code ecosystem.

### Key Features

- **Comprehensive Catalog**: 80+ documented skills across 10+ categories
- **External Links**: Directory of links to skill repositories rather than hosting skills directly
- **Categorized Organization**: Skills organized by domain:
  - Document Skills (Word, PDF, PowerPoint, Excel)
  - Creative & Design (Generative art, visual themes, GIF creation)
  - Development & Code (UI components, testing, architecture patterns)
  - Data & Analysis (CSV processing, error tracing)
  - Writing & Research (Content extraction, brainstorming)
  - Learning & Knowledge (Knowledge graphs, problem-solving frameworks)
  - Media & Content (Video/transcript handling, EPUB parsing)
  - Collaboration (Code review, meeting analysis, Notion integration)
  - Security & Testing (Web testing, fuzzing, debugging frameworks)
  - Utility & Automation (File organization, skill creation tools)

### Structure

Tables with skill names, descriptions, and GitHub source links. Emphasizes that skills require Claude Pro/Max/Team/Enterprise access with code execution enabled.

### Strengths & Limitations

**Strengths**:
- Easy skill discovery across domains
- Community-driven aggregation
- Low barrier to contribution

**Limitations**:
- Manual curation (scalability challenge)
- No version or dependency information
- Discovery only (no installation/configuration management)
- No quality or compatibility standards

### Relationship to Overture

Demonstrates the fragmented ecosystem Overture addresses. This collection shows plugin discovery is only the first step. Overture provides the next steps:
- Configuration management after discovery
- MCP server orchestration for installed plugins
- Validation that plugin dependencies are satisfied
- Project-appropriate plugin recommendations

Could serve as a data source for Overture's plugin registry, mapping plugins to their recommended MCP servers.

## CCMem

**Repository**: https://github.com/adestefa/ccmem

**Type**: MCP Server

**Description**: An MCP server that adds persistent memory capabilities to Claude Code, transforming it from a stateless tool into a project-aware development partner by maintaining context across sessions.

### Key Features

- **Project Settings Storage**: Preserves build commands, test procedures, and deployment scripts
- **Architecture Documentation**: Records technology decisions and design patterns
- **Development History Tracking**: Logs stories, tasks, bugs, and lessons learned
- **Local SQLite Database**: Uses local SQLite storage instead of cloud-based or expensive embedding services
- **Automatic Memory Capture**: Intelligently records file changes, command executions, and architectural insights

### Operating Modes

- **Green Mode** (Active Development): Automatically captures code modifications, command outputs, and technical decisions in real-time
- **Brown Mode** (Discovery): Documents existing project structure when exploring unfamiliar codebases

### Installation

```bash
claude mcp add ccmem -- npx -y @adestefa/ccmem@latest
```

Streamlined installation via Claude's built-in MCP manager, eliminating manual configuration steps.

### Value Proposition

Maintains project-specific context to reduce repetitive explanations and provide context-aware development assistance tailored to each project's unique patterns and decisions.

### Relationship to Overture

Excellent example of project-specific MCP server that Overture would orchestrate:

**Configuration Challenge CCMem Faces:**
- Manual installation via `claude mcp add`
- No plugin integration (plugins can't declare CCMem as dependency)
- Users must discover and configure manually
- No project-scoped vs global configuration management

**How Overture Would Help:**
- Plugins could declare CCMem as recommended MCP server
- `overture init` could prompt: "Enable persistent memory with CCMem? [Y/n]"
- Project-scoped `.mcp.json` configuration (different DB per project)
- Generated CLAUDE.md guidance on when CCMem is useful
- Validation that CCMem is properly installed

**Complementary Value:**
- CCMem solves memory persistence across conversations
- Overture solves configuration persistence across projects
- Together: Complete development environment management

---

*Last updated: 2025-10-25*
