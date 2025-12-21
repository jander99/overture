# Implementation Plan: Import & Cleanup Commands

**Status:** Services Complete, CLI Commands In Progress  
**Target Release:** v0.4.0  
**Last Updated:** 2025-12-21

## Overview

This document tracks the implementation of `overture import` and `overture cleanup` commands, which enable users to migrate existing MCP configurations from AI clients into Overture.

## Completed Work

### Phase 1: Foundation ✅

- [x] Created `@overture/import-core` library structure
- [x] Added `@clack/prompts` dependency for interactive TUI
- [x] Defined all TypeScript interfaces in `import.types.ts`:
  - `DiscoveredMcp`, `McpSource`, `McpConflict`
  - `ImportDiscoveryResult`, `ImportResult`
  - `CleanupTarget`, `CleanupResult`
  - `ClaudeCodeFullConfig`

### Phase 2: Adapter Enhancements ✅

- [x] **Claude Code Adapter** (`libs/adapters/client-adapters/src/lib/adapters/claude-code.adapter.ts`):
  - Added `readFullConfig()` to read complete ~/.claude.json including `projects` object
  - Added `cleanupDirectoryMcps()` to remove managed MCPs from directory configs
  - Added `writeFullConfig()` helper
- [x] **OpenCode Adapter** (`libs/adapters/client-adapters/src/lib/adapters/opencode.adapter.ts`):
  - Added `translateFromOpenCodeEnv()` for bidirectional env var conversion
  - Now supports `{env:VAR}` ↔ `${VAR}` in both directions

### Phase 3: Core Utilities ✅

- [x] **env-var-converter.ts**:
  - `isLikelySecret()` - Detects hardcoded API keys and tokens
  - `convertToEnvVarReferences()` - Converts secrets to `${VAR}` syntax
  - Pattern matching for OpenAI, GitHub, Slack, Anthropic tokens
  - `convertFromOpenCodeEnv()` / `convertToOpenCodeEnv()` helpers
- [x] **conflict-detector.ts**:
  - `detectConflicts()` - Finds same MCP with different configs across clients
  - `formatConflict()` - Pretty-prints conflict details for user

### Phase 4: Service Skeletons ✅

- [x] **import-service.ts** - Placeholder with method signatures
- [x] **cleanup-service.ts** - Placeholder with method signatures

Both services have TODO markers for full implementation.

## Remaining Work

### Phase 5: Complete Service Implementation ✅

**import-service.ts:**

- [x] Implement `discoverUnmanagedMcps()` with full client adapter integration
- [x] Handle Claude Code's directory-based configs in `projects` object
- [x] Handle OpenCode env var format conversion
- [x] Implement `importMcps()` with proper YAML writing (using `js-yaml`)
- [x] Add proper error handling for malformed configs

**cleanup-service.ts:**

- [x] Implement `findCleanupTargets()` with directory scanning
- [x] Integrate with `ClaudeCodeAdapter.cleanupDirectoryMcps()`
- [x] Add backup creation before cleanup
- [x] Preserve unmanaged MCPs with warnings

### Phase 6: CLI Commands 🔲

**apps/cli/src/cli/commands/import.ts:**

- [ ] Create command with Commander.js
- [ ] Implement interactive TUI with `@clack/prompts`:
  - Checkbox selection for discovered MCPs
  - Scope confirmation (global vs project)
  - Conflict warnings
  - Env var setup guidance
- [ ] Show YAML preview before writing
- [ ] Offer to run `overture sync` after import

**apps/cli/src/cli/commands/cleanup.ts:**

- [ ] Create command with Commander.js
- [ ] Implement interactive confirmation with `@clack/prompts`
- [ ] Support `--dry-run`, `--all`, `--directory` flags
- [ ] Show backup path after cleanup

### Phase 7: Registration & Integration 🚧

- [x] Add to composition root (`apps/cli/src/composition-root.ts`)
- [x] Wire up dependencies (filesystem, output)
- [ ] Register commands in `apps/cli/src/cli/index.ts`
- [ ] Complete CLI command implementation

### Phase 8: Enhanced Sync Validation 🔲

**libs/core/sync/src/lib/sync-engine.ts:**

- [ ] Add `validateEnvVars()` method
- [ ] Check for required env vars before sync
- [ ] Warn on missing vars with setup instructions

### Phase 9: Documentation 🔲

- [ ] Create `docs/howtos/importing-existing-configs.md`
- [ ] Update `docs/roadmap.md` with import/cleanup feature
- [ ] Add examples to `docs/examples.md`
- [ ] Update `README.md` with import workflow

### Phase 10: Testing 🔲

**Unit Tests:**

- [ ] `env-var-converter.spec.ts` - Secret detection and conversion
- [ ] `conflict-detector.spec.ts` - Conflict detection logic
- [ ] `import-service.spec.ts` - Discovery and import logic
- [ ] `cleanup-service.spec.ts` - Cleanup logic

**Integration Tests:**

- [ ] Full import workflow from each client
- [ ] Full cleanup workflow
- [ ] Conflict resolution scenarios
- [ ] Env var conversion edge cases

**E2E Tests:**

- [ ] `import.e2e.spec.ts` - Complete import flow
- [ ] `cleanup.e2e.spec.ts` - Complete cleanup flow

## Technical Notes

### Dependencies

```json
{
  "@clack/prompts": "^0.11.0"
}
```

### File Structure

```
libs/
├── core/import/                    # NEW library
│   └── src/lib/
│       ├── env-var-converter.ts    ✅
│       ├── conflict-detector.ts    ✅
│       ├── import-service.ts       🚧 (skeleton)
│       └── cleanup-service.ts      🚧 (skeleton)
├── domain/config-types/
│   └── src/lib/import.types.ts     ✅
└── adapters/client-adapters/
    └── src/lib/adapters/
        ├── claude-code.adapter.ts  ✅ (enhanced)
        └── opencode.adapter.ts     ✅ (enhanced)

apps/cli/src/cli/commands/
├── import.ts                       🔲
└── cleanup.ts                      🔲
```

### Design Decisions

| Decision          | Choice                               |
| ----------------- | ------------------------------------ |
| Scope inference   | Based on source location             |
| Interactive UX    | TUI with `@clack/prompts`            |
| Malformed configs | Warn and skip, don't fix             |
| Env var handling  | Convert to `${VAR}`, guide user      |
| OpenCode format   | Bidirectional `{env:VAR}` ↔ `${VAR}` |
| Conflicts         | Warn and skip, manual resolution     |
| Sync validation   | Check env vars exist before sync     |

## Next Steps

1. **Immediate:** Complete `import-service.ts` implementation
2. **Then:** Complete `cleanup-service.ts` implementation
3. **Then:** Build CLI commands with @clack/prompts TUI
4. **Finally:** Write comprehensive tests and documentation

## Estimated Effort

- **Remaining:** 8-10 days
- **Total:** 10-15 days

## Related Files

- **Roadmap:** `docs/roadmap.md` (needs update)
- **Examples:** `docs/examples.md` (needs import examples)
- **User Guide:** `docs/user-guide.md` (needs import section)

---

**Legend:**  
✅ Complete  
🚧 In Progress  
🔲 Not Started
