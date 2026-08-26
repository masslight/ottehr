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
import { detailCacheKey, fullCacheKey, loadReportCache, ReportDetailEnvelope } from '../framework/report-cache';
import { ReportPayload } from '../framework/types';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { kind, params, refresh, drilldown, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  const response = await performEffect(oystehr, kind, params, refresh, drilldown);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Serves the cache and queues async refreshes; the worker computes. Drilldowns are pure
// filters over the cached detail.
export async function performEffect(
  oystehr: Oystehr,
  kind: RefreshReportKind,
  rawParams: unknown,
  refresh: boolean | undefined,
  rawDrilldown?: unknown
): Promise<Record<string, unknown> & { fromCache: boolean; status: ReportRefreshStatus }> {
  const definition = reportRegistry[kind];
  if (!definition) throw new Error(`No report definition registered for kind '${kind}'`);
  const params = safeValidate(definition.paramsSchema, rawParams ?? {});
  const cacheKey = fullCacheKey(definition, params);

  if (rawDrilldown !== undefined) {
    if (!definition.drilldown) throw new Error(`Report kind '${kind}' does not support drilldown`);
    const drillParams = safeValidate(definition.drilldown.paramsSchema, rawDrilldown);
    const envelope = await loadReportCache<ReportDetailEnvelope<unknown>>(oystehr, detailCacheKey(definition, params));
    const status = await statusOf(oystehr, kind, params, cacheKey, envelope?.generatedAt, undefined);
    if (!envelope) {
      return { ...definition.drilldown.empty(), generatedAt: '', fromCache: false, status };
    }
    return {
      ...definition.drilldown.select(envelope.detail, drillParams),
      generatedAt: envelope.generatedAt,
      fromCache: true,
      status,
    };
  }

  let active = refresh
    ? await kickOffRefreshTask(oystehr, { kind, params, cacheKey })
    : await findActiveRefreshTask(oystehr, cacheKey);
  const cached = await loadReportCache<ReportPayload>(oystehr, cacheKey);
  // never computed: queue the first build instead of risking the request timeout
  if (!cached && !active) {
    active = await kickOffRefreshTask(oystehr, { kind, params, cacheKey });
  }

  const status = await statusOf(oystehr, kind, params, cacheKey, cached?.generatedAt, active);
  const payload = cached ? definition.sanitizePayload?.(cached) ?? cached : definition.emptyPayload();
  return { ...payload, fromCache: !!cached, status };
}

async function statusOf(
  oystehr: Oystehr,
  kind: RefreshReportKind,
  params: unknown,
  cacheKey: string,
  generatedAt: string | undefined,
  knownActive: Awaited<ReturnType<typeof findActiveRefreshTask>>
): Promise<ReportRefreshStatus> {
  const active = knownActive ?? (await findActiveRefreshTask(oystehr, cacheKey));
  const lastCompletedAt = generatedAt ? { lastCompletedAt: generatedAt } : {};
  if (active) {
    return { state: 'running', ...lastCompletedAt, progress: active.businessStatus?.text ?? 'queued' };
  }
  // a failed refresh newer than the served cache surfaces as an error status
  const failed = await findRecentFailedRefreshTask(oystehr, cacheKey, generatedAt ?? '');
  return failed
    ? { state: 'error', ...lastCompletedAt, error: failed.statusReason?.text ?? 'refresh failed' }
    : { state: 'idle', ...lastCompletedAt };
}
