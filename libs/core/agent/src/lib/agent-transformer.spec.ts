import { describe, it, expect } from 'vitest';
import { AgentTransformer } from './agent-transformer.js';
import {
  AgentDefinition,
  ModelMapping,
} from '@overture/config-types';

describe('AgentTransformer', () => {
  const transformer = new AgentTransformer();

  const mockAgent: AgentDefinition = {
    config: {
      name: 'test-agent',
      description: 'A test agent',
      model: 'smart',
      tools: ['read_file', 'write_file'],
      overrides: {
        'claude-code': {
          model: 'claude-3-opus',
        },
      },
    },
    body: 'This is the system prompt.',
    scope: 'global',
    sourceDir: '/some/dir',
  };

  const mockModelMapping: ModelMapping = {
    smart: {
      'claude-code': 'claude-3-5-sonnet',
      opencode: 'anthropic/claude-3-5-sonnet-latest',
      'copilot-cli': 'gpt-4o',
    },
  };

  it('should transform for Claude Code with model override', () => {
    const { content, filename } = transformer.transform(
      mockAgent,
      'claude-code',
      mockModelMapping,
    );

    expect(filename).toBe('test-agent.md');
    expect(content).toContain('name: test-agent');
    expect(content).toContain('description: A test agent');
    expect(content).toContain('tools: read_file, write_file');
    expect(content).toContain('model: claude-3-opus');
    expect(content).toContain('permissionMode: all');
    expect(content).toContain('This is the system prompt.');
  });

  it('should transform for OpenCode with model resolution', () => {
    const { content, filename } = transformer.transform(
      mockAgent,
      'opencode',
      mockModelMapping,
    );

    expect(filename).toBe('test-agent.md');
    expect(content).toContain('description: A test agent');
    expect(content).toContain('mode: subagent');
    expect(content).toContain('model: anthropic/claude-3-5-sonnet-latest');
    expect(content).toContain('tools:');
    expect(content).toContain('  - read_file');
    expect(content).toContain('  - write_file');
    expect(content).toContain('permission:');
    expect(content).toContain('  "*": allow');
  });

  it('should transform for GitHub Copilot', () => {
    const { content, filename } = transformer.transform(
      mockAgent,
      'copilot-cli',
      mockModelMapping,
    );

    expect(filename).toBe('test-agent.agent.md');
    expect(content).toContain('name: test-agent');
    expect(content).toContain('description: A test agent');
    expect(content).toContain('tools:');
    expect(content).toContain('  - read_file');
    expect(content).toContain('  - write_file');
  });
});
