import { APIGatewayProxyResult } from 'aws-lambda';
import { DateTime } from 'luxon';
import {
  APIError,
  EXTERNAL_LAB_ERROR,
  getSecret,
  isApiError,
  OYSTEHR_SUBMIT_LAB_API,
  SecretsKeys,
  SubmitLabOrderOutput,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getBundledOrderResources, makeOrderFormsAndDocRefs, makeProvenanceResourceRequest } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'submit-lab-order';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { serviceRequestIDs, manualOrder, secrets } = validateRequestParameters(input);
    console.log('manualOrder', serviceRequestIDs, manualOrder);

    console.log('Getting token');
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    console.log('token', m2mToken);

    const oystehr = createOystehrClient(m2mToken, secrets);

    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const currentUser = await createOystehrClient(userToken, secrets).user.me();

    const now = DateTime.now();

    console.log('getting resources needed for submit lab');
    const bundledOrdersByAccountNumber = await getBundledOrderResources(oystehr, m2mToken, serviceRequestIDs);
    console.log('successfully retrieved resources');

    console.log('check this! bundledOrdersByAccountNumber', JSON.stringify(bundledOrdersByAccountNumber));

    // todo SARAH comment out before testing, will not work
    // submit to oystehr labs when NOT manual order
    if (!manualOrder) {
      console.log('calling oystehr submit lab');

      const submitLabPromises = Object.entries(bundledOrdersByAccountNumber).map(([accountNumber, resources]) => {
        return fetch(OYSTEHR_SUBMIT_LAB_API, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${m2mToken}`,
          },
          body: JSON.stringify({
            serviceRequest: resources.testDetails.map((test) => `ServiceRequest/${test.serviceRequestID}`),
            accountNumber: accountNumber,
          }),
        });
      });

      const submitLabResults = await Promise.all(submitLabPromises);

      for (const res of submitLabResults) {
        if (!res.ok) {
          const submitLabRequestResponse = await res.json();
          console.log('submitLabRequestResponse', submitLabRequestResponse);
          throw EXTERNAL_LAB_ERROR(submitLabRequestResponse.message || 'error submitting lab request to oystehr');
        }
      }
    }

    // submit successful, do the fhir provenance writes
    const provenancePostRequests = Object.values(bundledOrdersByAccountNumber).flatMap((resources) => {
      return resources.testDetails.map((test) =>
        makeProvenanceResourceRequest(now, test.serviceRequestID, currentUser)
      );
    });

    // todo SARAH add this back somehow
    // if (manualOrder) {
    //   requests.push(
    //     getPatchBinary({
    //       resourceType: 'ServiceRequest',
    //       resourceId: serviceRequest.id || 'unknown',
    //       patchOperations: [
    //         {
    //           op: 'replace',
    //           path: '/status',
    //           value: 'active',
    //         },
    //         {
    //           op: 'add',
    //           path: serviceRequest?.category ? '/category/-' : '/category',
    //           value: serviceRequest?.category
    //             ? { coding: MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING }
    //             : [{ coding: MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING }],
    //         },
    //       ],
    //     })
    //   );
    // }

    console.log('making fhir transaction requests');
    await oystehr?.fhir.transaction({
      requests: provenancePostRequests,
    });

    const orderPdfUrls = await makeOrderFormsAndDocRefs(bundledOrdersByAccountNumber, now, secrets, m2mToken, oystehr);

    console.log('orderPdfUrls', orderPdfUrls);
    const responseBody: SubmitLabOrderOutput = { orderPdfUrls };

    return {
      body: JSON.stringify(responseBody),
      statusCode: 200,
    };
  } catch (error: any) {
    console.log(error);
    console.log('submit external lab order error:', JSON.stringify(error));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('admin-submit-lab-order', error, ENVIRONMENT);
    let body = JSON.stringify({ message: 'Error submitting external lab order' });
    if (isApiError(error)) {
      const { code, message } = error as APIError;
      body = JSON.stringify({ message, code });
    }
    return {
      statusCode: 500,
      body,
    };
  }
});
