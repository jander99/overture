# CLI Architecture Analysis: Exit Codes and Testability

## Executive Summary

This document analyzes the Overture CLI architecture focusing on:
1. Command structure and patterns
2. Exit code strategy and conventions
3. Filesystem access patterns
4. Testability concerns
5. Recommendations for improvement

**Key Findings:**
- Exit code mappings are well-defined and follow industry standards
- Validation command correctly returns 0 for valid configs (warnings don't fail)
- Commands lack dependency injection for filesystem paths (testing limitation)
- Architecture is generally testable with process.exit mocking, but could be improved

---

## 1. CLI Command Structure Analysis

### 1.1 Common Patterns

All commands follow a consistent structure:

```typescript
// Pattern from init.ts, sync.ts, validate.ts, user.ts, audit.ts, backup.ts
export function createXXXCommand(): Command {
  const command = new Command('xxx');

  command
    .description('...')
    .option('...')
    .action(async (options) => {
      try {
        // Command logic
      } catch (error) {
        const verbose = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
        ErrorHandler.handleCommandError(error, 'xxx', verbose);
      }
    });

  return command;
}
```

**Observations:**
- **Consistent error handling**: All commands use `ErrorHandler.handleCommandError()`
- **Verbose mode**: Controlled via `DEBUG` environment variable
- **Commander.js pattern**: Standard CLI framework usage
- **Async actions**: All commands support async operations
- **No DI**: Commands directly call services without dependency injection

### 1.2 Service Dependencies

Commands depend on these core services:

| Command | Core Dependencies |
|---------|------------------|
| `init` | ConfigManager, FsUtils, Prompts |
| `sync` | syncClients (sync-engine), adapterRegistry |
| `validate` | loadConfig, OvertureConfigV2Schema, transport-validator |
| `user` | loadUserConfig, hasUserConfig, path-resolver |
| `audit` | AuditService, loadConfig, adapterRegistry |
| `backup` | BackupService, RestoreService, adapterRegistry, Prompts |
| `mcp` | loadConfig, adapterRegistry, Logger |

**Key Observation**: Commands access config paths through:
- Direct `process.cwd()` calls
- Path resolver functions (`getUserConfigPath()`, `getProjectConfigPath()`)
- **NO** injectable path overrides for testing

---

## 2. Exit Code Strategy

### 2.1 Exit Code Mappings

Defined in `/apps/cli/src/core/error-handler.ts`:

```typescript
export enum ExitCode {
  SUCCESS = 0,              // Success
  GENERAL_ERROR = 1,        // General command error
  CONFIG_ERROR = 2,         // Configuration error
  VALIDATION_ERROR = 3,     // Validation error
  FILESYSTEM_ERROR = 4,     // File system error
  USER_CANCELLED = 5,       // User cancelled operation
  UNKNOWN_ERROR = 99,       // Unknown error
}
```

### 2.2 Error Class → Exit Code Mapping

From `/apps/cli/src/domain/errors.ts`:

| Error Class | Exit Code | Usage |
|------------|-----------|-------|
| `ConfigError` | 2 | Config file not found, invalid YAML |
| `ValidationError` | 3 | Schema validation failures |
| `PluginError` | 4 | Plugin installation/operation errors |
| `McpError` | 5 | MCP server errors |
| `OvertureError` (base) | 1 | Generic Overture errors |

From `/apps/cli/src/core/error-handler.ts`:

| Error Class | Exit Code | Context |
|------------|-----------|---------|
| `ConfigurationError` | 2 | Config issues (duplicate of ConfigError) |
| `FileSystemError` | 4 | Filesystem operations |
| `NetworkError` | 1 | Network issues |
| `UserCancelledError` | 5 | User cancellation |
| `DependencyError` | 1 | Missing dependencies |
| Standard `Error` | 1 | Unknown errors |

**Inconsistency Note**: There are TWO error classes for config errors:
- `ConfigError` (domain/errors.ts) → exit code 2
- `ConfigurationError` (core/error-handler.ts) → exit code 2

Both map to the same exit code, but this duplication is confusing.

### 2.3 Exit Code Standards Comparison

**Are Overture's exit codes standard?**

✅ **YES** - Overture follows common CLI conventions:

| Standard Convention | Overture Mapping |
|--------------------|------------------|
| 0 = success | ✅ ExitCode.SUCCESS = 0 |
| 1 = general error | ✅ ExitCode.GENERAL_ERROR = 1 |
| 2 = misuse of shell command | ✅ ExitCode.CONFIG_ERROR = 2 (config is input to CLI) |
| Non-zero = failure | ✅ All errors return non-zero |

**Industry examples:**
- **Git**: 0=success, 1=generic error, 128+=fatal errors
- **npm**: 0=success, 1=error, other codes for specific errors
- **Terraform**: 0=success, 1=error, 2=usage error
- **Docker**: 0=success, 1=error, 125-127=Docker daemon errors

**Verdict**: Overture's exit code strategy is **standard and appropriate** for a modern CLI tool.

---

## 3. Validate Command Analysis

### 3.1 Exit Logic

From `/apps/cli/src/cli/commands/validate.ts`:

```typescript
// Line 99-107
if (result.valid) {
  Logger.nl();
  Logger.success(chalk.bold('Configuration is valid!'));
  process.exit(0);  // ✅ Success
} else {
  Logger.nl();
  Logger.error(chalk.bold('Configuration has errors'));
  process.exit(3);  // ❌ Validation error
}
```

### 3.2 Validation Result Logic

```typescript
// Line 364-368
return {
  valid: errors.length === 0,  // ← Only errors affect validity
  errors,
  warnings,
};
```

**Key Finding**: Warnings do NOT affect validation success!

### 3.3 Answer to Key Question

**Q: Should validate return 0 when config is valid but has warnings?**

**A: YES** ✅ - And it already does!

**Reasoning:**
1. Warnings are informational (e.g., transport compatibility, no clients installed)
2. `result.valid` is `true` if `errors.length === 0`
3. Warnings don't increment the error count
4. Exit code 0 is returned when `result.valid === true`

**Example warning scenarios that return 0:**
- Transport not supported by client (line 177-190)
- No installed clients detected (line 168-174)
- Client not registered (line 162-167)

These are **warnings**, not **errors**, so validation passes (exit 0).

---

## 4. Filesystem Access Patterns

### 4.1 Current Implementation

Commands access config files through:

```typescript
// validate.ts (line 68)
config = loadConfig();

// Inside config-loader.ts:
export function loadConfig(): OvertureConfigV2 {
  const projectConfigPath = getProjectConfigPath();  // Uses process.cwd()
  const userConfigPath = getUserConfigPath();        // Uses os.homedir()
  // ...
}

// path-resolver.ts (line 98-101)
export function getProjectConfigPath(projectRoot?: string): string {
  const root = projectRoot || process.cwd();  // ← Hardcoded default
  return path.join(root, '.overture', 'config.yaml');
}
```

**Problem**: No way to override config paths for testing without:
1. Mocking filesystem functions
2. Using environment variables
3. Changing working directory

### 4.2 Dependency Injection Gap

Commands don't support path overrides:

```typescript
// What we have:
command.action(async (options) => {
  config = loadConfig();  // Always uses process.cwd()
});

// What would be testable:
command.action(async (options) => {
  const configPath = options.configDir || process.cwd();
  config = loadConfig(configPath);
});
```

### 4.3 Testing Workarounds

Current test patterns use:

```typescript
// From validate.spec.ts (line 71-89)
exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`Process exit: ${code}`);
});

jest.mock('../../core/config-loader', () => ({
  loadConfig: jest.fn(),
  ConfigLoadError: actualModule.ConfigLoadError,
  ConfigValidationError: actualModule.ConfigValidationError,
}));
```

**Observation**: Tests rely on:
1. Mocking `process.exit` to capture exit codes
2. Mocking entire modules (`config-loader`)
3. No integration testing with real filesystem

---

## 5. Architectural Recommendations

### 5.1 Exit Code Strategy

✅ **Keep current exit code mappings** - They're standard and well-documented.

⚠️ **Consolidate error classes**:
```typescript
// Remove ConfigurationError from error-handler.ts
// Use ConfigError from domain/errors.ts consistently
```

### 5.2 Validate Command

✅ **Keep current behavior** - Warnings don't fail validation (correct).

📋 **Document exit codes** in command help:
```typescript
command
  .description('Validate configuration schema and transport compatibility')
  .addHelpText('after', `
Exit Codes:
  0 - Configuration is valid (warnings allowed)
  1 - General error (file not found, etc.)
  3 - Validation errors (schema/constraint violations)
  `);
```

### 5.3 Filesystem Access & Testability

#### Option A: Add --config-dir flag (Recommended)

```typescript
// validate.ts
command
  .option('--config-dir <path>', 'Override config directory (for testing)')
  .action(async (options) => {
    const configDir = options.configDir || process.cwd();
    const config = loadConfig(configDir);
    // ...
  });

// config-loader.ts
export function loadConfig(projectRoot?: string): OvertureConfigV2 {
  const projectConfigPath = getProjectConfigPath(projectRoot);
  const userConfigPath = getUserConfigPath();
  // ...
}
```

**Benefits:**
- Supports integration testing with real configs
- Useful for debugging (`overture validate --config-dir /tmp/test-config`)
- Doesn't break existing usage (optional flag)
- No need to mock filesystem

#### Option B: Environment Variable Override

```typescript
// path-resolver.ts
export function getProjectConfigPath(projectRoot?: string): string {
  const root = projectRoot
    || process.env.OVERTURE_CONFIG_DIR  // ← Add this
    || process.cwd();
  return path.join(root, '.overture', 'config.yaml');
}
```

**Benefits:**
- Testable via `OVERTURE_CONFIG_DIR=/tmp/test-config`
- No API changes
- Easy to use in CI/CD

**Downside:**
- Environment variables are less discoverable than flags

#### Option C: Dependency Injection (Major Refactor)

```typescript
// Command factory with injected services
export function createValidateCommand(
  configLoader: ConfigLoader,
  logger: Logger,
  errorHandler: ErrorHandler
): Command {
  // ...
}

// In tests:
const mockConfigLoader = {
  loadConfig: jest.fn().mockResolvedValue(mockConfig)
};
const command = createValidateCommand(mockConfigLoader, logger, errorHandler);
```

**Benefits:**
- True dependency injection
- Highly testable
- Decoupled architecture

**Downside:**
- Large refactor required
- More complex setup in main.ts
- Overkill for current needs

### 5.4 Recommended Approach

**Implement Option A + Option B together**:

```typescript
// path-resolver.ts
export function getProjectConfigPath(projectRoot?: string): string {
  const root = projectRoot
    || process.env.OVERTURE_CONFIG_DIR  // For testing
    || process.cwd();
  return path.join(root, '.overture', 'config.yaml');
}

// All commands add --config-dir flag
command
  .option('--config-dir <path>', 'Override config directory')
  .action(async (options) => {
    const config = loadConfig(options.configDir);
    // ...
  });
```

**Why both?**
- Flags are user-visible and documented
- Environment variables work in test scripts
- Supports both manual testing and automated testing
- Minimal code changes

---

## 6. Integration Test Failures

### 6.1 Root Cause Analysis

The integration tests expect commands to:
1. Return proper exit codes (working ✅)
2. Access config files in temp directories (broken ❌)

**Example failure scenario:**
```typescript
// integration.spec.ts
it('should validate config in temp directory', async () => {
  const tempDir = setupTempConfig();

  // ❌ This doesn't work - validate always uses process.cwd()
  const result = await runCommand(['validate']);

  // ✅ This would work with --config-dir
  const result = await runCommand(['validate', '--config-dir', tempDir]);
});
```

### 6.2 Current Test Pattern

From `integration.spec.ts` (lines 69-126):

```typescript
async function runCommand(args: string[]): Promise<{
  exitCode: number;
  output: string;
  error: string
}> {
  // Mock process.exit to capture exit code
  (process.exit as unknown) = ((code?: number) => {
    throw new Error(`process.exit: ${code ?? 0}`);
  }) as typeof process.exit;

  try {
    await program.parseAsync(['node', 'overture', ...args]);
    return { exitCode: 0, output, error };
  } catch (error) {
    // Extract exit code from error message
    const match = error.message.match(/process\.exit: (\d+)/);
    exitCode = match ? parseInt(match[1], 10) : 1;
    return { exitCode, output, error };
  }
}
```

**Issue**: Tests capture exit codes correctly, but can't control config file locations.

---

## 7. CLI Best Practices Assessment

### 7.1 What Overture Does Well

✅ **Consistent error handling** - All commands use ErrorHandler
✅ **Standard exit codes** - Follows industry conventions
✅ **Contextual suggestions** - ErrorHandler provides helpful fix suggestions
✅ **Verbose mode** - DEBUG env var enables stack traces
✅ **User-friendly output** - Chalk colors, structured messages
✅ **Command structure** - Clean, consistent Commander.js patterns

### 7.2 Areas for Improvement

⚠️ **No --config-dir flag** - Can't test with custom config locations
⚠️ **Duplicate error classes** - ConfigError vs ConfigurationError
⚠️ **No exit code documentation** - Users don't know what codes mean
⚠️ **No integration tests with real configs** - Only unit tests with mocks

### 7.3 Comparison with Similar CLIs

| Feature | Overture | Terraform | Docker | npm |
|---------|----------|-----------|--------|-----|
| Standard exit codes | ✅ | ✅ | ✅ | ✅ |
| --help text | ✅ | ✅ | ✅ | ✅ |
| Exit code docs | ❌ | ✅ | ✅ | ❌ |
| Config path override | ❌ | ✅ (-chdir) | ✅ (--config) | ✅ (--prefix) |
| Verbose mode | ✅ (DEBUG) | ✅ (-v) | ✅ (-v) | ✅ (-v) |
| Colored output | ✅ | ✅ | ✅ | ✅ |
| Integration tests | ❌ | ✅ | ✅ | ✅ |

**Verdict**: Overture's architecture is solid but lacks config path overrides for testing.

---

## 8. Action Items

### 8.1 Immediate (Quick Wins)

1. **Add exit code documentation to command help**
   ```typescript
   command.addHelpText('after', `Exit Codes: 0=success, 1=error, 3=validation`);
   ```

2. **Add --config-dir flag to all commands**
   ```typescript
   .option('--config-dir <path>', 'Override config directory')
   ```

3. **Add OVERTURE_CONFIG_DIR environment variable**
   ```typescript
   const root = projectRoot || process.env.OVERTURE_CONFIG_DIR || process.cwd();
   ```

### 8.2 Short-term (Test Improvements)

4. **Create integration test fixtures**
   - Setup temp directories with valid/invalid configs
   - Test commands with --config-dir flag
   - Verify exit codes with real filesystem access

5. **Document testing patterns**
   - Add README in tests/ explaining mocking strategy
   - Document when to use unit vs integration tests

### 8.3 Medium-term (Refactoring)

6. **Consolidate error classes**
   - Remove ConfigurationError from error-handler.ts
   - Use ConfigError from domain/errors.ts everywhere
   - Update tests to match

7. **Add CI/CD integration tests**
   - Run integration tests in GitHub Actions
   - Test on multiple platforms (Linux, macOS, Windows)

### 8.4 Long-term (Architecture)

8. **Consider dependency injection** (if needed)
   - Extract service interfaces
   - Inject dependencies in command factories
   - Fully decouple commands from implementation

---

## 9. Conclusion

### 9.1 Exit Code Strategy

**Current implementation is correct.** The exit code mappings follow industry standards, and validation correctly returns 0 for valid configs with warnings.

**No changes needed** - but add documentation to help text.

### 9.2 Filesystem Access

**Current implementation lacks testability.** Commands hardcode config paths, making integration testing difficult.

**Recommended fix**: Add `--config-dir` flag and `OVERTURE_CONFIG_DIR` environment variable.

### 9.3 Overall Architecture

**Generally solid**, with these characteristics:

**Strengths:**
- Consistent error handling
- Standard exit codes
- User-friendly output
- Clean command structure

**Weaknesses:**
- No config path overrides
- Limited integration testing
- Duplicate error classes

**Recommendation**: Implement the action items above to improve testability while maintaining the solid foundation.

---

## Appendix: Exit Code Reference

### A.1 Complete Exit Code Mapping

| Code | Constant | Meaning | Examples |
|------|----------|---------|----------|
| 0 | SUCCESS | Command succeeded | Valid config, successful sync |
| 1 | GENERAL_ERROR | Generic error | Network failure, unknown error |
| 2 | CONFIG_ERROR | Configuration issue | YAML parse error, file not found |
| 3 | VALIDATION_ERROR | Schema/constraint violation | Missing required field, invalid type |
| 4 | FILESYSTEM_ERROR | File operation failed | Permission denied, disk full |
| 5 | USER_CANCELLED | User aborted operation | Prompt answered "no" |
| 99 | UNKNOWN_ERROR | Unexpected error | Non-Error throw, system failure |

### A.2 Command-Specific Exit Behavior

| Command | Success (0) | Failure (1) | Config Error (2) | Validation (3) |
|---------|------------|-------------|------------------|----------------|
| `init` | Config created | Generic error | Config exists (no --force) | N/A |
| `sync` | Sync complete | Sync failed | Config invalid | N/A |
| `validate` | Valid config | Load error | Config missing | Schema errors |
| `user init` | User config created | Generic error | Config exists | Validation failed |
| `user show` | Config displayed | Generic error | Config not found | N/A |
| `audit` | Audit complete | Generic error | Config invalid | N/A |
| `backup list` | List displayed | Generic error | N/A | N/A |
| `backup restore` | Restored | Restore failed | Invalid client | N/A |
| `mcp list` | List displayed | Generic error | Config invalid | N/A |
| `mcp enable` | MCP enabled | Generic error | Config invalid | N/A |

### A.3 ErrorHandler Flow

```
Error thrown in command
  ↓
Caught in try/catch
  ↓
ErrorHandler.handleCommandError(error, command, verbose)
  ↓
ErrorHandler.formatError(error, verbose)
  ↓
Determine exit code based on error type
  ↓
ErrorHandler.getErrorSuggestion(error, context)
  ↓
ErrorHandler.logError(formatted, suggestion, verbose)
  ↓
process.exit(exitCode)
```

---

**Document Version**: 1.0
**Date**: 2025-01-12
**Author**: Claude (Backend System Architect)
**Purpose**: Architecture analysis for integration test fix
