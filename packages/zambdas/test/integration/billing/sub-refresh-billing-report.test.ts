import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { randomInt, randomUUID } from 'crypto';
import {
  ClaimResponse,
  ClaimResponseItemAdjudication,
  FhirResource,
  PaymentReconciliation,
  Provenance,
  Task,
} from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { EXPORT_TASK_SYSTEM } from 'utils/lib/types/api/invoicing.types';
import {
  REFRESH_REPORT_CACHE_KEY_CODE,
  REFRESH_REPORT_KIND_CODE,
  REFRESH_REPORT_PARAMS_CODE,
  REFRESH_REPORT_TASK_CODE,
} from 'utils/lib/types/data/billing/billing.constants';
import { GetBillingPaymentsReportResponse, PaymentsReportDetail } from 'utils/lib/types/data/billing/billing.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OYSTEHR_ADJUDICATION_SYSTEM, X12_ADJUSTMENT_GROUP_SYSTEM } from '../../../src/billing/claim-amounts';
import { paymentsReport } from '../../../src/billing/reports/definitions/payments.report';
import { REFRESH_TASK_IDENTIFIER_SYSTEM } from '../../../src/billing/reports/framework/refresh-task';
import {
  detailCacheKey,
  fullCacheKey,
  loadReportCache,
  loadReportCacheMeta,
  ReportDetailEnvelope,
  saveReportCache,
} from '../../../src/billing/reports/framework/report-cache';
import {
  BILLING_APP_BUCKET,
  createBillingClient,
  ERA_PROCESSING_ACTIVITY_CODE,
  PROVENANCE_ACTIVITY_TYPE_SYSTEM,
} from '../../../src/billing/shared';
import { index } from '../../../src/subscriptions/task/sub-refresh-billing-report/index';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../../helpers/invoke-zambda-handler';

type PaymentsPayload = Omit<GetBillingPaymentsReportResponse, 'fromCache' | 'status'>;

describe('sub-refresh-billing-report', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let reportCacheClient: Oystehr;
  let processId: string;
  let token: string;
  let cleanup: () => Promise<void>;
  let previousDetail: ReportDetailEnvelope<PaymentsReportDetail> | undefined;
  let paymentReconciliation: PaymentReconciliation;
  let task: Task;

  const secrets = loadZambdaSecrets();
  const seededDeletes: BatchInputDeleteRequest[] = [];
  const payerName = `Refresh Payer ${randomUUID().slice(0, 8)}`;
  const checkDate = `19${randomInt(10, 99)}-0${randomInt(1, 10)}-1${randomInt(0, 10)}`;
  const params = { dateFrom: checkDate, dateTo: checkDate };
  const cacheKey = fullCacheKey(paymentsReport, params);
  const detailKey = detailCacheKey(paymentsReport, params);

  const seed = async <T extends FhirResource>(client: Oystehr, resource: T): Promise<T> => {
    const created = await client.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T;
  };

  const adjudication = (code: string, value: number): ClaimResponseItemAdjudication => ({
    category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code }] },
    amount: { value },
  });

  const eraClaimResponse = (amounts: {
    charge: number;
    allowed: number;
    paid: number;
    patientResp: number;
  }): ClaimResponse => ({
    resourceType: 'ClaimResponse',
    status: 'active',
    type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
    use: 'claim',
    patient: { display: 'Refresh Patient' },
    created: `${checkDate}T12:00:00Z`,
    insurer: { display: payerName },
    outcome: 'complete',
    item: [
      {
        itemSequence: 1,
        adjudication: [
          adjudication('charge', amounts.charge),
          adjudication('allowed', amounts.allowed),
          adjudication('paid', amounts.paid),
          {
            category: { coding: [{ system: X12_ADJUSTMENT_GROUP_SYSTEM, code: 'PR' }] },
            reason: { coding: [{ code: '1' }] },
            amount: { value: amounts.patientResp },
          },
        ],
      },
    ],
  });

  const deleteCache = async (key: string): Promise<void> => {
    const meta = await loadReportCacheMeta(reportCacheClient, key);
    if (!meta) return;
    await reportCacheClient.z3
      .deleteObject({ bucketName: BILLING_APP_BUCKET(secrets.PROJECT_ID), 'objectPath+': meta.objectPath })
      .catch(() => undefined);
    if (meta.docId) await oystehr.fhir.delete({ resourceType: 'DocumentReference', id: meta.docId });
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/sub-refresh-billing-report.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    oystehrBilling = setup.oystehrBilling;
    reportCacheClient = createBillingClient(setup.token, secrets);
    processId = setup.processId;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;

    previousDetail = await loadReportCache<ReportDetailEnvelope<PaymentsReportDetail>>(
      reportCacheClient,
      secrets,
      detailKey
    );

    const [reconciliation, ...claimResponses] = await Promise.all([
      seed<PaymentReconciliation>(oystehrBilling, {
        resourceType: 'PaymentReconciliation',
        status: 'active',
        created: `${checkDate}T12:00:00Z`,
        paymentDate: checkDate,
        paymentAmount: { value: 125, currency: 'USD' },
      }),
      seed<ClaimResponse>(oystehrBilling, eraClaimResponse({ charge: 200, allowed: 150, paid: 100, patientResp: 50 })),
      seed<ClaimResponse>(oystehrBilling, eraClaimResponse({ charge: 80, allowed: 60, paid: 25, patientResp: 35 })),
    ]);
    paymentReconciliation = reconciliation;

    await seed<Provenance>(oystehrBilling, {
      resourceType: 'Provenance',
      target: [
        { reference: `PaymentReconciliation/${reconciliation.id}` },
        ...claimResponses.map((claimResponse) => ({ reference: `ClaimResponse/${claimResponse.id}` })),
      ],
      recorded: `${checkDate}T12:00:00Z`,
      activity: { coding: [{ system: PROVENANCE_ACTIVITY_TYPE_SYSTEM, code: ERA_PROCESSING_ACTIVITY_CODE }] },
      agent: [{ who: { display: 'Oystehr RCM' } }],
    });

    task = await seed<Task>(oystehrBilling, {
      resourceType: 'Task',
      status: 'ready',
      intent: 'order',
      identifier: [{ system: REFRESH_TASK_IDENTIFIER_SYSTEM, value: cacheKey }],
      code: { coding: [{ system: EXPORT_TASK_SYSTEM, code: REFRESH_REPORT_TASK_CODE }] },
      input: [
        {
          type: { coding: [{ system: EXPORT_TASK_SYSTEM, code: REFRESH_REPORT_KIND_CODE }] },
          valueString: paymentsReport.kind,
        },
        {
          type: { coding: [{ system: EXPORT_TASK_SYSTEM, code: REFRESH_REPORT_PARAMS_CODE }] },
          valueString: JSON.stringify(params),
        },
        {
          type: { coding: [{ system: EXPORT_TASK_SYSTEM, code: REFRESH_REPORT_CACHE_KEY_CODE }] },
          valueString: cacheKey,
        },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    await deleteCache(cacheKey);
    if (previousDetail) {
      await saveReportCache(reportCacheClient, secrets, {}, detailKey, previousDetail);
    } else {
      await deleteCache(detailKey);
    }
    if (seededDeletes.length > 0) await oystehr.fhir.batch({ requests: seededDeletes });
    await cleanup();
  }, 60_000);

  it('computes the payments report from the ERAs and caches the payload and drilldown detail', async () => {
    const { statusCode, output } = await invokeZambdaHandler<{ taskStatus: string; statusReason: string }>(
      index,
      task,
      { token, secrets }
    );

    expect(statusCode).toBe(200);
    expect(output.taskStatus).toBe('completed');
    expect(output.statusReason).toMatch(/^payments report cached \(\d+ payers\)$/);

    const storedTask = await oystehrBilling.fhir.get<Task>({ resourceType: 'Task', id: task.id! });
    expect(storedTask.status).toBe('completed');
    expect(storedTask.statusReason?.text).toBe(output.statusReason);

    const payload = await loadReportCache<PaymentsPayload>(reportCacheClient, secrets, cacheKey);
    expect(payload?.rows.find((row) => row.payerName === payerName)).toEqual({
      payerId: '',
      payerName,
      eraCount: 1,
      claimCount: 2,
      billed: 280,
      allowed: 210,
      insurancePaid: 125,
      patientResp: 85,
      checkTotal: 125,
    });

    const detail = await loadReportCache<ReportDetailEnvelope<PaymentsReportDetail>>(
      reportCacheClient,
      secrets,
      detailKey
    );
    expect(detail?.generatedAt).toBe(payload?.generatedAt);
    const era = detail?.detail.eras.find((entry) => entry.id === paymentReconciliation.id);
    expect(era).toMatchObject({ checkDate, payerName, checkAmount: 125 });
    expect(era?.claims.map((claim) => claim.paid).sort((a, b) => a - b)).toEqual([25, 100]);
  });
});
