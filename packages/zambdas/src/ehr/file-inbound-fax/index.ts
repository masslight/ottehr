import Oystehr, { BatchInputPostRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference, Encounter, FhirResource, List, Patient, Reference, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { createOystehrClient } from 'utils/lib/helpers/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { FAX_TASK, getTaskInputValue, isInboundFaxDeleting, isInboundFaxFiled } from 'utils/lib/types/data/tasks/types';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  INVALID_INPUT_ERROR,
  PRECONDITION_FAILED,
  RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
} from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { topLevelCatch } from '../../shared/lambda';
import { resolveCallerPractitionerRef } from '../../shared/practitioners';
import { wrapHandler } from '../../shared/sentry';
import { createOwnerReference, createTask } from '../../shared/tasks';
import { ZambdaInput } from '../../shared/types/common';
import { resolvePatientDocumentFolder } from '../shared/patient-document-folders';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'file-inbound-fax';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`[${ZAMBDA_NAME}] handler start`);

  try {
    const {
      secrets,
      taskId,
      communicationId,
      patientId,
      folderId,
      documentName,
      internalName,
      encounterId,
      reviewTaskAssignee,
    } = validateRequestParameters(input);

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
    if (isInboundFaxDeleting(task)) {
      throw PRECONDITION_FAILED(`Task/${taskId} is being deleted`);
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

    // Everything that can reject the request runs before the folder is resolved: resolving can lazily
    // create the per-patient folder List, which a rejection afterwards would leave behind.
    let appointmentId: string | undefined;
    if (encounterId) {
      const encounter = (
        await oystehr.fhir.search<Encounter>({
          resourceType: 'Encounter',
          params: [
            { name: '_id', value: encounterId },
            { name: 'subject', value: `Patient/${patientId}` },
          ],
        })
      ).unbundle()[0];
      if (!encounter) {
        throw INVALID_INPUT_ERROR(`Encounter/${encounterId} not found for Patient/${patientId}`);
      }
      appointmentId = getIdFromReference(encounter.appointment?.[0]?.reference, 'Appointment');
    }
    const reviewTaskContext = reviewTaskAssignee
      ? await Promise.all([
          oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
          resolveCallerPractitionerRef(input.headers.Authorization.replace('Bearer ', ''), secrets, oystehr),
        ])
      : undefined;

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
        ...(encounterId ? { context: { encounter: [{ reference: `Encounter/${encounterId}` }] } } : {}),
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

    // Created in the same transaction so a fax is never filed without the review task that was asked for.
    if (reviewTaskAssignee && reviewTaskContext) {
      const [patient, requester] = reviewTaskContext;
      requests.push(
        buildReviewTaskRequest({
          faxTask: task,
          communicationId,
          patient,
          documentName,
          folderId: resolvedFolderId,
          encounterId,
          appointmentId,
          documentReference: { reference: docRefFullUrl },
          assignee: reviewTaskAssignee,
          requester,
        })
      );
    }

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
      `[${ZAMBDA_NAME}] filed DocumentReference/${documentRefId} into List/${resolvedFolderId} and marked Task/${taskId} filed${
        reviewTaskAssignee ? ', with a review task' : ''
      }`
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

export const reviewFaxTaskTitle = (documentName: string, patientName: string | undefined): string =>
  `Review fax “${documentName}”${patientName ? ` for ${patientName}` : ''}`;

function buildReviewTaskRequest(args: {
  faxTask: Task;
  communicationId: string;
  patient: Patient;
  documentName: string;
  folderId: string;
  encounterId: string | undefined;
  appointmentId: string | undefined;
  documentReference: Reference;
  assignee: { id: string; name: string };
  requester: Reference;
}): BatchInputPostRequest<Task> {
  const {
    faxTask,
    communicationId,
    patient,
    documentName,
    folderId,
    encounterId,
    appointmentId,
    documentReference,
    assignee,
    requester,
  } = args;
  return {
    method: 'POST',
    url: '/Task',
    resource: {
      ...createTask({
        category: FAX_TASK.category,
        title: reviewFaxTaskTitle(documentName, getFullestAvailableName(patient)),
        code: { system: FAX_TASK.system, code: FAX_TASK.code.reviewInboundFax },
        encounterId,
        input: [
          { type: FAX_TASK.input.patientId, valueString: patient.id },
          { type: FAX_TASK.input.folderId, valueString: folderId },
          { type: FAX_TASK.input.appointmentId, valueString: appointmentId },
          // Lets a notification about this task open the fax itself (see buildTaskNotificationAbout).
          { type: FAX_TASK.input.communicationId, valueString: communicationId },
          { type: FAX_TASK.input.receivedDate, valueString: getTaskInputValue(faxTask, FAX_TASK.input.receivedDate) },
        ],
      }),
      status: 'in-progress',
      owner: createOwnerReference(assignee.id, assignee.name),
      requester,
      focus: documentReference,
    },
  };
}
