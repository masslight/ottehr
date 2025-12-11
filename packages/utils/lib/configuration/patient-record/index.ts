import { Questionnaire, QuestionnaireItem, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';
import _ from 'lodash';
import { z } from 'zod';
import patientRecordQuestionnaire from '../../../../../config/oystehr/ehr-insurance-update-questionnaire.json' assert { type: 'json' };
import { PATIENT_RECORD_OVERRIDES as OVERRIDES } from '../../../.ottehr_config';
import { makeAnswer, makePrepopulatedItemsFromPatientRecord, PrePopulationFromPatientRecordInput } from '../../main';
import { QuestionnaireDataTypeSchema } from '../../types/data/paperwork';
import { mergeAndFreezeConfigObjects } from '../helpers';
import { VALUE_SETS as formValueSets } from '../value-sets';

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
const triggerEffectSchema = z.enum(['enable', 'require']);
const triggerSchema = z
  .object({
    targetQuestionLinkId: z.string(),
    effect: z.array(triggerEffectSchema),
    operator: z.enum(['exists', '=', '!=', '>', '<', '>=', '<=']),
    answerBoolean: z.boolean().optional(),
    answerString: z.string().optional(),
    answerDateTime: z.string().optional(),
  })
  .refine(
    (data) => {
      const definedAnswers = [data.answerBoolean, data.answerString, data.answerDateTime].filter(
        (answer) => answer !== undefined
      );
      return definedAnswers.length === 1;
    },
    {
      message: 'Exactly one of answerBoolean, answerString, or answerDecimal must be defined',
    }
  );

export type FormFieldTrigger = z.infer<typeof triggerSchema>;

const dynamicPopulationSchema = z.object({
  sourceLinkId: z.string(),
  // currently only supporting population when disabled, could see this evolve to a more flexible system where the trigger eval logic kicks off dynamic population
  triggerState: z.literal('disabled').optional().default('disabled'),
});

// patient record fields

const insurancePlanTypeOptions = formValueSets.insuranceTypeOptions.map((option) => ({
  label: `${option.candidCode} - ${option.label}`,
  value: option.candidCode,
}));

const RPNotSelfTrigger: FormFieldTrigger = {
  targetQuestionLinkId: 'responsible-party-relationship',
  effect: ['enable'],
  operator: '!=',
  answerString: 'Self',
};

const RPAddressAsPatientTrigger: FormFieldTrigger = {
  targetQuestionLinkId: 'responsible-party-address-as-patient',
  effect: ['enable'],
  operator: '!=',
  answerBoolean: true,
};

const FormFields = {
  patientSummary: {
    linkId: 'patient-info-section',
    title: 'Patient summary',
    items: {
      firstName: { key: 'patient-first-name', type: 'string', label: 'First name' },
      middleName: { key: 'patient-middle-name', type: 'string', label: 'Middle name' },
      lastName: { key: 'patient-last-name', type: 'string', label: 'Last name' },
      suffix: { key: 'patient-name-suffix', type: 'string', label: 'Suffix' },
      preferredName: { key: 'patient-preferred-name', type: 'string', label: 'Preferred name' },
      birthDate: { key: 'patient-birthdate', type: 'date', label: 'Date of birth', dataType: 'DOB' },
      birthSex: {
        key: 'patient-birth-sex',
        type: 'choice',
        label: 'Birth sex',
        options: formValueSets.birthSexOptions,
      },
      pronouns: {
        key: 'patient-pronouns',
        type: 'choice',
        label: 'Preferred pronouns',
        options: formValueSets.pronounOptions,
      },
      ssn: {
        key: 'patient-ssn',
        type: 'string',
        label: 'SSN',
        dataType: 'SSN',
        /*triggers: [
          {
            targetQuestionLinkId: 'should-display-ssn-field',
            effect: ['enable', 'require'],
            operator: '=',
            answerBoolean: true,
          },
        ],
        disabledDisplay: 'hidden',
        */
      },
    },
    hiddenFields: [],
    requiredFields: ['patient-first-name', 'patient-last-name', 'patient-birthdate', 'patient-birth-sex'],
  },
  patientDetails: {
    linkId: 'patient-additional-details-section',
    title: 'Patient details',
    items: {
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
        label: 'Please specify gender identity',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'patient-gender-identity',
            effect: ['require', 'enable'],
            operator: '=',
            answerString: formValueSets.genderIdentityOptions[formValueSets.genderIdentityOptions.length - 1].value,
          },
        ],
        disabledDisplay: 'hidden',
      },
      language: {
        key: 'preferred-language',
        label: 'Preferred language',
        type: 'choice',
        options: formValueSets.languageOptions,
      },
      otherLanguage: {
        key: 'other-preferred-language',
        label: 'Please specify other language',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'preferred-language',
            effect: ['require', 'enable'],
            operator: '=',
            answerString: formValueSets.languageOptions[formValueSets.languageOptions.length - 1].value,
          },
        ],
        disabledDisplay: 'hidden',
      },
      sendMarketing: { key: 'mobile-opt-in', label: 'Send marketing messages', type: 'boolean' },
      pointOfDiscovery: {
        key: 'patient-point-of-discovery',
        label: 'How did you hear about us?',
        type: 'choice',
        options: formValueSets.pointOfDiscoveryOptions,
      },
      commonWellConsent: { key: 'common-well-consent', label: 'CommonWell consent', type: 'boolean' },
    },
    hiddenFields: [],
    requiredFields: ['patient-ethnicity', 'patient-race'],
  },
  patientContactInformation: {
    linkId: 'patient-contact-info-section',
    title: 'Patient contact information',
    items: {
      streetAddress: { key: 'patient-street-address', type: 'string', label: 'Street address' },
      addressLine2: { key: 'patient-street-address-2', type: 'string', label: 'Address line 2' },
      city: { key: 'patient-city', type: 'string', label: 'City' },
      state: { key: 'patient-state', type: 'choice', label: 'State', options: formValueSets.stateOptions },
      zip: { key: 'patient-zip', type: 'string', label: 'ZIP', dataType: 'ZIP' },
      email: { key: 'patient-email', type: 'string', label: 'Patient email', dataType: 'Email' },
      phone: { key: 'patient-number', type: 'string', label: 'Patient mobile', dataType: 'Phone Number' },
      preferredCommunicationMethod: {
        key: 'patient-preferred-communication-method',
        type: 'choice',
        label: 'Preferred communication method',
        options: formValueSets.preferredCommunicationMethodOptions,
      },
    },
    hiddenFields: [],
    requiredFields: [
      'patient-street-address',
      'patient-city',
      'patient-zip',
      'patient-state',
      'patient-email',
      'patient-number',
      'patient-preferred-communication-method',
    ],
  },
  insurance: {
    linkId: ['insurance-section', 'insurance-section-2'],
    title: 'Insurance information',
    items: [
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
          options: insurancePlanTypeOptions,
        },
        memberId: { key: 'insurance-member-id', type: 'string', label: 'Member ID' },
        firstName: { key: 'policy-holder-first-name', type: 'string', label: "Policy holder's first name" },
        middleName: { key: 'policy-holder-middle-name', type: 'string', label: "Policy holder's middle name" },
        lastName: { key: 'policy-holder-last-name', type: 'string', label: "Policy holder's last name" },
        birthDate: {
          key: 'policy-holder-date-of-birth',
          type: 'date',
          label: "Policy holder's date of birth",
          dataType: 'DOB',
        },
        birthSex: {
          key: 'policy-holder-birth-sex',
          type: 'choice',
          label: "Policy holder's birth sex",
          options: formValueSets.birthSexOptions,
        },
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
        zip: { key: 'policy-holder-zip', type: 'string', label: 'ZIP', dataType: 'ZIP' },
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
        insurancePlanType: {
          key: 'insurance-plan-type-2',
          type: 'choice',
          label: 'Insurance type',
          options: insurancePlanTypeOptions,
        },
        memberId: { key: 'insurance-member-id-2', type: 'string', label: 'Member ID' },
        firstName: { key: 'policy-holder-first-name-2', type: 'string', label: "Policy holder's first name" },
        middleName: { key: 'policy-holder-middle-name-2', type: 'string', label: "Policy holder's middle name" },
        lastName: { key: 'policy-holder-last-name-2', type: 'string', label: "Policy holder's last name" },
        birthDate: {
          key: 'policy-holder-date-of-birth-2',
          type: 'date',
          label: "Policy holder's date of birth",
          dataType: 'DOB',
        },
        birthSex: {
          key: 'policy-holder-birth-sex-2',
          type: 'choice',
          label: "Policy holder's birth sex",
          options: formValueSets.birthSexOptions,
        },
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
        state: { key: 'policy-holder-state-2', type: 'choice', label: 'State', options: formValueSets.stateOptions },
        zip: { key: 'policy-holder-zip-2', type: 'string', label: 'ZIP', dataType: 'ZIP' },
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
    hiddenFields: [],
    requiredFields: [
      'insurance-carrier',
      'insurance-plan-type',
      'insurance-member-id',
      'policy-holder-first-name',
      'policy-holder-last-name',
      'policy-holder-date-of-birth',
      'policy-holder-birth-sex',
      'policy-holder-address',
      'policy-holder-city',
      'policy-holder-state',
      'policy-holder-zip',
      'patient-relationship-to-insured',
      'insurance-priority',
      // assuming it won't be a problem to have the fields from both insurance sections in the same array here since the two fields behave
      // identically when they're included
      'insurance-carrier-2',
      'insurance-plan-type-2',
      'insurance-member-id-2',
      'policy-holder-first-name-2',
      'policy-holder-last-name-2',
      'policy-holder-date-of-birth-2',
      'policy-holder-birth-sex-2',
      'policy-holder-address-2',
      'policy-holder-city-2',
      'policy-holder-state-2',
      'policy-holder-zip-2',
      'patient-relationship-to-insured-2',
      'insurance-priority-2',
    ],
  },
  primaryCarePhysician: {
    linkId: 'primary-care-physician-section',
    title: 'Primary care physician',
    items: {
      firstName: {
        key: 'pcp-first',
        type: 'string',
        label: 'First name',
        triggers: [{ targetQuestionLinkId: 'pcp-active', effect: ['require'], operator: '=', answerBoolean: true }],
      },
      lastName: {
        key: 'pcp-last',
        type: 'string',
        label: 'Last name',
        triggers: [{ targetQuestionLinkId: 'pcp-active', effect: ['require'], operator: '=', answerBoolean: true }],
      },
      practiceName: { key: 'pcp-practice', type: 'string', label: 'Practice name' },
      address: { key: 'pcp-address', type: 'string', label: 'Address' },
      phone: { key: 'pcp-number', type: 'string', label: 'Mobile', dataType: 'Phone Number' },
      active: { key: 'pcp-active', type: 'boolean', label: "Patient doesn't have a PCP at this time" },
    },
    hiddenFields: [],
    requiredFields: [],
  },
  responsibleParty: {
    linkId: 'responsible-party-section',
    title: 'Responsible party information',
    items: {
      relationship: {
        key: 'responsible-party-relationship',
        type: 'choice',
        label: 'Relationship to the patient',
        options: formValueSets.relationshipOptions,
      },
      firstName: {
        key: 'responsible-party-first-name',
        type: 'string',
        label: 'First name',
        triggers: [RPNotSelfTrigger],
        dynamicPopulation: { sourceLinkId: 'patient-first-name' },
      },
      lastName: {
        key: 'responsible-party-last-name',
        type: 'string',
        label: 'Last name',
        triggers: [RPNotSelfTrigger],
        dynamicPopulation: { sourceLinkId: 'patient-last-name' },
      },
      birthDate: {
        key: 'responsible-party-date-of-birth',
        type: 'date',
        label: 'Date of birth',
        dataType: 'DOB',
        triggers: [RPNotSelfTrigger],
        dynamicPopulation: { sourceLinkId: 'patient-birthdate' },
      },
      birthSex: {
        key: 'responsible-party-birth-sex',
        type: 'choice',
        label: 'Birth sex',
        options: formValueSets.birthSexOptions,
        triggers: [RPNotSelfTrigger],
        dynamicPopulation: { sourceLinkId: 'patient-birth-sex' },
      },
      phone: {
        key: 'responsible-party-number',
        type: 'string',
        label: 'Phone',
        dataType: 'Phone Number',
        triggers: [RPNotSelfTrigger],
        dynamicPopulation: { sourceLinkId: 'patient-number' },
      },
      email: {
        key: 'responsible-party-email',
        type: 'string',
        label: 'Email',
        dataType: 'Email',
        triggers: [RPNotSelfTrigger],
        dynamicPopulation: { sourceLinkId: 'patient-email' },
      },
      addressSameAsPatient: {
        key: 'responsible-party-address-as-patient',
        label: "Responsible party's address is the same as patient's address",
        type: 'boolean',
        triggers: [RPNotSelfTrigger],
      },
      addressLine1: {
        key: 'responsible-party-address',
        type: 'string',
        label: 'Street Address',
        triggers: [RPNotSelfTrigger, RPAddressAsPatientTrigger],
        enableBehavior: 'all',
        dynamicPopulation: { sourceLinkId: 'patient-street-address' },
      },
      addressLine2: {
        key: 'responsible-party-address-2',
        type: 'string',
        label: 'Address line 2',
        triggers: [RPNotSelfTrigger, RPAddressAsPatientTrigger],
        enableBehavior: 'all',
        dynamicPopulation: { sourceLinkId: 'patient-street-address-2' },
      },
      city: {
        key: 'responsible-party-city',
        type: 'string',
        label: 'City',
        triggers: [RPNotSelfTrigger, RPAddressAsPatientTrigger],
        enableBehavior: 'all',
        dynamicPopulation: { sourceLinkId: 'patient-city' },
      },
      state: {
        key: 'responsible-party-state',
        type: 'choice',
        label: 'State',
        options: formValueSets.stateOptions,
        triggers: [RPNotSelfTrigger, RPAddressAsPatientTrigger],
        enableBehavior: 'all',
        dynamicPopulation: { sourceLinkId: 'patient-state' },
      },
      zip: {
        key: 'responsible-party-zip',
        type: 'string',
        label: 'Zip',
        dataType: 'ZIP',
        triggers: [RPNotSelfTrigger, RPAddressAsPatientTrigger],
        enableBehavior: 'all',
        dynamicPopulation: { sourceLinkId: 'patient-zip' },
      },
    },
    hiddenFields: [],
    requiredFields: [
      'responsible-party-relationship',
      'responsible-party-first-name',
      'responsible-party-last-name',
      'responsible-party-date-of-birth',
      'responsible-party-address',
      'responsible-party-city',
      'responsible-party-state',
      'responsible-party-zip',
      'responsible-party-email',
    ],
  },
  emergencyContact: {
    linkId: 'emergency-contact-section',
    title: 'Emergency contact information',
    items: {
      relationship: {
        key: 'emergency-contact-relationship',
        type: 'choice',
        label: 'Relationship to the patient',
        options: formValueSets.emergencyContactRelationshipOptions,
      },
      firstName: { key: 'emergency-contact-first-name', type: 'string', label: 'First name' },
      middleName: { key: 'emergency-contact-middle-name', type: 'string', label: 'Middle name' },
      lastName: { key: 'emergency-contact-last-name', type: 'string', label: 'Last name' },
      phone: { key: 'emergency-contact-number', type: 'string', label: 'Phone', dataType: 'Phone Number' },
      addressAsPatient: {
        key: 'emergency-contact-address-as-patient',
        type: 'boolean',
        label: "Emergency contact address is the same as patient's address",
      },
      streetAddress: { key: 'emergency-contact-address', type: 'string', label: 'Street address' },
      addressLine2: { key: 'emergency-contact-address-2', type: 'string', label: 'Address line 2 (optional)' },
      city: { key: 'emergency-contact-city', type: 'string', label: 'City' },
      state: { key: 'emergency-contact-state', type: 'choice', label: 'State', options: formValueSets.stateOptions },
      zip: { key: 'emergency-contact-zip', type: 'string', label: 'Zip', dataType: 'ZIP' },
    },
    hiddenFields: [],
    requiredFields: [
      'emergency-contact-relationship',
      'emergency-contact-first-name',
      'emergency-contact-last-name',
      'emergency-contact-number',
    ],
  },
  preferredPharmacy: {
    linkId: 'preferred-pharmacy-section',
    title: 'Preferred pharmacy',
    items: {
      name: { key: 'pharmacy-name', type: 'string', label: 'Pharmacy name' },
      address: { key: 'pharmacy-address', type: 'string', label: 'Pharmacy address' },
    },
    hiddenFields: [],
    requiredFields: [],
  },
  employerInformation: {
    linkId: 'employer-information-page',
    title: 'Employer information',
    items: {
      employerName: { key: 'employer-name', type: 'string', label: 'Employer name' },
      addressLine1: { key: 'employer-address', type: 'string', label: 'Address line 1' },
      addressLine2: { key: 'employer-address-2', type: 'string', label: 'Address line 2' },
      city: { key: 'employer-city', type: 'string', label: 'City' },
      state: { key: 'employer-state', type: 'choice', label: 'State', options: formValueSets.stateOptions },
      zip: { key: 'employer-zip', type: 'string', label: 'ZIP', dataType: 'ZIP' },
      contactFirstName: { key: 'employer-contact-first-name', type: 'string', label: 'Contact first name' },
      contactLastName: { key: 'employer-contact-last-name', type: 'string', label: 'Contact last name' },
      contactTitle: { key: 'employer-contact-title', type: 'string', label: 'Contact title' },
      contactEmail: { key: 'employer-contact-email', type: 'string', label: 'Contact email', dataType: 'Email' },
      contactPhone: { key: 'employer-contact-phone', type: 'string', label: 'Contact phone', dataType: 'Phone Number' },
      contactFax: { key: 'employer-contact-fax', type: 'string', label: 'Contact fax', dataType: 'Phone Number' },
    },
  },
  hiddenFields: [],
  requiredFields: [],
};

const FormFieldsValueTypeSchema = z
  .object({
    key: z.string(),
    type: z.enum(['string', 'date', 'choice', 'boolean', 'reference']),
    label: z.string(),
    dataType: QuestionnaireDataTypeSchema.optional(),
    options: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        })
      )
      .optional(),
    triggers: z.array(triggerSchema).optional(),
    dynamicPopulation: dynamicPopulationSchema.optional(),
    enableBehavior: z.enum(['all', 'any']).default('any').optional(),
    disabledDisplay: z.enum(['hidden', 'disabled']).default('disabled'),
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

export const FormFieldItemRecordSchema = z.record(FormFieldsValueTypeSchema);
export type FormFieldItemRecord = z.infer<typeof FormFieldItemRecordSchema>;
export const FormSectionSimpleSchema = z.object({
  linkId: z.string(),
  title: z.string(),
  items: FormFieldItemRecordSchema,
  hiddenFields: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
});

const FormSectionArraySchema = z.object({
  linkId: z.array(z.string()),
  title: z.string(),
  items: z.array(FormFieldItemRecordSchema),
  hiddenFields: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
});

export type FormFieldSection = z.infer<typeof FormSectionSimpleSchema> | z.infer<typeof FormSectionArraySchema>;

const FormFieldsSchema = z.object({
  patientSummary: FormSectionSimpleSchema,
  patientDetails: FormSectionSimpleSchema,
  patientContactInformation: FormSectionSimpleSchema,
  insurance: FormSectionArraySchema,
  primaryCarePhysician: FormSectionSimpleSchema,
  responsibleParty: FormSectionSimpleSchema,
  emergencyContact: FormSectionSimpleSchema,
  preferredPharmacy: FormSectionSimpleSchema,
  employerInformation: FormSectionSimpleSchema,
});

const hiddenFormSections: string[] = [];

const PATIENT_RECORD_DEFAULTS = {
  ehrPatientRecordForm,
  formValueSets,
  hiddenFormSections,
  FormFields,
};

const mergedPatientRecordConfig = mergeAndFreezeConfigObjects(PATIENT_RECORD_DEFAULTS, OVERRIDES);

//type FormFieldKey = keyof typeof mergedPatientRecordConfig.FormFields;

const PatientRecordConfigSchema = z.object({
  ehrPatientRecordForm: z.object({
    url: z.string().url().optional(),
    version: z.string().optional(),
    templateQuestionnaire: z.custom<Questionnaire>().optional(),
  }),
  hiddenFormSections: z.array(z.string()),
  FormFields: FormFieldsSchema,
});

export const PATIENT_RECORD_CONFIG = PatientRecordConfigSchema.parse(mergedPatientRecordConfig);

const prepopulateLogicalFields = (questionnaire: Questionnaire): QuestionnaireResponseItem[] => {
  const shouldShowSSNField = !PATIENT_RECORD_CONFIG.FormFields.patientSummary.hiddenFields?.includes('patient-ssn');
  const ssnRequired =
    shouldShowSSNField && PATIENT_RECORD_CONFIG.FormFields.patientSummary.requiredFields?.includes('patient-ssn');

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
