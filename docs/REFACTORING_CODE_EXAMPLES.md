---
title: Doctor.ts Refactoring - Code Examples
created: 2025-12-29T18:45:00Z
last_modified: 2025-12-29T18:45:00Z
author: Claude
type: documentation
tags: [refactoring, code-examples, doctor-command]
---

# Doctor.ts Refactoring - Code Examples

This document provides concrete code examples showing the before and after for each refactoring.

---

## Function 1: outputConfigRepoStatus

### Before (Complexity 35, 97 lines)

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
  output: {
    success(message: string): void;
    warn(message: string): void;
    info(message: string): void;
  },
): void {
  output.info(chalk.bold('Checking config repository...\n'));

  if (configRepoExists) {
    output.success(
      `${chalk.green('✓')} Config repo - ${chalk.dim(configRepoPath)}`,
    );

    // ❌ PROBLEM: 4-5 levels of nesting in git section
    if (isGitRepo) {
      const hashShort = localHash ? localHash.substring(0, 7) : 'unknown';
      output.success(
        `  ${chalk.green('✓')} Git repository - ${chalk.dim('initialized')} ${chalk.dim(`(${hashShort})`)}`,
      );
      if (gitRemote) {
        output.success(
          `    ${chalk.green('✓')} Remote configured - ${chalk.dim(gitRemote)}`,
        );

        // ❌ DEEPEST NESTING: 5 levels deep here
        if (localHash && remoteHash) {
          if (gitInSync) {
            output.success(
              `      ${chalk.green('✓')} In sync with remote ${chalk.dim(`(${remoteHash.substring(0, 7)})`)}`,
            );
          } else {
            output.warn(
              `      ${chalk.yellow('⚠')} Out of sync with remote ${chalk.dim(`(${remoteHash.substring(0, 7)})`)}`,
            );
            console.log(
              `        ${chalk.dim('→')} ${chalk.dim('Run: git pull or git push')}`,
            );
          }
        } else if (localHash && !remoteHash) {
          output.warn(`      ${chalk.yellow('⚠')} Remote HEAD not available`);
          console.log(
            `        ${chalk.dim('→')} ${chalk.dim('Run: git push -u origin main')}`,
          );
        }
      } else {
        output.warn(`    ${chalk.yellow('⚠')} No git remote configured`);
        console.log(
          `      ${chalk.dim('→')} ${chalk.dim('Run: git remote add origin <url>')}`,
        );
      }
    } else {
      output.warn(`  ${chalk.yellow('⚠')} Not a git repository`);
      console.log(
        `    ${chalk.dim('→')} ${chalk.dim('Run: cd ' + configRepoPath + ' && git init')}`,
      );
    }

    // ❌ PROBLEM: Separate complex ternary for skills
    if (skillsDirExists) {
      const skillCountStr =
        skillCount === 0
          ? chalk.yellow('no skills')
          : skillCount === 1
            ? chalk.green('1 skill')
            : chalk.green(`${skillCount} skills`);
      output.success(
        `  ${chalk.green('✓')} Skills directory - ${chalk.dim(skillsPath)} ${chalk.dim(`(${skillCountStr})`)}`,
      );
    } else {
      output.warn(
        `  ${chalk.yellow('⚠')} Skills directory not found - ${chalk.dim(skillsPath)}`,
      );
      console.log(
        `    ${chalk.dim('→')} ${chalk.dim('Run: mkdir -p ' + skillsPath)}`,
      );
    }
  } else {
    output.warn(
      `${chalk.yellow('⚠')} Config repo not found - ${chalk.dim(configRepoPath)}`,
    );
    console.log(
      `  ${chalk.dim('→')} ${chalk.dim('Run: overture init to create config repo')}`,
    );
  }
  console.log('');
}
```

### After (Complexity 4-5, ~10 lines)

```typescript
// Helper 1: Display git repository status (4-6 levels of nesting extracted)
function outputGitRepoStatus(
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  output: OutputService,
): void {
  if (isGitRepo) {
    const hashShort = localHash ? localHash.substring(0, 7) : 'unknown';
    output.success(
      `  ${chalk.green('✓')} Git repository - ${chalk.dim('initialized')} ${chalk.dim(`(${hashShort})`)}`,
    );
    if (gitRemote) {
      output.success(
        `    ${chalk.green('✓')} Remote configured - ${chalk.dim(gitRemote)}`,
      );
      outputGitSyncStatus(localHash, remoteHash, gitInSync, output);
    } else {
      output.warn(`    ${chalk.yellow('⚠')} No git remote configured`);
      console.log(
        `      ${chalk.dim('→')} ${chalk.dim('Run: git remote add origin <url>')}`,
      );
    }
  } else {
    output.warn(`  ${chalk.yellow('⚠')} Not a git repository`);
    console.log(
      `    ${chalk.dim('→')} ${chalk.dim('Run: cd ' + configRepoPath + ' && git init')}`,
    );
  }
}

// Helper 2: Display git sync status (extracted innermost nesting)
function outputGitSyncStatus(
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  output: OutputService,
): void {
  if (localHash && remoteHash) {
    if (gitInSync) {
      output.success(
        `      ${chalk.green('✓')} In sync with remote ${chalk.dim(`(${remoteHash.substring(0, 7)})`)}`,
      );
    } else {
      output.warn(
        `      ${chalk.yellow('⚠')} Out of sync with remote ${chalk.dim(`(${remoteHash.substring(0, 7)})`)}`,
      );
      console.log(
        `        ${chalk.dim('→')} ${chalk.dim('Run: git pull or git push')}`,
      );
    }
  } else if (localHash && !remoteHash) {
    output.warn(`      ${chalk.yellow('⚠')} Remote HEAD not available`);
    console.log(
      `        ${chalk.dim('→')} ${chalk.dim('Run: git push -u origin main')}`,
    );
  }
}

// Helper 3: Display skills directory status
function outputSkillsStatus(
  skillsDirExists: boolean,
  skillsPath: string,
  skillCount: number,
  output: OutputService,
): void {
  if (skillsDirExists) {
    const skillCountStr =
      skillCount === 0
        ? chalk.yellow('no skills')
        : skillCount === 1
          ? chalk.green('1 skill')
          : chalk.green(`${skillCount} skills`);
    output.success(
      `  ${chalk.green('✓')} Skills directory - ${chalk.dim(skillsPath)} ${chalk.dim(`(${skillCountStr})`)}`,
    );
  } else {
    output.warn(
      `  ${chalk.yellow('⚠')} Skills directory not found - ${chalk.dim(skillsPath)}`,
    );
    console.log(
      `    ${chalk.dim('→')} ${chalk.dim('Run: mkdir -p ' + skillsPath)}`,
    );
  }
}

// Helper 4: Display when config repo not found
function outputConfigRepoNotFound(
  configRepoPath: string,
  output: OutputService,
): void {
  output.warn(
    `${chalk.yellow('⚠')} Config repo not found - ${chalk.dim(configRepoPath)}`,
  );
  console.log(
    `  ${chalk.dim('→')} ${chalk.dim('Run: overture init to create config repo')}`,
  );
}

// ✅ REFACTORED: Clear, simple orchestrator function
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
    output.success(
      `${chalk.green('✓')} Config repo - ${chalk.dim(configRepoPath)}`,
    );
    outputGitRepoStatus(isGitRepo, gitRemote, localHash, remoteHash, gitInSync, output);
    outputSkillsStatus(skillsDirExists, skillsPath, skillCount, output);
  } else {
    outputConfigRepoNotFound(configRepoPath, output);
  }

  console.log('');
}
```

---

## Function 2: outputClientResults

### Before (Complexity 29, 81 lines)

```typescript
function outputClientResults(
  clients: Array<{
    client: string;
    status: string;
    binaryPath?: string;
    appBundlePath?: string;
    version?: string;
    configPath?: string;
    configValid: boolean;
    warnings?: string[];
    source?: string;
    environment?: string;
    windowsPath?: string;
  }>,
  output: {
    success(message: string): void;
    error(message: string): void;
    warn(message: string): void;
    info(message: string): void;
  },
  verbose: boolean,
): void {
  output.info(chalk.bold('Checking client installations...\n'));

  for (const client of clients) {
    // ❌ PROBLEM: if/else-if/else with 3 branches, each with nested logic
    if (client.status === 'found') {
      const versionStr = client.version
        ? chalk.dim(` (${client.version})`)
        : '';
      const pathStr = client.binaryPath || client.appBundlePath;

      const wsl2Tag =
        client.source === 'wsl2-fallback' ? chalk.cyan(' [WSL2: Windows]') : '';

      output.success(
        `${chalk.green('✓')} ${chalk.bold(client.client)}${versionStr}${wsl2Tag} - ${chalk.dim(pathStr)}`,
      );

      // ❌ Nested conditional 1: config path
      if (client.configPath) {
        const configStatus = client.configValid
          ? chalk.green('valid')
          : chalk.yellow('invalid');
        console.log(`  Config: ${client.configPath} (${configStatus})`);
      }

      // ❌ Nested conditional 2: Windows path
      if (client.windowsPath && verbose) {
        console.log(
          `  ${chalk.dim('Windows path:')} ${chalk.dim(client.windowsPath)}`,
        );
      }

      // ❌ Nested conditional 3: warnings
      if ((client.warnings || []).length > 0 && verbose) {
        (client.warnings || []).forEach((warning) => {
          output.warn(`  ${chalk.yellow('⚠')} ${warning}`);
        });
      }
    } else if (client.status === 'not-found') {
      output.error(
        `${chalk.red('✗')} ${chalk.bold(client.client)} - not installed`,
      );

      // ❌ Nested conditional: recommendation
      const recommendation = getInstallRecommendation(
        client.client as ClientName,
      );
      if (recommendation) {
        console.log(`  ${chalk.dim('→')} ${chalk.dim(recommendation)}`);
      }
    } else {
      // Skipped
      console.log(
        `${chalk.gray('○')} ${chalk.bold(client.client)} - ${chalk.dim('skipped')}`,
      );
    }

    console.log(''); // Blank line
  }
}
```

### After (Complexity 3-4, ~15 lines)

```typescript
// Helper 1: Output found client with all details
function outputFoundClient(
  client: ClientInfo,
  output: OutputService,
  verbose: boolean,
): void {
  const versionStr = client.version ? chalk.dim(` (${client.version})`) : '';
  const pathStr = client.binaryPath || client.appBundlePath;
  const wsl2Tag =
    client.source === 'wsl2-fallback' ? chalk.cyan(' [WSL2: Windows]') : '';

  output.success(
    `${chalk.green('✓')} ${chalk.bold(client.client)}${versionStr}${wsl2Tag} - ${chalk.dim(pathStr)}`,
  );

  outputClientConfig(client, output);
  outputWindowsPath(client, output, verbose);
  outputClientWarnings(client, output, verbose);
}

// Helper 2: Output client config status
function outputClientConfig(client: ClientInfo, output: OutputService): void {
  if (!client.configPath) return;

  const configStatus = client.configValid
    ? chalk.green('valid')
    : chalk.yellow('invalid');
  console.log(`  Config: ${client.configPath} (${configStatus})`);
}

// Helper 3: Output Windows path if applicable
function outputWindowsPath(
  client: ClientInfo,
  output: OutputService,
  verbose: boolean,
): void {
  if (!verbose || !client.windowsPath) return;

  console.log(
    `  ${chalk.dim('Windows path:')} ${chalk.dim(client.windowsPath)}`,
  );
}

// Helper 4: Output client warnings
function outputClientWarnings(
  client: ClientInfo,
  output: OutputService,
  verbose: boolean,
): void {
  if (!verbose || !client.warnings || client.warnings.length === 0) return;

  client.warnings.forEach((warning) => {
    output.warn(`  ${chalk.yellow('⚠')} ${warning}`);
  });
}

// Helper 5: Output missing client with recommendation
function outputMissingClient(client: ClientInfo, output: OutputService): void {
  output.error(
    `${chalk.red('✗')} ${chalk.bold(client.client)} - not installed`,
  );

  const recommendation = getInstallRecommendation(
    client.client as ClientName,
  );
  if (recommendation) {
    console.log(`  ${chalk.dim('→')} ${chalk.dim(recommendation)}`);
  }
}

// Helper 6: Output skipped client
function outputSkippedClient(client: ClientInfo): void {
  console.log(
    `${chalk.gray('○')} ${chalk.bold(client.client)} - ${chalk.dim('skipped')}`,
  );
}

// ✅ REFACTORED: Clean loop with switch statement
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

## Function 3: outputSummary

### Before (Complexity 30, 85 lines)

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
  output: {
    info(message: string): void;
  },
): void {
  console.log('');
  output.info(chalk.bold('Summary:\n'));

  // ❌ PROBLEM: Complex config repo section with 4 levels of nesting
  const configRepoStatus = configRepoExists
    ? chalk.green('exists')
    : chalk.yellow('not found');
  console.log(`  Config repo:      ${configRepoStatus}`);
  if (configRepoExists) {
    const gitRepoStatus = isGitRepo ? chalk.green('yes') : chalk.yellow('no');
    console.log(`  Git repository:   ${gitRepoStatus}`);
    if (isGitRepo) {
      const remoteStatus = gitRemote
        ? chalk.green('configured')
        : chalk.yellow('not configured');
      console.log(`  Git remote:       ${remoteStatus}`);

      if (gitRemote && localHash && remoteHash) {
        const syncStatus = gitInSync
          ? chalk.green('in sync')
          : chalk.yellow('out of sync');
        console.log(`  Git sync:         ${syncStatus}`);
      }
    }
    const skillsStatus = skillsDirExists
      ? chalk.green('exists')
      : chalk.yellow('not found');
    const skillCountStr =
      skillsDirExists && skillCount > 0
        ? chalk.dim(` (${skillCount} skill${skillCount === 1 ? '' : 's'})`)
        : '';
    console.log(`  Skills directory: ${skillsStatus}${skillCountStr}`);
  }
  console.log('');

  // ❌ Multiple independent sections mixed together
  console.log(
    `  Clients detected: ${chalk.green(clientsDetected)} / ${ALL_CLIENTS.length}`,
  );
  console.log(`  Clients missing:  ${chalk.red(clientsMissing)}`);

  if (wsl2Detections > 0) {
    console.log(`  WSL2 detections:  ${chalk.cyan(wsl2Detections)}`);
  }

  console.log(`  Configs valid:    ${chalk.green(configsValid)}`);
  if (configsInvalid > 0) {
    console.log(`  Configs invalid:  ${chalk.yellow(configsInvalid)}`);
  }

  if (totalMcpServers > 0) {
    console.log('');
    console.log(
      `  MCP commands available: ${chalk.green(mcpCommandsAvailable)} / ${totalMcpServers}`,
    );
    if (mcpCommandsMissing > 0) {
      console.log(
        `  MCP commands missing:   ${chalk.yellow(mcpCommandsMissing)}`,
      );
    }
  }

  console.log('');
}
```

### After (Complexity 3-4, ~20 lines)

```typescript
// Helper 1: Output config repo summary
function outputConfigRepoSummary(
  configRepoExists: boolean,
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
  skillsDirExists: boolean,
  skillCount: number,
): void {
  const configRepoStatus = configRepoExists
    ? chalk.green('exists')
    : chalk.yellow('not found');
  console.log(`  Config repo:      ${configRepoStatus}`);

  if (configRepoExists) {
    outputGitSummary(isGitRepo, gitRemote, localHash, remoteHash, gitInSync);
    outputSkillsSummary(skillsDirExists, skillCount);
  }
}

// Helper 2: Output git summary
function outputGitSummary(
  isGitRepo: boolean,
  gitRemote: string | null,
  localHash: string | null,
  remoteHash: string | null,
  gitInSync: boolean,
): void {
  const gitRepoStatus = isGitRepo ? chalk.green('yes') : chalk.yellow('no');
  console.log(`  Git repository:   ${gitRepoStatus}`);

  if (isGitRepo) {
    const remoteStatus = gitRemote
      ? chalk.green('configured')
      : chalk.yellow('not configured');
    console.log(`  Git remote:       ${remoteStatus}`);

    if (gitRemote && localHash && remoteHash) {
      const syncStatus = gitInSync
        ? chalk.green('in sync')
        : chalk.yellow('out of sync');
      console.log(`  Git sync:         ${syncStatus}`);
    }
  }
}

// Helper 3: Output skills summary
function outputSkillsSummary(
  skillsDirExists: boolean,
  skillCount: number,
): void {
  const skillsStatus = skillsDirExists
    ? chalk.green('exists')
    : chalk.yellow('not found');
  const skillCountStr =
    skillsDirExists && skillCount > 0
      ? chalk.dim(` (${skillCount} skill${skillCount === 1 ? '' : 's'})`)
      : '';
  console.log(`  Skills directory: ${skillsStatus}${skillCountStr}`);
}

// Helper 4: Output clients summary
function outputClientsSummary(
  clientsDetected: number,
  clientsMissing: number,
  wsl2Detections: number,
): void {
  console.log(
    `  Clients detected: ${chalk.green(clientsDetected)} / ${ALL_CLIENTS.length}`,
  );
  console.log(`  Clients missing:  ${chalk.red(clientsMissing)}`);

  if (wsl2Detections > 0) {
    console.log(`  WSL2 detections:  ${chalk.cyan(wsl2Detections)}`);
  }
}

// Helper 5: Output configs summary
function outputConfigsSummary(configsValid: number, configsInvalid: number): void {
  console.log(`  Configs valid:    ${chalk.green(configsValid)}`);
  if (configsInvalid > 0) {
    console.log(`  Configs invalid:  ${chalk.yellow(configsInvalid)}`);
  }
}

// Helper 6: Output MCP summary
function outputMcpSummary(
  totalMcpServers: number,
  mcpCommandsAvailable: number,
  mcpCommandsMissing: number,
): void {
  if (totalMcpServers === 0) return;

  console.log('');
  console.log(
    `  MCP commands available: ${chalk.green(mcpCommandsAvailable)} / ${totalMcpServers}`,
  );
  if (mcpCommandsMissing > 0) {
    console.log(
      `  MCP commands missing:   ${chalk.yellow(mcpCommandsMissing)}`,
    );
  }
}

// ✅ REFACTORED: Clean orchestrator with isolated sections
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

## Key Improvements Visible in Code

### Nesting Reduction
- **Before:** 4-5 levels of nested if statements
- **After:** Maximum 1-2 levels, functions with single responsibility

### Readability
- **Before:** Scroll through 80-100 lines to understand one function
- **After:** 10-20 lines per main function, clear flow

### Testability
- **Before:** Must test entire function with multiple setup scenarios
- **After:** Each helper can be tested independently with simple mocks

### Maintainability
- **Before:** Changing one conditional affects entire block structure
- **After:** Changes isolated to specific helper functions

### Reusability
- **Before:** Cannot reuse status display logic
- **After:** Each helper can be used in other commands/features

---

## Testing the Refactored Code

### Before (Hard to Test)
```typescript
// Need to test all combinations:
// configRepoExists + isGitRepo + gitRemote + localHash + remoteHash + gitInSync + ...
// = 2^8 = 256+ combinations possible!
```

### After (Easy to Test)
```typescript
// Test each helper independently:
describe('outputGitSyncStatus', () => {
  test('shows in sync message', () => {
    outputGitSyncStatus(
      'abc1234', // localHash
      'abc1234', // remoteHash
      true,      // gitInSync
      mockOutput,
    );
    expect(mockOutput.success).toHaveBeenCalledWith(
      expect.stringContaining('In sync'),
    );
  });

  test('shows out of sync message', () => {
    outputGitSyncStatus(
      'abc1234',
      'def5678',
      false,
      mockOutput,
    );
    expect(mockOutput.warn).toHaveBeenCalledWith(
      expect.stringContaining('Out of sync'),
    );
  });
});
```

---

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Main Function Lines** | 97-85 | 10-20 |
| **Cyclomatic Complexity** | 35-30 | 4-5, 3-4, 3-4 |
| **Max Nesting Level** | 4-5 | 1-2 |
| **Helper Functions** | 0 | 16 |
| **Test Cases Possible** | Complex | Straightforward |
| **Code Duplication Risk** | Medium | Low |
| **Maintainability** | Hard | Easy |

