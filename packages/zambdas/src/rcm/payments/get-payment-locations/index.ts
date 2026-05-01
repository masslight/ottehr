import { APIGatewayProxyResult } from 'aws-lambda';
import { Device, Location } from 'fhir/r4b';
import {
  getTerminalLocationIdFromDevice,
  isLocationVirtual,
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE,
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export interface PaymentLocation {
  location: Location;
  supportsVirtualVisits: boolean;
  stripeTerminalLocationId: string | undefined;
}

export interface GetPaymentLocationsResponse {
  locations: PaymentLocation[];
}

const ZAMBDA_NAME = 'get-payment-locations';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

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

  // Fetch all terminal config Devices in one query
  const terminalDevices = (
    await oystehr.fhir.search<Device>({
      resourceType: 'Device',
      params: [
        {
          name: 'type',
          value: `${STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM}|${STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE}`,
        },
        { name: 'status', value: 'active' },
      ],
    })
  ).unbundle();

  // Build a map from Location ID to terminal location ID
  const terminalLocationByLocationId = new Map<string, string>();
  for (const device of terminalDevices) {
    const locationRef = device.location?.reference;
    if (locationRef) {
      const locationId = locationRef.replace('Location/', '');
      const terminalLocationId = getTerminalLocationIdFromDevice(device);
      if (terminalLocationId) {
        terminalLocationByLocationId.set(locationId, terminalLocationId);
      }
    }
  }

  const paymentLocations: PaymentLocation[] = allLocations
    .filter((location: Location) => {
      const isVirtual = isLocationVirtual(location);
      const hasPhysicalAddress = (location.address?.line?.length ?? 0) > 0;
      return isVirtual || hasPhysicalAddress;
    })
    .map((location: Location) => ({
      location,
      supportsVirtualVisits: isLocationVirtual(location),
      stripeTerminalLocationId: location.id ? terminalLocationByLocationId.get(location.id) : undefined,
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
});
