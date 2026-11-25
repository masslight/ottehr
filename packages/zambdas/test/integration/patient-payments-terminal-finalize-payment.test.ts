import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Location, PaymentNotice, PaymentReconciliation, Practitioner, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { FinalizePatientPaymentTerminalResponse } from 'utils/lib/types/api/patient-payment-types';
import { TaskIndicator } from 'utils/lib/types/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/patient-payments/terminal/finalize-payment/index';
import { practitionerFirstLastName } from '../../src/shared/practitioners';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../src/shared/stripeIntegration';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

const stripe = vi.hoisted(() => ({
  paymentIntents: { retrieve: vi.fn() },
  paymentMethods: { retrieve: vi.fn(), list: vi.fn(), detach: vi.fn() },
  customers: { update: vi.fn() },
}));

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/stripeIntegration')>()),
  getStripeClient: () => stripe,
}));

// A requested sync task would start the deployed Candid-sync/receipt subscription in the shared project.
vi.mock('utils/lib/fhir/helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils/lib/fhir/helpers')>();
  return {
    ...actual,
    getTaskResource: (...args: Parameters<typeof actual.getTaskResource>) => ({
      ...actual.getTaskResource(...args),
      status: 'draft',
    }),
  };
});

describe('patient-payments-terminal-finalize-payment integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let callerProfile: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let paymentNoticeId: string | undefined;
  const stripeAccount = `acct_it_${randomUUID().slice(0, 8)}`;
  const stripeCustomerId = `cus_it_${randomUUID().slice(0, 8)}`;
  const paymentIntentId = `pi_it_${randomUUID().slice(0, 8)}`;
  const generatedCardId = `pm_it_${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'patient-payments-terminal-finalize-payment.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    callerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);

    const locationId = getIdFromReference(base.encounter.location?.[0]?.location?.reference, 'Location')!;
    await oystehr.fhir.patch<Location>({
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
        params: [{ name: 'patient', value: `Patient/${base.patient.id}` }],
      })
    ).unbundle();
    await oystehr.fhir.patch<Account>({
      resourceType: 'Account',
      id: account.id!,
      operations: [
        {
          op: 'add',
          path: '/identifier',
          value: [
            {
              system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
              value: stripeCustomerId,
              extension: [{ url: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT, valueString: stripeAccount }],
            },
          ],
        },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    if (paymentNoticeId) {
      const tasks = (
        await oystehr.fhir.search<Task>({
          resourceType: 'Task',
          params: [{ name: 'focus', value: `PaymentNotice/${paymentNoticeId}` }],
        })
      ).unbundle();
      for (const task of tasks) {
        await oystehr.fhir.delete({ resourceType: 'Task', id: task.id! }).catch(() => undefined);
      }
      await oystehr.fhir.delete({ resourceType: 'PaymentNotice', id: paymentNoticeId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('records the succeeded terminal payment and makes its card the default for the customer', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({
      id: paymentIntentId,
      status: 'succeeded',
      amount: 4250,
      amount_received: 4250,
      latest_charge: {
        payment_method_details: { type: 'card_present', card_present: { generated_card: generatedCardId } },
      },
    });
    stripe.paymentMethods.retrieve.mockResolvedValueOnce({
      id: generatedCardId,
      card: { fingerprint: 'fp_it' },
      customer: stripeCustomerId,
    });
    stripe.paymentMethods.list.mockResolvedValueOnce({ data: [] });
    stripe.customers.update.mockResolvedValueOnce({ id: stripeCustomerId });

    const { statusCode, output } = await invokeZambdaHandler<FinalizePatientPaymentTerminalResponse>(
      index,
      { patientId: base.patient.id, encounterId: base.encounter.id, paymentIntentId },
      { token }
    );
    paymentNoticeId = output.paymentNoticeId;

    expect(statusCode).toBe(200);
    expect(output).toEqual({
      patientId: base.patient.id,
      encounterId: base.encounter.id,
      paymentIntentId,
      paymentNoticeId: expect.any(String),
      defaultPaymentMethodId: generatedCardId,
    });
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(
      paymentIntentId,
      { expand: ['latest_charge'] },
      { stripeAccount }
    );
    expect(stripe.customers.update).toHaveBeenCalledWith(
      stripeCustomerId,
      { invoice_settings: { default_payment_method: generatedCardId } },
      { stripeAccount }
    );

    const caller = await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: getIdFromReference(callerProfile, 'Practitioner')!,
    });
    const notice = await oystehr.fhir.get<PaymentNotice>({
      resourceType: 'PaymentNotice',
      id: output.paymentNoticeId!,
    });
    expect(notice.request?.reference).toBe(`Encounter/${base.encounter.id}`);
    expect(notice.amount).toEqual({ value: 42.5, currency: 'USD' });
    expect(notice.identifier).toEqual([{ system: STRIPE_PAYMENT_ID_SYSTEM, value: paymentIntentId }]);
    const reconciliation = notice.contained?.find(
      (resource): resource is PaymentReconciliation => resource.resourceType === 'PaymentReconciliation'
    );
    expect(reconciliation?.detail?.[0]?.submitter).toEqual({
      reference: callerProfile,
      display: practitionerFirstLastName(caller),
    });

    const [task] = (
      await oystehr.fhir.search<Task>({
        resourceType: 'Task',
        params: [{ name: 'focus', value: `PaymentNotice/${output.paymentNoticeId}` }],
      })
    ).unbundle();
    expect(task).toMatchObject({
      status: 'draft',
      encounter: { reference: `Encounter/${base.encounter.id}` },
      code: { coding: [TaskIndicator.patientPaymentCandidSyncAndReceipt] },
    });
  });
});
