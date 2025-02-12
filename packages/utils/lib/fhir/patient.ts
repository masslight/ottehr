import Oystehr from '@oystehr/sdk';
import {
  Address,
  Appointment,
  CodeableConcept,
  Communication,
  ContactPoint,
  Encounter,
  HumanName,
  Identifier,
  Patient,
  Period,
  Person,
  Practitioner,
  Reference,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import {
  FHIR_EXTENSION,
  FHIR_IDENTIFIER_NPI,
  filterResources,
  getCommunicationsAndSenders,
  getUniquePhonesNumbers,
  PRIVATE_EXTENSION_BASE_URL,
} from '.';
import {
  PatientInfo,
  PROVIDER_NOTIFICATION_METHOD_URL,
  PROVIDER_NOTIFICATIONS_ENABLED_URL,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
  ProviderNotificationMethod,
  ProviderNotificationSettings,
  RelatedPersonMaps,
} from '../types';
import { removePrefix } from '../helpers';

// Return true if a new user
export async function createUserResourcesForPatient(
  oystehr: Oystehr,
  patientID: string,
  phoneNumber: string
): Promise<{ relatedPerson: RelatedPerson; person: Person; newUser: boolean }> {
  console.log(`Creating a RelatedPerson for Patient ${patientID}`);
  const relatedPerson = (await oystehr.fhir.create({
    resourceType: 'RelatedPerson',
    relationship: [
      {
        coding: [
          {
            system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`,
            code: 'user-relatedperson',
          },
        ],
      },
    ],
    telecom: [
      { system: 'phone', value: phoneNumber },
      { system: 'sms', value: phoneNumber },
    ],
    patient: {
      reference: `Patient/${patientID}`,
    },
  })) as RelatedPerson;

  console.log(`For Patient ${patientID} created a RelatedPerson ${relatedPerson.id}`);
  console.log(`Searching for Person with phone number ${phoneNumber}`);

  const personResults = (
    await oystehr.fhir.search<Person>({
      resourceType: 'Person',
      params: [
        {
          name: 'telecom',
          value: phoneNumber,
        },
      ],
    })
  ).unbundle();

  let person: Person | undefined = undefined;
  let newUser = false;

  if (personResults.length === 0) {
    newUser = true;
    console.log(`Did not find a Person for user with phone number ${phoneNumber}, creating one`);
    person = (await oystehr.fhir.create({
      resourceType: 'Person',
      telecom: [{ system: 'phone', value: phoneNumber }],
      link: [
        {
          target: { reference: `RelatedPerson/${relatedPerson.id}` },
        },
      ],
    })) as Person;
    console.log(`For user with phone number ${phoneNumber} created a Person ${person.id}`);
  } else {
    console.log(
      `Did find a Person with phone number ${phoneNumber} with ID ${personResults[0].id}, adding RelatedPerson ${relatedPerson.id} to link`
    );
    person = personResults[0];
    const hasLink = person.link;
    if (hasLink) {
      console.log(
        "Person does not have link, this shouldn't happen outside of test cases but is still possible - The account may not have patients"
      );
    }
    const link = {
      target: {
        reference: `RelatedPerson/${relatedPerson.id}`,
      },
    };
    await oystehr.fhir.patch({
      resourceType: 'Person',
      id: person.id || '',
      operations: [
        {
          op: 'add',
          path: hasLink ? '/link/0' : '/link',
          value: hasLink ? link : [link],
        },
      ],
    });
    console.log(`Updated Person with ID ${person.id}`);
  }

  return { relatedPerson, person, newUser };
}

export async function getRelatedPersonsForPhoneNumber(
  phoneNumber: string,
  oystehr: Oystehr
): Promise<RelatedPerson[] | undefined> {
  const resources = (
    await oystehr.fhir.search<RelatedPerson>({
      resourceType: 'RelatedPerson',
      params: [
        {
          name: '_has:Person:relatedperson:telecom',
          value: phoneNumber,
        },
      ],
    })
  ).unbundle();
  return resources;
}

export async function getPatientResourceWithVerifiedPhoneNumber(
  patientID: string,
  oystehr: Oystehr
): Promise<{
  patient: Patient | undefined;
  verifiedPhoneNumber: string | undefined;
  relatedPerson: RelatedPerson | undefined;
}> {
  const response = (
    await oystehr.fhir.search<Patient | Person | RelatedPerson>({
      resourceType: 'Patient',
      params: [
        {
          name: '_id',
          value: patientID,
        },
        {
          name: '_revinclude',
          value: 'RelatedPerson:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Person:link:RelatedPerson',
        },
      ],
    })
  ).unbundle();

  const patient = response.find((res) => {
    return res.resourceType === 'Patient';
  }) as Patient;

  const person = response.find((res) => {
    return res.resourceType === 'Person';
  }) as Person;

  const relatedPerson = response.find((res) => {
    return res.resourceType === 'RelatedPerson';
  }) as RelatedPerson;

  const contacts = person?.telecom ?? [];

  const verifiedPhoneNumber = contacts.find((contact) => {
    if (contact.system === 'phone' && contact.value) {
      return contact.period?.end == undefined;
    }
    return false;
  })?.value;

  return { patient, verifiedPhoneNumber, relatedPerson };
}

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

export function getNickname(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[1]?.given?.[0];
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

export function getPatientChosenName(patient: PatientInfo, lowercaseP?: boolean): string {
  return patient.chosenName ? patient.chosenName : patient.firstName ?? `${lowercaseP ? 'p' : 'P'}atient`;
}

export function getPatientInfoFullNameUsingChosen(patient: PatientInfo): string {
  const { middleName, lastName } = patient;
  return `${getPatientChosenName(patient)}${middleName ? ` ${middleName}` : ''} ${lastName}`;
}

export function sortFullNames(a: PatientInfo, b: PatientInfo): number {
  const compareNames = (a?: string, b?: string): number => {
    const trimmedA = a?.trim() || '';
    const trimmedB = b?.trim() || '';
    return trimmedA && trimmedB ? trimmedA.localeCompare(trimmedB) : 0;
  };

  return (
    compareNames(a.chosenName || a.firstName, b.chosenName || b.firstName) ||
    compareNames(a.middleName, b.middleName) ||
    compareNames(a.lastName, b.lastName)
  );
}

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

export const findPatientForEncounter = (encounter: Encounter, patients: Patient[]): Patient | undefined => {
  const patientRef = encounter.participant?.find((part) => part.individual?.reference?.includes('Patient/'))?.individual
    ?.reference;
  const patientId = removePrefix('Patient/', patientRef ?? '');
  if (patientId) return patients.find((patient) => patient.id === patientId);
  return undefined;
};

export const findRelatedPersonForPatient = (
  patient: Patient,
  relatedPersons: RelatedPerson[]
): RelatedPerson | undefined => {
  return relatedPersons.find(
    (relatedPerson) => removePrefix('Patient/', relatedPerson.patient.reference ?? '') === patient.id
  );
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

type MightHaveTelecom = RelatedPerson | Patient | Person | Practitioner;
export const getSMSNumberForIndividual = (individual: MightHaveTelecom): string | undefined => {
  const { telecom } = individual;
  return (telecom ?? []).find((cp) => {
    // format starts with +1; this is some lazy but probably good enough validation
    return cp.system === 'sms' && cp.value?.startsWith('+');
  })?.value;
};

export const getPhoneNumberForIndividual = (individual: MightHaveTelecom): string | undefined => {
  const { telecom } = individual;
  return (telecom ?? []).find((cp) => {
    // format starts with +1; this is some lazy but probably good enough validation
    return cp.system === 'phone' && cp.value;
  })?.value;
};

export const getWorkPhoneNumberForIndividual = (individual: MightHaveTelecom): string | undefined => {
  const { telecom } = individual;
  return (telecom ?? []).find((cp) => {
    return cp.system === 'phone' && cp.use === 'work';
  })?.value;
};

export const getEmailForIndividual = (individual: MightHaveTelecom): string | undefined => {
  const { telecom } = individual;
  return (telecom ?? []).find((cp) => {
    return cp.system === 'email';
  })?.value;
};

export const getWorkEmailForIndividual = (individual: MightHaveTelecom): string | undefined => {
  const { telecom } = individual;
  return (telecom ?? []).find((cp) => {
    return cp.system === 'email' && cp.use === 'work';
  })?.value;
};

export const getAddressForIndividual = (individual: MightHaveTelecom): Address | undefined => {
  const { address } = individual;
  return (address ?? []).find((address) => {
    // format starts with +1; this is some lazy but probably good enough validation
    return !address.period?.end;
  });
};

export interface PatientContact {
  relationship?: CodeableConcept[];
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  period?: Period;
  organization?: Reference;
}
export const getBillingContactFromPatient = (patient: Patient): PatientContact | undefined => {
  return patient?.contact?.find((pc) => {
    if (pc.period?.end !== undefined) {
      return false;
    }
    return (
      pc.relationship?.some((rel) => {
        return (
          rel.coding?.some((coded) => {
            return coded.code === 'BP' && coded.system === 'http://terminology.hl7.org/CodeSystem/v2-013';
          }) ?? false
        );
      }) ?? false
    );
  });
};

export function getSuffix(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0]?.suffix?.[0];
}

export const getFullestAvailableName = (
  individual: Patient | Practitioner | RelatedPerson | Person,
  lastFirst?: boolean
): string | undefined => {
  const firstName = getFirstName(individual);
  const lastName = getLastName(individual);
  // const suffix = getSuffix(individual);
  if (firstName && lastName) {
    // return lastFirst
    //   ? `${lastName}${suffix ? ` ${suffix}` : ''}, ${firstName}`
    //   : `${firstName} ${lastName}${suffix ? ` ${suffix}` : ''}`;
    return lastFirst ? `${lastName}, ${firstName}` : `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  }
  return undefined;
};

export const getWeightForPatient = (patient?: Patient): string | undefined => {
  if (!patient) return;
  return patient.extension?.find((ext) => {
    return ext.url.replace('http:', 'https:') === FHIR_EXTENSION.Patient.weight.url;
  })?.valueString;
};

export const getPatientAddress = (
  address?: Patient['address']
): {
  city?: string;
  country?: string;
  addressLine?: string;
  addressLine2?: string;
  postalCode?: string;
  state?: string;
  cityStateZIP?: string;
  zipStateCityLine?: string;
} => {
  const city = address?.[0]?.city;
  const country = address?.[0]?.city;
  const addressLine = address?.[0]?.line?.[0];
  const addressLine2 = address?.[0]?.line?.[1];
  const postalCode = address?.[0]?.postalCode;
  const state = address?.[0]?.state;

  const cityStateZIP = [city, state, postalCode].filter((value) => !!value).join(', ');
  const zipStateCityLine = [postalCode, state, city, addressLine].filter((value) => !!value).join(', ');

  return {
    city,
    country,
    addressLine,
    addressLine2,
    postalCode,
    state,
    cityStateZIP,
    zipStateCityLine,
  };
};

export const relatedPersonAndCommunicationMaps = async (
  oystehr: Oystehr,
  inputResources: Resource[]
): Promise<RelatedPersonMaps> => {
  const allRelatedPersons = filterResources(inputResources, 'RelatedPerson') as RelatedPerson[];
  const rpsPhoneNumbers = getUniquePhonesNumbers(allRelatedPersons);
  const rpsToPatientIdMap = mapRelatedPersonToPatientId(allRelatedPersons);
  const rpToIdMap = mapRelatedPersonToId(allRelatedPersons);
  const foundResources = await getCommunicationsAndSenders(oystehr, rpsPhoneNumbers);
  const foundRelatedPersons = filterResources(foundResources, 'RelatedPerson') as RelatedPerson[];
  Object.assign(rpToIdMap, mapRelatedPersonToId(foundRelatedPersons));
  rpsPhoneNumbers.concat(getUniquePhonesNumbers(foundRelatedPersons)); // do better here
  const rpsRefsToPhoneNumberMap = mapRelatedPersonsRefsToPhoneNumber(foundRelatedPersons);

  const foundCommunications = filterResources(foundResources, 'Communication') as Communication[];
  const commsToRpRefMap = mapCommunicationsToRelatedPersonRef(foundCommunications, rpToIdMap, rpsRefsToPhoneNumberMap);

  return {
    rpsToPatientIdMap,
    commsToRpRefMap,
  };
};

function mapRelatedPersonToPatientId(allRps: RelatedPerson[]): Record<string, RelatedPerson[]> {
  const rpsToPatientIdMap: Record<string, RelatedPerson[]> = {};

  allRps.forEach((rp) => {
    const patientId = removePrefix('Patient/', rp.patient.reference || '');
    if (patientId) {
      if (rpsToPatientIdMap[patientId]) rpsToPatientIdMap[patientId].push(rp);
      else rpsToPatientIdMap[patientId] = [rp];
    }
  });

  return rpsToPatientIdMap;
}

function mapRelatedPersonToId(allRps: RelatedPerson[]): Record<string, RelatedPerson> {
  const rpToIdMap: Record<string, RelatedPerson> = {};

  allRps.forEach((rp) => {
    rpToIdMap['RelatedPerson/' + rp.id] = rp;
  });

  return rpToIdMap;
}

function mapRelatedPersonsRefsToPhoneNumber(allRps: RelatedPerson[]): Record<string, string[]> {
  const relatedPersonRefToPhoneNumber: Record<string, string[]> = {};

  allRps.forEach((rp) => {
    const rpRef = `RelatedPerson/${rp.id}`;
    const pn = getSMSNumberForIndividual(rp as RelatedPerson);
    if (pn) {
      if (relatedPersonRefToPhoneNumber[pn]) relatedPersonRefToPhoneNumber[pn].push(rpRef);
      else relatedPersonRefToPhoneNumber[pn] = [rpRef];
    }
  });
  return relatedPersonRefToPhoneNumber;
}

function mapCommunicationsToRelatedPersonRef(
  allCommunications: Communication[],
  rpToIdMap: Record<string, RelatedPerson>,
  rpsRefsToPhoneNumberMap: Record<string, string[]>
): Record<string, Communication[]> {
  const commsToRpRefMap: Record<string, Communication[]> = {};

  allCommunications.forEach((comm) => {
    const communication = comm as Communication;
    const rpRef = communication.sender?.reference;
    if (rpRef) {
      const senderResource = rpToIdMap[rpRef];
      if (senderResource) {
        const smsNumber = getSMSNumberForIndividual(senderResource);
        if (smsNumber) {
          const allRPsWithThisNumber = rpsRefsToPhoneNumberMap[smsNumber];
          allRPsWithThisNumber.forEach((rpRef) => {
            if (commsToRpRefMap[rpRef]) commsToRpRefMap[rpRef].push(communication);
            else commsToRpRefMap[rpRef] = [communication];
          });
        }
      }
    }
  });

  return commsToRpRefMap;
}

export const getProviderNotificationSettingsForPractitioner = (
  practitioner?: Practitioner
): ProviderNotificationSettings | undefined => {
  if (!practitioner) return undefined;
  const notifyExtension = practitioner?.extension?.find(
    (extension) => extension.url === PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL
  );
  const notifValue = notifyExtension?.extension?.find((extension) => extension.url === PROVIDER_NOTIFICATION_METHOD_URL)
    ?.valueString as ProviderNotificationMethod;
  const notificationsEnabled =
    notifyExtension?.extension?.find((extension) => extension.url === PROVIDER_NOTIFICATIONS_ENABLED_URL)
      ?.valueBoolean === true;
  return {
    enabled: notificationsEnabled,
    method: notifValue,
  };
};

export const checkEncounterHasPractitioner = (encounter: Encounter, practitioner: Practitioner): boolean => {
  const practitionerId = practitioner?.id;

  const encounterPractitioner = encounter.participant?.find(
    (item) => item.individual?.reference?.startsWith('Practitioner/')
  )?.individual?.reference;
  const encounterPractitionerId = encounterPractitioner && removePrefix('Practitioner/', encounterPractitioner);

  return !!practitioner && !!encounterPractitioner && practitionerId === encounterPractitionerId;
};

export const getPractitionerNPIIdentitifier = (practitioner: Practitioner): Identifier | undefined => {
  return practitioner.identifier?.find((existIdentifier) => existIdentifier.system === FHIR_IDENTIFIER_NPI);
};

export const getPatientFormUser = (patient: Patient | undefined): 'Parent' | 'Self' | undefined => {
  const formUser = patient?.extension?.find((ext) => {
    return ext.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/form-user';
  })?.valueString;

  return formUser === 'Parent/Guardian' ? 'Parent' : 'Self';
};

interface GetContactOptions {
  hasEmail?: boolean | undefined;
}

export const getParentContactForPatient = (
  patient: Patient | undefined,
  options: GetContactOptions | undefined
): PatientContact | undefined => {
  const checkEmail = options?.hasEmail ?? false;
  return patient?.contact?.find((cntct) => {
    const isParent = cntct.relationship?.some((rel) => {
      return rel.coding?.some((coded) => {
        return (
          coded.code === 'Parent/Guardian' &&
          coded.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship'
        );
      });
    });
    if (isParent && checkEmail) {
      return cntct.telecom?.some((obj) => {
        return obj?.system === 'email';
      });
    } else {
      return isParent;
    }
  });
};

export const getContactEmailForPatientAccount = (patient: Patient | undefined): string | undefined => {
  const formUser = getPatientFormUser(patient);

  if (!formUser) {
    return undefined;
  }
  if (formUser === 'Parent') {
    const parentContact = getParentContactForPatient(patient, { hasEmail: true });
    return parentContact?.telecom?.find((obj) => obj?.system === 'email')?.value;
  } else {
    return patient?.telecom?.find((tc) => tc.system === 'email')?.value;
  }
};
