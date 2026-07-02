/**
 * Inline fixture strings for the writer preservation harness.
 *
 * These are exported as constants rather than loaded from disk so the
 * spec files compile cleanly under CommonJS (which forbids
 * `import.meta`). The contents are byte-identical to the files in
 * `fixtures/`; that directory is kept for documentation and for any
 * downstream tooling that wants to read the raw bytes, but the test
 * suite uses these constants to avoid the ESM-only `import.meta.url`
 * API.
 *
 * NOTE: template-literal `\${` sequences are intentional. The fixture
 * payloads contain literal `${VAR}` strings (e.g. shell-style env
 * forwarders in MCP server configs); escaping with a leading
 * backslash keeps them as literal text instead of being evaluated as
 * template expressions.
 */

export const OPENCODE_FIXTURE = `{
  "$schema": "https://opencode.ai/config.json",
  "theme": "system",
  "provider": {
    "default": "anthropic"
  },
  // MCP servers (canonical: "mcp" top-level key)
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": [
        "npx",
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/home/user/projects"
      ],
      "environment": {
        "LOG_LEVEL": "info"
      },
      "enabled": true
    },
    /* second server, unrelated to the touch target */
    "context7": {
      "type": "local",
      "command": [
        "npx",
        "-y",
        "@upstash/context7-mcp@latest"
      ],
      "environment": {
        "CONTEXT7_API_KEY": "\${CONTEXT7_API_KEY}"
      },
      "enabled": true,
      "timeout": 30
    },
    "remote-bridge": {
      "type": "remote",
      "url": "https://mcp.example.com/bridge",
      "headers": {
        "Authorization": "Bearer \${MCP_BRIDGE_TOKEN}"
      },
      "enabled": true
    }
  }
}
`;

export const CLAUDE_CODE_FIXTURE = `{
  // ~/.claude.json — Claude Code MCP config
  // Top-level keys are general Claude Code state, not MCP config.
  "numStartups": 42,
  "autoUpdaterStatus": "enabled",
  "userID": "abc123def456",
  "hasCompletedOnboarding": true,
  "lastOnboardingVersion": "1.0.17",
  /* MCP server inventory (canonical top-level key: "mcpServers") */
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/home/user/projects"
      ],
      "env": {
        "LOG_LEVEL": "info"
      }
    },
    "context7": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/context7-mcp@latest"
      ],
      "env": {
        // Forward from the parent shell.
        "CONTEXT7_API_KEY": "\${CONTEXT7_API_KEY}"
      }
    },
    "remote-bridge": {
      "url": "https://mcp.example.com/bridge",
      "headers": {
        "Authorization": "Bearer \${MCP_BRIDGE_TOKEN}"
      }
    }
  }
}
`;

export const COPILOT_CLI_FIXTURE = `{
  // ~/.copilot/mcp-config.json — GitHub Copilot CLI MCP config
  "$schema": "https://github.com/copilot-cli/mcp-config.schema.json",
  "version": 1,
  "lastUpdated": "2026-06-01T12:00:00Z",
  /* MCP server inventory (canonical top-level key: "mcpServers") */
  "mcpServers": {
    "filesystem": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/home/user/projects"
      ],
      "tools": ["read_file", "write_file", "list_directory"]
    },
    "context7": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "@upstash/context7-mcp@latest"
      ],
      "env": {
        // Forward from the parent shell.
        "CONTEXT7_API_KEY": "\${CONTEXT7_API_KEY}"
      },
      "tools": ["get-library-docs", "resolve-library-id"]
    },
    "remote-bridge": {
      "type": "http",
      "url": "https://mcp.example.com/bridge",
      "headers": {
        "Authorization": "Bearer \${MCP_BRIDGE_TOKEN}"
      },
      "tools": ["*"]
    }
  }
}
`;

export const CODEX_FIXTURE = `# ~/.codex/config.toml — OpenAI Codex config
# Top-level keys are general Codex state, not MCP config.
model = "gpt-5"
model_provider = "openai"
approval_mode = "on-request"

[sandbox]
mode = "workspace-write"
network_access = false

# MCP server inventory (canonical top-level key: "mcp_servers")
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
startup_timeout_sec = 30

# A second server, unrelated to the touch target.
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp@latest"]
startup_timeout_sec = 15
tool_timeout_sec = 60

# Forward from the parent shell.
[mcp_servers.context7.env]
CONTEXT7_API_KEY = "\${CONTEXT7_API_KEY}"

[mcp_servers.remote-bridge]
url = "https://mcp.example.com/bridge"
bearer_token_env_var = "MCP_BRIDGE_TOKEN"
`;
export const CODEX_DESCENDANT_FIXTURE = `# Codex config with descendant subtables for both target AND a sibling.
# Used by S12 to prove the harness treats descendant subtables of the
# target as inside the target, while descendant subtables of a SIBLING
# (filesystem.env) are correctly treated as outside.
model = "gpt-5"

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem"]

[mcp_servers.filesystem.env]
LOG_LEVEL = "info"

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp@latest"]

[mcp_servers.context7.env]
CONTEXT7_API_KEY = "\${CONTEXT7_API_KEY}"

[mcp_servers.remote-bridge]
url = "https://mcp.example.com/bridge"
`;

export const CODEX_QUOTED_KEY_FIXTURE = `# Codex config with a quoted-key MCP server name (dot in name).
# Used by S13 to prove the harness parses [mcp_servers."server.with.dot"]
# as path segments ["mcp_servers", "server.with.dot"] (not four segments
# split on the literal dot).
model = "gpt-5"

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem"]

[mcp_servers."server.with.dot"]
command = "npx"
args = ["-y", "@upstash/context7-mcp@latest"]
startup_timeout_sec = 15

[mcp_servers."server.with.dot".env]
API_KEY = "\${API_KEY}"

[mcp_servers.remote-bridge]
url = "https://mcp.example.com/bridge"
`;

export const CODEX_NON_CONTIGUOUS_FIXTURE = `# Codex config with a non-contiguous descendant layout.
# The harness uses a single contiguous line range, so when a target
# descendant ([mcp_servers.foo.env]) appears AFTER a sibling
# ([mcp_servers.bar]), the harness range stops at the sibling and the
# descendant is OUTSIDE the range. The writer (Todo 2) rejects this
# layout as unsupported-shape; the harness simply reports the descendant
# as outside the allowed mutation zone.
[mcp_servers.foo]
command = "npx"
args = ["-y", "foo-mcp"]

[mcp_servers.bar]
command = "npx"
args = ["-y", "bar-mcp"]

# This descendant appears AFTER a sibling — outside the harness range.
[mcp_servers.foo.env]
FOO_API_KEY = "\${FOO_API_KEY}"
`;
