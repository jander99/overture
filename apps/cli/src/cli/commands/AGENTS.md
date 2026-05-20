# AGENTS.md — apps/cli/src/cli/commands

All 10 CLI command handlers. Each file registers subcommands onto Commander.js `program`.

## Command Files

| File                 | Command             | Key Behavior                                         |
| -------------------- | ------------------- | ---------------------------------------------------- |
| `init.ts`            | `overture init`     | Scaffold `.overture/config.yaml` in cwd              |
| `sync.ts`            | `overture sync`     | Run full sync: MCPs + agents + skills to all clients |
| `validate.ts`        | `overture validate` | Validate config YAML against Zod schema              |
| `doctor.ts`          | `overture doctor`   | Run all 5 diagnostic checkers, display results       |
| `mcp-commands.ts`    | `overture mcp`      | MCP server add/remove/list                           |
| `plugin-commands.ts` | `overture plugin`   | Claude Code plugin install/list/export               |
| `user-commands.ts`   | `overture user`     | User global config management                        |
| `audit-commands.ts`  | `overture audit`    | Scan client configs for unmanaged MCPs               |
| `backup-commands.ts` | `overture backup`   | Backup/restore client configs                        |
| `skill-commands.ts`  | `overture skill`    | Agent skill sync/list/validate                       |

`doctor.ts.backup` — leftover file, ignore entirely.

## Command Pattern

```typescript
// Every command follows this pattern:
export function registerMyCommand(
  program: Command,
  deps: AppDependencies,
): void {
  program
    .command('my-command')
    .description('...')
    .option('--flag', 'description')
    .action(async (options) => {
      try {
        const result = await deps.myService.doThing(options);
        deps.output.info(formatResult(result));
      } catch (error) {
        handleError(error); // from main.ts — exits with appropriate code
      }
    });
}
```

## Sync Command Options

`sync.ts` handles: `--skip-agents`, `--skip-skills`, `--skip-plugins`, `--dry-run`, `--detail`. It delegates to `SyncEngine` via `deps.syncEngine.sync(options)`.

## Doctor Command Pattern

`doctor.ts` calls each of the 5 checkers in sequence, collects `DiagnosticResult[]`, and formats output via `@overture/utils` formatters. Checkers never throw — always return results with status.

## Error Handling

All commands wrap their action in `try/catch` and call `handleError(error)`. The `handleError` function (exported from `main.ts`) maps `OvertureError` instances to appropriate exit codes and user-friendly messages.

## Testing Commands

- Mock `AppDependencies` using `../../test-utils/app-dependencies.mock.ts`
- Use Commander.js `.parseAsync(['node', 'overture', 'command', '--flag'])` pattern
- Assert on `deps.output.info` / `deps.output.error` mock calls
