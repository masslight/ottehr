import { QuestionnaireResponse, Task } from 'fhir/r4b';
import { Secrets, TASK_INPUT_TYPE_CODES, TASK_INPUT_TYPE_SYSTEM } from 'utils';
import { performMerge } from '../../../ehr/merge-patients/perform';
import { checkOrCreateM2MClientToken } from '../../../shared';
import { wrapTaskHandler } from '../helpers';

let cachedM2MToken: string | undefined;

const ensureM2MToken = async (secrets: Secrets | null): Promise<string> => {
  cachedM2MToken = await checkOrCreateM2MClientToken(cachedM2MToken ?? '', secrets);
  return cachedM2MToken;
};

export const index = wrapTaskHandler('sub-merge-patients', async (input, oystehr) => {
  const { task, secrets } = input;
  const taskId = task.id!;

  const qrId = extractQrId(task);
  const otherPatientId = extractInputString(task, TASK_INPUT_TYPE_CODES.OTHER_PATIENT_ID);
  const providerProfileReference = extractInputString(task, TASK_INPUT_TYPE_CODES.PROVIDER_PROFILE);

  if (!otherPatientId) {
    return { taskStatus: 'failed' as const, statusReason: `Task ${taskId} missing other-patient-id input` };
  }
  if (!providerProfileReference) {
    return { taskStatus: 'failed' as const, statusReason: `Task ${taskId} missing provider-profile input` };
  }

  const qr = await oystehr.fhir.get<QuestionnaireResponse>({ resourceType: 'QuestionnaireResponse', id: qrId });
  const mainPatientId = qr.subject?.reference?.replace('Patient/', '');
  if (!mainPatientId) {
    return { taskStatus: 'failed' as const, statusReason: `QR ${qrId} subject is not a Patient` };
  }

  const m2mToken = await ensureM2MToken(secrets);

  console.log(
    `Starting async merge for Patient/${mainPatientId} ← Patient/${otherPatientId} (Task/${taskId}, QR/${qrId})`
  );

  await performMerge(
    { mainPatientId, otherPatientId, questionnaireResponse: qr, providerProfileReference, secrets },
    oystehr,
    m2mToken
  );

  // mark qr as completed
  await oystehr.fhir.update<QuestionnaireResponse>({
    ...qr,
    status: 'completed',
  });

  return {
    taskStatus: 'completed' as const,
    statusReason: `merged Patient/${otherPatientId} into Patient/${mainPatientId}`,
  };
});

function extractQrId(task: Task): string {
  const ref = task.focus?.reference;
  if (!ref?.startsWith('QuestionnaireResponse/')) {
    throw new Error(`Task focus is not a QuestionnaireResponse: ${ref}`);
  }
  return ref.replace('QuestionnaireResponse/', '');
}

function extractInputString(task: Task, code: string): string | undefined {
  return task.input?.find((i) => i.type?.coding?.some((c) => c.system === TASK_INPUT_TYPE_SYSTEM && c.code === code))
    ?.valueString;
}
