import { AccessPolicy } from 'utils';

export const ADMINISTRATOR_RULES: AccessPolicy = {
  rule: [
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
        'FHIR:Medication',
        'FHIR:List',
      ],
    },
    {
      action: ['App:ListAllUsers', 'App:GetUser'],
      effect: 'Allow',
      resource: ['App:User'],
    },
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update'],
      effect: 'Allow',
      resource: [
        'FHIR:Patient',
        'FHIR:Appointment',
        'FHIR:Encounter',
        'FHIR:Location',
        'FHIR:HealthcareService',
        'FHIR:Communication',
        'FHIR:Flag',
        'FHIR:QuestionnaireResponse',
      ],
    },
    {
      action: ['Z3:GetObject'],
      effect: 'Allow',
      resource: ['Z3:*'],
    },
    {
      action: ['Zambda:InvokeFunction'],
      effect: 'Allow',
      resource: ['Zambda:Function:*'],
    },
    // Needed to create new schedules
    {
      action: ['FHIR:Create'],
      effect: 'Allow',
      resource: ['FHIR:Location', 'FHIR:Practitioner', 'FHIR:HealthcareService'],
    },
    // Needed for Evolve user to get their own fhir profile. this is overbroad and should be restricted when/if zap adds some sort of SELF token
    {
      action: ['FHIR:Read', 'FHIR:Update', 'FHIR:Search'],
      effect: 'Allow',
      resource: ['FHIR:Practitioner'],
    },
    // Needed for Evolve chat message sending
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Create'],
      effect: 'Allow',
      resource: ['FHIR:Communication'],
    },
    {
      action: ['Messaging:SendTransactionalSMS'],
      effect: 'Allow',
      resource: ['*'],
    },
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update', 'FHIR:Create'],
      resource: ['FHIR:InsurancePlan:*', 'FHIR:PractitionerRole'],
      effect: 'Allow',
    },
    {
      action: ['FHIR:History'],
      effect: 'Allow',
      resource: ['FHIR:Patient', 'FHIR:Appointment'],
    },
  ],
};

export const MANAGER_RULES: AccessPolicy = {
  rule: [
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
        'FHIR:Medication',
        'FHIR:List',
      ],
    },
    {
      action: ['App:ListAllUsers', 'App:GetUser'],
      effect: 'Allow',
      resource: ['App:User'],
    },
    {
      action: ['Telemed:GetRoomToken'],
      effect: 'Allow',
      resource: ['Telemed:Room'],
    },
    {
      action: ['Telemed:JoinMeeting'],
      effect: 'Allow',
      resource: ['Telemed:Meeting:*'],
    },
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update'],
      effect: 'Allow',
      resource: [
        'FHIR:Patient',
        'FHIR:Appointment',
        'FHIR:Encounter',
        'FHIR:Location',
        'FHIR:HealthcareService',
        'FHIR:QuestionnaireResponse',
        'FHIR:Flag',
      ],
    },
    {
      action: ['Z3:GetObject'],
      effect: 'Allow',
      resource: ['Z3:*'],
    },
    {
      action: ['Zambda:InvokeFunction'],
      effect: 'Allow',
      resource: ['Zambda:Function:*'],
    },
    // Needed for Evolve user to get their own fhir profile. this is overbroad and should be restricted when/if zap adds some sort of SELF token
    {
      action: ['FHIR:Read', 'FHIR:Update'],
      effect: 'Allow',
      resource: ['FHIR:Practitioner'],
    },
    // Needed for Evolve chat message sending
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update', 'FHIR:Create'],
      effect: 'Allow',
      resource: ['FHIR:Communication'],
    },
    {
      action: ['Messaging:SendTransactionalSMS'],
      effect: 'Allow',
      resource: ['*'],
    },
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update', 'FHIR:Create'],
      resource: ['FHIR:InsurancePlan:*'],
      effect: 'Allow',
    },
    {
      action: ['FHIR:History'],
      effect: 'Allow',
      resource: ['FHIR:Patient', 'FHIR:Appointment'],
    },
    {
      action: ['FHIR:Search', 'FHIR:Read'],
      effect: 'Allow',
      resource: ['FHIR:List'],
    },
  ],
};

export const STAFF_RULES: AccessPolicy = {
  rule: [
    {
      resource: [
        'FHIR:Consent',
        'FHIR:Coverage',
        'FHIR:RelatedPerson',
        'FHIR:Organization',
        'FHIR:Location',
        'FHIR:HealthcareService',
        'FHIR:QuestionnaireResponse',
        'FHIR:DocumentReference',
        'FHIR:Person',
      ],
      action: ['FHIR:Search', 'FHIR:Read'],
      effect: 'Allow',
    },
    {
      resource: ['FHIR:Appointment', 'FHIR:Encounter', 'FHIR:Patient', 'FHIR:Flag'],
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update'],
      effect: 'Allow',
    },
    {
      resource: ['Z3:*'],
      action: ['Z3:GetObject'],
      effect: 'Allow',
    },
    {
      action: ['Zambda:InvokeFunction'],
      effect: 'Allow',
      resource: ['Zambda:Function:*'],
    },
    // Needed for Evolve user to get their own fhir profile. this is overbroad and should be restricted when/if zap adds some sort of SELF token
    {
      action: ['FHIR:Read', 'FHIR:Update'],
      effect: 'Allow',
      resource: ['FHIR:Practitioner'],
    },
    // Needed for Evolve chat message sending
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update', 'FHIR:Create'],
      effect: 'Allow',
      resource: ['FHIR:Communication'],
    },
    {
      action: ['Messaging:SendTransactionalSMS'],
      effect: 'Allow',
      resource: ['*'],
    },
    {
      action: ['FHIR:History'],
      effect: 'Allow',
      resource: ['FHIR:Patient', 'FHIR:Appointment'],
    },
  ],
};

export const PROVIDER_RULES: AccessPolicy = {
  rule: [
    {
      resource: [
        'FHIR:Consent',
        'FHIR:Coverage',
        'FHIR:RelatedPerson',
        'FHIR:Organization',
        'FHIR:Location',
        'FHIR:HealthcareService',
        'FHIR:PractitionerRole',
        'FHIR:QuestionnaireResponse',
        'FHIR:DocumentReference',
        'FHIR:Person',
        'FHIR:Task',
        'FHIR:List',
      ],
      action: ['FHIR:Search', 'FHIR:Read'],
      effect: 'Allow',
    },
    {
      resource: ['FHIR:Appointment', 'FHIR:Encounter', 'FHIR:Patient', 'FHIR:Flag', 'FHIR:QuestionnaireResponse'],
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update'],
      effect: 'Allow',
    },
    {
      action: ['Telemed:JoinMeeting'],
      effect: 'Allow',
      resource: ['Telemed:Meeting:*'],
    },
    {
      resource: ['Z3:*'],
      action: ['Z3:GetObject'],
      effect: 'Allow',
    },
    {
      action: ['Zambda:InvokeFunction'],
      effect: 'Allow',
      resource: ['Zambda:Function:*'],
    },
    // Needed for Evolve user to get their own fhir profile. this is overbroad and should be restricted when/if zap adds some sort of SELF token
    {
      action: ['FHIR:Read', 'FHIR:Update'],
      effect: 'Allow',
      resource: ['FHIR:Practitioner'],
    },
    // Needed for Evolve chat message sending
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update', 'FHIR:Create'],
      effect: 'Allow',
      resource: ['FHIR:Communication'],
    },
    {
      action: ['Messaging:SendTransactionalSMS'],
      effect: 'Allow',
      resource: ['*'],
    },
    {
      action: ['*'],
      effect: 'Allow',
      resource: ['eRx:*'],
    },
    {
      resource: ['FHIR:AllergyIntolerance:*', 'FHIR:MedicationStatement:*'],
      action: ['FHIR:Read', 'FHIR:Search'],
      effect: 'Allow',
    },
    {
      action: ['FHIR:History'],
      effect: 'Allow',
      resource: ['FHIR:Patient', 'FHIR:Appointment'],
    },
    // RCM
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update', 'FHIR:Create'],
      effect: 'Allow',
      resource: [
        'FHIR:Claim',
        'FHIR:Appointment',
        'FHIR:Location',
        'FHIR:HealthcareService',
        'FHIR:Coverage',
        'FHIR:Practitioner',
        'FHIR:Patient',
        'FHIR:RelatedPerson',
      ],
    },
  ],
};

export const PRESCRIBER_RULES: AccessPolicy['rule'] = [
  {
    action: ['FHIR:Search', 'FHIR:Read'],
    effect: 'Allow',
    resource: ['FHIR:AllergyIntolerance', 'FHIR:MedicationStatement'],
  },

  {
    action: ['eRx:SearchMedication'],
    effect: 'Allow',
    resource: ['eRx:Medication'],
  },
  {
    action: ['eRx:SearchAllergy'],
    effect: 'Allow',
    resource: ['eRx:Allergy'],
  },
  {
    action: ['eRx:SyncPatient'],
    effect: 'Allow',
    resource: ['eRx:Patient'],
  },
  {
    action: ['eRx:Create', 'eRx:Read'],
    effect: 'Allow',
    resource: ['eRx:Enrollment'],
  },
];

export const FRONT_DESK_RULES: AccessPolicy = {
  rule: [
    {
      action: ['FHIR:Search', 'FHIR:Read'],
      effect: 'Allow',
      resource: [
        'FHIR:Patient',
        'FHIR:Consent',
        'FHIR:Coverage',
        'FHIR:RelatedPerson',
        'FHIR:Organization',
        'FHIR:Location',
        'FHIR:HealthcareService',
        'FHIR:QuestionnaireResponse',
        'FHIR:DocumentReference',
      ],
    },
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update'],
      effect: 'Allow',
      resource: ['FHIR:Appointment', 'FHIR:Encounter'],
    },
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update', 'FHIR:Create'],
      effect: 'Allow',
      resource: ['FHIR:Communication'],
    },
    {
      action: ['Z3:GetObject'],
      effect: 'Allow',
      resource: ['Z3:*'],
    },
    {
      action: ['Zambda:InvokeFunction'],
      effect: 'Allow',
      resource: ['Zambda:Function:*'],
    },
    {
      action: ['Messaging:SendTransactionalSMS'],
      effect: 'Allow',
      resource: ['*'],
    },
    {
      action: ['FHIR:History'],
      effect: 'Allow',
      resource: ['FHIR:Patient', 'FHIR:Appointment'],
    },
  ],
};

export const INACTIVE_RULES: AccessPolicy = {
  rule: [
    {
      resource: ['*'],
      action: ['*'],
      effect: 'Deny',
    },
  ],
};
