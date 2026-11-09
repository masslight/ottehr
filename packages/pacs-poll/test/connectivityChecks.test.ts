import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Registry } from 'prom-client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  classifyTcpErrorCode,
  DEFAULT_CALLING_AE_TITLE,
  DEFAULT_CHECK_TIMEOUT_MS,
  loadConnectivityConfig,
  parseConnectivityConfig,
  registerConnectivityMetrics,
  runConnectivityChecks,
  tcpConnect,
  TcpConnectError,
} from '../src/connectivityChecks';
import { FakeScp, getUnusedPort, SCP_AE_TITLE, startFakeScp, wellBehavedScp } from './helpers/fakeDicomScp';

describe('parseConnectivityConfig', () => {
  it('applies defaults and keeps what it was given', () => {
    const config = parseConnectivityConfig({
      targets: [
        { name: 'lifesys-pacs', host: '172.30.3.149', port: 6696, dicomEcho: { calledAeTitle: 'LIFESYS' } },
        { name: 'bridgelink', host: 'localhost', port: 8989 },
      ],
    });

    expect(config).toEqual({
      timeoutMs: DEFAULT_CHECK_TIMEOUT_MS,
      targets: [
        {
          name: 'lifesys-pacs',
          host: '172.30.3.149',
          port: 6696,
          dicomEcho: { calledAeTitle: 'LIFESYS', callingAeTitle: DEFAULT_CALLING_AE_TITLE },
        },
        { name: 'bridgelink', host: 'localhost', port: 8989 },
      ],
    });
  });

  it('honours an explicit timeout and calling AE title', () => {
    const config = parseConnectivityConfig({
      timeoutMs: 1500,
      targets: [{ name: 'a', host: 'h', port: 1, dicomEcho: { calledAeTitle: 'SCP', callingAeTitle: 'OTTEHR' } }],
    });
    expect(config.timeoutMs).toBe(1500);
    expect(config.targets[0].dicomEcho?.callingAeTitle).toBe('OTTEHR');
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
      'a dicomEcho block without an AE title',
      { targets: [{ name: 'a', host: 'h', port: 1, dicomEcho: {} }] },
      /calledAeTitle/,
    ],
    [
      'a 17 character AE title',
      { targets: [{ name: 'a', host: 'h', port: 1, dicomEcho: { calledAeTitle: 'ABCDEFGHIJKLMNOPQ' } }] },
      /calledAeTitle/,
    ],
    [
      'an AE title with a backslash',
      { targets: [{ name: 'a', host: 'h', port: 1, dicomEcho: { calledAeTitle: 'A\\B' } }] },
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

  it('resolves against a listening port and closes the socket', async () => {
    const scp = await startFakeScp(() => undefined);
    try {
      await expect(tcpConnect({ host: '127.0.0.1', port: scp.port, timeoutMs: 1000 })).resolves.toBeUndefined();
      expect(scp.received).toHaveLength(0);
    } finally {
      await scp.close();
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

describe('runConnectivityChecks', () => {
  const register = new Registry();
  registerConnectivityMetrics(register);
  let scp: FakeScp | undefined;

  const metricValue = async (name: string, labels: Record<string, string | number>): Promise<number | undefined> => {
    const metric = (await register.getMetricsAsJSON()).find((candidate) => candidate.name === name);
    return metric?.values.find((sample) =>
      Object.entries(labels).every(([key, value]) => String(sample.labels[key]) === String(value))
    )?.value;
  };

  beforeEach(() => register.resetMetrics());

  afterEach(async () => {
    await scp?.close();
    scp = undefined;
  });

  it('records success and failure for TCP and DICOM echo per target', async () => {
    scp = await startFakeScp(wellBehavedScp);
    const deadPort = await getUnusedPort();
    const before = Date.now() / 1000 - 1;

    await runConnectivityChecks({
      timeoutMs: 2000,
      targets: [
        {
          name: 'good',
          host: '127.0.0.1',
          port: scp.port,
          dicomEcho: { calledAeTitle: SCP_AE_TITLE, callingAeTitle: 'PACS_POLL' },
        },
        {
          name: 'dead',
          host: '127.0.0.1',
          port: deadPort,
          dicomEcho: { calledAeTitle: SCP_AE_TITLE, callingAeTitle: 'PACS_POLL' },
        },
        { name: 'tcp-only', host: '127.0.0.1', port: scp.port },
      ],
    });

    const good = { target: 'good', host: '127.0.0.1', port: scp.port };
    expect(await metricValue('pacs_poll_tcp_connect_success', good)).toBe(1);
    expect(await metricValue('pacs_poll_tcp_connect_duration_seconds', good)).toBeGreaterThanOrEqual(0);
    expect(await metricValue('pacs_poll_tcp_connect_last_success_timestamp_seconds', good)).toBeGreaterThan(before);
    expect(await metricValue('pacs_poll_dicom_echo_success', { ...good, called_ae: SCP_AE_TITLE })).toBe(1);
    expect(
      await metricValue('pacs_poll_dicom_echo_last_success_timestamp_seconds', { ...good, called_ae: SCP_AE_TITLE })
    ).toBeGreaterThan(before);
    expect(await metricValue('pacs_poll_tcp_connect_failures_total', { target: 'good' })).toBeUndefined();

    const dead = { target: 'dead', host: '127.0.0.1', port: deadPort };
    expect(await metricValue('pacs_poll_tcp_connect_success', dead)).toBe(0);
    expect(await metricValue('pacs_poll_tcp_connect_failures_total', { ...dead, reason: 'refused' })).toBe(1);
    expect(await metricValue('pacs_poll_tcp_connect_last_success_timestamp_seconds', dead)).toBeUndefined();
    expect(await metricValue('pacs_poll_dicom_echo_success', { ...dead, called_ae: SCP_AE_TITLE })).toBe(0);
    expect(
      await metricValue('pacs_poll_dicom_echo_failures_total', {
        ...dead,
        called_ae: SCP_AE_TITLE,
        reason: 'connect_error',
      })
    ).toBe(1);

    expect(await metricValue('pacs_poll_tcp_connect_success', { target: 'tcp-only' })).toBe(1);
    expect(await metricValue('pacs_poll_dicom_echo_success', { target: 'tcp-only' })).toBeUndefined();

    // The DICOM checks used their own connections: the SCP saw exactly one association.
    expect(scp.received.filter((received) => received.type === 0x01)).toHaveLength(1);
  });

  it('counts failure reasons separately across cycles', async () => {
    scp = await startFakeScp(({ type }, socket) => {
      if (type === 0x01) socket.write(Buffer.from([0x03, 0, 0, 0, 0, 4, 0, 1, 1, 7]));
    });
    const target = {
      name: 'rejecting',
      host: '127.0.0.1',
      port: scp.port,
      dicomEcho: { calledAeTitle: 'WRONG_AE', callingAeTitle: 'PACS_POLL' },
    };

    await runConnectivityChecks({ timeoutMs: 2000, targets: [target] });
    await runConnectivityChecks({ timeoutMs: 2000, targets: [target] });

    const labels = { target: 'rejecting', called_ae: 'WRONG_AE' };
    expect(await metricValue('pacs_poll_tcp_connect_success', { target: 'rejecting' })).toBe(1);
    expect(await metricValue('pacs_poll_dicom_echo_success', labels)).toBe(0);
    expect(
      await metricValue('pacs_poll_dicom_echo_failures_total', { ...labels, reason: 'association_rejected' })
    ).toBe(2);
  });
});
