import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim } from 'fhir/r4b';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../../src/shared/types/common';

// Runs the real wrapHandler, so these tests assert the HTTP response the caller gets rather than what
// performEffect throws. The exported `index` is typed as an AWS 3-arg Handler; cast to the shape used here.
type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr } = vi.hoisted(() => ({
  mockOystehr: { fhir: { search: vi.fn(), create: vi.fn(), transaction: vi.fn() } },
}));

vi.mock('@sentry/node-core/light', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  init: vi.fn(),
  isInitialized: vi.fn(() => true),
  setTag: vi.fn(),
  setTags: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock('../../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m-token'),
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createBillingClient: vi.fn(() => mockOystehr),
}));

vi.mock('../../../src/billing/provenance', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveClaimActor: vi.fn().mockResolvedValue({ who: { reference: 'Practitioner/test-user' } }),
}));

import { index as rawIndex } from '../../../src/billing/update-billing-claim/index';

const index = rawIndex as unknown as ZambdaHandler;

const CLAIM_ID = '5f2b8c9e-1a3d-4e6f-8a7b-9c0d1e2f3a4b';

const claim: Claim = {
  resourceType: 'Claim',
  id: CLAIM_ID,
  status: 'draft',
  type: { coding: [{ code: 'institutional' }] },
  use: 'claim',
  created: '2026-01-01',
  patient: { reference: 'Patient/p' },
  provider: { display: 'Unknown' },
  priority: { coding: [{ code: 'normal' }] },
  insurance: [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/cov-1' } }],
};

const input: ZambdaInput = {
  headers: { Authorization: 'Bearer user-token' },
  body: JSON.stringify({
    resourceType: 'Claim',
    resourceId: CLAIM_ID,
    claimId: CLAIM_ID,
    fields: { admissionDate: '2026-01-01T10:00:00.000Z', dischargeDate: '2026-01-02T10:00:00.000Z' },
  }),
  secrets: { ENVIRONMENT: 'local' },
};

const fhirError = (code: number, issue: object[]): Error =>
  new Oystehr.OystehrFHIRError({ code, error: { resourceType: 'OperationOutcome', issue } as any });

describe('update-billing-claim handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => [structuredClone(claim)] });
  });

  it('returns 200 when the claim is saved', async () => {
    mockOystehr.fhir.transaction.mockResolvedValue({ entry: [] });

    const result = await index(input);

    expect(result.statusCode).toBe(200);
  });

  it.each([400, 422])('returns a FHIR %i validation failure as a 422 carrying its details', async (status) => {
    mockOystehr.fhir.transaction.mockRejectedValue(
      fhirError(status, [
        {
          severity: 'error',
          code: 'invariant',
          details: { text: 'Constraint per-1 violated' },
          expression: ['Claim.billablePeriod'],
        },
      ])
    );

    const result = await index(input);

    expect(result.statusCode).toBe(422);
    expect(JSON.parse(result.body)).toEqual({
      code: APIErrorCode.FHIR_RESOURCE_VALIDATION_ERROR,
      message: 'FHIR validation failed: Constraint per-1 violated (Claim.billablePeriod)',
    });
  });

  it('keeps returning 500 for a FHIR server error', async () => {
    mockOystehr.fhir.transaction.mockRejectedValue(fhirError(500, [{ severity: 'error', code: 'exception' }]));

    const result = await index(input);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal error' });
  });

  it('keeps returning 500 for an unrelated error', async () => {
    mockOystehr.fhir.transaction.mockRejectedValue(new Error('boom'));

    const result = await index(input);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal error' });
  });
});
