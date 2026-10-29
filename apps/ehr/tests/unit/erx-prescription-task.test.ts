import { Encounter, Task as FhirTask } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { ERX_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: vi.fn(),
  safelyCaptureException: vi.fn(),
}));

import { fhirTaskToTask, OPEN_DOSESPOT } from '../../src/features/visits/in-person/hooks/useTasks';

const TITLE = 'Prescription failed: Amoxicillin 500 MG Oral Capsule for Maria Lopez — Receiver unable to process';

const erxTask = (code: string): FhirTask => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'in-progress',
  intent: 'order',
  description: TITLE,
  groupIdentifier: { system: ottehrIdentifierSystem('task-category'), value: ERX_TASK.category },
  code: { coding: [{ system: ERX_TASK.system, code }] },
  encounter: { reference: 'Encounter/enc-1' },
  focus: { reference: 'MedicationRequest/rx-1' },
  owner: { reference: 'Practitioner/pr-1', display: 'Dr Smith' },
});

const encounters = new Map<string, Encounter>([
  [
    'enc-1',
    {
      resourceType: 'Encounter',
      id: 'enc-1',
      status: 'in-progress',
      class: { code: 'AMB' },
      appointment: [{ reference: 'Appointment/appt-1' }],
    },
  ],
]);

describe('eRx prescription tasks on the Tasks page', () => {
  it.each([ERX_TASK.code.prescriptionError, ERX_TASK.code.prescriptionUnconfirmed])(
    '%s shows its sentence, opens the visit eRx page and can be completed',
    (code) => {
      const task = fhirTaskToTask(erxTask(code), encounters);
      expect(task.title).toBe(TITLE);
      expect(task.action).toEqual({ name: 'Go to Prescription', link: '/in-person/appt-1/erx-surescripts' });
      expect(task.completable).toBe(true);
      expect(task.assignee?.id).toBe('pr-1');
    }
  );

  it('keeps the DoseSpot notification task as it was', () => {
    const task = fhirTaskToTask(erxTask(ERX_TASK.code.providerNotification), encounters);
    expect(task.action?.name).toBe(OPEN_DOSESPOT);
  });
});
