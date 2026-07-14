import { APIGatewayProxyResult } from 'aws-lambda';
import { QuestionnaireResponse, Task } from 'fhir/r4b';
import {
  GetMergePatientsTaskResponse,
  getSecret,
  isValidUUID,
  MergePatientsResponse,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
  QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR,
  RoleType,
  Secrets,
  SecretsKeys,
  TASK_INPUT_TYPE_CODES,
  TASK_INPUT_TYPE_SYSTEM,
  TaskIndicator,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  getUser,
  safeJsonParse,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

const ZAMBDA_NAME = 'merge-patients';

let m2mToken: string;

interface KickoffInput {
  userToken: string;
  secrets: Secrets | null;
  mainPatientId: string;
  otherPatientId: string;
  questionnaireResponse: QuestionnaireResponse;
  mode: 'kickoff';
}

interface StatusInput {
  secrets: Secrets | null;
  patientId: string;
  mode: 'status';
}

type ValidatedInput = KickoffInput | StatusInput;

const ACTIVE_STATUSES: ReadonlyArray<Task['status']> = ['requested', 'received', 'accepted', 'in-progress', 'ready'];
// Statuses worth surfacing to the UI even when not active (require user attention).
const ATTENTION_STATUSES: ReadonlyArray<Task['status']> = ['failed'];
// If a Task is still in `requested` after this many ms, the subscription likely
// didn't fire (misconfiguration, deploy hiccup, etc.) and the user should be
// able to dismiss/retry instead of staring at an infinite spinner.
const STUCK_REQUESTED_THRESHOLD_MS = 90_000;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validated = validateRequestParameters(input);
    const { secrets } = validated;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    if (validated.mode === 'status') {
      if (!validated.patientId) {
        return { statusCode: 200, body: JSON.stringify({ task: null }) };
      }
      const response = await getActiveMergeTaskForPatient(validated.patientId, oystehr);
      return { statusCode: 200, body: JSON.stringify(response) };
    }

    const providerProfileReference = await checkAdminAndGetProfile(validated);

    // Reject if there is already an active merge task for this main patient,
    // to avoid two background workers stomping on each other.
    const existing = await getActiveMergeTaskForPatient(validated.mainPatientId, oystehr);
    if (existing.task) {
      const response: MergePatientsResponse = {
        taskId: existing.task.id,
        status: existing.task.status as MergePatientsResponse['status'],
      };
      return { statusCode: 200, body: JSON.stringify(response) };
    }

    // Persist the QR so the subscription handler can read it.
    const qrCreated = await oystehr.fhir.create<QuestionnaireResponse>({
      ...validated.questionnaireResponse,
      // Ensure the QR is anchored to the main patient.
      subject: { reference: `Patient/${validated.mainPatientId}` },
    });

    const task = await oystehr.fhir.create<Task>({
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      code: { coding: [{ system: TaskIndicator.mergePatients.system, code: TaskIndicator.mergePatients.code }] },
      focus: { reference: `QuestionnaireResponse/${qrCreated.id}` },
      for: { reference: `Patient/${validated.mainPatientId}` },
      input: [
        {
          type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.OTHER_PATIENT_ID }] },
          valueString: validated.otherPatientId,
        },
        {
          type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.PROVIDER_PROFILE }] },
          valueString: providerProfileReference,
        },
      ],
    });

    const response: MergePatientsResponse = { taskId: task.id!, status: 'requested' };
    return { statusCode: 200, body: JSON.stringify(response) };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const validateRequestParameters = (input: ZambdaInput): ValidatedInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  if (!input.headers?.Authorization) {
    throw NOT_AUTHORIZED;
  }
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  if (!userToken) {
    throw NOT_AUTHORIZED;
  }
  const { secrets } = input;
  const body = safeJsonParse(input.body);

  // Status mode: caller passes only patientId (no questionnaireResponse).
  // NB: the wire discriminator is `requestMode`, not `mode` — the Oystehr SDK
  // reserves `mode` on zambda.execute payloads and would strip it (see
  // get-vitals.types.ts). The patientId-without-mainPatientId fallback keeps
  // older callers working.
  if (body.requestMode === 'status' || (body.patientId && !body.mainPatientId)) {
    if (!body.patientId) {
      throw MISSING_REQUIRED_PARAMETERS(['patientId']);
    }
    // Polling endpoint is hit on every page render — be tolerant of bogus values
    // (e.g. URLs like /patient/undefined/info producing the literal string
    // "undefined") so they don't spam logs with 400s. The handler will treat
    // these as "no active task".
    if (typeof body.patientId !== 'string' || !isValidUUID(body.patientId)) {
      console.warn(`merge-patients status mode: ignoring non-UUID patientId ${JSON.stringify(body.patientId)}`);
      return { mode: 'status', secrets, patientId: '' };
    }
    return { mode: 'status', secrets, patientId: body.patientId };
  }

  const { mainPatientId, otherPatientId, questionnaireResponse } = body;
  if (!mainPatientId || !otherPatientId) {
    throw MISSING_REQUIRED_PARAMETERS(['mainPatientId', 'otherPatientId']);
  }
  if (!isValidUUID(mainPatientId) || !isValidUUID(otherPatientId)) {
    throw new Error('mainPatientId and otherPatientId must be valid UUIDs');
  }
  if (mainPatientId === otherPatientId) {
    throw new Error('mainPatientId and otherPatientId must be different');
  }
  if (!questionnaireResponse) {
    throw MISSING_REQUIRED_PARAMETERS(['questionnaireResponse']);
  }
  if (questionnaireResponse.resourceType !== 'QuestionnaireResponse') {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse must be of type QuestionnaireResponse');
  }
  return { mode: 'kickoff', userToken, secrets, mainPatientId, otherPatientId, questionnaireResponse };
};

const checkAdminAndGetProfile = async (input: KickoffInput): Promise<string> => {
  const { secrets, userToken } = input;
  const user = await getUser(userToken, secrets);
  if (!user) throw NOT_AUTHORIZED;
  const userRoles = (user as any).roles as { name?: string }[] | undefined;
  const isAdmin = userRoles?.some((role) => role.name === RoleType.Administrator) ?? false;
  if (!isAdmin) throw NOT_AUTHORIZED;
  if (!user.profile) throw NOT_AUTHORIZED;
  return user.profile;
};

const otherPatientIdOf = (task: Task): string =>
  task.input?.find(
    (i) =>
      i.type?.coding?.some(
        (c) => c.system === TASK_INPUT_TYPE_SYSTEM && c.code === TASK_INPUT_TYPE_CODES.OTHER_PATIENT_ID
      )
  )?.valueString ?? '';

async function getActiveMergeTaskForPatient(
  patientId: string,
  oystehr: ReturnType<typeof createClinicalOystehrClient>
): Promise<GetMergePatientsTaskResponse> {
  // Can't search by the merged-away patient directly — it lives in a Task.input
  // valueString, not a search param. So pull recent active/attention merge tasks
  // and match in JS against either role.
  const statusFilter = [...ACTIVE_STATUSES, ...ATTENTION_STATUSES].join(',');
  const tasks = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        {
          name: 'code',
          value: `${TaskIndicator.mergePatients.system}|${TaskIndicator.mergePatients.code}`,
        },
        { name: 'status', value: statusFilter },
        { name: '_sort', value: '-_lastUpdated' },
        { name: '_count', value: '100' },
      ],
    })
  ).unbundle();

  // The page polling for `patientId` may be the surviving (main) patient OR the
  // patient being merged away (the "other" patient). Surface the merge to both
  // so each page shows the in-progress banner and refreshes on completion.
  const patientRef = `Patient/${patientId}`;
  const task = tasks.find((t) => t.for?.reference === patientRef || otherPatientIdOf(t) === patientId);
  if (!task?.id) return { task: null };

  // Surface failed tasks (user must dismiss) and active tasks. A `requested`
  // task that has been sitting unprocessed for too long is treated as stuck
  // (subscription not firing) — also surfaced so the user can dismiss/retry.
  const now = Date.now();
  const lastUpdated = task.meta?.lastUpdated ? new Date(task.meta.lastUpdated).getTime() : now;
  const isStuck = task.status === 'requested' && now - lastUpdated > STUCK_REQUESTED_THRESHOLD_MS;
  const isActive = ACTIVE_STATUSES.includes(task.status) && !isStuck;
  const needsAttention = ATTENTION_STATUSES.includes(task.status) || isStuck;
  if (!isActive && !needsAttention) return { task: null };

  // Report the *other party* from the perspective of the queried patient: the
  // surviving page sees the merged-away patient, and the merged-away page sees
  // the survivor.
  const mainPatientId = task.for?.reference?.replace('Patient/', '') ?? '';
  const taskOtherPatientId = otherPatientIdOf(task);
  const otherPatientId = patientId === mainPatientId ? taskOtherPatientId : mainPatientId;

  // Synthesize a stuck status so the UI can render an actionable banner
  // without needing to know about timestamps.
  const reportedStatus = isStuck
    ? ('failed' as const)
    : (task.status as NonNullable<GetMergePatientsTaskResponse['task']>['status']);
  const statusReason = isStuck
    ? `Merge has been queued for over ${Math.round(
        STUCK_REQUESTED_THRESHOLD_MS / 1000
      )}s without starting. The background worker may be unavailable. Dismiss to retry.`
    : task.statusReason?.text;

  return {
    task: {
      id: task.id,
      status: reportedStatus,
      otherPatientId,
      statusReason,
    },
  };
}
