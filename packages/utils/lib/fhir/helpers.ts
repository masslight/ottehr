import { Appointment, Coding, Encounter, Patient, Resource, Location } from 'fhir/r4';
import { PRIVATE_EXTENSION_BASE_URL } from './constants';

export function getPatientFirstName(patient: Patient): string | undefined {
  return patient.name?.[0]?.given?.[0];
}

export const codingsEqual = (coding1: Coding, coding2: Coding): boolean => {
  const systemsAreEqual = coding1.system === coding2.system;
  const codesAreEqual = coding1.code === coding2.code;

  return systemsAreEqual && codesAreEqual;
};

export const codingContainedInList = (coding: Coding, codingList: Coding[]): boolean => {
  return codingList.reduce((haveMatch, currentCoding) => {
    return haveMatch || codingsEqual(coding, currentCoding);
  }, false);
};

export const findPatientForAppointment = (appointment: Appointment, patients: Patient[]): Patient | undefined => {
  const { participant } = appointment;
  if (!participant) {
    return undefined;
  }
  return patients.find((pat) => {
    return participant.some((part) => {
      const { actor } = part;
      if (actor && actor.reference) {
        const [type, appPatientId] = actor.reference.split('/');
        if (type !== 'Patient') {
          return false;
        }
        console.log('appPatientId', appPatientId);
        return appPatientId === pat.id;
      }
      return false;
    });
  });
};

export const findLocationForAppointment = (appointment: Appointment, locations: Location[]): Location | undefined => {
  const { participant } = appointment;
  if (!participant) {
    return undefined;
  }
  return locations.find((loc) => {
    return participant.some((part) => {
      const { actor } = part;
      if (actor && actor.reference) {
        const [type, appLocationId] = actor.reference.split('/');
        if (type !== 'Location') {
          return false;
        }
        console.log('appLocationId', appLocationId);
        return appLocationId === loc.id;
      } else {
        console.log('no actor?', JSON.stringify(actor));
      }
      return false;
    });
  });
};

export const findEncounterForAppointment = (
  appointment: Appointment,
  encounters: Encounter[],
): Encounter | undefined => {
  // Go through encounters and find the one with appointment
  return encounters.find(
    (encounter) =>
      encounter.appointment?.find((appRef) => {
        const { reference } = appRef;
        if (!reference) {
          return false;
        }
        const [_, refId] = reference.split('/');
        return refId && refId === appointment.id;
      }),
  );
};

export const resourceHasTag = (resource: Resource, tag: Coding): boolean => {
  const tags = resource.meta?.tag ?? [];
  return tags.some((t) => {
    return t.system === tag.system && t.code === tag.code;
  });
};

export const isPrebookAppointment = (appointment: Appointment): boolean => {
  const typeCoding = appointment.appointmentType?.coding ?? [];
  return typeCoding.some((codable) => {
    return codable.code === 'PREBOOK';
  });
};

export function getPatientContactEmail(patient: Patient): string | undefined {
  const formUser = patient.extension?.find((ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/form-user`)?.valueString;
  if (formUser === 'Patient') {
    return patient.telecom?.find((telecomTemp) => telecomTemp.system === 'email')?.value;
  }
  if (formUser === 'Parent/Guardian') {
    return patient.contact
      ?.find(
        (contactTemp) =>
          contactTemp.relationship?.find(
            (relationshipTemp) =>
              relationshipTemp.coding?.find(
                (codingTemp) => codingTemp.system === `${PRIVATE_EXTENSION_BASE_URL}/relationship`,
              ),
          ),
      )
      ?.telecom?.find((telecomTemp) => telecomTemp.system === 'email')?.value;
  }

  return undefined;
}
