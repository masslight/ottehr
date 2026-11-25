import { randomInt } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import Oystehr from '@oystehr/sdk';
import { DocumentReference, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ReportRefreshStatus } from 'utils/lib/types/data/billing/billing.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { paymentsReport } from '../../../src/billing/reports/definitions/payments.report';
import { REFRESH_TASK_IDENTIFIER_SYSTEM } from '../../../src/billing/reports/framework/refresh-task';
import {
  fullCacheKey,
  REPORT_CACHE_IDENTIFIER_SYSTEM,
  saveReportCache,
} from '../../../src/billing/reports/framework/report-cache';
import { BILLING_APP_BUCKET, createBillingClient } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';
import { loadZambdaSecrets } from '../../helpers/invoke-zambda-handler';

interface CachedReportResponse {
  downloadUrl: string;
  generatedAt: string;
  fromCache: boolean;
  status: ReportRefreshStatus;
}

describe('get-billing-report', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  const secrets = loadZambdaSecrets();
  const year = 1900 + randomInt(99);
  const month = String(randomInt(1, 13)).padStart(2, '0');
  const params = { dateFrom: `${year}-${month}-01`, dateTo: `${year}-${month}-28` };
  const cacheKey = fullCacheKey(paymentsReport, params);
  const generatedAt = DateTime.now().minus({ hours: 1 }).toUTC().toISO()!;
  const payload = { ...paymentsReport.emptyPayload(), generatedAt };
  const failureReason = 'ERA aggregation timed out';
  let failedTaskId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/get-billing-report.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehrTestUserM2M;
    oystehrBilling = createBillingClient(setup.token, secrets);
    cleanup = setup.cleanup;
    processId = setup.processId;

    expect(
      await saveReportCache(oystehrBilling, secrets, paymentsReport, cacheKey, payload, { kind: 'payments', params })
    ).toBe(true);
    failedTaskId = (
      await oystehrBilling.fhir.create<Task>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Task',
            status: 'failed',
            intent: 'order',
            identifier: [{ system: REFRESH_TASK_IDENTIFIER_SYSTEM, value: cacheKey }],
            statusReason: { text: failureReason },
          },
          processId
        ) as Task
      )
    ).id;
  }, 120_000);

  afterAll(async () => {
    try {
      if (failedTaskId) await oystehrBilling.fhir.delete({ resourceType: 'Task', id: failedTaskId });
      const cacheDocs = (
        await oystehrBilling.fhir.search<DocumentReference>({
          resourceType: 'DocumentReference',
          params: [{ name: 'identifier', value: `${REPORT_CACHE_IDENTIFIER_SYSTEM}|${cacheKey}` }],
        })
      ).unbundle();
      for (const doc of cacheDocs) {
        for (const { attachment } of doc.content) {
          if (attachment.url) {
            await oystehrBilling.z3.deleteObject({
              bucketName: BILLING_APP_BUCKET(secrets.PROJECT_ID),
              'objectPath+': attachment.url,
            });
          }
        }
        await oystehrBilling.fhir.delete({ resourceType: 'DocumentReference', id: doc.id! });
      }
    } catch (error) {
      console.error(`Failed to clean up report cache ${cacheKey}:`, error);
    }
    await cleanup();
  }, 120_000);

  it('serves the cached report as a download link with the failed refresh newer than the cache', async () => {
    const response = (await oystehr.zambda.execute({ id: 'get-billing-report', kind: 'payments', params }))
      .output as unknown as CachedReportResponse;

    expect(response.fromCache).toBe(true);
    expect(response.generatedAt).toBe(generatedAt);
    expect(response.status).toEqual({
      state: 'error',
      lastCompletedAt: generatedAt,
      error: failureReason,
      cacheSizeBytes: expect.any(Number),
    });
    expect(response.status.cacheSizeBytes).toBeGreaterThan(0);

    const download = await fetch(response.downloadUrl);
    expect(download.ok).toBe(true);
    const cached = JSON.parse(gunzipSync(new Uint8Array(await download.arrayBuffer())).toString('utf8'));
    expect(cached).toEqual(payload);
  }, 120_000);
});
