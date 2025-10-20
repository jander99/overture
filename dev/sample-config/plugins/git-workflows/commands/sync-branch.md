---
description: Sync current branch with target branch (default: main)
allowed-tools:
  - Bash(git:*)
---

# Sync Branch Command

Sync the current branch with the target branch (defaults to main/master).

Arguments: `$ARGUMENTS` can specify the target branch to sync with

## Process

1. **Verify Clean Working Directory**
   !git status

   If there are uncommitted changes, offer to:
   - Stash changes
   - Commit changes
   - Abort sync

2. **Identify Target Branch**
   - Use $ARGUMENTS if provided
   - Otherwise default to main or master
   - Verify target branch exists

3. **Fetch Latest Changes**
   !git fetch origin

4. **Sync Strategy**

   Determine the best sync strategy:

   **Option A: Rebase (recommended for feature branches)**
   - Keeps commit history clean
   - Places your commits on top of latest target
   ```
   git rebase origin/TARGET_BRANCH
   ```

   **Option B: Merge**
   - Preserves complete history
   - Creates merge commit
   ```
   git merge origin/TARGET_BRANCH
   ```

5. **Handle Conflicts**

   If conflicts occur:
   - List conflicting files
   - Provide guidance on resolution
   - Offer to open conflicting files
   - Verify resolution before continuing

6. **Update Remote**

   After successful sync:
   !git push origin HEAD --force-with-lease

7. **Summary**

   Display:
   - Number of commits synced
   - Files changed
   - Any new commits added to your branch
   - Next suggested actions

## Safety Checks

- Warn if force push is required
- Confirm before force pushing to shared branches
- Check for open PRs that might be affected
- Remind to notify team if branch is shared

## Example Usage

- `/sync-branch` - Sync with main
- `/sync-branch develop` - Sync with develop branch
- `/sync-branch origin/feature-x` - Sync with specific remote branch
