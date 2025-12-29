---
title: Complexity Reduction Analysis - Doctor.ts Output Functions
created: 2025-12-29T18:45:00Z
last_modified: 2025-12-29T18:45:00Z
author: Claude
type: plan
tags: [refactoring, complexity-reduction, doctor-command, output-functions]
---

# Complexity Reduction Analysis: Doctor.ts Output Functions

## Overview

This document provides a detailed analysis of three high-complexity output functions in `apps/cli/src/cli/commands/doctor.ts` that display diagnostic information. The goal is to reduce their cyclomatic complexity from 29-35 down to below 15 through strategic helper function extraction.

### Target Functions

1. **outputConfigRepoStatus** (lines 529-625) - Current complexity: **35**
2. **outputClientResults** (lines 630-710) - Current complexity: **29**
3. **outputSummary** (lines 759-843) - Current complexity: **30**

---

## Function 1: outputConfigRepoStatus (Complexity 35)

### Complexity Sources

| Source | Lines | Issue |
|--------|-------|-------|
| Nested if: configRepoExists | 548-623 | 2 levels |
| Nested if: isGitRepo | 554-595 | 3 levels |
| Nested if: gitRemote | 559-589 | 4 levels |
| Nested if/else: gitInSync | 566-577 | 5 levels (deepest) |
| Conditional branches: localHash/remoteHash | 565-583 | Complex sync detection |
| Nested if: skillsDirExists | 598-615 | 2 levels |
| Ternary operators: skillCountStr | 599-604 | Nested ternary (3 levels) |

### Root Cause
Deeply nested conditionals mixing multiple concerns:
- Config repo existence check
- Git repository detection
- Git remote configuration status
- Local/remote sync detection
- Skills directory validation and counting

### Proposed Helper Functions

#### 1. `outputGitRepoStatus()` (Extract lines 554-595)

**Purpose:** Display git repository status and sync information

**Signature:**
```typescript
function outputGitRepoStatus(
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  output: OutputService,
): void
```

**Extracts:** The entire git-related conditional block (lines 554-595)

**Reduces nesting by:** Moving 3-4 levels of nesting into a separate function, leaving only 1 level in parent

**Projected complexity:** 15-18 (down from 35+ in parent)

**Implementation outline:**
```typescript
function outputGitRepoStatus(isGitRepo, gitRemote, localHash, remoteHash, gitInSync, output) {
  if (isGitRepo) {
    // Output: Git initialized
    if (gitRemote) {
      // Output: Remote configured
      outputGitSyncStatus(localHash, remoteHash, gitInSync, output);
    } else {
      // Output: No remote
    }
  } else {
    // Output: Not a git repo
  }
}
```

#### 2. `outputGitSyncStatus()` (Extract lines 565-583)

**Purpose:** Display git synchronization status between local and remote

**Signature:**
```typescript
function outputGitSyncStatus(
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  output: OutputService,
): void
```

**Extracts:** The git sync detection logic with 3 branches (lines 565-583)

**Reduces nesting by:** Extracting the innermost conditional level from outputGitRepoStatus

**Projected complexity:** 4-6 (handles 3 distinct sync states)

**Implementation outline:**
```typescript
function outputGitSyncStatus(localHash, remoteHash, gitInSync, output) {
  if (localHash && remoteHash) {
    // Either: in sync or out of sync
  } else if (localHash && !remoteHash) {
    // Remote HEAD not available
  }
}
```

#### 3. `outputSkillsStatus()` (Extract lines 598-615)

**Purpose:** Display skills directory status and skill count

**Signature:**
```typescript
function outputSkillsStatus(
  skillsDirExists: boolean,
  skillsPath: string,
  skillCount: number,
  output: OutputService,
): void
```

**Extracts:** The skills directory section (lines 598-615)

**Reduces nesting by:** Removing 2 levels of conditional from parent

**Projected complexity:** 4-5 (simple if/else with ternary)

**Implementation outline:**
```typescript
function outputSkillsStatus(skillsDirExists, skillsPath, skillCount, output) {
  if (skillsDirExists) {
    const skillCountStr = getSkillCountDisplay(skillCount); // Extract ternary
    // Output success
  } else {
    // Output warning
  }
}
```

#### 4. `outputConfigRepoNotFound()` (Extract lines 617-622)

**Purpose:** Display message when config repo doesn't exist

**Signature:**
```typescript
function outputConfigRepoNotFound(
  configRepoPath: string,
  output: OutputService,
): void
```

**Extracts:** The else block for missing config repo (lines 617-622)

**Reduces nesting by:** Simplifying outer if/else structure

**Projected complexity:** 1 (just output operations)

---

### Simplified outputConfigRepoStatus Structure

**Before:** ~97 lines, complexity 35
**After:** ~10 lines, complexity ~4-5

```typescript
function outputConfigRepoStatus(
  configRepoPath: string,
  configRepoExists: boolean,
  skillsPath: string,
  skillsDirExists: boolean,
  skillCount: number,
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  output: OutputService,
): void {
  output.info(chalk.bold('Checking config repository...\n'));

  if (configRepoExists) {
    output.success(`${chalk.green('✓')} Config repo - ${chalk.dim(configRepoPath)}`);
    outputGitRepoStatus(isGitRepo, gitRemote, localHash, remoteHash, gitInSync, output);
    outputSkillsStatus(skillsDirExists, skillsPath, skillCount, output);
  } else {
    outputConfigRepoNotFound(configRepoPath, output);
  }

  console.log('');
}
```

---

## Function 2: outputClientResults (Complexity 29)

### Complexity Sources

| Source | Lines | Issue |
|--------|-------|-------|
| Loop: for each client | 654 | 1 level (foundation) |
| Branch: client.status === 'found' | 655-688 | 3 branches (found/not-found/skipped) |
| Nested if: configPath | 669-674 | 1 level within 'found' |
| Nested if: windowsPath && verbose | 677-681 | 1 level within 'found' |
| Nested if: warnings.length > 0 && verbose | 684-688 | 1 level within 'found' |
| Nested if: recommendation | 698-700 | 1 level within 'not-found' |

### Root Cause
Loop with three large conditional branches (status = found/not-found/other), each with nested conditionals for optional displays (config path, warnings, Windows path, recommendations).

### Proposed Helper Functions

#### 1. `outputFoundClient()` (Extract lines 655-688)

**Purpose:** Display details for an installed/found client

**Signature:**
```typescript
function outputFoundClient(
  client: ClientInfo,
  output: OutputService,
  verbose: boolean,
): void
```

**Extracts:** The entire 'found' client branch (34 lines, lines 655-688)

**Reduces nesting by:** Moving all nested conditionals for found clients into separate function

**Projected complexity:** 8-10 (handles config display, Windows path, warnings with 3 nested ifs)

**Implementation outline:**
```typescript
function outputFoundClient(client, output, verbose) {
  const versionStr = client.version ? chalk.dim(` (${client.version})`) : '';
  const pathStr = client.binaryPath || client.appBundlePath;
  const wsl2Tag = client.source === 'wsl2-fallback' ? chalk.cyan(' [WSL2: Windows]') : '';
  
  output.success(`${chalk.green('✓')} ${chalk.bold(client.client)}${versionStr}${wsl2Tag} - ${chalk.dim(pathStr)}`);
  
  outputClientConfig(client, output);
  outputWindowsPath(client, output, verbose);
  outputClientWarnings(client, output, verbose);
}
```

#### 2. `outputClientConfig()` (Extract lines 669-674)

**Purpose:** Display client config file path and validity status

**Signature:**
```typescript
function outputClientConfig(
  client: ClientInfo,
  output: OutputService,
): void
```

**Extracts:** Config path display logic (lines 669-674)

**Reduces nesting by:** Extracting conditional from outputFoundClient

**Projected complexity:** 1 (simple if with one branch)

```typescript
function outputClientConfig(client, output) {
  if (!client.configPath) return;
  
  const configStatus = client.configValid ? chalk.green('valid') : chalk.yellow('invalid');
  console.log(`  Config: ${client.configPath} (${configStatus})`);
}
```

#### 3. `outputClientWarnings()` (Extract lines 684-688)

**Purpose:** Display warnings for a client if any exist

**Signature:**
```typescript
function outputClientWarnings(
  client: ClientInfo,
  output: OutputService,
  verbose: boolean,
): void
```

**Extracts:** The warnings loop (lines 684-688)

**Reduces nesting by:** Extracting nested conditional from outputFoundClient

**Projected complexity:** 2 (outer if for verbose and warning presence, inner forEach)

```typescript
function outputClientWarnings(client, output, verbose) {
  if (!verbose || !client.warnings || client.warnings.length === 0) return;
  
  client.warnings.forEach((warning) => {
    output.warn(`  ${chalk.yellow('⚠')} ${warning}`);
  });
}
```

#### 4. `outputWindowsPath()` (Extract lines 677-681)

**Purpose:** Display Windows path for WSL2-detected clients

**Signature:**
```typescript
function outputWindowsPath(
  client: ClientInfo,
  output: OutputService,
  verbose: boolean,
): void
```

**Extracts:** Windows path display (lines 677-681)

**Projected complexity:** 1 (simple conditional output)

```typescript
function outputWindowsPath(client, output, verbose) {
  if (!verbose || !client.windowsPath) return;
  
  console.log(`  ${chalk.dim('Windows path:')} ${chalk.dim(client.windowsPath)}`);
}
```

#### 5. `outputMissingClient()` (Extract lines 689-700)

**Purpose:** Display message for missing/not-found client

**Signature:**
```typescript
function outputMissingClient(
  client: ClientInfo,
  output: OutputService,
): void
```

**Extracts:** The 'not-found' branch (lines 689-700)

**Projected complexity:** 2 (simple status output + optional recommendation)

```typescript
function outputMissingClient(client, output) {
  output.error(`${chalk.red('✗')} ${chalk.bold(client.client)} - not installed`);
  
  const recommendation = getInstallRecommendation(client.client);
  if (recommendation) {
    console.log(`  ${chalk.dim('→')} ${chalk.dim(recommendation)}`);
  }
}
```

#### 6. `outputSkippedClient()` (Extract lines 701-706)

**Purpose:** Display message for skipped client

**Signature:**
```typescript
function outputSkippedClient(
  client: ClientInfo,
): void
```

**Extracts:** The 'skipped' client output (lines 701-706)

**Projected complexity:** 1 (simple console.log)

---

### Simplified outputClientResults Structure

**Before:** ~81 lines, complexity 29
**After:** ~15 lines, complexity ~3-4

```typescript
function outputClientResults(
  clients: ClientInfo[],
  output: OutputService,
  verbose: boolean,
): void {
  output.info(chalk.bold('Checking client installations...\n'));

  for (const client of clients) {
    switch (client.status) {
      case 'found':
        outputFoundClient(client, output, verbose);
        break;
      case 'not-found':
        outputMissingClient(client, output);
        break;
      default:
        outputSkippedClient(client);
    }
    console.log(''); // Blank line
  }
}
```

---

## Function 3: outputSummary (Complexity 30)

### Complexity Sources

| Source | Lines | Issue |
|--------|-------|-------|
| Ternary: configRepoStatus | 784-786 | 1 level |
| Conditional: if configRepoExists | 788-812 | 2 levels |
| Nested if: isGitRepo | 791-802 | 3 levels |
| Nested if: gitRemote && localHash && remoteHash | 797-802 | 4 levels (deepest) |
| Ternary: gitRepoStatus, remoteStatus, syncStatus | Multiple | Scattered ternaries |
| Ternary: skillsStatus, skillCountStr | 804-811 | 2-level ternary |
| Conditional: if wsl2Detections > 0 | 821-823 | 1 level |
| Conditional: if totalMcpServers > 0 | 830-840 | 2 levels |
| Nested if: if mcpCommandsMissing > 0 | 835-839 | 1 level within MCP section |

### Root Cause
Multiple summary sections each with their own conditional display logic, mixed with ternary operators for status coloring. Sections are interdependent and deeply nested.

### Proposed Helper Functions

#### 1. `outputConfigRepoSummary()` (Extract lines 783-812)

**Purpose:** Display config repository summary (existence, git status, skills count)

**Signature:**
```typescript
function outputConfigRepoSummary(
  configRepoExists: boolean,
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  skillsDirExists: boolean,
  skillCount: number,
): void
```

**Extracts:** The entire config repo summary block (lines 783-812)

**Reduces nesting by:** Isolating config repo logic from other summary sections

**Projected complexity:** 12-14 (has 4 levels of nesting)

**Implementation outline:**
```typescript
function outputConfigRepoSummary(configRepoExists, isGitRepo, gitRemote, localHash, remoteHash, gitInSync, skillsDirExists, skillCount) {
  const configRepoStatus = configRepoExists ? chalk.green('exists') : chalk.yellow('not found');
  console.log(`  Config repo:      ${configRepoStatus}`);
  
  if (configRepoExists) {
    outputGitSummary(isGitRepo, gitRemote, localHash, remoteHash, gitInSync);
    outputSkillsSummary(skillsDirExists, skillCount);
  }
}
```

#### 2. `outputGitSummary()` (Extract lines 789-802)

**Purpose:** Display git repository and sync status summary

**Signature:**
```typescript
function outputGitSummary(
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
): void
```

**Extracts:** Git status lines within configRepoSummary (lines 789-802)

**Reduces nesting by:** Extracting 3 levels of nested conditionals

**Projected complexity:** 5-6 (handles git repo, remote, and sync status)

```typescript
function outputGitSummary(isGitRepo, gitRemote, localHash, remoteHash, gitInSync) {
  const gitRepoStatus = isGitRepo ? chalk.green('yes') : chalk.yellow('no');
  console.log(`  Git repository:   ${gitRepoStatus}`);
  
  if (isGitRepo) {
    const remoteStatus = gitRemote ? chalk.green('configured') : chalk.yellow('not configured');
    console.log(`  Git remote:       ${remoteStatus}`);
    
    if (gitRemote && localHash && remoteHash) {
      const syncStatus = gitInSync ? chalk.green('in sync') : chalk.yellow('out of sync');
      console.log(`  Git sync:         ${syncStatus}`);
    }
  }
}
```

#### 3. `outputSkillsSummary()` (Extract lines 804-811)

**Purpose:** Display skills directory summary with count

**Signature:**
```typescript
function outputSkillsSummary(
  skillsDirExists: boolean,
  skillCount: number,
): void
```

**Extracts:** Skills summary lines (lines 804-811)

**Projected complexity:** 2 (if/else with ternary inside)

```typescript
function outputSkillsSummary(skillsDirExists, skillCount) {
  const skillsStatus = skillsDirExists ? chalk.green('exists') : chalk.yellow('not found');
  const skillCountStr = skillsDirExists && skillCount > 0
    ? chalk.dim(` (${skillCount} skill${skillCount === 1 ? '' : 's'})`)
    : '';
  console.log(`  Skills directory: ${skillsStatus}${skillCountStr}`);
}
```

#### 4. `outputClientsSummary()` (Extract lines 815-823)

**Purpose:** Display client detection summary

**Signature:**
```typescript
function outputClientsSummary(
  clientsDetected: number,
  clientsMissing: number,
  wsl2Detections: number,
): void
```

**Extracts:** Client statistics lines (lines 815-823)

**Projected complexity:** 2 (simple outputs with one conditional)

```typescript
function outputClientsSummary(clientsDetected, clientsMissing, wsl2Detections) {
  console.log(`  Clients detected: ${chalk.green(clientsDetected)} / ${ALL_CLIENTS.length}`);
  console.log(`  Clients missing:  ${chalk.red(clientsMissing)}`);
  
  if (wsl2Detections > 0) {
    console.log(`  WSL2 detections:  ${chalk.cyan(wsl2Detections)}`);
  }
}
```

#### 5. `outputConfigsSummary()` (Extract lines 825-828)

**Purpose:** Display configuration validity summary

**Signature:**
```typescript
function outputConfigsSummary(
  configsValid: number,
  configsInvalid: number,
): void
```

**Extracts:** Config validity statistics (lines 825-828)

**Projected complexity:** 1 (simple outputs with one conditional)

```typescript
function outputConfigsSummary(configsValid, configsInvalid) {
  console.log(`  Configs valid:    ${chalk.green(configsValid)}`);
  if (configsInvalid > 0) {
    console.log(`  Configs invalid:  ${chalk.yellow(configsInvalid)}`);
  }
}
```

#### 6. `outputMcpSummary()` (Extract lines 830-840)

**Purpose:** Display MCP server availability summary

**Signature:**
```typescript
function outputMcpSummary(
  totalMcpServers: number,
  mcpCommandsAvailable: number,
  mcpCommandsMissing: number,
): void
```

**Extracts:** MCP summary block (lines 830-840)

**Projected complexity:** 2 (outer if, then simple outputs)

```typescript
function outputMcpSummary(totalMcpServers, mcpCommandsAvailable, mcpCommandsMissing) {
  if (totalMcpServers === 0) return;
  
  console.log('');
  console.log(`  MCP commands available: ${chalk.green(mcpCommandsAvailable)} / ${totalMcpServers}`);
  if (mcpCommandsMissing > 0) {
    console.log(`  MCP commands missing:   ${chalk.yellow(mcpCommandsMissing)}`);
  }
}
```

---

### Simplified outputSummary Structure

**Before:** ~85 lines, complexity 30
**After:** ~20 lines, complexity ~3-4

```typescript
function outputSummary(
  configRepoExists: boolean,
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  skillsDirExists: boolean,
  skillCount: number,
  clientsDetected: number,
  clientsMissing: number,
  wsl2Detections: number,
  configsValid: number,
  configsInvalid: number,
  mcpCommandsAvailable: number,
  mcpCommandsMissing: number,
  totalMcpServers: number,
  output: OutputService,
): void {
  console.log('');
  output.info(chalk.bold('Summary:\n'));

  outputConfigRepoSummary(
    configRepoExists,
    isGitRepo,
    gitRemote,
    localHash,
    remoteHash,
    gitInSync,
    skillsDirExists,
    skillCount,
  );
  console.log('');

  outputClientsSummary(clientsDetected, clientsMissing, wsl2Detections);
  outputConfigsSummary(configsValid, configsInvalid);
  outputMcpSummary(totalMcpServers, mcpCommandsAvailable, mcpCommandsMissing);

  console.log('');
}
```

---

## Summary Table

| Function | Current Complexity | Target Complexity | Line Reduction | Helper Functions | Extract Points |
|----------|-------------------|------------------|-----------------|-----------------|-----------------|
| outputConfigRepoStatus | 35 | 4-5 | ~97 → ~10 | 4 | Lines 554-595, 565-583, 598-615, 617-622 |
| outputClientResults | 29 | 3-4 | ~81 → ~15 | 6 | Lines 655-688, 669-674, 677-681, 684-688, 689-700, 701-706 |
| outputSummary | 30 | 3-4 | ~85 → ~20 | 6 | Lines 783-812, 789-802, 804-811, 815-823, 825-828, 830-840 |
| **TOTALS** | **94** | **10-13** | **263 → 45** | **16** | - |

## Implementation Benefits

### Code Quality Improvements
- ✅ **Reduced Cyclomatic Complexity:** From 94 (total) → 10-13 (target)
- ✅ **Improved Readability:** Main functions become simple orchestrators
- ✅ **Better Testability:** Each helper function can be unit tested independently
- ✅ **Easier Maintenance:** Logic is compartmentalized by concern
- ✅ **Reusability:** Display helpers can be used elsewhere if needed

### Cognitive Complexity Reduction
- **outputConfigRepoStatus:** 4-5 levels of nesting → 1 level
- **outputClientResults:** 3-4 nested branches → switch statement
- **outputSummary:** Multiple interdependent sections → isolated helpers

### Testing Opportunities
- Unit test each display helper independently
- Mock output service to verify exact messages
- Test conditional branches without nested setup
- Easier to test error conditions

---

## Implementation Priority

### Phase 1 (Critical - Highest Impact)
1. Extract `outputGitRepoStatus()` and `outputGitSyncStatus()` from outputConfigRepoStatus
2. Extract `outputFoundClient()` and related methods from outputClientResults
3. Extract summary sections from outputSummary

### Phase 2 (Support)
4. Extract remaining helper functions
5. Add unit tests for each helper
6. Update command implementation to use new helpers

### Phase 3 (Optimization)
7. Consider consolidating similar output patterns (e.g., success/warning messages)
8. Create reusable "status display" utilities if patterns emerge

---

## Migration Notes

- All helper functions should remain in the same file (doctor.ts) for now
- Functions use the existing `output` service (OutputService)
- No breaking changes to external API
- Parameter lists remain explicit (no large parameter objects initially)
- Consider parameter object refactoring in Phase 2 if complexity allows

