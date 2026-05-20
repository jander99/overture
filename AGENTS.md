# AGENTS.md — Overture Codebase Guide

AI agent guidance for GitHub Copilot, Cursor, OpenCode, and other tools working in this codebase.

## What Overture Does

Overture is a multi-platform MCP configuration orchestrator. It manages Model Context Protocol (MCP) server configurations and AI agents across **3 AI clients** (Claude Code, GitHub Copilot CLI, OpenCode) from a single `config.yaml` source of truth.

Key responsibilities: config loading/merging, client detection, config generation (`.mcp.json`, `opencode.json`, `.github/mcp.json`), agent sync, plugin management, skill sync, and diagnostics.

## Architecture: Hexagonal (Ports & Adapters)

```
libs/ports/        Pure TypeScript interfaces (no implementation)
libs/domain/       Types + Zod schemas (zero Node.js deps, only zod)
libs/core/         Business logic (depends on ports + domain only)
libs/adapters/     Node.js implementations + AI client adapters
libs/shared/       Cross-cutting utilities, formatters, test helpers
apps/cli/          CLI commands + DI composition root
```

**Critical invariant**: `libs/core/**` and `libs/domain/**` MUST NOT import `node:*` or `libs/adapters/infrastructure`. The ONLY place where infrastructure is instantiated is `apps/cli/src/composition-root.ts`.

## Package Alias Map

Use these aliases (defined in `tsconfig.base.json`) — never use relative paths across package boundaries.

| Alias | Package | Key Contents |
| --- | --- | --- |
| `@overture/config-types` | `libs/domain/config-types` | 15 type files: adapter, agent, base, client, config, discovery, import, mcp, plugin, skill, sync, utility, validation types |
| `@overture/config-schema` | `libs/domain/config-schema` | Zod schemas (434L), marketplace registry (349L) |
| `@overture/errors` | `libs/domain/errors` | OvertureError hierarchy + exit codes |
| `@overture/config-core` | `libs/core/config` | ConfigLoader (548L), PathResolver (748L) |
| `@overture/discovery-core` | `libs/core/discovery` | DiscoveryService (563L), WSL2Detector, BinaryDetector |
| `@overture/sync-core` | `libs/core/sync` | SyncEngine (1299L), McpSyncService (554L), BackupService |
| `@overture/plugin-core` | `libs/core/plugin` | PluginDetector (425L), Installer (387L), Exporter (424L) |
| `@overture/diagnostics-core` | `libs/core/diagnostics` | 5 checkers: agents, clients, config-repo, mcp, skills |
| `@overture/agent-core` | `libs/core/agent` | AgentSyncService |
| `@overture/skill` | `libs/core/skill` | SkillDiscovery, SkillSyncService |
| `@overture/client-adapters` | `libs/adapters/client-adapters` | 3 adapters + registry + factory + BaseClientAdapter |
| `@overture/adapters-infrastructure` | `libs/adapters/infrastructure` | Node.js FilesystemAdapter, ProcessAdapter, OutputAdapter |
| `@overture/ports-filesystem` | `libs/ports/filesystem` | FilesystemPort interface |
| `@overture/ports-process` | `libs/ports/process` | ProcessPort interface |
| `@overture/ports-output` | `libs/ports/output` | OutputPort interface |
| `@overture/utils` | `libs/shared/utils` | error-handler (787L), validation-formatter (404L), 12 more |
| `@overture/testing` | `libs/shared/testing` | builders, fixtures, mocks; config.builder.ts (441L) |

## Where to Look

| Task | Location |
| --- | --- |
| Add a CLI command | `apps/cli/src/cli/commands/` + register in `apps/cli/src/cli/index.ts` |
| Change DI wiring | `apps/cli/src/composition-root.ts` (ONLY infra instantiation point) |
| Modify sync behavior | `libs/core/sync/src/lib/sync-engine.ts` (1299L) |
| Add a diagnostic check | `libs/core/diagnostics/src/lib/checkers/` |
| Add/change config types | `libs/domain/config-types/src/lib/` |
| Add/change Zod schemas | `libs/domain/config-schema/src/lib/config-schema.ts` |
| Add a client adapter | `libs/adapters/client-adapters/src/lib/adapters/` |
| Change path resolution | `libs/core/config/src/lib/path-resolver.ts` |
| Add error type | `libs/domain/errors/src/lib/` |
| Add test helper/mock | `libs/shared/testing/src/lib/` |
| Add a utility | `libs/shared/utils/src/lib/` |
| Format output | `libs/shared/formatters/src/lib/formatters/` |

## Conventions

### ESM (Pure ESM Project)

- All imports use `.js` extension (even when importing `.ts` files)
- `import { foo } from './utils.js'` — always `.js`
- No `require()` anywhere
- `__dirname` equivalent: `const __dirname = dirname(fileURLToPath(import.meta.url))`

### TypeScript Strict

- `noUnusedLocals`, `noImplicitReturns`, `noImplicitOverride` all enabled
- **NEVER** use `as any`, `@ts-ignore`, or `@ts-expect-error`
- Exception: `// eslint-disable-next-line security/detect-object-injection` when index is a validated `Platform` type

### Testing (Vitest)

- `globals: true` → no need to import `describe`, `it`, `expect`, `beforeEach`, `vi`
- `environment: 'node'`, v8 coverage provider
- Tests co-located with source: `foo.ts` → `foo.spec.ts`
- Use `@overture/testing` builders/fixtures for config objects — never construct them inline
- Mock all filesystem/process operations — no real I/O in unit tests

### Diagnostic Pattern

- Diagnostic checkers **never throw** — always return results with error messages
- Return type: `DiagnosticResult[]` or similar typed result
- Pattern: collect errors into array, return at end

### Dependency Injection

- All services use constructor injection
- Dependencies flow: `composition-root.ts` → commands → services → ports
- Never instantiate `Node*Adapter` classes outside `composition-root.ts`

## Anti-Patterns (NEVER do these)

- **Import `node:*` in `libs/core/` or `libs/domain/`** — use ports interfaces instead
- **Import `@overture/adapters-infrastructure` in `libs/core/` or `libs/domain/`**
- **Use relative paths across package boundaries** — use `@overture/*` aliases
- **Suppress TypeScript errors** — fix the type, don't hide it
- **Throw inside diagnostic checkers** — always return results
- **Skip `.js` extension on relative imports** — ESM requires it
- **Instantiate adapters outside composition-root.ts**

## Directory Structure

```
apps/
├── cli/src/
│   ├── cli/commands/     # 10 commands: init, sync, validate, doctor, mcp, plugin, user, audit, backup, skill
│   ├── cli/index.ts      # createProgram() — registers all commands
│   ├── lib/              # option-parser.ts, config-loader.ts, formatters/, validators/
│   ├── core/             # process-lock.ts (prevents concurrent runs)
│   ├── test-utils/       # app-dependencies.mock.ts (373L), test-fixtures.ts (303L)
│   ├── composition-root.ts  # DI wiring (307L) — ONLY infra instantiation point
│   └── main.ts           # CLI entry point
└── cli-e2e/              # End-to-end tests

libs/
├── domain/               # Types + schemas — no Node.js deps
│   ├── config-types/     # 15 TypeScript interface files
│   ├── config-schema/    # Zod schemas + marketplace registry
│   ├── diagnostics-types/ # Diagnostic result types
│   └── errors/           # OvertureError hierarchy + exit codes
├── ports/                # Pure interfaces
│   ├── filesystem/       # FilesystemPort
│   ├── process/          # ProcessPort
│   └── output/           # OutputPort
├── adapters/             # Node.js implementations
│   ├── client-adapters/  # 3 adapters (claude-code, copilot-cli, opencode) + registry + factory
│   └── infrastructure/   # NodeFilesystemAdapter, NodeProcessAdapter, etc.
├── core/                 # Business logic
│   ├── sync/             # SyncEngine (1299L), McpSyncService, BackupService
│   ├── config/           # ConfigLoader (548L), PathResolver (748L)
│   ├── discovery/        # DiscoveryService, BinaryDetector, WSL2Detector
│   ├── diagnostics/      # 5 checkers (agents, clients, config-repo, mcp, skills)
│   ├── plugin/           # PluginDetector, Installer, Exporter
│   ├── agent/            # AgentSyncService
│   └── skill/            # SkillDiscovery, SkillSyncService
└── shared/               # Cross-cutting
    ├── utils/            # error-handler (787L), validation-formatter, 12 more
    ├── formatters/       # sync-formatter (601L), config-repo-formatter, 11 more
    ├── testing/          # builders, fixtures, mocks
    └── cli-utils/        # verbose-mode.ts
```

## CLI Commands

| Command | File | Description |
| --- | --- | --- |
| `overture init` | `init.ts` | Initialize `.overture/config.yaml` |
| `overture sync` | `sync.ts` | Sync MCPs + agents + skills to all clients |
| `overture validate` | `validate.ts` | Validate config files |
| `overture doctor` | `doctor.ts` | System diagnostics |
| `overture mcp` | `mcp-commands.ts` | MCP server management |
| `overture plugin` | `plugin-commands.ts` | Plugin management |
| `overture user` | `user-commands.ts` | User global config management |
| `overture audit` | `audit-commands.ts` | Find unmanaged MCPs |
| `overture backup` | `backup-commands.ts` | Backup/restore configs |
| `overture skill` | `skill-commands.ts` | Skill management |

## Development Commands

**Always use `nx` commands, never run underlying tools directly.**

```bash
# Install
npm install

# Test
nx test @overture/cli
nx test @overture/cli --watch
nx test @overture/cli --coverage

# Lint + format (must pass before commit)
nx run-many -t lint --all
npx prettier --check .
npx prettier --write .

# Build
nx build @overture/cli
node dist/apps/cli/main.js --help

# Nx utilities
nx graph                    # visualize dependency graph
nx reset                    # clear cache
npx tsc --noEmit            # type check without build
```

## CI Pipeline

`.github/workflows/ci.yml` runs two jobs:
1. **quality**: `nx run-many -t lint --all` + `prettier --check .`
2. **test** (requires quality): `nx test @overture/cli` on Node.js 20

## Git Workflow

- Default branch: `main`
- Feature branches: `feat/*`, `fix/*`, `docs/*`, `refactor/*`, `test/*`
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `build:`, `chore:`
- **Pull `main` before starting work. Work on a branch. Create a PR.**

## Notes

- `apps/cli/src/cli/commands/doctor.ts.backup` — leftover file, ignore
- Version string lives in `apps/cli/src/cli/index.ts` as `CLI_VERSION`
- Config supports both `.yaml` and `.yml` extensions; `.yaml` preferred; `.yml` shows deprecation warning
- Environment variable expansion: `${VAR}` (required) and `${VAR:-default}` (with fallback)
- WSL2 detection handles path translation between Windows/Linux file systems

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors

<!-- nx configuration end-->
