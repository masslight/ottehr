import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Organization, PaymentNotice, Practitioner, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PAYMENT_METHOD_EXTENSION_URL, PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { parsePaymentRefundsFromNotice } from 'utils/lib/fhir/paymentRefunds';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { RefundPatientPaymentResponse } from 'utils/lib/types/api/patient-payment-types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  buildPaymentNotice,
  EHR_PATIENT_PAYMENT_ID_SYSTEM,
  MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
  MANUAL_REFUND_ID_SYSTEM,
} from '../../../src/billing/payments';
import { index } from '../../../src/billing/refund-billing-patient-payment/index';
import { getAuth0Token } from '../../../src/shared/getAuth0Token';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';
import { SECRETS } from '../../data/secrets';
import {
  addProcessIdMetaTagToResource,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../../helpers/integration-test-seed-data-setup';
import { InvokedZambdaResponse, invokeZambdaHandler } from '../../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const { stripe, candidApiClient, syncCandidPatientRefunds } = vi.hoisted(() => ({
  stripe: { refunds: { list: vi.fn(), create: vi.fn() } },
  candidApiClient: { name: 'candid-api-client' },
  syncCandidPatientRefunds: vi.fn(),
}));

vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/stripeIntegration')>();
  return { ...actual, getStripeClient: vi.fn(() => stripe) };
});

vi.mock('../../../src/shared/candid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/candid')>();
  return { ...actual, syncCandidPatientRefunds };
});

vi.mock('utils/lib/helpers/candidApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils/lib/helpers/candidApi')>();
  return { ...actual, getOrCreateCandidApiClient: vi.fn(async () => candidApiClient) };
});

describe('refund-billing-patient-payment', () => {
  let oystehr: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const stripeAccount = `acct_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const paymentIntentId = `pi_${randomUUID().replace(/-/g, '')}`;
  const adminFamily = `Admin${randomUUID().slice(0, 8)}`;
  let billingAdminToken: string;
  let billingAdminProfile: string;
  let billingAdminM2MId: string | undefined;
  let encounterId: string;
  let locationId: string | undefined;
  let providerId: string;
  let claimId: string;
  let cashNoticeId: string;
  let cardNoticeId: string;

  const seed = async <T extends FhirResource>(client: Oystehr, resource: T): Promise<string> => {
    const created = await client.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  const refund = (body: Record<string, unknown>): Promise<InvokedZambdaResponse<RefundPatientPaymentResponse>> =>
    invokeZambdaHandler<RefundPatientPaymentResponse>(index, body, { token: billingAdminToken });

  const fetchNotice = (id: string): Promise<PaymentNotice> =>
    oystehr.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id });

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/refund-billing-patient-payment.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    cleanup = setup.cleanup;
    processId = setup.processId;

    const billingAdminRoleId = (await oystehr.role.list()).find((role) => role.name === RoleType.BillingAdmin)?.id;
    if (!billingAdminRoleId) throw new Error('The project has no BillingAdmin role');
    billingAdminProfile = `Practitioner/${await seed<Practitioner>(oystehr, {
      resourceType: 'Practitioner',
      name: [{ given: ['Billing'], family: adminFamily }],
    })}`;
    billingAdminM2MId = (
      await oystehr.m2m.create({
        name: `integration-billing-admin-${randomUUID()}`,
        description: M2MClientMockType.provider,
        profile: billingAdminProfile,
        roles: [billingAdminRoleId],
      })
    ).id;
    const { secret } = await oystehr.m2m.rotateSecret({ id: billingAdminM2MId });
    billingAdminToken = await getAuth0Token({
      AUTH0_ENDPOINT: SECRETS.AUTH0_ENDPOINT,
      AUTH0_CLIENT: (await oystehr.m2m.get({ id: billingAdminM2MId })).clientId,
      AUTH0_SECRET: secret,
      AUTH0_AUDIENCE: SECRETS.AUTH0_AUDIENCE,
    });

    const visit = await insertInPersonAppointmentBase(oystehr, processId);
    encounterId = visit.encounter.id!;
    locationId = visit.appointment.participant
      .find((participant) => participant.actor?.reference?.startsWith('Location/'))
      ?.actor?.reference?.split('/')[1];
    if (locationId) seededDeletes.push({ method: 'DELETE', url: `Location/${locationId}` });
    providerId = await seed<Organization>(setup.oystehrBilling, {
      resourceType: 'Organization',
      active: true,
      name: 'Integration Medical Group',
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
    const claimRequest = {
      type: 'Claim',
      reference: `Claim/${claimId}`,
      identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId },
    };
    cashNoticeId = await seed<PaymentNotice>(
      setup.oystehrBilling,
      buildPaymentNotice({
        request: claimRequest,
        payee: { reference: `Organization/${providerId}` },
        amountInCents: 5000,
        paymentMethod: 'cash',
        identifier: { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() },
        paymentDate: '2026-04-02',
        createdISO: '2026-04-02T15:00:00.000Z',
        disposition: 'cash payment collected manually',
      })
    );
    cardNoticeId = await seed<PaymentNotice>(setup.oystehrBilling, {
      resourceType: 'PaymentNotice',
      status: 'active',
      request: claimRequest,
      created: '2026-04-03T15:00:00.000Z',
      paymentDate: '2026-04-03',
      amount: { value: 30, currency: 'USD' },
      identifier: [
        { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: `${encounterId}_${randomUUID()}` },
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: paymentIntentId },
      ],
      extension: [
        { url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' },
        { url: PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL, valueString: stripeAccount },
      ],
      payment: { display: 'Stripe card payment' },
      payee: { reference: `Organization/${providerId}` },
      recipient: { reference: `Organization/${providerId}` },
    });
  }, 120_000);

  afterAll(async () => {
    try {
      const refundNotices = (
        await oystehr.fhir.search<PaymentNotice>({
          resourceType: 'PaymentNotice',
          params: [{ name: 'request', value: `Claim/${claimId}` }],
        })
      ).unbundle();
      const history = (
        await oystehr.fhir.search<Provenance>({
          resourceType: 'Provenance',
          params: [
            {
              name: 'target',
              value: [`Claim/${claimId}`, ...refundNotices.map((notice) => `PaymentNotice/${notice.id}`)].join(','),
            },
          ],
        })
      ).unbundle();
      const seededUrls = new Set(seededDeletes.map(({ url }) => url));
      await oystehr.fhir.batch({
        requests: [...history, ...refundNotices]
          .map((resource) => `${resource.resourceType}/${resource.id}`)
          .filter((url) => !seededUrls.has(url))
          .map((url): BatchInputDeleteRequest => ({ method: 'DELETE', url })),
      });
      await oystehr.fhir.batch({
        requests: seededDeletes,
      });
    } catch (error) {
      console.error('Failed to clean up fixtures; the run-tag sweep will retry:', error);
    }
    try {
      if (billingAdminM2MId) await oystehr.m2m.delete({ id: billingAdminM2MId });
    } catch (error) {
      console.error(`Failed to delete M2M client ${billingAdminM2MId}:`, error);
    }
    await cleanup();
  }, 120_000);

  it('records a partial cash refund on the payment with its AR offset and syncs it to Candid', async () => {
    const idempotencyKey = randomUUID();
    const refundId = `manual_${cashNoticeId}_${idempotencyKey}`;

    const { statusCode, output } = await refund({
      encounterId,
      paymentNoticeId: cashNoticeId,
      reason: 'Overcharge',
      notes: 'Copay was lower',
      amountInCents: 2000,
      idempotencyKey,
    });

    expect(statusCode).toBe(200);
    expect(output).toEqual({ refundId, amountInCents: 2000 });
    const stamped = parsePaymentRefundsFromNotice(await fetchNotice(cashNoticeId));
    expect(stamped).toEqual([
      expect.objectContaining({
        stripeRefundId: refundId,
        amountInCents: 2000,
        status: 'succeeded',
        reason: 'Overcharge',
        notes: 'Copay was lower',
        refundedBy: `Billing ${adminFamily}`,
        refundedByReference: billingAdminProfile,
      }),
    ]);

    const [offset] = (
      await oystehr.fhir.search<PaymentNotice>({
        resourceType: 'PaymentNotice',
        params: [{ name: 'identifier', value: `${MANUAL_REFUND_ID_SYSTEM}|${refundId}` }],
      })
    ).unbundle();
    expect(offset).toMatchObject({
      status: 'active',
      amount: { value: -20, currency: 'USD' },
      request: { reference: `Claim/${claimId}` },
      payee: { reference: `Organization/${providerId}` },
    });

    expect(syncCandidPatientRefunds).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId,
        candidApiClient,
        refunds: [expect.objectContaining({ stripeRefundId: refundId, amountInCents: 2000 })],
      })
    );
    expect(stripe.refunds.create).not.toHaveBeenCalled();

    const history = (
      await oystehr.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `PaymentNotice/${cashNoticeId}` }],
      })
    ).unbundle();
    expect(history.map((entry) => entry.agent[0].who?.reference)).toContain(billingAdminProfile);
  }, 120_000);

  it('refunds the rest of a card payment through Stripe and stamps the Stripe refund on the payment', async () => {
    const idempotencyKey = randomUUID();
    const operationKey = `${cardNoticeId}_${idempotencyKey}`;
    stripe.refunds.list.mockResolvedValue({ data: [] });
    stripe.refunds.create.mockImplementation(async (params: { amount: number; metadata: Record<string, string> }) => ({
      id: 're_integration_card',
      amount: params.amount,
      status: 'succeeded',
      created: 1_775_000_000,
      reason: 'requested_by_customer',
      metadata: params.metadata,
    }));

    const { statusCode, output } = await refund({
      encounterId,
      paymentNoticeId: cardNoticeId,
      reason: 'Service not provided',
      idempotencyKey,
    });

    expect(statusCode).toBe(200);
    expect(output).toEqual({ refundId: 're_integration_card', amountInCents: 3000 });
    expect(stripe.refunds.list).toHaveBeenCalledWith(
      { payment_intent: paymentIntentId, limit: 100 },
      { stripeAccount }
    );
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: paymentIntentId,
        amount: 3000,
        reason: 'requested_by_customer',
        metadata: expect.objectContaining({
          reason: 'Service not provided',
          refundedBy: `Billing ${adminFamily}`,
          refundedByReference: billingAdminProfile,
          operationKey,
        }),
      }),
      { stripeAccount, idempotencyKey: `refund_${operationKey}` }
    );
    expect(parsePaymentRefundsFromNotice(await fetchNotice(cardNoticeId))).toEqual([
      expect.objectContaining({
        stripeRefundId: 're_integration_card',
        amountInCents: 3000,
        status: 'succeeded',
        reason: 'Service not provided',
        refundedByReference: billingAdminProfile,
      }),
    ]);
  }, 120_000);
});
