import type { RunResult, SubmitResult } from './api';

/** Something the learner just did, broadcast so decorative UI (like the companions) can react. */
export type Outcome =
  | { kind: 'run'; result: RunResult }
  | { kind: 'submit'; result: SubmitResult }
  | { kind: 'request-failed' };

const OUTCOME_EVENT = 'theshire:outcome';

export function emitOutcome(outcome: Outcome) {
  window.dispatchEvent(new CustomEvent<Outcome>(OUTCOME_EVENT, { detail: outcome }));
}

export function onOutcome(listener: (outcome: Outcome) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<Outcome>).detail);
  window.addEventListener(OUTCOME_EVENT, handler);
  return () => window.removeEventListener(OUTCOME_EVENT, handler);
}
