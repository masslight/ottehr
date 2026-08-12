/**
 * Opt-in verbose logging for the paperwork and booking helpers.
 *
 * Those helpers narrate every field they touch. Locally that is exactly what you want; in CI the
 * generated booking suite fills hundreds of fields across parallel workers and the narration reaches
 * roughly 800 lines per second. That volume has a real cost beyond noise: the GitHub API only serves
 * the tail of a job log, so a run this chatty pushes its own setup steps — which bundle was used,
 * what was downloaded, what was discarded — past the point where they can be read back at all.
 *
 * The per-page and per-error logging stays on unconditionally; only the per-field narration and the
 * full-object dumps are gated here. Set E2E_VERBOSE_PAPERWORK=true to get them back.
 */
export const verbosePaperworkLogging = process.env.E2E_VERBOSE_PAPERWORK === 'true';

export function logVerbose(...args: unknown[]): void {
  if (verbosePaperworkLogging) {
    console.log(...args);
  }
}
