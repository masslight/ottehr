import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Appointment, FhirResource, Location, Patient, Person, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType, userMe } from 'utils/lib/auth/user-me.helper';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
  PATIENT_BILLING_ACCOUNT_TYPE,
  PRIVATE_EXTENSION_BASE_URL,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/patient/payment-methods/set-default/index';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

const stripe = vi.hoisted(() => ({
  customers: { update: vi.fn() },
}));

vi.mock('../../src/patient/payment-methods/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/patient/payment-methods/helpers')>()),
  getStripeClient: vi.fn(() => stripe),
}));

interface StripeVisit {
  patient: Patient;
  appointment: Appointment;
}

const createVisitAtStripeLocation = async (
  oystehr: Oystehr,
  processId: string,
  {
    callerPhone,
    stripeAccount,
    stripeCustomerId,
  }: { callerPhone: string; stripeAccount: string; stripeCustomerId: string }
): Promise<StripeVisit> => {
  const tag = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  const start = DateTime.now().toUTC();
  const bundle = await oystehr.fhir.transaction<FhirResource>({
    requests: [
      {
        method: 'POST',
        url: '/Location',
        fullUrl: 'urn:uuid:location',
        resource: tag<Location>({
          resourceType: 'Location',
          status: 'active',
          name: 'Payments Test Clinic',
          extension: [{ url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, valueString: stripeAccount }],
        }),
      },
      {
        method: 'POST',
        url: '/Patient',
        fullUrl: 'urn:uuid:patient',
        resource: tag<Patient>({
          resourceType: 'Patient',
          active: true,
          name: [{ given: ['Arya'], family: 'Stark' }],
          birthDate: '2010-04-04',
        }),
      },
      {
        method: 'POST',
        url: '/Appointment',
        resource: tag<Appointment>({
          resourceType: 'Appointment',
          status: 'booked',
          start: start.toISO()!,
          end: start.plus({ minutes: 15 }).toISO()!,
          participant: [
            { actor: { reference: 'urn:uuid:patient' }, status: 'accepted' },
            { actor: { reference: 'urn:uuid:location' }, status: 'accepted' },
          ],
        }),
      },
      {
        method: 'POST',
        url: '/Account',
        resource: tag<Account>({
          resourceType: 'Account',
          status: 'active',
          type: PATIENT_BILLING_ACCOUNT_TYPE,
          subject: [{ reference: 'urn:uuid:patient' }],
          identifier: [
            {
              system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
              value: stripeCustomerId,
              extension: [{ url: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT, valueString: stripeAccount }],
            },
          ],
        }),
      },
      {
        method: 'POST',
        url: '/RelatedPerson',
        fullUrl: 'urn:uuid:user-related-person',
        resource: tag<RelatedPerson>({
          resourceType: 'RelatedPerson',
          patient: { reference: 'urn:uuid:patient' },
          relationship: [
            { coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }] },
          ],
          telecom: [{ system: 'phone', value: callerPhone }],
        }),
      },
      {
        method: 'POST',
        url: '/Person',
        resource: tag<Person>({
          resourceType: 'Person',
          telecom: [{ system: 'phone', value: callerPhone }],
          link: [{ target: { reference: 'urn:uuid:user-related-person' } }],
        }),
      },
    ],
  });
  const resources = bundle.entry!.map((entry) => entry.resource!);
  return {
    patient: resources.find((r): r is Patient => r.resourceType === 'Patient')!,
    appointment: resources.find((r): r is Appointment => r.resourceType === 'Appointment')!,
  };
};

describe('payment-methods-set-default integration', () => {
  let token: string;
  let cleanup: () => Promise<void>;
  let visit: StripeVisit;
  const stripeAccount = `acct_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const stripeCustomerId = `cus_${randomUUID().replace(/-/g, '').slice(0, 14)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('payment-methods-set-default.test.ts', M2MClientMockType.patient);
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    const caller = await userMe(token, loadZambdaSecrets());
    visit = await createVisitAtStripeLocation(setup.oystehr, setup.processId, {
      callerPhone: caller.name,
      stripeAccount,
      stripeCustomerId,
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it("makes the card the default on the patient's customer in the visit location's Stripe account", async () => {
    stripe.customers.update.mockResolvedValueOnce({ id: stripeCustomerId });

    const { statusCode, output } = await invokeZambdaHandler(
      index,
      { beneficiaryPatientId: visit.patient.id, appointmentId: visit.appointment.id, paymentMethodId: 'pm_visa' },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual({});
    expect(stripe.customers.update).toHaveBeenCalledWith(
      stripeCustomerId,
      { invoice_settings: { default_payment_method: 'pm_visa' } },
      { stripeAccount }
    );
  });
});
