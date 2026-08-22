import { computeAndCacheCardsOnFileReport } from '../../../billing/reports/get-billing-cards-on-file-report';
import { computeAndCacheInvoiceReport } from '../../../billing/reports/get-billing-invoice-report';
import { updateRefreshTaskProgress } from '../../../billing/reports/refresh-task';
import { createBillingClient, createEraReadClient } from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { wrapTaskHandler } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'sub-refresh-billing-report';

// Async worker for the heavy Stripe-backed report refreshes; the http report zambdas only
// queue the Task and serve the cache this worker writes.
export const index = wrapTaskHandler(ZAMBDA_NAME, async (input, _oystehr) => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  // patients/appointments are clinical (untagged) resources in the same store
  const untaggedClient = createEraReadClient(m2mToken, params.secrets);
  const onProgress = (message: string): Promise<void> => updateRefreshTaskProgress(oystehr, params.taskId, message);

  if (params.kind === 'invoice') {
    const report = await computeAndCacheInvoiceReport(oystehr, untaggedClient, params.secrets, onProgress);
    return { taskStatus: 'completed', statusReason: `invoice report cached (${report.rows.length} invoices)` };
  }

  const report = await computeAndCacheCardsOnFileReport(oystehr, untaggedClient, params.secrets, onProgress);
  return {
    taskStatus: 'completed',
    statusReason: `cards-on-file report cached (${report.totals.customers} customers)`,
  };
});
