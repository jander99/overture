# Doctor.ts Refactoring Quick Reference

## Problem Statement
Three output functions in `apps/cli/src/cli/commands/doctor.ts` have excessive cyclomatic complexity:
- `outputConfigRepoStatus` (line 529): **Complexity 35** ❌
- `outputClientResults` (line 630): **Complexity 29** ❌  
- `outputSummary` (line 759): **Complexity 30** ❌

**Total: 94** - All must be reduced below 15 ✅

---

## Solution Overview

Extract **16 helper functions** to isolate display logic and reduce nesting.

| Function | Helpers | Target | Status |
|----------|---------|--------|--------|
| outputConfigRepoStatus | 4 | 4-5 | ✅ Achievable |
| outputClientResults | 6 | 3-4 | ✅ Achievable |
| outputSummary | 6 | 3-4 | ✅ Achievable |

---

## Function 1: outputConfigRepoStatus (35 → 4-5)

### Extract These Helpers

```typescript
// 1. outputGitRepoStatus() - Lines 554-595
function outputGitRepoStatus(isGitRepo, gitRemote, localHash, remoteHash, gitInSync, output)

// 2. outputGitSyncStatus() - Lines 565-583  
function outputGitSyncStatus(localHash, remoteHash, gitInSync, output)

// 3. outputSkillsStatus() - Lines 598-615
function outputSkillsStatus(skillsDirExists, skillsPath, skillCount, output)

// 4. outputConfigRepoNotFound() - Lines 617-622
function outputConfigRepoNotFound(configRepoPath, output)
```

### Simplified Main Function
```typescript
function outputConfigRepoStatus(...) {
  output.info(chalk.bold('Checking config repository...\n'));
  
  if (configRepoExists) {
    output.success(`✓ Config repo - ${configRepoPath}`);
    outputGitRepoStatus(isGitRepo, gitRemote, localHash, remoteHash, gitInSync, output);
    outputSkillsStatus(skillsDirExists, skillsPath, skillCount, output);
  } else {
    outputConfigRepoNotFound(configRepoPath, output);
  }
  
  console.log('');
}
```

---

## Function 2: outputClientResults (29 → 3-4)

### Extract These Helpers

```typescript
// 1. outputFoundClient() - Lines 655-688
function outputFoundClient(client, output, verbose)

// 2. outputClientConfig() - Lines 669-674
function outputClientConfig(client, output)

// 3. outputWindowsPath() - Lines 677-681
function outputWindowsPath(client, output, verbose)

// 4. outputClientWarnings() - Lines 684-688
function outputClientWarnings(client, output, verbose)

// 5. outputMissingClient() - Lines 689-700
function outputMissingClient(client, output)

// 6. outputSkippedClient() - Lines 701-706
function outputSkippedClient(client)
```

### Simplified Main Function
```typescript
function outputClientResults(clients, output, verbose) {
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
    console.log('');
  }
}
```

---

## Function 3: outputSummary (30 → 3-4)

### Extract These Helpers

```typescript
// 1. outputConfigRepoSummary() - Lines 783-812
function outputConfigRepoSummary(configRepoExists, isGitRepo, gitRemote, localHash, remoteHash, gitInSync, skillsDirExists, skillCount)

// 2. outputGitSummary() - Lines 789-802
function outputGitSummary(isGitRepo, gitRemote, localHash, remoteHash, gitInSync)

// 3. outputSkillsSummary() - Lines 804-811
function outputSkillsSummary(skillsDirExists, skillCount)

// 4. outputClientsSummary() - Lines 815-823
function outputClientsSummary(clientsDetected, clientsMissing, wsl2Detections)

// 5. outputConfigsSummary() - Lines 825-828
function outputConfigsSummary(configsValid, configsInvalid)

// 6. outputMcpSummary() - Lines 830-840
function outputMcpSummary(totalMcpServers, mcpCommandsAvailable, mcpCommandsMissing)
```

### Simplified Main Function
```typescript
function outputSummary(...) {
  console.log('');
  output.info(chalk.bold('Summary:\n'));
  
  outputConfigRepoSummary(configRepoExists, isGitRepo, gitRemote, localHash, remoteHash, gitInSync, skillsDirExists, skillCount);
  console.log('');
  
  outputClientsSummary(clientsDetected, clientsMissing, wsl2Detections);
  outputConfigsSummary(configsValid, configsInvalid);
  outputMcpSummary(totalMcpServers, mcpCommandsAvailable, mcpCommandsMissing);
  
  console.log('');
}
```

---

## Implementation Checklist

### Phase 1: outputConfigRepoStatus
- [ ] Create outputGitRepoStatus()
- [ ] Create outputGitSyncStatus()
- [ ] Create outputSkillsStatus()
- [ ] Create outputConfigRepoNotFound()
- [ ] Update main function to call helpers
- [ ] Run tests: `nx test @overture/cli`

### Phase 2: outputClientResults
- [ ] Create outputFoundClient()
- [ ] Create outputClientConfig()
- [ ] Create outputWindowsPath()
- [ ] Create outputClientWarnings()
- [ ] Create outputMissingClient()
- [ ] Create outputSkippedClient()
- [ ] Refactor loop to switch statement
- [ ] Run tests: `nx test @overture/cli`

### Phase 3: outputSummary
- [ ] Create outputConfigRepoSummary()
- [ ] Create outputGitSummary()
- [ ] Create outputSkillsSummary()
- [ ] Create outputClientsSummary()
- [ ] Create outputConfigsSummary()
- [ ] Create outputMcpSummary()
- [ ] Update main function
- [ ] Run tests: `nx test @overture/cli`

### Validation
- [ ] All tests pass: `nx test @overture/cli`
- [ ] Coverage ≥ 83%: `nx test @overture/cli --coverage`
- [ ] Linting clean: `nx lint @overture/cli`
- [ ] Build succeeds: `nx build @overture/cli`

---

## Key Metrics

```
Before Refactoring:
  outputConfigRepoStatus: 97 lines, complexity 35, nesting 4-5
  outputClientResults:    81 lines, complexity 29, nesting 3-4
  outputSummary:          85 lines, complexity 30, nesting 4+
  Total:                  263 lines, complexity 94

After Refactoring:
  outputConfigRepoStatus: 10 lines, complexity 4-5, nesting 1
  outputClientResults:    15 lines, complexity 3-4, nesting 1
  outputSummary:          20 lines, complexity 3-4, nesting 1
  Total:                  45 lines, complexity 10-13, nesting 1

Improvements:
  ✅ 83% line reduction in main functions
  ✅ 89% complexity reduction
  ✅ 80% nesting level reduction
  ✅ All functions below target of 15
```

---

## Related Documents

- **COMPLEXITY_REDUCTION_ANALYSIS.md** - Detailed analysis and specifications
- **REFACTORING_CODE_EXAMPLES.md** - Complete before/after code examples
- **REFACTORING_CHECKLIST.md** - Step-by-step implementation guide
- **COMPLEXITY_SUMMARY.txt** - Executive summary with visual breakdown

---

## Branch & Commit

```bash
# Create feature branch
git checkout -b refactor/doctor-complexity-reduction

# After implementation
git add apps/cli/src/cli/commands/doctor.ts
git commit -m "refactor: extract helpers from doctor output functions to reduce complexity

- Extract 4 helpers from outputConfigRepoStatus (complexity 35 → 4-5)
- Extract 6 helpers from outputClientResults (complexity 29 → 3-4)
- Extract 6 helpers from outputSummary (complexity 30 → 3-4)

Total complexity reduction: 94 → 10-13
All tests pass, coverage maintained at 83%+"
```

