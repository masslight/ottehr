import { MedicationAdministration, Procedure } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { buildDrugIdentification, mapMedicationUnitToCandid } from '../../src/shared/candid';

const CODE_SYSTEM_NDC = 'http://hl7.org/fhir/sid/ndc';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeProcedure(partOfMaId?: string): Procedure {
  return {
    resourceType: 'Procedure',
    status: 'completed',
    subject: { reference: 'Patient/patient-1' },
    ...(partOfMaId != null ? { partOf: [{ reference: `MedicationAdministration/${partOfMaId}` }] } : {}),
    code: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '90471' }] },
  };
}

function makeMedicationAdministration(opts: {
  id: string;
  ndcCode?: string;
  dose?: number;
  doseUnit?: string;
}): MedicationAdministration {
  return {
    resourceType: 'MedicationAdministration',
    id: opts.id,
    status: 'completed',
    subject: { reference: 'Patient/patient-1' },
    medicationReference: { reference: 'Medication/med-1' },
    effectiveDateTime: '2026-05-01T10:00:00Z',
    contained: opts.ndcCode
      ? [
          {
            resourceType: 'Medication',
            id: 'med-1',
            code: {
              coding: [
                { system: CODE_SYSTEM_NDC, code: opts.ndcCode },
                { system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '12345', display: 'Test Drug' },
              ],
            },
          },
        ]
      : [],
    dosage:
      opts.dose != null && opts.doseUnit != null ? { dose: { value: opts.dose, unit: opts.doseUnit } } : undefined,
  };
}

// ── buildDrugIdentification ────────────────────────────────────────────────────

describe('buildDrugIdentification', () => {
  it('returns correct DrugIdentification for a procedure linked to an MA with NDC and dosage', () => {
    const ma = makeMedicationAdministration({ id: 'ma-1', ndcCode: '12345-6789-01', dose: 2.5, doseUnit: 'ml' });
    const procedure = makeProcedure('ma-1');

    const result = buildDrugIdentification(procedure, [ma]);

    expect(result).toEqual({
      serviceIdQualifier: 'N4',
      nationalDrugCode: '12345-6789-01',
      nationalDrugUnitCount: '2.5',
      measurementUnitCode: 'ML',
    });
  });

  it('returns undefined when procedure has no partOf', () => {
    const ma = makeMedicationAdministration({ id: 'ma-1', ndcCode: '12345-6789-01', dose: 1, doseUnit: 'mg' });
    const procedure = makeProcedure(); // no partOf

    expect(buildDrugIdentification(procedure, [ma])).toBeUndefined();
  });

  it('returns undefined when partOf does not reference a MedicationAdministration', () => {
    const ma = makeMedicationAdministration({ id: 'ma-1', ndcCode: '12345-6789-01', dose: 1, doseUnit: 'mg' });
    const procedure: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/patient-1' },
      partOf: [{ reference: 'Procedure/some-other-procedure' }],
    };

    expect(buildDrugIdentification(procedure, [ma])).toBeUndefined();
  });

  it('returns undefined when the referenced MA is not in the provided array', () => {
    const ma = makeMedicationAdministration({ id: 'ma-2', ndcCode: '12345-6789-01', dose: 1, doseUnit: 'mg' });
    const procedure = makeProcedure('ma-999'); // different ID

    expect(buildDrugIdentification(procedure, [ma])).toBeUndefined();
  });

  it('returns undefined when medicationAdministrations array is empty', () => {
    const procedure = makeProcedure('ma-1');

    expect(buildDrugIdentification(procedure, [])).toBeUndefined();
  });

  it('returns undefined when MA has no contained medication', () => {
    const ma = makeMedicationAdministration({ id: 'ma-1' }); // no ndcCode → no contained medication
    const procedure = makeProcedure('ma-1');

    expect(buildDrugIdentification(procedure, [ma])).toBeUndefined();
  });

  it('returns undefined when contained medication has no NDC coding', () => {
    const ma: MedicationAdministration = {
      ...makeMedicationAdministration({ id: 'ma-1' }),
      contained: [
        {
          resourceType: 'Medication',
          id: 'med-1',
          code: {
            coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '12345', display: 'Test Drug' }],
          },
        },
      ],
    };
    const procedure = makeProcedure('ma-1');

    expect(buildDrugIdentification(procedure, [ma])).toBeUndefined();
  });

  it('defaults nationalDrugUnitCount to "1" and measurementUnitCode to "UN" when MA has no dosage', () => {
    const ma = makeMedicationAdministration({ id: 'ma-1', ndcCode: '12345-6789-01' }); // no dose/unit
    const procedure = makeProcedure('ma-1');

    const result = buildDrugIdentification(procedure, [ma]);

    expect(result).toEqual({
      serviceIdQualifier: 'N4',
      nationalDrugCode: '12345-6789-01',
      nationalDrugUnitCount: '1',
      measurementUnitCode: 'UN',
    });
  });

  it('picks the correct MA when multiple are in the array', () => {
    const ma1 = makeMedicationAdministration({ id: 'ma-1', ndcCode: '00000-0001-01', dose: 1, doseUnit: 'mg' });
    const ma2 = makeMedicationAdministration({ id: 'ma-2', ndcCode: '00000-0002-02', dose: 5, doseUnit: 'ml' });
    const procedure = makeProcedure('ma-2');

    const result = buildDrugIdentification(procedure, [ma1, ma2]);

    expect(result?.nationalDrugCode).toBe('00000-0002-02');
    expect(result?.nationalDrugUnitCount).toBe('5');
    expect(result?.measurementUnitCode).toBe('ML');
  });

  it('uses the first MedicationAdministration partOf reference when procedure has multiple partOf entries', () => {
    const ma1 = makeMedicationAdministration({ id: 'ma-1', ndcCode: '11111-1111-11', dose: 3, doseUnit: 'g' });
    const ma2 = makeMedicationAdministration({ id: 'ma-2', ndcCode: '22222-2222-22', dose: 1, doseUnit: 'unit' });
    const procedure: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/patient-1' },
      partOf: [{ reference: 'MedicationAdministration/ma-1' }, { reference: 'MedicationAdministration/ma-2' }],
    };

    const result = buildDrugIdentification(procedure, [ma1, ma2]);

    expect(result?.nationalDrugCode).toBe('11111-1111-11');
  });
});

// ── mapMedicationUnitToCandid ──────────────────────────────────────────────────

describe('mapMedicationUnitToCandid', () => {
  it('maps "mg" to Milligram ("ME")', () => {
    expect(mapMedicationUnitToCandid('mg')).toBe('ME');
  });

  it('maps "ml" to Milliliters ("ML")', () => {
    expect(mapMedicationUnitToCandid('ml')).toBe('ML');
  });

  it('maps "g" to Grams ("GR")', () => {
    expect(mapMedicationUnitToCandid('g')).toBe('GR');
  });

  it('maps "cc" to Milliliters ("ML") — cubic centimeters ≈ mL', () => {
    expect(mapMedicationUnitToCandid('cc')).toBe('ML');
  });

  it('maps "unit" to Units ("UN")', () => {
    expect(mapMedicationUnitToCandid('unit')).toBe('UN');
  });

  it('maps "application" to Units ("UN")', () => {
    expect(mapMedicationUnitToCandid('application')).toBe('UN');
  });
});
