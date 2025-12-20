# Continuation Prompt: Streamline Overture to 3 Clients

## Context

You are continuing a refactoring effort to streamline Overture from supporting 10 AI clients down to just 3:

- **Keep:** Claude Code, GitHub Copilot CLI, OpenCode
- **Remove:** Claude Desktop, VSCode, Cursor, Windsurf, JetBrains, Codex, Gemini CLI

## Progress So Far

✅ **Phase 1 Complete** (commit d588210)

- Updated `ClientName` type from 10 to 3 clients
- Updated schema validation (config-schema, config-types)
- Fixed all schema tests (107 passing)

✅ **Phase 2 Complete** (commit d588210)

- Updated `getClientConfigPath()` switch statement in path-resolver.ts
- Removed references to deleted clients
- Fixed all path resolver tests (61 passing)

## What's Next

### Phase 3: Implement Copilot CLI Adapter (HIGH PRIORITY)

**Research Available:**

- Comprehensive research doc at: `docs/archive/copilot-agent-schema-research-2025-12-14.md`
- Path resolution already configured in path-resolver.ts (getCopilotCliPath method exists)
- WSL2 detection configured in libs/core/discovery

**Implementation Needed:**

1. **Create copilot-cli.adapter.ts** at `libs/adapters/client-adapters/src/lib/adapters/copilot-cli.adapter.ts`

```typescript
/**
 * Copilot CLI Adapter
 *
 * Adapter for GitHub Copilot CLI client.
 * Supports both user-level and project-level MCP configurations.
 *
 * Config locations:
 * - User: ~/.copilot/mcp-config.json (all platforms, respects XDG_CONFIG_HOME on Linux)
 * - Project: ./.github/mcp.json
 *
 * @module adapters/copilot-cli.adapter
 * @version 3.0 - Hexagonal Architecture with Dependency Injection
 */

import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import {
  BaseClientAdapter,
  type ConfigPathResult,
  type ClientMcpConfig,
  type ClientMcpServerDef,
} from '../client-adapter.interface.js';
import type { Platform, OvertureConfig } from '@overture/config-types';
import { McpError } from '@overture/errors';

export class CopilotCliAdapter extends BaseClientAdapter {
  readonly name = 'copilot-cli' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly environment: EnvironmentPort,
  ) {
    super();
  }

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    const userPath = this.getCopilotCliGlobalPath(platform);
    const projectPath = this.getCopilotCliProjectPath(projectRoot);

    return {
      user: userPath,
      project: projectPath,
    };
  }

  async readConfig(path: string): Promise<ClientMcpConfig> {
    const exists = await this.filesystem.exists(path);
    if (!exists) {
      return { mcpServers: {} };
    }

    try {
      const content = await this.filesystem.readFile(path);
      const parsed = JSON.parse(content);

      if (!parsed.mcpServers) {
        return { mcpServers: {} };
      }

      return parsed;
    } catch (error) {
      throw new McpError(
        `Failed to read Copilot CLI config at ${path}: ${(error as Error).message}`,
        this.name,
      );
    }
  }

  async writeConfig(path: string, config: ClientMcpConfig): Promise<void> {
    try {
      const dir = this.getDirname(path);
      const dirExists = await this.filesystem.exists(dir);
      if (!dirExists) {
        await this.filesystem.mkdir(dir, { recursive: true });
      }

      const content = JSON.stringify(config, null, 2);
      await this.filesystem.writeFile(path, content);
    } catch (error) {
      throw new McpError(
        `Failed to write Copilot CLI config to ${path}: ${(error as Error).message}`,
        this.name,
      );
    }
  }

  convertFromOverture(
    overtureConfig: OvertureConfig,
    platform: Platform,
  ): ClientMcpConfig {
    const mcpServers: Record<string, ClientMcpServerDef> = {};

    for (const [name, mcpConfig] of Object.entries(overtureConfig.mcp)) {
      // Skip GitHub MCP - Copilot CLI bundles it by default
      if (name === 'github') {
        continue;
      }

      if (!this.shouldSyncMcp(mcpConfig, platform)) {
        continue;
      }

      const serverConfig = this.buildServerConfig(mcpConfig, platform);

      mcpServers[name] = {
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      };
    }

    return { mcpServers };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    return true; // Copilot CLI supports all transport types
  }

  needsEnvVarExpansion(): boolean {
    return false; // Copilot CLI has native ${VAR} support
  }

  override getBinaryNames(): string[] {
    return ['copilot', 'github-copilot-cli'];
  }

  override getAppBundlePaths(_platform: Platform): string[] {
    return []; // CLI-only client
  }

  override requiresBinary(): boolean {
    return true;
  }

  private getCopilotCliGlobalPath(platform: Platform): string {
    const env = this.environment.env;
    const homeDir = env.HOME || env.USERPROFILE || '/';

    switch (platform) {
      case 'darwin':
      case 'linux': {
        const configBase = env.XDG_CONFIG_HOME || `${homeDir}/.config`;
        return `${configBase}/.copilot/mcp-config.json`;
      }
      case 'win32': {
        return `${homeDir}\\.copilot\\mcp-config.json`;
      }
      default:
        throw new McpError(`Unsupported platform: ${platform}`, this.name);
    }
  }

  private getCopilotCliProjectPath(projectRoot?: string): string {
    const root = projectRoot || this.environment.env.PWD || '/';
    return `${root}/.github/mcp.json`;
  }

  private getDirname(filePath: string): string {
    const lastSlash = Math.max(
      filePath.lastIndexOf('/'),
      filePath.lastIndexOf('\\'),
    );
    return lastSlash === -1 ? '.' : filePath.substring(0, lastSlash);
  }
}
```

2. **Create copilot-cli.adapter.spec.ts** - Follow opencode.adapter.spec.ts pattern (39 tests)

3. **Register in adapter-factory.ts:**

```typescript
import { CopilotCliAdapter } from './adapters/copilot-cli.adapter.js';

// In createAdapterRegistry():
registry.register(new ClaudeCodeAdapter(filesystem, environment));
registry.register(new CopilotCliAdapter(filesystem, environment));  // ADD THIS
registry.register(new OpenCodeAdapter(filesystem, environment));

// In createAdapter():
case 'copilot-cli':
  return new CopilotCliAdapter(filesystem, environment);
```

4. **Export from index.ts:**

```typescript
export { CopilotCliAdapter } from './lib/adapters/copilot-cli.adapter.js';
```

### Phase 4: Update Sync Engine

File: `libs/core/sync/src/lib/sync-engine.ts`

Update client prioritization (around line 189):

```typescript
const prioritizedClients = ['claude-code', 'copilot-cli', 'opencode'];
```

### Phase 5: Update Test Utilities

File: `apps/cli/src/test-utils/app-dependencies.mock.ts` (lines 152-153)

```typescript
getAllNames: vi.fn().mockReturnValue(['claude-code', 'copilot-cli', 'opencode']),
listAdapters: vi.fn().mockReturnValue(['claude-code', 'copilot-cli', 'opencode']),
```

### Phase 6: Update Command Tests

**Already done in sync.spec.ts** - Verify these are correct, may need minor updates

### Phase 7: Update Documentation (LARGE)

1. **README.md**
   - Lines 18-23: Simplify problem statement (remove VSCode, Cursor, etc.)
   - Line 34: Update client detection list
   - Lines 526-536: Update roadmap
   - Lines 683-761: Simplify comparison matrix to 3 clients
   - Add Copilot CLI features to matrix

2. **docs/user-guide.md**
   - Line 18: Update client list
   - Lines 99-107: Update doctor examples
   - Lines 428-439: Update other examples

3. **AGENTS.md**
   - Line 197: Update from "8 clients" to "3 clients"

4. **Delete Research Docs:**
   - `docs/archive/codex-cli-research-2025-12-14.md`
   - `docs/archive/gemini-cli-research-2025-12-14.md`
5. **Update with deprecation note:**
   - `docs/archive/mcp-format-differences-2025-12-14.md` (add note at top)
   - `docs/archive/multi-cli-roadmap-2025-12-18.md` (add note at top)

### Phase 8: Update Integration Tests

File: `apps/cli-e2e/src/cli/sync-multi-client.spec.ts`

- Remove tests for deleted clients
- Update to use only: claude-code, copilot-cli, opencode

### Phase 9: Final Validation

```bash
# Run all tests
npx nx test @overture/cli

# Check coverage
npx nx test @overture/cli --coverage

# Build
npx nx build @overture/cli

# Test manually
node dist/apps/cli/main.js doctor
node dist/apps/cli/main.js sync --dry-run
```

## Commands to Run

```bash
# See current changes
git status

# Run specific test suites
npx nx test @overture/client-adapters --run
npx nx test @overture/config-core --run
npx nx test @overture/config-schema --run

# Build
npx nx build @overture/cli
```

## Key Notes

1. **Copilot CLI Special Handling:** Skip syncing 'github' MCP (bundled by default)
2. **Path Format:** User: `~/.copilot/mcp-config.json`, Project: `./.github/mcp.json`
3. **Schema:** Uses standard `mcpServers` root key (same as Claude Code)
4. **Native env expansion:** Supports `${VAR}` syntax natively

## Testing Strategy

After implementing adapter:

1. Unit tests for adapter (39+ tests following OpenCode pattern)
2. Integration tests in sync-multi-client.spec.ts
3. Manual testing with `overture doctor` and `overture sync`

## Success Criteria

- ✅ All tests passing (target: 900+ tests)
- ✅ Code coverage maintained (83%+)
- ✅ Copilot CLI adapter fully functional
- ✅ Documentation updated
- ✅ Research docs cleaned up

## Known Issues to Fix

There are TypeScript errors in files that reference deleted clients:

1. **`libs/core/discovery/src/lib/wsl2-detector.ts` (line 46)** - Remove 'claude-desktop' entry
2. **`apps/cli/src/cli/commands/doctor.ts` (lines 37-44, 359)** - Remove references to deleted clients in installation URLs map

These will need to be fixed as part of the implementation.

## Starting Point

You are at commit `d588210`. Continue from Phase 3: Implement Copilot CLI Adapter.

Good luck!
