import { AdditionalBooleanQuestion, AdditionalBooleanQuestionsFieldsNames } from 'utils';

export const PROJECT_NAME = import.meta.env.VITE_APP_NAME;
export const PROJECT_NAME_UPPER = PROJECT_NAME.toUpperCase();
export const PROJECT_NAME_LOWER = PROJECT_NAME.toLowerCase();

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

// This functionality is to ensure that sticky elements stick to the correct top when the banner is enabled
export const BANNER_HEIGHT = 60;
export const adjustTopForBannerHeight = (top: number): number => {
  return import.meta.env.VITE_APP_ENV !== 'production' ? top + BANNER_HEIGHT : top;
};

export const NEXT_WIDTH = '1%';
export const TYPE_WIDTH = '13%';
export const TIME_WIDTH = '12%';
export const PATIENT_AND_REASON_WIDTH = '21%';
export const INTAKE_WIDTH = '8%';
export const PROVIDER_WIDTH = '14%';
export const GROUP_WIDTH = '14%';
export const VISIT_ICONS_WIDTH = '19%';
export const NOTES_WIDTH = '19%';
export const CHAT_WIDTH = '8%';
export const ACTION_WIDTH = '11%';

// Constants for default page sizes. Could also consider adding constants for the page size options
export const LOCATION_ROWS_PER_PAGE = 25;
export const EMPLOYEE_ROWS_PER_PAGE = 5;
export const PROVIDER_ROWS_PER_PAGE = 5;
export const INSURANCE_ROWS_PER_PAGE = 10;
export const STATES_ROWS_PER_PAGE = 10;

export const PRONOUN_OPTIONS = [
  {
    label: 'He/Him/His',
    value: 'He/Him/His',
  },
  {
    label: 'She/Her/Her',
    value: 'She/Her/Her',
  },
  {
    label: 'They/Them/Their',
    value: 'They/Them/Their',
  },
  {
    label: 'My pronouns are not listed',
    value: 'My pronouns are not listed',
  },
];

export const SEX_OPTIONS = [
  {
    label: 'Male',
    value: 'male',
  },
  {
    label: 'Female',
    value: 'female',
  },
  {
    label: 'Intersex',
    value: 'intersex',
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
    value: '1',
  },
  {
    label: 'Secondary',
    value: '2',
  },
  {
    label: 'Tertiary',
    value: '3',
  },
];

export const RELATIONSHIP_OPTIONS = [
  {
    label: 'Self',
    value: 'Self',
    code: 'SELF',
  },
  {
    label: 'Legal Guardian',
    value: 'Legal Guardian',
    code: 'GUARD',
  },
  {
    label: 'Father',
    value: 'Father',
    code: 'FTH',
  },
  {
    label: 'Mother',
    value: 'Mother',
    code: 'MTH',
  },
  {
    label: 'Spouse',
    value: 'Spouse',
    code: 'SPO',
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
    label: 'Been there with another child or family member',
    value: 'Been there with another child or family member',
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
    label: 'Other',
    value: 'Other',
  },
  {
    label: 'Self',
    value: 'Self',
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
