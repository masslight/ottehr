import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Appointment, Communication, Encounter, FhirResource, Location, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE, PATIENT_BILLING_ACCOUNT_TYPE } from 'utils/lib/fhir/constants';
import { getFullName } from 'utils/lib/fhir/patient';
import { formatInvoiceAmount, formatInvoiceDate } from 'utils/lib/helpers/rcm/invoice-config';
import { ChargeCardConfig } from 'utils/lib/types/api/scheduled-outreach.types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  OUTREACH_ACTION_TYPE_SYSTEM,
  OUTREACH_PLATFORM_STRIPE_ACCOUNT,
  OUTREACH_STRIPE_ACCOUNT_INPUT,
} from '../../src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import { sendSmsForPatient } from '../../src/shared/communication';
import { STRIPE_METADATA_KEYS } from '../../src/shared/stripeIntegration';
import { index } from '../../src/subscriptions/task/sub-outreach-charge-card/index';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM } from '../helpers/integration-tags';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const fakes = vi.hoisted(() => ({
  encounterId: '',
  sendGenericOutreachEmail: vi.fn(async () => undefined),
  searchInvoices: vi.fn(),
  payInvoice: vi.fn(async () => ({ status: 'paid', charge: 'ch_integration_test' })),
  retrieveCustomer: vi.fn(async () => ({
    id: 'cus_integration_test',
    invoice_settings: { default_payment_method: 'pm_1' },
  })),
}));

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/shared/stripeIntegration')>();
  return {
    ...actual,
    getStripeClient: () => ({
      invoices: { search: fakes.searchInvoices, pay: fakes.payInvoice },
      customers: { retrieve: fakes.retrieveCustomer },
    }),
  };
});

vi.mock('../../src/shared/communication', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/shared/communication')>();
  return {
    ...actual,
    sendSmsForPatient: vi.fn(async () => ({ total: 1, sent: 1, failures: [] })),
    getEmailClient: () => ({ sendGenericOutreachEmail: fakes.sendGenericOutreachEmail }),
  };
});

const deleteTaggedResources = async (
  oystehr: Oystehr,
  processId: string,
  resourceTypes: FhirResource['resourceType'][]
): Promise<void> => {
  for (const resourceType of resourceTypes) {
    const resources = (
      await oystehr.fhir.search<FhirResource>({
        resourceType,
        params: [{ name: '_tag', value: `${INTEGRATION_TEST_PROCESS_ID_SYSTEM}|${processId}` }],
      })
    ).unbundle();
    await Promise.all(
      resources.map((resource) => oystehr.fhir.delete({ resourceType, id: resource.id! }).catch(() => undefined))
    );
  }
};

const APPOINTMENT_START = '2026-03-16T18:30:00.000Z';
const DUE_DATE = '2026-04-15';
const AMOUNT_DUE_CENTS = 4200;
const INVOICE_ID = 'in_integration_test';
const INVOICE_LINK = 'https://invoice.stripe.example/i/charge-card-test';
const STRIPE_CUSTOMER_ID = 'cus_integration_test';
const PATIENT_EMAIL = 'rickon.outreach@example.com';

describe('sub-outreach-charge-card', () => {
  let oystehr: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;
  let location: Location;
  let patient: Patient;
  let encounter: Encounter;
  let task: Task;

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sub-outreach-charge-card.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    processId = setup.processId;
    cleanup = setup.cleanup;

    location = await oystehr.fhir.create<Location>(
      tagged({ resourceType: 'Location', status: 'active', name: `Charge Card Clinic ${randomUUID()}` })
    );
    patient = await oystehr.fhir.create<Patient>(
      tagged({
        resourceType: 'Patient',
        active: true,
        name: [{ given: ['Rickon'], family: 'Stark' }],
        birthDate: '2012-09-09',
        telecom: [
          { system: 'phone', value: '+12125550148' },
          { system: 'email', value: PATIENT_EMAIL },
        ],
      })
    );
    await oystehr.fhir.create<Account>(
      tagged({
        resourceType: 'Account',
        status: 'active',
        type: PATIENT_BILLING_ACCOUNT_TYPE,
        subject: [{ reference: `Patient/${patient.id}` }],
        identifier: [{ system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE, value: STRIPE_CUSTOMER_ID }],
      })
    );
    const appointment = await oystehr.fhir.create<Appointment>(
      tagged({
        resourceType: 'Appointment',
        status: 'fulfilled',
        start: APPOINTMENT_START,
        end: '2026-03-16T18:45:00.000Z',
        participant: [
          { actor: { reference: `Patient/${patient.id}` }, status: 'accepted' },
          { actor: { reference: `Location/${location.id}` }, status: 'accepted' },
        ],
      })
    );
    encounter = await oystehr.fhir.create<Encounter>(
      tagged({
        resourceType: 'Encounter',
        status: 'finished',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
        subject: { reference: `Patient/${patient.id}` },
        appointment: [{ reference: `Appointment/${appointment.id}` }],
      })
    );
    fakes.encounterId = encounter.id!;
    fakes.searchInvoices.mockImplementation(async () => ({
      data: [
        {
          id: INVOICE_ID,
          status: 'open',
          amount_due: AMOUNT_DUE_CENTS,
          due_date: DateTime.fromISO(`${DUE_DATE}T12:00:00Z`).toUnixInteger(),
          hosted_invoice_url: INVOICE_LINK,
          metadata: { [STRIPE_METADATA_KEYS.encounterId]: fakes.encounterId },
        },
      ],
    }));

    const config: ChargeCardConfig = {
      onSuccess: {
        enabled: true,
        mediums: ['sms', 'email'],
        smsTemplate:
          'Thanks {{patient-full-name}}, we charged {{amount}} for your {{visit-date}} visit at {{location}}: {{invoice-link}}',
        emailTemplate: 'Your {{location}} invoice of {{amount}} due {{due-date}} is paid.',
      },
      onFailure: { enabled: false, mediums: [], smsTemplate: '', emailTemplate: '' },
      retryAttempts: 0,
      retryIntervalDays: 0,
    };

    task = await oystehr.fhir.create<Task>(
      tagged({
        resourceType: 'Task',
        status: 'draft',
        intent: 'order',
        code: { coding: [{ system: OUTREACH_ACTION_TYPE_SYSTEM, code: 'charge-card' }] },
        for: { reference: `Patient/${patient.id}` },
        focus: { reference: `Encounter/${encounter.id}` },
        executionPeriod: { start: DateTime.now().toISO()! },
        input: [
          { type: { text: 'charge-card-config' }, valueString: JSON.stringify(config) },
          { type: { text: OUTREACH_STRIPE_ACCOUNT_INPUT }, valueString: OUTREACH_PLATFORM_STRIPE_ACCOUNT },
        ],
      })
    );
  });

  afterAll(async () => {
    const communications = (
      await oystehr.fhir.search<Communication>({
        resourceType: 'Communication',
        params: [{ name: 'subject', value: `Patient/${patient.id}` }],
      })
    ).unbundle();
    await Promise.all(
      communications.map((communication) =>
        oystehr.fhir.delete({ resourceType: 'Communication', id: communication.id! }).catch(() => undefined)
      )
    );
    await cleanup();
    await deleteTaggedResources(oystehr, processId, [
      'Task',
      'Encounter',
      'Appointment',
      'Account',
      'Patient',
      'Location',
    ]);
  });

  it('pays the open Stripe invoice with the card on file and sends the success notifications', async () => {
    const { statusCode, output } = await invokeZambdaHandler<Record<string, unknown>>(index, {
      ...task,
      status: 'requested',
    });

    expect(statusCode).toBe(200);
    const chargeResult = {
      success: true,
      transactionId: 'ch_integration_test',
      amountCents: AMOUNT_DUE_CENTS,
      invoiceLink: INVOICE_LINK,
    };
    expect(output).toEqual({
      status: 'completed',
      attempt: 1,
      chargeResult,
      notificationResults: [
        { medium: 'sms', success: true },
        { medium: 'email', success: true },
      ],
    });

    expect(fakes.retrieveCustomer).toHaveBeenCalledWith(
      STRIPE_CUSTOMER_ID,
      { expand: ['invoice_settings.default_payment_method'] },
      { stripeAccount: undefined }
    );
    expect(fakes.payInvoice).toHaveBeenCalledWith(INVOICE_ID, { stripeAccount: undefined });

    expect(sendSmsForPatient).toHaveBeenCalledTimes(1);
    const [smsMessage, , smsPatient] = vi.mocked(sendSmsForPatient).mock.calls[0];
    expect(smsPatient?.id).toBe(patient.id);
    expect(smsMessage).toBe(
      `Thanks ${getFullName(patient)}, we charged ${formatInvoiceAmount(AMOUNT_DUE_CENTS)} for your ${formatInvoiceDate(
        APPOINTMENT_START
      )} visit at ${location.name}: ${INVOICE_LINK}`
    );

    expect(fakes.sendGenericOutreachEmail).toHaveBeenCalledTimes(1);
    const [emailTo, emailData] = fakes.sendGenericOutreachEmail.mock.calls[0] as unknown as [
      string,
      { content: string; 'subject-text': string },
    ];
    expect(emailTo).toBe(PATIENT_EMAIL);
    expect(emailData['subject-text']).toBe('Update regarding your visit');
    expect(emailData.content).toContain(
      `Your ${location.name} invoice of ${formatInvoiceAmount(AMOUNT_DUE_CENTS)} due ${formatInvoiceDate(
        DUE_DATE
      )} is paid.`
    );

    const [storedTask, communications] = await Promise.all([
      oystehr.fhir.get<Task>({ resourceType: 'Task', id: task.id! }),
      oystehr.fhir
        .search<Communication>({
          resourceType: 'Communication',
          params: [{ name: 'subject', value: `Patient/${patient.id}` }],
        })
        .then((bundle) => bundle.unbundle()),
    ]);
    expect(storedTask.status).toBe('completed');
    const storedChargeResult = storedTask.output?.find((entry) => entry.type?.text === 'charge-result')?.valueString;
    expect(JSON.parse(storedChargeResult ?? '{}')).toEqual(chargeResult);
    expect(storedTask.output?.find((entry) => entry.type?.text === 'attempt-1-result')?.valueString).toBe('success');
    expect(communications).toHaveLength(1);
    expect(communications[0].medium?.[0]?.coding?.[0]?.code).toBe('EMAILWRIT');
  });
});
