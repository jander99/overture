# AGENTS.md — libs/shared/utils/src/lib

14 cross-cutting utility modules. Used by core, adapters, and CLI layers.

## Utility Files

| File | Purpose |
| --- | --- |
| `error-handler.ts` (787L) | `handleError()`, `OvertureError` factory helpers, exit code mapping |
| `validation-formatter.ts` (404L) | Format Zod validation errors into human-readable messages |
| `config-resolver.ts` | Resolve config file paths with `.yaml`/`.yml` fallback |
| `env-expander.ts` | Expand `${VAR}` and `${VAR:-default}` in config strings |
| `file-utils.ts` | Common file operation helpers (read JSON, write YAML, etc.) |
| `merge-utils.ts` | Deep merge helpers for config objects |
| `platform-utils.ts` | OS detection, WSL2 detection helpers |
| `string-utils.ts` | String normalization, slugify, case conversion |
| `array-utils.ts` | Deduplication, diff, partition utilities |
| `path-utils.ts` | Path normalization across platforms |
| `logger.ts` | Lightweight logger wrapping `OutputPort` |
| `result-utils.ts` | `Result<T, E>` pattern helpers |
| `version-utils.ts` | Semver comparison helpers |
| `yaml-utils.ts` | YAML parse/stringify with error handling |

## error-handler.ts (Key File)

Contains `handleError(error: unknown): never` — the global error handler called by all CLI commands. Maps:
- `OvertureError` → appropriate exit code (1-99) + formatted message
- `ZodError` → validation error display via `validation-formatter`
- Unknown errors → exit code 1 + stack trace (in DEBUG mode)

Also exports `createOvertureError(code, message, cause?)` factory.

## validation-formatter.ts (Key File)

Transforms Zod `ZodError` into user-friendly output:
```
Config validation failed:
  • mcp.my-server.command: Required
  • sync.mergeStrategy: Expected 'append' | 'replace', got 'merge'
```

## env-expander.ts

Handles `${VAR}` expansion throughout config loading:
- `${VAR}` — required; throws `OvertureError` if `VAR` not set
- `${VAR:-default}` — optional with fallback; returns `default` if not set

## Rules

- All utils are **pure functions** or depend only on `OutputPort` (never `FilesystemPort`)
- No state — stateless utility functions only
- Import these from `@overture/utils`, never via relative path from other packages
