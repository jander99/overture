# Skills

## Overview

Skills are modular capabilities that extend Claude's functionality through organized folders containing instructions, scripts, and resources. Each Skill consists of a `SKILL.md` file with instructions that Claude reads when relevant, plus optional supporting files like scripts and templates.

## Key Characteristics

- **Model-Invoked**: Claude autonomously decides when to use skills based on your request and the skill's description
- **Cross-Platform**: Skills work across Claude apps, Claude Code, and the Anthropic API
- **Self-Contained**: Each skill is a folder with all necessary resources
- **Different from Slash Commands**: Skills are automatically invoked by Claude; slash commands are manually triggered by users

## Configuration

### Locations
Skills can be stored in two locations:

1. **Personal Skills**: `~/.claude/skills/my-skill/SKILL.md`
   - Available across all projects
   - Personal to the user

2. **Project Skills**: `.claude/skills/my-skill/SKILL.md`
   - Specific to a project
   - Can be checked into version control for team sharing

### File Structure

```
.claude/skills/my-skill/
├── SKILL.md          # Required: Main skill definition
├── scripts/          # Optional: Helper scripts
├── templates/        # Optional: Code templates
└── resources/        # Optional: Additional files
```

### SKILL.md Format

The `SKILL.md` file uses YAML frontmatter followed by detailed instructions:

```markdown
---
name: Generating Commit Messages
description: Generates clear commit messages from git diffs. Use when writing commit messages or reviewing staged changes.
---

# Skill Instructions

[Detailed instructions for Claude on how to perform this skill]
[Best practices, examples, templates]
[Any specific patterns or approaches to use]
```

### Frontmatter Fields
- `name`: Display name for the skill
- `description`: Brief description that helps Claude decide when to invoke the skill

### Body Content
The markdown body contains:
- Detailed instructions for performing the skill
- Examples and templates
- Best practices and patterns
- Any context needed to execute the skill effectively

## How Skills Work

1. **Automatic Detection**: Claude scans skill descriptions when processing user requests
2. **Relevance Matching**: Claude determines if a skill is relevant to the current task
3. **Loading**: When relevant, Claude loads the skill's instructions
4. **Execution**: Claude follows the skill's guidance to complete the task

## Potential for Duplication

**Skills vs Subagents**: Skills can overlap with subagent capabilities:
- **Skills**: Instructions loaded into Claude's current context when relevant
- **Subagents**: Separate AI instance with isolated context and dedicated tools
- **Overlap Risk**: A "generate-tests" skill could duplicate a "test-engineer" subagent's purpose

**Skills vs Hooks**: Skills that trigger on specific events might overlap with hooks:
- **Skills**: Claude decides when to invoke based on task relevance
- **Hooks**: Automatically triggered by specific events (tool use, user submit, etc.)
- **Overlap Risk**: A "pre-commit-validation" skill might overlap with a pre-tool-use hook

**Recommendation for Overture**:
- Allow skills to be referenced in subagent definitions (avoid duplicating instructions)
- Detect when skill descriptions match subagent purposes
- Consider skills as "lightweight" capabilities vs subagents as "heavyweight" isolated workers
- Skills should be used for instructions/guidance, subagents for full delegation

## Recent Updates (October 2025)

Claude introduced Skills as a way to improve how it performs specific tasks. Skills are now available across all Claude interfaces including Claude.ai, Claude Code, and the API.

## Sources

1. [Agent Skills - Claude Docs](https://docs.claude.com/en/docs/claude-code/skills) (Official Documentation)
2. [Equipping agents for the real world with Agent Skills - Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
3. [Skills for Claude!](https://blog.fsck.com/2025/10/16/skills-for-claude/)
4. [Claude Skills: Customize AI for your workflows - Anthropic](https://www.anthropic.com/news/skills)
5. [What Are Claude Skills? Simple Guide - Skywork AI](https://skywork.ai/blog/ai-agent/claude-skills-guide-non-developers/)
6. [How to Create and Use Skills in Claude and Claude Code - Apidog](https://apidog.com/blog/claude-skills/)
7. [Supercharge ADK Development with Claude Code Skills - Medium](https://medium.com/@kazunori279/supercharge-adk-development-with-claude-code-skills-d192481cbe72)
