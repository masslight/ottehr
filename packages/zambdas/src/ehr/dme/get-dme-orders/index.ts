import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DeviceRequest, Practitioner } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { GetDmeOrdersInput, GetDmeOrdersInputSchema, GetDmeOrdersResponse } from 'utils/lib/types/api/dme.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { DME_ORDER_SEARCH_TAG, getDmePractitionerIds, isDmeOrderDeleted, parseDmeOrder } from '../../../shared/dme';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { fetchPractitionerNames, getCallerToken } from '../shared/order-helpers';

let m2mToken: string;
const ZAMBDA_NAME = 'get-dme-orders';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  getCallerToken(input);
  const { secrets, ...params } = validateWithSchema(GetDmeOrdersInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await getDmeOrders(params, oystehr);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export const getDmeOrders = async (params: GetDmeOrdersInput, oystehr: Oystehr): Promise<GetDmeOrdersResponse> => {
  const resources = await getAllFhirSearchPages<DeviceRequest | Practitioner>(
    {
      resourceType: 'DeviceRequest',
      params: [
        params.deviceRequestId
          ? { name: '_id', value: params.deviceRequestId }
          : { name: 'encounter', value: `Encounter/${params.encounterId}` },
        { name: '_tag', value: DME_ORDER_SEARCH_TAG },
        { name: '_include', value: 'DeviceRequest:requester' },
      ],
    },
    oystehr
  );

  const deviceRequests = resources.filter(
    (r): r is DeviceRequest => r.resourceType === 'DeviceRequest' && !isDmeOrderDeleted(r)
  );
  const practitioners = resources.filter((r): r is Practitioner => r.resourceType === 'Practitioner');
  const practitionerNames = await fetchPractitionerNames(
    deviceRequests.flatMap(getDmePractitionerIds),
    oystehr,
    practitioners
  );

  const orders = deviceRequests
    .map((dr) => parseDmeOrder(dr, practitionerNames))
    .sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));

  return { orders };
};
