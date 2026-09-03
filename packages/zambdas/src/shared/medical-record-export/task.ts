import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  GetPatientMedicalRecordOutput,
  MEDICAL_RECORD_EXPORT_DEADLINE_CODE,
  MEDICAL_RECORD_EXPORT_FAILURE_CODE,
  MEDICAL_RECORD_EXPORT_FILE_NAME_CODE,
  MEDICAL_RECORD_EXPORT_OUTPUT_URL_CODE,
  MEDICAL_RECORD_EXPORT_PROGRESS_CODE,
  MEDICAL_RECORD_EXPORT_TASK_CODE,
  MEDICAL_RECORD_EXPORT_TASK_SYSTEM,
  MedicalRecordExportProgress,
  MedicalRecordExportProgressSchema,
  MedicalRecordExportStatus,
} from 'utils/lib/types/data/get-patient-medical-record.types';

export const ACTIVE_EXPORT_TASK_STATUSES: Task['status'][] = ['requested', 'received', 'accepted', 'in-progress'];

/**
 * Past this, a `requested` Task probably means the Subscription never fired. Generous on purpose: too
 * tight duplicates the whole archive, too loose only delays a retry.
 */
export const STUCK_REQUESTED_THRESHOLD_MS = 5 * 60_000;

/**
 * Fallback for a Task that went `in-progress` and quiet without publishing a deadline. The zambda's own
 * ceiling is 900 s, so nothing is still running this long after its last sign of life.
 */
export const STUCK_IN_PROGRESS_THRESHOLD_MS = 16 * 60_000;

type TaskOutput = NonNullable<Task['output']>[number];

const findOutput = (task: Task, code: string): TaskOutput | undefined =>
  task.output?.find((output) => output.type?.coding?.some((coding) => coding.code === code));

export const readExportedFileUrl = (task: Task): string | undefined =>
  findOutput(task, MEDICAL_RECORD_EXPORT_OUTPUT_URL_CODE)?.valueString;

export const readExportedFileName = (task: Task): string | undefined =>
  findOutput(task, MEDICAL_RECORD_EXPORT_FILE_NAME_CODE)?.valueString;

export const readExportDeadline = (task: Task): DateTime | undefined => {
  const raw = findOutput(task, MEDICAL_RECORD_EXPORT_DEADLINE_CODE)?.valueString;
  if (!raw) return undefined;
  const parsed = DateTime.fromISO(raw);
  return parsed.isValid ? parsed : undefined;
};

export const readUserFacingFailure = (task: Task): string | undefined =>
  findOutput(task, MEDICAL_RECORD_EXPORT_FAILURE_CODE)?.valueString || undefined;

export const readExportProgress = (task: Task): MedicalRecordExportProgress | undefined => {
  const raw = findOutput(task, MEDICAL_RECORD_EXPORT_PROGRESS_CODE)?.valueString;
  if (!raw) return undefined;
  try {
    return MedicalRecordExportProgressSchema.parse(JSON.parse(raw));
  } catch (error) {
    console.warn(`Ignoring unreadable export progress on Task/${task.id}: ${String(error)}`);
    return undefined;
  }
};

export const patientIdFromTask = (task: Task): string => {
  const reference = task.for?.reference ?? '';
  const [resourceType, id] = reference.split('/');
  if (resourceType !== 'Patient' || !id) {
    throw new Error(`Medical record export Task/${task.id} does not name a Patient in its subject`);
  }
  return id;
};

const FAILED_TASK_STATUSES: Task['status'][] = ['failed', 'cancelled', 'rejected', 'entered-in-error'];

export const toExportStatus = (taskStatus: Task['status']): MedicalRecordExportStatus => {
  if (taskStatus === 'completed') return 'completed';
  if (FAILED_TASK_STATUSES.includes(taskStatus)) return 'failed';
  return taskStatus === 'in-progress' ? 'in-progress' : 'requested';
};

export const isMedicalRecordExportTask = (task: Task): boolean =>
  task.code?.coding?.some(
    (coding) => coding.system === MEDICAL_RECORD_EXPORT_TASK_SYSTEM && coding.code === MEDICAL_RECORD_EXPORT_TASK_CODE
  ) ?? false;

const millisSinceLastUpdate = (task: Task, now: DateTime): number | undefined => {
  const lastUpdated = task.meta?.lastUpdated;
  if (!lastUpdated) return undefined;
  const updated = DateTime.fromISO(lastUpdated);
  return updated.isValid ? now.diff(updated).toMillis() : undefined;
};

/**
 * True for a Task in an active status that nothing is working on any more. Nothing else ever moves a Task
 * off `in-progress`, so without this a killed worker would make the chart un-exportable forever.
 *
 * The running case uses the deadline the worker publishes rather than a quiet-time guess: collection and
 * the size pass legitimately run for minutes without a progress write.
 */
export const isAbandonedExportTask = (task: Task, now: DateTime = DateTime.now()): boolean => {
  if (task.status === 'requested') {
    const idleFor = millisSinceLastUpdate(task, now);
    return idleFor !== undefined && idleFor > STUCK_REQUESTED_THRESHOLD_MS;
  }

  if (!ACTIVE_EXPORT_TASK_STATUSES.includes(task.status)) return false;

  const deadline = readExportDeadline(task);
  if (deadline) return now > deadline;

  const idleFor = millisSinceLastUpdate(task, now);
  return idleFor !== undefined && idleFor > STUCK_IN_PROGRESS_THRESHOLD_MS;
};

export const cancelAbandonedExportTask = async (oystehr: Oystehr, task: Task): Promise<void> => {
  try {
    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        { op: 'replace', path: '/status', value: 'cancelled' },
        {
          op: task.statusReason ? 'replace' : 'add',
          path: '/statusReason',
          value: { text: `abandoned in status ${task.status}; superseded by a new export` },
        },
      ],
    });
  } catch (error) {
    console.warn(`Could not cancel abandoned export Task/${task.id}: ${String(error)}`);
  }
};

export const buildExportStatusResponse = async (
  task: Task,
  presign: (url: string) => Promise<string>
): Promise<GetPatientMedicalRecordOutput> => {
  const status = toExportStatus(task.status);
  const fileName = readExportedFileName(task);
  const progress = readExportProgress(task);

  const base: GetPatientMedicalRecordOutput = {
    taskId: task.id!,
    status,
    processed: progress?.processed,
    total: progress?.total,
    skipped: progress?.skipped,
    fileName,
  };

  if (status === 'failed') {
    // Only an authored message crosses this boundary; `statusReason` holds the raw cause and stays
    // server-side, as in outbound-fax. With none, the front end supplies its own generic wording.
    return { ...base, error: readUserFacingFailure(task) };
  }

  if (status !== 'completed') {
    return base;
  }

  const objectUrl = readExportedFileUrl(task);
  // A completed export of a chart with no documents legitimately has no file (see `total: 0`).
  if (!objectUrl) {
    return base;
  }

  return { ...base, downloadUrl: await presign(objectUrl) };
};

export const createExportTask = async (oystehr: Oystehr, patientId: string): Promise<Task> =>
  oystehr.fhir.create<Task>({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    code: {
      coding: [{ system: MEDICAL_RECORD_EXPORT_TASK_SYSTEM, code: MEDICAL_RECORD_EXPORT_TASK_CODE }],
    },
    for: { reference: `Patient/${patientId}` },
    authoredOn: DateTime.now().toUTC().toISO() ?? undefined,
  });

export interface ExportTaskSearchResult {
  active?: Task;
  abandoned: Task[];
}

/**
 * The export already queued or running for this patient, so a double-click or reload re-attaches instead
 * of building a second near-identical archive.
 */
export const findActiveExportTask = async (oystehr: Oystehr, patientId: string): Promise<ExportTaskSearchResult> => {
  const bundle = await oystehr.fhir.search<Task>({
    resourceType: 'Task',
    params: [
      { name: 'code', value: `${MEDICAL_RECORD_EXPORT_TASK_SYSTEM}|${MEDICAL_RECORD_EXPORT_TASK_CODE}` },
      // `patient` is R4's search param for `Task.for` pointing at a Patient.
      { name: 'patient', value: `Patient/${patientId}` },
      { name: 'status', value: ACTIVE_EXPORT_TASK_STATUSES.join(',') },
      { name: '_sort', value: '-_lastUpdated' },
      { name: '_count', value: '5' },
    ],
  });

  const tasks = bundle.unbundle().filter((resource): resource is Task => resource.resourceType === 'Task');
  const now = DateTime.now();
  return {
    active: tasks.find((task) => !isAbandonedExportTask(task, now)),
    abandoned: tasks.filter((task) => isAbandonedExportTask(task, now)),
  };
};

/** How often progress may be written back. A 1000-file export becomes a handful of FHIR writes. */
export const PROGRESS_PATCH_INTERVAL_MS = 2_000;

export interface ExportTaskWriter {
  /** The instant this worker gives up by, so a Task left `in-progress` by a kill can be spotted as dead. */
  recordDeadline: (deadline: DateTime) => Promise<void>;
  reportProgress: (progress: MedicalRecordExportProgress) => Promise<void>;
  recordUserFacingFailure: (message: string) => Promise<void>;
  /** Writes the finished archive's location, along with final progress. Always writes through. */
  recordResult: (result: {
    fileUrl?: string;
    fileName: string;
    progress: MedicalRecordExportProgress;
  }) => Promise<void>;
}

/**
 * Owns the Task's `output` array for a job. `patchTaskStatus` only touches `/status` and `/statusReason`,
 * so what is written here survives completion; writes replace the whole array so repeated progress
 * reports cannot grow the Task without bound.
 */
export const createExportTaskWriter = (
  oystehr: Oystehr,
  task: Task,
  now: () => number = () => Date.now()
): ExportTaskWriter => {
  let hasOutput = (task.output?.length ?? 0) > 0;
  // Undefined rather than 0, so the first report always goes through and the poller learns the total.
  let lastWriteAt: number | undefined;
  let lastProgress: MedicalRecordExportProgress | undefined;
  let fileEntries: { code: string; valueString: string }[] = [];
  // Kept out of `fileEntries` so `recordResult` replacing those cannot drop it.
  let deadlineEntry: { code: string; valueString: string } | undefined;
  let failureEntry: { code: string; valueString: string } | undefined;

  const write = async (): Promise<void> => {
    const outputs = [
      ...(deadlineEntry ? [deadlineEntry] : []),
      ...(failureEntry ? [failureEntry] : []),
      ...fileEntries,
      ...(lastProgress
        ? [{ code: MEDICAL_RECORD_EXPORT_PROGRESS_CODE, valueString: JSON.stringify(lastProgress) }]
        : []),
    ];
    if (outputs.length === 0) return;

    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        {
          op: hasOutput ? 'replace' : 'add',
          path: '/output',
          value: outputs.map(({ code, valueString }) => ({
            type: { coding: [{ system: MEDICAL_RECORD_EXPORT_TASK_SYSTEM, code }] },
            valueString,
          })),
        },
      ],
    });
    hasOutput = true;
    // Only a write carrying progress arms the throttle, or recording the deadline would hold the first
    // real report back for a window.
    if (lastProgress) lastWriteAt = now();
  };

  return {
    recordDeadline: async (deadline) => {
      deadlineEntry = { code: MEDICAL_RECORD_EXPORT_DEADLINE_CODE, valueString: deadline.toUTC().toISO() ?? '' };
      // A failure here costs staleness detection precision, not the export: the idle fallback still applies.
      await write().catch((error) => console.warn(`Could not publish the export deadline: ${String(error)}`));
    },
    recordUserFacingFailure: async (message) => {
      failureEntry = { code: MEDICAL_RECORD_EXPORT_FAILURE_CODE, valueString: message };
      // Written before the handler rethrows, so it lands before the status flips to failed.
      await write();
    },
    reportProgress: async (progress) => {
      lastProgress = progress;
      if (lastWriteAt !== undefined && now() - lastWriteAt < PROGRESS_PATCH_INTERVAL_MS) return;
      await write().catch((error) => console.warn(`Could not publish export progress: ${String(error)}`));
    },
    recordResult: async ({ fileUrl, fileName, progress }) => {
      lastProgress = progress;
      fileEntries = [
        ...(fileUrl ? [{ code: MEDICAL_RECORD_EXPORT_OUTPUT_URL_CODE, valueString: fileUrl }] : []),
        { code: MEDICAL_RECORD_EXPORT_FILE_NAME_CODE, valueString: fileName },
      ];
      await write();
    },
  };
};
