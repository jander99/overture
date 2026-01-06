# Future Quality Gates for CI/CD

This document outlines the GitHub Actions workflows and quality gates that should be implemented when budget allows. These gates will automate code quality enforcement and prevent maintainability regressions.

## Overview

Quality gates are automated checks that run on every pull request to ensure code meets project standards. This document describes the gates we want to implement, their purpose, and example configurations.

## Recommended Quality Gates

### 1. File Size Check

**Purpose:** Prevent God objects and overly large files that are hard to maintain.

**Threshold:** 500 lines maximum for source files (excluding tests)

**Implementation:**

```yaml
name: File Size Check

on:
  pull_request:
    branches: [main]

jobs:
  check-file-sizes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check file sizes
        run: |
          echo "Checking for files > 500 lines..."
          OVERSIZED=""
          while IFS= read -r file; do
            lines=$(wc -l < "$file")
            if [ "$lines" -gt 500 ]; then
              OVERSIZED="$OVERSIZED\n$file ($lines lines)"
            fi
          done < <(find libs apps -name "*.ts" ! -name "*.spec.ts" -type f)

          if [ -n "$OVERSIZED" ]; then
            echo "Files exceeding 500 lines:"
            echo -e "$OVERSIZED"
            exit 1
          fi
          echo "All files under 500 lines"
```

### 2. Skipped Tests Check

**Purpose:** Prevent `.skip()` and `.only()` from being committed, which can hide test failures or cause CI to miss tests.

**Threshold:** Zero skipped or focused tests allowed

**Implementation:**

```yaml
name: Test Quality Check

on:
  pull_request:
    branches: [main]

jobs:
  check-skipped-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for skipped tests
        run: |
          SKIPPED=$(grep -rn "\.skip\|\.only" --include="*.spec.ts" apps libs || true)
          if [ -n "$SKIPPED" ]; then
            echo "Found skipped or focused tests:"
            echo "$SKIPPED"
            echo ""
            echo "Remove .skip() and .only() before merging"
            exit 1
          fi
          echo "No skipped or focused tests found"
```

### 3. Test Coverage Gate

**Purpose:** Ensure test coverage doesn't regress below acceptable threshold.

**Threshold:** 80% minimum coverage

**Implementation:**

```yaml
name: Test Coverage

on:
  pull_request:
    branches: [main]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: nx test @overture/cli --coverage --skip-nx-cache

      - name: Check coverage threshold
        run: |
          # Parse coverage from JSON report
          COVERAGE=$(node -e "
            const report = require('./coverage/coverage-summary.json');
            console.log(report.total.lines.pct);
          ")

          echo "Coverage: $COVERAGE%"

          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
```

### 4. Code Duplication Check

**Purpose:** Detect copy-paste code that should be refactored into shared functions.

**Threshold:** Maximum 5% code duplication

**Tool:** jscpd (JavaScript/TypeScript Copy/Paste Detector)

**Implementation:**

```yaml
name: Code Duplication

on:
  pull_request:
    branches: [main]

jobs:
  duplication:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install jscpd
        run: npm install -g jscpd

      - name: Check for code duplication
        run: |
          jscpd libs apps \
            --min-lines 10 \
            --min-tokens 50 \
            --threshold 5 \
            --reporters "console" \
            --ignore "**/node_modules/**,**/dist/**,**/*.spec.ts"
```

### 5. Complexity Check (ESLint)

**Purpose:** Prevent overly complex functions that are hard to understand and test.

**Threshold:**

- Maximum cyclomatic complexity: 10
- Maximum function lines: 50
- Maximum file lines: 500

**Implementation:**

```yaml
name: Complexity Check

on:
  pull_request:
    branches: [main]

jobs:
  complexity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint with complexity rules
        run: |
          npx eslint libs apps \
            --ext .ts \
            --rule 'complexity: [error, 10]' \
            --rule 'max-lines-per-function: [error, 50]' \
            --rule 'max-lines: [error, 500]' \
            --max-warnings 0
```

### 6. JSDoc Coverage Check

**Purpose:** Ensure public APIs are documented for developer experience.

**Threshold:** 80% of public APIs must have JSDoc

**Implementation:**

```yaml
name: Documentation Coverage

on:
  pull_request:
    branches: [main]

jobs:
  jsdoc-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Check JSDoc coverage
        run: |
          # Count public exports without JSDoc
          TOTAL=$(grep -r "export class\|export function\|export interface" \
            --include="*.ts" libs/core libs/ports libs/adapters \
            | grep -v ".spec.ts" | wc -l)

          DOCUMENTED=$(grep -B5 "export class\|export function\|export interface" \
            --include="*.ts" libs/core libs/ports libs/adapters \
            | grep -c "/\*\*" || echo "0")

          COVERAGE=$((DOCUMENTED * 100 / TOTAL))

          echo "JSDoc coverage: $COVERAGE% ($DOCUMENTED/$TOTAL)"

          if [ $COVERAGE -lt 80 ]; then
            echo "JSDoc coverage $COVERAGE% is below 80%"
            exit 1
          fi
```

### 7. SonarQube Analysis (Optional)

**Purpose:** Comprehensive static analysis including security, bugs, and code smells.

**Note:** Requires SonarQube server (cloud or self-hosted).

**Implementation:**

```yaml
name: SonarQube Analysis

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  sonarqube:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for accurate blame

      - name: SonarQube Scan
        uses: sonarsource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
        with:
          args: >
            -Dsonar.projectKey=overture
            -Dsonar.sources=libs,apps
            -Dsonar.tests=libs,apps
            -Dsonar.test.inclusions=**/*.spec.ts
            -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
            -Dsonar.qualitygate.wait=true
```

## Combined Workflow

For efficiency, combine all checks into a single workflow:

```yaml
name: Quality Gate

on:
  pull_request:
    branches: [main]

jobs:
  quality-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: nx run-many -t lint --all --max-warnings 0

      - name: Test with coverage
        run: nx test @overture/cli --coverage

      - name: Check file sizes
        run: |
          find libs apps -name "*.ts" ! -name "*.spec.ts" -type f | while read file; do
            lines=$(wc -l < "$file")
            if [ "$lines" -gt 500 ]; then
              echo "FAIL: $file ($lines lines)"
              exit 1
            fi
          done

      - name: Check for skipped tests
        run: |
          if grep -rn "\.skip\|\.only" --include="*.spec.ts" apps libs; then
            exit 1
          fi

      - name: Coverage threshold
        run: |
          COVERAGE=$(node -e "console.log(require('./coverage/coverage-summary.json').total.lines.pct)")
          [ $(echo "$COVERAGE >= 80" | bc) -eq 1 ] || exit 1
```

## Local Pre-commit Hooks

Until CI/CD budget is available, use local git hooks:

```bash
# Install husky
npm install -D husky lint-staged

# Setup hooks
npx husky init

# .husky/pre-commit
#!/bin/sh
npx lint-staged

# .husky/pre-push
#!/bin/sh
npm run test:affected
```

```json
// package.json
{
  "lint-staged": {
    "*.ts": ["eslint --fix --max-warnings 0", "prettier --write"]
  }
}
```

## Manual Quality Checks

Run these before creating PRs:

```bash
# Check file sizes
find libs apps -name "*.ts" ! -name "*.spec.ts" -exec wc -l {} + | sort -rn | head -20

# Check for skipped tests
grep -rn "\.skip\|\.only" --include="*.spec.ts" apps libs

# Run tests with coverage
nx test @overture/cli --coverage

# Check complexity (requires eslint rules)
npx eslint . --ext .ts --rule 'complexity: [warn, 10]'

# Check code duplication
npx jscpd libs apps --min-lines 10 --threshold 5
```

## Implementation Priority

When budget becomes available, implement in this order:

1. **Skipped tests check** - Prevents hiding test failures (free, simple)
2. **File size check** - Prevents God objects (free, simple)
3. **Test coverage gate** - Prevents coverage regression (free, moderate)
4. **Complexity check** - Prevents unmaintainable code (free, moderate)
5. **Code duplication** - Finds refactoring opportunities (free, moderate)
6. **JSDoc coverage** - Improves documentation (free, complex)
7. **SonarQube** - Comprehensive analysis (requires SonarCloud subscription)

## Cost Estimates

| Gate               | GitHub Actions Cost                           | Alternative           |
| ------------------ | --------------------------------------------- | --------------------- |
| Basic checks (1-5) | ~$0/month (within free tier)                  | Local hooks           |
| With caching       | ~$5-10/month                                  | -                     |
| SonarCloud         | Free for public repos, $10+/month for private | Self-hosted SonarQube |

## Related Documentation

- [Maintainability Implementation Plan](../maintainability-review-implementation-plan.md)
- [Architecture Documentation](../contributing/architecture.md)
- [Testing Guide](../contributing/README.md)
