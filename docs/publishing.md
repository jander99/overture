# Publishing `@jander99/overture` to npm — manual runbook

This runbook is the canonical publish procedure for `@jander99/overture`
on npmjs.com. It is written for a maintainer (you) who has **not yet
completed the one-time setup** — so it starts with that and ends with
the publish trigger.

## Overview

The release flow is **manual-gated** end to end. There are two distinct
workflows, each triggered from the GitHub Actions UI:

1. **`.github/workflows/release.yml`** — cuts the release. Produces a
   `vX.Y.Z` tag, a `CHANGELOG.md` update at the workspace root, and a
   GitHub Release whose body is the changelog. Driven by
   `yarn nx release --skip-publish` from Nx 23.
2. **`.github/workflows/publish.yml`** — publishes the tagged release
   to npm. Uses Trusted Publishing (OIDC, no long-lived npm token).
   Runs in the `npm-production` GitHub environment (requires a reviewer
   to approve before continuing).

Both workflows are **`workflow_dispatch`-only**. No `push` or
`pull_request` trigger can reach the registry. A release tag created
by `release.yml` will never auto-publish.

## One-time setup

These are manual steps performed outside git. Tick them off as you
complete them. They only need to happen once per npm package + GitHub
repo.

### Step 1 — npmjs.com account and 2FA

- [ ] Register or sign in at <https://www.npmjs.com/>.
- [ ] Enable two-factor authentication. 2FA is required for the
      `jander99` org and for any account that publishes scoped public
      packages. Recommended: TOTP (e.g. Authy, 1Password) or a hardware
      security key. SMS is supported but is being deprecated.
- [ ] Verify the org membership. The Trusted Publisher UI assumes
      the org owner can configure the publisher settings; the user
      account you register under must have admin or owner access on
      the org.

### Step 2 — npm Trusted Publisher for `@jander99/overture`

- [ ] Go to <https://www.npmjs.com/> and sign in.
- [ ] Click your avatar → "Account" → "Trusted Publishers".
      (If you do not see the org-level settings, switch to the
      `jander99` org from the avatar menu first.)
- [ ] Click "Add a Trusted Publisher".
- [ ] Select "GitHub Actions".
- [ ] Fill in:
  - **Owner or org**: `jander99`
  - **Repository**: `jander99/overture`
  - **Workflow filename**: `publish.yml`
  - **Allowed action**: `npm publish`
- [ ] Save. The package `@jander99/overture` will appear in your
      "Trusted Publishers" list. (If the package does not exist yet, you
      can still configure the Trusted Publisher; the link becomes active
      the first time `npm publish` runs and the org/package pair is
      matched.)
- [ ] If `@jander99/overture` is to be a public package (it is),
      make sure the package's access setting is `public`. This is set
      in `apps/cli/package.json` (`"publishConfig": { "access": "public" }`)
      and is honored by `npm publish --access public`.

### Step 3 — GitHub `npm-production` environment

- [ ] In the repo at <https://github.com/jander99/overture>, go to
      Settings → Environments → "New environment".
- [ ] Name: exactly `npm-production` (the publish workflow pins
      this name; a typo will surface as a workflow error).
- [ ] Under "Deployment protection rules", check "Required
      reviewers" and add at least one maintainer (yourself is fine for
      the first publish). This is the manual approval gate.
- [ ] (Optional) Add a "Wait timer" if you want a delay between
      trigger and the env actually becoming available. Default is no
      delay.
- [ ] Save. The environment is now active; the publish workflow
      will hit the "Required reviewers" check on every run.

### Step 4 — Branch protection bypass for `github-actions[bot]`

`release.yml` pushes a commit and an annotated tag to `main` from the
runner. The push is attributed to `github-actions[bot]`.

- If `main` is unprotected: no action is needed.
- If `main` is branch-protected: add `github-actions[bot]` as a
  **bypass actor** for the rule covering `main`. In the repo, go to
  Settings → Rules → Rulesets (or Settings → Branches → Branch
  protection rules on the classic model) and add the bypass.

Without the bypass, the workflow will fail at the `git push` step
with a clear "remote rejected" error. Verify by triggering
`release.yml` with `dry-run: true` first (the dry-run doesn't push
but it confirms config + checkout), then re-run with `dry-run: false`
and watch the push succeed.

## Cutting a release

`release.yml` is `workflow_dispatch`-only and runs from `main`. It
will hard-fail if triggered from any other ref.

### Step 1 — Ensure `main` is green

`ci.yml` runs on `push: branches: [main]`. The release push has
`[skip ci]` in its commit message, so it does **not** re-trigger
`ci.yml`. Confirm `main` is green before cutting.

### Step 2 — Preview with `dry-run: true`

From GitHub → Actions → "Release @jander99/overture" → "Run
workflow":

- **specifier**: `major` / `minor` / `patch` (default `minor`)
- **dry-run**: `true` (default — preview only)
- **first-release**: `true` for the first cut of
  `@jander99/overture`, `false` thereafter (default `true`)

The workflow runs `yarn nx release --skip-publish --specifier=<x>
--dry-run [--first-release]` and prints:

- The proposed new version (e.g. `0.1.0 → 0.1.1`).
- The proposed `CHANGELOG.md` entry.
- The git operations it would perform (commit, tag, push).

Nothing is written. Confirm the version + changelog look right.

### Step 3 — Apply with `dry-run: false`

Re-run the workflow with the same `specifier` and `first-release`,
but `dry-run: false`. The workflow:

1. Bumps `apps/cli/package.json` version.
2. Updates `yarn.lock` if needed.
3. Updates `CHANGELOG.md` at the workspace root.
4. Creates an annotated `vX.Y.Z` tag.
5. Commits and pushes the release to `main` (attributed to
   `github-actions[bot]`).
6. Creates a GitHub Release whose body is the new `CHANGELOG.md`
   entry.

The push will skip `ci.yml` and `validate.yml` (the `[skip ci]`
suffix on the release commit message blocks both, and tag pushes
don't match their `branches: [main]` filter).

After this step, the new tag is on `origin/main`. You can now
publish.

> **Note**: After the first successful release, change the
> `first-release` default in `.github/workflows/release.yml` to
> `false` so subsequent cuts use the latest tag as their baseline.

## Publishing a release

### Step 1 — Trigger and approve

Go to GitHub → Actions → "Publish @jander99/overture" → "Run
workflow". Supply the tag created by the release workflow (e.g.
`v0.1.1`). Confirm.

The workflow is gated on the `npm-production` environment at the
**job** level (`publish.yml:54`), which means GitHub holds the
entire job pending reviewer approval before any step runs. Approve
when ready; the steps then run in this order:

1. Validates the tag input.
2. Checks out the tagged commit.
3. Installs deps (`yarn install --immutable`, Corepack, Node 24).
4. Builds (`yarn nx build @jander99/overture --skip-nx-cache`).
5. Runs `node apps/cli/scripts/verify-package.mjs` (golden file
   list + install + smoke).
6. `npm publish --provenance --access public` from `apps/cli/`.
7. Smoke-checks `npm view @jander99/overture@<version> version`.

If the workflow fails at any step, see [Troubleshooting](#troubleshooting).

### Step 2 — Post-publish smoke checks

After the publish workflow succeeds, run these from a fresh
terminal on any machine with Node 24+ and npm 11.5.1+:

```bash
# Confirm the version is on the registry:
npm view @jander99/overture version

# Confirm the bin is exposed:
npm view @jander99/overture bin

# Pull a fresh copy through npx (the real user experience):
npx -y @jander99/overture@latest --help
npx -y @jander99/overture@latest detect --json | head -c 200
```

The `detect --json` output should print 4 platforms' worth of
inventory.

## Rollback

Do **not** unpublish unless the publish was a clear leak of
secrets or PII. npm unpublish is destructive and is increasingly
restricted.

For ordinary mistakes (a bug shipped in the published version):

1. Open a follow-up PR that fixes the bug.
2. After merge, trigger `release.yml` with `--specifier=patch`
   and `first-release: false` (or `true` if you've reset).
3. After the patch release is published, run:

   ```bash
   npm deprecate @jander99/overture@<bad-version> \
     "Bug: <description>; use <good-version> instead"
   ```

This nudges users away from the bad version without removing it.

For a published version that was a security regression: open a PR
with a hotfix, get a CVE if appropriate, then publish a new patch
release. Coordinate with users via a GitHub Security Advisory.

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

### "release.yml push is rejected by branch protection"

The runner pushes as `github-actions[bot]`. If branch protection
on `main` blocks this actor, the push fails. Add `github-actions[bot]`
as a bypass actor (see [Step 4](#step-4--branch-protection-bypass-for-github-actionsbot))
or temporarily relax the rule for the release.

### "Trusted publishing requires the workflow file to exist"

If you renamed `publish.yml.disabled` → `publish.yml` but the
Trusted Publisher UI is still referencing the disabled name,
double-check that the field in the Trusted Publisher config is
exactly `publish.yml` (no path, no `.yml.disabled`).

### "Publish workflow doesn't appear in the Actions UI"

The workflow file is still named `.publish.yml.disabled`. Rename
it to `publish.yml`, commit, push.

### "publish workflow completed but `npm view` returns 404"

Registry propagation may lag by a few seconds. Wait 30s and
retry. If it still 404s, check the workflow logs to confirm
`npm publish` exited 0 and the OIDC token exchange succeeded. If
the exchange failed, the Trusted Publisher on npmjs.com may not
be configured correctly — re-check owner, repo, workflow
filename, and allowed action.

### "PROVENANCE_NOT_SIGNED" or similar

This is a Trusted Publishing wiring issue. The OIDC token must
be exchanged for a short-lived publish token; the exchange
happens automatically when permissions and Trusted Publisher are
set up correctly. Re-confirm `permissions: id-token: write` in
`publish.yml` and the Trusted Publisher on npmjs.com.

### "npm publish" runs locally but not in CI

Local runs may use a long-lived `NODE_AUTH_TOKEN` that's not set
in CI. The publish workflow is intentionally tokenless and relies
on Trusted Publishing only. Do not add a fallback token.

### "release.yml dry-run prints the wrong baseline version"

If `dry-run` proposes a version that doesn't account for prior
tags, you may have stale `v*` tags from before this workflow
existed. Check:

```bash
git tag --list 'v*'
```

If a stale tag from a previous release line is present, Nx will
use it as the baseline. Either delete the stale tag or re-run
with `first-release: true` (which bypasses tag-baseline checks).

## Operational notes

- `release.yml` uses
  `concurrency: release-${{ github.ref }}` with
  `cancel-in-progress: false`. Two simultaneous release dispatches
  will block at the concurrency level, not corrupt state.
- `publish.yml` uses
  `concurrency: publish-${{ inputs.tag }}` with
  `cancel-in-progress: false`. A second publish of the same tag
  is blocked at the concurrency level, not at the registry.
- `setup-node` pins `node-version: '24'` (LTS). Local Node 25 is
  fine for development but both workflows use 24 for
  reproducibility.
- The verify-package step is a no-publish gate: it builds, packs,
  and smoke-tests the tarball. The same script runs in the CI
  `package-verify` job on every PR.
- The `build-and-detect` CI job is the native-build counterpart to
  `package-verify`. It runs `yarn install --immutable` from a clean
  cache, builds the CLI with the Nx workspace toolchain (`yarn nx
build @jander99/overture --skip-nx-cache`), then executes the
  freshly built `apps/cli/dist/main.js detect --json` on a runner
  with no pre-installed agents. Together they cover both the
  workspace build and the shipped artifact.
- The Trusted Publisher UI is the source of truth for who can
  publish. This runbook does not and should not encode npm
  tokens.

## Quick recap

The path from "ready to publish" to "published" is:

1. Complete the four one-time setup steps above (Trusted Publisher +
   `npm-production` environment; Step 4 only needed if `main` is
   branch-protected).
2. Trigger `.github/workflows/release.yml` with `dry-run: true`;
   review the proposed version + changelog.
3. Trigger `release.yml` again with `dry-run: false` to create
   the tag, commit, and GitHub Release.
4. Trigger `.github/workflows/publish.yml` with the new tag.
5. Approve in the `npm-production` environment.
6. Run the post-publish `npx` smoke checks.

Until you complete at least step 2 (Trusted Publisher) and step 3
(`npm-production` environment), `publish.yml` cannot reach the
registry. `release.yml` can push as long as branch protection on
`main` (if any) allows the `github-actions[bot]` actor. There is no
auto-publish, no scheduled run, and no PR trigger that could reach
the registry.
