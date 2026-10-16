import { ActivityDefinition, DeviceRequest, Organization, Procedure } from 'fhir/r4b';
import {
  DmeOrderFields,
  DmeOrderFieldsSchema,
  DmeOrderStatus,
  ParsedDmeOrderFields,
} from 'utils/lib/types/api/dme.types';
import { describe, expect, it } from 'vitest';
import { makeCPTCodeDTO } from '../../src/shared/chart-data/index';
import {
  getDmeOrderStatus,
  getDmePractitionerIds,
  isDmeMenuItem,
  isDmeOrderDeleted,
  isDmeOrderExternal,
  makeDmeBillingProcedures,
  makeDmeDeviceRequest,
  makeDmeDispensedExtension,
  makeDmeMenuItemActivityDefinition,
  parseDmeMenuItem,
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
    menuItemId: 'menu-item-1',
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

describe('DME menu item mapping', () => {
  it('round-trips name and HCPCS codes through an ActivityDefinition', () => {
    const resource = makeDmeMenuItemActivityDefinition(
      { name: '  Ankle Brace ', hcpcsCodes: ANKLE_BRACE_CODES },
      'ad-1'
    );

    expect(resource).toMatchObject({ id: 'ad-1', status: 'active', kind: 'DeviceRequest', title: 'Ankle Brace' });
    expect(isDmeMenuItem(resource)).toBe(true);
    expect(parseDmeMenuItem(resource)).toEqual({ id: 'ad-1', name: 'Ankle Brace', hcpcsCodes: ANKLE_BRACE_CODES });
  });

  it('handles an item without codes and rejects resources that are not DME menu items', () => {
    const resource = makeDmeMenuItemActivityDefinition({ name: 'Crutches', hcpcsCodes: [] }, 'ad-2');
    expect(resource.code).toBeUndefined();
    expect(parseDmeMenuItem(resource)).toEqual({ id: 'ad-2', name: 'Crutches', hcpcsCodes: [] });

    expect(makeDmeMenuItemActivityDefinition({ name: 'New', hcpcsCodes: [] }).id).toBeUndefined();
    expect(parseDmeMenuItem({ ...resource, id: undefined })).toBeUndefined();

    const other: ActivityDefinition = { resourceType: 'ActivityDefinition', id: 'qp', status: 'active', title: 'x' };
    expect(isDmeMenuItem(other)).toBe(false);
  });
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
      menuItemId: 'menu-item-1',
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

  it('round-trips a minimal free-text "Other" in-house order and drops third party details', () => {
    const dr = build(
      fields({ menuItemId: undefined, itemName: 'Custom splint', billingCodes: [], thirdParty: { name: 'Ignored' } })
    );
    const parsed = parseDmeOrder(dr, NAMES);

    expect(dr.contained).toBeUndefined();
    expect(dr.performer).toBeUndefined();
    expect(parsed).toMatchObject({
      menuItemId: undefined,
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

  it.each([{ fax: '5557654321' }, { address: '1 Main St' }, { name: 'Acme DME' }])(
    'builds a contained third party that satisfies org-1 for %o',
    (thirdParty) => {
      const org = build(fields({ external: true, thirdParty })).contained?.[0] as Organization;
      expect((org.identifier?.length ?? 0) + (org.name ? 1 : 0)).toBeGreaterThan(0);
      expect(org.telecom?.length ?? 1).toBeGreaterThan(0);
    }
  );

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
    makeDmeBillingProcedures({ fields: f, encounterId: ENCOUNTER_ID, patientId: PATIENT_ID });

  it('bills nothing for external orders', () => {
    expect(procedures(fields({ external: true, laterality: 'BI', modifier: 'NU' }))).toEqual([]);
  });

  it('creates one procedure per HCPCS code with LT+RT for bilateral, the modifier and quantity as units', () => {
    const result = procedures(fields({ laterality: 'BI', modifier: 'NU', quantity: 3 }));

    expect(result).toHaveLength(2);
    result.forEach((procedure, i) => {
      expect(procedure.basedOn).toBeUndefined();
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
