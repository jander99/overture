/**
 * Environment Variable Expansion Tests
 *
 * @module core/env-expander.spec
 */

import {
  expandEnvVars,
  expandEnvVarsRecursive,
  expandEnvVarsInObject,
  hasEnvVars,
  extractEnvVarNames,
  validateEnvVars,
  expandEnvVarsInArgs,
} from './env-expander';

describe('Environment Variable Expansion', () => {
  const testEnv = {
    HOME: '/home/testuser',
    USER: 'testuser',
    GITHUB_TOKEN: 'ghp_test123',
    BASE_PATH: '/opt/app',
    NESTED: '${HOME}/nested',
  };

  describe('expandEnvVars', () => {
    it('should expand simple environment variables', () => {
      const result = expandEnvVars('${HOME}/.config', testEnv);
      expect(result).toBe('/home/testuser/.config');
    });

    it('should expand multiple environment variables', () => {
      const result = expandEnvVars('${HOME}/projects/${USER}', testEnv);
      expect(result).toBe('/home/testuser/projects/testuser');
    });

    it('should handle default values for missing variables', () => {
      const result = expandEnvVars('${MISSING:-/default/path}', testEnv);
      expect(result).toBe('/default/path');
    });

    it('should use environment value over default if set', () => {
      const result = expandEnvVars('${HOME:-/default}', testEnv);
      expect(result).toBe('/home/testuser');
    });

    it('should return empty string for missing variables without default', () => {
      const result = expandEnvVars('${MISSING}', testEnv);
      expect(result).toBe('');
    });

    it('should handle strings without environment variables', () => {
      const result = expandEnvVars('/absolute/path', testEnv);
      expect(result).toBe('/absolute/path');
    });

    it('should handle empty strings', () => {
      const result = expandEnvVars('', testEnv);
      expect(result).toBe('');
    });

    it('should handle variables at start, middle, and end', () => {
      const result = expandEnvVars('${USER}/middle/${HOME}/end', testEnv);
      expect(result).toBe('testuser/middle//home/testuser/end');
    });

    it('should handle default values with special characters', () => {
      const result = expandEnvVars('${PORT:-8080}', testEnv);
      expect(result).toBe('8080');
    });

    it('should handle default values with slashes', () => {
      const result = expandEnvVars('${CONFIG_DIR:-~/.config/app}', testEnv);
      expect(result).toBe('~/.config/app');
    });

    it('should not expand partial patterns', () => {
      const result = expandEnvVars('$HOME', testEnv);
      expect(result).toBe('$HOME');
    });

    it('should not expand malformed patterns', () => {
      const result = expandEnvVars('${HOME', testEnv);
      expect(result).toBe('${HOME');
    });

    it('should handle consecutive variables', () => {
      const result = expandEnvVars('${USER}${HOME}', testEnv);
      expect(result).toBe('testuser/home/testuser');
    });
  });

  describe('expandEnvVarsRecursive', () => {
    it('should recursively expand nested variables', () => {
      const result = expandEnvVarsRecursive('${NESTED}', testEnv);
      expect(result).toBe('/home/testuser/nested');
    });

    it('should handle multiple levels of nesting', () => {
      const nestedEnv = {
        LEVEL1: '${LEVEL2}/1',
        LEVEL2: '${LEVEL3}/2',
        LEVEL3: '/base/3',
      };
      const result = expandEnvVarsRecursive('${LEVEL1}', nestedEnv);
      expect(result).toBe('/base/3/2/1');
    });

    it('should detect circular references', () => {
      const circularEnv = {
        VAR1: '${VAR2}',
        VAR2: '${VAR1}',
      };
      expect(() => {
        expandEnvVarsRecursive('${VAR1}', circularEnv);
      }).toThrow('Circular environment variable reference detected');
    });

    it('should handle non-nested variables normally', () => {
      const result = expandEnvVarsRecursive('${HOME}/.config', testEnv);
      expect(result).toBe('/home/testuser/.config');
    });

    it('should respect maxDepth parameter', () => {
      const deepEnv = {
        V1: '${V2}',
        V2: '${V3}',
        V3: '${V4}',
        V4: '${V5}',
        V5: '/value',
      };
      const result = expandEnvVarsRecursive('${V1}', deepEnv, 10);
      expect(result).toBe('/value');
    });

    it('should throw error when exceeding maxDepth', () => {
      const deepEnv = {
        V1: '${V2}',
        V2: '${V3}',
        V3: '${V4}',
      };
      expect(() => {
        expandEnvVarsRecursive('${V1}', deepEnv, 2);
      }).toThrow('Circular environment variable reference detected');
    });
  });

  describe('expandEnvVarsInObject', () => {
    it('should expand environment variables in object values', () => {
      const input = {
        token: '${GITHUB_TOKEN}',
        home: '${HOME}',
        debug: 'true',
      };
      const result = expandEnvVarsInObject(input, testEnv);
      expect(result).toEqual({
        token: 'ghp_test123',
        home: '/home/testuser',
        debug: 'true',
      });
    });

    it('should handle nested objects', () => {
      const input = {
        paths: {
          home: '${HOME}',
          user: '${USER}',
        },
        config: {
          token: '${GITHUB_TOKEN}',
        },
      };
      const result = expandEnvVarsInObject(input, testEnv);
      expect(result).toEqual({
        paths: {
          home: '/home/testuser',
          user: 'testuser',
        },
        config: {
          token: 'ghp_test123',
        },
      });
    });

    it('should preserve non-string values', () => {
      const input = {
        string: '${HOME}',
        number: 42,
        boolean: true,
        nullValue: null,
        array: ['${USER}', 'static'],
      };
      const result = expandEnvVarsInObject(input, testEnv);
      expect(result).toEqual({
        string: '/home/testuser',
        number: 42,
        boolean: true,
        nullValue: null,
        array: ['${USER}', 'static'], // Arrays are not expanded in this implementation
      });
    });

    it('should handle empty objects', () => {
      const result = expandEnvVarsInObject({}, testEnv);
      expect(result).toEqual({});
    });

    it('should not mutate original object', () => {
      const input = { path: '${HOME}' };
      const result = expandEnvVarsInObject(input, testEnv);
      expect(input.path).toBe('${HOME}');
      expect(result.path).toBe('/home/testuser');
    });
  });

  describe('hasEnvVars', () => {
    it('should detect environment variables', () => {
      expect(hasEnvVars('${HOME}/.config')).toBe(true);
      expect(hasEnvVars('${VAR:-default}')).toBe(true);
      expect(hasEnvVars('prefix ${VAR} suffix')).toBe(true);
    });

    it('should return false for strings without environment variables', () => {
      expect(hasEnvVars('/absolute/path')).toBe(false);
      expect(hasEnvVars('no variables here')).toBe(false);
      expect(hasEnvVars('')).toBe(false);
    });

    it('should not match malformed patterns', () => {
      expect(hasEnvVars('$HOME')).toBe(false);
      expect(hasEnvVars('${HOME')).toBe(false);
      expect(hasEnvVars('$HOME}')).toBe(false);
    });

    it('should match variables with underscores and numbers', () => {
      expect(hasEnvVars('${VAR_NAME_123}')).toBe(true);
      expect(hasEnvVars('${_PRIVATE}')).toBe(true);
    });

    it('should not match lowercase variables', () => {
      expect(hasEnvVars('${lowercase}')).toBe(false);
      expect(hasEnvVars('${mixedCase}')).toBe(false);
    });
  });

  describe('extractEnvVarNames', () => {
    it('should extract single variable name', () => {
      const result = extractEnvVarNames('${HOME}/.config');
      expect(result).toEqual(['HOME']);
    });

    it('should extract multiple variable names', () => {
      const result = extractEnvVarNames('${HOME}/projects/${USER}/${GITHUB_TOKEN}');
      expect(result).toEqual(['HOME', 'USER', 'GITHUB_TOKEN']);
    });

    it('should extract variable names with defaults', () => {
      const result = extractEnvVarNames('${PORT:-8080}');
      expect(result).toEqual(['PORT']);
    });

    it('should handle duplicate variables', () => {
      const result = extractEnvVarNames('${HOME}/path/${HOME}');
      expect(result).toEqual(['HOME', 'HOME']);
    });

    it('should return empty array for strings without variables', () => {
      const result = extractEnvVarNames('/absolute/path');
      expect(result).toEqual([]);
    });

    it('should handle variables with underscores and numbers', () => {
      const result = extractEnvVarNames('${VAR_NAME_123}');
      expect(result).toEqual(['VAR_NAME_123']);
    });
  });

  describe('validateEnvVars', () => {
    it('should validate that all variables are set', () => {
      const result = validateEnvVars('${HOME}/.config', testEnv);
      expect(result).toEqual({
        valid: true,
        missing: [],
      });
    });

    it('should detect missing variables', () => {
      const result = validateEnvVars('${HOME}/${MISSING}', testEnv);
      expect(result).toEqual({
        valid: false,
        missing: ['MISSING'],
      });
    });

    it('should detect multiple missing variables', () => {
      const result = validateEnvVars('${MISSING1}/${MISSING2}', testEnv);
      expect(result).toEqual({
        valid: false,
        missing: ['MISSING1', 'MISSING2'],
      });
    });

    it('should skip validation for variables with defaults', () => {
      const result = validateEnvVars('${MISSING:-/default}', testEnv);
      expect(result).toEqual({
        valid: true,
        missing: [],
      });
    });

    it('should validate mixed variables with and without defaults', () => {
      const result = validateEnvVars('${HOME}/${MISSING:-default}/${REQUIRED}', testEnv);
      expect(result).toEqual({
        valid: false,
        missing: ['REQUIRED'],
      });
    });

    it('should return valid for strings without variables', () => {
      const result = validateEnvVars('/absolute/path', testEnv);
      expect(result).toEqual({
        valid: true,
        missing: [],
      });
    });

    it('should handle empty strings', () => {
      const result = validateEnvVars('', testEnv);
      expect(result).toEqual({
        valid: true,
        missing: [],
      });
    });
  });

  describe('expandEnvVarsInArgs', () => {
    it('should expand environment variables in arguments', () => {
      const args = ['--token', '${GITHUB_TOKEN}', '--user', '${USER}'];
      const result = expandEnvVarsInArgs(args, testEnv);
      expect(result).toEqual(['--token', 'ghp_test123', '--user', 'testuser']);
    });

    it('should handle mixed args with and without variables', () => {
      const args = ['--home', '${HOME}', '--static', 'value'];
      const result = expandEnvVarsInArgs(args, testEnv);
      expect(result).toEqual(['--home', '/home/testuser', '--static', 'value']);
    });

    it('should handle empty args array', () => {
      const result = expandEnvVarsInArgs([], testEnv);
      expect(result).toEqual([]);
    });

    it('should handle args with default values', () => {
      const args = ['--port', '${PORT:-8080}'];
      const result = expandEnvVarsInArgs(args, testEnv);
      expect(result).toEqual(['--port', '8080']);
    });

    it('should not mutate original array', () => {
      const args = ['--token', '${GITHUB_TOKEN}'];
      const result = expandEnvVarsInArgs(args, testEnv);
      expect(args).toEqual(['--token', '${GITHUB_TOKEN}']);
      expect(result).toEqual(['--token', 'ghp_test123']);
    });
  });

  describe('Real-world scenarios', () => {
    it('should expand typical MCP server env config', () => {
      const mcpEnv = {
        GITHUB_TOKEN: '${GITHUB_TOKEN}',
        API_URL: '${API_URL:-https://api.github.com}',
        DEBUG: 'true',
      };
      const result = expandEnvVarsInObject(mcpEnv, testEnv);
      expect(result).toEqual({
        GITHUB_TOKEN: 'ghp_test123',
        API_URL: 'https://api.github.com',
        DEBUG: 'true',
      });
    });

    it('should handle path expansion in MCP config', () => {
      const config = {
        command: 'python',
        args: ['-m', 'mcp_server'],
        env: {
          PYTHONPATH: '${HOME}/.local/lib/python',
          CONFIG_DIR: '${HOME}/.config/app',
        },
      };
      const result = expandEnvVarsInObject(config, testEnv);
      expect(result.env).toEqual({
        PYTHONPATH: '/home/testuser/.local/lib/python',
        CONFIG_DIR: '/home/testuser/.config/app',
      });
    });

    it('should validate MCP server env requirements', () => {
      const envConfig = 'Token: ${GITHUB_TOKEN}, API: ${GITHUB_API:-https://api.github.com}';
      const validation = validateEnvVars(envConfig, testEnv);
      expect(validation.valid).toBe(true);

      const missingValidation = validateEnvVars('${REQUIRED_TOKEN}', testEnv);
      expect(missingValidation.valid).toBe(false);
      expect(missingValidation.missing).toContain('REQUIRED_TOKEN');
    });
  });
});
