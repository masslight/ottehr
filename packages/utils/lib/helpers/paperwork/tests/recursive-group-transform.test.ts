//import { Questionnaire } from 'fhir/r4b';
//import { mapQuestionnaireAndValueSetsToItemsList } from '../paperwork';
import { Questionnaire } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { mapQuestionnaireAndValueSetsToItemsList } from '../paperwork';
import { flattenItems, recursiveGroupTransform } from '../validation';

const BASE_FORM_VALUES = [
  {
    linkId: 'payment-option',
    answer: [
      {
        valueString: 'I have insurance',
      },
    ],
  },
  {
    linkId: 'card-payment-data',
  },
  {
    linkId: 'insurance-carrier',
    answer: [
      {
        valueReference: {
          reference: 'InsurancePlan/a31c8c8f-e2a9-4fb4-8be0-86462966568f',
          display: 'Aetna Better Health of Virginia',
        },
      },
    ],
  },
  {
    linkId: 'insurance-member-id',
    answer: [
      {
        valueString: 'FafOneJwgNdkOetWwe6',
      },
    ],
  },
  {
    linkId: 'policy-holder-first-name',
    answer: [
      {
        valueString: 'Ruth',
      },
    ],
  },
  {
    linkId: 'policy-holder-middle-name',
    answer: [
      {
        valueString: 'Eloise',
      },
    ],
  },
  {
    linkId: 'policy-holder-last-name',
    answer: [
      {
        // cSpell:disable-next Benham
        valueString: 'Benham',
      },
    ],
  },
  {
    linkId: 'policy-holder-date-of-birth',
    answer: [
      {
        valueString: '1994-02-21',
      },
    ],
  },
  {
    linkId: 'policy-holder-birth-sex',
    answer: [
      {
        valueString: 'Female',
      },
    ],
  },
  {
    linkId: 'policy-holder-address-as-patient',
    answer: [
      {
        valueBoolean: true,
      },
    ],
  },
  {
    linkId: 'policy-holder-address',
    answer: [
      {
        valueString: '317 R St NW Unit 2',
      },
    ],
  },
  {
    linkId: 'policy-holder-address-additional-line',
    answer: [
      {
        valueString: 'conditional-filter-test-1234',
      },
    ],
  },
  {
    linkId: 'policy-holder-city',
    answer: [
      {
        valueString: 'Washington',
      },
    ],
  },
  {
    linkId: 'policy-holder-state',
    answer: [
      {
        valueString: 'DC',
      },
    ],
  },
  {
    linkId: 'policy-holder-zip',
    answer: [
      {
        valueString: '20001',
      },
    ],
  },
  {
    linkId: 'patient-relationship-to-insured',
    answer: [
      {
        valueString: 'Injured Party',
      },
    ],
  },
  {
    linkId: 'insurance-card-front',
  },
  {
    linkId: 'insurance-card-back',
  },
  {
    linkId: 'insurance-eligibility-verification-status',
    answer: [
      {
        valueString: 'eligibility-confirmed',
      },
      {
        valueString: 'eligibility-check-not-supported',
      },
    ],
  },
  {
    linkId: 'display-secondary-insurance',
    answer: [
      {
        valueBoolean: true,
      },
    ],
  },
  {
    item: [
      {
        linkId: 'insurance-carrier-2',
        answer: [
          {
            valueReference: {
              reference: 'InsurancePlan/a31c8c8f-e2a9-4fb4-8be0-86462966568f',
              display: 'Aetna Better Health of Virginia',
            },
          },
        ],
      },
      {
        linkId: 'insurance-member-id-2',
        answer: [
          {
            // cSpell:disable-next fdfdfdfdfdf
            valueString: 'fdfdfdfdfdf',
          },
        ],
      },
      {
        linkId: 'policy-holder-first-name-2',
        answer: [
          {
            valueString: 'Barnabas',
          },
        ],
      },
      {
        linkId: 'policy-holder-middle-name-2',
        answer: [
          {
            valueString: 'Thaddeus',
          },
        ],
      },
      {
        linkId: 'policy-holder-last-name-2',
        answer: [
          {
            valueString: 'PicklesWorth',
          },
        ],
      },
      {
        linkId: 'policy-holder-date-of-birth-2',
        answer: [
          {
            valueString: '1991-02-21',
          },
        ],
      },
      {
        linkId: 'policy-holder-birth-sex-2',
        answer: [
          {
            valueString: 'Male',
          },
        ],
      },
      {
        linkId: 'policy-holder-address-as-patient-2',
        answer: [
          {
            valueBoolean: true,
          },
        ],
      },
      {
        linkId: 'policy-holder-address-2',
        answer: [
          {
            valueString: '317 R St NW Unit 2',
          },
        ],
      },
      {
        linkId: 'policy-holder-address-additional-line-2',
        answer: [
          {
            valueString: 'conditional-filter-test-1234',
          },
        ],
      },
      {
        linkId: 'policy-holder-city-2',
        answer: [
          {
            valueString: 'Washington',
          },
        ],
      },
      {
        linkId: 'policy-holder-state-2',
        answer: [
          {
            valueString: 'DC',
          },
        ],
      },
      {
        linkId: 'policy-holder-zip-2',
        answer: [
          {
            valueString: '20001',
          },
        ],
      },
      {
        linkId: 'patient-relationship-to-insured-2',
        answer: [
          {
            valueString: 'Child',
          },
        ],
      },
      {
        linkId: 'insurance-card-front-2',
      },
      {
        linkId: 'insurance-card-back-2',
      },
    ],
    linkId: 'secondary-insurance',
  },
];

const BASE_QUESTIONNAIRE: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  url: 'some-url',
  version: '1.0.0',
  item: [
    {
      linkId: 'payment-option-page',
      text: 'How would you like to pay for your visit?',
      extension: [
        {
          url: 'https://fhir.zapehr.com/r4/StructureDefinitions/review-text',
          valueString: 'Insurance details',
        },
        {
          url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation',
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-type',
              valueString: 'insurance eligibility',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerWhen',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerQuestion',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerOperator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerAnswer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
      ],
      type: 'group',
      item: [
        {
          linkId: 'payment-option',
          text: 'Select payment option',
          type: 'choice',
          required: true,
          answerOption: [
            {
              valueString: 'I have insurance',
            },
            {
              valueString: 'I will pay without insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/preferred-element',
              valueString: 'Radio',
            },
          ],
        },
        {
          linkId: 'card-payment-data',
          type: 'group',
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I will pay without insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I will pay without insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I will pay without insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/group-type',
              valueString: 'credit-card-collection',
            },
          ],
          item: [
            {
              linkId: 'credit-card-details-text',
              text: 'Credit card details',
              type: 'display',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                  valueString: 'h3',
                },
              ],
            },
            {
              linkId: 'valid-card-on-file',
              type: 'boolean',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
                  valueString: 'Payment Validation',
                },
              ],
            },
          ],
        },
        {
          linkId: 'insurance-details-text',
          text: 'Insurance details',
          type: 'display',
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
        },
        {
          linkId: 'insurance-details-caption',
          text: 'We use this information to help determine your coverage and costs.',
          type: 'display',
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
        },
        {
          linkId: 'insurance-carrier',
          text: 'Insurance carrier',
          type: 'choice',
          required: false,
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
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
                    expression: 'InsurancePlan?status=active&_tag=insurance-payer-plan',
                  },
                },
              ],
            },
          ],
        },
        {
          linkId: 'insurance-member-id',
          text: 'Member ID',
          type: 'string',
          required: false,
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'policy-holder-first-name',
          text: "Policy holder's first name",
          type: 'string',
          required: false,
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'policy-holder-middle-name',
          text: "Policy holder's middle name",
          type: 'string',
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'policy-holder-last-name',
          text: "Policy holder's last name",
          type: 'string',
          required: false,
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'policy-holder-date-of-birth',
          text: "Policy holder's date of birth",
          type: 'date',
          required: false,
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
              valueString: 'hidden',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
              valueString: 'DOB',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'policy-holder-birth-sex',
          text: "Policy holder's birth sex",
          type: 'choice',
          required: false,
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
          answerOption: [
            {
              valueString: 'Male',
            },
            {
              valueString: 'Female',
            },
            {
              valueString: 'Intersex',
            },
          ],
        },
        {
          linkId: 'policy-holder-address-as-patient',
          text: "Policy holder address is the same as patient's address",
          type: 'boolean',
          required: false,
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'policy-holder-address',
          text: 'Policy holder address',
          type: 'string',
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
            {
              question: 'policy-holder-address-as-patient',
              operator: '!=',
              answerBoolean: true,
            },
          ],
          enableBehavior: 'all',
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
              valueString: 'patient-street-address',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
              valueString: 'hidden',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'policy-holder-address-additional-line',
          text: 'Policy holder address line 2 (optional)',
          type: 'string',
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
            {
              question: 'policy-holder-address-as-patient',
              operator: '!=',
              answerBoolean: true,
            },
          ],
          enableBehavior: 'all',
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
              valueString: 'patient-street-address-2',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
              valueString: 'hidden',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'policy-holder-city',
          text: 'City',
          type: 'string',
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-width',
              valueString: 's',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
              valueString: 'patient-city',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
              valueString: 'hidden',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
            {
              question: 'policy-holder-address-as-patient',
              operator: '!=',
              answerBoolean: true,
            },
          ],
          enableBehavior: 'all',
        },
        {
          linkId: 'policy-holder-state',
          text: 'State',
          type: 'choice',
          answerOption: [
            {
              valueString: 'AL',
            },
            {
              valueString: 'AK',
            },
            {
              valueString: 'AZ',
            },
            {
              valueString: 'AR',
            },
            {
              valueString: 'CA',
            },
            {
              valueString: 'CO',
            },
            {
              valueString: 'CT',
            },
            {
              valueString: 'DE',
            },
            {
              valueString: 'DC',
            },
            {
              valueString: 'FL',
            },
            {
              valueString: 'GA',
            },
            {
              valueString: 'HI',
            },
            {
              valueString: 'ID',
            },
            {
              valueString: 'IL',
            },
            {
              valueString: 'IN',
            },
            {
              valueString: 'IA',
            },
            {
              valueString: 'KS',
            },
            {
              valueString: 'KY',
            },
            {
              valueString: 'LA',
            },
            {
              valueString: 'ME',
            },
            {
              valueString: 'MD',
            },
            {
              valueString: 'MA',
            },
            {
              valueString: 'MI',
            },
            {
              valueString: 'MN',
            },
            {
              valueString: 'MS',
            },
            {
              valueString: 'MO',
            },
            {
              valueString: 'MT',
            },
            {
              valueString: 'NE',
            },
            {
              valueString: 'NV',
            },
            {
              valueString: 'NH',
            },
            {
              valueString: 'NJ',
            },
            {
              valueString: 'NM',
            },
            {
              valueString: 'NY',
            },
            {
              valueString: 'NC',
            },
            {
              valueString: 'ND',
            },
            {
              valueString: 'OH',
            },
            {
              valueString: 'OK',
            },
            {
              valueString: 'OR',
            },
            {
              valueString: 'PA',
            },
            {
              valueString: 'RI',
            },
            {
              valueString: 'SC',
            },
            {
              valueString: 'SD',
            },
            {
              valueString: 'TN',
            },
            {
              valueString: 'TX',
            },
            {
              valueString: 'UT',
            },
            {
              valueString: 'VT',
            },
            {
              valueString: 'VA',
            },
            {
              valueString: 'VI',
            },
            {
              valueString: 'WA',
            },
            {
              valueString: 'WV',
            },
            {
              valueString: 'WI',
            },
            {
              valueString: 'WY',
            },
          ],
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
            {
              question: 'policy-holder-address-as-patient',
              operator: '!=',
              answerBoolean: true,
            },
          ],
          enableBehavior: 'all',
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-width',
              valueString: 's',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
              valueString: 'patient-state',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
              valueString: 'hidden',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'policy-holder-zip',
          text: 'ZIP',
          type: 'string',
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-width',
              valueString: 's',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
              valueString: 'ZIP',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
              valueString: 'patient-zip',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
              valueString: 'hidden',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
            {
              question: 'policy-holder-address-as-patient',
              operator: '!=',
              answerBoolean: true,
            },
          ],
          enableBehavior: 'all',
        },
        {
          linkId: 'patient-relationship-to-insured',
          text: "Patient's relationship to insured",
          type: 'choice',
          required: false,
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
          answerOption: [
            {
              valueString: 'Self',
            },
            {
              valueString: 'Child',
            },
            {
              valueString: 'Parent',
            },
            {
              valueString: 'Spouse',
            },
            {
              valueString: 'Common Law Spouse',
            },
            {
              valueString: 'Injured Party',
            },
            {
              valueString: 'Other',
            },
          ],
        },
        {
          linkId: 'insurance-card-front',
          text: 'Front side of the insurance card (optional)',
          type: 'attachment',
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          required: false,
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text',
              valueString: 'Take a picture of the **front side** of your card and upload it here',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
              valueString: 'Image',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type',
              valueString: '64290-0',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'insurance-card-back',
          text: 'Back side of the insurance card (optional)',
          type: 'attachment',
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          required: false,
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text',
              valueString: 'Take a picture of the **back side** of your card and upload it here',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
              valueString: 'Image',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type',
              valueString: '64290-0',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'insurance-eligibility-verification-status',
          type: 'string',
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'NEVER',
            },
          ],
          required: false,
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
              valueString: 'hidden',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/accepts-multiple-answers',
              valueBoolean: true,
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
          ],
        },
        {
          linkId: 'display-secondary-insurance',
          text: 'Add Secondary Insurance',
          type: 'boolean',
          required: false,
          enableWhen: [
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-question',
                  valueString: 'display-secondary-insurance',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-operator',
                  valueString: '=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-answer',
                  valueBoolean: true,
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-substitute-text',
                  valueString: 'Remove Secondary Insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'payment-option',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueString: 'I have insurance',
                },
              ],
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/preferred-element',
              valueString: 'Button',
            },
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-width',
              valueString: 'l',
            },
          ],
        },
        {
          linkId: 'secondary-insurance',
          type: 'group',
          enableWhen: [
            {
              question: 'display-secondary-insurance',
              operator: '=',
              answerBoolean: true,
            },
            {
              question: 'payment-option',
              operator: '=',
              answerString: 'I have insurance',
            },
          ],
          enableBehavior: 'all',
          extension: [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                  valueString: 'display-secondary-insurance',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                  valueString: '!=',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                  valueBoolean: true,
                },
              ],
            },
          ],
          item: [
            {
              linkId: 'insurance-details-text-2',
              text: 'Secondary insurance details',
              type: 'display',
            },
            {
              linkId: 'insurance-carrier-2',
              text: 'Insurance carrier',
              type: 'choice',
              required: true,
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
                  extension: [
                    {
                      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
                      valueString: 'payment-option',
                    },
                    {
                      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
                      valueString: '!=',
                    },
                    {
                      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
                      valueString: 'I have insurance',
                    },
                  ],
                },
                {
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
                        expression: 'InsurancePlan?status=active&_tag=insurance-payer-plan',
                      },
                    },
                  ],
                },
              ],
            },
            {
              linkId: 'insurance-member-id-2',
              text: 'Member ID',
              type: 'string',
              required: true,
            },
            {
              linkId: 'policy-holder-first-name-2',
              text: "Policy holder's first name",
              type: 'string',
              required: true,
            },
            {
              linkId: 'policy-holder-middle-name-2',
              text: "Policy holder's middle name",
              type: 'string',
              required: false,
            },
            {
              linkId: 'policy-holder-last-name-2',
              text: "Policy holder's last name",
              type: 'string',
              required: true,
            },
            {
              linkId: 'policy-holder-date-of-birth-2',
              text: "Policy holder's date of birth",
              type: 'date',
              required: true,
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
                  valueString: 'DOB',
                },
              ],
            },
            {
              linkId: 'policy-holder-birth-sex-2',
              text: "Policy holder's birth sex",
              type: 'choice',
              required: true,
              answerOption: [
                {
                  valueString: 'Male',
                },
                {
                  valueString: 'Female',
                },
                {
                  valueString: 'Intersex',
                },
              ],
            },
            {
              linkId: 'policy-holder-address-as-patient-2',
              text: "Policy holder address is the same as patient's address",
              type: 'boolean',
              required: false,
            },
            {
              linkId: 'policy-holder-address-2',
              text: 'Policy holder address',
              type: 'string',
              required: true,
              enableWhen: [
                {
                  question: 'secondary-insurance.policy-holder-address-as-patient-2',
                  operator: '!=',
                  answerBoolean: true,
                },
              ],
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
                  valueString: 'patient-street-address',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
                  valueString: 'hidden',
                },
              ],
            },
            {
              linkId: 'policy-holder-address-additional-line-2',
              text: 'Policy holder address line 2 (optional)',
              type: 'string',
              enableWhen: [
                {
                  question: 'secondary-insurance.policy-holder-address-as-patient-2',
                  operator: '!=',
                  answerBoolean: true,
                },
              ],
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
                  valueString: 'patient-street-address-2',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
                  valueString: 'hidden',
                },
              ],
            },
            {
              linkId: 'policy-holder-city-2',
              text: 'City',
              type: 'string',
              required: true,
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-width',
                  valueString: 's',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
                  valueString: 'patient-city',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
                  valueString: 'hidden',
                },
              ],
              enableWhen: [
                {
                  question: 'secondary-insurance.policy-holder-address-as-patient-2',
                  operator: '!=',
                  answerBoolean: true,
                },
              ],
            },
            {
              linkId: 'policy-holder-state-2',
              text: 'State',
              type: 'choice',
              required: true,
              answerOption: [
                {
                  valueString: 'AL',
                },
                {
                  valueString: 'AK',
                },
                {
                  valueString: 'AZ',
                },
                {
                  valueString: 'AR',
                },
                {
                  valueString: 'CA',
                },
                {
                  valueString: 'CO',
                },
                {
                  valueString: 'CT',
                },
                {
                  valueString: 'DE',
                },
                {
                  valueString: 'DC',
                },
                {
                  valueString: 'FL',
                },
                {
                  valueString: 'GA',
                },
                {
                  valueString: 'HI',
                },
                {
                  valueString: 'ID',
                },
                {
                  valueString: 'IL',
                },
                {
                  valueString: 'IN',
                },
                {
                  valueString: 'IA',
                },
                {
                  valueString: 'KS',
                },
                {
                  valueString: 'KY',
                },
                {
                  valueString: 'LA',
                },
                {
                  valueString: 'ME',
                },
                {
                  valueString: 'MD',
                },
                {
                  valueString: 'MA',
                },
                {
                  valueString: 'MI',
                },
                {
                  valueString: 'MN',
                },
                {
                  valueString: 'MS',
                },
                {
                  valueString: 'MO',
                },
                {
                  valueString: 'MT',
                },
                {
                  valueString: 'NE',
                },
                {
                  valueString: 'NV',
                },
                {
                  valueString: 'NH',
                },
                {
                  valueString: 'NJ',
                },
                {
                  valueString: 'NM',
                },
                {
                  valueString: 'NY',
                },
                {
                  valueString: 'NC',
                },
                {
                  valueString: 'ND',
                },
                {
                  valueString: 'OH',
                },
                {
                  valueString: 'OK',
                },
                {
                  valueString: 'OR',
                },
                {
                  valueString: 'PA',
                },
                {
                  valueString: 'RI',
                },
                {
                  valueString: 'SC',
                },
                {
                  valueString: 'SD',
                },
                {
                  valueString: 'TN',
                },
                {
                  valueString: 'TX',
                },
                {
                  valueString: 'UT',
                },
                {
                  valueString: 'VT',
                },
                {
                  valueString: 'VA',
                },
                {
                  valueString: 'VI',
                },
                {
                  valueString: 'WA',
                },
                {
                  valueString: 'WV',
                },
                {
                  valueString: 'WI',
                },
                {
                  valueString: 'WY',
                },
              ],
              enableWhen: [
                {
                  question: 'secondary-insurance.policy-holder-address-as-patient-2',
                  operator: '!=',
                  answerBoolean: true,
                },
              ],
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-width',
                  valueString: 's',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
                  valueString: 'patient-state',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
                  valueString: 'hidden',
                },
              ],
            },
            {
              linkId: 'policy-holder-zip-2',
              text: 'ZIP',
              type: 'string',
              required: true,
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-width',
                  valueString: 's',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
                  valueString: 'ZIP',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
                  valueString: 'patient-zip',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
                  valueString: 'hidden',
                },
              ],
              enableWhen: [
                {
                  question: 'secondary-insurance.policy-holder-address-as-patient-2',
                  operator: '!=',
                  answerBoolean: true,
                },
              ],
              enableBehavior: 'all',
            },
            {
              linkId: 'patient-relationship-to-insured-2',
              text: "Patient's relationship to insured",
              type: 'choice',
              required: true,
              answerOption: [
                {
                  valueString: 'Child',
                },
                {
                  valueString: 'Parent',
                },
                {
                  valueString: 'Mother',
                },
                {
                  valueString: 'Father',
                },
                {
                  valueString: 'Sibling',
                },
                {
                  valueString: 'Spouse',
                },
                {
                  valueString: 'Other',
                },
              ],
            },
            {
              linkId: 'insurance-card-front-2',
              text: 'Front side of the insurance card',
              type: 'attachment',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text',
                  valueString: 'Take a picture of the **front side** of your card and upload it here',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
                  valueString: 'Image',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type',
                  valueString: '64290-0',
                },
              ],
            },
            {
              linkId: 'insurance-card-back-2',
              text: 'Back side of the insurance card',
              type: 'attachment',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text',
                  valueString: 'Take a picture of the **back side** of your card and upload it here',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
                  valueString: 'Image',
                },
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type',
                  valueString: '64290-0',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const PAGE_ONE_ITEMS = (BASE_QUESTIONNAIRE.item ?? [])[0].item ?? [];

describe('Recursive group transform', () => {
  it('secondary insurance coverage values survive transform', () => {
    const structuredItems = mapQuestionnaireAndValueSetsToItemsList(PAGE_ONE_ITEMS, []);
    expect(BASE_FORM_VALUES).toBeDefined();
    const items = flattenItems(BASE_FORM_VALUES as any[]);
    expect(items).toBeDefined();
    const ic2Field = flattenItems(BASE_FORM_VALUES as any[]).find((i: any) => {
      return i.linkId === 'insurance-carrier-2';
    });
    expect(ic2Field).toBeDefined();
    expect(ic2Field.answer).toBeDefined();
    expect(ic2Field.answer[0]?.valueReference?.reference).toBe('InsurancePlan/a31c8c8f-e2a9-4fb4-8be0-86462966568f');
    expect(ic2Field.answer[0]?.valueReference?.display).toBe('Aetna Better Health of Virginia');
    const transformed = recursiveGroupTransform(structuredItems, BASE_FORM_VALUES);
    const flattenedTransform = flattenItems(transformed);
    const ic2FieldTransformed = flattenedTransform.find((i: any) => {
      return i.linkId === 'insurance-carrier-2';
    });
    expect(ic2FieldTransformed).toBeDefined();
    expect(ic2FieldTransformed.answer).toBeDefined();
    expect(ic2FieldTransformed.answer[0]?.valueReference?.reference).toBe(
      'InsurancePlan/a31c8c8f-e2a9-4fb4-8be0-86462966568f'
    );
    expect(ic2FieldTransformed.answer[0]?.valueReference?.display).toBe('Aetna Better Health of Virginia');
  });
  it('all values survive transform', () => {
    const structuredItems = mapQuestionnaireAndValueSetsToItemsList(PAGE_ONE_ITEMS, []);
    expect(BASE_FORM_VALUES).toBeDefined();
    const items = flattenItems(BASE_FORM_VALUES as any[]);
    expect(items).toBeDefined();

    const transformed = recursiveGroupTransform(structuredItems, BASE_FORM_VALUES);
    const flattenedTransform = flattenItems(transformed);
    items.forEach((item: any) => {
      if (item?.type !== 'display' && !item?.readOnly) {
        const analog = flattenedTransform.find((ti: any) => {
          return ti.linkId === item.linkId;
        });
        expect(analog?.linkId).toBe(item.linkId);
        expect(analog).toMatchObject(item);
      }
    });
  });
});
