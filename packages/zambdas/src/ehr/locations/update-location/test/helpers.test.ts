import { Location } from 'fhir/r4b';
import { SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { stripeExtValue, touchesPaymentFields } from '../helpers';

const locationWith = (extension: Location['extension']): Location => ({
  resourceType: 'Location',
  id: 'loc-1',
  extension,
});

describe('stripeExtValue', () => {
  it('reads the stripe account extension from among others', () => {
    expect(
      stripeExtValue(
        locationWith([
          { url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' },
          { url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, valueString: 'acct_123' },
        ])
      )
    ).toBe('acct_123');
  });

  it('is undefined when the Location has no stripe account', () => {
    expect(stripeExtValue(locationWith([{ url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' }]))).toBe(
      undefined
    );
    expect(stripeExtValue(locationWith(undefined))).toBe(undefined);
  });
});

describe('touchesPaymentFields', () => {
  it('is true when either payment field is set', () => {
    expect(touchesPaymentFields({ stripeAccountId: 'acct_123' })).toBe(true);
    expect(touchesPaymentFields({ advapacsLocationId: 'uuid' })).toBe(true);
  });

  it('is true for null and empty string, which clear the field rather than leaving it alone', () => {
    // The security-relevant edge: clearing is still an edit, so it must require Customer Support.
    // A truthiness check here would let any role wipe a stripe account.
    expect(touchesPaymentFields({ stripeAccountId: null })).toBe(true);
    expect(touchesPaymentFields({ stripeAccountId: '' })).toBe(true);
    expect(touchesPaymentFields({ advapacsLocationId: null })).toBe(true);
  });

  it('is false when neither key is present', () => {
    // The shape of the original bug: the UI never sent the key, so the handler correctly left the
    // stored value alone and returned 200 — nothing to authorize, nothing to write.
    expect(touchesPaymentFields({})).toBe(false);
    expect(touchesPaymentFields({ stripeAccountId: undefined, advapacsLocationId: undefined })).toBe(false);
  });
});
