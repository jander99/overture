# Overture Directory Structure

This document defines the directory structure for Overture external configuration repositories.

## Overview

Overture configurations are designed to be stored in version-controlled repositories (e.g., GitHub). Users maintain their Claude Code configurations as code, enabling sharing, versioning, and collaboration.

## Root Directory Structure

```
overture-config/                      # User's configuration repository
├── overture.yaml                     # Main manifest file
├── plugins/                          # Plugin bundles
│   └── [plugin-name]/
│       ├── plugin.yaml               # Plugin metadata and manifest
│       ├── agents/
│       │   └── [agent-name].yaml
│       ├── skills/
│       │   └── [skill-name]/
│       │       ├── skill.yaml
│       │       └── [implementation-files]
│       ├── hooks/
│       │   └── [hook-name].yaml
│       └── commands/
│           └── [command-name].md
├── agents/                           # Standalone agents
│   └── [agent-name].yaml
├── skills/                           # Standalone skills
│   └── [skill-name]/
│       ├── skill.yaml
│       └── [implementation-files]
├── hooks/                            # Standalone hooks
│   └── [hook-name].yaml
└── commands/                         # Standalone commands
    └── [command-name].md
```

## File Formats

### Main Manifest (`overture.yaml`)

The root configuration file that defines enabled features and plugin sources.

```yaml
version: 1.0.0
name: my-claude-config

# Sources for plugins
sources:
  - type: local
    path: ./plugins
  - type: git
    url: https://github.com/overture-plugins/official
  - type: registry
    url: https://registry.overture.example.com

# Enabled features
enabled:
  plugins:
    - plugin-name
  agents:
    - standalone-agent
  skills:
    - standalone-skill
  hooks:
    - standalone-hook
  commands:
    - standalone-command

# Global settings
settings:
  # Development mode - prevents modification of ~/.claude* files
  # Enable when working on Overture itself or testing configurations
  dev_mode: false

  # Validation and safety
  validate_dependencies: true
  auto_update_plugins: false
  strict_mode: true
```

#### Settings Reference

- **`dev_mode`** (boolean, default: `false`)
  - When `true`, prevents Overture from modifying any files in `~/.claude/`
  - Useful for:
    - Developing Overture itself
    - Testing configuration changes without affecting your actual Claude Code setup
    - Validating configurations in CI/CD pipelines
  - In dev mode, Overture will:
    - Still validate configurations
    - Output what changes would be made
    - Write to alternative output directory if specified with `--output`
    - Never touch `~/.claude/config.json`, `~/.claude/mcp.json`, or `~/.claude/commands/`

- **`validate_dependencies`** (boolean, default: `true`)
  - Validates that all feature references exist and follow directionality rules
  - Checks for circular dependencies
  - Verifies plugin dependencies are available

- **`auto_update_plugins`** (boolean, default: `false`)
  - Automatically pull latest versions of git-based plugins
  - Only applies to plugins from git sources

- **`strict_mode`** (boolean, default: `false`)
  - Enforces all validation rules strictly
  - Treats warnings as errors
  - Requires all dependencies to be explicitly declared
```

### Plugin Configuration (`plugins/[name]/plugin.yaml`)

Defines a plugin bundle with metadata and provided features.

```yaml
name: plugin-name
version: 1.0.0
description: Brief description of the plugin
author: username
repository: https://github.com/user/overture-plugin-name

# Features provided by this plugin
provides:
  agents:
    - agent-name
  skills:
    - skill-name
  hooks:
    - hook-name
  commands:
    - command-name

# Dependencies on other plugins
dependencies:
  plugins:
    - other-plugin-name

# Metadata
tags:
  - category1
  - category2
license: MIT
```

### Agent Configuration (`agents/[name].yaml` or `plugins/[plugin]/agents/[name].yaml`)

Defines a Claude Code subagent with specific capabilities.

```yaml
name: agent-name
description: Brief description of what this agent does
type: general-purpose  # or other agent types

# Tools the agent has access to
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep

# Dependencies on other features
dependencies:
  hooks:
    - hook:pre-agent-start
    - hook:post-agent-complete
  skills:
    - skill:code-analysis

# Agent prompt/instructions
prompt: |
  You are a specialized agent for [purpose].

  Your responsibilities:
  1. Task one
  2. Task two

  Follow these guidelines:
  - Guideline one
  - Guideline two
```

### Skill Configuration (`skills/[name]/skill.yaml` or `plugins/[plugin]/skills/[name]/skill.yaml`)

Defines a reusable skill that can be invoked by agents or commands.

```yaml
name: skill-name
description: Brief description of the skill
version: 1.0.0

# Dependencies
dependencies:
  hooks:
    - hook:setup-environment

# Skill implementation files
files:
  - script.py
  - config.json
  - helpers.sh

# Entry point
entrypoint: script.py

# Configuration
config:
  setting1: value1
  setting2: value2
```

### Hook Configuration (`hooks/[name].yaml` or `plugins/[plugin]/hooks/[name].yaml`)

Defines event-driven hooks that execute on specific triggers.

```yaml
name: hook-name
description: Brief description of when and why this hook runs

# Event trigger
event: tool-call  # or: prompt-submit, agent-start, agent-complete, etc.

# Optional: Filter conditions
filter:
  tool: Bash
  pattern: "git.*"

# Command to execute
command: |
  echo "Hook executing..."
  ./scripts/hook-script.sh

# Environment variables
env:
  VAR_NAME: value

# Dependencies (hooks should not depend on higher-level features)
dependencies: []
```

### Command Configuration (`commands/[name].md` or `plugins/[plugin]/commands/[name].md`)

Custom Claude Code commands using the native format (Markdown with YAML frontmatter).

```markdown
---
description: Brief description of what this command does
allowed-tools:
  - Bash(git:*)
  - Read(**/*.js)
  - Edit(**/*.js)
---

# Command Instructions

This command will $ARGUMENTS.

Steps:
1. First step
2. Second step
3. Third step

@src/relevant-file.js  # Reference relevant files

!git status  # Can embed bash commands
```

## Reference System

### Reference Format

Features reference each other using a URI-like scheme:

**Simple Reference** (within same scope):
```
feature-type:feature-name
```

**Plugin-Scoped Reference**:
```
plugin:plugin-name/feature-type/feature-name
```

### Examples

```yaml
# In an agent configuration
dependencies:
  hooks:
    - hook:pre-review          # Standalone hook
    - plugin:git-tools/hook/pre-commit  # Hook from plugin
  skills:
    - skill:static-analysis    # Standalone skill
    - plugin:linters/skill/eslint      # Skill from plugin
```

### Reference Types

- `hook:name` - Hook reference
- `skill:name` - Skill reference
- `agent:name` - Agent reference
- `command:name` - Command reference
- `plugin:name` - Plugin reference
- `plugin:name/type/item` - Feature within a plugin

## Dependency Directionality

Overture enforces a dependency hierarchy to prevent circular dependencies and maintain logical separation:

```
Level 0: hooks       → [no dependencies on other features]
Level 1: skills      → [hooks]
Level 2: agents      → [hooks, skills]
Level 3: commands    → [hooks, skills, agents]
         plugins     → [plugins]
```

### Rules

1. **Hooks** are the lowest level and cannot depend on any other feature type
2. **Skills** can depend on hooks only
3. **Agents** can depend on hooks and skills
4. **Commands** can depend on hooks, skills, and agents
5. **Plugins** can depend on other plugins

### Validation

Overture will validate:
- ✅ Dependency types are allowed per directionality rules
- ✅ Referenced features exist
- ✅ No circular dependencies within the same level
- ✅ Plugin dependencies are available
- ⚠️  Warn about unused features

## Directory Organization Best Practices

### For Small Configurations

Keep it simple with standalone features:

```
overture-config/
├── overture.yaml
├── agents/
│   └── code-reviewer.yaml
├── hooks/
│   └── pre-commit.yaml
└── commands/
    └── review.md
```

### For Large Configurations

Organize into plugins for better modularity:

```
overture-config/
├── overture.yaml
├── plugins/
│   ├── git-workflows/
│   │   ├── plugin.yaml
│   │   ├── hooks/
│   │   │   ├── pre-commit.yaml
│   │   │   └── pre-push.yaml
│   │   └── commands/
│   │       ├── commit.md
│   │       └── push.md
│   └── code-quality/
│       ├── plugin.yaml
│       ├── agents/
│       │   ├── reviewer.yaml
│       │   └── linter.yaml
│       └── skills/
│           └── static-analysis/
│               └── skill.yaml
└── agents/
    └── custom-agent.yaml  # Project-specific standalone agent
```

### Naming Conventions

- **Files**: Use kebab-case (e.g., `code-reviewer.yaml`, `pre-commit.yaml`)
- **Feature names**: Use kebab-case in YAML (e.g., `name: code-reviewer`)
- **Plugin names**: Use kebab-case (e.g., `git-workflows`)
- **Directories**: Use kebab-case (e.g., `code-quality/`)

## Plugin Distribution

### Local Plugins

Store in the repository's `plugins/` directory:

```yaml
# overture.yaml
sources:
  - type: local
    path: ./plugins
```

### Git-Based Plugins

Reference external repositories:

```yaml
sources:
  - type: git
    url: https://github.com/overture-plugins/official
  - type: git
    url: https://github.com/myorg/custom-plugins
```

### Registry-Based Plugins

Use a plugin registry (future feature):

```yaml
sources:
  - type: registry
    url: https://registry.overture.example.com
```

## Development Workflow

1. **Initialize Configuration**
   ```bash
   overture init
   ```

2. **Add Features**
   ```bash
   overture add agent code-reviewer
   overture add plugin git-workflows
   ```

3. **Validate Configuration**
   ```bash
   overture validate
   ```

4. **Generate Claude Code Configuration**
   ```bash
   overture generate --output ~/.claude/
   ```

5. **Commit and Share**
   ```bash
   git add .
   git commit -m "Add code review configuration"
   git push
   ```

## Migration from Claude Code Native Format

Overture can import existing Claude Code configurations:

```bash
overture import --from ~/.claude/
```

This will analyze existing:
- Commands in `.claude/commands/`
- Settings in `.claude/settings.json`
- MCP servers in `.claude/mcp.json`

And generate equivalent Overture configurations.

## Example Use Cases

### Use Case 1: Personal Configuration

A developer maintains their personal Claude Code setup:

```
my-claude-config/
├── overture.yaml
├── commands/
│   ├── deploy.md
│   └── test.md
└── hooks/
    └── format-on-save.yaml
```

### Use Case 2: Team-Shared Plugin

A team creates a shared plugin for their workflow:

```
team-workflow-plugin/
├── plugin.yaml
├── agents/
│   └── pr-reviewer.yaml
├── hooks/
│   ├── pre-commit-lint.yaml
│   └── pre-push-test.yaml
└── commands/
    ├── create-pr.md
    └── deploy-staging.md
```

Published to GitHub, team members reference it:

```yaml
# In team member's overture.yaml
sources:
  - type: git
    url: https://github.com/myteam/team-workflow-plugin

enabled:
  plugins:
    - team-workflow
```

### Use Case 3: Open Source Plugin Ecosystem

Community-contributed plugins available via registry:

```yaml
sources:
  - type: registry
    url: https://plugins.overture.dev

enabled:
  plugins:
    - typescript-tools
    - react-helpers
    - python-dev
```

## Future Considerations

- **Versioning**: Support for plugin versioning and compatibility
- **Overrides**: Allow users to override plugin configurations
- **Environments**: Different configurations for dev/staging/prod
- **Templates**: Plugin templates for common patterns
- **Marketplace**: Searchable plugin directory
- **Testing**: Framework for testing configurations before deployment
