/**
 * Environment Variable Converter Tests
 *
 * @module @overture/import-core/env-var-converter.spec
 */

import { describe, it, expect } from 'vitest';
import {
  isLikelySecret,
  convertToEnvVarReferences,
  convertFromOpenCodeEnv,
  convertToOpenCodeEnv,
} from './env-var-converter.js';

describe('env-var-converter', () => {
  describe('isLikelySecret', () => {
    it('should detect GitHub personal access tokens', () => {
      expect(isLikelySecret('ghp_1234567890123456789012345678901234567890')).toBe(true);
    });

    it('should detect OpenAI API keys', () => {
      expect(isLikelySecret('sk-1234567890123456789012345678901234567890')).toBe(true);
    });

    it('should detect generic long API keys', () => {
      expect(isLikelySecret('abcd1234567890123456789012345678')).toBe(true); // 32+ chars
    });

    it('should NOT detect already-converted env var references', () => {
      expect(isLikelySecret('${GITHUB_TOKEN}')).toBe(false);
      expect(isLikelySecret('{env:API_KEY}')).toBe(false);
    });

    it('should NOT detect short strings', () => {
      expect(isLikelySecret('short')).toBe(false);
      expect(isLikelySecret('api-key-123')).toBe(false);
    });

    it('should NOT detect empty strings', () => {
      expect(isLikelySecret('')).toBe(false);
    });
  });

  describe('convertToEnvVarReferences', () => {
    it('should convert GitHub tokens to ${GITHUB_TOKEN}', () => {
      const env = {
        GITHUB_TOKEN: 'ghp_1234567890123456789012345678901234567890',
      };

      const result = convertToEnvVarReferences(env, 'github');

      expect(result.converted.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
      expect(result.varsToSet).toContain('GITHUB_TOKEN');
      expect(result.detectedTypes.GITHUB_TOKEN).toBe('GitHub Personal Access Token');
    });

    it('should convert OpenAI API keys to ${OPENAI_API_KEY}', () => {
      const env = {
        OPENAI_API_KEY: 'sk-1234567890123456789012345678901234567890',
      };

      const result = convertToEnvVarReferences(env, 'openai');

      expect(result.converted.OPENAI_API_KEY).toBe('${OPENAI_API_KEY}');
      expect(result.varsToSet).toContain('OPENAI_API_KEY');
      expect(result.detectedTypes.OPENAI_API_KEY).toBe('OpenAI API Key');
    });

    it('should convert generic long secrets to ${API_KEY}', () => {
      const env = {
        BRAVE_API_KEY: 'BSA1234567890123456789012345678901234567890',
      };

      const result = convertToEnvVarReferences(env, 'brave-search');

      expect(result.converted.BRAVE_API_KEY).toBe('${API_KEY}');
      expect(result.varsToSet).toContain('API_KEY');
      expect(result.detectedTypes.API_KEY).toBe('API Key');
    });

    it('should preserve already-converted env var references', () => {
      const env = {
        TOKEN: '${GITHUB_TOKEN}',
        API_KEY: '{env:API_KEY}',
      };

      const result = convertToEnvVarReferences(env, 'test');

      expect(result.converted.TOKEN).toBe('${GITHUB_TOKEN}');
      expect(result.converted.API_KEY).toBe('{env:API_KEY}');
      expect(result.varsToSet).toHaveLength(0);
    });

    it('should keep non-secret values unchanged', () => {
      const env = {
        DATABASE_HOST: 'localhost',
        PORT: '5432',
        DEBUG: 'true',
      };

      const result = convertToEnvVarReferences(env, 'postgres');

      expect(result.converted).toEqual(env);
      expect(result.varsToSet).toHaveLength(0);
    });

    it('should handle mixed secrets and non-secrets', () => {
      const env = {
        API_KEY: 'sk-1234567890123456789012345678901234567890',
        BASE_URL: 'https://api.example.com',
        TIMEOUT: '30',
      };

      const result = convertToEnvVarReferences(env, 'api-client');

      expect(result.converted.API_KEY).toBe('${OPENAI_API_KEY}');
      expect(result.converted.BASE_URL).toBe('https://api.example.com');
      expect(result.converted.TIMEOUT).toBe('30');
      expect(result.varsToSet).toEqual(['OPENAI_API_KEY']);
    });

    it('should handle undefined env', () => {
      const result = convertToEnvVarReferences(undefined, 'test');

      expect(result).toEqual({
        converted: {},
        varsToSet: [],
        detectedTypes: {},
      });
    });

    it('should handle empty env object', () => {
      const result = convertToEnvVarReferences({}, 'test');

      expect(result).toEqual({
        converted: {},
        varsToSet: [],
        detectedTypes: {},
      });
    });
  });

  describe('convertFromOpenCodeEnv', () => {
    it('should convert {env:VAR} to ${VAR}', () => {
      const env = {
        GITHUB_TOKEN: '{env:GITHUB_TOKEN}',
        API_KEY: '{env:API_KEY}',
      };

      const result = convertFromOpenCodeEnv(env);

      expect(result.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
      expect(result.API_KEY).toBe('${API_KEY}');
    });

    it('should convert {env:VAR:-default} to ${VAR:-default}', () => {
      const env = {
        DATABASE_URL: '{env:DATABASE_URL:-postgresql://localhost:5432/dev}',
      };

      const result = convertFromOpenCodeEnv(env);

      expect(result.DATABASE_URL).toBe('${DATABASE_URL:-postgresql://localhost:5432/dev}');
    });

    it('should preserve non-OpenCode values', () => {
      const env = {
        STATIC_VALUE: 'hardcoded',
        OVERTURE_STYLE: '${SOME_VAR}',
      };

      const result = convertFromOpenCodeEnv(env);

      expect(result.STATIC_VALUE).toBe('hardcoded');
      expect(result.OVERTURE_STYLE).toBe('${SOME_VAR}');
    });

    it('should handle undefined env', () => {
      const result = convertFromOpenCodeEnv(undefined);
      expect(result).toEqual({});
    });

    it('should handle empty env object', () => {
      const result = convertFromOpenCodeEnv({});
      expect(result).toEqual({});
    });
  });

  describe('convertToOpenCodeEnv', () => {
    it('should convert ${VAR} to {env:VAR}', () => {
      const env = {
        GITHUB_TOKEN: '${GITHUB_TOKEN}',
        API_KEY: '${API_KEY}',
      };

      const result = convertToOpenCodeEnv(env);

      expect(result.GITHUB_TOKEN).toBe('{env:GITHUB_TOKEN}');
      expect(result.API_KEY).toBe('{env:API_KEY}');
    });

    it('should convert ${VAR:-default} to {env:VAR:-default}', () => {
      const env = {
        DATABASE_URL: '${DATABASE_URL:-postgresql://localhost:5432/dev}',
      };

      const result = convertToOpenCodeEnv(env);

      expect(result.DATABASE_URL).toBe('{env:DATABASE_URL:-postgresql://localhost:5432/dev}');
    });

    it('should preserve non-Overture values', () => {
      const env = {
        STATIC_VALUE: 'hardcoded',
        OPENCODE_STYLE: '{env:SOME_VAR}',
      };

      const result = convertToOpenCodeEnv(env);

      expect(result.STATIC_VALUE).toBe('hardcoded');
      expect(result.OPENCODE_STYLE).toBe('{env:SOME_VAR}');
    });

    it('should handle undefined env', () => {
      const result = convertToOpenCodeEnv(undefined);
      expect(result).toEqual({});
    });

    it('should handle empty env object', () => {
      const result = convertToOpenCodeEnv({});
      expect(result).toEqual({});
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain value through OpenCode round-trip', () => {
      const original = {
        GITHUB_TOKEN: '${GITHUB_TOKEN}',
        DATABASE_URL: '${DATABASE_URL:-postgresql://localhost:5432/dev}',
      };

      const toOpenCode = convertToOpenCodeEnv(original);
      const backToOverture = convertFromOpenCodeEnv(toOpenCode);

      expect(backToOverture).toEqual(original);
    });
  });
});
