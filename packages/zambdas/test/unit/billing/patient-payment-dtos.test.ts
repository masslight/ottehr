import Oystehr from '@oystehr/sdk';
import { Account, PaymentNotice } from 'fhir/r4b';
import Stripe from 'stripe';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/billing/patient-payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchEncounterPaymentNotices: vi.fn(),
}));
vi.mock('utils/lib/fhir/payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStripeAccountForAppointmentOrEncounter: vi.fn().mockResolvedValue(undefined),
}));

import { getPaymentsForEncounter } from '../../../src/billing/patient-payment-dtos';
import { fetchEncounterPaymentNotices } from '../../../src/billing/patient-payments';
import { MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM } from '../../../src/billing/payments';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';

const ENCOUNTER_ID = 'enc-1';

const otherNotice = (
  id: string,
  created: string,
  value: number,
  identifier: PaymentNotice['identifier']
): PaymentNotice =>
  ({
    resourceType: 'PaymentNotice',
    id,
    meta: { tag: [BILLING_RESOURCE_TAG] },
    status: 'active',
    created,
    amount: { value, currency: 'USD' },
    request: {
      type: 'Claim',
      identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: ENCOUNTER_ID },
    },
    identifier,
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'other' }],
  }) as PaymentNotice;

describe('getPaymentsForEncounter', () => {
  it("lists billing payments whose method is 'other'", async () => {
    vi.mocked(fetchEncounterPaymentNotices).mockResolvedValue(
      new Map([
        [
          ENCOUNTER_ID,
          [
            // recorded in the billing app
            otherNotice('manual-1', '2026-10-20T15:00:00.000Z', 25, [
              { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: 'key-1' },
            ]),
            // a Stripe invoice marked paid out of band: its only Stripe id is the invoice's
            otherNotice('invoice-1', '2026-10-21T15:00:00.000Z', 40, [
              { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'in_1' },
            ]),
          ],
        ],
      ])
    );

    const payments = await getPaymentsForEncounter({
      clinicalOystehr: {} as Oystehr,
      billingOystehr: {} as Oystehr,
      stripeClient: {} as Stripe,
      account: { resourceType: 'Account', id: 'account-1', status: 'active' } as Account,
      encounterId: ENCOUNTER_ID,
    });

    expect(payments).toEqual([
      expect.objectContaining({ paymentMethod: 'other', fhirPaymentNotificationId: 'invoice-1', amountInCents: 4000 }),
      expect.objectContaining({ paymentMethod: 'other', fhirPaymentNotificationId: 'manual-1', amountInCents: 2500 }),
    ]);
  });
});
