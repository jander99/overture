import type { ConflictClassification, ScanMatrix } from '@overture/scan-matrix';

export interface ScanJsonOutput {
  readonly matrix: ScanMatrix;
  readonly conflicts: ConflictClassification;
}

export function buildScanJsonOutput(): ScanJsonOutput | null {
  return null;
}
