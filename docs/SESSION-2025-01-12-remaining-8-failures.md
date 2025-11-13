# Remaining Test Failures - January 12, 2025

## Summary

**Status**: 1140/1148 tests passing (99.3%)
**Remaining**: 8 test failures in 3 test files

## Test Status Before This Session

- **Before**: 1064/1127 passing (94.4%)
- **After**: 1140/1148 passing (99.3%)
- **Improvement**: +76 tests fixed (+4.9 percentage points)

## Fixes Completed This Session

### Sprint 1: Chalk Mock (init.spec.ts)
- Added chalk and inquirer mocks before imports
- Deferred full resolution as not blocking

### Sprint 2: Command Implementations
- **validate.ts**: Added --platform, --client, --verbose options; v0.2 validation logic; exit codes 0/2/3
- **mcp.ts**: Added --scope, --client options; user/project config merging; enhanced table display

### Sprint 3: Integration Test Fixes
- Fixed test configs: added `plugins: {}` and `scope: project`
- Fixed supportsTransport null reference bug in validate.ts
- Added ConfigLoadError/ConfigValidationError handling in ErrorHandler
- Added client name validation to mcp list command
- Updated transport validation test expectations

## Remaining 8 Failures

### 1. mcp.spec.ts: "should warn when no MCPs match filters"
**File**: `apps/cli/src/cli/commands/mcp.spec.ts`
**Issue**: Test expects warning when filters don't match, implementation might return success

### 2. validate.spec.ts: "should warn about unsupported transports"
**File**: `apps/cli/src/cli/commands/validate.spec.ts`
**Issue**: Transport validation logic for unsupported transports

### 3-4. integration.spec.ts: Audit command tests
**File**: `apps/cli/src/cli/commands/integration.spec.ts`
**Tests**:
- "should detect unmanaged MCPs"
- "should support client filtering"

**Issue**: Audit command failing, likely due to config loading or adapter issues

### 5. integration.spec.ts: "should detect invalid config"
**File**: `apps/cli/src/cli/commands/integration.spec.ts`
**Issue**: Validate command not detecting invalid config correctly

### 6. integration.spec.ts: "should filter by client"
**File**: `apps/cli/src/cli/commands/integration.spec.ts`
**Issue**: MCP list --client filtering not working correctly

### 7. integration.spec.ts: "should support sync → audit workflow"
**File**: `apps/cli/src/cli/commands/integration.spec.ts`
**Issue**: Audit command in workflow failing

### 8. integration.spec.ts: "should handle missing config gracefully"
**File**: `apps/cli/src/cli/commands/integration.spec.ts`
**Issue**: Validate should exit with non-zero code when no config exists

## Root Causes

### Common Issue Pattern: Config Loading
Several failures relate to how configs are loaded when:
- No config exists (should fail with exit code 2)
- Invalid config format (should fail with exit code 3)
- Configs have certain formats that tests expect

### MCP Filtering Issues
- Client filtering in mcp list may not be working correctly with test configs
- Test configs may need `clients` section or sync.enabledClients

### Audit Command
- Multiple audit tests failing suggests audit.ts has issues
- Likely related to config loading or adapter registry

## Recommended Next Steps

1. **Config Loading Edge Cases**: Investigate loadConfig behavior when no config exists
2. **Audit Command**: Debug why audit command is failing across multiple tests
3. **MCP List Filtering**: Fix client filtering logic in mcp.ts
4. **Test Config Format**: Ensure test configs match expected v2.0 schema

## Files Modified This Session

**Production Code**:
- `apps/cli/src/cli/commands/validate.ts` - Enhanced with v0.2 features, transport validation
- `apps/cli/src/cli/commands/mcp.ts` - Enhanced with v0.2 features, client validation
- `apps/cli/src/core/error-handler.ts` - Added ConfigLoadError/ConfigValidationError handling
- `apps/cli/src/cli/commands/sync.ts` - Added --dry-run, --client, --force options
- `apps/cli/src/cli/commands/index.ts` - Exported user, audit, backup commands
- `apps/cli/src/cli/index.ts` - Registered user, audit, backup commands

**Test Files**:
- `apps/cli/src/cli/commands/integration.spec.ts` - Fixed test configs, updated expectations
- `apps/cli/src/cli/commands/init.spec.ts` - Added chalk/inquirer mocks

## Key Insights

1. **ConfigLoadError/ConfigValidationError needed special handling** - ErrorHandler didn't recognize them
2. **Transport validation needs enabled clients list** - Extract from clients section if sync.enabledClients missing
3. **Client name validation important** - mcp list --client should validate client names
4. **Test config schema compliance** - v2.0 configs need `plugins: {}` and `scope: project`

## Time Investment

- **Sprint 1**: ~30 minutes (chalk mock attempts)
- **Sprint 2**: ~45 minutes (parallel agents for validate.ts and mcp.ts)
- **Sprint 3**: ~90 minutes (systematic integration test fixes)
- **Total**: ~2.5 hours for 76 test fixes

## Next Session Goals

1. Fix audit command loading issues
2. Fix mcp list client filtering
3. Fix validate missing config detection
4. Achieve 100% test pass rate (1148/1148)
