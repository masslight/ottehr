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
import { mergeAndFreezeConfigObjects } from '../helpers';
import {
  createQuestionnaireFromConfig,
  FormFieldTrigger,
  FormSectionArraySchema,
  FormSectionSimpleSchema,
  QuestionnaireBase,
  QuestionnaireConfigSchema,
} from '../shared-questionnaire';
import { VALUE_SETS as formValueSets } from '../value-sets';

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
    logicalItems: {
      shouldDisplaySsnField: {
        key: 'should-display-ssn-field',
        type: 'boolean',
        initialValue: false,
      },
      ssnFieldRequired: {
        key: 'ssn-field-required',
        type: 'boolean',
      },
    },
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
        triggers: [
          {
            targetQuestionLinkId: 'should-display-ssn-field',
            effect: ['enable'],
            operator: '=',
            answerBoolean: true,
          },
          {
            targetQuestionLinkId: 'ssn-field-required',
            effect: ['require'],
            operator: '=',
            answerBoolean: true,
          },
        ],
        disabledDisplay: 'hidden',
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
    hiddenFields: [],
    requiredFields: [],
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
    hiddenFields: [],
    requiredFields: [],
  },
};

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

const PatientRecordConfigSchema = QuestionnaireConfigSchema.extend({
  FormFields: FormFieldsSchema,
});

export const PATIENT_RECORD_CONFIG = PatientRecordConfigSchema.parse(mergedPatientRecordConfig);
const prepopulateLogicalFields = (questionnaire: Questionnaire): QuestionnaireResponseItem[] => {
  const shouldShowSSNField = !(
    PATIENT_RECORD_CONFIG.FormFields.patientSummary.hiddenFields?.includes('patient-ssn') ?? false
  );
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

  return item.flatMap((i) => i.item ?? []).filter((i) => i.answer !== undefined);
};

export const prepopulatePatientRecordItems = (
  input: PrePopulationFromPatientRecordInput
): QuestionnaireResponseItem[] => {
  if (!input) {
    return [];
  }

  const q = input.questionnaire;
  const logicalFieldItems = prepopulateLogicalFields(q);
  // todo: this is exported from another util file, but only used here. probably want to move it and
  // consolidate the interface exposed to the rest of the system.
  const patientRecordItems = makePrepopulatedItemsFromPatientRecord({ ...input, overriddenItems: logicalFieldItems });

  return patientRecordItems;
};
export const PATIENT_RECORD_QUESTIONNAIRE = (): Questionnaire =>
  JSON.parse(JSON.stringify(createQuestionnaireFromConfig(PATIENT_RECORD_CONFIG)));
