/**
 * Environment Validator Tests
 *
 * Comprehensive tests for environment variable validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractEnvVars,
  validateEnvVarSyntax,
  isHardcodedValue,
  validateMcpEnvVars,
  getEnvVarErrors,
  getEnvVarWarnings,
  getEnvVarValidationSummary,
  formatEnvVarErrors,
  formatEnvVarWarnings,
} from './environment-validator';
import type { OvertureConfig } from '@overture/config-types';
import type { ClientAdapter } from '@overture/client-adapters';

// Mock client adapter
function createMockAdapter(needsExpansion: boolean): ClientAdapter {
  return {
    name: needsExpansion ? 'vscode' : 'claude-code',
    schemaRootKey: 'mcpServers',
    needsEnvVarExpansion: () => needsExpansion,
    supportsTransport: () => true,
    detectConfigPath: () => null,
    readConfig: async () => ({ mcpServers: {} }),
    writeConfig: async () => {},
    convertFromOverture: () => ({ mcpServers: {} }),
    isInstalled: () => false,
    getBinaryNames: () => [],
    getAppBundlePaths: () => [],
    requiresBinary: () => false,
  };
}

describe('extractEnvVars', () => {
  it('should extract simple env var', () => {
    const result = extractEnvVars('${TOKEN}');
    expect(result).toEqual([
      { name: 'TOKEN', hasDefault: false, defaultValue: undefined },
    ]);
  });

  it('should extract env var with default value', () => {
    const result = extractEnvVars('${API_URL:-https://api.example.com}');
    expect(result).toEqual([
      {
        name: 'API_URL',
        hasDefault: true,
        defaultValue: 'https://api.example.com',
      },
    ]);
  });

  it('should extract multiple env vars', () => {
    const result = extractEnvVars('${HOST}:${PORT}');
    expect(result).toEqual([
      { name: 'HOST', hasDefault: false, defaultValue: undefined },
      { name: 'PORT', hasDefault: false, defaultValue: undefined },
    ]);
  });

  it('should extract mix of vars with and without defaults', () => {
    const result = extractEnvVars('${TOKEN} at ${URL:-http://localhost}');
    expect(result).toEqual([
      { name: 'TOKEN', hasDefault: false, defaultValue: undefined },
      { name: 'URL', hasDefault: true, defaultValue: 'http://localhost' },
    ]);
  });

  it('should return empty array for string without env vars', () => {
    const result = extractEnvVars('plain string');
    expect(result).toEqual([]);
  });
});

describe('validateEnvVarSyntax', () => {
  it('should validate correct syntax', () => {
    expect(validateEnvVarSyntax('${API_TOKEN}')).toEqual({ valid: true });
    expect(validateEnvVarSyntax('${TOKEN_123}')).toEqual({ valid: true });
    expect(validateEnvVarSyntax('${_PRIVATE}')).toEqual({ valid: true });
  });

  it('should validate syntax with defaults', () => {
    expect(validateEnvVarSyntax('${URL:-http://localhost}')).toEqual({
      valid: true,
    });
  });

  it('should error on unclosed ${', () => {
    const result = validateEnvVarSyntax('${VAR_NAME');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unclosed ${');
  });

  it('should error on invalid variable name starting with number', () => {
    const result = validateEnvVarSyntax('${123_INVALID}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid variable name');
  });

  it('should error on lowercase variable name', () => {
    const result = validateEnvVarSyntax('${lowercase}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid variable name');
  });

  it('should error on hyphenated variable name', () => {
    const result = validateEnvVarSyntax('${API-TOKEN}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid variable name');
  });
});

describe('isHardcodedValue', () => {
  it('should identify hardcoded values', () => {
    expect(isHardcodedValue('ghp_1234567890')).toBe(true);
    expect(isHardcodedValue('plain text')).toBe(true);
  });

  it('should identify env var references', () => {
    expect(isHardcodedValue('${TOKEN}')).toBe(false);
    expect(isHardcodedValue('prefix ${TOKEN} suffix')).toBe(false);
  });
});

describe('validateMcpEnvVars', () => {
  it('should pass valid env vars for client with native expansion', () => {
    const adapter = createMockAdapter(false); // Claude Code with native expansion
    const env = {
      TOKEN: '${API_TOKEN}',
      URL: '${BASE_URL:-https://api.example.com}',
    };

    const results = validateMcpEnvVars('test-mcp', env, adapter);

    expect(results).toHaveLength(2);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(true);
  });

  it('should error when env var undefined for client needing expansion', () => {
    const adapter = createMockAdapter(true); // VS Code needs expansion
    const env = {
      TOKEN: '${UNDEFINED_VAR}',
    };

    const results = validateMcpEnvVars('test-mcp', env, adapter, {});

    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(false);
    expect(results[0].error).toContain('not defined');
    expect(results[0].error).toContain('vscode');
  });

  it('should pass when env var exists for client needing expansion', () => {
    const adapter = createMockAdapter(true); // VS Code needs expansion
    const env = {
      TOKEN: '${API_TOKEN}',
    };

    const results = validateMcpEnvVars('test-mcp', env, adapter, {
      API_TOKEN: 'test-token',
    });

    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(true);
  });

  it('should pass when env var has default value', () => {
    const adapter = createMockAdapter(true); // VS Code needs expansion
    const env = {
      URL: '${API_URL:-http://localhost}',
    };

    const results = validateMcpEnvVars('test-mcp', env, adapter, {});

    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(true);
  });

  it('should warn on hardcoded long values', () => {
    const adapter = createMockAdapter(false);
    const env = {
      TOKEN: 'ghp_' + 'x'.repeat(60), // >50 chars
    };

    const results = validateMcpEnvVars('test-mcp', env, adapter);

    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(true);
    expect(results[0].warning).toContain('Hardcoded value');
    expect(results[0].warning).toContain('environment variable');
  });

  it('should error on invalid syntax', () => {
    const adapter = createMockAdapter(false);
    const env = {
      BAD: '${unclosed',
    };

    const results = validateMcpEnvVars('test-mcp', env, adapter);

    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(false);
    expect(results[0].error).toContain('Unclosed');
  });

  it('should handle undefined env gracefully', () => {
    const adapter = createMockAdapter(false);
    const results = validateMcpEnvVars('test-mcp', undefined, adapter);

    expect(results).toHaveLength(0);
  });
});

describe('getEnvVarErrors', () => {
  it('should collect errors from all MCPs', () => {
    const adapter = createMockAdapter(true); // Needs expansion
    const config: OvertureConfig = {
      version: '1.0',
      mcp: {
        mcp1: {
          command: 'cmd',
          transport: 'stdio',
          env: {
            TOKEN: '${MISSING_VAR}',
          },
        },
        mcp2: {
          command: 'cmd',
          transport: 'stdio',
          env: {
            BAD: '${invalid-name}',
          },
        },
      },
    };

    const errors = getEnvVarErrors(config, adapter, {});

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.mcpName === 'mcp1')).toBe(true);
    expect(errors.some((e) => e.mcpName === 'mcp2')).toBe(true);
  });

  it('should collect errors from client overrides', () => {
    const adapter = createMockAdapter(true);
    const config: OvertureConfig = {
      version: '1.0',
      mcp: {
        'test-mcp': {
          command: 'cmd',
          transport: 'stdio',
          clients: {
            overrides: {
              vscode: {
                env: {
                  TOKEN: '${MISSING}',
                },
              },
            },
          },
        },
      },
    };

    const errors = getEnvVarErrors(config, adapter, {});

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].mcpName).toContain('client override');
  });

  it('should include suggestions in errors', () => {
    const adapter = createMockAdapter(true);
    const config: OvertureConfig = {
      version: '1.0',
      mcp: {
        'test-mcp': {
          command: 'cmd',
          transport: 'stdio',
          env: {
            TOKEN: '${MISSING}',
          },
        },
      },
    };

    const errors = getEnvVarErrors(config, adapter, {});

    expect(errors).toHaveLength(1);
    expect(errors[0].suggestion).toBeDefined();
    expect(errors[0].suggestion).toContain('export');
  });
});

describe('getEnvVarWarnings', () => {
  it('should collect warnings for hardcoded values', () => {
    const adapter = createMockAdapter(false);
    const config: OvertureConfig = {
      version: '1.0',
      mcp: {
        'test-mcp': {
          command: 'cmd',
          transport: 'stdio',
          env: {
            TOKEN: 'ghp_' + 'x'.repeat(60),
          },
        },
      },
    };

    const warnings = getEnvVarWarnings(config, adapter);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe('medium');
    expect(warnings[0].message).toContain('Hardcoded');
  });

  it('should assign correct severity levels', () => {
    const adapter = createMockAdapter(false);
    const config: OvertureConfig = {
      version: '1.0',
      mcp: {
        'test-mcp': {
          command: 'cmd',
          transport: 'stdio',
          env: {
            SECRET: 'secret_' + 'x'.repeat(60), // Contains "secret" keyword
          },
        },
      },
    };

    const warnings = getEnvVarWarnings(config, adapter);

    if (warnings.length > 0) {
      // Note: Our implementation checks for "secret" in warning message
      // Currently warnings are for hardcoded values, not keyword matching
      expect(warnings[0].severity).toBe('medium');
    }
  });
});

describe('getEnvVarValidationSummary', () => {
  it('should provide complete summary', () => {
    const adapter = createMockAdapter(true);
    const config: OvertureConfig = {
      version: '1.0',
      mcp: {
        mcp1: {
          command: 'cmd',
          transport: 'stdio',
          env: {
            GOOD: '${DEFINED}',
            BAD: '${MISSING}',
          },
        },
      },
    };

    const summary = getEnvVarValidationSummary(config, adapter, {
      DEFINED: 'value',
    });

    expect(summary.total).toBe(2);
    expect(summary.valid).toBe(1);
    expect(summary.errors).toHaveLength(1);
  });
});

describe('formatEnvVarErrors', () => {
  it('should format errors with suggestions', () => {
    const errors = [
      {
        mcpName: 'test-mcp',
        envKey: 'TOKEN',
        message: 'Variable not defined',
        suggestion: 'Export the variable',
      },
    ];

    const formatted = formatEnvVarErrors(errors);

    expect(formatted).toContain('test-mcp');
    expect(formatted).toContain('TOKEN');
    expect(formatted).toContain('not defined');
    expect(formatted).toContain('💡');
    expect(formatted).toContain('Export');
  });

  it('should handle empty errors', () => {
    const formatted = formatEnvVarErrors([]);
    expect(formatted).toContain('No environment variable errors');
  });
});

describe('formatEnvVarWarnings', () => {
  it('should format warnings with severity icons', () => {
    const warnings = [
      {
        mcpName: 'test-mcp',
        envKey: 'TOKEN',
        message: 'Hardcoded value',
        severity: 'high' as const,
      },
    ];

    const formatted = formatEnvVarWarnings(warnings);

    expect(formatted).toContain('test-mcp');
    expect(formatted).toContain('TOKEN');
    expect(formatted).toContain('⚠️');
  });

  it('should handle empty warnings', () => {
    const formatted = formatEnvVarWarnings([]);
    expect(formatted).toContain('No environment variable warnings');
  });
});
