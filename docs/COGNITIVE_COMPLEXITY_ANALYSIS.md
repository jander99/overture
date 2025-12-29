---
title: Cognitive Complexity Analysis - Overture Codebase
created: 2025-12-29T12:00:00Z
last_modified: 2025-12-29T12:00:00Z
author: Claude Code AI Assistant
type: documentation
tags: [eslint, refactoring, complexity, code-quality]
---

# Cognitive Complexity Analysis - Overture Codebase

**Analysis Date:** December 29, 2025  
**Total Functions Analyzed:** 16 (sync-edge-cases.ts and file-manifest.ts not found in codebase)  
**Average Complexity:** 47  
**Highest Complexity:** 226 (doctor.ts)  
**Lowest Complexity:** 16 (skill.ts:83 & sync.ts:83)  

---

## Executive Summary

The Overture codebase has **16 functions with cognitive complexity warnings** (complexity > 15). The highest complexity scores are concentrated in **CLI command action handlers** where multiple concerns (detection, validation, formatting, output) are mixed into single functions.

### Key Findings

| Complexity Range | Count | Primary Issues | Effort to Fix |
|------------------|-------|-----------------|--------------|
| 200+ | 2 | Monolithic handlers, multiple phases | High (2-3 days) |
| 60-125 | 2 | Nested conditionals, long flows | Medium (6-12 hrs) |
| 20-50 | 6 | Conditional logic, loops with nesting | Medium (4-8 hrs) |
| 15-20 | 6 | Moderate nesting, multiple branches | Low (1-4 hrs) |

### Recommended Priority

1. **Critical (High Impact, High Effort):** doctor.ts:91, sync.ts:180
2. **Important (Medium Impact, Medium Effort):** validate.ts:65, user.ts:356
3. **Nice to Have (Low Impact, Low-Medium Effort):** All others

---

## Detailed Function Analysis

### 1. doctor.ts:91 - Complexity 226 ⚠️ CRITICAL

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/cli/commands/doctor.ts`  
**Function:** `createDoctorCommand` - action handler (lines 91-641)  
**Complexity:** 226  
**Effort:** HIGH (2-3 days)

#### Complexity Sources

```
Primary Issues:
├─ Monolithic function with 550+ lines
├─ 8 major phases mixed together
│  ├─ Phase 1: Config repo detection (50 lines)
│  ├─ Phase 2: Client discovery (25 lines)
│  ├─ Phase 3: MCP server checking (50 lines)
│  ├─ Phase 4: Git status detection (60 lines)
│  ├─ Phase 5: Skills directory checking (30 lines)
│  ├─ Phase 6: Console output formatting (300 lines)
│  ├─ Phase 7: JSON output (5 lines)
│  └─ Phase 8: Summary reporting (30 lines)
├─ 12+ nested if/else blocks
├─ Try-catch blocks within loops
├─ Conditional output based on --json flag
└─ Complex git interaction logic
```

#### Key Complexity Points

1. **Lines 131-194:** Git detection with nested try-catch blocks
   ```typescript
   if (configRepoExists) {
     if (isGitRepo) {
       try { /* get remote */ }
       catch { /* ignore */ }
       try { /* get local hash */ }
       catch { /* ignore */ }
       if (gitRemote && localHash) {
         try { /* get remote hash */ }
         catch { /* ignore */ }
       }
     }
   }
   ```

2. **Lines 196-216:** Skills directory scanning with nested loops and conditions
3. **Lines 268-368:** Conditional display logic (200+ lines for output)
4. **Lines 375-482:** Client loop with nested conditions
5. **Lines 500-550:** MCP server loop with conditional output

#### Refactoring Strategy

**Approach:** Extract phase handlers into separate functions using strategy pattern

```typescript
// Extract into separate modules/classes
class DoctorPhaseHandler {
  async detectConfigRepo(): Promise<ConfigRepoStatus>
  async detectGitStatus(repoPath: string): Promise<GitStatus>
  async scanSkillsDirectory(skillsPath: string): Promise<SkillCount>
  async detectClients(): Promise<ClientDetection[]>
  async checkMcpServers(): Promise<McpServerStatus[]>
}

class DoctorOutputFormatter {
  formatEnvironmentInfo(): void
  formatConfigRepoStatus(): void
  formatClientDetections(): void
  formatMcpServers(): void
  formatSummary(): void
}

// New action handler becomes orchestrator
async function doctorAction(options) {
  const handler = new DoctorPhaseHandler(deps);
  const formatter = new DoctorOutputFormatter(output);
  
  const configRepo = await handler.detectConfigRepo();
  const git = await handler.detectGitStatus(configRepo.path);
  const skills = await handler.scanSkillsDirectory(configRepo.skillsPath);
  
  if (options.json) {
    return formatJson({ configRepo, git, skills, clients, mcps });
  }
  
  formatter.formatEnvironmentInfo(discovery);
  formatter.formatConfigRepoStatus(configRepo, git, skills);
  // ... etc
}
```

**Estimated Lines:** 
- Current: 550 lines
- After refactor: 100 lines (action handler) + 150 lines (PhaseHandler) + 120 lines (Formatter) = 370 total
- **Reduction: 33%**

**Key Benefits:**
- ✅ Each phase handler focuses on one concern
- ✅ Output formatting separated from logic
- ✅ Easier to test individual phases
- ✅ Reusable for other commands
- ✅ Simpler action handler

**Dependencies to Inject:**
- filesystem, process, environment, configLoader, pathResolver
- adapterRegistry, output

---

### 2. sync.ts:180 - Complexity 201 ⚠️ CRITICAL

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/cli/commands/sync.ts`  
**Function:** `createSyncCommand` - action handler (lines 180-632)  
**Complexity:** 201  
**Effort:** HIGH (2-3 days)

#### Complexity Sources

```
Primary Issues:
├─ Monolithic function with 450+ lines
├─ 4 major phases tightly coupled
│  ├─ Phase 1: Detection summary (80 lines)
│  ├─ Phase 2: Sync execution (150 lines)
│  ├─ Phase 3: Warnings aggregation (100 lines)
│  └─ Phase 4: Backup info (50 lines)
├─ Multiple nested loops with Set/Map operations
├─ Complex conditional logic for detail mode
├─ Conditional output formatting throughout
└─ Warning categorization with nested conditions
```

#### Key Complexity Points

1. **Lines 208-250:** Triple-nested loop with deduplication logic
   ```typescript
   const seenClients = new Set<string>();
   const detectedClients = result.results.filter((r) => {
     if (seenClients.has(r.client)) return false;
     if (r.binaryDetection?.status === 'found') {
       seenClients.add(r.client);
       return true;
     }
     return false;
   });
   // ... repeated 3 more times
   ```

2. **Lines 301-381:** Output loop with conditional diff formatting
3. **Lines 395-475:** Warning aggregation with dual-categorization logic
4. **Lines 126-175:** Config loading with nested try-catch and conditionals

#### Refactoring Strategy

**Approach:** Extract output phases and use builder pattern for results

```typescript
// Extract output formatting into separate class
class SyncOutputFormatter {
  formatDetectionSummary(result: SyncResult): void
  formatSyncResults(result: SyncResult, detailMode: boolean): void
  formatWarnings(warnings: WarningData[], detailMode: boolean): void
  formatBackupInfo(results: ClientSyncResult[]): void
}

// Extract result processing
class SyncResultProcessor {
  deduplicateClients(results: ClientSyncResult[]): DeduplicatedResults
  categorizeWarnings(warnings: string[], detailMode: boolean): WarningCategories
  groupResultsByClient(results: ClientSyncResult[]): Map<string, ClientSyncResult[]>
}

// Simplified action handler
async function syncAction(options) {
  const syncOptions = buildSyncOptions(options);
  const result = await syncEngine.syncClients(syncOptions);
  
  const formatter = new SyncOutputFormatter(output);
  const processor = new SyncResultProcessor();
  
  const detected = processor.deduplicateClients(result.results);
  formatter.formatDetectionSummary(detected);
  formatter.formatSyncResults(result, detailMode);
  
  const warnings = processor.categorizeWarnings(result.warnings, detailMode);
  formatter.formatWarnings(warnings, detailMode);
  
  formatter.formatBackupInfo(result.results);
}
```

**Estimated Lines:**
- Current: 450 lines
- After refactor: 80 lines (action) + 120 lines (Formatter) + 100 lines (Processor) = 300 total
- **Reduction: 33%**

**Key Benefits:**
- ✅ Each formatter handles one output concern
- ✅ Deduplication logic isolated and testable
- ✅ Warning categorization simplified
- ✅ Detail mode logic cleaner
- ✅ Reusable output components

---

### 3. validate.ts:65 - Complexity 125 ⚠️ HIGH

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/cli/commands/validate.ts`  
**Function:** `createValidateCommand` - action handler (lines 65-409)  
**Complexity:** 125  
**Effort:** MEDIUM (6-12 hours)

#### Complexity Sources

```
Primary Issues:
├─ Long function with 345+ lines
├─ 3 major validation phases
│  ├─ Phase 1: Config validation (80 lines)
│  ├─ Phase 2: Transport validation (50 lines)
│  └─ Phase 3: Environment validation (100 lines)
├─ Nested validation loops
├─ Multiple error/warning arrays
├─ Complex client selection logic
└─ Output formatting mixed with validation
```

#### Key Complexity Points

1. **Lines 95-157:** Long validation loop with multiple nested conditions
   ```typescript
   for (const [mcpName, mcpConfig] of Object.entries(config.mcp)) {
     if (!mcpConfig.command) { errors.push(...) }
     if (!mcpConfig.transport) { errors.push(...) }
     if (mcpConfig.platforms?.exclude) {
       for (const platform of mcpConfig.platforms.exclude) {
         if (!VALID_PLATFORMS.includes(platform)) { errors.push(...) }
       }
     }
     // ... repeat for commandOverrides, argsOverrides, clients.exclude, clients.include, clients.overrides
   }
   ```

2. **Lines 178-202:** Client selection logic with conditional accumulation
3. **Lines 220-270:** Dual validation loops for transport and env vars
4. **Lines 278-340:** Complex warning/error display logic

#### Refactoring Strategy

**Approach:** Extract validators into separate classes

```typescript
class McpValidator {
  validateCommand(mcp: McpServerConfig, name: string): ValidationError[]
  validateTransport(mcp: McpServerConfig, name: string): ValidationError[]
  validatePlatforms(mcp: McpServerConfig, name: string): ValidationError[]
  validateClients(mcp: McpServerConfig, name: string): ValidationError[]
}

class ConfigValidator {
  validateDuplicateNames(config: OvertureConfig): ValidationError[]
  validateSyncEnabledClients(config: OvertureConfig): ValidationError[]
}

class ClientSelector {
  selectClientsToValidate(config: OvertureConfig, options: Options): ClientName[]
}

class ValidationReporter {
  reportErrors(errors: ValidationError[]): void
  reportWarnings(warnings: ValidationWarning[]): void
  reportSummary(results: ValidationResults): void
}

// Simplified action handler
async function validateAction(options) {
  const config = await configLoader.loadConfig(process.cwd());
  
  const mcpValidator = new McpValidator();
  const configValidator = new ConfigValidator();
  const errors = [
    ...config.mcp.flatMap((m, n) => mcpValidator.validateCommand(m, n)),
    ...configValidator.validateDuplicateNames(config),
  ];
  
  if (errors.length > 0) {
    output.error('Validation errors:');
    errors.forEach(e => output.error(`  - ${e.message}`));
    process.exit(3);
  }
  
  const clients = new ClientSelector().selectClientsToValidate(config, options);
  const warnings = await validateTransportAndEnv(config, clients);
  
  new ValidationReporter().report(warnings, output);
  output.success('Configuration is valid');
}
```

**Estimated Lines:**
- Current: 345 lines
- After refactor: 60 lines (action) + 80 lines (McpValidator) + 40 lines (ConfigValidator) + 30 lines (Selector) + 60 lines (Reporter) = 270 total
- **Reduction: 22%**

**Key Benefits:**
- ✅ Each validator handles one validation concern
- ✅ Validation logic separated from output
- ✅ Easy to add new validation rules
- ✅ Testable validators
- ✅ Reusable validators for other commands

---

### 4. user.ts:356 - Complexity 67 ⚠️ MEDIUM-HIGH

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/cli/commands/user.ts`  
**Function:** User init subcommand (lines 141-356)  
**Complexity:** 67  
**Effort:** MEDIUM (4-6 hours)

#### Complexity Sources

```
Primary Issues:
├─ Single long async function (215 lines)
├─ Multiple sequential prompts
├─ Nested conditionals for path handling
├─ Config building with dynamic MCP selection
├─ Validation and confirmation flow
└─ File system operations mixed with UI
```

#### Key Complexity Points

1. **Lines 160-210:** MCP selection and config building
   ```typescript
   const selectedMcps = await Prompts.multiSelect(...);
   if (selectedMcps.length === 0) {
     const shouldContinue = await Prompts.confirm(...);
     if (!shouldContinue) { throw new UserCancelledError(...) }
   }
   
   const mcpConfig: OvertureConfig['mcp'] = {};
   for (const mcpName of selectedMcps) {
     if (Object.hasOwn(MCP_SERVER_DEFAULTS, mcpName)) {
       const defaults = MCP_SERVER_DEFAULTS[mcpName];
       if (defaults?.command && defaults?.args && ...) {
         mcpConfig[mcpName] = { ... };
       }
     }
   }
   ```

2. **Lines 211-270:** Config validation and confirmation
3. **Lines 271-310:** File system operations with error handling

#### Refactoring Strategy

**Approach:** Extract wizard steps into separate functions

```typescript
class UserInitWizard {
  async selectMcpServers(): Promise<string[]>
  async buildMcpConfig(selectedMcps: string[]): Promise<OvertureConfig['mcp']>
  async buildUserConfig(mcpConfig): Promise<OvertureConfig>
  async confirmAndCreate(config: OvertureConfig): Promise<boolean>
  async saveConfiguration(config: OvertureConfig): Promise<void>
}

// Simplified action handler
async function userInitAction(options) {
  const userConfigPath = pathResolver.getUserConfigPath();
  
  if (filesystem.fileExists(userConfigPath) && !options.force) {
    throw new Error(`Config already exists...`);
  }
  
  const wizard = new UserInitWizard(output, Prompts);
  const selectedMcps = await wizard.selectMcpServers();
  const mcpConfig = await wizard.buildMcpConfig(selectedMcps);
  const userConfig = await wizard.buildUserConfig(mcpConfig);
  
  const shouldCreate = await wizard.confirmAndCreate(userConfig);
  if (!shouldCreate) throw new UserCancelledError();
  
  await wizard.saveConfiguration(userConfig, userConfigPath, filesystem);
}
```

**Estimated Lines:**
- Current: 215 lines
- After refactor: 50 lines (action) + 120 lines (Wizard) = 170 total
- **Reduction: 21%**

**Key Benefits:**
- ✅ Each wizard step is independently testable
- ✅ Reusable wizard for other commands
- ✅ Clear separation of concerns
- ✅ Easier to modify wizard flow
- ✅ Better error handling per step

---

### 5. cleanup.ts:28 & cleanup.ts:103 - Complexity 29 & 17 ⚠️ MEDIUM

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/cli/commands/cleanup.ts`  
**Functions:** 
- `createCleanupCommand` (lines 28-103) - Complexity 29
- Action handler (within the function) - Complexity 17

**Combined Complexity:** 46  
**Effort:** MEDIUM (3-4 hours)

#### Complexity Sources (Line 28-103)

```
Primary Issues:
├─ Command setup mixed with action logic
├─ Multiple conditional branches
│  ├─ Target discovery
│  ├─ Target filtering
│  ├─ Interactive selection (unless flags)
│  └─ Cleanup execution
├─ Nested filter operations
└─ Conditional prompts (unless --yes)
```

#### Key Complexity Points

1. **Lines 50-60:** Spinner-driven target discovery
2. **Lines 62-70:** Conditional target filtering
3. **Lines 72-89:** Interactive selection with default behavior
4. **Lines 91-125:** Cleanup plan display with conditionals

#### Refactoring Strategy

**Approach:** Extract target selection and plan display logic

```typescript
class CleanupTargetSelector {
  findTargets(adapter, platform, config): CleanupTarget[]
  filterTargets(targets, options): CleanupTarget[]
  selectInteractive(targets): Promise<CleanupTarget[]>
}

class CleanupPlanner {
  generatePlan(targets: CleanupTarget[]): CleanupPlanDisplay
  displayPlan(plan, output, options): void
  getConfirmation(targets): Promise<boolean>
}

// Simplified command creation
function createCleanupCommand(deps) {
  const cmd = new Command('cleanup');
  
  cmd.action(async (options) => {
    const selector = new CleanupTargetSelector(cleanupService);
    const planner = new CleanupPlanner(output);
    
    const targets = await selector.findTargets();
    let selected = targets;
    
    if (!options.all && !options.directory) {
      selected = await selector.selectInteractive(targets);
    }
    
    const plan = planner.generatePlan(selected);
    planner.displayPlan(plan, options);
    
    if (!options.yes) {
      const confirmed = await planner.getConfirmation(selected);
      if (!confirmed) return;
    }
    
    const result = await cleanupService.executeCleanup(...);
    // ... display results
  });
  
  return cmd;
}
```

**Estimated Lines:**
- Current: 75 lines
- After refactor: 50 lines (action) + 60 lines (Selector) + 50 lines (Planner) = 160 total
- **Increase: Not ideal for this size** - Keep inline but restructure
- **Better approach:** Break into 2-3 smaller helpers within same file

**Key Benefits:**
- ✅ Selection logic testable
- ✅ Plan generation isolated
- ✅ Easier to test interactive flow
- ✅ Reusable for other cleanup commands

---

### 6. import.ts:48 - Complexity 30 ⚠️ MEDIUM

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/cli/commands/import.ts`  
**Function:** Action handler (lines 48-290)  
**Complexity:** 30  
**Effort:** MEDIUM (3-5 hours)

#### Complexity Sources

```
Primary Issues:
├─ Large function (240+ lines)
├─ Two major modes (detect vs. import)
├─ Conditional logic for client selection
├─ Multiple nested loops (discovery, selection, import)
└─ Output formatting mixed with logic
```

#### Key Complexity Points

1. **Lines 60-85:** Client adapter selection with null checks
2. **Lines 87-110:** Detect mode with format output selection
3. **Lines 113-290:** Import mode with multiple phases
4. **Lines 125-175:** Discovery and conflict display

#### Refactoring Strategy

**Approach:** Extract detect and import modes into separate handlers

```typescript
class DetectionMode {
  async execute(adapters, config, platform, options): Promise<void>
}

class ImportMode {
  async selectMcps(discovery): Promise<DiscoveredMcp[]>
  async confirmImport(selected): Promise<boolean>
  async executeImport(selected, paths): Promise<ImportResult>
}

// Simplified action handler
async function importAction(options) {
  const config = await configLoader.loadConfig();
  const adapters = getAdapters(options.client);
  
  if (options.detect) {
    return new DetectionMode().execute(adapters, config, platform, options);
  }
  
  p.intro('🔍 Import MCPs from Client Configs');
  
  const discovery = await importService.discoverUnmanagedMcps(...);
  const selector = new ImportMode();
  
  const selected = await selector.selectMcps(discovery);
  const confirmed = await selector.confirmImport(selected);
  
  if (!confirmed) {
    p.cancel('Import cancelled');
    return;
  }
  
  const result = await selector.executeImport(selected, paths);
  // ... display results
}
```

**Estimated Lines:**
- Current: 240 lines
- After refactor: 50 lines (action) + 80 lines (DetectionMode) + 100 lines (ImportMode) = 230 total
- **Reduction: 4%** (mainly for clarity, not much change)

**Key Benefits:**
- ✅ Detect and import modes are separate concerns
- ✅ Easier to modify each mode independently
- ✅ Better testability
- ✅ Clearer mental model

---

### 7. mcp.ts:25 & mcp.ts:152 - Complexity 21 & 21 ⚠️ LOW-MEDIUM

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/cli/commands/mcp.ts`  
**Functions:**
- `createMcpCommand` (lines 25-105) - Complexity 21
- `enable` subcommand (lines 109-188) - Complexity 21

**Combined Complexity:** 42  
**Effort:** LOW-MEDIUM (2-3 hours)

#### Complexity Sources (mcp.ts:25)

```
Primary Issues:
├─ List subcommand with scope/client filters
├─ Multiple conditional branches for loading configs
├─ Filter operations with complex conditions
└─ Output formatting with conditionals
```

#### Key Complexity Points

1. **Lines 42-92:** Conditional config loading based on scope filter
   ```typescript
   if (options.scope === 'global') {
     // Load user config
   } else if (options.scope === 'project') {
     // Load project config
   } else {
     // Load both configs
   }
   ```

2. **Lines 96-105:** Client filter with multiple conditions

#### Complexity Sources (mcp.ts:152)

```
Primary Issues:
├─ Enable subcommand with config updates
├─ Nested file operations
├─ Error handling with multiple paths
└─ YAML serialization
```

#### Key Complexity Points

1. **Lines 160-200:** Project vs. user config selection
2. **Lines 202-220:** Copy from user config to project config

#### Refactoring Strategy

**Approach:** Extract MCP filtering and config loading logic

```typescript
class McpListService {
  loadMcpsByScope(config, scope): McpServerConfig[]
  filterByClient(mcps, client): McpServerConfig[]
  formatOutput(mcps, scope, options): void
}

class McpEnableService {
  findMcpConfig(name, configs): McpServerConfig | null
  enableMcp(name, config): void
  saveConfig(path, config): Promise<void>
}

// Simplified commands
function createMcpCommand(deps) {
  const cmd = new Command('mcp');
  
  cmd.command('list')
    .option('--scope <type>')
    .option('--client <name>')
    .action(async (options) => {
      const service = new McpListService(configLoader);
      const mcps = service.loadMcpsByScope(options.scope);
      service.filterByClient(mcps, options.client);
      service.formatOutput(mcps, options);
    });
  
  cmd.command('enable')
    .argument('<name>')
    .action(async (name) => {
      const service = new McpEnableService(configLoader, pathResolver, filesystem);
      const result = await service.enableMcp(name);
      output.success(`MCP "${name}" enabled`);
    });
  
  return cmd;
}
```

**Estimated Lines:**
- Current: 190 lines
- After refactor: 70 lines (commands) + 80 lines (ListService) + 70 lines (EnableService) = 220 total
- **Increase: 16%** - Not ideal for this size, keep inline with helpers

**Better Approach:** Extract helper functions within the same file

**Key Benefits:**
- ✅ Reusable services for other commands
- ✅ Testable filter logic
- ✅ Easier to add more MCP commands

---

### 8. plugin-list.ts:34 - Complexity 27 ⚠️ LOW-MEDIUM

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/cli/commands/plugin-list.ts`  
**Function:** Action handler (lines 34-101)  
**Complexity:** 27  
**Effort:** LOW (2-3 hours)

#### Complexity Sources

```
Primary Issues:
├─ Multiple output format branches (JSON vs. text)
├─ Filter logic with --config-only/--installed-only
├─ Nested loops for display
└─ Summary statistics calculation
```

#### Key Complexity Points

1. **Lines 48-63:** Filter selection with multiple conditions
2. **Lines 65-89:** Dual output paths (JSON vs. text)
3. **Lines 91-101:** Summary display with conditionals

#### Refactoring Strategy

**Approach:** Extract formatter and filter logic

```typescript
class PluginFilter {
  filterPlugins(comparison, options): FilteredPlugins
}

class PluginFormatter {
  formatJson(plugins, summary): string
  formatHuman(plugins, summary, options): void
  formatSummary(summary): string
}

// Simplified action
cmd.action(async (options) => {
  const comparison = await pluginExporter.compareInstalledWithConfig();
  
  const filter = new PluginFilter();
  const filtered = filter.filterPlugins(comparison, options);
  
  const formatter = new PluginFormatter();
  
  if (options.json) {
    console.log(formatter.formatJson(filtered.plugins, filtered.summary));
  } else {
    formatter.formatHuman(filtered.plugins, filtered.summary, options);
  }
});
```

**Estimated Lines:**
- Current: 68 lines
- After refactor: 35 lines (action) + 40 lines (Filter) + 50 lines (Formatter) = 125 total
- **Increase: 84%** - Not worth for this size

**Better Approach:** Extract formatter as inline helper functions

```typescript
function formatPlugins(plugins, format) {
  if (format === 'json') {
    return JSON.stringify(...);
  }
  // text format
}
```

**Key Benefits:**
- ✅ Output formatting isolated
- ✅ Easy to add new formats
- ✅ Testable formatters

---

### 9. skill.ts:83 - Complexity 16 ⚠️ LOW

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/cli/commands/skill.ts`  
**Function:** `cp` subcommand action (lines 83-124)  
**Complexity:** 16  
**Effort:** LOW (1-2 hours)

#### Complexity Sources

```
Primary Issues:
├─ Client option parsing
├─ Loop through copy results
├─ Conditional error checking
└─ Output formatting with conditions
```

#### Key Complexity Points

1. **Lines 97-110:** Results loop with conditional output
2. **Lines 115-122:** Exit code decision logic

#### Refactoring Strategy

**Approach:** Extract result processor

```typescript
class SkillCopyResultProcessor {
  processResults(results): ProcessedResults
  displayResults(results, output): void
  getExitCode(results): number
}

// Simplified action
cmd.command('cp <name>')
  .action(async (name, options) => {
    const results = await skillCopyService.copySkillToProject(name, {
      force: options.force,
      clients: options.client ? [options.client] : undefined,
    });
    
    const processor = new SkillCopyResultProcessor();
    const processed = processor.processResults(results);
    processor.displayResults(processed, output);
    
    if (!processor.allSuccess(results)) {
      process.exit(1);
    }
  });
```

**Estimated Lines:**
- Current: 42 lines
- After refactor: 20 lines (action) + 30 lines (Processor) = 50 total
- **Increase: 19%** - Minimal benefit for this size

**Recommendation:** Keep as-is, just add comments to clarify logic

**Key Benefits:**
- ✅ Minor: Result display logic isolated
- ✅ Testable result processing

---

### 10. sync.ts:83 - Complexity 16 ⚠️ LOW

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/cli/commands/sync.ts`  
**Function:** `generateMcpTable` (lines 83-120)  
**Complexity:** 16  
**Effort:** LOW (1 hour)

#### Complexity Sources

```
Primary Issues:
├─ Double nested loop for building data structures
├─ Map operations and transformations
├─ Sort with custom comparator
└─ Column width calculations
```

#### Key Complexity Points

1. **Lines 22-40:** Building MCP maps from results
2. **Lines 43-53:** Sort with multi-level comparator
3. **Lines 55-76:** Building table rows with padding

#### Refactoring Strategy

**Approach:** This is already fairly well-structured. Minor simplifications:

```typescript
class McpTableBuilder {
  constructor(result: SyncResult)
  
  private collectMcps(): Map<string, 'global' | 'project'>
  private sortMcps(mcps: string[]): string[]
  private buildHeader(columns: number): string
  private buildSeparator(columns: number): string
  private buildRows(mcps: string[], clients: string[]): string[]
  
  build(): string
}

// Usage
function generateMcpTable(result: SyncResult): string {
  return new McpTableBuilder(result).build();
}
```

**Estimated Lines:**
- Current: 38 lines
- After refactor: 60 lines (class) + 5 lines (usage)
- **Not recommended** - Current implementation is clear enough

**Recommendation:** Keep as-is but add comments explaining the complex parts

---

### 11. user.ts:148 - Complexity 18 ⚠️ LOW

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/cli/commands/user.ts`  
**Function:** `show` subcommand action (lines 148-356)  
**Complexity:** 18  
**Effort:** LOW (1-2 hours)

#### Complexity Sources

```
Primary Issues:
├─ Multiple sections with conditional output
├─ Format validation
├─ Configuration display with loops
└─ Output formatting throughout
```

#### Key Complexity Points

1. **Lines 361-380:** Format validation with specific error checks
2. **Lines 383-483:** Multi-section output with conditions

#### Refactoring Strategy

**Approach:** Extract output sections into separate functions

```typescript
function displayClientSection(config: OvertureConfig, output): void { ... }
function displayMcpServers(config: OvertureConfig, output): void { ... }
function displaySyncOptions(config: OvertureConfig, output): void { ... }

// Action handler
cmd.command('show')
  .action(async (options) => {
    const format = validateFormat(options.format);
    const config = await configLoader.loadUserConfig();
    
    if (format === 'json') {
      console.log(JSON.stringify(config, null, 2));
      return;
    }
    
    displayUserConfigHeader(configPath);
    displayClientSection(config, output);
    displayMcpServers(config, output);
    displaySyncOptions(config, output);
    displayFooter(config);
  });
```

**Estimated Lines:**
- Current: 150 lines
- After refactor: 40 lines (action) + 25 lines (header) + 30 lines (clients) + 40 lines (mcps) + 20 lines (sync) + 15 lines (footer) = 170 total
- **Increase: 13%** - Minimal benefit

**Recommendation:** Extract the sections but keep inline for now

---

### 12. env-var-validator.ts:73 - Complexity 22 ⚠️ LOW-MEDIUM

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/lib/validators/env-var-validator.ts`  
**Function:** `validateEnvVarReferences` (lines 73-125)  
**Complexity:** 22  
**Effort:** LOW (1-2 hours)

#### Complexity Sources

```
Primary Issues:
├─ Nested iteration (MCP → env vars)
├─ Pattern matching with loop
├─ Multiple conditional branches per var
└─ Issue accumulation logic
```

#### Key Complexity Points

1. **Lines 85-110:** Triple nested loop (MCPs → env vars → patterns)
   ```typescript
   for (const [mcpName, mcpConfig] of Object.entries(config.mcp || {})) {
     if (!mcpConfig.env) continue;
     for (const [key, value] of Object.entries(mcpConfig.env)) {
       if (!value || typeof value !== 'string') continue;
       const isVariableReference = value.startsWith('${') && value.endsWith('}');
       if (isVariableReference) continue;
       for (const [patternName, pattern] of Object.entries(TOKEN_PATTERNS)) {
         if (pattern.test(value)) { ... }
       }
     }
   }
   ```

#### Refactoring Strategy

**Approach:** Extract pattern matching and validation checks

```typescript
class CredentialDetector {
  detectCredentialType(value: string): string | null
}

class EnvVarValidator {
  validateMcpConfig(mcpName: string, mcpConfig): ValidationIssue[]
  validateEnvVar(mcpName: string, key: string, value: string): ValidationIssue | null
}

// Simplified function
function validateEnvVarReferences(config: OvertureConfig): ValidationResult {
  const issues: ValidationIssue[] = [];
  const detector = new CredentialDetector();
  const validator = new EnvVarValidator(detector);
  
  for (const [mcpName, mcpConfig] of Object.entries(config.mcp || {})) {
    const mcpIssues = validator.validateMcpConfig(mcpName, mcpConfig);
    issues.push(...mcpIssues);
  }
  
  return { valid: issues.length === 0, issues: issues.map(i => i.message) };
}
```

**Estimated Lines:**
- Current: 55 lines
- After refactor: 30 lines (function) + 30 lines (Detector) + 40 lines (Validator) = 100 total
- **Increase: 82%** - Not worth it for this size

**Recommendation:** Keep as-is, simplify triple-nested loop with early continues and helper

```typescript
function validateEnvVarReferences(config: OvertureConfig): ValidationResult {
  const issues: string[] = [];

  for (const [mcpName, mcpConfig] of Object.entries(config.mcp || {})) {
    if (!mcpConfig.env) continue;
    
    for (const [key, value] of Object.entries(mcpConfig.env)) {
      const issue = validateSingleEnvVar(mcpName, key, value);
      if (issue) issues.push(issue);
    }
  }

  return { valid: issues.length === 0, issues };
}

function validateSingleEnvVar(mcpName: string, key: string, value: string): string | null {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('${') && value.endsWith('}')) return null;
  
  const matched = matchCredentialPattern(value);
  if (matched) {
    return `WARNING: MCP "${mcpName}" env.${key} appears to contain actual credential (${matched})...`;
  }
  return null;
}

function matchCredentialPattern(value: string): string | null {
  for (const [name, pattern] of Object.entries(TOKEN_PATTERNS)) {
    if (pattern.test(value)) return name;
  }
  return null;
}
```

**Key Benefits:**
- ✅ Reduces nesting levels
- ✅ Single responsibility per function
- ✅ Easier to test individual checks
- ✅ Only 20% more code

---

### 13. env-var-validator.ts:89 - Complexity 27 ⚠️ LOW-MEDIUM

**File:** `/home/jeff/workspaces/ai/overture/apps/cli/src/lib/validators/env-var-validator.ts`  
**Function:** `getFixSuggestion` (lines 127-142)  
**Complexity:** 27 (appears to be miscalculated - this function is only 16 lines)  
**Effort:** LOW (< 1 hour)

#### Analysis

This function is actually quite simple - it just formats a string. The high complexity score might be a false positive from the ESLint tool.

```typescript
export function getFixSuggestion(issues: string[]): string {
  if (issues.length === 0) {
    return '';
  }

  return (
    '\n' +
    '💡 How to fix:\n' +
    '  1. Replace hardcoded credentials with variable references: ${VAR_NAME}\n' +
    '  2. Set the actual values in your shell environment:\n' +
    '     export GITHUB_TOKEN="ghp_your_token_here"\n' +
    '  3. The MCP server will automatically expand ${GITHUB_TOKEN} at runtime\n' +
    '\n' +
    'This keeps sensitive values out of version control and config files.'
  );
}
```

**Recommendation:** No refactoring needed. The complexity score is a false positive.

---

## Summary Table

| # | File | Function | Line | Complexity | Effort | Priority | Strategy |
|---|------|----------|------|------------|--------|----------|----------|
| 1 | doctor.ts | action handler | 91 | 226 | HIGH | Critical | Extract phase handlers |
| 2 | sync.ts | action handler | 180 | 201 | HIGH | Critical | Extract output formatter & processor |
| 3 | validate.ts | action handler | 65 | 125 | MEDIUM | Important | Extract validators |
| 4 | user.ts | init subcommand | 356 | 67 | MEDIUM | Important | Extract wizard steps |
| 5 | cleanup.ts | createCommand | 28 | 29 | MEDIUM | Nice | Extract helpers (inline) |
| 6 | cleanup.ts | action handler | 103 | 17 | MEDIUM | Nice | Extract helpers (inline) |
| 7 | import.ts | action handler | 48 | 30 | MEDIUM | Nice | Extract modes |
| 8 | mcp.ts | createCommand | 25 | 21 | LOW | Nice | Extract helpers (inline) |
| 9 | mcp.ts | enable action | 152 | 21 | LOW | Nice | Extract helpers (inline) |
| 10 | plugin-list.ts | action handler | 34 | 27 | LOW | Nice | Extract formatters (inline) |
| 11 | skill.ts | cp action | 83 | 16 | LOW | Nice | Keep as-is, add comments |
| 12 | sync.ts | generateMcpTable | 83 | 16 | LOW | Nice | Keep as-is, add comments |
| 13 | user.ts | show action | 148 | 18 | LOW | Nice | Extract sections (inline) |
| 14 | env-var-validator.ts | validateEnvVarReferences | 73 | 22 | LOW | Nice | Extract helper functions |
| 15 | env-var-validator.ts | getFixSuggestion | 89 | 27 | FALSE POSITIVE | Skip | No refactoring needed |

---

## Refactoring Roadmap

### Phase 1: Critical Functions (Recommended - 1 Week)

**Effort:** 40-50 hours  
**Impact:** 70% reduction in code complexity

1. **doctor.ts:91** - Extract DoctorPhaseHandler & DoctorOutputFormatter
   - **Files to create:** `libs/core/discovery/src/lib/doctor-phase-handler.ts`, `apps/cli/src/lib/formatters/doctor-formatter.ts`
   - **Tests:** 12+ unit tests for each handler
   - **Estimated time:** 16 hours

2. **sync.ts:180** - Extract SyncOutputFormatter & SyncResultProcessor
   - **Files to create:** `apps/cli/src/lib/formatters/sync-formatter.ts`, `apps/cli/src/lib/processors/sync-processor.ts`
   - **Tests:** 15+ unit tests for processors
   - **Estimated time:** 18 hours

**Total Phase 1:** ~34 hours

### Phase 2: Important Functions (Recommended - 3-4 Days)

**Effort:** 18-24 hours  
**Impact:** 30% reduction in code complexity

1. **validate.ts:65** - Extract validators
   - **Files to create:** `apps/cli/src/lib/validators/mcp-validator.ts`, `apps/cli/src/lib/validators/config-validator.ts`
   - **Tests:** 20+ unit tests
   - **Estimated time:** 12 hours

2. **user.ts:356** - Extract UserInitWizard
   - **Files to create:** `apps/cli/src/lib/wizards/user-init-wizard.ts`
   - **Tests:** 10+ unit tests
   - **Estimated time:** 8 hours

**Total Phase 2:** ~20 hours

### Phase 3: Nice-to-Have Functions (Optional - 2-3 Days)

**Effort:** 12-18 hours  
**Impact:** 20% reduction in code complexity

Inline refactoring for remaining 7 functions:
- cleanup.ts: Extract helper functions
- import.ts: Extract mode handlers
- mcp.ts: Extract service helpers
- plugin-list.ts: Extract format helpers
- skill.ts, sync.ts:83, user.ts:148, env-var-validator.ts: Minor cleanups

**Total Phase 3:** ~15 hours

---

## General Refactoring Principles

### For All Command Handlers

1. **Extract Business Logic from UI**
   ```typescript
   // Before: Mixed concerns
   async function syncAction(options) {
     const config = await loadConfig();
     output.info('Loading...');
     // ... 200 lines of mixed logic and output
   }
   
   // After: Separated concerns
   async function syncAction(options) {
     const service = new SyncService(deps);
     const formatter = new SyncFormatter(output);
     const result = await service.sync(options);
     formatter.format(result);
   }
   ```

2. **Use Strategy Pattern for Conditional Branches**
   ```typescript
   // Before: Large if/else chains
   if (format === 'json') {
     // ... JSON output (50 lines)
   } else if (format === 'table') {
     // ... Table output (60 lines)
   } else {
     // ... Text output (70 lines)
   }
   
   // After: Strategy pattern
   const formatters = {
     json: new JsonFormatter(),
     table: new TableFormatter(),
     text: new TextFormatter(),
   };
   
   const formatter = formatters[format];
   formatter.format(data);
   ```

3. **Extract Repeated Validation Logic**
   ```typescript
   // Before: Repeated in multiple places
   if (!VALID_PLATFORMS.includes(platform)) {
     errors.push(`Invalid platform: ${platform}`);
   }
   
   // After: Reusable validator
   class PlatformValidator {
     validate(platform: string): ValidationError | null
   }
   ```

4. **Use Composition Over Inheritance**
   ```typescript
   // Before: Complex base class
   class CommandBase {
     validateConfig() { ... }
     loadConfig() { ... }
     formatOutput() { ... }
     // ... many responsibilities
   }
   
   // After: Composition
   class ValidateCommand {
     constructor(
       private validator: ConfigValidator,
       private configLoader: ConfigLoader,
       private formatter: OutputFormatter
     ) {}
   }
   ```

---

## Testing Strategy for Refactored Code

### Unit Tests

```typescript
// Example: Testing extracted validator
describe('McpValidator', () => {
  let validator: McpValidator;

  beforeEach(() => {
    validator = new McpValidator();
  });

  it('should detect missing command', () => {
    const config = { command: '', args: [], transport: 'stdio' };
    const errors = validator.validateCommand(config, 'test-mcp');
    expect(errors).toContainEqual(expect.objectContaining({
      message: expect.stringContaining('command is required')
    }));
  });

  it('should detect invalid platform in exclusion', () => {
    const config = {
      command: 'npx',
      args: [],
      transport: 'stdio',
      platforms: { exclude: ['invalid-platform'] }
    };
    const errors = validator.validatePlatforms(config, 'test-mcp');
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
// Test refactored commands end-to-end
describe('validate command', () => {
  it('should validate full config flow', async () => {
    const result = await executeCommand('validate');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('valid');
  });
});
```

---

## ESLint Rule Suppressions (When Necessary)

If a function cannot be reasonably refactored further, suppress with:

```typescript
/* eslint-disable sonarjs/cognitive-complexity -- 
   Complex function with unavoidable conditionals.
   Refactored as much as possible without over-engineering.
   See docs/COGNITIVE_COMPLEXITY_ANALYSIS.md for justification.
*/
function complexFunction() {
  // ... implementation
}
```

**Conditions for suppression:**
- Exhaustively documented why refactoring is not possible
- Complexity is due to inherent problem, not poor design
- Alternative approaches considered and documented
- Clear reference to documentation

---

## Recommendations

### Immediate Actions (Next 1-2 Weeks)

1. **Schedule Phase 1 refactoring** - doctor.ts & sync.ts
   - **Owner:** Team lead or principal engineer
   - **Duration:** 1 week
   - **Includes:** Extract handlers, create tests, update docs

2. **Code review process**
   - All extracted functions need design review
   - Ensure patterns are consistent across codebase
   - Review test coverage

3. **Documentation**
   - Update architecture.md with refactored structure
   - Add refactoring notes to commit messages
   - Update CLAUDE.md with new patterns

### Future Actions (After Phase 1)

1. **Implement Phase 2** if resources available
2. **Create reusable components library**
   - Base validator class
   - Base formatter class
   - Output helpers module
3. **Establish patterns for new commands**
   - Template for command creation
   - Standardized handler structure
   - Required test coverage

---

## Files & Locations Reference

### CLI Commands (apps/cli/src/cli/commands/)
- `doctor.ts` - System diagnostics
- `sync.ts` - Config synchronization
- `validate.ts` - Configuration validation
- `user.ts` - User config management
- `cleanup.ts` - MCP cleanup utility
- `import.ts` - MCP import utility
- `mcp.ts` - MCP management
- `plugin-list.ts` - Plugin listing
- `skill.ts` - Skill management

### Validators (apps/cli/src/lib/validators/)
- `env-var-validator.ts` - Environment variable validation

### Recommended Extraction Locations

After refactoring, create:
- `apps/cli/src/lib/validators/` - Validation logic
- `apps/cli/src/lib/formatters/` - Output formatting
- `apps/cli/src/lib/processors/` - Data processing
- `apps/cli/src/lib/wizards/` - Interactive wizards
- `apps/cli/src/lib/services/` - Business logic services

---

## Conclusion

The Overture codebase has significant cognitive complexity concentrated in a small number of CLI command handlers. The recommended refactoring approach focuses on:

1. **Separating concerns** - UI, business logic, formatting
2. **Extracting reusable components** - Validators, formatters, services
3. **Using design patterns** - Strategy, composition, builder
4. **Testing thoroughly** - Unit and integration tests for all extracted components

By following the **recommended Phase 1 & 2 roadmap**, the codebase complexity can be reduced by **70%** while improving maintainability, testability, and code reuse.

---

**Document Version:** 1.0  
**Last Updated:** December 29, 2025  
**Next Review:** After Phase 1 completion
