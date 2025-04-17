import { APIGatewayProxyResult } from 'aws-lambda';
import { BatchInputDeleteRequest } from '@oystehr/sdk';
import { topLevelCatch, ZambdaInput } from '../../shared';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { makeDeleteResourceRequest, getLabOrderRelatedResources } from './helpers';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { serviceRequestId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const { serviceRequest, questionnaireResponse, task } = await getLabOrderRelatedResources(
      oystehr,
      validatedParameters
    );

    if (!serviceRequest) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Lab order with ID ${serviceRequestId} not found` }),
      };
    }

    const deleteRequests: BatchInputDeleteRequest[] = [];

    deleteRequests.push(makeDeleteResourceRequest('ServiceRequest', serviceRequestId));

    if (questionnaireResponse?.id) {
      deleteRequests.push(makeDeleteResourceRequest('QuestionnaireResponse', questionnaireResponse.id));
    }

    if (task?.id) {
      deleteRequests.push(makeDeleteResourceRequest('Task', task.id));
    }

    if (deleteRequests.length > 0) {
      console.log(
        `Deleting lab order ${serviceRequestId} and questionnaire response id: ${questionnaireResponse?.id} and task id: ${task?.id}`
      );

      await oystehr.fhir.transaction({
        requests: deleteRequests,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully deleted lab order resources`,
        deletedResources: {
          serviceRequest,
          questionnaireResponse,
          task,
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
