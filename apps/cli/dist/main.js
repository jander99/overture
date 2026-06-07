#!/usr/bin/env node
"use strict";

// apps/cli/src/platforms/detect.ts
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var import_promises2 = require("node:fs/promises");

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
    defaultConfidence: "medium",
    detectionStrategy: "binary-first",
    mcpSupport: "supported",
    executableNames: ["claude"]
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
    defaultConfidence: "high",
    detectionStrategy: "marker-only",
    mcpSupport: "supported",
    executableNames: []
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
    defaultConfidence: "high",
    detectionStrategy: "binary-first",
    mcpSupport: "supported",
    executableNames: ["opencode"]
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
    defaultConfidence: "medium",
    detectionStrategy: "marker-only",
    mcpSupport: "supported",
    executableNames: []
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
    defaultConfidence: "medium",
    detectionStrategy: "binary-first",
    mcpSupport: "supported",
    executableNames: ["copilot"]
  },
  {
    id: "github-copilot-cloud-agent",
    displayName: "GitHub Copilot Cloud Agent",
    installMarkers: [],
    mcpLocations: [],
    defaultConfidence: "unsupported",
    detectionStrategy: "marker-only",
    mcpSupport: "unsupported",
    executableNames: [],
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
    defaultConfidence: "high",
    detectionStrategy: "marker-only",
    mcpSupport: "supported",
    executableNames: ["cursor"]
  },
  {
    id: "windsurf",
    displayName: "Windsurf",
    installMarkers: [],
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
    defaultConfidence: "high",
    detectionStrategy: "binary-first",
    mcpSupport: "supported",
    executableNames: ["windsurf"]
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
    defaultConfidence: "medium",
    detectionStrategy: "marker-only",
    mcpSupport: "supported",
    executableNames: []
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
    defaultConfidence: "medium",
    detectionStrategy: "marker-only",
    mcpSupport: "supported",
    executableNames: []
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
    defaultConfidence: "medium",
    detectionStrategy: "marker-only",
    mcpSupport: "supported",
    executableNames: []
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
    defaultConfidence: "medium",
    detectionStrategy: "marker-only",
    mcpSupport: "supported",
    executableNames: ["zed"]
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
    defaultConfidence: "high",
    detectionStrategy: "binary-first",
    mcpSupport: "supported",
    executableNames: ["codex"]
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
    detectionStrategy: "binary-first",
    mcpSupport: "unsupported",
    executableNames: ["aider"],
    reason: "aider detection in v1 is filesystem-only; a stable first-party MCP config surface is unconfirmed. Marker present (e.g., .aider.conf.yml) can be reported, but the registry must not claim install from PATH."
  }
];

// apps/cli/src/platforms/paths.ts
var import_promises = require("node:fs/promises");
var DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD;.VBS;.JS;.WS;.MSC";
var SWALLOWED_CODES = /* @__PURE__ */ new Set([
  "ENOENT",
  "EACCES",
  "EPERM",
  "ELOOP",
  "ENOTDIR"
]);
function isSwallowed(err) {
  return err instanceof Error && "code" in err && typeof err.code === "string" && SWALLOWED_CODES.has(err.code);
}
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
    if (isSwallowed(err)) {
      return false;
    }
    throw err;
  }
}
function splitPath(pathString, platform) {
  const sep = platform === "win32" ? ";" : ":";
  return pathString.split(sep).map((d) => d.trim()).filter((d) => d.length > 0);
}
function parsePathext(pathext) {
  return pathext.split(";").map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0);
}
async function matchPosix(dir, name) {
  const candidate = `${dir}/${name}`;
  try {
    const s = await (0, import_promises.stat)(candidate);
    if (!s.isFile() || (s.mode & 73) === 0) {
      return null;
    }
    return {
      name,
      resolvedPath: await (0, import_promises.realpath)(candidate),
      source: "path"
    };
  } catch (err) {
    if (isSwallowed(err)) return null;
    throw err;
  }
}
async function matchWindows(dir, name, pathext) {
  const lowerName = name.toLowerCase();
  const exts = parsePathext(pathext);
  if (exts.length === 0) return null;
  let entries;
  try {
    entries = await (0, import_promises.readdir)(dir);
  } catch (err) {
    if (isSwallowed(err)) return null;
    throw err;
  }
  for (const entry of entries) {
    const lower = entry.toLowerCase();
    if (!lower.startsWith(lowerName)) continue;
    for (const ext of exts) {
      if (lower === `${lowerName}${ext}`) {
        return {
          name,
          resolvedPath: await (0, import_promises.realpath)(`${dir}/${entry}`),
          source: "windows"
        };
      }
    }
  }
  return null;
}
async function matchWsl(dir, name) {
  const candidates = [`${dir}/${name}`, `${dir}/${name}.exe`];
  for (const candidate of candidates) {
    try {
      const s = await (0, import_promises.stat)(candidate);
      if (s.isFile()) {
        return {
          name,
          resolvedPath: await (0, import_promises.realpath)(candidate),
          source: "wsl"
        };
      }
    } catch (err) {
      if (isSwallowed(err)) continue;
      throw err;
    }
  }
  return null;
}
var SOURCE_ORDER = {
  path: 0,
  wsl: 1,
  windows: 2
};
function compareMatches(a, b) {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
}
async function findExecutablesInPath(names, options) {
  if (names.length === 0) return [];
  if (options.pathString.length === 0) return [];
  const dirs = splitPath(options.pathString, options.platform);
  const pathext = options.pathext ?? DEFAULT_PATHEXT;
  const matches = [];
  for (const dir of dirs) {
    for (const name of names) {
      const m = options.platform === "win32" ? await matchWindows(dir, name, pathext) : await matchPosix(dir, name);
      if (m !== null) {
        matches.push(m);
      }
    }
  }
  if (options.platform === "linux" && options.wslWindowsPath !== void 0 && options.wslWindowsPath.length > 0) {
    const wslDirs = splitPath(options.wslWindowsPath, options.platform);
    for (const dir of wslDirs) {
      for (const name of names) {
        const m = await matchWsl(dir, name);
        if (m === null) continue;
        const duplicate = matches.some(
          (existing) => existing.name === m.name && existing.resolvedPath === m.resolvedPath
        );
        if (!duplicate) {
          matches.push(m);
        }
      }
    }
  }
  matches.sort(compareMatches);
  return matches;
}

// apps/cli/src/platforms/mcp-config.ts
var import_node_module = require("node:module");
var import_jsonc_parser = require("jsonc-parser");
var smolTomlCjsModule = (0, import_node_module.createRequire)(__filename)("smol-toml");
function parseToml(text) {
  return smolTomlCjsModule.parse(text);
}
function isJsonLike(format) {
  return format === "json" || format === "jsonc";
}
function isContainer(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmptyContainer(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isContainer(value)) {
    return Object.keys(value).length > 0;
  }
  return false;
}
function stripBom(contents) {
  return contents.charCodeAt(0) === 65279 ? contents.slice(1) : contents;
}
function parseMcpConfig(options) {
  const { contents, format, topLevelKey } = options;
  if (topLevelKey === "") {
    return {
      configured: false,
      parsed: false,
      parseError: "topLevelKey required"
    };
  }
  if (contents === "") {
    return { configured: false, parsed: true };
  }
  if (isJsonLike(format)) {
    const cleaned = stripBom(contents);
    const errors = [];
    let result;
    try {
      result = (0, import_jsonc_parser.parse)(cleaned, errors, {
        allowTrailingComma: true,
        disallowComments: false
      });
    } catch (err) {
      return {
        configured: false,
        parsed: false,
        parseError: err instanceof Error ? err.message : String(err)
      };
    }
    if (errors.length > 0) {
      const first = errors[0];
      const offset = first?.offset ?? 0;
      return {
        configured: false,
        parsed: false,
        parseError: `${first?.error ?? "parse error"} at offset ${offset}`
      };
    }
    if (!isContainer(result)) {
      return { configured: false, parsed: true };
    }
    const section = result[topLevelKey];
    return {
      configured: nonEmptyContainer(section),
      parsed: true
    };
  }
  if (format === "toml") {
    const cleaned = stripBom(contents);
    let result;
    try {
      result = parseToml(cleaned);
    } catch (err) {
      return {
        configured: false,
        parsed: false,
        parseError: err instanceof Error ? err.message : String(err)
      };
    }
    if (!isContainer(result)) {
      return { configured: false, parsed: true };
    }
    const section = result[topLevelKey];
    if (!isContainer(section)) {
      return { configured: false, parsed: true };
    }
    return {
      configured: Object.keys(section).length > 0,
      parsed: true
    };
  }
  return { configured: false, parsed: false, parseError: "unsupported format" };
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
function resolveMcpLocationPath(loc, ctx) {
  switch (loc.base) {
    case "home":
      return `${ctx.homeDir}/${loc.relativePath}`;
    case "config":
      return `${ctx.configDir}/${loc.relativePath}`;
    case "workspace":
      return `${ctx.workspaceDir}/${loc.relativePath}`;
    case "absolute":
      return loc.relativePath;
    default: {
      const _exhaustive = loc.base;
      throw new Error(`Unsupported path base: ${_exhaustive}`);
    }
  }
}
function platformMatches(platforms, platform) {
  return platforms === void 0 || platforms.includes(platform);
}
function locationIsApplicable(loc, ctx) {
  return platformMatches(loc.platforms, ctx.platform);
}
async function scanMcpLocation(loc, index, entry, ctx, installed, mcpSupport) {
  const id = `${entry.id}-${index}`;
  const resolvedPath = resolveMcpLocationPath(loc, ctx);
  const topLevelKey = loc.topLevelKey ?? "";
  const base = {
    id,
    resolvedPath,
    format: loc.format,
    ...topLevelKey === "" ? {} : { topLevelKey },
    nonEmpty: false
  };
  let contents;
  try {
    contents = await (0, import_promises2.readFile)(resolvedPath, "utf8");
  } catch (err) {
    if (err instanceof Error && "code" in err && typeof err.code === "string" && err.code === "ENOENT") {
      return {
        matched: [],
        orphaned: [],
        hasNonEmptyConfigured: false,
        hasParseError: false
      };
    }
    return {
      matched: [
        {
          ...base,
          parseError: `read failed: ${err instanceof Error ? err.message : String(err)}`
        }
      ],
      orphaned: [],
      hasNonEmptyConfigured: false,
      hasParseError: true
    };
  }
  const parsed = parseMcpConfig({ contents, format: loc.format, topLevelKey });
  if (!parsed.parsed) {
    return {
      matched: [
        {
          ...base,
          parseError: parsed.parseError ?? "parse error"
        }
      ],
      orphaned: [],
      hasNonEmptyConfigured: false,
      hasParseError: true
    };
  }
  if (!parsed.configured) {
    return {
      matched: [{ ...base, nonEmpty: false }],
      orphaned: [],
      hasNonEmptyConfigured: false,
      hasParseError: false
    };
  }
  const nonEmpty = true;
  if (!installed) {
    return {
      matched: [],
      orphaned: [{ ...base, nonEmpty }],
      hasNonEmptyConfigured: true,
      hasParseError: false
    };
  }
  if (mcpSupport === "supported") {
    return {
      matched: [{ ...base, nonEmpty }],
      orphaned: [],
      hasNonEmptyConfigured: true,
      hasParseError: false
    };
  }
  return {
    matched: [{ ...base, nonEmpty: false }],
    orphaned: [],
    hasNonEmptyConfigured: true,
    hasParseError: false
  };
}
function computeReasonCode(args) {
  const {
    detectionStrategy,
    installed,
    mcpSupport,
    hasNonEmptyMcp,
    hasParseError
  } = args;
  if (hasNonEmptyMcp && !installed) {
    return "orphaned-mcp-config";
  }
  if (installed && mcpSupport === "supported" && hasNonEmptyMcp) {
    return "mcp-configured";
  }
  if (installed && mcpSupport === "unsupported") {
    return "unsupported-no-mcp-client";
  }
  if (detectionStrategy === "binary-first" && installed && mcpSupport !== "unsupported") {
    return "binary-found";
  }
  if (detectionStrategy === "marker-only" && installed && mcpSupport !== "unsupported") {
    return "marker-found";
  }
  if (hasParseError && !installed && !hasNonEmptyMcp && (mcpSupport === "unsupported" || mcpSupport === "unknown")) {
    return "unsupported-no-local-signal";
  }
  if (hasParseError && !installed && !hasNonEmptyMcp) {
    return "parse-error";
  }
  if ((mcpSupport === "unsupported" || mcpSupport === "unknown") && !installed) {
    return "unsupported-no-local-signal";
  }
  return "not-detected";
}
async function buildResultForEntry(entry, ctx) {
  const pathString = process.env.PATH ?? "";
  const wslWindowsPath = process.env.WSL_WINDOWS_PATH;
  const applicableMarkers = entry.installMarkers.filter(
    (marker) => platformMatches(marker.platforms, ctx.platform)
  );
  const applicableMcpLocations = entry.mcpLocations.filter(
    (loc) => locationIsApplicable(loc, ctx)
  );
  let matchedExecutables = [];
  let installed = false;
  let confidence = entry.defaultConfidence;
  let reason = entry.reason;
  const matchedMarkerPaths = [];
  if (entry.detectionStrategy === "binary-first") {
    matchedExecutables = await findExecutablesInPath(entry.executableNames, {
      pathString,
      platform: ctx.platform,
      ...wslWindowsPath !== void 0 ? { wslWindowsPath } : {}
    });
    installed = matchedExecutables.length > 0;
    if (installed) {
      confidence = "high";
      reason = `binary ${matchedExecutables[0]?.name ?? ""} found on PATH`.trim();
    }
  } else {
    const markerChecks = await Promise.all(
      applicableMarkers.map(async (marker) => ({
        marker,
        exists: await markerExists(marker, ctx),
        resolvedPath: resolveMarkerPath(marker, ctx)
      }))
    );
    const matched = markerChecks.filter((check) => check.exists);
    if (matched.length > 0) {
      const bestMatch = matched.reduce(
        (best, current) => confidenceRank[current.marker.confidence] > confidenceRank[best.marker.confidence] ? current : best
      );
      installed = true;
      confidence = bestMatch.marker.confidence;
      reason = bestMatch.marker.reason;
      for (const m of matched) {
        matchedMarkerPaths.push(m.resolvedPath);
      }
    } else if (entry.executableNames.length > 0 && entry.detectionStrategy === "marker-only") {
      matchedExecutables = await findExecutablesInPath(entry.executableNames, {
        pathString,
        platform: ctx.platform,
        ...wslWindowsPath !== void 0 ? { wslWindowsPath } : {}
      });
    }
    if (!installed && entry.installMarkers.length === 0) {
      confidence = "unsupported";
    } else if (!installed && entry.defaultConfidence === "unsupported") {
      confidence = "unsupported";
    } else if (!installed) {
      confidence = entry.defaultConfidence;
    }
    if (!installed) {
      reason = reason ?? "No install markers matched.";
    }
  }
  const mcpScans = await Promise.all(
    applicableMcpLocations.map(
      (loc, index) => scanMcpLocation(loc, index, entry, ctx, installed, entry.mcpSupport)
    )
  );
  const matchedMcpLocations = [];
  const orphanedMcpLocations = [];
  let hasNonEmptyConfigured = false;
  let hasParseError = false;
  for (const scan of mcpScans) {
    for (const m of scan.matched) matchedMcpLocations.push(m);
    for (const o of scan.orphaned) orphanedMcpLocations.push(o);
    if (scan.hasNonEmptyConfigured) hasNonEmptyConfigured = true;
    if (scan.hasParseError) hasParseError = true;
  }
  const mcpConfigured = installed && entry.mcpSupport === "supported" && matchedMcpLocations.some((m) => m.nonEmpty);
  const reasonCode = computeReasonCode({
    detectionStrategy: entry.detectionStrategy,
    installed,
    mcpSupport: entry.mcpSupport,
    hasNonEmptyMcp: hasNonEmptyConfigured,
    hasParseError
  });
  const result = {
    id: entry.id,
    displayName: entry.displayName,
    installed,
    confidence,
    matchedMarkers: matchedMarkerPaths,
    installMarkers: entry.installMarkers,
    mcpLocations: entry.mcpLocations,
    detectionStrategy: entry.detectionStrategy,
    mcpSupport: entry.mcpSupport,
    executableNames: entry.executableNames,
    matchedExecutables,
    mcpConfigured,
    matchedMcpLocations,
    orphanedMcpLocations,
    reasonCode,
    ...reason !== void 0 ? { reason } : {}
  };
  return result;
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
    if (entry === void 0) {
      throw new Error(`Missing registry entry at index ${String(index)}`);
    }
    return buildFailedResult(entry, result.reason);
  });
  return { platforms };
}
function buildFailedResult(entry, failure) {
  const message = failure instanceof Error ? failure.message : String(failure);
  const result = {
    id: entry.id,
    displayName: entry.displayName,
    installed: false,
    confidence: "unsupported",
    matchedMarkers: [],
    installMarkers: entry.installMarkers,
    mcpLocations: entry.mcpLocations,
    detectionStrategy: entry.detectionStrategy,
    mcpSupport: entry.mcpSupport,
    executableNames: entry.executableNames,
    matchedExecutables: [],
    mcpConfigured: false,
    matchedMcpLocations: [],
    orphanedMcpLocations: [],
    reasonCode: "not-detected",
    reason: message
  };
  return result;
}

// apps/cli/src/cli.ts
function formatJsonOutput(output) {
  return JSON.stringify(output, null, 2) + "\n";
}
function formatHumanOutput(output) {
  const installed = output.platforms.filter((p) => p.installed);
  const totalOrphans = output.platforms.reduce(
    (n, p) => n + p.orphanedMcpLocations.length,
    0
  );
  if (installed.length === 0 && totalOrphans === 0) {
    return "No supported MCP-capable platforms detected.\n";
  }
  const sections = [];
  const detected = installed.filter((p) => p.mcpSupport !== "unsupported");
  if (detected.length > 0) {
    const lines = ["Detected MCP-capable platforms:"];
    for (const platform of detected) {
      let tag;
      if (platform.mcpConfigured) {
        tag = "[mcp-configured]";
      } else if (platform.mcpSupport === "unknown") {
        tag = "[unknown]";
      } else {
        tag = "[mcp-not-configured]";
      }
      lines.push(`  - ${platform.displayName} (${platform.confidence}) ${tag}`);
    }
    sections.push(lines.join("\n"));
  }
  const unsupported = installed.filter((p) => p.mcpSupport === "unsupported");
  if (unsupported.length > 0) {
    const lines = [
      "Installed tools without MCP support (inventory):"
    ];
    for (const platform of unsupported) {
      const label = platform.executableNames[0] ?? platform.id;
      lines.push(`    - ${platform.displayName} (${label})`);
    }
    sections.push(lines.join("\n"));
  }
  const orphans = [];
  for (const platform of output.platforms) {
    for (const orphan of platform.orphanedMcpLocations) {
      orphans.push({ path: orphan.resolvedPath, platformId: platform.id });
    }
  }
  if (orphans.length > 0) {
    const lines = [
      "Orphaned MCP configurations (no platform installed):"
    ];
    for (const o of orphans) {
      lines.push(`    - ${o.path} (${o.platformId})`);
    }
    sections.push(lines.join("\n"));
  }
  return sections.join("\n\n") + "\n";
}
async function run(args) {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    process.stdout.write("Usage: overture detect [--json]\n");
    return 0;
  }
  if (args[0] === "detect") {
    const flags = args.slice(1);
    if (flags.includes("--help") || flags.includes("-h")) {
      process.stdout.write("Usage: overture detect [--json]\n");
      return 0;
    }
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
