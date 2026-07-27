import { describe, expect, it } from 'vitest';
import { chartHasSubstantiveContent } from './chart-content';

describe('chartHasSubstantiveContent', () => {
  it('returns false for an undefined chart', () => {
    expect(chartHasSubstantiveContent(undefined)).toBe(false);
  });

  it('returns false for a fully empty chart', () => {
    expect(chartHasSubstantiveContent({})).toBe(false);
  });

  it('returns false when the only free-text fields are whitespace, and arrays are empty', () => {
    expect(
      chartHasSubstantiveContent({
        historyOfPresentIllness: { text: '   ' },
        chiefComplaint: { text: '\n\t' },
        medicalDecision: { text: '' },
        diagnosis: [],
        examObservations: [],
        instructions: [],
      })
    ).toBe(false);
  });

  it('returns false for intake-harvested history alone (allergies/meds/conditions)', () => {
    expect(
      chartHasSubstantiveContent({
        allergies: [{ name: 'Penicillin', current: true }],
        medications: [{ name: 'Amoxicillin', status: 'active', intakeInfo: {}, type: 'scheduled' }],
        conditions: [{ display: 'Asthma', current: true }],
      })
    ).toBe(false);
  });

  it('returns true when only exam observations exist', () => {
    expect(chartHasSubstantiveContent({ examObservations: [{ field: 'normal-general', value: true }] })).toBe(true);
  });

  it('returns true when only an E&M code exists', () => {
    expect(chartHasSubstantiveContent({ emCode: { code: '99213', display: 'Office visit, established' } })).toBe(true);
  });

  it('returns true when only MDM free text exists', () => {
    expect(chartHasSubstantiveContent({ medicalDecision: { text: 'Viral URI, supportive care.' } })).toBe(true);
  });

  it('returns true when only a diagnosis exists', () => {
    expect(chartHasSubstantiveContent({ diagnosis: [{ code: 'J06.9', display: 'Acute URI', isPrimary: true }] })).toBe(
      true
    );
  });
});
