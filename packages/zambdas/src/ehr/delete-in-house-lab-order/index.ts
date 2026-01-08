import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  DiagnosticReport,
  DocumentReference,
  FhirResource,
  Provenance,
  Reference,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DeleteInHouseLabOrderParameters,
  DeleteInHouseLabOrderZambdaOutput,
  getSecret,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { makeSoftDeleteStatusPatchRequest } from '../lab/shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const canDeleteInHouseLabOrder = (serviceRequest: ServiceRequest): boolean => {
  // these SR statuses cover the currently supported states of an order, so a user will be able to delete an order "at any point"
  // but it will reject already soft-deleted orders or any unexpected statuses
  return ['draft', 'active', 'completed'].includes(serviceRequest.status);
};

const getInHouseLabOrderRelatedResources = async (
  oystehr: Oystehr,
  serviceRequestId: string
): Promise<{
  serviceRequest: ServiceRequest | null;
  task: Task | null;
  diagnosticReport: DiagnosticReport | null;
  documentReference: DocumentReference | null;
  specimen: Specimen | null;
}> => {
  try {
    const searchResponse = (
      await oystehr.fhir.search<ServiceRequest | Task | DiagnosticReport | DocumentReference | Specimen>({
        resourceType: 'ServiceRequest',
        params: [
          {
            name: '_id',
            value: serviceRequestId,
          },
          // this will grab any results for orders being deleted once results are already entered
          {
            name: '_revinclude',
            value: 'DiagnosticReport:based-on',
          },
          // this will grab the result pdf if the order has had results entered
          {
            name: '_revinclude:iterate',
            value: 'DocumentReference:related',
          },
          // this will grab tasks based on SR and DR, although there are no DR tasks for in house labs currently (e.g. a review task)
          {
            name: '_revinclude:iterate',
            value: 'Task:based-on',
          },
          {
            name: '_include',
            value: 'ServiceRequest:specimen',
          },
        ],
      })
    ).unbundle();

    const results = searchResponse.reduce(
      (acc, resource) => {
        if (resource.resourceType === 'ServiceRequest' && resource.id === serviceRequestId) {
          acc.serviceRequests.push(resource);
        } else if (
          resource.resourceType === 'Task' &&
          resource.basedOn?.some((ref) => ref.reference === `ServiceRequest/${serviceRequestId}`) &&
          ['ready', 'in-progress'].includes(resource.status)
        ) {
          acc.tasks.push(resource);
        } else if (resource.resourceType === 'DiagnosticReport') {
          acc.diagnosticReports.push(resource);
        } else if (resource.resourceType === 'DocumentReference' && resource.status === 'current') {
          acc.documentReferences.push(resource);
        } else if (resource.resourceType === 'Specimen') {
          acc.specimens.push(resource);
        }

        return acc;
      },
      {
        serviceRequests: [] as ServiceRequest[],
        tasks: [] as Task[],
        diagnosticReports: [] as DiagnosticReport[],
        documentReferences: [] as DocumentReference[],
        specimens: [] as Specimen[],
      }
    );
    console.log(
      'These are the resources to soft delete: ',
      Object.fromEntries(
        Object.entries(results).map(([key, arr]) => [key, arr.map((item) => `${item.resourceType}/${item.id}`)])
      )
    );

    const { serviceRequests, tasks, diagnosticReports, documentReferences, specimens } = results;

    const serviceRequest = serviceRequests[0] || null;
    const task = tasks[0] || null;
    const diagnosticReport = diagnosticReports[0] || null;
    const documentReference = documentReferences[0] || null;
    const specimen = specimens[0] || null;

    if (diagnosticReport || documentReference)
      console.log(
        `Found DiagnosticReport or DocRef to delete: DiagnosticReport/${diagnosticReport.id} or DocumentReference/${documentReference.id}`
      );

    if (serviceRequest && !canDeleteInHouseLabOrder(serviceRequest)) {
      const errorMessage = `Cannot delete in-house lab order; ServiceRequest has status: ${serviceRequest.status}. Only draft, active, or completed orders can be deleted.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    return {
      serviceRequest,
      task,
      diagnosticReport,
      documentReference,
      specimen,
    };
  } catch (error) {
    console.error('Error fetching in-house lab order and related resources:', error);
    throw error;
  }
};

const ZAMBDA_NAME = 'delete-in-house-lab-order';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`delete-in-house-lab-order started, input: ${JSON.stringify(input)}`);

  let secrets = input.secrets;
  let validatedParameters: DeleteInHouseLabOrderParameters & { secrets: Secrets | null; userToken: string };

  try {
    validatedParameters = validateRequestParameters(input);
  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid request parameters. ${error.message || error}`,
      }),
    };
  }

  try {
    secrets = validatedParameters.secrets;
    const { serviceRequestId, userToken } = validatedParameters;

    console.log('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    const currentUserPractitionerId = await getMyPractitionerId(oystehrCurrentUser);
    console.log(`User initiating delete action is Practitioner/${currentUserPractitionerId}`);

    const resources = await getInHouseLabOrderRelatedResources(oystehr, serviceRequestId);

    if (!resources.serviceRequest) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: `In-house lab order with ServiceRequest ID ${serviceRequestId} not found`,
        }),
      };
    }

    const requests: (
      | BatchInputPostRequest<Provenance>
      | BatchInputPatchRequest<ServiceRequest | DiagnosticReport | DocumentReference | Task | Specimen>
    )[] = [];

    const updatedResourceReferences: Reference[] = [];
    Object.values(resources).forEach((resource) => {
      if (resource && resource.id) {
        requests.push(makeSoftDeleteStatusPatchRequest(resource.resourceType, resource.id));
        updatedResourceReferences.push({
          reference: `${resource.resourceType}/${resource.id}`,
        });
      }
    });

    // add provenance to track who did the delete and what changed
    const provenancePost: BatchInputPostRequest<Provenance> = {
      method: 'POST',
      url: '/Provenance',
      resource: {
        resourceType: 'Provenance',
        target: updatedResourceReferences,
        recorded: DateTime.now().toISO(),
        agent: [{ who: { reference: `Practitioner/${currentUserPractitionerId}` } }],
        activity: {
          coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.deleteOrder],
        },
      },
    };
    requests.push(provenancePost);

    if (requests.length > 0) {
      console.log(
        `Deleting in-house lab order for ServiceRequest ID: ${serviceRequestId}; requests: ${JSON.stringify(
          requests,
          null,
          2
        )}`
      );

      if (requests.length > 0) {
        console.log(
          `Deleting external lab order for service request id: ${serviceRequestId}; request: ${JSON.stringify(
            requests,
            null,
            2
          )}`
        );

        const transactionResponse = await oystehr.fhir.transaction<FhirResource>({ requests });
        console.log(`Successfully soft deleted in house lab order. Response: ${JSON.stringify(transactionResponse)}`);
      }
    }

    const response: DeleteInHouseLabOrderZambdaOutput = {};

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error deleting in-house lab order:', error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('delete-in-house-lab-order', error, ENVIRONMENT);
  }
});
