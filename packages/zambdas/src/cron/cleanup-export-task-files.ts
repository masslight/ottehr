import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { EXPORT_CSV_OUTPUT_URL_CODE, getAllFhirSearchPages } from 'utils';

export interface CleanupExportTaskFilesInput {
  oystehr: Oystehr;
  taskSystem: string;
  taskCode: string;
  bucketName: string;
  ageMinutes: number;
}

export interface CleanupExportTaskFilesResult {
  message: string;
  deletedFiles: number;
}

export async function cleanupExportTaskFiles({
  oystehr,
  taskSystem,
  taskCode,
  bucketName,
  ageMinutes,
}: CleanupExportTaskFilesInput): Promise<CleanupExportTaskFilesResult> {
  const tasks = await getAllFhirSearchPages<Task>(
    {
      resourceType: 'Task',
      params: [
        {
          name: 'code',
          value: `${taskSystem}|${taskCode}`,
        },
        {
          name: 'status',
          value: 'completed,failed',
        },
      ],
    },
    oystehr
  );

  // An export the caller may still be downloading is left alone until its window has passed.
  const cutoff = DateTime.now().minus({ minutes: ageMinutes });
  const expired = tasks.filter((task) => {
    const lastUpdated = task.meta?.lastUpdated;
    return lastUpdated && DateTime.fromISO(lastUpdated) < cutoff;
  });
  console.log(`found ${tasks.length} finished export task(s), ${expired.length} older than ${ageMinutes}m`);

  let deletedFiles = 0;
  for (const task of expired) {
    // A finished export Task holds the Z3 url of the CSV it produced.
    const outputIndex = exportOutputIndex(task);
    if (outputIndex === -1) continue;

    const objectPath = exportObjectPath(task.output?.[outputIndex]?.valueString, bucketName);
    if (!objectPath) continue;

    try {
      await oystehr.z3.deleteObject({
        bucketName,
        'objectPath+': objectPath,
      });
      deletedFiles += 1;
    } catch (error) {
      console.error(`Failed to delete Z3 object ${objectPath}:`, error);
      continue;
    }

    // Taking the url off the Task leaves a later poll with nothing to download instead of a link to
    // a deleted object, and stops this cron retrying the same delete on every run, so no task has
    // to age out of the search to keep the work bounded.
    try {
      await oystehr.fhir.patch<Task>({
        resourceType: 'Task',
        id: task.id ?? '',
        operations: [
          {
            op: 'remove',
            path: `/output/${outputIndex}`,
          },
        ],
      });
    } catch (error) {
      console.error(`Deleted ${objectPath} but could not drop its url from Task/${task.id}:`, error);
    }
  }

  return {
    message: `Cleanup complete: deleted ${deletedFiles} Z3 file(s)`,
    deletedFiles,
  };
}

const exportOutputIndex = (task: Task): number =>
  task.output?.findIndex(
    (output) => output.type?.coding?.some((coding) => coding.code === EXPORT_CSV_OUTPUT_URL_CODE)
  ) ?? -1;

const exportObjectPath = (url: string | undefined, bucketName: string): string | undefined => {
  if (!url) return undefined;
  const marker = `z3/${bucketName}/`;
  const markerIndex = url.indexOf(marker);
  return markerIndex === -1 ? undefined : url.slice(markerIndex + marker.length);
};
