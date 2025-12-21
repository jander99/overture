# ADR 0001: Plugin Sync Architecture

**Status**: Accepted
**Date**: 2025-01-15
**Deciders**: Architecture Team
**Technical Story**: Plugin Sync Feature (v0.3.0)

## Context and Problem Statement

Overture currently focuses on MCP server synchronization across AI development clients. However, Claude Code's plugin system is independent of MCP servers, and users must manually install plugins on each machine. This creates friction for multi-machine workflows and reduces the value of Overture's configuration orchestration.

**Problem**: How should Overture handle Claude Code plugin synchronization to provide the best user experience while respecting the constraints of Claude Code's plugin system?

## Decision Drivers

1. **User Experience**: Minimize manual plugin management across multiple machines
2. **Configuration Simplicity**: Keep config format intuitive and aligned with existing Overture patterns
3. **Technical Constraints**: Claude Code plugins are installed globally, not project-scoped
4. **Reliability**: Handle undocumented `.claude/settings.json` format defensively
5. **Forward Compatibility**: Design for future enhancements (version pinning, dependencies)
6. **Consistency**: Follow existing Overture architectural patterns (services, types, error handling)

## Considered Options

### Option 1: Bidirectional Sync (Auto-detect and Sync Both Ways)

**Approach**: Automatically sync plugins in both directions (installed → config, config → installed) on every `overture sync`.

**Pros**:

- Fully automatic - no user intervention needed
- Always in sync

**Cons**:

- Surprising behavior (installing a plugin manually would add it to config automatically)
- Loss of user control over what's in config
- Complexity in handling conflicts
- **Rejected**: Too opinionated, reduces user control

### Option 2: One-way Sync Only (Config → Installed)

**Approach**: `overture sync` only installs plugins from config. No reverse sync.

**Pros**:

- Simple and predictable
- Config is explicit source of truth
- No surprising behavior

**Cons**:

- Users must manually edit config to add new plugins
- Workflow: install plugin → edit YAML → sync elsewhere
- **Partially Rejected**: Too much friction for users

### Option 3: Hybrid Approach (One-way Sync + Explicit Export) ✅ SELECTED

**Approach**:

- `overture sync`: Install plugins from config (one-way: config → installed)
- `overture plugin export`: Capture installed plugins to config (explicit export)

**Pros**:

- User control: explicit action to add plugins to config
- Simple sync: config is source of truth
- Flexible: users can experiment with plugins before committing to config
- Clear intent: separate commands for separate actions

**Cons**:

- Two commands to remember (sync vs export)
- **Accepted**: Best balance of control and convenience

## Decision Outcome

**Chosen Option**: **Option 3 - Hybrid Approach (One-way Sync + Explicit Export)**

### Architecture Components

#### 1. Type Definitions (`domain/plugin.types.ts`)

**Design Decisions**:

- `InstalledPlugin`: Represents detected plugins from `.claude/settings.json`
- `InstallationResult`: Typed result for installation operations
- `PluginSyncResult`: Summary result for sync operations
- `ExportOptions`: Configuration for export behavior
- `MarketplaceConfig`: Marketplace metadata

**Rationale**: Strong typing provides compile-time safety and self-documentation.

#### 2. PluginDetector Service (`core/plugin-detector.ts`)

**Responsibilities**:

- Parse `.claude/settings.json` to detect installed plugins
- Extract plugin name, marketplace, enabled status
- Handle missing/malformed files gracefully

**Design Decisions**:

- **Defensive Parsing**: `.claude/settings.json` format is undocumented (public beta)
  - Graceful degradation on missing files (return empty array)
  - Detailed error messages for malformed JSON
  - Multiple key format support (name@marketplace, name, marketplace/name)
- **Multiple Settings Paths**: Support both user (~/.claude) and project (.claude) locations
- **Error Handling**: Return empty arrays with warnings instead of throwing errors

**Rationale**: Claude Code's settings format may change. Defensive implementation prevents breaking on format changes.

#### 3. PluginInstaller Service (`core/plugin-installer.ts`)

**Responsibilities**:

- Execute `claude plugin install name@marketplace` via child_process
- Handle marketplace auto-addition for known marketplaces
- Provide dry-run simulation mode
- Check Claude binary availability

**Design Decisions**:

- **Sequential Installation**: Install plugins one at a time (not parallel)
  - Avoids race conditions in Claude CLI
  - Simpler error handling
  - Easier to track progress
- **Timeout Handling**: 30-second default timeout per plugin
  - Uses `Promise.race` for timeout implementation
  - Consistent with BinaryDetector pattern
- **Marketplace Auto-addition**: Automatically add known marketplaces before installation
  - Reduces user friction
  - Uses MarketplaceRegistry for resolution
- **ProcessExecutor Usage**: Leverages existing infrastructure abstraction
  - Consistent with BinaryDetector
  - Centralized command execution

**Rationale**: Sequential installation is more reliable than parallel. Marketplace auto-addition improves UX without adding complexity.

#### 4. PluginExporter Service (`core/plugin-exporter.ts`)

**Responsibilities**:

- Detect installed plugins via PluginDetector
- Interactive prompt for plugin selection
- Update `~/.config/overture.yml` with selected plugins
- Preserve existing config structure and comments

**Design Decisions**:

- **Interactive Mode (Default)**: Checkbox selection for user-friendly export
  - Uses inquirer for prompts (to be implemented)
  - Multi-select capability
  - Clear visual feedback
- **Non-interactive Mode**: Explicit plugin list for automation
  - Supports CI/CD and scripting
  - Validates plugin names against installed plugins
- **Config Preservation**: YAML structure and formatting preserved
  - Uses `js-yaml` dump with sortKeys: false
  - Merges with existing plugins section
  - Preserves mcps array if already present
- **Dependency Injection**: Accepts PluginDetector in constructor for testability

**Rationale**: Interactive mode provides best UX for manual export. Non-interactive mode enables automation.

#### 5. MarketplaceRegistry (`domain/marketplace-registry.ts`)

**Responsibilities**:

- Map marketplace shortcuts to full repository paths
- Provide resolution and validation utilities
- Extensible for future marketplaces

**Design Decisions**:

- **Static Registry Pattern**: No instance needed, all methods static
  - Simpler usage: `MarketplaceRegistry.resolveMarketplace('shortcut')`
  - Centralized marketplace knowledge
- **Shortcut Mapping**: 'claude-code-workflows' → 'anthropics/claude-code-workflows'
  - Reduces config verbosity
  - Easier to remember
  - Consistent with package manager patterns (npm, cargo)
- **Extensibility**: Runtime addition of custom marketplaces
  - `addCustomMarketplace()` for testing and enterprise use
  - Built-in marketplaces are protected from removal
- **Normalization**: Bidirectional resolution (shortcut ↔ full path)
  - Enables comparison between different sources
  - Handles both config format and detected format

**Rationale**: Static registry provides clean API and centralized marketplace knowledge. Extensibility supports future growth.

### Service Integration Patterns

**Composition Over Inheritance**:

- PluginExporter uses PluginDetector via composition
- PluginInstaller uses BinaryDetector and MarketplaceRegistry
- Services are independent and testable

**Error Handling Strategy**:

- Custom `PluginError` extends `OvertureError`
- Consistent with existing error hierarchy (ConfigError, ValidationError)
- Errors include context (plugin name, path, operation)
- Graceful degradation where appropriate (detection failures)

**Async/Await Pattern**:

- All I/O operations are async
- Consistent with existing Overture services
- Enables timeout handling with `Promise.race`

### Storage Location Decision

**User Global Only** (`~/.config/overture.yml`):

**Rationale**:

- Claude Code plugins are installed globally for all sessions
- No user/project distinction in Claude Code itself
- Project config would not work as expected

**Warning System**:

- Detect plugins in project config (`.overture/config.yaml`)
- Show clear warning explaining why it won't work
- Suggest moving to user global config

### Marketplace Handling

**Shortcut Format**:

- Config uses shortcuts: `marketplace: claude-code-workflows`
- MarketplaceRegistry resolves to full paths: `anthropics/claude-code-workflows`
- Installer auto-adds marketplaces before installation

**Rationale**:

- Simpler config (less typing)
- More maintainable (marketplace URLs may change)
- Consistent with user mental model (friendly names)

### Plugin Detection Strategy

**Primary Method**: Parse `.claude/settings.json`

**Rationale**:

- Most reliable source of installed plugin information
- Contains marketplace information
- Includes enabled/disabled status
- Provides installation timestamps

**Challenges**:

- Format is undocumented (public beta)
- May change without notice
- Different Claude Code versions may use different formats

**Mitigation**:

- Defensive parsing with comprehensive error handling
- Support multiple key formats
- Graceful degradation on parse failures
- Clear warning messages for users

**Fallback Strategy**:

- If settings.json unavailable, return empty array
- Log warning but don't fail
- Allow sync to proceed (will attempt installation)

## Consequences

### Positive

1. **User Control**: Explicit export gives users control over config contents
2. **Simple Sync**: Config is clear source of truth for plugin installation
3. **Experimentation Friendly**: Users can try plugins before committing to config
4. **Consistent Architecture**: Follows existing Overture patterns (services, types, errors)
5. **Testable**: Services use dependency injection and composition
6. **Extensible**: Marketplace registry and plugin types support future enhancements
7. **Defensive**: Handles undocumented settings format changes gracefully

### Negative

1. **Two Commands**: Users must learn both `sync` and `export` commands
   - _Mitigation_: Clear documentation and help text
2. **Manual Export**: Users must explicitly export after installing plugins
   - _Mitigation_: Interactive mode makes export easy
3. **Settings Format Dependency**: Relies on undocumented `.claude/settings.json`
   - _Mitigation_: Defensive parsing and graceful degradation
4. **No Version Pinning**: Cannot pin plugin versions in v0.3.0
   - _Future Enhancement_: Add version field to plugin config

## Implementation Notes

### Testing Strategy

**Unit Tests**:

- PluginDetector: Mock file system, test various settings.json formats
- PluginInstaller: Mock child_process, test command execution
- PluginExporter: Mock prompts and file writes
- MarketplaceRegistry: Pure function tests (no mocks needed)

**Test Fixtures**:

- `__fixtures__/plugin-detector/valid-settings.json`
- `__fixtures__/plugin-detector/empty-settings.json`
- `__fixtures__/plugin-detector/malformed-settings.json`
- `__fixtures__/plugin-detector/various-key-formats.json`

**Integration Tests**:

- Full sync workflow (config → installed)
- Export workflow (installed → config)
- Error scenarios (binary not found, malformed files)

**Coverage Goals**:

- Core services: >90%
- MarketplaceRegistry: 100% (pure functions)
- Overall: Maintain 83%+ project coverage

### Future Enhancements

1. **Version Pinning** (v0.4.0):

   ```yaml
   plugins:
     python-development:
       marketplace: claude-code-workflows
       version: '1.2.0' # Pin to specific version
   ```

2. **Plugin Dependencies** (v0.5.0):

   ```yaml
   plugins:
     advanced-plugin:
       marketplace: custom
       requires:
         - python-development@claude-code-workflows
   ```

3. **Team Configuration**:
   - Generate `.claude/settings.json` for team repos
   - Shared plugin configurations for teams

4. **Plugin Updates**:
   - `overture plugin update` command
   - Check for plugin updates
   - Batch update workflow

### Security Considerations

1. **Command Injection Prevention**:
   - Use `execa` with argument arrays (not shell strings)
   - Validate plugin names and marketplace formats
   - Never interpolate user input into shell commands

2. **Path Traversal Prevention**:
   - Validate settings.json paths
   - Use path.join() for path construction
   - Check for suspicious patterns (.., ~, etc.)

3. **Marketplace Validation**:
   - Validate marketplace formats (shortcut, GitHub, local)
   - Warn on unknown marketplaces
   - Prevent injection via marketplace names

## Links

- [Implementation Plan](../PLUGIN-SYNC-IMPLEMENTATION.md)
- [Plugin Domain Types](../../apps/cli/src/domain/plugin.types.ts)
- [PluginDetector Service](../../apps/cli/src/core/plugin-detector.ts)
- [PluginInstaller Service](../../apps/cli/src/core/plugin-installer.ts)
- [PluginExporter Service](../../apps/cli/src/core/plugin-exporter.ts)
- [MarketplaceRegistry](../../apps/cli/src/domain/marketplace-registry.ts)

## Appendix: Alternative Patterns Considered

### Plugin Storage in Config

**Option A**: Flat structure

```yaml
plugins:
  [
    python-development@claude-code-workflows,
    backend-development@claude-code-workflows,
  ]
```

**Rejected**: No room for metadata (mcps, enabled, version)

**Option B**: Nested with marketplace shortcuts (SELECTED)

```yaml
plugins:
  python-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [python-repl, ruff]
```

**Selected**: Extensible, readable, supports metadata

### Detection Methods

**Option A**: Parse settings.json (SELECTED)

- Most reliable, includes marketplace info
- Undocumented format (defensive parsing needed)

**Option B**: Execute `claude plugin list`

- Doesn't exist in current Claude CLI
- Would require CLI enhancement

**Option C**: State tracking file

- Requires maintaining separate state
- Duplicate of Claude's own state
- **Rejected**: Unnecessary complexity

### Error Handling Philosophy

**Strict Mode**: Fail on any detection error

- **Rejected**: Too brittle for undocumented format

**Graceful Degradation** (SELECTED):

- Warn on detection failures
- Return empty arrays
- Continue with sync
- **Selected**: Better UX, more resilient
