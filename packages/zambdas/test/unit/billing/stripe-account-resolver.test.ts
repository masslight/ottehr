import Oystehr from '@oystehr/sdk';
import { PaymentNotice } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/fhir/payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStripeAccountForAppointmentOrEncounter: vi.fn(),
}));

import { createStripeAccountResolver } from '../../../src/billing/patient-payments';
import { stripeAccountExtension } from '../../../src/billing/payments';
import { STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';

const organizations: Record<string, object> = {
  'clinic-org': {
    resourceType: 'Organization',
    id: 'clinic-org',
    identifier: [{ system: STRIPE_ACCOUNT_IDENTIFIER_SYSTEM, value: 'acct_clinic' }],
  },
  'default-org': { resourceType: 'Organization', id: 'default-org' },
};
const billingGet = vi.fn(async ({ id }: { id: string }) => {
  if (!organizations[id]) throw { code: 404 };
  return organizations[id];
});

const billingNotice = (payee: string, stamp?: { stripeAccount: string | undefined }): PaymentNotice =>
  ({
    resourceType: 'PaymentNotice',
    meta: { tag: [BILLING_RESOURCE_TAG] },
    payee: { reference: payee },
    ...(stamp ? { extension: [stripeAccountExtension(stamp.stripeAccount)] } : {}),
  }) as PaymentNotice;
const legacyNotice = { resourceType: 'PaymentNotice', request: { reference: 'Encounter/enc-1' } } as PaymentNotice;

const resolver = (): ((notice: PaymentNotice) => Promise<string | undefined>) =>
  createStripeAccountResolver({
    billingOystehr: { fhir: { get: billingGet } } as unknown as Oystehr,
    clinicalOystehr: {} as Oystehr,
    encounterId: 'enc-1',
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStripeAccountForAppointmentOrEncounter).mockResolvedValue('acct_schedule');
});

describe('createStripeAccountResolver', () => {
  it('resolves a payment to the account stamped on it, even when no billing provider carries it', async () => {
    await expect(
      resolver()(billingNotice('Organization/default-org', { stripeAccount: 'acct_unmapped' }))
    ).resolves.toBe('acct_unmapped');
    expect(billingGet).not.toHaveBeenCalled();
    expect(getStripeAccountForAppointmentOrEncounter).not.toHaveBeenCalled();
  });

  it('keeps a payment stamped with the platform account, as an outreach invoice is, on the platform account', async () => {
    await expect(
      resolver()(billingNotice('Organization/default-org', { stripeAccount: undefined }))
    ).resolves.toBeUndefined();
    expect(getStripeAccountForAppointmentOrEncounter).not.toHaveBeenCalled();
  });

  it("resolves an unstamped billing payment to its payee's connected account", async () => {
    await expect(resolver()(billingNotice('Organization/clinic-org'))).resolves.toBe('acct_clinic');
    expect(getStripeAccountForAppointmentOrEncounter).not.toHaveBeenCalled();
  });

  it("falls back to the schedule owner's account when an unstamped payee carries none", async () => {
    // a connected account with no billing provider leaves the default org as payee
    await expect(resolver()(billingNotice('Organization/default-org'))).resolves.toBe('acct_schedule');
    await expect(resolver()(billingNotice('Organization/clinical-org'))).resolves.toBe('acct_schedule');
  });

  it("resolves a legacy EHR payment to the schedule owner's account, looked up once", async () => {
    const resolve = resolver();

    await expect(resolve(legacyNotice)).resolves.toBe('acct_schedule');
    await expect(resolve(legacyNotice)).resolves.toBe('acct_schedule');
    expect(getStripeAccountForAppointmentOrEncounter).toHaveBeenCalledTimes(1);
  });

  it('looks each payee up once', async () => {
    const resolve = resolver();

    await resolve(billingNotice('Organization/clinic-org'));
    await resolve(billingNotice('Organization/clinic-org'));
    expect(billingGet).toHaveBeenCalledTimes(1);
  });
});
