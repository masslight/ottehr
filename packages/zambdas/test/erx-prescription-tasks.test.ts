import { Task } from 'fhir/r4b';
import { ErxEventDTO, PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ERX_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it } from 'vitest';
import { prescriptionTaskTitle, prescriptionTaskToCreate } from '../src/shared/erx-prescription-tasks';

const SENT = '2026-10-27T15:00:00.000Z';
const errorEvent: ErxEventDTO = {
  code: 'error 601',
  text: 'Surescripts reported an error: Receiver unable to process',
  recorded: '2026-10-27T15:05:00.000Z',
};
const faxedEvent: ErxEventDTO = { code: 'faxed', text: 'Sent by fax', recorded: '2026-10-27T15:05:00.000Z' };

const rx = (status: PrescribedMedicationDTO['status'], ...events: ErxEventDTO[]): PrescribedMedicationDTO => ({
  resourceId: 'rx-1',
  name: 'Amoxicillin 500 MG Oral Capsule',
  status,
  encounterId: 'enc-1',
  pharmacyName: 'Main St Pharmacy',
  sent: SENT,
  events: [{ code: 'ordered', recorded: SENT }, ...events],
});

const task = (code: string, status: Task['status']): Task => ({
  resourceType: 'Task',
  status,
  intent: 'order',
  code: { coding: [{ system: ERX_TASK.system, code }] },
  focus: { reference: 'MedicationRequest/rx-1' },
});

describe('error task for a prescription', () => {
  it('is made for a prescription Surescripts stopped', () => {
    expect(prescriptionTaskToCreate(rx('stopped', errorEvent), [])).toBe(ERX_TASK.code.prescriptionError);
  });

  it('is not made for a faxed prescription, or one that is sending, sent or cancelled', () => {
    expect(prescriptionTaskToCreate(rx('stopped', faxedEvent, errorEvent), [])).toBeUndefined();
    expect(prescriptionTaskToCreate(rx('draft'), [])).toBeUndefined();
    expect(prescriptionTaskToCreate(rx('active'), [])).toBeUndefined();
    expect(prescriptionTaskToCreate(rx('cancelled'), [])).toBeUndefined();
  });

  it('is not made while an open task points at the prescription', () => {
    expect(prescriptionTaskToCreate(rx('stopped', errorEvent), [task('any', 'ready')])).toBeUndefined();
    expect(
      prescriptionTaskToCreate(rx('stopped', errorEvent), [task(ERX_TASK.code.prescriptionError, 'in-progress')])
    ).toBeUndefined();
  });

  it('is not made again once completed, but a completed task of another kind does not count', () => {
    expect(
      prescriptionTaskToCreate(rx('stopped', errorEvent), [task(ERX_TASK.code.prescriptionError, 'completed')])
    ).toBeUndefined();
    expect(prescriptionTaskToCreate(rx('stopped', errorEvent), [task('other', 'completed')])).toBe(
      ERX_TASK.code.prescriptionError
    );
  });

  it('names the medication, the patient and the error', () => {
    expect(prescriptionTaskTitle(ERX_TASK.code.prescriptionError, rx('stopped', errorEvent), 'Maria Lopez')).toBe(
      'Prescription failed: Amoxicillin 500 MG Oral Capsule for Maria Lopez — Receiver unable to process'
    );
    expect(prescriptionTaskTitle(ERX_TASK.code.prescriptionError, rx('stopped'), 'Maria Lopez')).toBe(
      'Prescription failed: Amoxicillin 500 MG Oral Capsule for Maria Lopez'
    );
  });
});
