---
title: Doctor.ts Refactoring Implementation Checklist
created: 2025-12-29T18:45:00Z
last_modified: 2025-12-29T18:45:00Z
author: Claude
type: plan
tags: [refactoring, checklist, doctor-command, implementation]
---

# Doctor.ts Refactoring Checklist

## Phase 1: outputConfigRepoStatus Refactoring

### Extract outputGitRepoStatus()
- [ ] Create new function at lines 525-528 (before main function)
- [ ] Move lines 554-595 to new function
- [ ] Parameters: `isGitRepo, gitRemote, localHash, remoteHash, gitInSync, output`
- [ ] Update call in outputConfigRepoStatus: `outputGitRepoStatus(isGitRepo, gitRemote, localHash, remoteHash, gitInSync, output);`
- [ ] Run tests: `nx test @overture/cli --include apps/cli/src/cli/commands/doctor.spec.ts`

### Extract outputGitSyncStatus()
- [ ] Create new function before outputGitRepoStatus
- [ ] Move lines 565-583 to new function
- [ ] Parameters: `localHash, remoteHash, gitInSync, output`
- [ ] Update call in outputGitRepoStatus: `outputGitSyncStatus(localHash, remoteHash, gitInSync, output);`
- [ ] Run tests and verify complexity drop

### Extract outputSkillsStatus()
- [ ] Create new function before outputGitRepoStatus
- [ ] Move lines 598-615 to new function
- [ ] Parameters: `skillsDirExists, skillsPath, skillCount, output`
- [ ] Consider extracting skill count display as separate helper
- [ ] Update call in outputConfigRepoStatus
- [ ] Run tests

### Extract outputConfigRepoNotFound()
- [ ] Create new function before outputGitRepoStatus
- [ ] Move lines 617-622 to new function
- [ ] Parameters: `configRepoPath, output`
- [ ] Update call in outputConfigRepoStatus
- [ ] Run tests

### Verify outputConfigRepoStatus
- [ ] Main function now ~10 lines
- [ ] Complexity reduced from 35 to ~4-5
- [ ] All tests pass
- [ ] Run: `nx lint @overture/cli` for style checks

---

## Phase 2: outputClientResults Refactoring

### Extract outputFoundClient()
- [ ] Create new function before outputClientResults
- [ ] Move lines 655-688 to new function
- [ ] Parameters: `client, output, verbose`
- [ ] This calls sub-helpers for config, Windows path, warnings
- [ ] Update loop in outputClientResults
- [ ] Run tests

### Extract outputClientConfig()
- [ ] Create new function before outputFoundClient
- [ ] Move lines 669-674 to new function
- [ ] Parameters: `client, output`
- [ ] Early return if no configPath
- [ ] Call from outputFoundClient
- [ ] Run tests

### Extract outputClientWarnings()
- [ ] Create new function before outputFoundClient
- [ ] Move lines 684-688 to new function
- [ ] Parameters: `client, output, verbose`
- [ ] Early return if verbose false or no warnings
- [ ] Call from outputFoundClient
- [ ] Run tests

### Extract outputWindowsPath()
- [ ] Create new function before outputFoundClient
- [ ] Move lines 677-681 to new function
- [ ] Parameters: `client, output, verbose`
- [ ] Early return if verbose false or no windowsPath
- [ ] Call from outputFoundClient
- [ ] Run tests

### Extract outputMissingClient()
- [ ] Create new function before outputClientResults
- [ ] Move lines 689-700 to new function
- [ ] Parameters: `client, output`
- [ ] Call from outputClientResults switch statement
- [ ] Run tests

### Extract outputSkippedClient()
- [ ] Create new function before outputClientResults
- [ ] Move lines 701-706 to new function
- [ ] Parameters: `client` (doesn't need output)
- [ ] Call from outputClientResults switch statement
- [ ] Run tests

### Refactor outputClientResults Loop
- [ ] Replace if/else-if/else with switch statement
- [ ] Update loop structure to call helpers
- [ ] Verify blank line handling
- [ ] Run tests

### Verify outputClientResults
- [ ] Main function now ~15 lines
- [ ] Complexity reduced from 29 to ~3-4
- [ ] All tests pass
- [ ] Run: `nx lint @overture/cli` for style checks

---

## Phase 3: outputSummary Refactoring

### Extract outputConfigRepoSummary()
- [ ] Create new function before outputSummary
- [ ] Move lines 783-812 to new function
- [ ] Parameters: `configRepoExists, isGitRepo, gitRemote, localHash, remoteHash, gitInSync, skillsDirExists, skillCount`
- [ ] Calls outputGitSummary and outputSkillsSummary
- [ ] Update call in outputSummary
- [ ] Run tests

### Extract outputGitSummary()
- [ ] Create new function before outputConfigRepoSummary
- [ ] Move lines 789-802 to new function
- [ ] Parameters: `isGitRepo, gitRemote, localHash, remoteHash, gitInSync`
- [ ] Call from outputConfigRepoSummary
- [ ] Run tests

### Extract outputSkillsSummary()
- [ ] Create new function before outputConfigRepoSummary
- [ ] Move lines 804-811 to new function
- [ ] Parameters: `skillsDirExists, skillCount`
- [ ] Extract skill count formatting as separate helper
- [ ] Call from outputConfigRepoSummary
- [ ] Run tests

### Extract outputClientsSummary()
- [ ] Create new function before outputSummary
- [ ] Move lines 815-823 to new function
- [ ] Parameters: `clientsDetected, clientsMissing, wsl2Detections`
- [ ] Call from outputSummary
- [ ] Run tests

### Extract outputConfigsSummary()
- [ ] Create new function before outputSummary
- [ ] Move lines 825-828 to new function
- [ ] Parameters: `configsValid, configsInvalid`
- [ ] Call from outputSummary
- [ ] Run tests

### Extract outputMcpSummary()
- [ ] Create new function before outputSummary
- [ ] Move lines 830-840 to new function
- [ ] Parameters: `totalMcpServers, mcpCommandsAvailable, mcpCommandsMissing`
- [ ] Call from outputSummary
- [ ] Run tests

### Verify outputSummary
- [ ] Main function now ~20 lines
- [ ] Complexity reduced from 30 to ~3-4
- [ ] All tests pass
- [ ] Run: `nx lint @overture/cli` for style checks

---

## Testing & Validation

### Unit Tests
- [ ] Create test file: `apps/cli/src/cli/commands/doctor.helpers.spec.ts`
- [ ] Test outputGitRepoStatus with all git state combinations
- [ ] Test outputGitSyncStatus with sync/out-of-sync states
- [ ] Test outputSkillsStatus with/without skills
- [ ] Test outputClientConfig with valid/invalid configs
- [ ] Test outputClientWarnings with/without warnings
- [ ] Test outputMissingClient with/without recommendations
- [ ] Test outputMcpSummary with 0 MCP servers (edge case)
- [ ] Run: `nx test @overture/cli`

### Coverage Verification
- [ ] Ensure coverage remains >= 83%
- [ ] Run: `nx test @overture/cli --coverage`
- [ ] Check coverage report for doctor.ts

### Integration Tests
- [ ] Run e2e tests: `nx e2e cli-e2e`
- [ ] Verify doctor command still works end-to-end
- [ ] Test with various config states

### Linting & Formatting
- [ ] Run: `nx lint @overture/cli`
- [ ] Run: `npx prettier --write apps/cli/src/cli/commands/doctor.ts`
- [ ] Ensure no ESLint warnings introduced

### Build Verification
- [ ] Run: `nx build @overture/cli`
- [ ] Verify build succeeds
- [ ] Check for any TypeScript errors

---

## Code Review Checklist

### Before Commit
- [ ] All complexity metrics reduced as intended
- [ ] No new ESLint warnings
- [ ] All tests passing (384 total)
- [ ] Coverage maintained at 83%+
- [ ] No breaking changes to CLI interface
- [ ] Consistent code style with rest of codebase

### Git Commit Message
```
refactor: extract helpers from doctor output functions to reduce complexity

- Extract 4 helpers from outputConfigRepoStatus (complexity 35 → 4-5)
- Extract 6 helpers from outputClientResults (complexity 29 → 3-4)
- Extract 6 helpers from outputSummary (complexity 30 → 3-4)

Total complexity reduction: 94 → 10-13 lines of main functions
All tests pass, coverage maintained at 83%+

Fixes: [Issue number if applicable]
```

### Post-Merge
- [ ] Verify CI/CD pipeline passes
- [ ] Check that no regressions in related commands
- [ ] Document changes in CHANGELOG.md

---

## Complexity Target Summary

| Function | Before | After | Target |
|----------|--------|-------|--------|
| outputConfigRepoStatus | 35 | ~4-5 | ✅ Below 15 |
| outputClientResults | 29 | ~3-4 | ✅ Below 15 |
| outputSummary | 30 | ~3-4 | ✅ Below 15 |
| **Total** | **94** | **10-13** | ✅ All below 15 |

---

## Notes

- Keep all helpers in same file (doctor.ts) initially
- Consider moving to separate module in Phase 2 if patterns emerge
- All helpers use existing OutputService interface - no new dependencies
- Parameter count is explicit (not using parameter objects) to maintain clarity
- ESLint complexity rules should be satisfied after refactoring
- Maintain backward compatibility with createDoctorCommand export

