import { Location, Organization, PaymentNotice } from 'fhir/r4b';
import Stripe from 'stripe';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { describe, expect, test, vi } from 'vitest';
import { buildOrganizationReceiptBlock, parsePaymentsList } from '../../src/shared/pdf/patient-payment-receipt-pdf';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../src/shared/stripeIntegration';

const mockOrg: Organization = {
  resourceType: 'Organization',
  name: 'Test Clinic',
  address: [
    {
      line: ['123 Org Street', 'Suite 1'],
      city: 'OrgCity',
      state: 'OC',
      postalCode: '10001',
    },
  ],
  telecom: [{ system: 'phone', value: '555-ORG-PHONE' }],
};

const locationWithAddress: Location = {
  resourceType: 'Location',
  name: 'Downtown Branch',
  address: {
    line: ['456 Location Rd'],
    city: 'LocCity',
    state: 'LC',
    postalCode: '20002',
  },
  telecom: [{ system: 'phone', value: '555-LOC-PHONE' }],
};

describe('buildOrganizationReceiptBlock', () => {
  describe('when location has a complete address', () => {
    test('uses location address fields', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, locationWithAddress, '555-ORG-PHONE', '555-LOC-PHONE');

      expect(result.street).toBe('456 Location Rd');
      expect(result.city).toBe('LocCity');
      expect(result.state).toBe('LC');
      expect(result.zip).toBe('20002');
    });

    test('uses organization name', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, locationWithAddress, '555-ORG-PHONE', '555-LOC-PHONE');

      expect(result.name).toBe('Test Clinic');
    });

    test('prefers location phone over org phone', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, locationWithAddress, '555-ORG-PHONE', '555-LOC-PHONE');

      expect(result.phone).toBe('555-LOC-PHONE');
    });

    test('falls back to org phone when location phone is undefined', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, locationWithAddress, '555-ORG-PHONE', undefined);

      expect(result.phone).toBe('555-ORG-PHONE');
    });
  });

  describe('when location has no address', () => {
    test('uses organization address fields when location is undefined', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, undefined, '555-ORG-PHONE', undefined);

      expect(result.street).toBe('123 Org Street');
      expect(result.city).toBe('OrgCity');
      expect(result.state).toBe('OC');
      expect(result.zip).toBe('10001');
    });

    test('uses organization address fields when location has no address property', () => {
      const locationWithoutAddress: Location = { resourceType: 'Location', name: 'No Address Branch' };

      const result = buildOrganizationReceiptBlock(mockOrg, locationWithoutAddress, '555-ORG-PHONE', undefined);

      expect(result.street).toBe('123 Org Street');
      expect(result.city).toBe('OrgCity');
      expect(result.state).toBe('OC');
      expect(result.zip).toBe('10001');
    });

    test('uses organization phone', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, undefined, '555-ORG-PHONE', undefined);

      expect(result.phone).toBe('555-ORG-PHONE');
    });

    test('includes street2 when organization address has a second line', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, undefined, '555-ORG-PHONE', undefined);

      expect(result.street2).toBe('Suite 1');
    });
  });

  describe('when location address is incomplete', () => {
    test('falls back to org address when location is missing postalCode', () => {
      const partialLocation: Location = {
        resourceType: 'Location',
        address: {
          line: ['789 Partial Rd'],
          city: 'PartialCity',
          state: 'PC',
          // no postalCode
        },
      };

      const result = buildOrganizationReceiptBlock(mockOrg, partialLocation, '555-ORG-PHONE', '555-LOC-PHONE');

      expect(result.street).toBe('123 Org Street');
      expect(result.city).toBe('OrgCity');
    });

    test('falls back to org address when location is missing city', () => {
      const partialLocation: Location = {
        resourceType: 'Location',
        address: {
          line: ['789 Partial Rd'],
          state: 'PC',
          postalCode: '30003',
        },
      };

      const result = buildOrganizationReceiptBlock(mockOrg, partialLocation, '555-ORG-PHONE', '555-LOC-PHONE');

      expect(result.street).toBe('123 Org Street');
    });
  });
});

describe('parsePaymentsList', () => {
  const cardNotice = (id: string, paymentIntentId: string): PaymentNotice =>
    ({
      resourceType: 'PaymentNotice',
      id,
      meta: { tag: [BILLING_RESOURCE_TAG] },
      status: 'active',
      created: '2026-10-21T15:00:00.000Z',
      amount: { value: 40, currency: 'USD' },
      identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: paymentIntentId }],
      extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' }],
    }) as PaymentNotice;

  test("reads a payment's card on the account it was taken on, not only the encounter's prefetched intents", async () => {
    const retrieveIntent = vi.fn(async (id: string) => ({ id, payment_method: 'pm_platform' }));
    const retrieveMethod = vi.fn(async (id: string) => ({ id, card: { brand: 'visa', last4: '4242' } }));
    const stripeClient = {
      paymentIntents: { retrieve: retrieveIntent },
      paymentMethods: { retrieve: retrieveMethod },
    } as unknown as Stripe;
    // an outreach invoice on the platform account; its intent is not among the schedule account's
    const accountFor = vi.fn(async () => undefined);

    const [payment] = await parsePaymentsList(
      [cardNotice('outreach-1', 'pi_platform')],
      [],
      { invoice_settings: {} } as Stripe.Customer,
      stripeClient,
      accountFor
    );

    expect(retrieveIntent).toHaveBeenCalledWith('pi_platform', undefined, { stripeAccount: undefined });
    expect(retrieveMethod).toHaveBeenCalledWith('pm_platform', {}, { stripeAccount: undefined });
    expect(payment).toMatchObject({ brand: 'visa', last4: '4242' });
  });

  test('uses the prefetched intent and the payment account for its card', async () => {
    const retrieveIntent = vi.fn();
    const retrieveMethod = vi.fn(async (id: string) => ({ id, card: { brand: 'amex', last4: '0005' } }));
    const stripeClient = {
      paymentIntents: { retrieve: retrieveIntent },
      paymentMethods: { retrieve: retrieveMethod },
    } as unknown as Stripe;

    await parsePaymentsList(
      [cardNotice('clinic-1', 'pi_clinic')],
      [{ id: 'pi_clinic', payment_method: 'pm_clinic' } as Stripe.PaymentIntent],
      { invoice_settings: {} } as Stripe.Customer,
      stripeClient,
      async () => 'acct_clinic'
    );

    expect(retrieveIntent).not.toHaveBeenCalled();
    expect(retrieveMethod).toHaveBeenCalledWith('pm_clinic', {}, { stripeAccount: 'acct_clinic' });
  });
});
