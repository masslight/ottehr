import { Location, Questionnaire } from "fhir/r4";

export const defaultQuestionnaire: Questionnaire = {
  resourceType: 'Questionnaire',
  name: 'telemed',
  status: 'draft',
  "item": [
    {
      "linkId": "contact-information-page",
      "text": "Contact information",
      "type": "group",
      "item": [
        {
          "linkId": "contact-page-address-text",
          "text": "{patientFirstName}'s primary address",
          "type": "display",
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
              "valueString": "h3"
            }
          ]
        },
        {
          "linkId": "patient-street-address",
          "text": "Street address",
          "type": "string",
          "required": true
        },
        {
          "linkId": "patient-street-address-2",
          "text": "Address line 2 (optional)",
          "type": "string",
          "required": false
        },
        {
          "linkId": "patient-city",
          "text": "City",
          "type": "string",
          "required": true,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-width",
              "valuePositiveInt": 4
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
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-width",
              "valuePositiveInt": 4
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
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-format",
              "valueString": "ZIP"
            },
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-width",
              "valuePositiveInt": 4
            }
          ]
        },
        {
          "linkId": "patient-contact-additional-text",
          "text": "Additional information",
          "type": "display",
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
              "valueString": "h3"
            }
          ]
        },
        {
          "linkId": "patient-contact-additional-caption",
          "text": "Please provide the information for the best point of contact regarding this reservation.",
          "type": "display",
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
              "valueString": "p"
            }
          ]
        },
        {
          "linkId": "patient-filling-out-as",
          "text": "I am filling out this info as:",
          "type": "choice",
          "answerOption": [
            {
              "valueString": "Parent/Guardian"
            },
            {
              "valueString": "Patient (Self)"
            }
          ],
          "required": true,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
              "valueString": "Radio List"
            }
          ]
        },
        {
          "linkId": "patient-email",
          "text": "Patient email",
          "type": "string",
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-format",
              "valueString": "Email"
            },
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                  "valueString": "patient-filling-out-as"
                },
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                  "valueString": "="
                },
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                  "valueString": "Patient (Self)"
                }
              ]
            }
          ]
        },
        {
          "linkId": "patient-number",
          "text": "Patient mobile",
          "type": "string",
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-format",
              "valueString": "Phone Number"
            },
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                  "valueString": "patient-filling-out-as"
                },
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                  "valueString": "="
                },
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                  "valueString": "Patient (Self)"
                }
              ]
            }
          ]
        },
        {
          "linkId": "guardian-email",
          "text": "Parent/Guardian email",
          "type": "string",
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-format",
              "valueString": "Email"
            },
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                  "valueString": "patient-filling-out-as"
                },
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                  "valueString": "="
                },
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                  "valueString": "Parent/Guardian"
                }
              ]
            }
          ]
        },
        {
          "linkId": "guardian-number",
          "text": "Parent/Guardian mobile",
          "type": "string",
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-format",
              "valueString": "Phone Number"
            },
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question",
                  "valueString": "patient-filling-out-as"
                },
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator",
                  "valueString": "="
                },
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer",
                  "valueString": "Parent/Guardian"
                }
              ]
            }
          ]
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
          "text": "Patient's ethnicity",
          "type": "choice",
          "required": false,
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
          "text": "Patient's race",
          "type": "choice",
          "required": false,
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
          "linkId": "patient-birth-sex",
          "text": "Patient's birth sex",
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
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/information-text-secondary",
              "valueString": "Our care team uses this to inform treatment recommendations and share helpful information regarding potential medication side effects, as necessary."
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
              "valueString": "He/him/his"
            },
            {
              "valueString": "She/her/her"
            },
            {
              "valueString": "They/them/their"
            },
            {
              "valueString": "My pronounces are not listed"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/information-text-secondary",
              "valueString": "Pronoun responses are kept confidential in our system and are used to help us best respect how our patients (up to age 26) wish to be addressed."
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
              "answerString": "My pronounces are not listed"
            }
          ]
        },
        {
          "linkId": "patient-details-additional-text",
          "text": "Additional information",
          "type": "display",
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
              "valueString": "h3"
            }
          ]
        },
        {
          "linkId": "patient-point-of-discovery",
          "text": "How did you hear about us?",
          "type": "choice",
          "required": true,
          "answerOption": [
            {
              "valueString": "Friend/Family"
            },
            {
              "valueString": "Been there with another child or family member"
            },
            {
              "valueString": "Pediatrician/Healthcare Professional"
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
              "valueString": "exampleone"
            },
            {
              "valueString": "exampletwo"
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
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
              "valueString": "Radio List"
            }
          ]
        }
      ]
    },
    {
      "linkId": "primary-care-physician-page",
      "text": "Primary Care Physician",
      "type": "group",
      "item": [
        {
          "linkId": "pcp-first",
          "text": "First name",
          "type": "string",
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-width",
              "valuePositiveInt": 6
            }
          ]
        },
        {
          "linkId": "pcp-last",
          "text": "Last name",
          "type": "string",
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-width",
              "valuePositiveInt": 6
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
          "linkId": "pcp-number",
          "text": "Phone number",
          "type": "string",
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-format",
              "valueString": "Phone Number"
            }
          ]
        },
        {
          "linkId": "fax-number",
          "text": "Fax number",
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
            }
          ]
        }
      ]
    },
    {
      "linkId": "current-medications-page",
      "text": "Current medications",
      "type": "group",
      "item": [
        {
          "linkId": "current-medications-yes-no",
          "type": "choice",
          "text": "Select option",
          "required": true,
          "answerOption": [
            {
              "valueString": "Patient does not take any medications currently"
            },
            {
              "valueString": "Patient takes medication currently"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
              "valueString": "Radio"
            }
          ]
        },
        {
          "linkId": "current-medications",
          "type": "group",
          "text": "Medications taken",
          "required": true,
          "item": [
            {
              "linkId": "current-medications-form-header",
              "type": "display",
              "text": "Add medication",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
                  "valueString": "h4"
                }
              ]
            },
            {
              "linkId": "current-medications-form-medication",
              "type": "choice",
              "text": "Medication",
              "required": true,
              "answerOption": [
                {
                  "valueString": "Acetaminophen/ Tylenol"
                },
                {
                  "valueString": "Albuterol"
                },
                {
                  "valueString": "Amoxicillin"
                },
                {
                  "valueString": "Amoxicillin+Clav./ Augmentin"
                },
                {
                  "valueString": "Budesonide inhaler/ Pulmicort/ Symbicort"
                },
                {
                  "valueString": "Cefdinir/ Omnicef"
                },
                {
                  "valueString": "Cephalexin/ Keflex"
                },
                {
                  "valueString": "Cetirizine/ Zyrtec"
                },
                {
                  "valueString": "cloNIDine"
                },
                {
                  "valueString": "Cold, cough medication- over the counter"
                },
                {
                  "valueString": "Dextroamphetamine amphetamine/ Adderall/ Focalin"
                },
                {
                  "valueString": "Diphenhydramine/ Benadryl"
                },
                {
                  "valueString": "EpiPen"
                },
                {
                  "valueString": "Escitalopram/ Lexapro"
                },
                {
                  "valueString": "Famotidine/ Pepcid/ Zantac"
                },
                {
                  "valueString": "Fexofenadine/ Allegra"
                },
                {
                  "valueString": "Fluoxetine/ PROzac"
                },
                {
                  "valueString": "Fluticasone propionate inhaler/ Flovent"
                },
                {
                  "valueString": "Fluticasone propionate nasal spray/ Flonase"
                },
                {
                  "valueString": "guanFACINE HCl/ Intuniv"
                },
                {
                  "valueString": "Ibuprofen/ Motrin/ Advil"
                },
                {
                  "valueString": "Levocetirizine/ Xyzal"
                },
                {
                  "valueString": "Lisdexamfetamine/ Vyvanse"
                },
                {
                  "valueString": "Loratadine/ Claritin"
                },
                {
                  "valueString": "Melatonin"
                },
                {
                  "valueString": "Methylphenidate/ Concerta"
                },
                {
                  "valueString": "MiraLax"
                },
                {
                  "valueString": "Montelukast/ Singulair"
                },
                {
                  "valueString": "Sertraline/ Zoloft"
                },
                {
                  "valueString": "Vitamins"
                }
              ]
            },
            {
              "linkId": "current-medications-form-button",
              "type": "display",
              "text": "Add to the medications",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
                  "valueString": "button"
                }
              ]
            }
          ],
          "enableWhen": [
            {
              "question": "current-medications-yes-no",
              "operator": "=",
              "answerString": "Patient takes medication currently"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/group-type",
              "valueString": "list-with-form"
            }
          ]
        }
      ]
    },
    {
      "linkId": "allergies-page",
      "text": "Allergies",
      "type": "group",
      "item": [
        {
          "linkId": "allergies-yes-no",
          "type": "choice",
          "text": "Select option",
          "required": true,
          "answerOption": [
            {
              "valueString": "Patient has no allergies"
            },
            {
              "valueString": "Patient has allergies"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
              "valueString": "Radio"
            }
          ]
        },
        {
          "linkId": "allergies",
          "type": "group",
          "text": "Known allergies",
          "required": true,
          "item": [
            {
              "linkId": "allergies-form-header",
              "type": "display",
              "text": "Add allergy",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
                  "valueString": "h4"
                }
              ]
            },
            {
              "linkId": "allergies-form-type",
              "type": "choice",
              "text": "Select option",
              "required": true,
              "answerOption": [
                {
                  "valueString": "Medications"
                },
                {
                  "valueString": "Food"
                },
                {
                  "valueString": "Other"
                }
              ],
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
                  "valueString": "Radio List"
                }
              ]
            },
            {
              "linkId": "allergies-form-agent-substance-medications",
              "type": "choice",
              "text": "Agent/Substance",
              "required": true,
              "answerOption": [
                {
                  "valueString": "Acetaminophen (Tylenol)"
                },
                {
                  "valueString": "Amoxicillin/ Penicillin"
                },
                {
                  "valueString": "Amoxicillin-Clavulanic Acid (Augmentin)"
                },
                {
                  "valueString": "Aspirin"
                },
                {
                  "valueString": "Azithromycin"
                },
                {
                  "valueString": "Cefdinir (Omnicef)"
                },
                {
                  "valueString": "Cefprozil (Cefzil)"
                },
                {
                  "valueString": "Cephalexin (Keflex)"
                },
                {
                  "valueString": "Clindamycin"
                },
                {
                  "valueString": "Erythromycin "
                },
                {
                  "valueString": "Ibuprofen (Motrin/ Advil)"
                },
                {
                  "valueString": "Oseltamivir (Tamiflu)"
                },
                {
                  "valueString": "Other Cephalosporin"
                },
                {
                  "valueString": "Trimethoprim / Sulfamethoxazole (Bactrim)/ Sulfa Antibiotics"
                }
              ],
              "enableWhen": [
                {
                  "question": "allergies-form-type",
                  "operator": "=",
                  "answerString": "Medications"
                }
              ],
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/custom-link-id",
                  "valueString": "allergies-form-agent-substance"
                }
              ]
            },
            {
              "linkId": "allergies-form-agent-substance-food",
              "type": "choice",
              "text": "Agent/Substance",
              "required": true,
              "answerOption": [
                {
                  "valueString": "Apple"
                },
                {
                  "valueString": "Banana"
                },
                {
                  "valueString": "Eggs or Egg-derived Products"
                },
                {
                  "valueString": "Fish/ Fish Oil"
                },
                {
                  "valueString": "Food Color Red"
                },
                {
                  "valueString": "Kiwi"
                },
                {
                  "valueString": "Lactose"
                },
                {
                  "valueString": "Mango"
                },
                {
                  "valueString": "Milk/ Dairy"
                },
                {
                  "valueString": "Peanut"
                },
                {
                  "valueString": "Pineapple"
                },
                {
                  "valueString": "Sesame/ Sesame Seed/ Sesame Oil"
                },
                {
                  "valueString": "Shellfish/ Seafood/ Shrimp"
                },
                {
                  "valueString": "Soy/ Soybean"
                },
                {
                  "valueString": "Strawberries"
                },
                {
                  "valueString": "Tree Nuts (Caschew, Pistachio, etc.)"
                },
                {
                  "valueString": "Wheat/ Gluten"
                }
              ],
              "enableWhen": [
                {
                  "question": "allergies-form-type",
                  "operator": "=",
                  "answerString": "Food"
                }
              ],
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/custom-link-id",
                  "valueString": "allergies-form-agent-substance"
                }
              ]
            },
            {
              "linkId": "allergies-form-agent-substance-other",
              "type": "choice",
              "text": "Agent/Substance",
              "required": true,
              "answerOption": [
                {
                  "valueString": "Adhesive"
                },
                {
                  "valueString": "Bees/ bee sting"
                },
                {
                  "valueString": "Cockroach"
                },
                {
                  "valueString": "Dust Mites"
                },
                {
                  "valueString": "Latex"
                },
                {
                  "valueString": "Mold"
                },
                {
                  "valueString": "Mosquito (Diagnostic)"
                },
                {
                  "valueString": "Pet Dander (Cat, Dog, etc.) "
                },
                {
                  "valueString": "Pollen/ Seasonal/ Ragweed"
                }
              ],
              "enableWhen": [
                {
                  "question": "allergies-form-type",
                  "operator": "=",
                  "answerString": "Other"
                }
              ],
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/custom-link-id",
                  "valueString": "allergies-form-agent-substance"
                }
              ]
            },
            {
              "linkId": "allergies-form-button",
              "type": "display",
              "text": "Add to the known allergies",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
                  "valueString": "button"
                }
              ]
            }
          ],
          "enableWhen": [
            {
              "question": "allergies-yes-no",
              "operator": "=",
              "answerString": "Patient has allergies"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/group-type",
              "valueString": "list-with-form"
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
          "linkId": "medical-history-yes-no",
          "type": "choice",
          "text": "Select option",
          "required": true,
          "answerOption": [
            {
              "valueString": "Patient has no medical conditions"
            },
            {
              "valueString": "Patient has medical conditions"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
              "valueString": "Radio"
            }
          ]
        },
        {
          "linkId": "medical-history",
          "type": "group",
          "text": "Medical conditions",
          "required": true,
          "item": [
            {
              "linkId": "medical-history-form-header",
              "type": "display",
              "text": "Add medical conditions",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
                  "valueString": "h4"
                }
              ]
            },
            {
              "linkId": "medical-history-form-medical-condition",
              "type": "choice",
              "text": "Medical condition",
              "required": true,
              "answerOption": [
                {
                  "valueString": "ADHD/ ADD"
                },
                {
                  "valueString": "Anemia"
                },
                {
                  "valueString": "Anxiety"
                },
                {
                  "valueString": "Asthma/ Reactive Airway/ Wheezing"
                },
                {
                  "valueString": "Autism spectrum"
                },
                {
                  "valueString": "Celiac disease"
                },
                {
                  "valueString": "Constipation"
                },
                {
                  "valueString": "Croup"
                },
                {
                  "valueString": "Depression"
                },
                {
                  "valueString": "Eczema"
                },
                {
                  "valueString": "Epilepsy"
                },
                {
                  "valueString": "Febrile Seizure"
                },
                {
                  "valueString": "G6PD deficiency"
                },
                {
                  "valueString": "Gastroesophageal Reflux Disease- GERD"
                },
                {
                  "valueString": "Heart murmur"
                },
                {
                  "valueString": "Hip dysplasia- congenital"
                },
                {
                  "valueString": "Hydronephrosis"
                },
                {
                  "valueString": "Hypothyroidism"
                },
                {
                  "valueString": "Jaundice"
                },
                {
                  "valueString": "Laryngomalacia"
                },
                {
                  "valueString": "Migraines"
                },
                {
                  "valueString": "Otitis media/ Chronic ear infections"
                },
                {
                  "valueString": "Pneumonia"
                },
                {
                  "valueString": "Premature birth- preemie"
                },
                {
                  "valueString": "RSV- Respiratory Syncytial Virus"
                },
                {
                  "valueString": "Seasonal allergies"
                },
                {
                  "valueString": "Sickle cell trait"
                },
                {
                  "valueString": "Sleep apnea"
                },
                {
                  "valueString": "Speech delay"
                },
                {
                  "valueString": "Type 1 Diabetes"
                }
              ]
            },
            {
              "linkId": "medical-history-form-button",
              "type": "display",
              "text": "Add to medical conditions",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
                  "valueString": "button"
                }
              ]
            }
          ],
          "enableWhen": [
            {
              "question": "medical-history-yes-no",
              "operator": "=",
              "answerString": "Patient has medical conditions"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/group-type",
              "valueString": "list-with-form"
            }
          ]
        }
      ]
    },
    {
      "linkId": "surgical-history-page",
      "text": "Surgical history",
      "type": "group",
      "item": [
        {
          "linkId": "surgical-history-yes-no",
          "type": "choice",
          "text": "Select option",
          "required": true,
          "answerOption": [
            {
              "valueString": "Patient doesn't have surgical history"
            },
            {
              "valueString": "Patient has surgical history"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
              "valueString": "Radio"
            }
          ]
        },
        {
          "linkId": "surgical-history",
          "type": "group",
          "text": "Surgeries",
          "required": true,
          "item": [
            {
              "linkId": "surgical-history-form-header",
              "type": "display",
              "text": "Add surgery",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
                  "valueString": "h4"
                }
              ]
            },
            {
              "linkId": "surgical-history-form-type",
              "type": "choice",
              "text": "Type of surgery",
              "required": true,
              "answerOption": [
                {
                  "valueString": "Adenoidectomy (Adenoid Removal)"
                },
                {
                  "valueString": "Appendectomy"
                },
                {
                  "valueString": "C-section (Cesarean delivery)"
                },
                {
                  "valueString": "Circumcision"
                },
                {
                  "valueString": "Cleft lip/palate repair"
                },
                {
                  "valueString": "Cyst removed"
                },
                {
                  "valueString": "Dental/ Oral Surgery"
                },
                {
                  "valueString": "Ear tube placement (Myringotomy)"
                },
                {
                  "valueString": "Elbow/ Hand/ Arm Surgery"
                },
                {
                  "valueString": "Feeding tube (G-tube)"
                },
                {
                  "valueString": "Foot/ Ankle Surgery"
                },
                {
                  "valueString": "Frenotomy (Tongue Tie Repair)"
                },
                {
                  "valueString": "Gallbladder removal"
                },
                {
                  "valueString": "Heart/ Cardiac surgery"
                },
                {
                  "valueString": "Hemangioma "
                },
                {
                  "valueString": "Hernia "
                },
                {
                  "valueString": "Hydrocele Repair"
                },
                {
                  "valueString": "Hypospadias repair"
                },
                {
                  "valueString": "Kidney surgery"
                },
                {
                  "valueString": "Knee Surgery"
                },
                {
                  "valueString": "Orchiectomy (Testicle Removal)"
                },
                {
                  "valueString": "Other Eye surgery"
                },
                {
                  "valueString": "Pyloromyotomy (Pyloric Stenosis Repair)"
                },
                {
                  "valueString": "Sinus surgery"
                },
                {
                  "valueString": "Splenectomy"
                },
                {
                  "valueString": "Tear Duct Eye surgery"
                },
                {
                  "valueString": "Tonsillectomy and adenoidectomy (Tonsil and Adenoid Removal)"
                },
                {
                  "valueString": "Undescended Testicle Repair"
                },
                {
                  "valueString": "Ventriculoperitoneal shunt placement"
                },
                {
                  "valueString": "Wisdom teeth removal"
                },
                {
                  "valueString": "Other"
                }
              ]
            },
            {
              "linkId": "surgical-history-form-date",
              "type": "date",
              "text": "Year",
              "required": true,
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/date-type",
                  "valueString": "year"
                }
              ]
            },
            {
              "linkId": "surgical-history-form-button",
              "type": "display",
              "text": "Add to the surgeries",
              "extension": [
                {
                  "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
                  "valueString": "button"
                }
              ]
            }
          ],
          "enableWhen": [
            {
              "question": "surgical-history-yes-no",
              "operator": "=",
              "answerString": "Patient has surgical history"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/group-type",
              "valueString": "list-with-form"
            }
          ]
        }
      ]
    },
    {
      "linkId": "additional-page",
      "text": "Additional questions",
      "type": "group",
      "item": [
        {
          "linkId": "flu-vaccine",
          "text": "Has the patient had the flu vaccine?",
          "type": "choice",
          "answerOption": [
            {
              "valueString": "Yes"
            },
            {
              "valueString": "No"
            }
          ],
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
              "valueString": "Radio List"
            }
          ]
        },
        {
          "linkId": "vaccines-up-to-date",
          "text": "Are the patient's vaccines up to date?",
          "type": "choice",
          "answerOption": [
            {
              "valueString": "Yes"
            },
            {
              "valueString": "No"
            }
          ],
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
              "valueString": "Radio List"
            }
          ]
        },
        {
          "linkId": "travel-usa",
          "text": "Has the patient traveled out of the USA in the last 2 weeks?",
          "type": "choice",
          "answerOption": [
            {
              "valueString": "Yes"
            },
            {
              "valueString": "No"
            }
          ],
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
              "valueString": "Radio List"
            }
          ]
        },
        {
          "linkId": "hospitalize",
          "text": "Has the patient been hospitalized in the past 6 months?",
          "type": "choice",
          "answerOption": [
            {
              "valueString": "Yes"
            },
            {
              "valueString": "No"
            }
          ],
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
              "valueString": "Radio List"
            }
          ]
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
              "valueString": "I have insurance"
            },
            {
              "valueString": "I will pay without insurance"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/select-type",
              "valueString": "Radio"
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
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
              "valueString": "h3"
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
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
              "valueString": "p"
            }
          ]
        },
        {
          "linkId": "insurance-carrier",
          "text": "Insurance Carrier",
          "type": "string",
          "required": true,
          "enableWhen": [
            {
              "question": "payment-option",
              "operator": "=",
              "answerString": "I have insurance"
            }
          ]
        },
        {
          "linkId": "insurance-member-id",
          "text": "Member ID",
          "type": "string",
          "required": true,
          "enableWhen": [
            {
              "question": "payment-option",
              "operator": "=",
              "answerString": "I have insurance"
            }
          ]
        },
        {
          "linkId": "cardholder-details-text",
          "text": "Cardholder details",
          "type": "display",
          "enableWhen": [
            {
              "question": "payment-option",
              "operator": "=",
              "answerString": "I have insurance"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
              "valueString": "h3"
            }
          ]
        },
        {
          "linkId": "policy-holder-first-name",
          "text": "Policy holder's first name",
          "type": "string",
          "required": true,
          "enableWhen": [
            {
              "question": "payment-option",
              "operator": "=",
              "answerString": "I have insurance"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-width",
              "valuePositiveInt": 6
            }
          ]
        },
        {
          "linkId": "policy-holder-last-name",
          "text": "Policy holder's last name",
          "type": "string",
          "required": true,
          "enableWhen": [
            {
              "question": "payment-option",
              "operator": "=",
              "answerString": "I have insurance"
            }
          ],
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-width",
              "valuePositiveInt": 6
            }
          ]
        },
        {
          "linkId": "policy-holder-date-of-birth",
          "text": "Policy holder's date of birth",
          "type": "date",
          "required": true,
          "enableWhen": [
            {
              "question": "payment-option",
              "operator": "=",
              "answerString": "I have insurance"
            }
          ]
        },
        {
          "linkId": "policy-holder-birth-sex",
          "text": "Policy holder's birth sex",
          "type": "choice",
          "required": true,
          "enableWhen": [
            {
              "question": "payment-option",
              "operator": "=",
              "answerString": "I have insurance"
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
          "linkId": "patient-relationship-to-insured",
          "text": "Patient's relationship to insured",
          "type": "choice",
          "required": true,
          "enableWhen": [
            {
              "question": "payment-option",
              "operator": "=",
              "answerString": "I have insurance"
            }
          ],
          "answerOption": [
            {
              "valueString": "Child"
            },
            {
              "valueString": "Parent"
            },
            {
              "valueString": "Mother"
            },
            {
              "valueString": "Father"
            },
            {
              "valueString": "Sibling"
            },
            {
              "valueString": "Spouse"
            },
            {
              "valueString": "Other"
            }
          ]
        },
        {
          "linkId": "insurance-additional-information",
          "text": "Additional insurance information (optional)",
          "type": "text",
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
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-multiline-minimum-rows",
              "valuePositiveInt": 3
            },
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/information-text",
              "valueString": "Secondary insurance or additional insurance details"
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
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/document-type",
              "valueString": "64290-0"
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
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/document-type",
              "valueString": "64290-0"
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
          "text": "A responsible party is the individual responsible for the visit's financial obligations. If the patient is not their own responsible party (most common), then the responsible party must be the patient's legal guardian or legal designee.",
          "type": "display",
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
              "valueString": "p"
            }
          ]
        },
        {
          "linkId": "responsible-party-relationship",
          "text": "Relationship",
          "type": "choice",
          "required": true,
          "answerOption": [
            {
              "valueString": "Self"
            },
            {
              "valueString": "Legal Guardian"
            },
            {
              "valueString": "Father"
            },
            {
              "valueString": "Mother"
            },
            {
              "valueString": "Spouse"
            }
          ]
        },
        {
          "linkId": "responsible-party-first-name",
          "text": "First name",
          "type": "string",
          "required": true,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-width",
              "valuePositiveInt": 6
            }
          ]
        },
        {
          "linkId": "responsible-party-last-name",
          "text": "Last name",
          "type": "string",
          "required": true,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-width",
              "valuePositiveInt": 6
            }
          ]
        },
        {
          "linkId": "responsible-party-date-of-birth",
          "text": "Date of birth",
          "type": "date",
          "required": true
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
          ]
        },
        {
          "linkId": "responsible-party-number",
          "text": "Phone (optional)",
          "type": "string",
          "required": false,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-format",
              "valueString": "Phone Number"
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
          "text": "Please upload a picture of a Photo ID, Drivers License or Passport of the patient's legal guardian (ie: Patient or Parent/Guardian)",
          "type": "display",
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/text-type",
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
              "valueString": "Take a picture of the **front side** of your Photo ID and upload it here"
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
              "valueString": "Take a picture of the **back side** of your Photo ID and upload it here"
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
      "item": [
        {
          "linkId": "hipaa-acknowledgement",
          "text": "I have reviewed and accept [HIPAA Acknowledgement](/HIPAA.Acknowledgement-S.pdf)",
          "type": "boolean",
          "required": true
        },
        {
          "linkId": "consent-to-treat",
          "text": "I have reviewed and accept [Consent to Treat and Guarantee of Payment](/CTT.and.Guarantee.of.Payment-S.pdf)",
          "type": "boolean",
          "required": true
        },
        {
          "linkId": "signature",
          "text": "Signature",
          "type": "string",
          "required": true,
          "extension": [
            {
              "url": "https://fhir.zapehr.com/r4/StructureDefinitions/input-format",
              "valueString": "Signature"
            }
          ]
        },
        {
          "linkId": "full-name",
          "text": "Full name",
          "type": "string",
          "required": true
        },
        {
          "linkId": "consent-form-signer-relationship",
          "text": "Relationship to the patient",
          "type": "choice",
          "required": true,
          "answerOption": [
            {
              "valueString": "Parent"
            },
            {
              "valueString": "Self"
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
    }
  ],
};

export const defaultLocation: Location = {
  resourceType: 'Location',
  status: 'active',
  name: 'Testing',
  description: 'Test description',
  identifier: [
    {
      system: 'https://fhir.zapehr.com/r4/StructureDefinitions/location',
      value: 'testing',
    },
  ],
  address: {
    use: 'work',
    type: 'physical',
    line: ['12345 Test St'],
    city: 'Test City',
    state: 'Test State',
    postalCode: '12345',
  },
  telecom: [
    {
      system: 'phone',
      use: 'work',
      value: '1234567890',
    },
    {
      system: 'url',
      use: 'work',
      value: 'https://example.com',
    },
  ],
  extension: [
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
      valueString:
        '{"schedule":{"monday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":10},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]},"tuesday":{"open":8,"close":21,"openingBuffer":0,"closingBuffer":30,"workingDay":true,"hours":[{"hour":8,"capacity":10},{"hour":9,"capacity":5},{"hour":10,"capacity":7},{"hour":11,"capacity":4},{"hour":12,"capacity":8},{"hour":13,"capacity":11},{"hour":14,"capacity":1},{"hour":15,"capacity":2},{"hour":16,"capacity":1},{"hour":17,"capacity":1},{"hour":18,"capacity":2},{"hour":19,"capacity":2},{"hour":20,"capacity":6}]},"wednesday":{"open":8,"close":0,"openingBuffer":30,"closingBuffer":30,"workingDay":true,"hours":[{"hour":8,"capacity":20},{"hour":9,"capacity":20},{"hour":10,"capacity":20},{"hour":11,"capacity":20},{"hour":12,"capacity":20},{"hour":13,"capacity":20},{"hour":14,"capacity":20},{"hour":15,"capacity":20},{"hour":16,"capacity":20},{"hour":17,"capacity":20},{"hour":18,"capacity":20},{"hour":19,"capacity":20},{"hour":20,"capacity":20},{"hour":21,"capacity":20},{"hour":22,"capacity":20},{"hour":23,"capacity":20}]},"thursday":{"open":18,"close":24,"openingBuffer":30,"closingBuffer":0,"workingDay":true,"hours":[{"hour":0,"capacity":0},{"hour":1,"capacity":0},{"hour":2,"capacity":0},{"hour":3,"capacity":0},{"hour":4,"capacity":0},{"hour":5,"capacity":0},{"hour":6,"capacity":0},{"hour":7,"capacity":0},{"hour":8,"capacity":0},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":12},{"hour":18,"capacity":10},{"hour":19,"capacity":10},{"hour":20,"capacity":10},{"hour":21,"capacity":0},{"hour":22,"capacity":10},{"hour":23,"capacity":10}]},"friday":{"open":14,"close":21,"openingBuffer":30,"closingBuffer":30,"workingDay":true,"hours":[{"hour":14,"capacity":5},{"hour":15,"capacity":6},{"hour":16,"capacity":6},{"hour":17,"capacity":5},{"hour":18,"capacity":5},{"hour":19,"capacity":5},{"hour":20,"capacity":5}]},"saturday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]},"sunday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]}},"scheduleOverrides":{"12/21/2023":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"12/9/2023":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"05/01/2024":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"1/19/2024":{"open":7,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]}}}',
    },
    {
      url: 'http://hl7.org/fhir/StructureDefinition/timezone',
      valueString: 'America/New_York',
    },
  ],
  hoursOfOperation: [
    {
      openingTime: '04:00:00',
      closingTime: '20:00:00',
      daysOfWeek: ['mon'],
    },
    {
      openingTime: '08:00:00',
      closingTime: '21:00:00',
      daysOfWeek: ['tue'],
    },
    {
      openingTime: '08:00:00',
      closingTime: '00:00:00',
      daysOfWeek: ['wed'],
    },
    {
      openingTime: '18:00:00',
      daysOfWeek: ['thu'],
    },
    {
      openingTime: '14:00:00',
      closingTime: '21:00:00',
      daysOfWeek: ['fri'],
    },
    {
      openingTime: '04:00:00',
      closingTime: '20:00:00',
      daysOfWeek: ['sat'],
    },
    {
      openingTime: '04:00:00',
      closingTime: '20:00:00',
      daysOfWeek: ['sun'],
    },
  ],
};
