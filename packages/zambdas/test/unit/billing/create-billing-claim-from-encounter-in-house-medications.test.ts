import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { Claim, MedicationAdministration, Practitioner, Procedure } from 'fhir/r4b';
import { FHIR_IDENTIFIER_NPI, PARTICIPATION_CODE_SYSTEM, SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { MEDICATION_CPT_CODES_EXTENSION_URL } from 'utils/lib/fhir/medication-administration';
import { CODE_SYSTEM_CPT, CODE_SYSTEM_HL7_HCPCS, CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import {
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  PRACTITIONER_ORDERED_MEDICATION_CODE,
} from 'utils/lib/types/api/medication-administration.constants';
import { describe, expect, it, vi } from 'vitest';
import {
  ComplexValidationOutput,
  getProcedureDrug,
  getProcedureOrderingProvider,
  medicationUnitToDrugUnitCode,
  performEffect,
} from '../../../src/billing/create-billing-claim-from-encounter/handler';
import { EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER, readClaimItemDrug } from '../../../src/billing/shared';

const TEST_PROVENANCE_AGENT = { who: { reference: 'Device/test' } };
const VALID_NPI = '1234567893';

const performer = (
  practitionerId: string,
  code: string
): NonNullable<MedicationAdministration['performer']>[number] => ({
  actor: { reference: `Practitioner/${practitionerId}` },
  function: { coding: [{ system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM, code }] },
});

function makeMedicationAdministration(opts: {
  id?: string;
  ndc?: string;
  dose?: number;
  unit?: string;
  cptCodes?: { code: string; display: string; isMedication?: boolean }[];
  performers?: NonNullable<MedicationAdministration['performer']>;
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
    performer: opts.performers ?? [performer('ordering-practitioner', PRACTITIONER_ORDERED_MEDICATION_CODE)],
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

const clinicalOrderingPractitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'ordering-practitioner',
  name: [{ given: ['Olivia'], family: 'Order' }],
  identifier: [{ system: FHIR_IDENTIFIER_NPI, value: VALID_NPI }],
};

const billingOrderingPractitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'billing-ordering-practitioner',
  name: [{ given: ['Olivia'], family: 'Order' }],
  identifier: [{ system: FHIR_IDENTIFIER_NPI, value: VALID_NPI }],
};

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

  it.each(['1234567890', '1234-5678-90', '12345-678-90', '12345-6789-0', '123456789012', 'abc'])(
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

describe('getProcedureOrderingProvider', () => {
  const procedure = makeProcedure('J1885', 'ma-1');

  it('references the billing rendering provider with the same NPI', () => {
    const ma = makeMedicationAdministration({});
    expect(
      getProcedureOrderingProvider(procedure, [ma], [clinicalOrderingPractitioner], [billingOrderingPractitioner])
    ).toEqual({ firstName: 'Olivia', lastName: 'Order', npi: VALID_NPI, providerId: 'billing-ordering-practitioner' });
  });

  it('falls back to a manually entered provider when billing has no match', () => {
    const ma = makeMedicationAdministration({});
    expect(getProcedureOrderingProvider(procedure, [ma], [clinicalOrderingPractitioner], [])).toEqual({
      firstName: 'Olivia',
      lastName: 'Order',
      npi: VALID_NPI,
    });
  });

  it('drops an NPI that fails the checksum from a manually entered provider', () => {
    const ma = makeMedicationAdministration({});
    const practitioner = {
      ...clinicalOrderingPractitioner,
      identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1234567890' }],
    };
    expect(getProcedureOrderingProvider(procedure, [ma], [practitioner], [])).toEqual({
      firstName: 'Olivia',
      lastName: 'Order',
    });
  });

  it('prefers the latest "ordered by" provider over the one who created the order', () => {
    const ma = makeMedicationAdministration({
      performers: [
        performer('creator', PRACTITIONER_ORDERED_MEDICATION_CODE),
        performer('creator', PRACTITIONER_ORDERED_BY_MEDICATION_CODE),
        performer('ordering-practitioner', PRACTITIONER_ORDERED_BY_MEDICATION_CODE),
        performer('nurse', PRACTITIONER_ADMINISTERED_MEDICATION_CODE),
      ],
    });
    const creator: Practitioner = {
      resourceType: 'Practitioner',
      id: 'creator',
      name: [{ given: ['C'], family: 'R' }],
    };
    expect(getProcedureOrderingProvider(procedure, [ma], [creator, clinicalOrderingPractitioner], [])).toEqual({
      firstName: 'Olivia',
      lastName: 'Order',
      npi: VALID_NPI,
    });
  });

  it('returns nothing for procedures not tied to a medication or a practitioner without a name', () => {
    const ma = makeMedicationAdministration({});
    expect(getProcedureOrderingProvider(makeProcedure('99213'), [ma], [clinicalOrderingPractitioner], [])).toBe(
      undefined
    );
    expect(
      getProcedureOrderingProvider(procedure, [ma], [{ ...clinicalOrderingPractitioner, name: undefined }], [])
    ).toBeUndefined();
  });
});

describe('performEffect with in-house medications', () => {
  it('stores the drug in item.detail and the ordering provider like the claim editor does', async () => {
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
        medicationPractitioners: [clinicalOrderingPractitioner],
      },
      billingResources: {
        accounts: [],
        coverages: [],
        subscribers: [],
        practitioners: [billingOrderingPractitioner],
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
    const orderingRefs = items.map(
      (item) => item.extension?.find((ext) => ext.url === EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER)?.valueReference
    );
    expect(orderingRefs).toEqual([
      undefined,
      { reference: 'Practitioner/billing-ordering-practitioner', display: expect.any(String) },
      { reference: 'Practitioner/billing-ordering-practitioner', display: expect.any(String) },
    ]);
    expect(claimRequest.resource.contained).toBeUndefined();
  });
});
