import { APIGatewayProxyResult } from 'aws-lambda';
import { BatchInputDeleteRequest } from '@oystehr/sdk';
import { topLevelCatch, ZambdaInput } from 'zambda-utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';
import { makeDeleteResourceRequest, getLabOrderAndRelatedResources } from './helpers';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { labOrderId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const { serviceRequest, relatedDiagnoses } = await getLabOrderAndRelatedResources(oystehr, validatedParameters);

    if (!serviceRequest) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Lab order with ID ${labOrderId} not found` }),
      };
    }

    const deleteRequests: BatchInputDeleteRequest[] = [];

    deleteRequests.push(makeDeleteResourceRequest('ServiceRequest', labOrderId));

    if (relatedDiagnoses.length > 0) {
      relatedDiagnoses.forEach((diagnosis) => {
        if (diagnosis.id) {
          deleteRequests.push(makeDeleteResourceRequest('Condition', diagnosis.id));
        }
      });
    }

    if (deleteRequests.length > 0) {
      console.log(`Deleting lab order ${labOrderId} and ${relatedDiagnoses.length} related diagnoses`);
      await oystehr.fhir.transaction({
        requests: deleteRequests,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully deleted lab order and ${relatedDiagnoses.length} related diagnoses`,
        deletedResources: {
          labOrder: labOrderId,
          diagnoses: relatedDiagnoses.map((d) => d.id),
        },
      }),
    };
  } catch (error: any) {
    await topLevelCatch('delete-lab-order', error, input.secrets);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ message: `Error deleting lab order: ${error.message || error}` }),
    };
  }
};
