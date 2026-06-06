# AGENTS.md

Compact guide for AI agents working in the `overture` repository.

## What this repo is

Yarn 4 (Corepack) + Nx 22 monorepo. The only shipped artifact today is the
`overture` CLI in `apps/cli` (entry: `src/main.ts`); `packages/` exists but is
empty and is reserved for future shared libraries. The CLI's purpose is to
sync MCP server configurations across LLM coding platforms — the canonical
per-platform catalog that drives detection and writing logic is
[`docs/coding-platform-mcp-configurations.md`](docs/coding-platform-mcp-configurations.md).
Read that doc before adding support for a new platform.

## Working dir + commands

All commands run from the repo root.

- Install: `yarn install` (Corepack-managed Yarn 4; do not use `npm`).
- Dev run (one-shot, no watch): `yarn nx serve cli`.
- Build: `yarn nx build cli` → `apps/cli/dist/main.js` (CommonJS bundle;
  `bundle: true` preserves the `#!/usr/bin/env node` shebang from `src/main.ts`).
- Test: `yarn nx test cli` (Vitest 3, `jsdom` env, `globals: true`).
- Affected-only: `yarn nx affected -t test` / `yarn nx affected -t build`.
- Local global symlink (so `overture` / `npx overture` work on PATH):
  `yarn nx run cli:link`. Reverse with `yarn nx run cli:unlink`. Re-link after
  every change to `src/main.ts`.

## Gotchas

- **Naming mismatch.** The root `package.json` is named `skills-cli` (legacy
  project name). The app package in `apps/cli/package.json` is named `cli`,
  and the `bin` it exposes is `overture`. None of these three names agree.
  Do not rename without checking the README's `link`/`unlink` script and
  `.github/mcp.json` references.
- **`tsconfig.base.json` sets `customConditions: ["skills-cli"]`.** No current
  package exports this condition. Leave it alone unless you are also fixing
  the legacy naming; removing it will silently change module resolution for
  any package that ends up using `import ... from 'pkg'`.
- **CI install is broken.** `.github/workflows/ci.yml` runs `npm ci` with
  `cache: 'npm'`, but the repo only ships `yarn.lock` (no `package-lock.json`).
  The install step will fail. Local dev uses `yarn install` via Corepack. If
  you fix the CI, also flip the setup-node cache to `yarn` and pin
  `packageManager` to a Yarn-4-compatible hash.
- **CI also runs `npx nx run-many -t lint --all` and `npx prettier --check .`**,
  but neither `eslint` / `@nx/eslint` nor `prettier` is in the root
  `devDependencies`, and no `lint` target is defined under `apps/cli` or in
  `nx.json` for the apps. These steps will fail until tooling is added.
  There is no formatting or linting configured locally yet.
- **The `bin` points at the built artifact.** `overture` won't work after a
  fresh checkout until you `yarn nx run cli:link` (which builds + `npm link`s).
  The bundle has no vendored `node_modules`; it expects to run inside a
  workspace that supplies the CLI's deps transitively.
- **NX caches are on** for `build`, `test`, `lint`, `@nx/esbuild:esbuild`, and
  `@nx/vitest:test` (see `nx.json` → `targetDefaults`). New commands you
  introduce should follow the same pattern: add to `targetDefaults` and prefer
  `dependsOn: ["^build"]` where it makes sense.
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
- **ESLint / Prettier are not configured yet.** If you add them, wire the
  `lint` target into `nx.json` `targetDefaults` so the CI step actually
  resolves.

## Adding a new package or app

1. Create `packages/<name>/` (or `apps/<name>/`) with its own `package.json`,
   `tsconfig.json` (extending `../../tsconfig.base.json`), and a
   `tsconfig.lib.json` for build / `tsconfig.spec.json` for tests.
2. Add a project reference from the matching root `tsconfig.json`
   (the root `tsconfig.json` and the relevant `apps/*/tsconfig.json`).
3. Update `package.json` `workspaces` if it isn't already covered by
   `packages/*` / `apps/*` globs.
4. For shared libs that should be importable from `apps/cli`, pick a path
   alias consistent with `@overture/*` and add it to `tsconfig.base.json`.

## Things not to change without asking

- `.yarnrc.yml` (`nodeLinker: node-modules`) — switching to PnP will break
  the build and CI.
- The root `package.json` `name` (`skills-cli`) — see Gotchas.
- The `npm ci` install in CI — fix it deliberately, not by adding a
  `package-lock.json` to a Yarn 4 workspace.
