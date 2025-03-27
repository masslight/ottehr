import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Patient, Practitioner, PractitionerRole, Resource } from 'fhir/r4b';
import { EncounterPackage } from './types';

// called from assign-practitioner and unassign-practitioner zambdas
export const getVisitResources = async (
  oystehr: Oystehr,
  encounterId: string
): Promise<EncounterPackage | undefined> => {
  console.log('getVisitResources', encounterId);
  const items: Array<Appointment | Encounter | Patient | Location | Practitioner | PractitionerRole> = (
    await oystehr.fhir.search<Appointment | Encounter | Patient | Location | Practitioner | PractitionerRole>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:location',
        },
        {
          name: '_include',
          value: 'Encounter:participant:Practitioner',
        },
        {
          name: '_include',
          value: 'Encounter:participant:PractitionerRole',
        },
        {
          name: '_revinclude:iterate',
          value: 'Account:patient',
        },
      ],
    })
  ).unbundle();

  const appointment: Appointment | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Appointment';
  }) as Appointment;
  if (!appointment) return undefined;

  const encounter: Encounter | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Encounter';
  }) as Encounter;
  if (!encounter) return undefined;

  const patient: Patient | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Patient';
  }) as Patient;

  const location: Location | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Location';
  }) as Location;

  const practitioner: Practitioner | undefined = items?.find((item: Resource) => {
    return item.resourceType === 'Practitioner';
  }) as Practitioner;

  const practitionerRoles: PractitionerRole[] = items.filter(
    (item: Resource) => item.resourceType === 'PractitionerRole'
  ) as PractitionerRole[];

  const practitionerRole: PractitionerRole | undefined = practitionerRoles.find(
    (practitionerRole: PractitionerRole) => {
      const practitionerRoleLocation = practitionerRole?.location?.some((loc) => loc.id === location?.id);
      return practitionerRoleLocation !== undefined;
    }
  );

  return {
    appointment,
    encounter,
    patient,
    location,
    practitioner,
    practitionerRole,
  };
};
