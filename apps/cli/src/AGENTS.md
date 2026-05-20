# AGENTS.md — apps/cli/src

CLI application root: composition root (DI wiring), CLI bootstrap, entry point, and shared app utilities.

## This Directory

```
apps/cli/src/
├── composition-root.ts   # DI wiring (307L) — ONLY place where Node adapters are instantiated
├── main.ts               # CLI entry point — calls createProgram(), handleError exported for tests
├── cli/
│   ├── index.ts          # createProgram() — registers all commands, CLI_VERSION constant
│   └── commands/         # 10 command files (see commands/AGENTS.md)
├── lib/
│   ├── option-parser.ts  # Commander.js option parsing helpers
│   ├── config-loader.ts  # CLI-layer config loading wrapper
│   ├── formatters/       # Output formatters for CLI display
│   └── validators/       # Input validators for CLI args
├── core/
│   └── process-lock.ts   # Prevents concurrent CLI runs via lock file
└── test-utils/
    ├── app-dependencies.mock.ts  # 373L — mock AppDependencies for unit tests
    └── test-fixtures.ts          # 303L — shared test fixtures
```

## Composition Root (CRITICAL)

`composition-root.ts` is the **only** file in the entire codebase allowed to import from `@overture/adapters-infrastructure`. It wires all concrete implementations to their port interfaces and returns an `AppDependencies` object consumed by commands.

```typescript
// Pattern in composition-root.ts:
const filesystem = new NodeFilesystemAdapter();
const process = new NodeProcessAdapter();
const output = new NodeOutputAdapter();

// Services are constructed with ports, never with concrete adapters
const configLoader = new ConfigLoader(filesystem, process);
const syncEngine = new SyncEngine(configLoader, filesystem, output, ...);
```

**Never add infrastructure imports anywhere else.** If a service needs filesystem access, it must accept `FilesystemPort` via constructor injection.

## Adding a New Command

1. Create `apps/cli/src/cli/commands/my-command.ts`
2. Export a `registerMyCommand(program: Command, deps: AppDependencies)` function
3. Import and call it in `apps/cli/src/cli/index.ts` inside `createProgram()`
4. Wire any new services it needs in `composition-root.ts`

## AppDependencies Interface

The `AppDependencies` type (defined near `composition-root.ts`) carries all service instances. Commands receive it as a parameter — never construct services inside command handlers.

## Test Patterns

- Unit tests use `app-dependencies.mock.ts` to get a fully mocked `AppDependencies`
- Mock all port calls with `vi.fn()` — no real I/O
- Use `test-fixtures.ts` for pre-built config objects
