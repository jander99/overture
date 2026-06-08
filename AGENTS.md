# AGENTS.md

Compact guide for AI agents working in the `overture` repository.

## What this repo is

Yarn 4 (Corepack) + Nx 22 monorepo. The shipped artifact today is the
`overture` CLI in `apps/cli` (entry: `src/main.ts`); the first shared
library `@overture/os` lives in `packages/os/` and provides cross-platform
OS detection (Windows, macOS, Linux, WSL1/WSL2 with distro). Add new
shared logic as new packages under `packages/`. The CLI's purpose is to
sync MCP server configurations across LLM coding platforms — the canonical
per-platform catalog that drives detection and writing logic is
[`docs/coding-platform-mcp-configurations.md`](docs/coding-platform-mcp-configurations.md).
Read that doc before adding support for a new platform.

## Working dir + commands

All commands run from the repo root.

- Install: `yarn install --immutable` (Corepack-managed Yarn 4; do not use
  `npm`).
- Dev run (one-shot, no watch): `yarn nx serve @jander99/overture`.
- Build: `yarn nx build @jander99/overture` → `apps/cli/dist/main.js`
  (CommonJS bundle; `bundle: true` and `thirdParty: true` preserve the
  `#!/usr/bin/env node` shebang from `src/main.ts` and inline static
  `jsonc-parser` imports).
- Test: `yarn nx test @jander99/overture` (Vitest 4, `jsdom` env,
  `globals: true`).
- Affected-only: `yarn nx affected -t test` / `yarn nx affected -t build`.
- Local global symlink (so `overture` / `npx @jander99/overture` work on
  PATH): `yarn nx run @jander99/overture:link`. Reverse with
  `yarn nx run @jander99/overture:unlink`. Re-link after every change to
  `src/main.ts`.
- Verify a local npm pack + install + smoke (no publish):
  `node apps/cli/scripts/verify-package.mjs`.

## Gotchas

- **Naming.** The root `package.json` is named `skills-cli` (legacy project
  name). The app package in `apps/cli/package.json` is named
  `@jander99/overture` (the npm name), and the bin it exposes is `overture`.
  Nx 22 does **not** honor `packageJson.nx.name` as a CLI alias, so the Nx
  project name equals the npm package name: `yarn nx build @jander99/overture`,
  not `yarn nx build cli`. Don't rename the root `package.json` (see
  "Things not to change without asking" below).
- **`tsconfig.base.json` sets `customConditions: ["skills-cli"]`.** No current
  package exports this condition. Leave it alone unless you are also fixing
  the legacy naming; removing it will silently change module resolution for
  any package that ends up using `import ... from 'pkg'`.
- **CI is correct now.** `.github/workflows/ci.yml` uses `setup-node` with
  Node 24 LTS and `yarn install --immutable` via Corepack. The Quality Gates
  job runs `npx prettier --check .`; the Lint step is a tracked-no-op until
  a lint target is added (see `.omo/plans/`). The Test job runs
  `npx nx test @jander99/overture`. A new `package-verify` job runs
  `node apps/cli/scripts/verify-package.mjs` to assert the npm pack tarball
  shape, smoke-tests the installed binary, and guards the published
  contract. Local dev mirrors these: `yarn install --immutable`,
  `yarn nx test @jander99/overture`, `yarn nx build @jander99/overture`,
  `yarn prettier --check .`.
- **Lint target is not configured.** `npx nx run-many -t lint --all` will
  fail until a `lint` target is added to `apps/cli` (and the corresponding
  ESLint toolchain). The CI step is currently a tracked no-op. Don't try to
  silence it with `|| true`; either wire the target or leave the
  no-op-and-log.
- **`bin` points at the built artifact.** `overture` won't work after a
  fresh checkout until you `yarn nx run @jander99/overture:link` (which
  builds + `npm link`s). The bundle is **partially** vendored: `jsonc-parser`
  is inlined into `dist/main.js` via esbuild's `thirdParty: true` option
  (and a deep ESM import to dodge the UMD wrapper's runtime relative
  requires). `smol-toml` is declared as a runtime `dependency` and loaded
  via `createRequire(__filename)('smol-toml')`; consumers running
  `npm install @jander99/overture` get it installed alongside.
- **NX caches are on** for `build`, `test`, `@nx/esbuild:esbuild`, and
  `@nx/vitest:test` (see `nx.json` → `targetDefaults`). New commands you
  introduce should follow the same pattern: add to `targetDefaults` and prefer
  `dependsOn: ["^build"]` where it makes sense. The publish workflow is
  intentionally not cached.
- **OpenCode / NX MCP servers are checked in.** `.mcp.json` (workspace root)
  and `.github/mcp.json` both register an `nx-mcp` server. Keep them in sync
  if you change one.

## Conventions

- **TypeScript strict is on** in `tsconfig.base.json`: `strict`,
  `noUnusedLocals`, `noImplicitReturns`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `noEmitOnError`. No `any`, no `@ts-ignore`,
  no `@ts-expect-error`. Module mode is `nodenext`, target `es2022`.
- **Vitest** is the only test runner. Config lives at
  `apps/cli/vitest.config.mts`; tests are co-located as `*.spec.ts`. Don't
  introduce Jest or a second test config.
- **The `tsconfig` setup splits build vs. test.** `apps/cli/tsconfig.app.json`
  excludes `*.spec.ts`; `apps/cli/tsconfig.spec.json` includes only the
  vitest config + `*.spec.ts` + `*.d.ts`. Keep that split when adding
  packages.
- **No `prepare` / `prepublish` / `prepublishOnly` scripts** in any
  published package. Consumers should not need a workspace build toolchain
  to install the CLI.

## Adding a new package or app

The `@overture/os` library in `packages/os/` is the canonical template.
When you add a new package:

1. Create `packages/<name>/` (or `apps/<name>/`) with its own `package.json`,
   `tsconfig.json` (extending `../../tsconfig.base.json`), and a
   `tsconfig.lib.json` for build / `tsconfig.spec.json` for tests. Use
   `project.json` with the `@nx/esbuild:esbuild` executor (matches
   `apps/cli` and avoids the `@nx/js:tsc` buildable-lib tmp-tsconfig
   pitfall). Set `composite: true, declaration: true, declarationMap: true`
   in `tsconfig.lib.json`; these are required when `declarationMap` or
   `emitDeclarationOnly` is inherited from the base.
2. Add a project reference from the matching root `tsconfig.json`
   (the root `tsconfig.json` and the relevant `apps/*/tsconfig.json`).
3. Update `package.json` `workspaces` if it isn't already covered by
   `packages/*` / `apps/*` globs.
4. For shared libs that should be importable from `apps/cli`, point
   `package.json` `main`/`types` at the source `.ts` files
   (Yarn workspaces symlinks the package, and esbuild inlines source
   with `thirdParty: true`). Add a `references` entry to
   `apps/cli/tsconfig.app.json` and `apps/cli/tsconfig.spec.json` so
   tsc finds the source via project references (not path aliases —
   composite+references is the supported pattern in Nx 22).

## Things not to change without asking

- `.yarnrc.yml` (`nodeLinker: node-modules`) — switching to PnP will break
  the build and CI.
- The root `package.json` `name` (`skills-cli`) — see Gotchas.
- The `customConditions: ["skills-cli"]` in `tsconfig.base.json` — see
  Gotchas.
- The npm Trusted Publishing workflow (`.github/workflows/publish.yml`)
  once added. The publish workflow is intentionally manual-gated
  (`workflow_dispatch` + protected `npm-production` environment) and
  release-please is not authorized to publish. Don't add a `push: tags:`
  trigger that auto-publishes.
