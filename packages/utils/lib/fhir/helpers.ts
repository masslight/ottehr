import {
  Appointment,
  Coding,
  Encounter,
  Patient,
  Resource,
  Location,
  CodeableConcept,
  DocumentReference,
  Consent,
  Practitioner,
  RelatedPerson,
  Person,
} from 'fhir/r4';
import { PRIVATE_EXTENSION_BASE_URL } from './constants';
import { FhirClient } from '@zapehr/sdk';
import { OTTEHR_MODULE } from './moduleIdentification';
import { VisitType } from '../types';

export function getPatientFirstName(patient: Patient): string | undefined {
  return getFirstName(patient);
}

export function getPatientLastName(patient: Patient): string | undefined {
  return getLastName(patient);
}

export function getFirstName(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0]?.given?.[0];
}

export function getLastName(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0]?.family;
}

export function getPractitionerNPI(practitioner: Practitioner): string | undefined {
  return practitioner.identifier?.find((ident) => {
    return ident.system === 'http://hl7.org.fhir/sid/us-npi';
  })?.value;
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
  encounters: Encounter[]
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
      })
  );
};

export const resourceHasTag = (resource: Resource, tag: Coding): boolean => {
  const tags = resource.meta?.tag ?? [];
  return tags.some((t) => {
    return t.system === tag.system && t.code === tag.code;
  });
};

export const isPrebookAppointment = (appointment: Appointment): boolean => {
  const typeCoding = appointment.appointmentType?.text;
  return typeCoding === VisitType.PreBook;
};

export function getPatientContactEmail(patient: Patient): string | undefined {
  const formUser = patient.extension?.find((ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/form-user`)?.valueString;
  if (formUser === 'Parent/Guardian') {
    return patient.contact
      ?.find(
        (contactTemp) =>
          contactTemp.relationship?.find(
            (relationshipTemp) =>
              relationshipTemp.coding?.find(
                (codingTemp) => codingTemp.system === `${PRIVATE_EXTENSION_BASE_URL}/relationship`
              )
          )
      )
      ?.telecom?.find((telecomTemp) => telecomTemp.system === 'email')?.value;
  } else {
    return patient.telecom?.find((telecomTemp) => telecomTemp.system === 'email')?.value;
  }
}

export function getOtherOfficesForLocation(location: Location): { display: string; url: string }[] {
  const rawExtensionValue = location?.extension?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/other-offices'
  )?.valueString;
  if (!rawExtensionValue) {
    console.log("Location doesn't have other-offices extension");
    return [];
  }

  let parsedExtValue: { display: string; url: string }[] = [];
  try {
    parsedExtValue = JSON.parse(rawExtensionValue);
  } catch (_) {
    console.log('Location other-offices extension is formatted incorrectly');
    return [];
  }

  return parsedExtValue;
}

export async function createDocumentReference(
  docInfo: { contentURL: string; title: string; mimeType: string }[],
  type: CodeableConcept,
  dateCreated: string,
  references: object,
  fhirClient: FhirClient,
  ottehrModule: OTTEHR_MODULE
): Promise<DocumentReference> {
  try {
    console.log('creating new document reference resource');
    const documentReference = await fhirClient.createResource<DocumentReference>({
      resourceType: 'DocumentReference',
      meta: {
        tag: [{ code: ottehrModule }],
      },
      date: dateCreated,
      status: 'current',
      type: type,
      content: docInfo.map((tempInfo) => {
        return { attachment: { url: tempInfo.contentURL, contentType: tempInfo.mimeType, title: tempInfo.title } };
      }),
      ...references,
    });

    return documentReference;
  } catch (error: unknown) {
    throw new Error(`Failed to create DocumentReference resource: ${JSON.stringify(error)}`);
  }
}

export async function createConsentResource(
  patientID: string,
  documentReferenceID: string,
  dateTime: string,
  fhirClient: FhirClient
): Promise<Consent> {
  try {
    console.log('creating new consent resource');
    const createdConsent = await fhirClient.createResource<Consent>({
      resourceType: 'Consent',
      dateTime: dateTime,
      status: 'active',
      patient: {
        reference: `Patient/${patientID}`,
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
              code: 'hipaa-ack',
            },
          ],
        },
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
              code: 'treat-guarantee',
            },
          ],
        },
      ],
      policy: [
        {
          uri: 'https://ottehr.com',
        },
        {
          uri: 'https://ottehr.com',
        },
      ],
      sourceReference: {
        reference: `DocumentReference/${documentReferenceID}`,
      },
      scope: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'patient-privacy',
            display: 'Privacy Consent',
          },
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'treatment',
            display: 'Treatment',
          },
        ],
      },
    });

    return createdConsent;
  } catch (error: unknown) {
    throw new Error(`Failed to create Consent resource: ${JSON.stringify(error)}`);
  }
}

