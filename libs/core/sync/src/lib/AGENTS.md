# AGENTS.md — libs/core/sync/src/lib

The sync engine: orchestrates multi-client MCP and agent synchronization. Largest core package (23 files).

## Key Files

```
sync/src/lib/
├── sync-engine.ts              # 1299L — main orchestrator, entry point for all sync operations
├── backup-service.ts           # Backup/restore logic for client configs
├── config-sync-service.ts      # Config file read/write coordination
├── sync-types.ts               # Internal sync result types
└── services/
    ├── mcp-sync-service.ts     # 554L — MCP server config sync per client
    ├── plugin-sync-coordinator.ts  # Plugin installation coordination
    └── config-sync-*.ts        # Additional config sync helpers
```

## SyncEngine (sync-engine.ts)

The main entry point for `overture sync`. Coordinates:

1. Load config (via `ConfigLoader`)
2. Detect clients (via `DiscoveryService`)
3. Sync MCPs to each client adapter
4. Sync agents
5. Sync skills
6. Sync plugins

**Method signature pattern:**

```typescript
class SyncEngine {
  constructor(
    private readonly configLoader: ConfigLoader,
    private readonly filesystem: FilesystemPort,
    private readonly output: OutputPort,
    private readonly adapters: ClientAdapterRegistry,
    // ... other services via DI
  ) {}

  async sync(options: SyncOptions): Promise<SyncResult> { ... }
}
```

## McpSyncService (services/mcp-sync-service.ts)

Handles per-client MCP config generation. For each detected client:

1. Load existing client config
2. Merge/append MCP entries from Overture config
3. Write back via `FilesystemPort`

Uses `ClientAdapter.buildServerConfig()` to transform MCP definitions to client-specific format.

## Adding Sync Behavior

- **New sync step**: Add to `SyncEngine.sync()`, create a new service class, inject via constructor
- **New MCP field**: Update `McpSyncService` + relevant `ClientAdapter.buildServerConfig()`
- **New client**: Add adapter in `libs/adapters/client-adapters/` and register in `AdapterRegistry`

## Invariants

- No `node:*` imports — all I/O via `FilesystemPort` and `ProcessPort`
- No imports from `@overture/adapters-infrastructure`
- Services are stateless between sync runs (fresh load each time)
- All errors propagate as `OvertureError` instances

## BackupService

Creates timestamped backups of client config files before overwriting. Uses `sync.backupRetention` from config to prune old backups.
