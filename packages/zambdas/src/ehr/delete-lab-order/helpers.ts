import Oystehr, { BatchInputDeleteRequest, BatchInputPatchRequest } from '@oystehr/sdk';
import {
  Communication,
  Condition,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  QuestionnaireResponse,
  Reference,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { ExternalLabCommunications } from 'utils';
import { ADDED_VIA_LAB_ORDER_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { labOrderCommunicationType } from '../get-lab-orders/helpers';
import { makeSoftDeleteStatusPatchRequest } from '../lab/shared/helpers';
import { DeleteLabOrderZambdaInputValidated } from './validateRequestParameters';

export const makeDeleteResourceRequest = (resourceType: string, id: string): BatchInputDeleteRequest => ({
  method: 'DELETE',
  url: `${resourceType}/${id}`,
});

export const getLabOrderRelatedResources = async (
  oystehr: Oystehr,
  params: DeleteLabOrderZambdaInputValidated
): Promise<{
  serviceRequest: ServiceRequest | null;
  questionnaireResponse: QuestionnaireResponse | null;
  tasks: Task[];
  labConditions: Condition[];
  communications: ExternalLabCommunications | undefined;
  documentReferences: DocumentReference[];
  diagnosticReports: DiagnosticReport[];
}> => {
  try {
    const serviceRequestResponse = (
      await oystehr.fhir.search<
        ServiceRequest | Task | Encounter | Condition | Communication | DocumentReference | DiagnosticReport
      >({
        resourceType: 'ServiceRequest',
        params: [
          {
            name: '_id',
            value: params.serviceRequestId,
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

          // if the lab has been sent there are some additional resources we need to check for
          {
            name: '_revinclude',
            value: 'DiagnosticReport:based-on',
          },

          // will pull tasks based on the service request and the diagnostic report
          {
            name: '_revinclude:iterate',
            value: 'Task:based-on',
          },

          // order pdf, label pdf, result pdf, ABNs
          {
            name: '_revinclude:iterate',
            value: 'DocumentReference:related',
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
      documentReferences: DocumentReference[];
      diagnosticReports: DiagnosticReport[];
    };
    const initAccumulator: accType = {
      serviceRequests: [],
      tasks: [],
      conditions: [],
      encounters: [],
      orderLevelNotesByUser: [],
      clinicalInfoNotesByUser: [],
      documentReferences: [],
      diagnosticReports: [],
    };
    const {
      serviceRequests,
      tasks,
      conditions,
      encounters,
      orderLevelNotesByUser,
      clinicalInfoNotesByUser,
      documentReferences,
      diagnosticReports,
    } = serviceRequestResponse.reduce((acc, resource) => {
      if (resource.resourceType === 'ServiceRequest' && resource.id === params.serviceRequestId) {
        acc.serviceRequests.push(resource);
      } else if (
        resource.resourceType === 'Task' &&
        resource.status !== 'cancelled' &&
        resource.status !== 'completed'
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
      } else if (resource.resourceType === 'DocumentReference' && resource.status === 'current') {
        acc.documentReferences.push(resource);
      } else if (resource.resourceType === 'DiagnosticReport') {
        acc.diagnosticReports.push(resource);
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

    if (!serviceRequest?.id) {
      console.error('Lab order not found or invalid response', serviceRequestResponse);
      throw new Error(`Service request for delete request is misconfigured: ${serviceRequest?.id}`);
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

    // confirm the task is related to the lab service request or some lab diagnostic report
    const drRefSet = new Set(diagnosticReports.map((dr) => `DiagnosticReport/${dr.id}`));
    const filteredTasks = tasks.filter((task) => {
      return !!task.basedOn?.some((ref) => {
        const basedOn = ref.reference;
        if (!basedOn) return false;

        const isBasedOnServiceRequest = basedOn.endsWith(`/ServiceRequest/${params.serviceRequestId}`);
        const isBasedOnSomeDR = drRefSet.has(basedOn);

        return isBasedOnServiceRequest || isBasedOnSomeDR;
      });
    });

    return {
      serviceRequest,
      questionnaireResponse,
      tasks: filteredTasks,
      labConditions,
      communications,
      documentReferences,
      diagnosticReports,
    };
  } catch (error) {
    console.error('Error fetching external lab order and related resources:', error);
    throw error;
  }
};

export const makeCommunicationRequestForOrderNote = (
  orderLevelNotes: Communication[] | undefined,
  serviceRequest: ServiceRequest
): { batchRequest: BatchInputPatchRequest<Communication>; targetReference: Reference } | undefined => {
  if (!orderLevelNotes || orderLevelNotes.length === 0) return;

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
      return {
        batchRequest: makeSoftDeleteStatusPatchRequest('Communication', orderLevelNote.id),
        targetReference: { reference: `Communication/${orderLevelNote.id}` },
      };
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
    return {
      batchRequest: communicationPatchRequest,
      targetReference: { reference: `Communication/${orderLevelNote.id}` },
    };
  }
};

export const makeCommunicationRequestForClinicalInfoNote = (
  clinicalInfoNotesByUser: Communication[] | undefined,
  serviceRequest: ServiceRequest
): { batchRequest: BatchInputPatchRequest<Communication>; targetReference: Reference } | undefined => {
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

  return {
    batchRequest: makeSoftDeleteStatusPatchRequest('Communication', clinicalInfoNote.id),
    targetReference: { reference: `Communication/${clinicalInfoNote.id}` },
  };
};
