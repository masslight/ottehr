// Shared "POST /zambda/<id>/execute" helper for the synthetic-data dev scripts.
// One home for the bearer + x-zapehr-project-id headers and the status/output
// handling that synthesize-visit.ts (zambdaExecute + ~20 hand-rolled fetch
// sites), finalize-visit-orders.ts (zfetch), and the census re-implemented.
import { withRetry } from './retry';

/**
 * What a zambda call needs to know about the caller. Structurally satisfied by
 * synthesize-visit's SynthesisContext and by finalize-visit-orders' FinalizeCtx
 * (fields are nullable because the synth harness runs in plan mode with no auth;
 * zambda calls only happen in execute mode where all three are set).
 */
export interface ZambdaCtx {
  zambdaApi: string | null;
  accessToken: string | null;
  projectId: string | null;
}

export const zambdaHeaders = (ctx: ZambdaCtx): Record<string, string> => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${ctx.accessToken}`,
  'x-zapehr-project-id': ctx.projectId ?? '',
});

export interface ZambdaPostOptions {
  /** POST to /execute-public (intake-registered zambdas) instead of /execute. */
  execPublic?: boolean;
  /**
   * Wrap the POST in withRetry (transient network failures only — see retry.ts).
   * Only for idempotent calls; label defaults to the zambda id, attempts to 3.
   */
  retry?: { label?: string; attempts?: number };
}

/**
 * Raw POST to `<zambdaApi>/zambda/<id>/execute[-public]`, returning the raw
 * Response — callers keep their own status/body handling. Use zambdaExecute()
 * when you just want the parsed output.
 */
export const zambdaPost = async (
  ctx: ZambdaCtx,
  id: string,
  body: unknown,
  opts: ZambdaPostOptions = {}
): Promise<Response> => {
  const doPost = (): Promise<Response> =>
    fetch(`${ctx.zambdaApi}/zambda/${id}/${opts.execPublic ? 'execute-public' : 'execute'}`, {
      method: 'POST',
      headers: zambdaHeaders(ctx),
      body: JSON.stringify(body),
    });
  return opts.retry ? withRetry(opts.retry.label ?? id, opts.retry.attempts ?? 3, doPost) : doPost();
};

/**
 * POST + status check + parse: throws on a non-2xx response (message carries the
 * zambda id, status, and the first 300 chars of the body) and returns the
 * response's `output` field when present (the local zambda server wraps results),
 * the parsed body otherwise, or undefined for an empty body.
 */
export const zambdaExecute = async (
  ctx: ZambdaCtx,
  id: string,
  body: unknown,
  opts: ZambdaPostOptions = {}
): Promise<unknown> => {
  const res = await zambdaPost(ctx, id, body, opts);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${id} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  if (!text) return undefined;
  const parsed = JSON.parse(text) as { output?: unknown };
  return parsed.output ?? parsed;
};
