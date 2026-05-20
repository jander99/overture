# AGENTS.md — libs/core/config/src/lib

Config loading and path resolution. Two large services: ConfigLoader (548L) and PathResolver (748L).

## Key Files

```
config/src/lib/
├── config-loader.ts    # 548L — loads, merges, and validates config.yaml
├── path-resolver.ts    # 748L — resolves all platform/client-specific paths
└── config-merger.ts    # Merges project config with user global config
```

## ConfigLoader

Loads `.overture/config.yaml` (project) and `~/.config/overture/config.yaml` (user global), merges them with project taking precedence, validates against Zod schema.

```typescript
class ConfigLoader {
  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly process: ProcessPort,
  ) {}

  async load(projectDir: string): Promise<OvertureConfig> { ... }
}
```

Key behaviors:
- Supports both `.yaml` and `.yml` (`.yml` logs deprecation warning)
- Expands `${VAR}` and `${VAR:-default}` environment variables
- Throws `OvertureError` with `CONFIG_NOT_FOUND` exit code when no config found
- Merges user global MCP servers with project MCPs (project wins on conflicts)

## PathResolver

Resolves platform-specific paths for all 3 AI clients and Overture itself. Handles WSL2 path translation (Windows ↔ Linux).

```typescript
class PathResolver {
  constructor(private readonly process: ProcessPort) {}

  getClaudeCodeAgentsDir(): string { ... }
  getOpenCodeAgentsDir(): string { ... }
  getCopilotAgentsDir(projectDir: string): string { ... }
  getOvertureConfigDir(): string { ... }
  // ... 20+ more methods
}
```

Key behaviors:
- All paths computed from `process.env.HOME`, `process.cwd()` via `ProcessPort`
- WSL2 detection: if running in WSL2 and target is Windows path, translates via `/mnt/c/...`
- No hardcoded paths — all derived from environment

## Config Merge Strategy

```
User global config (~/.config/overture/config.yaml)
  +
Project config (.overture/config.yaml)
  ↓
Merged: project MCPs + user MCPs (deduplicated, project wins)
```

`sync.mergeStrategy: 'append'` vs `'replace'` controls how existing client configs are handled.

## Invariants

- No `node:*` imports — all I/O via ports
- ConfigLoader never writes files (read-only)
- PathResolver is pure computation (no I/O)
