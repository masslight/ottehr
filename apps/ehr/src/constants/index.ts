import { PATIENT_RECORD_CONFIG, patientScreeningQuestionsConfig } from 'utils';

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

export const QUERY_STALE_TIME = 5 * 60 * 1000;

export const CHART_DATA_QUERY_KEY = 'chart-data-query-key'; // useChartData uses this key
export const CHART_FIELDS_QUERY_KEY = 'chart-fields-query-key'; // useChartField uses this key

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

export const TYPE_WIDTH_MIN = '160px';
export const TIME_WIDTH_MIN = '140px';
export const PATIENT_AND_REASON_WIDTH_MIN = '300px';
export const ROOM_WIDTH_MIN = '120px';
export const PROVIDER_WIDTH_MIN = '140px';
export const VISIT_ICONS_WIDTH_MIN = '160px';
export const VITALS_ICON_WIDTH_MIN = '90px';
export const NOTES_WIDTH_MIN = '220px';
export const CHAT_WIDTH_MIN = '80px';
export const GO_TO_ONE_BUTTON_WIDTH_MIN = '160px';
export const GO_TO_MANY_BUTTONS_WIDTH_MIN = '400px';
export const ACTION_WIDTH_MIN = '130px';

// Constants for default page sizes. Could also consider adding constants for the page size options
export const LOCATION_ROWS_PER_PAGE = 25;
export const EMPLOYEE_ROWS_PER_PAGE = 5;
export const PROVIDER_ROWS_PER_PAGE = 5;
export const INSURANCE_ROWS_PER_PAGE = 10;
export const STATES_ROWS_PER_PAGE = 10;

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

const { FormFields } = PATIENT_RECORD_CONFIG;

export const PatientIdentifyingFields = [
  FormFields.patientSummary.items.firstName.key,
  FormFields.patientSummary.items.middleName.key,
  FormFields.patientSummary.items.lastName.key,
  FormFields.patientSummary.items.birthDate.key,
  FormFields.patientSummary.items.birthSex.key,
];

export const PatientAddressFields = [
  FormFields.patientContactInformation.items.streetAddress.key,
  FormFields.patientContactInformation.items.addressLine2.key,
  FormFields.patientContactInformation.items.city.key,
  FormFields.patientContactInformation.items.state.key,
  FormFields.patientContactInformation.items.zip.key,
];

export const PatientGuarantorFields = [
  FormFields.patientSummary.items.firstName.key,
  FormFields.patientSummary.items.lastName.key,
  FormFields.patientSummary.items.birthDate.key,
  FormFields.patientSummary.items.birthSex.key,
  FormFields.patientContactInformation.items.phone.key,
];

export const InsurancePriorityFields = [
  FormFields.insurance.items[0].insurancePriority.key,
  FormFields.insurance.items[1].insurancePriority.key,
];

// Generate additional questions from configuration
// Only include fields that exist in questionnaire (for now, assuming all are boolean)
// TODO: only boolean fields are supported for now, add support for other field types when needed
const questionnaireFields = patientScreeningQuestionsConfig.fields.filter((field) => field.existsInQuestionnaire);

export const ADDITIONAL_QUESTIONS = questionnaireFields.map((field) => ({
  label: field.question,
  field: field.fhirField,
}));

export const PREFERRED_COMMUNICATION_METHOD_OPTIONS = [
  {
    label: 'No preference',
    value: 'No preference',
  },
  {
    label: 'Email',
    value: 'Email',
  },
  {
    label: 'Home Phone',
    value: 'Home Phone',
  },
  {
    label: 'Cell Phone',
    value: 'Cell Phone',
  },
  {
    label: 'Mail',
    value: 'Mail',
  },
];
