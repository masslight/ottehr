import Oystehr, { BatchInputDeleteRequest, BatchInputPatchRequest } from '@oystehr/sdk';
import { Communication, Condition, Encounter, QuestionnaireResponse, ServiceRequest, Task } from 'fhir/r4b';
import { ExternalLabCommunications } from 'utils';
import { ADDED_VIA_LAB_ORDER_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { labOrderCommunicationType } from '../get-lab-orders/helpers';
import { DeleteLabOrderZambdaInputValidated } from './validateRequestParameters';

export const makeDeleteResourceRequest = (resourceType: string, id: string): BatchInputDeleteRequest => ({
  method: 'DELETE',
  url: `${resourceType}/${id}`,
});

export const canDeleteLabOrder = (labOrder: ServiceRequest): boolean => {
  return labOrder.status === 'draft';
};

export const getLabOrderRelatedResources = async (
  oystehr: Oystehr,
  params: DeleteLabOrderZambdaInputValidated
): Promise<{
  serviceRequest: ServiceRequest | null;
  questionnaireResponse: QuestionnaireResponse | null;
  task: Task | null;
  labConditions: Condition[];
  communications: ExternalLabCommunications | undefined;
}> => {
  try {
    const serviceRequestResponse = (
      await oystehr.fhir.search<ServiceRequest | Task | Encounter | Condition | Communication>({
        resourceType: 'ServiceRequest',
        params: [
          {
            name: '_id',
            value: params.serviceRequestId,
          },
          {
            name: '_revinclude',
            value: 'Task:based-on',
          },
          {
            name: '_include',
            value: 'ServiceRequest:encounter',
          },
          {
            name: '_revinclude:iterate',
            value: 'Condition:encounter',
          },
          {
            name: '_revinclude:iterate',
            value: 'Communication:based-on', // order level notes & clinical info notes
          },
        ],
      })
    ).unbundle();

    type accType = {
      serviceRequests: ServiceRequest[];
      tasks: Task[];
      conditions: Condition[];
      encounters: Encounter[];
      orderLevelNotesByUser: Communication[];
      clinicalInfoNotesByUser: Communication[];
    };
    const initAccumulator: accType = {
      serviceRequests: [],
      tasks: [],
      conditions: [],
      encounters: [],
      orderLevelNotesByUser: [],
      clinicalInfoNotesByUser: [],
    };
    const { serviceRequests, tasks, conditions, encounters, orderLevelNotesByUser, clinicalInfoNotesByUser } =
      serviceRequestResponse.reduce((acc, resource) => {
        if (resource.resourceType === 'ServiceRequest' && resource.id === params.serviceRequestId) {
          acc.serviceRequests.push(resource);
        } else if (
          resource.resourceType === 'Task' &&
          resource.basedOn?.some((ref) => ref.reference === `ServiceRequest/${params.serviceRequestId}`)
        ) {
          acc.tasks.push(resource);
        } else if (resource.resourceType === 'Condition') {
          acc.conditions.push(resource);
        } else if (resource.resourceType === 'Encounter') {
          acc.encounters.push(resource);
        } else if (resource.resourceType === 'Communication') {
          const labCommType = labOrderCommunicationType(resource);
          if (labCommType === 'order-level-note') acc.orderLevelNotesByUser.push(resource);
          if (labCommType === 'clinical-info-note') acc.clinicalInfoNotesByUser.push(resource);
        }
        return acc;
      }, initAccumulator);

    let communications: ExternalLabCommunications | undefined;
    if (orderLevelNotesByUser.length > 0 || clinicalInfoNotesByUser.length > 0) {
      communications = {
        orderLevelNotesByUser,
        clinicalInfoNotesByUser,
      };
    }

    const serviceRequest = serviceRequests[0];
    const task = tasks[0];

    if (!canDeleteLabOrder(serviceRequest)) {
      const errorMessage = `Cannot delete lab order; ServiceRequest has status: ${serviceRequest.status}. Only pending orders can be deleted.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (!serviceRequest?.id) {
      console.error('Lab order not found or invalid response', serviceRequestResponse);
      return { serviceRequest: null, questionnaireResponse: null, task: null, labConditions: [], communications };
    }

    const encounter = encounters.find(
      (encounter) => encounter.id === serviceRequest.encounter?.reference?.split('/')[1]
    );

    // this Conditions were added from external lab order page and should be deleted if the lab order is deleted
    const labConditions = conditions.filter(
      (condition) =>
        condition.encounter?.reference === `Encounter/${encounter?.id}` &&
        condition.extension?.some((ext) => ext.url === ADDED_VIA_LAB_ORDER_SYSTEM && ext.valueBoolean === true)
    );

    const questionnaireResponse = await (async () => {
      if (serviceRequest.supportingInfo && serviceRequest.supportingInfo.length > 0) {
        const questionnaireResponseId = serviceRequest.supportingInfo
          .filter((ref) => ref.reference?.startsWith('QuestionnaireResponse/'))
          .map((ref) => ref.reference!.split('/')[1])[0];

        if (questionnaireResponseId) {
          const questionnaireResponse = (
            await oystehr.fhir.search<QuestionnaireResponse>({
              resourceType: 'QuestionnaireResponse',
              params: [
                {
                  name: '_id',
                  value: questionnaireResponseId,
                },
              ],
            })
          ).unbundle()[0];

          if (questionnaireResponse.id === questionnaireResponseId) {
            return questionnaireResponse;
          }

          return null;
        }
      }

      return null;
    })();

    return {
      serviceRequest,
      questionnaireResponse,
      task,
      labConditions,
      communications,
    };
  } catch (error) {
    console.error('Error fetching external lab order and related resources:', error);
    throw error;
  }
};

export const makeCommunicationRequestForOrderNote = (
  orderLevelNotes: Communication[] | undefined,
  serviceRequest: ServiceRequest
): BatchInputPatchRequest<Communication> | BatchInputDeleteRequest | undefined => {
  if (!orderLevelNotes) return;

  if (orderLevelNotes.length !== 1) {
    throw new Error(
      `Too many order level notes found for this service request: ${orderLevelNotes.map(
        (comm) => `Communication/${comm.id}`
      )}`
    );
  }

  const orderLevelNote = orderLevelNotes[0];
  if (!orderLevelNote.basedOn || orderLevelNote.basedOn.length === 0) {
    console.warn(`This communication is not linked to any service requests: ${orderLevelNote.id}`);
    return;
  }

  if (orderLevelNote.basedOn?.length === 1) {
    // confirm the service request matches
    const sameServiceRequest = orderLevelNote.basedOn[0].reference === `ServiceRequest/${serviceRequest.id}`;
    if (sameServiceRequest && orderLevelNote.id) {
      console.log('will delete the order level note communication', orderLevelNote.id);
      return makeDeleteResourceRequest('Communication', orderLevelNote.id);
    } else {
      console.warn(`This communication is linked to an unexpected service request: ${orderLevelNote.id}`);
      return;
    }
  } else {
    // if other service requests are linked to the communication, just remove this one
    const pathIdx = orderLevelNote.basedOn?.findIndex(
      (serviceRequestRef) => serviceRequestRef.reference === `ServiceRequest/${serviceRequest.id}`
    );
    console.log('will patch order level note communication, removing this service request', orderLevelNote.id);
    const communicationPatchRequest: BatchInputPatchRequest<Communication> = {
      method: 'PATCH',
      url: `Communication/${orderLevelNote.id}`,
      operations: [{ op: 'remove', path: `/basedOn/${pathIdx}` }],
      ifMatch: orderLevelNote.meta?.versionId ? `W/"${orderLevelNote.meta.versionId}"` : undefined,
    };
    return communicationPatchRequest;
  }
};

export const makeCommunicationRequestForClinicalInfoNote = (
  clinicalInfoNotesByUser: Communication[] | undefined,
  serviceRequest: ServiceRequest
): BatchInputDeleteRequest | undefined => {
  if (!clinicalInfoNotesByUser || clinicalInfoNotesByUser.length === 0) return;

  if (clinicalInfoNotesByUser.length > 1) {
    // if there is more than one clinical info note, something has gone wrong
    throw new Error(
      `Something is misconfigured with notes for the lab you are trying to delete, related: ServiceRequest/${
        serviceRequest.id
      } ${clinicalInfoNotesByUser.map((note) => `Communication/${note.id}`)}`
    );
  }

  const clinicalInfoNote = clinicalInfoNotesByUser[0];
  if (clinicalInfoNote.basedOn?.length !== 1) {
    // if there is more than one service request linked to this note, something has gone wrong
    throw new Error(`Something is misconfigured with the clinical info note for the lab you are trying to delete`);
  }
  if (!clinicalInfoNote.id) throw new Error(`communication is missing an id ${clinicalInfoNote.id}`);

  return makeDeleteResourceRequest('Communication', clinicalInfoNote.id);
};
