# MCP Configuration Format Differences Analysis

> **⚠️ DEPRECATION NOTICE**
>
> As of Overture v0.3.0 (December 2025), only **3 clients** are supported: **Claude Code**, **GitHub Copilot CLI**, and **OpenCode**.
>
> This document contains historical research for 7 additional clients (Claude Desktop, VS Code, Cursor, Windsurf, JetBrains, Codex CLI, Gemini CLI) that are **no longer supported**. The MCP format analysis for these clients is preserved for reference but is not maintained.
>
> **Last updated:** 2025-12-14 | **Status:** ARCHIVED | **Supported clients:** 3/10

**Research Date:** 2025-12-14
**Status:** Complete
**Version:** v1
**Related Documents:**

- `/home/jeff/workspaces/ai/overture/docs/multi-cli-roadmap.md`
- `/home/jeff/workspaces/ai/overture/docs/architecture.md`
- `/home/jeff/workspaces/ai/overture/apps/cli/src/adapters/`

---

## Executive Summary

This research analyzed MCP server configuration format differences across 7+ AI CLI clients to enable robust transpilation in Overture v0.3. The focus was: **"Are there CLI-specific MCP schema variations and what are the transpilation requirements for each client?"**

### Key Findings

1. **Schema Root Key Divergence** — Most clients use `mcpServers`, but VS Code and JetBrains use `servers`. This is the primary compatibility issue.

2. **Transport Support Varies** — Claude Desktop free tier supports stdio only; Claude Code supports all transports (stdio, http, sse); other clients have mixed support.

3. **Environment Variable Expansion** — Claude Code performs native expansion (`${VAR}`), while VS Code and others require Overture to pre-expand variables.

4. **Path Resolution Differences** — Windows clients require different path formats (backslashes vs forward slashes, drive letters).

5. **No Breaking Schema Differences** — Beyond root key and env var handling, MCP schema is remarkably consistent across clients.

### Impact on Overture v0.3

- **Per-Client Adapters Required** — Each client needs schema transformation logic
- **Transport Validation Needed** — Overture must warn when config uses unsupported transports
- **Env Var Strategy** — Pre-expand for VS Code/JetBrains, pass-through for Claude CLIs
- **Unified Source Format** — Overture config remains CLI-agnostic, adapters handle differences

---

## 1. MCP Schema Comparison Matrix

### 1.1 Complete Client × Field Compatibility Matrix

| Field                | Claude Code         | Claude Desktop          | VS Code          | Cursor          | Windsurf        | Copilot CLI     | JetBrains        |
| -------------------- | ------------------- | ----------------------- | ---------------- | --------------- | --------------- | --------------- | ---------------- |
| **Root Key**         | `mcpServers`        | `mcpServers`            | `servers`        | `mcpServers`    | `mcpServers`    | `mcpServers`    | `servers`        |
| **command**          | ✅ Required         | ✅ Required             | ✅ Required      | ✅ Required     | ✅ Required     | ✅ Required     | ✅ Required      |
| **args**             | ✅ Optional         | ✅ Optional             | ✅ Optional      | ✅ Optional     | ✅ Optional     | ✅ Optional     | ✅ Optional      |
| **env**              | ✅ Native expansion | ✅ Native expansion     | ⚠️ Pre-expand    | ⚠️ Pre-expand   | ⚠️ Pre-expand   | ✅ Native       | ⚠️ Pre-expand    |
| **disabled**         | ✅ Supported        | ✅ Supported            | ❌ Not supported | ✅ Supported    | ✅ Supported    | ✅ Supported    | ❌ Not supported |
| **description**      | ✅ Optional         | ✅ Optional             | ❌ Ignored       | ✅ Optional     | ✅ Optional     | ✅ Optional     | ❌ Ignored       |
| **Transport: stdio** | ✅ Full support     | ⚠️ Free: yes, Paid: yes | ✅ Full support  | ✅ Full support | ✅ Full support | ✅ Full support | ✅ Full support  |
| **Transport: http**  | ✅ Full support     | ⚠️ Free: no, Paid: yes  | ✅ Full support  | ✅ Full support | ✅ Full support | ✅ Full support | ⚠️ Limited       |
| **Transport: sse**   | ✅ Full support     | ⚠️ Free: no, Paid: yes  | ✅ Full support  | ✅ Full support | ✅ Full support | ✅ Full support | ⚠️ Limited       |

**Legend:**

- ✅ Full support
- ⚠️ Partial support or restrictions
- ❌ Not supported

### 1.2 Root Key Differences

**Most Clients (Claude Code, Claude Desktop, Cursor, Windsurf, Copilot):**

```json
{
  "mcpServers": {
    "python-repl": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-python-repl"]
    }
  }
}
```

**VS Code & JetBrains:**

```json
{
  "servers": {
    "python-repl": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-python-repl"]
    }
  }
}
```

**Overture Adapter Solution:**

```typescript
export interface ClientAdapter {
  readonly schemaRootKey: 'mcpServers' | 'servers';
}

// Claude Code adapter
export class ClaudeCodeAdapter implements ClientAdapter {
  readonly schemaRootKey = 'mcpServers' as const;
}

// VS Code adapter
export class VscodeAdapter implements ClientAdapter {
  readonly schemaRootKey = 'servers' as const;
}
```

### 1.3 Environment Variable Expansion

**Native Expansion (Claude Code, Claude Desktop, Copilot):**

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

Client performs expansion at runtime: `${GITHUB_TOKEN}` → actual token value.

**Pre-Expansion Required (VS Code, Cursor, Windsurf, JetBrains):**

```json
{
  "servers": {
    "github": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_actual_token_value_here"
      }
    }
  }
}
```

**Overture Adapter Solution:**

```typescript
export interface ClientAdapter {
  needsEnvVarExpansion(): boolean;
}

// Claude Code: native expansion
export class ClaudeCodeAdapter implements ClientAdapter {
  needsEnvVarExpansion(): boolean {
    return false; // Keep ${VAR} syntax
  }
}

// VS Code: pre-expand
export class VscodeAdapter implements ClientAdapter {
  needsEnvVarExpansion(): boolean {
    return true; // Expand to actual values
  }

  expandEnvVars(env: Record<string, string>): Record<string, string> {
    const expanded: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      expanded[key] = value.replace(/\$\{(\w+)\}/g, (_, varName) => {
        return process.env[varName] || '';
      });
    }

    return expanded;
  }
}
```

---

## 2. Transport Support Analysis

### 2.1 Transport Type Comparison

| Client             | stdio        | http            | sse             | Notes                          |
| ------------------ | ------------ | --------------- | --------------- | ------------------------------ |
| **Claude Code**    | ✅ Full      | ✅ Full         | ✅ Full         | All transports fully supported |
| **Claude Desktop** | ✅ Free+Paid | ⚠️ Paid only    | ⚠️ Paid only    | Free tier restricted to stdio  |
| **VS Code**        | ✅ Full      | ✅ Full         | ✅ Full         | Extension handles all types    |
| **Cursor**         | ✅ Full      | ✅ Full         | ✅ Full         | Forked VS Code, same support   |
| **Windsurf**       | ✅ Full      | ✅ Full         | ✅ Full         | Based on VS Code architecture  |
| **Copilot CLI**    | ✅ Full      | ✅ Full         | ✅ Full         | GitHub infrastructure          |
| **JetBrains**      | ✅ Full      | ⚠️ Experimental | ⚠️ Experimental | Plugin limitations             |

### 2.2 Transport Type Examples

**stdio (Standard Input/Output):**

```json
{
  "mcpServers": {
    "python-repl": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-python-repl"],
      "transport": "stdio"
    }
  }
}
```

**http (HTTP Server):**

```json
{
  "mcpServers": {
    "remote-api": {
      "url": "http://localhost:8080/mcp",
      "transport": "http"
    }
  }
}
```

**sse (Server-Sent Events):**

```json
{
  "mcpServers": {
    "streaming-data": {
      "url": "http://localhost:8080/sse",
      "transport": "sse"
    }
  }
}
```

### 2.3 Adapter Transport Validation

```typescript
export interface ClientAdapter {
  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean;
}

// Claude Code: All transports
export class ClaudeCodeAdapter implements ClientAdapter {
  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    return true; // All supported
  }
}

// Claude Desktop: Tier-dependent
export class ClaudeDesktopAdapter implements ClientAdapter {
  constructor(private readonly tier: 'free' | 'paid') {}

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    if (transport === 'stdio') return true;
    return this.tier === 'paid'; // http/sse only on paid
  }
}

// JetBrains: stdio only (stable)
export class JetbrainsAdapter implements ClientAdapter {
  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    return transport === 'stdio'; // Others experimental
  }
}
```

**Overture Validation:**

```typescript
export class McpConfigValidator {
  validate(config: OvertureConfig, clientType: string): ValidationResult {
    const adapter = this.registry.getAdapter(clientType);
    const errors: string[] = [];

    for (const [name, mcpConfig] of Object.entries(config.mcp)) {
      const transport = mcpConfig.transport || 'stdio';

      if (!adapter.supportsTransport(transport)) {
        errors.push(
          `MCP server "${name}" uses transport "${transport}" which is not supported by ${clientType}.\n` +
            `Supported transports: ${this.getSupportedTransports(adapter).join(', ')}`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
```

---

## 3. Path Resolution Differences

### 3.1 Platform-Specific Path Formats

**Unix/Linux/macOS (Claude Code, VS Code, most clients):**

```json
{
  "mcpServers": {
    "local-server": {
      "command": "/usr/local/bin/mcp-server",
      "args": ["--config", "/home/user/.config/mcp/config.json"]
    }
  }
}
```

**Windows (all clients, but format differs):**

```json
{
  "mcpServers": {
    "local-server": {
      "command": "C:\\Program Files\\MCP\\server.exe",
      "args": ["--config", "C:\\Users\\User\\AppData\\config.json"]
    }
  }
}
```

### 3.2 Home Directory Expansion

**Claude Code (native tilde expansion):**

```json
{
  "mcpServers": {
    "local-tool": {
      "command": "~/bin/mcp-tool"
    }
  }
}
```

**VS Code/JetBrains (requires explicit expansion):**

```json
{
  "servers": {
    "local-tool": {
      "command": "/home/username/bin/mcp-tool"
    }
  }
}
```

**Overture Adapter Solution:**

```typescript
export interface ClientAdapter {
  resolveCommand(command: string): string;
}

// Claude Code: native tilde expansion
export class ClaudeCodeAdapter implements ClientAdapter {
  resolveCommand(command: string): string {
    return command; // Keep ~ as-is, Claude Code handles it
  }
}

// VS Code: manual expansion
export class VscodeAdapter implements ClientAdapter {
  resolveCommand(command: string): string {
    if (command.startsWith('~/')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      return path.join(homeDir, command.slice(2));
    }
    return command;
  }
}
```

### 3.3 Platform Detection

```typescript
export class PlatformUtils {
  static getPlatform(): 'windows' | 'mac' | 'linux' {
    const platform = process.platform;

    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'mac';
    return 'linux';
  }

  static normalizePath(filepath: string, targetPlatform?: string): string {
    const target = targetPlatform || this.getPlatform();

    if (target === 'windows') {
      // Convert forward slashes to backslashes
      return filepath.replace(/\//g, '\\');
    } else {
      // Convert backslashes to forward slashes
      return filepath.replace(/\\/g, '/');
    }
  }

  static resolveHome(filepath: string): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';

    return filepath.replace(/^~/, homeDir);
  }
}
```

---

## 4. Existing Adapter Implementation Analysis

### 4.1 Adapter Interface

**From `apps/cli/src/adapters/client-adapter.interface.ts`:**

```typescript
export interface ClientAdapter {
  /**
   * Root key for MCP servers in config file
   * - Most clients: 'mcpServers'
   * - VS Code/JetBrains: 'servers'
   */
  readonly schemaRootKey: 'mcpServers' | 'servers';

  /**
   * Whether client performs native environment variable expansion
   * @returns false if client handles ${VAR}, true if Overture must expand
   */
  needsEnvVarExpansion(): boolean;

  /**
   * Check if client supports a specific transport type
   * @param transport - stdio, http, or sse
   */
  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean;

  /**
   * Get MCP configuration file path for this client
   * @param scope - 'project' or 'user'
   */
  getConfigPath(scope: 'project' | 'user'): string;

  /**
   * Transform generic MCP config to client-specific format
   */
  transformConfig(config: McpServerConfig): unknown;
}
```

### 4.2 Base Adapter Implementation

**From `apps/cli/src/adapters/base-client.adapter.ts`:**

```typescript
export abstract class BaseClientAdapter implements ClientAdapter {
  abstract readonly schemaRootKey: 'mcpServers' | 'servers';

  constructor(
    protected readonly filesystem: FilesystemPort,
    protected readonly environment: EnvironmentPort,
  ) {}

  needsEnvVarExpansion(): boolean {
    // Default: most clients support native expansion
    return false;
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    // Default: all transports supported
    return true;
  }

  transformConfig(config: McpServerConfig): unknown {
    const transformed: Record<string, unknown> = {
      [this.schemaRootKey]: {},
    };

    for (const [name, serverConfig] of Object.entries(config.servers)) {
      transformed[this.schemaRootKey][name] =
        this.transformServer(serverConfig);
    }

    return transformed;
  }

  protected transformServer(server: ServerConfig): unknown {
    const transformed: Record<string, unknown> = {
      command: this.resolveCommand(server.command),
    };

    if (server.args) {
      transformed.args = server.args;
    }

    if (server.env) {
      transformed.env = this.needsEnvVarExpansion()
        ? this.expandEnvVars(server.env)
        : server.env;
    }

    if (server.disabled !== undefined) {
      transformed.disabled = server.disabled;
    }

    return transformed;
  }

  protected resolveCommand(command: string): string {
    // Default: no transformation
    return command;
  }

  protected expandEnvVars(env: Record<string, string>): Record<string, string> {
    const expanded: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      expanded[key] = value.replace(/\$\{(\w+)\}/g, (_, varName) => {
        return this.environment.getVariable(varName) || '';
      });
    }

    return expanded;
  }
}
```

### 4.3 Claude Code Adapter

**From `apps/cli/src/adapters/claude-code.adapter.ts`:**

```typescript
export class ClaudeCodeAdapter extends BaseClientAdapter {
  readonly schemaRootKey = 'mcpServers' as const;

  getConfigPath(scope: 'project' | 'user'): string {
    if (scope === 'project') {
      return this.filesystem.join(process.cwd(), '.mcp.json');
    }

    // User-level: ~/.config/claude/settings.json
    const configDir =
      this.environment.getVariable('XDG_CONFIG_HOME') ||
      this.filesystem.join(this.environment.getHome(), '.config');

    return this.filesystem.join(configDir, 'claude', 'settings.json');
  }

  // Inherits default implementations:
  // - needsEnvVarExpansion(): false (native expansion)
  // - supportsTransport(): true (all transports)
  // - resolveCommand(): pass-through (no transformation)
}
```

### 4.4 VS Code Adapter

**From `apps/cli/src/adapters/vscode.adapter.ts`:**

```typescript
export class VscodeAdapter extends BaseClientAdapter {
  readonly schemaRootKey = 'servers' as const; // Different from Claude!

  needsEnvVarExpansion(): boolean {
    return true; // VS Code requires pre-expanded env vars
  }

  getConfigPath(scope: 'project' | 'user'): string {
    if (scope === 'project') {
      return this.filesystem.join(process.cwd(), '.vscode', 'mcp.json');
    }

    // User-level: depends on OS
    const platform = process.platform;
    const homeDir = this.environment.getHome();

    if (platform === 'win32') {
      return this.filesystem.join(
        this.environment.getVariable('APPDATA'),
        'Code',
        'User',
        'mcp.json',
      );
    } else if (platform === 'darwin') {
      return this.filesystem.join(
        homeDir,
        'Library',
        'Application Support',
        'Code',
        'User',
        'mcp.json',
      );
    } else {
      return this.filesystem.join(
        homeDir,
        '.config',
        'Code',
        'User',
        'mcp.json',
      );
    }
  }

  protected resolveCommand(command: string): string {
    // Expand ~ to home directory
    if (command.startsWith('~/')) {
      return this.filesystem.join(this.environment.getHome(), command.slice(2));
    }
    return command;
  }
}
```

### 4.5 Cursor Adapter

**From `apps/cli/src/adapters/cursor.adapter.ts`:**

```typescript
export class CursorAdapter extends BaseClientAdapter {
  readonly schemaRootKey = 'mcpServers' as const;

  getConfigPath(scope: 'project' | 'user'): string {
    if (scope === 'project') {
      return this.filesystem.join(process.cwd(), '.cursor', 'mcp.json');
    }

    // Similar to VS Code but different directory
    const platform = process.platform;
    const homeDir = this.environment.getHome();

    if (platform === 'win32') {
      return this.filesystem.join(
        this.environment.getVariable('APPDATA'),
        'Cursor',
        'User',
        'mcp.json',
      );
    } else if (platform === 'darwin') {
      return this.filesystem.join(
        homeDir,
        'Library',
        'Application Support',
        'Cursor',
        'User',
        'mcp.json',
      );
    } else {
      return this.filesystem.join(
        homeDir,
        '.config',
        'Cursor',
        'User',
        'mcp.json',
      );
    }
  }

  needsEnvVarExpansion(): boolean {
    return true; // Cursor requires pre-expansion like VS Code
  }
}
```

---

## 5. Adapter Registry System

### 5.1 Registry Implementation

**From `apps/cli/src/adapters/client-adapter.registry.ts`:**

```typescript
export class ClientAdapterRegistry {
  private adapters: Map<string, ClientAdapter> = new Map();

  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly environment: EnvironmentPort,
  ) {
    this.registerDefaultAdapters();
  }

  private registerDefaultAdapters(): void {
    // Register all built-in adapters
    this.register(
      'claude-code',
      new ClaudeCodeAdapter(this.filesystem, this.environment),
    );
    this.register(
      'claude-desktop',
      new ClaudeDesktopAdapter(this.filesystem, this.environment),
    );
    this.register(
      'vscode',
      new VscodeAdapter(this.filesystem, this.environment),
    );
    this.register(
      'cursor',
      new CursorAdapter(this.filesystem, this.environment),
    );
    this.register(
      'windsurf',
      new WindsurfAdapter(this.filesystem, this.environment),
    );
    this.register(
      'copilot-cli',
      new CopilotCliAdapter(this.filesystem, this.environment),
    );
    this.register(
      'jetbrains',
      new JetbrainsAdapter(this.filesystem, this.environment),
    );
  }

  register(clientType: string, adapter: ClientAdapter): void {
    this.adapters.set(clientType, adapter);
  }

  getAdapter(clientType: string): ClientAdapter {
    const adapter = this.adapters.get(clientType);

    if (!adapter) {
      throw new Error(
        `No adapter found for client type: ${clientType}\n` +
          `Available clients: ${Array.from(this.adapters.keys()).join(', ')}`,
      );
    }

    return adapter;
  }

  getSupportedClients(): string[] {
    return Array.from(this.adapters.keys());
  }

  getClientInfo(clientType: string): ClientInfo {
    const adapter = this.getAdapter(clientType);

    return {
      name: clientType,
      schemaRootKey: adapter.schemaRootKey,
      supportsTransports: {
        stdio: adapter.supportsTransport('stdio'),
        http: adapter.supportsTransport('http'),
        sse: adapter.supportsTransport('sse'),
      },
      needsEnvVarExpansion: adapter.needsEnvVarExpansion(),
      configPaths: {
        project: adapter.getConfigPath('project'),
        user: adapter.getConfigPath('user'),
      },
    };
  }
}
```

### 5.2 Usage in Config Generator

```typescript
export class McpConfigGenerator {
  constructor(private readonly registry: ClientAdapterRegistry) {}

  async generateForClient(
    config: OvertureConfig,
    clientType: string,
  ): Promise<GeneratedConfig> {
    const adapter = this.registry.getAdapter(clientType);

    // Transform Overture config to client-specific format
    const transformed = adapter.transformConfig({
      servers: config.mcp,
    });

    // Get output path
    const outputPath = adapter.getConfigPath('project');

    return {
      path: outputPath,
      content: JSON.stringify(transformed, null, 2),
    };
  }

  async generateForAllClients(
    config: OvertureConfig,
  ): Promise<GeneratedConfig[]> {
    const clients = this.registry.getSupportedClients();
    const results: GeneratedConfig[] = [];

    for (const clientType of clients) {
      results.push(await this.generateForClient(config, clientType));
    }

    return results;
  }
}
```

---

## 6. CLI-Specific Configuration Paths

### 6.1 Project-Level Paths

| Client             | Project Config Path  | Notes                       |
| ------------------ | -------------------- | --------------------------- |
| **Claude Code**    | `.mcp.json`          | Root of project             |
| **Claude Desktop** | `.mcp.json`          | Same as Claude Code         |
| **VS Code**        | `.vscode/mcp.json`   | VS Code settings directory  |
| **Cursor**         | `.cursor/mcp.json`   | Cursor settings directory   |
| **Windsurf**       | `.windsurf/mcp.json` | Windsurf settings directory |
| **Copilot CLI**    | `.github/mcp.json`   | GitHub directory convention |
| **JetBrains**      | `.idea/mcp.json`     | IntelliJ IDEA settings      |

### 6.2 User-Level Paths

**macOS:**

| Client         | User Config Path                                         |
| -------------- | -------------------------------------------------------- |
| Claude Code    | `~/Library/Application Support/Claude/settings.json`     |
| Claude Desktop | `~/Library/Application Support/Claude/settings.json`     |
| VS Code        | `~/Library/Application Support/Code/User/mcp.json`       |
| Cursor         | `~/Library/Application Support/Cursor/User/mcp.json`     |
| Windsurf       | `~/Library/Application Support/Windsurf/User/mcp.json`   |
| JetBrains      | `~/Library/Application Support/JetBrains/[IDE]/mcp.json` |

**Linux:**

| Client         | User Config Path                     |
| -------------- | ------------------------------------ |
| Claude Code    | `~/.config/claude/settings.json`     |
| Claude Desktop | `~/.config/claude/settings.json`     |
| VS Code        | `~/.config/Code/User/mcp.json`       |
| Cursor         | `~/.config/Cursor/User/mcp.json`     |
| Windsurf       | `~/.config/Windsurf/User/mcp.json`   |
| JetBrains      | `~/.config/JetBrains/[IDE]/mcp.json` |

**Windows:**

| Client         | User Config Path                     |
| -------------- | ------------------------------------ |
| Claude Code    | `%APPDATA%\Claude\settings.json`     |
| Claude Desktop | `%APPDATA%\Claude\settings.json`     |
| VS Code        | `%APPDATA%\Code\User\mcp.json`       |
| Cursor         | `%APPDATA%\Cursor\User\mcp.json`     |
| Windsurf       | `%APPDATA%\Windsurf\User\mcp.json`   |
| JetBrains      | `%APPDATA%\JetBrains\[IDE]\mcp.json` |

---

## 7. Validation & Error Handling

### 7.1 Transport Validation

```typescript
export class TransportValidator {
  validate(
    mcpConfig: McpServerConfig,
    adapter: ClientAdapter,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [name, server] of Object.entries(mcpConfig.servers)) {
      const transport = server.transport || 'stdio';

      if (!adapter.supportsTransport(transport)) {
        errors.push(
          `MCP server "${name}" uses unsupported transport "${transport}"`,
        );
      }

      // Warn about Claude Desktop free tier limitations
      if (adapter instanceof ClaudeDesktopAdapter && transport !== 'stdio') {
        warnings.push(
          `MCP server "${name}" uses transport "${transport}" which may not work on Claude Desktop free tier`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

### 7.2 Environment Variable Validation

```typescript
export class EnvironmentValidator {
  validate(
    mcpConfig: McpServerConfig,
    adapter: ClientAdapter,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [name, server] of Object.entries(mcpConfig.servers)) {
      if (!server.env) continue;

      for (const [envKey, envValue] of Object.entries(server.env)) {
        // Check if value contains ${VAR} syntax
        const hasVariableRef = /\$\{(\w+)\}/.test(envValue);

        if (hasVariableRef && adapter.needsEnvVarExpansion()) {
          // Extract variable name
          const varMatch = envValue.match(/\$\{(\w+)\}/);
          const varName = varMatch?.[1];

          // Check if variable is set
          if (varName && !process.env[varName]) {
            errors.push(
              `MCP server "${name}" references undefined environment variable: ${varName}`,
            );
          }
        }

        // Warn about security implications
        if (!hasVariableRef && envValue.length > 50) {
          warnings.push(
            `MCP server "${name}" has hardcoded value for ${envKey} (${envValue.length} chars). Consider using environment variable.`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

### 7.3 Comprehensive Validation

```typescript
export class McpConfigValidator {
  constructor(
    private readonly transportValidator: TransportValidator,
    private readonly envValidator: EnvironmentValidator,
    private readonly registry: ClientAdapterRegistry,
  ) {}

  validate(config: OvertureConfig, clientType: string): ValidationResult {
    const adapter = this.registry.getAdapter(clientType);

    // Combine all validation results
    const transportResult = this.transportValidator.validate(
      { servers: config.mcp },
      adapter,
    );

    const envResult = this.envValidator.validate(
      { servers: config.mcp },
      adapter,
    );

    return {
      valid: transportResult.valid && envResult.valid,
      errors: [...transportResult.errors, ...envResult.errors],
      warnings: [...transportResult.warnings, ...envResult.warnings],
    };
  }

  validateAllClients(config: OvertureConfig): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();

    for (const clientType of this.registry.getSupportedClients()) {
      results.set(clientType, this.validate(config, clientType));
    }

    return results;
  }
}
```

---

## 8. Implementation Recommendations

### 8.1 Testing Strategy

```typescript
describe('ClientAdapters', () => {
  describe('Schema Root Key', () => {
    it('Claude Code should use mcpServers', () => {
      const adapter = new ClaudeCodeAdapter(mockFs, mockEnv);
      expect(adapter.schemaRootKey).toBe('mcpServers');
    });

    it('VS Code should use servers', () => {
      const adapter = new VscodeAdapter(mockFs, mockEnv);
      expect(adapter.schemaRootKey).toBe('servers');
    });

    it('should transform config with correct root key', () => {
      const vscodeAdapter = new VscodeAdapter(mockFs, mockEnv);
      const config = { servers: { test: { command: 'npx' } } };
      const result = vscodeAdapter.transformConfig(config);

      expect(result).toHaveProperty('servers');
      expect(result).not.toHaveProperty('mcpServers');
    });
  });

  describe('Environment Variable Expansion', () => {
    it('Claude Code should NOT expand env vars', () => {
      const adapter = new ClaudeCodeAdapter(mockFs, mockEnv);
      expect(adapter.needsEnvVarExpansion()).toBe(false);
    });

    it('VS Code should expand env vars', () => {
      const adapter = new VscodeAdapter(mockFs, mockEnv);
      expect(adapter.needsEnvVarExpansion()).toBe(true);

      mockEnv.getVariable.mockReturnValue('test-token');
      const env = { TOKEN: '${GITHUB_TOKEN}' };
      const expanded = adapter['expandEnvVars'](env);

      expect(expanded.TOKEN).toBe('test-token');
    });
  });

  describe('Transport Support', () => {
    it('Claude Code should support all transports', () => {
      const adapter = new ClaudeCodeAdapter(mockFs, mockEnv);

      expect(adapter.supportsTransport('stdio')).toBe(true);
      expect(adapter.supportsTransport('http')).toBe(true);
      expect(adapter.supportsTransport('sse')).toBe(true);
    });

    it('JetBrains should only support stdio', () => {
      const adapter = new JetbrainsAdapter(mockFs, mockEnv);

      expect(adapter.supportsTransport('stdio')).toBe(true);
      expect(adapter.supportsTransport('http')).toBe(false);
      expect(adapter.supportsTransport('sse')).toBe(false);
    });
  });

  describe('Config Path Resolution', () => {
    it('should resolve project paths correctly', () => {
      const claudeAdapter = new ClaudeCodeAdapter(mockFs, mockEnv);
      const vscodeAdapter = new VscodeAdapter(mockFs, mockEnv);

      expect(claudeAdapter.getConfigPath('project')).toContain('.mcp.json');
      expect(vscodeAdapter.getConfigPath('project')).toContain(
        '.vscode/mcp.json',
      );
    });

    it('should resolve user paths per platform', () => {
      const adapter = new VscodeAdapter(mockFs, mockEnv);

      // Mock macOS
      process.platform = 'darwin';
      expect(adapter.getConfigPath('user')).toContain(
        'Library/Application Support',
      );

      // Mock Linux
      process.platform = 'linux';
      expect(adapter.getConfigPath('user')).toContain('.config');
    });
  });
});
```

### 8.2 CLI Commands

```bash
# Validate MCP config for specific client
overture validate --client claude-code
overture validate --client vscode

# Validate for all clients
overture validate --all-clients
# Output:
# ✓ claude-code: Valid
# ✓ claude-desktop: Valid (1 warning: http transport on free tier)
# ✓ vscode: Valid
# ✗ jetbrains: Invalid (1 error: sse transport not supported)

# Show client capabilities
overture info --client claude-code
# Output:
# Client: claude-code
# Schema Root: mcpServers
# Env Var Expansion: Native
# Transports: stdio, http, sse
# Config Paths:
#   Project: .mcp.json
#   User: ~/.config/claude/settings.json

# List all supported clients
overture clients list
```

### 8.3 Future Extensibility

**Plugin System for Custom Adapters:**

```typescript
// Custom adapter for new CLI
export class CustomCliAdapter extends BaseClientAdapter {
  readonly schemaRootKey = 'mcpServers' as const;

  // Custom implementation
}

// Register custom adapter
registry.register('custom-cli', new CustomCliAdapter(fs, env));
```

**Configuration:**

```yaml
# .overture/config.yaml
clients:
  - claude-code
  - vscode
  - custom-cli:
      adapter: ./custom-adapter.ts
      schemaRootKey: mcpServers
      envVarExpansion: true
```

---

## 9. Conclusions & Next Steps

### 9.1 Key Takeaways

1. **Schema Root Key is Main Difference** — `mcpServers` vs `servers` requires per-client transformation
2. **Env Var Expansion Split** — Claude CLIs support native, others need pre-expansion
3. **Transport Support Varies** — Validation required to prevent runtime errors
4. **Adapter Pattern Works Well** — Existing architecture scales to 7+ clients
5. **No Major Schema Breaking Changes** — Core MCP format is stable

### 9.2 Recommendations for Overture v0.3

**Priority 1: Enhance Validation**

- Add transport validation per client
- Validate env var references
- Warn about platform-specific issues

**Priority 2: Improve Error Messages**

- Detailed errors with client-specific guidance
- Suggest fixes (e.g., "Use stdio instead of http for JetBrains")
- Link to client documentation

**Priority 3: Multi-Client Testing**

- Test generated configs with real CLI binaries
- E2E tests for each adapter
- Validation test suite

### 9.3 Implementation Roadmap

**Week 1: Enhanced Validation**

- Implement `TransportValidator`
- Implement `EnvironmentValidator`
- Add comprehensive error messages

**Week 2: Testing**

- Unit tests for all adapters (>90% coverage)
- Integration tests with mock CLIs
- E2E tests with real binaries (where possible)

**Week 3: Documentation**

- Per-client compatibility guides
- Migration guides (e.g., VS Code → Claude Code)
- Troubleshooting documentation

**Week 4: Polish & Release**

- CLI command improvements
- User feedback iteration
- v0.3 release

---

**End of Research Document**

_This analysis confirms that MCP configuration format is remarkably consistent across 7+ AI CLIs, with only schema root key and environment variable expansion as major differences. Overture's adapter architecture is well-suited to handle these variations through simple per-client transformations._
