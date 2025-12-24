import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Appointment, HealthcareService, Location, Practitioner, Schedule, Slot } from 'fhir/r4b';
import { APPOINTMENT_NOT_FOUND_ERROR, SCHEDULE_NOT_FOUND_ERROR } from '../types';
import { ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT } from './constants';

// Returns undefined if there is no stripe account registered on the schedule owner
export const getStripeAccountForAppointmentOrEncounter = async (
  input: { appointmentId?: string; encounterId?: string },
  oystehr: Oystehr
): Promise<string | undefined> => {
  const { appointmentId, encounterId } = input;
  const appointmentSearchParams: SearchParam[] = [
    {
      name: '_include',
      value: 'Appointment:actor',
    },
    {
      name: '_include',
      value: 'Appointment:slot',
    },
    {
      name: '_include:iterate',
      value: 'Slot:schedule',
    },
    {
      name: '_revinclude:iterate',
      value: 'Schedule:actor:Location',
    },
    {
      name: '_revinclude:iterate',
      value: 'Schedule:actor:Practitioner',
    },
  ];

  if (appointmentId) {
    appointmentSearchParams.push({
      name: '_id',
      value: appointmentId,
    });
  } else if (encounterId) {
    appointmentSearchParams.push({ name: '_has:Encounter:appointment:_id', value: encounterId });
  } else {
    throw new Error('Either appointmentId or encounterId must be provided');
  }

  const allResources = (
    await oystehr.fhir.search<Appointment | Slot | Schedule | Location | HealthcareService | Practitioner>({
      resourceType: 'Appointment',
      params: appointmentSearchParams,
    })
  ).unbundle();
  console.log(`successfully retrieved ${allResources.length} appointment resources`);
  const fhirAppointment = allResources.find((resource) => resource.resourceType === 'Appointment') as Appointment;
  const fhirLocation = allResources.find((resource) => resource.resourceType === 'Location');
  const fhirHS = allResources.find((resource) => resource.resourceType === 'HealthcareService');
  const fhirPractitioner = allResources.find((resource) => resource.resourceType === 'Practitioner');

  let scheduleOwner: Location | HealthcareService | Practitioner | undefined;
  if (fhirLocation) {
    scheduleOwner = fhirLocation as Location;
  } else if (fhirHS) {
    scheduleOwner = fhirHS as HealthcareService;
  } else if (fhirPractitioner) {
    scheduleOwner = fhirPractitioner as Practitioner;
  }

  if (!fhirAppointment) {
    throw APPOINTMENT_NOT_FOUND_ERROR;
  }

  if (!scheduleOwner) {
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  const stripeAccountFromScheduleOwner = scheduleOwner.extension?.find((ext) => {
    return ext.url === ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT;
  })?.valueString;

  if (stripeAccountFromScheduleOwner) {
    return stripeAccountFromScheduleOwner;
  }

  return undefined;
};
