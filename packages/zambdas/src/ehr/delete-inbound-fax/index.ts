import { BatchInputDeleteRequest, BatchInputRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource, Task } from 'fhir/r4b';
import {
  createOystehrClient,
  FAX_TASK,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getPatchBinary,
  getSecret,
  getTaskInputValue,
  INVALID_INPUT_ERROR,
  PRECONDITION_FAILED,
  replaceOperation,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { deleteZ3Object, Z3Error } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-inbound-fax';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`[${ZAMBDA_NAME}] handler start`);

  try {
    const { secrets, taskId, communicationId } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(
      m2mToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );

    // Verify the task exists and is an inbound-fax task
    let task: Task;
    try {
      task = await oystehr.fhir.get<Task>({
        resourceType: 'Task',
        id: taskId,
      });
    } catch {
      throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Task/${taskId} not found`), statusCode: 404 };
    }

    if (task.groupIdentifier?.value !== FAX_TASK.category) {
      throw INVALID_INPUT_ERROR(`Task/${taskId} is not an inbound-fax task`);
    }

    const taskBasedOn = task.basedOn?.some((ref) => ref.reference === `Communication/${communicationId}`);
    if (!taskBasedOn) {
      throw INVALID_INPUT_ERROR(`Task/${taskId} is not associated with Communication/${communicationId}`);
    }

    // Reject already-finalized tasks: prevents delete-after-file (and double-delete) races.
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw PRECONDITION_FAILED(
        `Task/${taskId} has already been ${task.status === 'completed' ? 'filed' : 'deleted'} (status: ${task.status})`
      );
    }

    // SECURITY: the pdf url MUST come from the verified Task's stored input (set by
    // handle-inbound-fax), never from the request — otherwise a caller could delete an
    // arbitrary Z3 object (e.g. another patient's document).
    const pdfUrl = getTaskInputValue(task, FAX_TASK.input.pdfUrl);

    // Delete the Z3 PDF object first. If this fails (other than the object already being
    // gone), fail the whole operation BEFORE touching the FHIR resources — otherwise the
    // Communication/Task would be gone while the PHI PDF lives on in Z3 with no way to
    // find it again. The operation is retryable as nothing has been deleted yet.
    if (pdfUrl) {
      try {
        await deleteZ3Object(pdfUrl, m2mToken);
        console.log(`[${ZAMBDA_NAME}] deleted Z3 object at ${pdfUrl}`);
      } catch (error) {
        if (error instanceof Z3Error && error.statusCode === 404) {
          // Already gone (e.g. a previous attempt deleted it but failed later); proceed.
          console.log(`[${ZAMBDA_NAME}] Z3 object at ${pdfUrl} already deleted; continuing`);
        } else {
          captureException(error);
          throw error;
        }
      }
    } else {
      console.log(`[${ZAMBDA_NAME}] Task/${taskId} has no stored pdf url; skipping Z3 delete`);
    }

    // Delete the Communication and cancel the Task atomically so a partial failure can't
    // leave a cancelled task pointing at a live Communication (or vice versa).
    const deleteCommunicationRequest: BatchInputDeleteRequest = {
      method: 'DELETE',
      url: `/Communication/${communicationId}`,
    };
    const cancelTaskRequest = getPatchBinary({
      resourceType: 'Task',
      resourceId: taskId,
      patchOperations: [replaceOperation('/status', 'cancelled')],
    });
    const requests: BatchInputRequest<FhirResource>[] = [deleteCommunicationRequest, cancelTaskRequest];
    await oystehr.fhir.transaction<FhirResource>({ requests });

    console.log(`[${ZAMBDA_NAME}] deleted Communication/${communicationId} and cancelled Task/${taskId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
