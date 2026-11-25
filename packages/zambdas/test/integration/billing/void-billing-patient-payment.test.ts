import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Organization, PaymentNotice, Practitioner, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { parsePaymentVoidFromNotice } from 'utils/lib/fhir/paymentRefunds';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { VoidPatientPaymentResponse } from 'utils/lib/types/api/patient-payment-types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildPaymentNotice, MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM } from '../../../src/billing/payments';
import { index } from '../../../src/billing/void-billing-patient-payment/index';
import { getAuth0Token } from '../../../src/shared/getAuth0Token';
import { getStripeClient } from '../../../src/shared/stripeIntegration';
import { SECRETS } from '../../data/secrets';
import {
  addProcessIdMetaTagToResource,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../../helpers/invoke-zambda-handler';

vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/stripeIntegration')>();
  return { ...actual, getStripeClient: vi.fn(() => ({})) };
});

describe('void-billing-patient-payment', () => {
  let oystehr: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const adminFamily = `Admin${randomUUID().slice(0, 8)}`;
  let billingAdminToken: string;
  let billingAdminProfile: string;
  let billingAdminM2MId: string | undefined;
  let encounterId: string;
  let locationId: string | undefined;
  let noticeId: string;

  const seed = async <T extends FhirResource>(client: Oystehr, resource: T): Promise<string> => {
    const created = await client.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/void-billing-patient-payment.test.ts',
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
    const providerId = await seed<Organization>(setup.oystehrBilling, {
      resourceType: 'Organization',
      active: true,
      name: 'Integration Medical Group',
    });
    const claimId = await seed<Claim>(setup.oystehrBilling, {
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
    noticeId = await seed<PaymentNotice>(
      setup.oystehrBilling,
      buildPaymentNotice({
        request: {
          type: 'Claim',
          reference: `Claim/${claimId}`,
          identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId },
        },
        payee: { reference: `Organization/${providerId}` },
        amountInCents: 4500,
        paymentMethod: 'check',
        identifier: { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() },
        paymentDate: '2026-04-02',
        createdISO: '2026-04-02T15:00:00.000Z',
        disposition: 'check payment collected manually',
      })
    );
  }, 120_000);

  afterAll(async () => {
    try {
      const history = (
        await oystehr.fhir.search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: `PaymentNotice/${noticeId}` }],
        })
      ).unbundle();
      if (history.length > 0) {
        await oystehr.fhir.batch({
          requests: history.map(
            (entry): BatchInputDeleteRequest => ({ method: 'DELETE', url: `Provenance/${entry.id}` })
          ),
        });
      }
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

  it('cancels the check payment and stamps who voided it and why', async () => {
    const { statusCode, output } = await invokeZambdaHandler<VoidPatientPaymentResponse>(
      index,
      { encounterId, paymentNoticeId: noticeId, reason: 'Entered in error', notes: 'Recorded on the wrong visit' },
      { token: billingAdminToken }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual({ paymentNoticeId: noticeId, voidedBillingNoticeCount: 1 });
    const notice = await oystehr.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id: noticeId });
    expect(notice.status).toBe('cancelled');
    expect(parsePaymentVoidFromNotice(notice)).toEqual({
      reason: 'Entered in error',
      notes: 'Recorded on the wrong visit',
      voidedAtISO: expect.any(String),
      voidedBy: `Billing ${adminFamily}`,
      voidedByReference: billingAdminProfile,
    });
    expect(getStripeClient).not.toHaveBeenCalled();

    const history = (
      await oystehr.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `PaymentNotice/${noticeId}` }],
      })
    ).unbundle();
    expect(history.map((entry) => entry.agent[0].who?.reference)).toContain(billingAdminProfile);
  }, 120_000);
});
