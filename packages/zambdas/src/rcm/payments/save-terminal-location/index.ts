import { APIGatewayProxyResult } from 'aws-lambda';
import { Device } from 'fhir/r4b';
import {
  findTerminalDeviceForLocation,
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE,
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM,
  STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'save-terminal-location';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { locationId, terminalLocationId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const existingDevice = await findTerminalDeviceForLocation(locationId, oystehr);

  if (terminalLocationId) {
    if (existingDevice) {
      // Update existing Device's identifier
      const updatedIdentifiers = (existingDevice.identifier ?? []).filter(
        (id) => id.system !== STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM
      );
      updatedIdentifiers.push({
        system: STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM,
        value: terminalLocationId,
      });

      await oystehr.fhir.update<Device>(
        {
          ...existingDevice,
          identifier: updatedIdentifiers,
          status: 'active',
        },
        { optimisticLockingVersionId: existingDevice.meta?.versionId }
      );
    } else {
      // Create new Device
      const newDevice: Device = {
        resourceType: 'Device',
        type: {
          coding: [
            {
              system: STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM,
              code: STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE,
            },
          ],
        },
        location: {
          reference: `Location/${locationId}`,
        },
        identifier: [
          {
            system: STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM,
            value: terminalLocationId,
          },
        ],
        status: 'active',
      };

      await oystehr.fhir.create<Device>(newDevice);
    }
  } else if (existingDevice?.id) {
    // Remove the Device when terminal location is being cleared
    await oystehr.fhir.delete({ resourceType: 'Device', id: existingDevice.id });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
});
