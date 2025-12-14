/**
 * Configuration Test Fixtures
 *
 * Predefined configuration objects for testing.
 * Provides realistic, complete config samples for various scenarios.
 *
 * @module lib/fixtures/config.fixtures
 */

/**
 * Valid user global configuration
 *
 * Complete configuration with all common fields populated.
 */
export const validUserConfig = {
  version: '2.0',
  clients: {
    'claude-code': {
      enabled: true,
    },
    'claude-desktop': {
      enabled: true,
    },
  },
  mcp: {
    github: {
      command: 'mcp-server-github',
      args: [],
      env: {
        GITHUB_TOKEN: '${GITHUB_TOKEN}',
      },
      transport: 'stdio' as const,
    },
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      env: {},
      transport: 'stdio' as const,
    },
  },
  sync: {
    backup: true,
    backupDir: '~/.config/overture/backups',
    backupRetention: 10,
    mergeStrategy: 'append' as const,
    autoDetectClients: true,
  },
};

/**
 * Valid project configuration
 *
 * Project-scoped configuration with project-specific MCPs.
 */
export const validProjectConfig = {
  version: '2.0',
  mcp: {
    'nx-mcp': {
      command: 'npx',
      args: ['@jander99/nx-mcp'],
      env: {},
      transport: 'stdio' as const,
    },
    'python-repl': {
      command: 'uvx',
      args: ['mcp-server-python-repl'],
      env: {},
      transport: 'stdio' as const,
    },
  },
};

/**
 * Configuration with plugins
 */
export const configWithPlugins = {
  version: '2.0',
  plugins: {
    'python-development': {
      marketplace: 'claude-code-workflows',
      enabled: true,
      mcps: ['python-repl', 'ruff'],
    },
    'kubernetes-operations': {
      marketplace: 'claude-code-workflows',
      enabled: true,
      mcps: ['kubectl'],
    },
  },
  mcp: {
    'python-repl': {
      command: 'uvx',
      args: ['mcp-server-python-repl'],
      env: {},
      transport: 'stdio' as const,
    },
    ruff: {
      command: 'uvx',
      args: ['mcp-server-ruff'],
      env: {},
      transport: 'stdio' as const,
    },
    kubectl: {
      command: 'kubectl-mcp',
      args: [],
      env: {},
      transport: 'stdio' as const,
    },
  },
};

/**
 * Configuration with client exclusions
 */
export const configWithExclusions = {
  version: '2.0',
  mcp: {
    github: {
      command: 'mcp-server-github',
      args: [],
      env: {},
      transport: 'stdio' as const,
      clients: {
        exclude: ['copilot-cli' as const],
      },
    },
  },
};

/**
 * Configuration with client includes (whitelist)
 */
export const configWithIncludes = {
  version: '2.0',
  mcp: {
    specialized: {
      command: 'specialized-server',
      args: [],
      env: {},
      transport: 'stdio' as const,
      clients: {
        include: ['claude-code' as const, 'cursor' as const],
      },
    },
  },
};

/**
 * Configuration with platform-specific overrides
 */
export const configWithPlatformOverrides = {
  version: '2.0',
  mcp: {
    'python-server': {
      command: 'python3',
      args: ['-m', 'mcp_server'],
      env: {},
      transport: 'stdio' as const,
      platforms: {
        exclude: ['win32' as const],
        commandOverrides: {
          darwin: '/usr/local/bin/python3',
          win32: 'python',
        },
      },
    },
  },
};

/**
 * Configuration with WSL2 discovery settings
 */
export const configWithWSL2 = {
  version: '2.0',
  mcp: {},
  discovery: {
    enabled: true,
    wsl2_auto_detect: true,
    wsl2: {
      windows_user_profile: '/mnt/c/Users/testuser',
      windows_binary_paths: ['/mnt/c/Program Files/Custom Apps'],
      windows_config_paths: {
        'claude-desktop': '/mnt/c/Users/testuser/AppData/Roaming/Claude/config.json',
      },
    },
  },
};

/**
 * Configuration with HTTP transport
 */
export const configWithHttpTransport = {
  version: '2.0',
  mcp: {
    'http-server': {
      command: 'http-mcp-server',
      args: ['--port', '3000'],
      env: {},
      transport: 'http' as const,
    },
  },
};

/**
 * Minimal valid configuration
 */
export const minimalConfig = {
  version: '2.0',
  mcp: {},
};

/**
 * Empty configuration (no MCPs)
 */
export const emptyConfig = {
  version: '2.0',
  mcp: {},
};

/**
 * Invalid configuration (missing required fields)
 */
export const invalidConfig = {
  version: '2.0',
  mcp: {
    broken: {
      command: 'test',
      // Missing required 'args', 'env', and 'transport' fields
    },
  },
};

/**
 * Configuration with disabled client
 */
export const configWithDisabledClient = {
  version: '2.0',
  clients: {
    'claude-code': {
      enabled: false,
    },
  },
  mcp: {
    github: {
      command: 'mcp-server-github',
      args: [],
      env: {},
      transport: 'stdio' as const,
    },
  },
};

/**
 * Configuration with custom config paths
 */
export const configWithCustomPaths = {
  version: '2.0',
  clients: {
    'claude-code': {
      enabled: true,
      configPath: '~/.custom-claude/mcp.json',
    },
  },
  mcp: {},
};

/**
 * Configuration with discovery overrides
 */
export const configWithDiscoveryOverrides = {
  version: '2.0',
  mcp: {},
  discovery: {
    enabled: true,
    timeout: 3000,
    clients: {
      codex: {
        binary_path: '~/.local/bin/codex',
      },
      'gemini-cli': {
        binary_path: '/usr/local/bin/gemini',
      },
    },
  },
};
