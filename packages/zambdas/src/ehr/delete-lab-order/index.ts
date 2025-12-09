import { BatchInputDeleteRequest, BatchInputPatchRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { DeleteLabOrderZambdaOutput, getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getLabOrderRelatedResources, makeCommunicationRequest, makeDeleteResourceRequest } from './helpers';
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

    const { serviceRequest, questionnaireResponse, task, labConditions, communications } =
      await getLabOrderRelatedResources(oystehr, validatedParameters);

    if (!serviceRequest) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Lab order with ID ${serviceRequestId} not found` }),
      };
    }

    const requests: (BatchInputDeleteRequest | BatchInputPatchRequest<Communication>)[] = [];

    requests.push(makeDeleteResourceRequest('ServiceRequest', serviceRequestId));

    if (questionnaireResponse?.id) {
      requests.push(makeDeleteResourceRequest('QuestionnaireResponse', questionnaireResponse.id));
    }

    if (task?.id) {
      requests.push(makeDeleteResourceRequest('Task', task.id));
    }

    labConditions.forEach((condition) => {
      if (condition.id) {
        requests.push(makeDeleteResourceRequest('Condition', condition.id));
      }
    });

    const communicationRequest = makeCommunicationRequest(communications?.orderLevelNotes, serviceRequest);
    if (communicationRequest) requests.push(communicationRequest);

    if (requests.length > 0) {
      console.log(
        `Deleting external lab order for service request id: ${serviceRequestId}; request: ${JSON.stringify(
          requests,
          null,
          2
        )}`
      );

      await oystehr.fhir.transaction({ requests });
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
