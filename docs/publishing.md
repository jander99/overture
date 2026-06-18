# Publishing `@jander99/overture` to npm — manual runbook

This runbook is the executable counterpart to the npm/npx readiness
phase-set plan at `.omo/plans/npm-npx-readiness-phase-set.md`. It is
written for a maintainer (you) who has **not yet registered on
npmjs.com** — so it starts with the one-time setup and ends with the
publish trigger.

The publish workflow is intentionally **disabled** until you complete
the one-time UI setup. See [Enabling the publish workflow](#enabling-the-publish-workflow)
below.

## Overview

The publish flow is manual-gated end to end:

1. **release-please** opens a release PR from conventional commits on
   `main` and tags the merge commit. (Already configured;
   `.github/workflows/release-please.yml` is active.)
2. A maintainer reviews and merges the release PR. This creates a tag
   like `v0.1.0` on the merge commit.
3. A maintainer **enables** the publish workflow (rename
   `.github/workflows/publish.yml.disabled` →
   `.github/workflows/publish.yml`) and runs it via
   `workflow_dispatch` from the Actions UI.
4. The publish workflow builds, verifies, and `npm publish`es the
   tarball under the `npm-production` GitHub environment (manual
   approval required).
5. A maintainer runs the post-publish `npx` smoke commands.

## One-time setup (you, in web UIs)

These are manual steps performed outside git. Tick them off as you
complete them.

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
  - **Workflow filename**: `publish.yml` (the actual filename, not
    the `.disabled` name; GitHub will look for the file at the
    supplied path when the workflow runs)
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

### Step 4 — Create the first npm package entry (optional)

If you want the package's npm page (and the post-publish smoke
checks like `npm view @jander99/overture version`) to work before
the first publish, you can create a placeholder via `npm init
--scope=jander99 --name=overture` from any machine. This is
optional — `npm publish` will create the package entry on its own.

## Enabling the publish workflow

The publish workflow is currently **disabled** to prevent any
accidental registry action before the one-time setup above is
complete.

The file `.github/workflows/publish.yml.disabled` is the real
workflow. GitHub does not pick up `.disabled` files as workflows
(`.yml` is the recognized extension), so the workflow does not
appear in the Actions UI and cannot be triggered.

When you are ready to publish:

- [ ] On a feature branch in a PR (or directly on main if you prefer
      to skip review for this admin change), rename the file:
  ```bash
  git mv .github/workflows/publish.yml.disabled \
        .github/workflows/publish.yml
  ```
- [ ] Commit: `chore(ci): enable npm publish workflow`.
- [ ] Push and open a PR (or merge directly if you're using a
      personal policy that allows admin changes on main). The
      `ci.yml` Quality Gates + Test + package-verify jobs all run on
      the PR; nothing should break since this is a pure rename.
- [ ] After merge, the workflow appears in the GitHub Actions UI
      under "Publish @jander99/overture".

## The publish flow (after enabling)

### Step 1 — Land work via conventional commits

release-please derives the next semver from commit messages on
`main`. The mapping:

| Commit type        | Version bump |
| ------------------ | ------------ |
| `fix: ...`         | patch        |
| `feat: ...`        | minor        |
| `feat!: ...` or    | major        |
| `BREAKING CHANGE:` |              |

Other types (`docs:`, `chore:`, `refactor:`, `test:`, `build:`,
`ci:`, `perf:`) appear in `CHANGELOG.md` but do not bump the
version.

### Step 2 — release-please opens a release PR

After commits land on `main`,
`.github/workflows/release-please.yml` opens (or updates) a PR
titled `chore(main): release @jander99/overture <new-version>`. The
PR body shows the changelog for the release.

Review the PR. Check that:

- The version bump is correct (e.g. `0.0.1` → `0.1.0` for a new
  minor).
- The changelog only includes user-visible changes.
- `apps/cli/package.json` and `CHANGELOG.md` are the only files
  modified.

Merge the PR. This creates a tag like `v0.1.0` on the merge commit.

### Step 3 — Run the publish workflow

Go to GitHub → Actions → "Publish @jander99/overture" → "Run
workflow". Supply the tag (e.g. `v0.1.0`). Confirm.

The workflow:

1. Validates the tag input.
2. Checks out the tagged commit.
3. Installs deps (`yarn install --immutable`, Corepack, Node 24).
4. Builds (`yarn nx build @jander99/overture --skip-nx-cache`).
5. Runs `node apps/cli/scripts/verify-package.mjs` (golden file
   list + install + smoke).
6. Enters the `npm-production` environment (requires a reviewer
   to approve before continuing).
7. `npm publish --provenance --access public` from `apps/cli/`.
8. Smoke-checks `npm view @jander99/overture@<version> version`.

If the publish workflow fails at any step, see
[Troubleshooting](#troubleshooting) below.

### Step 4 — Post-publish smoke checks

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

If the smoke checks fail, see [Rollback](#rollback) below.

## Rollback

Do **not** unpublish unless the publish was a clear leak of
secrets or PII. npm unpublish is destructive and is increasingly
restricted.

For ordinary mistakes (a bug shipped in the published version):

1. Open a follow-up PR that fixes the bug.
2. After merge, release-please will propose a patch release.
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

### "Publish workflow doesn't appear in the Actions UI"

The workflow file is still named `.publish.yml.disabled`. Rename
it to `publish.yml`, commit, push.

### "Trusted publishing requires the workflow file to exist"

If you renamed the file but the Trusted Publisher UI is still
referencing the disabled name, double-check that the field in the
Trusted Publisher config is exactly `publish.yml` (no path, no
`.yml.disabled`).

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

## Operational notes

- The publish workflow uses
  `concurrency: publish-${{ inputs.tag }}` with
  `cancel-in-progress: false`. A second publish of the same tag
  is blocked at the concurrency level, not at the registry.
- `setup-node` pins `node-version: '24'` (LTS). Local Node 25 is
  fine for development but the publish uses 24 for
  reproducibility.
- The verify-package step is a no-publish gate: it builds, packs,
  and smoke-tests the tarball. The same script runs in the CI
  `package-verify` job on every PR.
- The `build-and-detect` CI job is the native-build counterpart to
  `package-verify`. It runs `yarn install --immutable` from a clean
  cache, builds the CLI with the Nx workspace toolchain (`yarn nx
build @jander99/overture --skip-nx-cache`), then executes the
  freshly built `apps/cli/dist/main.js detect --json` on a runner
  with no pre-installed agents. It asserts the output is valid JSON
  with all 14 registry entries, every entry reports
  `installed: false`, and no platform carries a `parseError`. This
  catches the class of build-pipeline regressions the unit tests
  would not (a missing runtime dep like `smol-toml`, a broken Yarn
  workspace symlink, a transitive `^build` failure, etc.). Together
  with `package-verify` (which proves the published-tarball
  contract) the two jobs cover both the workspace build and the
  shipped artifact.
- The Trusted Publisher UI is the source of truth for who can
  publish. This runbook does not and should not encode npm
  tokens.

## Quick recap

The path from "ready to publish" to "published" is:

1. Complete the four one-time setup steps above.
2. Rename `.github/workflows/publish.yml.disabled` to
   `publish.yml` and merge.
3. Land work on `main` via conventional commits; merge the
   release-please PR.
4. Run the publish workflow with the new tag from the Actions UI.
5. Approve in the `npm-production` environment.
6. Run the post-publish `npx` smoke checks.

Until you complete step 1, the publish workflow is inert: it
exists in the repo as a `.disabled` file that GitHub does not
load as a workflow, and the npm registry has no record of the
package. There is no auto-publish, no scheduled run, and no PR
trigger that could reach the registry.
