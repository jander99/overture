# Implementation Plan: Universal Subagent Synchronization

## Goal

Enable synchronization of specialized AI agents (Subagents/Custom Agents) across Claude Code, OpenCode, and GitHub Copilot from a unified Overture source (`.yaml` metadata + `.md` system prompt).

## 1. Discovery & Source Structure

Overture will manage agents in two locations:

- **Global**: `~/.config/overture/agents/`
- **Project**: `.overture/agents/`

Each agent consists of a pair of files:

- `<name>.yaml`: Metadata and configuration.
- `<name>.md`: The system prompt body.

## 2. Model Mapping Table

To ensure cross-client compatibility, Overture will use a logical model mapping table defined in `~/.config/overture/models.yaml`:

```yaml
smart:
  claude-code: sonnet
  opencode: anthropic/claude-3-5-sonnet-latest
  copilot-cli: gpt-4o
fast:
  claude-code: haiku
  opencode: anthropic/claude-3-haiku-latest
  copilot-cli: gpt-4o-mini
```

## 3. Implementation Tasks

### Phase 1: Domain & Types

- [ ] Add `AgentConfig` and `AgentDefinition` types to `libs/domain/config-types/src/lib/config.types.ts`.
- [ ] Define `ModelMapping` interface.

### Phase 2: Schema & Validation

- [ ] Add Zod schemas for Agent YAML and Model Mapping in `libs/domain/config-schema`.

### Phase 3: Core Logic (The Agent Compiler)

- [ ] Create `AgentTransformer` in `libs/core/agent` (new module or within sync).
  - Handle frontmatter generation per client.
  - Resolve logical models to physical IDs.
  - Standardize permissions (initially `*`).
- [ ] Create `AgentSyncService` to handle discovery and orchestration.

### Phase 4: Client Adapters

- [ ] Update `ClaudeCodeAdapter` to support `agents/` directory syncing.
- [ ] Update `OpenCodeAdapter` to support Markdown-based agent definitions.
- [ ] Update `CopilotCliAdapter` to sync to `.github/agents/*.agent.md`.

### Phase 5: CLI Integration

- [ ] Update `overture sync` to include the agents phase.
- [ ] Add `overture agents list` command for visibility.

## 4. Client-Specific Renderings

### Claude Code

- **Path**: `~/.claude/agents/<name>.md`
- **Frontmatter**: `name`, `description`, `tools` (csv), `model`, `permissionMode`.

### OpenCode

- **Path**: `~/.config/opencode/agent/<name>.md`
- **Frontmatter**: `description`, `mode: subagent`, `model`, `tools` (map), `permission` (granular).

### GitHub Copilot

- **Path**: `.github/agents/<name>.agent.md`
- **Frontmatter**: `name`, `description`, `tools` (list).
