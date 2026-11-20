import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Practitioner, Task } from 'fhir/r4b';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { CompleteJournalTaskInputSchema, CompleteJournalTaskOutput } from 'utils/lib/types/api/provider-journal.types';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { isInboundFaxDeleting } from 'utils/lib/types/data/tasks/types';
import { CONCURRENT_UPDATE_WITH_MESSAGE, FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { isFhirNotFoundError } from '../../../shared/errors';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { lambdaResponse } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { createOwnerReference } from '../../../shared/tasks';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { isOpenBoardTask } from '../get-provider-journal/helpers';

const ZAMBDA_NAME = 'complete-journal-task';

let m2mToken: string;

/**
 * Completes a Tasks-board task from the journal's Free form note dialog ("Mark '…' done"). Same
 * access as the Tasks page: any EHR staff role; the task is completed in the caller's name.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { taskId, secrets } = validateWithSchema(CompleteJournalTaskInputSchema, input);
  const user = await requireUserWithRole(getUserToken(input), secrets, ALL_EHR_STAFF_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  let task: Task;
  try {
    task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });
  } catch (error) {
    if (isFhirNotFoundError(error)) throw FHIR_RESOURCE_NOT_FOUND('Task');
    throw error;
  }
  if (!isOpenBoardTask(task)) throw INVALID_INPUT_ERROR('Only an open task on the Tasks board can be completed');
  if (isInboundFaxDeleting(task)) throw INVALID_INPUT_ERROR('The fax is being deleted');

  const operations: Operation[] = [{ op: 'replace', path: '/status', value: 'completed' }];
  const practitionerId = getIdFromReference(user.profile, 'Practitioner');
  if (!task.owner && practitionerId) {
    const practitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId });
    operations.push({
      op: 'add',
      path: '/owner',
      value: createOwnerReference(practitionerId, getFullestAvailableName(practitioner) ?? ''),
    });
  }

  try {
    await oystehr.fhir.patch<Task>(
      { resourceType: 'Task', id: taskId, operations },
      task.meta?.versionId ? { optimisticLockingVersionId: task.meta.versionId } : undefined
    );
  } catch (error) {
    if ((error as { code?: number })?.code === 412) {
      throw CONCURRENT_UPDATE_WITH_MESSAGE('The task was changed by someone else. Reload the journal and try again.');
    }
    throw error;
  }

  const output: CompleteJournalTaskOutput = { taskId, status: 'completed' };
  return lambdaResponse(200, output);
});
