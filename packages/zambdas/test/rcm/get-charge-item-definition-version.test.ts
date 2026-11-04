import Oystehr from '@oystehr/sdk';
import type { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { CPT_CODE_SYSTEM, RCM_TAG_SYSTEM } from 'utils/lib/fhir/constants';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
}));

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

const mockOystehrClient = {
  fhir: {
    history: vi.fn(),
  },
};

const { index: handler } = (await import(
  '../../src/rcm/fee-schedules/get-charge-item-definition-version/index'
)) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

const RESOURCE_ID = '550e8400-e29b-41d4-a716-446655440000';
const VERSION_ID = 'b4ae842a-d549-4568-8cd5-c67327c487f6';

const makeInput = (body: Record<string, unknown>): ZambdaInput => ({
  headers: null,
  body: JSON.stringify(body),
  secrets: null,
});

const makeVersion = (kind: 'fee-schedule' | 'charge-master', versionId = VERSION_ID): ChargeItemDefinition => ({
  resourceType: 'ChargeItemDefinition',
  id: RESOURCE_ID,
  status: 'active',
  url: 'http://example.com',
  meta: {
    versionId,
    lastUpdated: '2026-04-09T14:30:03.048Z',
    tag: [
      { system: RCM_TAG_SYSTEM, code: 'rcm' },
      { system: RCM_TAG_SYSTEM, code: kind },
    ],
  },
  propertyGroup: [
    {
      priceComponent: [
        {
          type: 'base',
          code: { coding: [{ system: CPT_CODE_SYSTEM, code: '99213' }] },
          amount: { value: 100, currency: 'USD' },
        },
      ],
    },
  ],
});

describe('get-charge-item-definition-version handler', () => {
  beforeEach(() => {
    mockOystehrClient.fhir.history.mockReset();
  });

  it.each(['fee-schedule', 'charge-master'] as const)('returns exactly the requested version of a %s', async (kind) => {
    const version = makeVersion(kind);
    mockOystehrClient.fhir.history.mockResolvedValue(version);

    const result = await handler(makeInput({ resourceId: RESOURCE_ID, versionId: VERSION_ID }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(version);
    expect(mockOystehrClient.fhir.history).toHaveBeenCalledTimes(1);
    expect(mockOystehrClient.fhir.history).toHaveBeenCalledWith({
      resourceType: 'ChargeItemDefinition',
      id: RESOURCE_ID,
      versionId: VERSION_ID,
    });
  });

  it.each([
    ['a 404', () => new Oystehr.OystehrSdkError({ code: 404, message: 'not found' })],
    ['a 410', () => new Oystehr.OystehrSdkError({ code: 410, message: 'gone' })],
    [
      'a not-found OperationOutcome',
      () =>
        Object.assign(new Error('not found'), {
          cause: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] },
        }),
    ],
  ])('reports a missing version for %s', async (_label, makeError) => {
    mockOystehrClient.fhir.history.mockRejectedValue(makeError());

    await expect(handler(makeInput({ resourceId: RESOURCE_ID, versionId: VERSION_ID }))).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
      message: `Version ${VERSION_ID} of ChargeItemDefinition ${RESOURCE_ID} was not found`,
    });
  });

  it.each([
    ['another resource', { ...makeVersion('fee-schedule'), id: 'another-id' }],
    ['another version', makeVersion('fee-schedule', 'cc07e41f-5ce4-4005-95b2-272b80a66066')],
    ['another resource type', { resourceType: 'Patient', id: RESOURCE_ID, meta: { versionId: VERSION_ID } }],
  ])('reports a missing version when the server answers with %s', async (_label, answer) => {
    mockOystehrClient.fhir.history.mockResolvedValue(answer);

    await expect(handler(makeInput({ resourceId: RESOURCE_ID, versionId: VERSION_ID }))).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
  });

  it('rethrows other read failures unchanged', async () => {
    const failure = new Oystehr.OystehrSdkError({ code: 500, message: 'boom' });
    mockOystehrClient.fhir.history.mockRejectedValue(failure);

    await expect(handler(makeInput({ resourceId: RESOURCE_ID, versionId: VERSION_ID }))).rejects.toBe(failure);
  });

  it('rejects an invalid request before reading anything', async () => {
    await expect(handler(makeInput({ resourceId: RESOURCE_ID }))).rejects.toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
    });
    expect(mockOystehrClient.fhir.history).not.toHaveBeenCalled();
  });
});
