import { describe, expect, it } from 'vitest';
import { MedicalRecordDateRangeSchema, StartMedicalRecordExportInputSchema } from './get-patient-medical-record.types';

const FROM = '2026-03-01T00:00:00.000-05:00';
const TO = '2026-03-31T23:59:59.999-04:00';

describe('MedicalRecordDateRangeSchema', () => {
  it.each([
    ['in the same offset', FROM],
    ['in different offsets', '2026-03-01T05:00:00.000Z'],
  ])('accepts a range that starts and ends at the same instant, written %s', (_label, to) => {
    expect(MedicalRecordDateRangeSchema.safeParse({ from: FROM, to }).success).toBe(true);
  });

  it('refuses a start one millisecond after the end, pointing at the start', () => {
    const result = MedicalRecordDateRangeSchema.safeParse({ from: '2026-03-01T05:00:00.001Z', to: FROM });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['from'], message: 'The start date must not be after the end date' }),
    ]);
  });

  it.each([
    ['no bounds', {}],
    ['only a start', { from: FROM }],
    ['only an end', { to: TO }],
    ['a null start', { from: null, to: TO }],
  ])('refuses %s', (_label, range) => {
    expect(MedicalRecordDateRangeSchema.safeParse(range).success).toBe(false);
  });

  it.each([
    ['a local time', { from: '2026-03-01T00:00:00.000', to: TO }],
    ['a bare date', { from: FROM, to: '2026-03-31' }],
  ])('refuses a bound written as %s, which has no offset', (_label, range) => {
    expect(MedicalRecordDateRangeSchema.safeParse(range).success).toBe(false);
  });
});

describe('StartMedicalRecordExportInputSchema', () => {
  const PATIENT_ID = '11111111-1111-4111-8111-111111111111';

  it('requires a date range', () => {
    expect(StartMedicalRecordExportInputSchema.safeParse({ patientId: PATIENT_ID }).success).toBe(false);
    expect(
      StartMedicalRecordExportInputSchema.safeParse({ patientId: PATIENT_ID, dateRange: { from: FROM, to: TO } })
        .success
    ).toBe(true);
  });
});
