import Oystehr from '@oystehr/sdk';
import { Communication } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getFullName } from 'utils/lib/fhir/patient';
import { formatInvoiceDate } from 'utils/lib/helpers/rcm/invoice-config';
import { SendBillingOutreachNotificationResponse } from 'utils/lib/types/api/invoicing.types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/send-billing-outreach-notification/index';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const { sendSmsForPatient, sendGenericOutreachEmail } = vi.hoisted(() => ({
  sendSmsForPatient: vi.fn(),
  sendGenericOutreachEmail: vi.fn(),
}));

vi.mock('../../src/shared/communication', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/communication')>()),
  sendSmsForPatient,
  getEmailClient: () => ({ sendGenericOutreachEmail }),
}));

describe('send-billing-outreach-notification integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let emailCommunications: Communication[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('send-billing-outreach-notification.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);
    sendSmsForPatient.mockResolvedValue({ total: 1, sent: 1, failures: [] });
    sendGenericOutreachEmail.mockResolvedValue(undefined);
  }, 60_000);

  afterAll(async () => {
    for (const communication of emailCommunications) {
      await oystehr.fhir.delete({ resourceType: 'Communication', id: communication.id! }).catch(() => undefined);
    }
    await cleanup();
  });

  it('fills the templates from the visit and the invoice values and sends them by SMS and email', async () => {
    const { statusCode, output } = await invokeZambdaHandler<SendBillingOutreachNotificationResponse>(
      index,
      {
        encounterId: base.encounter.id,
        mediums: ['sms', 'email'],
        smsTemplate: 'Hi {{patient-full-name}}, your {{location}} visit on {{visit-date}} has {{amount}} due',
        emailTemplate: 'Your {{location}} invoice of {{amount}} is due {{due-date}}: {{invoice-link}}',
        amountCents: 12500,
        dueDate: '2026-12-31',
        invoiceLink: 'https://invoice.example.com/pay',
      },
      {
        token,
        secrets: { ...loadZambdaSecrets(), BILLING_INTEGRATION: 'ottehr', INVOICING_IN_BILLING_APP: 'true' },
      }
    );

    expect(statusCode).toBe(200);
    expect(output.results).toEqual([
      { medium: 'sms', success: true },
      { medium: 'email', success: true },
    ]);

    const location = 'Integration Test Location';
    expect(sendSmsForPatient).toHaveBeenCalledTimes(1);
    const [smsMessage, , smsPatient] = sendSmsForPatient.mock.calls[0];
    expect(smsMessage).toBe(
      `Hi ${getFullName(base.patient)}, your ${location} visit on ${formatInvoiceDate(
        base.appointment.start
      )} has $125.00 due`
    );
    expect(smsPatient.id).toBe(base.patient.id);

    expect(sendGenericOutreachEmail).toHaveBeenCalledTimes(1);
    const [emailAddress, emailData] = sendGenericOutreachEmail.mock.calls[0];
    expect(emailAddress).toBe('john.doe@example.com');
    expect(emailData['subject-text']).toBe('Important information about your visit');
    expect(emailData.content).toContain(
      `Your ${location} invoice of $125.00 is due ${formatInvoiceDate('2026-12-31')}`
    );

    emailCommunications = (
      await oystehr.fhir.search<Communication>({
        resourceType: 'Communication',
        params: [
          { name: 'subject', value: `Patient/${base.patient.id}` },
          { name: 'encounter', value: `Encounter/${base.encounter.id}` },
        ],
      })
    ).unbundle();
    expect(emailCommunications).toHaveLength(1);
    expect(emailCommunications[0]).toMatchObject({
      status: 'completed',
      medium: [{ coding: [{ code: 'EMAILWRIT' }] }],
    });
  });
});
