import Oystehr, { BatchInputPostRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference, FhirResource, List, Patient, ServiceRequest, Task, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_CATEGORY_IDENTIFIER, TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getReferralSpecialty, getReferralStatus, withReferralDetails } from 'utils/lib/fhir/referral';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { createOystehrClient, removePrefix } from 'utils/lib/helpers/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { PROVIDER_NOTIFICATION_TAG_SYSTEM } from 'utils/lib/types/api/practitioner.types';
import { isReferralOpen, REFERRAL_TASK, referralReviewTaskTitle } from 'utils/lib/types/api/referrals/referrals.types';
import { FAX_TASK, getTaskInputValue, isInboundFaxDeleting, isInboundFaxFiled } from 'utils/lib/types/data/tasks/types';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  INVALID_INPUT_ERROR,
  PRECONDITION_FAILED,
  RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
} from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { topLevelCatch } from '../../shared/lambda';
import { loadReferral } from '../../shared/referrals/load-referral';
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
    const { secrets, taskId, communicationId, patientId, folderId, documentName, internalName, referralId } =
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

    // A referral the fax answers must be this patient's and still open; checked before anything is written.
    const referral = referralId ? await getOpenReferralOrThrow(oystehr, referralId, patientId) : undefined;

    const now = DateTime.now().setZone('UTC').toISO() ?? '';

    // Single FHIR transaction: DocumentReference create + folder List update + Task marked filed, plus, for a
    // referral response, the referral marked Response received and its review routed. A partial failure rolls
    // everything back, so the folder can never be left half-updated, the task can never be marked filed
    // without the document actually being filed, and a referral can never be answered by a document that
    // was not filed (or filed without being answered, which a retry would then file twice).
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
        ...(referral ? { context: { related: [{ reference: `ServiceRequest/${referral.id}` }] } } : {}),
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

    const referralRequests = referral
      ? await buildReferralResponseRequests({ oystehr, referral, docRefFullUrl, patientId })
      : [];

    const requests: BatchInputRequest<FhirResource>[] = [
      createDocRefRequest,
      updateListRequest,
      markTaskFiledRequest,
      ...referralRequests,
    ];
    const transactionResult = await oystehr.fhir.transaction<FhirResource>({ requests }).catch((error: unknown) => {
      // A lost optimistic lock (Task, folder List or referral changed concurrently) is an expected race, not a server fault.
      if (error instanceof Oystehr.OystehrFHIRError && error.code === 412) {
        throw PRECONDITION_FAILED(`Task/${taskId}, its folder or the referral changed while filing`);
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
      `[${ZAMBDA_NAME}] filed DocumentReference/${documentRefId} into List/${resolvedFolderId} and marked Task/${taskId} filed` +
        (referral ? ` as a response to ServiceRequest/${referral.id}` : '')
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

/** The referral a filed response is attached to: tagged `referral`, this patient's, and not yet closed. */
const getOpenReferralOrThrow = async (
  oystehr: Oystehr,
  referralId: string,
  patientId: string
): Promise<ServiceRequest> => {
  const referral = await loadReferral(oystehr, referralId, { patientId });
  if (!isReferralOpen(getReferralStatus(referral))) {
    throw INVALID_INPUT_ERROR(`Referral ${referralId} is not an open referral of this patient`);
  }
  return referral;
};

const taskInput = (
  code: string,
  value: { valueString?: string; valueReference?: TaskInput['valueReference'] }
): TaskInput => ({
  type: { coding: [{ system: TASK_INPUT_SYSTEM, code }] },
  ...value,
});

/**
 * The transaction entries that record the response on the referral and route its review to the referring
 * provider: the referral's open task is retitled, assigned and told which document to read, or a review task is
 * created when it has none. A specialist's note is never filed unread. The new DocumentReference is named by its
 * transaction-local `urn:uuid`, which the server rewrites when the transaction commits.
 */
const buildReferralResponseRequests = async (args: {
  oystehr: Oystehr;
  referral: ServiceRequest;
  docRefFullUrl: string;
  patientId: string;
}): Promise<BatchInputRequest<FhirResource>[]> => {
  const { oystehr, referral, docRefFullUrl, patientId } = args;
  const referralId = referral.id!;

  const markResponseReceived: BatchInputPutRequest<ServiceRequest> = {
    method: 'PUT',
    url: `/ServiceRequest/${referralId}`,
    resource: withReferralDetails(referral, { status: 'response-received' }),
    // Optimistic lock: a referral closed or edited since it was checked above fails the filing instead of
    // silently reverting that change.
    ifMatch: makeOptimisticLockIfMatchHeader(referral),
  };

  const specialty = getReferralSpecialty(referral);
  const recipientName = referral.performer?.[0]?.display;
  const title = referralReviewTaskTitle(specialty, recipientName);
  const requesterId = removePrefix('Practitioner/', referral.requester?.reference ?? '');
  const owner = requesterId ? createOwnerReference(requesterId, referral.requester?.display ?? '') : undefined;
  const responseInput = taskInput(REFERRAL_TASK.input.responseDocumentReferenceId, {
    valueReference: { reference: docRefFullUrl },
  });

  const openTask = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'based-on', value: `ServiceRequest/${referralId}` },
        { name: 'group-identifier', value: `${TASK_CATEGORY_IDENTIFIER}|${REFERRAL_TASK.category}` },
        { name: 'status', value: 'requested,ready,in-progress' },
      ],
    })
  ).unbundle()[0];

  if (openTask?.id) {
    // Drop the notification tags so the cron treats the re-assignment as new and tells the provider (as unassign
    // does), and the overdue window: the response has arrived, so the task is no longer waiting for one.
    const { restriction: _restriction, ...taskWithoutRestriction } = openTask;
    const remainingTags = (openTask.meta?.tag ?? []).filter((tag) => tag.system !== PROVIDER_NOTIFICATION_TAG_SYSTEM);
    const { tag: _tag, ...metaWithoutTags } = openTask.meta ?? {};
    const routed: Task = {
      ...taskWithoutRestriction,
      description: title,
      ...(owner ? { owner, status: 'in-progress' } : {}),
      ...(openTask.meta
        ? { meta: remainingTags.length ? { ...metaWithoutTags, tag: remainingTags } : metaWithoutTags }
        : {}),
      input: [...(openTask.input ?? []), responseInput],
    };
    const routeOpenTask: BatchInputPutRequest<Task> = {
      method: 'PUT',
      url: `/Task/${openTask.id}`,
      resource: routed,
      ifMatch: makeOptimisticLockIfMatchHeader(openTask),
    };
    return [markResponseReceived, routeOpenTask];
  }

  const patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
  const task = createTask({
    category: REFERRAL_TASK.category,
    title,
    code: { system: REFERRAL_TASK.system, code: REFERRAL_TASK.code.reviewResponse },
    encounterId: removePrefix('Encounter/', referral.encounter?.reference ?? '') || undefined,
    input: [
      taskInput(REFERRAL_TASK.input.referralId, { valueString: referralId }),
      taskInput(REFERRAL_TASK.input.patient, {
        valueReference: { reference: `Patient/${patientId}`, display: getFullestAvailableName(patient) },
      }),
      taskInput(REFERRAL_TASK.input.specialty, { valueString: specialty }),
      ...(recipientName ? [taskInput(REFERRAL_TASK.input.recipientName, { valueString: recipientName })] : []),
      responseInput,
    ],
    basedOn: [`ServiceRequest/${referralId}`, docRefFullUrl],
  });
  const createReviewTask: BatchInputPostRequest<Task> = {
    method: 'POST',
    url: '/Task',
    resource: owner ? { ...task, owner, status: 'in-progress' } : task,
  };
  return [markResponseReceived, createReviewTask];
};
