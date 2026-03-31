import type { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../src/rcm/fee-schedules/add-procedure-code/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

// ---------------------------------------------------------------------------
// validateRequestParameters
// ---------------------------------------------------------------------------

function makeInput(body: Record<string, unknown>): ZambdaInput {
  return { headers: null, body: JSON.stringify(body), secrets: null };
}

describe('add-procedure-code validateRequestParameters', () => {
  it('returns validated params for valid input', () => {
    const result = validateRequestParameters(makeInput({ feeScheduleId: 'fs-1', code: '99213', amount: 150 }));
    expect(result).toMatchObject({ feeScheduleId: 'fs-1', code: '99213', amount: 150 });
  });

  it('throws when body is missing', () => {
    expect(() => validateRequestParameters({ headers: null, body: null, secrets: null })).toThrow(
      'The request was missing a required request body'
    );
  });

  it('throws when feeScheduleId is missing', () => {
    expect(() => validateRequestParameters(makeInput({ code: '99213', amount: 150 }))).toThrow('feeScheduleId');
  });

  it('throws when code is missing', () => {
    expect(() => validateRequestParameters(makeInput({ feeScheduleId: 'fs-1', amount: 150 }))).toThrow('code');
  });

  it('throws when amount is not a number', () => {
    expect(() => validateRequestParameters(makeInput({ feeScheduleId: 'fs-1', code: '99213', amount: 'abc' }))).toThrow(
      'amount'
    );
  });

  it('passes through optional modifier and description', () => {
    const result = validateRequestParameters(
      makeInput({ feeScheduleId: 'fs-1', code: '99213', amount: 100, modifier: '25', description: 'Office visit' })
    );
    expect(result.modifier).toBe('25');
    expect(result.description).toBe('Office visit');
  });

  it('normalizes falsy modifier/description to undefined', () => {
    const result = validateRequestParameters(
      makeInput({ feeScheduleId: 'fs-1', code: '99213', amount: 100, modifier: '', description: '' })
    );
    expect(result.modifier).toBeUndefined();
    expect(result.description).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// index handler — duplicate detection
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
    id: 'fs-1',
    status: 'active',
    url: 'http://example.com',
    propertyGroup: propertyGroup || [],
  }) as ChargeItemDefinition;

// We test the handler logic by mocking the shared helpers and oystehr client
vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

const mockOystehrClient = {
  fhir: {
    get: vi.fn(),
    update: vi.fn(),
  },
};

// Import handler AFTER mocks are set up — cast away Lambda wrapper types since wrapHandler mock unwraps them
const { index: handler } = (await import('../../src/rcm/fee-schedules/add-procedure-code/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

describe('add-procedure-code handler', () => {
  it('rejects duplicate code (no modifier)', async () => {
    mockOystehrClient.fhir.get.mockResolvedValue(fakeExisting(makePropertyGroup('99213')));
    const result = await handler(makeInput({ feeScheduleId: 'fs-1', code: '99213', amount: 200 }));
    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).message).toContain('already exists');
    expect(mockOystehrClient.fhir.update).not.toHaveBeenCalled();
  });

  it('rejects duplicate code+modifier', async () => {
    mockOystehrClient.fhir.get.mockResolvedValue(fakeExisting(makePropertyGroup('99213', '25')));
    const result = await handler(makeInput({ feeScheduleId: 'fs-1', code: '99213', modifier: '25', amount: 200 }));
    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).message).toContain('modifier 25');
  });

  it('allows same code with different modifier', async () => {
    mockOystehrClient.fhir.get.mockResolvedValue(fakeExisting(makePropertyGroup('99213', '25')));
    mockOystehrClient.fhir.update.mockResolvedValue(fakeExisting([]));
    const result = await handler(makeInput({ feeScheduleId: 'fs-1', code: '99213', modifier: '26', amount: 200 }));
    expect(result.statusCode).toBe(200);
    expect(mockOystehrClient.fhir.update).toHaveBeenCalled();
  });

  it('allows add when no existing codes', async () => {
    mockOystehrClient.fhir.get.mockResolvedValue(fakeExisting([]));
    mockOystehrClient.fhir.update.mockResolvedValue(fakeExisting(makePropertyGroup('99213')));
    const result = await handler(makeInput({ feeScheduleId: 'fs-1', code: '99213', amount: 100 }));
    expect(result.statusCode).toBe(200);
  });

  it('appends new propertyGroup to existing ones', async () => {
    mockOystehrClient.fhir.get.mockResolvedValue(fakeExisting(makePropertyGroup('99213')));
    mockOystehrClient.fhir.update.mockImplementation(async (resource: ChargeItemDefinition) => resource);
    const result = await handler(makeInput({ feeScheduleId: 'fs-1', code: '99214', amount: 200 }));
    expect(result.statusCode).toBe(200);
    const updated = mockOystehrClient.fhir.update.mock.calls[0][0] as ChargeItemDefinition;
    expect(updated.propertyGroup).toHaveLength(2);
  });

  it('handles existing resource with undefined propertyGroup', async () => {
    const noGroups = fakeExisting(undefined);
    mockOystehrClient.fhir.get.mockResolvedValue(noGroups);
    mockOystehrClient.fhir.update.mockImplementation(async (resource: ChargeItemDefinition) => resource);
    const result = await handler(makeInput({ feeScheduleId: 'fs-1', code: '99213', amount: 100 }));
    expect(result.statusCode).toBe(200);
  });
});
