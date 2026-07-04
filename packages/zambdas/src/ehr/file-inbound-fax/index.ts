import { BatchInputPostRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference, FhirResource, List, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
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
  RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'file-inbound-fax';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`[${ZAMBDA_NAME}] handler start`);

  try {
    const { secrets, taskId, communicationId, patientId, folderId, documentName } = validateRequestParameters(input);

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

    // Reject already-finalized tasks: prevents double-filing and file-vs-delete races.
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw PRECONDITION_FAILED(
        `Task/${taskId} has already been ${task.status === 'completed' ? 'filed' : 'deleted'} (status: ${task.status})`
      );
    }

    // SECURITY: the pdf url MUST come from the verified Task's stored input (set by
    // handle-inbound-fax), never from the request — otherwise a caller could file an
    // arbitrary URL into the patient's chart.
    const pdfUrl = getTaskInputValue(task, FAX_TASK.input.pdfUrl);
    if (!pdfUrl) {
      throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(`Task/${taskId} has no stored fax PDF url; cannot file this fax`);
    }

    // Fetch the target folder List
    let folderList: List;
    try {
      folderList = await oystehr.fhir.get<List>({
        resourceType: 'List',
        id: folderId,
      });
    } catch {
      throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Folder List/${folderId} not found`), statusCode: 404 };
    }

    // Verify the folder belongs to the specified patient
    if (folderList.subject?.reference !== `Patient/${patientId}`) {
      throw INVALID_INPUT_ERROR(`Folder List/${folderId} does not belong to Patient/${patientId}`);
    }

    const now = DateTime.now().setZone('UTC').toISO() ?? '';

    // Single FHIR transaction: DocumentReference create + folder List update + Task complete.
    // A partial failure rolls everything back, so the folder can never be left half-updated
    // and the task can never be completed without the document actually being filed.
    const docRefFullUrl = `urn:uuid:${randomUUID()}`;
    const createDocRefRequest: BatchInputPostRequest<DocumentReference> = {
      method: 'POST',
      fullUrl: docRefFullUrl,
      url: '/DocumentReference',
      resource: {
        resourceType: 'DocumentReference',
        status: 'current',
        date: now,
        description: documentName,
        subject: {
          reference: `Patient/${patientId}`,
        },
        content: [
          {
            attachment: {
              url: pdfUrl,
              contentType: 'application/pdf',
              title: documentName,
            },
          },
        ],
      },
    };

    // Full-resource PUT (rather than a patch) so the urn:uuid reference to the new
    // DocumentReference is rewritten by the server when the transaction commits.
    const updatedList: List = {
      ...folderList,
      entry: [
        ...(folderList.entry ?? []),
        {
          date: now,
          item: {
            type: 'DocumentReference',
            reference: docRefFullUrl,
          },
        },
      ],
    };
    const updateListRequest: BatchInputPutRequest<List> = {
      method: 'PUT',
      url: `/List/${folderId}`,
      resource: updatedList,
    };

    const completeTaskRequest = getPatchBinary({
      resourceType: 'Task',
      resourceId: taskId,
      patchOperations: [replaceOperation('/status', 'completed')],
    });

    const requests: BatchInputRequest<FhirResource>[] = [createDocRefRequest, updateListRequest, completeTaskRequest];
    const transactionResult = await oystehr.fhir.transaction<FhirResource>({ requests });

    const documentRefId = transactionResult.entry
      ?.map((entry) => entry.resource)
      .find((resource): resource is DocumentReference => resource?.resourceType === 'DocumentReference')?.id;

    if (!documentRefId) {
      throw new Error(`Transaction succeeded but no DocumentReference was returned for Task/${taskId}`);
    }

    console.log(
      `[${ZAMBDA_NAME}] filed DocumentReference/${documentRefId} into List/${folderId} and completed Task/${taskId}`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ documentRefId, folderId }),
    };
  } catch (error: any) {
    console.error(`[${ZAMBDA_NAME}] error:`, error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
