import { Patient, Task as FhirTask } from 'fhir/r4b';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: vi.fn(),
  safelyCaptureException: vi.fn(),
}));

import { getPatientLabel } from '../../src/features/tasks/common';
import { fhirTaskToTask } from '../../src/features/visits/in-person/hooks/useTasks';

const patient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['Jane'], family: 'Doe' }],
  birthDate: '1958-08-30',
};

const input = (
  code: string,
  value: Partial<NonNullable<FhirTask['input']>[number]>
): NonNullable<FhirTask['input']>[number] =>
  ({ type: { coding: [{ system: TASK_INPUT_SYSTEM, code }] }, ...value }) as NonNullable<FhirTask['input']>[number];

const manualTask = (params: {
  category: string;
  patientDisplay: string;
  title?: string;
  documentReferenceId?: string;
}): FhirTask => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'requested',
  intent: 'order',
  groupIdentifier: { value: params.category },
  input: [
    ...(params.title ? [input(MANUAL_TASK.input.title, { valueString: params.title })] : []),
    input(MANUAL_TASK.input.patient, {
      valueReference: { reference: 'Patient/patient-1', display: params.patientDisplay },
    }),
    ...(params.documentReferenceId
      ? [input(MANUAL_TASK.input.documentReferenceId, { valueString: params.documentReferenceId })]
      : []),
  ],
});

describe('task patient dates', () => {
  it('labels a patient with the birth date as MM/DD/YYYY', () => {
    expect(getPatientLabel(patient)).toMatch(/\(08\/30\/1958\)$/);
  });

  it.each([undefined, '1958-02-30'])('labels a patient by name only when the birth date is %s', (birthDate) => {
    expect(getPatientLabel({ ...patient, birthDate })).not.toContain('(');
  });

  it('shows the patient label a new manual task stores as is', () => {
    const task = manualTask({
      category: MANUAL_TASK.category.other,
      title: 'Right thumb X-ray',
      patientDisplay: getPatientLabel(patient),
    });

    expect(fhirTaskToTask(task).title).toMatch(/^Right thumb X-ray for .*\(08\/30\/1958\)$/);
  });

  it('shows the YYYY-MM-DD birth date stored on older manual tasks as MM/DD/YYYY', () => {
    const task = manualTask({
      category: MANUAL_TASK.category.other,
      title: 'Right thumb X-ray',
      patientDisplay: 'Doe, Jane (1958-08-30)',
    });

    expect(fhirTaskToTask(task).title).toBe('Right thumb X-ray for Doe Jane (08/30/1958)');
  });

  it('keeps a stored birth date that is not a real date as it was', () => {
    const task = manualTask({
      category: MANUAL_TASK.category.other,
      title: 'Right thumb X-ray',
      patientDisplay: 'Doe, Jane (1958-13-01)',
    });

    expect(fhirTaskToTask(task).title).toBe('Right thumb X-ray for Doe Jane (1958-13-01)');
  });

  it('shows the YYYY-MM-DD birth date stored on older patient follow-up tasks as MM/DD/YYYY', () => {
    const task = manualTask({
      category: MANUAL_TASK.category.patientFollowUp,
      patientDisplay: 'Doe, Jane (1958-08-30)',
      documentReferenceId: 'doc-1',
    });

    expect(fhirTaskToTask(task).title).toBe('Patient follow-up for Doe Jane (08/30/1958)');
  });
});
