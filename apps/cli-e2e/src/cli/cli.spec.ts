import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

describe('CLI tests', () => {
  const cliPath = join(process.cwd(), 'dist/apps/cli/main.js');

  beforeAll(() => {
    if (!existsSync(cliPath)) {
      throw new Error(
        `CLI not built at ${cliPath}. Run: nx build @overture/cli`,
      );
    }
  });

  it('should display usage information', () => {
    const output = execSync(`node ${cliPath} --help`).toString();

    expect(output).toMatch(/Usage: overture/);
    expect(output).toMatch(/Orchestration layer/);
  });

  it('should display version', () => {
    const output = execSync(`node ${cliPath} --version`).toString();

    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should display help', () => {
    const output = execSync(`node ${cliPath} --help`).toString();

    expect(output).toMatch(/Commands:/);
    expect(output).toMatch(/init/);
    expect(output).toMatch(/sync/);
  });
});
