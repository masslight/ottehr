import { Questionnaire } from 'fhir/r4b';
import z from 'zod';
import { INTAKE_PAPERWORK_CONFIG as OVERRIDES } from '../../../ottehr-config-overrides/intake-paperwork';
import { mergeAndFreezeConfigObjects } from '../helpers';
import {
  createQuestionnaireFromConfig,
  FormSectionSimpleSchema,
  QuestionnaireBase,
  QuestionnaireConfigSchema,
} from '../shared-questionnaire';
import { VALUE_SETS as formValueSets } from '../value-sets';

/*

TARGET QUESTIONNAIRE TO DEFINE:

{
        "resourceType": "Questionnaire",
        "url": "https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson",
        "version": "1.1.3",
        "name": "in-person_pre-visit_paperwork",
        "title": "in-person pre-visit paperwork",
        "status": "active",
        "item": [
          {
            "linkId": "contact-information-page",
            "text": "Contact information",
            "type": "group",
            "item": [
              {
                "linkId": "contact-page-address-text",
                "text": "Primary address",
                "type": "display",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/preferred-element",
                    "valueString": "h3"
                  }
                ]
              },
              {
                "linkId": "patient-street-address",
                "text": "Street address",
                "type": "string",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-contact-information shipping address-line1"
                  }
                ]
              },
              {
                "linkId": "patient-street-address-2",
                "text": "Address line 2 (optional)",
                "type": "string",
                "required": false,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-contact-information shipping address-line2"
                  }
                ]
              },
              {
                "linkId": "patient-city",
                "text": "City",
                "type": "string",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-contact-information shipping address-level2"
                  }
                ]
              },
              {
                "linkId": "patient-state",
                "text": "State",
                "type": "choice",
                "answerOption": [
                  {
                    "valueString": "AL"
                  },
                  {
                    "valueString": "AK"
                  },
                  {
                    "valueString": "AZ"
                  },
                  {
                    "valueString": "AR"
                  },
                  {
                    "valueString": "CA"
                  },
                  {
                    "valueString": "CO"
                  },
                  {
                    "valueString": "CT"
                  },
                  {
                    "valueString": "DE"
                  },
                  {
                    "valueString": "DC"
                  },
                  {
                    "valueString": "FL"
                  },
                  {
                    "valueString": "GA"
                  },
                  {
                    "valueString": "HI"
                  },
                  {
                    "valueString": "ID"
                  },
                  {
                    "valueString": "IL"
                  },
                  {
                    "valueString": "IN"
                  },
                  {
                    "valueString": "IA"
                  },
                  {
                    "valueString": "KS"
                  },
                  {
                    "valueString": "KY"
                  },
                  {
                    "valueString": "LA"
                  },
                  {
                    "valueString": "ME"
                  },
                  {
                    "valueString": "MD"
                  },
                  {
                    "valueString": "MA"
                  },
                  {
                    "valueString": "MI"
                  },
                  {
                    "valueString": "MN"
                  },
                  {
                    "valueString": "MS"
                  },
                  {
                    "valueString": "MO"
                  },
                  {
                    "valueString": "MT"
                  },
                  {
                    "valueString": "NE"
                  },
                  {
                    "valueString": "NV"
                  },
                  {
                    "valueString": "NH"
                  },
                  {
                    "valueString": "NJ"
                  },
                  {
                    "valueString": "NM"
                  },
                  {
                    "valueString": "NY"
                  },
                  {
                    "valueString": "NC"
                  },
                  {
                    "valueString": "ND"
                  },
                  {
                    "valueString": "OH"
                  },
                  {
                    "valueString": "OK"
                  },
                  {
                    "valueString": "OR"
                  },
                  {
                    "valueString": "PA"
                  },
                  {
                    "valueString": "RI"
                  },
                  {
                    "valueString": "SC"
                  },
                  {
                    "valueString": "SD"
                  },
                  {
                    "valueString": "TN"
                  },
                  {
                    "valueString": "TX"
                  },
                  {
                    "valueString": "UT"
                  },
                  {
                    "valueString": "VT"
                  },
                  {
                    "valueString": "VA"
                  },
                  {
                    "valueString": "VI"
                  },
                  {
                    "valueString": "WA"
                  },
                  {
                    "valueString": "WV"
                  },
                  {
                    "valueString": "WI"
                  },
                  {
                    "valueString": "WY"
                  }
                ],
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  }
                ]
              },
              {
                "linkId": "patient-zip",
                "text": "ZIP",
                "type": "string",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "ZIP"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-contact-information shipping postal-code"
                  }
                ]
              },
              {
                "linkId": "patient-will-be-18",
                "type": "boolean",
                "required": true,
                "readOnly": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  }
                ]
              },
              {
                "linkId": "is-new-qrs-patient",
                "type": "boolean",
                "required": true,
                "readOnly": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  }
                ]
              },
              {
                "linkId": "patient-first-name",
                "type": "string",
                "required": true,
                "readOnly": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  }
                ]
              },
              {
                "linkId": "patient-last-name",
                "type": "string",
                "required": true,
                "readOnly": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  }
                ]
              },
              {
                "linkId": "patient-birthdate",
                "type": "date",
                "required": true,
                "readOnly": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "DOB"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  }
                ]
              },
              {
                "linkId": "patient-birth-sex",
                "type": "choice",
                "required": true,
                "readOnly": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  }
                ],
                "answerOption": [
                  {
                    "valueString": "Male"
                  },
                  {
                    "valueString": "Female"
                  },
                  {
                    "valueString": "Intersex"
                  }
                ]
              },
              {
                "linkId": "patient-birth-sex-missing",
                "type": "boolean",
                "required": false,
                "readOnly": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  }
                ]
              },
              {
                "linkId": "patient-contact-additional-caption",
                "text": "Please provide the information for the best point of contact regarding this reservation.",
                "type": "display",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/preferred-element",
                    "valueString": "p"
                  }
                ]
              },
              {
                "linkId": "patient-email",
                "text": "Email",
                "type": "string",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Email"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-patient shipping email"
                  }
                ]
              },
              {
                "linkId": "patient-number",
                "text": "Mobile",
                "type": "string",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Phone Number"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-patient shipping tel"
                  }
                ]
              },
              {
                "linkId": "patient-preferred-communication-method",
                "text": "Preferred Communication Method",
                "required": true,
                "type": "choice",
                "answerOption": [
                  {
                    "valueString": "No preference"
                  },
                  {
                    "valueString": "Email"
                  },
                  {
                    "valueString": "Home Phone"
                  },
                  {
                    "valueString": "Cell Phone"
                  },
                  {
                    "valueString": "Mail"
                  }
                ]
              },
              {
                "linkId": "mobile-opt-in",
                "text": "Yes! I would like to receive helpful text messages from Ottehr regarding patient education, events, and general information about our offices. Message frequency varies, and data rates may apply.",
                "type": "boolean",
                "required": false
              }
            ]
          },
          {
            "linkId": "patient-details-page",
            "text": "Patient details",
            "type": "group",
            "item": [
              {
                "linkId": "patient-ethnicity",
                "text": "Ethnicity",
                "type": "choice",
                "required": true,
                "answerOption": [
                  {
                    "valueString": "Hispanic or Latino"
                  },
                  {
                    "valueString": "Not Hispanic or Latino"
                  },
                  {
                    "valueString": "Decline to Specify"
                  }
                ]
              },
              {
                "linkId": "patient-race",
                "text": "Race",
                "type": "choice",
                "required": true,
                "answerOption": [
                  {
                    "valueString": "American Indian or Alaska Native"
                  },
                  {
                    "valueString": "Asian"
                  },
                  {
                    "valueString": "Black or African American"
                  },
                  {
                    "valueString": "Native Hawaiian or Other Pacific Islander"
                  },
                  {
                    "valueString": "White"
                  },
                  {
                    "valueString": "Decline to Specify"
                  }
                ]
              },
              {
                "linkId": "patient-pronouns",
                "text": "Preferred pronouns",
                "type": "choice",
                "required": false,
                "answerOption": [
                  {
                    "valueString": "He/him"
                  },
                  {
                    "valueString": "She/her"
                  },
                  {
                    "valueString": "They/them"
                  },
                  {
                    "valueString": "My pronouns are not listed"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/information-text-secondary",
                    "valueString": "Pronoun responses are kept confidential in our system and are used to help us best respect how our patients wish to be addressed."
                  }
                ]
              },
              {
                "linkId": "patient-pronouns-custom",
                "text": "My pronouns",
                "type": "text",
                "required": false,
                "enableWhen": [
                  {
                    "question": "patient-pronouns",
                    "operator": "=",
                    "answerString": "My pronouns are not listed"
                  }
                ]
              },
              {
                "linkId": "patient-details-additional-text",
                "text": "Additional information",
                "type": "display",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/preferred-element",
                    "valueString": "h3"
                  }
                ]
              },
              {
                "linkId": "patient-point-of-discovery",
                "text": "How did you hear about us?",
                "type": "choice",
                "required": false,
                "enableWhen": [
                  {
                    "question": "is-new-qrs-patient",
                    "operator": "=",
                    "answerBoolean": true
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  }
                ],
                "answerOption": [
                  {
                    "valueString": "Friend/Family"
                  },
                  {
                    "valueString": "Been there with another family member"
                  },
                  {
                    "valueString": "Healthcare Professional"
                  },
                  {
                    "valueString": "Google/Internet search"
                  },
                  {
                    "valueString": "Internet ad"
                  },
                  {
                    "valueString": "Social media community group"
                  },
                  {
                    "valueString": "Webinar"
                  },
                  {
                    "valueString": "TV/Radio"
                  },
                  {
                    "valueString": "Newsletter"
                  },
                  {
                    "valueString": "School"
                  },
                  {
                    "valueString": "Drive by/Signage"
                  }
                ]
              },
              {
                "linkId": "preferred-language",
                "text": "Preferred language",
                "type": "choice",
                "required": true,
                "answerOption": [
                  {
                    "valueString": "English"
                  },
                  {
                    "valueString": "Spanish"
                  },
                  {
                    "valueString": "Chinese"
                  },
                  {
                    "valueString": "French"
                  },
                  {
                    "valueString": "German"
                  },
                  {
                    "valueString": "Tagalog"
                  },
                  {
                    "valueString": "Vietnamese"
                  },
                  {
                    "valueString": "Italian"
                  },
                  {
                    "valueString": "Korean"
                  },
                  {
                    "valueString": "Russian"
                  },
                  {
                    "valueString": "Polish"
                  },
                  {
                    "valueString": "Arabic"
                  },
                  {
                    "valueString": "Portuguese"
                  },
                  {
                    "valueString": "Japanese"
                  },
                  {
                    "valueString": "Greek"
                  },
                  {
                    "valueString": "Hindi"
                  },
                  {
                    "valueString": "Persian"
                  },
                  {
                    "valueString": "Urdu"
                  },
                  {
                    "valueString": "Sign Language"
                  },
                  {
                    "valueString": "Other"
                  }
                ]
              },
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
              }
            ]
          },
          {
            "linkId": "primary-care-physician-page",
            "text": "Primary Care Physician",
            "type": "group",
            "enableWhen": [
              {
                "question": "contact-information-page.patient-street-address-2",
                "operator": "!=",
                "answerString": "conditional-filter-test-1234"
              }
            ],
            "item": [
              {
                "linkId": "pcp-first",
                "text": "Provider first name",
                "type": "string",
                "required": false,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "m"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-pcp shipping given-name"
                  }
                ]
              },
              {
                "linkId": "pcp-last",
                "text": "Provider last name",
                "type": "string",
                "required": false,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "m"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-pcp shipping family-name"
                  }
                ]
              },
              {
                "linkId": "pcp-practice",
                "text": "Practice name",
                "type": "string",
                "required": false
              },
              {
                "linkId": "pcp-address",
                "text": "Address",
                "type": "string",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/placeholder",
                    "valueString": "Street address, City, State, ZIP"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-pcp shipping street-address"
                  }
                ]
              },
              {
                "linkId": "pcp-number",
                "text": "Phone number",
                "type": "string",
                "required": false,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Phone Number"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-pcp shipping tel"
                  }
                ]
              }
            ]
          },
          {
            "linkId": "pharmacy-page",
            "text": "Preferred pharmacy",
            "type": "group",
            "item": [
              {
                "linkId": "pharmacy-name",
                "text": "Pharmacy name",
                "type": "string",
                "required": false
              },
              {
                "linkId": "pharmacy-address",
                "text": "Pharmacy address",
                "type": "string",
                "required": false
              }
            ]
          },
          {
            "linkId": "payment-option-page",
            "text": "How would you like to pay for your visit?",
            "extension": [
              {
                "url": "https://fhir.zapehr.com/r4/StructureDefinitions/review-text",
                "valueString": "Insurance details"
              },
              {
                "url": "https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-type",
                    "valueString": "insurance eligibility"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerWhen",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerQuestion",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerOperator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerAnswer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-question",
                    "valueString": "appointment-service-category"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-operator",
                    "valueString": "="
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-answer",
                    "valueString": "occupational-medicine"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-substitute-text",
                    "valueString": "Who is paying for the visit?"
                  }
                ]
              },
              {
                "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-question",
                    "valueString": "appointment-service-category"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-operator",
                    "valueString": "="
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-answer",
                    "valueString": "workmans-comp"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-substitute-text",
                    "valueString": "Who is responsible for the claim?"
                  }
                ]
              }
            ],
            "type": "group",
            "item": [
              {
                "linkId": "payment-option",
                "text": "Select payment option",
                "type": "choice",
                "required": true,
                "answerOption": [
                  {
                    "valueString": "I have insurance",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/answer-enable-when",
                        "valueString": "appointment-service-category != occupational-medicine"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/answer-label-when",
                        "valueString": "appointment-service-category = workmans-comp : Insurance"
                      }
                    ]
                  },
                  {
                    "valueString": "I will pay without insurance",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/answer-enable-when",
                        "valueString": "appointment-service-category != workmans-comp"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/answer-label-when",
                        "valueString": "appointment-service-category = occupational-medicine : Self"
                      }
                    ]
                  },
                  {
                    "valueString": "Employer",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/answer-enable-when",
                        "valueString": "appointment-service-category = occupational-medicine"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/answer-enable-when",
                        "valueString": "appointment-service-category = workmans-comp"
                      }
                    ]
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/preferred-element",
                    "valueString": "Radio"
                  }
                ]
              },
              {
                "linkId": "self-pay-alert-text",
                "text": "By choosing to proceed with self-pay without insurance, you agree to pay $100 at the time of service.",
                "type": "display",
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I will pay without insurance"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Call Out"
                  }
                ]
              },
              {
                "linkId": "insurance-details-text",
                "text": "Insurance details",
                "type": "display",
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ]
              },
              {
                "linkId": "insurance-details-caption",
                "text": "We use this information to help determine your coverage and costs.",
                "type": "display",
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ]
              },
              {
                "linkId": "insurance-carrier",
                "text": "Insurance carrier",
                "type": "choice",
                "required": false,
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/answer-loading-options",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/strategy",
                        "valueString": "dynamic"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/source",
                        "valueExpression": {
                          "language": "application/x-fhir-query",
                          "expression": "Organization?active:not=false&type=http://terminology.hl7.org/CodeSystem/organization-type|pay"
                        }
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "insurance-member-id",
                "text": "Member ID",
                "type": "string",
                "required": false,
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "policy-holder-first-name",
                "text": "Policy holder's first name",
                "type": "string",
                "required": false,
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "policy-holder-middle-name",
                "text": "Policy holder's middle name",
                "type": "string",
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "policy-holder-last-name",
                "text": "Policy holder's last name",
                "type": "string",
                "required": false,
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "policy-holder-date-of-birth",
                "text": "Policy holder's date of birth",
                "type": "date",
                "required": false,
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "DOB"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "policy-holder-birth-sex",
                "text": "Policy holder's birth sex",
                "type": "choice",
                "required": false,
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ],
                "answerOption": [
                  {
                    "valueString": "Male"
                  },
                  {
                    "valueString": "Female"
                  },
                  {
                    "valueString": "Intersex"
                  }
                ]
              },
              {
                "linkId": "policy-holder-address-as-patient",
                "text": "Policy holder address is the same as patient's address",
                "type": "boolean",
                "required": false,
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "policy-holder-address",
                "text": "Policy holder address",
                "type": "string",
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  },
                  {
                    "question": "policy-holder-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-street-address"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "policy-holder-address-additional-line",
                "text": "Policy holder address line 2 (optional)",
                "type": "string",
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  },
                  {
                    "question": "policy-holder-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-street-address-2"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "policy-holder-city",
                "text": "City",
                "type": "string",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-city"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ],
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  },
                  {
                    "question": "policy-holder-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all"
              },
              {
                "linkId": "policy-holder-state",
                "text": "State",
                "type": "choice",
                "answerOption": [
                  {
                    "valueString": "AL"
                  },
                  {
                    "valueString": "AK"
                  },
                  {
                    "valueString": "AZ"
                  },
                  {
                    "valueString": "AR"
                  },
                  {
                    "valueString": "CA"
                  },
                  {
                    "valueString": "CO"
                  },
                  {
                    "valueString": "CT"
                  },
                  {
                    "valueString": "DE"
                  },
                  {
                    "valueString": "DC"
                  },
                  {
                    "valueString": "FL"
                  },
                  {
                    "valueString": "GA"
                  },
                  {
                    "valueString": "HI"
                  },
                  {
                    "valueString": "ID"
                  },
                  {
                    "valueString": "IL"
                  },
                  {
                    "valueString": "IN"
                  },
                  {
                    "valueString": "IA"
                  },
                  {
                    "valueString": "KS"
                  },
                  {
                    "valueString": "KY"
                  },
                  {
                    "valueString": "LA"
                  },
                  {
                    "valueString": "ME"
                  },
                  {
                    "valueString": "MD"
                  },
                  {
                    "valueString": "MA"
                  },
                  {
                    "valueString": "MI"
                  },
                  {
                    "valueString": "MN"
                  },
                  {
                    "valueString": "MS"
                  },
                  {
                    "valueString": "MO"
                  },
                  {
                    "valueString": "MT"
                  },
                  {
                    "valueString": "NE"
                  },
                  {
                    "valueString": "NV"
                  },
                  {
                    "valueString": "NH"
                  },
                  {
                    "valueString": "NJ"
                  },
                  {
                    "valueString": "NM"
                  },
                  {
                    "valueString": "NY"
                  },
                  {
                    "valueString": "NC"
                  },
                  {
                    "valueString": "ND"
                  },
                  {
                    "valueString": "OH"
                  },
                  {
                    "valueString": "OK"
                  },
                  {
                    "valueString": "OR"
                  },
                  {
                    "valueString": "PA"
                  },
                  {
                    "valueString": "RI"
                  },
                  {
                    "valueString": "SC"
                  },
                  {
                    "valueString": "SD"
                  },
                  {
                    "valueString": "TN"
                  },
                  {
                    "valueString": "TX"
                  },
                  {
                    "valueString": "UT"
                  },
                  {
                    "valueString": "VT"
                  },
                  {
                    "valueString": "VA"
                  },
                  {
                    "valueString": "VI"
                  },
                  {
                    "valueString": "WA"
                  },
                  {
                    "valueString": "WV"
                  },
                  {
                    "valueString": "WI"
                  },
                  {
                    "valueString": "WY"
                  }
                ],
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  },
                  {
                    "question": "policy-holder-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-state"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "policy-holder-zip",
                "text": "ZIP",
                "type": "string",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "ZIP"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-zip"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ],
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  },
                  {
                    "question": "policy-holder-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all"
              },
              {
                "linkId": "patient-relationship-to-insured",
                "text": "Patient's relationship to insured",
                "type": "choice",
                "required": false,
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ],
                "answerOption": [
                  {
                    "valueString": "Self"
                  },
                  {
                    "valueString": "Child"
                  },
                  {
                    "valueString": "Parent"
                  },
                  {
                    "valueString": "Spouse"
                  },
                  {
                    "valueString": "Common Law Spouse"
                  },
                  {
                    "valueString": "Injured Party"
                  },
                  {
                    "valueString": "Other"
                  }
                ]
              },
              {
                "linkId": "insurance-card-front",
                "text": "Front side of the insurance card (optional)",
                "type": "attachment",
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "required": false,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text",
                    "valueString": "Take a picture of the **front side** of your card and upload it here"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Image"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/document-type",
                    "valueString": "64290-0"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "insurance-card-back",
                "text": "Back side of the insurance card (optional)",
                "type": "attachment",
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "required": false,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text",
                    "valueString": "Take a picture of the **back side** of your card and upload it here"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Image"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/document-type",
                    "valueString": "64290-0"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "insurance-eligibility-verification-status",
                "type": "string",
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "NEVER"
                  }
                ],
                "required": false,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/accepts-multiple-answers",
                    "valueBoolean": true
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "display-secondary-insurance",
                "text": "Add Secondary Insurance",
                "type": "boolean",
                "required": false,
                "enableWhen": [
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-question",
                        "valueString": "display-secondary-insurance"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-operator",
                        "valueString": "="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-answer",
                        "valueBoolean": true
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-when-substitute-text",
                        "valueString": "Remove Secondary Insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "payment-option"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueString": "I have insurance"
                      }
                    ]
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/preferred-element",
                    "valueString": "Button"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "l"
                  }
                ]
              },
              {
                "linkId": "secondary-insurance",
                "type": "group",
                "enableWhen": [
                  {
                    "question": "display-secondary-insurance",
                    "operator": "=",
                    "answerBoolean": true
                  },
                  {
                    "question": "payment-option",
                    "operator": "=",
                    "answerString": "I have insurance"
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                        "valueString": "display-secondary-insurance"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                        "valueString": "!="
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                        "valueBoolean": true
                      }
                    ]
                  }
                ],
                "item": [
                  {
                    "linkId": "insurance-details-text-2",
                    "text": "Secondary insurance details",
                    "type": "display"
                  },
                  {
                    "linkId": "insurance-carrier-2",
                    "text": "Insurance carrier",
                    "type": "choice",
                    "required": true,
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when",
                        "extension": [
                          {
                            "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question",
                            "valueString": "payment-option"
                          },
                          {
                            "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator",
                            "valueString": "!="
                          },
                          {
                            "url": "https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer",
                            "valueString": "I have insurance"
                          }
                        ]
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/answer-loading-options",
                        "extension": [
                          {
                            "url": "https://fhir.zapehr.com/r4/StructureDefinitions/strategy",
                            "valueString": "dynamic"
                          },
                          {
                            "url": "https://fhir.zapehr.com/r4/StructureDefinitions/source",
                            "valueExpression": {
                              "language": "application/x-fhir-query",
                              "expression": "Organization?active:not=false&type=http://terminology.hl7.org/CodeSystem/organization-type|pay"
                            }
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "linkId": "insurance-member-id-2",
                    "text": "Member ID",
                    "type": "string",
                    "required": true
                  },
                  {
                    "linkId": "policy-holder-first-name-2",
                    "text": "Policy holder's first name",
                    "type": "string",
                    "required": true
                  },
                  {
                    "linkId": "policy-holder-middle-name-2",
                    "text": "Policy holder's middle name",
                    "type": "string",
                    "required": false
                  },
                  {
                    "linkId": "policy-holder-last-name-2",
                    "text": "Policy holder's last name",
                    "type": "string",
                    "required": true
                  },
                  {
                    "linkId": "policy-holder-date-of-birth-2",
                    "text": "Policy holder's date of birth",
                    "type": "date",
                    "required": true,
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                        "valueString": "DOB"
                      }
                    ]
                  },
                  {
                    "linkId": "policy-holder-birth-sex-2",
                    "text": "Policy holder's birth sex",
                    "type": "choice",
                    "required": true,
                    "answerOption": [
                      {
                        "valueString": "Male"
                      },
                      {
                        "valueString": "Female"
                      },
                      {
                        "valueString": "Intersex"
                      }
                    ]
                  },
                  {
                    "linkId": "policy-holder-address-as-patient-2",
                    "text": "Policy holder address is the same as patient's address",
                    "type": "boolean",
                    "required": false
                  },
                  {
                    "linkId": "policy-holder-address-2",
                    "text": "Policy holder address",
                    "type": "string",
                    "required": true,
                    "enableWhen": [
                      {
                        "question": "secondary-insurance.policy-holder-address-as-patient-2",
                        "operator": "!=",
                        "answerBoolean": true
                      }
                    ],
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                        "valueString": "patient-street-address"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                        "valueString": "hidden"
                      }
                    ]
                  },
                  {
                    "linkId": "policy-holder-address-additional-line-2",
                    "text": "Policy holder address line 2 (optional)",
                    "type": "string",
                    "enableWhen": [
                      {
                        "question": "secondary-insurance.policy-holder-address-as-patient-2",
                        "operator": "!=",
                        "answerBoolean": true
                      }
                    ],
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                        "valueString": "patient-street-address-2"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                        "valueString": "hidden"
                      }
                    ]
                  },
                  {
                    "linkId": "policy-holder-city-2",
                    "text": "City",
                    "type": "string",
                    "required": true,
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                        "valueString": "s"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                        "valueString": "patient-city"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                        "valueString": "hidden"
                      }
                    ],
                    "enableWhen": [
                      {
                        "question": "secondary-insurance.policy-holder-address-as-patient-2",
                        "operator": "!=",
                        "answerBoolean": true
                      }
                    ]
                  },
                  {
                    "linkId": "policy-holder-state-2",
                    "text": "State",
                    "type": "choice",
                    "required": true,
                    "answerOption": [
                      {
                        "valueString": "AL"
                      },
                      {
                        "valueString": "AK"
                      },
                      {
                        "valueString": "AZ"
                      },
                      {
                        "valueString": "AR"
                      },
                      {
                        "valueString": "CA"
                      },
                      {
                        "valueString": "CO"
                      },
                      {
                        "valueString": "CT"
                      },
                      {
                        "valueString": "DE"
                      },
                      {
                        "valueString": "DC"
                      },
                      {
                        "valueString": "FL"
                      },
                      {
                        "valueString": "GA"
                      },
                      {
                        "valueString": "HI"
                      },
                      {
                        "valueString": "ID"
                      },
                      {
                        "valueString": "IL"
                      },
                      {
                        "valueString": "IN"
                      },
                      {
                        "valueString": "IA"
                      },
                      {
                        "valueString": "KS"
                      },
                      {
                        "valueString": "KY"
                      },
                      {
                        "valueString": "LA"
                      },
                      {
                        "valueString": "ME"
                      },
                      {
                        "valueString": "MD"
                      },
                      {
                        "valueString": "MA"
                      },
                      {
                        "valueString": "MI"
                      },
                      {
                        "valueString": "MN"
                      },
                      {
                        "valueString": "MS"
                      },
                      {
                        "valueString": "MO"
                      },
                      {
                        "valueString": "MT"
                      },
                      {
                        "valueString": "NE"
                      },
                      {
                        "valueString": "NV"
                      },
                      {
                        "valueString": "NH"
                      },
                      {
                        "valueString": "NJ"
                      },
                      {
                        "valueString": "NM"
                      },
                      {
                        "valueString": "NY"
                      },
                      {
                        "valueString": "NC"
                      },
                      {
                        "valueString": "ND"
                      },
                      {
                        "valueString": "OH"
                      },
                      {
                        "valueString": "OK"
                      },
                      {
                        "valueString": "OR"
                      },
                      {
                        "valueString": "PA"
                      },
                      {
                        "valueString": "RI"
                      },
                      {
                        "valueString": "SC"
                      },
                      {
                        "valueString": "SD"
                      },
                      {
                        "valueString": "TN"
                      },
                      {
                        "valueString": "TX"
                      },
                      {
                        "valueString": "UT"
                      },
                      {
                        "valueString": "VT"
                      },
                      {
                        "valueString": "VA"
                      },
                      {
                        "valueString": "VI"
                      },
                      {
                        "valueString": "WA"
                      },
                      {
                        "valueString": "WV"
                      },
                      {
                        "valueString": "WI"
                      },
                      {
                        "valueString": "WY"
                      }
                    ],
                    "enableWhen": [
                      {
                        "question": "secondary-insurance.policy-holder-address-as-patient-2",
                        "operator": "!=",
                        "answerBoolean": true
                      }
                    ],
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                        "valueString": "s"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                        "valueString": "patient-state"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                        "valueString": "hidden"
                      }
                    ]
                  },
                  {
                    "linkId": "policy-holder-zip-2",
                    "text": "ZIP",
                    "type": "string",
                    "required": true,
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                        "valueString": "s"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                        "valueString": "ZIP"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                        "valueString": "patient-zip"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                        "valueString": "hidden"
                      }
                    ],
                    "enableWhen": [
                      {
                        "question": "secondary-insurance.policy-holder-address-as-patient-2",
                        "operator": "!=",
                        "answerBoolean": true
                      }
                    ],
                    "enableBehavior": "all"
                  },
                  {
                    "linkId": "patient-relationship-to-insured-2",
                    "text": "Patient's relationship to insured",
                    "type": "choice",
                    "required": true,
                    "answerOption": [
                      {
                        "valueString": "Self"
                      },
                      {
                        "valueString": "Child"
                      },
                      {
                        "valueString": "Parent"
                      },
                      {
                        "valueString": "Spouse"
                      },
                      {
                        "valueString": "Common Law Spouse"
                      },
                      {
                        "valueString": "Injured Party"
                      },
                      {
                        "valueString": "Other"
                      }
                    ]
                  },
                  {
                    "linkId": "insurance-card-front-2",
                    "text": "Front side of the insurance card (optional)",
                    "type": "attachment",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text",
                        "valueString": "Take a picture of the **front side** of your card and upload it here"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                        "valueString": "Image"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/document-type",
                        "valueString": "64290-0"
                      }
                    ]
                  },
                  {
                    "linkId": "insurance-card-back-2",
                    "text": "Back side of the insurance card",
                    "type": "attachment",
                    "extension": [
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text",
                        "valueString": "Take a picture of the **back side** of your card and upload it here"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                        "valueString": "Image"
                      },
                      {
                        "url": "https://fhir.zapehr.com/r4/StructureDefinitions/document-type",
                        "valueString": "64290-0"
                      }
                    ]
                  }
                ]
              },
              {
                "linkId": "appointment-service-category",
                "type": "string",
                "required": true,
                "readOnly": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "hidden"
                  }
                ]
              }
            ]
          },
          {
            "linkId": "card-payment-page",
            "type": "group",
            "text": "Credit card details",
            "item": [
              {
                "linkId": "valid-card-on-file",
                "type": "boolean",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Payment Validation"
                  }
                ]
              },
              {
                "linkId": "card-payment-details-text",
                "text": "If you choose not to enter your credit card information in advance, payment (cash or credit) will be required upon arrival.",
                "type": "display",
                "enableWhen": [
                  {
                    "question": "card-payment-details-text",
                    "operator": "=",
                    "answerString": "-"
                  }
                ]
              }
            ]
          },
          {
            "linkId": "responsible-party-page",
            "text": "Responsible party information",
            "type": "group",
            "item": [
              {
                "linkId": "responsible-party-page-caption",
                "text": "A responsible party is the individual responsible for the visit’s financial obligations. If the patient is not their own responsible party, then the responsible party must be the patient’s legal guardian or legal designee.",
                "type": "display",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/preferred-element",
                    "valueString": "p"
                  }
                ]
              },
              {
                "linkId": "responsible-party-relationship",
                "text": "Relationship to the patient",
                "type": "choice",
                "required": true,
                "answerOption": [
                  {
                    "valueString": "Self"
                  },
                  {
                    "valueString": "Spouse"
                  },
                  {
                    "valueString": "Parent"
                  },
                  {
                    "valueString": "Legal Guardian"
                  },
                  {
                    "valueString": "Other"
                  }
                ]
              },
              {
                "linkId": "responsible-party-first-name",
                "text": "First name",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "m"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-first-name"
                  }
                ]
              },
              {
                "linkId": "responsible-party-last-name",
                "text": "Last name",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "m"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-last-name"
                  }
                ]
              },
              {
                "linkId": "responsible-party-date-of-birth",
                "text": "Date of birth",
                "type": "date",
                "required": true,
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-birthdate"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "DOB"
                  }
                ]
              },
              {
                "linkId": "responsible-party-birth-sex",
                "text": "Birth sex",
                "type": "choice",
                "required": true,
                "answerOption": [
                  {
                    "valueString": "Male"
                  },
                  {
                    "valueString": "Female"
                  },
                  {
                    "valueString": "Intersex"
                  }
                ],
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-birth-sex"
                  }
                ]
              },
              {
                "linkId": "responsible-party-address-as-patient",
                "text": "Responsible party's address is the same as patient's address",
                "type": "boolean",
                "required": false,
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  }
                ]
              },
              {
                "linkId": "responsible-party-address",
                "text": "Address",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  },
                  {
                    "question": "responsible-party-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-street-address"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "responsible-party-address-2",
                "text": "Address line 2 (optional)",
                "type": "string",
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  },
                  {
                    "question": "responsible-party-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-street-address-2"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "responsible-party-city",
                "text": "City",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  },
                  {
                    "question": "responsible-party-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-city"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "responsible-party-state",
                "text": "State",
                "type": "choice",
                "answerOption": [
                  {
                    "valueString": "AL"
                  },
                  {
                    "valueString": "AK"
                  },
                  {
                    "valueString": "AZ"
                  },
                  {
                    "valueString": "AR"
                  },
                  {
                    "valueString": "CA"
                  },
                  {
                    "valueString": "CO"
                  },
                  {
                    "valueString": "CT"
                  },
                  {
                    "valueString": "DE"
                  },
                  {
                    "valueString": "DC"
                  },
                  {
                    "valueString": "FL"
                  },
                  {
                    "valueString": "GA"
                  },
                  {
                    "valueString": "HI"
                  },
                  {
                    "valueString": "ID"
                  },
                  {
                    "valueString": "IL"
                  },
                  {
                    "valueString": "IN"
                  },
                  {
                    "valueString": "IA"
                  },
                  {
                    "valueString": "KS"
                  },
                  {
                    "valueString": "KY"
                  },
                  {
                    "valueString": "LA"
                  },
                  {
                    "valueString": "ME"
                  },
                  {
                    "valueString": "MD"
                  },
                  {
                    "valueString": "MA"
                  },
                  {
                    "valueString": "MI"
                  },
                  {
                    "valueString": "MN"
                  },
                  {
                    "valueString": "MS"
                  },
                  {
                    "valueString": "MO"
                  },
                  {
                    "valueString": "MT"
                  },
                  {
                    "valueString": "NE"
                  },
                  {
                    "valueString": "NV"
                  },
                  {
                    "valueString": "NH"
                  },
                  {
                    "valueString": "NJ"
                  },
                  {
                    "valueString": "NM"
                  },
                  {
                    "valueString": "NY"
                  },
                  {
                    "valueString": "NC"
                  },
                  {
                    "valueString": "ND"
                  },
                  {
                    "valueString": "OH"
                  },
                  {
                    "valueString": "OK"
                  },
                  {
                    "valueString": "OR"
                  },
                  {
                    "valueString": "PA"
                  },
                  {
                    "valueString": "RI"
                  },
                  {
                    "valueString": "SC"
                  },
                  {
                    "valueString": "SD"
                  },
                  {
                    "valueString": "TN"
                  },
                  {
                    "valueString": "TX"
                  },
                  {
                    "valueString": "UT"
                  },
                  {
                    "valueString": "VT"
                  },
                  {
                    "valueString": "VA"
                  },
                  {
                    "valueString": "VI"
                  },
                  {
                    "valueString": "WA"
                  },
                  {
                    "valueString": "WV"
                  },
                  {
                    "valueString": "WI"
                  },
                  {
                    "valueString": "WY"
                  }
                ],
                "required": true,
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  },
                  {
                    "question": "responsible-party-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-state"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "responsible-party-zip",
                "text": "ZIP",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  },
                  {
                    "question": "responsible-party-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "ZIP"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-zip"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "responsible-party-number",
                "text": "Phone number (optional)",
                "type": "string",
                "required": false,
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Phone Number"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-number"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "responsible-party-email",
                "text": "Email",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "responsible-party-relationship",
                    "operator": "!=",
                    "answerString": "Self"
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Email"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-email"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              }
            ]
          },
          {
            "linkId": "employer-information-page",
            "text": "Employer information",
            "type": "group",
            "item": [
              {
                "linkId": "employer-name",
                "text": "Employer Name",
                "type": "string",
                "required": true
              },
              {
                "linkId": "employer-address",
                "text": "Employer Address",
                "type": "string",
                "required": true
              },
              {
                "linkId": "employer-address-2",
                "text": "Address line 2 (optional)",
                "type": "string",
                "required": false
              },
              {
                "linkId": "employer-city",
                "text": "City",
                "type": "string",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  }
                ]
              },
              {
                "linkId": "employer-state",
                "text": "State",
                "type": "choice",
                "required": true,
                "answerOption": [
                  {
                    "valueString": "AL"
                  },
                  {
                    "valueString": "AK"
                  },
                  {
                    "valueString": "AZ"
                  },
                  {
                    "valueString": "AR"
                  },
                  {
                    "valueString": "CA"
                  },
                  {
                    "valueString": "CO"
                  },
                  {
                    "valueString": "CT"
                  },
                  {
                    "valueString": "DE"
                  },
                  {
                    "valueString": "DC"
                  },
                  {
                    "valueString": "FL"
                  },
                  {
                    "valueString": "GA"
                  },
                  {
                    "valueString": "HI"
                  },
                  {
                    "valueString": "ID"
                  },
                  {
                    "valueString": "IL"
                  },
                  {
                    "valueString": "IN"
                  },
                  {
                    "valueString": "IA"
                  },
                  {
                    "valueString": "KS"
                  },
                  {
                    "valueString": "KY"
                  },
                  {
                    "valueString": "LA"
                  },
                  {
                    "valueString": "ME"
                  },
                  {
                    "valueString": "MD"
                  },
                  {
                    "valueString": "MA"
                  },
                  {
                    "valueString": "MI"
                  },
                  {
                    "valueString": "MN"
                  },
                  {
                    "valueString": "MS"
                  },
                  {
                    "valueString": "MO"
                  },
                  {
                    "valueString": "MT"
                  },
                  {
                    "valueString": "NE"
                  },
                  {
                    "valueString": "NV"
                  },
                  {
                    "valueString": "NH"
                  },
                  {
                    "valueString": "NJ"
                  },
                  {
                    "valueString": "NM"
                  },
                  {
                    "valueString": "NY"
                  },
                  {
                    "valueString": "NC"
                  },
                  {
                    "valueString": "ND"
                  },
                  {
                    "valueString": "OH"
                  },
                  {
                    "valueString": "OK"
                  },
                  {
                    "valueString": "OR"
                  },
                  {
                    "valueString": "PA"
                  },
                  {
                    "valueString": "RI"
                  },
                  {
                    "valueString": "SC"
                  },
                  {
                    "valueString": "SD"
                  },
                  {
                    "valueString": "TN"
                  },
                  {
                    "valueString": "TX"
                  },
                  {
                    "valueString": "UT"
                  },
                  {
                    "valueString": "VT"
                  },
                  {
                    "valueString": "VA"
                  },
                  {
                    "valueString": "VI"
                  },
                  {
                    "valueString": "WA"
                  },
                  {
                    "valueString": "WV"
                  },
                  {
                    "valueString": "WI"
                  },
                  {
                    "valueString": "WY"
                  }
                ],
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  }
                ]
              },
              {
                "linkId": "employer-zip",
                "text": "ZIP",
                "type": "string",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "ZIP"
                  }
                ]
              },
              {
                "linkId": "employer-contact-text",
                "text": "Employer Contact",
                "type": "display"
              },
              {
                "linkId": "employer-contact-first-name",
                "text": "First name",
                "type": "string",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "m"
                  }
                ]
              },
              {
                "linkId": "employer-contact-last-name",
                "text": "Last name",
                "type": "string",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "m"
                  }
                ]
              },
              {
                "linkId": "employer-contact-title",
                "text": "Title",
                "type": "string",
                "required": false
              },
              {
                "linkId": "employer-contact-email",
                "text": "Email",
                "type": "string",
                "required": false,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Email"
                  }
                ]
              },
              {
                "linkId": "employer-contact-phone",
                "text": "Mobile",
                "type": "string",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Phone Number"
                  }
                ]
              },
              {
                "linkId": "employer-contact-fax",
                "text": "Fax",
                "type": "string",
                "required": false,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Phone Number"
                  }
                ]
              }
            ]
          },
          {
            "linkId": "emergency-contact-page",
            "text": "Emergency Contact",
            "type": "group",
            "item": [
              {
                "linkId": "emergency-contact-relationship",
                "text": "Relationship to the patient",
                "type": "choice",
                "required": true,
                "answerOption": [
                  {
                    "valueString": "Spouse"
                  },
                  {
                    "valueString": "Parent"
                  },
                  {
                    "valueString": "Legal Guardian"
                  },
                  {
                    "valueString": "Other"
                  }
                ]
              },
              {
                "linkId": "emergency-contact-first-name",
                "text": "Emergency contact first name",
                "type": "string",
                "required": true
              },
              {
                "linkId": "emergency-contact-middle-name",
                "text": "Emergency contact middle name",
                "type": "string",
                "required": false
              },
              {
                "linkId": "emergency-contact-last-name",
                "text": "Emergency contact last name",
                "type": "string",
                "required": true
              },
              {
                "linkId": "emergency-contact-number",
                "text": "Emergency contact phone",
                "type": "string",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Phone Number"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-patient shipping tel"
                  }
                ]
              },
              {
                "linkId": "emergency-contact-address-as-patient",
                "text": "Same as patient's address",
                "type": "boolean",
                "required": false
              },
              {
                "linkId": "emergency-contact-address",
                "text": "Address",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "emergency-contact-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-street-address"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "emergency-contact-address-2",
                "text": "Address line 2 (optional)",
                "type": "string",
                "enableWhen": [
                  {
                    "question": "emergency-contact-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-street-address-2"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "emergency-contact-city",
                "text": "City",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "emergency-contact-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-city"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "emergency-contact-state",
                "text": "State",
                "type": "choice",
                "answerOption": [
                  {
                    "valueString": "AL"
                  },
                  {
                    "valueString": "AK"
                  },
                  {
                    "valueString": "AZ"
                  },
                  {
                    "valueString": "AR"
                  },
                  {
                    "valueString": "CA"
                  },
                  {
                    "valueString": "CO"
                  },
                  {
                    "valueString": "CT"
                  },
                  {
                    "valueString": "DE"
                  },
                  {
                    "valueString": "DC"
                  },
                  {
                    "valueString": "FL"
                  },
                  {
                    "valueString": "GA"
                  },
                  {
                    "valueString": "HI"
                  },
                  {
                    "valueString": "ID"
                  },
                  {
                    "valueString": "IL"
                  },
                  {
                    "valueString": "IN"
                  },
                  {
                    "valueString": "IA"
                  },
                  {
                    "valueString": "KS"
                  },
                  {
                    "valueString": "KY"
                  },
                  {
                    "valueString": "LA"
                  },
                  {
                    "valueString": "ME"
                  },
                  {
                    "valueString": "MD"
                  },
                  {
                    "valueString": "MA"
                  },
                  {
                    "valueString": "MI"
                  },
                  {
                    "valueString": "MN"
                  },
                  {
                    "valueString": "MS"
                  },
                  {
                    "valueString": "MO"
                  },
                  {
                    "valueString": "MT"
                  },
                  {
                    "valueString": "NE"
                  },
                  {
                    "valueString": "NV"
                  },
                  {
                    "valueString": "NH"
                  },
                  {
                    "valueString": "NJ"
                  },
                  {
                    "valueString": "NM"
                  },
                  {
                    "valueString": "NY"
                  },
                  {
                    "valueString": "NC"
                  },
                  {
                    "valueString": "ND"
                  },
                  {
                    "valueString": "OH"
                  },
                  {
                    "valueString": "OK"
                  },
                  {
                    "valueString": "OR"
                  },
                  {
                    "valueString": "PA"
                  },
                  {
                    "valueString": "RI"
                  },
                  {
                    "valueString": "SC"
                  },
                  {
                    "valueString": "SD"
                  },
                  {
                    "valueString": "TN"
                  },
                  {
                    "valueString": "TX"
                  },
                  {
                    "valueString": "UT"
                  },
                  {
                    "valueString": "VT"
                  },
                  {
                    "valueString": "VA"
                  },
                  {
                    "valueString": "VI"
                  },
                  {
                    "valueString": "WA"
                  },
                  {
                    "valueString": "WV"
                  },
                  {
                    "valueString": "WI"
                  },
                  {
                    "valueString": "WY"
                  }
                ],
                "required": true,
                "enableWhen": [
                  {
                    "question": "emergency-contact-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-state"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "emergency-contact-zip",
                "text": "ZIP",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "emergency-contact-address-as-patient",
                    "operator": "!=",
                    "answerBoolean": true
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "ZIP"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-width",
                    "valueString": "s"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled",
                    "valueString": "patient-zip"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              }
            ]
          },
          {
            "linkId": "photo-id-page",
            "text": "Photo ID",
            "type": "group",
            "item": [
              {
                "linkId": "photo-id-page-caption",
                "text": "Please upload a Photo ID, Driver's License, or Passport for an adult, either yourself or the parent/guardian when accompanying a child. ",
                "type": "display",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/preferred-element",
                    "valueString": "p"
                  }
                ]
              },
              {
                "linkId": "photo-id-front",
                "text": "Take a picture of the front side of your Photo ID (optional)",
                "type": "attachment",
                "required": false,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text",
                    "valueString": "Take a picture of the **front side** of your Photo ID"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Image"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/document-type",
                    "valueString": "55188-7"
                  }
                ]
              },
              {
                "linkId": "photo-id-back",
                "text": "Take a picture of the back side of your Photo ID (optional)",
                "type": "attachment",
                "required": false,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text",
                    "valueString": "Take a picture of the **back side** of your Photo ID"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Image"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/document-type",
                    "valueString": "55188-7"
                  }
                ]
              }
            ]
          },
          {
            "linkId": "consent-forms-page",
            "text": "Complete consent forms",
            "type": "group",
            "extension": [
              {
                "url": "https://fhir.zapehr.com/r4/StructureDefinitions/review-text",
                "valueString": "Consent forms"
              }
            ],
            "enableWhen": [
              {
                "question": "$status",
                "operator": "!=",
                "answerString": "completed"
              },
              {
                "question": "$status",
                "operator": "!=",
                "answerString": "amended"
              }
            ],
            "enableBehavior": "all",
            "item": [
              {
                "linkId": "hipaa-acknowledgement",
                "text": "I have reviewed and accept [HIPAA Acknowledgement](/hipaa_notice_template.pdf)",
                "type": "boolean",
                "required": true,
                "enableWhen": [
                  {
                    "question": "$status",
                    "operator": "!=",
                    "answerString": "completed"
                  },
                  {
                    "question": "$status",
                    "operator": "!=",
                    "answerString": "amended"
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/permissible-value",
                    "valueBoolean": true
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "consent-to-treat",
                "text": "I have reviewed and accept [Consent to Treat, Guarantee of Payment & Card on File Agreement](/consent_to_treat_template.pdf)",
                "type": "boolean",
                "required": true,
                "enableWhen": [
                  {
                    "question": "$status",
                    "operator": "!=",
                    "answerString": "completed"
                  },
                  {
                    "question": "$status",
                    "operator": "!=",
                    "answerString": "amended"
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/permissible-value",
                    "valueBoolean": true
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "signature",
                "text": "Signature",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "$status",
                    "operator": "!=",
                    "answerString": "completed"
                  },
                  {
                    "question": "$status",
                    "operator": "!=",
                    "answerString": "amended"
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Signature"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "full-name",
                "text": "Full name",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "$status",
                    "operator": "!=",
                    "answerString": "completed"
                  },
                  {
                    "question": "$status",
                    "operator": "!=",
                    "answerString": "amended"
                  }
                ],
                "enableBehavior": "all",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete",
                    "valueString": "section-consent-forms shipping name"
                  },
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ]
              },
              {
                "linkId": "consent-form-signer-relationship",
                "text": "Relationship to the patient",
                "type": "choice",
                "required": true,
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display",
                    "valueString": "protected"
                  }
                ],
                "enableWhen": [
                  {
                    "question": "$status",
                    "operator": "!=",
                    "answerString": "completed"
                  },
                  {
                    "question": "$status",
                    "operator": "!=",
                    "answerString": "amended"
                  }
                ],
                "enableBehavior": "all",
                "answerOption": [
                  {
                    "valueString": "Self"
                  },
                  {
                    "valueString": "Spouse"
                  },
                  {
                    "valueString": "Parent"
                  },
                  {
                    "valueString": "Legal Guardian"
                  },
                  {
                    "valueString": "Other"
                  }
                ]
              }
            ]
          },
          {
            "linkId": "medical-history-page",
            "text": "Medical history",
            "type": "group",
            "item": [
              {
                "linkId": "medical-history-questionnaire",
                "type": "boolean",
                "extension": [
                  {
                    "url": "https://fhir.zapehr.com/r4/StructureDefinitions/data-type",
                    "valueString": "Medical History"
                  }
                ]
              }
            ]
          }
        ]
      }
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
        text: 'Street address',
        type: 'string',
        autocomplete: 'section-contact-information shipping address-line1',
      },
      streetAddress2: {
        key: 'patient-street-address-2',
        label: 'Address line 2 (optional)',
        text: 'Address line 2 (optional)',
        type: 'string',
        autocomplete: 'section-contact-information shipping address-line2',
      },
      city: {
        key: 'patient-city',
        label: 'City',
        text: 'City',
        type: 'string',
        inputWidth: 's',
        autocomplete: 'section-contact-information shipping address-level2',
      },
      state: {
        key: 'patient-state',
        label: 'State',
        text: 'State',
        type: 'choice',
        options: formValueSets.stateOptions,
        inputWidth: 's',
      },
      zip: {
        key: 'patient-zip',
        label: 'ZIP',
        text: 'ZIP',
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
        text: 'Email',
        type: 'string',
        dataType: 'Email',
        autocomplete: 'section-patient shipping email',
      },
      phoneNumber: {
        key: 'patient-number',
        label: 'Mobile',
        text: 'Mobile',
        type: 'string',
        dataType: 'Phone Number',
        autocomplete: 'section-patient shipping tel',
      },
      preferredCommunicationMethod: {
        key: 'patient-preferred-communication-method',
        label: 'Preferred Communication Method',
        text: 'Preferred Communication Method',
        type: 'choice',
        options: formValueSets.preferredCommunicationMethodOptions,
      },
      mobileOptIn: {
        key: 'mobile-opt-in',
        label:
          'Yes! I would like to receive helpful text messages from Ottehr regarding patient education, events, and general information about our offices. Message frequency varies, and data rates may apply.',
        text: 'Yes! I would like to receive helpful text messages from Ottehr regarding patient education, events, and general information about our offices. Message frequency varies, and data rates may apply.',
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
        text: 'Ethnicity',
        type: 'choice',
        options: formValueSets.ethnicityOptions,
      },
      race: {
        key: 'patient-race',
        label: 'Race',
        text: 'Race',
        type: 'choice',
        options: formValueSets.raceOptions,
      },
      pronouns: {
        key: 'patient-pronouns',
        label: 'Preferred pronouns',
        text: 'Preferred pronouns',
        type: 'choice',
        options: formValueSets.pronounOptions,
      },
      pronounsCustom: {
        key: 'patient-pronouns-custom',
        label: 'My pronouns',
        text: 'My pronouns',
        type: 'string',
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
        text: 'How did you hear about us?',
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
        text: 'Preferred language',
        type: 'choice',
        options: formValueSets.languageOptions,
      },
      otherPreferredLanguage: {
        key: 'other-preferred-language',
        label: 'Other preferred language',
        text: 'Other preferred language',
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
    },
    hiddenFields: [],
    requiredFields: ['patient-ethnicity', 'patient-race', 'preferred-language'],
  },
  primaryCarePhysician: {
    linkId: 'primary-care-physician-page',
    title: 'Primary Care Physician',
    enableWhen: [
      {
        question: 'contact-information-page.patient-street-address-2',
        operator: '!=',
        answerString: 'conditional-filter-test-1234',
      },
    ],
    items: {
      firstName: {
        key: 'pcp-first',
        label: 'Provider first name',
        text: 'Provider first name',
        type: 'string',
        inputWidth: 'm',
        autocomplete: 'section-pcp shipping given-name',
      },
      lastName: {
        key: 'pcp-last',
        label: 'Provider last name',
        text: 'Provider last name',
        type: 'string',
        inputWidth: 'm',
        autocomplete: 'section-pcp shipping family-name',
      },
      practiceName: {
        key: 'pcp-practice',
        label: 'Practice name',
        text: 'Practice name',
        type: 'string',
      },
      address: {
        key: 'pcp-address',
        label: 'Address',
        text: 'Address',
        type: 'string',
        autocomplete: 'section-pcp shipping street-address',
      },
      phoneNumber: {
        key: 'pcp-number',
        label: 'Phone number',
        text: 'Phone number',
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
        text: 'Pharmacy name',
        type: 'string',
      },
      address: {
        key: 'pharmacy-address',
        label: 'Pharmacy address',
        text: 'Pharmacy address',
        type: 'string',
      },
    },
    hiddenFields: [],
    requiredFields: [],
  },
  paymentOptionDefault: {
    linkId: 'payment-option-default-page',
    title: 'How would you like to pay for your visit?',
    reviewText: 'Insurance details',
    logicalItems: {
      appointmentServiceCategory: {
        key: 'appointment-service-category',
        type: 'string',
      },
    },
    enableWhen: [
      {
        question: 'appointment-service-category',
        operator: '!=',
        answerString: 'occupational-medicine',
      },
      {
        question: 'appointment-service-category',
        operator: '!=',
        answerString: 'workmans-comp',
      },
    ],
    enableBehavior: 'all',
    items: {
      paymentOption: {
        key: 'payment-option-default',
        label: 'Select payment option',
        text: 'Select payment option',
        type: 'choice',
        options: [
          { label: 'I have insurance', value: 'I have insurance' },
          { label: 'I will pay without insurance', value: 'I will pay without insurance' },
        ],
      },
      selfPayAlert: {
        key: 'self-pay-alert-text-default',
        text: 'By choosing to proceed with self-pay without insurance, you agree to pay $100 at the time of service.',
        type: 'display',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option-default',
            effect: ['enable'],
            operator: '=',
            answerString: 'I will pay without insurance',
          },
        ],
      },
    },
    hiddenFields: [],
    requiredFields: ['payment-option-default'],
  },
  paymentOptionOccupational: {
    linkId: 'payment-option-occupational-page',
    title: 'Who is paying for the visit?',
    reviewText: 'Insurance details',
    enableWhen: [
      {
        question: 'appointment-service-category',
        operator: '=',
        answerString: 'occupational-medicine',
      },
    ],
    items: {
      paymentOption: {
        key: 'payment-option-occupational',
        label: 'Select payment option',
        text: 'Select payment option',
        type: 'choice',
        options: [
          { label: 'Self', value: 'I will pay without insurance' },
          { label: 'Employer', value: 'Employer' },
        ],
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
            answerString: 'I will pay without insurance',
          },
        ],
      },
    },
    hiddenFields: [],
    requiredFields: ['payment-option-occupational'],
  },
  paymentOptionWorkmans: {
    linkId: 'payment-option-workmans-page',
    title: 'Who is responsible for the claim?',
    reviewText: 'Insurance details',
    enableWhen: [
      {
        question: 'appointment-service-category',
        operator: '=',
        answerString: 'workmans-comp',
      },
    ],
    items: {
      paymentOption: {
        key: 'payment-option-workmans',
        label: 'Select payment option',
        text: 'Select payment option',
        type: 'choice',
        options: [
          { label: 'Insurance', value: 'I have insurance' },
          { label: 'Employer', value: 'Employer' },
        ],
      },
      selfPayAlert: {
        key: 'self-pay-alert-text-workmans',
        text: 'By choosing to proceed with self-pay without insurance, you agree to pay $100 at the time of service.',
        type: 'display',
        triggers: [
          {
            targetQuestionLinkId: 'payment-option-workmans',
            effect: ['enable'],
            operator: '=',
            answerString: 'I will pay without insurance',
          },
        ],
      },
    },
    hiddenFields: [],
    requiredFields: ['payment-option-workmans'],
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
        text: 'Relationship to the patient',
        type: 'choice',
        options: formValueSets.relationshipOptions,
      },
      firstName: {
        key: 'responsible-party-first-name',
        label: 'First name',
        text: 'First name',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-first-name' },
      },
      lastName: {
        key: 'responsible-party-last-name',
        label: 'Last name',
        text: 'Last name',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-last-name' },
      },
      birthDate: {
        key: 'responsible-party-date-of-birth',
        label: 'Date of birth',
        text: 'Date of birth',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-birthdate' },
      },
      phoneNumber: {
        key: 'responsible-party-number',
        label: 'Phone',
        text: 'Phone',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-number' },
      },
      email: {
        key: 'responsible-party-email',
        label: 'Email',
        text: 'Email',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-email' },
      },
      addressSameAsPatient: {
        key: 'responsible-party-address-as-patient',
        label: "Responsible party address is the same as patient's address",
        text: "Responsible party address is the same as patient's address",
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
        label: 'Street address',
        text: 'Street address',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-street-address' },
      },
      streetAddress2: {
        key: 'responsible-party-address-2',
        label: 'Address line 2',
        text: 'Address line 2',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-street-address-2' },
      },
      city: {
        key: 'responsible-party-city',
        label: 'City',
        text: 'City',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-city' },
      },
      state: {
        key: 'responsible-party-state',
        label: 'State',
        text: 'State',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-state' },
      },
      zip: {
        key: 'responsible-party-zip',
        label: 'ZIP',
        text: 'ZIP',
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
        disabledDisplay: 'protected',
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
  employerInformation: {
    linkId: 'employer-information-page',
    title: 'Employer information',
    items: {
      name: {
        key: 'employer-name',
        label: 'Employer Name',
        text: 'Employer Name',
        type: 'string',
      },
      address: {
        key: 'employer-address',
        label: 'Employer Address',
        text: 'Employer Address',
        type: 'string',
      },
      address2: {
        key: 'employer-address-2',
        label: 'Address line 2 (optional)',
        text: 'Address line 2 (optional)',
        type: 'string',
      },
      city: {
        key: 'employer-city',
        label: 'City',
        text: 'City',
        type: 'string',
        inputWidth: 's',
      },
      state: {
        key: 'employer-state',
        label: 'State',
        text: 'State',
        type: 'choice',
        options: formValueSets.stateOptions,
        inputWidth: 's',
      },
      zip: {
        key: 'employer-zip',
        label: 'ZIP',
        text: 'ZIP',
        type: 'string',
        dataType: 'ZIP',
        inputWidth: 's',
      },
      contactFirstName: {
        key: 'employer-contact-first-name',
        label: 'First name',
        text: 'First name',
        type: 'string',
      },
      contactLastName: {
        key: 'employer-contact-last-name',
        label: 'Last name',
        text: 'Last name',
        type: 'string',
      },
      contactTitle: {
        key: 'employer-contact-title',
        label: 'Title',
        text: 'Title',
        type: 'string',
      },
      contactEmail: {
        key: 'employer-contact-email',
        label: 'Email',
        text: 'Email',
        type: 'string',
        dataType: 'Email',
      },
      contactPhone: {
        key: 'employer-contact-phone',
        label: 'Phone',
        text: 'Phone',
        type: 'string',
        dataType: 'Phone Number',
      },
    },
    hiddenFields: [],
    requiredFields: ['employer-name', 'employer-address', 'employer-city', 'employer-state', 'employer-zip'],
  },
  emergencyContact: {
    linkId: 'emergency-contact-page',
    title: 'Emergency Contact',
    items: {
      relationship: {
        key: 'emergency-contact-relationship',
        label: 'Relationship to the patient',
        text: 'Relationship to the patient',
        type: 'choice',
        options: formValueSets.emergencyContactRelationshipOptions,
      },
      firstName: {
        key: 'emergency-contact-first-name',
        label: 'Emergency contact first name',
        text: 'Emergency contact first name',
        type: 'string',
      },
      middleName: {
        key: 'emergency-contact-middle-name',
        label: 'Emergency contact middle name',
        text: 'Emergency contact middle name',
        type: 'string',
      },
      lastName: {
        key: 'emergency-contact-last-name',
        label: 'Emergency contact last name',
        text: 'Emergency contact last name',
        type: 'string',
      },
      phoneNumber: {
        key: 'emergency-contact-number',
        label: 'Emergency contact phone',
        text: 'Emergency contact phone',
        type: 'string',
        dataType: 'Phone Number',
        autocomplete: 'section-patient shipping tel',
      },
      addressAsPatient: {
        key: 'emergency-contact-address-as-patient',
        label: "Same as patient's address",
        text: "Same as patient's address",
        type: 'boolean',
      },
      streetAddress: {
        key: 'emergency-contact-address',
        label: 'Address',
        text: 'Address',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-street-address' },
      },
      streetAddress2: {
        key: 'emergency-contact-address-2',
        label: 'Address line 2 (optional)',
        text: 'Address line 2 (optional)',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-street-address-2' },
      },
      city: {
        key: 'emergency-contact-city',
        label: 'City',
        text: 'City',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-city' },
      },
      state: {
        key: 'emergency-contact-state',
        label: 'State',
        text: 'State',
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
        disabledDisplay: 'protected',
        dynamicPopulation: { sourceLinkId: 'patient-state' },
      },
      zip: {
        key: 'emergency-contact-zip',
        label: 'ZIP',
        text: 'ZIP',
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
        disabledDisplay: 'protected',
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
      'emergency-contact-zip',
    ],
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
  consentForms: {
    linkId: 'consent-forms-page',
    title: 'Complete consent forms',
    reviewText: 'Consent forms',
    enableWhen: [
      {
        question: '$status',
        operator: '!=',
        answerString: 'completed',
      },
      {
        question: '$status',
        operator: '!=',
        answerString: 'amended',
      },
    ],
    enableBehavior: 'all',
    items: {
      hipaaAcknowledgement: {
        key: 'hipaa-acknowledgement',
        label: 'I have reviewed and accept [HIPAA Acknowledgement](/hipaa_notice_template.pdf)',
        text: 'I have reviewed and accept [HIPAA Acknowledgement](/hipaa_notice_template.pdf)',
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
        disabledDisplay: 'protected',
      },
      consentToTreat: {
        key: 'consent-to-treat',
        label:
          'I have reviewed and accept [Consent to Treat, Guarantee of Payment & Card on File Agreement](/consent_to_treat_template.pdf)',
        text: 'I have reviewed and accept [Consent to Treat, Guarantee of Payment & Card on File Agreement](/consent_to_treat_template.pdf)',
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
        disabledDisplay: 'protected',
      },
      signature: {
        key: 'signature',
        label: 'Signature',
        text: 'Signature',
        type: 'string',
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
        disabledDisplay: 'protected',
      },
    },
    hiddenFields: [],
    requiredFields: ['hipaa-acknowledgement', 'consent-to-treat', 'signature'],
  },
  medicalHistory: {
    linkId: 'medical-history-page',
    title: 'Medical history',
    items: {
      questionnaire: {
        key: 'medical-history-questionnaire',
        label: '',
        type: 'boolean',
        dataType: 'Medical History',
      },
    },
    hiddenFields: [],
    requiredFields: [],
  },
};

const FormFieldsSchema = z.object({
  contactInformation: FormSectionSimpleSchema,
  patientDetails: FormSectionSimpleSchema,
  primaryCarePhysician: FormSectionSimpleSchema,
  pharmacy: FormSectionSimpleSchema,
  paymentOptionDefault: FormSectionSimpleSchema,
  paymentOptionOccupational: FormSectionSimpleSchema,
  paymentOptionWorkmans: FormSectionSimpleSchema,
  cardPayment: FormSectionSimpleSchema,
  responsibleParty: FormSectionSimpleSchema,
  employerInformation: FormSectionSimpleSchema,
  emergencyContact: FormSectionSimpleSchema,
  photoId: FormSectionSimpleSchema,
  consentForms: FormSectionSimpleSchema,
  medicalHistory: FormSectionSimpleSchema,
});

const hiddenFormSections: string[] = [];

const questionnaireBaseDefaults: QuestionnaireBase = {
  resourceType: 'Questionnaire',
  url: 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson',
  version: '1.1.3',
  name: 'in-person_pre-visit_paperwork',
  title: 'in-person pre-visit paperwork',
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

export const INTAKE_PAPERWORK_CONFIG = IntakePaperworkConfigSchema.parse(mergedIntakePaperworkConfig);
export const INTAKE_PAPERWORK_QUESTIONNAIRE = (): Questionnaire =>
  JSON.parse(JSON.stringify(createQuestionnaireFromConfig(INTAKE_PAPERWORK_CONFIG)));
