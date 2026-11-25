import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, Communication, Encounter, FhirResource, Location, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { LOCATION_REVIEW_LINK_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getFullName } from 'utils/lib/fhir/patient';
import { formatInvoiceAmount, formatInvoiceDate } from 'utils/lib/helpers/rcm/invoice-config';
import { OutreachMediumResult } from 'utils/lib/types/api/scheduled-outreach.types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  OUTREACH_ACTION_TYPE_SYSTEM,
  OUTREACH_PLATFORM_STRIPE_ACCOUNT,
  OUTREACH_STRIPE_ACCOUNT_INPUT,
} from '../../src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import { sendSmsForPatient } from '../../src/shared/communication';
import { STRIPE_METADATA_KEYS } from '../../src/shared/stripeIntegration';
import { index } from '../../src/subscriptions/task/sub-outreach-send-notification/index';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM } from '../helpers/integration-tags';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

const fakes = vi.hoisted(() => ({
  encounterId: '',
  sendGenericOutreachEmail: vi.fn(async () => undefined),
  searchInvoices: vi.fn(),
}));

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/shared/stripeIntegration')>();
  return { ...actual, getStripeClient: () => ({ invoices: { search: fakes.searchInvoices } }) };
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
const AMOUNT_DUE_CENTS = 12345;
const INVOICE_LINK = 'https://invoice.stripe.example/i/integration-test';
const REVIEW_LINK = 'https://reviews.example/integration-clinic';
const PATIENT_EMAIL = 'bran.outreach@example.com';

describe('sub-outreach-send-notification', () => {
  let oystehr: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;
  let location: Location;
  let patient: Patient;
  let encounter: Encounter;
  let task: Task;

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sub-outreach-send-notification.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    processId = setup.processId;
    cleanup = setup.cleanup;

    location = await oystehr.fhir.create<Location>(
      tagged({
        resourceType: 'Location',
        status: 'active',
        name: `Outreach Clinic ${randomUUID()}`,
        extension: [{ url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: REVIEW_LINK }],
      })
    );
    patient = await oystehr.fhir.create<Patient>(
      tagged({
        resourceType: 'Patient',
        active: true,
        name: [{ given: ['Bran'], family: 'Stark' }],
        birthDate: '2010-04-01',
        telecom: [
          { system: 'phone', value: '+12125550147' },
          { system: 'email', value: PATIENT_EMAIL },
        ],
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
          id: 'in_integration_test',
          amount_due: AMOUNT_DUE_CENTS,
          due_date: DateTime.fromISO(`${DUE_DATE}T12:00:00Z`).toUnixInteger(),
          hosted_invoice_url: INVOICE_LINK,
          metadata: { [STRIPE_METADATA_KEYS.encounterId]: fakes.encounterId },
        },
      ],
    }));

    task = await oystehr.fhir.create<Task>(
      tagged({
        resourceType: 'Task',
        status: 'draft',
        intent: 'order',
        code: { coding: [{ system: OUTREACH_ACTION_TYPE_SYSTEM, code: 'send-notification' }] },
        for: { reference: `Patient/${patient.id}` },
        focus: { reference: `Encounter/${encounter.id}` },
        executionPeriod: { start: DateTime.now().toISO()! },
        input: [
          { type: { text: 'mediums' }, valueString: 'sms,email' },
          {
            type: { text: 'sms-template' },
            valueString:
              'Hi {{patient-full-name}}, you owe {{amount}} for your {{visit-date}} visit at {{location}}, due {{due-date}}: {{invoice-link}}',
          },
          {
            type: { text: 'email-template' },
            valueString: 'Thanks for visiting {{location}}, {{patient-full-name}}. Review us: {{location-review-link}}',
          },
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
    await deleteTaggedResources(oystehr, processId, ['Task', 'Encounter', 'Appointment', 'Patient', 'Location']);
  });

  it('fills the templates from the visit and the Stripe invoice and sends the sms and email', async () => {
    const { statusCode, output } = await invokeZambdaHandler<{ status: string; results: OutreachMediumResult[] }>(
      index,
      { ...task, status: 'requested' }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual({
      status: 'completed',
      results: [
        { medium: 'sms', success: true },
        { medium: 'email', success: true },
      ],
    });

    const patientName = getFullName(patient);
    expect(sendSmsForPatient).toHaveBeenCalledTimes(1);
    const [smsMessage, , smsPatient] = vi.mocked(sendSmsForPatient).mock.calls[0];
    expect(smsPatient?.id).toBe(patient.id);
    expect(smsMessage).toBe(
      `Hi ${patientName}, you owe ${formatInvoiceAmount(AMOUNT_DUE_CENTS)} for your ${formatInvoiceDate(
        APPOINTMENT_START
      )} visit at ${location.name}, due ${formatInvoiceDate(DUE_DATE)}: ${INVOICE_LINK}`
    );
    expect(fakes.searchInvoices).toHaveBeenCalledWith(
      { query: `metadata['${STRIPE_METADATA_KEYS.encounterId}']:"${encounter.id}"` },
      { stripeAccount: undefined }
    );

    expect(fakes.sendGenericOutreachEmail).toHaveBeenCalledTimes(1);
    const [emailTo, emailData] = fakes.sendGenericOutreachEmail.mock.calls[0] as unknown as [
      string,
      { content: string; 'subject-text': string },
    ];
    expect(emailTo).toBe(PATIENT_EMAIL);
    expect(emailData['subject-text']).toBe('Important information about your visit');
    expect(emailData.content).toContain(location.name);
    expect(emailData.content).toContain(REVIEW_LINK);

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
    expect(JSON.parse(storedTask.output?.[0]?.valueString ?? '[]')).toEqual(output.results);
    expect(communications).toHaveLength(1);
    expect(communications[0].medium?.[0]?.coding?.[0]?.code).toBe('EMAILWRIT');
  });
});
