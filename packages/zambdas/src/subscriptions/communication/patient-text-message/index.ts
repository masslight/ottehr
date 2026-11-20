import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Communication, Patient, RelatedPerson, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_CATEGORY_IDENTIFIER } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { lambdaResponse } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { getVisits } from '../../../shared/support-chat/request-task';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';
import {
  buildTextMessageTask,
  getAttachTextOperations,
  getTextTaskPatientId,
  hasVisitToday,
  isInboundPatientSms,
  isTaskForCommunication,
} from './helpers';

const ZAMBDA_NAME = 'patient-text-message-subscription';
const TEXT_TASK_CLAIM_SYSTEM = ottehrIdentifierSystem('patient-text-task-claim');

let m2mToken: string;

/**
 * Fires for every SMS Communication. A text from a patient with no visit today (not on any tracking
 * board) becomes a Patient Request task, following the portal Support Chat rules: a new text joins
 * the patient's open text task (even if they now have a visit today); otherwise a task is created,
 * unassigned, linked to the patient's newest visit. Completed tasks never reopen.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const communication = validateRequestParameters(input);
  if (!isInboundPatientSms(communication)) {
    return lambdaResponse(200, { skipped: 'not an inbound patient text' });
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);

  const senderId = getIdFromReference(communication.sender?.reference, 'RelatedPerson')!;
  const sender = await oystehr.fhir.get<RelatedPerson>({ resourceType: 'RelatedPerson', id: senderId });
  const patientId = getIdFromReference(sender.patient?.reference, 'Patient');
  const patient = patientId
    ? (await oystehr.fhir.search<Patient>({ resourceType: 'Patient', params: [{ name: '_id', value: patientId }] }))
        .unbundle()
        .at(0)
    : undefined;
  if (!patient?.id) {
    return lambdaResponse(200, { skipped: 'sender has no patient' });
  }

  const [visits, openTextTasks] = await Promise.all([
    getVisits(oystehr, [patient]),
    findOpenTextTasks(oystehr, patient.id),
  ]);

  const openTask = openTextTasks.at(0);
  if (openTask) {
    if (isTaskForCommunication(openTask, communication.id!)) {
      return lambdaResponse(200, { taskId: openTask.id, alreadyProcessed: true });
    }
    await oystehr.fhir.patch<Task>(
      { resourceType: 'Task', id: openTask.id!, operations: getAttachTextOperations(openTask, communication) },
      openTask.meta?.versionId ? { optimisticLockingVersionId: openTask.meta.versionId } : undefined
    );
    return lambdaResponse(200, { taskId: openTask.id, attached: true });
  }

  if (hasVisitToday(visits, DateTime.now())) {
    return lambdaResponse(200, { skipped: 'patient has a visit today' });
  }

  // Same conditional create as the inbound-fax subscription: a re-delivered Communication must not
  // create a second task, and the claim token tells "we created it" from "it already existed".
  const claimToken = randomUUID();
  const newTask: Task = {
    ...buildTextMessageTask({ patient, visit: visits[0], communication }),
    identifier: [{ system: TEXT_TASK_CLAIM_SYSTEM, value: claimToken }],
  };
  const result = await oystehr.fhir.create<Task>(newTask, {
    ifNoneExist: [
      { name: 'based-on', value: `Communication/${communication.id}` },
      { name: 'group-identifier', value: `${TASK_CATEGORY_IDENTIFIER}|${PATIENT_REQUEST_TASK.category}` },
    ],
  });
  const ownsClaim = result.identifier?.some((id) => id.system === TEXT_TASK_CLAIM_SYSTEM && id.value === claimToken);
  return lambdaResponse(200, { taskId: result.id, alreadyProcessed: !ownsClaim || undefined });
});

/** The patient's open text tasks, newest first. Task inputs are not searchable, so the patient filter is in code. */
async function findOpenTextTasks(
  oystehr: ReturnType<typeof createClinicalOystehrClient>,
  patientId: string
): Promise<Task[]> {
  const tasks = await getAllFhirSearchPages<Task>(
    {
      resourceType: 'Task',
      params: [
        { name: 'group-identifier', value: `${TASK_CATEGORY_IDENTIFIER}|${PATIENT_REQUEST_TASK.category}` },
        { name: 'code', value: `${PATIENT_REQUEST_TASK.system}|${PATIENT_REQUEST_TASK.code.textMessage}` },
        { name: 'status', value: 'ready,in-progress' },
        { name: '_sort', value: '-authored-on' },
      ],
    },
    oystehr
  );
  return tasks.filter((task) => getTextTaskPatientId(task) === patientId);
}

function validateRequestParameters(input: ZambdaInput): Communication {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const communication = safeJsonParse(input.body) as Communication;
  if (communication.resourceType !== 'Communication') {
    throw INVALID_INPUT_ERROR(`Expected Communication but got ${communication.resourceType}`);
  }
  if (!communication.id) throw INVALID_INPUT_ERROR('Communication is missing id');
  return communication;
}
