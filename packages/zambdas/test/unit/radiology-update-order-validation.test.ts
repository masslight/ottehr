import { describe, expect, test } from 'vitest';
import { validateInput } from '../../src/ehr/radiology/update-order/validation';
import { ZambdaInput } from '../../src/shared/types/common';

const createMockZambdaInput = (body: any): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: {
    Authorization: 'Bearer test-token',
  },
  secrets: null,
});

const validOrder = {
  diagnosisCodes: ['W21.89XA'],
  cptCode: '73562',
  lateralityModifier: undefined,
  stat: false,
  clinicalHistory: 'Took an arrow to the knee',
  consentObtained: true,
  external: true,
  performingOrganization: { name: 'Test Imaging Center' },
  timeWindow: 'Please perform within 4 hours',
  safetyFlags: ['metal', 'pacemaker'],
};

const contentUpdate = (order: Record<string, unknown> = validOrder): Record<string, unknown> => ({
  serviceRequestId: 'sr-1',
  update: { type: 'content', order },
});

describe('Radiology update-order - validateInput', () => {
  test('accepts a consent patch', async () => {
    const result = await validateInput(
      createMockZambdaInput({ serviceRequestId: 'sr-1', update: { type: 'consent', consentObtained: true } })
    );

    expect(result.body.serviceRequestId).toBe('sr-1');
    expect(result.body.update).toEqual({ type: 'consent', consentObtained: true });
    expect(result.callerAccessToken).toBe('test-token');
  });

  test('accepts a performed-by patch', async () => {
    const result = await validateInput(
      createMockZambdaInput({ serviceRequestId: 'sr-1', update: { type: 'performed-by', performedById: 'prac-1' } })
    );

    expect(result.body.update).toEqual({ type: 'performed-by', performedById: 'prac-1' });
  });

  test('accepts a full content payload and returns it typed (no cast)', async () => {
    const result = await validateInput(createMockZambdaInput(contentUpdate()));

    if (result.body.update.type !== 'content') throw new Error('expected a content update');
    expect(result.body.update.order.cptCode).toBe('73562');
    expect(result.body.update.order.safetyFlags).toEqual(['metal', 'pacemaker']);
  });

  test('rejects a missing serviceRequestId', async () => {
    await expect(
      validateInput(createMockZambdaInput({ update: { type: 'consent', consentObtained: true } }))
    ).rejects.toThrow();
  });

  test('rejects an empty serviceRequestId', async () => {
    await expect(
      validateInput(createMockZambdaInput({ serviceRequestId: '', update: { type: 'consent', consentObtained: true } }))
    ).rejects.toThrow();
  });

  // The union is what buys this: an omitted field can no longer be read as "nothing to change".
  test('rejects an update with no type', async () => {
    await expect(
      validateInput(createMockZambdaInput({ serviceRequestId: 'sr-1', update: { consentObtained: true } }))
    ).rejects.toThrow();
  });

  test('rejects an unknown update type', async () => {
    await expect(
      validateInput(createMockZambdaInput({ serviceRequestId: 'sr-1', update: { type: 'colour', colour: 'blue' } }))
    ).rejects.toThrow();
  });

  test('rejects a consent patch with no consentObtained', async () => {
    await expect(
      validateInput(createMockZambdaInput({ serviceRequestId: 'sr-1', update: { type: 'consent' } }))
    ).rejects.toThrow();
  });

  test('rejects a non-boolean consentObtained', async () => {
    await expect(
      validateInput(
        createMockZambdaInput({ serviceRequestId: 'sr-1', update: { type: 'consent', consentObtained: 'yes' } })
      )
    ).rejects.toThrow();
  });

  test('rejects a performed-by patch with an empty performedById', async () => {
    await expect(
      validateInput(
        createMockZambdaInput({ serviceRequestId: 'sr-1', update: { type: 'performed-by', performedById: '' } })
      )
    ).rejects.toThrow();
  });

  test('rejects an order that is not an object', async () => {
    await expect(validateInput(createMockZambdaInput(contentUpdate([] as any)))).rejects.toThrow();
  });

  test('rejects an unknown safety flag', async () => {
    await expect(
      validateInput(createMockZambdaInput(contentUpdate({ ...validOrder, safetyFlags: ['wormhole'] })))
    ).rejects.toThrow();
  });

  test('rejects a clinical history over 255 characters', async () => {
    await expect(
      validateInput(createMockZambdaInput(contentUpdate({ ...validOrder, clinicalHistory: 'x'.repeat(256) })))
    ).rejects.toThrow();
  });
});
