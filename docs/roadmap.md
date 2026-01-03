# Overture Roadmap

**Last Updated:** 2025-12-31  
**Current Version:** v0.3.0  
**Status:** Living Document

---

## Vision

**Overture's Mission:** Unify AI coding assistant configuration across tools and teams, eliminating duplication and enabling seamless workflow coordination.

**Core Principles:**

- Single source of truth for MCP configurations
- Multi-client sync from one config file
- Project and user scopes with intelligent merging
- Simple, maintainable, extensible

---

## Recently Completed (v0.3.0 - January 2025)

### AI Agent Sync ✅ SHIPPED

**Problem:** Users needed to manage subagent configurations separately for each AI client (Claude Code, OpenCode, GitHub Copilot CLI).

**Solution:** Universal agent sync from a single source with automatic format transformation.

**Features:**

- **Split Source Pattern**: Agent configuration (YAML) + system prompt (Markdown)
- **Global and Project Agents**: `~/.config/overture/agents/` for global, `.overture/agents/` for project-specific
- **Model Mapping**: Logical model names (`claude-3-5-sonnet`) resolve to client-specific IDs
- **Automatic Transformation**: Converts to each client's native format
  - Claude Code: `~/.claude/agents/<name>.md` (YAML frontmatter + Markdown)
  - OpenCode: `~/.config/opencode/agent/<name>.md` (same format)
  - GitHub Copilot CLI: `.github/agents/<name>.agent.md` (project-only)
- **Sync Status Tracking**: Four states (inSync, outOfSync, onlyInGlobal, onlyInProject)
- **Validation**: YAML syntax, schema validation, paired file verification

**Commands:**

```bash
# Sync agents to all clients
overture sync

# Skip agent sync
overture sync --skip-agents

# Check agent sync status
overture doctor --verbose
```

**Status:** ✅ **Released in v0.3.0** (PR #16)

---

### Diagnostics System Refactoring ✅ SHIPPED

**Problem:** The `doctor` command was a monolithic 1,727-line file that was hard to maintain, test, and extend.

**Solution:** Complete architectural refactoring to hexagonal architecture with modular checkers.

**Improvements:**

- **95.9% Code Reduction**: doctor.ts went from 1,727 lines → 71 lines
- **New Libraries**:
  - `@overture/diagnostics-types` - Type definitions (19 tests)
  - `@overture/diagnostics` - Checker implementations (92 tests)
  - `@overture/formatters` - Output formatters (76 tests)
- **Parallel Execution**: All checkers run concurrently (3-5s → 1-2s)
- **98%+ Test Coverage**: 187 new tests across diagnostics modules
- **Modular Design**: Each checker is independent and testable
- **Multiple Output Formats**: Summary, detailed, verbose, JSON, quiet

**Checkers Implemented:**

1. ConfigRepoChecker - Validates config repository
2. GlobalAgentsChecker - Checks global agents
3. ProjectAgentsChecker - Checks project agents
4. AgentSyncChecker - Detects agent sync status
5. ClientsChecker - Detects installed AI clients
6. McpCommandsChecker - Tests MCP command availability

**Formatter Strategy:**

- SummaryFormatter - Concise overview (default)
- DetailedFormatter - Full diagnostics with suggestions
- VerboseFormatter - Agent-by-agent breakdown
- JsonFormatter - Machine-readable output
- QuietFormatter - Errors/warnings only

**Status:** ✅ **Released in v0.3.0** (PR #17)

**Architecture:** See [docs/architecture.md](architecture.md#diagnostics-system)

---

## Near-Term (v0.4 - Q1 2025)

### 1. Import & Cleanup Commands ✅ SHIPPED

**Problem:** Users with existing MCP configurations need an easy migration path to Overture without manually recreating their configs.

**Solution:** ~~Two new commands to streamline adoption~~ (Removed in v0.4.0):

**`overture import`** - ~~Discover and import unmanaged MCPs~~ **[REMOVED]**

**`overture cleanup`** - ~~Remove redundant Claude Code directory configs~~ **[REMOVED]**

**Migration Note:** These commands were removed in v0.4.0 as they had 0% test coverage and limited usage. Users can manually configure MCPs in `config.yaml` instead.

# 3. Sync to all clients (now from single source)

overture sync

# 4. Clean up redundant Claude Code directory configs

overture cleanup

```

**Benefits:**

- ✅ Zero-friction migration from existing MCP setups
- ✅ Preserves all working configurations
- ✅ Guides users on environment variable setup
- ✅ Eliminates configuration drift between clients
- ✅ Clear path from "MCP chaos" to "single source of truth"

**Status:** ✅ **Released in v0.4.0** (January 2025)

**Documentation:** See [Importing Existing Configs](howtos/importing-existing-configs.md)

---

### 2. Configuration Repository Template ⭐ HIGH PRIORITY

**Problem:** Users need a starting point for their Overture configuration.

**Solution:** Official GitHub template repository for Overture configs.

**Structure:**

```

my-overture-config/
├── config.yaml # Main configuration
├── mcp-servers.yaml # MCP server definitions
├── environments/ # Environment profiles
│ ├── development.yaml
│ ├── staging.yaml
│ └── production.yaml
├── templates/ # Reusable templates
└── README.md # Setup instructions

````

**User Workflow:**

```bash
# Create config repo from template
gh repo create my-overture-config --template overture-stack/config-template

# Clone your config repo
git clone git@github.com:username/my-overture-config.git ~/overture-configs

# Use in a project
cd ~/projects/my-app
overture init --config ~/overture-configs
````

**Benefits:**

- ✅ Pre-configured directory structure
- ✅ Working examples to learn from
- ✅ Best practices baked in
- ✅ Easy to fork and customize
- ✅ Version controlled configuration

**Team Workflow:**

```bash
# Team creates shared config repo
git clone git@github.com:company/team-overture-config.git ~/work/team-config

# Each team member links projects
cd ~/work/project
overture init --config ~/work/team-config
```

**Implementation Priority:** Month 1-2 (foundational feature)

---

### 2. Template Library

**Vision:** Curated collection of configuration templates for common stacks.

**Available Templates:**

```
overture templates list

Available templates:
  basic             Basic MCP setup
  python            Python development (pytest, ruff)
  typescript        TypeScript development (eslint, prettier)
  react             React + TypeScript frontend
  fastapi           FastAPI backend development
  fullstack         Full-stack web app (frontend + backend)
  data-science      Jupyter, pandas, scikit-learn
  devops            Docker, kubernetes, terraform
```

**Usage:**

```bash
overture new my-config --template python
overture new my-api --template fastapi
```

**Community Templates:**

```bash
overture templates add --url github:username/my-template
overture new my-project --template username/my-template
```

**Implementation Priority:** Month 3

---

### 3. Interactive Configuration Builder

**Vision:** TUI (Terminal UI) for building configs interactively.

**Example:**

```bash
overture new my-config --interactive

┌─ Overture Configuration Builder ──────────────┐
│                                                 │
│ Config Name: my-config                          │
│ Description: ________________________________   │
│ Author: username                                │
│ Version: 1.0.0                                  │
│                                                 │
│ MCP Servers:                                    │
│ [x] filesystem                                  │
│ [x] memory                                      │
│ [x] github                                      │
│ [ ] sqlite                                      │
│ [ ] postgres                                    │
│                                                 │
│ [ Previous ]  [ Next ]  [ Cancel ]              │
└─────────────────────────────────────────────────┘
```

**Technology:** Use `ratatui` or `inquirer` for TUI.

**Implementation Priority:** Month 2-3

---

## Mid-Term (v0.5-v0.6 - Q2 2025)

### 4. Configuration Composition & Inheritance

**Vision:** Compose complex configs from simpler ones.

**Example:**

```yaml
# overture.yaml
config:
  name: my-comprehensive-config
  version: 1.0.0

# Inherit from base configs
extends:
  - python-dev@1.0.0 # Get Python tools
  - git-workflow@2.0.0 # Get git conventions

# Add or override
mcp:
  custom-tool:
    command: my-tool
    args: ['--custom']
```

**Benefits:**

- ✅ Reuse existing configurations
- ✅ Build on community work
- ✅ Override specific pieces
- ✅ Create configuration families

**Implementation Priority:** Month 5-6

---

### 5. CLAUDE.md Optimization Tools

**Vision:** Automated token optimization and duplication detection.

**Features:**

**1. Token Budget Analysis:**

```bash
overture analyze tokens

CLAUDE.md Token Usage:
├─ Conventions: 150 tokens (30%)
├─ Commands: 80 tokens (16%)
├─ Architecture: 120 tokens (24%)
├─ Testing: 100 tokens (20%)
└─ Tools: 50 tokens (10%)

Total: 500 tokens
Budget: 800 tokens (62% used)
```

**2. Duplication Detection:**

```bash
overture analyze duplication

Duplicate Content Found:
├─ "pytest AAA pattern" (3 occurrences)
│  ├─ CLAUDE.md:45-48
│  ├─ config/testing.yaml:8-12
│  └─ templates/test.yaml:15-20
│
└─ "Black formatter 88 chars" (2 occurrences)
   ├─ CLAUDE.md:22
   └─ config/formatting.yaml:5

Suggestions:
→ Extract to CLAUDE.md conventions section
→ Update components to reference conventions
```

**3. Auto-Extraction:**

```bash
overture optimize --auto-extract

Extracting duplicates to CLAUDE.md...
✓ Extracted testing conventions (saved 120 tokens)
✓ Extracted formatting rules (saved 45 tokens)
✓ Updated 3 config files

Token savings: 165 tokens (25% reduction)
```

**Implementation Priority:** Month 5

---

### 6. Validation & Testing Framework

**Vision:** Automated testing for configurations.

**Example:**

```bash
overture test

Running configuration tests...
✓ Validates without errors
✓ All referenced MCP servers exist
✓ All commands are accessible
✓ No circular dependencies
✓ CLAUDE.md under token budget
✓ Environment variables defined

Integration tests:
✓ Syncs to Claude Code
✓ Syncs to Copilot CLI
✓ Syncs to OpenCode
✓ MCP servers start successfully

All tests passed!
```

**Test Types:**

1. Schema validation
2. Dependency resolution
3. Command existence checks
4. Token budget compliance
5. Integration tests (actual client sync)
6. End-to-end workflows

**Implementation Priority:** Month 6

---

## Long-Term (v1.0+ - Q3-Q4 2025)

### 7. AI-Assisted Configuration Creation

**Vision:** Use Claude to help create configurations.

**Example:**

```bash
overture ai create

> I need a config for FastAPI development with pytest testing

Claude: I'll create a FastAPI development configuration for you.
This will include:
- MCP servers: pytest-runner, sqlite
- Environment: Python 3.11+
- Testing setup: pytest with coverage
- Linting: ruff, mypy

Shall I proceed? (Y/n):
```

**Features:**

- Natural language config description
- AI suggests MCP servers
- Generates configuration
- Creates example files
- Explains decisions

**Implementation Priority:** Month 10+

---

### 8. Analytics & Insights (Opt-In)

**Vision:** Understand how configurations are used and optimize accordingly.

**Features:**

**1. Usage Tracking:**

```bash
overture analytics show

Configuration Usage (Last 30 Days):
├─ filesystem MCP: 145 invocations
├─ memory MCP: 89 uses
├─ github MCP: 67 invocations
└─ sqlite MCP: 234 uses

Most Used Commands:
1. overture sync (156 times)
2. overture doctor (89 times)
3. overture audit (45 times)
```

**2. Optimization Suggestions:**

```
Based on usage patterns:
→ filesystem and memory often used together - consider template
→ sqlite MCP invoked most - ensure optimal configuration
→ doctor command used frequently - may indicate config issues
```

**Implementation Priority:** Month 12+

---

## Explicitly Out of Scope

### Will NOT Implement

1. **Multi-tool support beyond 3 clients**
   - Reason: Overture v0.3 focuses on Claude Code, Copilot CLI, OpenCode
   - Clients like Cursor, Windsurf lack mature MCP support
   - IDE-specific extensions (VS Code, JetBrains) require custom plugins

2. **Enterprise-specific features**
   - Team licensing, access control, audit logging
   - Self-hosted infrastructure
   - Centralized management console
   - Reason: Keep Overture simple and focused on individual developers

3. **Plugin marketplace**
   - Discovery, ratings, reviews
   - Reason: Complexity not justified for 3-client scope

4. **Web-based GUI**
   - Reason: Overture is a CLI tool; GUI adds unnecessary complexity

---

## Monitoring for Future Inclusion

### Clients Under Consideration

| Client                 | Status      | Criteria Needed                       |
| ---------------------- | ----------- | ------------------------------------- |
| **Windsurf**           | 🔍 Watching | Mature MCP support (6+ months stable) |
| **Aider**              | 🔍 Watching | MCP integration roadmap               |
| **Cody (Sourcegraph)** | 🔍 Watching | Native MCP support                    |

**Inclusion Criteria:**

- ✅ Native MCP protocol support
- ✅ Stable configuration format
- ✅ Active maintenance (6+ months)
- ✅ Project-scoped configuration
- ✅ Clear documentation

---

## Success Metrics

### Adoption Metrics

- Installations per month
- Active users (weekly, monthly)
- Configurations created
- Community contributions

### Quality Metrics

- Error rate (failed syncs)
- Time to first working config
- User satisfaction (NPS score)
- Documentation completeness

### Ecosystem Health

- GitHub stars
- Contributors
- Issues/PRs per month
- Community discussions

---

## Contributing to This Roadmap

This roadmap is **living and evolving**. As Overture grows:

1. **Near-term ideas** → Move to GitHub Issues when ready
2. **Features in development** → Track in GitHub Projects
3. **Completed features** → Update README and docs
4. **New ideas** → Add to this roadmap via PR

**How to Contribute:**

- Open issues for new ideas
- Comment on existing proposals
- Submit PRs for roadmap updates
- Share use cases and needs

---

## Evolution Path

```
Current (v0.3 - Jan 2025):
└─> 3-client support, stable foundation

Phase 1 (v0.4 - Q1 2025): Templates & Composition
├─> Configuration templates
├─> Interactive builder
└─> Template library

Phase 2 (v0.5-v0.6 - Q2 2025): Optimization & Testing
├─> Config composition
├─> CLAUDE.md optimization
├─> Validation framework
└─> Testing tools

Phase 3 (v1.0+ - Q3-Q4 2025): AI & Analytics
├─> AI-assisted creation
├─> Usage analytics
└─> Advanced insights
```

---

## Questions or Feedback?

- **Feature Requests:** Open a GitHub issue
- **Discussion:** Start a GitHub discussion
- **Contributions:** See [CONTRIBUTING.md](../CONTRIBUTING.md)

---

**Last Updated:** 2025-01-12  
**Status:** Living Document  
**Next Review:** Q2 2025 or when reaching major milestones
