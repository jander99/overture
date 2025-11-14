# Changelog

All notable changes to the Overture project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2025-01-11

### Enhanced

**Dry-Run Mode with Debug Output**

Changed:
- `--dry-run` flag now writes generated configs to `dist/` directory for inspection
- Config files are prepended with client name (e.g., `dist/claude-code-mcp.json`, `dist/vscode-mcp.json`)
- Enables debugging and tuning without affecting actual client configurations
- Users can inspect exact configs that would be written before applying

Files Modified:
- `apps/cli/src/core/sync-engine.ts` - Added `getDryRunOutputPath()` and `ensureDistDirectory()` helpers
- `apps/cli/src/cli/commands/sync.ts` - Updated dry-run messaging to inform users about dist/ output

Usage:
```bash
# Preview changes and write debug configs to dist/
overture sync --dry-run

# Inspect generated configs
ls -la dist/
cat dist/claude-code-mcp.json

# Apply changes after review
overture sync
```

## [0.2.0] - 2025-01-13

### Multi-Platform MCP Manager - COMPLETE

**Status:** ✅ COMPLETE
**Tests:** 873 passing, 32 test suites, 83%+ code coverage

Overture v0.2 delivers comprehensive multi-platform MCP configuration management with:
- User global configuration (`~/.config/overture.yml`)
- Project/user config merging with proper precedence
- 7 platform adapters (Claude Code, Claude Desktop, Cursor, Windsurf, VSCode, Copilot CLI, JetBrains)
- Multi-client sync engine with backup/restore
- Config audit for detecting unmanaged MCPs
- Transport validation and platform filtering
- Process locking for safe concurrent operations

#### Implementation Details

**Phase 2: Client Adapters (16 WUs, 653 tests)**

Added:
- Multi-client adapter architecture supporting 7 AI development clients
- `BaseClientAdapter` abstract class with common filtering logic
- `adapter-registry.ts` for centralized adapter management
- Core adapters:
  - `claude-code-adapter.ts` - Claude Code CLI (stdio + http)
  - `claude-desktop-adapter.ts` - Claude Desktop app (stdio + sse)
  - `vscode-adapter.ts` - VS Code MCP extension (stdio only)
- Extended adapters:
  - `cursor-adapter.ts` - Cursor IDE (stdio + http)
  - `windsurf-adapter.ts` - Windsurf IDE (stdio only)
  - `copilot-cli-adapter.ts` - GitHub Copilot CLI (stdio only)
  - `jetbrains-copilot-adapter.ts` - JetBrains GitHub Copilot plugin (stdio only)
- Comprehensive test coverage for all adapters (31 tests for extended adapters)

**Phase 3: Sync Engine (10 WUs, 802 tests)**

Added:
- `config-diff.ts` - Configuration diff generation with field-level change detection (19 tests)
- `backup-service.ts` - Timestamped backup creation with retention policy (34 tests)
- `restore-service.ts` - Backup restoration with validation (16 tests)
- `process-lock.ts` - File-based process locking with stale detection (18 tests)
- `exclusion-filter.ts` - MCP filtering by platform/client/transport/scope (16 tests)
- `transport-validator.ts` - Transport compatibility validation (22 tests)
- `client-env-service.ts` - Client-aware environment variable expansion (19 tests)
- `sync-engine.ts` - Main orchestration layer coordinating entire sync workflow (21 tests)

Features:
- Dry-run mode for previewing changes without writing
- Force flag to override transport warnings
- Scope filtering (global vs project MCPs)
- Client filtering (sync specific clients only)
- Platform auto-detection (darwin, linux, win32)
- Automatic backup before config updates
- Diff generation showing what changed
- Process locking preventing concurrent syncs
- Graceful error handling with detailed results per client

**Phase 4: Commands & CLI Integration (Complete)**

Added:
- `overture user init` - Interactive user global config setup
- `overture user show` - Display user config in YAML or JSON
- `overture audit` - Detect unmanaged MCPs across clients
- `overture backup list` - List all backups
- `overture backup restore` - Restore from backup
- `overture backup cleanup` - Remove old backups
- Enhanced `overture sync` with multi-client support, dry-run, client filtering

**Phase 5: Testing & Documentation (Complete)**

Achieved:
- ✅ 873 tests passing (100% pass rate)
- ✅ 32 test suites covering all components
- ✅ 83%+ code coverage (statements: 83.03%, functions: 86.7%, branches: 69.18%)
- ✅ Comprehensive integration tests
- ✅ Performance benchmarks (11 scenarios, A-grade performance)
- ✅ Documentation updates (README, CLAUDE.md, PURPOSE.md, CHANGELOG)
- ✅ Migration guide from v0.1 (docs/migration-v0.1-to-v0.2.md)

## [0.1.0] - 2024-11-09

### Added

**Phase 1: Foundation**

- Initial Nx monorepo setup with TypeScript
- Domain types and Zod validation schemas
  - `config-v2.types.ts` - TypeScript interfaces for v2 config
  - `config-v2.schema.ts` - Zod validators for runtime validation
- Core utilities:
  - `path-resolver.ts` - Cross-platform path resolution
  - `env-expander.ts` - Environment variable expansion with ${VAR} syntax
  - `config-loader.ts` - Config loading with user/project precedence
- Template system with Handlebars
- CLI commands:
  - `overture init` - Initialize .overture/config.yaml
  - `overture sync` - Install plugins and generate configs
  - `overture validate` - Validate configuration
  - `overture mcp list` - List configured MCPs
  - `overture mcp enable` - Enable disabled MCPs
- CLAUDE.md generation with Nx-style paired markers
- Comprehensive test suite (191 tests)

### Technical Details

- **Build System:** Nx with esbuild bundler
- **Target:** CommonJS (not ESM)
- **Dependencies:** commander, zod, js-yaml, chalk@4.1.2, inquirer@8.2.6, execa@5.1.1, handlebars
- **Platform Support:** macOS (darwin), Linux, Windows (win32)

## Architecture Decisions

### Multi-Client Adapter Pattern

**Decision:** Use abstract base class with concrete implementations per client

**Rationale:**
- Isolates client-specific logic
- Provides uniform interface for sync engine
- Easy to add new clients
- Testable in isolation

**Implementation:**
```typescript
abstract class BaseClientAdapter {
  abstract name: ClientName;
  abstract detectConfigPath(platform: Platform): ConfigPathResult;
  abstract convertFromOverture(config: OvertureConfigV2): ClientMcpConfig;
  // ... more methods

  // Helper method for common filtering logic
  protected shouldSyncMcp(mcpConfig, platform): boolean
}
```

### Config Precedence

**Decision:** Project config overrides user config

**Rationale:**
- Project-specific needs trump user defaults
- Allows teams to standardize MCPs per project
- User config provides sensible defaults

### Environment Variable Expansion

**Decision:** Client-aware expansion (native vs Overture-managed)

**Clients with Native Support:**
- Claude Code, Claude Desktop, Cursor, Windsurf, Copilot CLI
- Keep ${VAR} syntax in config, client expands at runtime

**Clients Requiring Overture Expansion:**
- VS Code, JetBrains Copilot
- Overture expands ${VAR} before writing config

**Rationale:**
- Respects client capabilities
- Prevents double-expansion issues
- Maintains compatibility

### Transport Validation

**Decision:** Check compatibility BEFORE filtering

**Rationale:**
- Provides clear warnings about unsupported transports
- Filtering would hide the incompatibility
- User can use --force to override if needed

### Process Safety

**Decision:** File-based locking with stale detection

**Rationale:**
- Prevents concurrent sync operations
- Stale detection prevents deadlocks (10s timeout)
- Exponential backoff for retries
- Auto-cleanup on exit (SIGINT, SIGTERM, uncaught exceptions)

## [Links]

- [Implementation Plan](docs/v0.2-implementation-plan.md)
- [Architecture Documentation](docs/v0.2-architecture.md)
- [Purpose & Vision](docs/PURPOSE.md)
- [User Guide](docs/user-guide.md)
