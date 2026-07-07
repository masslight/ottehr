import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PATIENT_ETHNICITY_URL, PATIENT_INDIVIDUAL_PRONOUNS_URL, PATIENT_RACE_URL } from '../types/constants';
import { buildExtensionObject } from './patientMasterRecord';

describe('buildExtensionObject', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('builds a fully-populated coding for a mapped race value', () => {
    const ext = buildExtensionObject(PATIENT_RACE_URL, 'White');
    expect(ext).toEqual({
      url: PATIENT_RACE_URL,
      valueCodeableConcept: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-Race', code: '2106-3', display: 'White' }],
      },
    });
  });

  // Regression for OTR-2856: an unmapped coded value used to produce coding: [{}]
  // (all fields undefined → empty object), violating FHIR ele-1 and 500-ing the harvest.
  it('returns undefined (no empty coding) for an unmapped race value', () => {
    const ext = buildExtensionObject(PATIENT_RACE_URL, 'Other Race');
    expect(ext).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('never emits a coding with an empty object for any unmapped coded value', () => {
    for (const url of [PATIENT_RACE_URL, PATIENT_ETHNICITY_URL, PATIENT_INDIVIDUAL_PRONOUNS_URL]) {
      const ext = buildExtensionObject(url, 'definitely-not-a-mapping-key');
      // either skipped entirely, or — if ever built — must not contain an empty coding entry
      const coding = ext?.valueCodeableConcept?.coding ?? [];
      expect(coding.every((c) => Object.keys(c).length > 0)).toBe(true);
      expect(ext).toBeUndefined();
    }
  });

  it('still maps known values for other coded extensions (ethnicity, pronouns)', () => {
    expect(
      buildExtensionObject(PATIENT_ETHNICITY_URL, 'Not Hispanic or Latino')?.valueCodeableConcept?.coding?.[0]
    ).toMatchObject({ code: '2186-5', display: 'Not Hispanic or Latino' });
    expect(
      buildExtensionObject(PATIENT_INDIVIDUAL_PRONOUNS_URL, 'She/her')?.valueCodeableConcept?.coding?.[0]
    ).toMatchObject({ code: 'LA29519-8', display: 'She/her' });
  });
});
