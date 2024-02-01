export const MANAGER_RULES = [
  {
    resource: [
      'FHIR:Consent',
      'FHIR:Coverage',
      'FHIR:RelatedPerson',
      'FHIR:Organization',
      'FHIR:QuestionnaireResponse',
      'FHIR:DocumentReference',
    ],
    action: ['FHIR:Search', 'FHIR:Read'],
    effect: 'Allow',
  },
  {
    resource: ['FHIR:Patient', 'FHIR:Location', 'FHIR:Appointment', 'FHIR:Encounter'],
    action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update'],
    effect: 'Allow',
  },
  {
    resource: 'App:User',
    action: ['App:ListAllUsers', 'App:GetUser'],
    effect: 'Allow',
  },
  {
    resource: 'Z3:*',
    action: 'Z3:GetObject',
    effect: 'Allow',
  },
];

export const FRONT_DESK_RULES = [
  {
    resource: [
      'FHIR:Consent',
      'FHIR:Coverage',
      'FHIR:RelatedPerson',
      'FHIR:Organization',
      'FHIR:QuestionnaireResponse',
      'FHIR:DocumentReference',
    ],
    action: ['FHIR:Search', 'FHIR:Read'],
    effect: 'Allow',
  },
  {
    resource: 'App:User',
    action: ['App:ListAllUsers', 'App:GetUser'],
    effect: 'Allow',
  },
  {
    resource: ['FHIR:Patient', 'FHIR:Appointment', 'FHIR:Encounter', 'FHIR:Location'],
    action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update'],
    effect: 'Allow',
  },
  {
    resource: 'Z3:*',
    action: 'Z3:GetObject',
    effect: 'Allow',
  },
];

export const STAFF_RULES = [
  {
    resource: [
      'FHIR:Patient',
      'FHIR:Consent',
      'FHIR:Coverage',
      'FHIR:RelatedPerson',
      'FHIR:Organization',
      'FHIR:Location',
      'FHIR:Encounter',
      'FHIR:QuestionnaireResponse',
      'FHIR:DocumentReference',
    ],
    action: ['FHIR:Search', 'FHIR:Read'],
    effect: 'Allow',
  },
  {
    resource: 'Z3:*',
    action: 'Z3:GetObject',
    effect: 'Allow',
  },
];

export const PROVIDER_RULES = [
  {
    resource: [
      'FHIR:Patient',
      'FHIR:Consent',
      'FHIR:Coverage',
      'FHIR:RelatedPerson',
      'FHIR:Organization',
      'FHIR:Location',
      'FHIR:Encounter',
      'FHIR:QuestionnaireResponse',
      'FHIR:DocumentReference',
    ],
    action: ['FHIR:Search', 'FHIR:Read'],
    effect: 'Allow',
  },
  {
    resource: 'Z3:*',
    action: 'Z3:GetObject',
    effect: 'Allow',
  },
];
