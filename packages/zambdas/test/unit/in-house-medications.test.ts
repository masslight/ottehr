import Oystehr from '@oystehr/sdk';
import { Medication } from 'fhir/r4b';
import {
  getMedicationInventoryConfig,
  INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM,
  makeInventoryLot,
  makeMedicationInventoryExtension,
  MEDICATION_INVENTORY_EXTENSION_URL,
  withLotOnHand,
} from 'utils/lib/fhir/medication-inventory';
import { CODE_SYSTEM_CPT, CODE_SYSTEM_HL7_HCPCS, CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import { InHouseMedicationInventory } from 'utils/lib/types/api/config/in-house-medications';
import {
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import { performEffect as createPerformEffect } from '../../src/ehr/configuration/in-house-medications/create-in-house-medication/index';
import { validateRequestParameters as createValidate } from '../../src/ehr/configuration/in-house-medications/create-in-house-medication/validateRequestParameters';
import { performEffect as updatePerformEffect } from '../../src/ehr/configuration/in-house-medications/update-in-house-medication/index';
import { validateRequestParameters } from '../../src/ehr/configuration/in-house-medications/update-in-house-medication/validateRequestParameters';
import { ZambdaInput } from '../../src/shared/types/common';

// Local const so that DEPRECATED system doesn't get imported from utils
const CODE_SYSTEM_HCPCS = 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets'; // formerly used by Ottehr clinical in-house meds

const createInput = (body: Record<string, unknown>): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer test-token' },
  secrets: null,
});

// ─── create-in-house-medication/validateRequestParameters ─────────────────────

describe('create-in-house-medication - validateRequestParameters', () => {
  it('validates with all fields', () => {
    const result = createValidate(
      createInput({
        name: 'Ibuprofen 200mg',
        ndc: '12345-678-90',
        medispanID: 'DRUG123',
      })
    );
    expect(result.name).toBe('Ibuprofen 200mg');
    expect(result.ndc).toBe('12345-678-90');
    expect(result.medispanID).toBe('DRUG123');
  });

  it('validates without optional ndc', () => {
    const result = createValidate(createInput({ name: 'Ibuprofen 200mg', medispanID: 'DRUG123' }));
    expect(result.name).toBe('Ibuprofen 200mg');
    expect(result.ndc).toBeUndefined();
  });

  it('throws when body is missing', () => {
    const input: ZambdaInput = { body: '', headers: { Authorization: 'Bearer test-token' }, secrets: null };
    expect(() => createValidate(input)).toThrow();
  });

  it('throws when name is missing', () => {
    expect(() => createValidate(createInput({ medispanID: 'DRUG123' }))).toThrow('name');
  });

  it('throws when medispanID is missing', () => {
    expect(() => createValidate(createInput({ name: 'Ibuprofen 200mg' }))).toThrow('medispanID');
  });
});

// ─── update-in-house-medication/validateRequestParameters ─────────────────────

describe('update-in-house-medication - validateRequestParameters', () => {
  it('validates status update', () => {
    const result = validateRequestParameters(createInput({ medicationID: 'med-123', status: 'active' }));
    expect(result.medicationID).toBe('med-123');
    expect(result.status).toBe('active');
  });

  it('validates name update', () => {
    const result = validateRequestParameters(
      createInput({ medicationID: 'med-123', name: 'Updated Name', medispanID: 'DRUG456' })
    );
    expect(result.name).toBe('Updated Name');
  });

  it('throws when body is missing', () => {
    const input: ZambdaInput = { body: '', headers: { Authorization: 'Bearer test-token' }, secrets: null };
    expect(() => validateRequestParameters(input)).toThrow();
  });

  it('throws when medicationID is missing', () => {
    expect(() => validateRequestParameters(createInput({ name: 'Drug' }))).toThrow('medicationID');
  });

  it('throws for invalid status value', () => {
    expect(() => validateRequestParameters(createInput({ medicationID: 'med-123', status: 'deleted' }))).toThrow();
  });

  it('throws when neither status nor name is provided', () => {
    expect(() => validateRequestParameters(createInput({ medicationID: 'med-123' }))).toThrow('name');
  });
});

// ─── create-in-house-medication/performEffect ─────────────────────────────────

describe('create-in-house-medication - performEffect', () => {
  const makeMockOystehr = (createdMed?: Partial<Medication>): Oystehr => {
    const mockCreate = vi.fn().mockResolvedValue({
      resourceType: 'Medication',
      id: 'new-med-id',
      status: 'active',
      ...createdMed,
    } as Medication);
    return { fhir: { create: mockCreate } } as unknown as Oystehr;
  };

  it('creates medication with all fields', async () => {
    const oystehr = makeMockOystehr();
    const result = await createPerformEffect(oystehr, 'Ibuprofen 200mg', '12345-678-90', 'DRUG123', 'DRUG456');

    expect(oystehr.fhir.create).toHaveBeenCalledOnce();
    const callArg = vi.mocked(oystehr.fhir.create).mock.calls[0][0] as Medication;

    expect(callArg.resourceType).toBe('Medication');
    expect(callArg.status).toBe('active');
    expect(callArg.identifier).toContainEqual({
      system: MEDICATION_TYPE_SYSTEM,
      value: INVENTORY_MEDICATION_TYPE_CODE,
    });
    expect(callArg.identifier).toContainEqual({ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Ibuprofen 200mg' });

    const codings = callArg.code?.coding ?? [];
    expect(codings).toContainEqual({ system: CODE_SYSTEM_NDC, code: '12345-678-90' });
    expect(codings).toContainEqual({ system: MEDICATION_DISPENSABLE_DRUG_ID, code: 'DRUG123' });
    expect(codings).toContainEqual({ system: MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS, code: 'DRUG456' });
    // CPT/HCPCS are no longer managed by the admin medication catalog
    expect(codings.some((c) => c.system === CODE_SYSTEM_CPT)).toBe(false);
    expect(codings.some((c) => c.system === CODE_SYSTEM_HCPCS)).toBe(false);
    expect(codings.some((c) => c.system === CODE_SYSTEM_HL7_HCPCS)).toBe(false);
    expect(result.id).toBe('new-med-id');
  });

  it('creates medication without optional ndc', async () => {
    const oystehr = makeMockOystehr();
    await createPerformEffect(oystehr, 'Ibuprofen 200mg', undefined, 'DRUG123');

    const callArg = vi.mocked(oystehr.fhir.create).mock.calls[0][0] as Medication;
    const codings = callArg.code?.coding ?? [];
    expect(codings.some((c) => c.system === CODE_SYSTEM_NDC)).toBe(false);
    expect(codings).toContainEqual({ system: MEDICATION_DISPENSABLE_DRUG_ID, code: 'DRUG123' });
  });
});

// ─── update-in-house-medication/performEffect ─────────────────────────────────

const existingMedication: Medication = {
  resourceType: 'Medication',
  id: 'med-123',
  status: 'active',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Ibuprofen 200mg' },
  ],
  code: {
    coding: [
      { system: CODE_SYSTEM_NDC, code: '12345-678-90' },
      { system: MEDICATION_DISPENSABLE_DRUG_ID, code: 'DRUG123' },
      // Legacy CPT/HCPCS codings left over from the previous admin flow — must be preserved by updates.
      { system: CODE_SYSTEM_CPT, code: '99213', display: 'Office visit' },
      { system: CODE_SYSTEM_HCPCS, code: 'J0696', display: 'Ceftriaxone injection' },
      { system: CODE_SYSTEM_HL7_HCPCS, code: 'J0696', display: 'Ceftriaxone injection' },
    ],
  },
};

describe('update-in-house-medication - performEffect', () => {
  const makeMockOystehr = (existing: Medication = existingMedication): Oystehr => {
    const mockGet = vi.fn().mockResolvedValue(existing);
    const mockPatch = vi
      .fn()
      .mockImplementation(({ operations }: { operations: unknown }) =>
        Promise.resolve({ ...existing, _patched: operations })
      );
    return { fhir: { get: mockGet, patch: mockPatch } } as unknown as Oystehr;
  };

  it('patches name when changed', async () => {
    const oystehr = makeMockOystehr();
    await updatePerformEffect(oystehr, {
      medicationID: 'med-123',
      name: 'Ibuprofen 400mg',
    });

    expect(oystehr.fhir.patch).toHaveBeenCalledOnce();
    const { operations } = vi.mocked(oystehr.fhir.patch).mock.calls[0][0] as any;
    expect(operations).toContainEqual(
      expect.objectContaining({ op: 'replace', path: expect.stringContaining('value'), value: 'Ibuprofen 400mg' })
    );
  });

  it('does not patch when name is unchanged', async () => {
    const oystehr = makeMockOystehr();
    await updatePerformEffect(oystehr, {
      medicationID: 'med-123',
      name: 'Ibuprofen 200mg',
      ndc: '12345-678-90',
      medispanID: 'DRUG123',
    });

    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('patches status', async () => {
    const oystehr = makeMockOystehr();
    await updatePerformEffect(oystehr, { medicationID: 'med-123', status: 'inactive' });

    expect(oystehr.fhir.patch).toHaveBeenCalledOnce();
    const { operations } = vi.mocked(oystehr.fhir.patch).mock.calls[0][0] as any;
    expect(operations).toContainEqual({ op: 'replace', path: '/status', value: 'inactive' });
  });

  it('preserves legacy CPT and HCPCS codings when other fields change', async () => {
    const oystehr = makeMockOystehr();
    await updatePerformEffect(oystehr, {
      medicationID: 'med-123',
      ndc: 'new-ndc',
    });

    expect(oystehr.fhir.patch).toHaveBeenCalledOnce();
    const { operations } = vi.mocked(oystehr.fhir.patch).mock.calls[0][0] as any;
    const replaceCodingOp = operations.find((op: any) => op.path === '/code/coding');
    expect(replaceCodingOp).toBeDefined();

    const codings = replaceCodingOp.value;
    expect(codings).toContainEqual({ system: CODE_SYSTEM_NDC, code: 'new-ndc' });
    expect(codings).toContainEqual({ system: MEDICATION_DISPENSABLE_DRUG_ID, code: 'DRUG123' });
    // Legacy CPT/HCPCS codings on the existing medication are preserved as-is.
    expect(codings).toContainEqual({ system: CODE_SYSTEM_CPT, code: '99213', display: 'Office visit' });
    expect(codings).toContainEqual({ system: CODE_SYSTEM_HCPCS, code: 'J0696', display: 'Ceftriaxone injection' });
    expect(codings).toContainEqual({ system: CODE_SYSTEM_HL7_HCPCS, code: 'J0696', display: 'Ceftriaxone injection' });
  });

  it('throws when medication is not found', async () => {
    const mockGet = vi.fn().mockResolvedValue(null);
    const oystehr = { fhir: { get: mockGet } } as unknown as Oystehr;

    await expect(updatePerformEffect(oystehr, { medicationID: 'nonexistent' })).rejects.toThrow('nonexistent');
  });

  it('adds /code when the existing medication has no code field', async () => {
    const medicationWithoutCode: Medication = {
      resourceType: 'Medication',
      id: 'med-no-code',
      status: 'active',
      identifier: [
        { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
        { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Dummy Med' },
      ],
      // no code field
    };
    const oystehr = makeMockOystehr(medicationWithoutCode);

    await updatePerformEffect(oystehr, {
      medicationID: 'med-no-code',
      ndc: 'new-ndc',
      medispanID: 'new-medispan',
    });

    expect(oystehr.fhir.patch).toHaveBeenCalledOnce();
    const { operations } = vi.mocked(oystehr.fhir.patch).mock.calls[0][0] as any;
    // exactly one /code-related op, using `add` (not `replace` or append)
    const codeOps = operations.filter((op: any) => op.path === '/code' || op.path.startsWith('/code/'));
    expect(codeOps).toHaveLength(1);
    expect(codeOps[0]).toEqual({
      op: 'add',
      path: '/code',
      value: {
        coding: [
          { system: CODE_SYSTEM_NDC, code: 'new-ndc' },
          { system: MEDICATION_DISPENSABLE_DRUG_ID, code: 'new-medispan' },
        ],
      },
    });
    // verify no legacy append-style op snuck in
    expect(operations.some((op: any) => op.path === '/code/coding/-')).toBe(false);
  });

  it('adds /code/coding when the existing medication has code but no coding array', async () => {
    const medicationWithEmptyCode: Medication = {
      resourceType: 'Medication',
      id: 'med-empty-code',
      status: 'active',
      identifier: [
        { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
        { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Dummy Med' },
      ],
      code: {}, // code present but no coding array
    };
    const oystehr = makeMockOystehr(medicationWithEmptyCode);

    await updatePerformEffect(oystehr, {
      medicationID: 'med-empty-code',
      ndc: 'new-ndc',
      medispanID: 'new-medispan',
    });

    const { operations } = vi.mocked(oystehr.fhir.patch).mock.calls[0][0] as any;
    const codeOps = operations.filter((op: any) => op.path === '/code' || op.path.startsWith('/code/'));
    expect(codeOps).toHaveLength(1);
    expect(codeOps[0]).toEqual({
      op: 'add',
      path: '/code/coding',
      value: [
        { system: CODE_SYSTEM_NDC, code: 'new-ndc' },
        { system: MEDICATION_DISPENSABLE_DRUG_ID, code: 'new-medispan' },
      ],
    });
  });
});

// ─── update-in-house-medication: inventory setup ──────────────────────────────

const inventory: InHouseMedicationInventory = {
  countedAs: 'vial',
  eachContains: { amount: 4, unit: 'mg', in: { amount: 2, unit: 'ml' } },
  use: 'single-use',
  reorderLevels: [
    { locationId: 'loc-main', level: 10 },
    { locationId: 'loc-north', level: 6 },
  ],
};

describe('update-in-house-medication - inventory validation', () => {
  it('accepts a full inventory setup and defaults reorderLevels', () => {
    const { countedAs, eachContains, use } = inventory;
    const withoutLevels = { countedAs, eachContains, use };
    const result = validateRequestParameters(
      createInput({ medicationID: 'med-123', name: 'Drug', inventory: withoutLevels })
    );
    expect(result.inventory).toEqual({ ...withoutLevels, reorderLevels: [] });
  });

  it('passes null through so the setup can be cleared', () => {
    const result = validateRequestParameters(createInput({ medicationID: 'med-123', name: 'Drug', inventory: null }));
    expect(result.inventory).toBeNull();
  });

  it('leaves inventory undefined when not sent', () => {
    const result = validateRequestParameters(createInput({ medicationID: 'med-123', name: 'Drug' }));
    expect(result.inventory).toBeUndefined();
  });

  it.each([
    ['unknown counted-as', { ...inventory, countedAs: 'box' }],
    ['unknown dose unit', { ...inventory, eachContains: { amount: 4, unit: 'oz' } }],
    ['zero amount', { ...inventory, eachContains: { amount: 0, unit: 'mg' } }],
    ['missing use', { ...inventory, use: undefined }],
    ['negative reorder level', { ...inventory, reorderLevels: [{ locationId: 'loc-main', level: -1 }] }],
    ['fractional reorder level', { ...inventory, reorderLevels: [{ locationId: 'loc-main', level: 1.5 }] }],
  ])('rejects %s', (_label, bad) => {
    expect(() =>
      validateRequestParameters(createInput({ medicationID: 'med-123', name: 'Drug', inventory: bad }))
    ).toThrow();
  });
});

const lotSearchBundle = (lots: Medication[]): unknown => ({
  entry: lots.map((resource) => ({ resource, search: { mode: 'match' } })),
  total: lots.length,
  unbundle: () => lots,
});

describe('update-in-house-medication - inventory persistence', () => {
  const makeMockOystehr = (existing: Medication): Oystehr => {
    const mockGet = vi.fn().mockResolvedValue(existing);
    const mockPatch = vi.fn().mockResolvedValue(existing);
    const mockSearch = vi.fn().mockResolvedValue(lotSearchBundle([]));
    return { fhir: { get: mockGet, patch: mockPatch, search: mockSearch } } as unknown as Oystehr;
  };
  const otherExtension = { url: 'https://example.com/other', valueString: 'keep me' };
  const trackedMedication: Medication = {
    ...existingMedication,
    extension: [otherExtension, makeMedicationInventoryExtension(inventory)],
  };

  it('round-trips the setup through the Medication extension', () => {
    expect(getMedicationInventoryConfig(trackedMedication)).toEqual(inventory);
    expect(getMedicationInventoryConfig(existingMedication)).toBeUndefined();
  });

  it('writes one extension per reorder level with a Location reference', () => {
    const extension = makeMedicationInventoryExtension(inventory);
    expect(extension.url).toBe(MEDICATION_INVENTORY_EXTENSION_URL);
    expect(extension.extension).toContainEqual({ url: 'counted-as', valueCode: 'vial' });
    expect(extension.extension).toContainEqual({
      url: 'reorder-level',
      extension: [
        { url: 'location', valueReference: { reference: 'Location/loc-main' } },
        { url: 'level', valueInteger: 10 },
      ],
    });
  });

  it('adds /extension when the medication has none', async () => {
    const oystehr = makeMockOystehr(existingMedication);
    await updatePerformEffect(oystehr, { medicationID: 'med-123', inventory });

    const { operations } = vi.mocked(oystehr.fhir.patch).mock.calls[0][0] as any;
    expect(operations).toEqual([
      { op: 'add', path: '/extension', value: [makeMedicationInventoryExtension(inventory)] },
    ]);
  });

  it('replaces the setup and keeps unrelated extensions', async () => {
    const oystehr = makeMockOystehr(trackedMedication);
    const changed: InHouseMedicationInventory = { ...inventory, use: 'multi-use', reorderLevels: [] };
    await updatePerformEffect(oystehr, { medicationID: 'med-123', inventory: changed });

    const { operations } = vi.mocked(oystehr.fhir.patch).mock.calls[0][0] as any;
    expect(operations).toEqual([
      { op: 'replace', path: '/extension', value: [otherExtension, makeMedicationInventoryExtension(changed)] },
    ]);
  });

  it('clears the setup with null, removing /extension when nothing else is left', async () => {
    const oystehr = makeMockOystehr({
      ...existingMedication,
      extension: [makeMedicationInventoryExtension(inventory)],
    });
    await updatePerformEffect(oystehr, { medicationID: 'med-123', inventory: null });

    const { operations } = vi.mocked(oystehr.fhir.patch).mock.calls[0][0] as any;
    expect(operations).toEqual([{ op: 'remove', path: '/extension' }]);
  });

  it('does not patch when the setup is unchanged or left undefined', async () => {
    const unchanged = makeMockOystehr(trackedMedication);
    await updatePerformEffect(unchanged, { medicationID: 'med-123', inventory });
    expect(unchanged.fhir.patch).not.toHaveBeenCalled();

    const untouched = makeMockOystehr(trackedMedication);
    await updatePerformEffect(untouched, { medicationID: 'med-123', name: 'Ibuprofen 200mg' });
    expect(untouched.fhir.patch).not.toHaveBeenCalled();

    const neverTracked = makeMockOystehr(existingMedication);
    await updatePerformEffect(neverTracked, { medicationID: 'med-123', inventory: null });
    expect(neverTracked.fhir.patch).not.toHaveBeenCalled();
  });
});

describe('update-in-house-medication - Counting Unit after inventory has been recorded', () => {
  const trackedCatalog = {
    ...existingMedication,
    extension: [makeMedicationInventoryExtension(inventory)],
  } as Medication & { id: string };
  const lotAt = (locationId: string, onHand: number): Medication => ({
    ...withLotOnHand(
      makeInventoryLot(trackedCatalog, {
        locationId,
        lotNumber: 'A123',
        expirationDate: '2027-03-31',
        ndc: '12345-678-90',
        unit: 'vial',
      }),
      onHand
    ),
    id: `lot-${locationId}`,
  });
  const makeMockOystehr = (catalog: Medication, lots: Medication[]): Oystehr =>
    ({
      fhir: {
        get: vi.fn().mockResolvedValue(catalog),
        patch: vi.fn().mockResolvedValue(catalog),
        search: vi.fn().mockResolvedValue(lotSearchBundle(lots)),
      },
    }) as unknown as Oystehr;
  const asTablets: InHouseMedicationInventory = { ...inventory, countedAs: 'tablet' };
  const rejected = { code: APIErrorCode.INVALID_INPUT };

  it('changes the unit when no inventory has been recorded', async () => {
    const oystehr = makeMockOystehr(trackedCatalog, []);
    await updatePerformEffect(oystehr, { medicationID: 'med-123', inventory: asTablets });

    const { operations } = vi.mocked(oystehr.fhir.patch).mock.calls[0][0] as any;
    expect(operations).toEqual([
      { op: 'replace', path: '/extension', value: [makeMedicationInventoryExtension(asTablets)] },
    ]);
  });

  it('rejects a unit change once a receipt has been recorded', async () => {
    const oystehr = makeMockOystehr(trackedCatalog, [lotAt('loc-main', 10)]);
    await expect(updatePerformEffect(oystehr, { medicationID: 'med-123', inventory: asTablets })).rejects.toMatchObject(
      rejected
    );
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('rejects a unit change after the stock has been used up', async () => {
    const oystehr = makeMockOystehr(trackedCatalog, [lotAt('loc-main', 0)]);
    await expect(updatePerformEffect(oystehr, { medicationID: 'med-123', inventory: asTablets })).rejects.toMatchObject(
      rejected
    );
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('counts inventory recorded at any location', async () => {
    const oystehr = makeMockOystehr(trackedCatalog, [lotAt('loc-north', 10)]);
    await expect(updatePerformEffect(oystehr, { medicationID: 'med-123', inventory: asTablets })).rejects.toMatchObject(
      rejected
    );

    const { params } = vi.mocked(oystehr.fhir.search).mock.calls[0][0] as any;
    expect(params).toContainEqual({ name: 'identifier', value: `${INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM}|med-123` });
    expect(params.some((param: { name: string }) => param.name === '_tag')).toBe(false);
  });

  it('saves the same unit with inventory recorded, without searching for it', async () => {
    const oystehr = makeMockOystehr(trackedCatalog, [lotAt('loc-main', 10)]);
    const sameUnit: InHouseMedicationInventory = { ...inventory, use: 'multi-use', reorderLevels: [] };
    await updatePerformEffect(oystehr, { medicationID: 'med-123', inventory: sameUnit });

    expect(oystehr.fhir.patch).toHaveBeenCalledOnce();
    expect(oystehr.fhir.search).not.toHaveBeenCalled();
  });

  it('edits other medication fields with inventory recorded', async () => {
    const oystehr = makeMockOystehr(trackedCatalog, [lotAt('loc-main', 10)]);
    await updatePerformEffect(oystehr, {
      medicationID: 'med-123',
      name: 'Ibuprofen 400mg',
      ndc: 'new-ndc',
      inventory,
    });

    expect(oystehr.fhir.patch).toHaveBeenCalledOnce();
    expect(oystehr.fhir.search).not.toHaveBeenCalled();
  });

  it('rejects changing a configured unit to match its lots when the two already differ', async () => {
    const tabletCatalog = { ...existingMedication, extension: [makeMedicationInventoryExtension(asTablets)] };
    const oystehr = makeMockOystehr(tabletCatalog, [lotAt('loc-main', 10)]);
    await expect(updatePerformEffect(oystehr, { medicationID: 'med-123', inventory })).rejects.toMatchObject(rejected);
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('after tracking was turned off, accepts only the unit the inventory was recorded in', async () => {
    const differentUnit = makeMockOystehr(existingMedication, [lotAt('loc-main', 10)]);
    await expect(
      updatePerformEffect(differentUnit, { medicationID: 'med-123', inventory: asTablets })
    ).rejects.toMatchObject(rejected);
    expect(differentUnit.fhir.patch).not.toHaveBeenCalled();

    const recordedUnit = makeMockOystehr(existingMedication, [lotAt('loc-main', 10)]);
    await updatePerformEffect(recordedUnit, { medicationID: 'med-123', inventory });
    expect(recordedUnit.fhir.patch).toHaveBeenCalledOnce();
  });
});
