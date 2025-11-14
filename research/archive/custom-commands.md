# Custom Commands Research

This document provides comprehensive research on how custom slash commands work in Claude Code.

## 1. How Custom Slash Commands Are Defined

Custom slash commands in Claude Code are defined using **Markdown files** (.md). The filename determines the command name:

- A file named `optimize.md` creates the command `/optimize`
- A file named `fix-issue.md` creates the command `/fix-issue`

### Command Types

There are two types of custom commands:

1. **Project Commands**: Stored in `.claude/commands/` directory
   - Shared across the team via version control
   - Available only within that specific project

2. **Personal Commands**: Stored in `~/.claude/commands/` directory
   - Available across all projects for that user
   - Private to the individual user

### Creating Commands

```bash
# Create a project command
mkdir -p .claude/commands
echo "Analyze this code for performance issues and suggest optimizations:" > .claude/commands/optimize.md

# Create a personal command
mkdir -p ~/.claude/commands
echo "Review this code for security vulnerabilities:" > ~/.claude/commands/security-review.md
```

## 2. File Format and Structure

### Basic Structure

Custom commands are Markdown files with optional YAML frontmatter followed by the prompt content.

### Simple Example (No Frontmatter)

```markdown
Analyze the performance of this code and suggest three specific optimizations:
```

### Advanced Example (With Frontmatter)

```markdown
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create a git commit
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## Your task

Based on the above changes, create a single git commit.
```

## 3. Storage Location

### Project Commands
- **Location**: `.claude/commands/` in the project root
- **Scope**: Available only within the project
- **Sharing**: Committed to version control, shared with team

### Personal Commands
- **Location**: `~/.claude/commands/` in user's home directory
- **Scope**: Available across all projects
- **Sharing**: Private to the user

### Namespaced Commands

Commands can be organized in subdirectories for namespacing:

```
.claude/commands/
├── optimize.md                    → /optimize
├── frontend/
│   └── component.md              → /frontend:component
└── backend/
    └── api.md                    → /backend:api

~/.claude/commands/
└── security-review.md            → /security-review
```

**Important**: Conflicts between user and project level commands with the same name are not supported.

## 4. Capabilities

### Frontmatter Options

The YAML frontmatter supports the following fields:

#### `allowed-tools`
Specifies which tools Claude can use when executing this command:

```yaml
---
allowed-tools: Bash(npm:*), Bash(git:*)
description: Build and deploy to production
---
```

Examples:
- `Bash(git:*)` - Allow all git commands
- `Bash(npm run test:*)` - Allow npm test commands
- `Bash(npm run lint)` - Allow exact command
- `Edit(**/*.js)` - Allow editing JavaScript files
- `Read(~/.zshrc)` - Allow reading specific file

#### `description`
Provides a brief description of what the command does (shown in command lists):

```yaml
---
description: Build and deploy to production
---
```

### Embedded Bash Commands

Commands can include bash commands prefixed with `!` that execute and inject their output into the prompt:

```markdown
---
allowed-tools: Bash(git:*)
---

## Context

- Current git status: !`git status`
- Current git diff: !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## Your task

Create a descriptive commit message based on the changes above.
```

### File References

Commands can reference files using the `@` prefix:

```markdown
# Review a specific file
Review the implementation in @src/utils/helpers.js

# Compare multiple files
Compare @src/old-version.js with @src/new-version.js
```

### Arguments with $ARGUMENTS

Commands can accept arguments using the `$ARGUMENTS` placeholder:

```bash
echo "Find and fix issue #$ARGUMENTS. Follow these steps:
1. Understand the issue described in the ticket
2. Locate the relevant code in our codebase
3. Implement a solution that addresses the root cause
4. Add appropriate tests
5. Prepare a concise PR description" > .claude/commands/fix-issue.md
```

Usage:
```
/fix-issue 123
```

The `$ARGUMENTS` placeholder will be replaced with "123" in this case.

### Integration with Other Features

Custom commands can:
- ✅ Reference hooks (via allowed-tools)
- ✅ Use MCP servers (via allowed-tools)
- ❌ Directly invoke other slash commands
- ❌ Directly reference skills or subagents (but can instruct Claude to use them)

## 5. How Commands Are Invoked

### Basic Invocation

```
/command-name
```

### With Arguments

```
/command-name argument1 argument2 ...
```

Arguments are space-separated. For arguments with spaces, use quotes:

```
/mcp__jira__create_issue "Bug in login flow" high
```

### Namespaced Commands

```
/namespace:command-name
```

Example:
```
/frontend:component
/pr-review-toolkit:review-pr
```

### MCP-Provided Commands

MCP servers can provide their own slash commands with a special format:

```
/mcp__<server-name>__<prompt-name> [arguments]
```

Examples:
```
/mcp__github__list_prs
/mcp__github__pr_review 456
```

Server and prompt names are normalized (spaces/special chars to underscores, lowercased).

### Discovering Available Commands

- Type `/` to see all available slash commands
- Use `/help` for general help
- Commands are dynamically discovered from:
  - `.claude/commands/` (project)
  - `~/.claude/commands/` (personal)
  - Connected MCP servers

## 6. Best Practices and Conventions

### Organizing Commands

1. **Use Descriptive Names**: Command names should clearly indicate their purpose
   - Good: `/fix-error`, `/pr-review`, `/optimize`
   - Bad: `/cmd1`, `/do-stuff`, `/x`

2. **Use Namespacing for Large Projects**:
   ```
   commands/
   ├── pr/
   │   ├── create.md      → /pr:create
   │   ├── review.md      → /pr:review
   │   └── feedback.md    → /pr:feedback
   └── update/
       ├── deps.md        → /update:deps
       └── docs.md        → /update:docs
   ```

3. **Add Descriptions**: Always include a description in the frontmatter
   ```yaml
   ---
   description: Analyze code for performance issues
   ---
   ```

### Writing Effective Commands

1. **Be Specific**: Provide clear, detailed instructions
   ```markdown
   ## Your task

   1. Run `npm run build`
   2. Run `npm run test`
   3. If tests pass, deploy with `npm run deploy`
   4. Tag the release with current version
   ```

2. **Provide Context**: Use embedded commands to inject relevant information
   ```markdown
   ## Context

   - Current git status: !`git status`
   - Recent commits: !`git log --oneline -5`
   ```

3. **Limit Tool Access**: Only grant necessary permissions
   ```yaml
   ---
   allowed-tools: Bash(git status:*), Bash(git diff:*)
   ---
   ```

4. **Use Templates**: Create reusable command templates for common workflows
   ```markdown
   ---
   description: Fix GitHub issue using standard workflow
   ---

   Please analyze and fix the GitHub issue: $ARGUMENTS.

   Follow these steps:

   1. Use `gh issue view` to get the issue details
   2. Understand the problem described in the issue
   3. Search the codebase for relevant files
   4. Implement the necessary changes to fix the issue
   5. Write and run tests to verify the fix
   6. Ensure code passes linting and type checking
   7. Create a descriptive commit message
   8. Push and create a PR
   ```

### Security Considerations

1. **Limit Bash Permissions**: Be cautious with wildcards
   ```yaml
   # Good - specific
   allowed-tools: Bash(npm run test:*), Bash(git status:*)

   # Risky - too broad
   allowed-tools: Bash(*)
   ```

2. **Don't Commit Secrets**: Never include API keys or credentials in commands
   - Use environment variables instead
   - Reference secure configuration files

3. **Review Team Commands**: Before committing commands to version control, review:
   - What tools they access
   - What files they can modify
   - What commands they can execute

### Documentation

1. **Include Examples in Commands**: Help users understand expected usage
   ```markdown
   ## Usage Examples

   Basic analysis:
   ```
   /optimize
   ```

   Focus on specific aspect:
   ```
   /optimize memory
   ```
   ```

2. **Maintain a Command Registry**: For large projects, document all commands in README
   ```markdown
   ## Available Commands

   ### Code Quality
   - `/optimize` - Analyze performance and suggest optimizations
   - `/security-review` - Check for security vulnerabilities

   ### Git Workflow
   - `/pr:create` - Create a pull request from current changes
   - `/pr:review` - Review an existing pull request
   ```

### Related Commands

1. **Link Related Commands**: Reference complementary commands
   ```markdown
   ## Related Commands

   - `/pr:create` - Create PR after fixing issue
   - `/optimize` - Optimize the implemented solution
   ```

2. **Chain Commands**: Design commands that work well together
   ```
   /fix-issue 123
   /optimize
   /pr:create
   ```

## Advanced Examples

### Multi-Step Workflow Command

```markdown
---
allowed-tools: Bash(npm:*), Bash(git:*)
description: Complete feature development workflow
---

## Your task

Complete the following workflow for feature: $ARGUMENTS

### Phase 1: Setup
1. Create feature branch: `git checkout -b feature/$ARGUMENTS`
2. Install dependencies: `npm install`

### Phase 2: Development
3. Implement the feature
4. Write comprehensive tests
5. Run tests: `npm run test`

### Phase 3: Quality Checks
6. Run linter: `npm run lint:fix`
7. Run type checker: `npm run typecheck`
8. Fix any issues found

### Phase 4: Documentation
9. Update relevant documentation
10. Add code comments where needed

### Phase 5: Commit
11. Stage changes: `git add .`
12. Create semantic commit message
13. Commit: `git commit`

### Phase 6: Review
14. Push branch: `git push -u origin feature/$ARGUMENTS`
15. Create PR with detailed description
```

### Contextual Code Review Command

```markdown
---
allowed-tools: Bash(git:*), Read(**/*.{js,ts,json})
description: Comprehensive code review with git context
---

## Context

### Git Information
- Current branch: !`git branch --show-current`
- Changed files: !`git diff --name-only HEAD`
- Commit history: !`git log --oneline -5`
- Current diff: !`git diff HEAD`

## Review Criteria

Analyze the changes for:

1. **Code Quality**
   - Readability and maintainability
   - Adherence to project conventions
   - Proper error handling

2. **Performance**
   - Potential bottlenecks
   - Memory leaks
   - Optimization opportunities

3. **Security**
   - Input validation
   - Authentication/authorization
   - Data exposure risks

4. **Testing**
   - Test coverage
   - Edge cases
   - Integration points

5. **Documentation**
   - Code comments
   - API documentation
   - Breaking changes noted

## Output Format

Provide a structured review with:
- Critical issues (must fix)
- Important suggestions (should fix)
- Minor improvements (nice to have)
- Positive observations
```

## Comparison with Related Features

### Commands vs Hooks
- **Commands**: User-invoked prompts that start tasks
- **Hooks**: Automated scripts triggered by events (PreToolUse, PostToolUse, etc.)
- Commands can specify allowed-tools that hooks may validate

### Commands vs Skills
- **Commands**: Simple prompt templates
- **Skills**: More complex, potentially with custom logic (less documentation available)
- Commands are simpler and easier to create

### Commands vs Subagents
- **Commands**: Inline prompts executed in main conversation
- **Subagents**: Separate agent instances with isolated context
- Commands can't directly invoke subagents but can instruct Claude to use the `--agent` flag

### Commands vs MCP Prompts
- **Custom Commands**: Defined locally as Markdown files
- **MCP Prompts**: Provided by MCP servers, dynamically discovered
- Both use slash command syntax
- MCP prompts use `/ mcp__server__prompt` format

## Summary

Claude Code custom commands provide a powerful way to:
- Create reusable prompt templates
- Standardize team workflows
- Inject dynamic context via embedded bash commands
- Control tool permissions per command
- Accept arguments for flexibility
- Reference files and integrate with git

They are simple to create (just Markdown files), easy to share (via git), and integrate seamlessly with Claude Code's permission system and MCP servers.
