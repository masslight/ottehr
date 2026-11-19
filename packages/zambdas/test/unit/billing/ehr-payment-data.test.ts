import { GetPatientPaymentVisitsResponse } from 'utils/lib/types/api/patient-payment-visits.types';
import { SCHEDULE_NOT_FOUND_ERROR } from 'utils/lib/types/errors';
import { describe, expect, it } from 'vitest';
import { ehrClinicalPaymentLookups } from '../../../src/billing/ehr-payment-data';

const ehrData: GetPatientPaymentVisitsResponse = {
  visits: [
    { encounterId: 'enc-clinic', scheduleOwner: { stripeAccount: 'acct_clinic' }, legacyPaymentNotices: [] },
    { encounterId: 'enc-platform', scheduleOwner: {}, legacyPaymentNotices: [] },
    { encounterId: 'enc-no-owner', legacyPaymentNotices: [] },
  ],
  stripeCustomers: [{ customerId: 'cus_platform' }, { stripeAccount: 'acct_clinic', customerId: 'cus_clinic' }],
};

describe('ehrClinicalPaymentLookups', () => {
  it("answers a visit's schedule owner account from the EHR's visits, rejecting like the FHIR lookup without one", async () => {
    const lookups = ehrClinicalPaymentLookups(ehrData);

    await expect(lookups.scheduleStripeAccount('enc-clinic')).resolves.toBe('acct_clinic');
    await expect(lookups.scheduleStripeAccount('enc-platform')).resolves.toBeUndefined();
    await expect(lookups.scheduleStripeAccount('enc-no-owner')).rejects.toBe(SCHEDULE_NOT_FOUND_ERROR);
    await expect(lookups.scheduleStripeAccount('enc-unknown')).rejects.toBe(SCHEDULE_NOT_FOUND_ERROR);
  });

  it("finds the patient's Stripe customer on each account", () => {
    const lookups = ehrClinicalPaymentLookups(ehrData);

    expect(lookups.stripeCustomerId(undefined)).toBe('cus_platform');
    expect(lookups.stripeCustomerId('acct_clinic')).toBe('cus_clinic');
    expect(lookups.stripeCustomerId('acct_other')).toBeUndefined();
  });
});
