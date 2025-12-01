export class OvertureError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = 'OvertureError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      exitCode: this.exitCode,
      stack: this.stack,
    };
  }
}

export class ConfigError extends OvertureError {
  constructor(message: string, public filePath?: string) {
    super(message, 'CONFIG_ERROR', 2);
    this.name = 'ConfigError';
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      filePath: this.filePath,
    };
  }
}

export class ValidationError extends OvertureError {
  constructor(message: string, public issues: string[] = []) {
    super(message, 'VALIDATION_ERROR', 3);
    this.name = 'ValidationError';
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      issues: this.issues,
    };
  }
}

export class PluginError extends OvertureError {
  constructor(message: string, public pluginName?: string) {
    super(message, 'PLUGIN_ERROR', 4);
    this.name = 'PluginError';
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      pluginName: this.pluginName,
    };
  }
}

export class McpError extends OvertureError {
  constructor(message: string, public mcpName?: string) {
    super(message, 'MCP_ERROR', 5);
    this.name = 'McpError';
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      mcpName: this.mcpName,
    };
  }
}
