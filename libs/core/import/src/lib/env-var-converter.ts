/**
 * Environment Variable Converter
 *
 * Converts hardcoded secrets to environment variable references.
 *
 * @module @overture/import-core/env-var-converter
 */

/**
 * Result of converting environment variables
 */
export interface EnvVarConversionResult {
  /** Converted environment object with ${VAR} references */
  converted: Record<string, string>;
  /** List of environment variable names that need to be set */
  varsToSet: string[];
  /** Mapping of var names to their detected secret types */
  detectedTypes: Record<string, string>;
}

/**
 * Secret pattern definitions
 */
const SECRET_PATTERNS = [
  // OpenAI API keys
  {
    regex: /^sk-[a-zA-Z0-9]{20,}$/,
    varName: 'OPENAI_API_KEY',
    type: 'OpenAI API Key',
  },
  // GitHub Personal Access Tokens
  {
    regex: /^ghp_[a-zA-Z0-9]{36,}$/,
    varName: 'GITHUB_TOKEN',
    type: 'GitHub Personal Access Token',
  },
  // GitHub Fine-grained tokens
  {
    regex: /^github_pat_[a-zA-Z0-9_]{82}$/,
    varName: 'GITHUB_TOKEN',
    type: 'GitHub Fine-grained Token',
  },
  // Slack Bot tokens
  {
    regex: /^xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}$/,
    varName: 'SLACK_BOT_TOKEN',
    type: 'Slack Bot Token',
  },
  // Slack User tokens
  {
    regex: /^xoxp-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}$/,
    varName: 'SLACK_TOKEN',
    type: 'Slack User Token',
  },
  // Anthropic API keys
  {
    regex: /^sk-ant-[a-zA-Z0-9-_]{95,}$/,
    varName: 'ANTHROPIC_API_KEY',
    type: 'Anthropic API Key',
  },
  // Generic API keys (fallback)
  {
    regex: /^[a-zA-Z0-9_-]{32,}$/,
    varName: 'API_KEY',
    type: 'API Key',
  },
];

/**
 * Detect if a value looks like a hardcoded secret
 */
export function isLikelySecret(value: string): boolean {
  if (!value || value.startsWith('${') || value.startsWith('{env:')) {
    return false; // Already a reference
  }

  return SECRET_PATTERNS.some((pattern) => pattern.regex.test(value));
}

/**
 * Detect the type of secret and suggest a variable name
 */
function detectSecretType(
  value: string,
): { varName: string; type: string } | null {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(value)) {
      return { varName: pattern.varName, type: pattern.type };
    }
  }
  return null;
}

/**
 * Convert hardcoded environment values to ${VAR} references
 *
 * @param env - Original environment object
 * @param mcpName - Name of the MCP (used for context in var names)
 * @returns Conversion result with converted env and vars to set
 */
export function convertToEnvVarReferences(
  env: Record<string, string> | undefined,
  mcpName: string,
): EnvVarConversionResult {
  if (!env) {
    return { converted: {}, varsToSet: [], detectedTypes: {} };
  }

  const converted: Record<string, string> = {};
  const varsToSet: string[] = [];
  const detectedTypes: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    // key is from Object.entries - always exists in env
    if (!Object.hasOwn(env, key)) continue;

    // Skip if already a reference
    if (value.startsWith('${') || value.startsWith('{env:')) {
      // eslint-disable-next-line security/detect-object-injection -- key from Object.entries(env)
      converted[key] = value;
      continue;
    }

    // Check if it looks like a secret
    if (isLikelySecret(value)) {
      const detected = detectSecretType(value);
      if (detected) {
        // Use detected var name or fallback to key name
        const varName = detected.varName || key.toUpperCase();
        // eslint-disable-next-line security/detect-object-injection -- key from Object.entries(env)
        converted[key] = `\${${varName}}`;
        varsToSet.push(varName);
        // eslint-disable-next-line security/detect-object-injection -- varName from detection/fallback
        detectedTypes[varName] = detected.type;
      } else {
        // Generic fallback
        const varName = `${mcpName.toUpperCase()}_${key.toUpperCase()}`;
        // eslint-disable-next-line security/detect-object-injection -- key from Object.entries(env)
        converted[key] = `\${${varName}}`;
        varsToSet.push(varName);
        // eslint-disable-next-line security/detect-object-injection -- varName constructed from string params
        detectedTypes[varName] = 'Secret';
      }
    } else {
      // Not a secret, keep as-is
      // eslint-disable-next-line security/detect-object-injection -- key from Object.entries(env)
      converted[key] = value;
    }
  }

  return { converted, varsToSet, detectedTypes };
}

/**
 * Convert OpenCode env syntax to Overture syntax
 * {env:VAR} → ${VAR}
 * {env:VAR:-default} → ${VAR:-default}
 */
export function convertFromOpenCodeEnv(
  env: Record<string, string> | undefined,
): Record<string, string> {
  if (!env) {
    return {};
  }

  const converted: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    // key is from Object.entries - always exists in env
    if (!Object.hasOwn(env, key)) continue;

    if (value.startsWith('{env:')) {
      // {env:VAR} or {env:VAR:-default}
      const match = value.match(/^\{env:([^}]+)\}$/);
      if (match && match[1]) {
        // eslint-disable-next-line security/detect-object-injection -- key from Object.entries(env)
        converted[key] = `\${${match[1]}}`;
      } else {
        // eslint-disable-next-line security/detect-object-injection -- key from Object.entries(env)
        converted[key] = value;
      }
    } else {
      // eslint-disable-next-line security/detect-object-injection -- key from Object.entries(env)
      converted[key] = value;
    }
  }

  return converted;
}

/**
 * Convert Overture env syntax to OpenCode syntax
 * ${VAR} → {env:VAR}
 * ${VAR:-default} → {env:VAR:-default}
 */
export function convertToOpenCodeEnv(
  env: Record<string, string> | undefined,
): Record<string, string> {
  if (!env) {
    return {};
  }

  const converted: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    // key is from Object.entries - always exists in env
    if (!Object.hasOwn(env, key)) continue;

    if (value.startsWith('${')) {
      // ${VAR} or ${VAR:-default}
      const match = value.match(/^\$\{([^}]+)\}$/);
      if (match && match[1]) {
        // eslint-disable-next-line security/detect-object-injection -- key from Object.entries(env)
        converted[key] = `{env:${match[1]}}`;
      } else {
        // eslint-disable-next-line security/detect-object-injection -- key from Object.entries(env)
        converted[key] = value;
      }
    } else {
      // eslint-disable-next-line security/detect-object-injection -- key from Object.entries(env)
      converted[key] = value;
    }
  }

  return converted;
}
