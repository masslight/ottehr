import Oystehr from '@oystehr/sdk';
import {
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
  SCHEDULE_OWNER_STRIPE_TERMINAL_LOCATION_ID_EXTENSION_URL,
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

// Returns undefined if there is no stripe terminal location id registered on the schedule owner
export const getStripeTerminalLocationIdForAppointmentOrEncounter = async (
  input: { appointmentId?: string; encounterId?: string },
  oystehr: Oystehr
): Promise<string | undefined> => {
  const scheduleOwner = await getScheduleOwnerFromAppointmentOrEncounter(input, oystehr);

  return scheduleOwner.extension?.find((ext) => {
    return ext.url === SCHEDULE_OWNER_STRIPE_TERMINAL_LOCATION_ID_EXTENSION_URL;
  })?.valueString;
};
