import type { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../src/rcm/fee-schedules/bulk-add-procedure-codes/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

function beforeEachClearMocks(): void {
  mockOystehrClient.fhir.get.mockReset();
  mockOystehrClient.fhir.update.mockReset();
}

// ---------------------------------------------------------------------------
// validateRequestParameters
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeInput(body: Record<string, unknown>): ZambdaInput {
  return { headers: null, body: JSON.stringify(body), secrets: null };
}

describe('bulk-add-procedure-codes validateRequestParameters', () => {
  it('returns validated params', () => {
    const result = validateRequestParameters(
      makeInput({
        feeScheduleId: VALID_UUID,
        codes: [{ code: '99213', amount: 100 }],
        replaceAll: true,
      })
    );
    expect(result).toMatchObject({
      feeScheduleId: VALID_UUID,
      codes: [{ code: '99213', amount: 100 }],
      replaceAll: true,
    });
  });

  it('throws when body is missing', () => {
    expect(() => validateRequestParameters({ headers: null, body: null, secrets: null })).toThrow();
  });

  it('throws when feeScheduleId is missing', () => {
    expect(() => validateRequestParameters(makeInput({ codes: [{ code: '99213', amount: 100 }] }))).toThrow(
      /feeScheduleId/
    );
  });

  it('throws when codes is empty', () => {
    expect(() => validateRequestParameters(makeInput({ feeScheduleId: VALID_UUID, codes: [] }))).toThrow();
  });

  it('throws when codes is not an array', () => {
    expect(() => validateRequestParameters(makeInput({ feeScheduleId: VALID_UUID, codes: 'not-array' }))).toThrow();
  });

  it('throws when a row has invalid amount', () => {
    expect(() =>
      validateRequestParameters(makeInput({ feeScheduleId: VALID_UUID, codes: [{ code: '99213', amount: 'abc' }] }))
    ).toThrow();
  });

  it('defaults replaceAll to false when omitted', () => {
    const result = validateRequestParameters(
      makeInput({ feeScheduleId: VALID_UUID, codes: [{ code: '99213', amount: 100 }] })
    );
    expect(result.replaceAll).toBe(false);
  });

  it('normalizes falsy modifier to undefined', () => {
    const result = validateRequestParameters(
      makeInput({
        feeScheduleId: VALID_UUID,
        codes: [{ code: '99213', amount: 100, modifier: '' }],
      })
    );
    expect(result.codes[0].modifier).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// index handler — replaceAll vs append
// ---------------------------------------------------------------------------

function makePropertyGroup(code: string, modifier?: string, amount = 100): ChargeItemDefinition['propertyGroup'] {
  return [
    {
      priceComponent: [
        {
          type: 'base' as const,
          code: { coding: [{ system: CPT_CODE_SYSTEM, code }] },
          amount: { value: amount, currency: 'USD' },
          ...(modifier ? { extension: [{ url: CPT_MODIFIER_EXTENSION_URL, valueCode: modifier }] } : {}),
        },
      ],
    },
  ];
}

const fakeExisting = (propertyGroup: ChargeItemDefinition['propertyGroup']): ChargeItemDefinition =>
  ({
    resourceType: 'ChargeItemDefinition',
    id: VALID_UUID,
    status: 'active',
    url: 'http://example.com',
    propertyGroup: propertyGroup || [],
  }) as ChargeItemDefinition;

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

const mockOystehrClient = {
  fhir: {
    get: vi.fn(),
    update: vi.fn(),
  },
};

const { index: handler } = (await import('../../src/rcm/fee-schedules/bulk-add-procedure-codes/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

describe('bulk-add-procedure-codes handler', () => {
  it('replaces all propertyGroups when replaceAll is true', async () => {
    beforeEachClearMocks();
    mockOystehrClient.fhir.get.mockResolvedValue(fakeExisting(makePropertyGroup('99213')));
    mockOystehrClient.fhir.update.mockImplementation(async (resource: ChargeItemDefinition) => resource);

    const result = await handler(
      makeInput({
        feeScheduleId: VALID_UUID,
        codes: [{ code: '99214', amount: 200 }],
        replaceAll: true,
      })
    );
    expect(result.statusCode).toBe(200);
    const updated = mockOystehrClient.fhir.update.mock.calls[0][0] as ChargeItemDefinition;
    expect(updated.propertyGroup).toHaveLength(1);
    expect(updated.propertyGroup![0].priceComponent![0].code!.coding![0].code).toBe('99214');
  });

  it('appends to existing propertyGroups when replaceAll is false', async () => {
    beforeEachClearMocks();
    mockOystehrClient.fhir.get.mockResolvedValue(fakeExisting(makePropertyGroup('99213')));
    mockOystehrClient.fhir.update.mockImplementation(async (resource: ChargeItemDefinition) => resource);

    const result = await handler(
      makeInput({
        feeScheduleId: VALID_UUID,
        codes: [{ code: '99214', amount: 200 }],
        replaceAll: false,
      })
    );
    expect(result.statusCode).toBe(200);
    const updated = mockOystehrClient.fhir.update.mock.calls[0][0] as ChargeItemDefinition;
    expect(updated.propertyGroup).toHaveLength(2);
  });

  it('handles empty existing propertyGroup with append', async () => {
    beforeEachClearMocks();
    mockOystehrClient.fhir.get.mockResolvedValue(fakeExisting(undefined));
    mockOystehrClient.fhir.update.mockImplementation(async (resource: ChargeItemDefinition) => resource);

    const result = await handler(
      makeInput({
        feeScheduleId: VALID_UUID,
        codes: [{ code: '99213', amount: 100 }],
        replaceAll: false,
      })
    );
    expect(result.statusCode).toBe(200);
    const updated = mockOystehrClient.fhir.update.mock.calls[0][0] as ChargeItemDefinition;
    expect(updated.propertyGroup).toHaveLength(1);
  });

  it('adds modifier extensions when modifier is provided', async () => {
    beforeEachClearMocks();
    mockOystehrClient.fhir.get.mockResolvedValue(fakeExisting([]));
    mockOystehrClient.fhir.update.mockImplementation(async (resource: ChargeItemDefinition) => resource);

    await handler(
      makeInput({
        feeScheduleId: VALID_UUID,
        codes: [{ code: '99213', modifier: '25', amount: 100 }],
        replaceAll: true,
      })
    );
    const updated = mockOystehrClient.fhir.update.mock.calls[0][0] as ChargeItemDefinition;
    const ext = updated.propertyGroup![0].priceComponent![0].extension;
    expect(ext).toHaveLength(1);
    expect(ext![0]).toMatchObject({ url: CPT_MODIFIER_EXTENSION_URL, valueCode: '25' });
  });

  it('omits extension when modifier is absent', async () => {
    beforeEachClearMocks();
    mockOystehrClient.fhir.get.mockResolvedValue(fakeExisting([]));
    mockOystehrClient.fhir.update.mockImplementation(async (resource: ChargeItemDefinition) => resource);

    await handler(
      makeInput({
        feeScheduleId: VALID_UUID,
        codes: [{ code: '99213', amount: 100 }],
        replaceAll: true,
      })
    );
    const updated = mockOystehrClient.fhir.update.mock.calls[0][0] as ChargeItemDefinition;
    const pc = updated.propertyGroup![0].priceComponent![0];
    expect(pc.extension).toBeUndefined();
  });
});
