# AGENTS.md — libs/adapters/client-adapters/src/lib

Three AI client adapters + registry + factory. Translates Overture config to each client's native format.

## Files

```
client-adapters/src/lib/
├── adapters/
│   ├── claude-code.adapter.ts   # Generates .mcp.json and ~/.claude.json
│   ├── copilot-cli.adapter.ts   # Generates .github/mcp.json
│   └── opencode.adapter.ts      # Generates opencode.json
├── client-adapter.interface.ts  # 389L — ClientAdapter interface + BaseClientAdapter abstract class
├── adapter-registry.ts          # AdapterRegistry — maps ClientName → adapter instance
├── adapter-factory.ts           # AdapterFactory — constructs adapters with deps
└── skill-paths.ts               # Skill path resolution per client
```

## ClientAdapter Interface

```typescript
interface ClientAdapter {
  readonly clientName: ClientName;

  // Check if this adapter should handle MCP for the given server config
  shouldSyncMcp(serverConfig: McpServerConfig): boolean;

  // Transform Overture MCP config → client-specific server config object
  buildServerConfig(
    name: string,
    serverConfig: McpServerConfig,
  ): Record<string, unknown>;

  // Write the final config file(s) for this client
  writeConfig(config: OvertureConfig, projectDir: string): Promise<void>;

  // Read existing client config (for merge strategy)
  readExistingConfig(
    projectDir: string,
  ): Promise<Record<string, unknown> | null>;
}
```

`BaseClientAdapter` (abstract class in `client-adapter.interface.ts`) provides default implementations of `shouldSyncMcp` (checks `clients.include`/`clients.exclude`) and common helpers.

## Adding a New Client Adapter

1. Create `adapters/new-client.adapter.ts` extending `BaseClientAdapter`
2. Implement `writeConfig()` and `buildServerConfig()`
3. Add `'new-client'` to `CLIENT_NAMES` in `@overture/config-types`
4. Register in `AdapterRegistry` and `AdapterFactory`
5. Wire in `composition-root.ts`

## Per-Client Config Locations

| Client      | Project Config     | User Config                      |
| ----------- | ------------------ | -------------------------------- |
| claude-code | `.mcp.json`        | `~/.claude.json`                 |
| copilot-cli | `.github/mcp.json` | —                                |
| opencode    | `opencode.json`    | `~/.config/opencode/config.json` |

## shouldSyncMcp Logic

```typescript
// BaseClientAdapter default:
shouldSyncMcp(serverConfig: McpServerConfig): boolean {
  const { include, exclude } = serverConfig.clients ?? {};
  if (include) return include.includes(this.clientName);
  if (exclude) return !exclude.includes(this.clientName);
  return true; // sync to all by default
}
```

## skill-paths.ts

Maps each `ClientName` to the filesystem path where skills/agents are stored. Used by `SkillSyncService`.
