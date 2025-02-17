import { QuestionnaireResponse } from 'fhir/r4b';

interface QuestionnaireResponseParams {
  // patient.id
  patientId: string;

  // encounter.id
  encounterId: string;

  questionnaireUrl?: string;
  status?: QuestionnaireResponse['status'];

  // patient.name[0].given[0]
  firstName: string;

  // patient.name[0].family
  lastName: string;

  /*
   {
   day: DateTime.fromISO(patient.birthDate).toFormat('dd'), // "01"
   month: DateTime.fromISO(patient.birthDate).toFormat('MM'), // "01"
   year: DateTime.fromISO(patient.birthDate).toFormat('yyyy'), // "2024"
   }
 */
  birthDate: {
    day: string;
    month: string;
    year: string;
  };

  consentJurisdiction?: string;
  willBe18?: boolean;
  isNewPatient?: boolean;
  fillingOutAs?: string;
  guardianEmail?: string;
  guardianNumber?: string;
  birthSex?: string;
  address?: {
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  mobileOptIn?: boolean;
  ethnicity?: string;
  race?: string;
  pronouns?: string;
  ovrpInterest?: string;
  paymentOption?: string;
  responsibleParty?: {
    relationship?: string;
    firstName?: string;
    lastName?: string;
    birthDate?: {
      day?: string;
      month?: string;
      year?: string;
    };
    birthSex?: string;
  };
}

export function createQuestionnaireResponse({
  // patient.id
  patientId,

  // encounter.id
  encounterId,

  //TODO: update this to the correct questionnaire url
  // grab it from the appropiate Q resource in the deployed resources folder in utils
  questionnaireUrl = '',
  status = 'in-progress',

  // patient.name[0].given[0]
  firstName,

  // patient.name[0].family
  lastName,

  /*
   {
   day: DateTime.fromISO(patient.birthDate).toFormat('dd'), // "01"
   month: DateTime.fromISO(patient.birthDate).toFormat('MM'), // "01"
   year: DateTime.fromISO(patient.birthDate).toFormat('yyyy'), // "2024"
   }
 */
  birthDate,

  consentJurisdiction = 'NY',
  willBe18 = false,
  isNewPatient = false,
  fillingOutAs = 'Parent/Guardian',
  guardianEmail = 'testemail@s0metestdomain123454321.com',
  guardianNumber = '(925) 622-4222',
  birthSex = 'Female',
  address = {
    street: 'dew',
    city: 'adws',
    state: 'FL',
    zip: '22222',
  },
  mobileOptIn = true,
  ethnicity = 'Decline to Specify',
  race = 'Native Hawaiian or Other Pacific Islander',
  pronouns = 'She/her',
  ovrpInterest = 'Need more info',
  paymentOption = 'I will pay without insurance',
  responsibleParty = {
    relationship: 'Legal Guardian',
    firstName: 'fwe',
    lastName: 'sf',
    birthDate: {
      day: '13',
      month: '05',
      year: '2009',
    },
    birthSex: 'Intersex',
  },
}: QuestionnaireResponseParams): QuestionnaireResponse {
  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: questionnaireUrl,
    status,
    subject: {
      reference: `Patient/${patientId}`,
    },
    encounter: {
      reference: `Encounter/${encounterId}`,
    },
    item: [
      {
        linkId: 'contact-information-page',
        item: [
          {
            linkId: 'patient-will-be-18',
            answer: [{ valueBoolean: willBe18 }],
          },
          {
            linkId: 'is-new-qrs-patient',
            answer: [{ valueBoolean: isNewPatient }],
          },
          {
            linkId: 'patient-first-name',
            answer: [{ valueString: firstName }],
          },
          {
            linkId: 'patient-last-name',
            answer: [{ valueString: lastName }],
          },
          {
            linkId: 'patient-birthdate',
            item: [
              {
                linkId: 'patient-dob-day',
                answer: [{ valueString: birthDate.day }],
              },
              {
                linkId: 'patient-dob-month',
                answer: [{ valueString: birthDate.month }],
              },
              {
                linkId: 'patient-dob-year',
                answer: [{ valueString: birthDate.year }],
              },
            ],
          },
          {
            linkId: 'patient-filling-out-as',
            answer: [{ valueString: fillingOutAs }],
          },
          {
            linkId: 'guardian-email',
            answer: [{ valueString: guardianEmail }],
          },
          {
            linkId: 'guardian-number',
            answer: [{ valueString: guardianNumber }],
          },
          {
            linkId: 'patient-birth-sex',
            answer: [{ valueString: birthSex }],
          },
          {
            linkId: 'patient-street-address',
            answer: [{ valueString: address.street }],
          },
          {
            linkId: 'patient-street-address-2',
            ...(address.street2 && {
              answer: [{ valueString: address.street2 }],
            }),
          },
          {
            linkId: 'patient-city',
            answer: [{ valueString: address.city }],
          },
          {
            linkId: 'patient-state',
            answer: [{ valueString: address.state }],
          },
          {
            linkId: 'patient-zip',
            answer: [{ valueString: address.zip }],
          },
          {
            linkId: 'mobile-opt-in',
            answer: [{ valueBoolean: mobileOptIn }],
          },
        ],
      },
      {
        linkId: 'patient-details-page',
        item: [
          {
            linkId: 'patient-ethnicity',
            answer: [{ valueString: ethnicity }],
          },
          {
            linkId: 'patient-race',
            answer: [{ valueString: race }],
          },
          {
            linkId: 'patient-pronouns',
            answer: [{ valueString: pronouns }],
          },
          {
            linkId: 'ovrp-interest',
            answer: [{ valueString: ovrpInterest }],
          },
        ],
      },
      {
        linkId: 'payment-option-page',
        item: [
          {
            linkId: 'payment-option',
            answer: [{ valueString: paymentOption }],
          },
        ],
      },
      {
        linkId: 'responsible-party-page',
        item: [
          {
            linkId: 'responsible-party-relationship',
            answer: [{ valueString: responsibleParty.relationship }],
          },
          {
            linkId: 'responsible-party-first-name',
            answer: [{ valueString: responsibleParty.firstName }],
          },
          {
            linkId: 'responsible-party-last-name',
            answer: [{ valueString: responsibleParty.lastName }],
          },
          {
            linkId: 'responsible-party-date-of-birth',
            item: [
              {
                linkId: 'responsible-party-dob-day',
                answer: [{ valueString: responsibleParty.birthDate?.day }],
              },
              {
                linkId: 'responsible-party-dob-month',
                answer: [{ valueString: responsibleParty.birthDate?.month }],
              },
              {
                linkId: 'responsible-party-dob-year',
                answer: [{ valueString: responsibleParty.birthDate?.year }],
              },
            ],
          },
          {
            linkId: 'responsible-party-birth-sex',
            answer: [{ valueString: responsibleParty.birthSex }],
          },
        ],
      },
      {
        linkId: 'consent-forms-page',
        item: [
          {
            linkId: 'consent-jurisdiction',
            answer: [{ valueString: consentJurisdiction }],
          },
        ],
      },
    ],
  };
}
