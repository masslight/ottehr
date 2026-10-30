import { APIGatewayProxyResult } from 'aws-lambda';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import {
  ADHOC_BILLING_DATASET_TASK_CODE,
  ADHOC_REPORT_OUTPUT_URL_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { EXPORT_TASK_SYSTEM } from 'utils/lib/types/api/invoicing.types';
import { EXPORT_CLAIMS_CSV_TASK_CODE } from 'utils/lib/types/data/billing/billing.constants';
import { BillingOystehr, createBillingClient } from '../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { truncateForLog } from '../../shared/logging';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { cleanupExportTaskFiles, CleanupExportTaskFilesResult } from '../cleanup-export-task-files';
import { validateRequestParameters } from './validateRequestParameters';

const CLEANUP_AGE_MINUTES = 10;
const ADHOC_CLEANUP_AGE_MINUTES = 60;

let m2mToken: string;

const ZAMBDA_NAME = 'cleanup-billing-claim-exports';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');

  const params = validateRequestParameters(input);
  const { secrets } = params;

  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');

  const response = await performEffect(oystehr, secrets);

  console.groupEnd();
  console.debug('performEffect success', truncateForLog(response));

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function performEffect(oystehr: BillingOystehr, secrets: Secrets): Promise<CleanupExportTaskFilesResult> {
  const bucketName = `${getSecret(SecretsKeys.PROJECT_ID, secrets)}-${BUCKET_NAMES.BILLING_CLAIM_EXPORTS}`;

  const results = await Promise.allSettled([
    cleanupExportTaskFiles({
      oystehr,
      taskSystem: EXPORT_TASK_SYSTEM,
      taskCode: EXPORT_CLAIMS_CSV_TASK_CODE,
      bucketName,
      ageMinutes: CLEANUP_AGE_MINUTES,
    }),
    cleanupExportTaskFiles({
      oystehr,
      taskSystem: ADHOC_REPORT_TASK_SYSTEM,
      taskCode: ADHOC_BILLING_DATASET_TASK_CODE,
      outputCode: ADHOC_REPORT_OUTPUT_URL_CODE,
      bucketName,
      ageMinutes: ADHOC_CLEANUP_AGE_MINUTES,
    }),
  ]);

  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failure) throw failure.reason;

  const deletedFiles = results.reduce(
    (sum, result) => sum + (result.status === 'fulfilled' ? result.value.deletedFiles : 0),
    0
  );

  return {
    message: `Cleanup complete: deleted ${deletedFiles} Z3 file(s)`,
    deletedFiles,
  };
}
