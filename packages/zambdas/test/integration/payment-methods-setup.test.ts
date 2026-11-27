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
import { PaymentMethodSetupZambdaOutput } from 'utils/lib/types/data/payment/payment-method-types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/patient/payment-methods/setup/index';
import { STRIPE_METADATA_KEYS } from '../../src/shared/stripeIntegration';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const stripe = vi.hoisted(() => ({
  customers: { create: vi.fn() },
  setupIntents: { create: vi.fn() },
}));

vi.mock('../../src/patient/payment-methods/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/patient/payment-methods/helpers')>()),
  getStripeClient: vi.fn(() => stripe),
}));

interface StripeVisit {
  patient: Patient;
  appointment: Appointment;
  account: Account;
}

const createVisitAtStripeLocation = async (
  oystehr: Oystehr,
  processId: string,
  { callerPhone, stripeAccount, email }: { callerPhone: string; stripeAccount: string; email: string }
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
          telecom: [{ system: 'email', value: email }],
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
          guarantor: [{ party: { reference: 'urn:uuid:patient' } }],
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
    account: resources.find((r): r is Account => r.resourceType === 'Account')!,
  };
};

describe('payment-methods-setup integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let visit: StripeVisit;
  const stripeAccount = `acct_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const email = `arya-${randomUUID()}@example.com`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('payment-methods-setup.test.ts', M2MClientMockType.patient);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    const caller = await userMe(token, loadZambdaSecrets());
    visit = await createVisitAtStripeLocation(oystehr, setup.processId, {
      callerPhone: caller.name,
      stripeAccount,
      email,
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it("creates the guarantor's Stripe customer in the visit location's account, stores it and returns a setup intent", async () => {
    const stripeCustomerId = `cus_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    stripe.customers.create.mockResolvedValueOnce({ id: stripeCustomerId });
    stripe.setupIntents.create.mockResolvedValueOnce({ id: 'seti_1', client_secret: 'seti_1_secret_abc' });

    const { statusCode, output } = await invokeZambdaHandler<PaymentMethodSetupZambdaOutput>(
      index,
      { beneficiaryPatientId: visit.patient.id, appointmentId: visit.appointment.id },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual({ clientSecret: 'seti_1_secret_abc', stripeAccount });
    expect(stripe.customers.create).toHaveBeenCalledWith(
      { email, name: 'Arya Stark', metadata: { [STRIPE_METADATA_KEYS.patientId]: visit.patient.id } },
      { stripeAccount }
    );
    expect(stripe.setupIntents.create).toHaveBeenCalledWith(
      { customer: stripeCustomerId, automatic_payment_methods: { enabled: false }, payment_method_types: ['card'] },
      { stripeAccount }
    );

    const account = await oystehr.fhir.get<Account>({ resourceType: 'Account', id: visit.account.id! });
    expect(account.identifier).toEqual([
      {
        system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
        value: stripeCustomerId,
        extension: [{ url: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT, valueString: stripeAccount }],
      },
    ]);
  });
});
