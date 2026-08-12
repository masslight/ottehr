import { APIGatewayProxyResult } from 'aws-lambda';
import {
  BUCKET_NAMES,
  EXPORT_INVOICES_CSV_TASK_CODE,
  EXPORT_INVOICES_CSV_TASK_SYSTEM,
  getSecret,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
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
