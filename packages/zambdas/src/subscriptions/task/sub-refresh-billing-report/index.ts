import { updateRefreshTaskProgress } from '../../../billing/reports/framework/refresh-task';
import { reportRegistry } from '../../../billing/reports/framework/registry';
import { fullCacheKey, saveReportCache } from '../../../billing/reports/framework/report-cache';
import { createBillingClient, createEraReadClient } from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { safeValidate } from '../../../shared/validation';
import { wrapTaskHandler } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'sub-refresh-billing-report';

// Async worker for all billing-report refreshes; the http zambda only queues the Task and serves
// the cache this worker writes. Routing and caching are generic — per-report logic lives in the
// registry's ReportDefinitions.
export const index = wrapTaskHandler(ZAMBDA_NAME, async (input, _oystehr) => {
  const { kind, paramsJson, taskId, secrets } = validateRequestParameters(input);
  const definition = reportRegistry[kind];
  const params = safeValidate(definition.paramsSchema, JSON.parse(paramsJson));

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);
  // patients/appointments/encounters are clinical (untagged) resources in the same store
  const untaggedClient = createEraReadClient(m2mToken, secrets);
  const onProgress = (message: string): Promise<void> => updateRefreshTaskProgress(oystehr, taskId, message);

  const payload = await definition.compute({ oystehr, untaggedClient, secrets }, params, onProgress);
  if (!definition.savesOwnCache) {
    await saveReportCache(oystehr, definition, fullCacheKey(definition, params), payload);
  }
  return { taskStatus: 'completed', statusReason: definition.summarize(payload) };
});
