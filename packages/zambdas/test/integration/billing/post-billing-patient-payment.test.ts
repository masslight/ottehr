import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Account, Claim, FhirResource, Organization, PaymentNotice, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
  PAYMENT_METHOD_EXTENSION_URL,
  PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getPaymentNoticeSubmitterRef } from 'utils/lib/fhir/payments';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ensurePaymentTaskForNotice } from '../../../src/billing/patient-payments';
import { EHR_PATIENT_PAYMENT_ID_SYSTEM, EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM } from '../../../src/billing/payments';
import { index } from '../../../src/billing/post-billing-patient-payment/index';
import { STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { STRIPE_METADATA_KEYS, STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';
import {
  addProcessIdMetaTagToResource,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const stripe = vi.hoisted(() => ({
  paymentIntents: { create: vi.fn() },
}));

vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/stripeIntegration')>();
  return { ...actual, getStripeClient: vi.fn(() => stripe) };
});

vi.mock('../../../src/billing/patient-payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/billing/patient-payments')>();
  return { ...actual, ensurePaymentTaskForNotice: vi.fn() };
});

interface PostBillingPatientPaymentResponse {
  notice: PaymentNotice;
  patientId: string;
  encounterId: string;
}

describe('post-billing-patient-payment', () => {
  let oystehr: Oystehr;
  let token: string;
  let callerProfile: string;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const createdDeletes: BatchInputDeleteRequest[] = [];
  const suffix = randomUUID().replace(/-/g, '').slice(0, 16);
  const stripeAccount = `acct_${suffix}`;
  const customerId = `cus_${suffix}`;
  const paymentIntentId = `pi_${suffix}`;
  const chargeId = `ch_${suffix}`;
  let patientId: string;
  let encounterId: string;
  let locationId: string;
  let providerId: string;
  let claimId: string;

  const seed = async <T extends FhirResource>(client: Oystehr, resource: T): Promise<string> => {
    const created = await client.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/post-billing-patient-payment.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    callerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
    processId = setup.processId;

    const visit = await insertInPersonAppointmentBase(oystehr, processId);
    patientId = visit.patient.id!;
    encounterId = visit.encounter.id!;
    locationId = visit.appointment.participant
      .find((participant) => participant.actor?.reference?.startsWith('Location/'))!
      .actor!.reference!.split('/')[1];
    await oystehr.fhir.patch({
      resourceType: 'Location',
      id: locationId,
      operations: [
        {
          op: 'add',
          path: '/extension',
          value: [{ url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, valueString: stripeAccount }],
        },
      ],
    });
    const [account] = (
      await oystehr.fhir.search<Account>({
        resourceType: 'Account',
        params: [{ name: 'patient', value: `Patient/${patientId}` }],
      })
    ).unbundle();
    await oystehr.fhir.patch({
      resourceType: 'Account',
      id: account.id!,
      operations: [
        {
          op: 'add',
          path: '/identifier',
          value: [
            {
              system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
              value: customerId,
              extension: [{ url: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT, valueString: stripeAccount }],
            },
          ],
        },
      ],
    });

    providerId = await seed<Organization>(setup.oystehrBilling, {
      resourceType: 'Organization',
      active: true,
      name: 'Integration Medical Group',
      identifier: [{ system: STRIPE_ACCOUNT_IDENTIFIER_SYSTEM, value: stripeAccount }],
    });
    claimId = await seed<Claim>(setup.oystehrBilling, {
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      created: '2026-04-01',
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      patient: { display: 'Jon Snow' },
      provider: { reference: `Organization/${providerId}` },
      identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId }],
      total: { value: 150, currency: 'USD' },
      meta: { tag: claimStatusValuesToTags({ arStage: AR_STAGE.patient, patientArStatus: 'ready-to-invoice' }) },
    });

    stripe.paymentIntents.create.mockResolvedValue({
      id: paymentIntentId,
      status: 'succeeded',
      latest_charge: chargeId,
    });
  }, 120_000);

  afterAll(async () => {
    try {
      if (createdDeletes.length > 0) await oystehr.fhir.batch({ requests: createdDeletes });
      await oystehr.fhir.batch({ requests: [...seededDeletes, { method: 'DELETE', url: `Location/${locationId}` }] });
    } catch (error) {
      console.error('Failed to clean up fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  it("charges the patient's saved card on the visit's Stripe account and records it on the claim", async () => {
    const idempotencyKey = randomUUID();
    const body = {
      patientId,
      encounterId,
      paymentDetails: {
        paymentMethod: 'card',
        amountInCents: 8550,
        paymentMethodId: 'pm_integration_card',
        description: 'Visit copay',
        idempotencyKey,
      },
    };

    const { statusCode, output } = await invokeZambdaHandler<PostBillingPatientPaymentResponse>(index, body, {
      token,
    });
    const notice = output.notice;
    const history = (
      await oystehr.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `PaymentNotice/${notice.id}` }],
      })
    ).unbundle();
    createdDeletes.push(
      ...history.map(
        (resource): BatchInputDeleteRequest => ({ method: 'DELETE', url: `${resource.resourceType}/${resource.id}` })
      ),
      { method: 'DELETE', url: `PaymentNotice/${notice.id}` }
    );

    expect(statusCode).toBe(200);
    expect(output).toMatchObject({ patientId, encounterId });
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 8550,
        currency: 'usd',
        customer: customerId,
        payment_method: 'pm_integration_card',
        description: 'Visit copay',
        confirm: true,
        metadata: expect.objectContaining({
          [STRIPE_METADATA_KEYS.encounterId]: encounterId,
          [STRIPE_METADATA_KEYS.ehrPaymentId]: `${encounterId}_${idempotencyKey}`,
          [STRIPE_METADATA_KEYS.ehrPaymentNoticeId]: notice.id,
        }),
      }),
      { stripeAccount, idempotencyKey }
    );

    expect(notice).toMatchObject({
      status: 'active',
      amount: { value: 85.5, currency: 'USD' },
      request: { reference: `Claim/${claimId}` },
      payee: { reference: `Organization/${providerId}` },
    });
    expect(notice.identifier).toEqual(
      expect.arrayContaining([
        { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: `${encounterId}_${idempotencyKey}` },
        { system: EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM, value: `${encounterId}_${idempotencyKey}` },
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: paymentIntentId },
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: chargeId },
      ])
    );
    expect(notice.extension).toEqual(
      expect.arrayContaining([
        { url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' },
        { url: PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL, valueString: stripeAccount },
      ])
    );
    expect(getPaymentNoticeSubmitterRef(notice)?.reference).toBe(callerProfile);
    expect(getPaymentNoticeSubmitterRef(notice)?.display).toBeTruthy();

    expect(ensurePaymentTaskForNotice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: notice.id, status: 'active' }),
      encounterId
    );
    expect(history.map((entry) => entry.agent[0].who?.reference)).toEqual([callerProfile]);

    const replay = await invokeZambdaHandler<PostBillingPatientPaymentResponse>(index, body, { token });
    expect(replay.output.notice.id).toBe(notice.id);
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(ensurePaymentTaskForNotice).toHaveBeenCalledTimes(2);
  }, 120_000);
});
