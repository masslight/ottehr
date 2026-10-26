import { PaymentNotice } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getPaymentNoticeSubmitterRef } from 'utils/lib/fhir/payments';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { describe, expect, it } from 'vitest';
import {
  encounterIdForPaymentNotice,
  mergeBillingAndLegacyPaymentNotices,
  paymentMethodForNotice,
  stripePaymentIntentIdForNotice,
} from '../../../src/billing/patient-payments';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, MANUAL_REFUND_ID_SYSTEM } from '../../../src/billing/payments';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';

const ENCOUNTER_ID = 'enc-1';
const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

const legacyNotice = (id: string, opts: { method: string; stripeId?: string; submitter?: string }): PaymentNotice =>
  ({
    resourceType: 'PaymentNotice',
    id,
    status: 'active',
    created: '2026-04-22T15:30:00Z',
    amount: { value: 20, currency: 'USD' },
    request: { reference: `Encounter/${ENCOUNTER_ID}` },
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: opts.method }],
    identifier: opts.stripeId ? [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: opts.stripeId }] : [],
    contained: [
      {
        resourceType: 'PaymentReconciliation',
        id: 'contained-reconciliation',
        status: 'active',
        created: '2026-04-22T15:30:00Z',
        paymentDate: '2026-04-22',
        paymentAmount: { value: 20, currency: 'USD' },
        outcome: 'complete',
        detail: opts.submitter ? [{ type: {}, submitter: { reference: opts.submitter, display: 'Front Desk' } }] : [],
      },
    ],
  }) as PaymentNotice;

const billingNotice = (
  id: string,
  opts: { method: string; amount?: number; identifiers: PaymentNotice['identifier'] }
): PaymentNotice =>
  ({
    resourceType: 'PaymentNotice',
    id,
    meta: { tag: [BILLING_RESOURCE_TAG] },
    status: 'active',
    created: '2026-04-22T15:30:05Z',
    amount: { value: opts.amount ?? 20, currency: 'USD' },
    request: { type: 'Claim', identifier: { system: CLAIM_ENCOUNTER_ID_SYSTEM, value: ENCOUNTER_ID } },
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: opts.method }],
    identifier: opts.identifiers,
    contained: [
      {
        resourceType: 'PaymentReconciliation',
        id: 'contained-reconciliation',
        status: 'active',
        created: '2026-04-22T15:30:05Z',
        paymentDate: '2026-04-22',
        paymentAmount: { value: opts.amount ?? 20, currency: 'USD' },
        outcome: 'complete',
      },
    ],
  }) as PaymentNotice;

describe('mergeBillingAndLegacyPaymentNotices', () => {
  it('drops a legacy cash notice the bridge already copied into billing', () => {
    const legacy = legacyNotice('clinical-1', { method: 'cash' });
    const copy = billingNotice('billing-1', {
      method: 'cash',
      identifiers: [{ system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: 'clinical-1' }],
    });

    expect(mergeBillingAndLegacyPaymentNotices([copy], [legacy]).map((notice) => notice.id)).toEqual(['billing-1']);
  });

  it('drops a legacy card notice the webhook recorded, keeping who took the payment', () => {
    const legacy = legacyNotice('clinical-1', { method: 'card', stripeId: 'pi_1', submitter: 'Practitioner/fd' });
    const webhookCopy = billingNotice('billing-1', {
      method: 'card',
      identifiers: [
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' },
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' },
      ],
    });

    const merged = mergeBillingAndLegacyPaymentNotices([webhookCopy], [legacy]);

    expect(merged.map((notice) => notice.id)).toEqual(['billing-1']);
    expect(getPaymentNoticeSubmitterRef(merged[0])).toEqual({ reference: 'Practitioner/fd', display: 'Front Desk' });
    // the input is not mutated
    expect(getPaymentNoticeSubmitterRef(webhookCopy)).toBeUndefined();
  });

  it('keeps legacy notices no billing notice records, and drops negative refund offsets', () => {
    const legacy = legacyNotice('clinical-1', { method: 'check' });
    const posted = billingNotice('billing-1', { method: 'cash', identifiers: [] });
    const refundOffset = billingNotice('billing-2', {
      method: 'cash',
      amount: -5,
      identifiers: [{ system: MANUAL_REFUND_ID_SYSTEM, value: 'manual_1' }],
    });

    expect(mergeBillingAndLegacyPaymentNotices([posted, refundOffset], [legacy]).map((notice) => notice.id)).toEqual([
      'billing-1',
      'clinical-1',
    ]);
  });
});

describe('payment notice accessors', () => {
  it('reads the encounter from either request shape', () => {
    expect(encounterIdForPaymentNotice(legacyNotice('c', { method: 'cash' }))).toBe(ENCOUNTER_ID);
    expect(encounterIdForPaymentNotice(billingNotice('b', { method: 'cash', identifiers: [] }))).toBe(ENCOUNTER_ID);
  });

  it('prefers the payment intent id over the charge id the webhook stores first', () => {
    const webhookCopy = billingNotice('b', {
      method: 'card',
      identifiers: [
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' },
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' },
      ],
    });
    const chargeOnly = billingNotice('b', {
      method: 'other',
      identifiers: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: 'in_1' }],
    });

    expect(stripePaymentIntentIdForNotice(webhookCopy)).toBe('pi_1');
    expect(stripePaymentIntentIdForNotice(chargeOnly)).toBeUndefined();
    expect(stripePaymentIntentIdForNotice(legacyNotice('c', { method: 'card', stripeId: 'pi_2' }))).toBe('pi_2');
  });

  it("reads the webhook's card_present method as a card reader payment", () => {
    expect(paymentMethodForNotice(billingNotice('b', { method: 'card_present', identifiers: [] }))).toBe('card-reader');
    expect(paymentMethodForNotice(billingNotice('b', { method: 'check', identifiers: [] }))).toBe('check');
  });
});
