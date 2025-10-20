---
description: Create a pull request with auto-generated title and description
allowed-tools:
  - Bash(git:*)
  - Bash(gh:*)
  - Read(**/*)
  - Grep(**/*)
---

# Create Pull Request Command

Create a pull request for the current branch with auto-generated title and description.

Arguments: `$ARGUMENTS` can specify target branch (defaults to main/master)

## Process

1. **Verify Current State**
   !git status
   !git branch --show-current

2. **Get Target Branch**
   - Use $ARGUMENTS if provided, otherwise default to main
   - Verify target branch exists

3. **Analyze Changes**
   !git diff main...HEAD --name-only
   !git log main..HEAD --oneline

4. **Generate PR Title**
   - Based on commit messages
   - Follow conventional commit format if applicable
   - Examples:
     - "feat: Add user authentication system"
     - "fix: Resolve memory leak in image processing"
     - "refactor: Simplify database query logic"

5. **Generate PR Description**

   Create a comprehensive description including:

   **Summary**
   - Brief overview of changes
   - Problem being solved

   **Changes**
   - List of modified files
   - Key changes in each area

   **Testing**
   - How changes were tested
   - Test coverage impact

   **Checklist**
   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] No breaking changes (or documented)
   - [ ] Follows code style guidelines

6. **Create PR**
   !gh pr create --title "PR_TITLE" --body "PR_DESCRIPTION"

7. **Output PR URL**
   - Display created PR URL
   - Suggest reviewers based on file ownership (if available)
   - Remind about CI/CD checks

## Notes

- Ensures all changes are committed
- Pushes current branch if needed
- Links related issues if mentioned in commits
- Adds appropriate labels based on change type
