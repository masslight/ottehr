import { APIGatewayProxyResult } from 'aws-lambda';
import { Task as FhirTask } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  EXPORT_CSV_OUTPUT_URL_CODE,
  EXPORT_INVOICES_CSV_TASK_CODE,
  EXPORT_INVOICES_CSV_TASK_SYSTEM,
  getSecret,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';

const CLEANUP_AGE_MINUTES = 10;

let m2mToken: string;

export const index = wrapHandler(
  'cleanup-invoice-exports',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createOystehrClient(m2mToken, input.secrets);
    const projectId = getSecret(SecretsKeys.PROJECT_ID, input.secrets);
    const bucketName = `${projectId}-${BUCKET_NAMES.REPORTS}`;

    // Find completed or failed export tasks
    const tasks = (
      await oystehr.fhir.search<FhirTask>({
        resourceType: 'Task',
        params: [
          { name: 'code', value: `${EXPORT_INVOICES_CSV_TASK_SYSTEM}|${EXPORT_INVOICES_CSV_TASK_CODE}` },
          { name: 'status', value: 'completed,failed' },
        ],
      })
    ).unbundle();

    const cutoff = DateTime.now().minus({ minutes: CLEANUP_AGE_MINUTES });
    const eligibleTasks = tasks.filter((task) => {
      const lastModified = task.meta?.lastUpdated;
      return lastModified && DateTime.fromISO(lastModified) < cutoff;
    });

    console.log(
      `Found ${tasks.length} completed/failed export tasks, ${eligibleTasks.length} older than ${CLEANUP_AGE_MINUTES} minutes`
    );

    let deletedFiles = 0;

    for (const task of eligibleTasks) {
      // Delete the Z3 object if the task has an output URL
      const outputUrl = task.output?.find((o) => o.type?.coding?.some((c) => c.code === EXPORT_CSV_OUTPUT_URL_CODE))
        ?.valueString;

      if (outputUrl) {
        // Extract the object path from the full Z3 URL
        // URL format: https://<api>/z3/<bucketName>/<objectPath>
        const z3Marker = `z3/${bucketName}/`;
        const markerIndex = outputUrl.indexOf(z3Marker);
        if (markerIndex !== -1) {
          const objectPath = outputUrl.substring(markerIndex + z3Marker.length);
          try {
            await oystehr.z3.deleteObject({ bucketName, 'objectPath+': objectPath });
            deletedFiles++;
            console.log(`Deleted Z3 object: ${objectPath}`);
          } catch (error) {
            console.error(`Failed to delete Z3 object ${objectPath}:`, error);
          }
        }
      }
    }

    const message = `Cleanup complete: deleted ${deletedFiles} Z3 files`;
    console.log(message);

    return {
      statusCode: 200,
      body: JSON.stringify({ message, deletedFiles }),
    };
  }
);
