"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INACTIVE_RULES = exports.FRONT_DESK_RULES = exports.PRESCRIBER_RULES = exports.CUSTOMER_SUPPORT_RULES = exports.PROVIDER_RULES = exports.STAFF_RULES = exports.MANAGER_RULES = exports.ADMINISTRATOR_RULES = void 0;
exports.ADMINISTRATOR_RULES = {
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
exports.MANAGER_RULES = {
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
exports.STAFF_RULES = {
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
exports.PROVIDER_RULES = {
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
exports.CUSTOMER_SUPPORT_RULES = {
    rule: __spreadArray(__spreadArray([], exports.ADMINISTRATOR_RULES.rule, true), exports.PROVIDER_RULES.rule, true),
};
exports.PRESCRIBER_RULES = {
    rule: [
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
        {
            action: ['Zambda:InvokeFunction'],
            effect: 'Allow',
            resource: ['Zambda:Function:*'],
        },
    ],
};
exports.FRONT_DESK_RULES = {
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
                'FHIR:Questionnaire',
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
exports.INACTIVE_RULES = {
    rule: [
        {
            resource: ['*'],
            action: ['*'],
            effect: 'Deny',
        },
    ],
};
