import { AdditionalBooleanQuestion, AdditionalBooleanQuestionsFieldsNames } from 'utils';

export const REASON_FOR_VISIT_OPTIONS: string[] = [
  'Cough and/or congestion',
  'Throat pain',
  'Eye concern',
  'Fever',
  'Ear pain',
  'Vomiting and/or diarrhea',
  'Abdominal (belly) pain',
  'Rash or skin issue',
  'Urinary problem',
  'Breathing problem',
  'Injury to arm',
  'Injury to leg',
  'Injury to head',
  'Injury (Other)',
  'Cut to arm or leg',
  'Cut to face or head',
  'Removal of sutures/stitches/staples',
  'Choked or swallowed something',
  'Allergic reaction to medication or food',
  'Other',
];

export const PHONE_NUMBER_REGEX = /^\d{10}$/;
export const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
export const ZIP_REGEX = /^\d{5}$/;

export const MAXIMUM_CHARACTER_LIMIT = 155;

export const HOP_QUEUE_URI = 'hop-queue';

export const CHAT_REFETCH_INTERVAL = 15000;

export const APPOINTMENT_REFRESH_INTERVAL = 15000;

export enum LANGUAGES {
  spanish = 'spanish',
  english = 'english',
}

export const ADDITIONAL_QUESTIONS: AdditionalBooleanQuestion[] = [
  {
    label: 'Do you have any COVID symptoms?',
    field: AdditionalBooleanQuestionsFieldsNames.CovidSymptoms,
  },
  {
    label: 'Have you tested positive for COVID?',
    field: AdditionalBooleanQuestionsFieldsNames.TestedPositiveCovid,
  },
  {
    label: 'Have you traveled out of the USA in the last 2 weeks?',
    field: AdditionalBooleanQuestionsFieldsNames.TravelUsa,
  },
];

export const QUERY_STALE_TIME = 1000 * 60;

export const FLAGGED_REASONS_FOR_VISIT: string[] = [
  'Breathing problem',
  'Injury to head',
  'Choked or swallowed something',
  'Allergic reaction to medication or food',
];

export const MOBILE_MODAL_STYLE = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  border: 'none',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
};

export const TYPE_WIDTH_MIN = '120px';
export const TIME_WIDTH_MIN = '96px';
export const PATIENT_AND_REASON_WIDTH_MIN = '180px';
export const ROOM_WIDTH_MIN = '42px';
export const PROVIDER_WIDTH_MIN = '120px';
export const VISIT_ICONS_WIDTH_MIN = '150px';
export const NOTES_WIDTH_MIN = '150px';
export const CHAT_WIDTH_MIN = '42px';
export const GO_TO_ONE_BUTTON_WIDTH_MIN = '90px';
export const GO_TO_MANY_BUTTONS_WIDTH_MIN = '270px';
export const ACTION_WIDTH_MIN = '110px';

// Constants for default page sizes. Could also consider adding constants for the page size options
export const LOCATION_ROWS_PER_PAGE = 25;
export const EMPLOYEE_ROWS_PER_PAGE = 5;
export const PROVIDER_ROWS_PER_PAGE = 5;
export const INSURANCE_ROWS_PER_PAGE = 10;
export const STATES_ROWS_PER_PAGE = 10;

export const PRONOUN_OPTIONS = [
  {
    label: 'He/him',
    value: 'He/him',
  },
  {
    label: 'She/her',
    value: 'She/her',
  },
  {
    label: 'They/them',
    value: 'They/them',
  },
  {
    label: 'My pronouns are not listed',
    value: 'My pronouns are not listed',
  },
];

export const SEX_OPTIONS = [
  {
    label: 'Male',
    value: 'Male',
  },
  {
    label: 'Female',
    value: 'Female',
  },
  {
    label: 'Intersex',
    value: 'Intersex',
  },
];

export const STATE_OPTIONS = [
  {
    label: 'AL',
    value: 'AL',
  },
  {
    label: 'AK',
    value: 'AK',
  },
  {
    label: 'AZ',
    value: 'AZ',
  },
  {
    label: 'AR',
    value: 'AR',
  },
  {
    label: 'CA',
    value: 'CA',
  },
  {
    label: 'CO',
    value: 'CO',
  },
  {
    label: 'CT',
    value: 'CT',
  },
  {
    label: 'DE',
    value: 'DE',
  },
  {
    label: 'DC',
    value: 'DC',
  },
  {
    label: 'FL',
    value: 'FL',
  },
  {
    label: 'GA',
    value: 'GA',
  },
  {
    label: 'HI',
    value: 'HI',
  },
  {
    label: 'ID',
    value: 'ID',
  },
  {
    label: 'IL',
    value: 'IL',
  },
  {
    label: 'IN',
    value: 'IN',
  },
  {
    label: 'IA',
    value: 'IA',
  },
  {
    label: 'KS',
    value: 'KS',
  },
  {
    label: 'KY',
    value: 'KY',
  },
  {
    label: 'LA',
    value: 'LA',
  },
  {
    label: 'ME',
    value: 'ME',
  },
  {
    label: 'MD',
    value: 'MD',
  },
  {
    label: 'MA',
    value: 'MA',
  },
  {
    label: 'MI',
    value: 'MI',
  },
  {
    label: 'MN',
    value: 'MN',
  },
  {
    label: 'MS',
    value: 'MS',
  },
  {
    label: 'MO',
    value: 'MO',
  },
  {
    label: 'MT',
    value: 'MT',
  },
  {
    label: 'NE',
    value: 'NE',
  },
  {
    label: 'NV',
    value: 'NV',
  },
  {
    label: 'NH',
    value: 'NH',
  },
  {
    label: 'NJ',
    value: 'NJ',
  },
  {
    label: 'NM',
    value: 'NM',
  },
  {
    label: 'NY',
    value: 'NY',
  },
  {
    label: 'NC',
    value: 'NC',
  },
  {
    label: 'ND',
    value: 'ND',
  },
  {
    label: 'OH',
    value: 'OH',
  },
  {
    label: 'OK',
    value: 'OK',
  },
  {
    label: 'OR',
    value: 'OR',
  },
  {
    label: 'PA',
    value: 'PA',
  },
  {
    label: 'RI',
    value: 'RI',
  },
  {
    label: 'SC',
    value: 'SC',
  },
  {
    label: 'SD',
    value: 'SD',
  },
  {
    label: 'TN',
    value: 'TN',
  },
  {
    label: 'TX',
    value: 'TX',
  },
  {
    label: 'UT',
    value: 'UT',
  },
  {
    label: 'VT',
    value: 'VT',
  },
  {
    label: 'VA',
    value: 'VA',
  },
  {
    label: 'VI',
    value: 'VI',
  },
  {
    label: 'WA',
    value: 'WA',
  },
  {
    label: 'WV',
    value: 'WV',
  },
  {
    label: 'WI',
    value: 'WI',
  },
  {
    label: 'WY',
    value: 'WY',
  },
];

export const PATIENT_FILLING_OUT_AS_OPTIONS = [
  {
    label: 'Parent',
    value: 'Parent',
  },
  {
    label: 'Patient',
    value: 'Patient',
  },
];

export const INSURANCE_COVERAGE_OPTIONS = [
  {
    label: 'Primary',
    value: 'Primary',
  },
  {
    label: 'Secondary',
    value: 'Secondary',
  },
];

export const RELATIONSHIP_OPTIONS = [
  {
    label: 'Self',
    value: 'Self',
  },
  {
    label: 'Spouse',
    value: 'Spouse',
  },
  {
    label: 'Parent',
    value: 'Parent',
  },
  {
    label: 'Legal Guardian',
    value: 'Legal Guardian',
  },
  {
    label: 'Other',
    value: 'Other',
  },
];

export const ETHNICITY_OPTIONS = [
  {
    label: 'Hispanic or Latino',
    value: 'Hispanic or Latino',
  },
  {
    label: 'Not Hispanic or Latino',
    value: 'Not Hispanic or Latino',
  },
  {
    label: 'Decline to Specify',
    value: 'Decline to Specify',
  },
];

export const RACE_OPTIONS = [
  {
    label: 'American Indian or Alaska Native',
    value: 'American Indian or Alaska Native',
  },
  {
    label: 'Asian',
    value: 'Asian',
  },
  {
    label: 'Black or African American',
    value: 'Black or African American',
  },
  {
    label: 'Native Hawaiian or Other Pacific Islander',
    value: 'Native Hawaiian or Other Pacific Islander',
  },
  {
    label: 'White',
    value: 'White',
  },
  {
    label: 'Decline to Specify',
    value: 'Decline to Specify',
  },
];

export const SEXUAL_ORIENTATION_OPTIONS = [
  {
    label: 'Straight',
    value: 'Straight',
  },
  {
    label: 'Lesbian or Gay',
    value: 'Lesbian or Gay',
  },
  {
    label: 'Bisexual',
    value: 'Bisexual',
  },
  {
    label: 'Something else',
    value: 'Something else',
  },
  {
    label: 'Decline to Specify',
    value: 'Decline to Specify',
  },
];

export const GENDER_IDENTITY_OPTIONS = [
  {
    label: 'Female',
    value: 'Female gender identity',
  },
  {
    label: 'Male',
    value: 'Male gender identity',
  },
  {
    label: 'Other',
    value: 'Non-binary gender identity',
  },
];

export const POINT_OF_DISCOVERY_OPTIONS = [
  {
    label: 'Friend/Family',
    value: 'Friend/Family',
  },
  {
    label: 'Been there with another family member',
    value: 'Been there with another family member',
  },
  {
    label: 'Pediatrician/Healthcare Professional',
    value: 'Pediatrician/Healthcare Professional',
  },
  {
    label: 'Google/Internet search',
    value: 'Google/Internet search',
  },
  {
    label: 'Internet ad',
    value: 'Internet ad',
  },
  {
    label: 'Social media community group',
    value: 'Social media community group',
  },
  {
    label: 'Webinar',
    value: 'Webinar',
  },
  {
    label: 'TV/Radio',
    value: 'TV/Radio',
  },
  {
    label: 'Newsletter',
    value: 'Newsletter',
  },
  {
    label: 'School',
    value: 'School',
  },
  {
    label: 'Drive by/Signage',
    value: 'Drive by/Signage',
  },
];

export const RELATIONSHIP_TO_INSURED_OPTIONS = [
  {
    label: 'Self',
    value: 'Self',
  },
  {
    label: 'Child',
    value: 'Child',
  },
  {
    label: 'Parent',
    value: 'Parent',
  },
  {
    label: 'Spouse',
    value: 'Spouse',
  },
  {
    label: 'Common Law Spouse',
    value: 'Common Law Spouse',
  },
  {
    label: 'Injured Party',
    value: 'Injured Party',
  },
  {
    label: 'Other',
    value: 'Other',
  },
];

export const RX_HISTORY_CONSENT_OPTIONS = [
  {
    label: 'Rx history consent signed by the patient',
    value: 'Rx history consent signed by the patient',
  },
  {
    label: 'Rx history consent unasked to the patient',
    value: 'Rx history consent unasked to the patient',
  },
  {
    label: 'Rx history consent denied by the patient',
    value: 'Rx history consent denied by the patient',
  },
];

// patient record fields
export const FormFields = {
  patientSummary: {
    firstName: { key: 'patient-first-name', type: 'String' },
    middleName: { key: 'patient-middle-name', type: 'String' },
    lastName: { key: 'patient-last-name', type: 'String' },
    suffix: { key: 'patient-name-suffix', type: 'String' },
    preferredName: { key: 'patient-preferred-name', type: 'String' },
    birthDate: { key: 'patient-birthdate', type: 'String' },
    birthSex: { key: 'patient-birth-sex', type: 'String' },
    pronouns: { key: 'patient-pronouns', type: 'String' },
  },
  patientDetails: {
    ethnicity: { key: 'patient-ethnicity' },
    race: { key: 'patient-race' },
    sexualOrientation: { key: 'patient-sexual-orientation' },
    genderIdentity: { key: 'patient-gender-identity' },
    genderIdentityDetails: { key: 'patient-gender-identity-details' },
    language: { key: 'preferred-language' },
    pointOfDiscovery: { key: 'patient-point-of-discovery' },
    sendMarketing: { key: 'mobile-opt-in' },
    commonWellConsent: { key: 'common-well-consent' },
  },
  patientContactInformation: {
    streetAddress: { key: 'patient-street-address', type: 'String' },
    addressLine2: { key: 'patient-street-address-2', type: 'String' },
    city: { key: 'patient-city', type: 'String' },
    state: { key: 'patient-state', type: 'String' },
    zip: { key: 'patient-zip', type: 'String' },
    email: { key: 'patient-email', type: 'String' },
    phone: { key: 'patient-number', type: 'String' },
  },
  insurance: [
    {
      insurancePriority: { key: 'insurance-priority', type: 'String' },
      insuranceCarrier: { key: 'insurance-carrier', type: 'Reference' },
      memberId: { key: 'insurance-member-id', type: 'String' },
      firstName: { key: 'policy-holder-first-name', type: 'String' },
      middleName: { key: 'policy-holder-middle-name', type: 'String' },
      lastName: { key: 'policy-holder-last-name', type: 'String' },
      birthDate: { key: 'policy-holder-date-of-birth', type: 'String' },
      birthSex: { key: 'policy-holder-birth-sex', type: 'String' },
      policyHolderAddressAsPatient: { key: 'policy-holder-address-as-patient', type: 'Boolean' },
      streetAddress: { key: 'policy-holder-address', type: 'String' },
      addressLine2: { key: 'policy-holder-address-additional-line', type: 'String' },
      city: { key: 'policy-holder-city', type: 'String' },
      state: { key: 'policy-holder-state', type: 'String' },
      zip: { key: 'policy-holder-zip', type: 'String' },
      relationship: { key: 'patient-relationship-to-insured', type: 'String' },
      additionalInformation: { key: 'insurance-additional-information', type: 'String' },
    },
    {
      insurancePriority: { key: 'insurance-priority-2', type: 'String' },
      insuranceCarrier: { key: 'insurance-carrier-2', type: 'Reference' },
      memberId: { key: 'insurance-member-id-2', type: 'String' },
      firstName: { key: 'policy-holder-first-name-2', type: 'String' },
      middleName: { key: 'policy-holder-middle-name-2', type: 'String' },
      lastName: { key: 'policy-holder-last-name-2', type: 'String' },
      birthDate: { key: 'policy-holder-date-of-birth-2', type: 'String' },
      birthSex: { key: 'policy-holder-birth-sex-2', type: 'String' },
      policyHolderAddressAsPatient: { key: 'policy-holder-address-as-patient-2', type: 'Boolean' },
      streetAddress: { key: 'policy-holder-address-2', type: 'String' },
      addressLine2: { key: 'policy-holder-address-additional-line-2', type: 'String' },
      city: { key: 'policy-holder-city-2', type: 'String' },
      state: { key: 'policy-holder-state-2', type: 'String' },
      zip: { key: 'policy-holder-zip-2', type: 'String' },
      relationship: { key: 'patient-relationship-to-insured-2', type: 'String' },
      additionalInformation: { key: 'insurance-additional-information-2', type: 'String' },
    },
  ],
  primaryCarePhysician: {
    firstName: { key: 'pcp-first', type: 'String' },
    lastName: { key: 'pcp-last', type: 'String' },
    practiceName: { key: 'pcp-practice', type: 'String' },
    address: { key: 'pcp-address', type: 'String' },
    phone: { key: 'pcp-number', type: 'String' },
    active: { key: 'pcp-active', type: 'Boolean' },
  },
  responsibleParty: {
    relationship: { key: 'responsible-party-relationship', type: 'String', label: 'Relationship to the patient' },
    firstName: { key: 'responsible-party-first-name', type: 'String', label: 'First name' },
    lastName: { key: 'responsible-party-last-name', type: 'String', label: 'Last name' },
    birthDate: { key: 'responsible-party-date-of-birth', type: 'String', label: 'Date of birth' },
    birthSex: { key: 'responsible-party-birth-sex', type: 'String', label: 'Birth sex' },
    phone: { key: 'responsible-party-number', type: 'String', label: 'Phone' },
    addressLine1: { key: 'responsible-party-address', type: 'String', label: 'Street Address' },
    addressLine2: { key: 'responsible-party-address-2', type: 'String', label: 'Address line 2' },
    city: { key: 'responsible-party-city', type: 'String', label: 'City' },
    state: { key: 'responsible-party-state', type: 'String', label: 'State' },
    zip: { key: 'responsible-party-zip', type: 'String', label: 'Zip' },
  },
};

export const PatientIdentifyingFields = [
  FormFields.patientSummary.firstName.key,
  FormFields.patientSummary.middleName.key,
  FormFields.patientSummary.lastName.key,
  FormFields.patientSummary.birthDate.key,
  FormFields.patientSummary.birthSex.key,
];

export const PatientAddressFields = [
  FormFields.patientContactInformation.streetAddress.key,
  FormFields.patientContactInformation.addressLine2.key,
  FormFields.patientContactInformation.city.key,
  FormFields.patientContactInformation.state.key,
  FormFields.patientContactInformation.zip.key,
];

export const PatientGuarantorFields = [
  FormFields.patientSummary.firstName.key,
  FormFields.patientSummary.lastName.key,
  FormFields.patientSummary.birthDate.key,
  FormFields.patientSummary.birthSex.key,
  FormFields.patientContactInformation.phone.key,
];

export const InsurancePriorityOptions = [
  FormFields.insurance[0].insurancePriority.key,
  FormFields.insurance[1].insurancePriority.key,
];
