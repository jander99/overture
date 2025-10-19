# Subagents

## Overview

Subagents are specialized AI assistants in Claude Code that can be invoked to handle specific types of tasks. They enable more efficient problem-solving by providing task-specific configurations with customized system prompts, tools, and a separate context window.

## Key Characteristics

- **Independent Context**: Each subagent operates in its own context window, preventing pollution of the main conversation
- **Specialized Expertise**: Pre-configured AI personalities with specific roles and capabilities
- **Delegation Model**: Claude Code can delegate tasks to subagents when it encounters work matching their expertise
- **Tool Access**: Subagents can have their own set of MCP tools, different from the main agent

## Configuration

### Location
- **Project-Level**: `.claude/agents/` within your project
- Subagent files are automatically detected and loaded by Claude Code

### File Structure
Subagent configuration files use Markdown with YAML frontmatter:

```markdown
---
name: subagent-name
description: Brief description of capabilities
tools: List of MCP tools used
---

Role definition and expertise...
[Detailed instructions for the subagent's behavior]
```

### Frontmatter Fields
- `name`: Identifier for the subagent
- `description`: Brief description of capabilities (used for task matching)
- `tools`: List of MCP tools the subagent has access to

### Body Content
The markdown body after the frontmatter contains:
- Role definition
- Expertise areas
- Behavioral instructions
- Task-specific guidelines
- Any context the subagent needs to operate effectively

## Tool Management

Use the `/agents` command to modify tool access through an interactive interface that lists all available tools, including any connected MCP server tools.

## Creation Best Practices

- **Generate Initial Version**: Anthropic recommends generating your initial subagent with Claude and then iterating
- **Personalize**: Customize the generated subagent to fit your specific needs
- **Focus on Specificity**: Make subagents highly specialized rather than general-purpose

## Potential for Duplication

**Skills vs Subagents**: Subagents may possess the same capabilities as first-class Skills. Key differences:
- **Skills**: Model-invoked, Claude decides when to use them based on task
- **Subagents**: Delegated to with full context isolation and separate tool access
- **Overlap Risk**: A skill for "writing tests" could overlap with a "test-engineer" subagent

**Recommendation**: When designing Overture's configuration system, consider:
- Detecting when a subagent's description matches a skill's purpose
- Allowing skills to be referenced within subagent configurations
- Providing warnings when creating redundant capabilities

## Availability

Claude Code Subagents became generally available in 2025, enabling developers to create independent, task-specific AI agents.

## Community Resources

- Large collection of community-created subagents available on GitHub
- Repositories containing 60+ specialized subagents organized by domain
- Examples: https://github.com/VoltAgent/awesome-claude-code-subagents

## Sources

1. [Subagents - Claude Docs](https://docs.claude.com/en/docs/claude-code/sub-agents) (Official Documentation)
2. [Claude Code Subagents Enable Modular AI Workflows - InfoQ](https://www.infoq.com/news/2025/08/claude-code-subagents/)
3. [Claude Code Frameworks & Sub-Agents: The Complete 2025 Developer's Guide](https://medianeth.dev/blog/claude-code-frameworks-subagents-2025)
4. [GitHub - VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents)
5. [ClaudeLog - Custom Agents](https://claudelog.com/mechanics/custom-agents/)
6. [Claude Code: Subagent Deep Dive](https://cuong.io/blog/2025/06/24-claude-code-subagent-deep-dive)
