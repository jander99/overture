# Sample Overture Configuration

This directory contains a complete example of an Overture configuration repository structure.

## Purpose

This sample configuration demonstrates:
- ✅ All feature types (plugins, agents, skills, hooks, commands)
- ✅ Both plugin-bundled and standalone features
- ✅ Proper dependency references with directionality
- ✅ Realistic use cases for each feature type
- ✅ Best practices for organization and naming

## Structure Overview

```
sample-config/
├── overture.yaml                 # Main manifest
├── plugins/                      # Plugin bundles
│   ├── code-quality/             # Code quality plugin
│   │   ├── plugin.yaml
│   │   ├── agents/
│   │   │   └── code-reviewer.yaml
│   │   ├── skills/
│   │   │   └── static-analysis/
│   │   ├── hooks/
│   │   │   └── pre-commit-lint.yaml
│   │   └── commands/
│   │       ├── review.md
│   │       └── lint.md
│   └── git-workflows/            # Git workflow plugin
│       ├── plugin.yaml
│       ├── hooks/
│       │   ├── pre-push-test.yaml
│       │   └── commit-message-template.yaml
│       └── commands/
│           ├── create-pr.md
│           └── sync-branch.md
├── agents/                       # Standalone agents
│   └── custom-analyzer.yaml
├── skills/                       # Standalone skills
│   └── testing-utils/
├── hooks/                        # Standalone hooks
│   └── workspace-init.yaml
└── commands/                     # Standalone commands
    └── analyze.md
```

## Features Demonstrated

### Plugins

#### 1. code-quality
Comprehensive code quality tools including:
- **Agent**: `code-reviewer` - Reviews code for best practices and bugs
- **Skill**: `static-analysis` - Performs static code analysis
- **Hook**: `pre-commit-lint` - Runs linting before commits
- **Commands**: `review`, `lint` - Quality checking commands

**Dependencies**:
- Agent depends on: hook (`pre-commit-lint`), skill (`static-analysis`)
- Skill depends on: hook (`setup-analysis-tools`)
- Hook has no dependencies (lowest level)

#### 2. git-workflows
Git workflow automation including:
- **Hooks**: `pre-push-test`, `commit-message-template` - Workflow automation
- **Commands**: `create-pr`, `sync-branch` - Git operations

### Standalone Features

#### Agent: custom-analyzer
Project-specific code analyzer that uses the testing-utils skill.
**Dependencies**: `skill:testing-utils`

#### Skill: testing-utils
Test generation and coverage utilities with implementation files.
**Dependencies**: None

#### Hook: workspace-init
Initializes workspace environment on session start.
**Dependencies**: None

#### Command: analyze
Comprehensive project analysis command.
**Dependencies**: None (implicitly can use any tools)

## Dependency Graph

```
Commands (Level 3)
├── review → agent:code-reviewer
├── lint → (uses tools directly)
├── create-pr → (uses tools directly)
├── sync-branch → (uses tools directly)
└── analyze → (uses tools directly)

Agents (Level 2)
├── code-reviewer → hook:pre-commit-lint, skill:static-analysis
└── custom-analyzer → skill:testing-utils

Skills (Level 1)
├── static-analysis → hook:setup-analysis-tools
└── testing-utils → (no dependencies)

Hooks (Level 0)
├── pre-commit-lint → (no dependencies)
├── pre-push-test → (no dependencies)
├── commit-message-template → (no dependencies)
└── workspace-init → (no dependencies)
```

## Reference Examples

### Within Plugin
In `code-quality/agents/code-reviewer.yaml`:
```yaml
dependencies:
  hooks:
    - hook:pre-commit-lint  # References hook in same plugin
  skills:
    - skill:static-analysis  # References skill in same plugin
```

### Cross-Plugin References (if needed)
```yaml
dependencies:
  hooks:
    - plugin:git-workflows/hook/pre-push-test
```

### Standalone Feature References
In `agents/custom-analyzer.yaml`:
```yaml
dependencies:
  skills:
    - skill:testing-utils  # References standalone skill
```

## Validation Rules Demonstrated

### ✅ Valid Dependencies
- Agent → Skill: `code-reviewer` → `static-analysis`
- Agent → Hook: `code-reviewer` → `pre-commit-lint`
- Skill → Hook: `static-analysis` → `setup-analysis-tools`

### ❌ Invalid Dependencies (prevented by Overture)
- Hook → Agent: Hooks cannot depend on agents
- Hook → Skill: Hooks cannot depend on skills
- Skill → Agent: Skills cannot depend on agents

## Usage

**Note**: This sample configuration has `dev_mode: true` enabled in `overture.yaml`, which prevents Overture from modifying any `~/.claude/` files. This is a safety feature for development and testing. Set `dev_mode: false` when you want to actually apply configurations to your Claude Code setup.

This configuration would be used as follows:

1. **Initialize** (in a real implementation):
   ```bash
   overture init --from sample-config
   ```

2. **Validate**:
   ```bash
   overture validate
   ```

3. **Generate Claude Code configuration**:
   ```bash
   # In dev mode (safe testing):
   overture generate --output ./test-output/

   # Production mode (set dev_mode: false first):
   overture generate --output ~/.claude/
   ```

4. **Use in Claude Code**:
   - `/review` - Run code review
   - `/lint --fix` - Run linting with auto-fix
   - `/create-pr` - Create pull request
   - `/analyze` - Analyze project

## File Formats

### YAML Configuration
All metadata and configuration files use YAML for readability and maintainability.

### Markdown Commands
Commands follow Claude Code's native format (Markdown with YAML frontmatter).

### Implementation Files
Skills include actual implementation files (Python, JavaScript, Shell) demonstrating that skills are executable components.

## Extensibility

This structure can be extended by:
- Adding new plugins to `plugins/`
- Adding standalone features to their respective directories
- Creating new feature types in future versions
- Referencing external plugin repositories in `overture.yaml`

## Notes for Developers

This sample configuration serves as:
1. **Reference Implementation**: Shows correct structure and patterns
2. **Testing Fixture**: Can be used for Overture testing
3. **Documentation**: Living example of best practices
4. **Template**: Starting point for new configurations

## Next Steps

Use this sample to:
- Validate Overture's configuration parser
- Test dependency resolution
- Generate Claude Code configuration files
- Create automated tests
- Document expected behavior
