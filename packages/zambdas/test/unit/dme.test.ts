import Oystehr from '@oystehr/sdk';
import { DeviceRequest, Encounter, Location, Organization, Patient, Procedure } from 'fhir/r4b';
import { ottehrCodeSystemUrl } from 'utils/lib/fhir/systemUrls';
import { CODE_SYSTEM_CPT_MODIFIER } from 'utils/lib/helpers/rcm/constants';
import {
  DME_ORDER_PARAMETER_SYSTEM,
  DME_TASK,
  DmeOrderFields,
  DmeOrderFieldsSchema,
  DmeOrderStatus,
  ParsedDmeOrderFields,
} from 'utils/lib/types/api/dme.types';
import { describe, expect, it, vi } from 'vitest';
import {
  fetchDmeBillingProcedures,
  fetchDmeEncounterContext,
  makeDmeDispenseTask,
} from '../../src/ehr/dme/shared/order-helpers';
import { makeCPTCodeDTO, makeProcedureResource } from '../../src/shared/chart-data/index';
import {
  DME_BILLED_ORDER_EXTENSION_URL,
  DME_BILLING_PROCEDURE_EXTENSION_URL,
  getDmeBillingProcedureIds,
  getDmeOrderStatus,
  getDmePractitionerIds,
  isDmeBillingProcedure,
  isDmeBillingProcedureOf,
  isDmeOrderDeleted,
  isDmeOrderExternal,
  makeDmeBillingProcedures,
  makeDmeDeviceRequest,
  makeDmeDispensedExtension,
  makeDmeProvenance,
  parseDmeOrder,
} from '../../src/shared/dme';

const ORDERED_BY = '0b5a2c8e-1f3d-4c6e-9a7b-2d4f6e8a0c1b';
const DISPENSED_BY = '7e9c1a3b-5d7f-4b2e-8c6a-0f2e4d6b8a9c';
const ENCOUNTER_ID = 'encounter-1';
const PATIENT_ID = 'patient-1';
const NAMES = { [ORDERED_BY]: 'Dr. Order', [DISPENSED_BY]: 'Nurse Dispense' };

const ANKLE_BRACE_CODES = [
  { code: 'L1906', display: 'Ankle foot orthosis, multiligamentous ankle support' },
  { code: 'L4361', display: 'Walking boot, pneumatic' },
];

const fields = (overrides: Partial<DmeOrderFields> = {}): ParsedDmeOrderFields =>
  DmeOrderFieldsSchema.parse({
    itemName: 'Ankle Brace',
    quantity: 2,
    orderedByPractitionerId: ORDERED_BY,
    billingCodes: ANKLE_BRACE_CODES,
    ...overrides,
  });

const build = (f: ParsedDmeOrderFields, existing?: DeviceRequest): DeviceRequest => ({
  ...makeDmeDeviceRequest({ fields: f, encounterId: ENCOUNTER_ID, patientId: PATIENT_ID, existing }),
  id: existing?.id ?? 'dr-1',
});

describe('DME order mapping', () => {
  it('round-trips an external order with third party, duration, laterality, modifier and billing codes', () => {
    const f = fields({
      external: true,
      laterality: 'BI',
      modifier: 'RR',
      duration: { value: 3, unit: 'weeks' },
      diagnoses: [{ code: 'S93.401A', display: 'Sprain of right ankle' }],
      instructions: '  Wear while walking  ',
      thirdParty: { name: 'Acme DME', address: '1 Main St', phone: '5551234567', fax: '5557654321' },
    });
    const dr = build(f);

    expect(isDmeOrderExternal(dr)).toBe(true);
    expect(parseDmeOrder(dr, NAMES)).toEqual({
      id: 'dr-1',
      encounterId: ENCOUNTER_ID,
      itemName: 'Ankle Brace',
      diagnoses: [{ code: 'S93.401A', display: 'Sprain of right ankle' }],
      quantity: 2,
      billingCodes: ANKLE_BRACE_CODES,
      laterality: 'BI',
      modifier: 'RR',
      duration: { value: 3, unit: 'weeks' },
      instructions: 'Wear while walking',
      external: true,
      thirdParty: { name: 'Acme DME', address: '1 Main St', phone: '5551234567', fax: '5557654321' },
      status: DmeOrderStatus.ordered,
      orderedBy: { practitionerId: ORDERED_BY, name: 'Dr. Order' },
      orderedAt: dr.authoredOn,
      dispensed: undefined,
    });
  });

  it('stores laterality, modifier and duration of use in their R4 places', () => {
    const dr = build(fields({ laterality: 'BI', modifier: 'NU', duration: { value: 10, unit: 'days' } }));

    expect(dr.occurrenceTiming).toEqual({
      repeat: { boundsDuration: { value: 10, unit: 'day', system: 'http://unitsofmeasure.org', code: 'd' } },
    });
    expect(dr.parameter).toEqual(
      expect.arrayContaining([
        {
          code: { coding: [{ system: 'http://snomed.info/sct', code: '272741003', display: 'Laterality' }] },
          valueCodeableConcept: {
            coding: [{ system: 'http://snomed.info/sct', code: '51440002', display: 'Right and left' }],
          },
        },
        expect.objectContaining({
          valueCodeableConcept: {
            coding: [{ system: CODE_SYSTEM_CPT_MODIFIER, code: 'NU', display: 'NU (New Purchase)' }],
          },
        }),
      ])
    );
    expect(dr.supportingInfo).toBeUndefined();
  });

  it.each([
    ['LT', 'http://snomed.info/sct', '7771000'],
    ['RT', 'http://snomed.info/sct', '24028007'],
    ['BI', 'http://snomed.info/sct', '51440002'],
    ['NA', 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', 'NA'],
  ] as const)('maps laterality %s to %s|%s and back', (laterality, system, code) => {
    const dr = build(fields({ laterality }));
    const param = dr.parameter?.find((p) => p.code?.coding?.[0]?.code === '272741003');
    expect(param?.valueCodeableConcept?.coding).toEqual([expect.objectContaining({ system, code })]);
    expect(parseDmeOrder(dr, NAMES).laterality).toBe(laterality);
  });

  it('writes no laterality parameter when none is chosen', () => {
    const dr = build(fields({ laterality: undefined }));
    expect(dr.parameter?.map((p) => p.code?.coding?.[0]?.code)).toEqual(['quantity']);
    expect(parseDmeOrder(dr, NAMES).laterality).toBeUndefined();
  });

  it('reads an order saved in the earlier parameter-only shape without crashing', () => {
    const legacy: DeviceRequest = {
      ...build(fields()),
      parameter: [
        { code: { coding: [{ system: DME_ORDER_PARAMETER_SYSTEM, code: 'quantity' }] }, valueQuantity: { value: 4 } },
        {
          code: { coding: [{ system: DME_ORDER_PARAMETER_SYSTEM, code: 'laterality' }] },
          valueCodeableConcept: { coding: [{ system: DME_ORDER_PARAMETER_SYSTEM, code: 'LT' }] },
        },
        {
          code: { coding: [{ system: DME_ORDER_PARAMETER_SYSTEM, code: 'modifier' }] },
          valueCodeableConcept: { coding: [{ system: DME_ORDER_PARAMETER_SYSTEM, code: 'RR' }] },
        },
        {
          code: { coding: [{ system: DME_ORDER_PARAMETER_SYSTEM, code: 'duration' }] },
          valueQuantity: { value: 2, unit: 'weeks' },
        },
      ],
      supportingInfo: [{ reference: 'Procedure/old' }],
    };
    expect(parseDmeOrder(legacy, NAMES)).toMatchObject({
      quantity: 4,
      laterality: undefined,
      modifier: undefined,
      duration: undefined,
    });
  });

  it('round-trips a minimal in-house order and drops third party details', () => {
    const dr = build(fields({ itemName: 'Custom splint', billingCodes: [], thirdParty: { name: 'Ignored' } }));
    const parsed = parseDmeOrder(dr, NAMES);

    expect(dr.contained).toBeUndefined();
    expect(dr.performer).toBeUndefined();
    expect(parsed).toMatchObject({
      itemName: 'Custom splint',
      quantity: 2,
      billingCodes: [],
      diagnoses: [],
      external: false,
      thirdParty: undefined,
      laterality: undefined,
      modifier: undefined,
      duration: undefined,
      instructions: undefined,
      status: DmeOrderStatus.pending,
    });
  });

  it('stores the item name as the code text only', () => {
    expect(build(fields({ itemName: '  Knee walker ' })).codeCodeableConcept).toEqual({ text: 'Knee walker' });
  });

  it('reads the item name of an order placed from the old DME menu (coding, no text)', () => {
    const legacy: DeviceRequest = {
      ...build(fields()),
      codeCodeableConcept: {
        coding: [{ system: ottehrCodeSystemUrl('dme-item'), code: 'menu-item-1', display: 'Ankle Brace' }],
      },
    };
    const parsed = parseDmeOrder(legacy, NAMES);
    expect(parsed.itemName).toBe('Ankle Brace');
    expect(parsed).not.toHaveProperty('menuItemId');

    const resaved = build(DmeOrderFieldsSchema.parse({ ...fields(), itemName: parsed.itemName }), legacy);
    expect(resaved.codeCodeableConcept).toEqual({ text: 'Ankle Brace' });
  });

  it.each([{ fax: '5557654321' }, { address: '1 Main St' }, { name: 'Acme DME' }])(
    'builds a contained third party that satisfies org-1 for %o',
    (thirdParty) => {
      const org = build(fields({ external: true, thirdParty })).contained?.[0] as Organization;
      expect((org.identifier?.length ?? 0) + (org.name ? 1 : 0)).toBe(1);
      expect(org.telecom?.length ?? 1).toBeGreaterThan(0);
    }
  );

  it('lists the billing Procedures of this version of the order, replacing the previous list on edit', () => {
    const make = (references: string[], existing?: DeviceRequest): DeviceRequest => ({
      ...makeDmeDeviceRequest({
        fields: fields(),
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        existing,
        billingProcedureReferences: references,
      }),
      id: 'dr-1',
    });
    const stored = make(['Procedure/old-1', 'Procedure/old-2']);

    expect(stored.extension).toContainEqual({
      url: DME_BILLING_PROCEDURE_EXTENSION_URL,
      valueReference: { reference: 'Procedure/old-1' },
    });
    expect(getDmeBillingProcedureIds(stored)).toEqual(['old-1', 'old-2']);
    expect(getDmeBillingProcedureIds(make(['Procedure/new'], stored))).toEqual(['new']);
    expect(getDmeBillingProcedureIds(make([], stored))).toEqual([]);
    expect(parseDmeOrder(stored, NAMES).billingCodes).toEqual(ANKLE_BRACE_CODES);
  });

  it('describes a billing code stored without a display by the item name', () => {
    const dr = build(fields());
    dr.extension = dr.extension?.map((e) =>
      e.valueCoding?.code === 'L4361' ? { ...e, valueCoding: { ...e.valueCoding, display: '' } } : e
    );
    expect(parseDmeOrder(dr, NAMES).billingCodes).toEqual([
      ANKLE_BRACE_CODES[0],
      { code: 'L4361', display: 'Ankle Brace' },
    ]);
  });

  it('keeps status, dispensed info, id and authoredOn from the existing order on edit', () => {
    const original = build(fields());
    const dispensedAt = '2026-10-01T12:00:00.000Z';
    const dispensed: DeviceRequest = {
      ...original,
      authoredOn: '2026-09-30T08:00:00.000Z',
      status: 'completed',
      extension: [...(original.extension ?? []), makeDmeDispensedExtension(DISPENSED_BY, dispensedAt)],
    };

    const edited = build(fields({ quantity: 5, laterality: 'LT' }), dispensed);
    const parsed = parseDmeOrder(edited, NAMES);

    expect(edited.id).toBe('dr-1');
    expect(edited.authoredOn).toBe('2026-09-30T08:00:00.000Z');
    expect(parsed).toMatchObject({
      quantity: 5,
      laterality: 'LT',
      status: DmeOrderStatus.dispensed,
      dispensed: { practitionerId: DISPENSED_BY, name: 'Nurse Dispense', at: dispensedAt },
    });
    expect(getDmePractitionerIds(edited)).toEqual([ORDERED_BY, DISPENSED_BY]);
  });

  it('records a dispense without a practitioner', () => {
    const dr: DeviceRequest = {
      ...build(fields()),
      status: 'completed',
      extension: [makeDmeDispensedExtension(undefined, '2026-10-02T00:00:00.000Z')],
    };
    expect(parseDmeOrder(dr, NAMES).dispensed).toEqual({
      practitionerId: undefined,
      name: undefined,
      at: '2026-10-02T00:00:00.000Z',
    });
    expect(getDmePractitionerIds(dr)).toEqual([ORDERED_BY]);
  });
});

describe('getDmeOrderStatus', () => {
  it('maps in-house, external and completed orders', () => {
    const inHouse = build(fields());
    const external = build(fields({ external: true }));

    expect(getDmeOrderStatus(inHouse)).toBe(DmeOrderStatus.pending);
    expect(getDmeOrderStatus(external)).toBe(DmeOrderStatus.ordered);
    expect(getDmeOrderStatus({ ...inHouse, status: 'completed' })).toBe(DmeOrderStatus.dispensed);
    expect(getDmeOrderStatus({ ...external, status: 'completed' })).toBe(DmeOrderStatus.dispensed);
  });

  it('treats revoked orders as deleted', () => {
    const dr = build(fields());
    expect(isDmeOrderDeleted(dr)).toBe(false);
    expect(isDmeOrderDeleted({ ...dr, status: 'revoked' })).toBe(true);
  });
});

describe('makeDmeBillingProcedures', () => {
  const procedures = (f: ParsedDmeOrderFields): Procedure[] =>
    makeDmeBillingProcedures({
      fields: f,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      deviceRequestReference: 'DeviceRequest/dr-1',
    });

  it('bills nothing for external orders', () => {
    expect(procedures(fields({ external: true, laterality: 'BI', modifier: 'NU' }))).toEqual([]);
  });

  it('creates one procedure per HCPCS code with LT+RT for bilateral, the modifier and quantity as units', () => {
    const result = procedures(fields({ laterality: 'BI', modifier: 'NU', quantity: 3 }));

    expect(result).toHaveLength(2);
    result.forEach((procedure, i) => {
      expect(procedure.basedOn).toBeUndefined();
      expect(procedure.extension).toEqual([
        { url: DME_BILLED_ORDER_EXTENSION_URL, valueReference: { reference: 'DeviceRequest/dr-1' } },
      ]);
      expect(isDmeBillingProcedureOf(procedure, build(fields()))).toBe(true);
      expect(isDmeBillingProcedureOf(procedure, { ...build(fields()), id: 'dr-2' })).toBe(false);
      expect(isDmeBillingProcedure(procedure)).toBe(true);
      expect(isDmeBillingProcedure({ ...procedure, extension: undefined })).toBe(false);
      expect(procedure.encounter).toEqual({ reference: `Encounter/${ENCOUNTER_ID}` });
      expect(procedure.subject).toEqual({ reference: `Patient/${PATIENT_ID}` });
      expect(procedure.meta?.tag).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'cpt-code' })]));

      const dto = makeCPTCodeDTO(procedure);
      expect(dto).toMatchObject({ code: ANKLE_BRACE_CODES[i].code, display: ANKLE_BRACE_CODES[i].display });
      expect(dto?.modifier?.map((m) => m.code)).toEqual(['LT', 'RT', 'NU']);
      expect(dto?.billableUnits).toBe(3);
    });
  });

  it('adds only the matching side for unilateral orders and no modifiers for N/A', () => {
    const right = makeCPTCodeDTO(procedures(fields({ laterality: 'RT' }))[0]);
    expect(right?.modifier?.map((m) => m.code)).toEqual(['RT']);

    const na = makeCPTCodeDTO(procedures(fields({ laterality: 'NA' }))[0]);
    expect(na?.modifier ?? []).toEqual([]);
    expect(na?.billableUnits).toBe(2);
  });
});

describe('fetchDmeBillingProcedures', () => {
  const line = (id: string, deviceRequestReference: string): Procedure => ({
    ...makeDmeBillingProcedures({
      fields: fields(),
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      deviceRequestReference,
    })[0],
    id,
  });
  const fhirSearching = (lines: Procedure[]): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
    const search = vi.fn(async () => ({
      total: lines.length,
      entry: lines.map((resource) => ({ resource, search: { mode: 'match' } })),
      unbundle: () => lines,
    }));
    return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
  };
  const order = (billingProcedureIds: string[]): DeviceRequest => ({
    ...makeDmeDeviceRequest({
      fields: fields(),
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      billingProcedureReferences: billingProcedureIds.map((id) => `Procedure/${id}`),
    }),
    id: 'dr-1',
  });

  it("returns only this order's billing lines, not another order's or a manually added CPT line", async () => {
    const manual: Procedure = {
      ...makeProcedureResource(ENCOUNTER_ID, PATIENT_ID, { code: 'L1906', display: 'Ankle brace' }, 'cpt-code'),
      id: 'manual',
    };
    const { oystehr, search } = fhirSearching([
      line('own', 'DeviceRequest/dr-1'),
      line('other', 'DeviceRequest/dr-2'),
      manual,
    ]);

    const result = await fetchDmeBillingProcedures(build(fields()), oystehr);

    expect(result.map((p) => p.id)).toEqual(['own']);
    expect((search.mock.calls[0] as any)[0].params).toEqual(
      expect.arrayContaining([
        { name: 'encounter', value: `Encounter/${ENCOUNTER_ID}` },
        { name: '_tag', value: 'cpt-code' },
      ])
    );
  });

  it('finds a billing line the chart rewrote without its order extension, and skips one deleted by hand', async () => {
    const own = line('own', 'DeviceRequest/dr-1');
    // save-chart-data rebuilds an edited CPT line from its DTO, which carries no root extensions
    const rewritten: Procedure = {
      ...makeProcedureResource(ENCOUNTER_ID, PATIENT_ID, { ...makeCPTCodeDTO(own)!, billableUnits: 4 }, 'cpt-code'),
      id: 'own',
    };
    expect(isDmeBillingProcedure(rewritten)).toBe(false);
    const { oystehr } = fhirSearching([rewritten, line('other', 'DeviceRequest/dr-2')]);

    const result = await fetchDmeBillingProcedures(order(['own', 'deleted-by-hand']), oystehr);

    expect(result.map((p) => p.id)).toEqual(['own']);
    expect(getDmeBillingProcedureIds(order(['own', 'deleted-by-hand']))).toEqual(['own', 'deleted-by-hand']);
  });
});

describe('DME dispense task', () => {
  const patient: Patient = { resourceType: 'Patient', id: PATIENT_ID, name: [{ given: ['Jane'], family: 'Doe' }] };
  const visitLocation: Location = { resourceType: 'Location', id: 'visit-location', name: 'Main St' };
  const followUpLocation: Location = { resourceType: 'Location', id: 'follow-up-location', name: 'Annex' };
  const parent: Encounter = {
    resourceType: 'Encounter',
    id: 'parent-encounter',
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: 'Appointment/parent-appointment' }],
    location: [{ location: { reference: `Location/${visitLocation.id}` } }],
  };
  const followUp: Encounter = {
    resourceType: 'Encounter',
    id: ENCOUNTER_ID,
    status: 'in-progress',
    class: { code: 'VR' },
    subject: { reference: `Patient/${PATIENT_ID}` },
    partOf: { reference: `Encounter/${parent.id}` },
    location: [{ location: { reference: `Location/${followUpLocation.id}` } }],
  };

  const dispenseTaskFor = async (
    resources: (Encounter | Patient | Location)[]
  ): Promise<ReturnType<typeof makeDmeDispenseTask>> => {
    const search = vi.fn(async () => ({ unbundle: () => resources }));
    const context = await fetchDmeEncounterContext(ENCOUNTER_ID, { fhir: { search } } as unknown as Oystehr);
    expect((search.mock.calls[0] as any)[0].params).toContainEqual({ name: '_include', value: 'Encounter:part-of' });
    return makeDmeDispenseTask({
      deviceRequestReference: 'DeviceRequest/dr-1',
      itemName: 'Ankle Brace',
      orderDate: undefined,
      providerName: 'Dr. Order',
      context,
    });
  };
  const appointmentInput = (task: ReturnType<typeof makeDmeDispenseTask>): string | undefined =>
    task.input?.find((i) => i.type.coding?.some((c) => c.code === DME_TASK.input.appointmentId))?.valueString;

  it("opens a follow-up without its own appointment through the parent's appointment", async () => {
    const task = await dispenseTaskFor([followUp, patient, followUpLocation, parent, visitLocation]);

    expect(appointmentInput(task)).toBe('parent-appointment');
    expect(task.encounter).toEqual({ reference: `Encounter/${ENCOUNTER_ID}` });
    expect(task.location).toEqual({ reference: `Location/${followUpLocation.id}`, display: followUpLocation.name });
  });

  it("prefers the encounter's own appointment", async () => {
    const task = await dispenseTaskFor([
      { ...followUp, appointment: [{ reference: 'Appointment/own-appointment' }] },
      patient,
      followUpLocation,
      parent,
    ]);

    expect(appointmentInput(task)).toBe('own-appointment');
  });
});

describe('makeDmeProvenance', () => {
  const provenance = (callerPractitionerId: string | undefined): ReturnType<typeof makeDmeProvenance> =>
    makeDmeProvenance({
      target: 'DeviceRequest/dr-1',
      activity: 'update',
      callerPractitionerId,
      requesterReference: `Practitioner/${ORDERED_BY}`,
    });

  it('records the caller as agent, acting on behalf of a different requester', () => {
    expect(provenance(DISPENSED_BY)?.agent).toEqual([
      { who: { reference: `Practitioner/${DISPENSED_BY}` }, onBehalfOf: { reference: `Practitioner/${ORDERED_BY}` } },
    ]);
    expect(provenance(ORDERED_BY)?.agent).toEqual([{ who: { reference: `Practitioner/${ORDERED_BY}` } }]);
    expect(provenance(undefined)).toBeUndefined();
  });
});
