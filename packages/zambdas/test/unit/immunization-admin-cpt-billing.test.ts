// Immunization admin CPT codes on the claim: 90460 ×1 + 90461 ×5 per vaccine (Vaxelis, Prevnar 20, RotaTeq) at
// one well visit. Exercises the real administerImmunizationOrder and candid's getBillableUnitsForProcedure with an
// in-memory Oystehr.
import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration, Practitioner, Procedure } from 'fhir/r4b';
import { CPT_BILLABLE_UNITS_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { IMMUNIZATION_ORDER_TAG_CODE, IMMUNIZATION_ORDER_TAG_SYSTEM } from 'utils/lib/fhir/medication-administration';
import { AdministerImmunizationOrderRequest, ImmunizationCptCode } from 'utils/lib/types/data/immunization/types';
import { describe, expect, it } from 'vitest';
import { administerImmunizationOrder } from '../../src/ehr/immunization/administer-order/index';
import { CONTAINED_MEDICATION_ID, validateAdministrationDetailsValues } from '../../src/ehr/immunization/common';
import { mapMedicationAdministrationToImmunizationOrder } from '../../src/ehr/immunization/get-orders';
import { getBillableUnitsForProcedure } from '../../src/shared/candid';

const C90460: ImmunizationCptCode = { code: '90460', display: 'Imm admin thru 18yr any rte 1st/only component' };
const C90461: ImmunizationCptCode = { code: '90461', display: 'Imm admin thru 18yr any rte addl component' };

const makeMA = (id: string): MedicationAdministration =>
  ({
    resourceType: 'MedicationAdministration',
    id,
    meta: { tag: [{ system: IMMUNIZATION_ORDER_TAG_SYSTEM, code: IMMUNIZATION_ORDER_TAG_CODE }] },
    status: 'in-progress',
    subject: { reference: 'Patient/maya' },
    context: { reference: 'Encounter/enc-1' },
    medicationReference: { reference: `#${CONTAINED_MEDICATION_ID}` },
    performer: [],
    contained: [{ resourceType: 'Medication', id: CONTAINED_MEDICATION_ID, extension: [] }],
  }) as MedicationAdministration;

const practitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'nurse-1',
  name: [{ given: ['N'], family: 'Urse' }],
};
const vaccine: Medication = { resourceType: 'Medication', id: 'vax', code: { text: 'vax' } };

function makeFakeOystehr(mas: Record<string, MedicationAdministration>): {
  oystehr: Oystehr;
  procedures: Procedure[];
} {
  const procedures: Procedure[] = [];
  const fhir = {
    get: async ({ resourceType, id }: { resourceType: string; id: string }) => {
      if (resourceType === 'MedicationAdministration') return structuredClone(mas[id]);
      if (resourceType === 'Medication') return structuredClone(vaccine);
      if (resourceType === 'Practitioner') return structuredClone(practitioner);
      throw new Error(`unexpected get ${resourceType}/${id}`);
    },
    transaction: async ({ requests }: { requests: any[] }) => {
      for (const r of requests) {
        if (r.method === 'PUT' && r.resource.resourceType === 'MedicationAdministration')
          mas[r.resource.id] = r.resource;
      }
      return { entry: [] };
    },
    // honors the encounter and part-of params, so the search behaves like the server's for either dedup scope
    search: async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
      const partOf = params.find((p) => p.name === 'part-of')?.value;
      const encounter = params.find((p) => p.name === 'encounter')?.value;
      const result =
        resourceType === 'Procedure'
          ? procedures.filter(
              (p) =>
                (!partOf || p.partOf?.some((ref) => ref.reference === partOf)) &&
                (!encounter || p.encounter?.reference === encounter) &&
                p.meta?.tag?.some((t) => t.code === 'cpt-code')
            )
          : [];
      return { unbundle: () => result };
    },
    create: async (resource: Procedure) => {
      const created = { ...resource, id: `proc-${procedures.length + 1}` };
      procedures.push(created);
      return created;
    },
    update: async (resource: Procedure) => {
      const index = procedures.findIndex((p) => p.id === resource.id);
      procedures[index] = resource;
      return resource;
    },
  };
  return { oystehr: { fhir } as unknown as Oystehr, procedures };
}

function adminRequest(orderId: string, cptCodes: ImmunizationCptCode[]): AdministerImmunizationOrderRequest {
  return {
    orderId,
    type: 'administered',
    details: {
      medication: { id: 'vax', name: 'vax' },
      dose: '0.5',
      units: 'mL',
      route: 'IM',
      location: { name: 'Thigh', code: 'x' },
      orderedProvider: { id: 'p', name: 'Dr. P' },
    },
    administrationDetails: {
      lot: 'L1',
      expDate: '2027-01-01',
      mvx: 'MSD',
      cvx: '146',
      ndc: '00000-0000-00',
      administeredDateTime: '2026-11-10T10:00:00Z',
      visGivenDate: '2026-11-10',
      cptCodes,
    },
  };
}

const linesFor = (procs: Procedure[], code: string): Procedure[] =>
  procs.filter((p) => p.code?.coding?.[0]?.code === code);

describe('Immunization admin CPT billing (Maya well visit)', () => {
  it('each vaccine given bills its own 90460: the dedup is per administration, not per visit', async () => {
    const mas = { vaxelis: makeMA('vaxelis'), prevnar: makeMA('prevnar'), rotateq: makeMA('rotateq') };
    const { oystehr, procedures } = makeFakeOystehr(mas);

    await administerImmunizationOrder(
      oystehr,
      adminRequest('vaxelis', [C90460, { ...C90461, billableUnits: 5 }]),
      practitioner
    );
    await administerImmunizationOrder(oystehr, adminRequest('prevnar', [C90460]), practitioner);
    await administerImmunizationOrder(oystehr, adminRequest('rotateq', [C90460]), practitioner);

    expect(linesFor(procedures, '90460').map((p) => p.partOf?.[0]?.reference)).toEqual([
      'MedicationAdministration/vaxelis',
      'MedicationAdministration/prevnar',
      'MedicationAdministration/rotateq',
    ]);
    expect(linesFor(procedures, '90461')).toHaveLength(1);
  });

  it('a count is saved with the administration and reaches the claim as the quantity', async () => {
    const mas = { vaxelis: makeMA('vaxelis') };
    const { oystehr, procedures } = makeFakeOystehr(mas);

    await administerImmunizationOrder(
      oystehr,
      adminRequest('vaxelis', [C90460, { ...C90461, billableUnits: 5 }]),
      practitioner
    );

    const [p90461] = linesFor(procedures, '90461');
    expect(p90461.code?.coding?.[0]?.extension).toEqual([{ url: CPT_BILLABLE_UNITS_EXTENSION_URL, valueDecimal: 5 }]);
    expect(getBillableUnitsForProcedure(p90461, [mas.vaxelis])).toBe(5);
    expect(getBillableUnitsForProcedure(linesFor(procedures, '90460')[0], [mas.vaxelis])).toBeUndefined();
    // the saved order reads the count back for the details card and the quick pick save
    expect(mapMedicationAdministrationToImmunizationOrder(mas.vaxelis).administrationDetails?.cptCodes).toEqual([
      C90460,
      { ...C90461, billableUnits: 5 },
    ]);
  });

  it('re-administering keeps one line per code and takes the new count', async () => {
    const mas = { vaxelis: makeMA('vaxelis') };
    const { oystehr, procedures } = makeFakeOystehr(mas);

    await administerImmunizationOrder(
      oystehr,
      adminRequest('vaxelis', [C90460, { ...C90461, billableUnits: 5 }]),
      practitioner
    );
    await administerImmunizationOrder(
      oystehr,
      adminRequest('vaxelis', [C90460, { ...C90461, billableUnits: 4 }]),
      practitioner
    );

    expect(procedures).toHaveLength(2);
    expect(getBillableUnitsForProcedure(linesFor(procedures, '90461')[0], [mas.vaxelis])).toBe(4);
  });

  it('rejects a count that is not a positive integer', () => {
    expect(() => validateAdministrationDetailsValues({ cptCodes: [{ ...C90461, billableUnits: 0 }] })).toThrow(
      /positive integer/
    );
    expect(() => validateAdministrationDetailsValues({ cptCodes: [{ ...C90461, billableUnits: 2.5 }] })).toThrow(
      /positive integer/
    );
    expect(() => validateAdministrationDetailsValues({ cptCodes: [{ ...C90461, billableUnits: 5 }] })).not.toThrow();
  });
});
