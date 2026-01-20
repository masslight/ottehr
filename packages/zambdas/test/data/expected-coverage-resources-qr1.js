"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expectedCoverageResources = exports.expectedAccountGuarantorFromQR1 = exports.expectedSecondaryPolicyHolderFromQR1 = exports.expectedPrimaryPolicyHolderFromQR1 = void 0;
var utils_1 = require("utils");
exports.expectedPrimaryPolicyHolderFromQR1 = {
    resourceType: 'RelatedPerson',
    id: 'coverageSubscriber',
    name: [
        {
            given: ['Barnabas', 'Thaddeus'],
            family: 'PicklesWorth',
        },
    ],
    birthDate: '1982-02-23',
    gender: 'male',
    patient: { reference: '{{PATIENT_REF}}' },
    relationship: [
        {
            coding: [
                {
                    system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                    code: 'child',
                    display: 'Child',
                },
            ],
        },
    ],
    address: [
        {
            line: ['317 Mustard Street', 'Unit 2'],
            city: 'DeliciousVilla',
            state: 'DE',
            postalCode: '20001',
        },
    ],
};
exports.expectedSecondaryPolicyHolderFromQR1 = {
    resourceType: 'RelatedPerson',
    id: 'coverageSubscriber',
    name: [
        {
            given: ['Jennifer', 'Celeste'],
            family: 'PicklesWorth',
        },
    ],
    birthDate: '1983-02-23',
    gender: 'female',
    patient: { reference: '{{PATIENT_REF}}' },
    relationship: [
        {
            coding: [
                {
                    system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                    code: 'child',
                    display: 'Child',
                },
            ],
        },
    ],
    address: [
        {
            line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
            city: 'Washington',
            state: 'DC',
            postalCode: '20001',
        },
    ],
};
exports.expectedAccountGuarantorFromQR1 = {
    resourceType: 'RelatedPerson',
    id: 'accountGuarantorId',
    name: [{ given: ['Jane'], family: 'Doe' }],
    birthDate: '1983-02-23',
    gender: 'female',
    patient: { reference: '{{PATIENT_REF}}' }, // newPatient1
    address: [
        {
            city: 'fakePlace',
            line: ['123 test lane'],
            postalCode: '11111',
            state: 'NY',
        },
    ],
    relationship: [
        {
            coding: [
                {
                    system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                    code: 'parent',
                    display: 'Parent',
                },
            ],
        },
    ],
    telecom: [
        {
            system: 'phone',
            value: '+19895556543',
        },
        {
            system: 'email',
            value: 'rowdyroddypiper@hotmail.com',
        },
    ],
};
exports.expectedCoverageResources = {
    primary: {
        resourceType: 'Coverage',
        identifier: [
            __assign(__assign({}, utils_1.COVERAGE_MEMBER_IDENTIFIER_BASE), { value: 'FafOneJwgNdkOetWwe6', assigner: {
                    reference: '{{ORGANIZATION_REF}}',
                    display: 'Aetna',
                } }),
        ],
        contained: [exports.expectedPrimaryPolicyHolderFromQR1],
        status: 'active',
        beneficiary: { reference: '{{PATIENT_REF}}', type: 'Patient' },
        payor: [{ reference: '{{ORGANIZATION_REF}}' }],
        subscriberId: 'FafOneJwgNdkOetWwe6',
        subscriber: {
            reference: "#coverageSubscriber",
        },
        relationship: {
            coding: [
                {
                    system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                    code: 'child',
                    display: 'Child',
                },
            ],
        },
        class: [
            {
                name: 'Aetna',
                type: {
                    coding: [
                        {
                            code: 'plan',
                            system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                        },
                    ],
                },
                value: '60054',
            },
        ],
        type: {
            coding: [
                {
                    code: '09',
                    system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
                },
                {
                    code: 'pay',
                    system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
                },
            ],
        },
        extension: [
            {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information',
                valueString: 'Additional info to primary insurance',
            },
        ],
    },
    secondary: {
        resourceType: 'Coverage',
        identifier: [
            __assign(__assign({}, utils_1.COVERAGE_MEMBER_IDENTIFIER_BASE), { value: 'FdfDfdFdfDfh7897', assigner: {
                    reference: '{{ORGANIZATION_REF}}',
                    display: 'Aetna',
                } }),
        ],
        contained: [exports.expectedSecondaryPolicyHolderFromQR1],
        status: 'active',
        beneficiary: { reference: '{{PATIENT_REF}}', type: 'Patient' },
        payor: [{ reference: '{{ORGANIZATION_REF}}' }],
        subscriberId: 'FdfDfdFdfDfh7897',
        subscriber: { reference: '#coverageSubscriber' },
        relationship: {
            coding: [
                {
                    system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                    code: 'child',
                    display: 'Child',
                },
            ],
        },
        class: [
            {
                name: 'Aetna',
                type: {
                    coding: [
                        {
                            code: 'plan',
                            system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                        },
                    ],
                },
                value: '60054',
            },
        ],
        type: {
            coding: [
                {
                    code: '12',
                    system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
                },
                {
                    code: 'PPO',
                    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                },
            ],
        },
        extension: [
            {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information',
                valueString: 'Additional info to secondary insurance',
            },
        ],
    },
};
