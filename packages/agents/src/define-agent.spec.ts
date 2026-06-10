import { describe, expect, it } from 'vitest';
import { defineAgent, notImplementedMcpHandlers } from './define-agent.js';

describe('defineAgent', () => {
  const base = {
    id: 'test-agent' as const,
    displayName: 'Test Agent',
    installMarkers: [],
    mcpLocations: [],
    defaultConfidence: 'high' as const,
    detectionStrategy: 'marker-only' as const,
    mcpSupport: 'supported' as const,
    executableNames: ['test'],
  };

  it('fills in default read and write handlers', () => {
    const agent = defineAgent({ ...base, id: 'aider' });
    expect(typeof agent.mcp.read).toBe('function');
    expect(typeof agent.mcp.write).toBe('function');
  });

  it('default write handler rejects with the canonical error text', async () => {
    const agent = defineAgent({ ...base, id: 'aider' });
    await expect(
      agent.mcp.write(
        { homeDir: '', configDir: '', workspaceDir: '', platform: 'linux' },
        { servers: [] },
      ),
    ).rejects.toThrow("MCP write for agent 'aider' is not implemented yet");
  });

  it('preserves caller-provided parseServers', () => {
    const parseServers = () => [];
    const agent = defineAgent({
      ...base,
      id: 'aider',
      mcp: {
        read: () => Promise.resolve({ config: null, nonEmpty: false }),
        parseServers,
      },
    });
    expect(agent.mcp.parseServers).toBe(parseServers);
  });

  it('preserves notImplementedMcpHandlers for unsupported agents', async () => {
    const agent = defineAgent({
      ...base,
      id: 'aider',
      mcpSupport: 'unsupported',
      mcp: notImplementedMcpHandlers('aider'),
    });
    await expect(
      agent.mcp.read({
        homeDir: '',
        configDir: '',
        workspaceDir: '',
        platform: 'linux',
      }),
    ).rejects.toThrow("MCP read for agent 'aider' is not implemented yet");
    await expect(
      agent.mcp.write(
        { homeDir: '', configDir: '', workspaceDir: '', platform: 'linux' },
        { servers: [] },
      ),
    ).rejects.toThrow("MCP write for agent 'aider' is not implemented yet");
  });
});
