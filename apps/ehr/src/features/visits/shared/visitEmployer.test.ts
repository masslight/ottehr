import { describe, expect, test } from 'vitest';
import { buildVisitEmployerUpdate } from './visitEmployer';

describe('buildVisitEmployerUpdate', () => {
  test('passes a selected employer reference through', () => {
    const ref = { reference: 'Organization/abc', display: 'Acme' };
    expect(buildVisitEmployerUpdate('appt-1', ref)).toEqual({
      appointmentId: 'appt-1',
      bookingDetails: { visitOccupationalMedicineEmployer: ref },
    });
  });

  // The "clear" path is what the visit-details endpoint relies on to remove the extension.
  test('maps null/undefined employer to null (clear)', () => {
    expect(buildVisitEmployerUpdate('appt-1', null).bookingDetails.visitOccupationalMedicineEmployer).toBeNull();
    expect(buildVisitEmployerUpdate('appt-1', undefined).bookingDetails.visitOccupationalMedicineEmployer).toBeNull();
  });
});
