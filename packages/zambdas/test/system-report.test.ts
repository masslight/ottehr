import type { APIGatewayProxyResult } from 'aws-lambda';
import type { Basic, Bundle, FhirResource } from 'fhir/r4b';
import { SYSTEM_REPORT_CODE, SystemReportDefinition } from 'utils/lib/types/adhoc/system/system-report';
import { ALL_EHR_STAFF_ROLES, RoleType } from 'utils/lib/types/api/user.types';
import { APIErrorCode, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeSavedAdHocReportBasic,
  SAVED_ADHOC_REPORT_CODE,
  SAVED_ADHOC_REPORT_SYSTEM,
} from '../src/shared/saved-adhoc-report';
import { makeSystemReportBasic, parseSystemReportBasic } from '../src/shared/system-report';
import type { ZambdaInput } from '../src/shared/types/common';

// ---------------------------------------------------------------------------
// Shared mocks: a caller with EHR roles, and a tiny FHIR store of Basics that honours the `code` and `_id`
// search parameters the saved-report and system-report helpers search by.
// ---------------------------------------------------------------------------

// The caller's roles; the auth fakes answer the way getUser / requireUserWithRole do for a user holding them.
let callerRoles: string[] = [RoleType.Administrator];

vi.mock('../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-m2m-token'),
    getUserToken: vi.fn(() => 'mock-user-token'),
    getUser: vi.fn(async () => ({ id: 'caller', roles: callerRoles.map((name) => ({ name })) })),
    requireUserWithRole: vi.fn(async (_token: string, _secrets: unknown, allowed: string[]) => {
      if (!allowed.some((role) => callerRoles.includes(role))) throw NOT_AUTHORIZED;
      return { id: 'caller', roles: callerRoles.map((name) => ({ name })) };
    }),
  };
});

vi.mock('../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createClinicalOystehrClient: vi.fn(() => mockFhirClient) };
});

vi.mock('../src/shared/sentry', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn };
});

vi.mock('../src/shared/adhoc-fetch-plan', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, runFetchPlan: vi.fn() };
});

const store = new Map<string, Basic>();

const bundleOf = (resources: FhirResource[]): Bundle & { unbundle: () => FhirResource[] } =>
  ({
    resourceType: 'Bundle',
    type: 'searchset',
    entry: resources.map((resource) => ({ resource })),
    unbundle: () => resources,
  }) as Bundle & { unbundle: () => FhirResource[] };

const mockFhirClient = {
  fhir: {
    search: vi.fn(async ({ params }: { params: { name: string; value: string }[] }) => {
      const code = params.find((p) => p.name === 'code')?.value.split('|')[1];
      const id = params.find((p) => p.name === '_id')?.value;
      return bundleOf(
        Array.from(store.values()).filter(
          (basic) => (!code || basic.code?.coding?.[0]?.code === code) && (!id || basic.id === id)
        )
      );
    }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

const { index: listSavedHandler } = (await import('../src/ehr/list-adhoc-reports/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};
const { index: saveSavedHandler } = (await import('../src/ehr/save-adhoc-report/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};
const { index: deleteSavedHandler } = (await import('../src/ehr/delete-adhoc-report/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};
const { index: getSystemHandler } = (await import('../src/ehr/get-system-report/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};
const { index: runSystemHandler } = (await import('../src/ehr/run-system-report/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};
const { runFetchPlan } = await import('../src/shared/adhoc-fetch-plan');

// ---------------------------------------------------------------------------

const secrets = {
  AUTH0_ENDPOINT: 'https://auth.test',
  AUTH0_CLIENT: 'client',
  AUTH0_SECRET: 'secret',
  AUTH0_AUDIENCE: 'https://api.test',
  ENVIRONMENT: 'test',
} as unknown as ZambdaInput['secrets'];

const input = (body: unknown): ZambdaInput =>
  ({ body: JSON.stringify(body), headers: { Authorization: 'Bearer x' }, secrets }) as unknown as ZambdaInput;

const systemDefinition: SystemReportDefinition = {
  name: 'payer-mix',
  title: 'Payer mix',
  parameters: [],
  inputs: [{ name: 'range', kind: 'dateRange', required: false, default: { preset: 'last-30-days' } }],
  plan: {
    version: 1,
    steps: [
      {
        id: 'visits',
        resourceType: 'Appointment',
        params: [{ name: 'date', value: 'ge{{start}}' }],
        mode: 'auto',
      },
    ],
  },
  code: 'function ReportRoot() { return null; }\nreturn ReportRoot;',
  runtimeVersion: 1,
};

const savedDefinition = {
  name: 'my saved report',
  datasetId: 'encounters-comprehensive',
  criteria: { dateRange: 'last-7-days' },
  request: 'visits by status',
  code: 'return function ReportRoot() { return null; }',
};

const SYSTEM_ID = 'basic-system-1';
const SAVED_ID = 'basic-saved-1';
const dateRange = { start: '2026-10-01T04:00:00.000Z', end: '2026-10-16T03:59:59.999Z' };

beforeEach(() => {
  callerRoles = [RoleType.Administrator];
  store.clear();
  store.set(SYSTEM_ID, { ...makeSystemReportBasic(systemDefinition), id: SYSTEM_ID });
  store.set(SAVED_ID, { ...makeSavedAdHocReportBasic(savedDefinition), id: SAVED_ID });
  vi.mocked(mockFhirClient.fhir.create).mockReset();
  vi.mocked(mockFhirClient.fhir.update).mockReset();
  vi.mocked(mockFhirClient.fhir.delete).mockReset();
  vi.mocked(runFetchPlan).mockReset();
});

describe('system report Basic', () => {
  it('carries its own code under the saved-report code system and round-trips the definition', () => {
    const basic = makeSystemReportBasic(systemDefinition);
    expect(basic.code?.coding).toEqual([{ system: SAVED_ADHOC_REPORT_SYSTEM, code: SYSTEM_REPORT_CODE }]);
    expect(SYSTEM_REPORT_CODE).not.toBe(SAVED_ADHOC_REPORT_CODE);
    expect(parseSystemReportBasic({ ...basic, id: 'b1', meta: { lastUpdated: '2026-10-16T13:00:00Z' } })).toEqual({
      ...systemDefinition,
      id: 'b1',
      updatedAt: '2026-10-16T13:00:00Z',
    });
  });

  it('parses to null without an id or with a blob that is not a system report', () => {
    expect(parseSystemReportBasic(makeSystemReportBasic(systemDefinition))).toBeNull();
    expect(parseSystemReportBasic({ ...makeSavedAdHocReportBasic(savedDefinition), id: 'b2' })).toBeNull();
    const basic = makeSystemReportBasic(systemDefinition);
    basic.extension![0].valueString = '{"name":"no plan"}';
    expect(parseSystemReportBasic({ ...basic, id: 'b3' })).toBeNull();
  });
});

describe('saved-report zambdas never see a system report', () => {
  it('list-adhoc-reports lists the saved report only; get-system-report finds a system report by name only', async () => {
    const saved = JSON.parse((await listSavedHandler(input({}))).body);
    expect(saved.reports.map((r: { id: string }) => r.id)).toEqual([SAVED_ID]);
    const system = JSON.parse((await getSystemHandler(input({ name: 'payer-mix' }))).body);
    expect(system.report).toEqual({ ...systemDefinition, id: SYSTEM_ID });
    await expect(getSystemHandler(input({ name: savedDefinition.name }))).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
    await expect(getSystemHandler(input({}))).rejects.toMatchObject({ code: APIErrorCode.INVALID_INPUT });
  });

  it('save-adhoc-report refuses to overwrite a system report by id', async () => {
    await expect(saveSavedHandler(input({ reportId: SYSTEM_ID, definition: savedDefinition }))).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
    expect(mockFhirClient.fhir.update).not.toHaveBeenCalled();
  });

  it('delete-adhoc-report refuses to delete a system report by id', async () => {
    await expect(deleteSavedHandler(input({ reportId: SYSTEM_ID }))).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
    expect(mockFhirClient.fhir.delete).not.toHaveBeenCalled();
  });
});

describe('any signed-in EHR staff user, no per-report roles', () => {
  it('get-system-report and run-system-report serve every EHR staff role and refuse a user without one', async () => {
    for (const role of ALL_EHR_STAFF_ROLES) {
      callerRoles = [role];
      const system = JSON.parse((await getSystemHandler(input({ name: 'payer-mix' }))).body);
      expect(system.report.id).toBe(SYSTEM_ID);
    }
    callerRoles = [RoleType.Inactive];
    await expect(getSystemHandler(input({ name: 'payer-mix' }))).rejects.toMatchObject({ code: NOT_AUTHORIZED.code });
    await expect(runSystemHandler(input({ reportId: SYSTEM_ID, dateRange }))).rejects.toMatchObject({
      code: NOT_AUTHORIZED.code,
    });
    expect(runFetchPlan).not.toHaveBeenCalled();
    expect(mockFhirClient.fhir.create).not.toHaveBeenCalled();
  });
});

describe('run-system-report', () => {
  it('runs only a system report: a saved report id, an unknown id or no id is refused', async () => {
    await expect(runSystemHandler(input({ reportId: SAVED_ID, dateRange }))).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
    await expect(runSystemHandler(input({ reportId: 'nope', dateRange }))).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
    await expect(runSystemHandler(input({ dateRange }))).rejects.toMatchObject({ code: APIErrorCode.INVALID_INPUT });
    expect(runFetchPlan).not.toHaveBeenCalled();
    expect(mockFhirClient.fhir.create).not.toHaveBeenCalled();
  });

  it('never runs a plan or code sent by the browser: only the stored plan reaches the runner', async () => {
    const sent = { version: 1, steps: [{ id: 'evil', resourceType: 'Patient', params: [] }] };
    vi.mocked(mockFhirClient.fhir.create).mockResolvedValue({ resourceType: 'Task', id: 'task-1' } as never);
    // With nothing measured on this practice yet, the run goes through the Task (like Report Studio's first run).
    const response = await runSystemHandler(input({ reportId: SYSTEM_ID, dateRange, plan: sent, code: 'alert(1)' }));
    expect(JSON.parse(response.body)).toEqual({ taskId: 'task-1' });
    const task = vi.mocked(mockFhirClient.fhir.create).mock.calls[0][0] as { input: { valueString: string }[] };
    const params = JSON.parse(task.input[0].valueString);
    expect(params.plan).toEqual(systemDefinition.plan);
    expect(params.systemReportId).toBe(SYSTEM_ID);
    expect(params).not.toHaveProperty('code');
  });

  it('runs directly once a fast run was measured on this practice, and records the new timing', async () => {
    store.set(SYSTEM_ID, {
      ...makeSystemReportBasic({
        ...systemDefinition,
        fetchMode: 'direct',
        measuredFetchSeconds: 1,
        measuredRangeDays: 30,
      }),
      id: SYSTEM_ID,
    });
    vi.mocked(runFetchPlan).mockResolvedValue({
      resources: { visits: [] },
      stats: [
        {
          id: 'visits',
          resourceType: 'Appointment',
          ms: 5,
          count: 0,
          byType: {},
          bytes: 2,
          mode: 'normal',
          requests: 1,
          params: [],
        },
      ],
      totalMs: 5,
    });
    const response = await runSystemHandler(input({ reportId: SYSTEM_ID, dateRange }));
    expect(JSON.parse(response.body)).toMatchObject({ resources: { visits: [] }, totalMs: 5 });
    expect(vi.mocked(runFetchPlan).mock.calls[0][1]).toEqual(systemDefinition.plan);
    const updated = vi.mocked(mockFhirClient.fhir.update).mock.calls[0][0] as Basic;
    expect(parseSystemReportBasic(updated)).toMatchObject({ fetchMode: 'direct', measuredFetchSeconds: 0.005 });
  });

  it('runs a per-patient report directly even with nothing measured', async () => {
    const plan = {
      version: 1 as const,
      steps: [
        {
          id: 'vitals',
          resourceType: 'Observation',
          params: [{ name: 'patient', value: 'Patient/{{patientId}}' }],
          mode: 'auto' as const,
        },
      ],
    };
    store.set(SYSTEM_ID, {
      ...makeSystemReportBasic({ ...systemDefinition, plan, inputs: undefined, parameters: ['patientId'] }),
      id: SYSTEM_ID,
    });
    vi.mocked(runFetchPlan).mockResolvedValue({ resources: { vitals: [] }, stats: [], totalMs: 400 });
    const response = await runSystemHandler(input({ reportId: SYSTEM_ID, parameters: { patientId: 'p1' } }));
    expect(JSON.parse(response.body)).toMatchObject({ resources: { vitals: [] } });
    expect(mockFhirClient.fhir.create).not.toHaveBeenCalled();
  });

  it('requires a patient for a per-patient plan', async () => {
    const plan = {
      version: 1 as const,
      steps: [
        {
          id: 'vitals',
          resourceType: 'Observation',
          params: [{ name: 'patient', value: 'Patient/{{patientId}}' }],
          mode: 'auto' as const,
        },
      ],
    };
    store.set(SYSTEM_ID, {
      ...makeSystemReportBasic({ ...systemDefinition, plan, parameters: ['patientId'] }),
      id: SYSTEM_ID,
    });
    await expect(runSystemHandler(input({ reportId: SYSTEM_ID, dateRange }))).rejects.toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
    });
  });
});
