# How To: Add a New CLI Client to Overture

This guide walks through adding support for a new AI coding CLI client to Overture, using the OpenCode integration (December 2024) as a reference example.

## Overview

Adding a new CLI client involves:

1. **Type System Updates** - Add the client name to type definitions
2. **Adapter Implementation** - Create a ClientAdapter for the new client
3. **WSL2 Support** - Add Windows path detection (if needed)
4. **Config Diff Support** - Update schema root key types (if client uses different format)
5. **Doctor Command** - Add client to diagnostic checks
6. **Documentation** - Update README comparison matrix and examples
7. **Testing** - Write comprehensive adapter tests

**Time Estimate:** 4-8 hours for complete integration with tests and docs

---

## Step 1: Research the Client's Configuration

Before starting, understand:

- **Config file location** (user and project paths)
- **Config file format** (JSON, YAML, etc.)
- **Schema structure** (root key for MCP servers: `mcpServers`, `servers`, `mcp`, etc.)
- **Format differences** from Overture's internal format
- **Binary names** (for PATH detection)
- **App bundle paths** (macOS .app, Windows .exe locations)
- **Variable expansion** (how the client handles environment variables)

### OpenCode Example

For OpenCode, we researched:

- **Docs:** https://opencode.ai/docs/
- **Config location:** `~/.config/opencode/opencode.json`
- **Schema root key:** `mcp` (not `mcpServers`)
- **Format differences:**
  - Command + args combined into single array: `command: [cmd, ...args]`
  - Environment variables use `{env:VAR}` instead of `${VAR}`
  - Additional fields: `type: 'local'`, `enabled: true`
- **Binary names:** `['opencode']`
- **Variable expansion:** Client handles it (no expansion needed)

**Reference Commit:** Research documented in `docs/opencode-integration-research.md` (archived)

---

## Step 2: Add Client to Type System

### File: `libs/domain/config-types/src/lib/config.types.ts`

Add the client name to the `ClientName` union type:

```typescript
export type ClientName =
  | 'claude-code'
  | 'claude-desktop'
  | 'vscode'
  | 'cursor'
  | 'windsurf'
  | 'copilot-cli'
  | 'jetbrains-copilot'
  | 'codex'
  | 'gemini-cli'
  | 'opencode'; // ADD YOUR CLIENT HERE
```

**Reference Commit:** `cd4a642` - "feat: implement OpenCodeAdapter with comprehensive tests"

---

## Step 3: Implement the ClientAdapter

### File: `libs/adapters/client-adapters/src/lib/adapters/{client-name}.adapter.ts`

Create a new adapter class extending `BaseClientAdapter`. Follow the pattern from existing adapters.

#### Key Methods to Implement

1. **Constructor** - Accept filesystem and environment ports
2. **`name`** - Readonly property with client name
3. **`schemaRootKey`** - Root key in config file (`'mcpServers'`, `'servers'`, or `'mcp'`)
4. **`detectConfigPath()`** - Return user and project config paths
5. **`readConfig()`** - Read and parse the config file
6. **`writeConfig()`** - Write config (with JSON patching if needed)
7. **`convertFromOverture()`** - Translate Overture format to client format
8. **`convertToOverture()`** - Translate client format to Overture format (if needed)
9. **`supportsTransport()`** - Which transports the client supports
10. **`needsEnvVarExpansion()`** - Whether Overture should expand `${VAR}`
11. **`getBinaryNames()`** - Binary names for PATH detection
12. **`requiresBinary()`** - Whether client requires a binary
13. **`getAppBundlePaths()`** - macOS app bundle paths (if applicable)

#### OpenCode Adapter Example

```typescript
/**
 * OpenCode Client Adapter
 *
 * Manages configuration for OpenCode CLI.
 *
 * Key features:
 * - JSON patching: Preserves custom agents, commands, permissions, themes
 * - Format translation: Combines command+args, translates env vars
 * - Schema: Uses 'mcp' root key (not 'mcpServers')
 *
 * @module lib/adapters/opencode.adapter
 */

import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import type {
  Platform,
  ClientMcpConfig,
  OvertureConfig,
  ConfigPathResult,
  TransportType,
} from '@overture/config-types';
import { BaseClientAdapter } from '../client-adapter.base.js';

export class OpenCodeAdapter extends BaseClientAdapter {
  readonly name = 'opencode' as const;
  readonly schemaRootKey = 'mcp' as const;

  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly environment: EnvironmentPort,
  ) {
    super();
  }

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    const userPath = this.getOpenCodeGlobalPath(platform);
    const projectPath = this.getOpenCodeProjectPath(projectRoot);
    return { user: userPath, project: projectPath };
  }

  async readConfig(path: string): Promise<ClientMcpConfig> {
    const content = await this.filesystem.readFile(path);
    const parsed = JSON.parse(content);
    return { mcp: parsed.mcp || {} };
  }

  async writeConfig(path: string, config: ClientMcpConfig): Promise<void> {
    // JSON PATCHING: Preserve custom config sections
    let existing = {};
    if (await this.filesystem.exists(path)) {
      const content = await this.filesystem.readFile(path);
      existing = JSON.parse(content);
    }

    // Merge: Preserve everything except 'mcp' section
    const merged = {
      ...existing,
      mcp: config.mcp,
    };

    const dir = this.getDirname(path);
    if (!(await this.filesystem.exists(dir))) {
      await this.filesystem.mkdir(dir, { recursive: true });
    }
    await this.filesystem.writeFile(path, JSON.stringify(merged, null, 2));
  }

  convertFromOverture(
    overtureConfig: OvertureConfig,
    platform: Platform,
  ): ClientMcpConfig {
    const mcpServers: Record<string, any> = {};

    for (const [name, mcpConfig] of Object.entries(overtureConfig.mcp)) {
      if (!this.shouldSyncMcp(mcpConfig, platform)) continue;

      const serverConfig = this.buildServerConfig(mcpConfig, platform);

      // OpenCode format translation
      mcpServers[name] = {
        type: 'local',
        enabled: true,
        command: [serverConfig.command, ...serverConfig.args], // Combined array
        environment: this.translateEnvVars(serverConfig.env || {}), // ${VAR} -> {env:VAR}
      };
    }

    return { mcp: mcpServers };
  }

  private translateEnvVars(
    env: Record<string, string>,
  ): Record<string, string> {
    const translated: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      translated[key] = value.replace(/\$\{([^}]+)\}/g, '{env:$1}');
    }
    return translated;
  }

  supportsTransport(transport: TransportType): boolean {
    return true; // OpenCode supports all transports
  }

  needsEnvVarExpansion(): boolean {
    return false; // OpenCode handles {env:VAR} internally
  }

  getBinaryNames(): string[] {
    return ['opencode'];
  }

  requiresBinary(): boolean {
    return true;
  }

  getAppBundlePaths(platform: Platform): string[] {
    return []; // OpenCode has no app bundle
  }

  private getOpenCodeGlobalPath(platform: Platform): string {
    if (platform === 'win32') {
      return '%APPDATA%/opencode/opencode.json';
    }
    return '~/.config/opencode/opencode.json';
  }

  private getOpenCodeProjectPath(projectRoot?: string): string {
    if (!projectRoot) return '';
    return this.joinPath(projectRoot, 'opencode.json');
  }
}
```

**Reference Commit:** `cd4a642` - "feat: implement OpenCodeAdapter with comprehensive tests"

---

## Step 4: Register the Adapter

### File: `libs/adapters/client-adapters/src/lib/adapter-factory.ts`

Add the adapter to the factory:

```typescript
import { OpenCodeAdapter } from './adapters/opencode.adapter.js';

export function createAdapterRegistry(
  filesystem: FilesystemPort,
  environment: EnvironmentPort,
): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(new ClaudeCodeAdapter(filesystem, environment));
  registry.register(new OpenCodeAdapter(filesystem, environment)); // ADD HERE
  // ... other adapters
  return registry;
}

export function createAdapter(
  adapterName: string,
  filesystem: FilesystemPort,
  environment: EnvironmentPort,
): ClientAdapter {
  switch (adapterName) {
    case 'claude-code':
      return new ClaudeCodeAdapter(filesystem, environment);
    case 'opencode': // ADD CASE
      return new OpenCodeAdapter(filesystem, environment);
    // ... other cases
    default:
      throw new McpError(`Unknown adapter: ${adapterName}`);
  }
}
```

### File: `libs/adapters/client-adapters/src/index.ts`

Export the adapter:

```typescript
export { OpenCodeAdapter } from './lib/adapters/opencode.adapter.js';
```

**Reference Commit:** `cd4a642` - "feat: implement OpenCodeAdapter with comprehensive tests"

---

## Step 5: Update Client Adapter Interface (If Needed)

### File: `libs/adapters/client-adapters/src/lib/client-adapter.interface.ts`

If your client uses a different schema root key, add it to the union type:

```typescript
export interface ClientAdapter {
  readonly name: ClientName;
  readonly schemaRootKey: 'mcpServers' | 'servers' | 'mcp'; // ADD 'mcp' if needed
  // ...
}

export abstract class BaseClientAdapter implements ClientAdapter {
  abstract readonly name: ClientName;
  abstract readonly schemaRootKey: 'mcpServers' | 'servers' | 'mcp'; // SAME HERE
  // ...
}
```

**Reference Commit:** `cd4a642` - "feat: implement OpenCodeAdapter with comprehensive tests"

---

## Step 6: Add WSL2 Support (If Needed)

### File: `libs/core/discovery/src/lib/wsl2-detector.ts`

If the client can be installed on Windows and accessed from WSL2, add default paths:

```typescript
export const WINDOWS_DEFAULT_PATHS: Record<
  ClientName,
  { binaryPaths: string[]; configPath?: string }
> = {
  // ... existing entries ...
  opencode: {
    binaryPaths: [
      'AppData/Roaming/npm/opencode.cmd',
      '.local/bin/opencode.exe',
    ],
    configPath: '.config/opencode/opencode.json',
  },
};
```

**Reference Commit:** `007edb4` - "fix: add OpenCode to WSL2 detector and config diff types"

---

## Step 7: Update Config Diff Support (If Needed)

### File: `libs/core/sync/src/lib/config-diff.ts`

If your client uses a different root key, update the `generateDiff` function signature:

```typescript
export function generateDiff(
  oldConfig: ClientMcpConfig,
  newConfig: ClientMcpConfig,
  rootKey: 'mcpServers' | 'servers' | 'mcp' = 'mcpServers', // ADD 'mcp'
): ConfigDiff {
  // ...
}
```

**Reference Commit:** `007edb4` - "fix: add OpenCode to WSL2 detector and config diff types"

---

## Step 8: Update Doctor Command

### File: `apps/cli/src/cli/commands/doctor.ts`

Add the client to the diagnostics list:

```typescript
const ALL_CLIENTS: ClientName[] = [
  'claude-code',
  'claude-desktop',
  'vscode',
  'cursor',
  'windsurf',
  'copilot-cli',
  'jetbrains-copilot',
  'codex',
  'gemini-cli',
  'opencode', // ADD HERE
];

function getInstallRecommendation(client: ClientName): string | null {
  const recommendations: Record<ClientName, string> = {
    // ... existing entries ...
    opencode: 'Install OpenCode: https://opencode.ai', // ADD HERE
  };
  return recommendations[client] || null;
}
```

**Reference Commit:** `21a71ef` - "fix: doctor command - composition root deps and missing OpenCode"

---

## Step 9: Write Comprehensive Tests

### File: `libs/adapters/client-adapters/src/lib/adapters/{client-name}.adapter.spec.ts`

Write at least 20 test cases covering:

- Path detection (user, project, platform-specific)
- Read config (valid JSON, invalid JSON, missing file)
- Write config (new file, update existing, preserve custom sections)
- Format conversion (Overture → Client, field translation)
- Variable translation (if applicable)
- Filtering (disabled MCPs, platform-specific)
- Transport support
- Binary/app bundle detection

**Target Coverage:** 85%+ line coverage

#### OpenCode Test Example

```typescript
describe('OpenCodeAdapter', () => {
  describe('detectConfigPath', () => {
    it('should return Linux paths', () => {
      const filesystem = createMockFilesystem();
      const environment = createMockEnvironment('linux');
      const adapter = new OpenCodeAdapter(filesystem, environment);

      const result = adapter.detectConfigPath('linux', '/home/user/project');

      expect(result.user).toBe('~/.config/opencode/opencode.json');
      expect(result.project).toBe('/home/user/project/opencode.json');
    });

    it('should return Windows paths', () => {
      const filesystem = createMockFilesystem();
      const environment = createMockEnvironment('win32');
      const adapter = new OpenCodeAdapter(filesystem, environment);

      const result = adapter.detectConfigPath(
        'win32',
        'C:\\Users\\user\\project',
      );

      expect(result.user).toBe('%APPDATA%/opencode/opencode.json');
      expect(result.project).toBe('C:\\Users\\user\\project/opencode.json');
    });
  });

  describe('writeConfig with JSON patching', () => {
    it('should preserve custom agents and commands', async () => {
      const filesystem = createMockFilesystem();
      const environment = createMockEnvironment('linux');
      const adapter = new OpenCodeAdapter(filesystem, environment);

      // Existing config with custom sections
      filesystem.files.set(
        '/config.json',
        JSON.stringify(
          {
            agents: { myAgent: { skills: ['analyze'] } },
            commands: { '/custom': 'echo hello' },
            mcp: { oldServer: { command: ['old'] } },
          },
          null,
          2,
        ),
      );

      // Write new MCP config
      await adapter.writeConfig('/config.json', {
        mcp: { newServer: { command: ['uvx', 'server'] } },
      });

      const written = JSON.parse(filesystem.files.get('/config.json') || '{}');

      // Custom sections preserved
      expect(written.agents).toEqual({ myAgent: { skills: ['analyze'] } });
      expect(written.commands).toEqual({ '/custom': 'echo hello' });

      // MCP section updated
      expect(written.mcp).toEqual({
        newServer: { command: ['uvx', 'server'] },
      });
    });
  });

  describe('convertFromOverture', () => {
    it('should combine command and args into array', () => {
      const filesystem = createMockFilesystem();
      const environment = createMockEnvironment('linux');
      const adapter = new OpenCodeAdapter(filesystem, environment);

      const overtureConfig = {
        mcp: {
          python: {
            command: 'uvx',
            args: ['mcp-server-python'],
            enabled: true,
          },
        },
      };

      const result = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(result.mcp.python.command).toEqual(['uvx', 'mcp-server-python']);
    });

    it('should translate environment variable syntax', () => {
      const filesystem = createMockFilesystem();
      const environment = createMockEnvironment('linux');
      const adapter = new OpenCodeAdapter(filesystem, environment);

      const overtureConfig = {
        mcp: {
          github: {
            command: 'mcp-server-github',
            args: [],
            env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
            enabled: true,
          },
        },
      };

      const result = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(result.mcp.github.environment.GITHUB_TOKEN).toBe(
        '{env:GITHUB_TOKEN}',
      );
    });
  });
});
```

**Reference Commit:** `cd4a642` - "feat: implement OpenCodeAdapter with comprehensive tests" (39 tests, 96.72% coverage)

---

## Step 10: Update Documentation

### 1. README Comparison Matrix

Add a column for the new client in the comparison table.

**File:** `README.md` (lines ~496-565)

```markdown
| Feature            | Claude Code | ... | OpenCode |
| ------------------ | ----------- | --- | -------- |
| MCP Client Support | ✅ Full     | ... | ✅ Full  |
| MCP Server Mode    | ❌          | ... | ❌       |
| ...more rows...    | ...         | ... | ...      |
```

**Reference Commit:** `8fd14d0` - "docs: add OpenCode to comparison matrix and hybrid setup example"

### 2. Add Example Configuration

Create an example showing hybrid setups or client-specific features.

**File:** `docs/examples.md`

````markdown
## Example 7: OpenCode + Claude Code Hybrid Setup

Demonstrates unified MCP management across multiple tools.

### `.overture/config.yaml`

```yaml
version: '1.0'

project:
  name: my-api
  type: python-backend

plugins:
  python-development:
    marketplace: claude-code-workflows
    mcps: [python-repl, ruff]

mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
```
````

### Generated `opencode.json`

```json
{
  "agents": {
    "custom-agent": { "skills": ["analyze"] }
  },
  "mcp": {
    "python-repl": {
      "type": "local",
      "enabled": true,
      "command": ["uvx", "mcp-server-python-repl"],
      "environment": {}
    }
  }
}
```

**What it does:**

- Unified MCP management across Claude Code and OpenCode
- Preserves OpenCode custom agents/commands
- Single source of truth for MCP servers

````

**Reference Commit:** `8fd14d0` - "docs: add OpenCode to comparison matrix and hybrid setup example"

### 3. Create GitHub Issue Templates (Optional)

Add client-specific issue templates for bug reports.

**File:** `.github/ISSUE_TEMPLATE/opencode_integration.md`

```yaml
---
name: "OpenCode Integration Issue"
about: "Report an issue with OpenCode integration"
title: "[OpenCode] "
labels: ["opencode", "integration"]
---

## Description
Describe the issue with OpenCode integration.

## Environment
- OpenCode version: [run `opencode --version`]
- Overture version: [run `overture --version`]
- OS: [e.g., Ubuntu 22.04, Windows 11]

## OpenCode Configuration
```json
# Paste relevant parts of ~/.config/opencode/opencode.json
````

## Overture Configuration

```yaml
# Paste relevant parts of .overture/config.yaml
```

## Steps to Reproduce

1. ...
2. ...

## Expected vs Actual Behavior

...

````

**Reference Commit:** `cd33cfc` - "feat: add GitHub issue templates for bugs, features, and OpenCode"

---

## Step 11: Build and Test

### Build the CLI

```bash
nx build @overture/cli
````

### Run Unit Tests

```bash
nx test @overture/client-adapters
nx test @overture/cli
```

### Test the Doctor Command

```bash
node dist/apps/cli/main.js doctor
```

Expected output:

```
✓ ✓ opencode (1.0.153) - /path/to/opencode
  Config: /home/user/.config/opencode/opencode.json (valid/invalid)
```

### Manual Integration Test

1. Create a test Overture config with the new client's MCPs
2. Run `overture sync`
3. Verify the client's config file is created/updated correctly
4. Check that custom sections are preserved (if applicable)

---

## Step 12: Commit Strategy

Use separate, focused commits:

### Commit 1: Core Adapter Implementation

```bash
git add libs/adapters/client-adapters/src/lib/adapters/{client}.adapter.ts
git add libs/adapters/client-adapters/src/lib/adapters/{client}.adapter.spec.ts
git add libs/adapters/client-adapters/src/lib/adapter-factory.ts
git add libs/adapters/client-adapters/src/index.ts
git add libs/domain/config-types/src/lib/config.types.ts
git add libs/adapters/client-adapters/src/lib/client-adapter.interface.ts

git commit -m "feat: implement {Client}Adapter with comprehensive tests

Added {Client} client adapter following hexagonal architecture:

**Features:**
- Path detection for user and project configs
- Format translation: {describe key translations}
- JSON patching: {if applicable, describe what's preserved}
- Schema: Uses '{rootKey}' root key

**Implementation:**
- {X} test cases with {Y}% coverage
- Platform-specific path detection (Linux, macOS, Windows)
- Async filesystem operations via FilesystemPort
- {Other key features}

**Testing:**
- Config read/write with validation
- Format conversion (Overture ↔ {Client})
- {Specific features like variable translation}
- Edge cases: missing files, invalid JSON, disabled MCPs

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Reference:** `cd4a642`

### Commit 2: Type System and Discovery Updates

```bash
git add libs/core/discovery/src/lib/wsl2-detector.ts
git add libs/core/sync/src/lib/config-diff.ts

git commit -m "fix: add {Client} to WSL2 detector and config diff types

Extended infrastructure support for {Client}:

**WSL2 Detection:**
- Added Windows binary paths for {Client}
- Added config path: {path}

**Config Diff:**
- Added '{rootKey}' to schema root key union type
- Enables diff generation for {Client} configs

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Reference:** `007edb4`

### Commit 3: Doctor Command Integration

```bash
git add apps/cli/src/cli/commands/doctor.ts

git commit -m "fix: add {Client} to doctor command diagnostics

Extended doctor command to detect {Client}:

**Changes:**
- Added '{client-name}' to ALL_CLIENTS array
- Added installation recommendation
- {Client} now appears in diagnostic output

**Result:**
Doctor command successfully detects {Client} installations
and validates config files.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Reference:** `21a71ef`

### Commit 4: Documentation

```bash
git add README.md
git add docs/examples.md
git add .github/ISSUE_TEMPLATE/

git commit -m "docs: add {Client} to comparison matrix and examples

Updated documentation with {Client} integration:

**README:**
- Added {Client} column to comparison matrix (8th column)
- Populated all {N} feature rows with accurate data
- Added key differentiators for {Client}

**Examples:**
- Example {N}: {Client} + Claude Code hybrid setup
- Demonstrates {key features}
- Shows {specific use cases}

**GitHub Templates:**
- Added {Client}-specific issue template
- Includes version info, config snippets, error logs

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Reference:** `8fd14d0`, `cd33cfc`

---

## Common Pitfalls & Solutions

### 1. **Async/Sync Mismatch**

**Problem:** FilesystemPort is async, but some parts of the codebase need sync operations.

**Solution:**

- Use FilesystemPort (async) in adapters
- Composition root provides sync adapters for BinaryDetector using Node.js `fs` directly

### 2. **Config Validation Always Fails**

**Problem:** Config validation shows all files as invalid.

**Solution:**

- Ensure `validateConfigFile()` uses actual filesystem operations
- Don't create BinaryDetector without arguments
- Use async methods if using FilesystemPort

**Reference:** `5ff2e17`, `8850859`

### 3. **JSON Patching Not Working**

**Problem:** Custom config sections are being overwritten.

**Solution:**

```typescript
async writeConfig(path: string, config: ClientMcpConfig): Promise<void> {
  // Read existing file FIRST
  let existing = {};
  if (await this.filesystem.exists(path)) {
    const content = await this.filesystem.readFile(path);
    existing = JSON.parse(content);
  }

  // Merge: Preserve everything except the MCP section
  const merged = {
    ...existing,      // Keep all existing keys
    [this.schemaRootKey]: config[this.schemaRootKey]  // Update only MCP section
  };

  await this.filesystem.writeFile(path, JSON.stringify(merged, null, 2));
}
```

### 4. **Platform-Specific Paths Not Working**

**Problem:** Paths work on Linux but fail on Windows/macOS.

**Solution:**

- Use platform parameter in `detectConfigPath()`
- Test all three platforms: `'linux'`, `'darwin'`, `'win32'`
- Use `%APPDATA%` for Windows user data
- Use `~/.config/` for Linux/macOS user data

### 5. **Format Translation Errors**

**Problem:** Client config has wrong format after conversion.

**Solution:**

- Log the Overture config and converted config during development
- Write specific tests for each translation (command format, env vars, etc.)
- Check the client's actual config file format from their docs

---

## Testing Checklist

Before submitting:

- [ ] All unit tests pass: `nx test @overture/client-adapters`
- [ ] Coverage ≥85%: Check test output
- [ ] Build succeeds: `nx build @overture/cli`
- [ ] Doctor command detects client: `node dist/apps/cli/main.js doctor`
- [ ] Config validation works (valid configs show as "valid")
- [ ] Manual sync test: Create test config, run `overture sync`, verify output
- [ ] JSON patching works (if applicable): Verify custom sections preserved
- [ ] Cross-platform paths tested (Linux, macOS, Windows)
- [ ] README comparison matrix updated
- [ ] Example configuration added
- [ ] All commits follow conventional commit format

---

## Real-World Example: OpenCode Integration Timeline

**December 2024** - Complete OpenCode integration in ~6 hours:

| Time | Task                                     | Commit               |
| ---- | ---------------------------------------- | -------------------- |
| 0:00 | Research OpenCode docs and config format | -                    |
| 1:00 | Create OpenCodeAdapter with core methods | -                    |
| 2:30 | Write 39 test cases                      | -                    |
| 3:30 | Register adapter, update type system     | `cd4a642`            |
| 4:00 | Add WSL2 support, config diff types      | `007edb4`            |
| 4:30 | Update doctor command                    | `21a71ef`            |
| 5:00 | Update README and examples               | `8fd14d0`            |
| 5:30 | Fix config validation issues             | `5ff2e17`, `8850859` |
| 6:00 | Final testing and documentation          | -                    |

**Result:**

- 96.72% test coverage
- 39 passing tests
- Full WSL2 support
- Comprehensive documentation

---

## Additional Resources

- **Hexagonal Architecture:** `libs/adapters/client-adapters/README.md`
- **Existing Adapters:** `libs/adapters/client-adapters/src/lib/adapters/`
  - `claude-code.adapter.ts` - Reference implementation
  - `cursor.adapter.ts` - Simple example
- **Type Definitions:** `libs/domain/config-types/src/lib/config.types.ts`
- **Testing Patterns:** `libs/adapters/client-adapters/src/lib/client-adapters.spec.ts`

---

## Need Help?

1. **Review existing adapters** - Start with `claude-code.adapter.ts` as a template
2. **Check test patterns** - Look at `*.adapter.spec.ts` files for test examples
3. **Use sequential thinking** - For complex format translations, break down step-by-step
4. **Ask for clarification** - If the client's docs are unclear, research or ask

---

**Last Updated:** December 2024
**Maintainer:** Overture Team
**Related:** [docs/examples.md](../examples.md), [docs/overture-schema.md](../overture-schema.md)
