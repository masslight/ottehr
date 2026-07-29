import { describe, expect, test } from 'vitest';
import { validateInput } from '../../src/ehr/radiology/order-list/validation';
import { ZambdaInput } from '../../src/shared';

const UUID_A = '123e4567-e89b-12d3-a456-426614174000';
const UUID_B = '123e4567-e89b-12d3-a456-426614174001';

const createMockZambdaInput = (body: any): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer test-token' },
  secrets: null,
});

describe('Radiology order-list - validateInput', () => {
  test('accepts a single patientId', async () => {
    const { body } = await validateInput(createMockZambdaInput({ patientId: UUID_A }));
    expect(body.patientId).toBe(UUID_A);
    expect(body.encounterIds).toBeUndefined();
  });

  test('normalizes a single encounterIds string to an array', async () => {
    const { body } = await validateInput(createMockZambdaInput({ encounterIds: UUID_A }));
    expect(body.encounterIds).toEqual([UUID_A]);
  });

  test('preserves an encounterIds array', async () => {
    const { body } = await validateInput(createMockZambdaInput({ encounterIds: [UUID_A, UUID_B] }));
    expect(body.encounterIds).toEqual([UUID_A, UUID_B]);
  });

  test('accepts pagination alongside an identifier', async () => {
    const { body } = await validateInput(createMockZambdaInput({ patientId: UUID_A, pageIndex: 2, itemsPerPage: 25 }));
    expect(body.pageIndex).toBe(2);
    expect(body.itemsPerPage).toBe(25);
  });

  test('tolerates itemsPerPage/pageIndex of 0 (preserved legacy behavior)', async () => {
    const { body } = await validateInput(createMockZambdaInput({ patientId: UUID_A, pageIndex: 0, itemsPerPage: 0 }));
    expect(body.pageIndex).toBe(0);
    expect(body.itemsPerPage).toBe(0);
  });

  test('rejects more than one identifier', async () => {
    await expect(
      validateInput(createMockZambdaInput({ patientId: UUID_A, serviceRequestId: UUID_B }))
    ).rejects.toThrow();
  });

  test('rejects when no identifier is provided', async () => {
    await expect(validateInput(createMockZambdaInput({ pageIndex: 1 }))).rejects.toThrow();
  });

  test('rejects a non-uuid patientId', async () => {
    await expect(validateInput(createMockZambdaInput({ patientId: 'not-a-uuid' }))).rejects.toThrow();
  });

  test('rejects an encounterIds array containing a non-uuid', async () => {
    await expect(validateInput(createMockZambdaInput({ encounterIds: [UUID_A, 'nope'] }))).rejects.toThrow();
  });

  test('rejects an empty encounterIds array', async () => {
    await expect(validateInput(createMockZambdaInput({ encounterIds: [] }))).rejects.toThrow();
  });

  test('rejects itemsPerPage below 1', async () => {
    await expect(validateInput(createMockZambdaInput({ patientId: UUID_A, itemsPerPage: 0.5 }))).rejects.toThrow();
  });

  test('rejects a negative pageIndex', async () => {
    await expect(validateInput(createMockZambdaInput({ patientId: UUID_A, pageIndex: -1 }))).rejects.toThrow();
  });
});
