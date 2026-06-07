import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from './cli.js';

describe('main', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('runs detect and prints output to stdout', async () => {
    const code = await run(['detect']);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalled();
    const callArg = stdoutSpy.mock.calls[0][0] as string;
    expect(
      callArg.includes('No supported MCP-capable platforms detected.') ||
        callArg.includes('Detected MCP-capable platforms:'),
    ).toBe(true);
  });
});
