import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { DeletedResponse } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, fetchById } from '../shared';
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
  const existing = await complexValidation(oystehr, params);
  console.groupEnd();
  console.debug('complexValidation success');

  console.group('performEffect');
  const response = await performEffect(oystehr, params, existing);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function complexValidation(oystehr: Oystehr, params: DeleteServiceFacilityParams): Promise<Location> {
  return fetchById<Location>(oystehr, 'Location', params.facilityId);
}

async function performEffect(
  oystehr: Oystehr,
  params: DeleteServiceFacilityParams,
  existing: Location
): Promise<DeletedResponse> {
  const { facilityId } = params;

  await oystehr.fhir.patch(
    {
      resourceType: 'Location',
      id: facilityId,
      operations: [
        {
          op: 'add',
          path: '/status',
          value: 'inactive',
        },
      ],
    },
    {
      optimisticLockingVersionId: existing.meta?.versionId,
    }
  );

  return { deleted: true };
}
