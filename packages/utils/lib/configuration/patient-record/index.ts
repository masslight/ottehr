import { Questionnaire, QuestionnaireItem, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';
import _ from 'lodash';
import { z } from 'zod';
import patientRecordQuestionnaire from '../../../../../config/oystehr/ehr-insurance-update-questionnaire.json' assert { type: 'json' };
import { PATIENT_RECORD_OVERRIDES as OVERRIDES } from '../../../.ottehr_config';
import { makeAnswer, makePrepopulatedItemsFromPatientRecord, PrePopulationFromPatientRecordInput } from '../../main';
import { mergeAndFreezeConfigObjects } from '../helpers';

const PatientRecordQuestionnaire = Object.values(patientRecordQuestionnaire.fhirResources)![0]
  .resource as Questionnaire;

const ehrPatientRecordForm: {
  url: string | undefined;
  version: string | undefined;
  templateQuestionnaire: Questionnaire | undefined;
} = (() => {
  const templateResource = _.cloneDeep(PatientRecordQuestionnaire);
  return {
    url: templateResource?.url,
    version: templateResource?.version,
    templateQuestionnaire: templateResource as Questionnaire,
  };
})();

/*
  THE SOURCE COMMENT

*/
// patient record fields

const formValueSets = {
  birthSexOptions: [
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
  ],
  pronounOptions: [
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
  ],
  stateOptions: [
    { label: 'AL', value: 'AL' },
    { label: 'AK', value: 'AK' },
    { label: 'AZ', value: 'AZ' },
    { label: 'AR', value: 'AR' },
    { label: 'CA', value: 'CA' },
    { label: 'CO', value: 'CO' },
    { label: 'CT', value: 'CT' },
    { label: 'DE', value: 'DE' },
    { label: 'DC', value: 'DC' },
    { label: 'FL', value: 'FL' },
    { label: 'GA', value: 'GA' },
    { label: 'HI', value: 'HI' },
    { label: 'ID', value: 'ID' },
    { label: 'IL', value: 'IL' },
    { label: 'IN', value: 'IN' },
    { label: 'IA', value: 'IA' },
    { label: 'KS', value: 'KS' },
    { label: 'KY', value: 'KY' },
    { label: 'LA', value: 'LA' },
    { label: 'ME', value: 'ME' },
    { label: 'MD', value: 'MD' },
    { label: 'MA', value: 'MA' },
    { label: 'MI', value: 'MI' },
    { label: 'MN', value: 'MN' },
    { label: 'MS', value: 'MS' },
    { label: 'MO', value: 'MO' },
    { label: 'MT', value: 'MT' },
    { label: 'NE', value: 'NE' },
    { label: 'NV', value: 'NV' },
    { label: 'NH', value: 'NH' },
    { label: 'NJ', value: 'NJ' },
    { label: 'NM', value: 'NM' },
    { label: 'NY', value: 'NY' },
    { label: 'NC', value: 'NC' },
    { label: 'ND', value: 'ND' },
    { label: 'OH', value: 'OH' },
    { label: 'OK', value: 'OK' },
    { label: 'OR', value: 'OR' },
    { label: 'PA', value: 'PA' },
    { label: 'RI', value: 'RI' },
    { label: 'SC', value: 'SC' },
    { label: 'SD', value: 'SD' },
    { label: 'TN', value: 'TN' },
    { label: 'TX', value: 'TX' },
    { label: 'UT', value: 'UT' },
    { label: 'VT', value: 'VT' },
    { label: 'VA', value: 'VA' },
    { label: 'VI', value: 'VI' },
    { label: 'WA', value: 'WA' },
    { label: 'WV', value: 'WV' },
    { label: 'WI', value: 'WI' },
    { label: 'WY', value: 'WY' },
  ],
  patientFillingOutAsOptions: [
    { label: 'Parent', value: 'Parent' },
    { label: 'Patient', value: 'Patient' },
  ],
  insurancePriorityOptions: [
    { label: 'Primary', value: 'Primary' },
    { label: 'Secondary', value: 'Secondary' },
  ],
  relationshipOptions: [
    { label: 'Self', value: 'Self' },
    { label: 'Spouse', value: 'Spouse' },
    { label: 'Parent', value: 'Parent' },
    { label: 'Legal Guardian', value: 'Legal Guardian' },
    { label: 'Other', value: 'Other' },
  ],
  emergencyContactRelationshipOptions: [
    { label: 'Spouse', value: 'Spouse' },
    { label: 'Parent', value: 'Parent' },
    { label: 'Legal Guardian', value: 'Legal Guardian' },
    { label: 'Other', value: 'Other' },
  ],
  ethnicityOptions: [
    { label: 'Hispanic or Latino', value: 'Hispanic or Latino' },
    { label: 'Not Hispanic or Latino', value: 'Not Hispanic or Latino' },
    { label: 'Decline to Specify', value: 'Decline to Specify' },
  ],
  raceOptions: [
    { label: 'American Indian or Alaska Native', value: 'American Indian or Alaska Native' },
    { label: 'Asian', value: 'Asian' },
    { label: 'Black or African American', value: 'Black or African American' },
    { label: 'Native Hawaiian or Other Pacific Islander', value: 'Native Hawaiian or Other Pacific Islander' },
    { label: 'White', value: 'White' },
    { label: 'Decline to Specify', value: 'Decline to Specify' },
  ],
  sexualOrientationOptions: [
    { label: 'Straight', value: 'Straight' },
    { label: 'Lesbian or Gay', value: 'Lesbian or Gay' },
    { label: 'Bisexual', value: 'Bisexual' },
    { label: 'Something else', value: 'Something else' },
    { label: 'Decline to Specify', value: 'Decline to Specify' },
  ],
  genderIdentityOptions: [
    { label: 'Female', value: 'Female gender identity' },
    { label: 'Male', value: 'Male gender identity' },
    { label: 'Other', value: 'Non-binary gender identity' },
  ],
  pointOfDiscoveryOptions: [
    { label: 'Friend/Family', value: 'Friend/Family' },
    { label: 'Been there with another family member', value: 'Been there with another family member' },
    { label: 'Pediatrician/Healthcare Professional', value: 'Pediatrician/Healthcare Professional' },
    { label: 'Google/Internet search', value: 'Google/Internet search' },
    { label: 'Internet ad', value: 'Internet ad' },
    { label: 'Social media community group', value: 'Social media community group' },
    { label: 'Webinar', value: 'Webinar' },
    { label: 'TV/Radio', value: 'TV/Radio' },
    { label: 'Newsletter', value: 'Newsletter' },
    { label: 'School', value: 'School' },
    { label: 'Drive by/Signage', value: 'Drive by/Signage' },
  ],
  relationshipToInsuredOptions: [
    { label: 'Self', value: 'Self' },
    { label: 'Child', value: 'Child' },
    { label: 'Parent', value: 'Parent' },
    { label: 'Spouse', value: 'Spouse' },
    { label: 'Common Law Spouse', value: 'Common Law Spouse' },
    { label: 'Injured Party', value: 'Injured Party' },
    { label: 'Other', value: 'Other' },
  ],
  rxHistoryConsentOptions: [
    { label: 'Rx history consent signed by the patient', value: 'Rx history consent signed by the patient' },
    { label: 'Rx history consent unasked to the patient', value: 'Rx history consent unasked to the patient' },
    { label: 'Rx history consent denied by the patient', value: 'Rx history consent denied by the patient' },
  ],
  preferredCommunicationMethodOptions: [
    { label: 'No preference', value: 'No preference' },
    { label: 'Email', value: 'Email' },
    { label: 'Home Phone', value: 'Home Phone' },
    { label: 'Cell Phone', value: 'Cell Phone' },
    { label: 'Mail', value: 'Mail' },
  ],
  languageOptions: [
    { label: 'English', value: 'English' },
    { label: 'Spanish', value: 'Spanish' },
    { label: 'Chinese', value: 'Chinese' },
    { label: 'French', value: 'French' },
    { label: 'German', value: 'German' },
    { label: 'Tagalog', value: 'Tagalog' },
    { label: 'Vietnamese', value: 'Vietnamese' },
    { label: 'Italian', value: 'Italian' },
    { label: 'Korean', value: 'Korean' },
    { label: 'Russian', value: 'Russian' },
    { label: 'Polish', value: 'Polish' },
    { label: 'Arabic', value: 'Arabic' },
    { label: 'Portuguese', value: 'Portuguese' },
    { label: 'Japanese', value: 'Japanese' },
    { label: 'Greek', value: 'Greek' },
    { label: 'Hindi', value: 'Hindi' },
    { label: 'Persian', value: 'Persian' },
    { label: 'Urdu', value: 'Urdu' },
    { label: 'Sign Language', value: 'Sign Language' },
    { label: 'Other', value: 'Other' },
  ],
};

const FormFields = {
  patientSummary: {
    firstName: { key: 'patient-first-name', type: 'string', label: 'First name' },
    middleName: { key: 'patient-middle-name', type: 'string', label: 'Middle name' },
    lastName: { key: 'patient-last-name', type: 'string', label: 'Last name' },
    suffix: { key: 'patient-name-suffix', type: 'string', label: 'Suffix' },
    preferredName: { key: 'patient-preferred-name', type: 'string', label: 'Preferred name' },
    birthDate: { key: 'patient-birthdate', type: 'date', label: 'Date of birth' },
    birthSex: { key: 'patient-birth-sex', type: 'choice', label: 'Birth sex', options: formValueSets.birthSexOptions },
    pronouns: {
      key: 'patient-pronouns',
      type: 'choice',
      label: 'Preferred pronouns',
      options: formValueSets.pronounOptions,
    },
    ssn: { key: 'patient-ssn', type: 'string', label: 'SSN' },
  },
  patientDetails: {
    ethnicity: {
      key: 'patient-ethnicity',
      label: "Patient's ethnicity",
      type: 'choice',
      options: formValueSets.ethnicityOptions,
    },
    race: {
      key: 'patient-race',
      label: "Patient's race",
      type: 'choice',
      options: formValueSets.raceOptions,
    },
    sexualOrientation: {
      key: 'patient-sexual-orientation',
      label: 'Sexual orientation',
      type: 'choice',
      options: formValueSets.sexualOrientationOptions,
    },
    genderIdentity: {
      key: 'patient-gender-identity',
      label: 'Gender identity',
      type: 'choice',
      options: formValueSets.genderIdentityOptions,
    },
    genderIdentityDetails: {
      key: 'patient-gender-identity-details',
      label: '',
      type: 'string',
    },
    language: {
      key: 'preferred-language',
      label: 'Preferred language',
      type: 'choice',
      options: formValueSets.languageOptions,
    },
    otherLanguage: { key: 'other-preferred-language', label: '', type: 'string' },
    sendMarketing: { key: 'mobile-opt-in', label: 'Send marketing messages', type: 'boolean' },
    pointOfDiscovery: {
      key: 'patient-point-of-discovery',
      label: 'How did you hear about us?',
      type: 'choice',
      options: formValueSets.pointOfDiscoveryOptions,
    },
    commonWellConsent: { key: 'common-well-consent', label: 'CommonWell consent', type: 'boolean' },
  },
  patientContactInformation: {
    streetAddress: { key: 'patient-street-address', type: 'string', label: 'Street address' },
    addressLine2: { key: 'patient-street-address-2', type: 'string', label: 'Address line 2' },
    city: { key: 'patient-city', type: 'string', label: 'City' },
    state: { key: 'patient-state', type: 'string', label: 'State' },
    zip: { key: 'patient-zip', type: 'string', label: 'ZIP' },
    email: { key: 'patient-email', type: 'string', label: 'Patient email' },
    phone: { key: 'patient-number', type: 'string', label: 'Patient mobile' },
    preferredCommunicationMethod: {
      key: 'patient-preferred-communication-method',
      type: 'string',
      label: 'Preferred communication method',
    },
  },
  insurance: [
    {
      insurancePriority: {
        key: 'insurance-priority',
        type: 'choice',
        label: 'Type',
        options: formValueSets.insurancePriorityOptions,
      },
      insuranceCarrier: { key: 'insurance-carrier', type: 'reference', label: 'Insurance carrier' },
      insurancePlanType: {
        key: 'insurance-plan-type',
        type: 'choice',
        label: 'Insurance type',
        options: [],
      },
      memberId: { key: 'insurance-member-id', type: 'string', label: 'Member ID' },
      firstName: { key: 'policy-holder-first-name', type: 'string', label: "Policy holder's first name" },
      middleName: { key: 'policy-holder-middle-name', type: 'string', label: "Policy holder's middle name" },
      lastName: { key: 'policy-holder-last-name', type: 'string', label: "Policy holder's last name" },
      birthDate: { key: 'policy-holder-date-of-birth', type: 'date', label: "Policy holder's date of birth" },
      birthSex: { key: 'policy-holder-birth-sex', type: 'string', label: "Policy holder's birth sex" },
      policyHolderAddressAsPatient: {
        key: 'policy-holder-address-as-patient',
        type: 'boolean',
        label: "Policy holder address is the same as patient's address",
      },
      streetAddress: { key: 'policy-holder-address', type: 'string', label: "Policy holder's address" },
      addressLine2: {
        key: 'policy-holder-address-additional-line',
        type: 'string',
        label: "Policy holder's address line 2",
      },
      city: { key: 'policy-holder-city', type: 'string', label: 'City' },
      state: { key: 'policy-holder-state', type: 'choice', label: 'State', options: formValueSets.stateOptions },
      zip: { key: 'policy-holder-zip', type: 'string', label: 'ZIP' },
      relationship: {
        key: 'patient-relationship-to-insured',
        type: 'choice',
        label: "Patient's relationship to insured",
        options: formValueSets.relationshipToInsuredOptions,
      },
      additionalInformation: {
        key: 'insurance-additional-information',
        type: 'string',
        label: 'Additional insurance information',
      },
    },
    {
      insurancePriority: {
        key: 'insurance-priority-2',
        type: 'choice',
        label: 'Type',
        options: formValueSets.insurancePriorityOptions,
      },
      insuranceCarrier: { key: 'insurance-carrier-2', type: 'reference', label: 'Insurance carrier' },
      insurancePlanType: { key: 'insurance-plan-type-2', type: 'choice', label: 'Insurance type', options: [] },
      memberId: { key: 'insurance-member-id-2', type: 'string', label: 'Member ID' },
      firstName: { key: 'policy-holder-first-name-2', type: 'string', label: "Policy holder's first name" },
      middleName: { key: 'policy-holder-middle-name-2', type: 'string', label: "Policy holder's middle name" },
      lastName: { key: 'policy-holder-last-name-2', type: 'string', label: "Policy holder's last name" },
      birthDate: { key: 'policy-holder-date-of-birth-2', type: 'date', label: "Policy holder's date of birth" },
      birthSex: { key: 'policy-holder-birth-sex-2', type: 'string', label: "Policy holder's birth sex" },
      policyHolderAddressAsPatient: {
        key: 'policy-holder-address-as-patient-2',
        type: 'boolean',
        label: "Policy holder address is the same as patient's address",
      },
      streetAddress: { key: 'policy-holder-address-2', type: 'string', label: "Policy holder's address" },
      addressLine2: {
        key: 'policy-holder-address-additional-line-2',
        type: 'string',
        label: "Policy holder's address line 2",
      },
      city: { key: 'policy-holder-city-2', type: 'string', label: 'City' },
      state: { key: 'policy-holder-state-2', type: 'string', label: 'State' },
      zip: { key: 'policy-holder-zip-2', type: 'string', label: 'ZIP' },
      relationship: {
        key: 'patient-relationship-to-insured-2',
        type: 'choice',
        label: "Patient's relationship to insured",
        options: formValueSets.relationshipToInsuredOptions,
      },
      additionalInformation: {
        key: 'insurance-additional-information-2',
        type: 'string',
        label: 'Additional insurance information',
      },
    },
  ],
  primaryCarePhysician: {
    firstName: { key: 'pcp-first', type: 'string', label: 'First name' },
    lastName: { key: 'pcp-last', type: 'string', label: 'Last name' },
    practiceName: { key: 'pcp-practice', type: 'string', label: 'Practice name' },
    address: { key: 'pcp-address', type: 'string', label: 'Address' },
    phone: { key: 'pcp-number', type: 'string', label: 'Mobile' },
    active: { key: 'pcp-active', type: 'boolean', label: "Patient doesn't have a PCP at this time" },
  },
  responsibleParty: {
    relationship: {
      key: 'responsible-party-relationship',
      type: 'choice',
      label: 'Relationship to the patient',
      options: formValueSets.relationshipOptions,
    },
    firstName: { key: 'responsible-party-first-name', type: 'string', label: 'First name' },
    lastName: { key: 'responsible-party-last-name', type: 'string', label: 'Last name' },
    birthDate: { key: 'responsible-party-date-of-birth', type: 'date', label: 'Date of birth' },
    birthSex: { key: 'responsible-party-birth-sex', type: 'string', label: 'Birth sex' },
    phone: { key: 'responsible-party-number', type: 'string', label: 'Phone' },
    email: { key: 'responsible-party-email', type: 'string', label: 'Email' },
    addressLine1: { key: 'responsible-party-address', type: 'string', label: 'Street Address' },
    addressLine2: { key: 'responsible-party-address-2', type: 'string', label: 'Address line 2' },
    city: { key: 'responsible-party-city', type: 'string', label: 'City' },
    state: { key: 'responsible-party-state', type: 'string', label: 'State' },
    zip: { key: 'responsible-party-zip', type: 'string', label: 'Zip' },
  },
  emergencyContact: {
    relationship: {
      key: 'emergency-contact-relationship',
      type: 'choice',
      label: 'Relationship to the patient',
      options: formValueSets.emergencyContactRelationshipOptions,
    },
    firstName: { key: 'emergency-contact-first-name', type: 'string', label: 'First name' },
    middleName: { key: 'emergency-contact-middle-name', type: 'string', label: 'Middle name' },
    lastName: { key: 'emergency-contact-last-name', type: 'string', label: 'Last name' },
    phone: { key: 'emergency-contact-number', type: 'string', label: 'Phone' },
    addressAsPatient: {
      key: 'emergency-contact-address-as-patient',
      type: 'boolean',
      label: "Emergency contact address is the same as patient's address",
    },
    streetAddress: { key: 'emergency-contact-address', type: 'string', label: 'Street address' },
    addressLine2: { key: 'emergency-contact-address-2', type: 'string', label: 'Address line 2 (optional)' },
    city: { key: 'emergency-contact-city', type: 'string', label: 'City' },
    state: { key: 'emergency-contact-state', type: 'string', label: 'State' },
    zip: { key: 'emergency-contact-zip', type: 'string', label: 'Zip' },
  },
  preferredPharmacy: {
    name: { key: 'pharmacy-name', type: 'string', label: 'Pharmacy name' },
    address: { key: 'pharmacy-address', type: 'string', label: 'Pharmacy address' },
  },
  employerInformation: {
    employerName: { key: 'employer-name', type: 'string', label: 'Employer name' },
    addressLine1: { key: 'employer-address', type: 'string', label: 'Address line 1' },
    addressLine2: { key: 'employer-address-2', type: 'string', label: 'Address line 2' },
    city: { key: 'employer-city', type: 'string', label: 'City' },
    state: { key: 'employer-state', type: 'string', label: 'State' },
    zip: { key: 'employer-zip', type: 'string', label: 'ZIP' },
    contactFirstName: { key: 'employer-contact-first-name', type: 'string', label: 'Contact first name' },
    contactLastName: { key: 'employer-contact-last-name', type: 'string', label: 'Contact last name' },
    contactTitle: { key: 'employer-contact-title', type: 'string', label: 'Contact title' },
    contactEmail: { key: 'employer-contact-email', type: 'string', label: 'Contact email' },
    contactPhone: { key: 'employer-contact-phone', type: 'string', label: 'Contact phone' },
    contactFax: { key: 'employer-contact-fax', type: 'string', label: 'Contact fax' },
  },
};

const FormFieldsValueTypeSchema = z
  .object({
    key: z.string(),
    type: z.enum(['string', 'date', 'choice', 'boolean', 'reference']),
    label: z.string(),
    options: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        })
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'choice') {
        return Array.isArray(data.options);
      }
      return true;
    },
    {
      message: 'Options must be provided for choice types',
    }
  );

export type FormFieldsItem = z.infer<typeof FormFieldsValueTypeSchema>;

const FormFieldsSchema = z.object({
  patientSummary: z.record(FormFieldsValueTypeSchema),
  patientDetails: z.record(FormFieldsValueTypeSchema),
  patientContactInformation: z.record(FormFieldsValueTypeSchema),
  insurance: z.array(z.record(FormFieldsValueTypeSchema)),
  primaryCarePhysician: z.record(FormFieldsValueTypeSchema),
  responsibleParty: z.record(FormFieldsValueTypeSchema),
  emergencyContact: z.record(FormFieldsValueTypeSchema),
  preferredPharmacy: z.record(FormFieldsValueTypeSchema),
  employerInformation: z.record(FormFieldsValueTypeSchema),
});

const hiddenFormFields: Record<string, string[]> = {
  patientSummary: ['patient-ssn'],
  patientDetails: [],
  patientContactInformation: [],
  insurance: [],
  primaryCarePhysician: [],
  responsibleParty: [],
  emergencyContact: [],
  preferredPharmacy: [],
  employerInformation: [],
};

const requiredFormFields: Record<string, string[]> = {
  patientSummary: ['patient-first-name', 'patient-last-name', 'patient-birthdate'],
  patientDetails: [],
  patientContactInformation: [],
  insurance: [],
  primaryCarePhysician: [],
  responsibleParty: [],
  emergencyContact: [],
  preferredPharmacy: [],
  employerInformation: [],
};

const hiddenFormSections: string[] = [];

const PATIENT_RECORD_DEFAULTS = {
  ehrPatientRecordForm,
  hiddenFormFields,
  requiredFormFields,
  formValueSets,
  hiddenFormSections,
  FormFields,
};

const mergedPatientRecordConfig = mergeAndFreezeConfigObjects(PATIENT_RECORD_DEFAULTS, OVERRIDES);

type FormFieldKey = keyof typeof mergedPatientRecordConfig.FormFields;
const RequiredFieldsSchema = z.record(z.custom<FormFieldKey>(), z.array(z.string()));
const HiddenFieldsSchema = z.record(z.custom<FormFieldKey>(), z.array(z.string()));

const PatientRecordConfigSchema = z.object({
  ehrPatientRecordForm: z.object({
    url: z.string().url().optional(),
    version: z.string().optional(),
    templateQuestionnaire: z.custom<Questionnaire>().optional(),
  }),
  hiddenFormFields: HiddenFieldsSchema,
  requiredFormFields: RequiredFieldsSchema,
  hiddenFormSections: z.array(z.string()),
  formValueSets: z.record(
    z.string(),
    z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      })
    )
  ),
  FormFields: FormFieldsSchema,
});

export const PATIENT_RECORD_CONFIG = PatientRecordConfigSchema.parse(mergedPatientRecordConfig);

const prepopulateLogicalFields = (questionnaire: Questionnaire): QuestionnaireResponseItem[] => {
  const shouldShowSSNField = !hiddenFormFields.patientSummary.includes('patient-ssn');
  const ssnRequired = shouldShowSSNField && requiredFormFields.patientSummary.includes('patient-ssn');

  const item: QuestionnaireResponseItem[] = (questionnaire.item ?? []).map((item) => {
    const populatedItem: QuestionnaireResponseItem[] = (() => {
      const itemItems = (item.item ?? []).filter((i: QuestionnaireItem) => i.type !== 'display');
      return itemItems.map((item) => {
        let answer: QuestionnaireResponseItemAnswer[] | undefined;
        const { linkId } = item;

        if (linkId === 'should-display-ssn-field') {
          answer = makeAnswer(shouldShowSSNField, 'Boolean');
        }
        if (linkId === 'ssn-field-required') {
          answer = makeAnswer(ssnRequired, 'Boolean');
        }

        return {
          linkId,
          answer,
        };
      });
    })();
    return {
      linkId: item.linkId,
      item: populatedItem,
    };
  });

  return item;
};

export const prepopulatePatientRecordItems = (
  input: PrePopulationFromPatientRecordInput
): QuestionnaireResponseItem[] => {
  if (!input) {
    return [];
  }

  const q = input.questionnaire;
  const logicalFieldItems = prepopulateLogicalFields(q);
  const patientRecordItems = makePrepopulatedItemsFromPatientRecord({ ...input, overriddenItems: logicalFieldItems });

  return patientRecordItems;
};
