import { Task as FhirTask } from 'fhir/r4b';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { MANUAL_TASK, PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: vi.fn(),
  safelyCaptureException: vi.fn(),
}));

import { fhirTaskToTask } from '../../src/features/visits/in-person/hooks/useTasks';

const input = (
  code: string,
  value: Partial<NonNullable<FhirTask['input']>[number]>
): NonNullable<FhirTask['input']>[number] => ({
  type: { coding: [{ system: TASK_INPUT_SYSTEM, code }] },
  ...value,
});

const requestTask = (code: string, appointmentId?: string): FhirTask => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'ready',
  intent: 'order',
  groupIdentifier: { value: PATIENT_REQUEST_TASK.category },
  code: { coding: [{ system: PATIENT_REQUEST_TASK.system, code }] },
  description: 'Request',
  input: [
    input(MANUAL_TASK.input.patient, { valueReference: { reference: 'Patient/patient-1' } }),
    ...(appointmentId ? [input(MANUAL_TASK.input.appointmentId, { valueString: appointmentId })] : []),
  ],
});

describe('patient request quick action', () => {
  it.each(Object.values(PATIENT_REQUEST_TASK.code))(
    'opens the patient record for a %s task without a visit',
    (code) => {
      expect(fhirTaskToTask(requestTask(code)).action).toEqual({ name: 'Patient Record', link: '/patient/patient-1' });
    }
  );

  it('opens eRX for a prescription refill linked to a visit', () => {
    expect(
      fhirTaskToTask(requestTask(PATIENT_REQUEST_TASK.code.prescriptionRefill, 'appointment-1')).action?.name
    ).toBe('eRX');
  });
});
