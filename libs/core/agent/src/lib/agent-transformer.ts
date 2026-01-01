import {
  AgentDefinition,
  ClientName,
  ModelMapping,
  AgentConfig,
} from '@overture/config-types';

/**
 * AgentTransformer - Transforms universal agent definitions into client-specific formats.
 *
 * This class handles:
 * 1. Merging client-specific overrides into the base agent config.
 * 2. Resolving logical model names (e.g., "smart") to client-specific model IDs.
 * 3. Generating client-specific Markdown frontmatter.
 * 4. Standardizing tool lists and permissions.
 */
export class AgentTransformer {
  /**
   * Transforms an agent definition for a specific client.
   *
   * @param definition The universal agent definition (YAML + MD)
   * @param client The target client name
   * @param modelMapping The model mapping table
   * @returns The transformed content and the relative target path
   */
  transform(
    definition: AgentDefinition,
    client: ClientName,
    modelMapping: ModelMapping,
  ): { content: string; filename: string } {
    const { config, body } = definition;

    // 1. Merge client-specific overrides
    const mergedConfig = this.mergeOverrides(config, client);

    // 2. Resolve model
    const resolvedModel = this.resolveModel(
      mergedConfig.model,
      client,
      modelMapping,
    );

    // 3. Generate frontmatter and content based on client
    switch (client) {
      case 'claude-code':
        return this.transformForClaudeCode(mergedConfig, body, resolvedModel);
      case 'opencode':
        return this.transformForOpenCode(mergedConfig, body, resolvedModel);
      case 'copilot-cli':
        return this.transformForCopilot(mergedConfig, body);
      default:
        throw new Error(`Unsupported client for agent sync: ${client}`);
    }
  }

  /**
   * Merges client-specific overrides into the base config.
   */
  private mergeOverrides(config: AgentConfig, client: ClientName): AgentConfig {
    const overrides = config.overrides?.[client];
    if (!overrides) return config;

    return {
      ...config,
      ...overrides,
      settings: {
        ...config.settings,
        ...overrides.settings,
      },
    };
  }

  /**
   * Resolves a logical model name to a client-specific model ID.
   */
  private resolveModel(
    modelName: string | undefined,
    client: ClientName,
    modelMapping: ModelMapping,
  ): string | undefined {
    if (!modelName) return undefined;

    // If it's a logical name in the mapping, resolve it
    if (modelMapping[modelName]?.[client]) {
      return modelMapping[modelName]![client];
    }

    // Otherwise return as-is (might be a direct model ID)
    return modelName;
  }

  /**
   * Transforms for Claude Code (~/.claude/agents/<name>.md)
   * Format: name, description, tools (csv), model, permissionMode
   */
  private transformForClaudeCode(
    config: AgentConfig,
    body: string,
    model?: string,
  ): { content: string; filename: string } {
    const frontmatter = [
      '---',
      `name: ${config.name}`,
      `description: ${config.description}`,
    ];

    if (config.tools && config.tools.length > 0) {
      frontmatter.push(`tools: ${config.tools.join(', ')}`);
    }

    if (model) {
      frontmatter.push(`model: ${model}`);
    }

    // Default to 'all' for now as per plan
    frontmatter.push('permissionMode: all');
    frontmatter.push('---');
    frontmatter.push('');
    frontmatter.push(body);

    return {
      content: frontmatter.join('\n'),
      filename: `${config.name}.md`,
    };
  }

  /**
   * Transforms for OpenCode (~/.config/opencode/agent/<name>.md)
   * Format: description, mode: subagent, model, tools (map), permission (granular)
   */
  private transformForOpenCode(
    config: AgentConfig,
    body: string,
    model?: string,
  ): { content: string; filename: string } {
    const frontmatter = [
      '---',
      `description: ${config.description}`,
      'mode: subagent',
    ];

    if (model) {
      frontmatter.push(`model: ${model}`);
    }

    if (config.tools && config.tools.length > 0) {
      frontmatter.push('tools:');
      // OpenCode expects tools as a map or list in YAML
      for (const tool of config.tools) {
        frontmatter.push(`  - ${tool}`);
      }
    }

    // Standardize permissions
    frontmatter.push('permission:');
    frontmatter.push('  "*": allow');

    frontmatter.push('---');
    frontmatter.push('');
    frontmatter.push(body);

    return {
      content: frontmatter.join('\n'),
      filename: `${config.name}.md`,
    };
  }

  /**
   * Transforms for GitHub Copilot (.github/agents/<name>.agent.md)
   * Format: name, description, tools (list)
   */
  private transformForCopilot(
    config: AgentConfig,
    body: string,
  ): { content: string; filename: string } {
    const frontmatter = [
      '---',
      `name: ${config.name}`,
      `description: ${config.description}`,
    ];

    if (config.tools && config.tools.length > 0) {
      frontmatter.push('tools:');
      for (const tool of config.tools) {
        frontmatter.push(`  - ${tool}`);
      }
    }

    frontmatter.push('---');
    frontmatter.push('');
    frontmatter.push(body);

    return {
      content: frontmatter.join('\n'),
      filename: `${config.name}.agent.md`,
    };
  }
}
