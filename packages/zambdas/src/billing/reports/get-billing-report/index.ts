import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { RefreshReportKind } from 'utils/lib/types/data/billing/billing.constants';
import { ReportRefreshStatus } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';
import { createBillingClient } from '../../shared';
import { findActiveRefreshTask, findRecentFailedRefreshTask, kickOffRefreshTask } from '../framework/refresh-task';
import { reportRegistry } from '../framework/registry';
import { fullCacheKey, loadReportCache } from '../framework/report-cache';
import { ReportPayload } from '../framework/types';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { kind, params, refresh, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  const response = await performEffect(oystehr, kind, params, refresh);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Serves the cache and queues async refreshes; the subscription worker computes. Never computes
// a report in the HTTP request.
export async function performEffect(
  oystehr: Oystehr,
  kind: RefreshReportKind,
  rawParams: unknown,
  refresh: boolean | undefined
): Promise<ReportPayload & { fromCache: boolean; status: ReportRefreshStatus }> {
  const definition = reportRegistry[kind];
  const params = safeValidate(definition.paramsSchema, rawParams ?? {});
  const cacheKey = fullCacheKey(definition, params);

  let active = refresh
    ? await kickOffRefreshTask(oystehr, { kind, params, cacheKey })
    : await findActiveRefreshTask(oystehr, cacheKey);
  const cached = await loadReportCache<ReportPayload>(oystehr, cacheKey);
  // never computed: queue the first build instead of risking the request timeout
  if (!cached && !active) {
    active = await kickOffRefreshTask(oystehr, { kind, params, cacheKey });
  }

  const lastCompletedAt = cached?.generatedAt ? { lastCompletedAt: cached.generatedAt } : {};
  let status: ReportRefreshStatus;
  if (active) {
    status = { state: 'running', ...lastCompletedAt, progress: active.businessStatus?.text ?? 'queued' };
  } else {
    // a failed refresh newer than the served cache means "your data is fine, the last attempt broke"
    const failed = await findRecentFailedRefreshTask(oystehr, cacheKey, cached?.generatedAt ?? '');
    status = failed
      ? { state: 'error', ...lastCompletedAt, error: failed.statusReason?.text ?? 'refresh failed' }
      : { state: 'idle', ...lastCompletedAt };
  }

  const payload = cached ? definition.sanitizePayload?.(cached) ?? cached : definition.emptyPayload();
  return { ...payload, fromCache: !!cached, status };
}
