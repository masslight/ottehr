import { Encounter, Task as FhirTask } from 'fhir/r4b';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: vi.fn(),
  safelyCaptureException: vi.fn(),
}));

import { fhirTaskToTask } from '../../src/features/visits/in-person/hooks/useTasks';

const input = (code: string, valueString: string): NonNullable<FhirTask['input']>[number] => ({
  type: { coding: [{ system: TASK_INPUT_SYSTEM, code }] },
  valueString,
});

const makeOrderTask = (category: string): FhirTask => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'requested',
  intent: 'order',
  groupIdentifier: { value: category },
  input: [
    input(MANUAL_TASK.input.title, 'Check the order'),
    input(MANUAL_TASK.input.appointmentId, 'appt-1'),
    input(MANUAL_TASK.input.orderId, 'order-1'),
  ],
});

const followUpEncounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'in-progress',
  class: { code: 'AMB' },
  type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }],
};

describe('manual task linked to an order', () => {
  it.each([
    [MANUAL_TASK.category.immunization, '/in-person/appt-1/immunization/vaccine-details?scrollTo=order-1'],
    [MANUAL_TASK.category.dme, '/in-person/appt-1/dme/order-1/order-details'],
  ])('opens the %s order', (category, link) => {
    expect(fhirTaskToTask(makeOrderTask(category)).action?.link).toBe(link);
  });

  it("scrolls to the immunization order within the task's follow-up encounter", () => {
    const task = { ...makeOrderTask(MANUAL_TASK.category.immunization), encounter: { reference: 'Encounter/enc-1' } };

    expect(fhirTaskToTask(task, new Map([['enc-1', followUpEncounter]])).action?.link).toBe(
      '/in-person/appt-1/immunization/vaccine-details?scrollTo=order-1&encounterId=enc-1'
    );
  });
});
