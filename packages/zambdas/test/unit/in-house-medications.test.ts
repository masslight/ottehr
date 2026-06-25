import Oystehr from '@oystehr/sdk';
import { Medication } from 'fhir/r4b';
import {
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_HCPCS,
  CODE_SYSTEM_NDC,
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
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
