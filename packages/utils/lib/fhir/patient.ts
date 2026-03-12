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
  Organization,
  Patient,
  Period,
  Person,
  Practitioner,
  Reference,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import { removePrefix } from '../helpers';
import {
  ORG_TYPE_CODE_SYSTEM,
  PATIENT_INDIVIDUAL_PRONOUNS_URL,
  PatientInfo,
  PROVIDER_NOTIFICATION_METHOD_URL,
  PROVIDER_NOTIFICATIONS_ENABLED_URL,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
  PROVIDER_TASK_NOTIFICATIONS_ENABLED_URL,
  PROVIDER_TELEMED_NOTIFICATIONS_ENABLED_URL,
  ProviderNotificationMethod,
  ProviderNotificationSettings,
  RelatedPersonMaps,
} from '../types';
import {
  FHIR_EXTENSION,
  FHIR_IDENTIFIER_NPI,
  FHIR_IDENTIFIER_SYSTEM,
  filterResources,
  getAllPractitionerCredentials,
  getCommunicationsAndSenders,
  getUniquePhonesNumbers,
  PRIVATE_EXTENSION_BASE_URL,
} from '.';

// Return true if a new user
export async function createUserResourcesForPatient(
  oystehr: Oystehr,
  patientID: string,
  phoneNumber: string
): Promise<{ relatedPerson: RelatedPerson; person: Person; newUser: boolean }> {
  let newUser = false;

  console.log(`[UserCreate] Start for patient=${patientID} phone=${phoneNumber}`);

  let person: Person | undefined;

  const findPerson = async (): Promise<Person[]> =>
    (
      await oystehr.fhir.search<Person>({
        resourceType: 'Person',
        params: [{ name: 'telecom', value: phoneNumber }],
      })
    ).unbundle();

  let personResults = await findPerson();

  if (personResults.length > 0) {
    person = personResults[0];
    console.log(`[UserCreate] Found existing Person ${person.id}`);
  } else {
    try {
      console.log(`[UserCreate] Creating Person for phone=${phoneNumber}`);

      person = (await oystehr.fhir.create({
        resourceType: 'Person',
        telecom: [{ system: 'phone', value: phoneNumber }],
      })) as Person;

      newUser = true;
      console.log(`[UserCreate] Created Person ${person.id}`);
    } catch (e) {
      console.log(`[UserCreate] Person create failed, retrying search`);

      personResults = await findPerson();

      if (personResults.length === 0) {
        throw e;
      }

      person = personResults[0];
      console.log(`[UserCreate] Person resolved after race ${person.id}`);
    }
  }

  if (!person) {
    throw new Error('Failed to resolve Person');
  }

  let resolvedPerson: Person = person;

  let relatedPerson: RelatedPerson | undefined;

  const findRelated = async (): Promise<RelatedPerson[]> =>
    (
      await oystehr.fhir.search<RelatedPerson>({
        resourceType: 'RelatedPerson',
        params: [
          { name: 'patient', value: `Patient/${patientID}` },
          { name: 'telecom', value: phoneNumber },
        ],
      })
    ).unbundle();

  let relatedResults = await findRelated();

  if (relatedResults.length > 0) {
    relatedPerson = relatedResults[0];
    console.log(`[UserCreate] Found existing RelatedPerson ${relatedPerson.id}`);
  } else {
    try {
      console.log(`[UserCreate] Creating RelatedPerson for patient=${patientID}`);

      relatedPerson = (await oystehr.fhir.create({
        resourceType: 'RelatedPerson',
        patient: { reference: `Patient/${patientID}` },
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
      })) as RelatedPerson;

      console.log(`[UserCreate] Created RelatedPerson ${relatedPerson.id}`);
    } catch (e) {
      console.log(`[UserCreate] RelatedPerson create failed, retrying search`);

      relatedResults = await findRelated();

      if (relatedResults.length === 0) {
        throw e;
      }

      relatedPerson = relatedResults[0];
      console.log(`[UserCreate] RelatedPerson resolved after race ${relatedPerson.id}`);
    }
  }

  if (!relatedPerson) {
    throw new Error('Failed to resolve RelatedPerson');
  }

  const linkReference = `RelatedPerson/${relatedPerson.id}`;

  let retries = 0;

  while (retries < 10) {
    const alreadyLinked = resolvedPerson.link?.some((l) => l.target?.reference === linkReference) ?? false;

    if (alreadyLinked) {
      console.log(`[UserCreate] Link already exists`);
      break;
    }

    try {
      console.log(`[UserCreate] Patching Person ${resolvedPerson.id} with link`);

      await oystehr.fhir.patch(
        {
          resourceType: 'Person',
          id: resolvedPerson.id!,
          operations: [
            {
              op: 'add',
              path: resolvedPerson.link ? '/link/-' : '/link',
              value: resolvedPerson.link
                ? { target: { reference: linkReference } }
                : [{ target: { reference: linkReference } }],
            },
          ],
        },
        { optimisticLockingVersionId: resolvedPerson.meta!.versionId }
      );

      console.log(`[UserCreate] Patch successful`);
      break;
    } catch (e) {
      retries++;
      console.log(`[UserCreate] Patch failed (attempt ${retries}), refreshing Person`);

      resolvedPerson = await oystehr.fhir.get<Person>({
        resourceType: 'Person',
        id: resolvedPerson.id!,
      });

      const nowLinked = resolvedPerson.link?.some((l) => l.target?.reference === linkReference) ?? false;

      if (nowLinked) {
        console.log(`[UserCreate] Link added by concurrent request`);
        break;
      }

      if (retries >= 10) {
        throw e;
      }
    }
  }
  person = resolvedPerson;

  console.log(`[UserCreate] Completed successfully`);

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

export function getNameSuffix(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0]?.suffix?.[0];
}

export function getFullName(individual: Patient | Practitioner | RelatedPerson | Person): string {
  const firstName = getFirstName(individual);
  const middleName = getMiddleName(individual);
  const lastName = getLastName(individual);
  return `${firstName}${middleName ? ` ${middleName}` : ''} ${lastName}`;
}

/**
 * Output format: LastName, FirstName[, MiddleName][ (Nickname)]
 */
export function getFormattedPatientFullName(
  patient: Patient,
  options?: { skipMiddleName?: boolean; skipNickname?: boolean }
): string | undefined {
  const firstName = getFirstName(patient);
  const lastName = getLastName(patient);
  const middleName = getMiddleName(patient);
  const nickname = getNickname(patient);

  if (!firstName && !lastName) {
    return undefined;
  }

  let result: string;

  if (lastName && firstName) {
    result = `${lastName}, ${firstName}`;
  } else {
    result = firstName ?? lastName!;
  }

  if (!options?.skipMiddleName && middleName) {
    result += `, ${middleName}`;
  }

  if (!options?.skipNickname && nickname) {
    result += ` (${nickname})`;
  }

  return result;
}

export function getPatientInfoFullName(patient: PatientInfo): string {
  const { firstName, middleName, lastName } = patient;
  return `${firstName}${middleName ? ` ${middleName}` : ''} ${lastName}`;
}

export function getPatientChosenName(patient: PatientInfo, lowercaseP?: boolean): string {
  // cSpell:disable-next {p|P}atient
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
  let license = undefined;
  if (individual.resourceType === 'Practitioner') {
    // we want to use the credentials here, not licenses/qualifications
    license = getAllPractitionerCredentials(individual).join(', ');
  }
  // const suffix = getSuffix(individual);
  if (firstName && lastName) {
    // return lastFirst
    //   ? `${lastName}${suffix ? ` ${suffix}` : ''}, ${firstName}`
    //   : `${firstName} ${lastName}${suffix ? ` ${suffix}` : ''}`;
    if (lastFirst) {
      return `${lastName}, ${firstName}`;
    }

    if (license) {
      return `${firstName} ${lastName}, ${license}`;
    }
    return `${firstName} ${lastName}`;
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
  const notificationValue = notifyExtension?.extension?.find(
    (extension) => extension.url === PROVIDER_NOTIFICATION_METHOD_URL
  )?.valueString as ProviderNotificationMethod;

  /** @deprecated */
  const notificationsEnabled =
    notifyExtension?.extension?.find((extension) => extension.url === PROVIDER_NOTIFICATIONS_ENABLED_URL)
      ?.valueBoolean === true;
  const taskNotificationsExtension = notifyExtension?.extension?.find(
    (extension) => extension.url === PROVIDER_TASK_NOTIFICATIONS_ENABLED_URL
  );
  const telemedNotificationsExtension = notifyExtension?.extension?.find(
    (extension) => extension.url === PROVIDER_TELEMED_NOTIFICATIONS_ENABLED_URL
  );
  const taskNotificationsEnabled =
    taskNotificationsExtension !== undefined ? taskNotificationsExtension.valueBoolean === true : notificationsEnabled;
  const telemedNotificationsEnabled =
    telemedNotificationsExtension !== undefined
      ? telemedNotificationsExtension.valueBoolean === true
      : notificationsEnabled;

  const phoneNumber = getSMSNumberForIndividual(practitioner);

  return {
    method: notificationValue,
    taskNotificationsEnabled,
    telemedNotificationsEnabled,
    phoneNumber,
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

export const getPractitionerNPIIdentifier = (practitioner: Practitioner): Identifier | undefined => {
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
  return patient?.contact?.find((contact) => {
    const isParent = contact.relationship?.some((rel) => {
      return rel.coding?.some((coded) => {
        return (
          coded.code === 'Parent/Guardian' &&
          coded.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship'
        );
      });
    });
    if (isParent && checkEmail) {
      return contact.telecom?.some((obj) => {
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

export const getPronounsFromExtension = (patient: Patient): string => {
  const pronounsExtension = patient.extension?.find(
    (ext: { url: string }) => ext.url === PATIENT_INDIVIDUAL_PRONOUNS_URL
  );
  if (!pronounsExtension?.valueCodeableConcept?.coding?.[0]) return '';
  return pronounsExtension.valueCodeableConcept.coding[0].display || '';
};

export const getPreferredPharmacyFromPatient = (patient: Patient): Organization | undefined => {
  return patient?.contained?.find((res) => {
    return (
      res.resourceType === 'Organization' &&
      res.type?.some((type) => {
        return type.coding?.some((coding) => {
          return coding.code === 'pharmacy' && coding.system === ORG_TYPE_CODE_SYSTEM;
        });
      })
    );
  }) as Organization | undefined;
};

export const makeSSNIdentifier = (ssn: string): Identifier => {
  return {
    system: 'http://hl7.org/fhir/sid/us-ssn',
    type: {
      coding: [
        {
          system: FHIR_IDENTIFIER_SYSTEM,
          code: 'SS',
        },
      ],
    },
    value: ssn,
  };
};

export const mapGenderToLabel: { [name in Exclude<Patient['gender'], undefined>]: string } = {
  male: 'Male',
  female: 'Female',
  other: 'Intersex',
  unknown: 'Unknown',
};
