import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ErxEventDTO, PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ERX_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it } from 'vitest';
import {
  ErxPrescription,
  isPrescriptionSettled,
  prescriptionTaskTitle,
  prescriptionTaskToCreate,
} from '../src/shared/erx-prescription-tasks';

const SENT = '2026-10-27T15:00:00.000Z';
// Within 24 hours of sending
const NOW = DateTime.fromISO('2026-10-27T16:00:00.000Z');
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
    expect(prescriptionTaskToCreate(rx('stopped', errorEvent), [], NOW)).toBe(ERX_TASK.code.prescriptionError);
  });

  it('is not made for a faxed prescription, or one that is sending, sent or cancelled', () => {
    expect(prescriptionTaskToCreate(rx('stopped', faxedEvent, errorEvent), [], NOW)).toBeUndefined();
    expect(prescriptionTaskToCreate(rx('draft'), [], NOW)).toBeUndefined();
    expect(prescriptionTaskToCreate(rx('active'), [], NOW)).toBeUndefined();
    expect(prescriptionTaskToCreate(rx('cancelled'), [], NOW)).toBeUndefined();
  });

  it('is not made while an open task points at the prescription', () => {
    expect(prescriptionTaskToCreate(rx('stopped', errorEvent), [task('any', 'ready')], NOW)).toBeUndefined();
    expect(
      prescriptionTaskToCreate(rx('stopped', errorEvent), [task(ERX_TASK.code.prescriptionError, 'in-progress')], NOW)
    ).toBeUndefined();
  });

  it('is not made again once completed, but a completed task of another kind does not count', () => {
    expect(
      prescriptionTaskToCreate(rx('stopped', errorEvent), [task(ERX_TASK.code.prescriptionError, 'completed')], NOW)
    ).toBeUndefined();
    expect(prescriptionTaskToCreate(rx('stopped', errorEvent), [task('other', 'completed')], NOW)).toBe(
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

describe('no-confirmation task for a prescription', () => {
  const at = (hours: number): DateTime => DateTime.fromISO(SENT).plus({ hours });

  it('is made once a prescription has been Sending for 24 hours, faxed or not', () => {
    expect(prescriptionTaskToCreate(rx('draft'), [], at(23.9))).toBeUndefined();
    expect(prescriptionTaskToCreate(rx('draft'), [], at(24))).toBe(ERX_TASK.code.prescriptionUnconfirmed);
    expect(prescriptionTaskToCreate(rx('draft', faxedEvent), [], at(30))).toBe(ERX_TASK.code.prescriptionUnconfirmed);
  });

  it('is not made while an open task points at it, or again once completed', () => {
    expect(prescriptionTaskToCreate(rx('draft'), [task('any', 'ready')], at(30))).toBeUndefined();
    expect(
      prescriptionTaskToCreate(rx('draft'), [task(ERX_TASK.code.prescriptionUnconfirmed, 'completed')], at(30))
    ).toBeUndefined();
  });

  it('is not made for a sent, cancelled or stopped prescription; a stopped one gets the error task', () => {
    expect(prescriptionTaskToCreate(rx('active'), [], at(30))).toBeUndefined();
    expect(prescriptionTaskToCreate(rx('cancelled'), [], at(30))).toBeUndefined();
    expect(prescriptionTaskToCreate(rx('stopped', errorEvent), [], at(30))).toBe(ERX_TASK.code.prescriptionError);
  });

  it('names the pharmacy, the medication and the patient', () => {
    expect(prescriptionTaskTitle(ERX_TASK.code.prescriptionUnconfirmed, rx('draft'), 'Maria Lopez')).toBe(
      'No confirmation from Main St Pharmacy after 24 hours — call the pharmacy to confirm Amoxicillin 500 MG Oral ' +
        'Capsule for Maria Lopez'
    );
  });
});

describe('closing a task when its prescription is settled', () => {
  const erx = (
    resourceId: string,
    status: PrescribedMedicationDTO['status'],
    extra: Partial<ErxPrescription> = {}
  ): ErxPrescription => ({
    ...rx(status),
    resourceId,
    order: { ndc: '00093310901' },
    replaces: [],
    ...extra,
  });

  it('settles a prescription that went through or was cancelled', () => {
    expect(isPrescriptionSettled(erx('rx-1', 'active'), [])).toBe(true);
    expect(isPrescriptionSettled(erx('rx-1', 'cancelled'), [])).toBe(true);
    expect(isPrescriptionSettled(erx('rx-1', 'draft'), [])).toBe(false);
    expect(isPrescriptionSettled(erx('rx-1', 'stopped'), [])).toBe(false);
  });

  it('settles one replaced by the same medication sent later in the visit, or one approved from it', () => {
    const original = erx('rx-1', 'stopped');
    const resent = erx('rx-2', 'draft', { sent: '2026-10-27T16:00:00.000Z' });
    expect(isPrescriptionSettled(original, [original, resent])).toBe(true);
    const approved = erx('rx-3', 'active', { order: { ndc: '99999999999' }, replaces: ['rx-1'] });
    expect(isPrescriptionSettled(original, [original, approved])).toBe(true);
  });

  it('does not settle one when the same medication was sent earlier, elsewhere, or is another medication', () => {
    const original = erx('rx-1', 'stopped');
    const earlier = erx('rx-2', 'active', { sent: '2026-10-27T14:00:00.000Z' });
    const otherVisit = erx('rx-3', 'active', { encounterId: 'enc-2', sent: '2026-10-27T16:00:00.000Z' });
    const otherMedication = erx('rx-4', 'active', { order: { ndc: '99999999999' }, sent: '2026-10-27T16:00:00.000Z' });
    expect(isPrescriptionSettled(original, [original, earlier, otherVisit, otherMedication])).toBe(false);
  });
});
