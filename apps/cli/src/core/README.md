# Core

Core business logic and orchestration for Overture.

## Purpose

This directory contains the core engine components that coordinate configuration loading, syncing, validation, and backup operations across multiple clients.

## Structure

```
core/
├── audit-service.ts           # Audit MCP configurations across clients
├── backup-service.ts          # Backup and restore operations
├── client-env-service.ts      # Environment variable expansion for clients
├── config-diff.ts             # Configuration diff generation
├── config-loader.ts           # Configuration loading with precedence
├── env-expander.ts            # Environment variable expansion
├── error-handler.ts           # Centralized error handling
├── exclusion-filter.ts        # MCP filtering by client/platform/transport
├── path-resolver.ts           # Cross-platform path resolution
├── process-lock.ts            # Process locking to prevent concurrent runs
├── restore-service.ts         # Configuration restore operations
├── sync-engine.ts             # Main multi-client sync orchestrator
└── transport-validator.ts     # Transport compatibility validation
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

**Overture v0.2** - Multi-client MCP configuration orchestrator
