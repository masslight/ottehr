import Oystehr from '@oystehr/sdk';
import { Device } from 'fhir/r4b';
import {
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE,
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM,
  STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM,
} from './constants';
import { getScheduleOwnerFromAppointmentOrEncounter } from './helpers';
// Returns undefined if there is no stripe account registered on the schedule owner
export const getStripeAccountForAppointmentOrEncounter = async (
  input: { appointmentId?: string; encounterId?: string },
  oystehr: Oystehr
): Promise<string | undefined> => {
  const scheduleOwner = await getScheduleOwnerFromAppointmentOrEncounter(input, oystehr);

  return scheduleOwner.extension?.find((ext) => {
    return ext.url === SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL;
  })?.valueString;
};

// Returns undefined if there is no stripe terminal location id registered on the schedule owner.
// Looks up a Device resource with type stripe-terminal-config that references the schedule owner Location.
export const getStripeTerminalLocationIdForAppointmentOrEncounter = async (
  input: { appointmentId?: string; encounterId?: string },
  oystehr: Oystehr
): Promise<string | undefined> => {
  const scheduleOwner = await getScheduleOwnerFromAppointmentOrEncounter(input, oystehr);

  if (scheduleOwner.resourceType !== 'Location' || !scheduleOwner.id) {
    return undefined;
  }

  return getStripeTerminalLocationIdForLocation(scheduleOwner.id, oystehr);
};

// Returns the Stripe terminal location ID stored on a Device resource referencing the given Location.
export const getStripeTerminalLocationIdForLocation = async (
  locationId: string,
  oystehr: Oystehr
): Promise<string | undefined> => {
  const device = await findTerminalDeviceForLocation(locationId, oystehr);
  return getTerminalLocationIdFromDevice(device);
};

// Searches for the Device resource that stores the terminal location config for a given Location.
export const findTerminalDeviceForLocation = async (
  locationId: string,
  oystehr: Oystehr
): Promise<Device | undefined> => {
  const devices = (
    await oystehr.fhir.search<Device>({
      resourceType: 'Device',
      params: [
        {
          name: 'type',
          value: `${STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM}|${STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE}`,
        },
        { name: 'location', value: `Location/${locationId}` },
      ],
    })
  ).unbundle();

  return devices[0];
};

// Extracts the Stripe terminal location ID from a Device resource's identifiers.
export const getTerminalLocationIdFromDevice = (device: Device | undefined): string | undefined => {
  if (!device) return undefined;
  return device.identifier?.find((id) => id.system === STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM)?.value;
};
