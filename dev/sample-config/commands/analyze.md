---
description: Analyze project structure, dependencies, and code quality
allowed-tools:
  - Read(**/*.{json,yaml,yml,toml,lock})
  - Bash(find:*)
  - Bash(tree:*)
  - Grep(**/*)
  - Glob(**/*.*)
---

# Analyze Command

Perform a comprehensive analysis of the project. Arguments: `$ARGUMENTS` can specify focus area (structure, dependencies, quality, all)

## Analysis Process

### 1. Project Structure Analysis

!tree -L 3 -I 'node_modules|__pycache__|.git'

Analyze:
- Directory organization
- File naming conventions
- Module structure
- Configuration files present

### 2. Dependency Analysis

**For Node.js projects:**
@package.json

Check for:
- Outdated dependencies
- Security vulnerabilities
- Unused dependencies
- Version conflicts

!npm list --depth=0 2>&1 || true

**For Python projects:**
@requirements.txt
@setup.py
@pyproject.toml

!pip list --outdated 2>&1 || true

**For Go projects:**
@go.mod

!go list -m all

### 3. Code Quality Metrics

Analyze:
- File size distribution
- Lines of code statistics
- Comment ratio
- Test file coverage

!find . -type f -name "*.js" -o -name "*.py" -o -name "*.go" | head -20

Calculate:
- Total lines of code
- Number of files by type
- Average file size
- Test-to-code ratio

### 4. Configuration Analysis

Check for:
- Linter configurations (.eslintrc, .pylintrc, etc.)
- Formatter configurations (.prettierrc, .black, etc.)
- CI/CD configurations (.github/workflows/, .gitlab-ci.yml)
- Environment templates (.env.example)

@.eslintrc.json
@.prettierrc
@.github/workflows/*

### 5. Documentation Analysis

Check for:
- README.md completeness
- API documentation
- Contributing guidelines
- Changelog

@README.md
@CONTRIBUTING.md
@CHANGELOG.md

## Output Report

Generate a comprehensive report with:

### Summary
- Project type and language
- Total files and lines of code
- Main technologies used

### Structure Assessment
- Organization score (1-10)
- Suggested improvements
- Anti-patterns detected

### Dependencies
- Total dependencies
- Outdated packages
- Security concerns
- License compatibility

### Code Quality
- Overall quality score
- Areas needing attention
- Best practices followed

### Recommendations
1. High priority improvements
2. Medium priority suggestions
3. Optional enhancements

### Next Steps
- Suggested commands to run
- Areas to investigate further
- Quick wins for improvement

## Example Usage

- `/analyze` - Full analysis
- `/analyze structure` - Structure only
- `/analyze dependencies` - Dependencies only
- `/analyze quality` - Code quality only
