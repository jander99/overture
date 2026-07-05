#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = join(__dirname, '..', '..', '..');
const CLI_ENTRY = join(WORKSPACE_ROOT, 'apps', 'cli', 'dist', 'main.js');

const tempHome = mkdtempSync(join(tmpdir(), 'overture-validate-'));
const tempConfigDir = join(tempHome, '.config');
const env = {
  ...process.env,
  HOME: tempHome,
  XDG_CONFIG_HOME: tempConfigDir,
};

// chdir so the CLI does not walk up from cwd and discover the
// repository's own `.mcp.json` (which configures `nx-mcp` for local
// development). Mirrors the original workflow's `cd "$HOME"` step.
process.chdir(tempHome);

function cleanup() {
  try {
    rmSync(tempHome, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

let failures = 0;

function expect(label, cond, detail = '') {
  if (!cond) {
    console.error(`FAIL: ${label}${detail ? '\n  ' + detail : ''}`);
    failures += 1;
  } else {
    console.log(`OK:   ${label}`);
  }
}

function run(args) {
  return execFileSync(process.execPath, [CLI_ENTRY, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
}

function runJson(args) {
  return JSON.parse(run(args));
}

// `fixtures/` mirrors the target install paths under `tempHome` so a
// recursive copy reproduces exactly what `seedFixtures()` used to write
// in-place. `fixtures/.codex/config.toml` keeps `env = {}` because the
// codex normalizer emits `{env: undefined}` when the key is absent and
// other agents emit `{env: {}}`; `serverSettingsEqual` treats those as
// distinct, which would surface as a pickable conflict instead of the
// desired all-agents-equal adoption.
cpSync(join(__dirname, 'fixtures'), tempHome, { recursive: true });
console.log(`Seeded fixtures in ${tempHome}`);

// ----- Phase A: no overture config exists yet -----

const detect = runJson(['detect', '--json']);
expect(
  'detect returns 4 platforms',
  detect.platforms.length === 4,
  `got ${detect.platforms.length}`,
);

const expectedIds = [
  'claude-code',
  'github-copilot-cli',
  'openai-codex',
  'opencode',
];
const seenIds = detect.platforms.map((p) => p.id).sort();
expect(
  'detect ids match registry',
  JSON.stringify(seenIds) === JSON.stringify([...expectedIds].sort()),
  `got ${JSON.stringify(seenIds)}`,
);

for (const p of detect.platforms) {
  expect(`detect.${p.id}.installed`, p.installed === true);
  expect(
    `detect.${p.id}.mcpSupport=supported`,
    p.mcpSupport === 'supported',
    `got ${p.mcpSupport}`,
  );
  expect(
    `detect.${p.id}.mcpConfigured`,
    p.mcpConfigured === true,
    `got ${p.mcpConfigured}`,
  );
  for (const loc of [
    ...(p.matchedMcpLocations ?? []),
    ...(p.orphanedMcpLocations ?? []),
  ]) {
    expect(
      `detect.${p.id}.${loc.id}.no parseError`,
      !loc.parseError,
      `got ${loc.parseError}`,
    );
  }
}

const configShow = run(['config', 'show']);
expect(
  'config show reports no config',
  /No overture config found/.test(configShow),
);

const scan = runJson(['scan', '--json']);
expect('scan matrix has 4 agents', scan.matrix.agents.length === 4);
expect(
  'scan finds shared-fs as extra-in-agent',
  scan.matrix.rows.some(
    (r) => r.status === 'extra-in-agent' && r.agentServerName === 'shared-fs',
  ),
);
expect('scan has no pickable conflicts', scan.conflicts.pickable.length === 0);
expect(
  'scan has no hardRefuse conflicts',
  scan.conflicts.hardRefuses.length === 0,
);

const boot = runJson(['bootstrap', '--dry-run', '--json']);
expect('bootstrap proposal.status=ready', boot.proposal.status === 'ready');
expect(
  'bootstrap adopted shared-fs (all-agents-equal)',
  boot.proposal.adoptedServers.some(
    (s) => s.name === 'shared-fs' && s.source === 'all-agents-equal',
  ),
);

// ----- Phase B: write the bootstrap proposal, then apply + restore -----

mkdirSync(join(tempConfigDir, 'overture'), { recursive: true });
const overtureConfigPath = join(tempConfigDir, 'overture', 'overture.jsonc');
writeFileSync(
  overtureConfigPath,
  JSON.stringify(boot.proposal.config, null, 2) + '\n',
);
console.log(`Wrote canonical config: ${overtureConfigPath}`);

const apply = runJson(['apply', '--dry-run', '--json']);
expect('apply ran 4 agents', apply.results.length === 4);
for (const r of apply.results) {
  expect(
    `apply.${r.agentId}.status is would-update or no-change`,
    r.status === 'would-update' || r.status === 'no-change',
    `got ${r.status}`,
  );
}

try {
  run(['restore-last', '--dry-run']);
  expect('restore-last exits 1 when no history', false, 'expected exit 1');
} catch (err) {
  expect(
    'restore-last exits 1 when no history',
    err.status === 1,
    `got status ${err.status}`,
  );
  expect(
    'restore-last stderr mentions no history',
    /no overture apply history found/.test(String(err.stderr ?? '')),
    String(err.stderr ?? ''),
  );
}

if (failures > 0) {
  console.error(`\n${failures} validation check(s) failed.`);
  process.exit(1);
}
console.log('\nAll validation checks passed.');
console.log(`(workspace root: ${WORKSPACE_ROOT})`);
console.log(`(cli entry: ${relative(process.cwd(), CLI_ENTRY)})`);
