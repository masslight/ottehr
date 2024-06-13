import { FhirClient } from '@zapehr/sdk';
import { Account, Appointment, ChargeItem, Encounter, Patient, Resource } from 'fhir/r4';
import { AppointmentPackage } from './types';
import { getVideoRoomResourceExtension } from '../../shared/helpers';

export const getVideoResources = async (
  fhirClient: FhirClient,
  appointmentId: string,
): Promise<AppointmentPackage | undefined> => {
  //
  // Attempting to get three items: Encounter, Appointment and charge Item
  // FHIR API Query looks something like this:
  // Encounter?appointment=Appointment/d2d0f76d-5bc5-4d99-a5b4-8e16ebfe7e47
  //          &_include=Encounter:appointment
  //          &_revinclude=ChargeItem:context
  //          &_include=Encounter:subject
  //          &_revinclude:iterate=Account:patient
  //
  // Given an appointment ID, find an Encounter for this appointment, a Charge Item for which the Encounter
  // is its context, a patient that's the subject of the encounter, and the Accocunt for this patient
  //

  const items: Array<Appointment | Encounter | ChargeItem | Patient | Account> = await fhirClient.searchResources<
    Appointment | Encounter | ChargeItem | Patient | Account
  >({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: 'appointment',
        value: `Appointment/${appointmentId}`,
      },
      {
        name: '_include',
        value: 'Encounter:appointment',
      },
      {
        name: '_revinclude',
        value: 'ChargeItem:context',
      },
      {
        name: '_include',
        value: 'Encounter:subject',
      },
      {
        name: '_revinclude:iterate',
        value: 'Account:patient',
      },
    ],
  });

  const appointment: Appointment | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Appointment';
  }) as Appointment;
  if (!appointment) return undefined;

  const encounter: Encounter | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Encounter' && getVideoRoomResourceExtension(item);
  }) as Encounter;
  if (!encounter) return undefined;

  const chargeItem: ChargeItem | undefined = items.find((item: Resource) => {
    return item.resourceType === 'ChargeItem';
  }) as ChargeItem;

  const patient: Patient | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Patient';
  }) as Patient;

  const account: Account | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Account';
  }) as Account;

  return {
    appointment,
    encounter,
    chargeItem,
    patient,
    account,
  };
};
