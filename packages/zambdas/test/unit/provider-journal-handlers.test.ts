import type { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { ALL_EHR_STAFF_ROLES, RoleType } from 'utils/lib/types/api/user.types';
import { LAB_ORDER_TASK } from 'utils/lib/types/data/labs/labs.constants';
import { MANUAL_TASK, RADIOLOGY_TASK } from 'utils/lib/types/data/tasks/types';
import { APIErrorCode, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTask } from '../../src/shared/tasks';
import type { ZambdaInput } from '../../src/shared/types/common';

const { mockRequireRole, mockPractitionerRoles, mockGetAllPages } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockPractitionerRoles: vi.fn(),
  mockGetAllPages: vi.fn(),
}));
vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({ getAllFhirSearchPages: mockGetAllPages }));
vi.mock('../../src/shared/auth', () => ({
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m'),
  getUserToken: vi.fn(() => 'user-token'),
  requireUserWithRole: mockRequireRole,
  getPractitionerRoles: mockPractitionerRoles,
}));
vi.mock('../../src/shared/sentry', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn };
});
const mockFhir = { get: vi.fn(), patch: vi.fn() };
vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createClinicalOystehrClient: vi.fn(() => ({ fhir: mockFhir })) };
});

type Handler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
const PRACTITIONER_ID = '6f1c1c2e-1111-4a5a-9c2b-000000000001';
const TASK_ID = '6f1c1c2e-2222-4a5a-9c2b-000000000002';
const STAFF_USER = { id: 'user-1', profile: `Practitioner/${PRACTITIONER_ID}`, roles: [{ name: RoleType.Staff }] };

const call = (handler: Handler, body: unknown): Promise<APIGatewayProxyResult> =>
  handler({
    headers: { Authorization: 'Bearer user-token' },
    body: JSON.stringify(body),
    secrets: { ENVIRONMENT: 'testing' },
  });

describe('get-provider-journal access', () => {
  let handler!: Handler;
  beforeAll(async () => {
    handler = (await import('../../src/ehr/provider-journal/get-provider-journal/index')).index as Handler;
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(STAFF_USER);
    mockGetAllPages.mockResolvedValue([]);
  });

  it('requires an EHR staff role before reading anything', async () => {
    mockRequireRole.mockRejectedValue(NOT_AUTHORIZED);
    await expect(
      call(handler, { practitionerId: PRACTITIONER_ID, timezone: 'America/New_York' })
    ).rejects.toMatchObject({
      code: APIErrorCode.NOT_AUTHORIZED,
    });
    expect(mockRequireRole).toHaveBeenCalledWith('user-token', expect.anything(), ALL_EHR_STAFF_ROLES);
    expect(mockPractitionerRoles).not.toHaveBeenCalled();
    expect(mockGetAllPages).not.toHaveBeenCalled();
  });

  it('rejects a target who is neither a Provider nor a Clinician (the picker is not trusted)', async () => {
    mockPractitionerRoles.mockResolvedValue([RoleType.Staff]);
    await expect(
      call(handler, { practitionerId: PRACTITIONER_ID, timezone: 'America/New_York' })
    ).rejects.toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
    });
    expect(mockGetAllPages).not.toHaveBeenCalled();
  });

  it('rejects a malformed practitioner id and an invalid timezone', async () => {
    await expect(
      call(handler, { practitionerId: 'Practitioner/abc', timezone: 'America/New_York' })
    ).rejects.toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
    });
    await expect(call(handler, { practitionerId: PRACTITIONER_ID, timezone: 'Mars/Olympus' })).rejects.toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
    });
  });

  it('builds a provider journal for a Provider and only searches by the practitioner id the server validated', async () => {
    mockPractitionerRoles.mockResolvedValue([RoleType.Provider]);
    const result = await call(handler, { practitionerId: PRACTITIONER_ID, timezone: 'America/New_York' });
    expect(JSON.parse(result.body)).toMatchObject({
      kind: 'provider',
      comingUp: [],
      today: [],
      recent: [],
      notTied: [],
    });
    const [encounterSearch] = mockGetAllPages.mock.calls[0];
    expect(encounterSearch.resourceType).toBe('Encounter');
    expect(encounterSearch.params).toEqual(
      expect.arrayContaining([{ name: 'participant', value: `Practitioner/${PRACTITIONER_ID}` }])
    );
  });

  it('includes task results with the untyped Task:based-on (FHIR refuses the typed form with a 400)', async () => {
    mockPractitionerRoles.mockResolvedValue([RoleType.Provider]);
    await call(handler, { practitionerId: PRACTITIONER_ID, timezone: 'America/New_York' });
    const includes = mockGetAllPages.mock.calls
      .filter(([search]) => search.resourceType === 'Task')
      .flatMap(([search]) => search.params.filter((p: { name: string }) => p.name === '_include'))
      .map((p: { value: string }) => p.value);
    expect(includes).toContain('Task:based-on');
    expect(includes.filter((value: string) => value.startsWith('Task:based-on:'))).toEqual([]);
  });

  it('builds a clinician journal for a Clinician', async () => {
    mockPractitionerRoles.mockResolvedValue([RoleType.Clinician]);
    const result = await call(handler, { practitionerId: PRACTITIONER_ID, timezone: 'America/New_York' });
    expect(JSON.parse(result.body).kind).toBe('clinician');
  });
});

describe('complete-journal-task', () => {
  let handler!: Handler;
  const openTask = (overrides: Partial<Task> = {}): Task => ({
    ...createTask({ category: 'manual-patient-follow-up', title: 'Call about culture results' }),
    id: TASK_ID,
    meta: { tag: [{ code: 'task' }], versionId: '2' },
    ...overrides,
  });

  beforeAll(async () => {
    handler = (await import('../../src/ehr/provider-journal/complete-journal-task/index')).index as Handler;
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(STAFF_USER);
    mockFhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) =>
      resourceType === 'Task'
        ? openTask()
        : { resourceType: 'Practitioner', id: PRACTITIONER_ID, name: [{ given: ['Sam'], family: 'Staff' }] }
    );
    mockFhir.patch.mockResolvedValue({});
  });

  it('requires an EHR staff role (the same access as the Tasks page)', async () => {
    mockRequireRole.mockRejectedValue(NOT_AUTHORIZED);
    await expect(call(handler, { taskId: TASK_ID })).rejects.toMatchObject({ code: APIErrorCode.NOT_AUTHORIZED });
    expect(mockRequireRole).toHaveBeenCalledWith('user-token', expect.anything(), ALL_EHR_STAFF_ROLES);
    expect(mockFhir.patch).not.toHaveBeenCalled();
  });

  it('completes an open board task in the caller’s name when it has no owner, with an optimistic lock', async () => {
    const result = await call(handler, { taskId: TASK_ID });
    expect(JSON.parse(result.body)).toEqual({ taskId: TASK_ID, status: 'completed' });
    const [patch, options] = mockFhir.patch.mock.calls[0];
    expect(patch).toMatchObject({ resourceType: 'Task', id: TASK_ID });
    expect(patch.operations[0]).toEqual({ op: 'replace', path: '/status', value: 'completed' });
    expect(patch.operations[1]).toMatchObject({
      op: 'add',
      path: '/owner',
      value: { reference: `Practitioner/${PRACTITIONER_ID}` },
    });
    expect(options).toEqual({ optimisticLockingVersionId: '2' });
  });

  it('keeps the existing owner', async () => {
    mockFhir.get.mockResolvedValue(openTask({ owner: { reference: 'Practitioner/someone-else' } }));
    await call(handler, { taskId: TASK_ID });
    expect(mockFhir.patch.mock.calls[0][0].operations).toHaveLength(1);
  });

  it('refuses tasks that are not open board tasks', async () => {
    mockFhir.get.mockResolvedValue(openTask({ status: 'completed' }));
    await expect(call(handler, { taskId: TASK_ID })).rejects.toMatchObject({ code: APIErrorCode.INVALID_INPUT });
    mockFhir.get.mockResolvedValue(openTask({ meta: { tag: [] } }));
    await expect(call(handler, { taskId: TASK_ID })).rejects.toMatchObject({ code: APIErrorCode.INVALID_INPUT });
    expect(mockFhir.patch).not.toHaveBeenCalled();
  });

  it('refuses result reviews and other non Patient Follow-up tasks (the Tasks page cannot complete them either)', async () => {
    for (const category of [LAB_ORDER_TASK.category, RADIOLOGY_TASK.category, MANUAL_TASK.category.other]) {
      mockFhir.get.mockResolvedValue({ ...openTask(), ...createTask({ category, title: 'Review CBC' }), id: TASK_ID });
      await expect(call(handler, { taskId: TASK_ID })).rejects.toMatchObject({ code: APIErrorCode.INVALID_INPUT });
    }
    expect(mockFhir.patch).not.toHaveBeenCalled();
  });

  it('reports a concurrent change instead of overwriting it', async () => {
    mockFhir.patch.mockRejectedValue({ code: 412, message: 'Precondition Failed' });
    await expect(call(handler, { taskId: TASK_ID })).rejects.toMatchObject({ code: APIErrorCode.CONCURRENT_UPDATE });
  });

  it('maps a missing task to a not-found error', async () => {
    mockFhir.get.mockRejectedValue({ code: 404 });
    await expect(call(handler, { taskId: TASK_ID })).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
  });
});
