import type { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, ChargeItemDefinition, Provenance } from 'fhir/r4b';
import { CPT_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileVersions, versionsFromProvenance } from '../../src/rcm/fee-schedules/get-version-history/helpers';
import { validateRequestParameters } from '../../src/rcm/fee-schedules/get-version-history/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_UUID = '6f9619ff-8b86-d011-b42d-00cf4fc964ff';

function makeInput(body: Record<string, unknown>): ZambdaInput {
  return { headers: null, body: JSON.stringify(body), secrets: null };
}

describe('get-version-history validateRequestParameters', () => {
  it('returns validated params', () => {
    const result = validateRequestParameters(makeInput({ resourceId: VALID_UUID }));
    expect(result).toMatchObject({ resourceId: VALID_UUID });
  });

  it('throws when resourceId is missing', () => {
    expect(() => validateRequestParameters(makeInput({}))).toThrow('Validation error: Required at "resourceId"');
  });
});

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
}));

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

const mockOystehrClient = {
  fhir: {
    history: vi.fn(),
    search: vi.fn(),
  },
};

const { index: handler } = (await import('../../src/rcm/fee-schedules/get-version-history/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

const lastUpdatedOf = (n: number): string => new Date(Date.UTC(2026, 0, n, 12, 0, 0, 100)).toISOString();
const recordedOf = (n: number): string => new Date(Date.UTC(2026, 0, n, 12, 0, 0, 350)).toISOString();

function makeHistory(length: number): ChargeItemDefinition[] {
  return Array.from({ length }, (_, i) => {
    const n = length - i;
    return {
      resourceType: 'ChargeItemDefinition',
      id: VALID_UUID,
      status: 'active',
      url: 'http://example.com',
      meta: { versionId: `v${n}`, lastUpdated: lastUpdatedOf(n) },
      propertyGroup: [
        {
          priceComponent: [
            {
              type: 'base',
              code: { coding: [{ system: CPT_CODE_SYSTEM, code: '99213' }] },
              amount: { value: n, currency: 'USD' },
            },
          ],
        },
      ],
    };
  });
}

function provenance(
  versionId: string,
  recorded: string,
  overrides: Partial<Provenance> = {},
  reference = `ChargeItemDefinition/${VALID_UUID}/_history/${versionId}`
): Provenance {
  return {
    resourceType: 'Provenance',
    id: `prov-${versionId}-${reference.length}-${recorded}`,
    target: [{ reference }],
    recorded,
    activity: { coding: [{ code: versionId === 'v1' ? 'CREATE' : 'UPDATE' }] },
    agent: [{ who: { reference: 'Device/m2m' } }],
    ...overrides,
  };
}

const provenanceFor = (history: ChargeItemDefinition[]): Provenance[] =>
  history.map((r) => provenance(r.meta!.versionId!, recordedOf(Number(r.meta!.versionId!.slice(1)))));

const newestPage = (history: ChargeItemDefinition[]): Bundle<ChargeItemDefinition> => ({
  resourceType: 'Bundle',
  type: 'history',
  total: history.length,
  entry: history.slice(0, 1).map((resource) => ({ resource })),
});

function serve(history: ChargeItemDefinition[], provenances: Provenance[]): void {
  mockOystehrClient.fhir.history.mockImplementation(async () => newestPage(history));
  mockOystehrClient.fhir.search.mockImplementation(
    async ({ params }: { params: { name: string; value: string }[] }) => {
      const value = (name: string): string | undefined => params.find((p) => p.name === name)?.value;
      const offset = Number(value('_offset') ?? 0);
      const slice = provenances.slice(offset, offset + Number(value('_count') ?? provenances.length));
      return {
        resourceType: 'Bundle',
        type: 'searchset',
        total: provenances.length,
        entry: slice.map((resource) => ({ resource, search: { mode: 'match' } })),
        unbundle: () => slice,
      };
    }
  );
}

const expectOnlyNewestVersionRead = (): void => {
  expect(mockOystehrClient.fhir.history).toHaveBeenCalledTimes(1);
  expect(mockOystehrClient.fhir.history).toHaveBeenCalledWith({
    resourceType: 'ChargeItemDefinition',
    id: VALID_UUID,
    count: 1,
  });
};

async function invoke(): Promise<{ versions: Array<{ versionId: string; timestamp: string }> }> {
  const result = await handler(makeInput({ resourceId: VALID_UUID }));
  expect(result.statusCode).toBe(200);
  expect(result.body).not.toContain('propertyGroup');
  expect(result.body).not.toContain('resourceType');
  const body = JSON.parse(result.body);
  expect(Object.keys(body)).toEqual(['versions']);
  for (const version of body.versions) expect(Object.keys(version).sort()).toEqual(['timestamp', 'versionId']);
  return body;
}

const expectUnavailable = async (): Promise<void> => {
  await expect(handler(makeInput({ resourceId: VALID_UUID }))).rejects.toMatchObject({
    code: APIErrorCode.VERSION_HISTORY_UNAVAILABLE,
    statusCode: 503,
  });
  expectOnlyNewestVersionRead();
};

describe('versionsFromProvenance', () => {
  it('reads the version id from an exact versioned target and keeps the Provenance time, newest first', () => {
    const result = versionsFromProvenance(
      [
        provenance('v1', '2026-01-01T00:00:00.300Z'),
        provenance('v3', '2026-01-03T00:00:00.300Z'),
        provenance('v2', '2026-01-02T00:00:00.300Z'),
      ],
      VALID_UUID
    );

    expect(result).toStrictEqual({
      malformed: false,
      versions: [
        { versionId: 'v3', timestamp: '2026-01-03T00:00:00.300Z' },
        { versionId: 'v2', timestamp: '2026-01-02T00:00:00.300Z' },
        { versionId: 'v1', timestamp: '2026-01-01T00:00:00.300Z' },
      ],
    });
  });

  it('ignores targets that are not this ChargeItemDefinition', () => {
    const mixed = provenance('v2', '2026-01-02T00:00:00.000Z', {
      target: [
        { reference: `Claim/${OTHER_UUID}` },
        { reference: `ChargeItemDefinition/${VALID_UUID}/_history/v2` },
        { reference: `ChargeItemDefinition/${OTHER_UUID}/_history/v9` },
      ],
    });
    const result = versionsFromProvenance(
      [
        mixed,
        provenance('v9', '2026-01-09T00:00:00.000Z', {}, `ChargeItemDefinition/${OTHER_UUID}/_history/v9`),
        provenance('v8', '2026-01-08T00:00:00.000Z', {}, `ChargeItemDefinition/${VALID_UUID}0/_history/v8`),
        provenance('v7', '2026-01-07T00:00:00.000Z', { target: [{ display: 'no reference' }] }),
      ],
      VALID_UUID
    );

    expect(result).toStrictEqual({
      malformed: false,
      versions: [{ versionId: 'v2', timestamp: '2026-01-02T00:00:00.000Z' }],
    });
  });

  it('accepts CREATE and UPDATE records and ignores every other activity', () => {
    const result = versionsFromProvenance(
      [
        provenance('v1', '2026-01-01T00:00:00.000Z', { activity: { coding: [{ code: 'CREATE' }] } }),
        provenance('v2', '2026-01-02T00:00:00.000Z', { activity: { coding: [{ code: 'UPDATE' }] } }),
        provenance('v3', '2026-01-03T00:00:00.000Z', { activity: { coding: [{ code: 'REVIEW' }] } }),
        provenance('v4', '2026-01-04T00:00:00.000Z', { activity: { coding: [{ code: 'DELETE' }] } }),
        provenance('v5', '2026-01-05T00:00:00.000Z', { activity: undefined }),
      ],
      VALID_UUID
    );

    expect(result.versions.map((v) => v.versionId)).toEqual(['v2', 'v1']);
    expect(result.malformed).toBe(false);
  });

  it('keeps one entry per version, using the earliest record', () => {
    const result = versionsFromProvenance(
      [
        provenance('v2', '2026-01-02T00:00:05.000Z'),
        provenance('v2', '2026-01-02T00:00:01.000Z', { id: 'duplicate' }),
        provenance('v1', '2026-01-01T00:00:00.000Z'),
      ],
      VALID_UUID
    );

    expect(result.versions).toStrictEqual([
      { versionId: 'v2', timestamp: '2026-01-02T00:00:01.000Z' },
      { versionId: 'v1', timestamp: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it.each([
    ['an unversioned reference', `ChargeItemDefinition/${VALID_UUID}`],
    ['an empty version', `ChargeItemDefinition/${VALID_UUID}/_history/`],
    ['a nested path', `ChargeItemDefinition/${VALID_UUID}/_history/v2/extra`],
    ['a non-history sub-path', `ChargeItemDefinition/${VALID_UUID}/$meta`],
  ])('skips %s and flags the result as malformed', (_label, reference) => {
    const result = versionsFromProvenance(
      [provenance('v1', '2026-01-01T00:00:00.000Z'), provenance('v2', '2026-01-02T00:00:00.000Z', {}, reference)],
      VALID_UUID
    );

    expect(result).toStrictEqual({
      malformed: true,
      versions: [{ versionId: 'v1', timestamp: '2026-01-01T00:00:00.000Z' }],
    });
  });

  it('flags a relevant record without a recorded time as malformed', () => {
    const result = versionsFromProvenance(
      [
        provenance('v1', '2026-01-01T00:00:00.000Z'),
        { ...provenance('v2', ''), recorded: undefined as unknown as string },
      ],
      VALID_UUID
    );

    expect(result.malformed).toBe(true);
    expect(result.versions.map((v) => v.versionId)).toEqual(['v1']);
  });
});

const thrownBy = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('reconcileVersions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn')
      .mockImplementation(() => undefined)
      .mockClear();
  });

  const fromProvenance = (history: ChargeItemDefinition[]): ReturnType<typeof versionsFromProvenance> =>
    versionsFromProvenance(provenanceFor(history), VALID_UUID);

  it('puts a supplemented newest version first even when an older Provenance time is later', () => {
    const history = makeHistory(3);
    const provenances = versionsFromProvenance(
      [provenance('v2', '2026-12-31T00:00:00.000Z'), provenance('v1', recordedOf(1))],
      VALID_UUID
    );

    expect(reconcileVersions(VALID_UUID, provenances, newestPage(history)).map((v) => v.versionId)).toEqual([
      'v3',
      'v2',
      'v1',
    ]);
  });

  it('returns an empty list for an empty history', () => {
    expect(reconcileVersions(VALID_UUID, fromProvenance([]), newestPage([]))).toEqual([]);
  });

  it('cannot supplement when the newest history entry has no lastUpdated', () => {
    const history = makeHistory(2);
    const page = newestPage(history);
    page.entry![0].resource = { ...history[0], meta: { versionId: 'v2' } };

    expect(thrownBy(() => reconcileVersions(VALID_UUID, fromProvenance(history.slice(1)), page))).toMatchObject({
      code: APIErrorCode.VERSION_HISTORY_UNAVAILABLE,
    });
  });

  it('cannot reconcile when the history reports no total', () => {
    const history = makeHistory(2);
    const page = newestPage(history);
    delete page.total;

    expect(thrownBy(() => reconcileVersions(VALID_UUID, fromProvenance(history), page))).toMatchObject({
      code: APIErrorCode.VERSION_HISTORY_UNAVAILABLE,
    });
  });
});

describe('get-version-history handler', () => {
  beforeEach(() => {
    mockOystehrClient.fhir.history.mockReset();
    mockOystehrClient.fhir.search.mockReset();
    vi.spyOn(console, 'warn')
      .mockImplementation(() => undefined)
      .mockClear();
  });

  it('lists versions from Provenance when it matches the history total and newest version', async () => {
    const history = makeHistory(12);
    serve(history, provenanceFor(history));

    const body = await invoke();

    expect(body.versions).toHaveLength(12);
    expect(body.versions[0]).toStrictEqual({ versionId: 'v12', timestamp: recordedOf(12) });
    expect(body.versions.map((v) => v.versionId)).toEqual(history.map((r) => r.meta!.versionId));
    expectOnlyNewestVersionRead();
    expect(mockOystehrClient.fhir.search).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Provenance',
        params: expect.arrayContaining([{ name: 'target', value: `ChargeItemDefinition/${VALID_UUID}` }]),
      })
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('runs the Provenance search and the newest-version read in parallel', async () => {
    const history = makeHistory(3);
    const provenances = provenanceFor(history);
    const pending: Array<() => void> = [];
    mockOystehrClient.fhir.history.mockImplementation(
      () => new Promise((resolve) => pending.push(() => resolve(newestPage(history))))
    );
    mockOystehrClient.fhir.search.mockImplementation(
      () =>
        new Promise((resolve) =>
          pending.push(() =>
            resolve({
              total: provenances.length,
              entry: provenances.map((resource) => ({ resource, search: { mode: 'match' } })),
              unbundle: () => provenances,
            })
          )
        )
    );

    const result = handler(makeInput({ resourceId: VALID_UUID }));
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending.forEach((release) => release());

    expect(JSON.parse((await result).body).versions).toHaveLength(3);
  });

  it('supplements a newest version that Provenance has not recorded yet, without paging the history', async () => {
    const history = makeHistory(6);
    serve(history, provenanceFor(history.slice(1)));

    const body = await invoke();

    expect(body.versions).toHaveLength(6);
    expect(body.versions[0]).toStrictEqual({ versionId: 'v6', timestamp: lastUpdatedOf(6) });
    expect(body.versions.slice(1)).toStrictEqual(
      history
        .slice(1)
        .map((r) => ({ versionId: r.meta!.versionId, timestamp: recordedOf(Number(r.meta!.versionId!.slice(1))) }))
    );
    expectOnlyNewestVersionRead();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('supplements the only version of a ChargeItemDefinition created moments ago', async () => {
    const history = makeHistory(1);
    serve(history, []);

    const body = await invoke();

    expect(body.versions).toStrictEqual([{ versionId: 'v1', timestamp: lastUpdatedOf(1) }]);
  });

  it('reports the history as unavailable when Provenance is missing more than one version', async () => {
    const history = makeHistory(6);
    serve(history, provenanceFor(history.slice(2)));

    await expectUnavailable();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Provenance lists 4 versions'));
  });

  it('reports the history as unavailable when Provenance is missing an older version but lists the newest', async () => {
    const history = makeHistory(6);
    serve(
      history,
      provenanceFor(history).filter((p) => !p.target[0].reference!.endsWith('/v3'))
    );

    await expectUnavailable();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('newest v6 listed'));
  });

  it('reports the history as unavailable when the counts match but the newest version is not in Provenance', async () => {
    const history = makeHistory(4);
    serve(history, [provenance('v-stray', recordedOf(9)), ...provenanceFor(history.slice(1))]);

    await expectUnavailable();
  });

  it('reports the history as unavailable when Provenance lists more versions than the history', async () => {
    const history = makeHistory(3);
    serve(history, [...provenanceFor(history), provenance('v-extra', recordedOf(0))]);

    await expectUnavailable();
  });

  it('reports the history as unavailable when a relevant Provenance target is malformed', async () => {
    const history = makeHistory(2);
    serve(history, [
      ...provenanceFor(history),
      provenance('v0', recordedOf(1), {}, `ChargeItemDefinition/${VALID_UUID}`),
    ]);

    await expectUnavailable();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('malformed'));
  });

  it('fails without reading the history when the Provenance search fails', async () => {
    const history = makeHistory(3);
    serve(history, []);
    mockOystehrClient.fhir.search.mockRejectedValue(new Error('search unavailable'));

    await expect(handler(makeInput({ resourceId: VALID_UUID }))).rejects.toThrow('search unavailable');
    expectOnlyNewestVersionRead();
  });

  it('fails when the newest-version read fails', async () => {
    serve(makeHistory(2), []);
    mockOystehrClient.fhir.history.mockRejectedValue(new Error('history unavailable'));

    await expect(handler(makeInput({ resourceId: VALID_UUID }))).rejects.toThrow('history unavailable');
  });
});
