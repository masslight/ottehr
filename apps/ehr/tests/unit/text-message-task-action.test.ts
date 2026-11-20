import { Task as FhirTask } from 'fhir/r4b';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { MANUAL_TASK, PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: vi.fn(),
  safelyCaptureException: vi.fn(),
}));

import { fhirTaskToTask } from '../../src/features/visits/in-person/hooks/useTasks';

describe('text message task on the Tasks page', () => {
  it('opens the Patient Record (Review & Sign has no chat), even with a linked visit', () => {
    const task: FhirTask = {
      resourceType: 'Task',
      id: 'task-1',
      status: 'ready',
      intent: 'order',
      groupIdentifier: { value: PATIENT_REQUEST_TASK.category },
      code: { coding: [{ system: PATIENT_REQUEST_TASK.system, code: PATIENT_REQUEST_TASK.code.textMessage }] },
      description: 'Text message from Jane Doe 11/27/2026',
      input: [
        { type: { coding: [{ system: TASK_INPUT_SYSTEM, code: MANUAL_TASK.input.appointmentId }] }, valueString: 'a-1' },
        {
          type: { coding: [{ system: TASK_INPUT_SYSTEM, code: MANUAL_TASK.input.patient }] },
          valueReference: { reference: 'Patient/pat-1' },
        },
      ],
    };
    expect(fhirTaskToTask(task).action).toEqual({ name: 'Patient Record', link: '/patient/pat-1' });
  });
});
