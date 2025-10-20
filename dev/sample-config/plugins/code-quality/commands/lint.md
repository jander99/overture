---
description: Run linting checks on code and optionally fix issues
allowed-tools:
  - Bash(eslint:*)
  - Bash(pylint:*)
  - Bash(golint:*)
  - Read(**/*.{js,ts,py,go})
  - Edit(**/*.{js,ts,py,go})
---

# Lint Command

Run linting checks on code files. Accepts arguments: `--fix` to auto-fix issues, or file patterns.

## Usage

- `/lint` - Lint all files in the current directory
- `/lint --fix` - Lint and auto-fix issues
- `/lint src/` - Lint files in specific directory
- `/lint src/**/*.js` - Lint specific file pattern

## Process

1. **Detect Languages**
   !find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" \) | head -20

2. **Run Appropriate Linters**

   **JavaScript/TypeScript:**
   !eslint $ARGUMENTS

   **Python:**
   !pylint $ARGUMENTS

   **Go:**
   !golint $ARGUMENTS

3. **Report Results**
   - List all linting errors and warnings
   - Group by file
   - Show severity levels
   - Provide fix suggestions

4. **Auto-fix (if --fix flag)**
   - Apply automatic fixes where possible
   - Report which issues were fixed
   - List remaining issues that need manual intervention

## Output

Present results in a clear format:
- Total files checked
- Total issues found
- Issues by severity (error, warning, info)
- Files with most issues
- Common issue patterns

If issues found, provide guidance on:
- Which to fix first (prioritize errors)
- How to fix common issues
- Linter configuration recommendations
