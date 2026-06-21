import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { __setPlatformForTests } from './cli.js';

import { run, formatHumanOutput, formatJsonOutput } from './cli.js';
import type {
  DetectJsonOutput,
  PlatformDetectionResult,
} from './platforms/types.js';

describe('run', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let originalXdgConfigHome: string | undefined;
  let originalPath: string | undefined;
  let tempRoots: string[];

  beforeEach(() => {
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    originalPath = process.env.PATH;
    tempRoots = [];
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    for (const dir of tempRoots) {
      rmSync(dir, { recursive: true, force: true });
    }
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('returns 0 and prints usage for empty args', async () => {
    const code = await run([]);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('detect [--json]'),
    );
  });

  it('returns 0 and prints usage for help', async () => {
    const code = await run(['help']);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('detect [--json]'),
    );
  });

  it('returns 0 and prints usage for --help', async () => {
    const code = await run(['--help']);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('detect [--json]'),
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

  it('detect uses XDG config root for agent MCP paths (regression)', async () => {
    const xdgConfigHome = mkdtempSync(join(tmpdir(), 'overture-xdg-config-'));
    const pathDir = mkdtempSync(join(tmpdir(), 'overture-path-'));
    tempRoots.push(xdgConfigHome, pathDir);

    process.env.XDG_CONFIG_HOME = xdgConfigHome;
    process.env.PATH = `${pathDir}${process.env.PATH ? `:${process.env.PATH}` : ''}`;

    const opencodeDir = join(xdgConfigHome, 'opencode');
    mkdirSync(opencodeDir, { recursive: true });
    writeFileSync(
      join(opencodeDir, 'opencode.jsonc'),
      '// comment\n{"mcp": {"context7": {"type": "remote", "url": "https://example.test"}}}',
    );

    const opencodeBin = join(pathDir, 'opencode');
    writeFileSync(opencodeBin, '#!/bin/sh\nexit 0\n');
    chmodSync(opencodeBin, 0o755);

    const code = await run(['detect', '--json']);
    expect(code).toBe(0);

    const stdout = stdoutSpy.mock.calls
      .map((c: readonly unknown[]) => c[0] as string)
      .join('');
    const parsed = JSON.parse(stdout) as {
      platforms: {
        id: string;
        installed: boolean;
        mcpSupport: string;
        mcpConfigured: boolean;
        matchedMcpLocations: { resolvedPath: string }[];
      }[];
    };
    const opencode = parsed.platforms.find(
      (platform) => platform.id === 'opencode',
    );

    expect(opencode).toBeDefined();
    expect(opencode?.installed).toBe(true);
    expect(opencode?.mcpSupport).toBe('supported');
    expect(opencode?.mcpConfigured).toBe(true);
    expect(opencode?.matchedMcpLocations.length).toBeGreaterThanOrEqual(1);
    expect(opencode?.matchedMcpLocations[0]?.resolvedPath).toContain(
      'opencode/opencode.jsonc',
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
    expect(result).not.toContain('\x1b');
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
  expect(json).not.toContain('\x1b');
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

describe('run (platform gate)', () => {
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
    __setPlatformForTests(null);
  });

  it('prints a Windows unsupported message and exits 0 when platform is win32', async () => {
    __setPlatformForTests('win32');
    const code = await run(['detect']);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('Windows is not supported'),
    );
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('detected platform: win32'),
    );
  });

  it('the Windows gate fires even for `overture --help`', async () => {
    __setPlatformForTests('win32');
    const code = await run([]);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('Windows is not supported'),
    );
  });

  it('does not write the Windows message on linux', async () => {
    __setPlatformForTests('linux');
    const code = await run(['detect', '--help']);
    expect(code).toBe(0);
    const allWrites = stdoutSpy.mock.calls
      .map((c: readonly unknown[]) => c[0] as string)
      .join('');

    expect(allWrites).not.toContain('Windows is not supported');
  });
});

describe('run (config show)', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    tempDir = mkdtempSync(join(tmpdir(), 'overture-cli-'));
    prevHome = process.env.HOME;
    process.env.HOME = tempDir;
    process.env.XDG_CONFIG_HOME = tempDir;
    process.env.XDG_STATE_HOME = tempDir;
    process.env.XDG_CACHE_HOME = tempDir;
    __setPlatformForTests('linux');
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    __setPlatformForTests(null);
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.XDG_STATE_HOME;
    delete process.env.XDG_CACHE_HOME;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('prints "not found" message when no config file exists', async () => {
    const code = await run(['config', 'show']);
    expect(code).toBe(0);
    const out = stdoutSpy.mock.calls
      .map((c: readonly unknown[]) => c[0] as string)
      .join('');

    expect(out).toContain('No overture config found');
    expect(out).toContain(tempDir);
  });

  it('prints the resolved config file path and JSON contents when present', async () => {
    const configDir = join(tempDir, 'overture');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'overture.jsonc'),
      JSON.stringify({
        $schema: 'https://example/x.json',
        version: 1,
        profiles: {
          default: {
            mcpServers: {
              fs: { type: 'stdio', command: 'npx' },
            },
            sync: { targets: ['claude-code'] },
            skills: [],
          },
        },
      }),
      'utf8',
    );
    const code = await run(['config', 'show']);
    expect(code).toBe(0);
    const out = stdoutSpy.mock.calls
      .map((c: readonly unknown[]) => c[0] as string)
      .join('');

    expect(out).toContain(join(configDir, 'overture.jsonc'));
    expect(out).toContain('"version": 1');
    expect(out).toContain('claude-code');
  });

  it('returns 2 with a helpful message for unknown config subcommands', async () => {
    const code = await run(['config', 'frobnicate']);
    expect(code).toBe(2);
    const err = stderrSpy.mock.calls
      .map((c: readonly unknown[]) => c[0] as string)
      .join('');

    expect(err).toContain('config');
  });
});

describe('run: scan', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;
  let prevHome: string | undefined;
  let prevXdgConfig: string | undefined;
  let prevXdgState: string | undefined;
  let prevXdgCache: string | undefined;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    tempDir = mkdtempSync(join(tmpdir(), 'overture-scan-'));
    prevHome = process.env.HOME;
    prevXdgConfig = process.env.XDG_CONFIG_HOME;
    prevXdgState = process.env.XDG_STATE_HOME;
    prevXdgCache = process.env.XDG_CACHE_HOME;
    process.env.HOME = tempDir;
    process.env.XDG_CONFIG_HOME = tempDir;
    process.env.XDG_STATE_HOME = tempDir;
    process.env.XDG_CACHE_HOME = tempDir;
    __setPlatformForTests('linux');
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    __setPlatformForTests(null);
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevXdgConfig === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdgConfig;
    if (prevXdgState === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = prevXdgState;
    if (prevXdgCache === undefined) delete process.env.XDG_CACHE_HOME;
    else process.env.XDG_CACHE_HOME = prevXdgCache;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('--json returns 0 and writes parseable JSON with only matrix and conflicts keys', async () => {
    const code = await run(['scan', '--json']);
    expect(code).toBe(0);
    const out = stdoutSpy.mock.calls
      .map((c: readonly unknown[]) => c[0] as string)
      .join('');
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(['conflicts', 'matrix']);
    expect(parsed).not.toHaveProperty('version');
    expect(parsed).not.toHaveProperty('generatedAt');
    expect(parsed).not.toHaveProperty('duration');
  });

  it('--help returns 0 and prints the scan usage line', async () => {
    const code = await run(['scan', '--help']);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: overture scan [--json]'),
    );
  });

  it('-h returns 0 and prints the scan usage line', async () => {
    const code = await run(['scan', '-h']);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: overture scan [--json]'),
    );
  });

  it('--bogus returns 2 and mentions the bad flag plus the usage line', async () => {
    const code = await run(['scan', '--bogus']);
    expect(code).toBe(2);
    const err = stderrSpy.mock.calls
      .map((c: readonly unknown[]) => c[0] as string)
      .join('');
    expect(err).toContain('--bogus');
    expect(err).toContain('Usage: overture scan');
  });

  it('with no flag returns 0 (placeholder for the Task 5 human formatter)', async () => {
    const code = await run(['scan']);
    expect(code).toBe(0);
  });
});
