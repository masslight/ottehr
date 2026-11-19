import Oystehr from '@oystehr/sdk';
import { PaymentNotice } from 'fhir/r4b';
import { GetEncounterPaymentNoticeInputSchema } from 'utils/lib/types/api/encounter-payment-notice.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/shared/sentry', () => ({ wrapHandler: (_name: string, handler: unknown) => handler }));
vi.mock('utils/lib/fhir/payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStripeAccountForAppointmentOrEncounter: vi.fn().mockResolvedValue('acct_schedule'),
}));

import { getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import { performEffect } from '../../src/ehr/patient-payments/get-encounter-payment-notice';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../src/shared/stripeIntegration';

const ENCOUNTER_ID = '0f6c1d8e-3a2b-4c5d-9e8f-7a6b5c4d3e2f';
const NOTICE_ID = '7b1c4a2e-0d3f-4c5b-8e6a-1f2d3c4b5a69';
const notice = { resourceType: 'PaymentNotice', id: NOTICE_ID } as PaymentNotice;

const search = vi.fn();
const oystehr = { fhir: { search } } as unknown as Oystehr;
const secrets = {};

beforeEach(() => {
  vi.clearAllMocks();
  search.mockResolvedValue({ unbundle: () => [notice] });
});

describe('get-encounter-payment-notice', () => {
  it("looks a notice up by id within the encounter's notices", async () => {
    const result = await performEffect(oystehr, { encounterId: ENCOUNTER_ID, paymentNoticeId: NOTICE_ID, secrets });

    expect(search).toHaveBeenCalledWith({
      resourceType: 'PaymentNotice',
      params: [
        { name: 'request', value: `Encounter/${ENCOUNTER_ID}` },
        { name: '_id', value: NOTICE_ID },
      ],
    });
    expect(result).toEqual({ paymentNotice: notice });
    expect(getStripeAccountForAppointmentOrEncounter).not.toHaveBeenCalled();
  });

  it('looks a notice up by the Stripe payments it records', async () => {
    await performEffect(oystehr, { encounterId: ENCOUNTER_ID, stripePaymentIds: ['pi_1', 'ch_1'], secrets });

    expect(search.mock.calls[0][0].params[1]).toEqual({
      name: 'identifier',
      value: `${STRIPE_PAYMENT_ID_SYSTEM}|pi_1,${STRIPE_PAYMENT_ID_SYSTEM}|ch_1`,
    });
  });

  it("resolves only the schedule's Stripe account when no notice is asked for", async () => {
    const result = await performEffect(oystehr, { encounterId: ENCOUNTER_ID, includeStripeAccount: true, secrets });

    expect(search).not.toHaveBeenCalled();
    expect(getStripeAccountForAppointmentOrEncounter).toHaveBeenCalledWith({ encounterId: ENCOUNTER_ID }, oystehr);
    expect(result).toEqual({ stripeAccount: 'acct_schedule' });
  });

  it('omits a notice the encounter does not have', async () => {
    search.mockResolvedValue({ unbundle: () => [] });

    expect(await performEffect(oystehr, { encounterId: ENCOUNTER_ID, paymentNoticeId: NOTICE_ID, secrets })).toEqual(
      {}
    );
  });

  it('accepts exactly one lookup, or the Stripe account alone', () => {
    const parse = (input: object): boolean =>
      GetEncounterPaymentNoticeInputSchema.safeParse({ encounterId: ENCOUNTER_ID, ...input }).success;

    expect(parse({ paymentNoticeId: NOTICE_ID })).toBe(true);
    expect(parse({ stripePaymentIds: ['pi_1'], includeStripeAccount: true })).toBe(true);
    expect(parse({ includeStripeAccount: true })).toBe(true);
    expect(parse({})).toBe(false);
    expect(parse({ paymentNoticeId: NOTICE_ID, stripePaymentIds: ['pi_1'] })).toBe(false);
    expect(parse({ stripePaymentIds: [] })).toBe(false);
  });
});
