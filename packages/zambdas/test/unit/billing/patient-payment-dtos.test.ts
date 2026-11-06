import Oystehr from '@oystehr/sdk';
import { Account, PaymentNotice } from 'fhir/r4b';
import Stripe from 'stripe';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  BILLING_RESOURCE_TAG,
  PAYMENT_METHOD_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { buildPaymentRefundsExtension } from 'utils/lib/fhir/paymentRefunds';
import { getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { APPOINTMENT_NOT_FOUND_ERROR, SCHEDULE_NOT_FOUND_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, stripeAccountExtension } from '../../../src/billing/payments';
import { STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
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

beforeEach(() => {
  vi.clearAllMocks();
  // also drops a one-off rejection a test left unused because the lookup was skipped
  vi.mocked(getStripeAccountForAppointmentOrEncounter).mockReset().mockResolvedValue(undefined);
});

describe('getPaymentsForEncounter', () => {
  it("lists billing payments whose method is 'other', without a schedule to look up", async () => {
    // a manual billing payment's encounter may have no appointment, so no schedule owner
    vi.mocked(getStripeAccountForAppointmentOrEncounter).mockRejectedValueOnce(new Error('Appointment not found'));
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

    expect(getStripeAccountForAppointmentOrEncounter).not.toHaveBeenCalled();
    expect(payments).toEqual([
      expect.objectContaining({ paymentMethod: 'other', fhirPaymentNotificationId: 'invoice-1', amountInCents: 4000 }),
      expect.objectContaining({ paymentMethod: 'other', fhirPaymentNotificationId: 'manual-1', amountInCents: 2500 }),
    ]);
  });

  it("looks a card payment up on the Stripe account it was taken on, not the schedule owner's", async () => {
    vi.mocked(getStripeAccountForAppointmentOrEncounter).mockResolvedValue('acct_schedule');
    const cardNotice = (
      id: string,
      payee: string,
      paymentIntentId: string,
      stamp?: { stripeAccount: string | undefined }
    ): PaymentNotice => ({
      ...otherNotice(id, '2026-10-21T15:00:00.000Z', 40, [
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: paymentIntentId },
      ]),
      payee: { reference: payee },
      extension: [
        { url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' },
        ...(stamp ? [stripeAccountExtension(stamp.stripeAccount)] : []),
      ],
    });
    vi.mocked(fetchEncounterPaymentNotices).mockResolvedValue(
      new Map([
        [
          ENCOUNTER_ID,
          [
            // an outreach invoice, paid on the platform account
            cardNotice('outreach-1', 'Organization/platform-org', 'pi_platform', { stripeAccount: undefined }),
            cardNotice('clinic-1', 'Organization/clinic-org', 'pi_clinic'),
          ],
        ],
      ])
    );
    const organizations: Record<string, object> = {
      'clinic-org': {
        resourceType: 'Organization',
        id: 'clinic-org',
        identifier: [{ system: STRIPE_ACCOUNT_IDENTIFIER_SYSTEM, value: 'acct_clinic' }],
      },
      'platform-org': { resourceType: 'Organization', id: 'platform-org' },
    };
    const retrieve = vi.fn(async (id: string) => ({ id }));

    await getPaymentsForEncounter({
      clinicalOystehr: {} as Oystehr,
      billingOystehr: {
        fhir: { get: vi.fn(async ({ id }: { id: string }) => organizations[id]) },
      } as unknown as Oystehr,
      stripeClient: { paymentIntents: { retrieve } } as unknown as Stripe,
      account: { resourceType: 'Account', id: 'account-1', status: 'active' } as Account,
      encounterId: ENCOUNTER_ID,
    });

    expect(retrieve).toHaveBeenCalledWith('pi_platform', expect.anything(), { stripeAccount: undefined });
    expect(retrieve).toHaveBeenCalledWith('pi_clinic', expect.anything(), { stripeAccount: 'acct_clinic' });
    expect(retrieve).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), { stripeAccount: 'acct_schedule' });
  });

  it('does not look up the schedule when every card payment is stamped with its account', async () => {
    vi.mocked(getStripeAccountForAppointmentOrEncounter).mockRejectedValueOnce(new Error('Appointment not found'));
    vi.mocked(fetchEncounterPaymentNotices).mockResolvedValue(
      new Map([
        [
          ENCOUNTER_ID,
          [
            {
              ...otherNotice('card-1', '2026-10-21T15:00:00.000Z', 40, [
                { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' },
              ]),
              extension: [
                { url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' },
                stripeAccountExtension('acct_clinic'),
              ],
            },
          ],
        ],
      ])
    );
    const retrieve = vi.fn(async (id: string) => ({ id }));

    const payments = await getPaymentsForEncounter({
      clinicalOystehr: {} as Oystehr,
      billingOystehr: {} as Oystehr,
      stripeClient: { paymentIntents: { retrieve } } as unknown as Stripe,
      account: { resourceType: 'Account', id: 'account-1', status: 'active' } as Account,
      encounterId: ENCOUNTER_ID,
    });

    expect(getStripeAccountForAppointmentOrEncounter).not.toHaveBeenCalled();
    expect(retrieve).toHaveBeenCalledWith('pi_1', expect.anything(), { stripeAccount: 'acct_clinic' });
    expect(payments).toEqual([expect.objectContaining({ paymentMethod: 'card', fhirPaymentNotificationId: 'card-1' })]);
  });

  describe('an encounter with more card payments than the EHR visit list shows', () => {
    // stored oldest first, so the newest payment is the one past the cap
    const cardNotices = Array.from({ length: 21 }, (_, i): PaymentNotice => {
      const day = String(i + 1).padStart(2, '0');
      return {
        ...otherNotice(`card-${day}`, `2026-10-${day}T15:00:00.000Z`, 10, [
          { system: STRIPE_PAYMENT_ID_SYSTEM, value: `pi_${day}` },
        ]),
        extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' }, stripeAccountExtension('acct_clinic')],
      };
    });
    const listCardPayments = (uncappedCardPayments?: boolean): ReturnType<typeof getPaymentsForEncounter> => {
      vi.mocked(fetchEncounterPaymentNotices).mockResolvedValue(new Map([[ENCOUNTER_ID, cardNotices]]));
      return getPaymentsForEncounter({
        clinicalOystehr: {} as Oystehr,
        billingOystehr: {} as Oystehr,
        stripeClient: { paymentIntents: { retrieve: vi.fn(async (id: string) => ({ id })) } } as unknown as Stripe,
        account: { resourceType: 'Account', id: 'account-1', status: 'active' } as Account,
        encounterId: ENCOUNTER_ID,
        uncappedCardPayments,
      });
    };

    it('lists every one, newest first, when uncapped', async () => {
      const payments = await listCardPayments(true);

      expect(payments).toHaveLength(21);
      expect(payments[0].fhirPaymentNotificationId).toBe('card-21');
      expect(payments[20].fhirPaymentNotificationId).toBe('card-01');
    });

    it('keeps the EHR visit list capped at 20', async () => {
      expect(await listCardPayments()).toHaveLength(20);
    });
  });

  describe('a legacy card payment on an encounter without a schedule owner', () => {
    const legacyCardNotice: PaymentNotice = {
      resourceType: 'PaymentNotice',
      id: 'legacy-1',
      status: 'active',
      created: '2026-10-21T15:00:00.000Z',
      amount: { value: 30, currency: 'USD' },
      request: { reference: `Encounter/${ENCOUNTER_ID}` },
      payment: {},
      recipient: {},
      identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_legacy' }],
      extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' }],
    };
    const account = {
      resourceType: 'Account',
      id: 'account-1',
      status: 'active',
      identifier: [{ system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE, value: 'cus_1' }],
    } as Account;

    it.each([
      ['appointment', APPOINTMENT_NOT_FOUND_ERROR],
      ['schedule', SCHEDULE_NOT_FOUND_ERROR],
    ])('is still listed when the %s is missing', async (_missing, error) => {
      vi.mocked(getStripeAccountForAppointmentOrEncounter).mockRejectedValue(error);
      vi.mocked(fetchEncounterPaymentNotices).mockResolvedValue(new Map([[ENCOUNTER_ID, [legacyCardNotice]]]));
      const search = vi.fn();
      const retrieve = vi.fn().mockRejectedValue(new Error('No such payment_intent'));

      const payments = await getPaymentsForEncounter({
        clinicalOystehr: {} as Oystehr,
        billingOystehr: {} as Oystehr,
        stripeClient: { paymentIntents: { retrieve, search } } as unknown as Stripe,
        account,
        encounterId: ENCOUNTER_ID,
      });

      // no schedule account to search the customer's payments on
      expect(search).not.toHaveBeenCalled();
      expect(payments).toEqual([
        expect.objectContaining({
          paymentMethod: 'card',
          fhirPaymentNotificationId: 'legacy-1',
          stripePaymentId: 'pi_legacy',
          amountInCents: 3000,
        }),
      ]);
    });

    it('still fails the list on any other lookup error', async () => {
      vi.mocked(getStripeAccountForAppointmentOrEncounter).mockRejectedValue(new Error('FHIR unavailable'));
      vi.mocked(fetchEncounterPaymentNotices).mockResolvedValue(new Map([[ENCOUNTER_ID, [legacyCardNotice]]]));

      await expect(
        getPaymentsForEncounter({
          clinicalOystehr: {} as Oystehr,
          billingOystehr: {} as Oystehr,
          stripeClient: {} as Stripe,
          account,
          encounterId: ENCOUNTER_ID,
        })
      ).rejects.toThrow('FHIR unavailable');
    });
  });

  it('gives a terminal payment taken through a PaymentIntent its id, which refunds go through', async () => {
    vi.mocked(fetchEncounterPaymentNotices).mockResolvedValue(
      new Map([
        [
          ENCOUNTER_ID,
          [
            {
              ...otherNotice('reader-1', '2026-10-21T15:00:00.000Z', 40, [
                { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_2' },
                { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_2' },
              ]),
              extension: [
                { url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card_present' },
                stripeAccountExtension('acct_clinic'),
              ],
            },
          ],
        ],
      ])
    );
    const retrieve = vi.fn(async (id: string) => ({ id }));

    const payments = await getPaymentsForEncounter({
      clinicalOystehr: {} as Oystehr,
      billingOystehr: {} as Oystehr,
      stripeClient: { paymentIntents: { retrieve } } as unknown as Stripe,
      account: { resourceType: 'Account', id: 'account-1', status: 'active' } as Account,
      encounterId: ENCOUNTER_ID,
    });

    expect(payments).toEqual([
      expect.objectContaining({
        paymentMethod: 'card-reader',
        fhirPaymentNotificationId: 'reader-1',
        stripePaymentId: 'pi_2',
      }),
    ]);
  });

  describe('a card payment Stripe recorded as a bare charge', () => {
    const chargeOnlyNotice = (method: string, extra: PaymentNotice['extension'] = []): PaymentNotice => ({
      ...otherNotice('charge-1', '2026-10-21T15:00:00.000Z', 40, [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' }]),
      extension: [
        { url: PAYMENT_METHOD_EXTENSION_URL, valueString: method },
        stripeAccountExtension('acct_clinic'),
        ...extra,
      ],
    });
    const listWith = async (notice: PaymentNotice, charge: object | Error): Promise<unknown[]> => {
      vi.mocked(fetchEncounterPaymentNotices).mockResolvedValue(new Map([[ENCOUNTER_ID, [notice]]]));
      const retrieve = charge instanceof Error ? vi.fn().mockRejectedValue(charge) : vi.fn().mockResolvedValue(charge);
      const payments = await getPaymentsForEncounter({
        clinicalOystehr: {} as Oystehr,
        billingOystehr: {} as Oystehr,
        stripeClient: { charges: { retrieve } } as unknown as Stripe,
        account: { resourceType: 'Account', id: 'account-1', status: 'active' } as Account,
        encounterId: ENCOUNTER_ID,
      });
      expect(retrieve).toHaveBeenCalledWith('ch_1', {}, { stripeAccount: 'acct_clinic' });
      return payments;
    };

    it('is listed as a card payment with the card on the charge and no refund link', async () => {
      const refund = {
        stripeRefundId: 're_1',
        amountInCents: 1000,
        dateISO: '2026-10-22T15:00:00.000Z',
        status: 'succeeded',
      };
      const payments = await listWith(chargeOnlyNotice('card', [buildPaymentRefundsExtension([refund])]), {
        id: 'ch_1',
        description: 'Visit copay',
        payment_method_details: { type: 'card', card: { brand: 'visa', last4: '4242' } },
      });

      expect(payments).toEqual([
        expect.objectContaining({
          paymentMethod: 'card',
          fhirPaymentNotificationId: 'charge-1',
          amountInCents: 4000,
          stripePaymentId: undefined,
          cardBrand: 'visa',
          cardLast4: '4242',
          description: 'Visit copay',
          refunds: [expect.objectContaining({ stripeRefundId: 're_1' })],
          refundedAmountInCents: 1000,
        }),
      ]);
    });

    it('is listed once, as a card-reader payment, when taken on a terminal', async () => {
      const payments = await listWith(chargeOnlyNotice('card_present'), {
        id: 'ch_1',
        payment_method_details: { type: 'card_present', card_present: { brand: 'mastercard', last4: '1111' } },
      });

      expect(payments).toEqual([
        expect.objectContaining({
          paymentMethod: 'card-reader',
          fhirPaymentNotificationId: 'charge-1',
          cardBrand: 'mastercard',
          cardLast4: '1111',
        }),
      ]);
      // no PaymentIntent to refund through, so the EHR offers no refund
      expect(payments[0]).not.toHaveProperty('stripePaymentId');
    });

    it('is still listed from FHIR when Stripe cannot return the charge', async () => {
      const payments = await listWith(chargeOnlyNotice('card'), new Error('Stripe down'));

      expect(payments).toEqual([
        expect.objectContaining({ paymentMethod: 'card', fhirPaymentNotificationId: 'charge-1', amountInCents: 4000 }),
      ]);
    });
  });
});
