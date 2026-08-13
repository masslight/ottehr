import Oystehr from '@oystehr/sdk';
import {
  Claim,
  ClaimResponse,
  ClaimResponseItemAdjudication,
  Coverage,
  Organization,
  Patient,
  PaymentReconciliation,
} from 'fhir/r4b';
import { FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
  ADJUDICATION_CODES,
  fetchClaimResponsesByPaymentReconciliations,
  OYSTEHR_ADJUDICATION_SYSTEM,
  X12_ADJUSTMENT_GROUP_SYSTEM,
} from '../../../src/billing/claim-amounts';
import { performEffect } from '../../../src/billing/get-billing-era-detail';
import {
  ERA_CHECK_SYSTEM,
  ERA_ICN_EXTENSION,
  ERA_ITEM_PROCEDURE_CODE_EXTENSION,
  ERA_PCN_EXTENSION,
  ERA_STATUS_CODE_EXTENSION,
  resolvePayersByRef,
} from '../../../src/billing/shared';

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
  charge?: number;
}): ClaimResponseItemAdjudication[] => {
  const list: ClaimResponseItemAdjudication[] = [
    {
      category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: ADJUDICATION_CODES.PAID }] },
      amount: { value: parts.paid, currency: 'USD' },
    },
  ];
  if (parts.charge !== undefined) {
    list.push({
      category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: ADJUDICATION_CODES.CHARGE }] },
      amount: { value: parts.charge, currency: 'USD' },
    });
  }
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

const eraItem = (
  sequence: number,
  procedureCode: string,
  amounts: Parameters<typeof adjudications>[0]
): NonNullable<ClaimResponse['item']>[number] => ({
  itemSequence: sequence,
  adjudication: adjudications(amounts),
  extension: [{ url: ERA_ITEM_PROCEDURE_CODE_EXTENSION, valueString: procedureCode }],
});

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
  // matching strips the contained resources; the era-* extensions are all that is left
  request: { reference: 'Claim/c1' },
  extension: [
    { url: ERA_STATUS_CODE_EXTENSION, valueString: statusCode },
    { url: ERA_PCN_EXTENSION, valueString: 'ECHOED-PCN' },
    { url: ERA_ICN_EXTENSION, valueString: `ICN-${id}` },
  ],
  item: [eraItem(1, '99213', amounts)],
});

// The unmatched shape: contained Claim carrying no items, plus the billing provider (payee) and
// the patient the payer named.
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
  extension: [
    { url: ERA_STATUS_CODE_EXTENSION, valueString: '4' },
    { url: ERA_PCN_EXTENSION, valueString: 'ACC-7' },
    { url: ERA_ICN_EXTENSION, valueString: 'ICN-cr-2' },
  ],
  contained: [
    {
      resourceType: 'Claim',
      id: 'request',
      status: 'active',
      created: '2026-06-30',
      use: 'claim',
      type: { coding: [] },
      priority: { coding: [] },
      patient: { reference: '#patient' },
      provider: { reference: '#billing-provider' },
      insurance: [],
    } as Claim,
    {
      resourceType: 'Patient',
      id: 'patient',
      name: [{ family: 'Smith', given: ['Riley'] }],
    } as Patient,
    {
      resourceType: 'Organization',
      id: 'billing-provider',
      identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1871112375' }],
    } as Organization,
    {
      resourceType: 'Coverage',
      id: 'coverage',
      status: 'active',
      subscriber: { reference: '#subscriber' },
      beneficiary: { reference: '#patient' },
      payor: [{ display: 'Acme' }],
    } as Coverage,
    // NM1*IL: the payer names the insured with the NM109 member id
    {
      resourceType: 'Patient',
      id: 'subscriber',
      identifier: [{ type: { coding: [{ code: 'MB' }] }, value: 'MBR-777' }],
    } as Patient,
  ],
  item: [eraItem(1, '87880', { paid: 0, pr: ['3', 25], charge: 570 })],
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
  insurance: [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/cov-1' } }],
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
  birthDate: '2008-06-07',
};

const coverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-1',
  status: 'active',
  subscriberId: '999000111',
  beneficiary: { reference: 'Patient/p1' },
  payor: [{ display: 'Acme' }],
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
      search: vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) =>
        Promise.resolve({
          unbundle: () => (resourceType === 'Coverage' ? [coverage] : [submittedClaim, patient]),
          link: [],
        })
      ),
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
      // BPR04 is not preserved, and the trace number's system says nothing about it
      paymentMethod: '',
      totalClaims: 2,
      matchedClaims: 1,
      unmatchedClaims: 1,
      // taken off the unmatched remit's contained billing provider
      payee: { name: '', npi: '1871112375', taxId: '' },
    });
    expect(response.claims).toHaveLength(2);

    // matched row: one row per claim, remits ordered oldest -> newest
    const matched = response.claims.find((claim) => claim.claimId === 'c1');
    expect(matched).toBeDefined();
    expect(matched).toMatchObject({
      matched: true,
      patientName: 'Doe, Jane',
      patientDob: '2008-06-07',
      dos: '2026-07-09',
      billed: 100,
      // the CLP01 the payer echoed, not our own claim's PCN
      patientAccountNumber: 'ECHOED-PCN',
      // the focal coverage's subscriber id
      memberId: '999000111',
    });
    expect(matched?.remits.map((remit) => remit.claimResponseId)).toEqual(['cr-1', 'cr-1r']);
    expect(matched?.claimResponseIds).toEqual(['cr-1', 'cr-1r']);
    expect(matched?.remits[0]).toMatchObject({
      eraStatusCode: '1',
      payerClaimControlNumber: 'ICN-cr-1',
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

    // unmatched row: patient and claim date come from the contained resources, the line's own
    // identity from the remit extensions
    const unmatched = response.claims.find((claim) => !claim.matched);
    expect(unmatched).toMatchObject({
      claimId: 'unmatched-cr-2',
      patientName: 'Smith, Riley',
      patientAccountNumber: 'ACC-7',
      // the contained claim carries no total, so billed is the charge the payer reported
      billed: 570,
      // NM109 from the contained subscriber resource
      memberId: 'MBR-777',
      // the converter writes no birth date on the contained patient
      patientDob: '',
    });
    expect(unmatched?.remits).toHaveLength(1);
    expect(unmatched?.remits[0]).toMatchObject({ eraStatusCode: '4', payerClaimControlNumber: 'ICN-cr-2' });
    expect(unmatched?.remits[0].serviceLines[0]).toMatchObject({
      cptCode: '87880',
      serviceDate: '2026-06-30',
      copay: 25,
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
