import { Task } from 'fhir/r4b';
import { ERX_REQUEST_TASK_INPUT_SYSTEM, SURESCRIPTS_MESSAGE_ID_SYSTEM } from 'utils/lib/fhir/constants';
import { ERX_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it } from 'vitest';
import {
  makeRefillRequestTask,
  readPharmacyRefillRequest,
  refillRequestTaskAction,
  refillRequestTitle,
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
    const task = makeRefillRequestTask(
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
