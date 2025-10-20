---
description: Review code changes for quality, bugs, and best practices
allowed-tools:
  - Read(**/*.{js,ts,py,go,java})
  - Grep(**/*)
  - Bash(git:*)
---

# Code Review Command

Review the code changes specified by $ARGUMENTS (or recent changes if not specified).

## Review Process

1. **Identify Changed Files**
   !git diff --name-only $ARGUMENTS

2. **Analyze Each File**
   - Read the changed files
   - Look for potential issues:
     - Security vulnerabilities
     - Performance problems
     - Code duplication
     - Missing error handling
     - Unclear variable names
     - Missing tests

3. **Generate Review Report**
   - Summarize findings by severity (Critical, High, Medium, Low)
   - Provide specific line numbers and suggestions
   - Include code examples for recommended changes

## Focus Areas

- **Security**: Authentication, authorization, input validation, SQL injection, XSS
- **Performance**: Database queries, loops, memory usage, caching opportunities
- **Maintainability**: Code organization, naming, comments, documentation
- **Testing**: Test coverage, edge cases, error scenarios

## Output Format

Provide a structured review with:
1. Summary of changes reviewed
2. Critical issues (must fix before merge)
3. High priority suggestions (should fix)
4. Medium priority improvements (consider fixing)
5. Low priority notes (optional improvements)
6. Positive feedback (what's done well)

Be constructive, specific, and provide actionable feedback.
