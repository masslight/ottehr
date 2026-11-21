import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { getCoding } from 'utils/lib/fhir/helpers';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { CompleteJournalTaskInputSchema, CompleteJournalTaskOutput } from 'utils/lib/types/api/provider-journal.types';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { MANUAL_TASK, PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import {
  CONCURRENT_UPDATE_WITH_MESSAGE,
  FHIR_RESOURCE_NOT_FOUND,
  INVALID_INPUT_ERROR,
  NOT_AUTHORIZED,
} from 'utils/lib/types/errors';
import { getUserToken, requireUserWithRole } from '../../../shared/auth';
import { isFhirNotFoundError } from '../../../shared/errors';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { lambdaResponse } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { isOpenBoardTask, taskOwnerId } from '../get-provider-journal/helpers';

const ZAMBDA_NAME = 'complete-journal-task';

const isForbidden = (error: unknown): boolean => [401, 403].includes((error as { code?: number })?.code ?? 0);

/**
 * Completes an open Patient Follow-up or text task from the journal's Free form note dialog ("Mark '…' done"), with
 * the same access as the Tasks page's Complete: an EHR staff role whose own access policy can update the task, and
 * only the task's assignee.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { taskId, secrets } = validateWithSchema(CompleteJournalTaskInputSchema, input);
  const userToken = getUserToken(input);
  const user = await requireUserWithRole(userToken, secrets, ALL_EHR_STAFF_ROLES);

  // Exactly the Tasks page's Complete (completeTaskVersionChecked): the caller's own token, so FHIR records who
  // completed it and their access policy applies; status only; version-checked.
  const oystehr = createClinicalOystehrClient(userToken, secrets);

  let task: Task;
  try {
    task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });
  } catch (error) {
    if (isFhirNotFoundError(error)) throw FHIR_RESOURCE_NOT_FOUND('Task');
    if (isForbidden(error)) throw NOT_AUTHORIZED;
    throw error;
  }
  if (!isOpenBoardTask(task)) throw INVALID_INPUT_ERROR('Only an open task on the Tasks board can be completed');
  // The Free form note dialog only offers Patient Follow-up and text tasks; result reviews close through the order.
  const isTextTask =
    task.groupIdentifier?.value === PATIENT_REQUEST_TASK.category &&
    getCoding(task.code, PATIENT_REQUEST_TASK.system)?.code === PATIENT_REQUEST_TASK.code.textMessage;
  if (task.groupIdentifier?.value !== MANUAL_TASK.category.patientFollowUp && !isTextTask) {
    throw INVALID_INPUT_ERROR('Only a Patient Follow-up or text task can be marked done here');
  }
  // The Tasks page shows Complete only to the task's assignee.
  const callerId = getIdFromReference(user.profile, 'Practitioner');
  if (!callerId || taskOwnerId(task) !== callerId) {
    throw INVALID_INPUT_ERROR("Only the task's assignee can mark it done");
  }

  try {
    await oystehr.fhir.patch<Task>(
      { resourceType: 'Task', id: taskId, operations: [{ op: 'replace', path: '/status', value: 'completed' }] },
      task.meta?.versionId ? { optimisticLockingVersionId: task.meta.versionId } : undefined
    );
  } catch (error) {
    if ((error as { code?: number })?.code === 412) {
      throw CONCURRENT_UPDATE_WITH_MESSAGE('The task was changed by someone else. Reload the journal and try again.');
    }
    if (isForbidden(error)) throw NOT_AUTHORIZED;
    throw error;
  }

  const output: CompleteJournalTaskOutput = { taskId, status: 'completed' };
  return lambdaResponse(200, output);
});
