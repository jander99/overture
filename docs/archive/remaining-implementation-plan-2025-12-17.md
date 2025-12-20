# Remaining Implementation Plan: Overture CLI High-Priority Fixes

**Last Updated**: 2025-12-17
**Status**: 3 of 11 TDD cycles complete (27%)
**Approach**: Test-Driven Development (red-green-refactor)
**Estimated Remaining Effort**: 2-4 days

---

## ✅ Completed Work

### Critical Bug Fix
- ✅ **backup.ts async/await bug** - Fixed missing `await` keywords on 7 async service calls
- ✅ **backup.spec.ts** - Updated mocks to use `mockResolvedValue()` for proper async testing
- ✅ All 17 backup tests passing

### MCP Command (Cycles 1.1-1.3)
- ✅ **Cycle 1.1**: Basic command structure (4 tests)
  - Created mcp command with list and enable subcommands
- ✅ **Cycle 1.2**: Configuration loading (6 tests)
  - Loads merged user + project config via configLoader
- ✅ **Cycle 1.3**: Display MCPs in table (9 tests)
  - Displays configured MCPs with names and commands
  - Handles empty configuration

**Current Test Count**: 9 MCP tests passing

---

## 🚧 Remaining Work

### Workstream 1: MCP Command (Cycles 1.4-1.8) - 1 day

**Goal**: Complete MCP command implementation with filtering, error handling, and enable functionality

#### Cycle 1.4: Filter by Scope (45 min)
**Status**: NOT STARTED

**Test Requirements**:
- `--scope global` shows only global MCPs (from ~/.config/overture.yml)
- `--scope project` shows only project MCPs (from .overture/config.yaml)
- Default behavior shows all MCPs with scope labels

**Implementation**:
- Add `--scope <global|project>` option to list subcommand
- Filter MCPs by source (user config vs project config)
- Display scope indicator in output

**Mock Setup**:
```typescript
// Need to mock configLoader to return both user and project configs
vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
  version: '1.0',
  mcp: { memory: { command: 'npx', args: [...] } }
});
vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue({
  version: '1.0',
  mcp: { filesystem: { command: 'npx', args: [...] } }
});
```

**Expected Tests**:
- Filter by global scope
- Filter by project scope
- Display all with scope labels
- Invalid scope error

---

#### Cycle 1.5: Filter by Client (45 min)
**Status**: NOT STARTED

**Test Requirements**:
- `--client claude-code` shows only MCPs for that client
- Use exclusion logic from sync (only/except fields)
- Display which clients can use each MCP

**Implementation**:
- Add `--client <name>` option to list subcommand
- Import and use `shouldIncludeMcp()` from `@overture/sync-core`
- Filter MCPs based on client exclusion rules

**Mock Setup**:
```typescript
const mockConfig = {
  version: '1.0',
  mcp: {
    memory: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      // No exclusions - available to all
    },
    github: {
      command: 'mcp-server-github',
      clients: {
        only: ['claude-code'], // Only for claude-code
      },
    },
  },
};
```

**Expected Tests**:
- Filter by specific client
- Show all clients if no filter
- Display client compatibility info
- Invalid client error

---

#### Cycle 1.6: Error Handling (30 min)
**Status**: NOT STARTED

**Test Requirements**:
- Handle missing configuration gracefully
- Handle no MCPs found
- Handle invalid filter values
- Display helpful error messages

**Implementation**:
- Wrap action in try-catch block
- Use ErrorHandler.handleCommandError()
- Provide specific error messages for each case

**Expected Tests**:
- No configuration file found
- Empty MCP configuration
- Invalid --scope value
- Invalid --client value
- ConfigError handling
- ValidationError handling

---

#### Cycle 1.7: Enable Command (45 min)
**Status**: NOT STARTED

**Test Requirements**:
- `mcp enable <name>` sets `enabled: true` in project config
- Only works on project-scoped MCPs (not global)
- Creates .overture/config.yaml if it doesn't exist
- Merges with existing project config

**Implementation**:
```typescript
command
  .command('enable')
  .description('Enable a disabled MCP server in project configuration')
  .argument('<name>', 'MCP server name to enable')
  .action(async (name: string) => {
    // 1. Load project config
    // 2. Check if MCP exists
    // 3. Set enabled: true
    // 4. Write back to .overture/config.yaml
  });
```

**Expected Tests**:
- Enable disabled MCP
- Create config if missing
- Merge with existing config
- Display success message

---

#### Cycle 1.8: Enable Error Handling (30 min)
**Status**: NOT STARTED

**Test Requirements**:
- Error when MCP not found in any config
- Error when trying to enable global MCP
- Error when MCP already enabled
- Error when not in project directory

**Implementation**:
- Validate MCP exists in global or project config
- Check if MCP is global (can't enable)
- Check if already enabled
- Verify .overture/ directory exists

**Expected Tests**:
- MCP not found error
- Can't enable global MCP error
- Already enabled warning
- Not in project directory error
- Permission denied error

---

### Workstream 2: Test Coverage for Untested Commands - 2-3 days

**Goal**: Add comprehensive test coverage for 4 commands currently at 0% coverage

#### Command 1: doctor.spec.ts (4 hours)
**Status**: NOT STARTED

**File**: Create `apps/cli/src/cli/commands/doctor.spec.ts` (~500 lines, 15-20 tests)

**Test Structure**:
1. Basic command creation
2. Detect clients via discoveryService
3. Display platform info
4. Check MCP command availability
5. JSON output mode (--json)
6. Verbose mode (--verbose)
7. Error handling (discovery fails)

**Key Mocks**:
```typescript
vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue({
  environment: { platform: 'linux', isWSL2: false },
  clients: [{ name: 'claude-code', status: 'found', version: '1.0.0' }],
});
```

---

#### Command 2: audit.spec.ts (3 hours)
**Status**: NOT STARTED

**File**: Create `apps/cli/src/cli/commands/audit.spec.ts` (~400 lines, 12-15 tests)

**Test Structure**:
1. Basic command creation
2. Detect unmanaged MCPs via auditService
3. Display suggestions
4. Filter by client (--client)
5. JSON output
6. Error handling

**Key Mocks**:
```typescript
vi.mocked(deps.auditService.auditClient).mockReturnValue(['memory', 'github']);
```

---

#### Command 3: user.spec.ts (5 hours)
**Status**: NOT STARTED

**File**: Create `apps/cli/src/cli/commands/user.spec.ts` (~600 lines, 18-22 tests)

**Test Structure**:

**Subcommand: user init** (8 tests)
1. Create user config with default MCPs
2. Interactive MCP selection (mock Prompts.multiSelect)
3. Skip if config exists (without --force)
4. Overwrite with --force
5. Error handling (write fails)

**Subcommand: user show** (10 tests)
1. Display formatted config
2. JSON output (--json)
3. YAML output (--yaml)
4. Warning when no config exists
5. Error handling (read fails)

**Key Mocks**:
```typescript
vi.mocked(Prompts.multiSelect).mockResolvedValue(['filesystem', 'memory']);
vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue({
  version: '1.0',
  mcp: { filesystem: {...}, memory: {...} }
});
```

---

#### Command 4: backup.spec.ts (additional tests)
**Status**: PARTIALLY COMPLETE (17 tests exist)

**Note**: backup.spec.ts already exists with 17 tests covering basic functionality. May need additional edge case tests for comprehensive coverage.

**Potential Additional Tests**:
- Concurrent backup operations
- Large backup files
- Corrupted backup handling
- Backup migration scenarios

---

### Workstream 3: E2E Test Cleanup - 30 minutes

**Goal**: Resolve broken E2E tests

#### Option 1: Delete Broken E2E Test (Recommended)
**Status**: NOT STARTED

**Rationale**:
- Unit tests exist for BackupService/RestoreService
- Command tests cover integration layer
- E2E test broken due to architectural change (sync functions → async classes)
- Rewriting requires 2-3 days (not in scope)

**Action**:
```bash
rm apps/cli-e2e/src/backup-restore.spec.ts
```

#### Option 2: Rewrite E2E Tests (If Required)
**Estimated Effort**: 2-3 days

- Rewrite using `execSync()` pattern like `cli.spec.ts`
- Test actual CLI binary, not internal services
- Add proper timeout handling
- Test real filesystem operations

---

### Workstream 4: Final Integration - 2-3 hours

**Goal**: Ensure all changes work together and meet quality standards

#### Uncomment MCP Command in CLI Index
**File**: `apps/cli/src/cli/index.ts`

**Changes Required**:
```typescript
// Line 6: Uncomment import
import { createMcpCommand } from './commands/mcp';

// Line 44: Uncomment registration
program.addCommand(createMcpCommand(deps));
```

#### Run Full Test Suite
```bash
nx test @overture/cli
```

**Expected Results**:
- All tests passing (102+ tests)
- Coverage maintained at 83%+
- No regressions in existing commands

#### Run Build
```bash
nx build @overture/cli
```

**Expected Results**:
- Clean build with no TypeScript errors
- Compiled output in dist/apps/cli/

#### Manual Testing Checklist
- [ ] `overture mcp list` displays MCPs
- [ ] `overture mcp list --scope global` filters correctly
- [ ] `overture mcp list --client claude-code` filters correctly
- [ ] `overture mcp enable <name>` enables MCP
- [ ] `overture doctor` shows system info
- [ ] `overture audit` detects unmanaged MCPs
- [ ] `overture user init` creates user config
- [ ] `overture backup list` shows backups

---

## Success Criteria

### ✅ Critical Bug Fix (COMPLETED)
- ✅ All async service calls in backup.ts have `await`
- ✅ Tests verify async behavior (Promises resolved)
- ✅ No race conditions

### 🚧 MCP Command
- ⏳ Command uncommented in `cli/index.ts`
- ⏳ `mcp list` shows MCPs with filtering
- ⏳ `mcp enable <name>` enables disabled MCPs
- ⏳ 40+ tests, 85%+ coverage
- ⏳ All tests passing

### 🚧 Test Coverage
- ⏳ doctor.spec.ts: 15-20 tests, 80%+ coverage
- ⏳ audit.spec.ts: 12-15 tests, 80%+ coverage
- ⏳ user.spec.ts: 18-22 tests, 80%+ coverage
- ✅ backup.spec.ts: 17 tests (complete)
- ⏳ Overall: Maintain 83%+ CLI coverage

### 🚧 E2E Tests
- ⏳ Broken E2E test deleted OR rewritten
- ⏳ Testing strategy documented

### 🚧 Quality
- ⏳ All tests pass: `nx test @overture/cli`
- ⏳ Build succeeds: `nx build @overture/cli`
- ⏳ No linting errors
- ⏳ Manual testing completed

---

## Execution Order (Recommended)

### Session 1: Complete MCP Command (2-3 hours)
1. ✅ Cycles 1.1-1.3 completed
2. ⏳ Cycle 1.4: Filter by scope (45 min)
3. ⏳ Cycle 1.5: Filter by client (45 min)
4. ⏳ Cycle 1.6: Error handling (30 min)
5. ⏳ Cycle 1.7: Enable command (45 min)
6. ⏳ Cycle 1.8: Enable error handling (30 min)
7. ⏳ Uncomment in cli/index.ts
8. ⏳ Run tests and verify

### Session 2: doctor.spec.ts (4 hours)
1. ⏳ Create test file
2. ⏳ Implement 15-20 tests
3. ⏳ Verify coverage > 80%

### Session 3: audit.spec.ts + user.spec.ts (8 hours)
1. ⏳ Create audit.spec.ts (3 hours)
2. ⏳ Create user.spec.ts (5 hours)
3. ⏳ Verify coverage for both

### Session 4: Cleanup and Integration (2-3 hours)
1. ⏳ Delete E2E test OR rewrite
2. ⏳ Run full test suite
3. ⏳ Run build
4. ⏳ Manual testing
5. ⏳ Code review and refactor
6. ⏳ Coverage verification

---

## Files Changed Summary

### Created (6 files)
1. ✅ `apps/cli/src/cli/commands/mcp.ts` - MCP command implementation
2. ✅ `apps/cli/src/cli/commands/mcp.spec.ts` - MCP tests (9 tests)
3. ⏳ `apps/cli/src/cli/commands/doctor.spec.ts` - Doctor tests (~500 lines)
4. ⏳ `apps/cli/src/cli/commands/audit.spec.ts` - Audit tests (~400 lines)
5. ⏳ `apps/cli/src/cli/commands/user.spec.ts` - User tests (~600 lines)
6. ✅ `apps/cli/src/cli/commands/backup.spec.ts` - Backup tests (17 tests)

### Modified (2 files)
1. ✅ `apps/cli/src/cli/commands/backup.ts` - Added await to async calls
2. ⏳ `apps/cli/src/cli/index.ts` - Uncomment MCP command (2 lines)

### Deleted (1 file)
1. ⏳ `apps/cli-e2e/src/backup-restore.spec.ts` - Broken E2E test

---

## Risk Mitigation

### Risk: Missing await bugs elsewhere
**Mitigation**: Search codebase for similar patterns
```bash
grep -n "Service\." apps/cli/src/cli/commands/*.ts | grep -v "await"
```

### Risk: MCP detection logic complex
**Mitigation**:
- Reference old implementation (commit 92e12c6)
- Use existing `auditService` for detection
- Comprehensive edge case tests

### Risk: Coverage targets hard to hit
**Mitigation**:
- Use coverage reports to identify gaps
- Test error paths with `mockRejectedValue()`
- Add edge case tests iteratively

### Risk: Scope filtering complexity
**Mitigation**:
- ConfigLoader may need enhancement to track source
- May need to add metadata to merged config
- Test with both user and project configs

---

## Notes

- **TDD Discipline**: Write tests BEFORE implementation (red-green-refactor)
- **Mock Factory**: Use `createMockAppDependencies()` consistently
- **Test Organization**: Follow sync.spec.ts pattern
- **Async Testing**: Always `await command.parseAsync()` in tests
- **Coverage**: Run `nx test @overture/cli --coverage` frequently

---

## Current Branch Status

**Branch**: `fix/backup-async-await-bug`

**Commits**:
1. `71b4aec` - fix: add missing await to async service calls in backup command
2. `33c4b45` - feat: add environment variable validation to validate command
3. `f7203c3` - feat: implement mcp list command (TDD Cycles 1.1-1.3)

**Next Commit**: TDD Cycles 1.4-1.8 (MCP command filtering and enable)

---

**Generated**: 2025-12-17
**Tool**: Claude Code
**Plan Source**: `/home/jeff/.claude/plans/purring-wiggling-rivest.md`
