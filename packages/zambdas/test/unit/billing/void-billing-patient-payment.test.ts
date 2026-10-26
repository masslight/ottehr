import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { buildPaymentRefundsExtension, buildPaymentVoidExtension } from 'utils/lib/fhir/paymentRefunds';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/shared/sentry', () => ({ wrapHandler: (_name: string, handler: unknown) => handler }));
vi.mock('../../../src/shared/auth', () => ({
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('token'),
  getUserToken: vi.fn().mockReturnValue('user-token'),
  requireUserWithRole: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/pr-1', name: 'Pat Admin' }),
}));
vi.mock('../../../src/shared/practitioners', () => ({
  practitionerRefForUser: vi.fn().mockResolvedValue({ reference: 'Practitioner/pr-1', display: 'Pat Admin' }),
}));
vi.mock('../../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createClinicalOystehrClient: vi.fn(),
}));
vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createBillingClient: vi.fn(),
}));
vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  voidPaymentNotice: vi.fn(),
}));

import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM } from '../../../src/billing/payments';
import { createBillingClient } from '../../../src/billing/shared';
import { index } from '../../../src/billing/void-billing-patient-payment';
import { createClinicalOystehrClient } from '../../../src/shared/helpers';
import { voidPaymentNotice } from '../../../src/shared/stripeIntegration';
import { ZambdaInput } from '../../../src/shared/types/common';

const NOTICE_ID = '2e9e1a9e-5a1f-4b6e-9a51-9f6a3f1c2d3e';
const LEGACY_NOTICE_ID = '7b1c4a2e-0d3f-4c5b-8e6a-1f2d3c4b5a69';
const ENCOUNTER_ID = '0f6c1d8e-3a2b-4c5d-9e8f-7a6b5c4d3e2f';

const bridgedCopy: PaymentNotice = {
  resourceType: 'PaymentNotice',
  id: NOTICE_ID,
  meta: { versionId: '5', tag: [BILLING_RESOURCE_TAG] },
  status: 'active',
  amount: { value: 50, currency: 'USD' },
  request: { type: 'Claim', identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: ENCOUNTER_ID } },
  identifier: [{ system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: LEGACY_NOTICE_ID }],
  extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'cash' }],
} as PaymentNotice;

const legacyNotice = (
  extension: PaymentNotice['extension'],
  status: PaymentNotice['status'] = 'active'
): PaymentNotice =>
  ({
    resourceType: 'PaymentNotice',
    id: LEGACY_NOTICE_ID,
    status,
    amount: { value: 50, currency: 'USD' },
    request: { reference: `Encounter/${ENCOUNTER_ID}` },
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'cash' }, ...(extension ?? [])],
  }) as PaymentNotice;

const clinicalGet = vi.fn();
const billingPatch = vi.fn();

const invoke = (): Promise<APIGatewayProxyResult> =>
  (index as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)({
    body: JSON.stringify({ encounterId: ENCOUNTER_ID, paymentNoticeId: NOTICE_ID, reason: 'Other' }),
    headers: { Authorization: 'Bearer user-token' },
    secrets: {},
  } as unknown as ZambdaInput);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClinicalOystehrClient).mockReturnValue({ fhir: { get: clinicalGet } } as unknown as Oystehr);
  vi.mocked(createBillingClient).mockReturnValue({
    fhir: { get: vi.fn().mockResolvedValue(bridgedCopy), patch: billingPatch },
  } as unknown as Oystehr);
  billingPatch.mockImplementation(async ({ operations }) => ({
    ...bridgedCopy,
    status: operations.find((op: { path: string }) => op.path === '/status')?.value ?? bridgedCopy.status,
    extension: operations.find((op: { path: string }) => op.path === '/extension').value,
  }));
});

describe('void-billing-patient-payment', () => {
  it('voids the billing notice', async () => {
    clinicalGet.mockResolvedValue(legacyNotice([]));

    const result = await invoke();

    expect(billingPatch).not.toHaveBeenCalled();
    expect(vi.mocked(voidPaymentNotice).mock.calls[0][1].id).toBe(NOTICE_ID);
    expect(vi.mocked(voidPaymentNotice).mock.calls[0][2]).toMatchObject({ reason: 'Other', voidedBy: 'Pat Admin' });
    expect(JSON.parse(result.body)).toEqual({ paymentNoticeId: NOTICE_ID, voidedBillingNoticeCount: 1 });
  });

  it('rejects voiding a payment refunded before its billing copy existed', async () => {
    clinicalGet.mockResolvedValue(
      legacyNotice([
        buildPaymentRefundsExtension([
          {
            stripeRefundId: 'manual_legacy',
            amountInCents: 1000,
            dateISO: '2026-04-20T13:00:00Z',
            status: 'succeeded',
          },
        ]),
      ])
    );

    await expect(invoke()).rejects.toMatchObject({
      message: 'This payment has refunds recorded and can no longer be voided.',
    });
    expect(billingPatch.mock.calls[0][0].operations[0]).toEqual({ op: 'test', path: '/meta/versionId', value: '5' });
    expect(voidPaymentNotice).not.toHaveBeenCalled();
  });

  it('treats a payment voided only on the legacy notice as already voided', async () => {
    clinicalGet.mockResolvedValue(
      legacyNotice([buildPaymentVoidExtension({ reason: 'Other', voidedAtISO: '2026-04-20T13:00:00Z' })], 'cancelled')
    );

    await expect(invoke()).rejects.toMatchObject({ message: 'This payment has already been voided.' });
    expect(billingPatch.mock.calls[0][0].operations).toContainEqual({
      op: 'replace',
      path: '/status',
      value: 'cancelled',
    });
    expect(voidPaymentNotice).not.toHaveBeenCalled();
  });
});
