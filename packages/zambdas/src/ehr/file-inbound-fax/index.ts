import Oystehr, { BatchInputPostRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference, FhirResource, List, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { createOystehrClient } from 'utils/lib/helpers/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { FAX_TASK, getTaskInputValue, isInboundFaxFiled } from 'utils/lib/types/data/tasks/types';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  INVALID_INPUT_ERROR,
  PRECONDITION_FAILED,
  RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
} from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { resolvePatientDocumentFolder } from '../shared/patient-document-folders';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'file-inbound-fax';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`[${ZAMBDA_NAME}] handler start`);

  try {
    const { secrets, taskId, communicationId, patientId, folderId, documentName, internalName } =
      validateRequestParameters(input);

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

    // Reject already-finalized tasks: prevents double-filing and file-vs-delete races. Filing leaves
    // the Task open (staff complete it by hand), so a filed fax is recognized by its businessStatus.
    if (isInboundFaxFiled(task)) {
      throw PRECONDITION_FAILED(`Task/${taskId} has already been filed`);
    }
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw PRECONDITION_FAILED(
        `Task/${taskId} has already been ${task.status === 'completed' ? 'completed' : 'deleted'} (status: ${
          task.status
        })`
      );
    }

    // SECURITY: the pdf url MUST come from the verified Task's stored input (set by
    // handle-inbound-fax), never from the request — otherwise a caller could file an
    // arbitrary URL into the patient's chart.
    const pdfUrl = getTaskInputValue(task, FAX_TASK.input.pdfUrl);
    if (!pdfUrl) {
      throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(`Task/${taskId} has no stored fax PDF url; cannot file this fax`);
    }

    // Resolve the target folder. `folderId` may be a real List id or the
    // `synthetic:${internalName}` sentinel the read path hands out for folders the patient has
    // no List for yet; the shared resolver materializes those (validating against the folder
    // catalog) and verifies ownership. Folder Lists are never created client-side.
    const folderResult = await resolvePatientDocumentFolder({ folderId, patientId, internalName, oystehr });
    if (folderResult.status === 'not-found') {
      throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(folderResult.message), statusCode: 404 };
    }
    if (folderResult.status === 'wrong-patient') {
      throw INVALID_INPUT_ERROR(folderResult.message);
    }
    const folderList: List = folderResult.folder;
    const resolvedFolderId = folderList.id;
    if (!resolvedFolderId) {
      throw new Error(`Resolved folder List for Patient/${patientId} has no id`);
    }

    const now = DateTime.now().setZone('UTC').toISO() ?? '';

    // Single FHIR transaction: DocumentReference create + folder List update + Task marked filed.
    // A partial failure rolls everything back, so the folder can never be left half-updated
    // and the task can never be marked filed without the document actually being filed.
    // The Task is deliberately NOT completed here: fax tasks stay open until a person presses
    // Complete in the Tasks queue, the same as manual tasks.
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
      url: `/List/${resolvedFolderId}`,
      resource: updatedList,
      // Optimistic lock: this PUT replaces the whole List, so without it a document uploaded
      // (or another fax filed) between the read above and this write would be silently
      // reverted. A concurrent change fails the transaction instead, leaving the fax
      // unfiled and the task open so the operation can be retried.
      ifMatch: makeOptimisticLockIfMatchHeader(folderList),
    };

    const markTaskFiledRequest = getPatchBinary({
      resourceType: 'Task',
      resourceId: taskId,
      patchOperations: [
        {
          op: 'add',
          path: '/businessStatus',
          value: { coding: [{ system: FAX_TASK.system, code: FAX_TASK.businessStatus.filed }], text: 'Filed' },
        },
      ],
      // Optimistic lock: a concurrent file, delete or Complete since the checks above fails the transaction.
      ifMatch: makeOptimisticLockIfMatchHeader(task),
    });

    const requests: BatchInputRequest<FhirResource>[] = [createDocRefRequest, updateListRequest, markTaskFiledRequest];
    const transactionResult = await oystehr.fhir.transaction<FhirResource>({ requests }).catch((error: unknown) => {
      // A lost optimistic lock (Task or folder List changed concurrently) is an expected race, not a server fault.
      if (error instanceof Oystehr.OystehrFHIRError && error.code === 412) {
        throw PRECONDITION_FAILED(`Task/${taskId} or its folder changed while filing`);
      }
      throw error;
    });

    const documentRefId = transactionResult.entry
      ?.map((entry) => entry.resource)
      .find((resource): resource is DocumentReference => resource?.resourceType === 'DocumentReference')?.id;

    if (!documentRefId) {
      throw new Error(`Transaction succeeded but no DocumentReference was returned for Task/${taskId}`);
    }

    console.log(
      `[${ZAMBDA_NAME}] filed DocumentReference/${documentRefId} into List/${resolvedFolderId} and marked Task/${taskId} filed`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ documentRefId, folderId: resolvedFolderId }),
    };
  } catch (error: any) {
    console.error(`[${ZAMBDA_NAME}] error:`, error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
