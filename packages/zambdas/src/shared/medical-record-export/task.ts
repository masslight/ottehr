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

export const STUCK_REQUESTED_THRESHOLD_MS = 5 * 60_000;

export const STUCK_IN_PROGRESS_THRESHOLD_MS = 16 * 60_000;

export const ABANDONED_EXPORT_MESSAGE = 'This export stopped responding before it finished. Please try again.';

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
    return { ...base, error: readUserFacingFailure(task) };
  }

  if (status !== 'completed') {
    return base;
  }

  const objectUrl = readExportedFileUrl(task);
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

export const findActiveExportTask = async (oystehr: Oystehr, patientId: string): Promise<ExportTaskSearchResult> => {
  const bundle = await oystehr.fhir.search<Task>({
    resourceType: 'Task',
    params: [
      { name: 'code', value: `${MEDICAL_RECORD_EXPORT_TASK_SYSTEM}|${MEDICAL_RECORD_EXPORT_TASK_CODE}` },
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

export const PROGRESS_PATCH_INTERVAL_MS = 2_000;

export interface ExportTaskWriter {
  recordDeadline: (deadline: DateTime) => Promise<void>;
  reportProgress: (progress: MedicalRecordExportProgress) => Promise<void>;
  recordUserFacingFailure: (message: string) => Promise<void>;
  recordResult: (result: {
    fileUrl?: string;
    fileName: string;
    progress: MedicalRecordExportProgress;
  }) => Promise<void>;
}

export const createExportTaskWriter = (
  oystehr: Oystehr,
  task: Task,
  now: () => number = () => Date.now()
): ExportTaskWriter => {
  let hasOutput = (task.output?.length ?? 0) > 0;
  let lastWriteAt: number | undefined;
  let lastProgress: MedicalRecordExportProgress | undefined;
  let fileEntries: { code: string; valueString: string }[] = [];
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
    if (lastProgress) lastWriteAt = now();
  };

  return {
    recordDeadline: async (deadline) => {
      deadlineEntry = { code: MEDICAL_RECORD_EXPORT_DEADLINE_CODE, valueString: deadline.toUTC().toISO() ?? '' };
      await write().catch((error) => console.warn(`Could not publish the export deadline: ${String(error)}`));
    },
    recordUserFacingFailure: async (message) => {
      failureEntry = { code: MEDICAL_RECORD_EXPORT_FAILURE_CODE, valueString: message };
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
