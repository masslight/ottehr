import { Questionnaire } from 'fhir/r4b';
import z from 'zod';
import { INTAKE_PAPERWORK_CONFIG as OVERRIDES } from '../../../ottehr-config-overrides/intake-paperwork-virtual';
import { INSURANCE_CARD_CODE } from '../../types/data/paperwork/paperwork.constants';
import { mergeAndFreezeConfigObjects } from '../helpers';
import {
  ALLERGIES_YES_OPTION,
  createQuestionnaireFromConfig,
  FormSectionSimpleSchema,
  HAS_ATTORNEY_OPTION,
  INSURANCE_PAY_OPTION,
  OCC_MED_SELF_PAY_OPTION,
  QuestionnaireBase,
  QuestionnaireConfigSchema,
  SELF_PAY_OPTION,
  SURGICAL_HISTORY_YES_OPTION,
} from '../shared-questionnaire';
import { VALUE_SETS as formValueSets } from '../value-sets';

/*

SOURCE QUESTIONNAIRE CONTEXT
 {
                "linkId": "other-preferred-language",
                "text": "Other preferred language",
                "type": "string",
                "required": false,
                "enableWhen": [
                  {
                    "question": "preferred-language",
                    "operator": "=",
                    "answerString": "Other"
                  }
                ]
              },
              {
                "linkId": "relay-phone",
                "text": "Do you require a Hearing Impaired Relay Service? (711)",
                "type": "choice",
                "answerOption": [
                  {
                    "valueString": "No"
                  },
                  {
                    "valueString": "Yes"
                  }
                ],
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/preferred-element",
                    "valueString": "Radio List"
                  }
                ]
              }


*/

const FormFields = {
  contactInformation: {
    linkId: 'contact-information-page',
    title: 'Contact information',
    logicalItems: {
      patientWillBe18: {
        key: 'patient-will-be-18',
        type: 'boolean',
      },
      isNewQRSPatient: {
        key: 'is-new-qrs-patient',
        type: 'boolean',
      },
      patientFirstName: {
        key: 'patient-first-name',
        type: 'string',
      },
      patientLastName: {
        key: 'patient-last-name',
        type: 'string',
      },
      patientBirthDate: {
        key: 'patient-birthdate',
        type: 'date',
        dataType: 'DOB',
      },
      patientBirthSex: {
        key: 'patient-birth-sex',
        type: 'choice',
        options: formValueSets.birthSexOptions,
      },
      patientBirthSexMissing: {
        key: 'patient-birth-sex-missing',
        type: 'boolean',
        required: false,
      },
      appointmentServiceCategory: {
        key: 'appointment-service-category',
        type: 'string',
      },
      reasonForVisit: {
        key: 'reason-for-visit',
        type: 'choice',
        options: formValueSets.reasonForVisitOptions,
      },
    },
    items: {
      addressText: {
        key: 'contact-page-address-text',
        text: 'Primary address',
        type: 'display',
        element: 'h3',
      },
      streetAddress: {
        key: 'patient-street-address',
        label: 'Street address',
        type: 'string',
        autocomplete: 'section-contact-information shipping address-line1',
      },
      streetAddress2: {
        key: 'patient-street-address-2',
        label: 'Address line 2 (optional)',
        type: 'string',
        autocomplete: 'section-contact-information shipping address-line2',
      },
      city: {
        key: 'patient-city',
        label: 'City',
        type: 'string',
        inputWidth: 's',
        autocomplete: 'section-contact-information shipping address-level2',
      },
      state: {
        key: 'patient-state',
        label: 'State',
        type: 'choice',
        options: formValueSets.stateOptions,
        inputWidth: 's',
      },
      zip: {
        key: 'patient-zip',
        label: 'ZIP',
        type: 'string',
        dataType: 'ZIP',
        inputWidth: 's',
        autocomplete: 'section-contact-information shipping postal-code',
      },
      contactAdditionalCaption: {
        key: 'patient-contact-additional-caption',
        text: 'Please provide the information for the best point of contact regarding this reservation.',
        type: 'display',
        element: 'p',
      },
      email: {
        key: 'patient-email',
        label: 'Email',
        type: 'string',
        dataType: 'Email',
        autocomplete: 'section-patient shipping email',
      },
      phoneNumber: {
        key: 'patient-number',
        label: 'Mobile',
        type: 'string',
        dataType: 'Phone Number',
        autocomplete: 'section-patient shipping tel',
      },
      preferredCommunicationMethod: {
        key: 'patient-preferred-communication-method',
        label: 'Preferred Communication Method',
        type: 'choice',
        options: formValueSets.preferredCommunicationMethodOptions,
      },
      mobileOptIn: {
        key: 'mobile-opt-in',
        label:
          'Yes! I would like to receive helpful text messages from Ottehr regarding patient education, events, and general information about our offices. Message frequency varies, and data rates may apply.',
        type: 'boolean',
      },
    },
    hiddenFields: [],
    requiredFields: [
      'patient-street-address',
      'patient-city',
      'patient-state',
      'patient-zip',
      'patient-email',
      'patient-number',
      'patient-preferred-communication-method',
    ],
  },
  patientDetails: {
    linkId: 'patient-details-page',
    title: 'Patient details',
    items: {
      ethnicity: {
        key: 'patient-ethnicity',
        label: 'Ethnicity',
        type: 'choice',
        options: formValueSets.ethnicityOptions,
      },
      race: {
        key: 'patient-race',
        label: 'Race',
        type: 'choice',
        options: formValueSets.raceOptions,
      },
      pronouns: {
        key: 'patient-pronouns',
        label: 'Preferred pronouns',
        type: 'choice',
        options: formValueSets.pronounOptions,
        infoTextSecondary:
          'Pronoun responses are kept confidential in our system and are used to help us best respect how our patients wish to be addressed.',
      },
      pronounsCustom: {
        key: 'patient-pronouns-custom',
        label: 'My pronouns',
        type: 'text',
        triggers: [
          {
            targetQuestionLinkId: 'patient-pronouns',
            effect: ['enable'],
            operator: '=',
            answerString: 'My pronouns are not listed',
          },
        ],
      },
      additionalText: {
        key: 'patient-details-additional-text',
        text: 'Additional information',
        type: 'display',
        element: 'h3',
      },
      pointOfDiscovery: {
        key: 'patient-point-of-discovery',
        label: 'How did you hear about us?',
        type: 'choice',
        options: formValueSets.pointOfDiscoveryOptions,
        triggers: [
          {
            targetQuestionLinkId: 'is-new-qrs-patient',
            effect: ['enable'],
            operator: '=',
            answerBoolean: true,
          },
        ],
        disabledDisplay: 'hidden',
      },
      preferredLanguage: {
        key: 'preferred-language',
        label: 'Preferred language',
        type: 'choice',
        options: formValueSets.languageOptions,
      },
      otherPreferredLanguage: {
        key: 'other-preferred-language',
        label: 'Other preferred language',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'preferred-language',
            effect: ['enable'],
            operator: '=',
            answerString: 'Other',
          },
        ],
      },
      relayPhone: {
        key: 'relay-phone',
        label: 'Do you require a Hearing Impaired Relay Service? (711)',
        type: 'choice',
        options: formValueSets.yesNoOptions,
        element: 'Radio List',
      },
    },
    hiddenFields: [],
    requiredFields: ['patient-ethnicity', 'patient-race', 'preferred-language', 'relay-phone'],
  },
  primaryCarePhysician: {
    linkId: 'primary-care-physician-page',
    title: 'Primary Care Physician',
    items: {
      firstName: {
        key: 'pcp-first',
        label: 'Provider first name',
        type: 'string',
        inputWidth: 'm',
        autocomplete: 'section-pcp shipping given-name',
      },
      lastName: {
        key: 'pcp-last',
        label: 'Provider last name',
        type: 'string',
        inputWidth: 'm',
        autocomplete: 'section-pcp shipping family-name',
      },
      practiceName: {
        key: 'pcp-practice',
        label: 'Practice name',
        type: 'string',
      },
      address: {
        key: 'pcp-address',
        label: 'Address',
        type: 'string',
        placeholder: 'Street address, City, State, ZIP',
        autocomplete: 'section-pcp shipping street-address',
      },
      phoneNumber: {
        key: 'pcp-number',
        label: 'Phone number',
        type: 'string',
        dataType: 'Phone Number',
        autocomplete: 'section-pcp shipping tel',
      },
    },
    hiddenFields: [],
    requiredFields: [],
  },
  pharmacy: {
    linkId: 'pharmacy-page',
    title: 'Preferred pharmacy',
    items: {
      name: {
        key: 'pharmacy-name',
        label: 'Pharmacy name',
        type: 'string',
      },
      address: {
        key: 'pharmacy-address',
        label: 'Pharmacy address',
        type: 'string',
      },
    },
    hiddenFields: [],
    requiredFields: [],
  },
  currentMedications: {
    linkId: 'current-medications-page',
    title: 'Current medications',
    items: {
      yesNo: {
        key: 'current-medications-yes-no',
        label: 'Select option',
        type: 'choice',
        element: 'Radio',
        options: formValueSets.currentMedicationsYesNoOptions,
      },
      medications: {
        key: 'current-medications',
        text: 'Medications taken',
        required: false,
        type: 'group',
        groupType: 'list-with-form',
        triggers: [
          {
            targetQuestionLinkId: 'current-medications-yes-no',
            effect: ['enable'],
            operator: '=',
            answerString: 'Patient takes medication currently',
          },
          {
            targetQuestionLinkId: 'current-medications-yes-no',
            effect: ['filter'],
            operator: '!=',
            answerString: 'Patient takes medication currently',
          },
        ],
        items: {
          header: {
            key: 'current-medications-form-header',
            text: 'Add medication',
            type: 'display',
            element: 'h4',
          },
          medication: {
            key: 'current-medications-form-medication',
            label: 'Medication',
            type: 'open-choice',
            options: formValueSets.currentMedicationsOptions,
            acceptsMultipleAnswers: true,
          },
        },
        requiredFields: ['current-medications-form-medication'],
      },
    },
    requiredFields: ['current-medications-yes-no'],
  },
  allergies: {
    linkId: 'allergies-page',
    title: 'Current allergies',
    items: {
      yesNo: {
        key: 'allergies-yes-no',
        label: 'Select option',
        type: 'choice',
        element: 'Radio',
        options: formValueSets.allergiesYesNoOptions,
      },
      allergiesList: {
        key: 'allergies',
        text: 'Known current allergies',
        required: false,
        type: 'group',
        groupType: 'list-with-form',
        triggers: [
          {
            targetQuestionLinkId: 'allergies-yes-no',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: ALLERGIES_YES_OPTION,
          },
          {
            targetQuestionLinkId: 'allergies-yes-no',
            effect: ['filter'],
            operator: '!=',
            answerString: ALLERGIES_YES_OPTION,
          },
        ],
        items: {
          header: {
            key: 'allergies-form-header',
            text: 'Add allergy',
            type: 'display',
            element: 'h4',
          },
          type: {
            key: 'allergies-form-type',
            label: 'Type',
            type: 'choice',
            element: 'Radio List',
            options: formValueSets.allergyTypeOptions,
            alwaysFilter: true,
          },
          agentSubstanceMedications: {
            key: 'allergies-form-agent-substance-medications',
            label: 'Agent/Substance',
            type: 'open-choice',
            options: formValueSets.allergyMedicationOptions,
            customLinkId: 'allergies-form-agent-substance',
            acceptsMultipleAnswers: true,
            categoryTag: 'Medication',
            disabledDisplay: 'hidden',
            triggers: [
              {
                targetQuestionLinkId: 'allergies.allergies-form-type',
                effect: ['enable', 'require'],
                operator: '=',
                answerString: 'Medications',
              },
            ],
          },
          agentSubstanceOther: {
            key: 'allergies-form-agent-substance-other',
            label: 'Agent/Substance',
            type: 'open-choice',
            options: formValueSets.allergyOtherOptions,
            customLinkId: 'allergies-form-agent-substance',
            acceptsMultipleAnswers: true,
            categoryTag: 'Other',
            disabledDisplay: 'hidden',
            triggers: [
              {
                targetQuestionLinkId: 'allergies.allergies-form-type',
                effect: ['enable', 'require'],
                operator: '=',
                answerString: 'Other',
              },
            ],
          },
        },
        requiredFields: ['allergies-form-type'],
      },
    },
    requiredFields: ['allergies-yes-no'],
  },
  medicalHistory: {
    linkId: 'medical-history-page',
    title: 'Medical history',
    items: {
      yesNo: {
        key: 'medical-history-yes-no',
        label: 'Select option',
        type: 'choice',
        element: 'Radio',
        options: formValueSets.medicalHistoryYesNoOptions,
      },
      medicalConditions: {
        key: 'medical-history',
        text: 'Current medical conditions',
        required: true,
        type: 'group',
        groupType: 'list-with-form',
        triggers: [
          {
            targetQuestionLinkId: 'medical-history-yes-no',
            effect: ['enable'],
            operator: '=',
            answerString: 'Patient has current medical conditions',
          },
          {
            targetQuestionLinkId: 'medical-history-yes-no',
            effect: ['filter'],
            operator: '!=',
            answerString: 'Patient has current medical conditions',
          },
        ],
        items: {
          header: {
            key: 'medical-history-form-header',
            text: 'Add medical conditions',
            type: 'display',
            element: 'h4',
          },
          medicalCondition: {
            key: 'medical-history-form-medical-condition',
            label: 'Medical condition',
            type: 'open-choice',
            options: formValueSets.medicalConditionOptions,
            acceptsMultipleAnswers: true,
          },
        },
        requiredFields: ['medical-history-form-medical-condition'],
      },
    },
    requiredFields: ['medical-history-yes-no'],
  },
  surgicalHistory: {
    linkId: 'surgical-history-page',
    title: 'Surgical history',
    items: {
      yesNo: {
        key: 'surgical-history-yes-no',
        label: 'Select option',
        type: 'choice',
        element: 'Radio',
        options: formValueSets.surgicalHistoryYesNoOptions,
      },
      surgeries: {
        key: 'surgical-history',
        text: 'Surgeries',
        required: false,
        type: 'group',
        groupType: 'list-with-form',
        triggers: [
          {
            targetQuestionLinkId: 'surgical-history-yes-no',
            effect: ['enable'],
            operator: '=',
            answerString: SURGICAL_HISTORY_YES_OPTION,
          },
          {
            targetQuestionLinkId: 'surgical-history-yes-no',
            effect: ['filter'],
            operator: '!=',
            answerString: SURGICAL_HISTORY_YES_OPTION,
          },
        ],
        items: {
          header: {
            key: 'surgical-history-form-header',
            text: 'Add surgery',
            type: 'display',
            element: 'h4',
          },
          surgeryType: {
            key: 'surgical-history-form-type',
            label: 'Type of surgery',
            type: 'open-choice',
            options: formValueSets.surgeryTypeOptions,
            acceptsMultipleAnswers: true,
          },
        },
        requiredFields: ['surgical-history-form-type'],
      },
    },
    requiredFields: ['surgical-history-yes-no'],
  },
  additional: {
    linkId: 'additional-page',
    title: 'Additional questions',
    items: {
      covidSymptoms: {
        key: 'covid-symptoms',
        label: 'Do you have any COVID symptoms?',
        type: 'choice',
        element: 'Radio List',
        options: formValueSets.yesNoOptions,
      },
      testedPositiveCovid: {
        key: 'tested-positive-covid',
        label: 'Have you tested positive for COVID?',
        type: 'choice',
        element: 'Radio List',
        options: formValueSets.yesNoOptions,
      },
      travelUsa: {
        key: 'travel-usa',
        label: 'Have you traveled out of the USA in the last 2 weeks?',
        type: 'choice',
        element: 'Radio List',
        options: formValueSets.yesNoOptions,
      },
    },
    hiddenFields: [],
    requiredFields: [],
  },
  paymentOption: {
    linkId: 'payment-option-page',
    title: 'How would you like to pay for your visit?',
    reviewText: 'Insurance details',
    triggers: [
      {
        targetQuestionLinkId: 'contact-information-page.appointment-service-category',
        effect: ['enable'],
        operator: '!=',
        answerString: 'occupational-medicine',
      },
    ],
    enableBehavior: 'all',
    items: {
      paymentOption: {
        key: 'payment-option',
        label: 'Select payment option',
        type: 'choice',
        element: 'Radio',
        options: formValueSets.patientPaymentPageOptions,
      },
      selfPayAlert: {
        key: 'self-pay-alert-text',
        text: 'By choosing to proceed with self-pay without insurance, you agree to pay $100 at the time of service.',
        type: 'display',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable'],
            operator: '=',
            answerString: SELF_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'appointment-service-category',
            effect: ['sub-text'],
            operator: '=',
            answerString: 'workers-comp',
            substituteText:
              'By clicking "Continue," I acknowledge that if my employer or their Workers Compensation insurer does not pay for this visit, I am responsible for the charges and may self-pay or have the charges submitted to my personal insurance.',
          },
        ],
      },
      insuranceDetailsText: {
        key: 'insurance-details-text',
        text: 'Insurance details',
        type: 'display',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      insuranceDetailsCaption: {
        key: 'insurance-details-caption',
        text: 'We use this information to help determine your coverage and costs.',
        type: 'display',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      insuranceCarrier: {
        key: 'insurance-carrier',
        label: 'Insurance carrier',
        type: 'reference',
        dataSource: {
          answerSource: {
            resourceType: 'Organization',
            query: 'active:not=false&type=http://terminology.hl7.org/CodeSystem/organization-type|pay',
          },
        },
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      insuranceMemberId: {
        key: 'insurance-member-id',
        label: 'Member ID',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      policyHolderFirstName: {
        key: 'policy-holder-first-name',
        label: "Policy holder's first name",
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      policyHolderMiddleName: {
        key: 'policy-holder-middle-name',
        label: "Policy holder's middle name",
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      policyHolderLastName: {
        key: 'policy-holder-last-name',
        label: "Policy holder's last name",
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      policyHolderDateOfBirth: {
        key: 'policy-holder-date-of-birth',
        label: "Policy holder's date of birth",
        type: 'date',
        dataType: 'DOB',
        disabledDisplay: 'hidden',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      policyHolderBirthSex: {
        key: 'policy-holder-birth-sex',
        label: "Policy holder's birth sex",
        type: 'choice',
        options: formValueSets.birthSexOptions,
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      policyHolderAddressAsPatient: {
        key: 'policy-holder-address-as-patient',
        label: "Policy holder address is the same as patient's address",
        type: 'boolean',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      policyHolderAddress: {
        key: 'policy-holder-address',
        label: 'Policy holder address',
        type: 'string',
        disabledDisplay: 'hidden',
        dynamicPopulation: { sourceLinkId: 'patient-street-address' },
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'policy-holder-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
        enableBehavior: 'all',
      },
      policyHolderAddressAdditionalLine: {
        key: 'policy-holder-address-additional-line',
        label: 'Policy holder address line 2 (optional)',
        type: 'string',
        disabledDisplay: 'hidden',
        dynamicPopulation: { sourceLinkId: 'patient-street-address-2' },
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'policy-holder-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
        enableBehavior: 'all',
      },
      policyHolderCity: {
        key: 'policy-holder-city',
        label: 'City',
        type: 'string',
        inputWidth: 's',
        disabledDisplay: 'hidden',
        dynamicPopulation: { sourceLinkId: 'patient-city' },
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'policy-holder-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
        enableBehavior: 'all',
      },
      policyHolderState: {
        key: 'policy-holder-state',
        label: 'State',
        type: 'choice',
        options: formValueSets.stateOptions,
        inputWidth: 's',
        disabledDisplay: 'hidden',
        dynamicPopulation: { sourceLinkId: 'patient-state' },
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'policy-holder-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
        enableBehavior: 'all',
      },
      policyHolderZip: {
        key: 'policy-holder-zip',
        label: 'Zip',
        type: 'string',
        dataType: 'ZIP',
        inputWidth: 's',
        disabledDisplay: 'hidden',
        dynamicPopulation: { sourceLinkId: 'patient-zip' },
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'policy-holder-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
        enableBehavior: 'all',
      },
      patientRelationshipToInsured: {
        key: 'patient-relationship-to-insured',
        label: "Patient's relationship to insured",
        type: 'choice',
        options: formValueSets.relationshipToInsuredOptions,
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      insuranceCardFront: {
        key: 'insurance-card-front',
        label: 'Front side of the insurance card (optional)',
        type: 'attachment',
        attachmentText: 'Take a picture of the **front side** of your card and upload it here',
        dataType: 'Image',
        documentType: INSURANCE_CARD_CODE,
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      insuranceCardBack: {
        key: 'insurance-card-back',
        label: 'Back side of the insurance card',
        type: 'attachment',
        attachmentText: 'Take a picture of the **back side** of your card and upload it here',
        dataType: 'Image',
        documentType: INSURANCE_CARD_CODE,
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
        ],
      },
      displaySecondaryInsurance: {
        key: 'display-secondary-insurance',
        label: 'Add secondary insurance',
        type: 'boolean',
        element: 'Button',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['filter'],
            operator: '!=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'display-secondary-insurance',
            effect: ['sub-text'],
            operator: '=',
            answerBoolean: true,
            substituteText: 'Remove Secondary Insurance',
          },
        ],
      },
      secondaryInsurance: {
        key: 'secondary-insurance',
        type: 'group',
        text: 'Secondary insurance',
        items: {
          insuranceDetailsText: {
            key: 'insurance-details-text-2',
            text: 'Secondary insurance details',
            type: 'display',
          },
          insuranceCarrier: {
            key: 'insurance-carrier-2',
            label: 'Insurance carrier',
            type: 'reference',
            dataSource: {
              answerSource: {
                resourceType: 'Organization',
                query: 'active:not=false&type=http://terminology.hl7.org/CodeSystem/organization-type|pay',
              },
            },
            triggers: [
              {
                targetQuestionLinkId: 'payment-option',
                effect: ['filter'],
                operator: '!=',
                answerString: INSURANCE_PAY_OPTION,
              },
            ],
          },
          insuranceMemberId: {
            key: 'insurance-member-id-2',
            label: 'Member ID',
            type: 'string',
          },
          policyHolderFirstName: {
            key: 'policy-holder-first-name-2',
            label: "Policy holder's first name",
            type: 'string',
          },
          policyHolderMiddleName: {
            key: 'policy-holder-middle-name-2',
            label: "Policy holder's middle name",
            type: 'string',
          },
          policyHolderLastName: {
            key: 'policy-holder-last-name-2',
            label: "Policy holder's last name",
            type: 'string',
          },
          policyHolderDateOfBirth: {
            key: 'policy-holder-date-of-birth-2',
            label: "Policy holder's date of birth",
            type: 'date',
            dataType: 'DOB',
          },
          policyHolderBirthSex: {
            key: 'policy-holder-birth-sex-2',
            label: "Policy holder's birth sex",
            type: 'choice',
            options: formValueSets.birthSexOptions,
          },
          policyHolderAddressAsPatient: {
            key: 'policy-holder-address-as-patient-2',
            label: "Policy holder address is the same as patient's address",
            type: 'boolean',
          },
          policyHolderAddress: {
            key: 'policy-holder-address-2',
            label: 'Policy holder address',
            type: 'string',
            disabledDisplay: 'hidden',
            dynamicPopulation: { sourceLinkId: 'patient-street-address' },
            triggers: [
              {
                targetQuestionLinkId: 'secondary-insurance.policy-holder-address-as-patient-2',
                effect: ['enable'],
                operator: '!=',
                answerBoolean: true,
              },
            ],
          },
          policyHolderAddressAdditionalLine: {
            key: 'policy-holder-address-additional-line-2',
            label: 'Policy holder address line 2 (optional)',
            type: 'string',
            disabledDisplay: 'hidden',
            dynamicPopulation: { sourceLinkId: 'patient-street-address-2' },
            triggers: [
              {
                targetQuestionLinkId: 'secondary-insurance.policy-holder-address-as-patient-2',
                effect: ['enable'],
                operator: '!=',
                answerBoolean: true,
              },
            ],
          },
          policyHolderCity: {
            key: 'policy-holder-city-2',
            label: 'City',
            type: 'string',
            inputWidth: 's',
            disabledDisplay: 'hidden',
            dynamicPopulation: { sourceLinkId: 'patient-city' },
            triggers: [
              {
                targetQuestionLinkId: 'secondary-insurance.policy-holder-address-as-patient-2',
                effect: ['enable'],
                operator: '!=',
                answerBoolean: true,
              },
            ],
          },
          policyHolderState: {
            key: 'policy-holder-state-2',
            label: 'State',
            type: 'choice',
            options: formValueSets.stateOptions,
            inputWidth: 's',
            disabledDisplay: 'hidden',
            dynamicPopulation: { sourceLinkId: 'patient-state' },
            triggers: [
              {
                targetQuestionLinkId: 'secondary-insurance.policy-holder-address-as-patient-2',
                effect: ['enable'],
                operator: '!=',
                answerBoolean: true,
              },
            ],
          },
          policyHolderZip: {
            key: 'policy-holder-zip-2',
            label: 'ZIP',
            type: 'string',
            dataType: 'ZIP',
            inputWidth: 's',
            disabledDisplay: 'hidden',
            dynamicPopulation: { sourceLinkId: 'patient-zip' },
            triggers: [
              {
                targetQuestionLinkId: 'secondary-insurance.policy-holder-address-as-patient-2',
                effect: ['enable'],
                operator: '!=',
                answerBoolean: true,
              },
            ],
            enableBehavior: 'all',
          },
          patientRelationshipToInsured: {
            key: 'patient-relationship-to-insured-2',
            label: "Patient's relationship to insured",
            type: 'choice',
            options: formValueSets.relationshipToInsuredOptions,
          },
          insuranceCardFront: {
            key: 'insurance-card-front-2',
            label: 'Front side of the insurance card (optional)',
            type: 'attachment',
            attachmentText: 'Take a picture of the **front side** of your card and upload it here',
            dataType: 'Image',
            documentType: INSURANCE_CARD_CODE,
          },
          insuranceCardBack: {
            key: 'insurance-card-back-2',
            label: 'Back side of the insurance card',
            type: 'attachment',
            attachmentText: 'Take a picture of the **back side** of your card and upload it here',
            dataType: 'Image',
            documentType: INSURANCE_CARD_CODE,
          },
        },
        triggers: [
          {
            targetQuestionLinkId: 'display-secondary-insurance',
            effect: ['enable'],
            operator: '=',
            answerBoolean: true,
          },
          {
            targetQuestionLinkId: 'payment-option',
            effect: ['enable'],
            operator: '=',
            answerString: INSURANCE_PAY_OPTION,
          },
          {
            targetQuestionLinkId: 'display-secondary-insurance',
            effect: ['filter'],
            operator: '!=',
            answerBoolean: true,
          },
        ],
        enableBehavior: 'all',
      },
    },
    hiddenFields: [],
    requiredFields: [
      'payment-option',
      'insurance-carrier-2',
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
    ],
  },
  paymentOptionOccMed: {
    linkId: 'payment-option-occ-med-page',
    title: 'Who is paying for the visit?',
    reviewText: 'Insurance details',
    triggers: [
      {
        targetQuestionLinkId: 'contact-information-page.appointment-service-category',
        effect: ['enable'],
        operator: '=',
        answerString: 'occupational-medicine',
      },
    ],
    items: {
      paymentOption: {
        key: 'payment-option-occupational',
        label: 'Select payment option',
        type: 'choice',
        element: 'Radio',
        options: formValueSets.patientOccMedPaymentPageOptions,
      },
      selfPayAlert: {
        key: 'self-pay-alert-text-occupational',
        text: 'By choosing to proceed with self-pay without insurance, you agree to pay $100 at the time of service.',
        type: 'display',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option-occupational',
            effect: ['enable'],
            operator: '=',
            answerString: OCC_MED_SELF_PAY_OPTION,
          },
        ],
      },
    },
    hiddenFields: [],
    requiredFields: ['payment-option-occupational'],
  },
  occupationalMedicineEmployerInformation: {
    linkId: 'occupational-medicine-employer-information-page',
    title: 'Employer information',
    triggers: [
      {
        targetQuestionLinkId: 'contact-information-page.appointment-service-category',
        effect: ['enable'],
        operator: '=',
        answerString: 'occupational-medicine',
      },
    ],
    items: {
      employer: {
        key: 'occupational-medicine-employer',
        label: 'Employer',
        type: 'reference',
        dataSource: {
          answerSource: {
            resourceType: 'Organization',
            query:
              'active:not=false&type=http://terminology.hl7.org/CodeSystem/organization-type|occupational-medicine-employer',
          },
        },
      },
    },
    hiddenFields: [],
    requiredFields: [],
  },
  cardPayment: {
    linkId: 'card-payment-page',
    title: 'Credit card details',
    items: {
      validCardOnFile: {
        key: 'valid-card-on-file',
        label: '',
        type: 'boolean',
        dataType: 'Payment Validation',
      },
      detailsText: {
        key: 'card-payment-details-text',
        text: 'If you choose not to enter your credit card information in advance, payment (cash or credit) will be required upon arrival.',
        type: 'display',
        triggers: [
          {
            targetQuestionLinkId: 'card-payment-details-text',
            effect: ['enable'],
            operator: '=',
            answerString: '-',
          },
        ],
      },
    },
    hiddenFields: [],
    requiredFields: [],
    triggers: [
      {
        targetQuestionLinkId: 'contact-information-page.appointment-service-category',
        effect: ['enable'],
        operator: '!=',
        answerString: 'occupational-medicine',
      },
      {
        targetQuestionLinkId: 'payment-option-occ-med-page.payment-option-occupational',
        effect: ['enable'],
        operator: '=',
        answerString: OCC_MED_SELF_PAY_OPTION,
      },
    ],
    enableBehavior: 'any',
  },
  responsibleParty: {
    linkId: 'responsible-party-page',
    title: 'Responsible party information',
    items: {
      caption: {
        key: 'responsible-party-page-caption',
        text: "A responsible party is the individual responsible for the visit's financial obligations. If the patient is not their own responsible party, then the responsible party must be the patient's legal guardian or legal designee.",
        type: 'display',
        element: 'p',
      },
      relationship: {
        key: 'responsible-party-relationship',
        label: 'Relationship to the patient',
        type: 'choice',
        options: formValueSets.relationshipOptions,
      },
      firstName: {
        key: 'responsible-party-first-name',
        label: 'First name',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
        ],
        inputWidth: 'm',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-first-name' },
      },
      lastName: {
        key: 'responsible-party-last-name',
        label: 'Last name',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
        ],
        inputWidth: 'm',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-last-name' },
      },
      birthDate: {
        key: 'responsible-party-date-of-birth',
        label: 'Date of birth',
        type: 'date',
        dataType: 'DOB',
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
        ],
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-birthdate' },
      },
      birthSex: {
        key: 'responsible-party-birth-sex',
        label: 'Birth sex',
        type: 'choice',
        options: formValueSets.birthSexOptions,
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
        ],
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-birth-sex' },
      },
      addressSameAsPatient: {
        key: 'responsible-party-address-as-patient',
        label: "Responsible party's address is the same as patient's address",
        type: 'boolean',
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
        ],
      },
      streetAddress: {
        key: 'responsible-party-address',
        label: 'Address',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
          {
            targetQuestionLinkId: 'responsible-party-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
        ],
        enableBehavior: 'all',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-street-address' },
      },
      streetAddress2: {
        key: 'responsible-party-address-2',
        label: 'Address line 2 (optional)',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
          {
            targetQuestionLinkId: 'responsible-party-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
        ],
        enableBehavior: 'all',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-street-address-2' },
      },
      city: {
        key: 'responsible-party-city',
        label: 'City',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
          {
            targetQuestionLinkId: 'responsible-party-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
        ],
        enableBehavior: 'all',
        inputWidth: 's',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-city' },
      },
      state: {
        key: 'responsible-party-state',
        label: 'State',
        type: 'choice',
        options: formValueSets.stateOptions,
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
          {
            targetQuestionLinkId: 'responsible-party-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
        ],
        enableBehavior: 'all',
        inputWidth: 's',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-state' },
      },
      zip: {
        key: 'responsible-party-zip',
        label: 'ZIP',
        type: 'string',
        dataType: 'ZIP',
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
          {
            targetQuestionLinkId: 'responsible-party-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
        ],
        enableBehavior: 'all',
        inputWidth: 's',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-zip' },
      },
      phoneNumber: {
        key: 'responsible-party-number',
        label: 'Phone number (optional)',
        type: 'string',
        dataType: 'Phone Number',
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
        ],
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-number' },
      },
      email: {
        key: 'responsible-party-email',
        label: 'Email',
        type: 'string',
        dataType: 'Email',
        triggers: [
          {
            targetQuestionLinkId: 'responsible-party-relationship',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Self',
          },
        ],
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-email' },
      },
    },
    hiddenFields: [],
    requiredFields: [
      'responsible-party-relationship',
      'responsible-party-first-name',
      'responsible-party-last-name',
      'responsible-party-date-of-birth',
      'responsible-party-birth-sex',
      'responsible-party-address',
      'responsible-party-city',
      'responsible-party-state',
      'responsible-party-zip',
      'responsible-party-email',
    ],
  },
  employerInformation: {
    linkId: 'employer-information-page',
    title: 'Workers compensation employer information',
    items: {
      name: {
        key: 'employer-name',
        label: 'Employer Name',
        type: 'string',
      },
      address: {
        key: 'employer-address',
        label: 'Employer Address',
        type: 'string',
      },
      address2: {
        key: 'employer-address-2',
        label: 'Address line 2 (optional)',
        type: 'string',
      },
      city: {
        key: 'employer-city',
        label: 'City',
        type: 'string',
        inputWidth: 's',
      },
      state: {
        key: 'employer-state',
        label: 'State',
        type: 'choice',
        options: formValueSets.stateOptions,
        inputWidth: 's',
      },
      zip: {
        key: 'employer-zip',
        label: 'ZIP',
        type: 'string',
        dataType: 'ZIP',
        inputWidth: 's',
      },
      contactText: {
        key: 'employer-contact-text',
        text: 'Employer Contact',
        type: 'display',
      },
      contactFirstName: {
        key: 'employer-contact-first-name',
        label: 'First name',
        type: 'string',
        inputWidth: 'm',
      },
      contactLastName: {
        key: 'employer-contact-last-name',
        label: 'Last name',
        type: 'string',
        inputWidth: 'm',
      },
      contactTitle: {
        key: 'employer-contact-title',
        label: 'Title',
        type: 'string',
      },
      contactEmail: {
        key: 'employer-contact-email',
        label: 'Email',
        type: 'string',
        dataType: 'Email',
      },
      contactPhone: {
        key: 'employer-contact-phone',
        label: 'Mobile',
        type: 'string',
        dataType: 'Phone Number',
      },
      contactFax: {
        key: 'employer-contact-fax',
        label: 'Fax',
        type: 'string',
        dataType: 'Phone Number',
      },
    },
    hiddenFields: [],
    requiredFields: [
      'employer-name',
      'employer-address',
      'employer-city',
      'employer-state',
      'employer-zip',
      'employer-contact-first-name',
      'employer-contact-last-name',
      'employer-contact-phone',
    ],
    triggers: [
      {
        targetQuestionLinkId: 'contact-information-page.appointment-service-category',
        effect: ['enable'],
        operator: '=',
        answerString: 'workers-comp',
      },
    ],
  },
  emergencyContact: {
    linkId: 'emergency-contact-page',
    title: 'Emergency Contact',
    items: {
      relationship: {
        key: 'emergency-contact-relationship',
        label: 'Relationship to the patient',
        type: 'choice',
        options: formValueSets.emergencyContactRelationshipOptions,
      },
      firstName: {
        key: 'emergency-contact-first-name',
        label: 'Emergency contact first name',
        type: 'string',
      },
      middleName: {
        key: 'emergency-contact-middle-name',
        label: 'Emergency contact middle name',
        type: 'string',
      },
      lastName: {
        key: 'emergency-contact-last-name',
        label: 'Emergency contact last name',
        type: 'string',
      },
      phoneNumber: {
        key: 'emergency-contact-number',
        label: 'Emergency contact phone',
        type: 'string',
        dataType: 'Phone Number',
        autocomplete: 'section-patient shipping tel',
      },
      addressAsPatient: {
        key: 'emergency-contact-address-as-patient',
        label: "Same as patient's address",
        type: 'boolean',
      },
      streetAddress: {
        key: 'emergency-contact-address',
        label: 'Address',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'emergency-contact-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
        ],
        enableBehavior: 'all',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-street-address' },
      },
      streetAddress2: {
        key: 'emergency-contact-address-2',
        label: 'Address line 2 (optional)',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'emergency-contact-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
        ],
        enableBehavior: 'all',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-street-address-2' },
      },
      city: {
        key: 'emergency-contact-city',
        label: 'City',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'emergency-contact-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
        ],
        enableBehavior: 'all',
        inputWidth: 's',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-city' },
      },
      state: {
        key: 'emergency-contact-state',
        label: 'State',
        type: 'choice',
        options: formValueSets.stateOptions,
        triggers: [
          {
            targetQuestionLinkId: 'emergency-contact-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
        ],
        enableBehavior: 'all',
        inputWidth: 's',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-state' },
      },
      zip: {
        key: 'emergency-contact-zip',
        label: 'ZIP',
        type: 'string',
        dataType: 'ZIP',
        triggers: [
          {
            targetQuestionLinkId: 'emergency-contact-address-as-patient',
            effect: ['enable'],
            operator: '!=',
            answerBoolean: true,
          },
        ],
        enableBehavior: 'all',
        inputWidth: 's',
        disabledDisplay: 'disabled',
        dynamicPopulation: { sourceLinkId: 'patient-zip' },
      },
    },
    hiddenFields: [],
    requiredFields: [
      'emergency-contact-relationship',
      'emergency-contact-first-name',
      'emergency-contact-last-name',
      'emergency-contact-number',
      'emergency-contact-address',
      'emergency-contact-city',
      'emergency-contact-state',
      'emergency-contact-zip',
    ],
  },
  attorneyInformation: {
    linkId: 'attorney-mva-page',
    title: 'Attorney for Motor Vehicle Accident',
    triggers: [
      {
        targetQuestionLinkId: 'contact-information-page.reason-for-visit',
        effect: ['enable'],
        operator: '=',
        answerString: 'Auto accident',
      },
    ],
    items: {
      hasAttorney: {
        key: 'attorney-mva-has-attorney',
        label: 'Do you have an attorney?',
        type: 'choice',
        element: 'Radio',
        options: formValueSets.attorneyOptions,
      },
      firm: {
        key: 'attorney-mva-firm',
        label: 'Firm',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'attorney-mva-has-attorney',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: HAS_ATTORNEY_OPTION,
          },
        ],
      },
      firstName: {
        key: 'attorney-mva-first-name',
        label: 'First name',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'attorney-mva-has-attorney',
            effect: ['enable'],
            operator: '=',
            answerString: HAS_ATTORNEY_OPTION,
          },
        ],
      },
      lastName: {
        key: 'attorney-mva-last-name',
        label: 'Last name',
        type: 'string',
        triggers: [
          {
            targetQuestionLinkId: 'attorney-mva-has-attorney',
            effect: ['enable'],
            operator: '=',
            answerString: HAS_ATTORNEY_OPTION,
          },
        ],
      },
      email: {
        key: 'attorney-mva-email',
        label: 'Email',
        type: 'string',
        dataType: 'Email',
        triggers: [
          {
            targetQuestionLinkId: 'attorney-mva-has-attorney',
            effect: ['enable'],
            operator: '=',
            answerString: HAS_ATTORNEY_OPTION,
          },
        ],
      },
      mobile: {
        key: 'attorney-mva-mobile',
        label: 'Mobile',
        type: 'string',
        dataType: 'Phone Number',
        triggers: [
          {
            targetQuestionLinkId: 'attorney-mva-has-attorney',
            effect: ['enable'],
            operator: '=',
            answerString: HAS_ATTORNEY_OPTION,
          },
        ],
      },
      fax: {
        key: 'attorney-mva-fax',
        label: 'Fax',
        type: 'string',
        dataType: 'Phone Number',
        triggers: [
          {
            targetQuestionLinkId: 'attorney-mva-has-attorney',
            effect: ['enable'],
            operator: '=',
            answerString: HAS_ATTORNEY_OPTION,
          },
        ],
      },
    },
    hiddenFields: [],
    requiredFields: ['attorney-mva-has-attorney'],
  },
  photoId: {
    linkId: 'photo-id-page',
    title: 'Photo ID',
    items: {
      caption: {
        key: 'photo-id-page-caption',
        text: "Please upload a Photo ID, Driver's License, or Passport for an adult, either yourself or the parent/guardian when accompanying a child. ",
        type: 'display',
        element: 'p',
      },
      photoIdFront: {
        key: 'photo-id-front',
        label: 'Take a picture of the front side of your Photo ID (optional)',
        type: 'attachment',
        dataType: 'Image',
        attachmentText: 'Take a picture of the **front side** of your Photo ID',
        documentType: '55188-7',
      },
      photoIdBack: {
        key: 'photo-id-back',
        label: 'Take a picture of the back side of your Photo ID (optional)',
        type: 'attachment',
        dataType: 'Image',
        attachmentText: 'Take a picture of the **back side** of your Photo ID',
        documentType: '55188-7',
      },
    },
    hiddenFields: [],
    requiredFields: [],
  },
  patientCondition: {
    linkId: 'patient-condition-page',
    title: 'Patient condition',
    items: {
      patientPhotos: {
        key: 'patient-photos',
        label: "Photo of patient's condition (optional)",
        type: 'attachment',
        dataType: 'Image',
        documentType: '72170-4',
      },
    },
    hiddenFields: [],
    requiredFields: [],
  },
  schoolWorkNote: {
    linkId: 'school-work-note-page',
    title: 'Do you need a school or work note?',
    items: {
      choice: {
        key: 'school-work-note-choice',
        label: 'Select option:',
        type: 'choice',
        element: 'Radio',
        options: formValueSets.schoolWorkNoteOptions,
      },
      templateUploadGroup: {
        key: 'school-work-note-template-upload-group',
        text: 'Do you need a school or work note?',
        type: 'group',
        triggers: [
          {
            targetQuestionLinkId: 'school-work-note-choice',
            effect: ['enable'],
            operator: '!=',
            answerString: 'Neither',
          },
        ],
        items: {
          header: {
            key: 'school-work-note-template',
            text: 'I have a template',
            type: 'display',
            element: 'h3',
          },
          instructions: {
            key: 'school-work-note-template-text',
            text: 'Most institutions accept standard healthcare notes. If you require a specific form please upload it here and discuss it with your provider during the visit.',
            type: 'display',
            element: 'p',
          },
          schoolTemplate: {
            key: 'school-work-note-template-school',
            label: 'School Template',
            type: 'attachment',
            dataType: 'PDF',
            documentType: '47420-5',
            triggers: [
              {
                targetQuestionLinkId: 'school-work-note-choice',
                effect: ['enable'],
                operator: '=',
                answerString: 'School only',
              },
              {
                targetQuestionLinkId: 'school-work-note-choice',
                effect: ['enable'],
                operator: '=',
                answerString: 'Both school and work notes',
              },
              {
                targetQuestionLinkId: 'school-work-note-choice',
                effect: ['filter'],
                operator: '=',
                answerString: 'Work only',
              },
            ],
            enableBehavior: 'any',
          },
          workTemplate: {
            key: 'school-work-note-template-work',
            label: 'Work Template',
            type: 'attachment',
            dataType: 'PDF',
            documentType: '47420-5',
            triggers: [
              {
                targetQuestionLinkId: 'school-work-note-choice',
                effect: ['enable'],
                operator: '=',
                answerString: 'Work only',
              },
              {
                targetQuestionLinkId: 'school-work-note-choice',
                effect: ['enable'],
                operator: '=',
                answerString: 'Both school and work notes',
              },
              {
                targetQuestionLinkId: 'school-work-note-choice',
                effect: ['filter'],
                operator: '=',
                answerString: 'School only',
              },
            ],
            enableBehavior: 'any',
          },
        },
      },
    },
    requiredFields: ['school-work-note-choice'],
  },
  consentForms: {
    linkId: 'consent-forms-page',
    title: 'Complete consent forms',
    reviewText: 'Consent forms',
    triggers: [
      {
        targetQuestionLinkId: '$status',
        effect: ['enable'],
        operator: '!=',
        answerString: 'completed',
      },
      {
        targetQuestionLinkId: '$status',
        effect: ['enable'],
        operator: '!=',
        answerString: 'amended',
      },
    ],
    enableBehavior: 'all',
    items: {
      hipaaAcknowledgement: {
        key: 'hipaa-acknowledgement',
        label: 'I have reviewed and accept [HIPAA Acknowledgement](/hipaa_notice_template.pdf)',
        type: 'boolean',
        triggers: [
          {
            targetQuestionLinkId: '$status',
            effect: ['enable'],
            operator: '!=',
            answerString: 'completed',
          },
          {
            targetQuestionLinkId: '$status',
            effect: ['enable'],
            operator: '!=',
            answerString: 'amended',
          },
        ],
        enableBehavior: 'all',
        permissibleValue: true,
      },
      consentToTreat: {
        key: 'consent-to-treat',
        label:
          'I have reviewed and accept [Consent to Treat, Guarantee of Payment & Card on File Agreement](/consent_to_treat_template.pdf)',
        type: 'boolean',
        triggers: [
          {
            targetQuestionLinkId: '$status',
            effect: ['enable'],
            operator: '!=',
            answerString: 'completed',
          },
          {
            targetQuestionLinkId: '$status',
            effect: ['enable'],
            operator: '!=',
            answerString: 'amended',
          },
        ],
        enableBehavior: 'all',
        permissibleValue: true,
      },
      signature: {
        key: 'signature',
        label: 'Signature',
        type: 'string',
        dataType: 'Signature',
      },
      fullName: {
        key: 'full-name',
        label: 'Full name',
        type: 'string',
        autocomplete: 'section-consent-forms shipping name',
      },
      consentFormSignerRelationship: {
        key: 'consent-form-signer-relationship',
        label: 'Relationship to the patient',
        type: 'choice',
        triggers: [
          {
            targetQuestionLinkId: '$status',
            effect: ['enable'],
            operator: '!=',
            answerString: 'completed',
          },
          {
            targetQuestionLinkId: '$status',
            effect: ['enable'],
            operator: '!=',
            answerString: 'amended',
          },
        ],
        enableBehavior: 'all',
        options: formValueSets.relationshipOptions,
      },
    },
    hiddenFields: [],
    requiredFields: [
      'hipaa-acknowledgement',
      'consent-to-treat',
      'signature',
      'full-name',
      'consent-form-signer-relationship',
    ],
  },
  inviteParticipant: {
    linkId: 'invite-participant-page',
    title: 'Would you like someone to join this call?',
    items: {
      instructionText: {
        key: 'invite-page-text',
        text: 'Invite someone to join this call. Applicable for this visit only.',
        type: 'display',
        element: 'p',
      },
      fromAnotherDevice: {
        key: 'invite-from-another-device',
        label: 'Is anyone joining this visit from another device?',
        type: 'choice',
        element: 'Radio',
        options: formValueSets.inviteFromAnotherDeviceOptions,
      },
      firstName: {
        key: 'invite-first',
        label: 'First name',
        type: 'string',
        inputWidth: 'm',
        autocomplete: 'section-invite-participant shipping given-name',
        triggers: [
          {
            targetQuestionLinkId: 'invite-from-another-device',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: 'Yes, I will add invite details below',
          },
        ],
        disabledDisplay: 'hidden',
      },
      lastName: {
        key: 'invite-last',
        label: 'Last name',
        type: 'string',
        inputWidth: 'm',
        autocomplete: 'section-invite-participant shipping family-name',
        triggers: [
          {
            targetQuestionLinkId: 'invite-from-another-device',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: 'Yes, I will add invite details below',
          },
        ],
        disabledDisplay: 'hidden',
      },
      preferableContact: {
        key: 'invite-contact',
        label: 'Preferable contact',
        type: 'choice',
        element: 'Radio List',
        options: formValueSets.inviteContactOptions,
        triggers: [
          {
            targetQuestionLinkId: 'invite-from-another-device',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: 'Yes, I will add invite details below',
          },
        ],
        disabledDisplay: 'hidden',
      },
      email: {
        key: 'invite-email',
        label: 'Email address',
        type: 'string',
        dataType: 'Email',
        autocomplete: 'section-invite-participant shipping email',
        triggers: [
          {
            targetQuestionLinkId: 'invite-from-another-device',
            effect: ['enable'],
            operator: '=',
            answerString: 'Yes, I will add invite details below',
          },
          {
            targetQuestionLinkId: 'invite-contact',
            effect: ['require'],
            operator: '=',
            answerString: 'Email',
          },
        ],
        disabledDisplay: 'hidden',
      },
      phone: {
        key: 'invite-phone',
        label: 'Phone number',
        type: 'string',
        dataType: 'Phone Number',
        autocomplete: 'section-invite-participant shipping tel',
        triggers: [
          {
            targetQuestionLinkId: 'invite-from-another-device',
            effect: ['enable'],
            operator: '=',
            answerString: 'Yes, I will add invite details below',
          },
          {
            targetQuestionLinkId: 'invite-contact',
            effect: ['require'],
            operator: '=',
            answerString: 'Phone',
          },
        ],
        disabledDisplay: 'hidden',
      },
    },
    requiredFields: ['invite-from-another-device'],
  },
};

// note: the order of the fields on this object are what determines the order they appear in the form
// i try to make the template above match this order for easier reading, but that's a convention, and the order
// declared here is what will determine the order of the items on the form.
const FormFieldsSchema = z.object({
  contactInformation: FormSectionSimpleSchema,
  patientDetails: FormSectionSimpleSchema,
  primaryCarePhysician: FormSectionSimpleSchema,
  pharmacy: FormSectionSimpleSchema,
  currentMedications: FormSectionSimpleSchema,
  allergies: FormSectionSimpleSchema,
  medicalHistory: FormSectionSimpleSchema,
  surgicalHistory: FormSectionSimpleSchema,
  additional: FormSectionSimpleSchema,
  paymentOption: FormSectionSimpleSchema,
  paymentOptionOccMed: FormSectionSimpleSchema,
  occupationalMedicineEmployerInformation: FormSectionSimpleSchema,
  cardPayment: FormSectionSimpleSchema,
  responsibleParty: FormSectionSimpleSchema,
  employerInformation: FormSectionSimpleSchema,
  emergencyContact: FormSectionSimpleSchema,
  attorneyInformation: FormSectionSimpleSchema,
  photoId: FormSectionSimpleSchema,
  patientCondition: FormSectionSimpleSchema,
  schoolWorkNote: FormSectionSimpleSchema,
  consentForms: FormSectionSimpleSchema,
  inviteParticipant: FormSectionSimpleSchema,
});

const hiddenFormSections: string[] = [];

const questionnaireBaseDefaults: QuestionnaireBase = {
  resourceType: 'Questionnaire',
  url: 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-virtual',
  version: '1.0.20',
  name: 'virtual_pre-visit_paperwork',
  title: 'virtual pre-visit paperwork',
  status: 'active',
};

const INTAKE_PAPERWORK_DEFAULTS = {
  questionnaireBase: questionnaireBaseDefaults,
  hiddenFormSections,
  FormFields,
};

const mergedIntakePaperworkConfig = mergeAndFreezeConfigObjects(INTAKE_PAPERWORK_DEFAULTS, OVERRIDES);

const IntakePaperworkConfigSchema = QuestionnaireConfigSchema.extend({
  FormFields: FormFieldsSchema,
});

export const VIRTUAL_INTAKE_PAPERWORK_CONFIG = IntakePaperworkConfigSchema.parse(mergedIntakePaperworkConfig);
export const VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE = (): Questionnaire =>
  JSON.parse(JSON.stringify(createQuestionnaireFromConfig(VIRTUAL_INTAKE_PAPERWORK_CONFIG)));
