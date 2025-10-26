# Overture Architecture Research

> Comprehensive research on Claude Code architecture and Overture's configuration strategy

## Executive Summary

Claude Code uses a multi-layered architecture where different components provide different types of guidance to the LLM. Overture will manage these components through a unified YAML-based configuration system that generates Claude Code's native JSON configurations.

## Claude Code Component Architecture

### 1. Hooks (Event-Driven Automation)

**What they are:** Shell commands that execute at specific points in Claude Code's lifecycle.

**Event Types (9 total):**
- **PreToolUse**: Before tool execution (can block or auto-approve)
- **PostToolUse**: After tool execution (can validate or format)
- **UserPromptSubmit**: When user submits prompt (can inject context or block)
- **Notification**: On permission requests or idle notifications
- **Stop/SubagentStop**: When agents finish responding
- **SessionStart**: Session initialization
- **SessionEnd**: Session cleanup
- **PreCompact**: Before context window compression

**Configuration:**
- Stored in settings.json with matchers (pattern-based filters)
- Receive JSON via stdin
- Communicate via exit codes:
  - `0`: Success (stdout shown to user, or context injection for UserPromptSubmit)
  - `2`: Blocking error (stderr feeds back to Claude)
  - Other: Non-blocking error

**LLM Guidance Mechanism:**
- **Blocking**: Exit code 2 stops execution, feeds error to Claude
- **Context Injection**: UserPromptSubmit/SessionStart append information
- **Feedback Integration**: PostToolUse can reject results with explanations

**Example Use Cases:**
- Auto-format code after edits (PostToolUse)
- Block sensitive file modifications (PreToolUse)
- Inject git context into prompts (UserPromptSubmit)
- Load project context on session start (SessionStart)
- Audit trail logging (all hooks)

### 2. Subagents (Specialized AI Assistants)

**What they are:** Specialized AI assistants with separate context windows.

**Storage Locations:**
- `.claude/agents/*.md` (project-level, highest priority)
- `~/.claude/agents/*.md` (user-level)

**File Format:** Markdown with YAML frontmatter
```yaml
---
name: agent-name
description: "When to use this agent"
tools:
  - Read
  - Write
  - mcp__server__*
model: claude-sonnet-4
---
Agent instructions in Markdown...
```

**Invocation:**
- **Automatic**: Claude proactively delegates based on task description
- **Explicit**: User requests specific agent

**Key Features:**
- Isolated context window (prevents main conversation pollution)
- Tool restrictions via `tools` field
- Can use different AI model than main conversation
- Inherits all tools if `tools` field omitted

### 3. Slash Commands (Prompt Templates)

**What they are:** User-invoked prompt shortcuts and templates.

**Types:**
- **Built-in**: 25+ system commands (`/clear`, `/model`, `/review`, etc.)
- **Custom**: User-defined Markdown files

**Storage Locations:**
- `.claude/commands/*.md` (project-level)
- `~/.claude/commands/*.md` (personal)
- Subdirectories create namespaces: `commands/team/standup.md` → `/team/standup`

**File Format:** Markdown with YAML frontmatter
```yaml
---
description: "Command description"
allowed-tools:
  - Read
  - Grep
model: claude-sonnet-4
---
Prompt template with $ARGUMENTS, $1, $2...
Reference files with @path/to/file.md
```

**Advanced Features:**
- **Parameters**: `$ARGUMENTS`, `$1`, `$2` for positional arguments
- **Bash execution**: `!` prefix executes shell commands
- **File references**: `@` prefix includes file contents
- **Tool restrictions**: `allowed-tools` limits available capabilities

**LLM Guidance:**
- Command Markdown content becomes the actual prompt sent to LLM
- Variables and file references substituted at invocation time

### 4. Skills (Model-Invoked Capabilities)

**What they are:** Modular capabilities that Claude autonomously invokes based on task context.

**Key Distinction:** Model-invoked (Claude decides) vs Commands (user invokes)

**Storage Locations:**
- `.claude/skills/*/SKILL.md` (project)
- `~/.claude/skills/*/SKILL.md` (personal)

**File Format:** SKILL.md with YAML frontmatter
```yaml
---
description: "What this skill does AND when to use it"
allowed-tools:
  - Read
  - Write
---
Skill instructions and expertise...
```

**Discovery Mechanism:**
- Claude evaluates `description` field to match against user requests
- Automatically activates when relevant
- No explicit user invocation needed

**Tool Access Control:**
- `allowed-tools` restricts capabilities within skill context
- Enables read-only skills or security-sensitive workflows

**Directory Structure:**
- Each skill in its own directory
- Can include templates and supporting files

### 5. Plugins (Distribution Packages)

**What they are:** Bundled packages of commands, agents, skills, hooks, and MCP servers.

**Structure:**
```
.claude-plugin/
├── plugin.json          # Manifest
├── commands/           # Slash commands
├── agents/             # Subagent definitions
├── skills/             # Skill definitions
├── hooks.json          # Hook configurations
└── .mcp.json           # MCP server configs
```

**Manifest (plugin.json):**
```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Author name"
}
```

**Installation:**
- Interactive: `/plugin` opens management interface
- Direct: `/plugin install plugin-name@marketplace-name`
- Team: Configure in `.claude/settings.json` for auto-install

**Team Workflows:**
- Repository-level plugin specifications
- Automatic installation when folder trusted
- Ensures consistent tooling across teams

### 6. MCP Servers (External Capabilities)

**What they are:** External tools and data sources following Model Context Protocol standard.

**Transport Mechanisms:**
- **HTTP**: Remote services (recommended)
- **SSE**: Server-Sent Events (deprecated)
- **Stdio**: Local processes

**Configuration (`.mcp.json`):**
```json
{
  "mcpServers": {
    "server-name": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@scope/server"],
      "env": {
        "VAR": "value"
      }
    }
  }
}
```

**Capability Types:**

1. **Tools**: Functions Claude can call directly
   - Automatically discovered
   - Invoked like built-in tools

2. **Resources**: Data sources with @ mention syntax
   - `@server:resource://path`
   - Automatically fetched and attached

3. **Prompts**: Become slash commands
   - `/mcp__server__prompt_name`
   - Accept arguments
   - Dynamically discovered

**Scope Levels:**
- User-global: `~/.claude/.mcp.json`
- Project: `.claude/.mcp.json`
- Managed: `managed-mcp.json` (enterprise control)

## How Components Interact

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Distribution (Plugins)                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Layer 4: Automation (Hooks)                             │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Layer 3: Capabilities (Tools + MCP)                 │ │ │
│ │ │ ┌─────────────────────────────────────────────────┐ │ │ │
│ │ │ │ Layer 2: Invocable Instructions                 │ │ │ │
│ │ │ │ (Commands, Skills, Agents)                      │ │ │ │
│ │ │ │ ┌─────────────────────────────────────────────┐ │ │ │ │
│ │ │ │ │ Layer 1: Persistent Instructions            │ │ │ │ │
│ │ │ │ │ (CLAUDE.md)                                 │ │ │ │ │
│ │ │ │ └─────────────────────────────────────────────┘ │ │ │ │
│ │ │ └─────────────────────────────────────────────────┘ │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Information Flow

```
User Input
    ↓
[UserPromptSubmit Hook] - Can inject context or block
    ↓
[Command Expansion] - If slash command used
    ↓
[Skill Loading] - If Claude decides skill is relevant
    ↓
LLM Processing (with CLAUDE.md context)
    ↓
[Tool Selection] - Choose from available tools (built-in + MCP)
    ↓
[PreToolUse Hook] - Can block, auto-approve, or validate
    ↓
Tool Execution
    ↓
[PostToolUse Hook] - Can validate, format, or provide feedback
    ↓
LLM Response Generation
    ↓
[Stop Hook] - Cleanup or forced continuation
```

### Component Interactions

**Commands → Tools:**
- Commands can restrict available tools via `allowed-tools`
- Enables secure or focused command contexts

**Commands → Files:**
- `@` prefix includes file contents
- Enables templating and reusable snippets

**Skills → Tools:**
- Skills can restrict tool access for security
- Creates specialized, limited-capability contexts

**Hooks → Context:**
- UserPromptSubmit injects data before LLM sees prompt
- SessionStart loads project context
- Shapes what information LLM has available

**Hooks → Tools:**
- PreToolUse blocks or approves operations
- PostToolUse validates results
- Acts as guardrails around LLM actions

**Agents → Context:**
- Isolated context window prevents pollution
- Focused expertise without distraction

**MCP Prompts → Commands:**
- MCP servers provide prompts
- Become callable slash commands
- Extend command library dynamically

**MCP Resources → Context:**
- @ mention syntax fetches data
- Injects external information into conversation

**Plugins → Everything:**
- Package all components together
- Distribution unit for sharing configurations

## Real-World Integration Scenarios

### Scenario 1: Team Code Review Workflow

**Setup:**
- Command: `/review` with team standards template
- Skill: `code-reviewer` for analysis expertise
- Agent: `security-auditor` for security-specific reviews
- Hook: PostToolUse on Edit → run tests
- Hook: UserPromptSubmit → inject git context
- MCP: `github` server for PR integration

**Flow:**
1. User: `/review src/auth`
2. UserPromptSubmit hook injects current branch, recent commits
3. Command expands with `@.claude/templates/review-checklist.md` (rewritten during generation)
4. Claude reads files with Read tool
5. Claude invokes `code-reviewer` skill
6. For security issues, delegates to `security-auditor` agent
7. Claude suggests fixes, uses Edit tool
8. PostToolUse hook auto-runs tests
9. Tests pass → Claude offers to create PR via github MCP

**All components working together seamlessly!**

### Scenario 2: New Developer Onboarding

**Setup:**
- SessionStart hook: Load context, check dependencies
- Command: `/onboard` - interactive guide
- Skill: `project-guide` - ongoing help
- MCP: `filesystem` - documentation access

**Flow:**
1. New developer starts Claude Code
2. SessionStart hook checks node_modules, runs `npm install` if needed
3. SessionStart hook loads project context from config repo
4. Claude proactively suggests `/onboard`
5. User runs `/onboard`
6. Command guides through architecture, key files, workflows
7. `project-guide` skill available for follow-up questions
8. Filesystem MCP provides doc access

### Scenario 3: Continuous Integration

**Setup:**
- PreToolUse hook: Block commits to main branch
- PostToolUse hook: Run linter/formatter on edits
- Skill: `ci-helper` - CI/CD assistance
- MCP: `github` - CI status checks

**Flow:**
1. Claude edits file
2. PostToolUse hook runs prettier, eslint
3. Violations found → exit code 2 with feedback
4. Claude sees errors, fixes them
5. User asks Claude to commit
6. PreToolUse hook checks git branch
7. On main branch → block with error
8. Claude creates feature branch, commits there

## Overture Configuration Strategy

### Design Principles

1. **Symlink-Based Separation**: Config repo lives separately, symlinked from projects
2. **Single Source of Truth**: Config repo is canonical, `.claude/` is generated
3. **Human-Readable**: YAML for configs, Markdown for instructions
4. **Reusability**: One config repo serves multiple projects
5. **Preserve Patterns**: Keep Markdown+YAML frontmatter for commands/agents/skills

### Symlink Model

```
# Configuration Repository (version controlled)
~/overture-configs/              # Or ~/work/team-config for teams
├── config.yaml
├── mcp-servers.yaml
├── hooks.yaml
├── commands/
├── agents/
├── skills/
├── templates/
├── scripts/
└── environments/

# Project Directory
~/projects/my-app/
├── .overture -> ~/overture-configs/  # Symlink to config repo
├── .claude/                          # Generated (gitignored)
│   ├── settings.json
│   ├── .mcp.json
│   ├── commands/
│   ├── agents/
│   └── skills/
└── src/
```

### Overture Config Repository Structure

```
~/overture-configs/         # Config repository (git)
├── config.yaml              # Main configuration
├── mcp-servers.yaml         # MCP server definitions
├── hooks.yaml               # Hook configurations
│
├── commands/               # Slash commands
│   ├── review.md
│   ├── test.md
│   └── team/               # Namespaced
│       └── standup.md
│
├── agents/                 # Subagent definitions
│   ├── security-auditor.md
│   └── test-writer.md
│
├── skills/                 # Skill definitions
│   ├── code-reviewer/
│   │   ├── SKILL.md
│   │   └── templates/
│   └── api-documenter/
│       └── SKILL.md
│
├── context/                # Context injection files
│   ├── project-overview.md
│   └── architecture.md
│
├── templates/              # Shared templates
│   ├── pr-template.md
│   └── review-checklist.md
│
├── scripts/                # Hook scripts
│   ├── format-code.sh
│   └── run-tests.sh
│
└── environments/          # Environment-specific configs
    ├── development.yaml
    ├── staging.yaml
    └── production.yaml
```

### Configuration File Formats

#### config.yaml

```yaml
version: "1.0"
scope: project  # user-global | project | project-local

# Include other files
includes:
  - mcp-servers.yaml
  - hooks.yaml
  - ${OVERTURE_ENV:-development}/overture.yaml

# Extend other config files (optional)
# extends: ~/base-overture-config/config.yaml

# Plugin specifications
plugins:
  marketplaces:
    - name: my-company
      url: https://plugins.company.com
  installed:
    - name: code-reviewer
      marketplace: my-company
      enabled: true

# Global settings
settings:
  defaultModel: claude-sonnet-4
  enabledFeatures:
    - subagents
    - skills
    - hooks

# Variables for substitution
variables:
  team_style_guide: "team-coding-standards.md"
  repo_url: "https://github.com/org/repo"
```

#### mcp-servers.yaml

```yaml
servers:
  filesystem:
    transport: stdio
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "${project.root}"
    env:
      LOG_LEVEL: info

  github:
    transport: http
    url: https://api.github.com/mcp
    auth:
      type: bearer
      token: ${env.GITHUB_TOKEN}  # Environment variable

  database:
    transport: stdio
    command: /usr/local/bin/db-mcp-server
    args:
      - "--connection"
      - "${env.DB_CONNECTION_STRING}"
```

#### hooks.yaml

```yaml
hooks:
  # Auto-format TypeScript after editing
  - matcher:
      tool: Edit
      pattern: "**/*.ts"
    events:
      postToolUse:
        - command: npx prettier --write "${CLAUDE_FILE_PATH}"
          timeout: 5000
          description: "Format TypeScript with Prettier"

  # Block .env file modifications
  - matcher:
      tool: Edit|Write
      pattern: "**/.env*"
    events:
      preToolUse:
        - command: |
            echo '{"permissionDecision": "deny", "reason": "Env files require manual review"}' >&2
            exit 2
          description: "Protect environment files"

  # Inject git context on prompt submit
  - events:
      userPromptSubmit:
        - command: |
            echo "Current branch: $(git branch --show-current)"
            echo "Last commit: $(git log -1 --oneline)"
          description: "Inject git context"

  # Load project context on session start
  - events:
      sessionStart:
        - command: cat "$(readlink .overture)/context/project-overview.md"
          description: "Load project context"
        - command: |
            if [ ! -d "node_modules" ]; then
              npm install
            fi
          description: "Install dependencies"
```

#### Commands (Markdown + YAML)

**Source file** (`~/overture-configs/commands/review.md`):

```markdown
---
description: "Request code review with team standards"
allowed-tools:
  - Read
  - Grep
  - Bash
model: claude-sonnet-4
---

Please review the code in $ARGUMENTS focusing on:

1. **Code Quality**: Check for violations of ${team_style_guide}
2. **Security**: Look for common vulnerabilities
3. **Performance**: Identify potential bottlenecks
4. **Tests**: Ensure adequate test coverage

Use the team's review checklist:
@templates/review-checklist.md
```

**Generated file** (`.claude/commands/review.md`) - Overture rewrites `@` paths:

```markdown
---
description: "Request code review with team standards"
allowed-tools:
  - Read
  - Grep
  - Bash
model: claude-sonnet-4
---

Please review the code in $ARGUMENTS focusing on:

1. **Code Quality**: Check for violations of team-coding-standards.md
2. **Security**: Look for common vulnerabilities
3. **Performance**: Identify potential bottlenecks
4. **Tests**: Ensure adequate test coverage

Use the team's review checklist:
@.claude/templates/review-checklist.md
```

*Note: During generation, Overture copies `templates/review-checklist.md` to `.claude/templates/` and rewrites the path.*

#### Agents (Markdown + YAML)

**Source file** (`~/overture-configs/agents/security-auditor.md`):

```markdown
---
name: security-auditor
description: "Specialized security audit agent. Use when analyzing code for vulnerabilities or reviewing security-sensitive changes."
tools:
  - Read
  - Grep
  - Bash
  - mcp__filesystem__*
model: claude-opus-4
---

You are a security-focused code auditor. Your responsibilities:

1. Identify vulnerabilities (SQL injection, XSS, CSRF, etc.)
2. Check for exposed secrets and credentials
3. Review authentication and authorization logic
4. Validate input sanitization
5. Check dependency versions for known CVEs

Always provide:
- Severity rating (Critical/High/Medium/Low)
- Specific line references
- Remediation suggestions
- Links to security documentation
```

#### Skills (Markdown + YAML)

**Source file** (`~/overture-configs/skills/api-documenter/SKILL.md`):

```markdown
---
description: "Generate OpenAPI documentation from code. Use when user asks to document APIs or create OpenAPI/Swagger specs."
allowed-tools:
  - Read
  - Write
  - Grep
  - Bash
---

You are an API documentation specialist. When invoked:

1. Analyze codebase to find API endpoints
2. Extract route definitions, parameters, response types
3. Generate OpenAPI 3.0 specification
4. Include example requests and responses
5. Document authentication requirements

Output format: OpenAPI 3.0 YAML
Use templates from @skills/api-documenter/templates/
```

### Variable Substitution

**Variable Sources:**
- `${env.VAR_NAME}` - Environment variables
- `${overture.project.name}` - Overture config variables
- `${git.branch}` - Git context
- `${git.commit}` - Git commit hash
- `${git.default_branch}` - Default branch name
- `${user.home}` - User home directory
- `${project.root}` - Project root directory

**Example Usage:**

```yaml
# In mcp-servers.yaml
servers:
  github:
    env:
      GITHUB_TOKEN: ${env.GITHUB_TOKEN}
      REPO_PATH: ${project.root}
```

```markdown
<!-- In commands/create-pr.md -->
Create a pull request for branch ${git.branch} to ${git.default_branch}
```

### Environment-Specific Configurations

`~/overture-configs/config.yaml`:

```yaml
includes:
  - ${OVERTURE_ENV:-development}/overture.yaml
```

`~/overture-configs/environments/development.yaml`:

```yaml
mcp-servers:
  database:
    env:
      DB_HOST: localhost
      DB_PORT: 5432
```

`~/overture-configs/environments/production.yaml`:

```yaml
mcp-servers:
  database:
    env:
      DB_HOST: ${env.PROD_DB_HOST}
      DB_PORT: 5432
```

### Configuration Inheritance

```yaml
# ~/work/project-config/config.yaml
extends: ~/personal-config/config.yaml  # Inherit from personal config

# Override specific settings
settings:
  defaultModel: claude-opus-4  # Override for this project

# Add project-specific plugins
plugins:
  installed:
    - name: project-specific-tool
      marketplace: internal
```

## Overture Workflow

### CLI Commands

```bash
# Initialize new Overture configuration
overture init

# Import existing Claude Code config
overture import

# Validate configuration
overture validate

# Generate .claude/ files from config repo
overture generate

# Dry-run (show what would be generated)
overture generate --dry-run

# Watch for changes and auto-regenerate
overture watch

# Export as plugin
overture export --format plugin

# Migrate to new config version
overture migrate
```

### Generation Process

```
~/overture-configs/  (config repo)
  ├── config.yaml
  ├── mcp-servers.yaml
  ├── hooks.yaml
  ├── commands/*.md
  ├── agents/*.md
  └── skills/*/SKILL.md

         ↓ [overture generate]

.claude/
  ├── settings.json       # From config.yaml + hooks.yaml
  ├── .mcp.json          # From mcp-servers.yaml
  ├── commands/*.md      # Copied with variable substitution
  ├── agents/*.md        # Copied with variable substitution
  └── skills/*/SKILL.md  # Copied with variable substitution
```

### Validation Layers

1. **Syntax Validation**
   - YAML parsing
   - Markdown frontmatter parsing
   - JSON schema for generated output

2. **Schema Validation**
   - Config file schemas
   - Frontmatter schemas
   - Variable reference syntax

3. **Semantic Validation**
   - Referenced files exist
   - Hook scripts are executable
   - MCP server commands available
   - Tool names are valid
   - No circular dependencies

4. **Runtime Validation**
   - Variable substitution succeeds
   - Generated JSON is valid Claude Code config
   - File permissions correct

### Error Handling

```
Error in hooks.yaml:15
  Invalid event type 'preToolUse' (case-sensitive)
  Did you mean 'PreToolUse'?

Error in commands/review.md
  Frontmatter references unknown tool: 'GitLog'
  Available tools: Read, Write, Edit, Bash, Grep, ...

Warning in mcp-servers.yaml:22
  Environment variable ${env.GITHUB_TOKEN} is not set
  MCP server 'github' may fail to authenticate

Error in config.yaml:8
  Circular dependency detected:
    config.yaml extends base.yaml
    base.yaml extends config.yaml
```

## Versioning & Migration

### Configuration Versioning

```yaml
# config.yaml (in overture config repo)
version: "1.0"  # Overture format version
```

### Import from Claude Code

```bash
overture import
```

Process:
1. Read `.claude/settings.json`, `.claude/.mcp.json`
2. Parse existing commands/agents/skills
3. Generate Overture config repo structure
4. Convert JSON to YAML
5. Create backup of original `.claude/`

### Schema Evolution

- Overture 1.0: Initial release
- Overture 1.1: Add new Claude Code features
- Overture 2.0: Breaking changes with migration tool

### Deprecation Strategy

1. Add new format support
2. Deprecate old format with warnings
3. Provide auto-migration
4. Remove after grace period

```
Warning: Hook syntax changed in Overture 2.0
  Old: hooks.postToolUse
  New: hooks.events.PostToolUse
  Run 'overture migrate' to auto-update
```

## Implementation Priorities

### Phase 1: Core Generation
- [ ] YAML parsers for config files
- [ ] Claude Code JSON generators
- [ ] Variable substitution engine
- [ ] Basic validation

### Phase 2: Enhanced Features
- [ ] Environment-specific configs
- [ ] Configuration inheritance
- [ ] Import from existing Claude Code configs
- [ ] Watch mode for development

### Phase 3: Advanced Features
- [ ] Plugin export
- [ ] Advanced validation (semantic checks)
- [ ] Migration tooling
- [ ] Team collaboration features

## Key Insights

1. **Claude Code uses layered guidance**: Persistent (CLAUDE.md) → Invocable (commands/skills/agents) → Capabilities (tools/MCP) → Automation (hooks)

2. **Different invocation patterns**: Commands (user), Skills (model), Agents (both), Hooks (automatic)

3. **Markdown+YAML pattern works well**: Keep it for commands/agents/skills, just add better templating

4. **Hooks are powerful guardrails**: Can block, inject context, validate, and provide feedback to LLM

5. **MCP provides three capability types**: Tools (functions), Resources (data), Prompts (commands)

6. **Plugins package everything**: Distribution unit for teams

7. **Overture's value proposition**: Cleaner YAML configs, validation, templating, environment support, single source of truth

## Next Steps

1. Design detailed configuration schemas (JSON Schema)
2. Build proof-of-concept generator
3. Create sample configurations for common workflows
4. Build validation engine
5. Implement CLI tool
6. Write comprehensive documentation
7. Build plugin export functionality
