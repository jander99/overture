# Overlaps and Duplication Analysis

## Overview

This document analyzes potential overlaps and duplication issues across Claude Code's extensible features. Understanding these relationships is critical for Overture's design to avoid redundant configurations and enable intelligent feature composition.

## Feature Relationship Matrix

### Skills ↔ Subagents

**Overlap Type**: Functional duplication

**Description**: Both can perform similar tasks, but with different mechanisms:
- **Skills**: Instructions loaded into Claude's current context, model-invoked
- **Subagents**: Separate AI instance with isolated context, delegated to

**Specific Overlaps**:
1. **Test Generation**
   - Skill: "generate-tests" with instructions on writing test cases
   - Subagent: "test-engineer" that writes tests in isolated context
   - Duplication: Same capability, different execution model

2. **Code Review**
   - Skill: "code-review" with review guidelines
   - Subagent: "code-reviewer" performing reviews in isolation
   - Duplication: Same domain knowledge, different context handling

3. **Documentation Writing**
   - Skill: "write-docs" with documentation standards
   - Subagent: "documentation-specialist" dedicated to docs
   - Duplication: Same expertise area

**Design Implications**:
- Skills are "lightweight" (instructions only)
- Subagents are "heavyweight" (full AI instance with tools)
- Consider skills as shared knowledge that subagents can reference
- Subagents should use skills rather than duplicating their instructions

**Recommendation**:
- Allow subagents to explicitly reference skills in their definitions
- Detect when skill description matches subagent purpose
- Provide warnings when creating redundant capabilities
- Enable skill composition: subagent frontmatter could include `skills: [skill-name]`

### Skills ↔ Hooks

**Overlap Type**: Trigger mechanism confusion

**Description**: Skills that trigger on events might overlap with hook functionality:
- **Skills**: Claude decides when to invoke based on task relevance
- **Hooks**: Automatically triggered by specific events

**Specific Overlaps**:
1. **Pre-commit Validation**
   - Skill: "pre-commit-checks" that Claude might invoke before commits
   - Hook: `PreToolUse` hook on `Bash` tool for git commands
   - Duplication: Both validate before commits

2. **Code Formatting**
   - Skill: "format-code" with formatting instructions
   - Hook: `PostToolUse` hook that runs formatter after file edits
   - Duplication: Same outcome through different triggers

**Design Implications**:
- Skills are decision-based (Claude chooses when)
- Hooks are deterministic (always run on event)
- Hooks should be simple automation, skills for complex logic
- Hooks can invoke skills for decision-making

**Recommendation**:
- Keep hooks as thin automation layer
- Use hooks to trigger Claude to consider relevant skills
- Don't duplicate complex logic in both hooks and skills
- Consider: Hook runs linter, skill interprets results and suggests fixes

### Hooks ↔ Subagents

**Overlap Type**: Complex logic in hooks

**Description**: Sophisticated hooks might duplicate subagent reasoning:
- **Hooks**: Shell command execution in response to events
- **Subagents**: Full AI reasoning with context and tools

**Specific Overlaps**:
1. **Test Result Analysis**
   - Hook: Complex script analyzing test output
   - Subagent: "test-analyst" interpreting failures
   - Duplication: Analysis logic

2. **Deployment Decisions**
   - Hook: Script with deployment logic
   - Subagent: "devops-engineer" making deployment decisions
   - Duplication: Decision-making capability

**Design Implications**:
- Hooks are for automation, not complex decision-making
- Complex logic belongs in subagents or skills
- Hooks can trigger subagent delegation

**Recommendation**:
- Limit hooks to simple command execution
- For complex logic, hook should trigger subagent
- Don't encode sophisticated rules in hook scripts
- Use hooks as integration points, subagents as intelligence

### MCP Servers ↔ Multiple Features

**Overlap Type**: Tool access configuration

**Description**: MCP servers provide tools used by multiple features:

**Tool Sharing Pattern**:
```
MCP Server: pytest-runner
    ├─→ Subagent: test-engineer (uses pytest-runner)
    ├─→ Skill: run-tests (uses pytest-runner)
    ├─→ Hook: PostToolUse validates with pytest-runner
    └─→ Plugin: python-dev (bundles pytest-runner)
```

**Specific Overlaps**:
1. **Multiple Server Definitions**
   - User-level: `~/.claude.json` defines `git-tools`
   - Project-level: `.mcp.json` defines `git-tools`
   - Duplication: Same server, different scopes

2. **Plugin Bundling**
   - Plugin includes MCP server
   - User already has same MCP server configured
   - Conflict: Version mismatch or duplicate registration

**Design Implications**:
- MCP servers should be defined once, shared everywhere
- Configuration scope determines availability
- Plugins must handle already-configured servers

**Recommendation**:
- Detect duplicate MCP server names across scopes
- Version tracking for servers
- Plugin installation should check for existing servers
- Allow server aliases for different configurations of same tool

### Plugins ↔ All Features

**Overlap Type**: Bundling and composition

**Description**: Plugins are containers for other features:

**Plugin Contents**:
```
Plugin: python-dev
    ├── Subagents: [test-engineer, package-manager]
    ├── Skills: [write-docstring, run-tests]
    ├── MCP Servers: [pytest-runner, pip-manager]
    ├── Hooks: [pre-commit validation]
    └── Commands: [/test, /package]
```

**Specific Overlaps**:
1. **Internal Plugin Duplication**
   - Plugin includes both skill and subagent for same task
   - Recommendation: Subagent should reference skill

2. **Cross-Plugin Duplication**
   - Plugin A: includes "code-formatter" skill
   - Plugin B: includes "formatter" skill
   - Duplication: Same capability, different names

3. **Plugin vs Manual Configuration**
   - User manually configured components
   - Later installs plugin with overlapping components
   - Conflict: Duplicate features

**Design Implications**:
- Plugins should compose features, not duplicate them
- Plugin system needs conflict detection
- Installed components should be tracked by origin

**Recommendation**:
- Track plugin provenance (which features came from which plugin)
- Warn on overlaps between plugins
- Support plugin updates without duplicating configs
- Enable plugin uninstall that removes all components

## Configuration Scope Duplication

### Cross-Scope Feature Duplication

**Pattern**: Same feature configured at multiple configuration levels

**Examples**:

1. **Command Duplication**
   - User: `~/.claude/commands/git-helper.md`
   - Project: `.claude/commands/git-helper.md`
   - Conflict: Which takes precedence?

2. **Skill Duplication**
   - User: `~/.claude/skills/format-code/`
   - Project: `.claude/skills/format-code/`
   - Conflict: Different formatting standards

3. **Subagent Duplication**
   - User: personal code-reviewer with strict standards
   - Project: team code-reviewer with team standards
   - Conflict: Conflicting review criteria

**Recommendation**:
- Document clear precedence rules (project > user)
- Detect same-name features across scopes
- Provide warnings about shadowing
- Allow explicit inheritance (project extends user)

## Information Overlap and Sharing

### Shared Knowledge Pattern

Some information is relevant across multiple features:

**Example: Python Testing Knowledge**

Could appear in:
1. **Skill**: `write-python-tests/SKILL.md` - How to write pytest tests
2. **Subagent**: `test-engineer.md` - Uses same testing knowledge
3. **Command**: `test-runner.md` - Uses same test execution knowledge
4. **Hook**: Test validation - Uses same test format knowledge

**Duplication Problem**: Same information copied to 4 different places

**Recommendation for Overture**:
- Support shared knowledge files (e.g., `knowledge/python-testing.md`)
- Features reference shared knowledge
- Single source of truth for domain expertise
- Reduces duplication, easier to maintain

### Template and Resource Sharing

**Pattern**: Multiple features need same supporting files

**Example: React Component Templates**

Could be used by:
1. **Skill**: `generate-component/templates/` - Component templates
2. **Subagent**: `react-developer` - Uses same templates
3. **Command**: `/component` - Creates from templates

**Recommendation**:
- Shared resource directory (e.g., `.claude/resources/`)
- Features reference resources by path
- Overture tracks resource dependencies
- Bundle resources with features that need them

## Overture Design Recommendations

### 1. Dependency Graph

Build a dependency graph showing:
- Which features depend on which MCP servers
- Which subagents reference which skills
- Which plugins contain which components
- Which features share resources

### 2. Conflict Detection

Implement detection for:
- Duplicate feature names across scopes
- Overlapping plugin contents
- Conflicting MCP server definitions
- Redundant skill/subagent pairs

### 3. Composition Over Duplication

Enable:
- Subagents referencing skills (not duplicating instructions)
- Hooks triggering subagents (not duplicating logic)
- Plugins composing existing features (not bundling copies)
- Features sharing resources (not copying templates)

### 4. Provenance Tracking

Track:
- Which plugin installed which features
- Which features were manually configured
- Version information for all components
- Dependencies between features

### 5. Schema Design

Create schema that:
- Allows skill references in subagent definitions
- Supports shared knowledge/resource references
- Tracks plugin membership
- Handles scope precedence
- Enables feature composition

### 6. Validation Rules

Implement validation:
- Warn when skill matches subagent purpose
- Detect duplicate MCP server names
- Flag complex logic in hooks (suggest subagent)
- Identify cross-plugin duplications
- Validate resource references exist

## Cross-Tool Considerations (Claude Code ↔ Copilot)

### Claude-Specific Features

Features with no Copilot equivalent:
- **Subagents**: No Copilot equivalent (as of 2025)
- **Skills**: No Copilot equivalent
- **Hooks**: No Copilot equivalent
- **Plugins**: No Copilot equivalent

**Overture Strategy**:
- Mark features as Claude-specific
- Document what they do for Copilot users
- Provide equivalent Copilot configurations where possible
- Maintain Claude configuration even if not synced to Copilot

### Potentially Shareable Features

**MCP Servers**:
- If Copilot adopts MCP, could be shared
- Design schema to accommodate future Copilot MCP support
- For now, Claude-specific but with shareable potential

**Configuration Philosophy**:
- Some features may provide capabilities in Claude-specific ways
- Document the *intent* even if implementation differs
- Enable partial sync (sync what's compatible)

## Summary

### Critical Overlaps Identified

1. **Skills vs Subagents**: Same capabilities, different execution (HIGH PRIORITY)
2. **MCP Server Duplication**: Across scopes and plugins (HIGH PRIORITY)
3. **Hooks vs Skills**: Event-driven vs decision-based (MEDIUM PRIORITY)
4. **Plugin Composition**: Bundling leads to duplication (MEDIUM PRIORITY)
5. **Cross-Scope Duplication**: Same feature at multiple levels (MEDIUM PRIORITY)
6. **Resource Sharing**: Templates and knowledge (LOW PRIORITY)

### Design Principles for Overture

1. **Single Source of Truth**: Each piece of knowledge should exist once
2. **Composition Over Copying**: Reference rather than duplicate
3. **Explicit Dependencies**: Track what depends on what
4. **Conflict Detection**: Warn users about duplications
5. **Provenance Tracking**: Know where each feature came from
6. **Graceful Degradation**: Handle missing dependencies
7. **Cross-Tool Awareness**: Know what can/can't sync to Copilot

### Next Steps for Overture Implementation

1. Design schema supporting feature references and composition
2. Implement dependency graph builder
3. Create conflict detection system
4. Build validation rules for common duplication patterns
5. Design plugin handling that respects existing configurations
6. Create migration tools for consolidating duplicates
