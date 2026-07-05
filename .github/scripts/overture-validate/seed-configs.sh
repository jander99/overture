#!/usr/bin/env bash
set -eu

: "${HOME:?HOME must be set}"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"

mkdir -p "$CONFIG_DIR/opencode" "$HOME/.copilot" "$HOME/.codex"

# claude-code: ~/.claude.json
cat > "$HOME/.claude.json" <<'JSON'
{
  "mcpServers": {
    "shared-fs": {
      "command": "echo",
      "args": ["shared"],
      "env": {}
    }
  }
}
JSON

# opencode: $XDG_CONFIG_HOME/opencode/opencode.json
cat > "$CONFIG_DIR/opencode/opencode.json" <<'JSON'
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "shared-fs": {
      "type": "local",
      "command": ["echo", "shared"],
      "environment": {}
    }
  }
}
JSON

# github-copilot-cli: ~/.copilot/mcp-config.json
cat > "$HOME/.copilot/mcp-config.json" <<'JSON'
{
  "mcpServers": {
    "shared-fs": {
      "type": "local",
      "command": "echo",
      "args": ["shared"],
      "env": {}
    }
  }
}
JSON

# openai-codex: ~/.codex/config.toml
# `env = {}` is required so codex normalizes to `{env: {}}` — matching the
# other agents. Without it, codex emits `{env: undefined}` and the
# scan-matrix equality check (`serverSettingsEqual`) treats
# `undefined ≠ {}` as distinct, producing a pickable conflict instead of
# the expected `all-agents-equal` adoption.
cat > "$HOME/.codex/config.toml" <<'TOML'
[mcp_servers.shared-fs]
command = "echo"
args = ["shared"]
env = {}
TOML

echo "Seeded MCP configs:"
ls -l "$HOME/.claude.json" \
       "$CONFIG_DIR/opencode/opencode.json" \
       "$HOME/.copilot/mcp-config.json" \
       "$HOME/.codex/config.toml"
