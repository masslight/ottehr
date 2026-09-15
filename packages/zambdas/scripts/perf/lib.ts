/**
 * Shared plumbing for the zambda performance bench (see ./bench.ts).
 *
 * The bench runs the *real* handler through the *real* local-server express app in this process, so
 * every FHIR round trip is a real network call to the configured Oystehr backend. That makes it a
 * faithful measurement of the thing we're optimizing: wall time dominated by FHIR latency and by how
 * many round trips we serialize.
 *
 * Two capabilities live here:
 *   - `recorder`: patches globalThis.fetch (which is what the Oystehr SDK resolves at call time) to
 *     record a waterfall of every outbound request — start offset, duration, and a compact label.
 *     That waterfall is how N+1 patterns and accidentally-serialized awaits become visible.
 *   - `startBenchServer`: boots the local-server app on an ephemeral port and mints an admin token,
 *     mirroring what test/helpers/integration-global-setup.ts does for the integration suite.
 */
import Oystehr from '@oystehr/sdk';
import { Server } from 'http';
import type { AddressInfo } from 'net';
import app from '../../src/local-server/index';
import { getAuth0Token } from '../../src/shared/getAuth0Token';
import { SECRETS } from '../../test/data/secrets';

export interface RecordedCall {
  /** ms from the start of the current recording window to when the request was issued */
  startOffsetMs: number;
  durationMs: number;
  method: string;
  /** host of the request target, e.g. `fhir-api.zapehr.com` */
  host: string;
  /** compact, greppable label: resource type + the search params that matter */
  label: string;
  url: string;
}

class FetchRecorder {
  private original: typeof fetch | undefined;
  private windowStart = 0;
  private calls: RecordedCall[] = [];
  private enabled = false;

  install(): void {
    if (this.original) return;
    this.original = globalThis.fetch;
    const original = this.original;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      if (!this.enabled) return original(input, init);
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url ?? '';
      const method = (
        init?.method ??
        (typeof input === 'object' && 'method' in (input as Request) ? (input as Request).method : 'GET')
      ).toUpperCase();
      const startOffsetMs = performance.now() - this.windowStart;
      const started = performance.now();
      try {
        return await original(input, init);
      } finally {
        this.calls.push({
          startOffsetMs,
          durationMs: performance.now() - started,
          method,
          host: safeHost(url),
          label: labelForUrl(url, method),
          url,
        });
      }
    }) as typeof fetch;
  }

  /** Start a fresh recording window; all offsets are relative to this moment. */
  start(): void {
    this.windowStart = performance.now();
    this.calls = [];
    this.enabled = true;
  }

  stop(): RecordedCall[] {
    this.enabled = false;
    return [...this.calls].sort((a, b) => a.startOffsetMs - b.startOffsetMs);
  }
}

export const recorder = new FetchRecorder();

const safeHost = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
};

/**
 * Turns a FHIR URL into something short enough to read in a waterfall while still identifying the
 * query: `Provenance?target=Encounter/abc&agent-role=verifier` becomes
 * `Provenance?target=Encounter/abc,agent-role=verifier`. Long comma lists are collapsed to a count
 * so a batched `_id=a,b,c,...` search stays one line.
 */
const labelForUrl = (url: string, method: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `${method} ${url.slice(0, 80)}`;
  }
  const path = parsed.pathname.replace(/^\/r4\//, '').replace(/^\//, '');
  const params = [...parsed.searchParams.entries()]
    .filter(([key]) => !['_elements'].includes(key))
    .map(([key, value]) => {
      const parts = value.split(',');
      const shown = parts.length > 3 ? `${parts[0]}+${parts.length - 1}more` : value;
      return `${key}=${shown.slice(0, 60)}`;
    });
  return params.length ? `${path}?${params.join('&')}` : path;
};

export interface BenchServer {
  executeZambdaUrl: string;
  adminToken: string;
  oystehrAdmin: Oystehr;
  /** Client pointed at the local zambda server, for `zambda.execute` */
  oystehrZambda: Oystehr;
  close: () => Promise<void>;
}

export const startBenchServer = async (): Promise<BenchServer> => {
  const { AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;

  const { server, port } = await new Promise<{ server: Server; port: number }>((resolve, reject) => {
    const listener = app.listen(0, () => {
      const address = listener.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to determine bound port for bench server'));
        return;
      }
      resolve({ server: listener, port: (address as AddressInfo).port });
    });
    listener.on('error', reject);
  });

  const executeZambdaUrl = `http://localhost:${port}/local`;
  const adminToken = await getAuth0Token({
    AUTH0_ENDPOINT,
    AUTH0_CLIENT: SECRETS.AUTH0_CLIENT_TESTS,
    AUTH0_SECRET: SECRETS.AUTH0_SECRET_TESTS,
    AUTH0_AUDIENCE,
  });

  return {
    executeZambdaUrl,
    adminToken,
    oystehrAdmin: new Oystehr({ accessToken: adminToken, fhirApiUrl: FHIR_API, projectId: PROJECT_ID }),
    oystehrZambda: new Oystehr({
      accessToken: adminToken,
      fhirApiUrl: FHIR_API,
      projectApiUrl: executeZambdaUrl,
      services: { zambdaApiUrl: executeZambdaUrl },
      projectId: PROJECT_ID,
    }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

export interface Stats {
  n: number;
  min: number;
  median: number;
  p90: number;
  max: number;
  mean: number;
}

export const summarize = (samples: number[]): Stats => {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    n: sorted.length,
    min: sorted[0],
    median: at(0.5),
    p90: at(0.9),
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
};

export const fmt = (ms: number): string => `${ms.toFixed(0)}ms`;

/**
 * Prints the recorded waterfall for one invocation. Calls are grouped into "waves": a new wave starts
 * whenever a call is issued after every previously-seen call has already finished, which is exactly
 * the signature of a serialized await. Wave count is therefore the number of sequential FHIR round
 * trips on the critical path — the number we're trying to drive down.
 */
export const printWaterfall = (
  calls: RecordedCall[],
  opts: { hostFilter?: string; print?: (line: string) => void } = {}
): void => {
  const log = opts.print ?? say;
  const shown = opts.hostFilter ? calls.filter((c) => c.host.includes(opts.hostFilter!)) : calls;
  if (!shown.length) {
    log('  (no recorded calls)');
    return;
  }
  const waves = groupIntoWaves(shown);
  waves.forEach((wave, waveIndex) => {
    const waveStart = Math.min(...wave.map((c) => c.startOffsetMs));
    const waveEnd = Math.max(...wave.map((c) => c.startOffsetMs + c.durationMs));
    log(
      `  wave ${waveIndex + 1}  [${fmt(waveStart)} → ${fmt(waveEnd)}]  ${wave.length} call${
        wave.length === 1 ? '' : 's'
      }`
    );
    const byLabel = new Map<string, RecordedCall[]>();
    wave.forEach((call) => {
      const key = `${call.method} ${call.label.split('?')[0]}`;
      const list = byLabel.get(key) ?? [];
      list.push(call);
      byLabel.set(key, list);
    });
    for (const [key, group] of byLabel) {
      if (group.length > 1) {
        const total = group.reduce((a, c) => a + c.durationMs, 0);
        log(
          `    @${fmt(Math.min(...group.map((c) => c.startOffsetMs)))} ${key} ×${group.length}  (slowest ${fmt(
            Math.max(...group.map((c) => c.durationMs))
          )}, sum ${fmt(total)})`
        );
      } else {
        log(`    @${fmt(group[0].startOffsetMs)} +${fmt(group[0].durationMs)}  ${key}  ${group[0].label.slice(0, 90)}`);
      }
    }
  });
  log(`  total FHIR-ish calls: ${shown.length}, sequential waves: ${waves.length}`);
};

export const groupIntoWaves = (calls: RecordedCall[]): RecordedCall[][] => {
  const sorted = [...calls].sort((a, b) => a.startOffsetMs - b.startOffsetMs);
  const waves: RecordedCall[][] = [];
  let current: RecordedCall[] = [];
  let currentMaxEnd = -Infinity;
  for (const call of sorted) {
    if (current.length && call.startOffsetMs >= currentMaxEnd) {
      waves.push(current);
      current = [];
      currentMaxEnd = -Infinity;
    }
    current.push(call);
    currentMaxEnd = Math.max(currentMaxEnd, call.startOffsetMs + call.durationMs);
  }
  if (current.length) waves.push(current);
  return waves;
};

/**
 * Handlers log heavily (and the local server logs every request body), which buries the bench's own
 * output. Silence the noisy console methods for the duration of a run and hand back the raw ones so
 * the bench can still print. `console.time`/`timeEnd` are silenced too — the waterfall supersedes
 * them and is not interleaved with per-resource dumps.
 */
export const silenceHandlerLogs = (): { restore: () => void } => {
  const raw = {
    log: console.log,
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
    group: console.group,
    groupEnd: console.groupEnd,
    time: console.time,
    timeEnd: console.timeEnd,
  };
  const noop = (): void => undefined;
  Object.assign(console, {
    log: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    group: noop,
    groupEnd: noop,
    time: noop,
    timeEnd: noop,
  });
  return { restore: () => Object.assign(console, raw) };
};

/** Bench output. Writes straight to stdout so it survives `silenceHandlerLogs`. */
export const say = (line = ''): void => {
  process.stdout.write(`${line}\n`);
};
