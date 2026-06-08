# Publishing `@jander99/overture` to npm

This runbook covers the end-to-end flow from a merged PR to a published
release of `@jander99/overture` on the public npm registry. It is the
executable counterpart to the npm/npx readiness phase-set plan at
`.omo/plans/npm-npx-readiness-phase-set.md`.

## Overview

The publish flow is intentionally manual-gated:

1. **release-please** creates a release PR from conventional commits.
2. A maintainer reviews and merges the release PR (this creates a tag
   on `main`).
3. A maintainer runs the **publish workflow** (`workflow_dispatch`)
   on the tag.
4. The publish workflow builds, verifies, and `npm publish`es the
   tarball under the `npm-production` GitHub environment (manual
   approval required).
5. A maintainer runs the **post-publish smoke** commands below.

## Prerequisites (one-time setup)

These are manual UI / web steps performed outside git. Document the
completion status in this runbook when each is done.

- [ ] **npm account** with 2FA enabled. The owner is `jander99`.
- [ ] **npm Trusted Publisher** configured for the package
      `@jander99/overture` on <https://www.npmjs.com/>:
  - Owner: `jander99`
  - Repository: `jander99/overture`
  - Workflow filename: `publish.yml`
  - Allowed action: `npm publish`
- [ ] **GitHub environment** named exactly `npm-production` (in repo
      Settings → Environments) with at least one required reviewer
      (manual approval).
- [ ] **release-please** workflow (`.github/workflows/release-please.yml`)
      is enabled on the repo. The PAT (if used) must have `contents: write`
      and `pull-requests: write` scopes; OIDC (`id-token: write`) is
      preferred.

## Step 1: Land work via conventional commits

release-please derives the next semver from commit messages on `main`.
The mapping is:

| Commit type        | Version bump |
| ------------------ | ------------ |
| `fix: ...`         | patch        |
| `feat: ...`        | minor        |
| `feat!: ...` or    | major        |
| `BREAKING CHANGE:` |              |

Other types (`docs:`, `chore:`, `refactor:`, `test:`, `build:`, `ci:`,
`perf:`) appear in `CHANGELOG.md` but do not bump the version.

## Step 2: release-please opens a release PR

After commits land on `main`, `.github/workflows/release-please.yml`
opens (or updates) a PR titled `chore(main): release @jander99/overture
<new-version>`. The PR body shows the changelog for the release.

Review the PR. Check that:

- The version bump is correct (e.g. `0.0.1` → `0.1.0` for a new
  minor).
- The changelog only includes user-visible changes.
- `apps/cli/package.json` and `CHANGELOG.md` are the only files
  modified.

Merge the PR. This creates a tag like `v0.1.0` on the merge commit.

## Step 3: Run the publish workflow

Go to GitHub → Actions → "Publish @jander99/overture" → "Run
workflow". Supply the tag (e.g. `v0.1.0`). Confirm.

The workflow:

1. Validates the tag input.
2. Checks out the tagged commit.
3. Installs deps (`yarn install --immutable`, Corepack, Node 24).
4. Builds (`yarn nx build @jander99/overture --skip-nx-cache`).
5. Runs `node apps/cli/scripts/verify-package.mjs` (golden file list
   - install + smoke).
6. Enters the `npm-production` environment (requires a reviewer to
   approve before continuing).
7. `npm publish --provenance --access public` from `apps/cli/`.
8. Smoke-checks `npm view @jander99/overture@<version> version`.

If the publish workflow fails at any step, see
[Troubleshooting](#troubleshooting) below.

## Step 4: Post-publish smoke checks

After the publish workflow succeeds, run these from a fresh terminal
on any machine with Node 24+ and npm 11.5.1+:

```bash
# Confirm the version is on the registry:
npm view @jander99/overture version

# Confirm the bin is exposed:
npm view @jander99/overture bin

# Pull a fresh copy through npx (the real user experience):
npx -y @jander99/overture@latest --help
npx -y @jander99/overture@latest detect --json | head -c 200
```

The `detect --json` output should print 14 platforms' worth of
inventory.

## Rollback

Do **not** unpublish unless the publish was a clear leak of secrets
or PII. npm unpublish is destructive and is increasingly restricted.

For ordinary mistakes (a bug shipped in the published version):

1. Open a follow-up PR that fixes the bug.
2. After merge, release-please will propose a patch release.
3. After the patch release is published, run:

   ```bash
   npm deprecate @jander99/overture@<bad-version> "Bug: <description>; use <good-version> instead"
   ```

This nudges users away from the bad version without removing it.

For a published version that was a security regression: open a
PR with a hotfix, get a CVE if appropriate, then publish a new
patch release. Coordinate with users via GitHub Security Advisory.

## Troubleshooting

### "Cannot find project '@jander99/overture'"

The Nx project name must match the npm package name. If you see
this, the rename from `cli` → `@jander99/overture` didn't take.
Re-run:

```bash
yarn nx show project @jander99/overture --json | head -1
```

If that fails, the package name in `apps/cli/package.json` is
inconsistent. Fix the name and re-push.

### "publish workflow completed but `npm view` returns 404"

The registry propagation may lag by a few seconds. Wait 30s and retry.
If it still 404s, check the workflow logs to confirm `npm publish`
exited 0 and the OIDC token exchange succeeded. If the exchange
failed, the Trusted Publisher on npmjs.com may not be configured
correctly — re-check owner, repo, workflow filename, and allowed
action.

### "PROVENANCE_NOT_SIGNED" or similar

This is a Trusted Publishing wiring issue. The OIDC token must be
exchanged for a short-lived publish token; the exchange happens
automatically when permissions and Trusted Publisher are set up
correctly. Re-confirm `permissions: id-token: write` in
`publish.yml` and the Trusted Publisher on npmjs.com.

### "npm publish" runs locally but not in CI

Local runs may use a long-lived `NODE_AUTH_TOKEN` that's not set in
CI. The publish workflow is intentionally tokenless and relies on
Trusted Publishing only. Do not add a fallback token.

## Operational notes

- The publish workflow uses `concurrency: publish-${{ inputs.tag }}`
  with `cancel-in-progress: false`. A second publish of the same tag
  is blocked at the concurrency level, not at the registry.
- `setup-node` pins `node-version: '24'` (LTS). Local Node 25 is
  fine for development but the publish uses 24 for reproducibility.
- The verify-package step is a no-publish gate: it builds, packs,
  and smoke-tests the tarball. The same script runs in the CI
  `package-verify` job on every PR.
- The Trusted Publisher UI is the source of truth for who can
  publish. This runbook does not and should not encode npm tokens.
