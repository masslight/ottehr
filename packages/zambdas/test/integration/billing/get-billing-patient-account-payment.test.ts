import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Patient, PaymentNotice } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PAYMENT_METHOD_EXTENSION_URL, PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { GetBillingPatientAccountPaymentResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../../src/billing/get-billing-patient-account-payment/index';
import { claimRequestFor, EHR_PATIENT_PAYMENT_ID_SYSTEM } from '../../../src/billing/payments';
import { SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';
import {
  addProcessIdMetaTagToResource,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const stripe = vi.hoisted(() => ({
  paymentIntents: { retrieve: vi.fn(), search: vi.fn() },
  paymentMethods: { retrieve: vi.fn(), list: vi.fn() },
  refunds: { list: vi.fn() },
  charges: { retrieve: vi.fn() },
}));

vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/stripeIntegration')>();
  return { ...actual, getStripeClient: vi.fn(() => stripe) };
});

describe('get-billing-patient-account-payment', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const stripeAccount = `acct_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const paymentIntentId = `pi_${randomUUID().replace(/-/g, '')}`;
  let billingPatientId: string;
  let encounterId: string;
  let appointmentId: string;
  let visitDateISO: string;
  let locationId: string | undefined;
  let claimId: string;
  let cardNoticeId: string;

  const seed = async <T extends FhirResource>(client: Oystehr, resource: T): Promise<string> => {
    const created = await client.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/get-billing-patient-account-payment.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    oystehrBilling = setup.oystehrBilling;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    processId = setup.processId;

    const visit = await insertInPersonAppointmentBase(oystehr, processId);
    encounterId = visit.encounter.id!;
    appointmentId = visit.appointment.id!;
    visitDateISO = visit.appointment.start!;
    locationId = visit.appointment.participant
      .find((participant) => participant.actor?.reference?.startsWith('Location/'))
      ?.actor?.reference?.split('/')[1];
    if (locationId) seededDeletes.push({ method: 'DELETE', url: `Location/${locationId}` });

    billingPatientId = await seed<Patient>(oystehrBilling, {
      resourceType: 'Patient',
      active: true,
      name: [{ family: 'Snow', given: ['Jon'] }],
      birthDate: '2002-07-07',
      extension: [{ url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: `Patient/${visit.patient.id}` } }],
    });
    claimId = await seed<Claim>(oystehrBilling, {
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      created: '2026-03-01',
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      patient: { reference: `Patient/${billingPatientId}` },
      provider: { display: 'Integration Medical Group' },
      identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId }],
      total: { value: 120, currency: 'USD' },
      item: [{ sequence: 1, productOrService: { text: 'Office visit' }, servicedDate: '2026-03-01' }],
      meta: { tag: claimStatusValuesToTags({ arStage: AR_STAGE.patient, patientArStatus: 'ready-to-invoice' }) },
    });
    cardNoticeId = await seed<PaymentNotice>(oystehrBilling, {
      resourceType: 'PaymentNotice',
      status: 'active',
      request: { ...claimRequestFor(undefined, encounterId), reference: `Claim/${claimId}` },
      created: '2026-03-03T15:00:00.000Z',
      paymentDate: '2026-03-03',
      amount: { value: 40, currency: 'USD' },
      identifier: [
        { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: `${encounterId}_${randomUUID()}` },
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: paymentIntentId },
      ],
      extension: [
        { url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' },
        { url: PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL, valueString: stripeAccount },
      ],
      payment: { display: 'Stripe card payment' },
      recipient: { display: 'Integration Medical Group' },
    });

    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: paymentIntentId,
      payment_method: 'pm_integration_card',
      description: 'Visit copay',
      latest_charge: { id: 'ch_integration', amount_refunded: 0 },
    });
    stripe.paymentMethods.retrieve.mockResolvedValue({
      id: 'pm_integration_card',
      card: { brand: 'amex', last4: '0005' },
    });
  }, 120_000);

  afterAll(async () => {
    try {
      await oystehr.fhir.batch({
        requests: seededDeletes,
      });
    } catch (error) {
      console.error('Failed to clean up seeded fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  it('resolves one card payment with its visit, claim and Stripe card details', async () => {
    const { statusCode, output } = await invokeZambdaHandler<GetBillingPatientAccountPaymentResponse>(
      index,
      { patientId: billingPatientId, encounterId, paymentId: cardNoticeId },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output.payment).toMatchObject({
      fhirPaymentNotificationId: cardNoticeId,
      paymentMethod: 'card',
      method: 'card',
      amountInCents: 4000,
      dateISO: '2026-03-03',
      stripePaymentId: paymentIntentId,
      stripePaymentMethodId: 'pm_integration_card',
      description: 'Visit copay',
      cardBrand: 'amex',
      cardLast4: '0005',
      encounterId,
      appointmentId,
      visitDateISO,
      claimId,
      claimServiceDate: '2026-03-01',
    });
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(paymentIntentId, expect.anything(), {
      stripeAccount,
    });
    expect(stripe.paymentIntents.search).not.toHaveBeenCalled();
  }, 120_000);
});
