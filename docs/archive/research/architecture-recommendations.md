# Overture Architecture Recommendations

Based on the validated theory that Overture should treat plugins as the primary product, this document provides detailed architectural recommendations for implementation.

## Executive Summary

**Recommendation**: ✅ Adopt plugin-centric architecture with unified configuration

**Core Principle**: One `overture.yaml` → Multiple output formats (Claude Code plugin, Copilot config)

**Key Addition**: Include **MCP servers** and **slash commands** (missing from original theory)

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│      Overture Unified Configuration         │
│           (overture.yaml)                   │
│                                             │
│  • Plugin Metadata                          │
│  • MCP Servers (tools)                      │
│  • Subagents (AI workers)                   │
│  • Skills (capabilities)                    │
│  • Slash Commands (workflows)               │
│  • Hooks (automation)                       │
└─────────────────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │  Overture Compiler    │
        │                       │
        │  • Parse config       │
        │  • Validate deps      │
        │  • Resolve refs       │
        │  • Check conflicts    │
        └───────────────────────┘
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
┌──────────────────┐    ┌──────────────────┐
│  Claude Code     │    │  GitHub Copilot  │
│  Plugin Package  │    │  Configuration   │
│                  │    │                  │
│  Ready to        │    │  (Partial -      │
│  /plugin install │    │   compatible     │
│                  │    │   features only) │
└──────────────────┘    └──────────────────┘
```

## 1. Configuration Schema Design

### Recommended Format: YAML

**Rationale**:

- Human-readable and editable
- Comments support (vs JSON)
- Less verbose than JSON
- Well-supported by tooling
- Easy to version control

### Core Schema Structure

```yaml
# overture.yaml
version: '1.0'

# Plugin metadata
plugin:
  name: 'my-development-plugin'
  version: '1.0.0'
  author: 'username'
  description: 'Complete development workflow for Python projects'
  repository: 'https://github.com/username/my-dev-plugin'

# Foundation: Tool integrations
mcp_servers:
  pytest-runner:
    type: stdio
    command: npx
    args: ['-y', 'pytest-mcp-server']
    scope: plugin # Options: plugin, user, reference
    description: 'Runs pytest tests'

  git-tools:
    type: stdio
    command: mcp-git
    scope: reference # Reference existing user installation
    description: 'Git operations'

# Intelligence: AI workers
subagents:
  test-engineer:
    description: 'Writes and debugs test cases'
    file: ./agents/test-engineer.md
    tools:
      - pytest-runner
      - git-tools
    skills:
      - write-tests # References skill below
    model: claude-sonnet-4-5 # Optional: specific model

  code-reviewer:
    description: 'Reviews code for quality and style'
    file: ./agents/code-reviewer.md
    tools:
      - git-tools
    skills:
      - review-python

# Capabilities: Reusable instructions
skills:
  write-tests:
    description: 'Generate comprehensive test cases'
    directory: ./skills/write-tests/
    # Contains SKILL.md and supporting files

  review-python:
    description: 'Review Python code following PEP 8'
    directory: ./skills/review-python/

# Workflows: User-invoked commands
commands:
  test:
    description: 'Run test suite with coverage'
    file: ./commands/test.md
    uses_agent: test-engineer # Optional: delegates to agent

  review:
    description: 'Review recent changes'
    file: ./commands/review.md
    uses_agent: code-reviewer

# Automation: Event-driven hooks
hooks:
  pre-commit-check:
    event: PreToolUse
    matcher: 'Bash'
    pattern: 'git commit'
    commands:
      - 'pytest --quick'
      - 'black --check .'

  post-test-notification:
    event: PostToolUse
    matcher: 'pytest-runner'
    commands:
      - "notify-send 'Tests complete'"
```

### Schema Features

1. **Cross-references**: Subagents reference tools and skills
2. **Scoping**: MCP servers specify installation scope
3. **File references**: Point to actual content files
4. **Metadata**: Plugin information for marketplace
5. **Validation targets**: Clear dependency graph

## 2. Overture Component Architecture

### Core Modules

```
overture/
├── cli/
│   ├── init.py           # `overture init` - create new plugin
│   ├── build.py          # `overture build` - generate plugin
│   ├── validate.py       # `overture validate` - check config
│   └── sync.py           # `overture sync` - sync to tools
│
├── schema/
│   ├── parser.py         # Parse overture.yaml
│   ├── validator.py      # Validate configuration
│   └── schema.yaml       # JSON Schema definition
│
├── resolver/
│   ├── dependencies.py   # Resolve component dependencies
│   ├── references.py     # Resolve cross-references
│   └── conflicts.py      # Detect conflicts
│
├── generators/
│   ├── claude/
│   │   ├── plugin.py     # Generate Claude Code plugin
│   │   ├── manifest.py   # Generate plugin.json
│   │   └── structure.py  # Create directory structure
│   │
│   └── copilot/
│       ├── instructions.py  # Generate copilot-instructions.md
│       └── converter.py     # Convert features to Copilot format
│
├── marketplace/
│   ├── publish.py        # Publish to marketplace
│   └── template.py       # Generate marketplace.json
│
└── utils/
    ├── files.py          # File operations
    └── git.py            # Git operations
```

## 3. Dependency Resolution

### Dependency Graph

Overture must track and validate dependencies:

```python
# Conceptual dependency model
class Component:
    name: str
    type: ComponentType  # MCP, Subagent, Skill, etc.
    depends_on: List[Component]

# Example:
test_engineer = Subagent(
    name="test-engineer",
    depends_on=[
        MCPServer("pytest-runner"),
        MCPServer("git-tools"),
        Skill("write-tests")
    ]
)
```

### Validation Rules

1. **Existence Check**: All referenced components must be defined

   ```python
   if subagent.tools contains "pytest-runner":
       assert "pytest-runner" in mcp_servers
   ```

2. **Circular Dependencies**: Detect and prevent cycles

   ```python
   # Invalid: skill-a uses skill-b, skill-b uses skill-a
   detect_cycles(dependency_graph)
   ```

3. **Scope Validation**: Ensure scope compatibility

   ```python
   if mcp_server.scope == "reference":
       warn("Assumes user has {mcp_server.name} installed")
   ```

4. **Tool Access**: Validate subagents can access specified tools
   ```python
   for tool in subagent.tools:
       assert tool in available_mcp_servers
   ```

## 4. Plugin Generation Process

### Step-by-Step Build Process

```
1. Parse Configuration
   └─> Load overture.yaml
   └─> Validate YAML syntax

2. Validate Schema
   └─> Check against JSON Schema
   └─> Verify required fields

3. Resolve Dependencies
   └─> Build dependency graph
   └─> Check all references exist
   └─> Detect circular dependencies

4. Validate Consistency
   └─> Check tool availability
   └─> Verify file references exist
   └─> Validate scope compatibility

5. Generate Plugin Structure
   └─> Create .claude-plugin/ directory
   └─> Generate plugin.json manifest
   └─> Copy agent files to agents/
   └─> Copy skill directories to skills/
   └─> Copy command files to commands/
   └─> Generate hooks configuration
   └─> Bundle or reference MCP servers

6. Generate Copilot Config (if requested)
   └─> Convert compatible features
   └─> Generate .github/copilot-instructions.md
   └─> Document Claude-specific features

7. Package for Distribution
   └─> Create tarball or git repository
   └─> Generate marketplace.json if publishing
   └─> Create README with installation instructions
```

### Generated Plugin Structure

```
my-dev-plugin/
├── .claude-plugin/
│   └── plugin.json                # Generated manifest
│
├── agents/
│   ├── test-engineer.md           # Copied from source
│   └── code-reviewer.md
│
├── skills/
│   ├── write-tests/
│   │   ├── SKILL.md
│   │   └── templates/
│   └── review-python/
│       └── SKILL.md
│
├── commands/
│   ├── test.md
│   └── review.md
│
├── .github/
│   └── copilot-instructions.md    # Generated for Copilot
│
├── README.md                       # Generated installation docs
└── overture.yaml                   # Source configuration (for maintenance)
```

## 5. Conflict Detection and Resolution

### Types of Conflicts

1. **Name Conflicts**: Multiple components with same name

   ```yaml
   # Conflict: Two MCP servers with same name
   mcp_servers:
     git-tools: { type: stdio, command: mcp-git }
     git-tools: { type: http, url: "http://git-api" }  # ERROR
   ```

2. **Scope Conflicts**: Referenced server not available

   ```yaml
   mcp_servers:
     git-tools:
       scope: reference # Assumes user has it

   subagents:
     my-agent:
       tools: [git-tools] # WARNING: Requires user installation
   ```

3. **Circular References**: Components depending on each other

   ```yaml
   # Invalid cycle
   subagents:
     agent-a:
       skills: [skill-b]

   skills:
     skill-b:
       references_agent: agent-a # CYCLE DETECTED
   ```

4. **Missing Dependencies**: Referenced component doesn't exist
   ```yaml
   subagents:
     my-agent:
       tools: [nonexistent-tool] # ERROR: Tool not defined
   ```

### Conflict Resolution Strategies

```python
# Pseudo-code for conflict detection

def validate_configuration(config):
    errors = []
    warnings = []

    # Check for duplicate names
    all_names = collect_all_component_names(config)
    duplicates = find_duplicates(all_names)
    if duplicates:
        errors.append(f"Duplicate names: {duplicates}")

    # Check dependencies exist
    for component in config.all_components():
        for dependency in component.dependencies:
            if not dependency_exists(config, dependency):
                errors.append(
                    f"{component.name} depends on {dependency} which doesn't exist"
                )

    # Check for cycles
    dep_graph = build_dependency_graph(config)
    cycles = detect_cycles(dep_graph)
    if cycles:
        errors.append(f"Circular dependencies: {cycles}")

    # Check scope compatibility
    for subagent in config.subagents:
        for tool in subagent.tools:
            mcp_server = config.mcp_servers[tool]
            if mcp_server.scope == "reference":
                warnings.append(
                    f"{subagent.name} uses {tool} which must be installed by user"
                )

    return errors, warnings
```

## 6. Cross-Tool Synchronization

### Claude Code ↔ Copilot Mapping

| Claude Code Feature | Copilot Equivalent | Sync Strategy                 |
| ------------------- | ------------------ | ----------------------------- |
| MCP Servers         | ❌ None (yet)      | Document in instructions      |
| Subagents           | ❌ None            | Convert to workflow patterns  |
| Skills              | ❌ None            | Convert to instructions       |
| Slash Commands      | ❌ None            | Document as workflows         |
| Hooks               | ❌ None            | Cannot sync (Claude-specific) |

### Copilot Instructions Generation

```python
def generate_copilot_instructions(config):
    """
    Convert Overture config to Copilot instructions
    """
    instructions = []

    # Convert skills to instructions
    instructions.append("## Coding Guidelines\n")
    for skill in config.skills:
        skill_content = load_skill(skill.directory)
        instructions.append(f"### {skill.name}\n")
        instructions.append(convert_to_instructions(skill_content))

    # Document subagent purposes
    instructions.append("\n## Specialized Workflows\n")
    for agent in config.subagents:
        instructions.append(f"### {agent.name}\n")
        instructions.append(f"{agent.description}\n")
        instructions.append("(Note: This workflow is automated in Claude Code)\n")

    # Document tools (as FYI)
    instructions.append("\n## Available Tools (Claude Code)\n")
    for server in config.mcp_servers:
        instructions.append(f"- {server.name}: {server.description}\n")

    return "\n".join(instructions)
```

### Partial Sync Strategy

```yaml
# In overture.yaml, mark sync preferences
plugin:
  sync:
    copilot:
      enabled: true
      components:
        - skills # Convert to instructions
        - subagents # Document as patterns
      exclude:
        - hooks # Can't sync
```

## 7. CLI Interface Design

### Commands

```bash
# Initialize new plugin
overture init my-plugin
# Creates template overture.yaml and directory structure

# Validate configuration
overture validate
# Checks overture.yaml for errors and warnings

# Build plugin
overture build
# Generates complete plugin structure

# Build with Copilot sync
overture build --copilot
# Also generates Copilot configuration

# Install locally for testing
overture install
# Installs to ~/.claude/plugins/ for testing

# Publish to marketplace
overture publish --marketplace gh:username/marketplace
# Publishes to specified marketplace

# Sync to tools (future)
overture sync --claude --copilot
# Syncs configuration to both tools
```

### User Workflow Example

```bash
# 1. Create new plugin project
overture init python-dev-plugin
cd python-dev-plugin

# 2. Edit configuration
vim overture.yaml

# 3. Add agent files
mkdir -p agents
vim agents/test-engineer.md

# 4. Add skill files
mkdir -p skills/write-tests
vim skills/write-tests/SKILL.md

# 5. Validate
overture validate

# 6. Build
overture build

# 7. Test locally
overture install

# 8. Publish
git init
git add .
git commit -m "Initial plugin"
git remote add origin git@github.com:username/python-dev-plugin
git push
overture publish --marketplace gh:username/marketplace
```

## 8. Advanced Features

### 8.1 Template System

```yaml
# Support for plugin templates
plugin:
  template: python-web-dev
  # Inherits base MCP servers, agents, skills

  # Override or extend
  mcp_servers:
    custom-tool:
      type: stdio
      command: my-tool
```

### 8.2 Plugin Composition

```yaml
# Compose from other plugins
plugin:
  name: my-comprehensive-plugin

  includes:
    - plugin: python-dev@1.0.0
      components: [subagents, skills] # Import specific components

    - plugin: git-workflow@2.0.0
      components: [commands, hooks]

  # Add additional components
  subagents:
    custom-agent:
      # ...
```

### 8.3 Environment-Specific Overrides

```yaml
# overture.yaml - base configuration
plugin:
  name: my-plugin

---
# overture.dev.yaml - development overrides
mcp_servers:
  api:
    url: 'http://localhost:3000'

---
# overture.prod.yaml - production overrides
mcp_servers:
  api:
    url: 'https://api.production.com'
```

Build with environment:

```bash
overture build --env prod
```

### 8.4 Plugin Versioning

```yaml
plugin:
  version: '2.0.0'

  # Version constraints for dependencies
  includes:
    - plugin: base-tools@^1.5.0 # Semver range
```

## 9. Implementation Phases

### Phase 1: MVP (Minimum Viable Product)

**Goal**: Generate basic Claude Code plugins from YAML

**Features**:

- ✅ Parse overture.yaml
- ✅ Validate basic schema
- ✅ Generate plugin structure
- ✅ Copy agent/skill/command files
- ✅ Generate plugin.json manifest
- ✅ Basic dependency checking

**Timeline**: 2-3 weeks

### Phase 2: Dependency Management

**Goal**: Robust validation and conflict detection

**Features**:

- ✅ Full dependency graph
- ✅ Circular dependency detection
- ✅ Scope validation
- ✅ Conflict resolution
- ✅ Better error messages

**Timeline**: 2-3 weeks

### Phase 3: Cross-Tool Sync

**Goal**: Generate Copilot configurations

**Features**:

- ✅ Convert skills to Copilot instructions
- ✅ Document Claude-specific features
- ✅ Partial sync support
- ✅ Sync configuration options

**Timeline**: 2-3 weeks

### Phase 4: Advanced Features

**Goal**: Plugin composition and ecosystem

**Features**:

- ✅ Plugin templates
- ✅ Plugin composition (includes)
- ✅ Environment overrides
- ✅ Marketplace publishing
- ✅ Version management

**Timeline**: 4-6 weeks

## 10. Success Metrics

### Developer Experience

- **Time to create plugin**: < 30 minutes (vs hours manually)
- **Configuration errors**: Caught before installation
- **Dependency issues**: Detected and explained clearly
- **Learning curve**: < 1 hour to understand overture.yaml

### Technical Metrics

- **Validation coverage**: 100% of dependency issues caught
- **Generation success**: 100% of valid configs generate working plugins
- **Cross-tool compatibility**: Skills convertible to Copilot instructions
- **Plugin size**: Minimal overhead from Overture

## 11. Key Decisions Summary

| Decision              | Recommendation | Rationale                                |
| --------------------- | -------------- | ---------------------------------------- |
| Primary product       | ✅ Plugins     | Distribution unit, marketplace ecosystem |
| Config format         | ✅ YAML        | Human-readable, comments, less verbose   |
| Components            | ✅ 5 types     | MCP, Subagents, Skills, Commands, Hooks  |
| Dependency resolution | ✅ Full graph  | Catch all conflicts before generation    |
| Copilot sync          | ✅ Partial     | Convert what's compatible, document rest |
| Plugin composition    | ✅ Phase 4     | Enable reuse, not MVP-critical           |
| CLI interface         | ✅ Simple      | init, validate, build, publish           |

## 12. Next Steps

1. ✅ **Finalize Schema**: Complete JSON Schema for overture.yaml
2. ✅ **Create Parser**: Implement YAML parser with validation
3. ✅ **Build Generator**: Claude Code plugin structure generation
4. ✅ **Add Validator**: Dependency resolution and conflict detection
5. ✅ **Test with Examples**: Create sample plugins to validate approach
6. ✅ **Document**: Write user guide and API docs
7. ✅ **Community Feedback**: Share with Claude Code community for input

## Conclusion

The plugin-centric architecture is **strongly validated** and recommended for Overture. With the addition of MCP servers and slash commands to the component list, this approach provides:

- ✅ Clear value proposition (unified config → multiple outputs)
- ✅ Natural fit with Claude Code ecosystem (plugins are the distribution unit)
- ✅ Dependency management (validation before installation)
- ✅ Cross-tool compatibility (partial sync to Copilot)
- ✅ Scalability (composition, templates, versioning)

**Status**: Ready to begin implementation

---

**Document Version**: 1.0
**Date**: 2025-10-19
**Author**: Claude Code (Sonnet 4.5)
