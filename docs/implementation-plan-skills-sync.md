# Skills Sync Implementation Plan

**Created:** December 24, 2025  
**Status:** Ready for Implementation  
**Related:** [Research Plan](../RESEARCH_PLAN_SKILLS.md) | [CLI Feature Comparison](archive/research/cli-feature-comparison-2025-12-24.md)

---

## Overview

This document provides a detailed implementation plan for adding Agent Skills synchronization to Overture. Skills are SKILL.md files that provide specialized instructions to AI coding assistants.

### Key Decisions (Confirmed)

| Decision       | Choice                                      | Rationale                             |
| -------------- | ------------------------------------------- | ------------------------------------- |
| Skill source   | `~/.config/overture/skills/<name>/SKILL.md` | Single source of truth in config repo |
| Registration   | Auto-discovery (no config.yaml entry)       | Simpler UX, less config               |
| Sync direction | One-way (config repo → dotfiles)            | Avoids conflict resolution            |
| Copy source    | Config repo (not dotfiles)                  | Config repo is source of truth        |

### Target Paths by Client

| Client      | Global Path                         | Project Path                      |
| ----------- | ----------------------------------- | --------------------------------- |
| Claude Code | `~/.claude/skills/<name>/SKILL.md`  | `.claude/skills/<name>/SKILL.md`  |
| Copilot CLI | `~/.github/skills/<name>/SKILL.md`  | `.github/skills/<name>/SKILL.md`  |
| OpenCode    | `~/.opencode/skill/<name>/SKILL.md` | `.opencode/skill/<name>/SKILL.md` |

Note: OpenCode uses singular `skill/` while others use plural `skills/`.

---

## Architecture

### Data Flow

```
~/.config/overture/skills/           # Source of truth (user-managed)
    └── debugging/
        └── SKILL.md
    └── code-review/
        └── SKILL.md

        │
        │ overture sync
        ▼

~/.claude/skills/debugging/SKILL.md      # Claude Code global
~/.github/skills/debugging/SKILL.md      # Copilot CLI global
~/.opencode/skill/debugging/SKILL.md     # OpenCode global

        │
        │ overture skill cp debugging
        ▼

./project/.claude/skills/debugging/SKILL.md   # Project-level
./project/.github/skills/debugging/SKILL.md
./project/.opencode/skill/debugging/SKILL.md
```

### New Components

```
libs/
├── core/
│   └── skill/                          # NEW: Skill sync library
│       ├── src/
│       │   ├── lib/
│       │   │   ├── skill-discovery.ts      # Scan skills/ directory
│       │   │   ├── skill-discovery.spec.ts
│       │   │   ├── skill-sync-service.ts   # Sync to client directories
│       │   │   ├── skill-sync-service.spec.ts
│       │   │   ├── skill-copy-service.ts   # Copy to project
│       │   │   └── skill-copy-service.spec.ts
│       │   └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
│
├── domain/
│   └── config-types/
│       └── src/lib/
│           └── skill.types.ts          # NEW: Skill type definitions
│
└── adapters/
    └── client-adapters/
        └── src/lib/
            └── skill-paths.ts          # NEW: Per-client skill paths

apps/
└── cli/
    └── src/
        └── cli/commands/
            ├── skill.ts                # NEW: skill command group
            ├── skill-list.ts           # NEW: skill list subcommand
            └── skill-cp.ts             # NEW: skill cp subcommand
```

---

## Implementation Tasks

### Phase 1: Foundation (Types & Discovery)

#### Task 1.1: Add Skill Types

**File:** `libs/domain/config-types/src/lib/skill.types.ts`  
**Effort:** 30 min

```typescript
/**
 * Skill Domain Type Definitions
 */

/**
 * Discovered skill from the skills/ directory
 */
export interface DiscoveredSkill {
  /** Skill name (directory name) */
  name: string;
  /** Full path to SKILL.md file */
  path: string;
  /** Description extracted from SKILL.md (first paragraph or frontmatter) */
  description?: string;
}

/**
 * Result of syncing a skill to a client
 */
export interface SkillSyncResult {
  /** Skill name */
  skill: string;
  /** Client name */
  client: ClientName;
  /** Target path where skill was synced */
  targetPath: string;
  /** Whether sync succeeded */
  success: boolean;
  /** Whether skill was skipped (already exists) */
  skipped?: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Summary of skill sync operation
 */
export interface SkillSyncSummary {
  /** Total skills discovered */
  total: number;
  /** Successfully synced */
  synced: number;
  /** Skipped (already exists) */
  skipped: number;
  /** Failed */
  failed: number;
  /** Per-skill results */
  results: SkillSyncResult[];
}

/**
 * Options for skill discovery
 */
export interface SkillDiscoveryOptions {
  /** Custom skills directory path (default: ~/.config/overture/skills/) */
  skillsDir?: string;
}

/**
 * Options for skill sync
 */
export interface SkillSyncOptions {
  /** Force overwrite existing skills */
  force?: boolean;
  /** Specific clients to sync to */
  clients?: ClientName[];
  /** Dry run mode */
  dryRun?: boolean;
}

/**
 * Options for skill copy (to project)
 */
export interface SkillCopyOptions {
  /** Force overwrite existing skills */
  force?: boolean;
  /** Specific clients to copy for */
  clients?: ClientName[];
  /** Project root directory */
  projectRoot?: string;
}
```

**Tests:** Type-only file, no runtime tests needed.

---

#### Task 1.2: Create Skill Discovery Service

**File:** `libs/core/skill/src/lib/skill-discovery.ts`  
**Effort:** 1 hour

```typescript
/**
 * Skill Discovery Service
 *
 * Scans the skills/ directory in the Overture config repo
 * and returns a list of discovered skills.
 */
export class SkillDiscovery {
  constructor(
    private filesystem: FilesystemPort,
    private environment: EnvironmentPort,
  ) {}

  /**
   * Discover all skills in the config repo
   */
  async discoverSkills(
    options?: SkillDiscoveryOptions,
  ): Promise<DiscoveredSkill[]>;

  /**
   * Get a specific skill by name
   */
  async getSkill(
    name: string,
    options?: SkillDiscoveryOptions,
  ): Promise<DiscoveredSkill | null>;

  /**
   * Check if skills directory exists
   */
  async hasSkillsDirectory(options?: SkillDiscoveryOptions): Promise<boolean>;

  /**
   * Get the default skills directory path
   */
  getSkillsDirectoryPath(): string;

  /**
   * Extract description from SKILL.md content
   * Tries frontmatter first, then first paragraph
   */
  private extractDescription(content: string): string | undefined;
}
```

**Test Cases:**

- Discover skills from directory with multiple skills
- Return empty array when no skills directory
- Return empty array when skills directory is empty
- Extract description from frontmatter if present
- Extract description from first paragraph if no frontmatter
- Handle malformed SKILL.md files gracefully

---

#### Task 1.3: Add Skill Paths to Client Adapters

**File:** `libs/adapters/client-adapters/src/lib/skill-paths.ts`  
**Effort:** 45 min

```typescript
/**
 * Skill Path Resolution
 *
 * Provides per-client skill directory paths.
 */

export interface SkillPaths {
  /** Global skill directory (user-level) */
  global: string;
  /** Project skill directory */
  project: string;
}

/**
 * Get skill paths for a specific client
 */
export function getSkillPaths(
  client: ClientName,
  homeDir: string,
  projectRoot?: string,
): SkillPaths {
  switch (client) {
    case 'claude-code':
      return {
        global: `${homeDir}/.claude/skills`,
        project: projectRoot
          ? `${projectRoot}/.claude/skills`
          : '.claude/skills',
      };
    case 'copilot-cli':
      return {
        global: `${homeDir}/.github/skills`,
        project: projectRoot
          ? `${projectRoot}/.github/skills`
          : '.github/skills',
      };
    case 'opencode':
      return {
        global: `${homeDir}/.opencode/skill`, // Note: singular
        project: projectRoot
          ? `${projectRoot}/.opencode/skill`
          : '.opencode/skill',
      };
    default:
      throw new Error(`Unknown client: ${client}`);
  }
}

/**
 * Get full path to a specific skill for a client
 */
export function getSkillPath(
  client: ClientName,
  skillName: string,
  scope: 'global' | 'project',
  homeDir: string,
  projectRoot?: string,
): string {
  const paths = getSkillPaths(client, homeDir, projectRoot);
  const base = scope === 'global' ? paths.global : paths.project;
  return `${base}/${skillName}/SKILL.md`;
}
```

**Test Cases:**

- Return correct paths for each client
- Handle missing projectRoot for project paths
- OpenCode uses singular `skill/` not `skills/`

---

### Phase 2: Skill Sync Service

#### Task 2.1: Create Skill Sync Service

**File:** `libs/core/skill/src/lib/skill-sync-service.ts`  
**Effort:** 2 hours

```typescript
/**
 * Skill Sync Service
 *
 * Syncs skills from the Overture config repo to client-specific
 * global skill directories.
 */
export class SkillSyncService {
  constructor(
    private filesystem: FilesystemPort,
    private environment: EnvironmentPort,
    private skillDiscovery: SkillDiscovery,
    private output: OutputPort,
  ) {}

  /**
   * Sync all skills to all clients
   */
  async syncSkills(options?: SkillSyncOptions): Promise<SkillSyncSummary>;

  /**
   * Sync a single skill to all clients
   */
  async syncSkill(
    skill: DiscoveredSkill,
    options?: SkillSyncOptions,
  ): Promise<SkillSyncResult[]>;

  /**
   * Sync a skill to a specific client
   */
  private async syncSkillToClient(
    skill: DiscoveredSkill,
    client: ClientName,
    options?: SkillSyncOptions,
  ): Promise<SkillSyncResult>;

  /**
   * Check if skill already exists at target
   */
  private async skillExists(targetPath: string): Promise<boolean>;

  /**
   * Copy skill directory to target
   */
  private async copySkillDirectory(
    sourcePath: string,
    targetPath: string,
  ): Promise<void>;
}
```

**Test Cases:**

- Sync multiple skills to multiple clients
- Skip existing skills by default
- Overwrite existing skills with --force
- Create target directories if they don't exist
- Handle missing source skill gracefully
- Return correct summary counts
- Dry run mode logs but doesn't write

---

### Phase 3: Skill Copy Service (to Project)

#### Task 3.1: Create Skill Copy Service

**File:** `libs/core/skill/src/lib/skill-copy-service.ts`  
**Effort:** 1.5 hours

```typescript
/**
 * Skill Copy Service
 *
 * Copies skills from the Overture config repo to project directories.
 * This is for sharing skills with team members via version control.
 */
export class SkillCopyService {
  constructor(
    private filesystem: FilesystemPort,
    private environment: EnvironmentPort,
    private skillDiscovery: SkillDiscovery,
    private output: OutputPort,
  ) {}

  /**
   * Copy a skill to the current project
   */
  async copySkillToProject(
    skillName: string,
    options?: SkillCopyOptions,
  ): Promise<SkillSyncResult[]>;

  /**
   * Check if skill exists in project
   */
  async skillExistsInProject(
    skillName: string,
    client: ClientName,
    projectRoot: string,
  ): Promise<boolean>;
}
```

**Test Cases:**

- Copy skill to all three client directories in project
- Skip existing skills by default
- Overwrite with --force
- Create nested directories as needed
- Error if skill doesn't exist in config repo
- Copy only to specified client with --client flag

---

### Phase 4: CLI Commands

#### Task 4.1: Add Skill Command Group

**File:** `apps/cli/src/cli/commands/skill.ts`  
**Effort:** 30 min

```typescript
export function createSkillCommand(deps: AppDependencies): Command {
  const command = new Command('skill');

  command
    .description('Manage Agent Skills')
    .addCommand(createSkillListCommand(deps))
    .addCommand(createSkillCpCommand(deps));

  return command;
}
```

---

#### Task 4.2: Implement `skill list` Command

**File:** `apps/cli/src/cli/commands/skill-list.ts`  
**Effort:** 45 min

```typescript
export function createSkillListCommand(deps: AppDependencies): Command {
  const command = new Command('list');

  command
    .description('List available skills from config repo')
    .option('--json', 'Output as JSON')
    .option('--source', 'Show source path')
    .action(async (options) => {
      const skills = await deps.skillDiscovery.discoverSkills();

      if (options.json) {
        console.log(JSON.stringify(skills, null, 2));
        return;
      }

      // Table format output
      console.log('NAME          DESCRIPTION');
      for (const skill of skills) {
        console.log(`${skill.name.padEnd(14)}${skill.description || ''}`);
        if (options.source) {
          console.log(`              ${skill.path}`);
        }
      }
    });

  return command;
}
```

**Example Output:**

```
$ overture skill list
NAME          DESCRIPTION
debugging     Advanced debugging techniques for complex issues
code-review   Code review best practices and checklists

$ overture skill list --source
NAME          DESCRIPTION
debugging     Advanced debugging techniques for complex issues
              /home/user/.config/overture/skills/debugging/SKILL.md
```

---

#### Task 4.3: Implement `skill cp` Command

**File:** `apps/cli/src/cli/commands/skill-cp.ts`  
**Effort:** 1 hour

```typescript
export function createSkillCpCommand(deps: AppDependencies): Command {
  const command = new Command('cp');

  command
    .description('Copy a skill to the current project')
    .argument('<name>', 'Skill name to copy')
    .option('--force', 'Overwrite if skill exists in project')
    .option('--client <name>', 'Only copy for specified client')
    .action(async (name: string, options) => {
      const results = await deps.skillCopyService.copySkillToProject(name, {
        force: options.force,
        clients: options.client ? [options.client] : undefined,
      });

      // Output results
      console.log(`Copied '${name}' skill:`);
      for (const result of results) {
        const status = result.success ? '✓' : result.skipped ? '○' : '✗';
        console.log(`  ${status} ${result.targetPath}`);
      }
    });

  return command;
}
```

**Example Output:**

```
$ overture skill cp debugging
Copied 'debugging' skill:
  ✓ .claude/skills/debugging/SKILL.md
  ✓ .github/skills/debugging/SKILL.md
  ✓ .opencode/skill/debugging/SKILL.md

$ overture skill cp debugging
Copied 'debugging' skill:
  ○ .claude/skills/debugging/SKILL.md (skipped, already exists)
  ○ .github/skills/debugging/SKILL.md (skipped, already exists)
  ○ .opencode/skill/debugging/SKILL.md (skipped, already exists)
```

---

### Phase 5: Integrate with Sync Command

#### Task 5.1: Add Skills to Sync Engine

**File:** `libs/core/sync/src/lib/sync-engine.ts`  
**Effort:** 1.5 hours

Add skill sync to the existing `syncClients()` method:

```typescript
// In SyncEngineDeps interface:
skillSyncService?: SkillSyncService;

// In syncClients():
async syncClients(options: SyncOptions = {}): Promise<SyncResult> {
  // ... existing MCP sync logic ...

  // 2. Sync skills (after plugins, before MCP)
  let skillSyncSummary: SkillSyncSummary | undefined;
  if (!options.skipSkills) {
    try {
      skillSyncSummary = await this.syncSkills(options);
    } catch (error) {
      // Log warning but don't fail entire sync
      this.deps.output.warn(`⚠️  Skill sync failed: ${(error as Error).message}`);
      warnings.push(`Skill sync failed: ${(error as Error).message}`);
    }
  }

  // ... rest of sync logic ...

  return {
    success,
    results,
    warnings,
    errors,
    pluginSyncDetails,
    skillSyncSummary,  // NEW
  };
}
```

---

#### Task 5.2: Add Sync Command Flags

**File:** `apps/cli/src/cli/commands/sync.ts`  
**Effort:** 30 min

Add new options:

```typescript
.option('--skills-only', 'Only sync skills (skip MCP and plugins)')
.option('--mcp-only', 'Only sync MCP configs (skip skills and plugins)')
.option('--skip-skills', 'Skip skill sync')
```

Update output to include skill summary:

```
$ overture sync

Syncing to 3 clients...

MCP Configuration:
  ✓ claude-code: ~/.claude.json (3 servers)
  ✓ copilot-cli: ~/.config/github-copilot/mcp.json (3 servers)
  ✓ opencode: ~/.config/opencode/opencode.json (3 servers)

Skills:
  ✓ debugging → 3 clients
  ✓ code-review → 3 clients

Summary: 3 MCP servers, 2 skills synced to 3 clients
```

---

### Phase 6: Library Setup & Wiring

#### Task 6.1: Create libs/core/skill Library

**Effort:** 45 min

Create the Nx library structure:

```bash
nx g @nx/js:library skill-core --directory=libs/core/skill \
  --importPath=@overture/skill-core \
  --unitTestRunner=vitest \
  --bundler=tsc
```

Files to create:

- `libs/core/skill/package.json`
- `libs/core/skill/tsconfig.json`
- `libs/core/skill/tsconfig.lib.json`
- `libs/core/skill/tsconfig.spec.json`
- `libs/core/skill/vite.config.ts`
- `libs/core/skill/README.md`
- `libs/core/skill/src/index.ts`

---

#### Task 6.2: Update Composition Root

**File:** `apps/cli/src/composition-root.ts`  
**Effort:** 30 min

Wire up the new services:

```typescript
import {
  SkillDiscovery,
  SkillSyncService,
  SkillCopyService,
} from '@overture/skill-core';

export function createAppDependencies(): AppDependencies {
  // ... existing code ...

  // Skill services
  const skillDiscovery = new SkillDiscovery(filesystem, environment);
  const skillSyncService = new SkillSyncService(
    filesystem,
    environment,
    skillDiscovery,
    output,
  );
  const skillCopyService = new SkillCopyService(
    filesystem,
    environment,
    skillDiscovery,
    output,
  );

  // Update syncEngine deps
  const syncEngine = createSyncEngine({
    ...existingDeps,
    skillSyncService,
  });

  return {
    ...existingDeps,
    skillDiscovery,
    skillSyncService,
    skillCopyService,
  };
}
```

---

#### Task 6.3: Register Skill Command

**File:** `apps/cli/src/cli/cli.ts`  
**Effort:** 15 min

```typescript
import { createSkillCommand } from './commands/skill.js';

// In createCli():
program.addCommand(createSkillCommand(deps));
```

---

### Phase 7: Documentation

#### Task 7.1: Update User Guide

**File:** `docs/user-guide.md`  
**Effort:** 30 min

Add Skills section:

- What are Agent Skills
- How to create skills in config repo
- Syncing skills with `overture sync`
- Copying skills to projects with `overture skill cp`

---

#### Task 7.2: Update README

**File:** `README.md`  
**Effort:** 15 min

Update feature list and quick start to mention skills.

---

## Task Summary

| Phase | Task                           | Effort    | Priority |
| ----- | ------------------------------ | --------- | -------- |
| 1     | Add Skill Types                | 30 min    | High     |
| 1     | Create Skill Discovery Service | 1 hour    | High     |
| 1     | Add Skill Paths to Adapters    | 45 min    | High     |
| 2     | Create Skill Sync Service      | 2 hours   | High     |
| 3     | Create Skill Copy Service      | 1.5 hours | Medium   |
| 4     | Add Skill Command Group        | 30 min    | Medium   |
| 4     | Implement `skill list` Command | 45 min    | Medium   |
| 4     | Implement `skill cp` Command   | 1 hour    | Medium   |
| 5     | Add Skills to Sync Engine      | 1.5 hours | High     |
| 5     | Add Sync Command Flags         | 30 min    | Medium   |
| 6     | Create libs/core/skill Library | 45 min    | High     |
| 6     | Update Composition Root        | 30 min    | High     |
| 6     | Register Skill Command         | 15 min    | Medium   |
| 7     | Update User Guide              | 30 min    | Low      |
| 7     | Update README                  | 15 min    | Low      |

**Total Estimated Effort:** ~12 hours

---

## Test Plan

### Unit Tests

| Component        | Test File                  | Coverage Target |
| ---------------- | -------------------------- | --------------- |
| SkillDiscovery   | skill-discovery.spec.ts    | 90%             |
| SkillSyncService | skill-sync-service.spec.ts | 85%             |
| SkillCopyService | skill-copy-service.spec.ts | 85%             |
| getSkillPaths    | skill-paths.spec.ts        | 100%            |

### Integration Tests

| Scenario              | Description                                |
| --------------------- | ------------------------------------------ |
| Full sync with skills | `overture sync` discovers and syncs skills |
| Skills-only sync      | `--skills-only` flag works correctly       |
| Skill copy workflow   | `skill cp` copies to project correctly     |

### E2E Tests

| Scenario                    | Description                               |
| --------------------------- | ----------------------------------------- |
| End-to-end skill management | Create skill, sync, verify in dotfiles    |
| Project skill copy          | Copy skill to project, verify files exist |

---

## Rollout Plan

1. **Phase 1-2:** Foundation + Sync Service (MVP)
   - Users can sync skills with `overture sync`
   - No new CLI commands yet

2. **Phase 3-4:** Copy Service + Commands
   - Add `skill list` and `skill cp` commands
   - Full feature set

3. **Phase 5-7:** Integration + Documentation
   - Integrate with sync command flags
   - Update documentation

---

## Open Questions

1. **Skill validation:** Should we validate SKILL.md format? (Defer for now)
2. **Skill versioning:** Should we track skill versions? (Out of scope)
3. **Skill dependencies:** Can skills reference other skills? (Out of scope)

---

## Appendix: Example SKILL.md

```markdown
---
name: debugging
description: Advanced debugging techniques for complex issues
---

# Debugging Skill

When asked to debug issues, follow these steps:

1. **Reproduce the issue** - Ensure you can consistently trigger the bug
2. **Isolate the problem** - Use binary search to narrow down the cause
3. **Check logs** - Look for error messages and stack traces
4. **Verify assumptions** - Test your hypotheses systematically
5. **Fix and verify** - Make the fix and confirm it resolves the issue

## Tools to Use

- Use the `read` tool to examine relevant source files
- Use the `grep` tool to search for related code
- Use the `bash` tool to run tests and verify fixes
```
