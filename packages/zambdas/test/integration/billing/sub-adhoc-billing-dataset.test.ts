import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { randomInt, randomUUID } from 'crypto';
import {
  Claim,
  ClaimResponse,
  Coverage,
  FhirResource,
  Location,
  Organization,
  Patient,
  PaymentNotice,
  Practitioner,
  Task,
} from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { AdHocBillingClaimsOutput, BILLING_CLAIMS_DATASET_ID } from 'utils/lib/types/adhoc/datasets/billing-claims';
import {
  ADHOC_BILLING_DATASET_TASK_CODE,
  ADHOC_REPORT_OUTPUT_URL_CODE,
  ADHOC_REPORT_PARAMS_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import {
  CUSTOM_INSURANCE_ORG_ID_SYSTEM,
  CUSTOM_INSURANCE_ORG_KIND_CODE,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { OYSTEHR_ADJUDICATION_SYSTEM, X12_ADJUSTMENT_GROUP_SYSTEM } from '../../../src/billing/claim-amounts';
import {
  buildPaymentNotice,
  claimRequestFor,
  MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
} from '../../../src/billing/payments';
import { index } from '../../../src/subscriptions/task/sub-adhoc-billing-dataset/index';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';
import { InvokedZambdaResponse, invokeZambdaHandler, loadZambdaSecrets } from '../../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const outputValue = (task: Task, code: string): string | undefined =>
  task.output?.find((output) => output.type.coding?.some((coding) => coding.code === code))?.valueString;

describe('sub-adhoc-billing-dataset', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let processId: string;
  let token: string;
  let cleanup: () => Promise<void>;

  const secrets = loadZambdaSecrets();
  const bucketName = `${secrets.PROJECT_ID}-${BUCKET_NAMES.BILLING_CLAIM_EXPORTS}`;
  const seededDeletes: BatchInputDeleteRequest[] = [];
  const unique = `Adhoc${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const serviceDate = `19${String(randomInt(10, 99))}-0${randomInt(1, 10)}-1${randomInt(0, 10)}`;
  const encounterId = randomUUID();
  const payerBusinessId = `OTR-${unique.toUpperCase()}`;
  let patientId: string;
  let claimId: string;
  let task: Task;

  const seed = async <T extends FhirResource>(resource: T): Promise<T> => {
    const created = await oystehrBilling.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/sub-adhoc-billing-dataset.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    oystehrBilling = setup.oystehrBilling;
    processId = setup.processId;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;

    const [patient, payer, practitioner, facility] = await Promise.all([
      seed<Patient>({
        resourceType: 'Patient',
        active: true,
        name: [{ family: `${unique}Fam`, given: ['Avery'] }],
        birthDate: '1985-04-12',
      }),
      seed<Organization>({
        resourceType: 'Organization',
        active: true,
        name: `${unique} Health Plan`,
        identifier: [{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: payerBusinessId }],
        type: [{ coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: CUSTOM_INSURANCE_ORG_KIND_CODE }] }],
      }),
      seed<Practitioner>({
        resourceType: 'Practitioner',
        active: true,
        name: [{ family: `${unique}Doc`, given: ['Rendering'] }],
      }),
      seed<Location>({ resourceType: 'Location', status: 'active', name: `${unique} Clinic` }),
    ]);
    patientId = patient.id!;

    const coverage = await seed<Coverage>({
      resourceType: 'Coverage',
      status: 'active',
      beneficiary: { reference: `Patient/${patientId}` },
      payor: [{ reference: `Organization/${payer.id}` }],
      subscriberId: `MEM-${unique}`,
    });

    const claim = await seed<Claim>({
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      created: `${serviceDate}T12:00:00Z`,
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      patient: { reference: `Patient/${patientId}` },
      provider: { display: `${unique} Medical Group` },
      insurer: { reference: `Organization/${payer.id}` },
      insurance: [{ sequence: 1, focal: true, coverage: { reference: `Coverage/${coverage.id}` } }],
      facility: { reference: `Location/${facility.id}` },
      careTeam: [{ sequence: 1, provider: { reference: `Practitioner/${practitioner.id}` } }],
      identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId }],
      total: { value: 200, currency: 'USD' },
      item: [{ sequence: 1, productOrService: { text: 'Office visit' }, servicedDate: serviceDate }],
      meta: { tag: claimStatusValuesToTags({ arStage: AR_STAGE.patient, patientArStatus: 'ready-to-invoice' }) },
    });
    claimId = claim.id!;

    await Promise.all([
      seed<ClaimResponse>({
        resourceType: 'ClaimResponse',
        status: 'active',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
        use: 'claim',
        patient: { reference: `Patient/${patientId}` },
        created: `${serviceDate}T18:00:00Z`,
        insurer: { reference: `Organization/${payer.id}` },
        request: { reference: `Claim/${claimId}` },
        outcome: 'complete',
        item: [
          {
            itemSequence: 1,
            adjudication: [
              {
                category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: 'charge' }] },
                amount: { value: 200 },
              },
              {
                category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: 'allowed' }] },
                amount: { value: 150 },
              },
              { category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: 'paid' }] }, amount: { value: 100 } },
              {
                category: { coding: [{ system: X12_ADJUSTMENT_GROUP_SYSTEM, code: 'PR' }] },
                reason: { coding: [{ code: '1' }] },
                amount: { value: 50 },
              },
              {
                category: { coding: [{ system: X12_ADJUSTMENT_GROUP_SYSTEM, code: 'CO' }] },
                reason: { coding: [{ code: '45' }] },
                amount: { value: 50 },
              },
            ],
          },
        ],
      }),
      seed<PaymentNotice>(
        buildPaymentNotice({
          request: claimRequestFor(claim, encounterId),
          payee: { display: `${unique} Medical Group` },
          amountInCents: 2000,
          paymentMethod: 'cash',
          identifier: { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() },
          paymentDate: serviceDate,
          createdISO: `${serviceDate}T19:00:00.000Z`,
          disposition: 'cash payment collected manually',
        })
      ),
    ]);

    task = await seed<Task>({
      resourceType: 'Task',
      status: 'ready',
      intent: 'order',
      code: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_BILLING_DATASET_TASK_CODE }] },
      input: [
        {
          type: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_REPORT_PARAMS_CODE }] },
          valueString: JSON.stringify({
            datasetId: BILLING_CLAIMS_DATASET_ID,
            dateRange: { start: `${serviceDate}T00:00:00.000Z`, end: `${serviceDate}T23:59:59.999Z` },
            options: { coverage: true, patientPayments: true, remits: true },
          }),
        },
      ],
    });
  }, 120_000);

  afterAll(async () => {
    await oystehr.z3
      .deleteObject({ bucketName, 'objectPath+': `adhoc-billing-dataset-${task?.id}.json` })
      .catch(() => undefined);
    if (seededDeletes.length > 0) await oystehrBilling.fhir.batch({ requests: seededDeletes });
    await cleanup();
  }, 120_000);

  const buildDataset = async (): Promise<InvokedZambdaResponse<{ taskStatus: string; statusReason: string }>> => {
    for (let attempt = 1; ; attempt++) {
      const response = await invokeZambdaHandler<{ taskStatus: string; statusReason: string }>(index, task, {
        token,
        secrets,
      });
      const failure = (await oystehrBilling.fhir.get<Task>({ resourceType: 'Task', id: task.id! })).statusReason?.text;
      // The whole-project claim scan fails when another test deletes a claim mid-scan; a re-run is what a user would do.
      if (response.statusCode === 200 || attempt === 3 || !failure?.startsWith('Claim scan returned')) return response;
    }
  };

  it('builds the billing claims dataset JSON in Z3 and completes the task', async () => {
    const { statusCode, output } = await buildDataset();

    expect(statusCode).toBe(200);
    expect(output.taskStatus).toBe('completed');

    const storedTask = await oystehrBilling.fhir.get<Task>({ resourceType: 'Task', id: task.id! });
    expect(storedTask.status).toBe('completed');
    expect(storedTask.statusReason?.text).toBe(output.statusReason);
    expect(outputValue(storedTask, ADHOC_REPORT_OUTPUT_URL_CODE)).toBe(
      `${secrets.PROJECT_API}/z3/${bucketName}/adhoc-billing-dataset-${task.id}.json`
    );

    const dataset = JSON.parse(
      new TextDecoder().decode(
        await oystehr.z3.downloadFile({ bucketName, 'objectPath+': `adhoc-billing-dataset-${task.id}.json` })
      )
    ) as AdHocBillingClaimsOutput;
    expect(output.statusReason).toBe(`Ad-hoc billing dataset built (${dataset.rows.length} rows)`);
    expect(dataset.rows.find((row) => row.claimId === claimId)).toMatchObject({
      encounterId,
      serviceDate,
      patientName: `${unique}Fam, Avery`,
      patientDob: '1985-04-12',
      payerName: `${unique} Health Plan`,
      payerId: payerBusinessId,
      memberId: `MEM-${unique}`,
      facility: `${unique} Clinic`,
      renderingProvider: `${unique}Doc, Rendering`,
      arStage: AR_STAGE.patient,
      patientArStatus: 'ready-to-invoice',
      billed: 200,
      allowed: 150,
      insurancePaid: 100,
      patientResp: 50,
      patientPaid: 20,
      claimBalance: 30,
      adjudicated: true,
      coverageCount: 1,
      primaryCoverageStatus: 'active',
      patientPaymentCount: 1,
      remitCount: 1,
    });
  });
});
