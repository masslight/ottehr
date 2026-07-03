// Messaging from the sandboxed iframe to the SPA. Two kinds of message cross the boundary, both
// plain JSON — never functions or code:
//   - frame lifecycle (internal plumbing): { type: 'ready' | 'rendered' | 'resize' | 'error', ... }
//   - integration events (the app contract):   { event: string, options: { type, ...fields } }
// The SPA validates integration events against its whitelist (AdHocFrameEventSchema), ignores the rest.
// Type-only import: keep the utils package out of the iframe bundle.
import type { AdHocFrameEvent } from 'utils';

export type LifecycleMessage =
  | { type: 'ready' }
  | { type: 'rendered'; height: number }
  | { type: 'resize'; height: number }
  // fatal=false: the report already rendered and a later interaction/async error occurred — the SPA
  // logs it but must NOT regenerate a working report. Absent/true: generation-time failure.
  | { type: 'error'; message: string; fatal?: boolean };

function post(message: unknown): void {
  try {
    window.parent.postMessage(message, '*');
  } catch {
    // Never crash the frame over a failed postMessage.
  }
}

export const sendLifecycle = (message: LifecycleMessage): void => post(message);

/** Emit a whitelisted integration event to the SPA (e.g. openLink). */
export const sendFrameEvent = (event: AdHocFrameEvent): void => post(event);

export const measureHeight = (): number => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
