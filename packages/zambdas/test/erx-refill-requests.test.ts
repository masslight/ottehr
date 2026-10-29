import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import {
  ERX_CHANGE_REQUEST_TASK_CODE,
  ERX_REQUEST_TASK_CODE_SYSTEM,
  ERX_REQUEST_TASK_INPUT_SYSTEM,
  SURESCRIPTS_MESSAGE_ID_SYSTEM,
} from 'utils/lib/fhir/constants';
import { ERX_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';
import {
  makeErxRequestTask,
  readPharmacyChangeRequest,
  readPharmacyRefillRequest,
  refillRequestTaskAction,
  refillRequestTitle,
  syncErxRequestTask,
} from '../src/shared/erx-refill-requests';

const input = (code: string, valueString: string): NonNullable<Task['input']>[number] => ({
  type: { coding: [{ system: ERX_REQUEST_TASK_INPUT_SYSTEM, code }] },
  valueString,
});

const renewal = (status: Task['status']): Task => ({
  resourceType: 'Task',
  id: 'renewal-1',
  status,
  intent: 'order',
  focus: { reference: 'MedicationRequest/rx-1' },
  for: { reference: 'Patient/patient-1' },
  encounter: { reference: 'Encounter/encounter-1' },
  requester: { display: 'CVS Pharmacy #7741' },
  owner: { reference: 'Practitioner/practitioner-1' },
  input: [input('pharmacy-name', 'CVS Pharmacy #7741'), input('drug-description', 'Lisinopril 10 mg tablet')],
});

const ottehrTask = (status: Task['status']): Task => ({ resourceType: 'Task', id: 'task-1', status, intent: 'order' });

describe('eRx refill request tasks', () => {
  it('makes one task while the request is open, and none for a closed one', () => {
    expect(refillRequestTaskAction(renewal('requested'), [])).toBe('create');
    // Answered Pending: still open.
    expect(refillRequestTaskAction(renewal('in-progress'), [])).toBe('create');
    expect(refillRequestTaskAction(renewal('cancelled'), [])).toBeUndefined();
    // Asked again: the same Task changed; its task stays as it is.
    expect(refillRequestTaskAction(renewal('requested'), [ottehrTask('in-progress')])).toBeUndefined();
    // One already completed isn't made again.
    expect(refillRequestTaskAction(renewal('requested'), [ottehrTask('completed')])).toBeUndefined();
  });

  it('makes a new task when the pharmacy asks again after its task was closed unanswered', () => {
    const asked = (status: Task['status'], id: string): Task => ({
      ...renewal(status),
      identifier: [{ system: SURESCRIPTS_MESSAGE_ID_SYSTEM, value: id }],
    });
    const closedFor = (id: string): Task => ({
      ...ottehrTask('completed'),
      identifier: asked('requested', id).identifier,
    });
    expect(refillRequestTaskAction(asked('requested', 'm2'), [closedFor('m1')])).toBe('create');
    // The same request: closed by whoever answered or dismissed it.
    expect(refillRequestTaskAction(asked('in-progress', 'm1'), [closedFor('m1')])).toBeUndefined();
    expect(refillRequestTaskAction(asked('requested', 'm2'), [closedFor('m1'), closedFor('m2')])).toBeUndefined();
    expect(
      refillRequestTaskAction(asked('requested', 'm2'), [closedFor('m1'), ottehrTask('in-progress')])
    ).toBeUndefined();
    // Each task names the request it was made for.
    expect(makeErxRequestTask(asked('requested', 'm2'), undefined, undefined).identifier).toEqual([
      { system: SURESCRIPTS_MESSAGE_ID_SYSTEM, value: 'm2' },
    ]);
  });

  it('makes the task conditionally on its request, so racing deliveries make one', async () => {
    const create = vi.fn(async (task: Task, _options: unknown) => ({ ...task, id: 'task-1' }));
    const oystehr = {
      fhir: { search: async () => ({ unbundle: () => [] }), get: async () => undefined, create },
    } as unknown as Oystehr;
    const request: Task = {
      ...renewal('requested'),
      identifier: [{ system: SURESCRIPTS_MESSAGE_ID_SYSTEM, value: 'm1' }],
    };
    await syncErxRequestTask(oystehr, request);
    expect(create.mock.calls[0][1]).toEqual({
      ifNoneExist: [
        { name: 'based-on', value: 'Task/renewal-1' },
        { name: 'identifier', value: `${SURESCRIPTS_MESSAGE_ID_SYSTEM}|m1` },
      ],
    });
  });

  it('completes the task once the request is withdrawn or answered', () => {
    expect(refillRequestTaskAction(renewal('cancelled'), [ottehrTask('in-progress')])).toBe('complete');
    expect(refillRequestTaskAction(renewal('completed'), [ottehrTask('ready')])).toBe('complete');
    expect(refillRequestTaskAction(renewal('completed'), [ottehrTask('completed')])).toBeUndefined();
  });

  it('names the pharmacy, the medication and the patient', () => {
    expect(refillRequestTitle(renewal('requested'), 'Maria Lopez')).toBe(
      'Refill request from CVS Pharmacy #7741: Lisinopril 10 mg tablet for Maria Lopez'
    );
  });

  it('is an eRx task basedOn the request, in its visit, assigned to the prescriber', () => {
    const task = makeErxRequestTask(
      renewal('requested'),
      { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Maria'], family: 'Lopez' }] },
      { resourceType: 'Practitioner', id: 'practitioner-1', name: [{ given: ['Carolyn'], family: 'Demo' }] }
    );
    expect(task.groupIdentifier?.value).toBe(ERX_TASK.category);
    expect(task.code?.coding?.[0]).toEqual({ system: ERX_TASK.system, code: ERX_TASK.code.refillRequest });
    expect(task.basedOn).toEqual([{ reference: 'Task/renewal-1' }]);
    expect(task.encounter).toEqual({ reference: 'Encounter/encounter-1' });
    expect(task.status).toBe('in-progress');
    expect(task.owner?.reference).toBe('Practitioner/practitioner-1');
    expect(task.description).toBe('Refill request from CVS Pharmacy #7741: Lisinopril 10 mg tablet for Maria Lopez');
  });
});

const version = (
  status: Task['status'],
  messageId: string,
  lastUpdated: string,
  inputs = renewal(status).input
): Task => ({
  ...renewal(status),
  authoredOn: '2026-10-27T16:12:00.000Z',
  meta: { lastUpdated },
  identifier: [{ system: SURESCRIPTS_MESSAGE_ID_SYSTEM, value: messageId }],
  input: inputs,
});

describe('a pharmacy refill request, as the dialog reads it', () => {
  it('keeps only what the pharmacy sent: a field it left out stays absent, never 0', () => {
    const request = readPharmacyRefillRequest([
      version('requested', 'm1', '2026-10-27T16:12:00.000Z', [
        ...(renewal('requested').input ?? []),
        { type: { coding: [{ system: ERX_REQUEST_TASK_INPUT_SYSTEM, code: 'quantity' }] }, valueDecimal: 0.27 },
      ]),
    ]);
    expect(request.medication).toEqual({ description: 'Lisinopril 10 mg tablet', quantityValue: 0.27 });
    expect(request.medication.daysSupply).toBeUndefined();
    expect(request.medication.requestedRefills).toBeUndefined();
    expect(request.pharmacy.name).toBe('CVS Pharmacy #7741');
    expect(request).toMatchObject({ received: '2026-10-27T16:12:00.000Z', withdrawn: false, closed: false });
    expect(request.askedAgain).toBeUndefined();
  });

  it('says when the pharmacy asked again: the first version with the newest message id', () => {
    const request = readPharmacyRefillRequest([
      version('requested', 'm1', '2026-10-27T16:12:00.000Z'),
      version('in-progress', 'm1', '2026-10-27T17:00:00.000Z'),
      version('requested', 'm2', '2026-10-28T09:05:00.000Z'),
      version('requested', 'm2', '2026-10-28T09:06:00.000Z'),
    ]);
    expect(request.askedAgain).toBe('2026-10-28T09:05:00.000Z');
    expect(request.received).toBe('2026-10-27T16:12:00.000Z');
  });

  it('is withdrawn once the eRx service cancels its Task', () => {
    const request = readPharmacyRefillRequest([
      version('requested', 'm1', '2026-10-25T10:00:00.000Z'),
      version('cancelled', 'm1', '2026-10-26T10:00:00.000Z'),
    ]);
    expect(request).toMatchObject({ withdrawn: true, closed: true });
  });
});

const change = (status: Task['status'], inputs: NonNullable<Task['input']>): Task => ({
  ...renewal(status),
  id: 'change-1',
  code: { coding: [{ system: ERX_REQUEST_TASK_CODE_SYSTEM, code: ERX_CHANGE_REQUEST_TASK_CODE }] },
  authoredOn: '2026-10-28T14:02:00.000Z',
  meta: { lastUpdated: '2026-10-28T14:02:00.000Z' },
  identifier: [{ system: SURESCRIPTS_MESSAGE_ID_SYSTEM, value: 'c1' }],
  input: [input('pharmacy-name', 'CVS Pharmacy #7741'), ...inputs],
});

describe('eRx change request tasks', () => {
  it('are made and completed as refill requests are', () => {
    expect(refillRequestTaskAction(change('requested', []), [])).toBe('create');
    expect(refillRequestTaskAction(change('requested', []), [ottehrTask('in-progress')])).toBeUndefined();
    expect(refillRequestTaskAction(change('cancelled', []), [ottehrTask('in-progress')])).toBe('complete');
    expect(refillRequestTaskAction(change('completed', []), [ottehrTask('in-progress')])).toBe('complete');
  });

  it('is a change request task named by the pharmacy, the original medication, the patient and the kind', () => {
    const task = makeErxRequestTask(
      change('requested', [input('change-code', 'OS')]),
      { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Maria'], family: 'Lopez' }] },
      { resourceType: 'Practitioner', id: 'practitioner-1', name: [{ given: ['Carolyn'], family: 'Demo' }] },
      {
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/patient-1' },
        medicationCodeableConcept: { coding: [{ code: '64764017130', display: 'Dexilant 30 mg capsule' }] },
      }
    );
    expect(task.code?.coding?.[0]).toEqual({ system: ERX_TASK.system, code: ERX_TASK.code.changeRequest });
    expect(task.basedOn).toEqual([{ reference: 'Task/change-1' }]);
    expect(task.owner?.reference).toBe('Practitioner/practitioner-1');
    expect(task.description).toBe(
      'Change request from CVS Pharmacy #7741: Dexilant 30 mg capsule for Maria Lopez — Out of stock'
    );
  });
});

describe('a pharmacy change request, as the dialog reads it', () => {
  it('reads the kind, sub-codes, words and suggestions, keeping only what the pharmacy sent', () => {
    const request = readPharmacyChangeRequest([
      change('requested', [
        input('change-code', 'OS'),
        input('change-sub-codes', 'A,B'),
        input('change-reason', 'Dexilant on backorder until December'),
        input(
          'requested-medications',
          JSON.stringify([
            { description: 'Omeprazole 40 mg capsule', ndc: '00093521998', quantityValue: 0.27, numberOfRefills: 0 },
            { description: 'Pantoprazole 40 mg tablet' },
          ])
        ),
      ]),
    ]);
    expect(request).toMatchObject({
      changeTaskId: 'change-1',
      code: 'OS',
      subCodes: ['A', 'B'],
      reason: 'Dexilant on backorder until December',
      received: '2026-10-28T14:02:00.000Z',
      withdrawn: false,
      closed: false,
    });
    expect(request.suggestions).toEqual([
      { description: 'Omeprazole 40 mg capsule', ndc: '00093521998', quantityValue: 0.27, numberOfRefills: 0 },
      { description: 'Pantoprazole 40 mg tablet' },
    ]);
    // Left out: absent, never 0 or the original's.
    expect(request.suggestions[1].quantityValue).toBeUndefined();
    expect(request.suggestions[1].daysSupply).toBeUndefined();
    expect(request.suggestions[1].numberOfRefills).toBeUndefined();
  });

  it('has no suggestions for a prior authorization request', () => {
    const request = readPharmacyChangeRequest([change('requested', [input('change-code', 'P')])]);
    expect(request).toMatchObject({ code: 'P', subCodes: [], suggestions: [] });
    expect(request.reason).toBeUndefined();
  });
});
