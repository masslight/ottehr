import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BUCKET_NAMES, EXPORT_CLAIMS_CSV_TASK_CODE, EXPORT_TASK_SYSTEM, getSecret, Secrets, SecretsKeys } from 'utils';
import { createBillingClient } from '../../billing/shared';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { cleanupExportTaskFiles, CleanupExportTaskFilesResult } from '../cleanup-export-task-files';
import { validateRequestParameters } from './validateRequestParameters';

const CLEANUP_AGE_MINUTES = 10;

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
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function performEffect(oystehr: Oystehr, secrets: Secrets): Promise<CleanupExportTaskFilesResult> {
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);

  return cleanupExportTaskFiles({
    oystehr,
    taskSystem: EXPORT_TASK_SYSTEM,
    taskCode: EXPORT_CLAIMS_CSV_TASK_CODE,
    bucketName: `${projectId}-${BUCKET_NAMES.BILLING_CLAIM_EXPORTS}`,
    ageMinutes: CLEANUP_AGE_MINUTES,
  });
}
