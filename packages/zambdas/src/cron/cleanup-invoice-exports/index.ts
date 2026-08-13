import { APIGatewayProxyResult } from 'aws-lambda';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { EXPORT_INVOICES_CSV_TASK_CODE, EXPORT_INVOICES_CSV_TASK_SYSTEM } from 'utils/lib/types/api/invoicing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { cleanupExportTaskFiles } from '../cleanup-export-task-files';

const CLEANUP_AGE_MINUTES = 10;

let m2mToken: string;

export const index = wrapHandler(
  'cleanup-invoice-exports',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);
    const projectId = getSecret(SecretsKeys.PROJECT_ID, input.secrets);

    const response = await cleanupExportTaskFiles({
      oystehr,
      taskSystem: EXPORT_INVOICES_CSV_TASK_SYSTEM,
      taskCode: EXPORT_INVOICES_CSV_TASK_CODE,
      bucketName: `${projectId}-${BUCKET_NAMES.REPORTS}`,
      ageMinutes: CLEANUP_AGE_MINUTES,
    });

    console.log(response.message);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);
