import { Operation } from 'fast-json-patch';
import { CodeableConcept, Coding, Coverage, Extension, Patient, RelatedPerson } from 'fhir/r4b';
import {
  APP_TYPE,
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
} from 'utils';
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
  parentGuardianEmail: 'Patient/contact/0/telecom/0/value',
  parentGuardianPhone: 'Patient/contact/0/telecom/1/value',
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
  responsiblePartyPhone: 'Patient/contact/0/telecom/1/value',
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
  hearingEmpairedRelayService: {
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
  'LA29518-0': {
    display: 'He/Him/His',
    system: 'http://loinc.org',
  },
  'LA29519-8': {
    display: 'She/Her/Her',
    system: 'http://loinc.org',
  },
  'LA29520-6': {
    display: 'They/Them/Their',
    system: 'http://loinc.org',
  },
  'LA29521-4': {
    display: 'My pronouns are not listed',
    system: 'http://loinc.org',
  },
};

const GENDER_IDENTITY_MAPPING = {
  '446151000124109': {
    display: 'Female gender identity',
    system: 'http://snomed.info/sct',
  },
  '446141000124107': {
    display: 'Male gender identity',
    system: 'http://snomed.info/sct',
  },
  '33791000087105': {
    display: 'Non-binary gender identity',
    system: 'http://snomed.info/sct',
  },
};

const SEXUAL_ORIENTATION_MAPPING = {
  '446191000124102': {
    display: 'Straight',
    system: 'http://snomed.info/sct',
  },
  '446161000124108': {
    display: 'Gay or Lesbian',
    system: 'http://snomed.info/sct',
  },
  '446171000124106': {
    display: 'Bisexual',
    system: 'http://snomed.info/sct',
  },
  '446181000124104': {
    display: 'Other sexual orientation',
    system: 'http://snomed.info/sct',
  },
};

const ETHNICITY_MAPPING = {
  '2135-2': {
    display: 'Hispanic or Latino',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Ethnicity',
  },
  '2186-5': {
    display: 'Not Hispanic or Latino',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Ethnicity',
  },
  ASKU: {
    display: 'Decline to Specify',
    system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor',
  },
};

const RACE_MAPPING = {
  '1002-5': {
    display: 'American Indian or Alaska Native',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
  },
  '2028-9': {
    display: 'Asian',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
  },
  '2054-5': {
    display: 'Black or African American',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
  },
  '2076-8': {
    display: 'Native Hawaiian or Other Pacific Islander',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
  },
  '2106-3': {
    display: 'White',
    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
  },
  ASKU: {
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

type AppType = (typeof APP_TYPE)[keyof typeof APP_TYPE];
type ExtensionType = 'pronouns' | 'genderIdentity' | 'sexualOrientation' | 'ethnicity' | 'race';

export const APP_DISPLAY_MAPPINGS: Record<AppType, Record<ExtensionType, Record<string, string>>> = {
  [APP_TYPE.QRS]: {
    pronouns: {
      'LA29518-0': 'He/him',
      'LA29519-8': 'She/her',
      'LA29520-6': 'They/them',
      'LA29521-4': 'My pronouns are not listed',
    },
    genderIdentity: {
      '446151000124109': 'Female',
      '446141000124107': 'Male',
      '33791000087105': 'Non-binary',
    },
    sexualOrientation: {
      '446191000124102': 'Straight',
      '446161000124108': 'Gay or Lesbian',
      '446171000124106': 'Bisexual',
      '446181000124104': 'Other',
    },
    ethnicity: {
      '2135-2': 'Hispanic or Latino',
      '2186-5': 'Not Hispanic or Latino',
      ASKU: 'Decline to Specify',
    },
    race: {
      '1002-5': 'American Indian or Alaska Native',
      '2028-9': 'Asian',
      '2054-5': 'Black or African American',
      '2076-8': 'Native Hawaiian or Other Pacific Islander',
      '2106-3': 'White',
      ASKU: 'Decline to Specify',
    },
  },
  [APP_TYPE.EHR]: {
    pronouns: {
      'LA29518-0': 'He/Him/His',
      'LA29519-8': 'She/Her/Her',
      'LA29520-6': 'They/Them/Their',
      'LA29521-4': 'My pronouns are not listed',
    },
    genderIdentity: {
      '446151000124109': 'Female gender identity',
      '446141000124107': 'Male gender identity',
      '33791000087105': 'Non-binary gender identity',
    },
    sexualOrientation: {
      '446191000124102': 'Straight',
      '446161000124108': 'Gay or Lesbian',
      '446171000124106': 'Bisexual',
      '446181000124104': 'Other sexual orientation',
    },
    ethnicity: {
      '2135-2': 'Hispanic or Latino',
      '2186-5': 'Not Hispanic or Latino',
      ASKU: 'Decline to Specify',
    },
    race: {
      '1002-5': 'American Indian or Alaska Native',
      '2028-9': 'Asian',
      '2054-5': 'Black or African American',
      '2076-8': 'Native Hawaiian or Other Pacific Islander',
      '2106-3': 'White',
      ASKU: 'Decline to Specify',
    },
  },
};

const URL_TO_EXTENSION_TYPE: Record<string, ExtensionType> = {
  [PATIENT_INDIVIDUAL_PRONOUNS_URL]: 'pronouns',
  [PATIENT_GENDER_IDENTITY_URL]: 'genderIdentity',
  [PATIENT_SEXUAL_ORIENTATION_URL]: 'sexualOrientation',
  [PATIENT_RACE_URL]: 'race',
  [PATIENT_ETHNICITY_URL]: 'ethnicity',
} as const;

export function getDisplayValue(code: string, appType: AppType, type: ExtensionType): string {
  return (
    APP_DISPLAY_MAPPINGS[appType][type][code as keyof (typeof APP_DISPLAY_MAPPINGS)[typeof appType][typeof type]] ||
    code
  );
}

export function getCodeFromDisplay(display: string, appType: AppType, type: ExtensionType): string {
  const mappings = APP_DISPLAY_MAPPINGS[appType][type];
  return Object.entries(mappings).find(([_, value]) => value === display)?.[0] || display;
}

export function getPatchOperationToAddOrUpdateExtension(
  appType: AppType = APP_TYPE.QRS,
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
      const extensionType = URL_TO_EXTENSION_TYPE[extension.url];
      const mapping = CODEABLE_CONCEPT_MAPPINGS[extension.url as keyof typeof CODEABLE_CONCEPT_MAPPINGS];
      if (mapping) {
        const code = getCodeFromDisplay(extension.value, appType, extensionType);
        extensionValue = {
          valueCodeableConcept: {
            coding: [
              {
                system: (mapping[code as keyof typeof mapping] as Coding)?.system,
                code,
                display: (mapping[code as keyof typeof mapping] as Coding)?.display,
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
