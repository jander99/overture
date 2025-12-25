/**
 * Environment Variable Expansion Tests
 *
 * Comprehensive tests for environment variable expansion utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  expandEnvVars,
  expandEnvVarsRecursive,
  expandEnvVarsInObject,
  hasEnvVars,
  extractEnvVarNames,
  validateEnvVars,
  expandEnvVarsInArgs,
} from './env-expander.js';

describe('expandEnvVars', () => {
  it('should expand a single environment variable', () => {
    const result = expandEnvVars('${HOME}/.config', { HOME: '/home/user' });
    expect(result).toBe('/home/user/.config');
  });

  it('should expand multiple environment variables', () => {
    const result = expandEnvVars('${HOME}/${USER}', {
      HOME: '/home',
      USER: 'jeff',
    });
    expect(result).toBe('/home/jeff');
  });

  it('should return empty string for undefined variable without default', () => {
    const result = expandEnvVars('${UNDEFINED_VAR}', {});
    expect(result).toBe('');
  });

  it('should use default value when variable is not set', () => {
    const result = expandEnvVars('${MISSING:-/default/path}', {});
    expect(result).toBe('/default/path');
  });

  it('should use actual value over default when variable is set', () => {
    const result = expandEnvVars('${TOKEN:-default}', {
      TOKEN: 'actual-token',
    });
    expect(result).toBe('actual-token');
  });

  it('should handle complex default values', () => {
    const result = expandEnvVars('${API_URL:-https://api.example.com/v1}', {});
    expect(result).toBe('https://api.example.com/v1');
  });

  it('should not modify strings without env vars', () => {
    const result = expandEnvVars('plain string', { HOME: '/home' });
    expect(result).toBe('plain string');
  });

  it('should handle empty strings', () => {
    const result = expandEnvVars('', { HOME: '/home' });
    expect(result).toBe('');
  });

  it('should handle multiple vars in one string with mixed defaults', () => {
    const result = expandEnvVars('${HOST:-localhost}:${PORT}', {
      PORT: '3000',
    });
    expect(result).toBe('localhost:3000');
  });

  it('should expand underscore-prefixed variables', () => {
    const result = expandEnvVars('${_PRIVATE}', { _PRIVATE: 'secret' });
    expect(result).toBe('secret');
  });

  it('should expand variables with numbers', () => {
    const result = expandEnvVars('${TOKEN_123}', { TOKEN_123: 'value123' });
    expect(result).toBe('value123');
  });

  it('should use process.env by default', () => {
    const originalHome = process.env.HOME;
    process.env.HOME = '/test/home';
    const result = expandEnvVars('${HOME}');
    expect(result).toBe('/test/home');
    process.env.HOME = originalHome;
  });
});

describe('expandEnvVarsRecursive', () => {
  it('should expand nested environment variables', () => {
    const env = {
      BASE: '/home/user',
      CONFIG: '${BASE}/.config',
    };
    const result = expandEnvVarsRecursive('${CONFIG}/overture.yml', env);
    expect(result).toBe('/home/user/.config/overture.yml');
  });

  it('should handle multiple levels of nesting', () => {
    const env = {
      A: 'a',
      B: '${A}b',
      C: '${B}c',
    };
    const result = expandEnvVarsRecursive('${C}', env);
    expect(result).toBe('abc');
  });

  it('should throw on circular references', () => {
    const env = {
      A: '${B}',
      B: '${A}',
    };
    expect(() => expandEnvVarsRecursive('${A}', env)).toThrow(
      'Circular environment variable reference',
    );
  });

  it('should respect maxDepth parameter', () => {
    const env = {
      A: '${B}',
      B: '${C}',
      C: 'value',
    };
    const result = expandEnvVarsRecursive('${A}', env, 5);
    expect(result).toBe('value');
  });

  it('should throw when maxDepth exceeded', () => {
    const env = {
      A: '${B}',
      B: '${C}',
      C: '${D}',
      D: 'value',
    };
    expect(() => expandEnvVarsRecursive('${A}', env, 2)).toThrow(
      'Circular environment variable reference',
    );
  });

  it('should stop when no more expansions needed', () => {
    const result = expandEnvVarsRecursive('plain text', {});
    expect(result).toBe('plain text');
  });
});

describe('expandEnvVarsInObject', () => {
  it('should expand env vars in object string values', () => {
    const result = expandEnvVarsInObject(
      {
        path: '${HOME}/.config',
        user: '${USER}',
      },
      { HOME: '/home/user', USER: 'jeff' },
    );
    expect(result).toEqual({
      path: '/home/user/.config',
      user: 'jeff',
    });
  });

  it('should preserve non-string values', () => {
    const result = expandEnvVarsInObject(
      {
        count: 42,
        enabled: true,
        path: '${HOME}',
      },
      { HOME: '/home' },
    );
    expect(result).toEqual({
      count: 42,
      enabled: true,
      path: '/home',
    });
  });

  it('should handle nested objects', () => {
    const result = expandEnvVarsInObject(
      {
        outer: {
          inner: '${TOKEN}',
        },
      },
      { TOKEN: 'secret' },
    );
    expect(result).toEqual({
      outer: {
        inner: 'secret',
      },
    });
  });

  it('should preserve arrays', () => {
    const result = expandEnvVarsInObject(
      {
        items: ['a', 'b', 'c'],
      },
      {},
    );
    expect(result).toEqual({
      items: ['a', 'b', 'c'],
    });
  });

  it('should handle empty objects', () => {
    const result = expandEnvVarsInObject({}, { HOME: '/home' });
    expect(result).toEqual({});
  });

  it('should handle null values', () => {
    const result = expandEnvVarsInObject(
      {
        value: null,
        path: '${HOME}',
      } as Record<string, string | null>,
      { HOME: '/home' },
    );
    expect(result).toEqual({
      value: null,
      path: '/home',
    });
  });
});

describe('hasEnvVars', () => {
  it('should return true for strings with env vars', () => {
    expect(hasEnvVars('${HOME}')).toBe(true);
    expect(hasEnvVars('${TOKEN:-default}')).toBe(true);
    expect(hasEnvVars('prefix ${VAR} suffix')).toBe(true);
  });

  it('should return false for strings without env vars', () => {
    expect(hasEnvVars('plain string')).toBe(false);
    expect(hasEnvVars('/home/user/.config')).toBe(false);
    expect(hasEnvVars('')).toBe(false);
  });

  it('should return false for invalid env var syntax', () => {
    expect(hasEnvVars('$HOME')).toBe(false); // Missing braces
    expect(hasEnvVars('${lowercase}')).toBe(false); // Lowercase not matched
    expect(hasEnvVars('${123}')).toBe(false); // Starts with number
  });
});

describe('extractEnvVarNames', () => {
  it('should extract single env var name', () => {
    const result = extractEnvVarNames('${HOME}');
    expect(result).toEqual(['HOME']);
  });

  it('should extract multiple env var names', () => {
    const result = extractEnvVarNames('${HOME}/.config/${USER}');
    expect(result).toEqual(['HOME', 'USER']);
  });

  it('should extract names from vars with defaults', () => {
    const result = extractEnvVarNames('${TOKEN:-default}');
    expect(result).toEqual(['TOKEN']);
  });

  it('should return empty array for no env vars', () => {
    const result = extractEnvVarNames('plain string');
    expect(result).toEqual([]);
  });

  it('should handle duplicate variable references', () => {
    const result = extractEnvVarNames('${HOME}${HOME}');
    expect(result).toEqual(['HOME', 'HOME']);
  });
});

describe('validateEnvVars', () => {
  it('should validate when all required vars are set', () => {
    const result = validateEnvVars('${HOME}/${USER}', {
      HOME: '/home',
      USER: 'jeff',
    });
    expect(result).toEqual({ valid: true, missing: [] });
  });

  it('should report missing vars', () => {
    const result = validateEnvVars('${HOME}/${MISSING}', { HOME: '/home' });
    expect(result).toEqual({ valid: false, missing: ['MISSING'] });
  });

  it('should not report vars with defaults as missing', () => {
    const result = validateEnvVars('${MISSING:-default}', {});
    expect(result).toEqual({ valid: true, missing: [] });
  });

  it('should report multiple missing vars', () => {
    const result = validateEnvVars('${A}${B}${C}', { B: 'value' });
    expect(result).toEqual({ valid: false, missing: ['A', 'C'] });
  });

  it('should return valid for strings without env vars', () => {
    const result = validateEnvVars('plain string', {});
    expect(result).toEqual({ valid: true, missing: [] });
  });

  it('should handle mix of missing and defaulted vars', () => {
    const result = validateEnvVars('${MISSING}${DEFAULTED:-value}', {});
    expect(result).toEqual({ valid: false, missing: ['MISSING'] });
  });
});

describe('expandEnvVarsInArgs', () => {
  it('should expand env vars in array of args', () => {
    const result = expandEnvVarsInArgs(
      ['--token', '${TOKEN}', '--home', '${HOME}'],
      {
        TOKEN: 'secret',
        HOME: '/home/user',
      },
    );
    expect(result).toEqual(['--token', 'secret', '--home', '/home/user']);
  });

  it('should handle empty array', () => {
    const result = expandEnvVarsInArgs([], { TOKEN: 'value' });
    expect(result).toEqual([]);
  });

  it('should preserve args without env vars', () => {
    const result = expandEnvVarsInArgs(['--verbose', 'true'], {});
    expect(result).toEqual(['--verbose', 'true']);
  });

  it('should handle args with defaults', () => {
    const result = expandEnvVarsInArgs(['${PORT:-8080}'], {});
    expect(result).toEqual(['8080']);
  });
});
