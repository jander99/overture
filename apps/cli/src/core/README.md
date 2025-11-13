# Core

Core business logic and orchestration for Overture.

## Purpose

This directory contains the core engine components that coordinate configuration loading, syncing, validation, and backup operations across multiple clients.

## Structure

```
core/
├── config-loader.ts           # Configuration loading with precedence
├── path-resolver.ts           # Cross-platform path resolution
├── env-expander.ts            # Environment variable expansion
├── sync-engine.ts             # Main sync orchestrator
├── backup-service.ts          # Backup and restore operations
├── merge-strategy.ts          # Config merge logic
├── process-lock.ts            # Process locking to prevent concurrent runs
├── validator.ts               # Configuration validation
├── generator.ts               # CLAUDE.md generation
├── plugin-installer.ts        # Plugin installation
└── mcp-registry.ts            # MCP server registry
```

## Responsibilities

- **Configuration Management**: Load, validate, merge user and project configs
- **Path Resolution**: Resolve platform-specific paths with env var expansion
- **Sync Orchestration**: Coordinate multi-client sync operations
- **Backup & Restore**: Manage configuration backups
- **Locking**: Prevent concurrent Overture runs
- **Validation**: Validate schemas, transport support, MCP availability

## Dependencies

Core modules depend on:
- `domain/` for types and schemas
- `infrastructure/` for file system operations
- `adapters/` for client-specific logic

## Version

**Overture v0.1+ (expanded in v0.2)**
