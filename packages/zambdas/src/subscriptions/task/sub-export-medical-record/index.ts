import { DateTime } from 'luxon';
import { Secrets } from 'utils/lib/secrets';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { isUserFacingExportError } from '../../../shared/medical-record-export/errors';
import { runMedicalRecordExport } from '../../../shared/medical-record-export/run-export';
import { createExportTaskWriter, patientIdFromTask } from '../../../shared/medical-record-export/task';
import { wrapTaskHandler } from '../helpers';

const ZAMBDA_NAME = 'sub-export-medical-record';

// The zambda's own ceiling is 900 s. Stopping short of it turns "killed mid-upload, Task stuck
// in-progress forever" into a Task that fails with a reason the user can act on.
const EXPORT_BUDGET_MS = 13 * 60 * 1000;

let cachedM2MToken: string | undefined;

const ensureM2MToken = async (secrets: Secrets | null): Promise<string> => {
  cachedM2MToken = await checkOrCreateM2MClientToken(cachedM2MToken ?? '', secrets);
  return cachedM2MToken;
};

export const index = wrapTaskHandler(
  ZAMBDA_NAME,
  async (input, oystehr) => {
    const { task, secrets } = input;

    const patientId = patientIdFromTask(task);
    const token = await ensureM2MToken(secrets);
    const writer = createExportTaskWriter(oystehr, task);
    const deadlineAt = Date.now() + EXPORT_BUDGET_MS;

    // Before any work starts: if this invocation is killed, nothing else moves the Task off `in-progress`,
    // and this is what lets the next kickoff tell a dead job from a running one.
    await writer.recordDeadline(DateTime.fromMillis(deadlineAt));

    let result;
    try {
      result = await runMedicalRecordExport({
        oystehr,
        token,
        secrets,
        patientId,
        deadlineAt,
        onProgress: async (processed, total) => {
          await writer.reportProgress({ processed, total });
        },
      });
    } catch (error) {
      if (isUserFacingExportError(error)) {
        await writer
          .recordUserFacingFailure(error.message)
          .catch((writeError) => console.warn(`Could not publish the export failure: ${String(writeError)}`));
      }
      throw error;
    }

    await writer.recordResult({
      fileUrl: result.fileUrl,
      fileName: result.fileName,
      progress: {
        processed: result.documentCount,
        total: result.documentCount,
        skipped: result.skippedCount || undefined,
      },
    });

    const skippedNote = result.skippedCount > 0 ? `; ${result.skippedCount} unreadable file(s) skipped` : '';

    return {
      taskStatus: 'completed' as const,
      statusReason:
        result.documentCount === 0
          ? `no documents to archive${skippedNote}`
          : `${result.documentCount} file(s) archived into ${result.archiveBytes} bytes${skippedNote}`,
    };
  },
  { retry: false }
);
