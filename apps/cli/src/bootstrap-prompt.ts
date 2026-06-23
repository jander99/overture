/**
 * D2 - Plain-text interactive bootstrap prompt primitive.
 *
 * The module exposes a pure renderer/parser plus a thin injectable adapter
 * over `node:readline/promises`. The renderer is a pure function of a
 * `PickableConflict`: no I/O, no ANSI, no newlines other than `\n` between
 * sections. The parser maps a trimmed answer into a discriminated union
 * (`selected | skipped | invalid | abort`) without touching any global state.
 *
 * `createReadlinePrompt` accepts the minimal `question`/`close` shape that
 * `node:readline/promises.Interface` exposes so unit tests can pass a stub
 * interface. Production wiring (Wave 2) owns the real `node:readline` import
 * via `createStdinPrompt`, which is the only place `node:readline/promises`
 * is imported. Importing that factory in unit tests would pull a real TTY
 * dependency, so tests cover `createReadlinePrompt` with a stub instead.
 */
import type * as readlinePromises from 'node:readline/promises';

import type { PickableConflict } from '@overture/scan-matrix';

import { renderFingerprint } from './scan-human/fingerprint.js';

/**
 * The discriminated answer returned by `parsePickableAnswer` and the
 * `createReadlinePrompt` adapter. Callers (the Wave 2 command) decide how to
 * react: `selected` adopts `candidate[candidateIndex]`, `skipped` omits the
 * server, `invalid` re-asks the same prompt, `abort` exits with code 2.
 */
export type PickableAnswer =
  | { readonly kind: 'selected'; readonly candidateIndex: number }
  | { readonly kind: 'skipped' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'abort' };

/**
 * Adapter shape the Wave 2 command injects for testability. The factory
 * accepts the minimal readline surface (`question` + `close`) so tests can
 * pass a stub. The returned string is fed to `parsePickableAnswer` by the
 * caller; the adapter itself does no parsing.
 *
 * Returns `null` when the underlying line reader is closed (EOF), which the
 * caller maps to `kind: 'abort'` per the D2 plan.
 */
export type PromptQuestion = (message: string) => Promise<string | null>;

/**
 * Render a `PickableConflict` as deterministic plain-text prompt lines. The
 * exact shape is a public contract — Wave 2 callers and the spec lock the
 * ordering, indentation, and trailing `: ` (single trailing space on the
 * final prompt line) byte-for-byte.
 *
 * The renderer never mutates the input conflict; the candidate order follows
 * `PickableConflict.candidates` from `@overture/scan-matrix` (already in
 * registry order per B3). Fingerprints come from the shared
 * `renderFingerprint` helper so URLs / env / headers are redacted exactly
 * the way the C2 dry-run report redacts them.
 */
export function formatPickablePrompt(conflict: PickableConflict): string {
  const lines: string[] = [`Pickable conflict: ${conflict.serverName}`];

  conflict.candidates.forEach((candidate, index) => {
    const n = index + 1;
    lines.push(
      `  ${n}) ${candidate.displayName} (${candidate.agentId}): ${renderFingerprint(candidate.server)}`,
    );
  });

  lines.push('  s) skip this server (default)');
  lines.push(
    `Choose canonical entry [1-${conflict.candidates.length}, s=skip, q=abort]: `,
  );

  return lines.join('\n');
}

/**
 * Parse a trimmed answer into a `PickableAnswer`. Pure function: no I/O, no
 * regex literals, only literal string equality. Whitespace is stripped from
 * both ends before any check, matching what `node:readline/promises`
 * `rl.question()` returns for a single-line input.
 *
 * Mapping:
 *   - empty string OR whitespace-only -> `skipped` (per D2 default).
 *   - `s` / `S` / `skip` -> `skipped`.
 *   - `q` / `Q` / `quit` / `abort` / `exit` -> `abort`.
 *   - positive integer in `[1, candidateCount]` -> `selected` with
 *     `candidateIndex = input - 1`.
 *   - anything else (negative, zero, decimals, multi-line, embedded
 *     spaces, non-numeric, out-of-range) -> `invalid`.
 */
export function parsePickableAnswer(
  input: string,
  candidateCount: number,
): PickableAnswer {
  const trimmed = input.trim();

  if (trimmed === '') {
    return { kind: 'skipped' };
  }

  if (
    trimmed === 's' ||
    trimmed === 'S' ||
    trimmed === 'skip' ||
    trimmed === 'Skip' ||
    trimmed === 'SKIP'
  ) {
    return { kind: 'skipped' };
  }

  if (
    trimmed === 'q' ||
    trimmed === 'Q' ||
    trimmed === 'quit' ||
    trimmed === 'Quit' ||
    trimmed === 'QUIT' ||
    trimmed === 'abort' ||
    trimmed === 'Abort' ||
    trimmed === 'ABORT' ||
    trimmed === 'exit' ||
    trimmed === 'Exit' ||
    trimmed === 'EXIT'
  ) {
    return { kind: 'abort' };
  }

  if (!isPositiveInteger(trimmed)) {
    return { kind: 'invalid' };
  }

  const numeric = Number.parseInt(trimmed, 10);
  if (numeric < 1 || numeric > candidateCount) {
    return { kind: 'invalid' };
  }

  return { kind: 'selected', candidateIndex: numeric - 1 };
}

/**
 * Adapt a `node:readline/promises.Interface`-shaped object into a
 * `PromptQuestion`. The factory accepts the minimal `question`/`close`
 * surface so tests can pass a stub without instantiating a real readline
 * interface. Production wiring is `createStdinPrompt`, which uses
 * `node:readline/promises.createInterface({ input: process.stdin, ... })`.
 *
 * The trimmed string from `rl.question(message)` is returned as-is so the
 * caller can pass it to `parsePickableAnswer`. When the underlying reader
 * rejects (EOF, SIGINT, post-`close` call), the adapter returns `null`,
 * which the caller maps to `kind: 'abort'` per the D2 plan.
 */
export function createReadlinePrompt(
  rl: Pick<readlinePromises.Interface, 'question' | 'close'>,
): PromptQuestion {
  return async (message: string): Promise<string | null> => {
    try {
      const answer = await rl.question(message);
      return answer.trim();
    } catch {
      return null;
    }
  };
}

/**
 * Production helper. Builds a real `node:readline/promises` interface bound
 * to `process.stdin` / `process.stdout` and returns a `PromptQuestion`. This
 * is the only place `node:readline/promises` is imported — keeping it out of
 * the module top level lets unit tests exercise the pure parser/renderer
 * without pulling readline into the test bundle.
 *
 * `createStdinPrompt` is intentionally not unit-tested: calling it would
 * attach to the real process stdio and require a TTY fixture. Wave 2 command
 * tests inject a stubbed `createReadlinePrompt` adapter and cover the
 * interactive flow without touching real stdio.
 */
export function createStdinPrompt(): PromptQuestion {
  // Lazy import: keep readline out of the module top level so unit tests
  // can import the pure helpers without dragging readline into the bundle.
  const readlinePromises = createReadlinePromises();

  const rl = readlinePromises.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return createReadlinePrompt(rl);
}

interface ReadlinePromisesLike {
  createInterface(options: {
    readonly input: NodeJS.ReadableStream;
    readonly output: NodeJS.WritableStream;
  }): Pick<readlinePromises.Interface, 'question' | 'close'>;
}

function createReadlinePromises(): ReadlinePromisesLike {
  // `require` here is the lazy-load seam; tests never trigger this code path.

  const required = createReadlineRequire();
  return required('node:readline/promises') as ReadlinePromisesLike;
}

import { createRequire } from 'node:module';

function createReadlineRequire(): (specifier: string) => unknown {
  return createRequire(__filename);
}

function isPositiveInteger(text: string): boolean {
  if (text.length === 0) {
    return false;
  }
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 48 || code > 57) {
      return false;
    }
  }
  return true;
}
