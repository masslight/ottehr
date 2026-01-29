import { BatchInputDeleteRequest, BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Communication,
  DocumentReference,
  FhirResource,
  Provenance,
  QuestionnaireResponse,
  Reference,
  ServiceRequest,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { DeleteLabOrderZambdaOutput, getSecret, PROVENANCE_ACTIVITY_CODING_ENTITY, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { makeSoftDeleteStatusPatchRequest } from '../../shared/helpers';
import {
  getLabOrderRelatedResources,
  makeCommunicationRequestForClinicalInfoNote,
  makeCommunicationRequestForOrderNote,
  makeDeleteResourceRequest,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('delete-lab-order', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { serviceRequestId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
    const practitionerIdFromCurrentUser = await getMyPractitionerId(oystehrCurrentUser);

    const {
      serviceRequest,
      questionnaireResponse,
      tasks,
      labConditions,
      communications,
      documentReferences,
      diagnosticReports,
    } = await getLabOrderRelatedResources(oystehr, validatedParameters);

    if (!serviceRequest) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Lab order with ID ${serviceRequestId} not found` }),
      };
    }

    const requests: (
      | BatchInputDeleteRequest
      | BatchInputPostRequest<Provenance>
      | BatchInputPatchRequest<ServiceRequest | QuestionnaireResponse | Communication | DocumentReference>
    )[] = [];

    // any resource that was touched by this soft delete
    const targetResourcesForProvenance: Reference[] = [];

    requests.push(makeSoftDeleteStatusPatchRequest('ServiceRequest', serviceRequestId));
    targetResourcesForProvenance.push({ reference: `ServiceRequest/${serviceRequestId}` });

    if (questionnaireResponse?.id) {
      requests.push(makeSoftDeleteStatusPatchRequest('QuestionnaireResponse', questionnaireResponse.id));
      targetResourcesForProvenance.push({ reference: `QuestionnaireResponse/${questionnaireResponse.id}` });
    }

    if (tasks.length > 0) {
      tasks.forEach((task) => {
        if (task.id) {
          requests.push(makeSoftDeleteStatusPatchRequest('Task', task.id));
          targetResourcesForProvenance.push({ reference: `Task/${task.id}` });
        }
      });
    }

    labConditions.forEach((condition) => {
      if (condition.id) {
        requests.push(makeDeleteResourceRequest('Condition', condition.id));
      }
    });

    const orderNoteCommunicationRequest = makeCommunicationRequestForOrderNote(
      communications?.orderLevelNotesByUser,
      serviceRequest
    );
    if (orderNoteCommunicationRequest) {
      requests.push(orderNoteCommunicationRequest.batchRequest);
      targetResourcesForProvenance.push(orderNoteCommunicationRequest.targetReference);
    }

    const clinicalInfoNoteRequest = makeCommunicationRequestForClinicalInfoNote(
      communications?.clinicalInfoNotesByUser,
      serviceRequest
    );
    if (clinicalInfoNoteRequest) {
      requests.push(clinicalInfoNoteRequest.batchRequest);
      targetResourcesForProvenance.push(clinicalInfoNoteRequest.targetReference);
    }

    if (documentReferences.length > 0) {
      documentReferences.forEach((docRef) => {
        if (docRef.id) {
          requests.push(makeSoftDeleteStatusPatchRequest('DocumentReference', docRef.id));
          targetResourcesForProvenance.push({ reference: `DocumentReference/${docRef.id}` });
        }
      });
    }

    if (diagnosticReports.length > 0) {
      diagnosticReports.forEach((diagnosticReport) => {
        if (diagnosticReport.id) {
          requests.push(makeSoftDeleteStatusPatchRequest('DiagnosticReport', diagnosticReport.id));
          targetResourcesForProvenance.push({ reference: `DiagnosticReport/${diagnosticReport.id}` });
        }
      });
    }

    const curUserReference = { reference: `Practitioner/${practitionerIdFromCurrentUser}` };
    const provenancePost: BatchInputPostRequest<Provenance> = {
      method: 'POST',
      url: '/Provenance',
      resource: {
        resourceType: 'Provenance',
        target: targetResourcesForProvenance,
        recorded: DateTime.now().toISO(),
        agent: [{ who: curUserReference }],
        activity: {
          coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.deleteOrder],
        },
      },
    };
    requests.push(provenancePost);

    if (requests.length > 0) {
      console.log(
        `Deleting external lab order for service request id: ${serviceRequestId}; request: ${JSON.stringify(
          requests,
          null,
          2
        )}`
      );

      await oystehr.fhir.transaction<FhirResource>({ requests });
    }

    const response: DeleteLabOrderZambdaOutput = {};

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('delete-lab-order', error, ENVIRONMENT);
  }
});
