import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { getSecret, isLocationVirtual, SecretsKeys } from 'utils';
import { createOystehrClient, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export interface PaymentLocation {
  location: Location;
  supportsVirtualVisits: boolean;
}

export interface GetPaymentLocationsResponse {
  locations: PaymentLocation[];
}

const ZAMBDA_NAME = 'get-payment-locations';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets } = validateRequestParameters(input);
    const oystehr = createOystehrClient(input.accessToken!, secrets);

    const resources = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: 'status',
          value: 'active',
        },
      ],
    });

    const allLocations = resources.unbundle();

    const paymentLocations: PaymentLocation[] = allLocations
      .filter((location: Location) => {
        const isVirtual = isLocationVirtual(location);
        const hasPhysicalAddress = (location.address?.line?.length ?? 0) > 0;
        return isVirtual || hasPhysicalAddress;
      })
      .map((location: Location) => ({
        location,
        supportsVirtualVisits: isLocationVirtual(location),
      }))
      .sort((a, b) => {
        const nameA = a.location.name || '';
        const nameB = b.location.name || '';
        return nameA.localeCompare(nameB);
      });

    const response: GetPaymentLocationsResponse = {
      locations: paymentLocations,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
