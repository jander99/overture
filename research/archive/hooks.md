# Hooks

## Overview

Hooks are event-driven automation triggers in Claude Code that execute shell commands in response to specific events like tool usage, notifications, session start, or user prompt submission. They enable workflow automation and integration with external tools.

## Key Characteristics

- **Event-Driven**: Automatically triggered by specific Claude Code events
- **Shell Command Execution**: Runs arbitrary shell commands or scripts
- **Pattern Matching**: Can filter events based on tool names or other criteria
- **Environment Context**: Has access to project directory via environment variables

## Configuration

### Locations

Hooks can be configured in three different settings files, listed by precedence:

1. **User Settings**: `~/.claude/settings.json`
   - Global hooks that run on any project
   - Personal to the user

2. **Project Settings**: `.claude/settings.json`
   - Project-specific hooks
   - Should be committed for team sharing

3. **Local Project Settings**: `.claude/settings.local.json`
   - Local overrides not meant to be committed
   - Personal experimentation and local tooling

### JSON Structure

Hooks are defined in the `hooks` object within settings files:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "commands": [
          "echo 'About to run bash command'"
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "commands": [
          "echo 'Tool completed: $CLAUDE_TOOL_NAME'"
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "commands": [
          "echo 'User submitted: $CLAUDE_USER_PROMPT'"
        ]
      }
    ],
    "SessionStart": [
      {
        "commands": [
          "echo 'Session started in $CLAUDE_PROJECT_DIR'"
        ]
      }
    ]
  }
}
```

### Hook Events

Available event types:

1. **PreToolUse**: Before a tool runs
2. **PostToolUse**: After a tool completes successfully
3. **Notification**: When Claude sends an alert
4. **Stop**: When the AI agent finishes its response
5. **UserPromptSubmit**: When user submits a prompt
6. **SessionStart**: When a new session begins

### Configuration Fields

- `matcher`: (Optional) Pattern for filtering tool names (supports wildcards like `*`)
- `commands`: Array of shell commands to execute

### Environment Variables

Hooks have access to environment variables:
- `CLAUDE_PROJECT_DIR`: The current project directory
- `CLAUDE_TOOL_NAME`: Name of the tool being used (for tool-related hooks)
- `CLAUDE_USER_PROMPT`: User's submitted prompt (for UserPromptSubmit hook)

## Interactive Management

### /hooks Command

Use the interactive `/hooks` command to configure hooks through a menu interface:
- Lists all available hooks
- Easier than manually editing JSON
- Changes made via `/hooks` require review for security

**Important**: Direct edits to hooks in settings files don't take effect immediately and require review in the `/hooks` menu for changes to apply.

## Use Cases

Common hook applications:

1. **Pre-commit Validation**: Run linters or tests before git commits
2. **Notification Integration**: Send messages to Slack/Discord on events
3. **Logging**: Track tool usage or session activity
4. **Automated Formatting**: Format code after writes
5. **Security Scanning**: Check for secrets or vulnerabilities
6. **CI/CD Integration**: Trigger builds or deployments

## Potential for Duplication

**Hooks vs Skills**: Hooks that perform task-specific work might overlap with skills:
- **Hooks**: Event-driven, always execute when triggered
- **Skills**: Claude decides when to invoke based on relevance
- **Overlap Risk**: A hook that formats code on PostToolUse might duplicate a "code-formatting" skill

**Hooks vs Subagents**: Complex hooks that make decisions might duplicate subagent logic:
- **Hooks**: Simple shell command execution
- **Subagents**: Full AI reasoning with context
- **Design Principle**: Hooks should be simple automation, not complex decision-making

**Recommendation for Overture**:
- Hooks are implementation-specific (shell commands differ across systems)
- Consider extracting hook "intent" vs exact commands
- Allow hooks to invoke skills or trigger subagents for complex logic
- Keep hooks as thin automation layer

## Security Considerations

- Hooks execute arbitrary shell commands with project access
- Direct file edits require review in `/hooks` menu
- Be cautious with hooks from untrusted sources
- Local settings file can override for local-only experimental hooks

## Sources

1. [Hooks reference - Claude Docs](https://docs.claude.com/en/docs/claude-code/hooks) (Official Documentation)
2. [Claude Code Hooks - GitButler Docs](https://docs.gitbutler.com/features/ai-integration/claude-code-hooks)
3. [Demystifying Claude Code Hooks - Aaron Brethorst](https://www.brethorsting.com/blog/2025/08/demystifying-claude-code-hooks/)
4. [GitHub - disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery)
5. [A complete guide to hooks in Claude Code - eesel AI](https://www.eesel.ai/blog/hooks-in-claude-code)
6. [Automate Your AI Workflows with Claude Code Hooks - Butler's Log](https://blog.gitbutler.com/automate-your-ai-workflows-with-claude-code-hooks)
7. [How I'm Using Claude Code Hooks To Fully Automate My Workflow - Medium](https://medium.com/@joe.njenga/use-claude-code-hooks-newest-feature-to-fully-automate-your-workflow-341b9400cfbe)
8. [Complete Guide: Creating Claude Code Hooks - Suite Insider](https://suiteinsider.com/complete-guide-creating-claude-code-hooks/)
