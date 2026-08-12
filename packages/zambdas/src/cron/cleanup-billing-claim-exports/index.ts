import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  EXPORT_CLAIMS_CSV_TASK_CODE,
  EXPORT_CSV_OUTPUT_URL_CODE,
  EXPORT_TASK_SYSTEM,
  getSecret,
  Secrets,
  SecretsKeys,
} from 'utils';
import { createBillingClient } from '../../billing/shared';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const CLEANUP_AGE_MINUTES = 10;
const CLEANUP_WINDOW_HOURS = 24;

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

async function performEffect(oystehr: Oystehr, secrets: Secrets): Promise<{ message: string; deletedFiles: number }> {
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const bucketName = `${projectId}-${BUCKET_NAMES.BILLING_CLAIM_EXPORTS}`;
  const now = DateTime.now();

  const tasks = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        {
          name: 'code',
          value: `${EXPORT_TASK_SYSTEM}|${EXPORT_CLAIMS_CSV_TASK_CODE}`,
        },
        {
          name: 'status',
          value: 'completed,failed',
        },
        {
          name: '_lastUpdated',
          value: `gt${now.minus({ hours: CLEANUP_WINDOW_HOURS }).toISO()}`,
        },
      ],
    })
  ).unbundle();

  const cutoff = now.minus({ minutes: CLEANUP_AGE_MINUTES });
  const expired = tasks.filter((task) => {
    const lastUpdated = task.meta?.lastUpdated;
    return lastUpdated && DateTime.fromISO(lastUpdated) < cutoff;
  });
  console.log(`found ${tasks.length} finished export task(s), ${expired.length} older than ${CLEANUP_AGE_MINUTES}m`);

  let deletedFiles = 0;
  for (const task of expired) {
    const objectPath = exportObjectPath(task, bucketName);
    if (!objectPath) continue;

    try {
      await oystehr.z3.deleteObject({
        bucketName,
        'objectPath+': objectPath,
      });
      deletedFiles += 1;
    } catch (error) {
      console.error(`Failed to delete Z3 object ${objectPath}:`, error);
    }
  }

  return {
    message: `Cleanup complete: deleted ${deletedFiles} Z3 file(s)`,
    deletedFiles,
  };
}

function exportObjectPath(task: Task, bucketName: string): string | undefined {
  const url = task.output?.find(
    (output) => output.type?.coding?.some((coding) => coding.code === EXPORT_CSV_OUTPUT_URL_CODE)
  )?.valueString;
  if (!url) return undefined;

  const marker = `z3/${bucketName}/`;
  const markerIndex = url.indexOf(marker);
  return markerIndex === -1 ? undefined : url.slice(markerIndex + marker.length);
}
