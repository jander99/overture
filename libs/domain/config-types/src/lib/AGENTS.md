# AGENTS.md — libs/domain/config-types/src/lib

All TypeScript interface definitions. 15 files, zero runtime deps — pure type declarations.

## Files by Domain

| File | Key Types |
| --- | --- |
| `adapter.types.ts` | `ClientAdapter`, `AdapterConfig`, `ServerConfig` |
| `agent-types.ts` | `AgentConfig`, `AgentDefinition`, `ModelMapping` |
| `base-types.ts` | `Platform`, `ClientName` (`'claude-code' \| 'copilot-cli' \| 'opencode'`) |
| `client-names.ts` | `SUPPORTED_CLIENTS`, `ALL_KNOWN_CLIENTS` consts + `SupportedClientName`, `KnownClientName` types |
| `client-types.ts` | `ClientConfig`, `ClientDetectionResult` |
| `config.types.ts` | `OvertureConfig` (root config shape), `SyncConfig`, `ProjectConfig` |
| `discovery.types.ts` | `DiscoveryResult`, `DetectedClient` |
| `import.types.ts` | `ImportConfig` for config repository imports |
| `mcp-types.ts` | `McpServerConfig`, `McpTransport`, `McpClientFilter` |
| `plugin.types.ts` | `PluginConfig`, `DetectedPlugin` |
| `skill.types.ts` | `SkillConfig`, `SkillDefinition` |
| `sync-types.ts` | `SyncOptions`, `SyncResult`, `SyncStatus` |
| `utility-types.ts` | `DeepPartial`, `Result<T>`, shared utility types |
| `validation-types.ts` | `ValidationResult`, `ValidationError` |

## Rules for This Package

- **No runtime code** — only `interface`, `type`, `enum`, and `const` declarations
- **No imports from `node:*`** — zero Node.js dependencies
- **No imports from other `@overture/*` packages** except `@overture/errors` for error types
- Export everything through `index.ts`

## ClientName vs SupportedClientName

Two overlapping systems:

```typescript
// base-types.ts — the 3 active clients (preferred for MCP/sync logic)
export type ClientName = 'claude-code' | 'copilot-cli' | 'opencode';

// client-names.ts — const arrays (use for iteration or validation)
export const SUPPORTED_CLIENTS = ['claude-code', 'copilot-cli', 'opencode'] as const;
export type SupportedClientName = (typeof SUPPORTED_CLIENTS)[number];

// Also includes legacy/known clients for migration warnings:
export const ALL_KNOWN_CLIENTS = [...SUPPORTED_CLIENTS, 'claude-desktop', 'vscode', ...] as const;
export type KnownClientName = (typeof ALL_KNOWN_CLIENTS)[number];
```

Use `ClientName` for type annotations. Use `SUPPORTED_CLIENTS` when you need to iterate over clients at runtime. Never hardcode client name strings.

## McpServerConfig

```typescript
interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: 'stdio' | 'sse';
  clients?: {
    include?: ClientName[];
    exclude?: ClientName[];
  };
  platforms?: {
    include?: Platform[];
    exclude?: Platform[];
  };
}
```

## Adding a New Type

1. Add to the appropriate existing file (prefer extending existing types)
2. Or create `new-thing.types.ts` if the domain is distinct
3. Export from `index.ts`
4. Never add implementation logic — types only
