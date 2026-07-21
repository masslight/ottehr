import { describe, expect, test } from 'vitest';
import { validateInput } from '../../src/ehr/radiology/update-order/validation';
import { ZambdaInput } from '../../src/shared';

const createMockZambdaInput = (body: any): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: {
    Authorization: 'Bearer test-token',
  },
  secrets: null,
});

const validEdit = {
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

describe('Radiology update-order - validateInput', () => {
  test('accepts a consent-only patch (no edit payload)', async () => {
    const result = await validateInput(createMockZambdaInput({ serviceRequestId: 'sr-1', consentObtained: true }));

    expect(result.body.serviceRequestId).toBe('sr-1');
    expect(result.body.consentObtained).toBe(true);
    expect(result.body.edit).toBeUndefined();
    expect(result.callerAccessToken).toBe('test-token');
  });

  test('accepts a full edit payload and returns it typed (no cast)', async () => {
    const result = await validateInput(
      createMockZambdaInput({ serviceRequestId: 'sr-1', consentObtained: true, edit: validEdit })
    );

    expect(result.body.edit?.cptCode).toBe('73562');
    expect(result.body.edit?.safetyFlags).toEqual(['metal', 'pacemaker']);
  });

  test('rejects a missing serviceRequestId', async () => {
    await expect(validateInput(createMockZambdaInput({ consentObtained: true }))).rejects.toThrow();
  });

  test('rejects an empty serviceRequestId', async () => {
    await expect(
      validateInput(createMockZambdaInput({ serviceRequestId: '', consentObtained: true }))
    ).rejects.toThrow();
  });

  test('rejects a non-boolean consentObtained', async () => {
    await expect(
      validateInput(createMockZambdaInput({ serviceRequestId: 'sr-1', consentObtained: 'yes' }))
    ).rejects.toThrow();
  });

  test('rejects an edit that is not an object', async () => {
    await expect(
      validateInput(createMockZambdaInput({ serviceRequestId: 'sr-1', consentObtained: true, edit: [] }))
    ).rejects.toThrow();
  });

  test('rejects an unknown safety flag', async () => {
    await expect(
      validateInput(
        createMockZambdaInput({
          serviceRequestId: 'sr-1',
          consentObtained: true,
          edit: { ...validEdit, safetyFlags: ['wormhole'] },
        })
      )
    ).rejects.toThrow();
  });

  test('rejects a clinical history over 255 characters', async () => {
    await expect(
      validateInput(
        createMockZambdaInput({
          serviceRequestId: 'sr-1',
          consentObtained: true,
          edit: { ...validEdit, clinicalHistory: 'x'.repeat(256) },
        })
      )
    ).rejects.toThrow();
  });
});
