import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { Counter, Gauge, Registry } from 'prom-client';

/**
 * Network reachability checks run once per poll cycle, so Prometheus can tell "the tunnel to the
 * remote PACS is down" apart from "there was nothing to send".
 *
 * Every target gets a plain TCP connect from this host; bridgelink runs with host networking, so that
 * exercises the same route Mirth uses. Targets with a `dicomEcho` block additionally get a DICOM
 * C-ECHO, performed by Mirth itself: pacs-poll POSTs the target to a Mirth HTTP listener and Mirth
 * answers 2xx when the echo succeeded. The echo therefore exercises the real sender, with its AE title
 * and its DICOM stack, rather than a stand-in on this host.
 */

export const DEFAULT_CHECK_TIMEOUT_MS = 10000;

export interface DicomEchoTargetConfig {
  /** AE title of the SCP Mirth should echo. */
  calledAeTitle: string;
  /** AE title Mirth should present; when omitted the Mirth channel uses its own default. */
  callingAeTitle?: string;
}

export interface ConnectivityTarget {
  /** Stable, human readable name; becomes the `target` metric label. */
  name: string;
  host: string;
  port: number;
  dicomEcho?: DicomEchoTargetConfig;
}

export interface ConnectivityConfig {
  timeoutMs: number;
  /** Mirth HTTP listener that performs C-ECHOs; required when any target has a `dicomEcho` block. */
  mirthEchoUrl?: string;
  targets: ConnectivityTarget[];
}

// ── Config ──────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// 1-16 characters from the default repertoire, no backslash or control characters, not all spaces (PS3.5 6.2).
const parseAeTitle = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !/^[ -~]{1,16}$/.test(value) || value.includes('\\') || value.trim() === '') {
    throw new Error(`${label} must be 1-16 printable ASCII characters without backslashes`);
  }
  return value;
};

const parseTarget = (value: unknown, index: number): ConnectivityTarget => {
  const label = `targets[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  const { name, host, port, dicomEcho } = value;
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(`${label}.name must be a non-empty string`);
  }
  if (typeof host !== 'string' || host.trim() === '') {
    throw new Error(`${label}.host must be a non-empty string`);
  }
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label}.port must be an integer between 1 and 65535`);
  }
  const target: ConnectivityTarget = { name, host, port };
  if (dicomEcho !== undefined) {
    if (!isRecord(dicomEcho)) {
      throw new Error(`${label}.dicomEcho must be an object`);
    }
    target.dicomEcho = { calledAeTitle: parseAeTitle(dicomEcho.calledAeTitle, `${label}.dicomEcho.calledAeTitle`) };
    if (dicomEcho.callingAeTitle !== undefined) {
      target.dicomEcho.callingAeTitle = parseAeTitle(dicomEcho.callingAeTitle, `${label}.dicomEcho.callingAeTitle`);
    }
  }
  return target;
};

const parseMirthEchoUrl = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error('mirthEchoUrl must be a string');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`mirthEchoUrl "${value}" is not a valid URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('mirthEchoUrl must be an http or https URL');
  }
  return value;
};

export const parseConnectivityConfig = (raw: unknown): ConnectivityConfig => {
  if (!isRecord(raw)) {
    throw new Error('connectivity config must be a JSON object');
  }
  const timeoutMs = raw.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS;
  if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('timeoutMs must be a positive integer number of milliseconds');
  }
  if (!Array.isArray(raw.targets)) {
    throw new Error('targets must be an array');
  }
  const targets = raw.targets.map(parseTarget);
  const names = new Set<string>();
  for (const target of targets) {
    if (names.has(target.name)) {
      throw new Error(`duplicate target name "${target.name}"`);
    }
    names.add(target.name);
  }
  const mirthEchoUrl = raw.mirthEchoUrl === undefined ? undefined : parseMirthEchoUrl(raw.mirthEchoUrl);
  if (mirthEchoUrl === undefined && targets.some((target) => target.dicomEcho)) {
    throw new Error('mirthEchoUrl is required when a target has a dicomEcho block');
  }
  return mirthEchoUrl === undefined ? { timeoutMs, targets } : { timeoutMs, mirthEchoUrl, targets };
};

/** Returns undefined when no config file exists; throws when one exists but is unusable. */
export const loadConnectivityConfig = (configPath: string): ConnectivityConfig | undefined => {
  if (!existsSync(configPath)) {
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse connectivity config ${configPath}: ${(error as Error).message}`);
  }
  try {
    return parseConnectivityConfig(raw);
  } catch (error) {
    throw new Error(`Invalid connectivity config ${configPath}: ${(error as Error).message}`);
  }
};

// ── TCP connect check ───────────────────────────────────────────────

export type TcpConnectFailureReason = 'timeout' | 'refused' | 'unreachable' | 'dns_error' | 'reset' | 'error';

export class TcpConnectError extends Error {
  readonly reason: TcpConnectFailureReason;

  constructor(reason: TcpConnectFailureReason, message: string) {
    super(message);
    this.name = 'TcpConnectError';
    this.reason = reason;
  }
}

export const classifyTcpErrorCode = (code: string | undefined): TcpConnectFailureReason => {
  switch (code) {
    case 'ECONNREFUSED':
      return 'refused';
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
    case 'EHOSTDOWN':
    case 'ENETDOWN':
      return 'unreachable';
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
    case 'EAI_FAIL':
    case 'EAI_NONAME':
      return 'dns_error';
    case 'ETIMEDOUT':
      return 'timeout';
    case 'ECONNRESET':
      return 'reset';
    default:
      return 'error';
  }
};

export interface TcpConnectOptions {
  host: string;
  port: number;
  timeoutMs: number;
}

/** Opens a TCP connection and closes it again as soon as the handshake completes. */
export const tcpConnect = ({ host, port, timeoutMs }: TcpConnectOptions): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    socket.setTimeout(timeoutMs, () => finish(new TcpConnectError('timeout', `no connection within ${timeoutMs}ms`)));
    socket.once('error', (error: NodeJS.ErrnoException) => {
      finish(new TcpConnectError(classifyTcpErrorCode(error.code), `${error.code ?? 'error'}: ${error.message}`));
    });
    socket.once('connect', () => finish());
  });

// ── DICOM echo via Mirth ────────────────────────────────────────────

export type DicomEchoFailureReason = 'timeout' | 'mirth_unreachable' | 'echo_failed' | 'error';

export class DicomEchoError extends Error {
  readonly reason: DicomEchoFailureReason;

  constructor(reason: DicomEchoFailureReason, message: string) {
    super(message);
    this.name = 'DicomEchoError';
    this.reason = reason;
  }
}

/** Body POSTed to the Mirth echo channel. */
export interface MirthEchoRequest {
  target: string;
  host: string;
  port: number;
  calledAeTitle: string;
  callingAeTitle?: string;
}

const MAX_LOGGED_BODY_LENGTH = 300;

const summarizeBody = (body: string): string => {
  const singleLine = body.replace(/\s+/g, ' ').trim();
  return singleLine.length > MAX_LOGGED_BODY_LENGTH ? `${singleLine.slice(0, MAX_LOGGED_BODY_LENGTH)}…` : singleLine;
};

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

const describeFetchError = (error: unknown): string => {
  const cause = (error as { cause?: { code?: string; message?: string } }).cause;
  return cause?.code ?? cause?.message ?? (error as Error).message;
};

/**
 * Asks Mirth to C-ECHO the target. Mirth answers 2xx when the echo succeeded and anything else when it
 * failed; the response body (for example the dcm4che output) is passed back for logging either way.
 */
export const performMirthDicomEcho = async (
  mirthEchoUrl: string,
  request: MirthEchoRequest,
  timeoutMs: number
): Promise<string> => {
  const signal = AbortSignal.timeout(timeoutMs);
  let response: Response;
  try {
    response = await fetch(mirthEchoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new DicomEchoError('timeout', `Mirth did not answer within ${timeoutMs}ms`);
    }
    throw new DicomEchoError(
      'mirth_unreachable',
      `could not reach Mirth at ${mirthEchoUrl}: ${describeFetchError(error)}`
    );
  }

  let body: string;
  try {
    body = summarizeBody(await response.text());
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new DicomEchoError('timeout', `Mirth did not finish answering within ${timeoutMs}ms`);
    }
    body = '';
  }
  if (!response.ok) {
    throw new DicomEchoError('echo_failed', `Mirth answered ${response.status}${body ? `: ${body}` : ''}`);
  }
  return body;
};

// ── Metrics ─────────────────────────────────────────────────────────

const tcpLabelNames = ['target', 'host', 'port'] as const;
const dicomLabelNames = ['target', 'host', 'port', 'called_ae'] as const;

const tcpConnectSuccess = new Gauge({
  name: 'pacs_poll_tcp_connect_success',
  help: '1 if the last TCP connection attempt to the target succeeded, 0 if it failed',
  labelNames: tcpLabelNames,
  registers: [],
});

const tcpConnectDuration = new Gauge({
  name: 'pacs_poll_tcp_connect_duration_seconds',
  help: 'Duration of the last TCP connection attempt to the target',
  labelNames: tcpLabelNames,
  registers: [],
});

const tcpConnectLastSuccess = new Gauge({
  name: 'pacs_poll_tcp_connect_last_success_timestamp_seconds',
  help: 'Unix timestamp of the last successful TCP connection to the target',
  labelNames: tcpLabelNames,
  registers: [],
});

const tcpConnectFailures = new Counter({
  name: 'pacs_poll_tcp_connect_failures_total',
  help: 'Total failed TCP connection attempts to the target, by failure reason',
  labelNames: [...tcpLabelNames, 'reason'] as const,
  registers: [],
});

const dicomEchoSuccess = new Gauge({
  name: 'pacs_poll_dicom_echo_success',
  help: '1 if the last DICOM C-ECHO sent by Mirth to the target succeeded, 0 if it failed',
  labelNames: dicomLabelNames,
  registers: [],
});

const dicomEchoDuration = new Gauge({
  name: 'pacs_poll_dicom_echo_duration_seconds',
  help: 'Duration of the last DICOM C-ECHO round trip through Mirth to the target',
  labelNames: dicomLabelNames,
  registers: [],
});

const dicomEchoLastSuccess = new Gauge({
  name: 'pacs_poll_dicom_echo_last_success_timestamp_seconds',
  help: 'Unix timestamp of the last successful DICOM C-ECHO sent by Mirth to the target',
  labelNames: dicomLabelNames,
  registers: [],
});

const dicomEchoFailures = new Counter({
  name: 'pacs_poll_dicom_echo_failures_total',
  help: 'Total failed DICOM C-ECHO attempts through Mirth to the target, by failure reason',
  labelNames: [...dicomLabelNames, 'reason'] as const,
  registers: [],
});

export const registerConnectivityMetrics = (register: Registry): void => {
  register.registerMetric(tcpConnectSuccess);
  register.registerMetric(tcpConnectDuration);
  register.registerMetric(tcpConnectLastSuccess);
  register.registerMetric(tcpConnectFailures);
  register.registerMetric(dicomEchoSuccess);
  register.registerMetric(dicomEchoDuration);
  register.registerMetric(dicomEchoLastSuccess);
  register.registerMetric(dicomEchoFailures);
};

// ── Runner ──────────────────────────────────────────────────────────

const elapsedSeconds = (start: number): number => (performance.now() - start) / 1000;

const formatMs = (seconds: number): string => `${Math.round(seconds * 1000)}ms`;

interface CheckOutcome {
  ok: boolean;
  summary: string;
}

const checkTcp = async (target: ConnectivityTarget, timeoutMs: number): Promise<CheckOutcome> => {
  const labels = { target: target.name, host: target.host, port: target.port };
  const start = performance.now();
  try {
    await tcpConnect({ host: target.host, port: target.port, timeoutMs });
    const seconds = elapsedSeconds(start);
    tcpConnectSuccess.set(labels, 1);
    tcpConnectDuration.set(labels, seconds);
    tcpConnectLastSuccess.setToCurrentTime(labels);
    return { ok: true, summary: `tcp ok in ${formatMs(seconds)}` };
  } catch (error) {
    const seconds = elapsedSeconds(start);
    const reason = error instanceof TcpConnectError ? error.reason : 'error';
    tcpConnectSuccess.set(labels, 0);
    tcpConnectDuration.set(labels, seconds);
    tcpConnectFailures.inc({ ...labels, reason });
    return {
      ok: false,
      summary: `tcp FAILED (${reason}) after ${formatMs(seconds)}: ${(error as Error).message}`,
    };
  }
};

const checkDicomEcho = async (
  target: ConnectivityTarget,
  echo: DicomEchoTargetConfig,
  mirthEchoUrl: string,
  timeoutMs: number
): Promise<CheckOutcome> => {
  const labels = { target: target.name, host: target.host, port: target.port, called_ae: echo.calledAeTitle };
  const start = performance.now();
  try {
    await performMirthDicomEcho(
      mirthEchoUrl,
      {
        target: target.name,
        host: target.host,
        port: target.port,
        calledAeTitle: echo.calledAeTitle,
        ...(echo.callingAeTitle === undefined ? {} : { callingAeTitle: echo.callingAeTitle }),
      },
      timeoutMs
    );
    const seconds = elapsedSeconds(start);
    dicomEchoSuccess.set(labels, 1);
    dicomEchoDuration.set(labels, seconds);
    dicomEchoLastSuccess.setToCurrentTime(labels);
    return { ok: true, summary: `dicom echo to ${echo.calledAeTitle} via Mirth ok in ${formatMs(seconds)}` };
  } catch (error) {
    const seconds = elapsedSeconds(start);
    const reason = error instanceof DicomEchoError ? error.reason : 'error';
    dicomEchoSuccess.set(labels, 0);
    dicomEchoDuration.set(labels, seconds);
    dicomEchoFailures.inc({ ...labels, reason });
    return {
      ok: false,
      summary: `dicom echo to ${echo.calledAeTitle} via Mirth FAILED (${reason}) after ${formatMs(seconds)}: ${
        (error as Error).message
      }`,
    };
  }
};

/** Checks every target concurrently. Never rejects: failures are recorded in the metrics and logged. */
export const runConnectivityChecks = async (config: ConnectivityConfig): Promise<void> => {
  await Promise.all(
    config.targets.map(async (target) => {
      const checks = [checkTcp(target, config.timeoutMs)];
      if (target.dicomEcho && config.mirthEchoUrl) {
        checks.push(checkDicomEcho(target, target.dicomEcho, config.mirthEchoUrl, config.timeoutMs));
      }
      const outcomes = await Promise.all(checks);
      const summaries = outcomes.map((outcome) => outcome.summary).join('; ');
      const line = `Connectivity check ${target.name} (${target.host}:${target.port}): ${summaries}`;
      if (outcomes.some((outcome) => !outcome.ok)) {
        console.error(line);
      } else {
        console.log(line);
      }
    })
  );
};
