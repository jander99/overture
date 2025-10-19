# Overture Implementation Plan

## Overview

This document defines the implementation strategy for Overture, including technology stack selection and architectural approach using Nx.dev as the foundation for dependency management and smart builds.

**Date**: 2025-10-19
**Status**: Implementation planning

---

## Technology Stack Analysis

### Option 1: Node.js + TypeScript + Nx ⭐ RECOMMENDED

#### Pros
✅ **TypeScript**: Type safety, excellent IDE support, catches errors at compile time
✅ **Nx Ecosystem**: Built-in generators, executors, dependency graph, caching
✅ **Rich CLI Ecosystem**: Commander, Inquirer, Chalk, Ora for polished UX
✅ **Fast Development**: Hot reload, instant feedback
✅ **Community**: Massive ecosystem, extensive documentation
✅ **Monorepo Native**: Nx designed for exactly this use case
✅ **Distribution**: NPM/PNPM for package management, familiar to developers
✅ **CI/CD**: Nx Cloud for distributed caching and CI optimization

#### Cons
❌ **Runtime**: Requires Node.js installed
❌ **Binary Size**: Larger than compiled languages
❌ **Cold Start**: Slightly slower than native binaries (mitigated by bun/Node 20+)

#### Package Managers
- **NPM**: Default, widely used
- **PNPM**: Fast, disk-efficient (RECOMMENDED)
- **Yarn**: Modern, good workspace support
- **Bun**: Extremely fast, growing adoption

**Recommendation**: PNPM for speed + Nx for monorepo

### Option 2: Python + uv/uvx

#### Pros
✅ **uv**: Blazing fast Python package installer (Rust-based)
✅ **uvx**: Fast script execution, no venv needed
✅ **Type Hints**: Python 3.11+ has good type checking (Pyright/MyPy)
✅ **Familiar**: Many developers know Python
✅ **YAML Native**: PyYAML, ruamel.yaml for config parsing
✅ **Rich CLI**: Typer, Click for CLI building

#### Cons
❌ **No Nx Equivalent**: Would need to build dependency graph system from scratch
❌ **Monorepo Support**: Less mature than Node.js ecosystem
❌ **Slower Startup**: Python interpreter overhead (mitigated by uv)
❌ **Type Checking**: Not as seamless as TypeScript
❌ **Async**: asyncio less intuitive than promises/async-await

#### Build Systems
- **Poetry**: Dependency management
- **Rye**: Modern Python project management
- **Hatch**: Extensible build system
- **None match Nx capabilities** for smart rebuilds and project graphs

### Decision Matrix

| Criterion | Node + TS + Nx | Python + uv | Winner |
|-----------|----------------|-------------|--------|
| Type Safety | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Node |
| Dependency Graph | ⭐⭐⭐⭐⭐ (Nx) | ⭐⭐ (manual) | Node |
| Smart Rebuilds | ⭐⭐⭐⭐⭐ (Nx) | ⭐ (manual) | Node |
| CLI Tooling | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Node |
| Performance | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Tie |
| Community | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Node |
| Monorepo | ⭐⭐⭐⭐⭐ (Nx) | ⭐⭐ | Node |
| Distribution | ⭐⭐⭐⭐⭐ (NPM) | ⭐⭐⭐ (PyPI) | Node |

**Decision**: ✅ **Node.js + TypeScript + Nx**

The Nx ecosystem is **perfectly suited** for Overture's architecture where components (plugins, agents, skills) form a dependency graph.

---

## Nx-Based Architecture

### Core Concept: Everything is an Nx Project

Each component type becomes an Nx project:
- **Plugin** = Nx project
- **Subagent** = Nx project
- **Skill** = Nx project
- **Hook** = Nx project
- **MCP Server Config** = Nx project
- **Command** = Nx project

### Workspace Structure

```
overture-workspace/
├── nx.json                      # Nx workspace config
├── package.json                 # Workspace dependencies
├── pnpm-workspace.yaml          # PNPM workspace config
├── tsconfig.base.json           # Shared TypeScript config
├── overture.yaml                # Workspace-level Overture config
│
├── packages/
│   ├── cli/                     # Main Overture CLI
│   │   ├── src/
│   │   ├── package.json
│   │   └── project.json
│   │
│   ├── core/                    # Core library (shared code)
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   ├── parser/
│   │   │   ├── validator/
│   │   │   └── generator/
│   │   ├── package.json
│   │   └── project.json
│   │
│   ├── generators/              # Nx generators for Overture
│   │   ├── plugin/
│   │   ├── agent/
│   │   ├── skill/
│   │   └── hook/
│   │
│   └── executors/               # Nx executors for Overture
│       ├── build/
│       ├── validate/
│       └── sync/
│
├── plugins/                     # User's plugins (Nx projects)
│   ├── python-dev/
│   │   ├── plugin.yaml
│   │   ├── project.json         # Nx project config
│   │   └── README.md
│   │
│   └── web-dev/
│       ├── plugin.yaml
│       └── project.json
│
├── agents/                      # Subagents (Nx projects)
│   ├── test-engineer/
│   │   ├── agent.yaml
│   │   ├── agent.md
│   │   ├── project.json
│   │   └── README.md
│   │
│   ├── code-reviewer/
│   │   ├── agent.yaml
│   │   ├── agent.md
│   │   └── project.json
│   │
│   └── api-developer/
│       └── ...
│
├── skills/                      # Skills (Nx projects)
│   ├── write-tests/
│   │   ├── skill.yaml
│   │   ├── SKILL.md
│   │   ├── templates/
│   │   ├── project.json
│   │   └── README.md
│   │
│   └── review-python/
│       └── ...
│
├── hooks/                       # Hooks (Nx projects)
│   ├── pre-commit-check/
│   │   ├── hook.yaml
│   │   ├── project.json
│   │   └── README.md
│   │
│   └── post-test-notify/
│       └── ...
│
├── commands/                    # Slash commands (Nx projects)
│   ├── test/
│   │   ├── command.yaml
│   │   ├── command.md
│   │   └── project.json
│   │
│   └── review/
│       └── ...
│
├── mcp-servers/                 # MCP server configs (Nx projects)
│   ├── pytest-runner/
│   │   ├── server.yaml
│   │   └── project.json
│   │
│   └── git-tools/
│       └── ...
│
├── dist/                        # Build output
│   ├── plugins/
│   └── claude-code/             # Generated Claude Code plugin structure
│       └── copilot/             # Generated Copilot config
│
└── .nx/                         # Nx cache
    └── cache/
```

### Component Configuration Files

#### Plugin Configuration

```yaml
# plugins/python-dev/plugin.yaml
version: "1.0"
type: plugin

metadata:
  name: "python-dev"
  version: "1.0.0"
  description: "Python development workflow"
  author: "username"
  active: true                   # Active/inactive flag

# Dependencies (Nx will track these)
dependencies:
  agents:
    - test-engineer
    - code-reviewer

  skills:
    - write-tests
    - review-python

  mcp_servers:
    - pytest-runner
    - git-tools

  commands:
    - test
    - review

  hooks:
    - pre-commit-check

# CLAUDE.md generation
claude_md:
  sections:
    conventions:
      python:
        formatter: black
        linter: ruff

    commands:
      test: "pytest -v"
      format: "black . && isort ."
```

#### Nx Project Configuration

```json
// plugins/python-dev/project.json
{
  "name": "plugin-python-dev",
  "projectType": "application",

  "targets": {
    "validate": {
      "executor": "@overture/executors:validate",
      "options": {
        "config": "plugin.yaml"
      }
    },

    "build": {
      "executor": "@overture/executors:build",
      "dependsOn": [
        "^build"  // Build all dependencies first
      ],
      "inputs": [
        "{projectRoot}/**/*",
        "^default"  // Include dependency changes
      ],
      "outputs": [
        "{workspaceRoot}/dist/plugins/{projectName}"
      ],
      "options": {
        "config": "plugin.yaml",
        "outputPath": "dist/plugins/python-dev"
      }
    },

    "sync": {
      "executor": "@overture/executors:sync",
      "dependsOn": ["build"],
      "options": {
        "targets": ["claude-code", "copilot"]
      }
    }
  },

  "tags": ["type:plugin", "scope:python"]
}
```

#### Subagent Configuration

```yaml
# agents/test-engineer/agent.yaml
version: "1.0"
type: agent

metadata:
  name: "test-engineer"
  description: "Writes comprehensive test cases"
  active: true

# Dependencies this agent needs
dependencies:
  mcp_servers:
    - pytest-runner
    - git-tools

  skills:
    - write-tests  # References skill project

# Agent-specific configuration
configuration:
  model: "claude-sonnet-4-5"
  tools:
    - pytest-runner
    - git-tools

# Content file
content_file: "./agent.md"
```

```markdown
<!-- agents/test-engineer/agent.md -->
---
name: test-engineer
description: Writes comprehensive test cases
tools:
  - pytest-runner
  - git-tools
---

# Test Engineer Agent

You are a specialized test engineer focused on writing comprehensive,
maintainable test suites.

## Your Role

Follow the project's testing conventions documented in CLAUDE.md.

## Capabilities

- Write unit tests following AAA pattern
- Create integration tests
- Debug failing tests
- Suggest test improvements

## Tools

Use pytest-runner MCP server for executing tests.
Use git-tools for checking test files.
```

### Dependency Graph

Nx automatically builds a project graph:

```
plugin-python-dev
├─> agent-test-engineer
│   ├─> mcp-server-pytest-runner
│   └─> skill-write-tests
│       └─> mcp-server-pytest-runner
├─> agent-code-reviewer
│   └─> skill-review-python
├─> skill-write-tests
├─> skill-review-python
├─> mcp-server-pytest-runner
├─> mcp-server-git-tools
├─> command-test
└─> hook-pre-commit-check
```

**Visualization**:
```bash
nx graph
# Opens interactive browser showing dependency graph
```

### Smart Rebuilds

When user edits `agents/test-engineer/agent.md`:

```bash
nx build plugin-python-dev

# Nx automatically:
# 1. Detects agent-test-engineer changed
# 2. Rebuilds agent-test-engineer
# 3. Rebuilds plugin-python-dev (depends on test-engineer)
# 4. Skips unchanged components (cached)
```

**Affected command**:
```bash
# Only rebuild what changed
nx affected:build --base=main
```

---

## CLI Implementation

### Wrapper CLI: `overture`

The `overture` CLI wraps Nx commands with user-friendly interface:

```typescript
// packages/cli/src/index.ts
import { Command } from 'commander';
import { execSync } from 'child_process';

const program = new Command();

program
  .name('overture')
  .description('Unified AI coding assistant configuration')
  .version('1.0.0');

// User-friendly commands map to Nx under the hood
program
  .command('new <type> <name>')
  .description('Create a new component')
  .option('-t, --template <name>', 'Template to use')
  .action((type, name, options) => {
    // Maps to Nx generator
    execSync(`nx generate @overture/${type}:${type} ${name}`, {
      stdio: 'inherit'
    });
  });

program
  .command('build [component]')
  .description('Build component(s)')
  .option('--all', 'Build all components')
  .action((component, options) => {
    if (options.all) {
      execSync('nx run-many --target=build --all', { stdio: 'inherit' });
    } else if (component) {
      execSync(`nx build ${component}`, { stdio: 'inherit' });
    } else {
      // Build current directory's component
      const projectName = getCurrentProject();
      execSync(`nx build ${projectName}`, { stdio: 'inherit' });
    }
  });

program
  .command('validate [component]')
  .option('--check-duplication', 'Check for duplicated knowledge')
  .action((component, options) => {
    const target = component || getCurrentProject();
    execSync(`nx validate ${target}`, { stdio: 'inherit' });

    if (options.checkDuplication) {
      // Run custom duplication analysis
      execSync(`nx run ${target}:analyze-duplication`, { stdio: 'inherit' });
    }
  });

program.parse();
```

### User Experience

```bash
# Initialize workspace
overture init my-workspace
cd my-workspace

# Create new plugin (uses Nx generator)
overture new plugin python-dev --template python

# Create new agent (uses Nx generator)
overture new agent test-engineer

# Edit files
vim agents/test-engineer/agent.md

# Validate
overture validate test-engineer
# → nx validate agent-test-engineer

# Build plugin (smart rebuild)
overture build python-dev
# → nx build plugin-python-dev
# Automatically builds dependencies first

# Build everything
overture build --all
# → nx run-many --target=build --all

# View dependency graph
overture graph
# → nx graph

# Sync to tools
overture sync --claude --copilot
# → nx run-many --target=sync --all
```

---

## Nx Generators

### Generator: Create Plugin

```typescript
// packages/generators/plugin/index.ts
import { Tree, formatFiles, generateFiles, names } from '@nx/devkit';

interface PluginGeneratorSchema {
  name: string;
  template?: string;
  description?: string;
  author?: string;
}

export default async function pluginGenerator(
  tree: Tree,
  schema: PluginGeneratorSchema
) {
  const normalizedNames = names(schema.name);
  const projectRoot = `plugins/${normalizedNames.fileName}`;

  // Generate project files from templates
  generateFiles(
    tree,
    join(__dirname, 'files'),
    projectRoot,
    {
      ...schema,
      ...normalizedNames,
      tmpl: '',  // Remove __tmpl__ from file names
    }
  );

  // Add Nx project configuration
  addProjectConfiguration(tree, `plugin-${normalizedNames.fileName}`, {
    root: projectRoot,
    projectType: 'application',
    targets: {
      validate: {
        executor: '@overture/executors:validate',
      },
      build: {
        executor: '@overture/executors:build',
        dependsOn: ['^build'],
      },
      sync: {
        executor: '@overture/executors:sync',
        dependsOn: ['build'],
      },
    },
    tags: ['type:plugin'],
  });

  await formatFiles(tree);
}
```

**Template files** (`packages/generators/plugin/files/`):

```yaml
# plugin.yaml__tmpl__
version: "1.0"
type: plugin

metadata:
  name: "<%= name %>"
  version: "1.0.0"
  description: "<%= description %>"
  author: "<%= author %>"
  active: true

dependencies:
  agents: []
  skills: []
  mcp_servers: []
  commands: []
  hooks: []

claude_md:
  sections:
    conventions: {}
    commands: {}
```

### Generator: Create Agent

```typescript
// packages/generators/agent/index.ts
export default async function agentGenerator(
  tree: Tree,
  schema: AgentGeneratorSchema
) {
  const projectRoot = `agents/${schema.name}`;

  // Generate agent files
  generateFiles(tree, join(__dirname, 'files'), projectRoot, {
    ...schema,
    tmpl: '',
  });

  // Add Nx project
  addProjectConfiguration(tree, `agent-${schema.name}`, {
    root: projectRoot,
    projectType: 'library',  // Agents are libraries (reusable)
    targets: {
      build: {
        executor: '@overture/executors:build-agent',
      },
      validate: {
        executor: '@overture/executors:validate',
      },
    },
    tags: ['type:agent'],
  });

  await formatFiles(tree);
}
```

---

## Nx Executors

### Executor: Build Plugin

```typescript
// packages/executors/build/index.ts
import { ExecutorContext } from '@nx/devkit';
import { BuildExecutorSchema } from './schema';

export default async function buildExecutor(
  options: BuildExecutorSchema,
  context: ExecutorContext
) {
  const projectName = context.projectName;
  const projectRoot = context.workspace.projects[projectName].root;

  console.log(`Building ${projectName}...`);

  try {
    // 1. Load plugin configuration
    const pluginConfig = await loadPluginConfig(projectRoot);

    // 2. Resolve dependencies
    const dependencies = await resolveDependencies(
      pluginConfig,
      context
    );

    // 3. Validate all components
    await validateComponents(dependencies);

    // 4. Generate CLAUDE.md
    const claudeMd = await generateClaudeMd(pluginConfig, dependencies);

    // 5. Generate plugin structure
    const outputPath = options.outputPath || `dist/plugins/${projectName}`;
    await generatePluginStructure(outputPath, {
      config: pluginConfig,
      dependencies,
      claudeMd,
    });

    // 6. Generate Copilot config (if enabled)
    if (pluginConfig.sync?.copilot) {
      await generateCopilotConfig(outputPath, claudeMd);
    }

    console.log(`✓ Built ${projectName} successfully`);
    return { success: true };

  } catch (error) {
    console.error(`✗ Build failed: ${error.message}`);
    return { success: false };
  }
}

async function resolveDependencies(config, context) {
  const resolved = {
    agents: [],
    skills: [],
    mcp_servers: [],
    commands: [],
    hooks: [],
  };

  // For each agent dependency, load its project
  for (const agentName of config.dependencies.agents || []) {
    const agentProject = `agent-${agentName}`;
    const agentRoot = context.workspace.projects[agentProject].root;

    // Load agent configuration
    const agentConfig = await loadAgentConfig(agentRoot);
    const agentContent = await readFile(join(agentRoot, 'agent.md'));

    resolved.agents.push({
      name: agentName,
      config: agentConfig,
      content: agentContent,
    });
  }

  // Repeat for skills, mcp_servers, etc.
  // ...

  return resolved;
}

async function generatePluginStructure(outputPath, data) {
  // Create .claude-plugin structure
  const structure = {
    '.claude-plugin/plugin.json': generateManifest(data.config),
    'agents/': data.dependencies.agents,
    'skills/': data.dependencies.skills,
    'commands/': data.dependencies.commands,
    'CLAUDE.md': data.claudeMd,
  };

  // Write files to output directory
  for (const [path, content] of Object.entries(structure)) {
    await writeStructure(join(outputPath, path), content);
  }
}
```

### Executor: Validate

```typescript
// packages/executors/validate/index.ts
export default async function validateExecutor(
  options: ValidateExecutorSchema,
  context: ExecutorContext
) {
  const projectName = context.projectName;
  const projectRoot = context.workspace.projects[projectName].root;

  console.log(`Validating ${projectName}...`);

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Validate YAML syntax
    const config = await loadConfig(projectRoot);

    // 2. Validate schema
    const schemaErrors = validateSchema(config);
    errors.push(...schemaErrors);

    // 3. Check dependencies exist
    for (const dep of getAllDependencies(config)) {
      const depProject = getDependencyProject(dep, context);
      if (!depProject) {
        errors.push(`Dependency not found: ${dep}`);
      }
    }

    // 4. Check for circular dependencies
    const cycles = detectCycles(context, projectName);
    if (cycles.length > 0) {
      errors.push(`Circular dependencies detected: ${cycles.join(' -> ')}`);
    }

    // 5. Validate content files exist
    const contentFile = config.content_file || config.metadata?.content_file;
    if (contentFile && !existsSync(join(projectRoot, contentFile))) {
      errors.push(`Content file not found: ${contentFile}`);
    }

    // 6. Check for duplicated knowledge (if requested)
    if (options.checkDuplication) {
      const duplicates = await analyzeDuplication(projectRoot, context);
      warnings.push(...duplicates);
    }

    // Report results
    if (errors.length > 0) {
      console.error('✗ Validation failed:');
      errors.forEach(err => console.error(`  - ${err}`));
      return { success: false };
    }

    if (warnings.length > 0) {
      console.warn('⚠ Warnings:');
      warnings.forEach(warn => console.warn(`  - ${warn}`));
    }

    console.log(`✓ Validation passed`);
    return { success: true };

  } catch (error) {
    console.error(`✗ Validation error: ${error.message}`);
    return { success: false };
  }
}
```

### Executor: Sync

```typescript
// packages/executors/sync/index.ts
export default async function syncExecutor(
  options: SyncExecutorSchema,
  context: ExecutorContext
) {
  console.log('Syncing to AI tools...');

  const builtPlugins = findBuiltPlugins('dist/plugins');

  for (const plugin of builtPlugins) {
    // Sync to Claude Code
    if (options.targets.includes('claude-code')) {
      await syncToClaudeCode(plugin);
    }

    // Sync to Copilot
    if (options.targets.includes('copilot')) {
      await syncToCopilot(plugin);
    }
  }

  console.log('✓ Sync complete');
  return { success: true };
}

async function syncToClaudeCode(plugin) {
  const claudePluginsDir = expandTilde('~/.claude/plugins');
  const targetDir = join(claudePluginsDir, plugin.name);

  // Copy plugin structure to Claude Code
  await copyRecursive(plugin.path, targetDir);

  console.log(`  ✓ Synced to Claude Code: ${plugin.name}`);
}

async function syncToCopilot(plugin) {
  // Find .github/copilot-instructions.md in current project
  const copilotInstructions = join(
    process.cwd(),
    '.github',
    'copilot-instructions.md'
  );

  // Copy generated Copilot config
  const source = join(plugin.path, 'copilot-instructions.md');
  if (existsSync(source)) {
    await ensureDir(dirname(copilotInstructions));
    await copyFile(source, copilotInstructions);
    console.log(`  ✓ Synced to Copilot: ${plugin.name}`);
  }
}
```

---

## Active/Inactive Flag Implementation

### In Configuration

```yaml
# agents/test-engineer/agent.yaml
metadata:
  name: "test-engineer"
  active: true  # Toggle without deleting files
```

### In Build Process

```typescript
async function resolveDependencies(config, context) {
  const resolved = { agents: [], skills: [], ... };

  for (const agentName of config.dependencies.agents || []) {
    const agentConfig = await loadAgentConfig(agentRoot);

    // Skip if inactive
    if (!agentConfig.metadata.active) {
      console.log(`  ⊘ Skipping inactive agent: ${agentName}`);
      continue;
    }

    resolved.agents.push({ ... });
  }

  return resolved;
}
```

### CLI Support

```bash
# Deactivate agent
overture deactivate agent test-engineer
# Sets active: false in agent.yaml

# Activate agent
overture activate agent test-engineer
# Sets active: true

# List inactive components
overture list --inactive
```

---

## Benefits of Nx Architecture

### 1. Dependency Tracking ✅

Nx automatically tracks that `plugin-python-dev` depends on `agent-test-engineer`:

```bash
nx graph
# Visual browser showing dependency relationships
```

### 2. Smart Rebuilds ✅

Only rebuild what changed:

```bash
# Edit agent
vim agents/test-engineer/agent.md

# Build plugin - Nx knows to rebuild agent first
nx build plugin-python-dev
# ✓ agent-test-engineer (rebuilt)
# ✓ plugin-python-dev (rebuilt)
# ⊘ agent-code-reviewer (cached - unchanged)
# ⊘ skill-write-tests (cached - unchanged)
```

### 3. Parallel Execution ✅

Nx runs independent tasks in parallel:

```bash
nx run-many --target=build --all

# Builds independent components simultaneously:
# ├─ agent-test-engineer ┐
# ├─ agent-code-reviewer ├─ parallel
# └─ skill-write-tests   ┘
# └─ plugin-python-dev (waits for dependencies)
```

### 4. Caching ✅

Nx caches build results:

```bash
# First build: 5 seconds
nx build plugin-python-dev

# No changes: instant (cached)
nx build plugin-python-dev
# ✓ plugin-python-dev  [existing outputs match the cache, left as is]
```

### 5. Affected Detection ✅

Only process what changed:

```bash
# After git commit
nx affected:build --base=main

# Only rebuilds:
# - Projects with file changes
# - Projects that depend on changed projects
```

### 6. Project Graph ✅

Visual understanding of relationships:

```bash
nx graph

# Opens browser with interactive graph:
# - Nodes: Each component
# - Edges: Dependencies
# - Colors: By type (plugin, agent, skill)
```

### 7. Distributed Caching (Nx Cloud) ✅

Share cache across team:

```bash
nx connect-to-nx-cloud

# Team members download cached builds instead of rebuilding
# CI/CD downloads cached builds from developers
```

### 8. Module Boundaries ✅

Enforce architectural rules:

```json
// nx.json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  },
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "validate"]
      }
    }
  }
}
```

```typescript
// .eslintrc.json - enforce dependency rules
{
  "overrides": [
    {
      "files": ["plugins/**/*.ts"],
      "rules": {
        "@nx/enforce-module-boundaries": [
          "error",
          {
            "allow": [],
            "depConstraints": [
              {
                "sourceTag": "type:plugin",
                "onlyDependOnLibsWithTags": [
                  "type:agent",
                  "type:skill",
                  "type:mcp-server"
                ]
              }
            ]
          }
        ]
      }
    }
  ]
}
```

---

## Challenges and Solutions

### Challenge 1: Nx Learning Curve

**Problem**: Users need to understand Nx concepts

**Solution**: Hide complexity behind `overture` CLI

```bash
# User doesn't see Nx
overture build python-dev

# Under the hood
nx build plugin-python-dev
```

Provide simplified commands, expose Nx for power users.

### Challenge 2: Workspace Setup

**Problem**: Nx expects monorepo structure, users want simple files

**Solution**: Hybrid approach

**Mode 1: Simple** (for beginners)
```bash
overture init --simple ~/my-plugins

# Creates simple directory structure
# Overture manages dependencies manually
```

**Mode 2: Workspace** (for teams/power users)
```bash
overture init --workspace ~/my-workspace

# Creates full Nx workspace
# Full power of dependency graph
```

### Challenge 3: Component Sharing

**Problem**: Users want to share individual agents/skills

**Solution**: NPM packages + Nx workspace

```bash
# Publish agent as NPM package
nx publish agent-test-engineer

# Other users install
pnpm add @my-scope/agent-test-engineer

# Reference in plugin
dependencies:
  agents:
    - "@my-scope/agent-test-engineer"
```

Or use git submodules for simpler sharing.

### Challenge 4: Versioning Components

**Problem**: Components have versions, dependencies have version constraints

**Solution**: Extend config with version constraints

```yaml
# plugins/python-dev/plugin.yaml
dependencies:
  agents:
    - name: test-engineer
      version: "^1.0.0"  # Semver range
```

Nx + PNPM handle version resolution.

### Challenge 5: Distribution

**Problem**: How do users share complete workspaces?

**Solution**: Multiple distribution methods

1. **Git Repository** (simplest)
   ```bash
   git clone git@github.com:user/my-overture-workspace
   cd my-overture-workspace
   pnpm install
   overture build --all
   ```

2. **NPM Workspace Template**
   ```bash
   npm create overture-workspace my-workspace
   ```

3. **Individual Packages**
   ```bash
   pnpm add @user/plugin-python-dev
   ```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-4)

**Goal**: Basic Nx workspace and CLI

**Deliverables**:
- ✅ Nx workspace template
- ✅ Basic CLI (`overture init`, `overture new`)
- ✅ Schema definitions (TypeScript types)
- ✅ Basic generator (plugin, agent, skill)
- ✅ Simple build executor
- ✅ Validation executor

**Commands Working**:
```bash
overture init my-workspace --workspace
cd my-workspace
overture new plugin python-dev
overture new agent test-engineer
overture validate test-engineer
overture build python-dev
```

### Phase 2: Smart Dependencies (Weeks 5-8)

**Goal**: Full dependency resolution and smart rebuilds

**Deliverables**:
- ✅ Dependency resolver
- ✅ Active/inactive flag support
- ✅ Nx project graph integration
- ✅ Affected builds
- ✅ Caching

**Commands Working**:
```bash
overture graph
nx affected:build
overture activate agent test-engineer
overture build --only-changed
```

### Phase 3: CLAUDE.md & Sync (Weeks 9-12)

**Goal**: Generate CLAUDE.md and sync to tools

**Deliverables**:
- ✅ CLAUDE.md generator from plugin config
- ✅ Copilot instructions generator
- ✅ Sync executor
- ✅ Duplication detection
- ✅ Token optimization

**Commands Working**:
```bash
overture build python-dev --generate-claude-md
overture sync --claude --copilot
overture analyze duplication
overture optimize tokens
```

### Phase 4: Polish & Distribution (Weeks 13-16)

**Goal**: Production-ready CLI with distribution

**Deliverables**:
- ✅ NPM package publication
- ✅ Homebrew formula
- ✅ Documentation
- ✅ GitHub template repository
- ✅ Example workspace
- ✅ CI/CD templates

**Distribution**:
```bash
npm install -g overture-cli
# or
brew install overture
```

---

## Technology Stack Summary

### Dependencies

```json
{
  "name": "overture-workspace",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["packages/*", "plugins/*", "agents/*", "skills/*"],

  "devDependencies": {
    "@nx/devkit": "^17.0.0",
    "@nx/js": "^17.0.0",
    "@nx/workspace": "^17.0.0",
    "typescript": "^5.3.0",
    "tsx": "^4.0.0"
  },

  "dependencies": {
    "commander": "^11.0.0",
    "inquirer": "^9.0.0",
    "chalk": "^5.0.0",
    "ora": "^7.0.0",
    "yaml": "^2.3.0",
    "zod": "^3.22.0",
    "fs-extra": "^11.0.0"
  }
}
```

### Key Libraries

- **Nx**: Monorepo management, build system
- **Commander**: CLI framework
- **Inquirer**: Interactive prompts
- **Chalk**: Terminal colors
- **Ora**: Spinners/progress
- **Yaml**: YAML parsing
- **Zod**: Schema validation
- **fs-extra**: File system utilities

---

## Conclusion

The **Nx-based architecture** is ideal for Overture because:

1. ✅ **Natural Fit**: Components as projects matches our domain model
2. ✅ **Dependency Graph**: Built-in, no manual implementation needed
3. ✅ **Smart Rebuilds**: Only rebuild changed components
4. ✅ **Parallel Execution**: Build independent components simultaneously
5. ✅ **Caching**: Speed up builds dramatically
6. ✅ **Generators**: Scaffold components easily
7. ✅ **Executors**: Custom build logic per component type
8. ✅ **Extensible**: Can add new component types easily
9. ✅ **Team-Friendly**: Nx Cloud for distributed caching
10. ✅ **TypeScript Native**: Type-safe throughout

**Recommendation**: ✅ **Proceed with Node.js + TypeScript + Nx + PNPM**

---

**Document Version**: 1.0
**Date**: 2025-10-19
**Status**: Ready for implementation
**Next Step**: Set up initial Nx workspace and generators
