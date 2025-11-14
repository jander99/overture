# Jira Workflow Example

> Real-world example of how Claude Code components work together for Jira-based development workflow

## User's Workflow Requirements

Developer wants to say: "I have a Jira story, JIRA-12345, that I would like to work on" and have Claude Code:

1. Fetch Jira story details via Atlassian MCP
2. **Confirm understanding** before proceeding (vague prompt should be questioned)
3. Update main branch from remote
4. Create branch: `story/JIRA-12345-short-desc`
5. Implement the feature
6. Commit with message: `story: JIRA-12345 <description>`
7. Push to remote branch
8. Create PR with Jira ID in title

**Key requirement:** The prompt is intentionally vague. Claude should enrich it with Jira data and confirm understanding before executing.

## Component Stack

### 1. UserPromptSubmit Hook (Context Enrichment)

**Purpose:** Auto-detect Jira IDs and signal to fetch details

**File:** `hooks.yaml`

```yaml
hooks:
  - events:
      userPromptSubmit:
        - command: |
            #!/bin/bash
            # Detect Jira ID pattern and prompt Claude to fetch details
            if echo "$CLAUDE_PROMPT" | grep -q 'JIRA-[0-9]\+'; then
              JIRA_ID=$(echo "$CLAUDE_PROMPT" | grep -o 'JIRA-[0-9]\+' | head -1)
              echo "## Auto-detected Jira Story"
              echo "Jira ID: $JIRA_ID"
              echo ""
              echo "Please use the Atlassian MCP to fetch full story details for context."
            fi
          description: "Auto-detect Jira IDs and prompt for enrichment"
```

**How it works:**
- Fires when user submits any prompt
- Regex detects JIRA-XXXXX pattern
- Injects instruction to Claude: "fetch details"
- Claude sees enriched context before planning

### 2. Skill: jira-workflow (Autonomous Workflow)

**Purpose:** Model-invoked workflow guidance for Jira story development

**File:** `skills/jira-workflow/SKILL.md`

```markdown
---
description: "Jira story development workflow. Use when user wants to work on a Jira story or mentions a Jira ID for feature development."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - mcp__atlassian__*
---

You are a Jira-integrated development workflow assistant.

## Workflow Steps

When a user mentions working on a Jira story:

### 1. Fetch & Confirm Understanding

- Use Atlassian MCP to fetch full story details:
  - Title
  - Description
  - Acceptance criteria
  - Story points
  - Assigned labels/components

- **Summarize in your own words** what you understand the feature to be

- **ASK USER TO CONFIRM** your understanding before proceeding

- If unclear, ask clarifying questions:
  - Implementation approach (which library/framework?)
  - Architecture decisions (where should code live?)
  - Testing requirements (unit tests, integration tests, e2e?)
  - Breaking changes or backward compatibility concerns

**NEVER proceed to implementation without confirmation.**

### 2. Git Branch Setup

Once confirmed:

- Check current branch: `git branch --show-current`
- If not on main, ask if they want to switch first
- Update main branch:
  ```bash
  git checkout main && git pull origin main
  ```
- Extract short description from Jira title:
  - Take 3-4 key words
  - Convert to kebab-case
  - Example: "Implement User Password Reset" → "password-reset"
- Create feature branch:
  ```bash
  git checkout -b story/JIRA-{ID}-{short-desc}
  ```
  Example: `story/JIRA-12345-password-reset`

### 3. Implementation

- Implement the feature based on **confirmed** understanding
- Follow project coding standards from @.claude/context/coding-standards.md
- Use acceptance criteria as implementation checklist
- Write tests as you go
- Run tests periodically to ensure correctness

### 4. Git Commit

When implementation complete:

- Stage modified files:
  ```bash
  git add <files>
  ```

- Commit with standardized format:
  ```bash
  git commit -m "story: JIRA-{ID} {description}"
  ```

  Where {description} summarizes **the changes**, not just the Jira title.

  Good: `story: JIRA-12345 implement password reset with email token validation`
  Bad:  `story: JIRA-12345 User password reset feature`

- **Note:** Pre-commit hooks will validate format

### 5. PR Creation

- Push to remote:
  ```bash
  git push -u origin story/JIRA-{ID}-{short-desc}
  ```

- Create pull request with:
  - **Title:** `[JIRA-{ID}] {feature description}`
  - **Body:**
    - Link to Jira story
    - Summary of implementation
    - Testing completed
    - Any migration notes

## Important Reminders

- **ALWAYS confirm understanding before coding**
- **ALWAYS summarize what you're about to do before doing it**
- Use Jira acceptance criteria as your checklist
- Follow team git conventions (branch naming, commit format)
- Run tests before committing
```

**How it works:**
- Skill description matches user intent ("work on Jira story")
- Claude autonomously loads skill when relevant
- Skill provides step-by-step workflow
- Explicitly requires confirmation checkpoint

### 3. PreToolUse Hooks (Git Validation)

**Purpose:** Enforce git conventions, block invalid operations

**File:** `hooks.yaml`

```yaml
hooks:
  # Validate branch naming for new branches
  - matcher:
      tool: Bash
      pattern: "git checkout -b*"
    events:
      preToolUse:
        - command: |
            #!/bin/bash
            BRANCH_NAME=$(echo "$CLAUDE_COMMAND" | sed -n 's/.*git checkout -b \([^ ]*\).*/\1/p')

            # Check if branch follows story/JIRA-ID-description pattern
            if ! echo "$BRANCH_NAME" | grep -qE '^story/JIRA-[0-9]+-[a-z0-9-]+$'; then
              echo "❌ ERROR: Branch name must follow pattern: story/JIRA-{ID}-{short-desc}" >&2
              echo "" >&2
              echo "Example: story/JIRA-12345-user-authentication" >&2
              echo "Your attempt: $BRANCH_NAME" >&2
              exit 2
            fi

            echo "✓ Branch name follows convention"
          description: "Validate story branch naming convention"

  # Validate commit message format
  - matcher:
      tool: Bash
      pattern: "git commit*"
    events:
      preToolUse:
        - command: |
            #!/bin/bash
            # Extract commit message from command
            COMMIT_MSG=$(echo "$CLAUDE_COMMAND" | sed -n "s/.*-m ['\"]\\([^'\"]*\\)['\"].*/\\1/p")

            # Check format: "story: JIRA-ID description"
            if ! echo "$COMMIT_MSG" | grep -qE '^story: JIRA-[0-9]+ .{10,}'; then
              echo "❌ ERROR: Commit message must follow format:" >&2
              echo "   story: JIRA-{ID} {description}" >&2
              echo "" >&2
              echo "Example: story: JIRA-12345 implement user authentication flow" >&2
              echo "Your attempt: $COMMIT_MSG" >&2
              echo "" >&2
              echo "Note: Description should be at least 10 characters" >&2
              exit 2
            fi

            echo "✓ Commit message follows convention"
          description: "Validate commit message format"

  # Prevent direct commits to main/master
  - matcher:
      tool: Bash
      pattern: "git commit*"
    events:
      preToolUse:
        - command: |
            #!/bin/bash
            CURRENT_BRANCH=$(git branch --show-current)

            if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
              echo "❌ ERROR: Cannot commit directly to $CURRENT_BRANCH" >&2
              echo "" >&2
              echo "Please create a feature branch first:" >&2
              echo "  git checkout -b story/JIRA-{ID}-{description}" >&2
              exit 2
            fi

            echo "✓ Not on protected branch"
          description: "Prevent direct commits to main/master"
```

**How it works:**
- `PreToolUse` fires before git commands execute
- Validates branch names against regex pattern
- Validates commit messages against required format
- Exit code 2 blocks execution, feeds error to Claude
- Claude sees error and self-corrects

### 4. SessionStart Hook (Git Context)

**Purpose:** Provide Claude with git status on session start

**File:** `hooks.yaml`

```yaml
hooks:
  - events:
      sessionStart:
        - command: |
            echo "## Git Status"
            echo ""
            git status --short
            echo ""
            echo "📍 Current branch: $(git branch --show-current)"
            echo "📝 Last commit: $(git log -1 --oneline)"
            echo ""

            # Check if main is behind origin
            git fetch origin --quiet
            LOCAL=$(git rev-parse main 2>/dev/null)
            REMOTE=$(git rev-parse origin/main 2>/dev/null)

            if [ "$LOCAL" != "$REMOTE" ]; then
              echo "⚠️  Note: main branch is out of sync with origin"
            fi
          description: "Inject git context on session start"
```

**How it works:**
- Runs automatically when session starts
- Output is included in Claude's context
- Provides current branch, recent commits, sync status
- Helps Claude understand project state

### 5. Optional: Slash Command (Explicit Trigger)

**Purpose:** Alternative to vague prompt - explicit workflow invocation

**File:** `commands/story.md`

```markdown
---
description: "Start work on a Jira story with full workflow support"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - mcp__atlassian__*
---

I want to work on Jira story $1.

Please follow the complete Jira workflow:

1. Fetch full story details from Jira using Atlassian MCP
2. Summarize the feature and **ask me to confirm** your understanding
3. Once confirmed, set up git branch following our `story/JIRA-ID-desc` pattern
4. Implement the feature according to acceptance criteria
5. Write/update tests
6. Commit with proper message format: `story: JIRA-ID description`
7. Push to remote branch
8. Create PR with Jira ID in title

Follow the standards defined in @.claude/skills/jira-workflow/SKILL.md
```

**Usage:**
```
User: /story JIRA-12345
```

**How it works:**
- Explicit command for developers who prefer precision
- Still follows same workflow as skill
- `$1` substitutes with provided Jira ID
- References skill for consistency

## Complete Interaction Flow

### User Input

```
User: I have a Jira story, JIRA-12345, that I would like to work on
```

### Step 1: UserPromptSubmit Hook Fires

Hook detects "JIRA-12345" and injects:

```
## Auto-detected Jira Story
Jira ID: JIRA-12345

Please use the Atlassian MCP to fetch full story details for context.
```

### Step 2: Skill Automatically Activates

Claude recognizes prompt matches `jira-workflow` skill:
- "work on a Jira story" matches skill description
- Skill instructions loaded into context

### Step 3: Claude Fetches and Confirms

Claude calls MCP tool:

```
mcp__atlassian__get_issue(issue_key="JIRA-12345")
```

Returns:
```json
{
  "key": "JIRA-12345",
  "summary": "Implement user password reset functionality",
  "description": "Users need ability to reset forgotten passwords via email...",
  "acceptance_criteria": [
    "Send password reset email with secure token",
    "Token expires after 1 hour",
    "Validate token on reset page",
    "Update password with proper hashing",
    "Send confirmation email after reset"
  ]
}
```

**Claude responds:**

> I understand you want to implement a password reset feature for users. Based on the Jira story JIRA-12345, here's what I understand:
>
> **Feature:** User password reset functionality
>
> **Key requirements:**
> - Email-based password reset flow
> - Secure token generation with 1-hour expiration
> - Token validation on reset page
> - Secure password hashing on update
> - Confirmation email after successful reset
>
> **My implementation plan:**
> 1. Create API endpoint: `POST /api/auth/forgot-password` (sends email)
> 2. Create API endpoint: `POST /api/auth/reset-password` (validates token, updates password)
> 3. Add token storage in database with expiration
> 4. Integrate with email service for notifications
> 5. Add frontend reset password page
> 6. Write unit and integration tests
>
> **Questions before I proceed:**
> - Should tokens be single-use (invalidated after one attempt)?
> - Should we rate-limit reset requests to prevent abuse?
> - Which email service should I integrate with (existing service or specify)?
>
> Please confirm this understanding and answer the questions, then I'll proceed with implementation.

### Step 4: User Confirms

```
User: Yes that's correct. Tokens should be single-use. Add rate limiting of 3 attempts per hour per email. Use the existing EmailService class.
```

### Step 5: Claude Executes Workflow

**Git setup:**

```bash
# Claude runs:
git branch --show-current
# Output: main

git checkout main && git pull origin main
# Output: Already up to date.

git checkout -b story/JIRA-12345-password-reset
```

PreToolUse hook validates: ✓ Branch name follows convention

**Implementation:**

Claude creates/modifies files:
- `src/auth/password-reset.controller.ts`
- `src/auth/password-reset.service.ts`
- `src/auth/dto/password-reset.dto.ts`
- `src/database/entities/reset-token.entity.ts`
- `tests/auth/password-reset.spec.ts`

**Git commit:**

```bash
# Claude stages files
git add src/auth/password-reset.* src/database/entities/reset-token.entity.ts tests/auth/password-reset.spec.ts

# Claude commits
git commit -m "story: JIRA-12345 implement password reset with email token validation and rate limiting"
```

PreToolUse hooks validate:
- ✓ Not on protected branch (main/master)
- ✓ Commit message follows convention

**Push and PR:**

```bash
# Claude pushes
git push -u origin story/JIRA-12345-password-reset

# Claude creates PR (via gh CLI or GitHub MCP)
gh pr create \
  --title "[JIRA-12345] Implement user password reset functionality" \
  --body "Implements password reset feature with email-based token flow.

**Jira:** https://company.atlassian.net/browse/JIRA-12345

**Implementation:**
- Secure token generation with 1-hour expiration
- Single-use tokens (invalidated after use)
- Rate limiting: 3 attempts per hour per email
- Email notifications for reset request and confirmation
- Comprehensive unit and integration tests

**Testing:**
- ✓ Unit tests for service logic
- ✓ Integration tests for API endpoints
- ✓ Email service mocked appropriately
- ✓ Rate limiting validated"
```

### Step 6: Success

**Claude responds:**

> ✅ Implementation complete!
>
> **Created branch:** `story/JIRA-12345-password-reset`
>
> **Files modified:**
> - src/auth/password-reset.controller.ts (new)
> - src/auth/password-reset.service.ts (new)
> - src/auth/dto/password-reset.dto.ts (new)
> - src/database/entities/reset-token.entity.ts (new)
> - tests/auth/password-reset.spec.ts (new)
>
> **Commit:** `story: JIRA-12345 implement password reset with email token validation and rate limiting`
>
> **Pull Request:** [#142](https://github.com/company/project/pull/142) - [JIRA-12345] Implement user password reset functionality
>
> All tests passing ✓
>
> The PR is ready for review!

## Key Benefits Demonstrated

### 1. Autonomous Yet Controlled
- Skill auto-activates (no explicit command needed)
- But requires confirmation before proceeding
- Balances autonomy with safety

### 2. Context Enrichment
- Hook detects Jira ID
- Triggers MCP fetch automatically
- Vague prompt becomes rich context

### 3. Validation Guardrails
- Hooks enforce git conventions
- Claude cannot create invalid branches/commits
- Self-corrects when blocked

### 4. Workflow Consistency
- Every Jira story follows same process
- Standardized branch names, commit messages, PR format
- Reduces cognitive load

### 5. Multi-Component Coordination
- Hook → enriches context
- Skill → provides workflow
- MCP → fetches data
- Hooks → validate actions
- All work together seamlessly

## Configuration Files Summary

This workflow requires:

**hooks.yaml:**
- UserPromptSubmit: Detect Jira IDs
- PreToolUse: Validate branch naming
- PreToolUse: Validate commit messages
- PreToolUse: Prevent commits to main
- SessionStart: Inject git context

**skills/jira-workflow/SKILL.md:**
- Complete workflow instructions
- Confirmation checkpoint
- Step-by-step guidance

**commands/story.md** (optional):
- Explicit command alternative
- References skill for consistency

**MCP server:**
- Atlassian MCP for Jira integration
- Configured in mcp-servers.yaml

## Extension Ideas

### Add Context Files

**context/coding-standards.md:**
- Team coding conventions
- Referenced by skill: `@.claude/context/coding-standards.md`

**context/testing-guidelines.md:**
- Testing requirements
- Coverage expectations

### Add More Hooks

**PostToolUse: Auto-run tests after code changes:**

```yaml
- matcher:
    tool: Edit|Write
    pattern: "src/**/*.ts"
  events:
    postToolUse:
      - command: npm test -- --related --passWithNoTests
        description: "Auto-run related tests after code changes"
```

**PreToolUse: Prevent pushing to main:**

```yaml
- matcher:
    tool: Bash
    pattern: "git push*"
  events:
    preToolUse:
      - command: |
          BRANCH=$(git rev-parse --abbrev-ref HEAD)
          if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
            echo "❌ Cannot push directly to $BRANCH" >&2
            exit 2
          fi
        description: "Prevent push to protected branches"
```

### Add Agent for Code Review

**agents/jira-reviewer.md:**
- Specialized agent for reviewing Jira story implementations
- Checks implementation against acceptance criteria
- Invoked before creating PR

This example demonstrates the full power of Claude Code's component architecture working in harmony!
