import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Claim, Encounter, FhirResource, PaymentNotice, PaymentReconciliation } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { Secrets } from 'utils/lib/secrets';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { APIErrorCode } from 'utils/lib/types/errors';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { claimHistoryEntries, provenanceChanges } from './claim-history-fixtures';

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  wrapHandler: (_name: string, handler: unknown) => handler,
}));

vi.mock('../../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m-token'),
  getUser: vi.fn(),
}));

vi.mock('../../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createClinicalOystehrClient: vi.fn(),
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createBillingClient: vi.fn(),
}));

vi.mock('../../../src/billing/provenance', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveClaimActor: vi.fn(async () => ({
    who: {
      reference: 'Device/system',
    },
  })),
}));

import { CHECK_NUMBER_IDENTIFIER_SYSTEM, MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM } from '../../../src/billing/payments';
import { index as _index } from '../../../src/billing/record-billing-manual-payment';
import { createBillingClient } from '../../../src/billing/shared';
import { getUser } from '../../../src/shared/auth';
import { createClinicalOystehrClient } from '../../../src/shared/helpers';
import { ZambdaInput } from '../../../src/shared/types/common';

const index = _index as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const CLAIM_ENC_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');
const ENCOUNTER_ID = randomUUID();
const OTHER_ENCOUNTER_ID = randomUUID();

const secrets: Secrets = {
  DEFAULT_BILLING_RESOURCE: 'Organization/default-bp',
};

const baseParams = {
  encounterId: ENCOUNTER_ID,
  amountInCents: 4000,
  paymentMethod: 'check',
  paymentDateISO: '2026-07-01T15:00:00Z',
  checkNumber: '1234',
  description: 'check copay',
  idempotencyKey: 'key-12345678',
};

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  status: 'finished',
  class: { code: 'AMB' },
};

const claimWithProvider: Claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  status: 'active',
  type: {},
  use: 'claim',
  created: '2026-07-01',
  patient: { reference: 'Patient/p-1' },
  priority: {},
  insurance: [],
  provider: { reference: 'Organization/claim-bp' },
  identifier: [{ system: CLAIM_ENC_SYSTEM, value: ENCOUNTER_ID }],
};

// storedNotices answers the lookup by idempotency key; a transaction echoes the new notice with an id
const makeBillingOystehr = (
  claimResults: Claim[][],
  storedNotices: PaymentNotice[] = []
): { oystehr: Oystehr; transaction: Mock } => {
  const claimQueue = [...claimResults];
  const search = vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) => {
    const results =
      resourceType === 'Claim' ? claimQueue.shift() ?? [] : resourceType === 'PaymentNotice' ? storedNotices : [];
    return Promise.resolve({ unbundle: () => results });
  });
  const transaction = vi.fn().mockImplementation(({ requests }: { requests: BatchInputRequest<FhirResource>[] }) => {
    const resources = requests.map((request) => {
      const { resource } = request as { resource: FhirResource };
      return request.url === '/PaymentNotice'
        ? {
            ...resource,
            id: 'pn-new',
          }
        : resource;
    });
    return Promise.resolve({ unbundle: () => resources });
  });
  const batch = vi.fn().mockResolvedValue({ entry: [] });
  return {
    oystehr: {
      fhir: {
        search,
        transaction,
        batch,
      },
    } as unknown as Oystehr,
    transaction,
  };
};

const writtenNotice = (transaction: Mock): { resource: PaymentNotice; fullUrl: string; ifNoneExist: unknown } =>
  transaction.mock.calls[0][0].requests.find((request: { url: string }) => request.url === '/PaymentNotice');

const makeClinicalOystehr = (encounters: Encounter[]): Oystehr =>
  ({
    fhir: { search: vi.fn().mockResolvedValue({ unbundle: () => encounters }) },
  }) as unknown as Oystehr;

const makeInput = (params: Record<string, unknown>): ZambdaInput => ({
  body: JSON.stringify(params),
  headers: { Authorization: 'Bearer user-token' },
  secrets,
});

const containedReconciliation = (notice: PaymentNotice): PaymentReconciliation => {
  const reconciliation = notice.contained?.find(
    (resource): resource is PaymentReconciliation => resource.resourceType === 'PaymentReconciliation'
  );
  if (!reconciliation) throw new Error('PaymentReconciliation not found');
  return reconciliation;
};

const makeExistingNotice = (): PaymentNotice => ({
  resourceType: 'PaymentNotice',
  id: 'pn-existing',
  status: 'active',
  created: '2026-06-30T09:00:00Z',
  paymentDate: '2026-07-01',
  amount: { value: 40, currency: 'USD' },
  request: { type: 'Claim', identifier: { system: CLAIM_ENC_SYSTEM, value: ENCOUNTER_ID } },
  identifier: [{ system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: baseParams.idempotencyKey }],
  extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'check' }],
  payment: { reference: '#contained-reconciliation' },
  recipient: { reference: 'Organization/default-bp' },
  contained: [
    {
      resourceType: 'PaymentReconciliation',
      id: 'contained-reconciliation',
      status: 'active',
      created: '2026-06-30T09:00:00Z',
      paymentDate: '2026-07-01',
      paymentAmount: { value: 40, currency: 'USD' },
      disposition: 'check copay',
      paymentIdentifier: { system: CHECK_NUMBER_IDENTIFIER_SYSTEM, value: '1234' },
      detail: [{ type: {}, submitter: { reference: 'Practitioner/someone-else' } }],
    },
  ],
});

describe('record-billing-manual-payment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'));
    vi.clearAllMocks();
    (createClinicalOystehrClient as Mock).mockReturnValue(makeClinicalOystehr([encounter]));
    (getUser as Mock).mockResolvedValue({ profile: 'Practitioner/prac-1' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const invalidInputs: { name: string; override: Record<string, unknown> }[] = [
    { name: 'a zero amount', override: { amountInCents: 0 } },
    { name: 'an unknown payment method', override: { paymentMethod: 'wire' } },
    { name: 'an idempotency key with a pipe', override: { idempotencyKey: 'bad|key' } },
  ];

  it.each(invalidInputs)('rejects $name', async ({ override }) => {
    const { oystehr, transaction } = makeBillingOystehr([]);
    (createBillingClient as Mock).mockReturnValue(oystehr);

    await expect(index(makeInput({ ...baseParams, ...override }))).rejects.toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('throws when the encounter does not exist', async () => {
    (createClinicalOystehrClient as Mock).mockReturnValue(makeClinicalOystehr([]));
    const { oystehr, transaction } = makeBillingOystehr([]);
    (createBillingClient as Mock).mockReturnValue(oystehr);

    await expect(index(makeInput(baseParams))).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('records a notice with the expected shape when no claim exists yet', async () => {
    const { oystehr, transaction } = makeBillingOystehr([[], []]);
    (createBillingClient as Mock).mockReturnValue(oystehr);

    const result = await index(makeInput(baseParams));

    const { resource, ifNoneExist } = writtenNotice(transaction);
    expect(ifNoneExist).toEqual([
      { name: 'identifier', value: `${MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM}|${baseParams.idempotencyKey}` },
      { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
    ]);
    expect(resource.amount).toEqual({ value: 40, currency: 'USD' });
    expect(resource.extension).toEqual([expect.objectContaining({ valueString: 'check' })]);
    expect(resource.request).toEqual({
      type: 'Claim',
      identifier: { system: CLAIM_ENC_SYSTEM, value: ENCOUNTER_ID },
    });
    expect(resource.identifier).toEqual([
      { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: baseParams.idempotencyKey },
    ]);
    expect(resource.payee).toEqual({ reference: 'Organization/default-bp' });
    expect(resource.recipient).toEqual({ reference: 'Organization/default-bp' });
    expect(resource.paymentDate).toBe('2026-07-01');
    const reconciliation = containedReconciliation(resource);
    expect(reconciliation.paymentDate).toBe('2026-07-01');
    expect(reconciliation.disposition).toBe('check copay');
    expect(reconciliation.paymentIdentifier).toEqual({ system: CHECK_NUMBER_IDENTIFIER_SYSTEM, value: '1234' });
    expect(reconciliation.detail?.[0]?.submitter).toEqual({ reference: 'Practitioner/prac-1' });
    expect(resource.created).toBe('2026-07-22T12:00:00.000Z');
    expect(JSON.parse(result.body)).toEqual({ paymentNoticeId: 'pn-new' });
  });

  it('lands on the prior Eastern date when paymentDateISO is just past midnight UTC', async () => {
    const { oystehr, transaction } = makeBillingOystehr([[], []]);
    (createBillingClient as Mock).mockReturnValue(oystehr);

    await index(makeInput({ ...baseParams, paymentDateISO: '2026-07-02T02:00:00Z' }));

    expect(writtenNotice(transaction).resource.paymentDate).toBe('2026-07-01');
  });

  it('links to an existing claim and uses its provider as payee', async () => {
    const { oystehr, transaction } = makeBillingOystehr([[claimWithProvider]]);
    (createBillingClient as Mock).mockReturnValue(oystehr);

    const result = await index(makeInput(baseParams));

    expect(writtenNotice(transaction).resource.request?.reference).toBe('Claim/claim-1');
    expect(writtenNotice(transaction).resource.payee).toEqual({ reference: 'Organization/claim-bp' });
    expect(JSON.parse(result.body)).toEqual({ paymentNoticeId: 'pn-new', claimId: 'claim-1' });
  });

  it("records the payment in the claim's history, attributed to the biller who took it", async () => {
    const { oystehr, transaction } = makeBillingOystehr([[claimWithProvider]]);
    (createBillingClient as Mock).mockReturnValue(oystehr);

    await index(makeInput(baseParams));

    const [entry] = claimHistoryEntries(transaction.mock.calls[0][0].requests);
    expect(entry).toMatchObject({
      target: [
        {
          reference: writtenNotice(transaction).fullUrl,
        },
        {
          reference: 'Claim/claim-1',
        },
      ],
      activity: {
        coding: [CLAIM_PROVENANCE_ACTIVITY.create],
      },
      agent: [
        {
          who: {
            reference: 'Practitioner/prac-1',
          },
        },
      ],
    });
    expect(provenanceChanges(entry)).toContainEqual({
      field: 'amount',
      label: 'Amount',
      previousValue: null,
      newValue: '$40.00',
    });
  });

  it('records a payment taken before its claim exists against the payment alone', async () => {
    const { oystehr, transaction } = makeBillingOystehr([[], []]);
    (createBillingClient as Mock).mockReturnValue(oystehr);

    await index(makeInput(baseParams));

    const [entry] = claimHistoryEntries(transaction.mock.calls[0][0].requests);
    expect(entry.target).toEqual([
      {
        reference: writtenNotice(transaction).fullUrl,
      },
    ]);
  });

  it('returns the existing notice untouched on an identical replay', async () => {
    const { oystehr, transaction } = makeBillingOystehr([[], []], [makeExistingNotice()]);
    (createBillingClient as Mock).mockReturnValue(oystehr);

    const result = await index(makeInput(baseParams));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).paymentNoticeId).toBe('pn-existing');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('records the payment without a submitter, attributed to the system, when caller lookup fails', async () => {
    (getUser as Mock).mockRejectedValue(new Error('user lookup failed'));
    const { oystehr, transaction } = makeBillingOystehr([[], []]);
    (createBillingClient as Mock).mockReturnValue(oystehr);

    await index(makeInput(baseParams));

    const reconciliation = containedReconciliation(writtenNotice(transaction).resource);
    expect(reconciliation.detail).toBeUndefined();
    const [entry] = claimHistoryEntries(transaction.mock.calls[0][0].requests);
    expect(entry.agent).toEqual([
      {
        who: {
          reference: 'Device/system',
        },
      },
    ]);
  });

  const conflictingReplayCases: { field: string; mutate: (notice: PaymentNotice) => void }[] = [
    {
      field: 'amount',
      mutate: (notice) => {
        notice.amount = { value: 99, currency: 'USD' };
      },
    },
    {
      field: 'payment method',
      mutate: (notice) => {
        notice.extension![0].valueString = 'cash';
      },
    },
    {
      field: 'encounter',
      mutate: (notice) => {
        notice.request!.identifier!.value = OTHER_ENCOUNTER_ID;
      },
    },
    {
      field: 'payment date',
      mutate: (notice) => {
        notice.paymentDate = '2026-07-02';
      },
    },
    {
      field: 'check number',
      mutate: (notice) => {
        containedReconciliation(notice).paymentIdentifier!.value = '9999';
      },
    },
    {
      field: 'description',
      mutate: (notice) => {
        containedReconciliation(notice).disposition = 'other note';
      },
    },
  ];

  it.each(conflictingReplayCases)(
    'rejects a replayed key whose stored notice differs in $field',
    async ({ mutate }) => {
      const existing = makeExistingNotice();
      mutate(existing);
      const { oystehr, transaction } = makeBillingOystehr([[], []], [existing]);
      (createBillingClient as Mock).mockReturnValue(oystehr);

      await expect(index(makeInput(baseParams))).rejects.toMatchObject({
        code: APIErrorCode.MANUAL_PAYMENT_CONFLICT,
        statusCode: 409,
      });
      expect(transaction).not.toHaveBeenCalled();
    }
  );
});
