#!/usr/bin/env node
// verify-package.mjs
//
// Local npm-pack verification for the @jander99/overture CLI.
//
// Builds the CLI, packs the tarball with `npm pack`, asserts the tarball
// contents match the expected golden list (in `package-expected-files.txt`),
// then smoke-tests the package by running `npm install` in a clean temp
// directory (mirroring what `npx @jander99/overture` and `npm install -g
// @jander99/overture` do for real users) and exercising the installed CLI.
//
// Run from the repo root with `node apps/cli/scripts/verify-package.mjs`.
// Exits non-zero on any failure. Does NOT publish.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const cliDir = join(repoRoot, 'apps', 'cli');
const goldenListPath = join(__dirname, 'package-expected-files.txt');

function logStep(name) {
  console.log(`\n=== ${name} ===`);
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) {
    fail(`${cmd} exited with status ${res.status}`);
  }
}

logStep('Step 1 — Build');
run('yarn', ['nx', 'build', '@jander99/overture', '--skip-nx-cache'], {
  cwd: repoRoot,
});

const mainJs = join(cliDir, 'dist', 'main.js');
if (!statSync(mainJs, { throwIfNoEntry: false })) {
  fail(`expected dist/main.js after build, not found at ${mainJs}`);
}
console.log(`dist/main.js: ${statSync(mainJs).size} bytes`);

logStep('Step 2 — Pack');
const packTmp = mkdtempSync('/tmp/overture-verify-');
run('npm', ['pack', '--pack-destination', packTmp], { cwd: cliDir });
const { readdirSync } = await import('node:fs');
const builtTgz = readdirSync(packTmp).find((f) => f.endsWith('.tgz'));
if (!builtTgz) {
  fail('no .tgz produced by npm pack');
}
const tgz = join(packTmp, builtTgz);
console.log(`Tarball: ${tgz} (${statSync(tgz).size} bytes)`);

logStep('Step 3 — Verify golden file list');
const expected = readFileSync(goldenListPath, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));
const actualRaw = execFileSync('tar', ['-tzf', tgz]).toString();
const actual = actualRaw.split('\n').filter(Boolean);

// MUST CONTAIN
const missing = expected.filter((e) => !actual.includes(e));
if (missing.length > 0) {
  fail(`tarball missing required entries:\n  ${missing.join('\n  ')}`);
}
console.log(`Required entries present (${expected.length}): PASS`);

// MUST NOT CONTAIN
const forbiddenPatterns = [
  /^package\/node_modules\//,
  /^package\/.mcp\.json$/,
  /^package\/.gitignore$/,
  /^package\/nx\.json$/,
  /^package\/tsconfig[^/]*\.json$/,
  /^package\/src\//,
  /(^|\/)[\w-]+\.spec\.ts$/,
  /(^|\/)[\w-]+\.test\.ts$/,
];
const forbidden = actual.filter((entry) =>
  forbiddenPatterns.some((re) => re.test(entry)),
);
if (forbidden.length > 0) {
  fail(
    `tarball contains forbidden entries:\n  ${forbidden.slice(0, 10).join('\n  ')}`,
  );
}
console.log(`No forbidden entries: PASS`);

logStep('Step 4 — Install + smoke from clean temp dir (simulates `npx`)');
const cleanTmp = mkdtempSync('/tmp/overture-verify-clean-');
// `npm install` puts the package and its runtime dependencies in
// `node_modules/@jander99/overture/`, which mirrors what `npx
// @jander99/overture` and `npm install -g @jander99/overture` do for
// real users. Without this, runtime deps like `smol-toml` (declared
// in `apps/cli/package.json` `dependencies`) would be missing.
run('npm', ['install', '--silent', '--no-audit', '--no-fund', tgz], {
  cwd: cleanTmp,
});

const distMain = join(
  cleanTmp,
  'node_modules',
  '@jander99',
  'overture',
  'dist',
  'main.js',
);
run('node', [distMain, '--help']);

// detect --json smoke: extract JSON via pipe
const jsonResult = spawnSync('node', [distMain, 'detect', '--json'], {
  encoding: 'utf8',
});
if (jsonResult.status !== 0) {
  fail(`detect --json exited ${jsonResult.status}: ${jsonResult.stderr}`);
}
try {
  const parsed = JSON.parse(jsonResult.stdout);
  // The full registry is always emitted; on a clean runner every
  // entry reports `installed: false`. Asserting `length > 0` would
  // fail in CI, which runs on a clean machine with no pre-installed
  // agents.
  if (!Array.isArray(parsed.platforms) || parsed.platforms.length !== 4) {
    fail(
      `detect --json produced ${parsed.platforms?.length ?? 0} platforms;
  expected 4`,
    );
  }
  for (const p of parsed.platforms) {
    if (p.parseError) {
      fail(`${p.id} has parseError: ${p.parseError}`);
    }
  }
  const installed = parsed.platforms.filter((p) => p.installed).length;
  console.log(
    `detect --json: ${parsed.platforms.length} platforms (${installed} installed on this host)`,
  );
} catch (err) {
  fail(`detect --json output is not valid JSON: ${err.message}`);
}

// scan --json smoke: assert the C1 envelope shape and a non-error exit
// code. C1 accepts exit codes 0 (clean scan) and 1 (blocking state —
// invalid-profile or hard-refuse). Exit code 2 is reserved for usage
// errors and pre-model orchestration failures; if we see 2 here, the
// installed package is broken.
const scanResult = spawnSync('node', [distMain, 'scan', '--json'], {
  encoding: 'utf8',
});
if (scanResult.status !== 0 && scanResult.status !== 1) {
  fail(
    `scan --json exited ${scanResult.status} (expected 0 or 1): ${scanResult.stderr}`,
  );
}
try {
  const scan = JSON.parse(scanResult.stdout);
  const topKeys = Object.keys(scan).sort();
  const expectedTopKeys = ['conflicts', 'matrix'];
  if (
    topKeys.length !== expectedTopKeys.length ||
    !expectedTopKeys.every((k) => topKeys.includes(k))
  ) {
    fail(
      `scan --json top-level keys are [${topKeys.join(', ')}]; expected exactly [${expectedTopKeys.join(', ')}]`,
    );
  }
  const matrixKeys = Object.keys(scan.matrix).sort();
  const expectedMatrixKeys = [
    'agents',
    'canonicalIntent',
    'canonicalProfileName',
    'canonicalState',
    'rows',
  ];
  if (
    matrixKeys.length !== expectedMatrixKeys.length ||
    !expectedMatrixKeys.every((k) => matrixKeys.includes(k))
  ) {
    fail(
      `scan --json matrix keys are [${matrixKeys.join(', ')}]; expected exactly [${expectedMatrixKeys.join(', ')}]`,
    );
  }
  const conflictsKeys = Object.keys(scan.conflicts).sort();
  const expectedConflictsKeys = ['hardRefuses', 'pickable'];
  if (
    conflictsKeys.length !== expectedConflictsKeys.length ||
    !expectedConflictsKeys.every((k) => conflictsKeys.includes(k))
  ) {
    fail(
      `scan --json conflicts keys are [${conflictsKeys.join(', ')}]; expected exactly [${expectedConflictsKeys.join(', ')}]`,
    );
  }
  console.log(
    `scan --json: exit=${scanResult.status} matrix.agents=${scan.matrix.agents.length} pickable=${scan.conflicts.pickable.length} hardRefuses=${scan.conflicts.hardRefuses.length}: PASS`,
  );
} catch (err) {
  fail(`scan --json output is not valid JSON: ${err.message}`);
}

logStep('Cleanup');
rmSync(packTmp, { recursive: true, force: true });
rmSync(cleanTmp, { recursive: true, force: true });

logStep('PASS');
console.log('All verifications passed. The tarball is ready to publish.');
