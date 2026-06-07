#!/usr/bin/env node
"use strict";

// apps/cli/src/platforms/detect.ts
var import_node_os = require("node:os");
var import_node_path = require("node:path");

// apps/cli/src/platforms/registry.ts
var platformRegistry = [
  {
    id: "claude-code",
    displayName: "Claude Code",
    installMarkers: [
      {
        id: "claude-code-1-mcp-json",
        kind: "file",
        base: "home",
        relativePath: ".claude.json",
        confidence: "high",
        reason: "Primary user-global configuration file for Claude Code"
      },
      {
        id: "claude-code-2-project-mcp-json",
        kind: "file",
        base: "workspace",
        relativePath: ".mcp.json",
        confidence: "high",
        reason: "Project-level MCP configuration file for Claude Code"
      }
    ],
    mcpLocations: [
      {
        scope: "user",
        base: "home",
        relativePath: ".claude.json",
        format: "json",
        topLevelKey: "mcpServers",
        notes: "User-global MCP servers"
      },
      {
        scope: "project",
        base: "workspace",
        relativePath: ".mcp.json",
        format: "json",
        topLevelKey: "mcpServers",
        notes: "Project-level MCP servers"
      }
    ],
    defaultConfidence: "medium"
  },
  {
    id: "claude-desktop",
    displayName: "Claude Desktop",
    installMarkers: [
      {
        id: "claude-desktop-1-macos-config",
        kind: "file",
        base: "home",
        relativePath: "Library/Application Support/Claude/claude_desktop_config.json",
        platforms: ["darwin"],
        confidence: "high",
        reason: "macOS Claude Desktop configuration file"
      },
      {
        id: "claude-desktop-2-linux-config",
        kind: "file",
        base: "config",
        relativePath: "Claude/claude_desktop_config.json",
        platforms: ["linux"],
        confidence: "high",
        reason: "Linux Claude Desktop configuration file"
      },
      {
        id: "claude-desktop-3-windows-config",
        kind: "file",
        base: "config",
        relativePath: "Claude/claude_desktop_config.json",
        platforms: ["win32"],
        confidence: "high",
        reason: "Windows Claude Desktop configuration file"
      }
    ],
    mcpLocations: [
      {
        scope: "user",
        base: "home",
        relativePath: "Library/Application Support/Claude/claude_desktop_config.json",
        platforms: ["darwin"],
        format: "json",
        topLevelKey: "mcpServers",
        notes: "macOS user-global MCP servers"
      },
      {
        scope: "user",
        base: "config",
        relativePath: "Claude/claude_desktop_config.json",
        platforms: ["linux"],
        format: "json",
        topLevelKey: "mcpServers",
        notes: "Linux user-global MCP servers"
      },
      {
        scope: "user",
        base: "config",
        relativePath: "Claude/claude_desktop_config.json",
        platforms: ["win32"],
        format: "json",
        topLevelKey: "mcpServers",
        notes: "Windows user-global MCP servers"
      }
    ],
    defaultConfidence: "high"
  },
  {
    id: "opencode",
    displayName: "OpenCode",
    installMarkers: [
      {
        id: "opencode-1-config-json",
        kind: "file",
        base: "config",
        relativePath: "opencode/opencode.json",
        confidence: "high",
        reason: "Primary OpenCode configuration file under XDG config"
      },
      {
        id: "opencode-2-home-json",
        kind: "file",
        base: "home",
        relativePath: ".opencode.json",
        confidence: "high",
        reason: "Alternative OpenCode configuration file in home directory"
      }
    ],
    mcpLocations: [
      {
        scope: "user",
        base: "config",
        relativePath: "opencode/opencode.json",
        format: "json",
        topLevelKey: "mcp",
        notes: "User-global MCP configuration under mcp key"
      },
      {
        scope: "user",
        base: "home",
        relativePath: ".opencode.json",
        format: "json",
        topLevelKey: "mcp",
        notes: "Alternative user-global MCP configuration under mcp key"
      }
    ],
    defaultConfidence: "high"
  },
  {
    id: "github-copilot-vscode",
    displayName: "GitHub Copilot in VS Code",
    installMarkers: [
      {
        id: "github-copilot-vscode-1-workspace-mcp",
        kind: "file",
        base: "workspace",
        relativePath: ".vscode/mcp.json",
        confidence: "medium",
        reason: "Workspace-level VS Code MCP configuration"
      },
      {
        id: "github-copilot-vscode-2-user-mcp",
        kind: "file",
        base: "home",
        relativePath: ".vscode/mcp.json",
        confidence: "medium",
        reason: "User-global VS Code MCP configuration"
      }
    ],
    mcpLocations: [
      {
        scope: "project",
        base: "workspace",
        relativePath: ".vscode/mcp.json",
        format: "json",
        topLevelKey: "servers",
        notes: "Workspace-level MCP servers under servers key"
      },
      {
        scope: "user",
        base: "home",
        relativePath: ".vscode/mcp.json",
        format: "json",
        topLevelKey: "servers",
        notes: "User-global MCP servers under servers key"
      }
    ],
    defaultConfidence: "medium"
  },
  {
    id: "github-copilot-cli",
    displayName: "GitHub Copilot CLI",
    installMarkers: [
      {
        id: "github-copilot-cli-1-hosts-json",
        kind: "file",
        base: "config",
        relativePath: "github-copilot/hosts.json",
        confidence: "medium",
        reason: "GitHub Copilot CLI hosts configuration"
      },
      {
        id: "github-copilot-cli-2-intellij-json",
        kind: "file",
        base: "config",
        relativePath: "github-copilot/intellij.json",
        confidence: "low",
        reason: "GitHub Copilot IntelliJ configuration (weak proxy)"
      }
    ],
    mcpLocations: [
      {
        scope: "user",
        base: "config",
        relativePath: "github-copilot/hosts.json",
        format: "json",
        topLevelKey: "servers",
        notes: "User-global MCP servers under servers key"
      }
    ],
    defaultConfidence: "medium"
  },
  {
    id: "github-copilot-cloud-agent",
    displayName: "GitHub Copilot Cloud Agent",
    installMarkers: [],
    mcpLocations: [],
    defaultConfidence: "unsupported",
    reason: "v1 filesystem-only detection cannot confirm GitHub Copilot cloud agent presence; it is repository/settings-based."
  },
  {
    id: "cursor",
    displayName: "Cursor",
    installMarkers: [
      {
        id: "cursor-1-home-mcp",
        kind: "file",
        base: "home",
        relativePath: ".cursor/mcp.json",
        confidence: "high",
        reason: "User-global Cursor MCP configuration"
      },
      {
        id: "cursor-2-project-mcp",
        kind: "file",
        base: "workspace",
        relativePath: ".cursor/mcp.json",
        confidence: "high",
        reason: "Project-level Cursor MCP configuration"
      }
    ],
    mcpLocations: [
      {
        scope: "user",
        base: "home",
        relativePath: ".cursor/mcp.json",
        format: "json",
        topLevelKey: "mcpServers",
        notes: "User-global MCP servers"
      },
      {
        scope: "project",
        base: "workspace",
        relativePath: ".cursor/mcp.json",
        format: "json",
        topLevelKey: "mcpServers",
        notes: "Project-level MCP servers"
      }
    ],
    defaultConfidence: "high"
  },
  {
    id: "windsurf",
    displayName: "Windsurf",
    installMarkers: [
      {
        id: "windsurf-1-home-mcp",
        kind: "file",
        base: "home",
        relativePath: ".codeium/windsurf/mcp_config.json",
        confidence: "high",
        reason: "User-global Windsurf MCP configuration"
      }
    ],
    mcpLocations: [
      {
        scope: "user",
        base: "home",
        relativePath: ".codeium/windsurf/mcp_config.json",
        format: "json",
        topLevelKey: "mcpServers",
        notes: "User-global MCP servers"
      }
    ],
    defaultConfidence: "high"
  },
  {
    id: "cline",
    displayName: "Cline",
    installMarkers: [
      {
        id: "cline-1-macos-global-storage",
        kind: "file",
        base: "home",
        relativePath: "Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
        platforms: ["darwin"],
        confidence: "medium",
        reason: "macOS VS Code extension global storage for Cline"
      },
      {
        id: "cline-2-linux-global-storage",
        kind: "file",
        base: "config",
        relativePath: "Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
        platforms: ["linux"],
        confidence: "medium",
        reason: "Linux VS Code extension global storage for Cline"
      },
      {
        id: "cline-3-windows-global-storage",
        kind: "file",
        base: "config",
        relativePath: "Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
        platforms: ["win32"],
        confidence: "medium",
        reason: "Windows VS Code extension global storage for Cline"
      }
    ],
    mcpLocations: [
      {
        scope: "user",
        base: "home",
        relativePath: "Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
        platforms: ["darwin"],
        format: "json",
        topLevelKey: "mcpServers",
        notes: "macOS user-global MCP servers"
      },
      {
        scope: "user",
        base: "config",
        relativePath: "Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
        platforms: ["linux"],
        format: "json",
        topLevelKey: "mcpServers",
        notes: "Linux user-global MCP servers"
      },
      {
        scope: "user",
        base: "config",
        relativePath: "Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
        platforms: ["win32"],
        format: "json",
        topLevelKey: "mcpServers",
        notes: "Windows user-global MCP servers"
      }
    ],
    defaultConfidence: "medium"
  },
  {
    id: "roo-code",
    displayName: "Roo Code",
    installMarkers: [
      {
        id: "roo-code-1-macos-global-storage",
        kind: "file",
        base: "home",
        relativePath: "Library/Application Support/Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json",
        platforms: ["darwin"],
        confidence: "medium",
        reason: "macOS VS Code extension global storage for Roo Code"
      },
      {
        id: "roo-code-2-linux-global-storage",
        kind: "file",
        base: "config",
        relativePath: "Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json",
        platforms: ["linux"],
        confidence: "medium",
        reason: "Linux VS Code extension global storage for Roo Code"
      },
      {
        id: "roo-code-3-windows-global-storage",
        kind: "file",
        base: "config",
        relativePath: "Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json",
        platforms: ["win32"],
        confidence: "medium",
        reason: "Windows VS Code extension global storage for Roo Code"
      }
    ],
    mcpLocations: [
      {
        scope: "user",
        base: "home",
        relativePath: "Library/Application Support/Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json",
        platforms: ["darwin"],
        format: "json",
        topLevelKey: "mcpServers",
        notes: "macOS user-global MCP servers"
      },
      {
        scope: "user",
        base: "config",
        relativePath: "Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json",
        platforms: ["linux"],
        format: "json",
        topLevelKey: "mcpServers",
        notes: "Linux user-global MCP servers"
      },
      {
        scope: "user",
        base: "config",
        relativePath: "Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json",
        platforms: ["win32"],
        format: "json",
        topLevelKey: "mcpServers",
        notes: "Windows user-global MCP servers"
      }
    ],
    defaultConfidence: "medium"
  },
  {
    id: "continue",
    displayName: "Continue",
    installMarkers: [
      {
        id: "continue-1-home-config",
        kind: "file",
        base: "home",
        relativePath: ".continue/config.json",
        confidence: "medium",
        reason: "User-global Continue configuration file"
      }
    ],
    mcpLocations: [
      {
        scope: "user",
        base: "home",
        relativePath: ".continue/config.json",
        format: "json",
        topLevelKey: "mcpServers",
        notes: "User-global MCP servers"
      }
    ],
    defaultConfidence: "medium"
  },
  {
    id: "zed",
    displayName: "Zed",
    installMarkers: [
      {
        id: "zed-1-home-settings",
        kind: "file",
        base: "config",
        relativePath: "zed/settings.json",
        confidence: "medium",
        reason: "User-global Zed settings file"
      }
    ],
    mcpLocations: [
      {
        scope: "user",
        base: "config",
        relativePath: "zed/settings.json",
        format: "json",
        topLevelKey: "context_servers",
        notes: "User-global context servers (Zed refers to MCP as context servers)"
      }
    ],
    defaultConfidence: "medium"
  },
  {
    id: "openai-codex",
    displayName: "OpenAI Codex",
    installMarkers: [
      {
        id: "openai-codex-1-home-config",
        kind: "file",
        base: "home",
        relativePath: ".codex/config.toml",
        confidence: "high",
        reason: "User-global OpenAI Codex configuration file"
      },
      {
        id: "openai-codex-2-project-config",
        kind: "file",
        base: "workspace",
        relativePath: ".codex/config.toml",
        confidence: "high",
        reason: "Project-level OpenAI Codex configuration file"
      }
    ],
    mcpLocations: [
      {
        scope: "user",
        base: "home",
        relativePath: ".codex/config.toml",
        format: "toml",
        topLevelKey: "mcp_servers",
        notes: "User-global MCP servers as TOML tables"
      },
      {
        scope: "project",
        base: "workspace",
        relativePath: ".codex/config.toml",
        format: "toml",
        topLevelKey: "mcp_servers",
        notes: "Project-level MCP servers as TOML tables"
      }
    ],
    defaultConfidence: "high"
  },
  {
    id: "aider",
    displayName: "Aider",
    installMarkers: [
      {
        id: "aider-1-project-config",
        kind: "file",
        base: "workspace",
        relativePath: ".aider.conf.yml",
        confidence: "low",
        reason: "Project-level Aider configuration file (weak proxy for Aider presence, not MCP client support)"
      }
    ],
    mcpLocations: [],
    defaultConfidence: "unsupported",
    reason: "aider detection in v1 is filesystem-only; a stable first-party MCP config surface is unconfirmed. Marker present (e.g., .aider.conf.yml) can be reported, but the registry must not claim install from PATH."
  }
];

// apps/cli/src/platforms/paths.ts
var import_promises = require("node:fs/promises");
function resolveMarkerPath(marker, ctx) {
  switch (marker.base) {
    case "home":
      return `${ctx.homeDir}/${marker.relativePath}`;
    case "config":
      return `${ctx.configDir}/${marker.relativePath}`;
    case "workspace":
      return `${ctx.workspaceDir}/${marker.relativePath}`;
    case "absolute":
      return marker.relativePath;
    default: {
      const _exhaustive = marker.base;
      throw new Error(`Unsupported path base: ${_exhaustive}`);
    }
  }
}
async function markerExists(marker, ctx) {
  const resolved = resolveMarkerPath(marker, ctx);
  try {
    const s = await (0, import_promises.stat)(resolved);
    switch (marker.kind) {
      case "file":
        return s.isFile();
      case "directory":
        return s.isDirectory();
      case "file-or-directory":
        return s.isFile() || s.isDirectory();
      default: {
        const _exhaustive = marker.kind;
        throw new Error(`Unsupported marker kind: ${_exhaustive}`);
      }
    }
  } catch (err) {
    if (err instanceof Error && "code" in err && (err.code === "ENOENT" || err.code === "EACCES" || err.code === "EPERM" || err.code === "ELOOP" || err.code === "ENOTDIR")) {
      return false;
    }
    throw err;
  }
}

// apps/cli/src/platforms/detect.ts
var confidenceRank = {
  high: 3,
  medium: 2,
  low: 1,
  unsupported: 0
};
function defaultPathResolutionContext() {
  const homeDir = (0, import_node_os.homedir)();
  const configDir = process.env.XDG_CONFIG_HOME ?? (0, import_node_path.join)(homeDir, ".config");
  const workspaceDir = process.cwd();
  const platform = process.platform;
  if (platform !== "linux" && platform !== "darwin" && platform !== "win32") {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return {
    homeDir,
    configDir,
    workspaceDir,
    platform
  };
}
function buildResultForEntry(entry, ctx) {
  return (async () => {
    const applicableMarkers = entry.installMarkers.filter(
      (marker) => marker.platforms === void 0 || marker.platforms.includes(ctx.platform)
    );
    const markerChecks = await Promise.all(
      applicableMarkers.map(async (marker) => ({
        marker,
        exists: await markerExists(marker, ctx),
        resolvedPath: resolveMarkerPath(marker, ctx)
      }))
    );
    const matched = markerChecks.filter((check) => check.exists);
    if (matched.length > 0) {
      const bestMatch = matched.reduce((best, current) => {
        return confidenceRank[current.marker.confidence] > confidenceRank[best.marker.confidence] ? current : best;
      });
      return {
        id: entry.id,
        displayName: entry.displayName,
        installed: true,
        confidence: bestMatch.marker.confidence,
        matchedMarkers: matched.map((m) => m.resolvedPath),
        installMarkers: entry.installMarkers,
        mcpLocations: entry.mcpLocations,
        reason: bestMatch.marker.reason
      };
    }
    if (entry.installMarkers.length === 0) {
      return {
        id: entry.id,
        displayName: entry.displayName,
        installed: false,
        confidence: "unsupported",
        matchedMarkers: [],
        installMarkers: entry.installMarkers,
        mcpLocations: entry.mcpLocations,
        reason: entry.reason
      };
    }
    if (entry.defaultConfidence === "unsupported") {
      return {
        id: entry.id,
        displayName: entry.displayName,
        installed: false,
        confidence: "unsupported",
        matchedMarkers: [],
        installMarkers: entry.installMarkers,
        mcpLocations: entry.mcpLocations,
        reason: entry.reason
      };
    }
    return {
      id: entry.id,
      displayName: entry.displayName,
      installed: false,
      confidence: entry.defaultConfidence,
      matchedMarkers: [],
      installMarkers: entry.installMarkers,
      mcpLocations: entry.mcpLocations,
      reason: entry.reason ?? "No install markers matched."
    };
  })();
}
async function detectPlatforms(ctx) {
  const settled = await Promise.allSettled(
    platformRegistry.map((entry) => buildResultForEntry(entry, ctx))
  );
  const platforms = settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    const entry = platformRegistry[index];
    return {
      id: entry.id,
      displayName: entry.displayName,
      installed: false,
      confidence: "unsupported",
      matchedMarkers: [],
      installMarkers: entry.installMarkers,
      mcpLocations: entry.mcpLocations,
      reason: result.reason instanceof Error ? result.reason.message : String(result.reason)
    };
  });
  return { platforms };
}

// apps/cli/src/cli.ts
function formatJsonOutput(output) {
  return JSON.stringify(output, null, 2) + "\n";
}
function formatHumanOutput(output) {
  const installed = output.platforms.filter((p) => p.installed);
  if (installed.length === 0) {
    return "No supported MCP-capable platforms detected.\n";
  }
  const lines = ["Detected MCP-capable platforms:"];
  for (const platform of installed) {
    const paths = platform.matchedMarkers.join(", ");
    lines.push(`  - ${platform.displayName} (${platform.confidence}) ${paths}`);
  }
  lines.push("");
  return lines.join("\n");
}
async function run(args) {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    process.stdout.write("Usage: overture detect [--json]\n");
    return 0;
  }
  if (args[0] === "detect") {
    const flags = args.slice(1);
    const unknownFlags = flags.filter((f) => f !== "--json");
    if (unknownFlags.length > 0) {
      process.stderr.write(
        `Unknown flag: ${unknownFlags[0]}
Usage: overture detect [--json]
`
      );
      return 2;
    }
    const output = await detectPlatforms(defaultPathResolutionContext());
    if (flags.includes("--json")) {
      process.stdout.write(formatJsonOutput(output));
      return 0;
    }
    process.stdout.write(formatHumanOutput(output));
    return 0;
  }
  process.stderr.write(
    `Unknown command: ${args[0]}
Usage: overture detect [--json]
`
  );
  return 2;
}

// apps/cli/src/main.ts
(async () => {
  const code = await run(process.argv.slice(2));
  process.exit(code);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
