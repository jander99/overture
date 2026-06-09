import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run, formatHumanOutput, formatJsonOutput } from './cli.js';
import type {
  DetectJsonOutput,
  PlatformDetectionResult,
} from './platforms/types.js';

describe('run', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('returns 0 and prints usage for empty args', async () => {
    const code = await run([]);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: overture detect [--json]'),
    );
  });

  it('returns 0 and prints usage for help', async () => {
    const code = await run(['help']);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: overture detect [--json]'),
    );
  });

  it('returns 0 and prints usage for --help', async () => {
    const code = await run(['--help']);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: overture detect [--json]'),
    );
  });

  it('returns 2 and prints error for unknown command', async () => {
    const code = await run(['unknown-cmd']);
    expect(code).toBe(2);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown command: unknown-cmd'),
    );
  });

  it('returns 2 and prints error for unknown flag on detect', async () => {
    const code = await run(['detect', '--bogus']);
    expect(code).toBe(2);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown flag: --bogus'),
    );
  });

  it('detect --help returns 0 and prints usage', async () => {
    const code = await run(['detect', '--help']);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: overture detect'),
    );
  });

  it('detect -h returns 0 and prints usage', async () => {
    const code = await run(['detect', '-h']);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: overture detect'),
    );
  });

  it('detect with unknown flag still returns 2', async () => {
    const code = await run(['detect', '--bogus']);
    expect(code).toBe(2);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown flag: --bogus'),
    );
  });
});

describe('formatHumanOutput', () => {
  it('returns no-results message for empty platforms', () => {
    const output: DetectJsonOutput = { platforms: [] };
    expect(formatHumanOutput(output)).toBe(
      'No supported MCP-capable platforms detected.\n',
    );
  });

  it('returns heading and lines for installed platforms', () => {
    const platform: PlatformDetectionResult = {
      id: 'cursor',
      displayName: 'Cursor',
      installed: true,
      confidence: 'high',
      matchedMarkers: ['/home/user/.cursor/mcp.json'],
      installMarkers: [],
      mcpLocations: [],
      detectionStrategy: 'marker-only',
      mcpSupport: 'supported',
      executableNames: [],
      matchedExecutables: [],
      mcpConfigured: false,
      matchedMcpLocations: [],
      orphanedMcpLocations: [],
      reasonCode: 'marker-found',
    };
    const output: DetectJsonOutput = { platforms: [platform] };
    const result = formatHumanOutput(output);
    expect(result).toContain('Detected MCP-capable platforms:');
    expect(result).toContain('  - Cursor (high) [mcp-not-configured]');
  });

  it('installed supported with mcpConfigured true shows mcp-configured tag', () => {
    const platform: PlatformDetectionResult = {
      id: 'claude-code',
      displayName: 'Claude Code',
      installed: true,
      confidence: 'high',
      matchedMarkers: ['/home/user/.claude.json'],
      installMarkers: [],
      mcpLocations: [],
      detectionStrategy: 'binary-first',
      mcpSupport: 'supported',
      executableNames: ['claude'],
      matchedExecutables: [],
      mcpConfigured: true,
      matchedMcpLocations: [
        {
          id: 'claude-code-0',
          resolvedPath: '/home/user/.claude.json',
          format: 'json',
          nonEmpty: true,
        },
      ],
      orphanedMcpLocations: [],
      reasonCode: 'mcp-configured',
    };
    const output: DetectJsonOutput = { platforms: [platform] };
    const result = formatHumanOutput(output);
    expect(result).toContain('  - Claude Code (high) [mcp-configured]');
  });

  it('installed unsupported tool (aider) goes to inventory section', () => {
    const platform: PlatformDetectionResult = {
      id: 'aider',
      displayName: 'Aider',
      installed: true,
      confidence: 'unsupported',
      matchedMarkers: [],
      installMarkers: [],
      mcpLocations: [],
      detectionStrategy: 'binary-first',
      mcpSupport: 'unsupported',
      executableNames: ['aider'],
      matchedExecutables: [],
      mcpConfigured: false,
      matchedMcpLocations: [],
      orphanedMcpLocations: [],
      reasonCode: 'unsupported-no-mcp-client',
    };
    const output: DetectJsonOutput = { platforms: [platform] };
    const result = formatHumanOutput(output);
    expect(result).toContain(
      'Installed tools without MCP support (inventory):',
    );
    expect(result).toContain('    - Aider (aider)');
  });

  it('orphan location shows in warning section', () => {
    const platform: PlatformDetectionResult = {
      id: 'windsurf',
      displayName: 'Windsurf',
      installed: false,
      confidence: 'medium',
      matchedMarkers: [],
      installMarkers: [],
      mcpLocations: [],
      detectionStrategy: 'binary-first',
      mcpSupport: 'supported',
      executableNames: ['windsurf'],
      matchedExecutables: [],
      mcpConfigured: false,
      matchedMcpLocations: [],
      orphanedMcpLocations: [
        {
          id: 'windsurf-0',
          resolvedPath: '/home/x/.codeium/windsurf/mcp_config.json',
          format: 'json',
          nonEmpty: true,
        },
      ],
      reasonCode: 'orphaned-mcp-config',
    };
    const output: DetectJsonOutput = { platforms: [platform] };
    const result = formatHumanOutput(output);
    expect(result).toContain(
      'Orphaned MCP configurations (no platform installed):',
    );
    expect(result).toContain(
      '    - /home/x/.codeium/windsurf/mcp_config.json (windsurf)',
    );
  });

  it('no orphan section when orphans empty', () => {
    const platform: PlatformDetectionResult = {
      id: 'cursor',
      displayName: 'Cursor',
      installed: true,
      confidence: 'high',
      matchedMarkers: ['/home/user/.cursor/mcp.json'],
      installMarkers: [],
      mcpLocations: [],
      detectionStrategy: 'marker-only',
      mcpSupport: 'supported',
      executableNames: [],
      matchedExecutables: [],
      mcpConfigured: false,
      matchedMcpLocations: [],
      orphanedMcpLocations: [],
      reasonCode: 'marker-found',
    };
    const output: DetectJsonOutput = { platforms: [platform] };
    const result = formatHumanOutput(output);
    expect(result).not.toContain('Orphaned MCP configurations');
  });

  it('output has no ANSI escape sequences', () => {
    const platform: PlatformDetectionResult = {
      id: 'claude-code',
      displayName: 'Claude Code',
      installed: true,
      confidence: 'high',
      matchedMarkers: ['/tmp/.claude.json'],
      installMarkers: [],
      mcpLocations: [],
      detectionStrategy: 'marker-only',
      mcpSupport: 'supported',
      executableNames: [],
      matchedExecutables: [],
      mcpConfigured: false,
      matchedMcpLocations: [],
      orphanedMcpLocations: [],
      reasonCode: 'marker-found',
    };
    const output: DetectJsonOutput = { platforms: [platform] };
    const result = formatHumanOutput(output);
    expect(result).not.toMatch(/\x1b\[/);
    expect(result).not.toContain('');
  });
});

it('detected platform with matchedExecutables shows agent path subline', () => {
  const platform: PlatformDetectionResult = {
    id: 'claude-code',
    displayName: 'Claude Code',
    installed: true,
    confidence: 'high',
    matchedMarkers: [],
    installMarkers: [],
    mcpLocations: [],
    detectionStrategy: 'binary-first',
    mcpSupport: 'supported',
    executableNames: ['claude'],
    matchedExecutables: [
      {
        name: 'claude',
        resolvedPath: '/home/user/.local/share/claude/versions/2.1.138',
        source: 'path',
      },
    ],
    mcpConfigured: false,
    matchedMcpLocations: [],
    orphanedMcpLocations: [],
    reasonCode: 'binary-found',
  };
  const output: DetectJsonOutput = { platforms: [platform] };
  const result = formatHumanOutput(output);
  expect(result).toContain(
    '    agent: /home/user/.local/share/claude/versions/2.1.138',
  );
  expect(result).toContain('    mcp:   (not configured)');
});

it('detected platform falls back to matchedMarkers[0] when no executable', () => {
  const platform: PlatformDetectionResult = {
    id: 'cursor',
    displayName: 'Cursor',
    installed: true,
    confidence: 'high',
    matchedMarkers: ['/home/user/.cursor-server'],
    installMarkers: [],
    mcpLocations: [],
    detectionStrategy: 'marker-only',
    mcpSupport: 'supported',
    executableNames: [],
    matchedExecutables: [],
    mcpConfigured: false,
    matchedMcpLocations: [],
    orphanedMcpLocations: [],
    reasonCode: 'marker-found',
  };
  const output: DetectJsonOutput = { platforms: [platform] };
  const result = formatHumanOutput(output);
  expect(result).toContain('    agent: /home/user/.cursor-server');
  expect(result).toContain('    mcp:   (not configured)');
});

it('detected platform with mcpConfigured shows resolved mcp path', () => {
  const platform: PlatformDetectionResult = {
    id: 'claude-code',
    displayName: 'Claude Code',
    installed: true,
    confidence: 'high',
    matchedMarkers: [],
    installMarkers: [],
    mcpLocations: [],
    detectionStrategy: 'binary-first',
    mcpSupport: 'supported',
    executableNames: ['claude'],
    matchedExecutables: [
      {
        name: 'claude',
        resolvedPath: '/usr/bin/claude',
        source: 'path',
      },
    ],
    mcpConfigured: true,
    matchedMcpLocations: [
      {
        id: 'claude-code-0',
        resolvedPath: '/home/user/.claude.json',
        format: 'json',
        nonEmpty: true,
      },
    ],
    orphanedMcpLocations: [],
    reasonCode: 'mcp-configured',
  };
  const output: DetectJsonOutput = { platforms: [platform] };
  const result = formatHumanOutput(output);
  expect(result).toContain('    agent: /usr/bin/claude');
  expect(result).toContain('    mcp:   /home/user/.claude.json');
  expect(result).not.toContain('(not configured)');
});

it('unsupported inventory platform shows agent subline but no mcp subline', () => {
  const platform: PlatformDetectionResult = {
    id: 'aider',
    displayName: 'Aider',
    installed: true,
    confidence: 'unsupported',
    matchedMarkers: [],
    installMarkers: [],
    mcpLocations: [],
    detectionStrategy: 'binary-first',
    mcpSupport: 'unsupported',
    executableNames: ['aider'],
    matchedExecutables: [
      {
        name: 'aider',
        resolvedPath: '/home/user/.local/bin/aider',
        source: 'path',
      },
    ],
    mcpConfigured: false,
    matchedMcpLocations: [],
    orphanedMcpLocations: [],
    reasonCode: 'unsupported-no-mcp-client',
  };
  const output: DetectJsonOutput = { platforms: [platform] };
  const result = formatHumanOutput(output);
  expect(result).toContain('        agent: /home/user/.local/bin/aider');
  expect(result).not.toContain('(not configured)');
  const inventoryIdx = result.indexOf('Installed tools without MCP support');
  const afterInventory = result.slice(inventoryIdx);
  expect(afterInventory).not.toMatch(/\n\s+mcp:/);
});

it('detected platform with neither executable nor marker still emits (not configured) only', () => {
  const platform: PlatformDetectionResult = {
    id: 'github-copilot-cloud-agent',
    displayName: 'GitHub Copilot Cloud Agent',
    installed: true,
    confidence: 'low',
    matchedMarkers: [],
    installMarkers: [],
    mcpLocations: [],
    detectionStrategy: 'marker-only',
    mcpSupport: 'unsupported',
    executableNames: [],
    matchedExecutables: [],
    mcpConfigured: false,
    matchedMcpLocations: [],
    orphanedMcpLocations: [],
    reasonCode: 'unsupported-no-local-signal',
  };
  const output: DetectJsonOutput = { platforms: [platform] };
  const result = formatHumanOutput(output);
  expect(result).not.toMatch(/\n {4}agent:/);
  expect(result).not.toMatch(/\n {4}mcp:/);
});

describe('formatJsonOutput', () => {
  it('returns parseable JSON with platforms key', () => {
    const output: DetectJsonOutput = { platforms: [] };
    const result = formatJsonOutput(output);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('platforms');
    expect(Array.isArray(parsed.platforms)).toBe(true);
  });
});

it('does not contain ANSI escape sequences', () => {
  const platform: PlatformDetectionResult = {
    id: 'claude-code',
    displayName: 'Claude Code',
    installed: true,
    confidence: 'high',
    matchedMarkers: ['/tmp/.claude.json'],
    installMarkers: [],
    mcpLocations: [],
    detectionStrategy: 'marker-only',
    mcpSupport: 'supported',
    executableNames: [],
    matchedExecutables: [],
    mcpConfigured: false,
    matchedMcpLocations: [],
    orphanedMcpLocations: [],
    reasonCode: 'marker-found',
  };
  const output: DetectJsonOutput = { platforms: [platform] };
  const json = formatJsonOutput(output);
  expect(json).not.toContain('');
  expect(json).not.toMatch(/\x1b\[/);
  expect(JSON.parse(json)).toEqual(output);
});

describe('opencode server list in human output', () => {
  it('renders server names and transport type for configured opencode platform', async () => {
    const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const tmpDir = mkdtempSync(tmpdir() + '/overture-test-');
    mkdirSync(tmpDir, { recursive: true });
    const configPath = tmpDir + '/opencode.jsonc';
    writeFileSync(
      configPath,
      JSON.stringify({
        mcp: {
          filesystem: {
            command: 'npx -y @modelcontextprotocol/server-filesystem',
            args: ['/home'],
          },
          context7: {
            url: 'https://mcp.context7.com/mcp',
          },
        },
      }),
    );
    const platform: PlatformDetectionResult = {
      id: 'opencode',
      displayName: 'OpenCode',
      installed: true,
      confidence: 'high',
      matchedMarkers: [],
      installMarkers: [],
      mcpLocations: [],
      detectionStrategy: 'binary-first',
      mcpSupport: 'supported',
      executableNames: ['opencode'],
      matchedExecutables: [
        {
          name: 'opencode',
          resolvedPath: '/usr/bin/opencode',
          source: 'path',
        },
      ],
      mcpConfigured: true,
      matchedMcpLocations: [
        {
          id: 'opencode-0',
          resolvedPath: configPath,
          format: 'json',
          nonEmpty: true,
          serverNames: ['filesystem', 'context7'],
        },
      ],
      orphanedMcpLocations: [],
      reasonCode: 'mcp-configured',
    };
    const output = { platforms: [platform] };
    const result = formatHumanOutput(output);
    expect(result).toContain('  - OpenCode (high) [mcp-configured]');
    expect(result).toContain('    agent: /usr/bin/opencode');
    expect(result).toContain('    mcp:   ' + configPath);
    expect(result).toContain('      - filesystem  (local)');
    expect(result).toContain('      - context7  (remote)');
    expect(result).toContain('https://mcp.context7.com/mcp');
  });

  it('shows local server with command when command field is present', async () => {
    const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const tmpDir = mkdtempSync(tmpdir() + '/overture-test2-');
    mkdirSync(tmpDir, { recursive: true });
    const configPath = tmpDir + '/opencode2.jsonc';
    writeFileSync(
      configPath,
      JSON.stringify({
        mcp: {
          github: {
            command: '@modelcontextprotocol/server-github',
          },
        },
      }),
    );
    const platform: PlatformDetectionResult = {
      id: 'opencode',
      displayName: 'OpenCode',
      installed: true,
      confidence: 'high',
      matchedMarkers: [],
      installMarkers: [],
      mcpLocations: [],
      detectionStrategy: 'binary-first',
      mcpSupport: 'supported',
      executableNames: ['opencode'],
      matchedExecutables: [],
      mcpConfigured: true,
      matchedMcpLocations: [
        {
          id: 'opencode-0',
          resolvedPath: configPath,
          format: 'json',
          nonEmpty: true,
          serverNames: ['github'],
        },
      ],
      orphanedMcpLocations: [],
      reasonCode: 'mcp-configured',
    };
    const output = { platforms: [platform] };
    const result = formatHumanOutput(output);
    expect(result).toContain('      - github  (local)');
    expect(result).toContain('@modelcontextprotocol/server-github');
  });

  it('renders nothing extra for non-opencode platforms even with serverNames', () => {
    const platform: PlatformDetectionResult = {
      id: 'claude-code',
      displayName: 'Claude Code',
      installed: true,
      confidence: 'high',
      matchedMarkers: [],
      installMarkers: [],
      mcpLocations: [],
      detectionStrategy: 'binary-first',
      mcpSupport: 'supported',
      executableNames: ['claude'],
      matchedExecutables: [],
      mcpConfigured: true,
      matchedMcpLocations: [
        {
          id: 'claude-code-0',
          resolvedPath: '/home/user/.claude.json',
          format: 'json',
          nonEmpty: true,
          serverNames: ['filesystem', 'context7'],
        },
      ],
      orphanedMcpLocations: [],
      reasonCode: 'mcp-configured',
    };
    const output = { platforms: [platform] };
    const result = formatHumanOutput(output);
    expect(result).toContain('    mcp:   /home/user/.claude.json');
    expect(result).not.toContain('filesystem');
    expect(result).not.toContain('context7');
  });

  it('gracefully handles unreadable config path for opencode', () => {
    const platform: PlatformDetectionResult = {
      id: 'opencode',
      displayName: 'OpenCode',
      installed: true,
      confidence: 'high',
      matchedMarkers: [],
      installMarkers: [],
      mcpLocations: [],
      detectionStrategy: 'binary-first',
      mcpSupport: 'supported',
      executableNames: ['opencode'],
      matchedExecutables: [
        {
          name: 'opencode',
          resolvedPath: '/usr/bin/opencode',
          source: 'path',
        },
      ],
      mcpConfigured: true,
      matchedMcpLocations: [
        {
          id: 'opencode-0',
          resolvedPath: '/nonexistent/path/opencode.jsonc',
          format: 'json',
          nonEmpty: true,
          serverNames: ['filesystem'],
        },
      ],
      orphanedMcpLocations: [],
      reasonCode: 'mcp-configured',
    };
    const output = { platforms: [platform] };
    const result = formatHumanOutput(output);
    expect(result).toContain('  - OpenCode (high) [mcp-configured]');
    expect(result).toContain('    mcp:   /nonexistent/path/opencode.jsonc');
    expect(result).not.toContain('      - ');
  });
});
