import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { EXPORT_TASK_SYSTEM } from 'utils/lib/types/api/invoicing.types';
import { EXPORT_CLAIMS_CSV_TASK_CODE } from 'utils/lib/types/data/billing/billing.constants';
import { createBillingClient } from '../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
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
