import type { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { INTAKE_PAPERWORK_QR_TAG, PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { JournalRow } from 'utils/lib/types/api/provider-journal.types';
import { SUPPORT_CHAT_THREAD_SYSTEM, SUPPORT_CHAT_UNREAD_TAG } from 'utils/lib/types/api/support-chat.types';
import { ALL_EHR_STAFF_ROLES, RoleType } from 'utils/lib/types/api/user.types';
import { LAB_ORDER_TASK } from 'utils/lib/types/data/labs/labs.constants';
import { MANUAL_TASK, PATIENT_REQUEST_TASK, RADIOLOGY_TASK } from 'utils/lib/types/data/tasks/types';
import { CREATED_BY_SYSTEM } from 'utils/lib/types/common';
import { APIErrorCode, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClinicalOystehrClient } from '../../src/shared/helpers';
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
const mockFhir = { get: vi.fn(), patch: vi.fn(), search: vi.fn() };
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
    mockFhir.search.mockResolvedValue({ unbundle: () => [] });
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

  it('also reads a provider’s open visits of any age, for notes still to sign', async () => {
    mockPractitionerRoles.mockResolvedValue([RoleType.Provider]);
    await call(handler, { practitionerId: PRACTITIONER_ID, timezone: 'America/New_York' });
    const openVisitSearch = mockGetAllPages.mock.calls
      .map(([search]) => search)
      .find(
        (search) =>
          search.resourceType === 'Encounter' &&
          search.params.some((p: { name: string; value: string }) => p.name === 'status' && p.value === 'in-progress')
      );
    expect(openVisitSearch?.params).toEqual(
      expect.arrayContaining([{ name: 'participant', value: `Practitioner/${PRACTITIONER_ID}` }])
    );
    expect(openVisitSearch?.params.some((p: { name: string }) => p.name === 'appointment.date')).toBe(false);
  });

  it.each([
    ['a pre-visit lab on a visit months ago', { months: -4 }, 'fulfilled', LAB_ORDER_TASK.category],
    ['a text linked to an upcoming booking', { days: 7 }, 'booked', PATIENT_REQUEST_TASK.category],
  ] as const)('keeps open tasks on this person’s visits of any date: %s', async (_case, offset, status, category) => {
    mockPractitionerRoles.mockResolvedValue([RoleType.Provider]);
    const start = DateTime.now().plus(offset).toUTC().toISO()!;
    const visit = [
      {
        resourceType: 'Encounter',
        id: 'enc-1',
        status: status === 'booked' ? 'planned' : 'finished',
        subject: { reference: 'Patient/pat-1' },
        appointment: [{ reference: 'Appointment/appt-1' }],
        participant: [
          {
            type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND' }] }],
            individual: { reference: `Practitioner/${PRACTITIONER_ID}` },
          },
        ],
      },
      { resourceType: 'Appointment', id: 'appt-1', status, start },
    ];
    const task = { ...createTask({ category, title: 'Open task', encounterId: 'enc-1' }), id: 'task-1' };
    mockGetAllPages.mockImplementation(async ({ resourceType, params }) => {
      const has = (name: string): boolean => params.some((p: { name: string }) => p.name === name);
      if (resourceType === 'Task' && has('encounter.participant')) return [task, ...visit];
      if (resourceType === 'Patient') return [{ resourceType: 'Patient', id: 'pat-1', name: [{ given: ['Lee'] }] }];
      return [];
    });
    const journal = JSON.parse((await call(handler, { practitionerId: PRACTITIONER_ID, timezone: 'UTC' })).body);
    expect(journal.recent.map((row: JournalRow) => row.items.map((item) => item.id))).toEqual([['task-1']]);
    const chained = mockGetAllPages.mock.calls.find(([search]) =>
      search.params.some((p: { name: string }) => p.name === 'encounter.participant')
    )?.[0];
    expect(chained.params).toEqual(
      expect.arrayContaining([{ name: 'encounter.participant', value: `Practitioner/${PRACTITIONER_ID}` }])
    );
  });

  it('labels account phones with the consent signer of the newest visit the phone booked, and flags unread texts', async () => {
    mockPractitionerRoles.mockResolvedValue([RoleType.Provider]);
    const owned = {
      ...createTask({ category: MANUAL_TASK.category.other, title: 'Call' }),
      id: 'task-1',
      owner: { reference: `Practitioner/${PRACTITIONER_ID}` },
      input: [
        { type: { coding: [{ code: MANUAL_TASK.input.patient }] }, valueReference: { reference: 'Patient/pat-1' } },
      ],
    };
    const booking = {
      resourceType: 'Appointment',
      id: 'appt-1',
      start: '2026-11-01T15:00:00.000Z',
      participant: [{ actor: { reference: 'Patient/pat-1' } }],
      meta: { tag: [{ system: CREATED_BY_SYSTEM, display: 'Patient (410) 555-0123' }] },
    };
    const intake = {
      resourceType: 'QuestionnaireResponse',
      encounter: { reference: 'Encounter/enc-1' },
      meta: { tag: [INTAKE_PAPERWORK_QR_TAG] },
      item: [
        { linkId: 'full-name', answer: [{ valueString: 'Mei Chen' }] },
        { linkId: 'consent-form-signer-relationship', answer: [{ valueString: 'Parent' }] },
      ],
    };
    const accountPhone = {
      resourceType: 'RelatedPerson',
      id: 'rp-1',
      patient: { reference: 'Patient/pat-1' },
      relationship: [{ coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }] }],
      telecom: [{ system: 'sms', value: '+14105550123' }],
    };
    mockGetAllPages.mockImplementation(async ({ resourceType, params }) => {
      const has = (name: string): boolean => params.some((p: { name: string }) => p.name === name);
      if (resourceType === 'Task' && has('owner')) return [owned];
      if (resourceType === 'Patient')
        return [{ resourceType: 'Patient', id: 'pat-1', name: [{ given: ['Ava'], family: 'Chen' }] }, accountPhone];
      if (resourceType === 'Appointment') return [booking];
      if (resourceType === 'Encounter' && has('appointment'))
        return [{ resourceType: 'Encounter', id: 'enc-1', appointment: [{ reference: 'Appointment/appt-1' }] }, intake];
      return [];
    });
    // The tracking board's search: SMS Communications from the account phone numbers, with their senders.
    const unreadText = { resourceType: 'Communication', id: 'sms-1', status: 'completed', sender: { reference: 'RelatedPerson/rp-1' } };
    mockFhir.search.mockResolvedValue({ unbundle: () => [unreadText, accountPhone] });
    const journal = JSON.parse((await call(handler, { practitionerId: PRACTITIONER_ID, timezone: 'UTC' })).body);
    expect(journal.notTied[0].patient.phones).toEqual([
      { number: '+14105550123', recipientResourceUri: 'RelatedPerson/rp-1', signer: 'Mei Chen (Parent)' },
    ]);
    expect(journal.notTied[0].patient.hasUnreadTexts).toBe(true);
    expect(mockFhir.search.mock.calls[0][0]).toMatchObject({ resourceType: 'Communication' });
  });

  it('dates "Reply to patient message" from the newest unread patient message, not the request', async () => {
    mockPractitionerRoles.mockResolvedValue([RoleType.Provider]);
    const thread = { system: SUPPORT_CHAT_THREAD_SYSTEM, code: 'person-1' };
    const request = {
      ...createTask({ category: PATIENT_REQUEST_TASK.category, title: 'Prescription Refill for Ava Chen' }),
      id: 'task-portal',
      authoredOn: '2026-11-05T12:00:00.000Z',
      owner: { reference: `Practitioner/${PRACTITIONER_ID}` },
      meta: { tag: [{ code: 'task' }, thread, SUPPORT_CHAT_UNREAD_TAG] },
    };
    const message = (id: string, sent: string, sender?: string): object => ({
      resourceType: 'Communication',
      id,
      status: 'in-progress',
      sent,
      meta: { tag: [thread] },
      sender: sender ? { reference: sender } : undefined,
    });
    mockGetAllPages.mockImplementation(async ({ resourceType, params }) => {
      const has = (name: string): boolean => params.some((p: { name: string }) => p.name === name);
      if (resourceType === 'Task' && has('owner')) return [request];
      if (resourceType === 'Communication')
        return [
          message('m1', '2026-11-07T14:00:00.000Z', 'RelatedPerson/rp-1'),
          message('m2', '2026-11-07T14:50:00.000Z', 'RelatedPerson/rp-1'),
          // Staff and bot messages aren't the patient writing.
          message('m3', '2026-11-07T14:55:00.000Z', 'Practitioner/p-1'),
          message('m4', '2026-11-07T14:56:00.000Z'),
        ];
      return [];
    });
    const journal = JSON.parse((await call(handler, { practitionerId: PRACTITIONER_ID, timezone: 'UTC' })).body);
    expect(journal.notTied[0].items[0]).toMatchObject({
      label: 'Reply to patient message',
      when: 'received',
      since: '2026-11-07T14:50:00.000Z',
    });
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

  it('completes exactly like the Tasks page: the caller’s own token, status only, version-checked', async () => {
    for (const owner of [undefined, { reference: 'Practitioner/someone-else' }]) {
      vi.mocked(createClinicalOystehrClient).mockClear();
      mockFhir.patch.mockClear();
      mockFhir.get.mockResolvedValue(openTask({ owner }));
      const result = await call(handler, { taskId: TASK_ID });
      expect(JSON.parse(result.body)).toEqual({ taskId: TASK_ID, status: 'completed' });
      // Written as the signed-in user, so FHIR records who completed it and their access policy applies.
      expect(vi.mocked(createClinicalOystehrClient).mock.calls.map(([token]) => token)).toEqual(['user-token']);
      const [patch, options] = mockFhir.patch.mock.calls[0];
      expect(patch).toEqual({
        resourceType: 'Task',
        id: TASK_ID,
        operations: [{ op: 'replace', path: '/status', value: 'completed' }],
      });
      expect(options).toEqual({ optimisticLockingVersionId: '2' });
    }
  });

  it('passes on the caller’s own access policy refusing the task', async () => {
    mockFhir.patch.mockRejectedValue({ code: 403 });
    await expect(call(handler, { taskId: TASK_ID })).rejects.toMatchObject({ code: APIErrorCode.NOT_AUTHORIZED });
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
