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
    };
    const output: DetectJsonOutput = { platforms: [platform] };
    const result = formatHumanOutput(output);
    expect(result).toContain('Detected MCP-capable platforms:');
    expect(result).toContain('  - Cursor (high) /home/user/.cursor/mcp.json');
  });
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
  const output = {
    platforms: [
      {
        id: 'claude-code',
        displayName: 'Claude Code',
        installed: true,
        confidence: 'high',
        matchedMarkers: ['/tmp/.claude.json'],
        installMarkers: [],
        mcpLocations: [],
      },
    ],
  };
  const json = formatJsonOutput(output);
  expect(json).not.toContain('\u001b');
  expect(json).not.toMatch(/\x1b\[/);
  expect(JSON.parse(json)).toEqual(output);
});
