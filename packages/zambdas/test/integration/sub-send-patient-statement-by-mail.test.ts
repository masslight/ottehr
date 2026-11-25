import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  Account,
  Appointment,
  Claim,
  Communication,
  Encounter,
  FhirResource,
  Location,
  Organization,
  Patient,
  PaymentNotice,
  Task,
} from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PATIENT_BILLING_ACCOUNT_TYPE, TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { SecretsKeys } from 'utils/lib/secrets';
import { TaskIndicator } from 'utils/lib/types/common';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { formatCurrencyFromCents } from 'utils/lib/utils/convert';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildPaymentNotice, claimRequestFor, MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM } from '../../src/billing/payments';
import { MAIL_VENDOR_EXTENSION_URL, sendPostGridLetter } from '../../src/shared/postgrid';
import { index } from '../../src/subscriptions/task/sub-send-patient-statement-by-mail/index';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM } from '../helpers/integration-tags';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

const postGrid = vi.hoisted(() => ({
  letter: {
    id: 'letter_integration_test',
    object: 'letter',
    live: false,
    status: 'ready',
    url: 'https://postgrid.example/letter_integration_test.pdf',
    sendDate: '2026-03-17',
  },
}));

vi.mock('../../src/shared/postgrid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/shared/postgrid')>();
  return { ...actual, sendPostGridLetter: vi.fn(async () => postGrid.letter) };
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
const TIMEZONE = 'America/New_York';
const MAIL_STATEMENT_TASK_INPUT_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/patient-statement-mail-task-input';

describe('sub-send-patient-statement-by-mail', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let processId: string;
  let token: string;
  let cleanup: () => Promise<void>;
  let location: Location;
  let patient: Patient;
  let encounter: Encounter;
  let task: Task;

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sub-send-patient-statement-by-mail.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrBilling = setup.oystehrBilling;
    processId = setup.processId;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;

    location = await oystehr.fhir.create<Location>(
      tagged({
        resourceType: 'Location',
        status: 'active',
        name: `Mail Statement Clinic ${randomUUID()}`,
        extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: TIMEZONE }],
      })
    );
    patient = await oystehr.fhir.create<Patient>(
      tagged({
        resourceType: 'Patient',
        active: true,
        name: [{ given: ['Sansa'], family: 'Stark' }],
        birthDate: '1999-08-21',
        gender: 'female',
      })
    );
    await oystehr.fhir.create<Account>(
      tagged({
        resourceType: 'Account',
        status: 'active',
        type: PATIENT_BILLING_ACCOUNT_TYPE,
        subject: [{ reference: `Patient/${patient.id}` }],
        contained: [
          {
            resourceType: 'RelatedPerson',
            id: 'guarantor',
            patient: { reference: `Patient/${patient.id}` },
            name: [{ given: ['Catelyn'], family: 'Tully' }],
            address: [{ line: ['12 Riverrun Way'], city: 'Buffalo', state: 'NY', postalCode: '14201' }],
          },
        ],
        guarantor: [{ party: { reference: '#guarantor' } }],
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
        location: [{ location: { reference: `Location/${location.id}` } }],
      })
    );

    await oystehrBilling.fhir.create<Claim>(
      tagged({
        resourceType: 'Claim',
        meta: { tag: [{ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.patient }] },
        status: 'active',
        use: 'claim',
        identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: encounter.id! }],
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
        patient: { reference: `Patient/${patient.id}` },
        created: '2026-03-16',
        provider: { display: 'Integration Test Provider' },
        priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
        insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
        item: [
          {
            sequence: 1,
            productOrService: {
              coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99214', display: 'Extended office visit' }],
            },
            net: { value: 240, currency: 'USD' },
          },
        ],
        total: { value: 240, currency: 'USD' },
      })
    );
    await oystehrBilling.fhir.create<PaymentNotice>(
      tagged(
        buildPaymentNotice({
          request: claimRequestFor(undefined, encounter.id!),
          payee: { display: 'Integration Test Clinic' },
          amountInCents: 4000,
          paymentMethod: 'cash',
          identifier: { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() },
          paymentDate: '2026-03-16',
          createdISO: '2026-03-16T19:00:00.000Z',
          disposition: 'cash collected from patient',
        })
      )
    );

    task = await oystehr.fhir.create<Task>(
      tagged({
        resourceType: 'Task',
        status: 'ready',
        intent: 'order',
        code: {
          coding: [
            {
              system: TaskIndicator.sendPatientStatementByMail.system,
              code: TaskIndicator.sendPatientStatementByMail.code,
            },
          ],
        },
        for: { reference: `Patient/${patient.id}` },
        focus: { reference: `Appointment/${appointment.id}` },
        encounter: { reference: `Encounter/${encounter.id}` },
        input: [
          {
            type: { coding: [{ system: MAIL_STATEMENT_TASK_INPUT_SYSTEM, code: 'statementType' }] },
            valueString: 'past-due',
          },
          { type: { coding: [{ system: MAIL_STATEMENT_TASK_INPUT_SYSTEM, code: 'color' }] }, valueString: 'false' },
        ],
      })
    );
  });

  afterAll(async () => {
    const communications = (
      await oystehr.fhir.search<Communication>({
        resourceType: 'Communication',
        params: [{ name: 'encounter', value: `Encounter/${encounter.id}` }],
      })
    ).unbundle();
    await Promise.all(
      communications.map((communication) =>
        oystehr.fhir.delete({ resourceType: 'Communication', id: communication.id! }).catch(() => undefined)
      )
    );
    await cleanup();
    await deleteTaggedResources(oystehr, processId, [
      'PaymentNotice',
      'Claim',
      'Task',
      'Encounter',
      'Appointment',
      'Account',
      'Patient',
      'Location',
    ]);
  });

  it('mails the statement built from the visit, guarantor, biller and billing claim and records the letter', async () => {
    const { statusCode, output } = await invokeZambdaHandler<{ mailId: string; mailStatus: string }>(index, task, {
      token,
      secrets: { ...loadZambdaSecrets(), PATIENT_BALANCE_SOURCE: 'ottehr' },
    });

    expect(statusCode).toBe(200);
    expect(output).toEqual({ mailId: postGrid.letter.id, mailStatus: postGrid.letter.status });

    const secrets = loadZambdaSecrets();
    const billerReference = secrets[SecretsKeys.DEFAULT_BILLING_RESOURCE];
    const biller = await oystehr.fhir.get<Organization>({
      resourceType: 'Organization',
      id: billerReference.replace('Organization/', ''),
    });
    const visitDate = formatDateToMDYWithTime(APPOINTMENT_START, TIMEZONE)!.date;
    const description = `${biller.name} - Statement - Sansa Stark - Visit on ${visitDate}`;

    expect(sendPostGridLetter).toHaveBeenCalledTimes(1);
    const [letter] = vi.mocked(sendPostGridLetter).mock.calls[0];
    expect(letter).toMatchObject({
      description,
      from: { companyName: biller.name },
      to: {
        firstName: 'Catelyn',
        lastName: 'Tully',
        addressLine1: '12 Riverrun Way',
        city: 'Buffalo',
        provinceOrState: 'NY',
        postalOrZip: '14201',
      },
      color: false,
      mailingClass: 'first_class',
      metadata: {
        oystehr_patient_id: patient.id,
        oystehr_encounter_id: encounter.id,
        oystehr_project_id: secrets[SecretsKeys.PROJECT_ID],
      },
    });
    expect(letter.html).toContain(location.name);
    expect(letter.html).toContain('99214');
    expect(letter.html).toContain(formatCurrencyFromCents(24000));
    expect(letter.html).toContain(formatCurrencyFromCents(4000));
    expect(letter.html).toContain(formatCurrencyFromCents(20000));

    const [communication] = (
      await oystehr.fhir.search<Communication>({
        resourceType: 'Communication',
        params: [{ name: 'encounter', value: `Encounter/${encounter.id}` }],
      })
    ).unbundle();
    expect(communication.subject?.reference).toBe(`Patient/${patient.id}`);
    expect(communication.sender?.reference).toBe(billerReference);
    expect(communication.medium?.[0]?.coding?.[0]?.code).toBe('MAILWRIT');
    expect(communication.recipient?.[0]?.display).toBe('Catelyn Tully');
    expect(communication.payload?.[0]?.contentString).toBe(description);
    const vendor = communication.extension?.find((extension) => extension.url === MAIL_VENDOR_EXTENSION_URL);
    expect(vendor?.extension).toEqual(
      expect.arrayContaining([
        { url: 'vendor', valueString: 'postgrid' },
        { url: 'vendor-letter-id', valueString: postGrid.letter.id },
        { url: 'vendor-letter-status', valueString: postGrid.letter.status },
      ])
    );

    const storedTask = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: task.id! });
    expect(storedTask.status).toBe('completed');
  });
});
