# How to manually continue the npm/npx readiness phase-set

You picked: **publishing should be ready, but the action disabled**.

This document is the continuation guide. It assumes the repo is
on the `feature/npm-npx-readiness-phase-set` branch in the
`overture-npm-npx-readiness` worktree, with the implementation
work committed but NOT pushed and the publish workflow intentionally
disabled.

## Where we are

- Branch: `feature/npm-npx-readiness-phase-set`
- Base: `origin/main` at `03e6a117`
- Commits: 6 ahead of main (Tasks 0–11 of the npm/npx readiness
  phase-set are committed locally).
- Worktree: `/home/jeff/workspaces/ai/overture-npm-npx-readiness`
- Plan: `.omo/plans/npm-npx-readiness-phase-set.md` (12/17 boxes
  ticked; 4 final review gates + 1 publish gate remain)
- Publish workflow: **disabled** (`.github/workflows/publish.yml.disabled`)

## What is in the branch

The branch contains 6 commits covering the full npm/npx readiness
phase-set up to the publish gate:

1. `cfdf5f5f chore(cli): add npm package metadata and MIT license`
   — package shape, MIT license, build options, Nx project rename
   to `@jander99/overture`, jsonc-parser ESM deep import.
2. `2f3659c8 docs: document npm package install readiness` — root
   README and package-local `apps/cli/README.md` with
   `npx @jander99/overture@latest` and Node.js >= 24 docs.
3. `e458974f chore(cli): stop tracking generated dist and add
package verification` — `.gitignore` updates,
   `apps/cli/scripts/verify-package.mjs`, golden file list,
   `git rm --cached apps/cli/dist`.
4. `035baec3 ci: use Node 24 + AGENTS.md correction for package
readiness` — `ci.yml` Node 24, package-verify job, AGENTS.md
   updated to current CI/package facts.
5. `d95f546e ci: add gated npm trusted publishing + release-please +
runbook` — `publish.yml` (disabled), `release-please.yml`,
   `release-please-config.json`, `.release-please-manifest.json`,
   `docs/publishing.md` runbook.
6. (Note: the Task 11 evidence commit lands when the worktree
   syncs back to main and the `.omo/evidence/` files are
   preserved via the worktree completion step.)

## What's verified

Local end-to-end smoke test (run from the worktree, captured in
`.omo/evidence/task-3-self-contained-bundle.txt` and
`.omo/evidence/task-5-npx-package-smoke.txt`):

- `yarn nx build @jander99/overture --skip-nx-cache` exits 0
- `yarn nx test @jander99/overture` exits 0
- `npm pack` from `apps/cli/` produces a 16.8 KB tarball containing
  `LICENSE`, `README.md`, `package.json`, `dist/main.js`
- `node apps/cli/scripts/verify-package.mjs` exits 0 with
  `Required entries present (4): PASS` and
  `No forbidden entries: PASS`
- `npm install` of the tarball in a clean temp dir + `node
node_modules/@jander99/overture/dist/main.js --help` exits 0
- `detect --json` from the installed package returns 14
  platforms' worth of inventory

## What's intentionally NOT done

- **No npm registry action.** No package has been published. No
  `npm view` call has succeeded against `@jander99/overture` on
  npmjs.com.
- **No git push.** The branch is local to the worktree. Nothing
  has been pushed to `origin`.
- **No GitHub UI setup.** No Trusted Publisher configured on
  npmjs.com. No `npm-production` environment created on
  GitHub. No 2FA touched.
- **The publish workflow is disabled** as
  `.github/workflows/publish.yml.disabled`. GitHub does not
  load `.disabled` files as workflows, so the workflow does not
  appear in the Actions UI and cannot be triggered.

## Three paths from here

### Path A: Push the branch and open a PR (recommended)

1. Push the branch:
   ```bash
   cd /home/jeff/workspaces/ai/overture-npm-npx-readiness
   git push -u origin feature/npm-npx-readiness-phase-set
   ```
2. Open a PR. Suggested title:
   `feat: npm/npx readiness phase-set for @jander99/overture`.
3. CI runs:
   - Quality Gates (prettier, lint no-op) — should pass
   - Test (`yarn nx test @jander99/overture`) — should pass
   - package-verify (verify-package.mjs) — should pass
4. Review the diff. Approve and merge when satisfied.
5. After merge, `release-please` opens a release PR (because the
   work to date already includes `feat:` commits, the next
   release PR will propose a minor bump). Merge the release PR
   to create the first `v0.1.0` tag.
6. The package is **still not on the registry** — the
   `.disabled` workflow ensures that. Continue with Path B or
   Path C to actually publish.

### Path B: Hold the branch; do npmjs.com setup off-branch

The branch is harmless on `origin`. Do the npmjs.com Trusted
Publisher setup whenever you are ready (Steps 1–3 of
`docs/publishing.md`). When you want to publish:

1. Re-enable the publish workflow:
   ```bash
   git mv .github/workflows/publish.yml.disabled \
         .github/workflows/publish.yml
   git commit -m "chore(ci): enable npm publish workflow"
   git push
   ```
2. Run the publish workflow from the Actions UI as described in
   `docs/publishing.md` Step 3.

### Path C: Tear down the worktree; defer the whole thing

If you decide the npm/npx work isn't ready for prime time:

1. Discard the worktree:
   ```bash
   git -C /home/jeff/workspaces/ai/overture worktree remove \
       --force /home/jeff/workspaces/ai/overture-npm-npx-readiness
   git -C /home/jeff/workspaces/ai/overture branch -D \
       feature/npm-npx-readiness-phase-set
   ```
2. The plan and evidence live in the main repo's `.omo/`, so
   nothing is lost.

## File map (everything that changed)

```
apps/cli/
  package.json                        # rewritten: name, license, engines, files, build options
  package.json scripts.link/unlink    # uses @jander99/overture as the Nx project
  LICENSE                             # MIT, jander99 copyright (NEW)
  README.md                           # package-local README (NEW, mandatory for `files`)
  scripts/verify-package.mjs          # build + pack + install + smoke harness (NEW)
  scripts/package-expected-files.txt  # golden tarball file list (NEW)
  src/platforms/mcp-config.ts         # jsonc-parser deep ESM import

.github/workflows/
  ci.yml                              # Node 24; added package-verify job
  publish.yml.disabled                # gated npm Trusted Publishing (NEW, currently disabled)
  release-please.yml                  # release PR generator (NEW)

release-please-config.json            # config (NEW)
.release-please-manifest.json         # pinned version (NEW)

docs/publishing.md                    # full runbook (NEW)
README.md                             # updated for npm install / npx / Node 24
AGENTS.md                             # corrected for Node 24, Yarn immutable, dist policy,
                                      # no-lifecycle-scripts, Nx rename

.gitignore                            # apps/cli/dist/, .yarn/install-state.gz

.omo/evidence/                        # not committed (gitignored); synced back to main
                                      # at worktree completion
```

## Where to ask questions

If anything in the runbook is unclear, or if a CI step fails when
you push the branch, the relevant evidence files are at
`.omo/evidence/task-{0..11}-*.txt` in the worktree and (after
worktree completion) in the main repo's `.omo/evidence/`.

If you want to extend the phase-set, the natural next items are
documented as separate issues in the plan but not in scope here:

- WSL2-aware cross-OS platform detection (see issue #65)
- OS-detection Nx library extraction
- Renovate config review (already in place)
- Optional: pin GitHub Actions by SHA (currently uses major-version
  refs like `@v6`)

These are deliberately separate workstreams.
