# CLAUDE.md as Universal Coordination Mechanism

## Overview

This document explores how CLAUDE.md can serve as a universal coordination mechanism for Overture, reducing duplication across plugins while providing context, conventions, and instructions that all components can reference.

## CLAUDE.md Fundamentals

### What is CLAUDE.md?

CLAUDE.md is a special file automatically loaded into Claude Code's context when starting a conversation. It serves as **project memory** that persists across sessions.

### Hierarchical Memory System

Claude Code loads CLAUDE.md files from multiple locations:

1. **User Memory** (`~/.claude/CLAUDE.md`)
   - Global to all projects
   - Personal preferences, coding style, shortcuts
   - Always loaded

2. **Project Memory** (`./CLAUDE.md` in project root)
   - Project-specific context
   - Checked into git, shared with team
   - Loaded for all work in project

3. **Subdirectory Memory** (`./subdir/CLAUDE.md`)
   - Loaded on-demand when accessing files in that directory
   - Keeps context focused
   - Prevents token waste

### Key Characteristics

- **Automatic Loading**: No manual invocation required
- **Always Present**: Injected into every prompt
- **Hierarchical Merging**: All applicable files merged into context
- **Import Support**: Can import other files via `@path/to/file` syntax
- **Version Controlled**: Should be committed to share with team

## The Duplication Problem (Current State)

### Scenario: Python Testing Knowledge

Without coordination, same information appears in multiple places:

```
Plugin: python-dev-plugin
├── skills/write-tests/SKILL.md
│   └── "Use pytest with fixtures. Follow AAA pattern..."
│
├── agents/test-engineer.md
│   └── "You are a test engineer. Use pytest with fixtures..."
│
├── commands/test.md
│   └── "Run tests using pytest. Tests should use fixtures..."
│
└── .github/copilot-instructions.md
    └── "Write tests using pytest with fixtures..."
```

**Problem**: Same "pytest conventions" duplicated 4 times.

### Why This Is Bad

1. **Maintenance Burden**: Update in 4 places when conventions change
2. **Inconsistency Risk**: Easy to update one but forget others
3. **Token Waste**: Same information loaded multiple times
4. **Version Drift**: Different components get out of sync

## CLAUDE.md as Coordination Hub (Proposed)

### Core Concept: Single Source of Truth

Use CLAUDE.md as the **universal knowledge base** that all components reference:

```
CLAUDE.md (project root)
    ↓
    ├─→ Subagents read from CLAUDE.md
    ├─→ Skills reference CLAUDE.md
    ├─→ Commands assume CLAUDE.md context
    └─→ Hooks rely on CLAUDE.md conventions

copilot-instructions.md (generated)
    └─→ Extracted from CLAUDE.md
```

### Architecture

```
┌────────────────────────────────────────┐
│         CLAUDE.md                      │
│    (Single Source of Truth)            │
│                                        │
│  ## Project Conventions                │
│  - Python: Use pytest, AAA pattern     │
│  - Git: Conventional commits           │
│  - Code style: Black, isort            │
│                                        │
│  ## Available Tools                    │
│  - pytest-runner: Run tests            │
│  - git-tools: Git operations           │
│                                        │
│  ## Testing Standards                  │
│  - [Detailed testing guide]            │
└────────────────────────────────────────┘
            ↓ (reference)
    ┌───────┴────────┐
    ↓                ↓
┌─────────┐    ┌──────────┐
│ Plugins │    │ Copilot  │
│         │    │ (extract)│
│ Agents  │    └──────────┘
│ Skills  │
│ Commands│
└─────────┘
```

## Deep Thinking: Coordination Patterns

### Pattern 1: Knowledge Extraction

Instead of duplicating knowledge in components, **extract it to CLAUDE.md**:

**Before:**

```markdown
# agents/test-engineer.md

---

## name: test-engineer

You are a test engineer specializing in Python.

Use pytest with these conventions:

- AAA pattern (Arrange, Act, Assert)
- Fixtures in conftest.py
- Parametrize for multiple cases
- Mock external dependencies
```

**After:**

```markdown
# agents/test-engineer.md

---

## name: test-engineer

You are a test engineer specializing in Python.

Follow the project's testing conventions documented in CLAUDE.md.
Focus on writing comprehensive, maintainable tests.
```

**CLAUDE.md:**

```markdown
## Testing Conventions

All tests follow these standards:

- AAA pattern (Arrange, Act, Assert)
- Fixtures in conftest.py
- Parametrize for multiple cases
- Mock external dependencies
```

**Benefits:**

- ✅ Single update point for conventions
- ✅ Subagent focuses on role, not repeated conventions
- ✅ CLAUDE.md always in context (automatic)
- ✅ Other components reference same conventions

### Pattern 2: Tool Registry

CLAUDE.md can serve as **tool documentation hub**:

```markdown
# CLAUDE.md

## Available MCP Tools

### pytest-runner

**Purpose**: Execute pytest test suites
**Usage**: Invoke for running tests, supports markers and filters
**When to use**: Test writing, debugging, CI validation

### git-tools

**Purpose**: Git operations (status, diff, commit, push)
**Usage**: All git interactions
**When to use**: Version control operations

### black-formatter

**Purpose**: Python code formatting
**Usage**: Format Python files to project standards
**When to use**: Before committing code
```

**Components then reference tools by name:**

```yaml
# overture.yaml
subagents:
  test-engineer:
    tools: [pytest-runner, git-tools]
    # Tool docs automatically available via CLAUDE.md
```

**Benefits:**

- ✅ Subagents know tool purpose without documentation duplication
- ✅ Update tool docs once, all components benefit
- ✅ New team members read CLAUDE.md to understand tooling

### Pattern 3: Convention Inheritance

Components **inherit** conventions from CLAUDE.md implicitly:

```markdown
# CLAUDE.md

## Code Style

- Python: Black formatter, 88 line length, isort for imports
- TypeScript: Prettier, 2-space indent
- Git: Conventional commits (feat:, fix:, docs:)
- Tests: Co-located with source in **tests**/
```

**All components automatically follow these** because CLAUDE.md is always loaded.

Subagents don't need to say "use Black formatter" - they just do, because it's in CLAUDE.md.

### Pattern 4: Project Architecture Reference

CLAUDE.md documents **big-picture architecture**:

```markdown
# CLAUDE.md

## Architecture

This is a FastAPI backend with React frontend.

### Backend (`/backend`)

- FastAPI app in `app/main.py`
- Models in `app/models/`
- Routes in `app/routes/`
- Tests in `tests/`

### Frontend (`/frontend`)

- React + TypeScript
- Components in `src/components/`
- State: Redux in `src/store/`
- API client: `src/api/`

### Shared Conventions

- API follows REST conventions
- Authentication via JWT tokens
- All dates in ISO 8601 format
```

**Subagents benefit from this context:**

- Backend agent knows where to find models
- Frontend agent understands API contract
- Test agent knows test location conventions
- All agents understand authentication flow

### Pattern 5: Workflow Coordination

CLAUDE.md can define **cross-component workflows**:

```markdown
# CLAUDE.md

## Development Workflow

### Adding a New Feature

1. Create feature branch: `git checkout -b feat/feature-name`
2. Implement with tests (TDD encouraged)
3. Run full test suite: `pytest`
4. Format code: `black . && isort .`
5. Commit: Conventional commit message
6. Push and create PR

### Code Review Standards

- All tests passing
- Code coverage > 80%
- No linter warnings
- Documentation updated
```

**Components coordinate around this:**

- Hooks can enforce workflow steps
- Commands can implement workflow shortcuts
- Subagents understand the process
- Skills align with workflow expectations

## Overture Integration Strategy

### Level 1: CLAUDE.md Generation

Overture generates CLAUDE.md from plugin configuration:

```yaml
# overture.yaml
plugin:
  name: 'python-dev'

  # This metadata generates CLAUDE.md sections
  conventions:
    python:
      formatter: black
      line_length: 88
      test_framework: pytest
      test_pattern: AAA

    git:
      commit_style: conventional
      branch_prefix: true

  project_info:
    architecture: 'FastAPI backend with React frontend'
    backend_dir: '/backend'
    frontend_dir: '/frontend'
```

**Overture generates:**

```markdown
# CLAUDE.md (auto-generated by Overture)

## Project Configuration

This project uses the `python-dev` plugin.

## Code Conventions

### Python

- Formatter: Black (88 line length)
- Test framework: pytest
- Test pattern: AAA (Arrange, Act, Assert)

### Git

- Commit style: Conventional commits
- Branch prefixes: Required

## Architecture

FastAPI backend with React frontend

- Backend: `/backend`
- Frontend: `/frontend`
```

### Level 2: Component References

Components explicitly reference CLAUDE.md sections:

```markdown
# agents/test-engineer.md

---

name: test-engineer
claude_md_sections: [python_conventions, testing_standards]

---

You are a test engineer.

Follow conventions in CLAUDE.md sections:

- Python conventions
- Testing standards

Your role: Write comprehensive, maintainable tests.
```

**Overture validation:**

- Checks referenced sections exist in CLAUDE.md
- Warns if sections missing
- Suggests adding sections to overture.yaml

### Level 3: Smart Extraction

Overture detects duplicated content and extracts to CLAUDE.md:

```python
# Overture analysis
def analyze_duplication(plugin_config):
    """
    Detect duplicated knowledge across components
    """
    knowledge_fragments = []

    # Collect all instructional content
    for agent in plugin_config.subagents:
        knowledge_fragments.append(
            extract_knowledge(agent.file)
        )

    for skill in plugin_config.skills:
        knowledge_fragments.append(
            extract_knowledge(skill.directory)
        )

    # Detect duplicates
    duplicates = find_similar_content(knowledge_fragments)

    if duplicates:
        warn(f"Found {len(duplicates)} duplicate knowledge blocks")
        suggest("Consider extracting to CLAUDE.md:")
        for dup in duplicates:
            suggest(f"  - {dup.summary}")
```

### Level 4: CLAUDE.md Sections in overture.yaml

```yaml
# overture.yaml

plugin:
  name: 'python-dev'

# Generate CLAUDE.md from this
claude_md:
  sections:
    project_overview: |
      FastAPI backend with React frontend.
      See architecture diagram in docs/architecture.md

    conventions:
      python:
        formatter: black
        linter: ruff
        test_framework: pytest

      git:
        commit_format: conventional
        branch_naming: 'type/description'

    development_commands:
      test: 'pytest'
      lint: 'ruff check .'
      format: 'black . && isort .'
      dev_server: 'uvicorn app.main:app --reload'

    testing_standards: |
      All tests follow AAA pattern:
      - Arrange: Set up test data and conditions
      - Act: Execute the code being tested
      - Assert: Verify expected outcomes

      Use fixtures for common setup.
      Parametrize for multiple test cases.

  imports:
    - docs/architecture.md # Import detailed docs
    - docs/api-conventions.md

# Components implicitly benefit from CLAUDE.md
subagents:
  test-engineer:
    # Automatically has access to testing_standards section
    file: ./agents/test-engineer.md
```

## GitHub Copilot Synchronization

### Challenge: Copilot Uses .github/copilot-instructions.md

Different file location and format from CLAUDE.md.

### Solution: Generate copilot-instructions.md from CLAUDE.md

```
CLAUDE.md (master)
    ↓ (Overture generator)
.github/copilot-instructions.md (derived)
```

### Mapping Strategy

| CLAUDE.md Section  | Copilot Instructions              |
| ------------------ | --------------------------------- |
| Conventions        | Coding guidelines                 |
| Architecture       | Project structure context         |
| Commands           | Document as workflows             |
| Testing Standards  | Testing guidelines                |
| Tool Registry      | (Skip - Copilot doesn't have MCP) |
| Subagent Workflows | Document as patterns              |

### Generation Example

**Input (CLAUDE.md):**

```markdown
## Python Conventions

- Formatter: Black (88 line length)
- Linter: Ruff
- Test framework: pytest with AAA pattern

## Architecture

FastAPI backend in `/backend`
React frontend in `/frontend`
```

**Output (.github/copilot-instructions.md):**

```markdown
# GitHub Copilot Instructions

## Python Code Style

Format all Python code with Black (88 character line length).
Lint with Ruff before committing.
Write tests using pytest following AAA pattern (Arrange, Act, Assert).

## Project Structure

This project has a FastAPI backend in the `/backend` directory and a React frontend in `/frontend`.
When working on backend code, follow FastAPI conventions.
When working on frontend code, use React best practices.
```

### Overture Command

```bash
overture sync --copilot
```

Reads CLAUDE.md, generates copilot-instructions.md with appropriate transformations.

## Advanced Patterns

### Pattern: Layered Knowledge

```
~/.claude/CLAUDE.md (personal)
    └─→ "I prefer verbose comments and explicit types"

project/CLAUDE.md (team)
    └─→ "Use pytest, Black formatter, FastAPI patterns"

project/backend/CLAUDE.md (subdirectory)
    └─→ "Backend-specific: SQLAlchemy models, Alembic migrations"
```

All layers merge into context. Overture can manage each layer:

```yaml
# overture.yaml
claude_md:
  layers:
    project: # Root CLAUDE.md
      sections: { ... }

    subdirectories:
      backend: # backend/CLAUDE.md
        sections:
          database: 'SQLAlchemy ORM, Alembic for migrations'

      frontend: # frontend/CLAUDE.md
        sections:
          state_management: 'Redux with TypeScript'
```

### Pattern: Dynamic Imports

CLAUDE.md can import documentation:

```markdown
# CLAUDE.md

## Architecture

@docs/architecture.md

## API Design

@docs/api-conventions.md

## Database Schema

@docs/schema.md
```

**Overture ensures imports exist:**

```yaml
claude_md:
  imports:
    - path: docs/architecture.md
      required: true # Build fails if missing
    - path: docs/performance.md
      required: false # Optional
```

### Pattern: Tool-Specific Contexts

```markdown
# CLAUDE.md

## For Claude Code

This project uses MCP servers: pytest-runner, git-tools, black-formatter.
Invoke these tools when appropriate.

## For GitHub Copilot

Note: This project has automated tooling via Claude Code MCP servers.
When suggesting code, assume formatting and testing can be automated.
```

Overture can filter sections for each tool:

```yaml
claude_md:
  sections:
    conventions:
      for: [claude, copilot] # Both tools see this

    mcp_tools:
      for: [claude] # Only Claude Code sees this

    manual_workflows:
      for: [copilot] # Only Copilot sees this
```

## Token Budget Considerations

### Problem: CLAUDE.md Uses Tokens

Every session loads CLAUDE.md into context, consuming tokens.

### Best Practices (from research)

1. **Keep Under 100 Lines**: Reasonable token budget
2. **Be Specific, Not Generic**: Avoid "write clean code" platitudes
3. **Use Bullet Points**: Not long paragraphs
4. **Emphasize Critical Items**: "IMPORTANT:" for must-follow rules

### Overture's Role: Optimization

```bash
overture build --optimize-tokens
```

Analyzes CLAUDE.md and suggests:

- Remove redundant statements
- Consolidate similar points
- Use more concise phrasing
- Flag generic advice

### Token Budget Allocation

```yaml
# overture.yaml
claude_md:
  token_budget:
    max_lines: 100
    priority:
      - conventions: high # Always include
      - commands: medium # Include if space
      - examples: low # Skip if over budget
```

## Implementation in Overture

### Phase 1: Basic Generation

```bash
overture build
```

Generates CLAUDE.md from `overture.yaml`:

```yaml
claude_md:
  sections:
    project_overview: '...'
    conventions: { ... }
```

### Phase 2: Duplication Detection

```bash
overture validate --check-duplication
```

Scans subagent/skill files, detects duplicated knowledge:

```
⚠ Duplication detected:
  - "pytest AAA pattern" appears in:
    - agents/test-engineer.md (lines 15-20)
    - skills/write-tests/SKILL.md (lines 8-12)

  💡 Suggestion: Extract to CLAUDE.md testing_standards section
```

### Phase 3: Copilot Sync

```bash
overture sync --copilot
```

Generates `.github/copilot-instructions.md` from CLAUDE.md.

### Phase 4: Smart Extraction

```bash
overture extract --from agents --to claude-md
```

Automatically extracts common knowledge from components to CLAUDE.md:

1. Analyzes all component files
2. Finds repeated patterns
3. Creates CLAUDE.md sections
4. Updates components to reference CLAUDE.md
5. Shows diff for review

## Example: Complete Integration

### overture.yaml (with CLAUDE.md config)

```yaml
version: '1.0'

plugin:
  name: 'python-web-dev'
  version: '1.0.0'

# CLAUDE.md generation config
claude_md:
  sections:
    project_overview: |
      Full-stack Python web application:
      - Backend: FastAPI + SQLAlchemy
      - Frontend: React + TypeScript
      - Database: PostgreSQL

    conventions:
      python:
        formatter: black
        line_length: 88
        linter: ruff
        type_checker: mypy

      testing:
        framework: pytest
        pattern: AAA
        coverage_minimum: 80

      git:
        commit_style: conventional
        branch_format: 'type/description'

    commands:
      test: 'pytest -v'
      lint: 'ruff check . && mypy .'
      format: 'black . && isort .'
      dev: 'uvicorn app.main:app --reload'

    architecture: |
      ## Backend Structure
      - app/main.py: FastAPI application
      - app/models/: SQLAlchemy models
      - app/routes/: API endpoints
      - app/services/: Business logic
      - tests/: Test suite

      ## Frontend Structure
      - src/components/: React components
      - src/store/: Redux state management
      - src/api/: Backend API client

  imports:
    - docs/architecture.md
    - docs/database-schema.md

  token_optimization:
    max_lines: 100
    prioritize: [conventions, commands, architecture]

  sync:
    copilot: true
    sections_for_copilot: [conventions, architecture]

# MCP Servers (documented in CLAUDE.md)
mcp_servers:
  pytest-runner:
    type: stdio
    command: npx
    args: ['-y', 'pytest-mcp']

# Subagents (reference CLAUDE.md implicitly)
subagents:
  test-engineer:
    description: 'Writes comprehensive tests'
    file: ./agents/test-engineer.md
    tools: [pytest-runner]
    # No need to duplicate testing conventions - they're in CLAUDE.md

# Skills (reference CLAUDE.md sections)
skills:
  write-api-endpoint:
    description: 'Create new FastAPI endpoint'
    directory: ./skills/write-api-endpoint/
    # Inherits Python conventions from CLAUDE.md
```

### Generated CLAUDE.md

```markdown
# CLAUDE.md

_Auto-generated by Overture from python-web-dev plugin_

## Project Overview

Full-stack Python web application:

- Backend: FastAPI + SQLAlchemy
- Frontend: React + TypeScript
- Database: PostgreSQL

## Code Conventions

### Python

- Formatter: Black (88 line length)
- Linter: Ruff
- Type checker: MyPy

### Testing

- Framework: pytest
- Pattern: AAA (Arrange, Act, Assert)
- IMPORTANT: Minimum 80% code coverage required

### Git

- Commit style: Conventional commits (feat:, fix:, docs:)
- Branch format: type/description (e.g., feat/user-authentication)

## Development Commands

- Run tests: `pytest -v`
- Lint code: `ruff check . && mypy .`
- Format code: `black . && isort .`
- Start dev server: `uvicorn app.main:app --reload`

## Architecture

### Backend Structure

- app/main.py: FastAPI application entry point
- app/models/: SQLAlchemy ORM models
- app/routes/: API endpoint definitions
- app/services/: Business logic layer
- tests/: Test suite

### Frontend Structure

- src/components/: React components
- src/store/: Redux state management
- src/api/: Backend API client

## Available Tools (MCP Servers)

- **pytest-runner**: Execute test suites with pytest

## Additional Documentation

@docs/architecture.md
@docs/database-schema.md
```

### Generated .github/copilot-instructions.md

```markdown
# GitHub Copilot Custom Instructions

_Generated by Overture from python-web-dev plugin_

## Python Code Style

Format all Python code with Black using 88 character line length.
Run Ruff linter and MyPy type checker before committing.
Follow type hints for all function signatures.

## Testing Guidelines

Write tests using pytest following the AAA pattern:

- **Arrange**: Set up test data and conditions
- **Act**: Execute the code being tested
- **Assert**: Verify expected outcomes

Maintain minimum 80% code coverage for all new code.

## Git Workflow

Use conventional commit messages:

- feat: New features
- fix: Bug fixes
- docs: Documentation changes
- test: Test additions or modifications

Branch naming: `type/description` (e.g., `feat/user-authentication`)

## Project Architecture

This is a full-stack Python web application with:

- **Backend**: FastAPI + SQLAlchemy in the root directory
- **Frontend**: React + TypeScript in the `/frontend` directory
- **Database**: PostgreSQL

When working on the backend:

- Place models in `app/models/`
- Add routes in `app/routes/`
- Implement business logic in `app/services/`
- Write tests in `tests/`

When working on the frontend:

- Create components in `src/components/`
- Manage state in `src/store/` using Redux
- Define API calls in `src/api/`
```

## Benefits Summary

### 1. Single Source of Truth ✅

- Update conventions once in CLAUDE.md
- All components benefit immediately
- No duplication, no drift

### 2. Automatic Context ✅

- CLAUDE.md always loaded
- Components don't repeat what's already there
- Cleaner, more focused components

### 3. Team Coordination ✅

- CLAUDE.md checked into git
- Team shares same conventions
- New members read one file to understand project

### 4. Token Efficiency ✅

- Conventions in CLAUDE.md, not repeated in every component
- Overture optimizes CLAUDE.md for token budget
- More tokens available for actual work

### 5. Cross-Tool Sync ✅

- Generate copilot-instructions.md from CLAUDE.md
- Maintain consistency across tools
- Update once, sync everywhere

### 6. Validation ✅

- Overture detects duplication
- Warns about missing conventions
- Suggests extraction to CLAUDE.md

## Conclusion

CLAUDE.md is the **perfect coordination hub** for Overture because:

1. **It's already there**: Claude Code automatically loads it
2. **It's hierarchical**: User, project, subdirectory layers
3. **It's version controlled**: Team shares conventions
4. **It's always in context**: No explicit invocation needed
5. **It's tool-agnostic**: Can generate Copilot version

**Recommendation**: Make CLAUDE.md a first-class citizen in Overture architecture.

## Sources

1. [Manage Claude's memory - Claude Docs](https://docs.claude.com/en/docs/claude-code/memory) (Official)
2. [CLAUDE.md - Steve Kinney Course](https://stevekinney.com/courses/ai-development/claude-dot-md)
3. [Claude Code Best Practices - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices) (Official)
4. [What's a Claude.md File - Apidog](https://apidog.com/blog/claude-md/)
5. [Maximising Claude Code: Building an Effective CLAUDE.md](https://www.maxitect.blog/posts/maximising-claude-code-building-an-effective-claudemd)
6. [Adding custom instructions for GitHub Copilot - GitHub Docs](https://copilot-instructions.md/) (Official)
7. [Using a GitHub Copilot instructions file](https://chrissmith.xyz/blog/2025/using-a-github-copilot-instructions-file/)
8. [Mastering GitHub Copilot Custom Instructions - Medium](https://medium.com/@anil.goyal0057/mastering-github-copilot-custom-instructions-with-github-copilot-instructions-md-f353e5abf2b1)

---

**Document Date**: 2025-10-19
**Status**: Deep analysis complete
**Recommendation**: Integrate CLAUDE.md as coordination hub in Overture architecture
