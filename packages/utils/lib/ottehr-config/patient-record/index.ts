import { Questionnaire, QuestionnaireItem, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';
import _ from 'lodash';
import { z } from 'zod';
import { PATIENT_RECORD_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';
import {
  makeAnswer,
  makePrepopulatedItemsFromPatientRecord,
  ORG_TYPE_CODE_SYSTEM,
  ORG_TYPE_PAYER_CODE,
  PrePopulationFromPatientRecordInput,
} from '../../main';
import { AnswerOptionSourceSchema, QuestionnaireDataTypeSchema } from '../../types/data/paperwork';
import { mergeAndFreezeConfigObjects } from '../helpers';
import { VALUE_SETS as formValueSets } from '../value-sets';

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

const InsuredPersonNotSelfTrigger: FormFieldTrigger = {
  targetQuestionLinkId: 'patient-relationship-to-insured',
  effect: ['enable'],
  operator: '!=',
  answerString: formValueSets.relationshipToInsuredOptions[0].value,
};
const InsuredAddressNotSameAsPatientTrigger: FormFieldTrigger = {
  targetQuestionLinkId: 'policy-holder-address-as-patient',
  effect: ['enable'],
  operator: '!=',
  answerBoolean: true,
};

const InsuredPersonNotSelfTrigger2: FormFieldTrigger = {
  targetQuestionLinkId: 'patient-relationship-to-insured-2',
  effect: ['enable'],
  operator: '!=',
  answerString: formValueSets.relationshipToInsuredOptions[0].value,
};
const InsuredAddressNotSameAsPatientTrigger2: FormFieldTrigger = {
  targetQuestionLinkId: 'policy-holder-address-as-patient-2',
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
        label: 'Other gender identity',
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
        label: 'Other language',
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
        insuranceCarrier: {
          key: 'insurance-carrier',
          type: 'reference',
          label: 'Insurance carrier',
          dataSource: {
            answerSource: {
              resourceType: 'Organization',
              query: `type=${ORG_TYPE_CODE_SYSTEM}|${ORG_TYPE_PAYER_CODE}`,
              prependedIdentifier: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            },
          },
        },
        insurancePlanType: {
          key: 'insurance-plan-type',
          type: 'choice',
          label: 'Insurance type',
          options: insurancePlanTypeOptions,
        },
        memberId: { key: 'insurance-member-id', type: 'string', label: 'Member ID' },
        firstName: {
          key: 'policy-holder-first-name',
          type: 'string',
          label: "Policy holder's first name",
          triggers: [InsuredPersonNotSelfTrigger],
          dynamicPopulation: { sourceLinkId: 'patient-first-name' },
        },
        middleName: {
          key: 'policy-holder-middle-name',
          type: 'string',
          label: "Policy holder's middle name",
          triggers: [InsuredPersonNotSelfTrigger],
          dynamicPopulation: { sourceLinkId: 'patient-middle-name' },
        },
        lastName: {
          key: 'policy-holder-last-name',
          type: 'string',
          label: "Policy holder's last name",
          triggers: [InsuredPersonNotSelfTrigger],
          dynamicPopulation: { sourceLinkId: 'patient-last-name' },
        },
        birthDate: {
          key: 'policy-holder-date-of-birth',
          type: 'date',
          label: "Policy holder's date of birth",
          dataType: 'DOB',
          triggers: [InsuredPersonNotSelfTrigger],
          dynamicPopulation: { sourceLinkId: 'patient-birthdate' },
        },
        birthSex: {
          key: 'policy-holder-birth-sex',
          type: 'choice',
          label: "Policy holder's birth sex",
          options: formValueSets.birthSexOptions,
          triggers: [InsuredPersonNotSelfTrigger],
          dynamicPopulation: { sourceLinkId: 'patient-birth-sex' },
        },
        policyHolderAddressAsPatient: {
          key: 'policy-holder-address-as-patient',
          type: 'boolean',
          label: "Policy holder address is the same as patient's address",
          triggers: [InsuredPersonNotSelfTrigger],
        },
        streetAddress: {
          key: 'policy-holder-address',
          type: 'string',
          label: "Policy holder's address",
          triggers: [InsuredPersonNotSelfTrigger, InsuredAddressNotSameAsPatientTrigger],
          dynamicPopulation: { sourceLinkId: 'patient-street-address' },
          enableBehavior: 'all',
        },
        addressLine2: {
          key: 'policy-holder-address-additional-line',
          type: 'string',
          label: "Policy holder's address line 2",
          triggers: [InsuredPersonNotSelfTrigger, InsuredAddressNotSameAsPatientTrigger],
          dynamicPopulation: { sourceLinkId: 'patient-street-address-2' },
          enableBehavior: 'all',
        },
        city: {
          key: 'policy-holder-city',
          type: 'string',
          label: 'City',
          triggers: [InsuredPersonNotSelfTrigger, InsuredAddressNotSameAsPatientTrigger],
          dynamicPopulation: { sourceLinkId: 'patient-city' },
          enableBehavior: 'all',
        },
        state: {
          key: 'policy-holder-state',
          type: 'choice',
          label: 'State',
          options: formValueSets.stateOptions,
          triggers: [InsuredPersonNotSelfTrigger, InsuredAddressNotSameAsPatientTrigger],
          dynamicPopulation: { sourceLinkId: 'patient-state' },
          enableBehavior: 'all',
        },
        zip: {
          key: 'policy-holder-zip',
          type: 'string',
          label: 'ZIP',
          dataType: 'ZIP',
          triggers: [InsuredPersonNotSelfTrigger, InsuredAddressNotSameAsPatientTrigger],
          dynamicPopulation: { sourceLinkId: 'patient-zip' },
          enableBehavior: 'all',
        },
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
        insuranceCarrier: {
          key: 'insurance-carrier-2',
          type: 'reference',
          label: 'Insurance carrier',
          dataSource: {
            answerSource: {
              resourceType: 'Organization',
              query: `type=${ORG_TYPE_CODE_SYSTEM}|${ORG_TYPE_PAYER_CODE}`,
              prependedIdentifier: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            },
          },
        },
        insurancePlanType: {
          key: 'insurance-plan-type-2',
          type: 'choice',
          label: 'Insurance type',
          options: insurancePlanTypeOptions,
        },
        memberId: { key: 'insurance-member-id-2', type: 'string', label: 'Member ID' },
        firstName: {
          key: 'policy-holder-first-name-2',
          type: 'string',
          label: "Policy holder's first name",
          triggers: [InsuredPersonNotSelfTrigger2],
          dynamicPopulation: { sourceLinkId: 'patient-first-name' },
        },
        middleName: {
          key: 'policy-holder-middle-name-2',
          type: 'string',
          label: "Policy holder's middle name",
          triggers: [InsuredPersonNotSelfTrigger2],
          dynamicPopulation: { sourceLinkId: 'patient-middle-name' },
        },
        lastName: {
          key: 'policy-holder-last-name-2',
          type: 'string',
          label: "Policy holder's last name",
          triggers: [InsuredPersonNotSelfTrigger2],
          dynamicPopulation: { sourceLinkId: 'patient-last-name' },
        },
        birthDate: {
          key: 'policy-holder-date-of-birth-2',
          type: 'date',
          label: "Policy holder's date of birth",
          dataType: 'DOB',
          triggers: [InsuredPersonNotSelfTrigger2],
          dynamicPopulation: { sourceLinkId: 'patient-birthdate' },
        },
        birthSex: {
          key: 'policy-holder-birth-sex-2',
          type: 'choice',
          label: "Policy holder's birth sex",
          options: formValueSets.birthSexOptions,
          triggers: [InsuredPersonNotSelfTrigger2],
          dynamicPopulation: { sourceLinkId: 'patient-birth-sex' },
        },
        policyHolderAddressAsPatient: {
          key: 'policy-holder-address-as-patient-2',
          type: 'boolean',
          label: "Policy holder address is the same as patient's address",
          triggers: [InsuredPersonNotSelfTrigger2],
        },
        streetAddress: {
          key: 'policy-holder-address-2',
          type: 'string',
          label: "Policy holder's address",
          triggers: [InsuredPersonNotSelfTrigger2, InsuredAddressNotSameAsPatientTrigger2],
          dynamicPopulation: { sourceLinkId: 'patient-street-address' },
          enableBehavior: 'all',
        },
        addressLine2: {
          key: 'policy-holder-address-additional-line-2',
          type: 'string',
          label: "Policy holder's address line 2",
          triggers: [InsuredPersonNotSelfTrigger2, InsuredAddressNotSameAsPatientTrigger2],
          dynamicPopulation: { sourceLinkId: 'patient-street-address-2' },
          enableBehavior: 'all',
        },
        city: {
          key: 'policy-holder-city-2',
          type: 'string',
          label: 'City',
          triggers: [InsuredPersonNotSelfTrigger2, InsuredAddressNotSameAsPatientTrigger2],
          dynamicPopulation: { sourceLinkId: 'patient-city' },
          enableBehavior: 'all',
        },
        state: {
          key: 'policy-holder-state-2',
          type: 'choice',
          label: 'State',
          options: formValueSets.stateOptions,
          triggers: [InsuredPersonNotSelfTrigger2, InsuredAddressNotSameAsPatientTrigger2],
          dynamicPopulation: { sourceLinkId: 'patient-state' },
          enableBehavior: 'all',
        },
        zip: {
          key: 'policy-holder-zip-2',
          type: 'string',
          label: 'ZIP',
          dataType: 'ZIP',
          triggers: [InsuredPersonNotSelfTrigger2, InsuredAddressNotSameAsPatientTrigger2],
          dynamicPopulation: { sourceLinkId: 'patient-zip' },
          enableBehavior: 'all',
        },
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
      active: { key: 'pcp-active', type: 'boolean', label: "Patient doesn't have a PCP at this time" },
      firstName: {
        key: 'pcp-first',
        type: 'string',
        label: 'First name',
        triggers: [{ targetQuestionLinkId: 'pcp-active', effect: ['enable'], operator: '=', answerBoolean: true }],
        disabledDisplay: 'hidden',
      },
      lastName: {
        key: 'pcp-last',
        type: 'string',
        label: 'Last name',
        triggers: [{ targetQuestionLinkId: 'pcp-active', effect: ['enable'], operator: '=', answerBoolean: true }],
        disabledDisplay: 'hidden',
      },
      practiceName: {
        key: 'pcp-practice',
        type: 'string',
        label: 'Practice name',
        triggers: [
          { targetQuestionLinkId: 'pcp-active', effect: ['require', 'enable'], operator: '=', answerBoolean: true },
        ],
        disabledDisplay: 'hidden',
      },
      address: {
        key: 'pcp-address',
        type: 'string',
        label: 'Address',
        triggers: [{ targetQuestionLinkId: 'pcp-active', effect: ['enable'], operator: '=', answerBoolean: true }],
        disabledDisplay: 'hidden',
      },
      phone: {
        key: 'pcp-number',
        type: 'string',
        label: 'Mobile',
        dataType: 'Phone Number',
        triggers: [{ targetQuestionLinkId: 'pcp-active', effect: ['enable'], operator: '=', answerBoolean: true }],
        disabledDisplay: 'hidden',
      },
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
      contactFirstName: { key: 'employer-contact-first-name', type: 'string', label: 'First name' },
      contactLastName: { key: 'employer-contact-last-name', type: 'string', label: 'Last name' },
      contactTitle: { key: 'employer-contact-title', type: 'string', label: 'Title' },
      contactEmail: { key: 'employer-contact-email', type: 'string', label: 'Email', dataType: 'Email' },
      contactPhone: { key: 'employer-contact-phone', type: 'string', label: 'Phone', dataType: 'Phone Number' },
      contactFax: { key: 'employer-contact-fax', type: 'string', label: 'Fax', dataType: 'Phone Number' },
    },
  },
  attorneyInformation: {
    linkId: 'attorney-mva-page',
    title: 'Attorney for Motor Vehicle Accident',
    items: {
      firm: { key: 'attorney-mva-firm', type: 'string', label: 'Firm' },
      firstName: { key: 'attorney-mva-first-name', type: 'string', label: 'First name' },
      lastName: { key: 'attorney-mva-last-name', type: 'string', label: 'Last name' },
      email: { key: 'attorney-mva-email', type: 'string', label: 'Email', dataType: 'Email' },
      mobile: { key: 'attorney-mva-mobile', type: 'string', label: 'Mobile', dataType: 'Phone Number' },
      fax: { key: 'attorney-mva-fax', type: 'string', label: 'Fax', dataType: 'Phone Number' },
    },
  },
  hiddenFields: [],
  requiredFields: [],
};

const ReferenceDataSourceSchema = z
  .object({
    answerSource: AnswerOptionSourceSchema.optional(),
    valueSet: z.string().optional(),
  })
  .refine(
    (data) => {
      return data.answerSource !== undefined || data.valueSet !== undefined;
    },
    {
      message: 'Either answerSource or valueSet must be provided',
    }
  );

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
    dataSource: ReferenceDataSourceSchema.optional(),
    triggers: z.array(triggerSchema).optional(),
    dynamicPopulation: dynamicPopulationSchema.optional(),
    enableBehavior: z.enum(['all', 'any']).default('any').optional(),
    disabledDisplay: z.enum(['hidden', 'disabled']).default('disabled'),
  })
  .refine(
    (data) => {
      if (data.type === 'choice') {
        return (
          Array.isArray(data.options) || {
            message: 'Options must be provided for choice types',
          }
        );
      }
      return true;
    },
    {
      message: 'Options must be provided for choice types',
    }
  )
  .refine(
    (data) => {
      if (data.type === 'reference') {
        return data.dataSource !== undefined;
      }
      return true;
    },
    {
      message: 'dataSource must be provided for reference types',
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
  attorneyInformation: FormSectionSimpleSchema,
});

const hiddenFormSections: string[] = [];

const QuestionnaireBaseSchema = z.object({
  resourceType: z.literal('Questionnaire'),
  url: z.string(),
  version: z.string(),
  name: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'active', 'retired', 'unknown']),
});
export type QuestionnaireBase = z.infer<typeof QuestionnaireBaseSchema>;

const questionnaireBaseDefaults: QuestionnaireBase = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/fhir/Questionnaire/patient-record',
  version: '1.0.0',
  name: 'PatientRecordQuestionnaire',
  title: 'Patient Record Questionnaire',
  status: 'active',
};

const PATIENT_RECORD_DEFAULTS = {
  questionnaireBase: questionnaireBaseDefaults,
  hiddenFormSections,
  FormFields,
};

const mergedPatientRecordConfig = mergeAndFreezeConfigObjects(PATIENT_RECORD_DEFAULTS, OVERRIDES);

//type FormFieldKey = keyof typeof mergedPatientRecordConfig.FormFields;

const PatientRecordConfigSchema = z.object({
  questionnaireBase: QuestionnaireBaseSchema,
  hiddenFormSections: z.array(z.string()),
  FormFields: FormFieldsSchema,
});
type PatientRecordConfigType = z.infer<typeof PatientRecordConfigSchema>;

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

const createDataTypeExtension = (dataType: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
  valueString: dataType,
});

const createDisabledDisplayExtension = (display: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
  valueString: display,
});

const createFillFromWhenDisabledExtension = (
  sourceLinkId: string
): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
  valueString: sourceLinkId,
});

const createRequireWhenExtension = (
  trigger: FormFieldTrigger
): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
  extension: [
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
      valueString: trigger.targetQuestionLinkId,
    },
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
      valueString: trigger.operator,
    },
    ...(trigger.answerBoolean !== undefined
      ? [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
            valueBoolean: trigger.answerBoolean,
          },
        ]
      : []),
    ...(trigger.answerString !== undefined
      ? [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
            valueString: trigger.answerString,
          },
        ]
      : []),
  ],
});

const createAnswerLoadingOptionsExtension = (
  dataSource: any
): NonNullable<QuestionnaireItem['extension']>[number] | undefined => {
  const { answerSource } = dataSource;
  if (!answerSource) return undefined;

  return {
    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/answer-loading-options',
    extension: [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/strategy',
        valueString: 'dynamic',
      },
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/source',
        valueExpression: {
          language: 'application/x-fhir-query',
          expression: `${answerSource.resourceType}?${answerSource.query}`,
        },
      },
    ],
  };
};

const createEnableWhen = (trigger: FormFieldTrigger): QuestionnaireItem['enableWhen'] => {
  const enableWhen: any = {
    question: trigger.targetQuestionLinkId,
    operator: trigger.operator,
  };

  if (trigger.answerBoolean !== undefined) {
    enableWhen.answerBoolean = trigger.answerBoolean;
  } else if (trigger.answerString !== undefined) {
    enableWhen.answerString = trigger.answerString;
  } else if (trigger.answerDateTime !== undefined) {
    enableWhen.answerDateTime = trigger.answerDateTime;
  }

  return enableWhen;
};

const convertFormFieldToQuestionnaireItem = (field: FormFieldsItem, isRequired: boolean): QuestionnaireItem => {
  const item: QuestionnaireItem = {
    linkId: field.key,
    type: field.type === 'reference' ? 'choice' : (field.type as any),
  };

  // Add text if label is provided
  if (field.label) {
    item.text = field.label;
  }

  // Add required flag
  item.required = isRequired;

  // Add answer options for choice types
  if (field.type === 'choice' && field.options) {
    item.answerOption = field.options.map((opt) => ({ valueString: opt.value }));
  }

  // Handle reference type for dynamic data source
  if (field.type === 'reference' && field.dataSource) {
    item.answerOption = [{ valueString: '09' }]; // Placeholder, will be replaced dynamically
    const answerLoadingExt = createAnswerLoadingOptionsExtension(field.dataSource);
    if (answerLoadingExt) {
      item.extension = [answerLoadingExt];
    }
  }

  // Add extensions
  const extensions: any[] = item.extension ? [...item.extension] : [];

  if (field.dataType) {
    extensions.push(createDataTypeExtension(field.dataType));
  }

  if (field.disabledDisplay && field.disabledDisplay !== 'disabled') {
    extensions.push(createDisabledDisplayExtension(field.disabledDisplay));
  }

  if (field.dynamicPopulation) {
    extensions.push(createFillFromWhenDisabledExtension(field.dynamicPopulation.sourceLinkId));
    if (!field.disabledDisplay) {
      extensions.push(createDisabledDisplayExtension('protected'));
    }
  }

  // Add enableWhen from triggers
  if (field.triggers && field.triggers.length > 0) {
    const enableTriggers = field.triggers.filter((t) => t.effect.includes('enable'));
    if (enableTriggers.length > 0) {
      item.enableWhen = enableTriggers.flatMap((i) => createEnableWhen(i)!);
    }

    // Add require-when extension
    const requireTriggers = field.triggers.filter((t) => t.effect.includes('require'));
    if (requireTriggers.length > 0) {
      requireTriggers.forEach((trigger) => {
        extensions.push(createRequireWhenExtension(trigger));
      });
    }

    // Add enableBehavior if specified
    if (field.enableBehavior && item.enableWhen && item.enableWhen.length > 1) {
      item.enableBehavior = field.enableBehavior;
    }
  }

  if (extensions.length > 0) {
    item.extension = extensions;
  }

  return item;
};

const createLogicalFields = (): QuestionnaireItem[] => {
  return [
    {
      linkId: 'should-display-ssn-field',
      type: 'boolean',
      required: false,
      readOnly: true,
      initial: [{ valueBoolean: false }],
    },
    {
      linkId: 'ssn-field-required',
      type: 'boolean',
      required: false,
      readOnly: true,
    },
  ];
};

export const createQuestionnaireItemFromPatientRecordConfig = (
  config: PatientRecordConfigType
): Questionnaire['item'] => {
  const questionnaireItems: QuestionnaireItem[] = [];

  // Define the order of sections as they appear in the JSON
  const sectionOrder = [
    'patientSummary',
    'patientContactInformation',
    'patientDetails',
    'primaryCarePhysician',
    'insurance',
    'responsibleParty',
    'employerInformation',
    'attorneyInformation',
    'emergencyContact',
    'preferredPharmacy',
  ] as const;

  for (const sectionKey of sectionOrder) {
    const section = config.FormFields[sectionKey];
    if (!section) continue;

    // Handle array-based sections (like insurance)
    if (Array.isArray(section.linkId)) {
      section.linkId.forEach((linkId, index) => {
        const items = Array.isArray(section.items) ? section.items[index] : section.items;
        const groupItem: QuestionnaireItem = {
          linkId,
          type: 'group',
          text: section.title,
          repeats: true,
          item: [],
        };

        // Add special logical fields for patient summary section
        if (sectionKey === 'patientSummary' && index === 0) {
          groupItem.item = createLogicalFields();
        }

        // Convert each field to a questionnaire item
        for (const [, field] of Object.entries(items)) {
          const isRequired = section.requiredFields?.includes(field.key) ?? false;
          const questionnaireItem = convertFormFieldToQuestionnaireItem(field, isRequired);
          groupItem.item!.push(questionnaireItem);
        }

        questionnaireItems.push(groupItem);
      });
    } else {
      // Handle simple sections
      const groupItem: QuestionnaireItem = {
        linkId: section.linkId,
        type: 'group',
        text: section.title,
        item: [],
      };

      // Add special logical fields for patient summary section
      if (sectionKey === 'patientSummary') {
        groupItem.item = createLogicalFields();
      }

      // Convert each field to a questionnaire item
      for (const [, field] of Object.entries(section.items)) {
        const isRequired = section.requiredFields?.includes(field.key) ?? false;
        const questionnaireItem = convertFormFieldToQuestionnaireItem(field, isRequired);
        groupItem.item!.push(questionnaireItem);
      }

      questionnaireItems.push(groupItem);
    }
  }

  // Add user settings section at the end
  questionnaireItems.push({
    linkId: 'user-settings-section',
    type: 'group',
    text: 'User settings',
    item: [],
  });

  return questionnaireItems;
};

const createQuestionnaireFromPatientRecordConfig = (config: PatientRecordConfigType): Questionnaire => {
  return {
    ...config.questionnaireBase,
    item: createQuestionnaireItemFromPatientRecordConfig(config),
  };
};

export const PATIENT_RECORD_QUESTIONNAIRE = (): Questionnaire =>
  JSON.parse(JSON.stringify(createQuestionnaireFromPatientRecordConfig(PATIENT_RECORD_CONFIG)));
