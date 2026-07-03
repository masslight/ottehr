// Detailed console tracing for the ad-hoc report pipeline. Every stage (fetch → infer → generate →
// render, plus auto-repair and sandbox events) calls this, so a failure that would otherwise be
// swallowed is visible in the browser console. Also exposed on window as `showAdHocDebugLog` for
// manual poking, and dumps an error's stack when the payload is an Error.
const PREFIX = '%c[ad-hoc]';
const STYLE = 'color:#0a6; font-weight:600';

export function showAdHocDebugLog(scope: string, message: string, data?: unknown): void {
  const label = `${scope} — ${message}`;
  try {
    if (data instanceof Error) {
      console.error(PREFIX, STYLE, label, '\n', data.message, '\n', data.stack ?? '(no stack)');
    } else if (data !== undefined) {
      console.log(PREFIX, STYLE, label, data);
    } else {
      console.log(PREFIX, STYLE, label);
    }
  } catch {
    /* logging must never throw */
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as { showAdHocDebugLog?: typeof showAdHocDebugLog }).showAdHocDebugLog = showAdHocDebugLog;
}
