import { Encounter, Task as FhirTask } from 'fhir/r4b';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: vi.fn(),
  safelyCaptureException: vi.fn(),
}));

import { fhirTaskToTask, VIEW_FAX } from '../../src/features/visits/in-person/hooks/useTasks';

const input = (code: string, valueString: string): NonNullable<FhirTask['input']>[number] => ({
  type: { coding: [{ system: TASK_INPUT_SYSTEM, code }] },
  valueString,
});

const makeReviewTask = (inputs: NonNullable<FhirTask['input']>): FhirTask => ({
  resourceType: 'Task',
  id: 'review-1',
  status: 'in-progress',
  intent: 'order',
  description: 'Review fax “Referral” for Frodo Baggins',
  groupIdentifier: { value: 'inbound-fax' },
  code: { coding: [{ system: 'inbound-fax-task', code: 'review-inbound-fax' }] },
  input: [
    input('patient-id', 'patient-1'),
    input('folder-id', 'list-1'),
    input('communication-id', 'comm-1'),
    ...inputs,
  ],
});

describe('inbound fax review task', () => {
  it('opens the Documents tab of the visit the fax was attached to', () => {
    const task = fhirTaskToTask(makeReviewTask([input('appointment-id', 'appt-1')]));

    expect(task.action).toEqual({ name: VIEW_FAX, link: '/in-person/appt-1/documents' });
  });

  it("opens a follow-up's Documents tab through its original visit", () => {
    const followUp: Encounter = {
      resourceType: 'Encounter',
      id: 'enc-fu',
      status: 'in-progress',
      class: { code: 'AMB' },
      type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }],
      partOf: { reference: 'Encounter/enc-1' },
    };
    const reviewTask = {
      ...makeReviewTask([input('appointment-id', 'appt-1')]),
      encounter: { reference: 'Encounter/enc-fu' },
    };

    const task = fhirTaskToTask(reviewTask, new Map([['enc-fu', followUp]]));

    expect(task.action).toEqual({ name: VIEW_FAX, link: '/in-person/appt-1/documents?encounterId=enc-fu' });
  });

  it('opens the patient Docs folder the fax was filed into when no visit was chosen', () => {
    const task = fhirTaskToTask(makeReviewTask([]));

    expect(task.action).toEqual({ name: VIEW_FAX, link: '/patient/patient-1/docs?folderId=list-1' });
  });

  // `VIEW_FAX` is also what keeps the Tasks queue from asking "Complete without filing?" for this task.
  it('is titled from its description and can be completed', () => {
    const task = fhirTaskToTask(makeReviewTask([]));

    expect(task.title).toBe('Review fax “Referral” for Frodo Baggins');
    expect(task.completable).toBe(true);
    expect(task.action?.name).toBe(VIEW_FAX);
  });
});
