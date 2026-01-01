# @overture/agent-core

> Universal agent synchronization library for Overture

## Overview

`@overture/agent-core` provides agent discovery, validation, and synchronization capabilities across multiple AI development tools. It follows hexagonal architecture principles with dependency injection for filesystem and output operations.

## Features

- **Multi-client agent sync**: Claude Code, OpenCode, Copilot CLI
- **Split source pattern**: Separate YAML configuration and Markdown prompts
- **Model mapping**: Logical model names resolved per client
- **Scope enforcement**: Global vs project-level agents
- **Comprehensive validation**: YAML syntax, schema, file pairing
- **Client-specific transformations**: Format conversion for each client

## Installation

```bash
npm install @overture/agent-core
```

## Architecture

### Hexagonal Architecture

```
Domain Layer (config-types)
    ↓
Port Layer (ports-filesystem, ports-output)
    ↓
Core Layer (@overture/agent-core) ← YOU ARE HERE
    ↓
Orchestration Layer (sync-core)
```

### Dependencies

- `@overture/config-types` - Domain types
- `@overture/config-schema` - Zod schemas
- `@overture/ports-filesystem` - File operations
- `@overture/ports-output` - Logging and output
- `js-yaml` - YAML parsing

## Usage

### Basic Agent Sync

```typescript
import { AgentSyncService } from '@overture/agent-core';
import { NodeFilesystemAdapter } from '@overture/adapters-infrastructure';
import { Logger } from '@overture/utils';
import * as os from 'os';
import * as path from 'path';

const filesystem = new NodeFilesystemAdapter();
const output = new Logger();
const homeDir = os.homedir();
const xdgConfigHome = path.join(homeDir, '.config');

const agentSyncService = new AgentSyncService(
  filesystem,
  output,
  homeDir,
  xdgConfigHome,
);

const summary = await agentSyncService.syncAgents({
  clients: ['claude-code', 'opencode'],
  projectRoot: '/path/to/project',
  dryRun: false,
});

console.log(`Synced ${summary.synced} agents`);
```

### Agent Directory Structure

```
~/.config/overture/agents/     # Global agents
  code-reviewer.yaml
  code-reviewer.md
  test-writer.yaml
  test-writer.md

.overture/agents/               # Project agents
  project-helper.yaml
  project-helper.md
```

### Agent Configuration Format

**`code-reviewer.yaml`:**

```yaml
name: code-reviewer
model: smart # Resolved via models.yaml
description: Expert code reviewer

tools:
  - filesystem
  - github

clients:
  claude-code:
    model: claude-3-5-sonnet-20241022
  opencode:
    model: claude-3-5-sonnet-20241022
```

**`code-reviewer.md`:**

```markdown
# Code Reviewer

You are an expert code reviewer focused on best practices.

## Guidelines

- Explain WHY changes are needed
- Prioritize security and correctness
- Be constructive in tone
```

### Model Mapping

**`~/.config/overture/models.yaml`:**

```yaml
smart: claude-3-5-sonnet-20241022
fast: claude-3-haiku-20240307
vision: claude-3-5-sonnet-20241022
```

**Note:** Model mapping is client-agnostic in v0.3. Future versions will support per-client mappings:

```yaml
smart:
  claude-code: claude-3-5-sonnet-20241022
  opencode: claude-3-5-sonnet-20241022
  copilot-cli: gpt-4
```

## API Reference

### AgentSyncService

#### Constructor

```typescript
constructor(
  filesystem: FilesystemPort,
  output: OutputPort,
  homeDir: string,
  xdgConfigHome: string
)
```

**Parameters:**

- `filesystem` - File operations abstraction (injected port)
- `output` - Logging and output abstraction (injected port)
- `homeDir` - User home directory path (e.g., `/home/user`)
- `xdgConfigHome` - XDG config directory path (e.g., `/home/user/.config`)

#### Methods

##### `syncAgents(options?: AgentSyncOptions): Promise<AgentSyncSummary>`

Synchronizes agents to client-specific locations.

**Parameters:**

- `options.dryRun` - Preview changes without writing files (default: `false`)
- `options.projectRoot` - Path to project (for project-scoped agents)
- `options.clients` - Target clients (default: `['claude-code', 'copilot-cli', 'opencode']`)

**Returns:**

```typescript
{
  total: number;       // Total agents discovered
  synced: number;      // Successfully synced
  failed: number;      // Failed to sync
  results: AgentSyncResult[];
}
```

**Example:**

```typescript
const summary = await agentSyncService.syncAgents({
  clients: ['claude-code'],
  projectRoot: '/home/user/my-project',
  dryRun: false,
});

console.log(
  `Total: ${summary.total}, Synced: ${summary.synced}, Failed: ${summary.failed}`,
);

for (const result of summary.results) {
  console.log(`Agent: ${result.agent}, Success: ${result.success}`);
  for (const [client, clientResult] of Object.entries(result.clientResults)) {
    if (clientResult.success) {
      console.log(`  ${client}: ${clientResult.path}`);
    } else {
      console.log(`  ${client}: ERROR - ${clientResult.error}`);
    }
  }
}
```

### AgentTransformer

#### Methods

##### `transform(agent: AgentDefinition, client: ClientName, modelMapping: ModelMapping): { content: string; filename: string }`

Transforms agent definition to client-specific format.

**Parameters:**

- `agent` - Agent definition (config + body)
- `client` - Target client name (`'claude-code'`, `'opencode'`, `'copilot-cli'`)
- `modelMapping` - Model mapping configuration

**Returns:**

```typescript
{
  content: string; // Transformed file content
  filename: string; // Relative filename (e.g., "code-reviewer.md")
}
```

**Client Formats:**

**Claude Code** (`~/.claude/agents/<name>.md`):

```markdown
---
name: code-reviewer
description: Expert code reviewer
tools: filesystem, github
model: claude-3-5-sonnet-20241022
permissionMode: all
---

# Code Reviewer

You are an expert code reviewer focused on best practices.
```

**OpenCode** (`~/.config/opencode/agent/<name>.md`):

```markdown
---
description: Expert code reviewer
mode: subagent
model: claude-3-5-sonnet-20241022
tools:
  - filesystem
  - github
permission:
  '*': allow
---

# Code Reviewer

You are an expert code reviewer focused on best practices.
```

**Copilot CLI** (`.github/agents/<name>.agent.md`):

```markdown
---
name: code-reviewer
description: Expert code reviewer
tools:
  - filesystem
  - github
---

# Code Reviewer

You are an expert code reviewer focused on best practices.
```

## Validation

### Agent YAML Validation

- ✓ Valid YAML syntax
- ✓ Required `name` field
- ✓ Valid model reference
- ✓ Corresponding `.md` file exists
- ✓ Schema compliance (AgentConfigSchema)

### Model Mapping Validation

- ✓ Valid YAML syntax
- ✓ Object structure (key-value pairs)
- ✓ Non-null values

**Example validation errors:**

```
Error: Failed to load agent code-reviewer from ~/.config/overture/agents:
  Invalid YAML: unexpected token at line 5

Error: Agent "test-writer" missing required field: name

Error: Agent "project-helper" has no corresponding .md file
```

## Error Handling

Errors are logged via `OutputPort` and included in sync results:

```typescript
{
  agent: "code-reviewer",
  success: false,
  clientResults: {
    "claude-code": {
      success: false,
      error: "Failed to parse YAML: unexpected token"
    },
    "opencode": {
      success: true,
      path: "/home/user/.config/opencode/agent/code-reviewer.md"
    }
  }
}
```

**Error Types:**

- **Parsing errors**: Invalid YAML syntax, malformed frontmatter
- **Schema errors**: Missing required fields, invalid types
- **File errors**: Missing .md file, permission denied
- **Model errors**: Invalid model mapping reference

## Scope Rules

### Global Agents

**Location:** `~/.config/overture/agents/`

**Synced to:**

- ✓ Claude Code (`~/.claude/agents/`)
- ✓ OpenCode (`~/.config/opencode/agent/`)
- ✗ Copilot CLI (project-only)

### Project Agents

**Location:** `.overture/agents/`

**Synced to:**

- ✓ Claude Code (`~/.claude/agents/`)
- ✓ OpenCode (`~/.config/opencode/agent/`)
- ✓ Copilot CLI (`.github/agents/`)

**Note:** Copilot CLI only supports project-scoped agents. Global agents are ignored.

## Model Resolution

The transformer resolves models in the following order:

1. **Client-specific override**: `clients.<client-name>.model`
2. **Logical name mapping**: Lookup in `models.yaml`
3. **Use as-is**: If no mapping found, use model name directly

**Example:**

```yaml
# Agent: code-reviewer.yaml
model: smart
clients:
  opencode:
    model: claude-3-opus-20240229

# Model mapping: models.yaml
smart: claude-3-5-sonnet-20241022
```

**Resolution:**

- **Claude Code**: `claude-3-5-sonnet-20241022` (from mapping)
- **OpenCode**: `claude-3-opus-20240229` (client override)
- **Copilot CLI**: `smart` (no mapping, use as-is)

## Integration with Overture

### SyncEngine Integration

**Location:** `libs/core/sync/src/lib/sync-engine.ts`

```typescript
export class SyncEngine {
  constructor(
    // ... other dependencies
    private agentSyncService?: AgentSyncService, // Optional
  ) {}

  async sync(config: OvertureConfig, options: SyncOptions): Promise<void> {
    // Sync MCPs
    await this.syncMcps(config, options);

    // Sync agents (if service provided)
    if (this.agentSyncService) {
      await this.agentSyncService.syncAgents({
        clients: options.clients,
        projectRoot: options.projectRoot,
        dryRun: options.dryRun,
      });
    }
  }
}
```

### Doctor Command Integration

**Location:** `apps/cli/src/cli/commands/doctor.ts`

```typescript
async function checkAgents(
  homeDir: string,
  xdgConfigHome: string,
): Promise<AgentStatus> {
  // 1. Check global agents directory
  // 2. Validate YAML/MD pairs
  // 3. Check models.yaml
  // 4. Return validation status
}
```

**Output:**

```
Checking config repository...

✓ Config repo - ~/.config/overture
  ✓ Global agents - ~/.config/overture/agents (3 agents)
  ✓ Model mappings - ~/.config/overture/models.yaml

Summary:
  Global agents:    exists (3 agents)
  Model mappings:   valid
```

## Testing

```bash
# Run tests
nx test @overture/agent-core

# Run with coverage
nx test @overture/agent-core --coverage

# Watch mode
nx test @overture/agent-core --watch
```

**Test Coverage (v0.3):**

- ✓ Agent discovery (global + project)
- ✓ Model mapping resolution
- ✓ Client-specific transformations
- ✓ YAML/MD file pairing
- ✓ Sync summary generation

## Examples

### Example 1: Sync All Agents

```typescript
const summary = await agentSyncService.syncAgents({
  clients: ['claude-code', 'opencode', 'copilot-cli'],
  projectRoot: '/home/user/my-project',
});

console.log(
  `Total: ${summary.total}, Synced: ${summary.synced}, Failed: ${summary.failed}`,
);
```

### Example 2: Dry Run

```typescript
const summary = await agentSyncService.syncAgents({
  dryRun: true,
});

// Preview changes without writing files
for (const result of summary.results) {
  for (const [client, clientResult] of Object.entries(result.clientResults)) {
    if (clientResult.success) {
      console.log(`Would sync to: ${clientResult.path}`);
    }
  }
}
```

### Example 3: Single Client

```typescript
const summary = await agentSyncService.syncAgents({
  clients: ['claude-code'],
});

console.log(`Synced ${summary.synced} agents to Claude Code`);
```

## Future Enhancements

### Planned for v0.4+

- **Per-client model mappings**: Support different models per client in `models.yaml`
- **Agent templates**: `overture agent create` command
- **Agent validation**: `overture agent validate` command
- **Agent import**: `overture agent import` from existing configs
- **Agent overrides**: More granular client-specific overrides (settings, tools, permissions)

## License

MIT

---

**Related Documentation:**

- [Overture Schema](../../../docs/overture-schema.md#agents) - Agent configuration reference
- [Architecture](../../../docs/architecture.md#agent-sync-service) - Agent sync architecture
- [User Guide](../../../docs/user-guide.md) - End-user agent setup guide
