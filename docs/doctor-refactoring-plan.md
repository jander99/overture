# Doctor.ts Refactoring Plan

**Project:** Overture MCP Configuration Orchestrator  
**Version:** 0.3.0  
**Date:** December 31, 2025  
**Author:** AI Agent (Sequential Thinking)

---

## Executive Summary

This document outlines a comprehensive refactoring of the `doctor.ts` file (1,727 lines) into modular, testable components following Nx best practices and hexagonal architecture principles.

### Goals

- ✅ Extract shared diagnostic logic into reusable libraries
- ✅ Create testable modules with 80%+ code coverage
- ✅ Follow Nx organization philosophy (domain/core/shared separation)
- ✅ Use OutputPort abstraction for TUI-ready architecture
- ✅ Ensure diagnostics never fail (always return results)
- ✅ Maintain sequential execution (no parallelization)
- ✅ Deliver in single comprehensive PR
- ✅ Improve TypeScript type safety

### Key Metrics

- **Current:** 1,727 lines in single file, ~40 functions
- **Target:** ~100 lines in doctor.ts, 1,670+ lines in libraries
- **Reduction:** 94% reduction in command file size
- **New Libraries:** 1 new (diagnostics-types), 2 modified (diagnostics, formatters)
- **Test Coverage:** 80%+ on all new code
- **Estimated Effort (Sequential):** 47.5 hours (~6 days)
- **Estimated Effort (Parallel):** 19 hours (~2.5 days) - **60% reduction**

---

## Parallel Execution Strategy

### Overview

This refactoring can be **highly parallelized** to reduce total execution time from **47.5 hours to 19 hours** (60% reduction). The key insight is that after Phase 1 (type definitions), most checkers and formatters are completely independent and can be built simultaneously.

### Dependency Graph

```
Phase 1: Type Definitions (1.5h)
         ↓
    ┌────┴────┬────────┬────────┬────────┬────────┐
    ↓         ↓        ↓        ↓        ↓        ↓
  WS-A1     WS-A2    WS-A3    WS-B1    WS-B2    WS-B3
  (6h)      (5h)     (6.5h)   (5h)     (4h)     (4.5h)
    └────┬────┴────────┴────────┴────────┴────────┘
         ↓
   Integration (0.5h)
         ↓
   Phase 4: Orchestrator (5h)
         ↓
   Phase 5: Simplify doctor.ts (3.5h)
         ↓
   E2E Tests (2h)
```

**Critical Path:** 1.5h + 6.5h + 0.5h + 5h + 3.5h + 2h = **19 hours**

### Workstream Definitions

#### Foundation (Sequential)

**Phase 1: Type Definitions** (1.5 hours)

- Create diagnostics-types library
- Define all interfaces
- Export types
- Unit tests

**Blocks:** All workstreams depend on this completing first.

---

#### Workstream A1: Core Checkers - Config & Skills

**Duration:** 6 hours  
**Dependencies:** Phase 1 complete  
**Tasks:**

- Task 2.1: ConfigRepoChecker class (2h)
- Task 2.2: SkillsChecker class (1h)
- Task 6.1: ConfigRepoChecker tests (2h)
- Task 6.2: SkillsChecker tests (1h)

---

#### Workstream A2: Core Checkers - Agents

**Duration:** 5 hours  
**Dependencies:** Phase 1 complete  
**Tasks:**

- Task 2.3: AgentsChecker class (2h)
- Task 6.3: AgentsChecker tests (3h)

---

#### Workstream A3: Core Checkers - Clients & MCP

**Duration:** 6.5 hours  
**Dependencies:** Phase 1 complete  
**Tasks:**

- Task 2.4: ClientsChecker class (2h)
- Task 2.5: McpChecker class (1h)
- Task 6.4: ClientsChecker tests (2h)
- Task 6.5: McpChecker tests (1.5h)

---

#### Workstream B1: Formatters - Environment & ConfigRepo

**Duration:** 5 hours  
**Dependencies:** Phase 1 complete  
**Tasks:**

- Task 3.1: EnvironmentFormatter class (1h)
- Task 3.2: ConfigRepoFormatter class (3h)
- Corresponding tests from Task 6.6 (1h)

---

#### Workstream B2: Formatters - Clients & MCP

**Duration:** 4 hours  
**Dependencies:** Phase 1 complete  
**Tasks:**

- Task 3.3: ClientsFormatter class (2h)
- Task 3.4: McpFormatter class (1h)
- Corresponding tests from Task 6.6 (1h)

---

#### Workstream B3: Formatters - Summary & Helpers

**Duration:** 4.5 hours  
**Dependencies:** Phase 1 complete  
**Tasks:**

- Task 3.5: SummaryFormatter class (3h)
- Task 3.6: RecommendationsHelper utility (0.5h)
- Corresponding tests from Task 6.6 (1h)

---

#### Integration Checkpoint (Sequential)

**Duration:** 0.5 hours  
**Dependencies:** All workstreams A1-A3, B1-B3 complete  
**Tasks:**

- Task 2.6: Export all checkers (5 min)
- Task 2.7: Update diagnostics dependencies (10 min)
- Task 3.7: Export all formatters (5 min)
- Task 3.8: Update formatters dependencies (10 min)

---

#### Final Integration (Sequential)

**Phase 4: Orchestrator** (5 hours)

- Task 4.1: DiagnosticsOrchestrator class (4h)
- Task 4.2: Factory function (1h)
- Task 4.3: Update diagnostics exports (5 min)
- Task 6.7: Orchestrator integration tests (included)

**Phase 5: Simplify doctor.ts** (3.5 hours)

- Task 5.1: Remove extracted code (30 min)
- Task 5.2: Refactor createDoctorCommand (2h)
- Task 5.3: Update composition-root.ts (1h)
- Task 5.4: Update CLI dependencies (10 min)

**E2E Tests** (2 hours)

- Task 6.8: End-to-end tests (2h)

---

### Execution Models

#### Model 1: Single Developer (Sequential)

**Timeline:** 47.5 hours (~6 days)

- Execute phases in order 1 → 2 → 3 → 4 → 5 → 6

#### Model 2: Three Parallel Workstreams

**Timeline:** ~32.5 hours (~4 days)

- Workstream A: All checkers + tests (17.5h)
- Workstream B: All formatters + tests (14h)
- Workstream C: Types → wait → Orchestrator → Integration (13.5h)

#### Model 3: Six Parallel Workstreams (Optimal)

**Timeline:** 19 hours (~2.5 days)

- Phase 1: Foundation (1.5h) - single worker
- Parallel work: WS-A1, A2, A3, B1, B2, B3 (max 6.5h) - 6 workers
- Integration checkpoint (0.5h) - single worker
- Phase 4: Orchestrator (5h) - single worker
- Phase 5: doctor.ts (3.5h) - single worker
- E2E tests (2h) - single worker

---

### Coordination & Synchronization

#### Sync Point 1: After Phase 1

**Trigger:** Type definitions library complete and published  
**Action:** All 6 workstreams (A1, A2, A3, B1, B2, B3) can start  
**Verification:**

```bash
nx build @overture/diagnostics-types
nx test @overture/diagnostics-types
```

#### Sync Point 2: After All Workstreams

**Trigger:** All checkers and formatters complete  
**Action:** Integration checkpoint - wire up exports and dependencies  
**Verification:**

```bash
nx build @overture/diagnostics-core
nx build @overture/formatters
nx test @overture/diagnostics-core
nx test @overture/formatters
```

#### Sync Point 3: After Integration Checkpoint

**Trigger:** All libraries building and exporting correctly  
**Action:** Begin orchestrator development (Phase 4)  
**Verification:**

```bash
nx run-many -t build --projects=@overture/diagnostics-core,@overture/formatters,@overture/diagnostics-types
```

---

### Workstream Communication

#### Shared Interfaces (Read-Only)

All workstreams depend on types from Phase 1. These are **read-only** - no workstream modifies them.

#### No Cross-Dependencies

- Checkers don't depend on other checkers
- Formatters don't depend on other formatters
- Checkers and formatters are independent

#### File Conflicts

**Risk:** Low - each workstream works in separate files  
**Mitigation:** Each workstream has distinct file paths:

- A1: `config-repo-checker.ts`, `skills-checker.ts`
- A2: `agents-checker.ts`
- A3: `clients-checker.ts`, `mcp-checker.ts`
- B1: `environment-formatter.ts`, `config-repo-formatter.ts`
- B2: `clients-formatter.ts`, `mcp-formatter.ts`
- B3: `summary-formatter.ts`, `recommendations.ts`

---

### Recommended Approach for AI Agents

If using multiple AI agents or automated workers:

1. **Execute Phase 1** with a single agent (1.5h)
2. **Launch 6 parallel agents** for workstreams A1-A3, B1-B3 (6.5h)
3. **Single agent** performs integration checkpoint (0.5h)
4. **Single agent** builds orchestrator (5h)
5. **Single agent** simplifies doctor.ts (3.5h)
6. **Single agent** writes E2E tests (2h)

**Total elapsed time:** 19 hours (60% faster than sequential)

---

## Architecture Overview

### Current State

```
apps/cli/src/cli/commands/doctor.ts (1,727 lines)
├── Type helpers (getCurrentPlatform, validateConfigFile)
├── Config repo functions (checkConfigRepository)
├── Git functions (checkGitRepository, getGitRemote, etc.)
├── Skills functions (countSkills)
├── Agents functions (checkAgents, validateAgents)
├── Clients functions (checkClients)
├── MCP functions (checkMcpServers)
├── Output functions (40+ output formatters)
└── createDoctorCommand (main entry)
```

### Target State

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLI Layer (apps/cli)                       │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │             doctor.ts (Command Handler)                    │ │
│  │  - Receives CLI options                                    │ │
│  │  - Calls DiagnosticsOrchestrator                          │ │
│  │  - Calls formatters for output                            │ │
│  │  - Returns exit code                                      │ │
│  │  (~100 lines)                                             │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│             Composition Root (composition-root.ts)              │
│  - Wires up DiagnosticsOrchestrator                            │
│  - Wires up all Checkers                                       │
│  - Wires up all Formatters                                     │
│  - Provides dependency injection                               │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌──────────────────────┐            ┌──────────────────────┐
│  Core Diagnostics    │            │  Shared Formatters   │
│  (@overture/         │            │  (@overture/         │
│   diagnostics-core)  │            │   formatters)        │
│                      │            │                      │
│  ┌────────────────┐  │            │  ┌────────────────┐  │
│  │ Orchestrator   │  │            │  │ Environment    │  │
│  │ - runDiag...   │  │            │  │ Formatter      │  │
│  └────────────────┘  │            │  └────────────────┘  │
│         │            │            │  ┌────────────────┐  │
│  ┌──────┴─────┐      │            │  │ ConfigRepo     │  │
│  ▼            ▼      │            │  │ Formatter      │  │
│  Checkers:          │            │  └────────────────┘  │
│  - ConfigRepo       │            │  ┌────────────────┐  │
│  - Skills           │            │  │ Clients        │  │
│  - Agents           │            │  │ Formatter      │  │
│  - Clients          │            │  └────────────────┘  │
│  - MCP              │            │  ┌────────────────┐  │
│                     │            │  │ MCP            │  │
│  (~700 lines)       │            │  │ Formatter      │  │
│                     │            │  └────────────────┘  │
│                     │            │  ┌────────────────┐  │
│                     │            │  │ Summary        │  │
│                     │            │  │ Formatter      │  │
│                     │            │  └────────────────┘  │
│                     │            │                      │
│                     │            │  (~820 lines)        │
└──────────────────────┘            └──────────────────────┘
        │                                       │
        └───────────────────┬───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               Domain Types (@overture/diagnostics-types)        │
│  - DiagnosticsResult                                            │
│  - ConfigRepoCheckResult, GitCheckResult                       │
│  - SkillsCheckResult, AgentsCheckResult                        │
│  - ClientsCheckResult, McpCheckResult                          │
│  - DiagnosticsSummary                                          │
│  (~150 lines)                                                   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Infrastructure Ports                         │
│  - FilesystemPort, ProcessPort, EnvironmentPort                │
│  - OutputPort                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Task List

### Phase 1: Type Definitions Library (1.5 hours)

#### ☐ Task 1.1: Create diagnostics-types library (15 min)

**Command:**

```bash
nx g @nx/js:library diagnostics-types \
  --directory=libs/domain \
  --importPath=@overture/diagnostics-types \
  --unitTestRunner=vitest \
  --bundler=tsc \
  --strict
```

**Output:** `libs/domain/diagnostics-types/`

---

#### ☐ Task 1.2: Define all type interfaces (30 min)

**File:** `libs/domain/diagnostics-types/src/lib/diagnostics.types.ts`

**Code:**

```typescript
/**
 * @overture/diagnostics-types
 *
 * Type definitions for diagnostic checks and results.
 * Zero runtime dependencies - types only.
 */

import type {
  Platform,
  ClientName,
  OvertureConfig,
} from '@overture/config-types';

/**
 * Environment check result (platform, WSL2 detection)
 */
export interface EnvironmentCheckResult {
  platform: Platform;
  isWSL2: boolean;
  wsl2Info?: {
    distroName?: string;
    windowsUserProfile?: string;
  };
}

/**
 * Config repository check result
 */
export interface ConfigRepoCheckResult {
  configRepoPath: string;
  skillsPath: string;
  configRepoExists: boolean;
  skillsDirExists: boolean;
}

/**
 * Git repository check result
 */
export interface GitCheckResult {
  isGitRepo: boolean;
  gitRemote: string | null;
  localHash: string | null;
  remoteHash: string | null;
  gitInSync: boolean;
}

/**
 * Skills directory check result
 */
export interface SkillsCheckResult {
  skillsPath: string;
  skillsDirExists: boolean;
  skillCount: number;
}

/**
 * Agents directory check result
 */
export interface AgentsCheckResult {
  globalAgentsPath: string;
  globalAgentsDirExists: boolean;
  globalAgentCount: number;
  globalAgentErrors: string[];
  projectAgentsPath: string | null;
  projectAgentsDirExists: boolean;
  projectAgentCount: number;
  projectAgentErrors: string[];
  modelsConfigPath: string;
  modelsConfigExists: boolean;
  modelsConfigValid: boolean;
  modelsConfigError: string | null;
}

/**
 * Single client check result
 */
export interface ClientCheckResult {
  client: string;
  status: 'found' | 'not-found' | 'skipped';
  binaryPath?: string;
  appBundlePath?: string;
  version?: string;
  configPath?: string;
  configValid: boolean;
  warnings?: string[];
  source?: string;
  environment?: string;
  windowsPath?: string;
}

/**
 * All clients check result
 */
export interface ClientsCheckResult {
  clients: ClientCheckResult[];
  summary: {
    clientsDetected: number;
    clientsMissing: number;
    wsl2Detections: number;
    configsValid: number;
    configsInvalid: number;
  };
}

/**
 * Single MCP server check result
 */
export interface McpServerCheckResult {
  name: string;
  command: string;
  available: boolean;
  source: string;
}

/**
 * All MCP servers check result
 */
export interface McpCheckResult {
  mcpServers: McpServerCheckResult[];
  summary: {
    mcpCommandsAvailable: number;
    mcpCommandsMissing: number;
  };
}

/**
 * Overall diagnostics summary
 */
export interface DiagnosticsSummary {
  clientsDetected: number;
  clientsMissing: number;
  wsl2Detections: number;
  configsValid: number;
  configsInvalid: number;
  mcpCommandsAvailable: number;
  mcpCommandsMissing: number;
  globalAgents: number;
  projectAgents: number;
  agentErrors: number;
}

/**
 * Complete diagnostics result
 */
export interface DiagnosticsResult {
  environment: EnvironmentCheckResult;
  configRepo: ConfigRepoCheckResult & {
    git: GitCheckResult;
    skills: SkillsCheckResult;
    agents: AgentsCheckResult;
  };
  clients: ClientsCheckResult;
  mcpServers: McpCheckResult;
  summary: DiagnosticsSummary;
}

/**
 * Diagnostics options
 */
export interface DiagnosticsOptions {
  wsl2?: boolean;
  verbose?: boolean;
  json?: boolean;
}
```

**Dependencies:** `@overture/config-types`

---

#### ☐ Task 1.3: Export types from index (5 min)

**File:** `libs/domain/diagnostics-types/src/index.ts`

**Code:**

```typescript
export * from './lib/diagnostics.types.js';
```

---

#### ☐ Task 1.4: Add unit tests for types (30 min)

**File:** `libs/domain/diagnostics-types/src/lib/diagnostics.types.spec.ts`

**Code:**

```typescript
import { describe, it, expect } from 'vitest';
import type {
  DiagnosticsResult,
  EnvironmentCheckResult,
  ConfigRepoCheckResult,
  ClientCheckResult,
} from './diagnostics.types';

describe('diagnostics.types', () => {
  it('should compile EnvironmentCheckResult type', () => {
    const result: EnvironmentCheckResult = {
      platform: 'linux',
      isWSL2: false,
    };
    expect(result.platform).toBe('linux');
  });

  it('should compile ConfigRepoCheckResult type', () => {
    const result: ConfigRepoCheckResult = {
      configRepoPath: '/home/user/.config/overture',
      skillsPath: '/home/user/.config/overture/skills',
      configRepoExists: true,
      skillsDirExists: true,
    };
    expect(result.configRepoExists).toBe(true);
  });

  it('should compile ClientCheckResult type with all fields', () => {
    const result: ClientCheckResult = {
      client: 'claude-code',
      status: 'found',
      binaryPath: '/usr/local/bin/claude-code',
      version: '1.0.0',
      configValid: true,
    };
    expect(result.status).toBe('found');
  });

  it('should compile DiagnosticsResult type', () => {
    const result: DiagnosticsResult = {
      environment: {
        platform: 'darwin',
        isWSL2: false,
      },
      configRepo: {
        configRepoPath: '',
        skillsPath: '',
        configRepoExists: false,
        skillsDirExists: false,
        git: {
          isGitRepo: false,
          gitRemote: null,
          localHash: null,
          remoteHash: null,
          gitInSync: false,
        },
        skills: {
          skillsPath: '',
          skillsDirExists: false,
          skillCount: 0,
        },
        agents: {
          globalAgentsPath: '',
          globalAgentsDirExists: false,
          globalAgentCount: 0,
          globalAgentErrors: [],
          projectAgentsPath: null,
          projectAgentsDirExists: false,
          projectAgentCount: 0,
          projectAgentErrors: [],
          modelsConfigPath: '',
          modelsConfigExists: false,
          modelsConfigValid: false,
          modelsConfigError: null,
        },
      },
      clients: {
        clients: [],
        summary: {
          clientsDetected: 0,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 0,
        },
      },
      mcpServers: {
        mcpServers: [],
        summary: {
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
        },
      },
      summary: {
        clientsDetected: 0,
        clientsMissing: 0,
        wsl2Detections: 0,
        configsValid: 0,
        configsInvalid: 0,
        mcpCommandsAvailable: 0,
        mcpCommandsMissing: 0,
        globalAgents: 0,
        projectAgents: 0,
        agentErrors: 0,
      },
    };
    expect(result).toBeDefined();
  });
});
```

**Coverage Target:** 100% (type assertion tests)

---

### Phase 2: Core Checker Classes (8.5 hours)

#### ☐ Task 2.1: Create ConfigRepoChecker class (2 hours)

**File:** `libs/core/diagnostics/src/lib/checkers/config-repo-checker.ts`

**Code Example:**

```typescript
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { ProcessPort, EnvironmentPort } from '@overture/ports-process';
import type {
  ConfigRepoCheckResult,
  GitCheckResult,
} from '@overture/diagnostics-types';

/**
 * ConfigRepoChecker - Checks config repository and git status
 *
 * Never throws errors - always returns results.
 */
export class ConfigRepoChecker {
  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly process: ProcessPort,
    private readonly environment: EnvironmentPort,
  ) {}

  /**
   * Check if config repository exists
   */
  async checkConfigRepository(): Promise<ConfigRepoCheckResult> {
    try {
      const homeDir = this.environment.homedir();
      const configRepoPath = `${homeDir}/.config/overture`;
      const skillsPath = `${configRepoPath}/skills`;

      const configRepoExists = await this.filesystem.exists(configRepoPath);
      const skillsDirExists = await this.filesystem.exists(skillsPath);

      return {
        configRepoPath,
        skillsPath,
        configRepoExists,
        skillsDirExists,
      };
    } catch {
      // Never throw - return safe defaults
      const homeDir = this.environment.homedir();
      return {
        configRepoPath: `${homeDir}/.config/overture`,
        skillsPath: `${homeDir}/.config/overture/skills`,
        configRepoExists: false,
        skillsDirExists: false,
      };
    }
  }

  /**
   * Check git repository status
   */
  async checkGitRepository(
    configRepoPath: string,
    configRepoExists: boolean,
  ): Promise<GitCheckResult> {
    if (!configRepoExists) {
      return {
        isGitRepo: false,
        gitRemote: null,
        localHash: null,
        remoteHash: null,
        gitInSync: false,
      };
    }

    const gitDirPath = `${configRepoPath}/.git`;
    const isGitRepo = await this.filesystem.exists(gitDirPath);

    if (!isGitRepo) {
      return {
        isGitRepo: false,
        gitRemote: null,
        localHash: null,
        remoteHash: null,
        gitInSync: false,
      };
    }

    const gitRemote = await this.getGitRemote(configRepoPath);
    const localHash = await this.getLocalHash(configRepoPath);
    const { remoteHash, gitInSync } = await this.getRemoteHashAndSyncStatus(
      configRepoPath,
      gitRemote,
      localHash,
    );

    return {
      isGitRepo,
      gitRemote,
      localHash,
      remoteHash,
      gitInSync,
    };
  }

  /**
   * Get git remote origin URL
   */
  private async getGitRemote(configRepoPath: string): Promise<string | null> {
    try {
      const result = await this.process.exec('git', [
        '-C',
        configRepoPath,
        'remote',
        'get-url',
        'origin',
      ]);
      if (result.exitCode === 0 && result.stdout.trim()) {
        return result.stdout.trim();
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  /**
   * Get local git HEAD hash
   */
  private async getLocalHash(configRepoPath: string): Promise<string | null> {
    try {
      const result = await this.process.exec('git', [
        '-C',
        configRepoPath,
        'rev-parse',
        'HEAD',
      ]);
      if (result.exitCode === 0 && result.stdout.trim()) {
        return result.stdout.trim();
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  /**
   * Get remote hash and check sync status
   */
  private async getRemoteHashAndSyncStatus(
    configRepoPath: string,
    gitRemote: string | null,
    localHash: string | null,
  ): Promise<{ remoteHash: string | null; gitInSync: boolean }> {
    let remoteHash: string | null = null;
    let gitInSync = false;

    if (!gitRemote || !localHash) {
      return { remoteHash, gitInSync };
    }

    try {
      const result = await this.process.exec('git', [
        '-C',
        configRepoPath,
        'ls-remote',
        'origin',
        'HEAD',
      ]);
      if (result.exitCode === 0 && result.stdout.trim()) {
        const match = result.stdout.trim().split(/\s+/);
        if (match.length > 0) {
          remoteHash = match[0];
          gitInSync = localHash === remoteHash;
        }
      }
    } catch {
      // Ignore errors
    }

    return { remoteHash, gitInSync };
  }
}
```

**Lines:** ~150  
**Dependencies:** FilesystemPort, ProcessPort, EnvironmentPort, @overture/diagnostics-types

---

#### ☐ Task 2.2: Create SkillsChecker class (1 hour)

**File:** `libs/core/diagnostics/src/lib/checkers/skills-checker.ts`

**Code Example:**

```typescript
import type { FilesystemPort } from '@overture/ports-filesystem';

/**
 * SkillsChecker - Counts skills in skills directory
 *
 * Never throws errors - always returns a count.
 */
export class SkillsChecker {
  constructor(private readonly filesystem: FilesystemPort) {}

  /**
   * Count skills in skills directory
   */
  async countSkills(
    skillsPath: string,
    skillsDirExists: boolean,
  ): Promise<number> {
    let skillCount = 0;

    if (!skillsDirExists) {
      return skillCount;
    }

    try {
      const entries = await this.filesystem.readdir(skillsPath);
      for (const entry of entries) {
        const entryPath = `${skillsPath}/${entry}`;
        const stats = await this.filesystem.stat(entryPath);
        if (stats.isDirectory()) {
          const skillFile = `${entryPath}/SKILL.md`;
          const hasSkillFile = await this.filesystem.exists(skillFile);
          if (hasSkillFile) {
            skillCount++;
          }
        }
      }
    } catch {
      // Ignore errors - return 0
    }

    return skillCount;
  }
}
```

**Lines:** ~50  
**Dependencies:** FilesystemPort

---

#### ☐ Task 2.3: Create AgentsChecker class (2 hours)

**File:** `libs/core/diagnostics/src/lib/checkers/agents-checker.ts`

**Code Example:**

```typescript
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { AgentsCheckResult } from '@overture/diagnostics-types';

/**
 * AgentsChecker - Validates agent YAML/MD pairs
 *
 * Never throws errors - always returns results with error messages.
 */
export class AgentsChecker {
  constructor(private readonly filesystem: FilesystemPort) {}

  /**
   * Check agents directories and validate agent files
   */
  async checkAgents(
    configRepoPath: string,
    configRepoExists: boolean,
    projectRoot: string | null,
  ): Promise<AgentsCheckResult> {
    const globalAgentsPath = `${configRepoPath}/agents`;
    const modelsConfigPath = `${configRepoPath}/models.yaml`;

    const globalAgentsDirExists =
      configRepoExists && (await this.filesystem.exists(globalAgentsPath));
    const modelsConfigExists =
      configRepoExists && (await this.filesystem.exists(modelsConfigPath));

    // Validate global agents
    const { agentCount: globalAgentCount, errors: globalAgentErrors } =
      await this.validateAgents(globalAgentsPath, globalAgentsDirExists);

    // Validate project agents (if in a project)
    let projectAgentsPath: string | null = null;
    let projectAgentsDirExists = false;
    let projectAgentCount = 0;
    let projectAgentErrors: string[] = [];

    if (projectRoot) {
      projectAgentsPath = `${projectRoot}/.overture/agents`;
      projectAgentsDirExists = await this.filesystem.exists(projectAgentsPath);
      const projectAgentData = await this.validateAgents(
        projectAgentsPath,
        projectAgentsDirExists,
      );
      projectAgentCount = projectAgentData.agentCount;
      projectAgentErrors = projectAgentData.errors;
    }

    // Validate models.yaml
    let modelsConfigValid = false;
    let modelsConfigError: string | null = null;

    if (modelsConfigExists) {
      try {
        const content = await this.filesystem.readFile(modelsConfigPath);
        const yaml = await import('js-yaml');
        const parsed = yaml.load(content);

        if (typeof parsed !== 'object' || parsed === null) {
          modelsConfigError = 'models.yaml must contain a YAML object';
        } else {
          modelsConfigValid = true;
        }
      } catch (error) {
        modelsConfigError = (error as Error).message;
      }
    }

    return {
      globalAgentsPath,
      globalAgentsDirExists,
      globalAgentCount,
      globalAgentErrors,
      projectAgentsPath,
      projectAgentsDirExists,
      projectAgentCount,
      projectAgentErrors,
      modelsConfigPath,
      modelsConfigExists,
      modelsConfigValid,
      modelsConfigError,
    };
  }

  /**
   * Validate agent YAML/MD pairs in a directory
   */
  private async validateAgents(
    agentsPath: string,
    agentsDirExists: boolean,
  ): Promise<{ agentCount: number; errors: string[] }> {
    const errors: string[] = [];
    let agentCount = 0;

    if (!agentsDirExists) {
      return { agentCount, errors };
    }

    try {
      const files = await this.filesystem.readdir(agentsPath);
      const yamlFiles = files.filter(
        (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
      );

      for (const yamlFile of yamlFiles) {
        const name = yamlFile.replace(/\.ya?ml$/, '');
        const mdFile = `${name}.md`;

        const yamlPath = `${agentsPath}/${yamlFile}`;
        const mdPath = `${agentsPath}/${mdFile}`;

        // Check if corresponding .md file exists
        const hasMdFile = await this.filesystem.exists(mdPath);
        if (!hasMdFile) {
          errors.push(`${yamlFile}: Missing corresponding ${mdFile} file`);
          continue;
        }

        // Validate YAML syntax
        try {
          const yamlContent = await this.filesystem.readFile(yamlPath);
          const yaml = await import('js-yaml');
          const parsed = yaml.load(yamlContent);

          if (typeof parsed !== 'object' || parsed === null) {
            errors.push(`${yamlFile}: Invalid YAML structure`);
            continue;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!(parsed as any).name) {
            errors.push(`${yamlFile}: Missing required 'name' field`);
            continue;
          }

          // Successfully validated
          agentCount++;
        } catch (error) {
          errors.push(`${yamlFile}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      errors.push(
        `Failed to read agents directory: ${(error as Error).message}`,
      );
    }

    return { agentCount, errors };
  }
}
```

**Lines:** ~150  
**Dependencies:** FilesystemPort, @overture/diagnostics-types

---

#### ☐ Task 2.4: Create ClientsChecker class (2 hours)

**File:** `libs/core/diagnostics/src/lib/checkers/clients-checker.ts`

**Code Example:**

```typescript
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { AdapterRegistry } from '@overture/client-adapters';
import type { Platform, ClientName } from '@overture/config-types';
import type {
  ClientsCheckResult,
  ClientCheckResult,
} from '@overture/diagnostics-types';

/**
 * ClientsChecker - Validates client installations and configs
 *
 * Never throws errors - always returns results.
 */
export class ClientsChecker {
  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly adapterRegistry: AdapterRegistry,
  ) {}

  /**
   * Check all installed clients
   */
  async checkClients(
    discoveryReport: {
      clients: Array<{
        client: ClientName;
        detection: {
          status: string;
          binaryPath?: string;
          appBundlePath?: string;
          version?: string;
          warnings: string[];
        };
        source: string;
        environment?: string;
        windowsPath?: string;
      }>;
    },
    platform: Platform,
    projectRoot: string | null,
  ): Promise<ClientsCheckResult> {
    const clients: ClientCheckResult[] = [];

    const summary = {
      clientsDetected: 0,
      clientsMissing: 0,
      wsl2Detections: 0,
      configsValid: 0,
      configsInvalid: 0,
    };

    for (const clientDiscovery of discoveryReport.clients) {
      const clientName = clientDiscovery.client;
      const detection = clientDiscovery.detection;
      const adapter = this.adapterRegistry.get(clientName);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const configPath = (adapter as any)?.detectConfigPath?.(
        platform,
        projectRoot || undefined,
      );
      const configPathStr =
        typeof configPath === 'string'
          ? configPath
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (configPath as any)?.user || undefined;

      const configValid = configPathStr
        ? await this.validateConfigFile(configPathStr)
        : false;

      const clientResult: ClientCheckResult = {
        client: clientName,
        status: detection.status as 'found' | 'not-found' | 'skipped',
        binaryPath: detection.binaryPath,
        appBundlePath: detection.appBundlePath,
        version: detection.version,
        configPath: configPathStr,
        configValid,
        warnings: detection.warnings,
        source: clientDiscovery.source,
        environment: clientDiscovery.environment,
        windowsPath: clientDiscovery.windowsPath,
      };

      clients.push(clientResult);

      // Update summary
      if (detection.status === 'found') {
        summary.clientsDetected++;
        if (clientDiscovery.source === 'wsl2-fallback') {
          summary.wsl2Detections++;
        }
      } else if (detection.status === 'not-found') {
        summary.clientsMissing++;
      }

      if (configValid) {
        summary.configsValid++;
      } else if (configPathStr) {
        summary.configsInvalid++;
      }
    }

    return {
      clients,
      summary,
    };
  }

  /**
   * Validate if a config file exists and contains valid JSON
   */
  private async validateConfigFile(filepath: string): Promise<boolean> {
    try {
      const fileExists = await this.filesystem.exists(filepath);
      if (!fileExists) {
        return false;
      }
      const content = await this.filesystem.readFile(filepath);
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }
}
```

**Lines:** ~120  
**Dependencies:** FilesystemPort, AdapterRegistry, @overture/diagnostics-types

---

#### ☐ Task 2.5: Create McpChecker class (1 hour)

**File:** `libs/core/diagnostics/src/lib/checkers/mcp-checker.ts`

**Code Example:**

```typescript
import type { ProcessPort } from '@overture/ports-process';
import type { OvertureConfig } from '@overture/config-types';
import type {
  McpCheckResult,
  McpServerCheckResult,
} from '@overture/diagnostics-types';

/**
 * McpChecker - Checks MCP server command availability
 *
 * Never throws errors - always returns results.
 */
export class McpChecker {
  constructor(private readonly process: ProcessPort) {}

  /**
   * Check all MCP servers
   */
  async checkMcpServers(
    mergedConfig: OvertureConfig | null,
    mcpSources: Record<string, string>,
  ): Promise<McpCheckResult> {
    const mcpServers: McpServerCheckResult[] = [];

    const summary = {
      mcpCommandsAvailable: 0,
      mcpCommandsMissing: 0,
    };

    const mcpConfig = mergedConfig?.mcp || {};

    for (const [mcpName, mcpDef] of Object.entries(mcpConfig)) {
      const commandExists = await this.process.commandExists(mcpDef.command);
      const source = Object.hasOwn(mcpSources, mcpName)
        ? // eslint-disable-next-line security/detect-object-injection
          mcpSources[mcpName]
        : 'unknown';

      const mcpResult: McpServerCheckResult = {
        name: mcpName,
        command: mcpDef.command,
        available: commandExists,
        source,
      };

      mcpServers.push(mcpResult);

      // Update summary
      if (commandExists) {
        summary.mcpCommandsAvailable++;
      } else {
        summary.mcpCommandsMissing++;
      }
    }

    return {
      mcpServers,
      summary,
    };
  }
}
```

**Lines:** ~80  
**Dependencies:** ProcessPort, @overture/diagnostics-types

---

#### ☐ Task 2.6: Export all checkers (5 min)

**File:** `libs/core/diagnostics/src/lib/checkers/index.ts`

**Code:**

```typescript
export { ConfigRepoChecker } from './config-repo-checker.js';
export { SkillsChecker } from './skills-checker.js';
export { AgentsChecker } from './agents-checker.js';
export { ClientsChecker } from './clients-checker.js';
export { McpChecker } from './mcp-checker.js';
```

---

#### ☐ Task 2.7: Update diagnostics library dependencies (10 min)

**File:** `libs/core/diagnostics/package.json`

Add dependencies:

```json
{
  "dependencies": {
    "@overture/diagnostics-types": "*",
    "@overture/ports-filesystem": "*",
    "@overture/ports-process": "*",
    "@overture/config-types": "*",
    "@overture/client-adapters": "*",
    "js-yaml": "^4.1.0"
  }
}
```

---

### Phase 3: Formatter Classes (10.5 hours)

#### ☐ Task 3.1: Create EnvironmentFormatter class (1 hour)

**File:** `libs/shared/formatters/src/lib/formatters/environment-formatter.ts`

**Code Example:**

```typescript
import type { OutputPort } from '@overture/ports-output';
import type { EnvironmentCheckResult } from '@overture/diagnostics-types';
import chalk from 'chalk';

/**
 * EnvironmentFormatter - Formats environment information
 */
export class EnvironmentFormatter {
  constructor(private readonly output: OutputPort) {}

  /**
   * Format and output environment information
   */
  formatEnvironment(environment: EnvironmentCheckResult): void {
    if (environment.isWSL2) {
      this.output.info(chalk.bold('\nEnvironment:\n'));
      console.log(
        `  Platform: ${chalk.cyan('WSL2')} (${environment.wsl2Info?.distroName || 'Unknown'})`,
      );
      if (environment.wsl2Info?.windowsUserProfile) {
        console.log(
          `  Windows User: ${chalk.dim(environment.wsl2Info.windowsUserProfile)}`,
        );
      }
      console.log('');
    }
  }
}
```

**Lines:** ~40  
**Dependencies:** OutputPort, @overture/diagnostics-types, chalk

---

#### ☐ Task 3.2: Create ConfigRepoFormatter class (3 hours)

**File:** `libs/shared/formatters/src/lib/formatters/config-repo-formatter.ts`

**Code Example:** (Abbreviated - full implementation would be ~250 lines)

```typescript
import type { OutputPort } from '@overture/ports-output';
import type {
  ConfigRepoCheckResult,
  GitCheckResult,
  SkillsCheckResult,
  AgentsCheckResult,
} from '@overture/diagnostics-types';
import chalk from 'chalk';

/**
 * ConfigRepoFormatter - Formats config repository status
 */
export class ConfigRepoFormatter {
  constructor(private readonly output: OutputPort) {}

  /**
   * Format and output config repository status
   */
  formatConfigRepoStatus(
    configRepo: ConfigRepoCheckResult & {
      git: GitCheckResult;
      skills: SkillsCheckResult;
      agents: AgentsCheckResult;
    },
    verbose: boolean,
  ): void {
    this.output.info(chalk.bold('Checking config repository...\n'));

    if (configRepo.configRepoExists) {
      this.output.success(
        `${chalk.green('✓')} Config repo - ${chalk.dim(configRepo.configRepoPath)}`,
      );
      this.formatGitRepoStatus(configRepo.git, configRepo.configRepoPath);
      this.formatSkillsStatus(configRepo.skills);
      this.formatAgentsStatus(configRepo.agents, 'Global', verbose);
      this.formatModelsConfigStatus(configRepo.agents);
    } else {
      this.formatConfigRepoNotFound(configRepo.configRepoPath);
    }

    console.log('');
  }

  /**
   * Format git repository status
   */
  private formatGitRepoStatus(
    git: GitCheckResult,
    configRepoPath: string,
  ): void {
    if (git.isGitRepo) {
      const hashShort = git.localHash
        ? git.localHash.substring(0, 7)
        : 'unknown';
      this.output.success(
        `  ${chalk.green('✓')} Git repository - ${chalk.dim('initialized')} ${chalk.dim(`(${hashShort})`)}`,
      );
      if (git.gitRemote) {
        this.output.success(
          `    ${chalk.green('✓')} Remote configured - ${chalk.dim(git.gitRemote)}`,
        );
        this.formatGitSyncStatus(git);
      } else {
        this.output.warn(`    ${chalk.yellow('⚠')} No git remote configured`);
        console.log(
          `      ${chalk.dim('→')} ${chalk.dim('Run: git remote add origin <url>')}`,
        );
      }
    } else {
      this.output.warn(`  ${chalk.yellow('⚠')} Not a git repository`);
      console.log(
        `    ${chalk.dim('→')} ${chalk.dim('Run: cd ' + configRepoPath + ' && git init')}`,
      );
    }
  }

  // ... more private helper methods
}
```

**Lines:** ~250  
**Dependencies:** OutputPort, @overture/diagnostics-types, chalk

---

#### ☐ Task 3.3: Create ClientsFormatter class (2 hours)

**File:** `libs/shared/formatters/src/lib/formatters/clients-formatter.ts`

**Lines:** ~200  
**Dependencies:** OutputPort, @overture/diagnostics-types, chalk

---

#### ☐ Task 3.4: Create McpFormatter class (1 hour)

**File:** `libs/shared/formatters/src/lib/formatters/mcp-formatter.ts`

**Lines:** ~80  
**Dependencies:** OutputPort, @overture/diagnostics-types, chalk

---

#### ☐ Task 3.5: Create SummaryFormatter class (3 hours)

**File:** `libs/shared/formatters/src/lib/formatters/summary-formatter.ts`

**Lines:** ~250  
**Dependencies:** OutputPort, @overture/diagnostics-types, chalk

---

#### ☐ Task 3.6: Create RecommendationsHelper utility (30 min)

**File:** `libs/shared/formatters/src/lib/helpers/recommendations.ts`

**Code:**

```typescript
import type { ClientName } from '@overture/config-types';

/**
 * Get installation recommendation for a client
 */
export function getInstallRecommendation(client: ClientName): string | null {
  const recommendations: Record<ClientName, string> = {
    'claude-code': 'Install Claude Code CLI: https://claude.com/claude-code',
    'copilot-cli': 'Install GitHub Copilot CLI: npm install -g @github/copilot',
    opencode: 'Install OpenCode: https://opencode.ai',
  };

  return Object.hasOwn(recommendations, client)
    ? // eslint-disable-next-line security/detect-object-injection
      recommendations[client]
    : null;
}

/**
 * Get installation recommendation for an MCP command
 */
export function getMcpInstallRecommendation(command: string): string | null {
  if (command === 'npx') {
    return 'Install Node.js: https://nodejs.org';
  }
  if (command === 'uvx') {
    return 'Install uv: https://docs.astral.sh/uv/';
  }
  if (command.startsWith('mcp-server-')) {
    return `Try: npx -y ${command}`;
  }

  return `Ensure ${command} is installed and available in PATH`;
}
```

**Lines:** ~40

---

#### ☐ Task 3.7: Export all formatters (5 min)

**File:** `libs/shared/formatters/src/lib/formatters/index.ts`

**Code:**

```typescript
export { EnvironmentFormatter } from './environment-formatter.js';
export { ConfigRepoFormatter } from './config-repo-formatter.js';
export { ClientsFormatter } from './clients-formatter.js';
export { McpFormatter } from './mcp-formatter.js';
export { SummaryFormatter } from './summary-formatter.js';
```

---

#### ☐ Task 3.8: Update formatters library dependencies (10 min)

**File:** `libs/shared/formatters/package.json`

Add dependencies:

```json
{
  "dependencies": {
    "@overture/diagnostics-types": "*",
    "@overture/ports-output": "*",
    "@overture/config-types": "*",
    "chalk": "^5.3.0"
  }
}
```

---

### Phase 4: Orchestrator (5 hours)

#### ☐ Task 4.1: Create DiagnosticsOrchestrator class (4 hours)

**File:** `libs/core/diagnostics/src/lib/diagnostics-orchestrator.ts`

**Code Example:**

```typescript
import type { DiscoveryService } from '@overture/discovery-core';
import type { ConfigLoader, PathResolver } from '@overture/config-core';
import type { AdapterRegistry } from '@overture/client-adapters';
import type {
  DiagnosticsResult,
  DiagnosticsOptions,
} from '@overture/diagnostics-types';
import type { ClientName, Platform } from '@overture/config-types';
import { SUPPORTED_CLIENTS } from '@overture/config-types';
import {
  ConfigRepoChecker,
  SkillsChecker,
  AgentsChecker,
  ClientsChecker,
  McpChecker,
} from './checkers/index.js';
import * as os from 'node:os';

/**
 * Get current platform
 */
function getCurrentPlatform(): Platform {
  const platform = os.platform();
  if (platform === 'darwin') return 'darwin';
  if (platform === 'win32') return 'win32';
  return 'linux';
}

/**
 * DiagnosticsOrchestrator dependencies
 */
export interface DiagnosticsOrchestratorDeps {
  configRepoChecker: ConfigRepoChecker;
  skillsChecker: SkillsChecker;
  agentsChecker: AgentsChecker;
  clientsChecker: ClientsChecker;
  mcpChecker: McpChecker;
  discoveryService: DiscoveryService;
  configLoader: ConfigLoader;
  pathResolver: PathResolver;
  adapterRegistry: AdapterRegistry;
}

/**
 * DiagnosticsOrchestrator - Coordinates all diagnostic checks
 *
 * CRITICAL: Never throws errors. Always returns a complete DiagnosticsResult,
 * even if individual checks fail. This ensures the doctor command always provides
 * useful feedback to the user.
 */
export class DiagnosticsOrchestrator {
  constructor(private readonly deps: DiagnosticsOrchestratorDeps) {}

  /**
   * Run all diagnostics
   *
   * @param options - Diagnostic options (wsl2 mode, verbose, etc.)
   * @returns Complete diagnostics result (never throws)
   */
  async runDiagnostics(
    options: DiagnosticsOptions = {},
  ): Promise<DiagnosticsResult> {
    try {
      // Step 1: Get platform and project root
      const platform = getCurrentPlatform();
      const projectRoot = await this.deps.pathResolver.findProjectRoot();

      // Step 2: Load configs
      const userConfig = await this.deps.configLoader.loadUserConfig();
      const projectConfig = projectRoot
        ? await this.deps.configLoader.loadProjectConfig(projectRoot)
        : null;

      // Step 3: Run discovery
      const ALL_CLIENTS: readonly ClientName[] = SUPPORTED_CLIENTS;
      const adapters = ALL_CLIENTS.map((clientName) =>
        this.deps.adapterRegistry.get(clientName),
      ).filter(
        (
          adapter,
        ): adapter is import('@overture/client-adapters').ClientAdapter =>
          adapter !== undefined,
      );

      const discoveryReport =
        await this.deps.discoveryService.discoverAll(adapters);

      // Step 4: Check config repository
      const configRepo =
        await this.deps.configRepoChecker.checkConfigRepository();

      // Step 5: Check git repository
      const git = await this.deps.configRepoChecker.checkGitRepository(
        configRepo.configRepoPath,
        configRepo.configRepoExists,
      );

      // Step 6: Count skills
      const skillCount = await this.deps.skillsChecker.countSkills(
        configRepo.skillsPath,
        configRepo.skillsDirExists,
      );

      // Step 7: Check agents
      const agents = await this.deps.agentsChecker.checkAgents(
        configRepo.configRepoPath,
        configRepo.configRepoExists,
        projectRoot,
      );

      // Step 8: Check clients
      const clients = await this.deps.clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      // Step 9: Check MCP servers
      const mcpSources = this.deps.configLoader.getMcpSources(
        userConfig,
        projectConfig,
      );
      const mergedConfig = this.deps.configLoader.mergeConfigs(
        userConfig,
        projectConfig,
      );
      const mcpServers = await this.deps.mcpChecker.checkMcpServers(
        mergedConfig,
        mcpSources,
      );

      // Step 10: Build result
      return {
        environment: {
          platform: discoveryReport.environment.platform,
          isWSL2: discoveryReport.environment.isWSL2,
          wsl2Info: discoveryReport.environment.wsl2Info,
        },
        configRepo: {
          ...configRepo,
          git,
          skills: {
            skillsPath: configRepo.skillsPath,
            skillsDirExists: configRepo.skillsDirExists,
            skillCount,
          },
          agents,
        },
        clients,
        mcpServers,
        summary: {
          clientsDetected: clients.summary.clientsDetected,
          clientsMissing: clients.summary.clientsMissing,
          wsl2Detections: clients.summary.wsl2Detections,
          configsValid: clients.summary.configsValid,
          configsInvalid: clients.summary.configsInvalid,
          mcpCommandsAvailable: mcpServers.summary.mcpCommandsAvailable,
          mcpCommandsMissing: mcpServers.summary.mcpCommandsMissing,
          globalAgents: agents.globalAgentCount,
          projectAgents: agents.projectAgentCount,
          agentErrors:
            agents.globalAgentErrors.length + agents.projectAgentErrors.length,
        },
      };
    } catch (error) {
      // CRITICAL: Never throw. Return safe defaults.
      // This ensures doctor always provides feedback, even if everything fails.
      const platform = getCurrentPlatform();
      return this.getSafeDefaultResult(platform, error);
    }
  }

  /**
   * Get safe default result when all checks fail
   */
  private getSafeDefaultResult(
    platform: Platform,
    error: unknown,
  ): DiagnosticsResult {
    return {
      environment: {
        platform,
        isWSL2: false,
      },
      configRepo: {
        configRepoPath: '',
        skillsPath: '',
        configRepoExists: false,
        skillsDirExists: false,
        git: {
          isGitRepo: false,
          gitRemote: null,
          localHash: null,
          remoteHash: null,
          gitInSync: false,
        },
        skills: {
          skillsPath: '',
          skillsDirExists: false,
          skillCount: 0,
        },
        agents: {
          globalAgentsPath: '',
          globalAgentsDirExists: false,
          globalAgentCount: 0,
          globalAgentErrors: [`Fatal error: ${(error as Error).message}`],
          projectAgentsPath: null,
          projectAgentsDirExists: false,
          projectAgentCount: 0,
          projectAgentErrors: [],
          modelsConfigPath: '',
          modelsConfigExists: false,
          modelsConfigValid: false,
          modelsConfigError: null,
        },
      },
      clients: {
        clients: [],
        summary: {
          clientsDetected: 0,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 0,
        },
      },
      mcpServers: {
        mcpServers: [],
        summary: {
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
        },
      },
      summary: {
        clientsDetected: 0,
        clientsMissing: 0,
        wsl2Detections: 0,
        configsValid: 0,
        configsInvalid: 0,
        mcpCommandsAvailable: 0,
        mcpCommandsMissing: 0,
        globalAgents: 0,
        projectAgents: 0,
        agentErrors: 1,
      },
    };
  }
}
```

**Lines:** ~200  
**Dependencies:** All checkers, DiscoveryService, ConfigLoader, PathResolver, AdapterRegistry

---

#### ☐ Task 4.2: Create factory function (1 hour)

**File:** `libs/core/diagnostics/src/lib/create-diagnostics-orchestrator.ts`

**Code:**

```typescript
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { ProcessPort, EnvironmentPort } from '@overture/ports-process';
import type { DiscoveryService } from '@overture/discovery-core';
import type { ConfigLoader, PathResolver } from '@overture/config-core';
import type { AdapterRegistry } from '@overture/client-adapters';
import {
  DiagnosticsOrchestrator,
  type DiagnosticsOrchestratorDeps,
} from './diagnostics-orchestrator.js';
import {
  ConfigRepoChecker,
  SkillsChecker,
  AgentsChecker,
  ClientsChecker,
  McpChecker,
} from './checkers/index.js';

/**
 * Factory dependencies (from composition root)
 */
export interface CreateDiagnosticsOrchestratorDeps {
  filesystem: FilesystemPort;
  process: ProcessPort;
  environment: EnvironmentPort;
  discoveryService: DiscoveryService;
  configLoader: ConfigLoader;
  pathResolver: PathResolver;
  adapterRegistry: AdapterRegistry;
}

/**
 * Create DiagnosticsOrchestrator with all dependencies wired up
 */
export function createDiagnosticsOrchestrator(
  deps: CreateDiagnosticsOrchestratorDeps,
): DiagnosticsOrchestrator {
  const configRepoChecker = new ConfigRepoChecker(
    deps.filesystem,
    deps.process,
    deps.environment,
  );

  const skillsChecker = new SkillsChecker(deps.filesystem);

  const agentsChecker = new AgentsChecker(deps.filesystem);

  const clientsChecker = new ClientsChecker(
    deps.filesystem,
    deps.adapterRegistry,
  );

  const mcpChecker = new McpChecker(deps.process);

  const orchestratorDeps: DiagnosticsOrchestratorDeps = {
    configRepoChecker,
    skillsChecker,
    agentsChecker,
    clientsChecker,
    mcpChecker,
    discoveryService: deps.discoveryService,
    configLoader: deps.configLoader,
    pathResolver: deps.pathResolver,
    adapterRegistry: deps.adapterRegistry,
  };

  return new DiagnosticsOrchestrator(orchestratorDeps);
}
```

**Lines:** ~70

---

#### ☐ Task 4.3: Update diagnostics index exports (5 min)

**File:** `libs/core/diagnostics/src/index.ts`

**Code:**

```typescript
// Orchestrator
export {
  DiagnosticsOrchestrator,
  type DiagnosticsOrchestratorDeps,
} from './lib/diagnostics-orchestrator.js';
export {
  createDiagnosticsOrchestrator,
  type CreateDiagnosticsOrchestratorDeps,
} from './lib/create-diagnostics-orchestrator.js';

// Checkers
export * from './lib/checkers/index.js';
```

---

### Phase 5: Simplify doctor.ts (3.5 hours)

#### ☐ Task 5.1: Remove all extracted code from doctor.ts (30 min)

Delete lines 30-1726 (all helper functions), keep only:

- Imports
- createDoctorCommand function

---

#### ☐ Task 5.2: Refactor createDoctorCommand to use orchestrator (2 hours)

**File:** `apps/cli/src/cli/commands/doctor.ts`

**Code:**

```typescript
/**
 * Doctor Command - Diagnostic Tool for Overture
 *
 * Provides comprehensive diagnostics for:
 * - Client binary/app bundle detection
 * - Client version information
 * - Config file validity
 * - MCP server command availability
 * - WSL2 environment detection
 *
 * @module cli/commands/doctor
 * @version 0.3.0
 */

import { Command } from 'commander';
import type { AppDependencies } from '../../composition-root';

/**
 * Creates the 'doctor' command for system diagnostics.
 *
 * Usage: overture doctor [options]
 *
 * Checks:
 * - Client binary/application installations
 * - Client versions
 * - Config file validity
 * - MCP server command availability
 */
export function createDoctorCommand(deps: AppDependencies): Command {
  const { diagnosticsOrchestrator, formatters } = deps;

  const command = new Command('doctor');

  command
    .description('Check system for installed clients and MCP servers')
    .option('--json', 'Output results as JSON')
    .option('--verbose', 'Show detailed output')
    .option('--wsl2', 'Force WSL2 detection mode')
    .option('--no-wsl2', 'Disable WSL2 detection')
    .action(async (options) => {
      // Run all diagnostics (never throws)
      const results = await diagnosticsOrchestrator.runDiagnostics({
        wsl2: options.wsl2,
        verbose: options.verbose,
        json: options.json,
      });

      // Output results
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        // Format and output results
        formatters.environment.formatEnvironment(results.environment);
        formatters.configRepo.formatConfigRepoStatus(
          results.configRepo,
          options.verbose,
        );
        formatters.clients.formatClientResults(
          results.clients.clients,
          options.verbose,
        );
        formatters.mcp.formatMcpResults(
          results.mcpServers.mcpServers,
          options.verbose,
        );
        formatters.summary.formatSummary(results.summary);
      }
    });

  return command;
}
```

**Lines:** ~75

---

#### ☐ Task 5.3: Update composition-root.ts (1 hour)

**File:** `apps/cli/src/composition-root.ts`

Add to AppDependencies interface:

```typescript
export interface AppDependencies {
  // ... existing

  // Diagnostics
  diagnosticsOrchestrator: DiagnosticsOrchestrator;
  formatters: {
    environment: EnvironmentFormatter;
    configRepo: ConfigRepoFormatter;
    clients: ClientsFormatter;
    mcp: McpFormatter;
    summary: SummaryFormatter;
  };
}
```

Add to createAppDependencies function:

```typescript
import { createDiagnosticsOrchestrator } from '@overture/diagnostics-core';
import {
  EnvironmentFormatter,
  ConfigRepoFormatter,
  ClientsFormatter,
  McpFormatter,
  SummaryFormatter,
} from '@overture/formatters';

export function createAppDependencies(): AppDependencies {
  // ... existing

  // Create diagnostics orchestrator
  const diagnosticsOrchestrator = createDiagnosticsOrchestrator({
    filesystem,
    process,
    environment,
    discoveryService,
    configLoader,
    pathResolver,
    adapterRegistry,
  });

  // Create formatters
  const formatters = {
    environment: new EnvironmentFormatter(output),
    configRepo: new ConfigRepoFormatter(output),
    clients: new ClientsFormatter(output),
    mcp: new McpFormatter(output),
    summary: new SummaryFormatter(output),
  };

  return {
    // ... existing
    diagnosticsOrchestrator,
    formatters,
  };
}
```

---

#### ☐ Task 5.4: Update CLI dependencies (10 min)

**File:** `apps/cli/package.json`

Add dependencies:

```json
{
  "dependencies": {
    "@overture/diagnostics-core": "*",
    "@overture/diagnostics-types": "*",
    "@overture/formatters": "*"
  }
}
```

---

### Phase 6: Comprehensive Testing (18.5 hours)

#### ☐ Task 6.1: Unit tests for ConfigRepoChecker (2 hours)

**File:** `libs/core/diagnostics/src/lib/checkers/config-repo-checker.spec.ts`

**Test Cases:**

- checkConfigRepository when repo exists
- checkConfigRepository when repo doesn't exist
- checkGitRepository when git repo exists
- checkGitRepository when git repo doesn't exist
- getGitRemote success
- getGitRemote failure
- getLocalHash success
- getLocalHash failure
- getRemoteHashAndSyncStatus in sync
- getRemoteHashAndSyncStatus out of sync

**Coverage Target:** 85%+  
**Lines:** ~150

---

#### ☐ Task 6.2: Unit tests for SkillsChecker (1 hour)

**File:** `libs/core/diagnostics/src/lib/checkers/skills-checker.spec.ts`

**Test Cases:**

- countSkills with 0 skills
- countSkills with multiple skills
- countSkills with invalid directory
- countSkills with non-directory entries

**Coverage Target:** 85%+  
**Lines:** ~80

---

#### ☐ Task 6.3: Unit tests for AgentsChecker (3 hours)

**File:** `libs/core/diagnostics/src/lib/checkers/agents-checker.spec.ts`

**Test Cases:**

- checkAgents global agents only
- checkAgents with project agents
- validateAgents with valid YAML/MD pairs
- validateAgents with missing MD files
- validateAgents with invalid YAML
- validateAgents with missing name field
- models.yaml validation (valid/invalid)

**Coverage Target:** 85%+  
**Lines:** ~200

---

#### ☐ Task 6.4: Unit tests for ClientsChecker (2 hours)

**File:** `libs/core/diagnostics/src/lib/checkers/clients-checker.spec.ts`

**Test Cases:**

- checkClients with found clients
- checkClients with missing clients
- checkClients with WSL2 detections
- validateConfigFile valid JSON
- validateConfigFile invalid JSON
- validateConfigFile missing file

**Coverage Target:** 85%+  
**Lines:** ~150

---

#### ☐ Task 6.5: Unit tests for McpChecker (1.5 hours)

**File:** `libs/core/diagnostics/src/lib/checkers/mcp-checker.spec.ts`

**Test Cases:**

- checkMcpServers with available commands
- checkMcpServers with missing commands
- checkMcpServers with no MCP config
- checkMcpServers with mixed availability

**Coverage Target:** 85%+  
**Lines:** ~100

---

#### ☐ Task 6.6: Unit tests for formatters (4 hours)

**Files:**

- `libs/shared/formatters/src/lib/formatters/environment-formatter.spec.ts`
- `libs/shared/formatters/src/lib/formatters/config-repo-formatter.spec.ts`
- `libs/shared/formatters/src/lib/formatters/clients-formatter.spec.ts`
- `libs/shared/formatters/src/lib/formatters/mcp-formatter.spec.ts`
- `libs/shared/formatters/src/lib/formatters/summary-formatter.spec.ts`

**Test Cases:** Each format method with different inputs

**Coverage Target:** 80%+ (formatters are mostly output)  
**Lines:** ~400 total

---

#### ☐ Task 6.7: Integration tests for DiagnosticsOrchestrator (3 hours)

**File:** `libs/core/diagnostics/src/lib/diagnostics-orchestrator.spec.ts`

**Test Cases:**

- runDiagnostics full flow with mocked dependencies
- runDiagnostics with various error scenarios (never throws)
- runDiagnostics with WSL2 mode
- runDiagnostics returns safe defaults on total failure

**Coverage Target:** 85%+  
**Lines:** ~200

---

#### ☐ Task 6.8: End-to-end test for doctor command (2 hours)

**File:** `apps/cli-e2e/src/cli/doctor.e2e.spec.ts`

**Test Cases:**

- doctor command with real filesystem
- doctor --json output
- doctor --verbose output
- doctor with no config repo
- doctor with config repo

**Lines:** ~100

---

## Testing Strategy

### Unit Testing

- **Framework:** Vitest
- **Coverage Target:** 80-85%+
- **Mocking:** Use vi.mock() for external dependencies
- **Pattern:** Test both success and error paths
- **Validation:** Verify return types match TypeScript interfaces

### Integration Testing

- **Focus:** DiagnosticsOrchestrator coordination
- **Dependencies:** Mock all checkers and services
- **Scenarios:** Test various combinations of success/failure states
- **Critical:** Verify orchestrator never throws

### End-to-End Testing

- **Framework:** Vitest with real CLI execution
- **Scope:** Full doctor command workflow
- **Validation:** JSON output schema, console output format

---

## Migration Path

### Step 1: Build New Libraries (No Breaking Changes)

Execute Phases 1-4 to create all new libraries and code without touching doctor.ts.

**Timeline:** Days 1-4  
**Risk:** Low - no changes to existing code  
**Validation:** Ensure all new libraries build and pass linter

### Step 2: Add Comprehensive Tests

Execute Phase 6 to add tests for all new code.

**Timeline:** Day 5  
**Risk:** Low - just adding tests  
**Validation:** Achieve 80%+ test coverage

### Step 3: Swap Implementation

Execute Phase 5 to replace doctor.ts implementation with orchestrator.

**Timeline:** Day 6  
**Risk:** Medium - changing behavior  
**Validation:**

- Run `nx test @overture/cli` - all existing tests must pass
- Run `overture doctor` manually - compare output to previous version
- Test all CLI options: --json, --verbose, --wsl2

### Step 4: Final Verification

Run full test suite and manual verification.

**Validation:**

```bash
# Run all tests
nx run-many -t test --all

# Build everything
nx run-many -t build --all

# Lint everything
nx run-many -t lint --all

# Manual smoke tests
overture doctor
overture doctor --json
overture doctor --verbose
overture doctor --wsl2
```

---

## Rollback Strategy

### Feature Branch Protection

```bash
# Create feature branch
git checkout -b feat/doctor-refactoring

# Tag pre-refactor state
git tag pre-doctor-refactor

# Work on feature branch
# ... make all changes

# Before merge, verify everything works
npm run test:all
npm run build:all
npm run lint:all
```

### Quick Rollback (If Needed)

If critical issues are discovered after merge:

```bash
# Option 1: Revert the merge commit
git revert -m 1 <merge-commit-sha>

# Option 2: Reset to tagged state (if not pushed)
git reset --hard pre-doctor-refactor

# Option 3: Feature flag (build into code)
# Add feature flag in composition-root.ts
const USE_NEW_DIAGNOSTICS = process.env.OVERTURE_NEW_DIAGNOSTICS === 'true';
```

### Feature Flag Implementation

If conservative rollback is desired, add feature flag:

```typescript
// composition-root.ts
const USE_NEW_DIAGNOSTICS = process.env.OVERTURE_NEW_DIAGNOSTICS !== 'false'; // Default: enabled

export function createAppDependencies(): AppDependencies {
  if (USE_NEW_DIAGNOSTICS) {
    // New implementation
    const diagnosticsOrchestrator = createDiagnosticsOrchestrator(...);
    return { diagnosticsOrchestrator, ... };
  } else {
    // Old implementation (keep old code temporarily)
    return { ... };
  }
}
```

This allows:

```bash
# Use new implementation (default)
overture doctor

# Use old implementation if issues arise
OVERTURE_NEW_DIAGNOSTICS=false overture doctor
```

---

## Concerns and Recommendations

### Concerns

1. **DiscoveryService Shared Code**
   - **Issue:** Discovery service is used by both doctor and sync commands
   - **Mitigation:** No changes to DiscoveryService - only new consumers
   - **Risk:** Low

2. **Console.log Direct Usage**
   - **Issue:** Current doctor.ts uses console.log in some places
   - **Mitigation:** Formatters must handle this - wrap in OutputPort where possible
   - **Risk:** Low - cosmetic only

3. **Type Complexity**
   - **Issue:** Adding many new type interfaces
   - **Mitigation:** Keep types simple, well-documented, co-located
   - **Risk:** Low

4. **Testing Effort**
   - **Issue:** Extensive testing required (18.5 hours)
   - **Mitigation:** Spread across sprint, can parallelize test writing
   - **Risk:** Medium - time constraint

5. **All-at-Once Migration**
   - **Issue:** doctor.ts is tightly coupled, can't migrate incrementally
   - **Mitigation:** Feature branch + feature flag + comprehensive testing
   - **Risk:** Medium

### Recommendations

1. **Use Feature Branch**
   - Create `feat/doctor-refactoring` branch
   - Don't merge until all tests pass
   - Tag commit before merge for easy rollback

2. **Add Feature Flag**
   - Environment variable to toggle new/old implementation
   - Keep old code for one release cycle
   - Remove after stability confirmed

3. **Comprehensive Testing**
   - Don't skip tests - they're critical for confidence
   - Test edge cases: no config repo, no git, WSL2 mode
   - Add manual smoke test checklist

4. **Incremental Review**
   - Review Phase 1 (types) separately
   - Review Phase 2-3 (checkers/formatters) together
   - Review Phase 4-5 (orchestrator/integration) together
   - Review Phase 6 (tests) last

5. **Documentation**
   - Update ARCHITECTURE.md with new library structure
   - Add JSDoc comments to all public APIs
   - Document error handling strategy (never throw)

---

## Success Criteria

### Code Quality

- ✅ 94% reduction in doctor.ts file size (1,727 → 100 lines)
- ✅ 80%+ test coverage on all new libraries
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors
- ✅ All existing tests pass

### Functionality

- ✅ doctor command behavior unchanged (user-facing)
- ✅ All CLI options work: --json, --verbose, --wsl2
- ✅ WSL2 detection still works
- ✅ Error handling maintains "never fail" principle
- ✅ Sequential execution preserved

### Architecture

- ✅ Clean separation: domain types, core logic, formatters
- ✅ Dependency injection throughout
- ✅ OutputPort abstraction used consistently
- ✅ Follows Nx organization philosophy
- ✅ Reusable diagnostic modules created

### Documentation

- ✅ All public APIs have JSDoc comments
- ✅ README updated for new libraries
- ✅ ARCHITECTURE.md includes new structure
- ✅ This refactoring plan in docs/

---

## Summary

### Task Breakdown (Sequential)

- **Phase 1:** 4 tasks, 1.5 hours - Type definitions
- **Phase 2:** 7 tasks, 8.5 hours - Checker classes
- **Phase 3:** 8 tasks, 10.5 hours - Formatter classes
- **Phase 4:** 3 tasks, 5 hours - Orchestrator
- **Phase 5:** 4 tasks, 3.5 hours - Simplify doctor.ts
- **Phase 6:** 8 tasks, 18.5 hours - Tests

**Total: 34 tasks, 47.5 hours (~6 days)**

### Task Breakdown (Parallel - 6 Workstreams)

- **Phase 1 (Foundation):** 1.5 hours - Type definitions
- **Parallel Work:** 6.5 hours - All checkers & formatters with tests
  - Workstream A1: 6 hours
  - Workstream A2: 5 hours
  - Workstream A3: 6.5 hours (critical path)
  - Workstream B1: 5 hours
  - Workstream B2: 4 hours
  - Workstream B3: 4.5 hours
- **Integration Checkpoint:** 0.5 hours - Wire up exports
- **Phase 4 (Orchestrator):** 5 hours - Build orchestrator
- **Phase 5 (Integration):** 3.5 hours - Simplify doctor.ts
- **E2E Tests:** 2 hours - End-to-end validation

**Total: 19 hours (~2.5 days) - 60% time reduction**

### Libraries Created/Modified

1. **NEW:** `libs/domain/diagnostics-types` (150 lines)
2. **MODIFIED:** `libs/core/diagnostics` (+700 lines)
3. **MODIFIED:** `libs/shared/formatters` (+820 lines)
4. **MODIFIED:** `apps/cli/src/cli/commands/doctor.ts` (1,727 → 100 lines)

### Key Benefits

- **Reusability:** Diagnostic modules can be used by other commands
- **Testability:** 80%+ coverage with isolated unit tests
- **Maintainability:** Single responsibility, clear boundaries
- **Type Safety:** Strong TypeScript types throughout
- **TUI-Ready:** OutputPort abstraction for future TUI
- **Never Fails:** Robust error handling, always returns results

---

## Next Steps

### Option A: Sequential Execution (Single Developer - 6 days)

1. **Review this plan** with the team
2. **Create feature branch:** `feat/doctor-refactoring`
3. **Tag current state:** `pre-doctor-refactor`
4. **Execute Phase 1** (types) and get review
5. **Execute Phase 2-3** (checkers/formatters) and get review
6. **Execute Phase 4-5** (orchestrator/integration) and get review
7. **Execute Phase 6** (tests) and verify coverage
8. **Manual testing** with all CLI options
9. **Final review** and merge to main
10. **Monitor** for issues, keep rollback ready

### Option B: Parallel Execution (6 AI Agents - 2.5 days) ⭐ RECOMMENDED

1. **Review this plan** with the team
2. **Create feature branch:** `feat/doctor-refactoring`
3. **Tag current state:** `pre-doctor-refactor`
4. **Execute Phase 1** (single agent: 1.5h)
5. **Launch 6 parallel agents** for workstreams A1, A2, A3, B1, B2, B3 (6.5h)
6. **Integration checkpoint** (single agent: 0.5h)
7. **Execute Phase 4** (single agent: 5h)
8. **Execute Phase 5** (single agent: 3.5h)
9. **Execute E2E tests** (single agent: 2h)
10. **Manual testing** with all CLI options
11. **Final review** and merge to main
12. **Monitor** for issues, keep rollback ready

---

**Plan Generated:** December 31, 2025  
**Last Updated:** December 31, 2025 (Added parallel execution strategy)  
**Next Review:** Before Phase 1 execution  
**Status:** Ready for implementation  
**Recommended Approach:** Parallel execution with 6 workstreams (60% faster)
