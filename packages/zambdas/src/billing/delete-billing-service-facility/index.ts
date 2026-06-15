import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';
import { DeleteServiceFacilityParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'delete-billing-service-facility';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('complexValidation');
  await complexValidation(oystehr, params);
  console.groupEnd();
  console.debug('complexValidation success');

  console.group('performEffect');
  const response = await performEffect(oystehr, params);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function complexValidation(oystehr: Oystehr, params: DeleteServiceFacilityParams): Promise<void> {
  const { facilityId } = params;

  const bundle = await oystehr.fhir.search<Location>({
    resourceType: 'Location',
    params: [
      {
        name: '_id',
        value: facilityId,
      },
    ],
  });
  if (!bundle.unbundle()[0]) throw FHIR_RESOURCE_NOT_FOUND('Location');
}

async function performEffect(oystehr: Oystehr, params: DeleteServiceFacilityParams): Promise<{ id: string }> {
  const { facilityId } = params;

  await oystehr.fhir.patch({
    resourceType: 'Location',
    id: facilityId,
    operations: [
      {
        op: 'add',
        path: '/status',
        value: 'inactive',
      },
    ],
  });

  return { id: facilityId };
}
