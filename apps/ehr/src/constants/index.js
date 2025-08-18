"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsurancePriorityOptions = exports.PatientGuarantorFields = exports.PatientAddressFields = exports.PatientIdentifyingFields = exports.FormFields = exports.RX_HISTORY_CONSENT_OPTIONS = exports.RELATIONSHIP_TO_INSURED_OPTIONS = exports.POINT_OF_DISCOVERY_OPTIONS = exports.GENDER_IDENTITY_OPTIONS = exports.SEXUAL_ORIENTATION_OPTIONS = exports.RACE_OPTIONS = exports.ETHNICITY_OPTIONS = exports.RELATIONSHIP_OPTIONS = exports.INSURANCE_COVERAGE_OPTIONS = exports.PATIENT_FILLING_OUT_AS_OPTIONS = exports.STATE_OPTIONS = exports.SEX_OPTIONS = exports.PRONOUN_OPTIONS = exports.STATES_ROWS_PER_PAGE = exports.INSURANCE_ROWS_PER_PAGE = exports.PROVIDER_ROWS_PER_PAGE = exports.EMPLOYEE_ROWS_PER_PAGE = exports.LOCATION_ROWS_PER_PAGE = exports.ACTION_WIDTH_MIN = exports.GO_TO_MANY_BUTTONS_WIDTH_MIN = exports.GO_TO_ONE_BUTTON_WIDTH_MIN = exports.CHAT_WIDTH_MIN = exports.NOTES_WIDTH_MIN = exports.VISIT_ICONS_WIDTH_MIN = exports.PROVIDER_WIDTH_MIN = exports.ROOM_WIDTH_MIN = exports.PATIENT_AND_REASON_WIDTH_MIN = exports.TIME_WIDTH_MIN = exports.TYPE_WIDTH_MIN = exports.MOBILE_MODAL_STYLE = exports.FLAGGED_REASONS_FOR_VISIT = exports.QUERY_STALE_TIME = exports.ADDITIONAL_QUESTIONS = exports.LANGUAGES = exports.APPOINTMENT_REFRESH_INTERVAL = exports.CHAT_REFETCH_INTERVAL = exports.HOP_QUEUE_URI = exports.MAXIMUM_CHARACTER_LIMIT = exports.ZIP_REGEX = exports.EMAIL_REGEX = exports.PHONE_NUMBER_REGEX = exports.REASON_FOR_VISIT_OPTIONS = void 0;
var utils_1 = require("utils");
exports.REASON_FOR_VISIT_OPTIONS = [
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
exports.PHONE_NUMBER_REGEX = /^\d{10}$/;
exports.EMAIL_REGEX = /^\S+@\S+\.\S+$/;
exports.ZIP_REGEX = /^\d{5}$/;
exports.MAXIMUM_CHARACTER_LIMIT = 155;
exports.HOP_QUEUE_URI = 'hop-queue';
exports.CHAT_REFETCH_INTERVAL = 15000;
exports.APPOINTMENT_REFRESH_INTERVAL = 15000;
var LANGUAGES;
(function (LANGUAGES) {
    LANGUAGES["spanish"] = "spanish";
    LANGUAGES["english"] = "english";
})(LANGUAGES || (exports.LANGUAGES = LANGUAGES = {}));
exports.ADDITIONAL_QUESTIONS = [
    {
        label: 'Do you have any COVID symptoms?',
        field: utils_1.AdditionalBooleanQuestionsFieldsNames.CovidSymptoms,
    },
    {
        label: 'Have you tested positive for COVID?',
        field: utils_1.AdditionalBooleanQuestionsFieldsNames.TestedPositiveCovid,
    },
    {
        label: 'Have you traveled out of the USA in the last 2 weeks?',
        field: utils_1.AdditionalBooleanQuestionsFieldsNames.TravelUsa,
    },
];
exports.QUERY_STALE_TIME = 1000 * 60;
exports.FLAGGED_REASONS_FOR_VISIT = [
    'Breathing problem',
    'Injury to head',
    'Choked or swallowed something',
    'Allergic reaction to medication or food',
];
exports.MOBILE_MODAL_STYLE = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80%',
    border: 'none',
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 4,
};
exports.TYPE_WIDTH_MIN = '120px';
exports.TIME_WIDTH_MIN = '96px';
exports.PATIENT_AND_REASON_WIDTH_MIN = '180px';
exports.ROOM_WIDTH_MIN = '42px';
exports.PROVIDER_WIDTH_MIN = '120px';
exports.VISIT_ICONS_WIDTH_MIN = '150px';
exports.NOTES_WIDTH_MIN = '150px';
exports.CHAT_WIDTH_MIN = '42px';
exports.GO_TO_ONE_BUTTON_WIDTH_MIN = '90px';
exports.GO_TO_MANY_BUTTONS_WIDTH_MIN = '270px';
exports.ACTION_WIDTH_MIN = '110px';
// Constants for default page sizes. Could also consider adding constants for the page size options
exports.LOCATION_ROWS_PER_PAGE = 25;
exports.EMPLOYEE_ROWS_PER_PAGE = 5;
exports.PROVIDER_ROWS_PER_PAGE = 5;
exports.INSURANCE_ROWS_PER_PAGE = 10;
exports.STATES_ROWS_PER_PAGE = 10;
exports.PRONOUN_OPTIONS = [
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
exports.SEX_OPTIONS = [
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
exports.STATE_OPTIONS = [
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
exports.PATIENT_FILLING_OUT_AS_OPTIONS = [
    {
        label: 'Parent',
        value: 'Parent',
    },
    {
        label: 'Patient',
        value: 'Patient',
    },
];
exports.INSURANCE_COVERAGE_OPTIONS = [
    {
        label: 'Primary',
        value: 'Primary',
    },
    {
        label: 'Secondary',
        value: 'Secondary',
    },
];
exports.RELATIONSHIP_OPTIONS = [
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
exports.ETHNICITY_OPTIONS = [
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
exports.RACE_OPTIONS = [
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
exports.SEXUAL_ORIENTATION_OPTIONS = [
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
exports.GENDER_IDENTITY_OPTIONS = [
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
exports.POINT_OF_DISCOVERY_OPTIONS = [
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
exports.RELATIONSHIP_TO_INSURED_OPTIONS = [
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
exports.RX_HISTORY_CONSENT_OPTIONS = [
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
exports.FormFields = {
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
exports.PatientIdentifyingFields = [
    exports.FormFields.patientSummary.firstName.key,
    exports.FormFields.patientSummary.middleName.key,
    exports.FormFields.patientSummary.lastName.key,
    exports.FormFields.patientSummary.birthDate.key,
    exports.FormFields.patientSummary.birthSex.key,
];
exports.PatientAddressFields = [
    exports.FormFields.patientContactInformation.streetAddress.key,
    exports.FormFields.patientContactInformation.addressLine2.key,
    exports.FormFields.patientContactInformation.city.key,
    exports.FormFields.patientContactInformation.state.key,
    exports.FormFields.patientContactInformation.zip.key,
];
exports.PatientGuarantorFields = [
    exports.FormFields.patientSummary.firstName.key,
    exports.FormFields.patientSummary.lastName.key,
    exports.FormFields.patientSummary.birthDate.key,
    exports.FormFields.patientSummary.birthSex.key,
    exports.FormFields.patientContactInformation.phone.key,
];
exports.InsurancePriorityOptions = [
    exports.FormFields.insurance[0].insurancePriority.key,
    exports.FormFields.insurance[1].insurancePriority.key,
];
//# sourceMappingURL=index.js.map