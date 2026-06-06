#!/usr/bin/env node
import { run } from './cli.js';

(async () => {
  const code = await run(process.argv.slice(2));
  process.exit(code);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
