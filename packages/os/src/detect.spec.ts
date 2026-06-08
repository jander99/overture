import { describe, expect, it } from 'vitest';
import { readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectOS,
  type DetectOSOverrides,
  parseOsRelease,
  parseWslVersion,
  wslFromProc,
} from './detect.js';

async function makeOsRelease(contents: string): Promise<string> {
  const dir = join(
    tmpdir(),
    `overture-os-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await (await import('node:fs/promises')).mkdir(dir, { recursive: true });
  const p = join(dir, 'os-release');
  await (await import('node:fs/promises')).writeFile(p, contents, 'utf8');
  return p;
}

describe('detectOS', () => {
  it('returns a HostInfo with required fields', () => {
    const info = detectOS();
    expect(info.platform).toMatch(/^(linux|darwin|win32)$/);
    expect(typeof info.distro).toBe('string');
    expect(typeof info.distroId).toBe('string');
    expect(typeof info.wsl).toBe('boolean');
    expect(typeof info.wslVersion).toBe('number');
  });

  it('does not throw on this host', () => {
    expect(() => detectOS()).not.toThrow();
  });
});

describe('detectOS (overrides)', () => {
  it('reports Windows when platform=win32 is forced', () => {
    const overrides: DetectOSOverrides = {
      platform: 'win32',
      osReleasePath: null,
      procVersionSignature: null,
    };
    const info = detectOS(overrides);
    expect(info.platform).toBe('win32');
    expect(info.distro).toBe('Windows');
    expect(info.distroId).toBe('windows');
    expect(info.wsl).toBe(false);
  });

  it('reports macOS when platform=darwin is forced', () => {
    const overrides: DetectOSOverrides = {
      platform: 'darwin',
      osReleasePath: null,
      procVersionSignature: null,
    };
    const info = detectOS(overrides);
    expect(info.platform).toBe('darwin');
    expect(info.distro).toBe('macOS');
    expect(info.distroId).toBe('darwin');
    expect(info.wsl).toBe(false);
  });

  it('reports Linux with distro when platform=linux and os-release is present', async () => {
    const p = await makeOsRelease(
      `NAME="Ubuntu"\nVERSION_ID="22.04"\nID=ubuntu\nPRETTY_NAME="Ubuntu 22.04 LTS"\n`,
    );
    const overrides: DetectOSOverrides = {
      platform: 'linux',
      osReleasePath: p,
      procVersionSignature:
        'Linux version 5.15.0-91-generic (buildd@lcy02-amd64-001)',
    };
    const info = detectOS(overrides);
    expect(info.platform).toBe('linux');
    expect(info.distro).toBe('Ubuntu 22.04 LTS');
    expect(info.distroId).toBe('ubuntu');
    expect(info.wsl).toBe(false);
    expect(info.wslVersion).toBe(0);
  });

  it('reports WSL1 when proc/version signature contains Microsoft and version 1', async () => {
    const p = await makeOsRelease(
      `NAME="Ubuntu"\nVERSION_ID="20.04"\nID=ubuntu\nPRETTY_NAME="Ubuntu 20.04 LTS"\n`,
    );
    const overrides: DetectOSOverrides = {
      platform: 'linux',
      osReleasePath: p,
      procVersionSignature:
        'Linux version 4.4.0-19041-Microsoft (Microsoft@Microsoft.com)',
    };
    const info = detectOS(overrides);
    expect(info.platform).toBe('linux');
    expect(info.distroId).toBe('ubuntu');
    expect(info.wsl).toBe(true);
    expect(info.wslVersion).toBe(1);
    expect(info.wslDistro).toBe('Ubuntu 20.04 LTS');
  });

  it('reports WSL2 when proc/version signature contains Microsoft and version 2 kernel', async () => {
    const p = await makeOsRelease(
      `NAME="Ubuntu"\nVERSION_ID="22.04"\nID=ubuntu\nPRETTY_NAME="Ubuntu 22.04 LTS"\n`,
    );
    const overrides: DetectOSOverrides = {
      platform: 'linux',
      osReleasePath: p,
      procVersionSignature:
        'Linux version 5.15.146.1-microsoft-standard-WSL2 (oe-user@oe-host)',
    };
    const info = detectOS(overrides);
    expect(info.wsl).toBe(true);
    expect(info.wslVersion).toBe(2);
  });

  it('does not set wsl=true when proc/version lacks Microsoft marker', async () => {
    const p = await makeOsRelease(
      `NAME="Debian"\nVERSION_ID="12"\nID=debian\nPRETTY_NAME="Debian GNU/Linux 12"\n`,
    );
    const overrides: DetectOSOverrides = {
      platform: 'linux',
      osReleasePath: p,
      procVersionSignature:
        'Linux version 6.1.0-13-amd64 (debian-kernel@lists.debian.org)',
    };
    const info = detectOS(overrides);
    expect(info.wsl).toBe(false);
    expect(info.wslVersion).toBe(0);
    expect(info.distroId).toBe('debian');
  });
});

describe('parseOsRelease', () => {
  it('parses standard /etc/os-release key=value lines', () => {
    const parsed = parseOsRelease(
      `NAME="Ubuntu"\nVERSION_ID="22.04"\nID=ubuntu\nPRETTY_NAME="Ubuntu 22.04 LTS"\n`,
    );
    expect(parsed.ID).toBe('ubuntu');
    expect(parsed.PRETTY_NAME).toBe('Ubuntu 22.04 LTS');
    expect(parsed.NAME).toBe('Ubuntu');
    expect(parsed.VERSION_ID).toBe('22.04');
  });

  it('handles missing PRETTY_NAME by falling back to NAME', () => {
    const parsed = parseOsRelease(`ID=arch\nNAME=Arch\n`);
    expect(parsed.PRETTY_NAME).toBe('Arch');
  });

  it('returns empty object for empty input', () => {
    expect(parseOsRelease('')).toEqual({});
  });

  it('ignores comment lines and malformed lines', () => {
    const parsed = parseOsRelease(
      `# this is a comment\nID=alpine\n\nrandom garbage\nNAME=Alpine\n`,
    );
    expect(parsed.ID).toBe('alpine');
    expect(parsed.NAME).toBe('Alpine');
  });
});

describe('parseWslVersion', () => {
  it('returns 2 for WSL2 marker', () => {
    expect(
      parseWslVersion(
        'Linux version 5.15.146.1-microsoft-standard-WSL2 (oe-user@oe-host)',
      ),
    ).toBe(2);
  });
  it('returns 1 for WSL1 marker', () => {
    expect(
      parseWslVersion(
        'Linux version 4.4.0-19041-Microsoft (Microsoft@Microsoft.com)',
      ),
    ).toBe(1);
  });
  it('returns 0 for non-WSL kernel', () => {
    expect(
      parseWslVersion(
        'Linux version 6.1.0-13-amd64 (debian-kernel@lists.debian.org)',
      ),
    ).toBe(0);
  });
  it('returns 0 for empty/null input', () => {
    expect(parseWslVersion(null)).toBe(0);
    expect(parseWslVersion('')).toBe(0);
  });
});

describe('wslFromProc', () => {
  it('returns true for proc version containing Microsoft', () => {
    expect(
      wslFromProc(
        'Linux version 4.4.0-19041-Microsoft (Microsoft@Microsoft.com)',
      ),
    ).toBe(true);
  });
  it('returns false for native Linux proc version', () => {
    expect(
      wslFromProc(
        'Linux version 6.1.0-13-amd64 (debian-kernel@lists.debian.org)',
      ),
    ).toBe(false);
  });
  it('returns false for empty input', () => {
    expect(wslFromProc(null)).toBe(false);
    expect(wslFromProc('')).toBe(false);
  });
});

describe('detectOS (real-host smoke)', () => {
  it('matches this host — WSL2 Ubuntu on Linux', async () => {
    const info = detectOS();
    if (info.platform === 'linux') {
      const s = await stat('/proc/version').catch(() => null);
      if (s !== null) {
        // If /proc/version exists and is non-empty, our signature override reflects it
        const sig = (await readFile('/proc/version', 'utf8')).trim();
        const overrides: DetectOSOverrides = {
          platform: 'linux',
          osReleasePath: '/etc/os-release',
          procVersionSignature: sig,
        };
        const realInfo = detectOS(overrides);
        expect(realInfo.platform).toBe('linux');
        // The real host is WSL2 in this environment
        expect(realInfo.wsl).toBe(true);
        expect(realInfo.wslVersion).toBe(2);
      }
    }
  });
});
