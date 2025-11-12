# Adapters

Client adapters for multi-platform MCP server configuration sync.

## Purpose

This directory contains adapter implementations for different AI development clients. Each adapter translates Overture's canonical configuration format into the client-specific format required by that platform.

## Structure

```
adapters/
├── client-adapter.interface.ts  # Abstract adapter interface
├── adapter-registry.ts           # Adapter registry and detection
├── claude-code-adapter.ts        # Claude Code adapter
├── claude-desktop-adapter.ts     # Claude Desktop adapter
├── vscode-adapter.ts             # VS Code adapter (v0.2.1+)
├── jetbrains-copilot-adapter.ts  # JetBrains Copilot adapter (v0.2.1+)
└── copilot-cli-adapter.ts        # GitHub Copilot CLI adapter (v0.3+)
```

## Responsibilities

Each adapter must:
1. **Detect** client installation and config file paths
2. **Read** client-specific MCP configuration
3. **Write** client-specific MCP configuration
4. **Convert** between Overture config and client config formats
5. **Validate** transport type support
6. **Handle** environment variable expansion (client-aware)

## Adding New Adapters

To add support for a new client:

1. Create `{client}-adapter.ts` implementing `ClientAdapter` interface
2. Register adapter in `adapter-registry.ts`
3. Add client-specific path detection logic
4. Implement schema conversion if client uses non-standard format
5. Add unit tests in `__tests__/adapters/`

See `claude-code-adapter.ts` for a reference implementation.

## Version

**Overture v0.2+**
