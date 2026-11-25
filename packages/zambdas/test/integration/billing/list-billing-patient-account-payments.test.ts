import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Patient, PaymentNotice } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PAYMENT_METHOD_EXTENSION_URL, PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { ServiceMode } from 'utils/lib/types/common';
import { ListBillingPatientAccountPaymentsResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../../src/billing/list-billing-patient-account-payments/index';
import {
  buildPaymentNotice,
  claimRequestFor,
  EHR_PATIENT_PAYMENT_ID_SYSTEM,
  MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
} from '../../../src/billing/payments';
import { SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';
import {
  addProcessIdMetaTagToResource,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../../helpers/invoke-zambda-handler';

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

describe('list-billing-patient-account-payments', () => {
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
  let cashNoticeId: string;
  let legacyNoticeId: string;

  const seed = async <T extends FhirResource>(client: Oystehr, resource: T): Promise<string> => {
    const created = await client.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/list-billing-patient-account-payments.test.ts',
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
    cashNoticeId = await seed<PaymentNotice>(
      oystehrBilling,
      buildPaymentNotice({
        request: { ...claimRequestFor(undefined, encounterId), reference: `Claim/${claimId}` },
        payee: { display: 'Integration Medical Group' },
        amountInCents: 2500,
        paymentMethod: 'cash',
        identifier: { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() },
        paymentDate: '2026-03-02',
        createdISO: '2026-03-02T15:00:00.000Z',
        disposition: 'Paid at the front desk',
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
      card: { brand: 'mastercard', last4: '4444' },
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

  it("lists every payment on the billing patient's visits with its visit and claim, newest first", async () => {
    const { statusCode, output } = await invokeZambdaHandler<ListBillingPatientAccountPaymentsResponse>(
      index,
      { patientId: billingPatientId },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output.visits).toEqual([
      expect.objectContaining({
        encounterId,
        appointmentId,
        visitDateISO,
        serviceMode: ServiceMode['in-person'],
        followUp: false,
        locationName: 'Integration Test Location',
      }),
    ]);
    const visitFields = { encounterId, appointmentId, visitDateISO, claimId, claimServiceDate: '2026-03-01' };
    expect(output.payments).toEqual([
      expect.objectContaining({
        ...visitFields,
        fhirPaymentNotificationId: cardNoticeId,
        method: 'card',
        dateISO: '2026-03-03',
        amountInCents: 4000,
        stripePaymentId: paymentIntentId,
        description: 'Visit copay',
        cardBrand: 'mastercard',
        cardLast4: '4444',
      }),
      expect.objectContaining({
        ...visitFields,
        fhirPaymentNotificationId: cashNoticeId,
        method: 'cash',
        dateISO: '2026-03-02',
        amountInCents: 2500,
        description: 'Paid at the front desk',
      }),
      expect.objectContaining({
        ...visitFields,
        fhirPaymentNotificationId: legacyNoticeId,
        method: 'check',
        amountInCents: 1500,
      }),
    ]);
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(paymentIntentId, expect.anything(), {
      stripeAccount,
    });
  }, 120_000);
});
