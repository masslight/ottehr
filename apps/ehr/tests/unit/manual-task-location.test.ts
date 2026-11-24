import { Task as FhirTask } from 'fhir/r4b';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: vi.fn(),
  safelyCaptureException: vi.fn(),
}));

import { fhirTaskToTask } from '../../src/features/visits/in-person/hooks/useTasks';

const manualTask = (location?: FhirTask['location']): FhirTask => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'ready',
  intent: 'order',
  groupIdentifier: { value: MANUAL_TASK.category.other },
  location,
  input: [
    { type: { coding: [{ system: TASK_INPUT_SYSTEM, code: MANUAL_TASK.input.title }] }, valueString: 'Call the lab' },
    {
      type: { coding: [{ system: TASK_INPUT_SYSTEM, code: MANUAL_TASK.input.providerName }] },
      valueString: 'Demo User',
    },
  ],
});

describe('manual task location in the subtitle', () => {
  it('names the location the task was created for', () => {
    expect(fhirTaskToTask(manualTask({ reference: 'Location/loc-1', display: 'NY - New York' })).subtitle).toBe(
      'Manual task by Demo User / NY - New York'
    );
  });

  it('names only the creator when the task has no location', () => {
    expect(fhirTaskToTask(manualTask()).subtitle).toBe('Manual task by Demo User');
  });
});
