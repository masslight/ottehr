import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { FhirResource, PaymentNotice } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PAYMENT_METHOD_EXTENSION_URL, PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ListPatientPaymentResponse } from 'utils/lib/types/api/patient-payment-types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../../src/billing/list-billing-patient-payments/index';
import {
  buildPaymentNotice,
  claimRequestFor,
  EHR_PATIENT_PAYMENT_ID_SYSTEM,
  MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
} from '../../../src/billing/payments';
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

describe('list-billing-patient-payments', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const stripeAccount = `acct_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const paymentIntentId = `pi_${randomUUID().replace(/-/g, '')}`;
  let clinicalPatientId: string;
  let encounterId: string;
  let locationId: string | undefined;
  let cardNoticeId: string;
  let cashNoticeId: string;
  let legacyNoticeId: string;

  const seed = async <T extends FhirResource>(client: Oystehr, resource: T): Promise<string> => {
    const created = await client.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/list-billing-patient-payments.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    oystehrBilling = setup.oystehrBilling;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    processId = setup.processId;

    const visit = await insertInPersonAppointmentBase(oystehr, processId);
    clinicalPatientId = visit.patient.id!;
    encounterId = visit.encounter.id!;
    locationId = visit.appointment.participant
      .find((participant) => participant.actor?.reference?.startsWith('Location/'))
      ?.actor?.reference?.split('/')[1];
    if (locationId) seededDeletes.push({ method: 'DELETE', url: `Location/${locationId}` });

    cardNoticeId = await seed<PaymentNotice>(oystehrBilling, {
      resourceType: 'PaymentNotice',
      status: 'active',
      request: claimRequestFor(undefined, encounterId),
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
    cashNoticeId = await seed<PaymentNotice>(
      oystehrBilling,
      buildPaymentNotice({
        request: claimRequestFor(undefined, encounterId),
        payee: { display: 'Integration Medical Group' },
        amountInCents: 2500,
        paymentMethod: 'cash',
        identifier: { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() },
        paymentDate: '2026-03-02',
        createdISO: '2026-03-02T15:00:00.000Z',
        disposition: 'cash payment collected manually',
        reconciliation: {
          detail: [
            {
              type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/payment-type', code: 'payment' }] },
              submitter: { display: 'Dana Clerk' },
            },
          ],
        },
      })
    );
    legacyNoticeId = await seed<PaymentNotice>(oystehr, {
      resourceType: 'PaymentNotice',
      status: 'active',
      request: { reference: `Encounter/${encounterId}` },
      created: '2026-03-01T15:00:00.000Z',
      amount: { value: 15, currency: 'USD' },
      extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'check' }],
      payment: { display: 'check collected from patient' },
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
      card: { brand: 'visa', last4: '4242' },
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

  it("lists the encounter's billing and EHR payments, the card one with its Stripe card details", async () => {
    const { statusCode, output } = await invokeZambdaHandler<ListPatientPaymentResponse>(
      index,
      { patientId: clinicalPatientId, encounterId },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output.patientId).toBe(clinicalPatientId);
    expect(output.encounterId).toBe(encounterId);
    expect(output.payments).toEqual([
      expect.objectContaining({
        paymentMethod: 'card',
        fhirPaymentNotificationId: cardNoticeId,
        amountInCents: 4000,
        stripePaymentId: paymentIntentId,
        stripePaymentMethodId: 'pm_integration_card',
        description: 'Visit copay',
        cardBrand: 'visa',
        cardLast4: '4242',
      }),
      expect.objectContaining({
        paymentMethod: 'cash',
        fhirPaymentNotificationId: cashNoticeId,
        amountInCents: 2500,
        takenBy: 'Dana Clerk',
      }),
      expect.objectContaining({
        paymentMethod: 'check',
        fhirPaymentNotificationId: legacyNoticeId,
        amountInCents: 1500,
      }),
    ]);
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(paymentIntentId, expect.anything(), {
      stripeAccount,
    });
    expect(stripe.paymentMethods.retrieve).toHaveBeenCalledWith('pm_integration_card', { stripeAccount });
  }, 120_000);
});
