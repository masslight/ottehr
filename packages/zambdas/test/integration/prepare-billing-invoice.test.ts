import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Basic, Schedule, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  RcmTaskCodings,
  TIMEZONE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getFullName } from 'utils/lib/fhir/patient';
import { BRANDING_CONFIG } from 'utils/lib/ottehr-config/branding';
import { PrepareBillingInvoiceResponse } from 'utils/lib/types/api/invoicing.types';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/prepare-billing-invoice/index';
import { isInvoicedFromBillingApp } from '../../src/shared/invoice-tasks';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

const { retrieveCustomer } = vi.hoisted(() => ({ retrieveCustomer: vi.fn() }));

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/stripeIntegration')>()),
  getStripeClient: () => ({ customers: { retrieve: retrieveCustomer } }),
}));

describe('prepare-billing-invoice integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let schedule: Schedule;
  let ehrInvoiceTask: Task;
  const stripeCustomerId = `cus_${randomUUID().replace(/-/g, '')}`;
  const timezone = 'America/Chicago';

  beforeAll(async () => {
    const setup = await setupIntegrationTest('prepare-billing-invoice.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);
    const locationReference = base.appointment.participant.find(
      (participant) => participant.actor?.reference?.startsWith('Location/')
    )!.actor!.reference!;

    const account = (
      await oystehr.fhir.search<Account>({
        resourceType: 'Account',
        params: [{ name: 'patient', value: `Patient/${base.patient.id}` }],
      })
    ).unbundle()[0];
    [, schedule, ehrInvoiceTask] = await Promise.all([
      oystehr.fhir.patch<Account>({
        resourceType: 'Account',
        id: account.id!,
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [{ system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE, value: stripeCustomerId }],
          },
        ],
      }),
      oystehr.fhir.create<Schedule>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Schedule',
            active: true,
            actor: [{ reference: locationReference }],
            extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: timezone }],
          },
          setup.processId
        ) as Schedule
      ),
      oystehr.fhir.create<Task>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Task',
            status: 'ready',
            intent: 'order',
            code: RcmTaskCodings.sendInvoiceToPatient,
            encounter: { reference: `Encounter/${base.encounter.id}` },
            for: { reference: `Patient/${base.patient.id}` },
          },
          setup.processId
        ) as Task
      ),
    ]);
    retrieveCustomer.mockResolvedValue({ id: stripeCustomerId, email: 'jon.snow@example.com' });
  }, 60_000);

  afterAll(async () => {
    const markers = (
      await oystehr.fhir.search<Basic>({
        resourceType: 'Basic',
        params: [{ name: 'subject', value: `Encounter/${base.encounter.id}` }],
      })
    ).unbundle();
    for (const marker of markers) {
      await oystehr.fhir.delete({ resourceType: 'Basic', id: marker.id! }).catch(() => undefined);
    }
    if (ehrInvoiceTask?.id) {
      await oystehr.fhir.delete({ resourceType: 'Task', id: ehrInvoiceTask.id }).catch(() => undefined);
    }
    if (schedule?.id) {
      await oystehr.fhir.delete({ resourceType: 'Schedule', id: schedule.id }).catch(() => undefined);
    }
    await cleanup();
  });

  it('takes the visit over from the EHR and returns the invoice customer, timezone and placeholders', async () => {
    const { statusCode, output } = await invokeZambdaHandler<PrepareBillingInvoiceResponse>(
      index,
      { encounterId: base.encounter.id },
      {
        token,
        secrets: { ...loadZambdaSecrets(), BILLING_INTEGRATION: 'ottehr', INVOICING_IN_BILLING_APP: 'true' },
      }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual({
      patientId: base.patient.id,
      stripeCustomerId,
      timezone,
      placeholders: expect.objectContaining({
        patientFullName: getFullName(base.patient),
        clinic: BRANDING_CONFIG.projectName,
        location: 'Integration Test Location',
        visitDate: formatDateToMDYWithTime(base.appointment.start, timezone)!.date,
      }),
    });
    expect(retrieveCustomer).toHaveBeenCalledWith(stripeCustomerId, { stripeAccount: undefined });

    const cancelledTask = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: ehrInvoiceTask.id! });
    expect(cancelledTask.status).toBe('cancelled');
    expect(await isInvoicedFromBillingApp(oystehr, base.encounter.id!)).toBe(true);
  });
});
