import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { Registry } from 'prom-client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  classifyTcpErrorCode,
  DEFAULT_CHECK_TIMEOUT_MS,
  DicomEchoError,
  loadConnectivityConfig,
  MirthEchoRequest,
  parseConnectivityConfig,
  performMirthDicomEcho,
  registerConnectivityMetrics,
  runConnectivityChecks,
  tcpConnect,
  TcpConnectError,
} from '../src/connectivityChecks';

// ── Test doubles ────────────────────────────────────────────────────

interface ReceivedRequest {
  method: string | undefined;
  url: string | undefined;
  headers: http.IncomingHttpHeaders;
  body: string;
}

type MirthHandler = (request: ReceivedRequest, response: http.ServerResponse) => void;

interface FakeMirth {
  port: number;
  url: string;
  requests: ReceivedRequest[];
  close: () => Promise<void>;
}

/** Plays the Mirth HTTP listener channel that performs the echo. */
const startFakeMirth = async (handler: MirthHandler): Promise<FakeMirth> => {
  const requests: ReceivedRequest[] = [];
  const sockets = new Set<net.Socket>();
  const server = http.createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
    });
    req.on('end', () => {
      const received = { method: req.method, url: req.url, headers: req.headers, body };
      requests.push(received);
      handler(received, res);
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  return {
    port,
    url: `http://127.0.0.1:${port}/dicom-echo`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        server.close(() => resolve());
      }),
  };
};

/** A port nothing listens on: bind to an ephemeral port, then release it. */
const getUnusedPort = async (): Promise<number> => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
};

const echoRequest: MirthEchoRequest = {
  target: 'lifesys-pacs',
  host: '172.30.3.149',
  port: 6696,
  calledAeTitle: 'LIFESYS',
  callingAeTitle: 'BRIDGELINK',
};

const expectEchoFailure = async (
  promise: Promise<unknown>,
  reason: DicomEchoError['reason']
): Promise<DicomEchoError> => {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(DicomEchoError);
  expect((caught as DicomEchoError).reason).toBe(reason);
  return caught as DicomEchoError;
};

// ── Config ──────────────────────────────────────────────────────────

describe('parseConnectivityConfig', () => {
  it('applies defaults and keeps what it was given', () => {
    const config = parseConnectivityConfig({
      mirthEchoUrl: 'http://localhost:8990/',
      targets: [
        { name: 'lifesys-pacs', host: '172.30.3.149', port: 6696, dicomEcho: { calledAeTitle: 'LIFESYS' } },
        { name: 'bridgelink', host: 'localhost', port: 8989 },
      ],
    });

    expect(config).toEqual({
      timeoutMs: DEFAULT_CHECK_TIMEOUT_MS,
      mirthEchoUrl: 'http://localhost:8990/',
      targets: [
        { name: 'lifesys-pacs', host: '172.30.3.149', port: 6696, dicomEcho: { calledAeTitle: 'LIFESYS' } },
        { name: 'bridgelink', host: 'localhost', port: 8989 },
      ],
    });
  });

  it('honours an explicit timeout and calling AE title', () => {
    const config = parseConnectivityConfig({
      timeoutMs: 1500,
      mirthEchoUrl: 'https://mirth.example/echo',
      targets: [{ name: 'a', host: 'h', port: 1, dicomEcho: { calledAeTitle: 'SCP', callingAeTitle: 'BRIDGELINK' } }],
    });
    expect(config.timeoutMs).toBe(1500);
    expect(config.targets[0].dicomEcho).toEqual({ calledAeTitle: 'SCP', callingAeTitle: 'BRIDGELINK' });
  });

  it('does not need a Mirth URL when no target asks for an echo', () => {
    const config = parseConnectivityConfig({ targets: [{ name: 'a', host: 'h', port: 1 }] });
    expect(config.mirthEchoUrl).toBeUndefined();
  });

  it.each([
    ['not an object', [], /JSON object/],
    ['missing targets', {}, /targets must be an array/],
    ['a non-object target', { targets: [1] }, /targets\[0\] must be an object/],
    ['an empty name', { targets: [{ name: ' ', host: 'h', port: 1 }] }, /name must be/],
    ['a missing host', { targets: [{ name: 'a', port: 1 }] }, /host must be/],
    ['a port out of range', { targets: [{ name: 'a', host: 'h', port: 70000 }] }, /port must be/],
    ['a string port', { targets: [{ name: 'a', host: 'h', port: '6696' }] }, /port must be/],
    ['a bad timeout', { timeoutMs: 0, targets: [] }, /timeoutMs must be/],
    [
      'duplicate names',
      {
        targets: [
          { name: 'a', host: 'h', port: 1 },
          { name: 'a', host: 'h', port: 2 },
        ],
      },
      /duplicate/,
    ],
    [
      'an echo target without a Mirth URL',
      { targets: [{ name: 'a', host: 'h', port: 1, dicomEcho: { calledAeTitle: 'SCP' } }] },
      /mirthEchoUrl is required/,
    ],
    ['a Mirth URL that is not a URL', { mirthEchoUrl: 'not a url', targets: [] }, /not a valid URL/],
    ['a non-http Mirth URL', { mirthEchoUrl: 'ftp://mirth/echo', targets: [] }, /http or https/],
    [
      'a dicomEcho block without an AE title',
      { mirthEchoUrl: 'http://m/', targets: [{ name: 'a', host: 'h', port: 1, dicomEcho: {} }] },
      /calledAeTitle/,
    ],
    [
      'a 17 character AE title',
      {
        mirthEchoUrl: 'http://m/',
        targets: [{ name: 'a', host: 'h', port: 1, dicomEcho: { calledAeTitle: 'ABCDEFGHIJKLMNOPQ' } }],
      },
      /calledAeTitle/,
    ],
    [
      'an AE title with a backslash',
      { mirthEchoUrl: 'http://m/', targets: [{ name: 'a', host: 'h', port: 1, dicomEcho: { calledAeTitle: 'A\\B' } }] },
      /calledAeTitle/,
    ],
  ])('rejects %s', (_label, raw, message) => {
    expect(() => parseConnectivityConfig(raw)).toThrow(message);
  });
});

describe('loadConnectivityConfig', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pacs-poll-connectivity-'));

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns undefined when the file does not exist', () => {
    expect(loadConnectivityConfig(path.join(dir, 'missing.json'))).toBeUndefined();
  });

  it('loads a valid file', () => {
    const file = path.join(dir, 'connectivity.json');
    writeFileSync(file, JSON.stringify({ targets: [{ name: 'a', host: 'h', port: 1 }] }));
    expect(loadConnectivityConfig(file)?.targets).toHaveLength(1);
  });

  it('names the file when it is malformed or invalid', () => {
    const malformed = path.join(dir, 'malformed.json');
    writeFileSync(malformed, '{ not json');
    expect(() => loadConnectivityConfig(malformed)).toThrow(/Could not parse connectivity config .*malformed\.json/);

    const invalid = path.join(dir, 'invalid.json');
    writeFileSync(invalid, JSON.stringify({ targets: 'nope' }));
    expect(() => loadConnectivityConfig(invalid)).toThrow(/Invalid connectivity config .*invalid\.json: targets/);
  });
});

// ── TCP ─────────────────────────────────────────────────────────────

describe('tcpConnect', () => {
  it('classifies socket error codes into a bounded set of reasons', () => {
    expect(classifyTcpErrorCode('ECONNREFUSED')).toBe('refused');
    expect(classifyTcpErrorCode('EHOSTUNREACH')).toBe('unreachable');
    expect(classifyTcpErrorCode('ENOTFOUND')).toBe('dns_error');
    expect(classifyTcpErrorCode('ETIMEDOUT')).toBe('timeout');
    expect(classifyTcpErrorCode('ECONNRESET')).toBe('reset');
    expect(classifyTcpErrorCode('EPROTO')).toBe('error');
    expect(classifyTcpErrorCode(undefined)).toBe('error');
  });

  it('resolves against a listening port without sending anything', async () => {
    const mirth = await startFakeMirth((_request, response) => response.end());
    try {
      await expect(tcpConnect({ host: '127.0.0.1', port: mirth.port, timeoutMs: 1000 })).resolves.toBeUndefined();
      expect(mirth.requests).toHaveLength(0);
    } finally {
      await mirth.close();
    }
  });

  it('rejects with reason "refused" when nothing listens', async () => {
    const port = await getUnusedPort();
    let caught: unknown;
    try {
      await tcpConnect({ host: '127.0.0.1', port, timeoutMs: 1000 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TcpConnectError);
    expect((caught as TcpConnectError).reason).toBe('refused');
  });
});

// ── DICOM echo via Mirth ────────────────────────────────────────────

describe('performMirthDicomEcho', () => {
  let mirth: FakeMirth | undefined;

  afterEach(async () => {
    await mirth?.close();
    mirth = undefined;
  });

  it('POSTs the target as JSON and resolves with the body on a 2xx answer', async () => {
    mirth = await startFakeMirth((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('Connected to LIFESYS@172.30.3.149:6696\nC-ECHO-RSP status 0H\n');
    });

    await expect(performMirthDicomEcho(mirth.url, echoRequest, 2000)).resolves.toBe(
      'Connected to LIFESYS@172.30.3.149:6696 C-ECHO-RSP status 0H'
    );

    expect(mirth.requests).toHaveLength(1);
    const [request] = mirth.requests;
    expect(request.method).toBe('POST');
    expect(request.url).toBe('/dicom-echo');
    expect(request.headers['content-type']).toBe('application/json');
    expect(JSON.parse(request.body)).toEqual(echoRequest);
  });

  it('reports a non-2xx answer as a failed echo, quoting the body', async () => {
    mirth = await startFakeMirth((_request, response) => {
      response.writeHead(502);
      response.end('A-ASSOCIATE-RJ: called AE title not recognized');
    });

    const error = await expectEchoFailure(performMirthDicomEcho(mirth.url, echoRequest, 2000), 'echo_failed');
    expect(error.message).toContain('502');
    expect(error.message).toContain('called AE title not recognized');
  });

  it('truncates a long failure body in the error message', async () => {
    mirth = await startFakeMirth((_request, response) => {
      response.writeHead(500);
      response.end('x'.repeat(2000));
    });

    const error = await expectEchoFailure(performMirthDicomEcho(mirth.url, echoRequest, 2000), 'echo_failed');
    expect(error.message.length).toBeLessThan(400);
    expect(error.message).toContain('…');
  });

  it('reports a Mirth channel that never answers as a timeout', async () => {
    mirth = await startFakeMirth(() => undefined);

    const started = Date.now();
    const error = await expectEchoFailure(performMirthDicomEcho(mirth.url, echoRequest, 300), 'timeout');
    expect(error.message).toContain('300ms');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('reports a Mirth listener that is not running as unreachable', async () => {
    const port = await getUnusedPort();

    const error = await expectEchoFailure(
      performMirthDicomEcho(`http://127.0.0.1:${port}/dicom-echo`, echoRequest, 2000),
      'mirth_unreachable'
    );
    expect(error.message).toContain('ECONNREFUSED');
  });
});

// ── Runner + metrics ────────────────────────────────────────────────

describe('runConnectivityChecks', () => {
  const register = new Registry();
  registerConnectivityMetrics(register);
  let mirth: FakeMirth | undefined;

  const metricValue = async (name: string, labels: Record<string, string | number>): Promise<number | undefined> => {
    const metric = (await register.getMetricsAsJSON()).find((candidate) => candidate.name === name);
    return metric?.values.find((sample) =>
      Object.entries(labels).every(([key, value]) => String(sample.labels[key]) === String(value))
    )?.value;
  };

  beforeEach(() => register.resetMetrics());

  afterEach(async () => {
    await mirth?.close();
    mirth = undefined;
  });

  it('records success and failure for TCP and DICOM echo per target', async () => {
    // Mirth succeeds only for the LIFESYS AE title.
    mirth = await startFakeMirth((request, response) => {
      const body = JSON.parse(request.body) as MirthEchoRequest;
      if (body.calledAeTitle === 'LIFESYS') {
        response.writeHead(200);
        response.end('C-ECHO-RSP status 0H');
      } else {
        response.writeHead(500);
        response.end('A-ASSOCIATE-RJ');
      }
    });
    const deadPort = await getUnusedPort();
    const before = Date.now() / 1000 - 1;

    await runConnectivityChecks({
      timeoutMs: 2000,
      mirthEchoUrl: mirth.url,
      targets: [
        { name: 'good', host: '127.0.0.1', port: mirth.port, dicomEcho: { calledAeTitle: 'LIFESYS' } },
        { name: 'bad-ae', host: '127.0.0.1', port: mirth.port, dicomEcho: { calledAeTitle: 'WRONG' } },
        { name: 'dead', host: '127.0.0.1', port: deadPort },
      ],
    });

    const good = { target: 'good', host: '127.0.0.1', port: mirth.port };
    expect(await metricValue('pacs_poll_tcp_connect_success', good)).toBe(1);
    expect(await metricValue('pacs_poll_tcp_connect_duration_seconds', good)).toBeGreaterThanOrEqual(0);
    expect(await metricValue('pacs_poll_tcp_connect_last_success_timestamp_seconds', good)).toBeGreaterThan(before);
    expect(await metricValue('pacs_poll_dicom_echo_success', { ...good, called_ae: 'LIFESYS' })).toBe(1);
    expect(
      await metricValue('pacs_poll_dicom_echo_last_success_timestamp_seconds', { ...good, called_ae: 'LIFESYS' })
    ).toBeGreaterThan(before);
    expect(await metricValue('pacs_poll_tcp_connect_failures_total', { target: 'good' })).toBeUndefined();

    const badAe = { target: 'bad-ae', host: '127.0.0.1', port: mirth.port, called_ae: 'WRONG' };
    expect(await metricValue('pacs_poll_tcp_connect_success', { target: 'bad-ae' })).toBe(1);
    expect(await metricValue('pacs_poll_dicom_echo_success', badAe)).toBe(0);
    expect(await metricValue('pacs_poll_dicom_echo_failures_total', { ...badAe, reason: 'echo_failed' })).toBe(1);
    expect(await metricValue('pacs_poll_dicom_echo_last_success_timestamp_seconds', badAe)).toBeUndefined();

    const dead = { target: 'dead', host: '127.0.0.1', port: deadPort };
    expect(await metricValue('pacs_poll_tcp_connect_success', dead)).toBe(0);
    expect(await metricValue('pacs_poll_tcp_connect_failures_total', { ...dead, reason: 'refused' })).toBe(1);
    expect(await metricValue('pacs_poll_tcp_connect_last_success_timestamp_seconds', dead)).toBeUndefined();
    expect(await metricValue('pacs_poll_dicom_echo_success', { target: 'dead' })).toBeUndefined();

    // Mirth was asked once per echo target, with the target's own host and port.
    const echoed = mirth.requests.map((request) => JSON.parse(request.body) as MirthEchoRequest);
    expect(echoed.map((request) => request.target).sort()).toEqual(['bad-ae', 'good']);
    expect(echoed.every((request) => request.host === '127.0.0.1' && request.port === mirth?.port)).toBe(true);
  });

  it('records Mirth being down as its own failure reason, across cycles', async () => {
    const mirthPort = await getUnusedPort();
    const listener = await startFakeMirth((_request, response) => response.end());
    mirth = listener;
    const target = {
      name: 'lifesys',
      host: '127.0.0.1',
      port: listener.port,
      dicomEcho: { calledAeTitle: 'LIFESYS' },
    };
    const config = { timeoutMs: 2000, mirthEchoUrl: `http://127.0.0.1:${mirthPort}/dicom-echo`, targets: [target] };

    await runConnectivityChecks(config);
    await runConnectivityChecks(config);

    const labels = { target: 'lifesys', called_ae: 'LIFESYS' };
    expect(await metricValue('pacs_poll_tcp_connect_success', { target: 'lifesys' })).toBe(1);
    expect(await metricValue('pacs_poll_dicom_echo_success', labels)).toBe(0);
    expect(await metricValue('pacs_poll_dicom_echo_failures_total', { ...labels, reason: 'mirth_unreachable' })).toBe(
      2
    );
  });
});
