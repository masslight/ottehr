import { MedicationAdministration, Procedure } from 'fhir/r4b';
import { MEDICATION_CPT_CODES_EXTENSION_URL } from 'utils/lib/fhir/medication-administration';
import { CODE_SYSTEM_CPT, CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import { describe, expect, it } from 'vitest';
import { getProcedureDrug } from '../../../src/billing/create-billing-claim-from-encounter/handler';

const medicationAdministration = (
  overrides: { ndc?: string; dose?: number; unit?: string; cptCodes?: object[] } = {}
): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: 'ma-1',
  status: 'completed',
  subject: { reference: 'Patient/patient-1' },
  effectiveDateTime: '2026-10-01T10:00:00Z',
  medicationReference: { reference: '#medicationId' },
  contained: [
    {
      resourceType: 'Medication',
      id: 'medicationId',
      code: {
        coding: [
          { system: CODE_SYSTEM_CPT, code: 'J1100' },
          ...('ndc' in overrides && overrides.ndc === undefined
            ? []
            : [{ system: CODE_SYSTEM_NDC, code: overrides.ndc ?? '0409-4888-02' }]),
        ],
      },
    },
  ],
  dosage: { dose: { value: 'dose' in overrides ? overrides.dose : 4, unit: overrides.unit ?? 'mg' } },
  extension: [
    {
      url: MEDICATION_CPT_CODES_EXTENSION_URL,
      valueString: JSON.stringify(
        overrides.cptCodes ?? [
          { code: '96372', display: 'Injection' },
          { code: 'J1100', display: 'Dexamethasone', isMedication: true },
        ]
      ),
    },
  ],
});

const procedure = (code: string, partOf = 'MedicationAdministration/ma-1'): Procedure => ({
  resourceType: 'Procedure',
  status: 'completed',
  subject: { reference: 'Patient/patient-1' },
  code: { coding: [{ system: CODE_SYSTEM_CPT, code }] },
  partOf: [{ reference: partOf }],
});

describe('getProcedureDrug', () => {
  it("takes the medication's NDC (normalized to 11 digits) and the administered dose", () => {
    expect(getProcedureDrug(procedure('J1100'), [medicationAdministration()])).toEqual({
      ndc: '00409488802',
      quantity: 4,
      units: 'ME',
    });
  });

  it.each([
    ['ml', 'ML'],
    ['cc', 'ML'],
    ['g', 'GR'],
    ['unit', 'UN'],
    ['Puff(s)', 'UN'],
  ])('maps the %s dose unit to %s', (unit, expected) => {
    expect(getProcedureDrug(procedure('J1100'), [medicationAdministration({ unit })])?.units).toBe(expected);
  });

  it("leaves the order's other procedures, e.g. its administration code, without a drug", () => {
    expect(getProcedureDrug(procedure('96372'), [medicationAdministration()])).toBeUndefined();
  });

  it('falls back to the first CPT entry when none is marked as the medication', () => {
    const ma = medicationAdministration({ cptCodes: [{ code: 'J1100', display: 'Dexamethasone' }] });
    expect(getProcedureDrug(procedure('J1100'), [ma])?.ndc).toBe('00409488802');
  });

  it('ignores procedures that are not part of a medication administration', () => {
    expect(getProcedureDrug(procedure('J1100', 'Procedure/other'), [medicationAdministration()])).toBeUndefined();
    expect(
      getProcedureDrug(procedure('J1100', 'MedicationAdministration/ma-2'), [medicationAdministration()])
    ).toBeUndefined();
  });

  it('skips the drug when the NDC is missing or cannot be normalized', () => {
    expect(getProcedureDrug(procedure('J1100'), [medicationAdministration({ ndc: undefined })])).toBeUndefined();
    expect(getProcedureDrug(procedure('J1100'), [medicationAdministration({ ndc: '0409488802' })])).toBeUndefined();
  });

  it('skips the drug when there is no positive dose', () => {
    expect(getProcedureDrug(procedure('J1100'), [medicationAdministration({ dose: undefined })])).toBeUndefined();
    expect(getProcedureDrug(procedure('J1100'), [medicationAdministration({ dose: 0 })])).toBeUndefined();
  });
});
