import Oystehr from '@oystehr/sdk';
import {
  Claim,
  ClaimResponse,
  ClaimResponseItemAdjudication,
  Organization,
  Patient,
  PaymentReconciliation,
} from 'fhir/r4b';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
  ADJUDICATION_CODES,
  fetchClaimResponsesByPaymentReconciliations,
  OYSTEHR_ADJUDICATION_SYSTEM,
  X12_ADJUSTMENT_GROUP_SYSTEM,
} from '../../../src/billing/claim-amounts';
import { performEffect } from '../../../src/billing/get-billing-era-detail';
import { ERA_CHECK_SYSTEM, ERA_STATUS_CODE_EXTENSION, resolvePayersByRef } from '../../../src/billing/shared';

vi.mock('../../../src/billing/claim-amounts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchClaimResponsesByPaymentReconciliations: vi.fn(),
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolvePayersByRef: vi.fn(),
}));

const PAYER_REF = 'https://rcm.example.com/payer/123';

const paymentReconciliation: PaymentReconciliation = {
  resourceType: 'PaymentReconciliation',
  id: 'era-1',
  status: 'active',
  created: '2026-07-20T10:00:00Z',
  paymentDate: '2026-07-18',
  paymentAmount: { value: 60, currency: 'USD' },
  identifier: [{ system: ERA_CHECK_SYSTEM, value: 'CHK-100' }],
  paymentIdentifier: { system: ERA_CHECK_SYSTEM, value: 'CHK-100' },
  outcome: 'complete',
};

const adjudications = (parts: {
  paid: number;
  allowed?: number;
  pr?: [string, number];
}): ClaimResponseItemAdjudication[] => {
  const list: ClaimResponseItemAdjudication[] = [
    {
      category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: ADJUDICATION_CODES.PAID }] },
      amount: { value: parts.paid, currency: 'USD' },
    },
  ];
  if (parts.allowed !== undefined) {
    list.push({
      category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: ADJUDICATION_CODES.ALLOWED }] },
      amount: { value: parts.allowed, currency: 'USD' },
    });
  }
  if (parts.pr) {
    list.push({
      category: { coding: [{ system: X12_ADJUSTMENT_GROUP_SYSTEM, code: 'PR' }] },
      reason: { coding: [{ system: 'https://x12.org/codes/claim-adjustment-reason-codes', code: parts.pr[0] }] },
      amount: { value: parts.pr[1], currency: 'USD' },
    });
  }
  return list;
};

const matchedResponse = (
  id: string,
  created: string,
  statusCode: string,
  amounts: Parameters<typeof adjudications>[0]
): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  id,
  status: 'active',
  type: { coding: [{ code: 'professional' }] },
  use: 'claim',
  patient: { reference: 'Patient/p1' },
  created,
  insurer: { reference: PAYER_REF, display: 'Acme' },
  outcome: 'complete',
  request: { reference: 'Claim/c1' },
  extension: [{ url: ERA_STATUS_CODE_EXTENSION, valueString: statusCode }],
  item: [{ itemSequence: 1, adjudication: adjudications(amounts) }],
});

const unmatchedResponse: ClaimResponse = {
  resourceType: 'ClaimResponse',
  id: 'cr-2',
  status: 'active',
  type: { coding: [{ code: 'professional' }] },
  use: 'claim',
  patient: { reference: '#patient' },
  created: '2026-07-17',
  insurer: { display: 'Acme' },
  outcome: 'queued',
  request: { reference: '#request' },
  contained: [
    {
      resourceType: 'Claim',
      id: 'request',
      status: 'active',
      created: '2026-07-01',
      use: 'claim',
      type: { coding: [] },
      priority: { coding: [] },
      patient: { reference: '#patient' },
      provider: { display: 'Someone' },
      insurance: [],
      identifier: [{ value: 'ACC-7' }],
      item: [
        {
          sequence: 1,
          productOrService: { coding: [{ code: '99213' }] },
          servicedPeriod: { start: '2026-06-30' },
          net: { value: 80, currency: 'USD' },
        },
      ],
    } as Claim,
    {
      resourceType: 'Patient',
      id: 'patient',
      name: [{ family: 'Smith', given: ['Riley'] }],
    } as Patient,
  ],
  item: [{ itemSequence: 1, adjudication: adjudications({ paid: 0, pr: ['3', 25] }) }],
};

const submittedClaim: Claim = {
  resourceType: 'Claim',
  id: 'c1',
  status: 'active',
  created: '2026-07-10',
  use: 'claim',
  type: { coding: [] },
  priority: { coding: [] },
  patient: { reference: 'Patient/p1' },
  provider: { reference: 'Organization/prov-1' },
  insurance: [],
  total: { value: 100, currency: 'USD' },
  item: [
    {
      sequence: 1,
      productOrService: { coding: [{ code: '99213' }] },
      servicedPeriod: { start: '2026-07-09', end: '2026-07-09' },
      net: { value: 100, currency: 'USD' },
    },
  ],
} as Claim;

const patient: Patient = {
  resourceType: 'Patient',
  id: 'p1',
  name: [{ family: 'Doe', given: ['Jane'] }],
};

const makeEraReadClient = (): Oystehr =>
  ({
    fhir: {
      search: vi.fn().mockResolvedValue({
        unbundle: () => [paymentReconciliation],
        link: [],
      }),
      get: vi.fn(),
    },
  }) as unknown as Oystehr;

const makeBillingClient = (): Oystehr =>
  ({
    fhir: {
      search: vi.fn().mockResolvedValue({
        unbundle: () => [submittedClaim, patient],
        link: [],
      }),
    },
  }) as unknown as Oystehr;

describe('get-billing-era-detail performEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (resolvePayersByRef as Mock).mockResolvedValue(
      new Map<string, Organization>([
        [PAYER_REF, { resourceType: 'Organization', id: 'org-9', name: 'Acme Insurance' }],
      ])
    );
  });

  it('returns full remit detail nested under each claim row', async () => {
    (fetchClaimResponsesByPaymentReconciliations as Mock).mockResolvedValue(
      new Map([
        [
          'era-1',
          [
            matchedResponse('cr-1r', '2026-07-16', '22', { paid: -60, pr: ['1', -20] }),
            matchedResponse('cr-1', '2026-07-15', '1', { paid: 60, allowed: 80, pr: ['1', 20] }),
            unmatchedResponse,
          ],
        ],
      ])
    );

    const response = await performEffect(makeBillingClient(), makeEraReadClient(), { eraId: 'era-1', secrets: null });

    // header — pre-existing fields unchanged, new fields populated
    expect(response).toMatchObject({
      id: 'era-1',
      checkNumber: 'CHK-100',
      checkDate: '2026-07-18',
      createdDate: '2026-07-20T10:00:00Z',
      checkAmount: 60,
      payerName: 'Acme Insurance',
      payerFhirId: 'org-9',
      status: 'complete',
      paymentMethod: 'CHK',
      totalClaims: 2,
      matchedClaims: 1,
      unmatchedClaims: 1,
      payee: null,
    });
    expect(response.claims).toHaveLength(2);

    // matched row: one row per claim, remits ordered oldest -> newest
    const matched = response.claims.find((claim) => claim.claimId === 'c1');
    expect(matched).toBeDefined();
    expect(matched).toMatchObject({
      matched: true,
      patientName: 'Doe, Jane',
      dos: '2026-07-09',
      billed: 100,
      patientAccountNumber: 'c1',
    });
    expect(matched?.remits.map((remit) => remit.claimResponseId)).toEqual(['cr-1', 'cr-1r']);
    expect(matched?.claimResponseIds).toEqual(['cr-1', 'cr-1r']);
    expect(matched?.remits[0]).toMatchObject({
      eraStatusCode: '1',
      paid: 60,
      allowed: 80,
      patientResp: 20,
    });
    expect(matched?.remits[0].serviceLines[0]).toMatchObject({
      cptCode: '99213',
      serviceDate: '2026-07-09',
      deductible: 20,
      paid: 60,
    });
    expect(matched?.remits[1]).toMatchObject({ eraStatusCode: '22', paid: -60 });

    // unmatched row: joined from the contained claim/patient, identifier-only account number
    const unmatched = response.claims.find((claim) => !claim.matched);
    expect(unmatched).toMatchObject({
      claimId: 'unmatched-cr-2',
      patientName: 'Smith, Riley',
      patientAccountNumber: 'ACC-7',
    });
    expect(unmatched?.remits).toHaveLength(1);
    expect(unmatched?.remits[0].serviceLines[0]).toMatchObject({
      cptCode: '99213',
      serviceDate: '2026-06-30',
      copay: 25,
      billed: 80,
    });
  });

  it('throws when the PaymentReconciliation does not exist', async () => {
    const eraReadClient = {
      fhir: {
        search: vi.fn().mockResolvedValue({ unbundle: () => [], link: [] }),
      },
    } as unknown as Oystehr;
    await expect(
      performEffect(makeBillingClient(), eraReadClient, { eraId: 'missing', secrets: null })
    ).rejects.toThrow();
  });
});
