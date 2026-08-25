import { AccessPolicy } from 'utils/lib/types/api/user.types';

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
        'FHIR:Questionnaire',
        'FHIR:DocumentReference',
        'FHIR:Person',
        'FHIR:Medication',
        'FHIR:List',
        'FHIR:Schedule',
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
      action: ['Messaging:GetConfiguration'],
      effect: 'Allow',
      resource: ['Messaging:Messaging:*'],
    },
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update', 'FHIR:Create'],
      resource: ['FHIR:Organization:*', 'FHIR:PractitionerRole'],
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
        'FHIR:Questionnaire',
        'FHIR:Organization',
        'FHIR:QuestionnaireResponse',
        'FHIR:DocumentReference',
        'FHIR:Person',
        'FHIR:Medication',
        'FHIR:List',
        'FHIR:Schedule',
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
        'FHIR:Questionnaire',
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
      action: ['Messaging:GetConfiguration'],
      effect: 'Allow',
      resource: ['Messaging:Messaging:*'],
    },
    {
      action: ['FHIR:Search', 'FHIR:Read', 'FHIR:Update', 'FHIR:Create'],
      resource: ['FHIR:Organization:*'],
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
        'FHIR:Questionnaire',
        'FHIR:QuestionnaireResponse',
        'FHIR:DocumentReference',
        'FHIR:Person',
        'FHIR:Schedule',
        'FHIR:ValueSet',
        'FHIR:List',
        'FHIR:MedicationRequest',
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
      action: ['Messaging:GetConfiguration'],
      effect: 'Allow',
      resource: ['Messaging:Messaging:*'],
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
        'FHIR:Questionnaire',
        'FHIR:QuestionnaireResponse',
        'FHIR:DocumentReference',
        'FHIR:Person',
        'FHIR:Task',
        'FHIR:List',
        'FHIR:Schedule',
        'FHIR:ValueSet',
        'FHIR:Medication',
        'FHIR:MedicationRequest',
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
      action: ['Messaging:GetConfiguration'],
      effect: 'Allow',
      resource: ['Messaging:Messaging:*'],
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

// The read-only slice of eRx the Clinician role keeps in place of Provider's blanket `eRx:*` grant.
// These are Medispan reference-database lookups, the project eRx configuration read, and the patient's
// external medication history: they carry no prescribing authority and no NPI requirement, and the EHR
// needs them well outside the prescribing flow — medication search, the in-house medication admin pages,
// and medication reconciliation in the chart all call them.
//
// eRx:GetMedicationHistory is included because reading a patient's outside medications is reconciliation,
// not prescribing, and it is precisely the task nurses and MAs perform. The EHR calls it straight from the
// browser with the signed-in user's token (useExternalMedicationHistory), so without this grant the chart's
// external-medications list is empty for a Clinician.
//
// Everything that writes or transmits a prescription (and the DoseSpot practitioner connect/enroll flows)
// stays Provider-only. So, for now, do eRx:SyncPatient, eRx:Check and eRx:GetPharmacy — but note those
// three are a known gap rather than a settled decision: ERXInteractionsReadiness runs the in-house
// medication interaction precheck with the signed-in user's token (syncPatient, then
// checkPrecheckInteractions), and PrescribedMedicationsContainer resolves pharmacy names with getPharmacy.
// A Clinician is permitted to order in-house medications, so today that precheck 403s and silently
// degrades to "please review manually". Tracked separately — widen deliberately, not by accident.
const CLINICIAN_ERX_RULES: AccessPolicy['rule'] = [
  {
    action: ['eRx:SearchMedication', 'eRx:GetMedication'],
    effect: 'Allow',
    resource: ['eRx:Medication'],
  },
  {
    action: ['eRx:SearchAllergen'],
    effect: 'Allow',
    resource: ['eRx:Allergen'],
  },
  {
    action: ['eRx:GetConfiguration'],
    effect: 'Allow',
    resource: ['eRx:Configuration'],
  },
  {
    action: ['eRx:GetMedicationHistory'],
    effect: 'Allow',
    resource: ['eRx:Patient'],
  },
];

// Clinician = Provider access minus the two NPI-gated capabilities that are enforced at the access
// policy layer: client-side e-prescribing (eRx) and submitting Claims under a provider NPI. The other
// NPI-gated actions (sign/co-sign, external labs & imaging orders, in-house medication orders) run
// through M2M zambdas, so the access policy does not gate them — they are enforced in those zambdas
// via requirePractitionerNPI. Derived from PROVIDER_RULES so it stays in sync as Provider access evolves.
export const CLINICIAN_RULES: AccessPolicy = {
  rule: PROVIDER_RULES.rule
    // Swap Provider's blanket eRx grant for the read-only reference lookups (see above).
    .flatMap((rule) => ([rule.resource].flat().includes('eRx:*') ? CLINICIAN_ERX_RULES : [rule]))
    // Keep the rest of the RCM block (Appointment/Coverage/etc.) but remove the ability to write Claims.
    .map((rule) => {
      const resources = [rule.resource].flat();
      if (!resources.includes('FHIR:Claim')) {
        return rule;
      }
      return { ...rule, resource: resources.filter((resource) => resource !== 'FHIR:Claim') };
    }),
};

export const CUSTOMER_SUPPORT_RULES: AccessPolicy = {
  rule: [...ADMINISTRATOR_RULES.rule, ...PROVIDER_RULES.rule],
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
