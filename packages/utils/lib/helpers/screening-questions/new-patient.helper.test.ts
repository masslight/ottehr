import { Appointment } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { RETURNING_PATIENT_META_TAG } from '../../types/constants';
import {
  PATIENT_SEEN_IN_LAST_THREE_YEARS_FIELD,
  RecentVisitKeys,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
} from '../../types/data/screening-questions/constants';
import { isNewPatient, isWithinNewPatientLookback, newPatientLookbackStart } from './new-patient.helper';

const staffSaid = (value: string): { field: string; value: string } => ({
  field: SEEN_IN_LAST_THREE_YEARS_FIELD,
  value,
});
const patientSaid = (value: boolean): { field: string; value: boolean } => ({
  field: PATIENT_SEEN_IN_LAST_THREE_YEARS_FIELD,
  value,
});
const bookedAsReturning: Appointment = {
  resourceType: 'Appointment',
  status: 'booked',
  participant: [],
  meta: { tag: [RETURNING_PATIENT_META_TAG()] },
};

describe('isNewPatient', () => {
  it('an earlier Ottehr visit wins over any answer', () => {
    expect(isNewPatient(true, [{ observations: [staffSaid(RecentVisitKeys.No), patientSaid(false)] }])).toBe(false);
  });

  it("the staff answer wins over the patient's, whichever is listed first", () => {
    expect(isNewPatient(false, [{ observations: [patientSaid(false), staffSaid(RecentVisitKeys.Yes)] }])).toBe(false);
    expect(isNewPatient(false, [{ observations: [patientSaid(true), staffSaid(RecentVisitKeys.No)] }])).toBe(true);
  });

  it.each([RecentVisitKeys.NotApplicable, RecentVisitKeys.PreferNotToAnswer])(
    'staff answer %s falls through to the patient answer',
    (answer) => {
      expect(isNewPatient(false, [{ observations: [staffSaid(answer), patientSaid(true)] }])).toBe(false);
      expect(isNewPatient(false, [{ observations: [staffSaid(answer), patientSaid(false)] }])).toBe(true);
    }
  );

  it("takes the booking form's returning-patient tag as the patient saying yes", () => {
    expect(isNewPatient(false, [{ appointment: bookedAsReturning }])).toBe(false);
  });

  it('takes each answer from the earliest visit that has it', () => {
    const visits = [
      { observations: [patientSaid(false)] },
      { observations: [staffSaid(RecentVisitKeys.NotApplicable)], appointment: bookedAsReturning },
    ];
    expect(isNewPatient(false, visits)).toBe(true);
  });

  it('a skipped staff answer on an earlier visit does not hide a later yes/no', () => {
    const visits = [
      { observations: [staffSaid(RecentVisitKeys.NotApplicable)] },
      { observations: [staffSaid(RecentVisitKeys.Yes), patientSaid(false)] },
    ];
    expect(isNewPatient(false, visits)).toBe(false);
  });

  it('no evidence at all means new', () => {
    expect(isNewPatient(false, [])).toBe(true);
    expect(isNewPatient(false, [{}])).toBe(true);
  });
});

describe('newPatientLookbackStart', () => {
  it('is 3 years before the visit, in UTC', () => {
    expect(newPatientLookbackStart('2026-07-01T00:00:00.000Z')).toBe('2023-07-01T00:00:00.000Z');
    expect(newPatientLookbackStart('2026-07-01T09:00:00.000-04:00')).toBe('2023-07-01T13:00:00.000Z');
  });
});

describe('isWithinNewPatientLookback', () => {
  const visitAt = '2026-07-01T09:00:00.000-04:00';

  it('counts a visit up to exactly 3 years before, compared as instants', () => {
    expect(isWithinNewPatientLookback('2023-07-01T13:00:00.000Z', visitAt)).toBe(true);
    expect(isWithinNewPatientLookback('2023-07-01T12:59:59.000Z', visitAt)).toBe(false);
    expect(isWithinNewPatientLookback('2026-06-30T10:00:00.000Z', visitAt)).toBe(true);
  });

  it('does not count the visit itself, a later visit, or a missing or invalid date', () => {
    expect(isWithinNewPatientLookback(visitAt, visitAt)).toBe(false);
    expect(isWithinNewPatientLookback('2026-07-02T10:00:00.000Z', visitAt)).toBe(false);
    expect(isWithinNewPatientLookback(undefined, visitAt)).toBe(false);
    expect(isWithinNewPatientLookback('2025-01-01T10:00:00.000Z', undefined)).toBe(false);
    expect(isWithinNewPatientLookback('not-a-date', visitAt)).toBe(false);
  });
});
