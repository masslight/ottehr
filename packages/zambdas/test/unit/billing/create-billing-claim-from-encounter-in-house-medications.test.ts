import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { Claim, MedicationAdministration, Practitioner, Procedure } from 'fhir/r4b';
import { FHIR_IDENTIFIER_NPI, PARTICIPATION_CODE_SYSTEM, SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { MEDICATION_CPT_CODES_EXTENSION_URL } from 'utils/lib/fhir/medication-administration';
import { CODE_SYSTEM_CPT, CODE_SYSTEM_HL7_HCPCS, CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import { describe, expect, it, vi } from 'vitest';
import {
  ComplexValidationOutput,
  getProcedureDrug,
  medicationUnitToDrugUnitCode,
  performEffect,
} from '../../../src/billing/create-billing-claim-from-encounter/handler';
import { EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER, readClaimItemDrug } from '../../../src/billing/shared';

const TEST_PROVENANCE_AGENT = { who: { reference: 'Device/test' } };

function makeMedicationAdministration(opts: {
  id?: string;
  ndc?: string;
  dose?: number;
  unit?: string;
  cptCodes?: { code: string; display: string; isMedication?: boolean }[];
}): MedicationAdministration {
  return {
    resourceType: 'MedicationAdministration',
    id: opts.id ?? 'ma-1',
    status: 'completed',
    subject: { reference: 'Patient/patient-123' },
    medicationReference: { reference: '#medication' },
    contained: [
      {
        resourceType: 'Medication',
        id: 'medication',
        code: { coding: opts.ndc ? [{ system: CODE_SYSTEM_NDC, code: opts.ndc }] : [] },
      },
    ],
    ...(opts.cptCodes
      ? { extension: [{ url: MEDICATION_CPT_CODES_EXTENSION_URL, valueString: JSON.stringify(opts.cptCodes) }] }
      : {}),
    ...(opts.dose != null && opts.unit ? { dosage: { dose: { value: opts.dose, unit: opts.unit } } } : {}),
  };
}

function makeProcedure(code: string, maId?: string, system = CODE_SYSTEM_CPT): Procedure {
  return {
    resourceType: 'Procedure',
    status: 'completed',
    subject: { reference: 'Patient/patient-123' },
    code: { coding: [{ system, code }] },
    ...(maId ? { partOf: [{ reference: `MedicationAdministration/${maId}` }] } : {}),
  };
}

describe('medicationUnitToDrugUnitCode', () => {
  it.each([
    ['mg', 'ME'],
    ['ml', 'ML'],
    ['cc', 'ML'],
    ['g', 'GR'],
    ['unit', 'UN'],
    ['application', 'UN'],
    ['Puff(s)', 'UN'],
  ] as const)('maps %s to %s', (unit, expected) => {
    expect(medicationUnitToDrugUnitCode(unit)).toBe(expected);
  });
});

describe('getProcedureDrug', () => {
  it('reads the NDC, dose and units of the linked medication administration', () => {
    const ma = makeMedicationAdministration({ ndc: '12345-6789-01', dose: 2.5, unit: 'mg' });
    expect(getProcedureDrug(makeProcedure('J1885', 'ma-1'), [ma])).toEqual({
      ndc: '12345678901',
      quantity: 2.5,
      units: 'ME',
    });
  });

  it('puts the drug only on the code designated as the medication', () => {
    const ma = makeMedicationAdministration({
      ndc: '12345678901',
      dose: 1,
      unit: 'ml',
      cptCodes: [
        { code: '96372', display: 'Injection' },
        { code: 'J1885', display: 'Ketorolac', isMedication: true },
      ],
    });
    expect(getProcedureDrug(makeProcedure('96372', 'ma-1'), [ma])).toBeUndefined();
    expect(getProcedureDrug(makeProcedure('J1885', 'ma-1', CODE_SYSTEM_HL7_HCPCS), [ma])).toEqual({
      ndc: '12345678901',
      quantity: 1,
      units: 'ML',
    });
  });

  it('defaults to one unit when the administration has no dosage', () => {
    const ma = makeMedicationAdministration({ ndc: '12345678901' });
    expect(getProcedureDrug(makeProcedure('J1885', 'ma-1'), [ma])).toEqual({
      ndc: '12345678901',
      quantity: 1,
      units: 'UN',
    });
  });

  it.each([
    ['1234-5678-90', '01234567890'],
    ['12345-678-90', '12345067890'],
    ['12345-6789-0', '12345678900'],
  ])('normalizes the dashed 10-digit NDC %s to %s', (ndc, expected) => {
    const ma = makeMedicationAdministration({ ndc, dose: 1, unit: 'mg' });
    expect(getProcedureDrug(makeProcedure('J1885', 'ma-1'), [ma])).toEqual({ ndc: expected, quantity: 1, units: 'ME' });
  });

  it.each(['1234567890', '1234-567-89', '1234-5678-9', '123-45678-90', '123456789012', 'abc'])(
    'skips the non 11-digit NDC %s',
    (ndc) => {
      const ma = makeMedicationAdministration({ ndc, dose: 1, unit: 'mg' });
      expect(getProcedureDrug(makeProcedure('J1885', 'ma-1'), [ma])).toBeUndefined();
    }
  );

  it('returns nothing without a linked administration, an NDC, or with an unmappable NDC', () => {
    const ma = makeMedicationAdministration({ ndc: '12345678901', dose: 1, unit: 'mg' });
    expect(getProcedureDrug(makeProcedure('J1885'), [ma])).toBeUndefined();
    expect(getProcedureDrug(makeProcedure('J1885', 'ma-other'), [ma])).toBeUndefined();
    expect(
      getProcedureDrug(makeProcedure('J1885', 'ma-1'), [makeMedicationAdministration({ dose: 1, unit: 'mg' })])
    ).toBeUndefined();
    expect(
      getProcedureDrug(makeProcedure('J1885', 'ma-1'), [makeMedicationAdministration({ ndc: '1234567890' })])
    ).toBeUndefined();
  });
});

describe('performEffect with in-house medications', () => {
  it('stores the drug in item.detail and no ordering provider', async () => {
    const txFn = vi.fn().mockImplementation(async ({ requests }) => ({
      entry: requests.map((request: BatchInputPostRequest<any>, i: number) => ({
        resource: { ...(request.resource ?? { resourceType: 'Person' }), id: `id-${i}` },
      })),
    }));
    const billingOystehr = {
      fhir: { transaction: txFn },
      rcm: { constructPayerUrl: vi.fn() },
    } as unknown as Oystehr;

    const ma = makeMedicationAdministration({
      ndc: '12345-6789-01',
      dose: 30,
      unit: 'mg',
      cptCodes: [
        { code: '96372', display: 'Injection' },
        { code: 'J1885', display: 'Ketorolac', isMedication: true },
      ],
    });
    const attending: Practitioner = {
      resourceType: 'Practitioner',
      id: 'attending',
      identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1111111111' }],
    };
    const cvo: ComplexValidationOutput = {
      clinicalResources: {
        encounter: {
          resourceType: 'Encounter',
          id: 'encounter-123',
          status: 'finished',
          class: {},
          participant: [
            {
              individual: { reference: 'Practitioner/attending' },
              type: [{ coding: [{ system: PARTICIPATION_CODE_SYSTEM, code: 'ATND' }] }],
            },
          ],
        },
        patient: { resourceType: 'Patient', id: 'patient-123' },
        appointment: {
          resourceType: 'Appointment',
          id: 'appointment-123',
          status: 'fulfilled',
          participant: [],
          serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: 'urgent-care' }] }],
          start: '2026-01-01',
        },
        accounts: [],
        coverages: [],
        practitioners: [attending],
        location: { resourceType: 'Location', id: 'location-123', name: 'Test Clinic' },
        billingProvider: { resourceType: 'Organization', id: 'organization-123' },
        payors: [],
        diagnoses: [],
        procedures: [makeProcedure('99213'), makeProcedure('96372', 'ma-1'), makeProcedure('J1885', 'ma-1')],
        medicationAdministrations: [ma],
      },
      billingResources: {
        accounts: [],
        coverages: [],
        subscribers: [],
        practitioners: [],
      },
    };

    await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);

    const claimRequest = txFn.mock.calls[0][0].requests.find(
      (r: BatchInputPostRequest<Claim>) => r.url === '/Claim'
    ) as BatchInputPostRequest<Claim>;
    const items = claimRequest.resource.item ?? [];
    expect(items.map((item) => readClaimItemDrug(item))).toEqual([
      undefined,
      undefined,
      { ndc: '12345678901', quantity: 30, units: 'ME' },
    ]);
    expect(
      items.every((item) => !item.extension?.some((ext) => ext.url === EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER))
    ).toBe(true);
    expect(claimRequest.resource.contained).toBeUndefined();
  });
});
