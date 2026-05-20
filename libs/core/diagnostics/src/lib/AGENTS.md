# AGENTS.md — libs/core/diagnostics/src/lib

Five diagnostic checkers for `overture doctor`. Each checker validates a specific aspect of system health.

## Checkers

```
diagnostics/src/lib/
├── checkers/
│   ├── agents-checker.ts      # Validates agent YAML+MD pairs in agents directories
│   ├── clients-checker.ts     # Detects installed AI clients and their versions
│   ├── config-repo-checker.ts # Validates config repository existence and structure
│   ├── mcp-checker.ts         # Validates MCP server configs across clients
│   └── skills-checker.ts      # Validates skill files and sync status
└── diagnostics-service.ts     # Orchestrates all 5 checkers, aggregates results
```

## Critical Pattern: Never Throw

```typescript
// CORRECT: collect errors, return results
async check(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  try {
    const agents = await this.filesystem.readDir(agentsPath);
    // validate...
    results.push({ status: 'ok', message: '...' });
  } catch (error) {
    results.push({ status: 'error', message: formatError(error) });
  }
  return results;
}

// WRONG: throwing from a checker
async check(): Promise<DiagnosticResult[]> {
  const agents = await this.filesystem.readDir(agentsPath); // throws → breaks doctor
}
```

## AgentsChecker

Validates that every agent has both a `.yaml` and `.md` file (paired). Checks:
- YAML schema validity
- Markdown file presence
- Agent sync status (in-sync vs needs-update) across all 3 clients

## ClientsChecker

Detects Claude Code, Copilot CLI, OpenCode installation. Returns version info and config path for each.

## McpChecker

Reads each client's MCP config files and validates:
- JSON/YAML parse success
- Required fields present
- No duplicate server names

## Adding a New Checker

1. Create `checkers/my-checker.ts` implementing `check(): Promise<DiagnosticResult[]>`
2. Constructor-inject `FilesystemPort` and any needed services
3. Register in `DiagnosticsService` constructor and call in its `runAll()` method
4. Wire the new checker in `composition-root.ts`

## DiagnosticResult Type

Defined in `@overture/config-types` (diagnostics-types). Fields: `status: 'ok' | 'warning' | 'error'`, `message: string`, optional `detail: string`.
