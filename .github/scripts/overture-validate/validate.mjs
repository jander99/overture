#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OVERTURE = process.env.OVERTURE_BIN || '/usr/local/bin/overture';
const HOME = process.env.HOME;
if (!HOME) {
  console.error('FAIL: HOME is not set');
  process.exit(1);
}
if (process.cwd() !== HOME) {
  console.error(`FAIL: cwd (${process.cwd()}) must equal HOME (${HOME})`);
  process.exit(1);
}
const CONFIG_DIR = process.env.XDG_CONFIG_HOME || join(HOME, '.config');
const OVERTURE_CONFIG_DIR = join(CONFIG_DIR, 'overture');

let failures = 0;

function expect(label, cond, detail = '') {
  if (!cond) {
    console.error(`FAIL: ${label}${detail ? '\n  ' + detail : ''}`);
    failures += 1;
  } else {
    console.log(`OK:   ${label}`);
  }
}

function runJson(args) {
  const stdout = execFileSync(OVERTURE, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(stdout);
}

function run(args) {
  return execFileSync(OVERTURE, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// ----- Phase A: no overture config exists yet -----

const detect = runJson(['detect', '--json']);
expect(
  'detect returns 4 platforms',
  detect.platforms.length === 4,
  `got ${detect.platforms.length}`,
);
const expectedIds = ['claude-code', 'codex', 'github-copilot-cli', 'opencode'];
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

mkdirSync(OVERTURE_CONFIG_DIR, { recursive: true });
writeFileSync(
  join(OVERTURE_CONFIG_DIR, 'overture.jsonc'),
  JSON.stringify(boot.proposal.config, null, 2) + '\n',
);
console.log(
  `Wrote canonical config: ${join(OVERTURE_CONFIG_DIR, 'overture.jsonc')}`,
);

const apply = runJson(['apply', '--dry-run', '--json']);
expect('apply ran 4 agents', apply.results.length === 4);
for (const r of apply.results) {
  expect(
    `apply.${r.agentId}.status is would-update or no-change`,
    r.status === 'would-update' || r.status === 'no-change',
    `got ${r.status}`,
  );
}

// restore-last --dry-run with no history exits 1 with "no overture apply history found"
try {
  run(['restore-last', '--dry-run']);
  expect('restore-last exits 1 when no history', false, 'expected exit 1');
} catch (err) {
  expect(
    'restore-last exits 1 when no history',
    err.status === 1,
    `got status ${err.status}`,
  );
  const stderr = String(err.stderr ?? '');
  expect(
    'restore-last stderr mentions no history',
    /no overture apply history found/.test(stderr),
    stderr,
  );
}

if (failures > 0) {
  console.error(`\n${failures} validation check(s) failed.`);
  process.exit(1);
}
console.log('\nAll validation checks passed.');
