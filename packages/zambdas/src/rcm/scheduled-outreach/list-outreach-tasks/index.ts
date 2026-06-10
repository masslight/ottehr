import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Patient, Task } from 'fhir/r4b';
import {
  FRIENDLY_PATIENT_ID_SYSTEM_BASE,
  isValidUUID,
  MISSING_REQUEST_SECRETS,
  PRIVATE_EXTENSION_BASE_URL,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';

const OUTREACH_TASK_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/outreach-task`;
const OUTREACH_ACTION_TYPE_SYSTEM = 'https://ottehr.com/CodeSystem/outreach-action-type';

let m2mToken: string;

const ZAMBDA_NAME = 'list-outreach-tasks';

export interface OutreachTaskSummary {
  id: string;
  status: string;
  actionType: string;
  triggerEvent: string;
  actionId: string;
  patientId: string;
  patientName: string;
  patientFriendlyId?: string;
  appointmentId?: string;
  visitDate?: string;
  focusReference: string;
  dueDateTime: string;
  authoredOn: string;
  completedDateTime?: string;
  description: string;
  mediums?: string;
  errorMessage?: string;
  cancellationReason?: string;
  chargeResult?: { success: boolean; transactionId?: string; error?: string; amountCents?: number };
  notificationResults?: { medium: string; success: boolean; error?: string }[];
  executionResult?: { medium: string; success: boolean; error?: string }[];
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  const params = input.body ? JSON.parse(input.body) : {};
  const statusFilter = params.status || 'draft,requested,in-progress,completed,on-hold,cancelled';
  const pageSize = Math.min(Math.max(Number(params.pageSize) || 25, 1), 100);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const actionTypeFilter = params.actionType as string | undefined;
  const mediumFilter = params.medium as string | undefined;
  const mediumFilterSet = mediumFilter ? new Set(mediumFilter.split(',')) : undefined;
  const triggerEventFilter = params.triggerEvent as string | undefined;
  const patientSearch = (params.patientSearch as string | undefined)?.trim();

  // Resolve patient search to patient references if provided
  let patientReferences: string[] | undefined;
  if (patientSearch) {
    if (isValidUUID(patientSearch)) {
      patientReferences = [`Patient/${patientSearch}`];
    } else {
      // Search by friendly ID or name
      const patientBundle = await oystehr.fhir.search<Patient>({
        resourceType: 'Patient',
        params: [
          { name: 'identifier', value: patientSearch },
          { name: '_count', value: '50' },
        ],
      });
      let foundPatients = patientBundle.unbundle();
      if (foundPatients.length === 0) {
        // Try name search
        const nameBundle = await oystehr.fhir.search<Patient>({
          resourceType: 'Patient',
          params: [
            { name: 'name', value: patientSearch },
            { name: '_count', value: '50' },
          ],
        });
        foundPatients = nameBundle.unbundle();
      }
      if (foundPatients.length === 0) {
        return {
          statusCode: 200,
          body: JSON.stringify({ tasks: [], totalCount: 0, pageSize, offset }),
        };
      }
      patientReferences = foundPatients.map((p) => `Patient/${p.id}`);
    }
  }

  // Build base search params shared between count and data queries
  const baseSearchParams: { name: string; value: string }[] = [
    { name: '_tag', value: `${OUTREACH_TASK_TAG_SYSTEM}|` },
    { name: 'status', value: statusFilter },
  ];

  if (patientReferences) {
    baseSearchParams.push({ name: 'patient', value: patientReferences.join(',') });
  }

  if (actionTypeFilter) {
    const codeTokens = actionTypeFilter.split(',').map((at) => `${OUTREACH_ACTION_TYPE_SYSTEM}|${at}`);
    baseSearchParams.push({ name: 'code', value: codeTokens.join(',') });
  }

  if (triggerEventFilter) {
    const tagTokens = triggerEventFilter.split(',').map((te) => `${OUTREACH_TASK_TAG_SYSTEM}|${te}`);
    baseSearchParams.push({ name: '_tag', value: tagTokens.join(',') });
  }

  if (params.dueDateFrom) baseSearchParams.push({ name: 'period', value: `ge${params.dueDateFrom}` });
  if (params.dueDateTo) baseSearchParams.push({ name: 'period', value: `le${params.dueDateTo}` });
  if (params.createdFrom) baseSearchParams.push({ name: 'authored-on', value: `ge${params.createdFrom}` });
  if (params.createdTo) baseSearchParams.push({ name: 'authored-on', value: `le${params.createdTo}` });

  let tasks: Task[];
  let patients: Patient[];
  let totalCount: number;

  if (mediumFilterSet) {
    // Medium is stored in Task.input — requires post-filtering.
    // Fetch a larger set, filter, then manually paginate.
    const bundle = await oystehr.fhir.search<Task | Patient>({
      resourceType: 'Task',
      params: [
        ...baseSearchParams,
        { name: '_count', value: '1000' },
        { name: '_sort', value: '-_lastUpdated' },
        { name: '_include', value: 'Task:patient' },
      ],
    });
    const resources = bundle.unbundle();
    const allTasks = resources.filter((r): r is Task => r.resourceType === 'Task');
    patients = resources.filter((r): r is Patient => r.resourceType === 'Patient');

    const filteredTasks = allTasks.filter((task) => {
      const mediums = task.input?.find((i) => i.type?.text === 'mediums')?.valueString;
      if (mediums && mediums.split(',').some((m) => mediumFilterSet.has(m))) return true;
      // Also check charge-card tasks whose notification mediums are stored in the config
      const chargeCardMediums = extractChargeCardMediums(task);
      if (chargeCardMediums && chargeCardMediums.split(',').some((m) => mediumFilterSet.has(m))) return true;
      return false;
    });
    totalCount = filteredTasks.length;
    tasks = filteredTasks.slice(offset, offset + pageSize);
  } else {
    // Standard FHIR-level pagination
    const countBundle = await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [...baseSearchParams, { name: '_summary', value: 'count' }],
    });
    totalCount = countBundle.total ?? 0;

    const bundle = await oystehr.fhir.search<Task | Patient>({
      resourceType: 'Task',
      params: [
        ...baseSearchParams,
        { name: '_count', value: String(pageSize) },
        { name: '_offset', value: String(offset) },
        { name: '_sort', value: '-_lastUpdated' },
        { name: '_include', value: 'Task:patient' },
      ],
    });
    const resources = bundle.unbundle();
    tasks = resources.filter((r): r is Task => r.resourceType === 'Task');
    patients = resources.filter((r): r is Patient => r.resourceType === 'Patient');
  }

  const patientMap = new Map<string, Patient>();
  for (const p of patients) {
    if (p.id) patientMap.set(`Patient/${p.id}`, p);
  }

  // Extract appointment IDs from basedOn and fetch them in batch
  const appointmentIds = new Set<string>();
  for (const task of tasks) {
    const apptRef = task.basedOn?.find((ref) => ref.reference?.startsWith('Appointment/'))?.reference;
    if (apptRef) appointmentIds.add(apptRef.replace('Appointment/', ''));
  }

  const appointmentMap = new Map<string, Appointment>();
  if (appointmentIds.size > 0) {
    const apptBundle = await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [{ name: '_id', value: [...appointmentIds].join(',') }],
    });
    for (const a of apptBundle.unbundle()) {
      if (a.id) appointmentMap.set(`Appointment/${a.id}`, a);
    }
  }

  const summaries: OutreachTaskSummary[] = tasks.map((task) => {
    const patientRef = task.for?.reference || '';
    const patient = patientMap.get(patientRef);
    const patientName = patient?.name?.[0]
      ? [patient.name[0].given?.join(' '), patient.name[0].family].filter(Boolean).join(' ')
      : 'Unknown';
    const patientFriendlyId = patient?.identifier?.find(
      (ident) => ident.system?.startsWith(FRIENDLY_PATIENT_ID_SYSTEM_BASE)
    )?.value;

    const focusRef = task.focus?.reference || '';
    const appointmentBasedOn = task.basedOn?.find((ref) => ref.reference?.startsWith('Appointment/'));
    const appointment = appointmentBasedOn ? appointmentMap.get(appointmentBasedOn.reference!) : undefined;
    const appointmentId = appointment?.id;
    const visitDate = appointment?.start;

    return {
      id: task.id!,
      status: task.status,
      actionType: extractInput(task, 'action-type') || task.code?.coding?.[0]?.code || '',
      triggerEvent: extractInput(task, 'trigger-event') || extractTagTriggerEvent(task) || '',
      actionId: extractInput(task, 'action-id') || '',
      patientId: patientRef.replace('Patient/', ''),
      patientName,
      patientFriendlyId,
      appointmentId,
      visitDate,
      focusReference: focusRef,
      dueDateTime: task.executionPeriod?.start || '',
      authoredOn: task.authoredOn || '',
      completedDateTime: task.executionPeriod?.end,
      description: task.description || '',
      mediums: extractInput(task, 'mediums') || extractChargeCardMediums(task),
      errorMessage: extractErrorMessage(task),
      cancellationReason: task.statusReason?.text,
      chargeResult: extractJsonOutput(task, 'charge-result'),
      notificationResults: extractJsonOutput(task, 'notification-results'),
      executionResult: extractJsonOutput(task, 'execution-result'),
      retryInfo: extractRetryInfo(task),
    };
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ tasks: summaries, totalCount, pageSize, offset }),
  };
});

function extractInput(task: Task, key: string): string | undefined {
  return task.input?.find((i) => i.type?.text === key)?.valueString;
}

function extractChargeCardMediums(task: Task): string | undefined {
  const configStr = extractInput(task, 'charge-card-config');
  if (!configStr) return undefined;
  try {
    const config = JSON.parse(configStr) as {
      onSuccess?: { enabled?: boolean; mediums?: string[] };
      onFailure?: { enabled?: boolean; mediums?: string[] };
    };
    const mediums = new Set<string>();
    if (config.onSuccess?.enabled) {
      config.onSuccess.mediums?.forEach((m) => mediums.add(m));
    }
    if (config.onFailure?.enabled) {
      config.onFailure.mediums?.forEach((m) => mediums.add(m));
    }
    return mediums.size > 0 ? Array.from(mediums).join(',') : undefined;
  } catch {
    return undefined;
  }
}

function extractErrorMessage(task: Task): string | undefined {
  // Check for explicit error output
  const errorOutput = task.output?.find((o) => o.type?.text === 'error');
  if (errorOutput?.valueString) return errorOutput.valueString;

  // Check execution-result for per-medium failures
  const resultOutput = task.output?.find((o) => o.type?.text === 'execution-result');
  if (resultOutput?.valueString) {
    try {
      const results = JSON.parse(resultOutput.valueString) as { medium: string; success: boolean; error?: string }[];
      const failures = results.filter((r) => !r.success);
      if (failures.length > 0) {
        return failures.map((f) => `${f.medium}: ${f.error || 'unknown error'}`).join('; ');
      }
    } catch {
      // ignore parse errors
    }
  }

  return undefined;
}

function extractTagTriggerEvent(task: Task): string | undefined {
  return task.meta?.tag?.find((t) => t.system === OUTREACH_TASK_TAG_SYSTEM)?.code;
}

function extractJsonOutput(task: Task, key: string): any | undefined {
  const output = task.output?.find((o) => o.type?.text === key);
  if (!output?.valueString) return undefined;
  try {
    return JSON.parse(output.valueString);
  } catch {
    return undefined;
  }
}

function extractRetryInfo(
  task: Task
): { attemptCount: number; maxAttempts: number; nextRetryDate?: string } | undefined {
  if (task.code?.coding?.[0]?.code !== 'charge-card') return undefined;

  const configStr = task.input?.find((i) => i.type?.text === 'charge-card-config')?.valueString;
  if (!configStr) return undefined;

  try {
    const config = JSON.parse(configStr) as { retryAttempts?: number };
    const maxAttempts = (config.retryAttempts ?? 0) + 1; // total attempts = initial + retries

    const attemptOutput = task.output?.find((o) => o.type?.text === 'attempt-count');
    const attemptCount = attemptOutput?.valueInteger ?? 0;

    // If the task is in draft and has previous attempts, the executionPeriod.start is the next retry date
    const nextRetryDate = task.status === 'draft' && attemptCount > 0 ? task.executionPeriod?.start : undefined;

    // Only return retry info if retries are configured
    if (config.retryAttempts && config.retryAttempts > 0) {
      return { attemptCount, maxAttempts, nextRetryDate };
    }
    return undefined;
  } catch {
    return undefined;
  }
}
