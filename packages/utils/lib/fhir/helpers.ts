import { BatchInputPostRequest, FhirClient } from '@zapehr/sdk';
import {
  Appointment,
  CodeableConcept,
  Coding,
  Consent,
  DocumentReference,
  Encounter,
  Location,
  Patient,
  Person,
  Practitioner,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4';
import { DateTime } from 'luxon';
import { UserType, VisitType } from '../types';
import { FHIR_EXTENSION, PRIVATE_EXTENSION_BASE_URL } from './constants';
import { OTTEHR_MODULE } from './moduleIdentification';
import { PatientInfo } from '../types';

export function getPatientFirstName(patient: Patient): string | undefined {
  return getFirstName(patient);
}

export function getPatientLastName(patient: Patient): string | undefined {
  return getLastName(patient);
}

export function getFirstName(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0]?.given?.[0];
}

export function getMiddleName(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0].given?.[1];
}

export function getLastName(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0]?.family;
}

export function getFullName(individual: Patient | Practitioner | RelatedPerson | Person): string {
  const firstName = getFirstName(individual);
  const middleName = getMiddleName(individual);
  const lastName = getLastName(individual);
  return `${firstName}${middleName ? ` ${middleName}` : ''} ${lastName}`;
}

export function getPatientInfoFullName(patient: PatientInfo): string {
  const { firstName, middleName, lastName } = patient;
  return `${firstName}${middleName ? ` ${middleName}` : ''} ${lastName}`;
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
        // console.log('appPatientId', appPatientId);
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
        // console.log('appLocationId', appLocationId);
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

export interface CreateDocumentReferenceInput {
  docInfo: { contentURL: string; title: string; mimeType: string }[];
  type: CodeableConcept;
  dateCreated: string;
  references: object;
  fhirClient: FhirClient;
  ottehrModule: OTTEHR_MODULE;
  generateUUID?: () => string;
}

export async function createDocumentReference(input: CreateDocumentReferenceInput): Promise<DocumentReference> {
  const { docInfo, type, dateCreated, references, fhirClient, ottehrModule, generateUUID } = input;
  try {
    console.log('creating new document reference resource');
    const writeDRFullUrl = generateUUID ? generateUUID() : undefined;
    const writeDocRefReq: BatchInputPostRequest = {
      method: 'POST',
      fullUrl: writeDRFullUrl,
      url: '/DocumentReference',
      resource: {
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
      },
    };

    const results = await fhirClient.transactionRequest({ requests: [writeDocRefReq] });
    const docRef = results.entry?.[0]?.resource;
    if (docRef?.resourceType !== 'DocumentReference') {
      throw 'failed';
    }
    return docRef;
  } catch (error: unknown) {
    throw new Error(`Failed to create DocumentReference resource: ${JSON.stringify(error)}`);
  }
}

export async function createConsentResource(
  patientID: string,
  documentReferenceID: string,
  dateTime: string,
  fhirClient: FhirClient,
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

type MightReceiveTexts = RelatedPerson | Patient | Person | Practitioner;
export const getSMSNumberForIndividual = (individual: MightReceiveTexts): string | undefined => {
  const { telecom } = individual;
  return (telecom ?? []).find((cp) => {
    // format starts with +1; this is some lazy but probably good enough validation
    return cp.system === 'sms' && cp.value?.startsWith('+');
  })?.value;
};

//FHIR_EXTENSION.Patient.formUser.url

export const getFormUser = (patient: Patient): UserType | undefined => {
  const extensions = patient.extension ?? [];

  const stringVal = extensions.find((ext) => {
    return ext.url == FHIR_EXTENSION.Patient.formUser.url;
  })?.valueString;

  if (stringVal) {
    return stringVal as UserType;
  }
  return undefined;
};

interface ContactInfoPhoneNumebr {
  type: UserType;
  key: 'patient-email' | 'guardian-email';
  value: string;
}

export const getContactInfoSuppliedEmailForPatient = (patient: Patient): ContactInfoPhoneNumebr | undefined => {
  const formUser = getFormUser(patient);
  let value: string | undefined;
  let key: 'patient-email' | 'guardian-email' | undefined;

  if (formUser && formUser === 'Parent/Guardian') {
    key = 'guardian-email';
    const contacts = patient.contact ?? [];
    const contactToUse = contacts.find((cont) => {
      return cont.relationship?.find((relationship) => {
        return relationship?.coding?.[0].code === 'Parent/Guardian';
      });
    });
    if (contactToUse) {
      value = contactToUse.telecom?.find((tc) => tc.system === 'email')?.value;
    }
  } else if (formUser) {
    key = 'patient-email';
    const telecom = patient.telecom ?? [];
    const emailTel = telecom.find((tc) => {
      tc.system;
    });
    if (emailTel) {
      value = emailTel.value;
    }
  }
  if (value && formUser && key) {
    return {
      type: formUser,
      value,
      key,
    };
  } else {
    return undefined;
  }
};

export const getUnconfirmedDOBForAppointment = (appointment: Appointment): string | undefined => {
  const extensions = appointment.extension ?? [];
  return extensions.find((ext) => {
    return ext.url.replace('http:', 'https:') === FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url;
  })?.valueString;
};

export const getLastUpdateTimestampForResource = (resource: Resource): number | undefined => {
  if (!resource) {
    return undefined;
  }
  const metaTimeStamp = resource.meta?.lastUpdated;

  if (metaTimeStamp) {
    const updateTime = DateTime.fromISO(metaTimeStamp);

    if (updateTime.isValid) {
      return updateTime.toSeconds();
    }
  }
  return undefined;
};

export async function getQuestionnaireResponse(
  questionnaireID: string,
  encounterID: string,
  fhirClient: FhirClient
): Promise<QuestionnaireResponse | undefined> {
  const questionnaireResponse: QuestionnaireResponse[] = await fhirClient.searchResources({
    resourceType: 'QuestionnaireResponse',
    searchParams: [
      {
        name: 'questionnaire',
        value: `Questionnaire/${questionnaireID}`,
      },
      {
        name: 'encounter',
        value: `Encounter/${encounterID}`,
      },
    ],
  });

  if (questionnaireResponse.length === 1) {
    return questionnaireResponse[0];
  }
  return undefined;
}

export async function getRecentQuestionnaireResponse(
  questionnaireID: string,
  patientID: string,
  fhirClient: FhirClient
): Promise<QuestionnaireResponse | undefined> {
  console.log('questionnaireID', questionnaireID);
  const questionnaireResponse: QuestionnaireResponse[] = await fhirClient.searchResources({
    resourceType: 'QuestionnaireResponse',
    searchParams: [
      {
        name: 'questionnaire',
        value: `Questionnaire/${questionnaireID}`,
      },
      {
        name: 'subject',
        value: `Patient/${patientID}`,
      },
      {
        name: 'source:missing',
        value: 'false',
      },
      {
        name: '_sort',
        value: '-_lastUpdated',
      },
      {
        name: '_count',
        value: '1',
      },
    ],
  });

  console.log('questionnaireResponse found', questionnaireResponse);

  if (questionnaireResponse.length === 1) {
    return questionnaireResponse[0];
  }
  return undefined;
}
