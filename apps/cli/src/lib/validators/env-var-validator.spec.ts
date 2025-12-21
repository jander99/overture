/**
 * Environment Variable Security Validator Tests
 *
 * Comprehensive tests for the environment variable validator that detects
 * accidentally hardcoded credentials in MCP configurations.
 *
 * Test Coverage:
 * - GitHub token detection (ghp_, ghs_)
 * - PostgreSQL connection string detection
 * - MySQL/MongoDB connection string detection
 * - AWS access key detection
 * - Base64-encoded secret detection
 * - Variable reference validation (${VAR_NAME})
 * - Edge cases: Empty env, missing env, non-string values
 *
 * @see apps/cli/src/lib/validators/env-var-validator.ts
 */

import { describe, it, expect } from 'vitest';
import {
  validateEnvVarReferences,
  getFixSuggestion,
} from './env-var-validator';
import type { OvertureConfig } from '@overture/config-types';

describe('validateEnvVarReferences', () => {
  describe('valid configurations', () => {
    it('should accept variable references with ${} syntax', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: 'npx',
            args: [],
            env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should accept multiple variable references', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          postgres: {
            command: 'npx',
            args: [],
            env: {
              POSTGRES_CONNECTION_STRING: '${POSTGRES_CONNECTION_STRING}',
              POSTGRES_SSL_CERT: '${POSTGRES_SSL_CERT}',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should accept empty MCP configuration', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should accept MCP without env object', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: [],
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should accept empty env object', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          memory: {
            command: 'npx',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should accept non-sensitive string values', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          custom: {
            command: 'npx',
            args: [],
            env: {
              NODE_ENV: 'production',
              LOG_LEVEL: 'info',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('GitHub token detection', () => {
    it('should detect GitHub classic personal access token (ghp_)', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: 'npx',
            args: [],
            env: { GITHUB_TOKEN: 'ghp_1234567890abcdefghijklmnopqrstuv' },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('github');
      expect(result.issues[0]).toContain('GITHUB_TOKEN');
      expect(result.issues[0]).toContain('githubToken');
      expect(result.issues[0]).toContain('${GITHUB_TOKEN}');
    });

    it('should detect GitHub fine-grained token (ghs_)', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: 'npx',
            args: [],
            env: { GITHUB_TOKEN: 'ghs_abcdefghijklmnopqrstuvwxyz123456' },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('githubToken');
    });
  });

  describe('database connection string detection', () => {
    it('should detect PostgreSQL connection string', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          postgres: {
            command: 'npx',
            args: [],
            env: {
              POSTGRES_CONNECTION_STRING:
                'postgres://user:password@localhost:5432/db',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('postgres');
      expect(result.issues[0]).toContain('POSTGRES_CONNECTION_STRING');
      expect(result.issues[0]).toContain('postgresConnection');
    });

    it('should detect MySQL connection string', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          mysql: {
            command: 'npx',
            args: [],
            env: {
              MYSQL_URL: 'mysql://user:password@localhost:3306/db',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('mysqlConnection');
    });

    it('should detect MongoDB connection string', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          mongodb: {
            command: 'npx',
            args: [],
            env: {
              MONGODB_URI: 'mongodb://user:password@localhost:27017/db',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('mongoConnection');
    });

    it('should detect MongoDB+SRV connection string', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          mongodb: {
            command: 'npx',
            args: [],
            env: {
              MONGODB_URI: 'mongodb+srv://user:password@cluster.mongodb.net/db',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('mongoConnection');
    });
  });

  describe('AWS credentials detection', () => {
    it('should detect AWS access key', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          aws: {
            command: 'npx',
            args: [],
            env: {
              AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('awsAccessKey');
    });
  });

  describe('Bearer token detection', () => {
    it('should detect Bearer token', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          api: {
            command: 'npx',
            args: [],
            env: {
              API_TOKEN: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('bearerToken');
    });

    it('should detect bearer token (lowercase)', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          api: {
            command: 'npx',
            args: [],
            env: {
              API_TOKEN: 'bearer abc123xyz789',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
    });
  });

  describe('Base64-encoded secret detection', () => {
    it('should detect long base64-encoded string', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          custom: {
            command: 'npx',
            args: [],
            env: {
              SECRET_KEY: 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkw',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('base64Secret');
    });

    it('should not detect short strings as base64 secrets', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          custom: {
            command: 'npx',
            args: [],
            env: {
              SHORT_VALUE: 'abc123',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('multiple issues detection', () => {
    it('should detect multiple hardcoded credentials across different MCPs', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: 'npx',
            args: [],
            env: { GITHUB_TOKEN: 'ghp_1234567890abcdefghijklmnopqrstuv' },
            transport: 'stdio',
          },
          postgres: {
            command: 'npx',
            args: [],
            env: {
              POSTGRES_CONNECTION_STRING: 'postgres://user:pass@localhost/db',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(2);
      expect(result.issues[0]).toContain('github');
      expect(result.issues[1]).toContain('postgres');
    });

    it('should detect multiple credentials in same MCP', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          aws: {
            command: 'npx',
            args: [],
            env: {
              AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
              AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
            },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle null env values gracefully', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          custom: {
            command: 'npx',
            args: [],
            env: { NULL_VALUE: null as any },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle undefined env values gracefully', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          custom: {
            command: 'npx',
            args: [],
            env: { UNDEFINED_VALUE: undefined as any },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle non-string env values gracefully', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          custom: {
            command: 'npx',
            args: [],
            env: { NUMBER_VALUE: 123 as any },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle empty string env values', () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          custom: {
            command: 'npx',
            args: [],
            env: { EMPTY_VALUE: '' },
            transport: 'stdio',
          },
        },
      };

      const result = validateEnvVarReferences(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});

describe('getFixSuggestion', () => {
  it('should return empty string when no issues', () => {
    const suggestion = getFixSuggestion([]);

    expect(suggestion).toBe('');
  });

  it('should return helpful suggestion when issues exist', () => {
    const issues = [
      'WARNING: MCP "github" env.GITHUB_TOKEN appears to contain an actual credential',
    ];

    const suggestion = getFixSuggestion(issues);

    expect(suggestion).toContain('How to fix');
    expect(suggestion).toContain('${VAR_NAME}');
    expect(suggestion).toContain('export GITHUB_TOKEN');
    expect(suggestion).toContain('version control');
  });

  it('should work with multiple issues', () => {
    const issues = ['WARNING: Issue 1', 'WARNING: Issue 2', 'WARNING: Issue 3'];

    const suggestion = getFixSuggestion(issues);

    expect(suggestion).toContain('How to fix');
    expect(suggestion.length).toBeGreaterThan(0);
  });
});
