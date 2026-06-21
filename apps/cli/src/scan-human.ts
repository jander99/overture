/**
 * Public surface of the C2 detailed scan human report.
 *
 * The implementation lives in `./scan-human/` and is split into focused
 * modules (fingerprint, sections, cap, format). This file re-exports
 * the single public function the CLI dispatcher imports, so the public
 * import path `./scan-human.js` keeps working unchanged.
 */
export { formatHumanScanDetail } from './scan-human/format.js';
