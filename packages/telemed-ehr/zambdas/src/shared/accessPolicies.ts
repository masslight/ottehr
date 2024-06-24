export const ADMINISTRATOR_RULES = [
  {
    action: ['FHIR:Search', 'FHIR:Read'],
    effect: 'Allow',
    resource: [
      'FHIR:Consent',
      'FHIR:Coverage',
      'FHIR:RelatedPerson',
      'FHIR:Organization',
      'FHIR:QuestionnaireResponse',
      'FHIR:DocumentReference',
      'FHIR:Person',
    ],
  },
  {
    action: ['App:ListAllUsers', 'App:GetUser'],
    effect: 'Allow',
    resource: 'App:User',
  },
  {
    action: ['IAM:ListAllRoles', 'IAM:GetRole'],
    effect: 'Allow',
    resource: 'IAM:Role',
  },
  {
    action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update'],
    effect: 'Allow',
    resource: [
      'FHIR:Patient',
      'FHIR:Appointment',
      'FHIR:Encounter',
      'FHIR:Location',
      // Needed for ottehr user to get their own fhir profile. this is overbroad and should be restricted when/if zap adds some sort of SELF token
      'FHIR:Practitioner',
      'FHIR:HealthcareService',
      'FHIR:Communication',
      'FHIR:Flag',
    ],
  },
  {
    action: 'Z3:GetObject',
    effect: 'Allow',
    resource: 'Z3:*',
  },
  {
    action: ['Zambda:InvokeFunction'],
    effect: 'Allow',
    resource: ['Zambda:Function:*'],
  },
  // Needed for ottehr chat message sending
  {
    action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update', 'FHIR:Create'],
    effect: 'Allow',
    resource: ['FHIR:Communication', 'FHIR:PractitionerRole'],
  },
  {
    action: ['FHIR:Create'],
    effect: 'Allow',
    resource: ['FHIR:Location', 'FHIR:Practitioner', 'FHIR:HealthcareService'],
  },
  {
    action: ['Messaging:SendTransactionalSMS'],
    effect: 'Allow',
    resource: ['*'],
  },
  {
    action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update', 'FHIR:Create'],
    resource: 'FHIR:InsurancePlan:*',
    effect: 'Allow',
  },
];

export const MANAGER_RULES = [
  {
    resource: [
      'FHIR:Consent',
      'FHIR:Coverage',
      'FHIR:RelatedPerson',
      'FHIR:Organization',
      'FHIR:QuestionnaireResponse',
      'FHIR:DocumentReference',
      'FHIR:Person',
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
    action: ['Telemed:CreateRoom', 'Telemed:GetRoomToken'],
    effect: 'Allow',
    resource: 'Telemed:Room',
  },
  {
    resource: 'Z3:*',
    action: 'Z3:GetObject',
    effect: 'Allow',
  },
];

export const INACTIVE_RULES = [
  {
    resource: '*',
    action: '*',
    effect: 'Deny',
  },
];

export const STAFF_RULES = [
  {
    resource: [
      'FHIR:Appointment',
      'FHIR:Patient',
      'FHIR:Consent',
      'FHIR:Coverage',
      'FHIR:RelatedPerson',
      'FHIR:Organization',
      'FHIR:Location',
      'FHIR:Encounter',
      'FHIR:QuestionnaireResponse',
      'FHIR:DocumentReference',
      'FHIR:Person',
    ],
    action: ['FHIR:Search', 'FHIR:Read'],
    effect: 'Allow',
  },
  {
    resource: ['FHIR:Appointment', 'FHIR:Encounter', 'FHIR:Patient'],
    action: ['FHIR:Update'],
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
      'FHIR:Appointment',
      'FHIR:Patient',
      'FHIR:Consent',
      'FHIR:Coverage',
      'FHIR:RelatedPerson',
      'FHIR:Organization',
      'FHIR:Location',
      'FHIR:Encounter',
      'FHIR:QuestionnaireResponse',
      'FHIR:DocumentReference',
      'FHIR:Person',
    ],
    action: ['FHIR:Search', 'FHIR:Read'],
    effect: 'Allow',
  },
  {
    resource: ['FHIR:Appointment', 'FHIR:Encounter', 'FHIR:Patient'],
    action: ['FHIR:Update'],
    effect: 'Allow',
  },
  {
    action: ['Telemed:CreateRoom', 'Telemed:GetRoomToken'],
    effect: 'Allow',
    resource: 'Telemed:Room',
  },
  {
    action: ['Telemed:CreateMeeting', 'Telemed:JoinMeeting'],
    effect: 'Allow',
    resource: 'Telemed:Meeting',
  },
  {
    resource: 'Z3:*',
    action: 'Z3:GetObject',
    effect: 'Allow',
  },
];
