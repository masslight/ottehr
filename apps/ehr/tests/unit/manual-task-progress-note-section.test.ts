import { Task as FhirTask } from 'fhir/r4b';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
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

const makeManualTask = (category: string, inputs: NonNullable<FhirTask['input']>): FhirTask => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'requested',
  intent: 'order',
  groupIdentifier: { value: category },
  input: [input(MANUAL_TASK.input.title, 'Recheck vitals'), ...inputs],
});

describe('manual task linked to a progress note section', () => {
  it('opens that section of the visit', () => {
    const task = fhirTaskToTask(
      makeManualTask(MANUAL_TASK.category.charting, [
        input(MANUAL_TASK.input.appointmentId, 'appt-1'),
        input(MANUAL_TASK.input.progressNoteSection, 'vitals'),
      ])
    );

    expect(task.action?.link).toBe('/in-person/appt-1/vitals');
  });

  it('opens the visit when the stored section is no longer in the sidebar', () => {
    const task = fhirTaskToTask(
      makeManualTask(MANUAL_TASK.category.charting, [
        input(MANUAL_TASK.input.appointmentId, 'appt-1'),
        input(MANUAL_TASK.input.progressNoteSection, 'retired-section'),
      ])
    );

    expect(task.action?.link).toBe('/in-person/appt-1');
  });

  it('opens the linked order rather than the section', () => {
    const task = fhirTaskToTask(
      makeManualTask(MANUAL_TASK.category.nursingOrders, [
        input(MANUAL_TASK.input.appointmentId, 'appt-1'),
        input(MANUAL_TASK.input.orderId, 'order-1'),
        input(MANUAL_TASK.input.progressNoteSection, 'vitals'),
      ])
    );

    expect(task.action?.link).toBe('/in-person/appt-1/nursing-orders/order-1/order-details');
  });
});
