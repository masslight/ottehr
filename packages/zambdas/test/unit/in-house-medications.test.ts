import Oystehr from '@oystehr/sdk';
import { Medication } from 'fhir/r4b';
import {
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_HCPCS,
  CODE_SYSTEM_NDC,
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performEffect as createPerformEffect } from '../../src/ehr/configuration/in-house-medications/create-in-house-medication/index';
import { validateRequestParameters as createValidate } from '../../src/ehr/configuration/in-house-medications/create-in-house-medication/validateRequestParameters';
import { performEffect as updatePerformEffect } from '../../src/ehr/configuration/in-house-medications/update-in-house-medication/index';
import { validateRequestParameters } from '../../src/ehr/configuration/in-house-medications/update-in-house-medication/validateRequestParameters';
import { ZambdaInput } from '../../src/shared';

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
        cptCodes: ['99213'],
        hcpcsCodes: ['J0696'],
      })
    );
    expect(result.name).toBe('Ibuprofen 200mg');
    expect(result.ndc).toBe('12345-678-90');
    expect(result.medispanID).toBe('DRUG123');
    expect(result.cptCodes).toEqual(['99213']);
    expect(result.hcpcsCodes).toEqual(['J0696']);
  });

  it('validates without optional ndc, cptCodes, hcpcsCodes', () => {
    const result = createValidate(createInput({ name: 'Ibuprofen 200mg', medispanID: 'DRUG123' }));
    expect(result.name).toBe('Ibuprofen 200mg');
    expect(result.ndc).toBeUndefined();
    expect(result.cptCodes).toBeUndefined();
    expect(result.hcpcsCodes).toBeUndefined();
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

  it('validates cptCodes and hcpcsCodes', () => {
    const result = validateRequestParameters(
      createInput({ medicationID: 'med-123', name: 'Drug', cptCodes: ['99213', '99214'], hcpcsCodes: ['J0696'] })
    );
    expect(result.cptCodes).toEqual(['99213', '99214']);
    expect(result.hcpcsCodes).toEqual(['J0696']);
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
    const result = await createPerformEffect(
      oystehr,
      'Ibuprofen 200mg',
      '12345-678-90',
      'DRUG123',
      ['99213'],
      ['J0696']
    );

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
    expect(codings).toContainEqual({ system: CODE_SYSTEM_CPT, code: '99213' });
    expect(codings).toContainEqual({ system: CODE_SYSTEM_HCPCS, code: 'J0696' });
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

  it('creates medication without cptCodes and hcpcsCodes', async () => {
    const oystehr = makeMockOystehr();
    await createPerformEffect(oystehr, 'Ibuprofen 200mg', '12345-678-90', 'DRUG123');

    const callArg = vi.mocked(oystehr.fhir.create).mock.calls[0][0] as Medication;
    const codings = callArg.code?.coding ?? [];
    expect(codings.some((c) => c.system === CODE_SYSTEM_CPT)).toBe(false);
    expect(codings.some((c) => c.system === CODE_SYSTEM_HCPCS)).toBe(false);
  });

  it('creates medication with multiple CPT codes', async () => {
    const oystehr = makeMockOystehr();
    await createPerformEffect(oystehr, 'Drug', undefined, 'DRUG123', ['99213', '99214', '99215']);

    const callArg = vi.mocked(oystehr.fhir.create).mock.calls[0][0] as Medication;
    const cptCodings = (callArg.code?.coding ?? []).filter((c) => c.system === CODE_SYSTEM_CPT);
    expect(cptCodings).toHaveLength(3);
    expect(cptCodings.map((c) => c.code)).toEqual(['99213', '99214', '99215']);
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
      { system: CODE_SYSTEM_CPT, code: '99213' },
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

  it('replaces CPT and HCPCS codings, preserving others', async () => {
    const oystehr = makeMockOystehr();
    await updatePerformEffect(oystehr, {
      medicationID: 'med-123',
      cptCodes: ['99214', '99215'],
      hcpcsCodes: ['J0696'],
    });

    expect(oystehr.fhir.patch).toHaveBeenCalledOnce();
    const { operations } = vi.mocked(oystehr.fhir.patch).mock.calls[0][0] as any;
    const replaceCodingOp = operations.find((op: any) => op.path === '/code/coding');
    expect(replaceCodingOp).toBeDefined();

    const codings = replaceCodingOp.value;
    expect(codings).toContainEqual({ system: CODE_SYSTEM_NDC, code: '12345-678-90' });
    expect(codings).toContainEqual({ system: MEDICATION_DISPENSABLE_DRUG_ID, code: 'DRUG123' });
    expect(codings).toContainEqual({ system: CODE_SYSTEM_CPT, code: '99214' });
    expect(codings).toContainEqual({ system: CODE_SYSTEM_CPT, code: '99215' });
    expect(codings).toContainEqual({ system: CODE_SYSTEM_HCPCS, code: 'J0696' });
    // old CPT code should not be present
    expect(codings).not.toContainEqual({ system: CODE_SYSTEM_CPT, code: '99213' });
  });

  it('clears CPT codes when empty array provided', async () => {
    const oystehr = makeMockOystehr();
    await updatePerformEffect(oystehr, { medicationID: 'med-123', cptCodes: [] });

    const { operations } = vi.mocked(oystehr.fhir.patch).mock.calls[0][0] as any;
    const replaceCodingOp = operations.find((op: any) => op.path === '/code/coding');
    const codings = replaceCodingOp.value;
    expect(codings.some((c: any) => c.system === CODE_SYSTEM_CPT)).toBe(false);
  });

  it('throws when medication is not found', async () => {
    const mockGet = vi.fn().mockResolvedValue(null);
    const oystehr = { fhir: { get: mockGet } } as unknown as Oystehr;

    await expect(updatePerformEffect(oystehr, { medicationID: 'nonexistent' })).rejects.toThrow('nonexistent');
  });
});
