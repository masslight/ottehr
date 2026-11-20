import type { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_LOCATION_SYSTEM } from 'utils/lib/fhir/constants';
import { MANUAL_TASK, PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Visit } from '../../src/shared/support-chat/request-task';
import type { ZambdaInput } from '../../src/shared/types/common';
import {
  buildTextMessageTask,
  getAttachTextOperations,
  hasVisitToday,
  isInboundPatientSms,
} from '../../src/subscriptions/communication/patient-text-message/helpers';

const { mockGetAllPages, mockGetVisits } = vi.hoisted(() => ({ mockGetAllPages: vi.fn(), mockGetVisits: vi.fn() }));
vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({ getAllFhirSearchPages: mockGetAllPages }));
vi.mock('../../src/shared/support-chat/request-task', () => ({ getVisits: mockGetVisits }));
vi.mock('../../src/shared/auth', () => ({ checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m') }));
vi.mock('../../src/shared/sentry', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn };
});

const mockFhir = { get: vi.fn(), search: vi.fn(), patch: vi.fn(), create: vi.fn() };
vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createClinicalOystehrClient: vi.fn(() => ({ fhir: mockFhir })) };
});

const SMS_MEDIUM = {
  coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode', code: 'SMSWRIT' }],
};
const PATIENT: Patient = { resourceType: 'Patient', id: 'pat-1', name: [{ given: ['Robert'], family: 'Hill' }] };

const sms = (overrides: Partial<Communication> = {}): Communication => ({
  resourceType: 'Communication',
  id: 'comm-1',
  status: 'completed',
  medium: [SMS_MEDIUM],
  sender: { reference: 'RelatedPerson/rp-1' },
  sent: '2026-11-07T19:35:00.000Z',
  payload: [{ contentString: 'Still coughing a lot at night. Is that normal?' }],
  ...overrides,
});

const visitAt = (start: string, overrides: Partial<Visit> = {}): Visit => ({
  appointmentId: 'appt-1',
  encounterId: 'enc-1',
  patient: PATIENT,
  location: { id: 'loc-1', name: 'Main Street' },
  label: 'Robert Hill 11/03/2026',
  start,
  timezone: 'America/New_York',
  ...overrides,
});

const openTextTask = (): Task => ({
  ...buildTextMessageTask({
    patient: PATIENT,
    visit: visitAt('2026-11-03T15:20:00.000Z'),
    communication: sms({ id: 'comm-0' }),
  }),
  id: 'task-open',
  meta: { tag: [{ code: 'task' }], versionId: '3' },
});

describe('patient-text-message helpers', () => {
  it('recognises an inbound patient SMS and ignores staff SMS and other media', () => {
    expect(isInboundPatientSms(sms())).toBe(true);
    expect(isInboundPatientSms(sms({ sender: { reference: 'Practitioner/p' } }))).toBe(false);
    expect(isInboundPatientSms(sms({ sender: { reference: 'Device/d' } }))).toBe(false);
    expect(isInboundPatientSms(sms({ medium: [{ coding: [{ code: 'FAXWRIT' }] }] }))).toBe(false);
  });

  it('decides "visit today" in the visit location timezone', () => {
    const now = DateTime.fromISO('2026-11-07T23:30:00', { zone: 'America/New_York' }); // 04:30Z next day
    expect(hasVisitToday([visitAt('2026-11-07T14:00:00.000Z')], now)).toBe(true);
    expect(hasVisitToday([visitAt('2026-11-08T05:30:00.000Z', { timezone: 'America/Los_Angeles' })], now)).toBe(true);
    expect(hasVisitToday([visitAt('2026-11-06T14:00:00.000Z')], now)).toBe(false);
    expect(hasVisitToday([], now)).toBe(false);
  });

  it('builds an unassigned patient-request task on the newest visit with its location, patient and the text as details', () => {
    const task = buildTextMessageTask({
      patient: PATIENT,
      visit: visitAt('2026-11-03T15:20:00.000Z'),
      communication: sms(),
    });
    expect(task.status).toBe('ready');
    expect(task.owner).toBeUndefined();
    expect(task.groupIdentifier?.value).toBe(PATIENT_REQUEST_TASK.category);
    expect(task.code?.coding?.[0]).toEqual({
      system: PATIENT_REQUEST_TASK.system,
      code: PATIENT_REQUEST_TASK.code.textMessage,
    });
    expect(task.description).toBe('Text message from Robert Hill 11/03/2026');
    expect(task.encounter?.reference).toBe('Encounter/enc-1');
    expect(task.basedOn).toEqual([{ reference: 'Communication/comm-1' }]);
    // FHIR inv-1: lastModified >= authoredOn. A received text was sent before the task is authored.
    expect(DateTime.fromISO(task.lastModified!) >= DateTime.fromISO(task.authoredOn!)).toBe(true);
    expect(task.meta?.tag).toEqual([
      { code: 'task' },
      { system: TASK_LOCATION_SYSTEM, code: 'loc-1', display: 'Main Street' },
    ]);
    const input = (code: string): unknown =>
      task.input?.find((i) => i.type.coding?.some((c) => c.code === code))?.valueString ??
      task.input?.find((i) => i.type.coding?.some((c) => c.code === code))?.valueReference?.reference;
    expect(input(MANUAL_TASK.input.details)).toBe('Still coughing a lot at night. Is that normal?');
    expect(input(MANUAL_TASK.input.patient)).toBe('Patient/pat-1');
    expect(input(MANUAL_TASK.input.appointmentId)).toBe('appt-1');
  });

  it('builds a task with no location or visit when the patient has never had one', () => {
    const task = buildTextMessageTask({ patient: PATIENT, communication: sms() });
    expect(task.description).toBe('Text message from Robert Hill');
    expect(task.encounter).toBeUndefined();
    expect(task.location).toBeUndefined();
    expect(task.meta?.tag).toEqual([{ code: 'task' }]);
  });

  it('keeps the sent time when it is later than authoredOn', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T19:34:00.000Z'));
    try {
      const task = buildTextMessageTask({ patient: PATIENT, communication: sms() });
      expect(DateTime.fromISO(task.lastModified!).toMillis()).toBe(Date.parse('2026-11-07T19:35:00.000Z'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('attaches a later text: links the Communication, appends to the details and restarts the age', () => {
    const operations = getAttachTextOperations(openTextTask(), sms({ id: 'comm-2', sent: '2026-11-07T20:00:00.000Z' }));
    expect(operations).toEqual([
      { op: 'add', path: '/basedOn/-', value: { reference: 'Communication/comm-2' } },
      { op: 'replace', path: '/lastModified', value: '2026-11-07T20:00:00.000Z' },
      {
        op: 'replace',
        path: '/input/1/valueString',
        value: 'Still coughing a lot at night. Is that normal?\nStill coughing a lot at night. Is that normal?',
      },
    ]);
  });
});

describe('patient-text-message subscription', () => {
  type Handler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
  let handler!: Handler;

  const run = async (body: unknown): Promise<Record<string, unknown>> => {
    const result = await handler({ headers: {}, body: JSON.stringify(body), secrets: { ENVIRONMENT: 'testing' } });
    return JSON.parse(result.body);
  };

  beforeAll(async () => {
    handler = (await import('../../src/subscriptions/communication/patient-text-message/index')).index as Handler;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFhir.get.mockResolvedValue({
      resourceType: 'RelatedPerson',
      id: 'rp-1',
      patient: { reference: 'Patient/pat-1' },
    });
    mockFhir.search.mockResolvedValue({ unbundle: () => [PATIENT] });
    mockFhir.create.mockImplementation(async (task: Task) => ({ ...task, id: 'task-new' }));
    mockFhir.patch.mockResolvedValue({});
    mockGetAllPages.mockResolvedValue([]);
    mockGetVisits.mockResolvedValue([]);
  });

  it('ignores anything that is not an inbound patient text without touching FHIR', async () => {
    const result = await run(sms({ sender: { reference: 'Practitioner/p-1' } }));
    expect(result.skipped).toBeDefined();
    expect(mockFhir.get).not.toHaveBeenCalled();
    expect(mockFhir.create).not.toHaveBeenCalled();
  });

  it('creates a task for a patient with no visit today, linked to their newest visit, with a conditional create', async () => {
    mockGetVisits.mockResolvedValue([
      visitAt('2026-11-03T15:20:00.000Z'),
      visitAt('2026-10-01T15:00:00.000Z', { appointmentId: 'appt-old' }),
    ]);
    const result = await run(sms());
    expect(result.taskId).toBe('task-new');
    expect(mockFhir.patch).not.toHaveBeenCalled();
    const [task, options] = mockFhir.create.mock.calls[0];
    expect(task.encounter?.reference).toBe('Encounter/enc-1');
    expect(task.owner).toBeUndefined();
    expect(options.ifNoneExist).toEqual([
      { name: 'based-on', value: 'Communication/comm-1' },
      expect.objectContaining({ name: 'group-identifier' }),
    ]);
  });

  it('fails instead of reporting success when the task create is rejected', async () => {
    mockFhir.create.mockRejectedValue({ code: 400, message: 'Constraint inv-1 violated' });
    await expect(run(sms())).rejects.toMatchObject({ code: 400 });
  });

  it('creates no task when the patient has a visit today', async () => {
    mockGetVisits.mockResolvedValue([visitAt('2026-11-07T14:00:00.000Z')]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T19:40:00.000Z'));
    try {
      const result = await run(sms());
      expect(result.skipped).toBe('patient has a visit today');
      expect(mockFhir.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('adds the text to the open text task, even when the patient now has a visit today', async () => {
    mockGetVisits.mockResolvedValue([visitAt('2026-11-07T14:00:00.000Z')]);
    mockGetAllPages.mockResolvedValue([openTextTask()]);
    const result = await run(sms({ id: 'comm-2' }));
    expect(result).toEqual({ taskId: 'task-open', attached: true });
    expect(mockFhir.create).not.toHaveBeenCalled();
    const [patch, options] = mockFhir.patch.mock.calls[0];
    expect(patch.id).toBe('task-open');
    expect(patch.operations[0]).toEqual({
      op: 'add',
      path: '/basedOn/-',
      value: { reference: 'Communication/comm-2' },
    });
    expect(options).toEqual({ optimisticLockingVersionId: '3' });
  });

  it('ignores open text tasks of other patients', async () => {
    const otherPatientsTask = openTextTask();
    otherPatientsTask.input = otherPatientsTask.input?.map((i) =>
      i.valueReference ? { ...i, valueReference: { reference: 'Patient/pat-9' } } : i
    );
    mockGetAllPages.mockResolvedValue([otherPatientsTask]);
    const result = await run(sms());
    expect(result.taskId).toBe('task-new');
    expect(mockFhir.patch).not.toHaveBeenCalled();
  });

  it('is idempotent for a re-delivered Communication already on the open task', async () => {
    mockGetAllPages.mockResolvedValue([openTextTask()]);
    const result = await run(sms({ id: 'comm-0' }));
    expect(result).toEqual({ taskId: 'task-open', alreadyProcessed: true });
    expect(mockFhir.patch).not.toHaveBeenCalled();
    expect(mockFhir.create).not.toHaveBeenCalled();
  });

  it('never reopens a completed task: completed tasks are not searched as open', async () => {
    await run(sms());
    const [params] = mockGetAllPages.mock.calls[0];
    expect(params.params).toEqual(
      expect.arrayContaining([
        { name: 'status', value: 'ready,in-progress' },
        { name: 'code', value: `${PATIENT_REQUEST_TASK.system}|${PATIENT_REQUEST_TASK.code.textMessage}` },
      ])
    );
  });
});
