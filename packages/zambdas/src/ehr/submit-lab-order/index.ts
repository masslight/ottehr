import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { DocumentReference, FhirResource, Provenance, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APIError,
  getPatchBinary,
  getSecret,
  isApiError,
  MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING,
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
import {
  getBundledOrderResources,
  makeOrderFormsAndDocRefs,
  makeProvenanceResourceRequest,
  OrderResourcesByOrderNumber,
} from './helpers';
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
    const bundledOrdersByOrderNumber = await getBundledOrderResources(
      oystehr,
      m2mToken,
      serviceRequestIDs,
      manualOrder
    );
    console.log('successfully retrieved resources');

    // submit to oystehr labs when NOT manual order
    const successfulBundledOrders: OrderResourcesByOrderNumber = {};
    const failedBundledOrders: OrderResourcesByOrderNumber = {};
    if (!manualOrder) {
      console.log('calling oystehr submit lab');

      const submitLabPromises = Object.entries(bundledOrdersByOrderNumber).map(async ([orderNumber, resources]) => {
        if (resources.isPscOrder) return { status: 'fulfilled', orderNumber, isPsc: true };
        try {
          const params = {
            serviceRequest: resources.testDetails.map((test) => `ServiceRequest/${test.serviceRequestID}`),
            accountNumber: resources.accountNumber,
            orderNumber: orderNumber,
          };
          console.log('params being sent to oystehr submit lab', JSON.stringify(params));
          const res = await fetch(OYSTEHR_SUBMIT_LAB_API, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${m2mToken}`,
            },
            body: JSON.stringify(params),
          });

          if (!res.ok) {
            const body = await res.json();
            throw new Error(`Error submitting order number: ${orderNumber}. Error: ${body.message}`);
          }

          const result = await res.json();
          const eReq: DocumentReference | undefined = result?.eRequisitionDocumentReference;
          return { status: 'fulfilled', orderNumber, eReqDocumentReference: eReq };
        } catch (e) {
          return { status: 'rejected', orderNumber, reason: (e as Error).message };
        }
      });

      const submitLabResults = await Promise.all(submitLabPromises);

      for (const res of submitLabResults) {
        if (res.status === 'fulfilled') {
          const resources = bundledOrdersByOrderNumber[res.orderNumber];
          if (res.eReqDocumentReference) {
            console.log(`eReq generated for order ${res.orderNumber} - docRef id: ${res.eReqDocumentReference.id}`);
            successfulBundledOrders[res.orderNumber] = { ...resources, labGeneratedEReq: res.eReqDocumentReference };
          } else {
            successfulBundledOrders[res.orderNumber] = { ...resources };
          }
        } else if (res.status === 'rejected') {
          console.error('rejected result', res);
          const resources = bundledOrdersByOrderNumber[res.orderNumber];
          failedBundledOrders[res.orderNumber] = resources;
        }
      }
    } else {
      Object.entries(bundledOrdersByOrderNumber).forEach(([orderNumber, resources]) => {
        successfulBundledOrders[orderNumber] = resources;
      });
    }

    // submit successful, do the fhir provenance writes
    const provenancePostRequests: BatchInputRequest<Provenance>[] = [];
    const serviceRequestPatchRequest: BatchInputRequest<ServiceRequest>[] = [];

    Object.values(successfulBundledOrders).forEach((resources) => {
      resources.testDetails.forEach((test) => {
        provenancePostRequests.push(makeProvenanceResourceRequest(now, test.serviceRequestID, currentUser));

        const serviceRequestPatchOps: Operation[] = [
          {
            op: 'replace',
            path: '/status',
            value: 'active',
          },
        ];
        if (manualOrder) {
          serviceRequestPatchOps.push({
            op: 'add',
            path: test.serviceRequest?.category ? '/category/-' : '/category',
            value: test.serviceRequest?.category
              ? { coding: [MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING] }
              : [{ coding: [MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING] }],
          });
        }
        serviceRequestPatchRequest.push(
          getPatchBinary({
            resourceType: 'ServiceRequest',
            resourceId: test.serviceRequestID,
            patchOperations: serviceRequestPatchOps,
          })
        );
      });
    });

    const requests: BatchInputRequest<FhirResource>[] = [...provenancePostRequests, ...serviceRequestPatchRequest];
    if (requests.length) {
      console.log('making fhir transaction requests');
      await oystehr?.fhir.transaction({ requests });
    } else {
      console.log('no requests to make');
    }

    const hasSuccesses = Object.keys(successfulBundledOrders).length > 0;
    const orderPdfUrls = hasSuccesses
      ? await makeOrderFormsAndDocRefs(successfulBundledOrders, now, secrets, m2mToken, oystehr)
      : [];

    const hasFailures = Object.keys(failedBundledOrders).length > 0;
    const failedOrdersByOrderNumber = hasFailures
      ? Object.keys(failedBundledOrders).map((orderNumber) => orderNumber)
      : undefined;

    const responseBody: SubmitLabOrderOutput = { orderPdfUrls, failedOrdersByOrderNumber };

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
