import type Oystehr from '@oystehr/sdk';
import { Patient, ServiceRequest, Task } from 'fhir/r4b';
import { TASK_CATEGORY_IDENTIFIER, TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { makeReferralServiceRequest, withReferralDetails } from 'utils/lib/fhir/referral';
import {
  REFERRAL_OVERDUE_NOTIFIED_TAG_CODE,
  REFERRAL_OVERDUE_NOTIFIED_TAG_SYSTEM,
} from 'utils/lib/types/api/provider-notifications';
import { REFERRAL_TASK, SaveReferralInput } from 'utils/lib/types/api/referrals/referrals.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncReferralTask } from '../../src/ehr/referrals/shared';
import { buildReferralTask, findOpenReferralTask } from '../../src/shared/referrals/referral-task';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const REFERRAL_ID = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-11-01T15:00:00.000Z';
const SENT_AT = '2026-10-20T12:00:00.000Z';
const GIVEN_AT = '2026-10-25T09:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;
const OVERDUE_NOTIFIED_TAG = { system: REFERRAL_OVERDUE_NOTIFIED_TAG_SYSTEM, code: REFERRAL_OVERDUE_NOTIFIED_TAG_CODE };

const input: SaveReferralInput = {
  patientId: PATIENT_ID,
  specialty: 'Orthopedics',
  recipientContactId: CONTACT_ID,
  reason: 'Distal radius fracture',
  urgency: 'urgent',
  whatIsAsked: 'evaluate-and-treat',
  whoSchedules: 'patient',
  responseRequested: true,
  includeDocuments: [],
};

const referral = (overrides: Partial<SaveReferralInput> = {}, sentAt?: string): ServiceRequest =>
  withReferralDetails(
    {
      ...makeReferralServiceRequest(
        { ...input, ...overrides },
        {
          patientId: PATIENT_ID,
          requester: { reference: 'Practitioner/prac-1', display: 'Jordan Rivera, MD' },
          now: NOW,
        }
      ),
      id: REFERRAL_ID,
    },
    sentAt ? { status: 'sent', sentAt } : {}
  );

const patient: Patient = { resourceType: 'Patient', id: PATIENT_ID, name: [{ given: ['Maya'], family: 'Example' }] };

const openTask = (urgency: string, end = '2026-10-27T12:00:00.000Z'): Task => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'in-progress',
  intent: 'order',
  authoredOn: NOW,
  groupIdentifier: { system: TASK_CATEGORY_IDENTIFIER, value: REFERRAL_TASK.category },
  basedOn: [{ reference: `ServiceRequest/${REFERRAL_ID}` }],
  owner: { reference: 'Practitioner/prac-1' },
  restriction: { period: { end } },
  input: [
    { type: { coding: [{ system: TASK_INPUT_SYSTEM, code: REFERRAL_TASK.input.urgency }] }, valueString: urgency },
  ],
});

describe('syncReferralTask', () => {
  const search = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const patch = vi.fn();
  const oystehr = { fhir: { search, create, update, patch } } as unknown as Oystehr;
  const owner = { reference: 'Practitioner/prac-1', display: 'Jordan Rivera, MD' };

  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation(async (task: Task) => ({ ...task, id: 'task-new' }));
    update.mockImplementation(async (task: Task) => task);
    patch.mockResolvedValue({});
  });

  const withTasks = (tasks: Task[]): void => {
    search.mockResolvedValue({ unbundle: () => tasks });
  };

  it('creates an owned task whose overdue clock counts from the send, when a response is requested', async () => {
    withTasks([]);

    await syncReferralTask({ oystehr, serviceRequest: referral({}, SENT_AT), patient, owner });

    expect(create).toHaveBeenCalledTimes(1);
    const [task] = create.mock.calls[0];
    expect(task).toMatchObject({
      status: 'in-progress',
      description: 'Referral: Orthopedics',
      groupIdentifier: { value: REFERRAL_TASK.category },
      code: { coding: [{ system: REFERRAL_TASK.system, code: REFERRAL_TASK.code.awaitResponse }] },
      owner: expect.objectContaining({ reference: 'Practitioner/prac-1' }),
      basedOn: [{ reference: `ServiceRequest/${REFERRAL_ID}` }],
      // urgent = 7 days after it was sent
      restriction: { period: { end: new Date(Date.parse(SENT_AT) + 7 * DAY_MS).toISOString() } },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('counts the clock from now for a referral that has not gone out yet', async () => {
    withTasks([]);
    const before = Date.now();

    await syncReferralTask({ oystehr, serviceRequest: referral(), patient, owner });

    const end = Date.parse(create.mock.calls[0][0].restriction.period.end);
    expect(end).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
    expect(end).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS);
  });

  it('refreshes the open task without moving its due date when the urgency is unchanged', async () => {
    withTasks([openTask('urgent')]);

    await syncReferralTask({
      oystehr,
      serviceRequest: referral({ specialty: 'Hand surgery' }, SENT_AT),
      patient,
      owner,
    });

    expect(create).not.toHaveBeenCalled();
    const [updated] = update.mock.calls[0];
    expect(updated).toMatchObject({
      id: 'task-1',
      description: 'Referral: Hand surgery',
      restriction: { period: { end: '2026-10-27T12:00:00.000Z' } },
    });
  });

  it('moves the due date, still anchored on the send, when the urgency changed', async () => {
    withTasks([openTask('urgent')]);

    await syncReferralTask({ oystehr, serviceRequest: referral({ urgency: 'routine' }, SENT_AT), patient, owner });

    const [updated] = update.mock.calls[0];
    // routine = 14 days after it was sent
    expect(updated.restriction).toEqual({ period: { end: new Date(Date.parse(SENT_AT) + 14 * DAY_MS).toISOString() } });
  });

  it('anchors a task created after the hand-over on when the patient was given the form, not on the save', async () => {
    withTasks([]);
    const givenToPatient = withReferralDetails(referral(), { status: 'given-to-patient', givenToPatientAt: GIVEN_AT });

    await syncReferralTask({ oystehr, serviceRequest: givenToPatient, patient, owner });

    // urgent = 7 days after the hand-over
    expect(create.mock.calls[0][0].restriction).toEqual({
      period: { end: new Date(Date.parse(GIVEN_AT) + 7 * DAY_MS).toISOString() },
    });
  });

  it('clears the overdue-notified mark when an urgency change moves the due date, so the new date is notified', async () => {
    withTasks([{ ...openTask('urgent'), meta: { tag: [{ code: 'task' }, OVERDUE_NOTIFIED_TAG] } }]);

    await syncReferralTask({ oystehr, serviceRequest: referral({ urgency: 'routine' }, SENT_AT), patient, owner });

    expect(update.mock.calls[0][0].meta.tag).toEqual([{ code: 'task' }]);
  });

  it('keeps the overdue-notified mark when an edit leaves the due date where it was', async () => {
    withTasks([{ ...openTask('urgent'), meta: { tag: [{ code: 'task' }, OVERDUE_NOTIFIED_TAG] } }]);

    await syncReferralTask({
      oystehr,
      serviceRequest: referral({ specialty: 'Hand surgery' }, SENT_AT),
      patient,
      owner,
    });

    expect(update.mock.calls[0][0].meta.tag).toEqual([{ code: 'task' }, OVERDUE_NOTIFIED_TAG]);
  });

  it('cancels the open task when the response request is withdrawn, and creates nothing', async () => {
    withTasks([openTask('urgent')]);

    await syncReferralTask({ oystehr, serviceRequest: referral({ responseRequested: false }), patient, owner });

    expect(patch).toHaveBeenCalledWith({
      resourceType: 'Task',
      id: 'task-1',
      operations: [{ op: 'replace', path: '/status', value: 'cancelled' }],
    });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('does nothing for a referral without a response request and without a task', async () => {
    withTasks([]);

    await syncReferralTask({ oystehr, serviceRequest: referral({ responseRequested: false }), patient, owner });

    expect(patch).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('buildReferralTask', () => {
  const patientWithMiddleName: Patient = { ...patient, name: [{ given: ['Maya', 'Lou'], family: 'Example' }] };

  it('names the patient as the review task does (first and last name) and leaves an unowned awaiting task ready', () => {
    const task = buildReferralTask({
      serviceRequest: referral(),
      patient: patientWithMiddleName,
      recipientName: 'Riverside',
    });

    expect(task).toMatchObject({
      status: 'ready',
      description: 'Referral: Orthopedics, Riverside',
      code: { coding: [{ system: REFERRAL_TASK.system, code: REFERRAL_TASK.code.awaitResponse }] },
      basedOn: [{ reference: `ServiceRequest/${REFERRAL_ID}` }],
    });
    expect(task.owner).toBeUndefined();
    const patientInput = task.input?.find((input) => input.type.coding?.[0]?.code === REFERRAL_TASK.input.patient);
    expect(patientInput?.valueReference).toEqual({ reference: `Patient/${PATIENT_ID}`, display: 'Maya Example' });
    expect(task.input?.find((input) => input.type.coding?.[0]?.code === REFERRAL_TASK.input.urgency)?.valueString).toBe(
      'urgent'
    );
  });

  it('builds a review task for a filed response, based on the document and owned by a Practitioner owner', () => {
    const task = buildReferralTask({
      serviceRequest: referral(),
      patient,
      owner: { reference: 'Practitioner/prac-1', display: 'Jordan Rivera, MD' },
      responseDocument: { reference: 'urn:uuid:doc' },
    });

    expect(task).toMatchObject({
      status: 'in-progress',
      description: 'Review response: Orthopedics referral',
      code: { coding: [{ system: REFERRAL_TASK.system, code: REFERRAL_TASK.code.reviewResponse }] },
      owner: expect.objectContaining({ reference: 'Practitioner/prac-1', display: 'Jordan Rivera, MD' }),
      basedOn: [{ reference: `ServiceRequest/${REFERRAL_ID}` }, { reference: 'urn:uuid:doc' }],
    });
    const codes = task.input?.map((input) => input.type.coding?.[0]?.code);
    expect(codes).toContain(REFERRAL_TASK.input.responseDocumentReferenceId);
    expect(codes).not.toContain(REFERRAL_TASK.input.urgency);
  });

  it('leaves the task unowned when the owner is not a Practitioner', () => {
    const task = buildReferralTask({ serviceRequest: referral(), patient, owner: { reference: 'Device/d-1' } });
    expect(task.status).toBe('ready');
    expect(task.owner).toBeUndefined();
  });
});

describe('findOpenReferralTask', () => {
  it('returns the newest open task, ignoring finished ones', async () => {
    const search = vi.fn().mockResolvedValue({
      unbundle: () => [
        { ...openTask('urgent'), id: 'older', authoredOn: '2026-10-01T00:00:00.000Z' },
        { ...openTask('urgent'), id: 'done', status: 'completed', authoredOn: '2026-10-20T00:00:00.000Z' },
        { ...openTask('urgent'), id: 'newer', status: 'ready', authoredOn: '2026-10-10T00:00:00.000Z' },
      ],
    });

    const task = await findOpenReferralTask({ fhir: { search } } as unknown as Oystehr, REFERRAL_ID);

    expect(task?.id).toBe('newer');
  });
});
