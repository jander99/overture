# Claude Code Plugin Development Guide

A practical guide for building production-ready plugins for Claude Code. This guide is based on analysis of 84+ production implementations and official Anthropic specifications.

## Table of Contents

- [Quick Start](#quick-start)
- [Understanding Plugin Architecture](#understanding-plugin-architecture)
- [Building Agents](#building-agents)
- [Creating Skills](#creating-skills)
- [Implementing Commands](#implementing-commands)
- [Configuring Hooks](#configuring-hooks)
- [Assembling Complete Plugins](#assembling-complete-plugins)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Minimal Plugin Structure

Every Claude Code plugin requires this directory structure:

```
.claude-plugin/
  marketplace.json          # Plugin registry
plugins/
  your-plugin-name/
    agents/                 # AI personas
      agent-name.md
    commands/               # Slash commands (optional)
      command-name.md
    skills/                 # Knowledge packages (optional)
      skill-name/
        SKILL.md
    hooks/                  # Event automation (optional)
      hooks.json
```

### Installation Commands

Users install plugins with:

```bash
/plugin marketplace add https://github.com/your-org/plugins
/plugin install your-plugin-name
```

## Understanding Plugin Architecture

### Three Core Concepts

**1. Agents** - Specialized AI personas that handle specific domains
- Defined in Markdown with YAML frontmatter
- Assigned specific model tiers (haiku/sonnet/opus)
- Can have restricted tool access
- Activate based on context matching

**2. Skills** - Progressive disclosure knowledge packages
- Load in three tiers to optimize token usage
- Tier 1: Metadata (~50 tokens, always loaded)
- Tier 2: Instructions (<5000 tokens, loaded on activation)
- Tier 3: Resources (unlimited, loaded on explicit need)

**3. Hooks** - Event-driven automation
- Execute shell commands at lifecycle events
- Can block tool execution (PreToolUse only)
- Use regex patterns to filter events

### Token Efficiency Pattern

A well-designed plugin with 5 agents and 5 skills:
- Baseline load: ~300 tokens (metadata only)
- Full activation: 25,000+ tokens (all content)
- Average usage: 2,000-5,000 tokens (selective activation)

This progressive disclosure enables large knowledge bases without context window exhaustion.

## Building Agents

### Agent Definition Template

Create `agents/your-agent.md`:

```markdown
---
name: python-expert
description: Master Python 3.12+ with async patterns, testing, and modern tooling. Expert in uv, ruff, pytest, and FastAPI. Use PROACTIVELY when building Python applications, optimizing async code, or implementing testing strategies.
model: sonnet
tools: Read, Write, Edit, Bash, Grep
color: blue
---

# Python Development Expert

You are a senior Python developer specializing in modern Python 3.12+ development with cutting-edge tools and practices.

## Expertise Areas

### Modern Python Features
- Pattern matching with structural matching
- Type hints and generic types
- Async/await patterns with asyncio
- Context managers and decorators
- Dataclasses and Pydantic models

### Development Tools
- **uv**: Modern Python package management
- **ruff**: Fast Python linting and formatting
- **pytest**: Comprehensive testing framework
- **mypy**: Static type checking
- **pre-commit**: Git hooks for code quality

### Framework Expertise
- FastAPI for high-performance APIs
- Django for full-featured web applications
- Click for CLI development
- SQLAlchemy 2.0 for database access

## Workflow Process

When invoked, I follow this systematic approach:

1. **Understand requirements**: Analyze project goals, scale, and constraints
2. **Choose appropriate tools**: Select modern tooling (uv, ruff, pytest)
3. **Design architecture**: Plan modular, testable structure
4. **Implement with best practices**: Type hints, async patterns, error handling
5. **Add comprehensive tests**: Unit, integration, and E2E coverage
6. **Configure quality tools**: Set up ruff, mypy, pre-commit
7. **Document thoroughly**: Docstrings, README, usage examples

## Agent Coordination

**Complements:**
- backend-architect: For API design and microservices architecture
- devops-engineer: For deployment and CI/CD pipelines
- security-auditor: For security reviews and vulnerability scanning

**Enables:**
- Frontend developers can consume well-designed Python APIs
- DevOps can deploy with proper packaging and dependencies

**Boundaries:**
- vs backend-architect: I implement code; defer high-level architecture decisions
- vs devops-engineer: I write deployment-ready code; defer infrastructure provisioning
```

### YAML Frontmatter Fields

| Field | Required | Purpose | Example |
|-------|----------|---------|---------|
| `name` | Yes | Unique identifier (kebab-case) | `python-expert` |
| `description` | Yes | Capabilities + activation criteria | Use "PROACTIVELY" for auto-invocation |
| `model` | Yes | Model tier: haiku/sonnet/opus | `sonnet` |
| `tools` | No | Restrict tool access | `Read, Grep, Bash` |
| `color` | No | UI display color | `blue`, `green`, `purple` |

### Model Tier Selection Guide

**Haiku** (Lowest cost, fastest)
- Quick focused tasks
- Documentation generation
- Simple data analysis
- Standard responses
- Use when: Speed > complexity

**Sonnet** (Balanced cost/performance)
- Standard development work
- Code review and refactoring
- Language-specific implementation
- Testing and debugging
- Use when: General development tasks

**Opus** (Highest capability)
- Complex architecture design
- Security audits
- Incident response
- AI/ML engineering
- Use when: Critical reasoning required

### Tool Restriction Patterns

Restrict tools for security and focus:

```yaml
# Read-only agent (reviewers, analyzers)
tools: Read, Grep, Bash

# Full-access agent (developers)
tools: Read, Write, Edit, Bash, Grep

# Deployment agent (infrastructure)
tools: Bash, Read, Write

# Security auditor (no code modification)
tools: Read, Grep, Bash
```

Omit `tools` field to grant all available tools.

### Activation Patterns

**Implicit (recommended)**: Claude Code matches user requests to agent descriptions
```
User: "Optimize this Python async code"
    → Automatically routes to python-expert
```

**Explicit**: Users reference agents by name
```
User: "Use python-expert to refactor this module"
```

**Commands**: Structured workflows invoke specific agents
```bash
/python-development:scaffold fastapi-microservice
```

## Creating Skills

### Skill Structure

Create `skills/skill-name/SKILL.md`:

```markdown
---
name: fastapi-production-patterns
description: Production-ready FastAPI patterns with async/await, dependency injection, middleware, and testing. Use when building FastAPI applications, implementing REST APIs, or architecting production deployments.
---

# FastAPI Production Patterns

Production-grade FastAPI development requires specific architectural patterns and tooling choices.

## Project Structure

```
project/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── router.py
│   │       └── endpoints/
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── logging.py
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── repositories/
│   └── dependencies/
├── tests/
├── migrations/
└── pyproject.toml
```

## Async Endpoint Pattern

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.database import get_db
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends()
) -> User:
    """Create new user with validation."""
    existing = await user_service.get_by_email(db, user_data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email exists")
    
    return await user_service.create(db, user_data)
```

## Dependency Injection

```python
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

## Testing Pattern

```python
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_create_user(client: AsyncClient):
    response = await client.post(
        "/users/",
        json={"email": "[email protected]", "password": "SecurePass123!"}
    )
    assert response.status_code == 201
    assert response.json()["email"] == "[email protected]"
```

## Production Configuration

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "FastAPI Application"
    DATABASE_URL: str
    SECRET_KEY: str
    REDIS_URL: str | None = None
    
    class Config:
        env_file = ".env"

settings = Settings()
```
```

### Progressive Disclosure Tiers

**Tier 1: Metadata** (always loaded)
```yaml
---
name: fastapi-production-patterns
description: Production-ready FastAPI patterns... Use when building FastAPI applications...
---
```
Keep under 100 tokens per skill. Include "Use when" activation triggers.

**Tier 2: Instructions** (loaded on activation)
- Core patterns and best practices
- High-level implementation guidance
- Architecture recommendations
- Keep under 5,000 tokens

**Tier 3: Resources** (loaded on explicit need)
- Complete code examples
- Templates and boilerplate
- Advanced scenarios
- Reference documentation
- No token limit

### Activation Triggers

Skills activate when user requests match description keywords:

```yaml
description: Production-ready FastAPI patterns with async/await, dependency injection, middleware, and testing. Use when building FastAPI applications, implementing REST APIs, or architecting production deployments.
```

Triggers: "FastAPI", "REST API", "async patterns", "production deployment"

Request: "Build a FastAPI microservice" → Skill activates automatically

### Skill Composition

Multiple skills can activate for complex requests:

```
User: "Build production FastAPI microservice with Kubernetes"
    ↓
Skills activated:
- fastapi-production-patterns (API structure)
- async-python-patterns (async/await)
- python-testing-patterns (pytest setup)
- k8s-manifest-generator (Kubernetes YAML)
```

## Implementing Commands

### Command Definition

Create `commands/command-name.md`:

```markdown
# Python Project Scaffolding

## Description
Create production-ready Python projects with modern tooling (uv, ruff, pytest).

## Usage
`/python-development:scaffold [project-type] [project-name]`

## Arguments
- `project-type`: `fastapi-microservice`, `cli-tool`, `library`
- `project-name`: Directory name for the project

## Examples
```bash
/python-development:scaffold fastapi-microservice my-api
/python-development:scaffold cli-tool my-tool
/python-development:scaffold library my-lib
```

## Execution Workflow

### Phase 1: Validation
1. Verify project-type is supported (fastapi-microservice, cli-tool, library)
2. Check if project-name directory exists (abort if exists)
3. Validate project-name follows Python package naming (lowercase, hyphens)

### Phase 2: Directory Structure
Create appropriate structure based on project-type:

**FastAPI Microservice:**
```
project-name/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── api/
│   ├── core/
│   ├── models/
│   └── services/
├── tests/
├── pyproject.toml
├── .gitignore
└── README.md
```

**CLI Tool:**
```
project-name/
├── src/
│   └── project_name/
│       ├── __init__.py
│       ├── cli.py
│       └── commands/
├── tests/
├── pyproject.toml
└── README.md
```

### Phase 3: Configuration Files

**pyproject.toml:**
```toml
[project]
name = "project-name"
version = "0.1.0"
description = "Project description"
requires-python = ">=3.12"
dependencies = []

[project.optional-dependencies]
dev = ["pytest", "ruff", "mypy"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.pytest.ini_options]
testpaths = ["tests"]
```

**README.md template** with installation, usage, and development instructions.

**.gitignore** with Python-specific patterns.

### Phase 4: Initial Files

Create starter files based on project-type:
- FastAPI: `app/main.py` with basic FastAPI app
- CLI: `src/project_name/cli.py` with Click setup
- Library: `src/project_name/__init__.py` with package exports

### Phase 5: Initialization
1. Run `uv sync` to create virtual environment and install dependencies
2. Run `ruff format` to ensure consistent formatting
3. Display completion message with next steps

## Error Handling
- Directory exists → Prompt user to choose different name or remove existing
- Invalid project-type → Display supported types
- uv not installed → Prompt to install uv first
```

### Command Best Practices

1. **Clear usage syntax**: Show exact command format with arguments
2. **Concrete examples**: Provide 2-3 realistic usage examples
3. **Detailed workflow**: Break execution into clear phases
4. **Error handling**: Document common failures and solutions
5. **Validation**: Check preconditions before execution

## Configuring Hooks

### Hook Configuration File

Create `hooks/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' >> ~/.claude/bash-audit.log",
            "description": "Audit all bash commands for security"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "FILE=$(jq -r '.tool_input.file_path'); case $FILE in *.py) black $FILE && ruff check $FILE ;; *.js|*.ts) prettier --write $FILE ;; *.go) gofmt -w $FILE ;; esac",
            "description": "Auto-format code after modifications"
          },
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs git add",
            "description": "Auto-stage modified files"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "docker-compose down",
            "description": "Stop development containers on session end"
          }
        ]
      }
    ]
  }
}
```

### Hook Event Types

| Event | Timing | Blocks Execution | Use Cases |
|-------|--------|------------------|-----------|
| **PreToolUse** | Before tool runs | Yes (non-zero exit) | Validation, logging, setup |
| **PostToolUse** | After tool completes | No | Formatting, linting, cleanup |
| **Stop** | Claude finishes response | No | Session cleanup, notifications |
| **SubagentStop** | Subagent completes | No | Result aggregation, logging |
| **UserPromptSubmit** | Before processing | No | Request logging, analytics |
| **SessionStart** | New/resumed session | No | Environment setup |

### Matcher Patterns

Match specific tools with regex:

```json
{
  "matcher": "Write",           // Only Write tool
  "matcher": "Write|Edit",      // Write OR Edit tools
  "matcher": "Bash",            // Only Bash tool
  "matcher": "",                // All tools (empty matches everything)
  "matcher": "Write.*|Edit.*"   // Regex patterns supported
}
```

### Accessing Tool Data with jq

Hooks receive JSON via stdin:

```bash
# Extract file path
jq -r '.tool_input.file_path'

# Extract bash command
jq -r '.tool_input.command'

# Extract tool output
jq -r '.tool_output'

# Check success status
jq -r '.success'
```

### Hook Best Practices

1. **Audit commands carefully**: Review for security implications
2. **Handle errors gracefully**: Test with invalid inputs
3. **Avoid destructive operations**: Don't delete files without confirmation
4. **Keep commands focused**: One responsibility per hook
5. **Document side effects**: Explain what hooks do and when

### Common Hook Patterns

**Auto-format on save:**
```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "FILE=$(jq -r '.tool_input.file_path'); prettier --write $FILE || black $FILE || gofmt -w $FILE",
      "description": "Format files based on extension"
    }
  ]
}
```

**Run tests after changes:**
```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "npm test -- $(jq -r '.tool_input.file_path')",
      "description": "Run tests for modified files"
    }
  ]
}
```

**Prevent writes to protected directories:**
```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "FILE=$(jq -r '.tool_input.file_path'); [[ $FILE == /etc/* ]] && exit 1 || exit 0",
      "description": "Block writes to /etc"
    }
  ]
}
```

## Assembling Complete Plugins

### Step 1: Create Plugin Structure

```bash
mkdir -p plugins/your-plugin-name/{agents,commands,skills,hooks}
touch plugins/your-plugin-name/{agents/agent.md,commands/command.md,hooks/hooks.json}
mkdir -p plugins/your-plugin-name/skills/skill-name
touch plugins/your-plugin-name/skills/skill-name/SKILL.md
```

### Step 2: Create Marketplace Manifest

Create `.claude-plugin/marketplace.json`:

```json
{
  "name": "your-marketplace-name",
  "owner": {
    "name": "Your Name or Organization",
    "email": "[email protected]"
  },
  "plugins": [
    {
      "name": "your-plugin-name",
      "source": "./plugins/your-plugin-name",
      "description": "Brief description of what your plugin does",
      "version": "1.0.0",
      "author": {
        "name": "Your Name"
      },
      "homepage": "https://github.com/your-org/plugins",
      "repository": "https://github.com/your-org/plugins",
      "license": "MIT",
      "keywords": ["development", "python", "automation"],
      "category": "development",
      "strict": false,
      "agents": [
        "./agents/agent-name.md"
      ],
      "commands": [
        "./commands/command-name.md"
      ],
      "skills": [
        "./skills/skill-name"
      ]
    }
  ]
}
```

### Step 3: Validate Structure

Check that all referenced files exist:

```bash
# Verify agents
ls plugins/your-plugin-name/agents/

# Verify commands
ls plugins/your-plugin-name/commands/

# Verify skills
ls plugins/your-plugin-name/skills/*/SKILL.md

# Verify hooks
cat plugins/your-plugin-name/hooks/hooks.json | jq .
```

### Step 4: Test Installation

Install locally for testing:

```bash
cd /path/to/plugin/repo
/plugin marketplace add file://$(pwd)
/plugin install your-plugin-name
```

### Step 5: Test Functionality

Test each component:

**Agents**: Make requests that should trigger agents
```
"Build a Python FastAPI microservice"
```

**Skills**: Verify skills activate appropriately
```
"Show me FastAPI production patterns"
```

**Commands**: Execute slash commands
```bash
/your-plugin-name:command-name arg1 arg2
```

**Hooks**: Create/edit files and verify hooks execute

### Step 6: Create Documentation

Create `README.md` in plugin directory:

```markdown
# Your Plugin Name

Brief description of what the plugin does and why it's useful.

## Installation

```bash
/plugin marketplace add https://github.com/your-org/plugins
/plugin install your-plugin-name
```

## Components

### Agents

**agent-name** - Description of agent capabilities
- Use when: [specific scenarios]
- Model: sonnet/opus/haiku
- Expertise: [key areas]

### Commands

**command-name** - What the command does
```bash
/your-plugin-name:command-name [arguments]
```

### Skills

**skill-name** - Knowledge domain covered
- Activates when: [trigger scenarios]
- Provides: [key information/patterns]

### Hooks

- **PostToolUse**: Auto-format code after modifications
- **Stop**: Clean up on session end

## Usage Examples

### Example 1: [Scenario]
```
[User request]
→ [What happens]
→ [Result]
```

### Example 2: [Another scenario]
```
[User request]
→ [What happens]
→ [Result]
```

## Troubleshooting

**Issue**: Description of common problem
**Solution**: How to fix it

## License

MIT
```

### Step 7: Publish

Push to GitHub or Git hosting:

```bash
git init
git add .
git commit -m "Initial plugin release"
git remote add origin https://github.com/your-org/plugins.git
git push -u origin main
```

Users can now install with:

```bash
/plugin marketplace add https://github.com/your-org/plugins
/plugin install your-plugin-name
```

## Best Practices

### Design Principles

**1. Single Responsibility**: Each agent/skill/command should have one clear purpose

**2. Progressive Disclosure**: Load information incrementally
- Agents: Metadata → Full prompt (on activation)
- Skills: Metadata → Instructions → Resources (as needed)
- Commands: Overview → Details (on execution)

**3. Composability**: Components should work together seamlessly
- Skills serve multiple agents
- Agents coordinate explicitly
- Commands trigger appropriate agents

**4. Token Efficiency**: Minimize baseline token usage
- Keep metadata concise (<100 tokens)
- Use skills instead of agent prompt embedding
- Load resources on-demand only

### Naming Conventions

**Use kebab-case exclusively:**
- ✅ `python-expert`, `fastapi-patterns`, `code-scaffold`
- ❌ `python_expert`, `FastAPIPatterns`, `Code Scaffold`

**Be specific and descriptive:**
- ✅ `fastapi-production-patterns`
- ❌ `patterns`, `fastapi-stuff`

**Follow role-based naming for agents:**
- ✅ `backend-architect`, `security-auditor`, `python-expert`
- ❌ `helper1`, `agent-x`, `the-backend-guy`

### Description Writing

**Include clear activation criteria:**
```yaml
description: Expert Python 3.12+ developer specializing in async patterns, testing, and modern tooling. Use PROACTIVELY when building Python applications, optimizing async code, or implementing test strategies.
```

**Use "PROACTIVELY" for automatic invocation:**
- Signals Claude Code to auto-route matching requests
- Critical for seamless user experience

**Be specific about expertise boundaries:**
```yaml
description: Backend API architect focusing on REST/GraphQL design. Use when designing APIs or microservices architecture. Defer infrastructure to cloud-architect.
```

### Model Tier Optimization

**Cost-performance matrix:**

| Task Complexity | Model Choice | Justification |
|----------------|--------------|---------------|
| Simple, deterministic | haiku | Fast, cost-effective |
| Standard development | sonnet | Balanced quality/cost |
| Complex reasoning | opus | Highest capability |

**Hybrid orchestration:**
- Route workflows through multiple model tiers
- Use haiku for boilerplate → sonnet for implementation → opus for review

### Security Considerations

**Tool restrictions:**
- Review agents only: `Read, Grep, Bash`
- No shell access: `Read, Write, Edit`
- Limited deployment: `Bash, Read` (no Write/Edit)

**Hook safety:**
- Audit all commands for destructive operations
- Avoid commands that modify system configuration
- Test error handling thoroughly
- Don't expose credentials or secrets

**Validation:**
- Sanitize user inputs in commands
- Validate file paths before operations
- Check permissions before writes
- Log security-relevant actions

### Documentation Standards

**Required documentation:**
1. **README.md**: Overview, installation, usage
2. **Agent descriptions**: In YAML frontmatter
3. **Command syntax**: Clear usage examples
4. **Hook behavior**: What hooks do and when
5. **Troubleshooting**: Common issues and solutions

**Good documentation includes:**
- Installation steps
- 2-3 realistic usage examples
- Component catalog (agents/skills/commands)
- Troubleshooting section
- License information

### Testing Strategy

**Component testing:**
- **Agents**: Test activation with various phrasings
- **Skills**: Verify progressive disclosure works
- **Commands**: Test with valid/invalid arguments
- **Hooks**: Test tool invocations and error cases

**Integration testing:**
- Test multi-agent workflows
- Verify skill composition
- Test command-to-agent coordination
- Validate hook execution timing

**Token usage testing:**
- Measure baseline overhead (should be ~300 tokens)
- Verify progressive disclosure activates correctly
- Monitor token consumption during complex workflows

## Troubleshooting

### Plugin Won't Install

**Symptom**: `/plugin install` fails or shows no components

**Causes and solutions:**

1. **Invalid marketplace.json syntax**
   ```bash
   # Validate JSON syntax
   cat .claude-plugin/marketplace.json | jq .
   ```

2. **Incorrect file paths**
   ```bash
   # Verify all referenced files exist
   ls plugins/your-plugin-name/agents/
   ls plugins/your-plugin-name/skills/*/SKILL.md
   ```

3. **Invalid YAML frontmatter**
   ```bash
   # Check for syntax errors in agent files
   # Ensure proper --- delimiters
   ```

### Agent Doesn't Activate

**Symptom**: Agent exists but never gets invoked

**Solutions:**

1. **Make description more specific**: Include clear activation triggers
   ```yaml
   description: Python expert... Use PROACTIVELY when building Python applications
   ```

2. **Add relevant keywords**: Match terms users are likely to use
   ```yaml
   description: FastAPI, REST API, microservices, async patterns, Python web development
   ```

3. **Test with explicit invocation**: Use agent name directly
   ```
   "Use python-expert to refactor this code"
   ```

### Skill Never Loads

**Symptom**: Skill defined but content doesn't appear

**Solutions:**

1. **Add "Use when" triggers**: Skill descriptions must include activation criteria
   ```yaml
   description: FastAPI patterns... Use when building FastAPI applications
   ```

2. **Check file location**: Skill must be in `skills/skill-name/SKILL.md`

3. **Verify registration**: Check marketplace.json includes skill path
   ```json
   "skills": ["./skills/skill-name"]
   ```

### Hooks Don't Execute

**Symptom**: File changes don't trigger expected automation

**Solutions:**

1. **Check hooks.json syntax**: Validate JSON
   ```bash
   cat hooks/hooks.json | jq .
   ```

2. **Verify matcher patterns**: Ensure regex matches intended tools
   ```json
   "matcher": "Write|Edit"  // Must match tool names exactly
   ```

3. **Test hook commands manually**: Run command independently
   ```bash
   echo '{"tool_input":{"file_path":"test.py"}}' | jq -r '.tool_input.file_path'
   ```

4. **Check exit codes**: PreToolUse hooks must exit 0 to allow execution

### High Token Usage

**Symptom**: Plugin consumes excessive tokens

**Solutions:**

1. **Move content to skills**: Extract knowledge from agent prompts
2. **Implement progressive disclosure**: Use three-tier skill structure
3. **Minimize Tier 1 metadata**: Keep under 100 tokens per skill
4. **Use on-demand resources**: Keep examples in Tier 3

### Command Fails

**Symptom**: Slash command errors or produces unexpected results

**Solutions:**

1. **Validate arguments**: Check command receives expected parameters
2. **Test workflow phases**: Execute each phase independently
3. **Add error handling**: Handle invalid inputs gracefully
4. **Improve documentation**: Clarify usage and constraints

---

## Additional Resources

### Official Documentation
- [Claude Code Plugins](https://docs.claude.com/en/docs/claude-code/plugins)
- [Agent Skills Overview](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)
- [Hooks Guide](https://docs.claude.com/en/docs/claude-code/hooks-guide)

### Example Repositories
- [wshobson/agents](https://github.com/wshobson/agents) - 84+ production agents
- [getty104/claude-code-marketplace](https://github.com/getty104/claude-code-marketplace) - TDD automation
- [anthropics/skills](https://github.com/anthropics/skills) - Official skill examples

### Community
- [Claude AI Discord](https://discord.gg/anthropic)
- [Anthropic Support](https://support.claude.com)

---

*This guide is based on analysis of 84+ production implementations and official Anthropic specifications. For questions or contributions, see the Overture project repository.*