# Plugin Sync Feature Implementation Plan

**Status**: Planning Complete, Ready for Implementation
**Created**: 2025-01-15
**Target Version**: v0.3.0

## Table of Contents

1. [Overview](#overview)
2. [User Requirements](#user-requirements)
3. [Research Summary](#research-summary)
4. [Architecture Components](#architecture-components)
5. [Implementation Steps](#implementation-steps)
6. [Configuration Schema](#configuration-schema)
7. [CLI Command Specifications](#cli-command-specifications)
8. [Testing Strategy](#testing-strategy)
9. [Error Handling](#error-handling)
10. [Parallelization Plan](#parallelization-plan)
11. [Documentation Updates](#documentation-updates)

---

## Overview

Implement plugin synchronization feature for Overture to enable users to keep Claude Code plugins synced across different development environments and machines.

**Core Value Proposition**:
- User maintains a single `~/.config/overture.yml` file
- Sync this file across machines (git, cloud storage, etc.)
- Run `overture sync` on any machine to install declared plugins automatically
- Export current plugin state to config for portability

---

## User Requirements

Based on user clarification session, the following requirements are confirmed:

### ✅ Sync Direction: Hybrid Approach

- **`overture sync`**: Install plugins from config (one-way: config → Claude Code)
  - Config is the source of truth
  - Installs any plugins declared in config that aren't currently installed
  - Skips plugins already installed

- **`overture plugin export`**: Capture installed plugins to config (explicit export)
  - User explicitly chooses which plugins to add to config
  - Interactive selection interface
  - Updates config while preserving structure

### ✅ Storage Location: User Global Only

- **Primary Location**: `~/.config/overture.yml`
- **Rationale**: Claude Code plugins are installed globally for all sessions
- **Project Config Handling**: **Warn if plugins detected in `.overture/config.yaml`**
  - Plugins in project config won't work as expected (Claude Code doesn't support project-scoped plugins)
  - Show warning during sync
  - Suggest moving to user global config

### ✅ Marketplace Handling: Use Shortcuts

- **Format**: Keep current `marketplace: claude-code-workflows` format
- **Implementation**: Hardcoded mapping to full repository paths
  - `claude-code-workflows` → `anthropics/claude-code-workflows`
  - Extensible for future marketplaces
- **Auto-addition**: Automatically add known marketplaces before plugin installation

### ✅ Plugin Detection: Parse `.claude/settings.json`

- **Primary Method**: Parse `.claude/settings.json` to detect installed plugins
- **Location**: Typically `~/.claude/settings.json` (user) or `.claude/settings.json` (project)
- **Fallback**: If settings.json unavailable, rely on state tracking
- **Challenge**: Format is undocumented (public beta), implement with error handling

---

## Research Summary

### Claude Code Plugin System

**What Plugins Are:**
- Highest-level abstraction for extending Claude Code
- Bundle slash commands, subagents, skills, MCP servers, and hooks
- Installed globally for all Claude Code sessions

**Installation Methods:**
```bash
# Interactive
/plugin

# Direct installation
/plugin install plugin-name@marketplace-name

# Example
/plugin install python-development@claude-code-workflows
```

**Marketplace Management:**
```bash
# Add marketplace
/plugin marketplace add anthropics/claude-code-workflows

# Local development
/plugin marketplace add ./dev-marketplace
```

**Plugin Lifecycle:**
```bash
/plugin enable plugin-name@marketplace-name    # Enable disabled plugin
/plugin disable plugin-name@marketplace-name   # Disable without removal
/plugin uninstall plugin-name@marketplace-name # Remove completely
```

### Current Overture Implementation

**Already Implemented:**
- ✅ Plugin config schema: `PluginConfigSchema` with marketplace + mcps
- ✅ Template generation: `claude-md.hbs` generates plugin→MCP guidance
- ✅ Config format: YAML with plugins section

**Not Yet Implemented:**
- ❌ Plugin installation logic
- ❌ Plugin detection/listing
- ❌ State tracking
- ❌ Validation

### Technical Constraints

1. **No Official Programmatic API**: All plugin operations via slash commands
2. **Global Installation**: No user/project distinction in Claude Code itself
3. **Async Installation**: Plugin installation may require user interaction
4. **Undocumented Settings Format**: `.claude/settings.json` format may change
5. **Binary Dependency**: Requires `claude` CLI installed and in PATH

---

## Architecture Components

### 1. PluginDetector Service

**File**: `apps/cli/src/core/plugin-detector.ts`

**Responsibilities:**
- Parse `.claude/settings.json` to detect installed plugins
- Extract plugin name and marketplace information
- Handle missing or malformed settings files gracefully
- Provide list of currently installed plugins

**Interface:**
```typescript
interface InstalledPlugin {
  name: string;
  marketplace: string;
  enabled: boolean;
  installedAt?: string; // If available from settings
}

export class PluginDetector {
  async detectInstalledPlugins(): Promise<InstalledPlugin[]>
  async isPluginInstalled(name: string, marketplace: string): Promise<boolean>
  private parseClaudeSettings(settingsPath: string): Promise<any>
}
```

**Dependencies:**
- File system access for reading `.claude/settings.json`
- Error handling for missing/malformed files

---

### 2. PluginInstaller Service

**File**: `apps/cli/src/core/plugin-installer.ts`

**Responsibilities:**
- Execute `claude plugin install name@marketplace` via child_process
- Handle marketplace auto-addition for known marketplaces
- Capture installation output and errors
- Provide dry-run simulation mode
- Check Claude binary availability before installation

**Interface:**
```typescript
interface InstallationResult {
  success: boolean;
  plugin: string;
  marketplace: string;
  output?: string;
  error?: string;
}

export class PluginInstaller {
  async installPlugin(
    name: string,
    marketplace: string,
    options?: { dryRun?: boolean }
  ): Promise<InstallationResult>

  async ensureMarketplace(marketplace: string): Promise<void>
  private executeClaudeCommand(command: string): Promise<string>
  private checkClaudeBinary(): Promise<boolean>
}
```

**Dependencies:**
- `BinaryDetector` for Claude CLI detection
- `MarketplaceRegistry` for marketplace resolution
- `child_process` for command execution

---

### 3. PluginExporter Service

**File**: `apps/cli/src/core/plugin-exporter.ts`

**Responsibilities:**
- Detect installed plugins via PluginDetector
- Interactive prompt for which plugins to export
- Update `~/.config/overture.yml` with new plugin entries
- Preserve existing config structure and comments

**Interface:**
```typescript
interface ExportOptions {
  interactive?: boolean; // Default true
  pluginNames?: string[]; // Explicit list to export
}

export class PluginExporter {
  async exportPlugins(options?: ExportOptions): Promise<void>
  private promptPluginSelection(plugins: InstalledPlugin[]): Promise<string[]>
  private updateUserConfig(selectedPlugins: InstalledPlugin[]): Promise<void>
}
```

**Dependencies:**
- `PluginDetector` for listing installed plugins
- `ConfigManager` for reading/writing config
- Interactive prompt library (inquirer or similar)

---

### 4. MarketplaceRegistry

**File**: `apps/cli/src/domain/marketplace-registry.ts`

**Responsibilities:**
- Map marketplace shortcuts to full repository paths
- Provide known marketplace configurations
- Support custom marketplace resolution
- Extensible for future marketplaces

**Interface:**
```typescript
interface MarketplaceConfig {
  shortName: string;
  fullPath: string;
  type: 'github' | 'local' | 'custom';
}

export class MarketplaceRegistry {
  private static readonly KNOWN_MARKETPLACES: Record<string, string> = {
    'claude-code-workflows': 'anthropics/claude-code-workflows',
    // Extensible for future marketplaces
  };

  static resolveMarketplace(shortName: string): string
  static isKnownMarketplace(shortName: string): boolean
  static getAllKnown(): MarketplaceConfig[]
}
```

**Implementation:**
```typescript
export class MarketplaceRegistry {
  private static readonly KNOWN_MARKETPLACES: Record<string, string> = {
    'claude-code-workflows': 'anthropics/claude-code-workflows',
  };

  static resolveMarketplace(shortName: string): string {
    return this.KNOWN_MARKETPLACES[shortName] || shortName;
  }

  static isKnownMarketplace(shortName: string): boolean {
    return shortName in this.KNOWN_MARKETPLACES;
  }
}
```

---

### 5. Enhanced SyncEngine

**File**: `apps/cli/src/core/sync-engine.ts` (update existing)

**Enhancements:**
- Before MCP sync, install plugins from user config
- Show progress indicators for plugin installation
- Skip plugin installation if already installed
- Warn if plugins found in project config
- Provide summary of plugin sync results

**New Methods:**
```typescript
export class SyncEngine {
  // Existing methods...

  private async syncPlugins(): Promise<PluginSyncResult>
  private async validatePluginConfig(): Promise<ValidationResult>
  private async installMissingPlugins(
    missing: PluginConfig[]
  ): Promise<InstallationResult[]>
}
```

---

## Implementation Steps

### Phase 1: Foundation (Parallel Execution)

#### Step 1.1: Design Architecture & Types
- **Agent**: `backend-architect`
- **Parallelizable**: ✅ Yes (independent task)
- **Estimated Time**: 1 hour

**Tasks:**
1. Design interfaces for all services
2. Define type definitions for plugin data structures
3. Create architecture decision documentation
4. Review with existing Overture patterns

**Deliverables:**
- `apps/cli/src/core/plugin-detector.interface.ts`
- `apps/cli/src/core/plugin-installer.interface.ts`
- `apps/cli/src/core/plugin-exporter.interface.ts`
- `docs/adr/NNNN-plugin-sync-architecture.md`

**Agent Command:**
```typescript
Task({
  subagent_type: "backend-architect",
  description: "Design plugin sync architecture",
  prompt: `Design the architecture for Overture's plugin sync feature.

  Requirements:
  - Follow existing Overture patterns (detectors, installers, engines)
  - Design PluginDetector, PluginInstaller, PluginExporter services
  - Define interfaces and type definitions
  - Document architecture decisions

  Deliverables:
  - Interface files for each service
  - Type definitions for plugin data structures
  - Architecture decision record in docs/adr/`
})
```

---

#### Step 1.2: Create MarketplaceRegistry
- **Agent**: `typescript-pro`
- **Parallelizable**: ✅ Yes (independent implementation)
- **Estimated Time**: 30 minutes

**Tasks:**
1. Implement marketplace mapping service
2. Add known marketplace configurations
3. Write unit tests for marketplace resolution

**Deliverables:**
- `apps/cli/src/domain/marketplace-registry.ts`
- `apps/cli/src/domain/marketplace-registry.spec.ts`

**Agent Command:**
```typescript
Task({
  subagent_type: "typescript-pro",
  description: "Implement MarketplaceRegistry",
  prompt: `Implement MarketplaceRegistry service for Overture.

  Requirements:
  - Map 'claude-code-workflows' to 'anthropics/claude-code-workflows'
  - Support custom marketplace names (return as-is)
  - Provide isKnownMarketplace() check
  - Make extensible for future marketplaces

  Include comprehensive unit tests with Jest.`
})
```

---

#### Step 1.3: Design Test Strategy
- **Agent**: `test-automator`
- **Parallelizable**: ✅ Yes (can design while components are built)
- **Estimated Time**: 1 hour

**Tasks:**
1. Design comprehensive testing approach
2. Define mock strategies for child_process and file system
3. Create test fixture designs
4. Document test coverage goals

**Deliverables:**
- Test plan document
- Mock strategies documentation
- Test fixtures in `apps/cli/src/core/__fixtures__/`

**Agent Command:**
```typescript
Task({
  subagent_type: "test-automator",
  description: "Design plugin sync test strategy",
  prompt: `Design comprehensive testing strategy for plugin sync feature.

  Components to test:
  - PluginDetector (mocked file system reads)
  - PluginInstaller (mocked child_process)
  - PluginExporter (mocked prompts and file writes)
  - MarketplaceRegistry (pure functions)
  - SyncEngine integration

  Requirements:
  - Mock strategies for child_process.exec
  - Mock strategies for file system operations
  - Test fixture designs (.claude/settings.json examples)
  - Coverage goals: >90% for core services

  Deliverables:
  - Test plan document
  - Test fixture files
  - Mock patterns documentation`
})
```

---

### Phase 2: Core Services (Sequential with some parallelization)

#### Step 2.1: Implement PluginDetector
- **Agent**: `typescript-pro`
- **Parallelizable**: ⚠️ After architecture (Step 1.1), then independent
- **Estimated Time**: 2 hours

**Tasks:**
1. Implement PluginDetector service
2. Parse `.claude/settings.json` with error handling
3. Handle missing/malformed files gracefully
4. Write comprehensive unit tests

**Deliverables:**
- `apps/cli/src/core/plugin-detector.ts`
- `apps/cli/src/core/plugin-detector.spec.ts`
- Test fixtures for various settings.json formats

**Agent Command:**
```typescript
Task({
  subagent_type: "typescript-pro",
  description: "Implement PluginDetector service",
  prompt: `Implement PluginDetector service for Overture.

  Requirements:
  - Parse .claude/settings.json to extract installed plugins
  - Handle missing settings file (return empty list)
  - Handle malformed JSON (log error, return empty list)
  - Extract plugin name, marketplace, enabled status
  - Support both user (~/.claude/) and project (.claude/) locations

  Note: .claude/settings.json format is undocumented, implement defensively.

  Include:
  - Comprehensive error handling
  - Unit tests with mocked fs operations
  - Test fixtures for various settings.json formats
  - JSDoc documentation`
})
```

---

#### Step 2.2: Implement PluginInstaller
- **Agent**: `typescript-pro`
- **Parallelizable**: ✅ Can work in parallel with Step 2.1
- **Estimated Time**: 2.5 hours

**Tasks:**
1. Implement PluginInstaller service
2. Execute Claude CLI commands via child_process
3. Implement marketplace auto-addition
4. Add dry-run mode support
5. Comprehensive error handling
6. Write unit tests with mocked child_process

**Deliverables:**
- `apps/cli/src/core/plugin-installer.ts`
- `apps/cli/src/core/plugin-installer.spec.ts`

**Agent Command:**
```typescript
Task({
  subagent_type: "typescript-pro",
  description: "Implement PluginInstaller service",
  prompt: `Implement PluginInstaller service for Overture.

  Requirements:
  - Execute 'claude plugin install name@marketplace' via child_process
  - Check Claude binary availability using existing BinaryDetector
  - Auto-add marketplaces before installation for known marketplaces
  - Support dry-run mode (simulate without executing)
  - Capture command output and errors
  - Sequential installation (one plugin at a time)

  Error handling:
  - Claude binary not found
  - Installation failures (continue with next plugin)
  - Marketplace not available

  Include:
  - Unit tests with mocked child_process.exec
  - Mock strategies for command output
  - Dry-run mode tests
  - JSDoc documentation`
})
```

---

#### Step 2.3: Implement PluginExporter
- **Agent**: `typescript-pro`
- **Parallelizable**: ⚠️ After PluginDetector (Step 2.1), can work parallel to Step 2.2
- **Estimated Time**: 2 hours

**Tasks:**
1. Implement PluginExporter service
2. Interactive plugin selection prompts
3. Update user config while preserving structure
4. Write unit tests

**Deliverables:**
- `apps/cli/src/core/plugin-exporter.ts`
- `apps/cli/src/core/plugin-exporter.spec.ts`

**Agent Command:**
```typescript
Task({
  subagent_type: "typescript-pro",
  description: "Implement PluginExporter service",
  prompt: `Implement PluginExporter service for Overture.

  Requirements:
  - Use PluginDetector to list installed plugins
  - Interactive checkbox selection (using inquirer or similar)
  - Update ~/.config/overture.yml with selected plugins
  - Preserve existing config structure and comments
  - Support non-interactive mode with explicit plugin list

  Interactive prompts:
  - Show all installed plugins with checkboxes
  - Allow multi-select
  - Confirm before writing to config

  Include:
  - Unit tests with mocked prompts
  - Unit tests for config updates
  - JSDoc documentation`
})
```

---

### Phase 3: Integration

#### Step 3.1: Update SyncEngine
- **Agent**: `typescript-pro`
- **Parallelizable**: ❌ Needs Steps 2.1 and 2.2 complete
- **Estimated Time**: 2 hours

**Tasks:**
1. Integrate plugin installation into sync workflow
2. Add progress indicators
3. Implement warning for project-level plugin config
4. Write integration tests

**Deliverables:**
- Updated `apps/cli/src/core/sync-engine.ts`
- Integration tests in `apps/cli/src/core/sync-engine.spec.ts`

**Agent Command:**
```typescript
Task({
  subagent_type: "typescript-pro",
  description: "Update SyncEngine for plugin sync",
  prompt: `Update SyncEngine to integrate plugin installation.

  Requirements:
  - Add syncPlugins() method called before MCP sync
  - Read plugins from user global config
  - Detect installed plugins via PluginDetector
  - Calculate missing plugins
  - Install missing plugins via PluginInstaller
  - Show progress indicators during installation
  - Warning if plugins found in project config

  Workflow:
  1. Load user global config
  2. Check for plugins in project config (warn if found)
  3. Detect installed plugins
  4. Calculate diff (plugins in config but not installed)
  5. Install missing plugins sequentially
  6. Show summary
  7. Continue with existing MCP sync

  Include:
  - Integration tests
  - Progress indicators with status updates
  - Summary output (X/Y plugins installed, N skipped, M failed)
  - JSDoc documentation`
})
```

---

#### Step 3.2: Add CLI Commands
- **Agent**: `typescript-pro`
- **Parallelizable**: ⚠️ Export command can work parallel to Step 3.1
- **Estimated Time**: 1.5 hours

**Tasks:**
1. Enhance `overture sync` command
2. Add `overture plugin export` command
3. Add `overture plugin list` command
4. Update help text and examples

**Deliverables:**
- Updated `apps/cli/src/commands/sync.command.ts`
- New `apps/cli/src/commands/plugin-export.command.ts`
- New `apps/cli/src/commands/plugin-list.command.ts`

**Agent Command:**
```typescript
Task({
  subagent_type: "typescript-pro",
  description: "Add plugin CLI commands",
  prompt: `Add plugin-related CLI commands to Overture.

  Commands to implement:

  1. Enhance 'overture sync':
     - Add --skip-plugins flag
     - Add --dry-run support for plugins
     - Integrate with updated SyncEngine

  2. New 'overture plugin export':
     - Interactive plugin selection
     - Update user config with selected plugins
     - Show confirmation message

  3. New 'overture plugin list':
     - Show all installed plugins
     - Indicate which are in config
     - Show enabled/disabled status

  Include:
  - Help text for each command
  - Examples in help
  - Error handling
  - Unit tests for command logic`
})
```

---

### Phase 4: Testing & Validation

#### Step 4.1: Write Integration Tests
- **Agent**: `test-automator`
- **Parallelizable**: ❌ Needs all implementation complete
- **Estimated Time**: 2 hours

**Tasks:**
1. Create comprehensive integration tests
2. Test full sync workflow
3. Test export workflow
4. Error scenario coverage

**Deliverables:**
- Integration test suite
- Mock setup for end-to-end workflows

**Agent Command:**
```typescript
Task({
  subagent_type: "test-automator",
  description: "Write plugin sync integration tests",
  prompt: `Write comprehensive integration tests for plugin sync feature.

  Test scenarios:
  1. Full sync workflow (fresh machine)
  2. Partial sync (some plugins already installed)
  3. Export workflow (installed plugins → config)
  4. Error scenarios:
     - Claude binary not found
     - Plugin installation fails
     - Malformed settings.json
     - Marketplace not available
     - Config file permissions

  5. Project config warning detection
  6. Dry-run mode validation

  Use mocked:
  - child_process.exec for Claude CLI
  - fs operations for config/settings files
  - Interactive prompts

  Target coverage: >90% for integration paths`
})
```

---

#### Step 4.2: Code Review
- **Agent**: `code-reviewer`
- **Parallelizable**: ❌ Final step after all implementation
- **Estimated Time**: 1 hour

**Tasks:**
1. Review all implementation
2. Security audit (command injection prevention)
3. Performance considerations
4. Documentation review

**Deliverables:**
- Code review feedback
- Security audit report
- Performance recommendations

**Agent Command:**
```typescript
Task({
  subagent_type: "code-reviewer",
  description: "Review plugin sync implementation",
  prompt: `Review the entire plugin sync feature implementation.

  Focus areas:
  1. Security:
     - Command injection prevention in child_process calls
     - Path traversal prevention in file operations
     - Input validation for plugin names and marketplaces

  2. Code quality:
     - TypeScript best practices
     - Error handling completeness
     - Code duplication
     - Naming consistency

  3. Performance:
     - Sequential vs parallel installation trade-offs
     - File system operation efficiency
     - Memory usage with large plugin lists

  4. Documentation:
     - JSDoc completeness
     - README updates
     - User guide clarity

  5. Testing:
     - Coverage analysis
     - Edge case handling
     - Mock strategy validation

  Provide detailed feedback with file paths and line numbers.`
})
```

---

## Configuration Schema

### User Global Config Schema

**File**: `~/.config/overture.yml`

```yaml
version: "1.0"

# User's global plugins (synced across machines)
plugins:
  python-development:
    marketplace: claude-code-workflows  # Shortcut, maps to anthropics/claude-code-workflows
    enabled: true
    mcps: [python-repl, ruff, filesystem]

  backend-development:
    marketplace: claude-code-workflows
    enabled: false  # Disabled but tracked in config
    mcps: [docker, postgres]

  custom-plugin:
    marketplace: myorg/custom-marketplace  # Custom marketplace
    enabled: true
    mcps: []
```

### TypeScript Schema Update

**File**: `apps/cli/src/domain/config.schema.ts`

```typescript
export const PluginConfigSchema = z.object({
  marketplace: z.string().min(1, 'Marketplace name is required'),
  enabled: z.boolean().default(true),
  mcps: z.array(z.string()).default([]),
}).strict();

export const UserGlobalConfigSchema = z.object({
  version: z.string().default('1.0'),
  plugins: z.record(z.string(), PluginConfigSchema).optional(),
}).strict();
```

### Project Config Warning

If plugins detected in `.overture/config.yaml`:

```yaml
version: "1.0"

project:
  name: my-api
  type: python-backend

# ⚠️ WARNING: Plugin configuration detected in project config
# Claude Code plugins are installed globally and cannot be project-scoped
# Please move plugin configuration to: ~/.config/overture.yml

plugins:  # This will trigger a warning
  python-development:
    marketplace: claude-code-workflows
    enabled: true

mcp:
  # Project-specific MCP servers (this is correct)
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
```

---

## CLI Command Specifications

### `overture sync`

**Enhanced Behavior:**

1. Check for plugins in user global config (`~/.config/overture.yml`)
2. Warn if plugins detected in project config (`.overture/config.yaml`)
3. Detect installed plugins via `.claude/settings.json`
4. Calculate missing plugins (in config but not installed)
5. Install missing plugins sequentially
6. Continue with existing MCP sync logic

**New Flags:**
- `--skip-plugins`: Skip plugin installation, only sync MCPs
- `--dry-run`: Show what would be installed without installing (applies to both plugins and MCPs)

**Example Output:**

```
$ overture sync

🔍 Syncing plugins from user config...
📋 Found 3 plugins in config, 2 already installed

Installing missing plugins:
  ⏳ python-development@claude-code-workflows
     ✓ Marketplace added: anthropics/claude-code-workflows
     ✓ Plugin installed successfully
  ✓ backend-development@claude-code-workflows (already installed, skipped)
  ✓ custom-plugin@myorg/custom (already installed, skipped)

📦 Plugin sync complete: 1 installed, 2 skipped

⚠️  Warning: Plugin configuration found in project config
    Plugins are installed globally in Claude Code
    Move to ~/.config/overture.yml for proper functionality

🔍 Syncing MCP servers...
✅ Sync complete!
```

**Dry-Run Example:**

```
$ overture sync --dry-run

🔍 DRY RUN: Syncing plugins from user config...
📋 Found 3 plugins in config, 2 already installed

Would install:
  • python-development@claude-code-workflows
    Marketplace: anthropics/claude-code-workflows (would be added)

Would skip (already installed):
  • backend-development@claude-code-workflows
  • custom-plugin@myorg/custom

📦 Would install 1 plugin, skip 2

🔍 DRY RUN: Syncing MCP servers...
Would update .mcp.json with 5 servers
Would update CLAUDE.md with plugin→MCP mappings

No changes made (dry-run mode)
```

---

### `overture plugin export`

**New Command:**

```bash
overture plugin export [options]
```

**Behavior:**

1. Detect all installed Claude Code plugins via PluginDetector
2. Show interactive checklist of plugins to export
3. Update `~/.config/overture.yml` with selected plugins
4. Preserve existing config structure
5. Show confirmation message

**Options:**
- `--all`: Export all installed plugins without prompting
- `--plugin <name>`: Export specific plugin(s) (can specify multiple)

**Example Output (Interactive):**

```
$ overture plugin export

🔍 Detecting installed Claude Code plugins...

Found 5 installed plugins:

? Select plugins to export to config: (Space to toggle, Enter to confirm)
  ◉ python-development@claude-code-workflows
  ◉ backend-development@claude-code-workflows
  ◯ experimental-plugin@custom-marketplace
  ◯ test-plugin@local-dev
  ◉ kubernetes-operations@claude-code-workflows

✅ Updated ~/.config/overture.yml with 3 plugins:
   • python-development@claude-code-workflows
   • backend-development@claude-code-workflows
   • kubernetes-operations@claude-code-workflows

📝 Next steps:
   • Review your config: cat ~/.config/overture.yml
   • Sync config with your dotfiles repo
   • Run 'overture sync' on other machines to install these plugins
```

**Example Output (Non-Interactive):**

```
$ overture plugin export --plugin python-development --plugin backend-development

🔍 Exporting specified plugins...

✅ Updated ~/.config/overture.yml with 2 plugins:
   • python-development@claude-code-workflows
   • backend-development@claude-code-workflows
```

---

### `overture plugin list`

**New Command:**

```bash
overture plugin list [options]
```

**Behavior:**

- Show all installed Claude Code plugins
- Indicate which are in user config
- Show enabled/disabled status
- Show marketplace information

**Options:**
- `--config-only`: Show only plugins in config
- `--installed-only`: Show only installed plugins not in config
- `--json`: Output as JSON for scripting

**Example Output:**

```
$ overture plugin list

Installed Claude Code Plugins:

✓ python-development@claude-code-workflows
  Status: Enabled
  In config: Yes (~/.config/overture.yml)
  MCPs: python-repl, ruff, filesystem

✓ backend-development@claude-code-workflows
  Status: Disabled
  In config: Yes (~/.config/overture.yml)
  MCPs: docker, postgres

  experimental-plugin@custom-marketplace
  Status: Enabled
  In config: No
  MCPs: (none)

📊 Summary: 3 plugins installed, 2 in config

💡 Tips:
   • Use 'overture plugin export' to add plugins to config
   • Use 'overture sync' to install plugins from config
```

**JSON Output Example:**

```bash
$ overture plugin list --json
```

```json
{
  "installed": [
    {
      "name": "python-development",
      "marketplace": "claude-code-workflows",
      "enabled": true,
      "inConfig": true,
      "mcps": ["python-repl", "ruff", "filesystem"]
    },
    {
      "name": "backend-development",
      "marketplace": "claude-code-workflows",
      "enabled": false,
      "inConfig": true,
      "mcps": ["docker", "postgres"]
    },
    {
      "name": "experimental-plugin",
      "marketplace": "custom-marketplace",
      "enabled": true,
      "inConfig": false,
      "mcps": []
    }
  ],
  "summary": {
    "totalInstalled": 3,
    "inConfig": 2,
    "notInConfig": 1
  }
}
```

---

## Testing Strategy

### Unit Tests

**PluginDetector:**
- ✅ Parse valid `.claude/settings.json`
- ✅ Handle missing settings file (return empty array)
- ✅ Handle malformed JSON (log error, return empty array)
- ✅ Extract plugin name, marketplace, enabled status
- ✅ Support both user and project .claude locations

**PluginInstaller:**
- ✅ Execute install command successfully
- ✅ Handle Claude binary not found
- ✅ Handle installation failures
- ✅ Auto-add known marketplaces
- ✅ Skip unknown marketplace addition
- ✅ Dry-run mode doesn't execute commands
- ✅ Capture command output and errors

**PluginExporter:**
- ✅ Detect installed plugins
- ✅ Interactive selection prompts
- ✅ Update config preserving structure
- ✅ Non-interactive mode with explicit list
- ✅ Handle config file not found

**MarketplaceRegistry:**
- ✅ Resolve known marketplace shortcuts
- ✅ Return custom marketplace names as-is
- ✅ Check if marketplace is known

### Integration Tests

**Full Sync Workflow:**
1. ✅ Fresh machine: Install all plugins from config
2. ✅ Partial sync: Skip already installed plugins
3. ✅ Project config warning: Detect and warn about project plugins
4. ✅ Dry-run: Show actions without executing

**Export Workflow:**
1. ✅ Interactive selection and config update
2. ✅ Non-interactive with explicit plugin list
3. ✅ Preserve existing config structure

**Error Scenarios:**
1. ✅ Claude binary not found
2. ✅ Plugin installation fails (continue with others)
3. ✅ Malformed settings.json
4. ✅ Marketplace not available
5. ✅ Config file permissions issue

### Test Coverage Goals

- **Core Services**: >90% coverage
  - PluginDetector: 95%+
  - PluginInstaller: 90%+
  - PluginExporter: 90%+
  - MarketplaceRegistry: 100% (pure functions)

- **CLI Commands**: >85% coverage
  - Sync command enhancements: 85%+
  - Plugin export command: 90%+
  - Plugin list command: 85%+

- **Overall Project**: Maintain 83%+ coverage

### Mock Strategies

**child_process.exec:**
```typescript
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    if (cmd.includes('plugin install')) {
      callback(null, 'Plugin installed successfully', '');
    }
  }),
}));
```

**File System:**
```typescript
jest.mock('fs/promises', () => ({
  readFile: jest.fn((path) => {
    if (path.includes('settings.json')) {
      return Promise.resolve(JSON.stringify(mockSettings));
    }
  }),
  writeFile: jest.fn(),
}));
```

**Interactive Prompts:**
```typescript
jest.mock('inquirer', () => ({
  prompt: jest.fn(() => Promise.resolve({
    selectedPlugins: ['python-development', 'backend-development']
  })),
}));
```

### Test Fixtures

**`.claude/settings.json` Examples:**

```typescript
// apps/cli/src/core/__fixtures__/claude-settings/

// valid-settings.json
{
  "plugins": {
    "python-development": {
      "marketplace": "claude-code-workflows",
      "enabled": true
    },
    "backend-development": {
      "marketplace": "claude-code-workflows",
      "enabled": false
    }
  }
}

// empty-settings.json
{
  "plugins": {}
}

// malformed-settings.json
{
  "plugins": {
    "invalid": "not-an-object"
  }
}
```

---

## Error Handling

### 1. Claude Binary Not Found

**Error:**
```
❌ Error: Claude Code CLI not found

Claude Code must be installed to manage plugins.

Installation:
  • Download from: https://claude.com/claude-code
  • Or install via package manager

After installation, ensure 'claude' is in your PATH:
  $ which claude
  $ claude --version
```

**Implementation:**
```typescript
if (!await this.checkClaudeBinary()) {
  throw new Error(
    'Claude Code CLI not found. Please install from https://claude.com/claude-code'
  );
}
```

---

### 2. `.claude/settings.json` Not Found

**Behavior:**
- Log warning (not error)
- Return empty array
- Continue with sync (assume no plugins installed)

**Implementation:**
```typescript
try {
  const settings = await fs.readFile(settingsPath, 'utf-8');
  return JSON.parse(settings);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.warn('⚠️  .claude/settings.json not found, assuming no plugins installed');
    return [];
  }
  throw error;
}
```

---

### 3. Plugin Installation Fails

**Behavior:**
- Continue with other plugins
- Show summary of successes and failures
- Exit code 0 if at least one plugin installed
- Exit code 1 if all installations failed

**Output:**
```
Installing plugins:
  ✓ python-development@claude-code-workflows (installed)
  ❌ bad-plugin@unknown-marketplace (failed: marketplace not found)
  ✓ backend-development@claude-code-workflows (installed)

📦 Plugin sync: 2 succeeded, 1 failed

⚠️  Failed installations:
   • bad-plugin@unknown-marketplace
     Error: Marketplace 'unknown-marketplace' not found
```

---

### 4. Marketplace Not Found

**Behavior:**
- For known marketplaces: Auto-add before installation
- For unknown marketplaces: Fail with helpful error

**Output:**
```
❌ Error installing custom-plugin@unknown-marketplace

Marketplace 'unknown-marketplace' not found.

Please add the marketplace first:
  $ claude plugin marketplace add <org/repo>

Or update your config with the correct marketplace name.
```

---

### 5. Config File Permissions

**Error:**
```
❌ Error: Cannot write to ~/.config/overture.yml

Permission denied. Please check file permissions:
  $ ls -la ~/.config/overture.yml
  $ chmod 644 ~/.config/overture.yml
```

---

### 6. Malformed Settings JSON

**Behavior:**
- Log warning with error details
- Return empty array
- Continue with sync

**Output:**
```
⚠️  Warning: .claude/settings.json is malformed
    Error: Unexpected token in JSON at position 45

    Assuming no plugins installed. If you have plugins installed,
    please check your .claude/settings.json file.
```

---

### 7. Project Config Plugin Warning

**Output:**
```
⚠️  Warning: Plugin configuration found in project config

    File: .overture/config.yaml
    Plugins found: python-development, backend-development

    Claude Code plugins are installed globally for all sessions.
    Project-level plugin configuration will not work as expected.

    Please move plugin configuration to:
      ~/.config/overture.yml

    Project config should only contain:
      • Project metadata
      • MCP server configurations
```

---

## Parallelization Plan

### Parallel Group 1: Foundation (All Parallel)
**Duration**: 1 hour (max of all tasks)

1. **backend-architect**: Architecture design (1 hour)
2. **typescript-pro**: MarketplaceRegistry (30 min)
3. **test-automator**: Test strategy (1 hour)

**Total Time**: 1 hour (parallel)

---

### Parallel Group 2: Core Services (2 Parallel)
**Duration**: 2.5 hours (max of parallel tasks)

**After architecture complete:**

1. **typescript-pro #1**: PluginDetector (2 hours)
2. **typescript-pro #2**: PluginInstaller (2.5 hours)

**Total Time**: 2.5 hours (parallel)

---

### Parallel Group 3: Exporter (Depends on PluginDetector)
**Duration**: 2 hours

**After PluginDetector complete:**

1. **typescript-pro**: PluginExporter (2 hours)

Note: Can work in parallel with PluginInstaller (Step 2.2)

**Total Time**: 2 hours

---

### Sequential: Integration
**Duration**: 3.5 hours (sequential)

**After core services complete:**

1. **typescript-pro**: Update SyncEngine (2 hours)
2. **typescript-pro**: Add CLI commands (1.5 hours)

**Total Time**: 3.5 hours (sequential)

---

### Sequential: Quality
**Duration**: 3 hours (sequential)

**After integration complete:**

1. **test-automator**: Integration tests (2 hours)
2. **code-reviewer**: Code review (1 hour)

**Total Time**: 3 hours (sequential)

---

### Total Estimated Time

**With Parallelization:**
- Foundation: 1 hour
- Core Services: 2.5 hours
- Exporter: 2 hours (partial overlap with Core Services)
- Integration: 3.5 hours
- Quality: 3 hours

**Total: ~10-12 hours** (3-4 development sessions)

**Without Parallelization:**
- Sum of all individual tasks: ~17 hours

**Time Saved**: ~5-7 hours (~40% reduction)

---

## Documentation Updates

### New Documentation Files

1. **`docs/plugin-sync.md`**
   - Complete guide to plugin sync feature
   - User workflow examples
   - Cross-machine sync setup
   - Troubleshooting guide

2. **`docs/adr/NNNN-plugin-sync-architecture.md`**
   - Architecture decision record
   - Design rationale
   - Trade-offs considered
   - Future enhancements

### Updates to Existing Documentation

1. **`docs/overture-schema.md`**
   - Add plugin configuration examples
   - Document marketplace shortcuts
   - Explain user vs project plugin config

2. **`README.md`**
   - Add plugin sync to feature list
   - Add quick start example
   - Link to detailed plugin-sync.md guide

3. **`docs/user-guide.md`**
   - Add "Managing Plugins" section
   - Cross-machine sync workflow
   - Export/import workflows

4. **`CLAUDE.md`**
   - Update implementation status
   - Mark plugin sync as complete
   - Add plugin workflow guidance for Claude

5. **`docs/QUICKSTART.md`**
   - Add plugin sync example
   - Show typical workflow

---

## Success Criteria

Feature is considered complete when:

- ✅ All services implemented and tested
- ✅ CLI commands functional and user-friendly
- ✅ Test coverage >90% for core services
- ✅ Integration tests pass
- ✅ Code review complete with no critical issues
- ✅ Documentation complete and reviewed
- ✅ Security audit passed (no command injection vulnerabilities)
- ✅ User can sync plugins across machines successfully
- ✅ Export workflow captures installed plugins correctly
- ✅ Project config warnings displayed appropriately

---

## Future Enhancements (Post v0.3.0)

### Version Pinning
Add support for pinning plugin versions:
```yaml
plugins:
  python-development:
    marketplace: claude-code-workflows
    version: "1.2.0"  # Pin to specific version
```

### Plugin Dependencies
Support plugin dependencies:
```yaml
plugins:
  advanced-plugin:
    marketplace: custom
    requires:
      - python-development@claude-code-workflows
```

### Team Configuration
Generate `.claude/settings.json` for team repos:
```yaml
# .overture/team-config.yaml
team:
  plugins:
    - python-development@claude-code-workflows  # Auto-install for team
```

### Plugin Updates
Add `overture plugin update` command:
```bash
overture plugin update python-development
overture plugin update --all
```

### Marketplace Management
Add marketplace configuration:
```yaml
marketplaces:
  claude-code-workflows:
    source: anthropics/claude-code-workflows
    auto_update: true
  custom:
    source: myorg/custom-marketplace
    type: local
    path: ~/dev/marketplace
```

---

## Related Issues & PRs

- Issue: TBD (create after approval)
- PR: TBD (create during implementation)

---

## Appendix: Example Workflows

### Workflow 1: Fresh Machine Setup

**Scenario**: Developer gets a new machine and wants to set up Claude Code plugins

```bash
# Clone dotfiles or sync config
$ git clone git@github.com:user/dotfiles.git
$ cp dotfiles/overture/config.yaml ~/.config/overture.yml

# Install Claude Code
$ # (download and install from claude.com)

# Sync plugins
$ overture sync

🔍 Syncing plugins from user config...
📋 Found 5 plugins in config, 0 already installed

Installing plugins:
  ⏳ python-development@claude-code-workflows
     ✓ Marketplace added: anthropics/claude-code-workflows
     ✓ Plugin installed successfully
  ⏳ backend-development@claude-code-workflows
     ✓ Plugin installed successfully
  ⏳ kubernetes-operations@claude-code-workflows
     ✓ Plugin installed successfully
  # ... etc

📦 Plugin sync complete: 5 installed, 0 skipped

🔍 Syncing MCP servers...
✅ Sync complete! Claude Code is ready to use.
```

---

### Workflow 2: Add New Plugin and Sync to Other Machines

**Scenario**: Developer installs a new plugin and wants to sync it to other machines

```bash
# On Machine A: Install plugin manually
$ /plugin install data-science@claude-code-workflows

# Export to config
$ overture plugin export

? Select plugins to export:
  ◉ python-development@claude-code-workflows (already in config)
  ◉ backend-development@claude-code-workflows (already in config)
  ◉ data-science@claude-code-workflows (new)

✅ Updated ~/.config/overture.yml with 3 plugins

# Commit and push config
$ cd ~/dotfiles
$ git add overture/config.yaml
$ git commit -m "Add data-science plugin"
$ git push

# On Machine B: Pull and sync
$ cd ~/dotfiles
$ git pull
$ cp overture/config.yaml ~/.config/overture.yml
$ overture sync

📦 Plugin sync: 1 installed, 2 skipped
✅ data-science@claude-code-workflows installed
```

---

### Workflow 3: Project Mistakenly Has Plugin Config

**Scenario**: Developer adds plugins to project config instead of user config

```bash
# Accidentally add plugins to project config
$ cat .overture/config.yaml
version: "1.0"
project:
  name: my-api
plugins:
  python-development:
    marketplace: claude-code-workflows

# Run sync
$ overture sync

⚠️  Warning: Plugin configuration found in project config

    File: .overture/config.yaml
    Plugins found: python-development

    Claude Code plugins are installed globally.
    Move to ~/.config/overture.yml

📦 Plugins skipped (not in user config)
🔍 Syncing MCP servers...
✅ Sync complete

# Fix: Move to user config
$ # Manually move plugins section to ~/.config/overture.yml
$ overture sync
✅ All plugins synced correctly
```

---

**End of Implementation Plan**
