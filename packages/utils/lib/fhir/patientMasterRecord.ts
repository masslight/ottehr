import { Operation } from 'fast-json-patch';
import { CodeableConcept, Coding, Coverage, Extension, Patient, RelatedPerson } from 'fhir/r4b';
import {
  COVERAGE_ADDITIONAL_INFORMATION_URL,
  PATIENT_COMMON_WELL_CONSENT_URL,
  PATIENT_DECEASED_NOTE_URL,
  PATIENT_ETHNICITY_URL,
  PATIENT_FILLING_OUT_AS_URL,
  PATIENT_GENDER_IDENTITY_DETAILS_URL,
  PATIENT_GENDER_IDENTITY_URL,
  PATIENT_HEARING_IMPAIRED_RELAY_SERVICE_URL,
  PATIENT_INDIVIDUAL_PRONOUNS_CUSTOM_URL,
  PATIENT_INDIVIDUAL_PRONOUNS_URL,
  PATIENT_POINT_OF_DISCOVERY_URL,
  PATIENT_RACE_URL,
  PATIENT_RELEASE_OF_INFO_URL,
  PATIENT_RX_HISTORY_CONSENT_STATUS_URL,
  PATIENT_SEND_MARKETING_URL,
  PATIENT_SEXUAL_ORIENTATION_URL,
  PRACTICE_NAME_URL,
  RELATED_PERSON_SAME_AS_PATIENT_ADDRESS_URL,
} from '../types/constants';
import { extractExtensionValue } from './helpers';

export type PatientMasterRecordResource = Patient | RelatedPerson | Coverage;

export const ResourceTypeNames = {
  patient: 'Patient',
  coverage: 'Coverage',
  relatedPerson: 'RelatedPerson',
};

export type PatientMasterRecordResourceType = (typeof ResourceTypeNames)[keyof typeof ResourceTypeNames];

export const patientFieldPaths = {
  firstName: 'Patient/name/0/given/0',
  middleName: 'Patient/name/0/given/1',
  lastName: 'Patient/name/0/family',
  suffix: 'Patient/name/0/suffix/0',
  preferredName: 'Patient/name/1/given/0',
  birthDate: 'Patient/birthDate',
  preferredPronouns: `Patient/extension/${PATIENT_INDIVIDUAL_PRONOUNS_URL}`,
  preferredPronounsCustom: `Patient/extension/${PATIENT_INDIVIDUAL_PRONOUNS_CUSTOM_URL}`,
  gender: 'Patient/gender',
  phone: 'Patient/telecom/0/value',
  email: 'Patient/telecom/1/value',
  pcpFirstName: 'Patient/contained/0/name/0/given/0',
  pcpLastName: 'Patient/contained/0/name/0/family',
  pcpPhone: 'Patient/contained/0/telecom/0/value',
  pcpStreetAddress: 'Patient/contained/0/address/0/line/0',
  practiceName: `Patient/contained/0/extension/${PRACTICE_NAME_URL}`,
  pcpActive: 'Patient/contained/0/active',
  streetAddress: 'Patient/address/0/line/0',
  streetAddressLine2: 'Patient/address/0/line/1',
  city: 'Patient/address/0/city',
  state: 'Patient/address/0/state',
  zip: 'Patient/address/0/postalCode',
  fillingOutAs: `Patient/extension/${PATIENT_FILLING_OUT_AS_URL}`,
  parentGuardianPhone: 'Patient/contact/0/telecom/0/value',
  parentGuardianEmail: 'Patient/contact/0/telecom/1/value',
  preferredLanguage: 'Patient/communication/0',
  race: `Patient/extension/${PATIENT_RACE_URL}`,
  ethnicity: `Patient/extension/${PATIENT_ETHNICITY_URL}`,
  sexualOrientation: `Patient/extension/${PATIENT_SEXUAL_ORIENTATION_URL}`,
  pointOfDiscovery: `Patient/extension/${PATIENT_POINT_OF_DISCOVERY_URL}`,
  sendMarketing: `Patient/extension/${PATIENT_SEND_MARKETING_URL}`,
  hearingImpairedRelayService: `Patient/extension/${PATIENT_HEARING_IMPAIRED_RELAY_SERVICE_URL}`,
  commonWellConsent: `Patient/extension/${PATIENT_COMMON_WELL_CONSENT_URL}`,
  genderIdentity: `Patient/extension/${PATIENT_GENDER_IDENTITY_URL}`,
  genderIdentityDetails: `Patient/extension/${PATIENT_GENDER_IDENTITY_DETAILS_URL}`,
  responsiblePartyRelationship: 'Patient/contact/0/relationship/0/coding/0/display',
  responsiblePartyName: 'Patient/contact/0/name',
  responsiblePartyFirstName: 'Patient/contact/0/name/given/0',
  responsiblePartyLastName: 'Patient/contact/0/name/family',
  responsiblePartyGender: 'Patient/contact/0/gender',
  responsiblePartyBirthDate: 'Patient/contact/0/extension/0/valueString',
  responsiblePartyPhone: 'Patient/contact/0/telecom/0/value',
  releaseOfInfo: `Patient/extension/${PATIENT_RELEASE_OF_INFO_URL}`,
  rxHistoryConsentStatus: `Patient/extension/${PATIENT_RX_HISTORY_CONSENT_STATUS_URL}`,
  active: 'Patient/active',
  deceased: 'Patient/deceasedBoolean',
  deceasedDate: 'Patient/deceasedDateTime',
  deceasedNote: `Patient/extension/${PATIENT_DECEASED_NOTE_URL}`,
};

export const coverageFieldPaths = {
  memberId: 'Coverage/identifier/0/value',
  carrier: 'Coverage/class/0/name',
  payerId: 'Coverage/class/0/value',
  payor: 'Coverage/payor/0',
  order: 'Coverage/order',
  additionalInformation: `Coverage/extension/${COVERAGE_ADDITIONAL_INFORMATION_URL}`,
  relationship: 'Coverage/relationship/coding/0/display',
  status: 'Coverage/status',
};

export const relatedPersonFieldPaths = {
  firstName: 'RelatedPerson/name/0/given/0',
  middleName: 'RelatedPerson/name/0/given/1',
  lastName: 'RelatedPerson/name/0/family',
  gender: 'RelatedPerson/gender',
  streetAddress: 'RelatedPerson/address/0/line/0',
  addressLine2: 'RelatedPerson/address/0/line/1',
  city: 'RelatedPerson/address/0/city',
  state: 'RelatedPerson/address/0/state',
  zip: 'RelatedPerson/address/0/postalCode',
  relationship: 'RelatedPerson/relationship/0/coding/0/display',
  birthDate: 'RelatedPerson/birthDate',
  sameAsPatientAddress: `RelatedPerson/extension/${RELATED_PERSON_SAME_AS_PATIENT_ADDRESS_URL}`,
};

interface ExtensionConfig extends Extension {
  valueType: 'valueString' | 'valueBoolean' | 'valueCodeableConcept' | 'valueDateTime';
}

const EXTENSION_CONFIGS: Record<string, ExtensionConfig> = {
  preferredPronouns: {
    url: PATIENT_INDIVIDUAL_PRONOUNS_URL,
    valueType: 'valueCodeableConcept',
  },
  preferredPronounsCustom: {
    url: PATIENT_INDIVIDUAL_PRONOUNS_CUSTOM_URL,
    valueType: 'valueString',
  },
  sexualOrientation: {
    url: PATIENT_SEXUAL_ORIENTATION_URL,
    valueType: 'valueCodeableConcept',
  },
  ethnicity: {
    url: PATIENT_ETHNICITY_URL,
    valueType: 'valueCodeableConcept',
  },
  race: {
    url: PATIENT_RACE_URL,
    valueType: 'valueCodeableConcept',
  },
  fillingOutAs: {
    url: PATIENT_FILLING_OUT_AS_URL,
    valueType: 'valueString',
  },
  genderIdentity: {
    url: PATIENT_GENDER_IDENTITY_URL,
    valueType: 'valueCodeableConcept',
  },
  genderIdentityDetails: {
    url: PATIENT_GENDER_IDENTITY_DETAILS_URL,
    valueType: 'valueString',
  },
  pointOfDiscovery: {
    url: PATIENT_POINT_OF_DISCOVERY_URL,
    valueType: 'valueString',
  },
  sendMarketing: {
    url: PATIENT_SEND_MARKETING_URL,
    valueType: 'valueBoolean',
  },
  hearingImpairedRelayService: {
    url: PATIENT_HEARING_IMPAIRED_RELAY_SERVICE_URL,
    valueType: 'valueBoolean',
  },
  commonWellConsent: {
    url: PATIENT_COMMON_WELL_CONSENT_URL,
    valueType: 'valueBoolean',
  },
  deceasedNote: {
    url: PATIENT_DECEASED_NOTE_URL,
    valueType: 'valueString',
  },
  additionalInsuranceInformation: {
    url: COVERAGE_ADDITIONAL_INFORMATION_URL,
    valueType: 'valueString',
  },
  sameAsPatientAddress: {
    url: RELATED_PERSON_SAME_AS_PATIENT_ADDRESS_URL,
    valueType: 'valueBoolean',
  },
  releaseOfInfo: {
    url: PATIENT_RELEASE_OF_INFO_URL,
    valueType: 'valueBoolean',
  },
  rxHistoryConsentStatus: {
    url: PATIENT_RX_HISTORY_CONSENT_STATUS_URL,
    valueType: 'valueString',
  },
};

const PRONOUNS_MAPPING = {
  'He/him': {
    code: 'LA29518-0',
    display: 'He/him',
    system: 'http://loinc.org',
  },
  'She/her': {
    code: 'LA29519-8',
    display: 'She/her',
    system: 'http://loinc.org',
  },
  'They/them': {
    code: 'LA29520-6',
    display: 'They/them',
    system: 'http://loinc.org',
  },
  'My pronouns are not listed': {
    code: 'LA29521-4',
    display: 'My pronouns are not listed',
    system: 'http://loinc.org',
  },
};

const GENDER_IDENTITY_MAPPING = {
  'Female gender identity': {
    code: '446151000124109',
    display: 'Female gender identity',
    system: 'http://snomed.info/sct',
  },
  'Male gender identity': {
    code: '446141000124107',
    display: 'Male gender identity',
    system: 'http://snomed.info/sct',
  },
  'Non-binary gender identity': {
    code: '33791000087105',
    display: 'Non-binary gender identity',
    system: 'http://snomed.info/sct',
  },
};

const SEXUAL_ORIENTATION_MAPPING = {
  Straight: {
    code: '446191000124102',
    display: 'Straight',
    system: 'http://snomed.info/sct',
  },
  'Lesbian or Gay': {
    code: '446161000124108',
    display: 'Lesbian or Gay',
    system: 'http://snomed.info/sct',
  },
  Bisexual: {
    code: '446171000124106',
    display: 'Bisexual',
    system: 'http://snomed.info/sct',
  },
  'Something else': {
    code: '446181000124104',
    display: 'Something else',
    system: 'http://snomed.info/sct',
  },
  'Decline to Specify': {
    code: 'ASKU',
    display: 'Decline to Specify',
    system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor',
  },
};

const ETHNICITY_MAPPING = {
  'Hispanic or Latino': {
    code: '2135-2',
    display: 'Hispanic or Latino',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Ethnicity',
  },
  'Not Hispanic or Latino': {
    code: '2186-5',
    display: 'Not Hispanic or Latino',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Ethnicity',
  },
  'Decline to Specify': {
    code: 'ASKU',
    display: 'Decline to Specify',
    system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor',
  },
};

const RACE_MAPPING = {
  'American Indian or Alaska Native': {
    code: '1002-5',
    display: 'American Indian or Alaska Native',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
  },
  Asian: {
    code: '2028-9',
    display: 'Asian',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
  },
  'Black or African American': {
    code: '2054-5',
    display: 'Black or African American',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
  },
  'Native Hawaiian or Other Pacific Islander': {
    code: '2076-8',
    display: 'Native Hawaiian or Other Pacific Islander',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
  },
  White: {
    code: '2106-3',
    display: 'White',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
  },
  'Decline to Specify': {
    code: 'ASKU',
    display: 'Decline to Specify',
    system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor',
  },
};

const CODEABLE_CONCEPT_MAPPINGS = {
  [PATIENT_INDIVIDUAL_PRONOUNS_URL]: PRONOUNS_MAPPING,
  [PATIENT_GENDER_IDENTITY_URL]: GENDER_IDENTITY_MAPPING,
  [PATIENT_SEXUAL_ORIENTATION_URL]: SEXUAL_ORIENTATION_MAPPING,
  [PATIENT_RACE_URL]: RACE_MAPPING,
  [PATIENT_ETHNICITY_URL]: ETHNICITY_MAPPING,
};

export function getPatchOperationToAddOrUpdateExtension(
  resource: PatientMasterRecordResource,
  extension: {
    url: string;
    value: string;
    valueType?: string;
  },
  currentValue?: any
): Operation {
  const config = Object.values(EXTENSION_CONFIGS).find((config) => config.url === extension.url);
  if (!config) return {} as Operation;

  let extensionValue;
  switch (config.valueType) {
    case 'valueCodeableConcept': {
      const mapping = CODEABLE_CONCEPT_MAPPINGS[extension.url as keyof typeof CODEABLE_CONCEPT_MAPPINGS];
      if (mapping) {
        const valueMapping = mapping[extension.value as keyof typeof mapping] as Coding;
        extensionValue = {
          valueCodeableConcept: {
            coding: [
              {
                system: valueMapping?.system,
                code: valueMapping?.code,
                display: valueMapping?.display,
              },
            ],
          },
        };
      }
      break;
    }
    case 'valueBoolean':
      extensionValue = {
        valueBoolean: extension.value === 'true',
      };
      break;

    case 'valueDateTime':
      extensionValue = {
        valueDateTime: extension.value,
      };
      break;

    case 'valueString':
    default:
      extensionValue = {
        valueString: extension.value,
      };
      break;
  }

  const existingExtensionIndex = resource.extension?.findIndex((ext) => ext.url === extension.url);

  if (currentValue !== undefined && existingExtensionIndex !== undefined && existingExtensionIndex >= 0) {
    return {
      op: 'replace',
      path: `/extension/${existingExtensionIndex}`,
      value: {
        url: extension.url,
        ...extensionValue,
      },
    };
  }

  return {
    op: 'add',
    path: '/extension/-',
    value: {
      url: extension.url,
      ...extensionValue,
    },
  };
}

export function getCurrentValue(
  resource: PatientMasterRecordResource,
  path: string
): string | boolean | number | undefined {
  if (path.startsWith('/extension/')) {
    const extensionUrl = path.replace('/extension/', '');
    // Handle numeric extension path (e.g., '/extension/0')
    if (!isNaN(Number(extensionUrl))) {
      const extension = resource.extension?.[Number(extensionUrl)];
      return extension ? extractExtensionValue(extension) : undefined;
    }
    const extension = resource.extension?.find((ext) => ext.url === extensionUrl);

    if (!extension) return undefined;

    return extractExtensionValue(extension);
  }

  const parts = path.split('/').filter(Boolean); // filter removes empty strings from leading '/'
  let current: any = resource;

  for (const part of parts) {
    if (!isNaN(Number(part))) {
      current = current?.[Number(part)];
    } else {
      current = current?.[part];
    }

    if (current === undefined) return undefined;
  }

  return current;
}

export const LANGUAGE_OPTIONS = {
  English: 'English',
  Spanish: 'Spanish',
} as const;

export type LanguageOption = keyof typeof LANGUAGE_OPTIONS;

const LANGUAGE_MAPPING: Record<LanguageOption, Coding> = {
  [LANGUAGE_OPTIONS.English]: {
    code: 'en',
    display: 'English',
    system: 'urn:ietf:bcp:47',
  },
  [LANGUAGE_OPTIONS.Spanish]: {
    code: 'es',
    display: 'Spanish',
    system: 'urn:ietf:bcp:47',
  },
};

interface LanguageCommunication {
  language: CodeableConcept;
  preferred: boolean;
}

function getLanguageCommunication(value: LanguageOption, preferred = true): LanguageCommunication {
  const mapping = LANGUAGE_MAPPING[value];

  return {
    language: {
      coding: [
        {
          system: mapping.system,
          code: mapping.code,
          display: mapping.display,
        },
      ],
    },
    preferred,
  };
}

export function getPatchOperationToAddOrUpdatePreferredLanguage(
  value: LanguageOption,
  path: string,
  patient: Patient,
  currentValue?: LanguageOption
): Operation {
  const communication = getLanguageCommunication(value);
  if (currentValue) {
    return {
      op: 'replace',
      path: path,
      value: communication,
    };
  } else {
    if (patient.communication) {
      return {
        op: 'add',
        path: '/communication/-',
        value: communication,
      };
    } else {
      return {
        op: 'add',
        path: '/communication',
        value: communication,
      };
    }
  }
}

export const getPatchOperationToRemovePreferredLanguage = (patient: Patient): Operation | undefined => {
  if (!patient.communication || patient.communication.length === 0) {
    return undefined;
  }

  const communication = patient.communication;

  const existingPreferredLanguageIndex = communication.findIndex((language) => language.preferred === true);

  if (existingPreferredLanguageIndex < 0) {
    return undefined;
  }

  if (communication.length > 1) {
    return {
      op: 'remove',
      path: `/communication/${existingPreferredLanguageIndex}`,
    };
  } else {
    return {
      op: 'remove',
      path: '/communication',
    };
  }
};

export function getPatchOperationToAddOrUpdatePreferredName(
  path: string,
  currentValue: string,
  value?: string
): Operation | undefined {
  if (value === undefined) {
    if (currentValue !== undefined && currentValue !== null) {
      return {
        op: 'remove',
        path: path.replace('/given/0', ''),
      };
    }
    return undefined;
  } else {
    if (currentValue !== undefined) {
      return { op: 'replace', path, value };
    } else {
      const preferredNameItem = { given: [value], use: 'nickname' };
      return {
        op: 'add',
        path: '/name/-',
        value: preferredNameItem,
      };
    }
  }
}

export const RELATIONSHIP_OPTIONS = {
  Self: 'Self',
  'Legal Guardian': 'Legal Guardian',
  Father: 'Father',
  Mother: 'Mother',
  Spouse: 'Spouse',
  Parent: 'Parent',
  Other: 'Other',
} as const;

export type RelationshipOption = keyof typeof RELATIONSHIP_OPTIONS;

const RELATIONSHIP_MAPPING: Record<RelationshipOption, Coding> = {
  [RELATIONSHIP_OPTIONS.Self]: {
    code: 'SELF',
    display: 'Self',
    system: 'http://hl7.org/fhir/relationship',
  },
  [RELATIONSHIP_OPTIONS['Legal Guardian']]: {
    code: 'GUARD',
    display: 'Legal Guardian',
    system: 'http://hl7.org/fhir/relationship',
  },
  [RELATIONSHIP_OPTIONS.Father]: {
    code: 'FTH',
    display: 'Father',
    system: 'http://hl7.org/fhir/relationship',
  },
  [RELATIONSHIP_OPTIONS.Mother]: {
    code: 'MTH',
    display: 'Mother',
    system: 'http://hl7.org/fhir/relationship',
  },
  [RELATIONSHIP_OPTIONS.Spouse]: {
    code: 'SPO',
    display: 'Spouse',
    system: 'http://hl7.org/fhir/relationship',
  },
  [RELATIONSHIP_OPTIONS.Parent]: {
    code: 'PRN',
    display: 'Parent',
    system: 'http://hl7.org/fhir/relationship',
  },
  [RELATIONSHIP_OPTIONS.Other]: {
    code: 'OTH',
    display: 'Other',
    system: 'http://hl7.org/fhir/relationship',
  },
};

function getResponsiblePartyRelationship(value: RelationshipOption): CodeableConcept[] {
  const mapping = RELATIONSHIP_MAPPING[value];

  return [
    {
      coding: [
        {
          system: mapping.system,
          code: mapping.code,
          display: mapping.display,
        },
      ],
    },
    {
      coding: [
        {
          code: 'BP',
          system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
        },
      ],
    },
  ];
}

export function getPatchOperationToAddOrUpdateResponsiblePartyRelationship(
  value: RelationshipOption,
  path: string,
  currentValue?: RelationshipOption
): Operation {
  const relationship = getResponsiblePartyRelationship(value);
  if (currentValue) {
    return {
      op: 'replace',
      path,
      value,
    };
  } else {
    return {
      op: 'add',
      path: path.replace(/(\/contact\/\d+\/relationship).*/, '$1'),
      value: relationship,
    };
  }
}
