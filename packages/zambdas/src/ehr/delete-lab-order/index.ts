import { BatchInputDeleteRequest } from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DeleteLabOrderZambdaOutput, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../shared';
import { getLabOrderRelatedResources, makeDeleteResourceRequest } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { serviceRequestId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const { serviceRequest, questionnaireResponse, task, labConditions } = await getLabOrderRelatedResources(
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

    labConditions.forEach((condition) => {
      condition.id && deleteRequests.push(makeDeleteResourceRequest('Condition', condition.id));
    });

    if (deleteRequests.length > 0) {
      console.log(
        `Deleting external lab order for service request id: ${serviceRequestId}; request: ${JSON.stringify(
          deleteRequests,
          null,
          2
        )}`
      );

      await oystehr.fhir.transaction({
        requests: deleteRequests,
      });
    }

    const response: DeleteLabOrderZambdaOutput = {};

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('delete-lab-order', error, ENVIRONMENT);

    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ message: `Error deleting external lab order: ${error.message || error}` }),
    };
  }
});
