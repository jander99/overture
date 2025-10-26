export class OvertureError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = 'OvertureError';
  }
}

export class ConfigError extends OvertureError {
  constructor(message: string, public filePath?: string) {
    super(message, 'CONFIG_ERROR', 2);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends OvertureError {
  constructor(message: string, public issues: string[] = []) {
    super(message, 'VALIDATION_ERROR', 3);
    this.name = 'ValidationError';
  }
}

export class PluginError extends OvertureError {
  constructor(message: string, public pluginName?: string) {
    super(message, 'PLUGIN_ERROR', 4);
    this.name = 'PluginError';
  }
}

export class McpError extends OvertureError {
  constructor(message: string, public mcpName?: string) {
    super(message, 'MCP_ERROR', 5);
    this.name = 'McpError';
  }
}
