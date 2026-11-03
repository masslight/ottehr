import { APIGatewayProxyResult } from 'aws-lambda';
import { ServiceRequest } from 'fhir/r4b';
import {
  makeReferralServiceRequest,
  REFERRAL_ORDER_TYPE_TAG_TOKEN,
  withReferralDetails,
} from 'utils/lib/fhir/referral';
import { ListReferralsOutput, REFERRAL_ROLES, ReferralStatus } from 'utils/lib/types/api/referrals/referrals.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr, mockRequireUserWithRole } = vi.hoisted(() => ({
  mockOystehr: { fhir: { get: vi.fn(), search: vi.fn() } },
  mockRequireUserWithRole: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/prac-1' }),
}));

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  requireUserWithRole: mockRequireUserWithRole,
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createClinicalOystehrClient: vi.fn(() => mockOystehr),
}));

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

import { index as rawIndex } from '../../src/ehr/referrals/list-referrals';

const listReferrals = rawIndex as unknown as ZambdaHandler;

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const ENCOUNTER_ID = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-11-01T15:00:00.000Z';

const referralIn = (id: string, status: ReferralStatus): ServiceRequest => {
  const base = makeReferralServiceRequest(
    {
      patientId: PATIENT_ID,
      encounterId: ENCOUNTER_ID,
      specialty: 'Orthopedics',
      reason: 'Distal radius fracture',
      urgency: 'routine',
      whatIsAsked: 'evaluate-and-treat',
      whoSchedules: 'patient',
      responseRequested: false,
      includeDocuments: [],
    },
    {
      patientId: PATIENT_ID,
      encounterId: ENCOUNTER_ID,
      requester: { reference: 'Practitioner/prac-1', display: 'Jordan Rivera, MD' },
      now: NOW,
    }
  );
  return withReferralDetails({ ...base, id }, { status });
};

const stored: ServiceRequest[] = [
  referralIn('not-sent-1', 'not-sent'),
  referralIn('sent-1', 'sent'),
  referralIn('closed-1', 'closed'),
  referralIn('cancelled-1', 'cancelled'),
];

const run = async (body: Record<string, unknown>): Promise<APIGatewayProxyResult> =>
  listReferrals(createMockZambdaInput(body, { secrets: createMockSecrets() }));

describe('list-referrals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The referral search pages through fetchAllPages (no `next` link = one page); the recipients, tasks,
    // documents and encounters the DTOs load page through getAllFhirSearchPages (no match entries = done).
    mockOystehr.fhir.search.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
      unbundle: () => (resourceType === 'ServiceRequest' ? stored : []),
      entry: [],
    }));
  });

  it('leaves cancelled referrals off the list and returns the rest', async () => {
    const result = await run({ patientId: PATIENT_ID });

    expect(result.statusCode).toBe(200);
    const { referrals } = JSON.parse(result.body) as ListReferralsOutput;
    expect(referrals.map((referral) => referral.id)).not.toContain('cancelled-1');
    expect(referrals.map((referral) => [referral.id, referral.status]).sort()).toEqual([
      ['closed-1', 'closed'],
      ['not-sent-1', 'not-sent'],
      ['sent-1', 'sent'],
    ]);
  });

  it.each([
    ['patientId', PATIENT_ID, { name: 'subject', value: `Patient/${PATIENT_ID}` }],
    ['encounterId', ENCOUNTER_ID, { name: 'encounter', value: `Encounter/${ENCOUNTER_ID}` }],
  ])(
    'SECURITY: searches by the referral tag and the validated %s only, behind a referral role',
    async (key, id, scope) => {
      mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => [], entry: [] });

      // Anything else in the body is dropped by validation, not forwarded to the FHIR search.
      const result = await run({ [key]: id, _tag: 'anything', subject: 'Patient/someone-else' });

      expect(result.statusCode).toBe(200);
      expect(mockRequireUserWithRole).toHaveBeenCalledWith('test-token', expect.anything(), REFERRAL_ROLES);
      expect(mockOystehr.fhir.search).toHaveBeenCalledTimes(1);
      expect(mockOystehr.fhir.search).toHaveBeenCalledWith({
        resourceType: 'ServiceRequest',
        params: [
          { name: '_tag', value: REFERRAL_ORDER_TYPE_TAG_TOKEN },
          scope,
          { name: '_count', value: expect.any(String) },
          { name: '_offset', value: '0' },
        ],
      });
    }
  );

  it('refuses a request that names neither a patient nor a visit before searching', async () => {
    const result = await run({});

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.INVALID_INPUT);
    expect(mockOystehr.fhir.search).not.toHaveBeenCalled();
  });
});
