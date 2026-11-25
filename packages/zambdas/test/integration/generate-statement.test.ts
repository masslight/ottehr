import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  Account,
  Appointment,
  Claim,
  DocumentReference,
  Encounter,
  FhirResource,
  List,
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
import { StatementDetails } from 'utils/lib/statements/generate-statement';
import { TaskIndicator } from 'utils/lib/types/common';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { STATEMENT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { formatCurrencyFromCents } from 'utils/lib/utils/convert';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildPaymentNotice, claimRequestFor, MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM } from '../../src/billing/payments';
import { getAuth0Token } from '../../src/shared/getAuth0Token';
import { getStatementDetails } from '../../src/shared/statements/get-statement-details';
import { createPresignedUrl, deleteZ3Object } from '../../src/shared/z3Utils';
import { index } from '../../src/subscriptions/task/sub-generate-statement/index';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM } from '../helpers/integration-tags';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

vi.mock('../../src/shared/statements/get-statement-details', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/shared/statements/get-statement-details')>();
  return { ...actual, getStatementDetails: vi.fn(actual.getStatementDetails) };
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

describe('generate-statement', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;
  let location: Location;
  let patient: Patient;
  let encounter: Encounter;
  let appointment: Appointment;
  let task: Task;
  const statementFileUrls: string[] = [];

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('generate-statement.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrBilling = setup.oystehrBilling;
    processId = setup.processId;
    cleanup = setup.cleanup;

    location = await oystehr.fhir.create<Location>(
      tagged({
        resourceType: 'Location',
        status: 'active',
        name: `Statement Clinic ${randomUUID()}`,
        extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: TIMEZONE }],
      })
    );
    patient = await oystehr.fhir.create<Patient>(
      tagged({
        resourceType: 'Patient',
        active: true,
        name: [{ given: ['Arya'], family: 'Stark' }],
        birthDate: '2001-02-03',
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
            name: [{ given: ['Eddard'], family: 'Stark' }],
            address: [{ line: ['1 Winterfell Rd', 'Suite 7'], city: 'Albany', state: 'NY', postalCode: '12207' }],
          },
        ],
        guarantor: [{ party: { reference: '#guarantor' } }],
      })
    );
    appointment = await oystehr.fhir.create<Appointment>(
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
              coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213', display: 'Office visit' }],
            },
            net: { value: 150, currency: 'USD' },
          },
        ],
        total: { value: 150, currency: 'USD' },
      })
    );
    await oystehrBilling.fhir.create<PaymentNotice>(
      tagged(
        buildPaymentNotice({
          request: claimRequestFor(undefined, encounter.id!),
          payee: { display: 'Integration Test Clinic' },
          amountInCents: 5000,
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
              system: TaskIndicator.generatePatientStatement.system,
              code: TaskIndicator.generatePatientStatement.code,
            },
          ],
        },
        for: { reference: `Patient/${patient.id}` },
        focus: { reference: `Appointment/${appointment.id}` },
        encounter: { reference: `Encounter/${encounter.id}` },
      })
    );
  });

  afterAll(async () => {
    const z3Token = await getAuth0Token(loadZambdaSecrets());
    await Promise.all(statementFileUrls.map((url) => deleteZ3Object(url, z3Token).catch(() => undefined)));
    const folders = (
      await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [{ name: 'subject', value: `Patient/${patient.id}` }],
      })
    ).unbundle();
    await cleanup();
    await Promise.all(
      folders.map((list) => oystehr.fhir.delete({ resourceType: 'List', id: list.id! }).catch(() => undefined))
    );
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

  it('builds the statement from the visit, guarantor, biller and billing claim and files it as a PDF', async () => {
    const { statusCode, output } = await invokeZambdaHandler<{ documentReference: string }>(index, task, {
      secrets: { ...loadZambdaSecrets(), PATIENT_BALANCE_SOURCE: 'ottehr' },
    });

    expect(statusCode).toBe(200);
    expect(output.documentReference).toMatch(/^DocumentReference\/.+/);

    const details = await (vi.mocked(getStatementDetails).mock.results[0].value as Promise<StatementDetails>);
    const billerId = loadZambdaSecrets()[SecretsKeys.DEFAULT_BILLING_RESOURCE].replace('Organization/', '');
    const biller = await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: billerId });
    const visit = formatDateToMDYWithTime(APPOINTMENT_START, TIMEZONE)!;

    expect(details.patient).toEqual({ firstName: 'Arya', lastName: 'Stark', dob: '02/03/2001' });
    expect(details.visit).toEqual(visit);
    expect(details.facility.name).toBe(location.name);
    expect(details.statement.number).toBe(appointment.id);
    expect(details.respParty).toMatchObject({
      firstName: 'Eddard',
      lastName: 'Stark',
      addressLine1: '1 Winterfell Rd',
      addressLine2: 'Suite 7',
      city: 'Albany',
      provinceOrState: 'NY',
      postalOrZip: '12207',
    });
    expect(details.biller.name).toBe(biller.name);
    expect(details.service).toEqual([
      {
        cpt: '99213',
        description: '99213 - Office visit',
        charged: formatCurrencyFromCents(15000),
        insurancePaid: formatCurrencyFromCents(0),
        patientPaid: formatCurrencyFromCents(5000),
        writeOffs: formatCurrencyFromCents(0),
        patientOwes: formatCurrencyFromCents(10000),
      },
    ]);
    expect(details.totals).toMatchObject({
      charged: formatCurrencyFromCents(15000),
      patientPaid: formatCurrencyFromCents(5000),
      balanceDue: formatCurrencyFromCents(10000),
    });

    const documentReference = await oystehr.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: output.documentReference.replace('DocumentReference/', ''),
    });
    const attachment = documentReference.content[0].attachment;
    statementFileUrls.push(attachment.url!);

    expect(documentReference.status).toBe('current');
    expect(documentReference.subject?.reference).toBe(`Patient/${patient.id}`);
    expect(documentReference.context?.encounter?.[0]?.reference).toBe(`Encounter/${encounter.id}`);
    expect(documentReference.type?.coding?.[0]?.code).toBe(STATEMENT_CODE);
    expect(attachment.title).toBe(`Statement-${visit.date}-${visit.time}`);
    expect(attachment.url).toContain(`Statement-${encounter.id}-`);

    const z3Token = await getAuth0Token(loadZambdaSecrets());
    const pdf = await fetch(await createPresignedUrl(z3Token, attachment.url!, 'download'));
    expect(pdf.ok).toBe(true);
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 5)
        .toString()
    ).toBe('%PDF-');

    const storedTask = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: task.id! });
    expect(storedTask.status).toBe('completed');
  });
});
