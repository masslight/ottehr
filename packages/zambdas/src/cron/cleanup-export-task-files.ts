import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getPatchOperationForNewMetaTag } from 'utils/lib/fhir/resourcePatch';
import { EXPORT_CSV_OUTPUT_URL_CODE, EXPORT_FILE_CLEANED_TAG } from 'utils/lib/types/api/invoicing.types';

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
        {
          name: '_tag:not',
          value: `${EXPORT_FILE_CLEANED_TAG.system}|${EXPORT_FILE_CLEANED_TAG.code}`,
        },
      ],
    },
    oystehr
  );

  // An export the caller may still be downloading is left alone until its window has passed.
  const cutoff = DateTime.now().minus({ minutes: ageMinutes });
  const uncleaned = tasks.filter((task) => !isCleaned(task));
  if (uncleaned.length !== tasks.length) {
    console.warn(
      `\`_tag:not\` was not honored: ${tasks.length - uncleaned.length} already-cleaned export task(s) came back`
    );
  }
  const expired = uncleaned.filter((task) => {
    const lastUpdated = task.meta?.lastUpdated;
    return lastUpdated && DateTime.fromISO(lastUpdated) < cutoff;
  });
  console.log(`found ${uncleaned.length} uncleaned export task(s), ${expired.length} older than ${ageMinutes}m`);

  let deletedFiles = 0;
  for (const task of expired) {
    const taskId = task.id;
    if (!taskId) {
      console.warn('Skipping an export task the search returned without an id');
      continue;
    }

    // A finished export Task holds the Z3 url of the CSV it produced. A failed export has none, so
    // there is nothing to delete and the task only needs tagging.
    const outputIndex = exportOutputIndex(task);
    const objectUrl = outputIndex === -1 ? undefined : task.output?.[outputIndex]?.valueString;
    const objectPath = exportObjectPath(objectUrl, bucketName);
    if (objectUrl && !objectPath) {
      console.warn(`Task/${taskId} holds an output url outside ${bucketName}, leaving its object in place`);
    }

    if (objectPath) {
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
    }

    // Taking the url off the Task leaves a later poll with nothing to download instead of a link to
    // a deleted object. The tag drops the task out of the search above, so neither the deletes nor
    // the pages this cron reads grow with the number of exports the project has run.
    const operations: Operation[] = [];
    if (objectPath) {
      operations.push({
        op: 'remove',
        path: `/output/${outputIndex}`,
      });
    }
    operations.push(getPatchOperationForNewMetaTag(task, EXPORT_FILE_CLEANED_TAG));

    try {
      await oystehr.fhir.patch<Task>({
        resourceType: 'Task',
        id: taskId,
        operations,
      });
    } catch (error) {
      console.error(`Cleaned up Task/${taskId} but could not mark it cleaned:`, error);
    }
  }

  return {
    message: `Cleanup complete: deleted ${deletedFiles} Z3 file(s)`,
    deletedFiles,
  };
}

const isCleaned = (task: Task): boolean =>
  task.meta?.tag?.some(
    (tag) => tag.system === EXPORT_FILE_CLEANED_TAG.system && tag.code === EXPORT_FILE_CLEANED_TAG.code
  ) ?? false;

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
