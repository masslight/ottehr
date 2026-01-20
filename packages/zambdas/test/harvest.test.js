"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var harvest_1 = require("../src/ehr/shared/harvest");
var patient_1_json_1 = require("./data/patient-1.json");
var patient_2_json_1 = require("./data/patient-2.json");
var patient_3_json_1 = require("./data/patient-3.json");
var patient_4_json_1 = require("./data/patient-4.json");
var questionnaire_response_1_json_1 = require("./data/questionnaire-response-1.json");
var questionnaire_response_2_json_1 = require("./data/questionnaire-response-2.json");
var questionnaire_response_3_json_1 = require("./data/questionnaire-response-3.json");
var questionnaire_response_4_json_1 = require("./data/questionnaire-response-4.json");
var questionnaire_response_5_json_1 = require("./data/questionnaire-response-5.json");
var questionnaire_response_6_json_1 = require("./data/questionnaire-response-6.json");
var questionnaire_response_7_json_1 = require("./data/questionnaire-response-7.json");
var questionnaire_response_8_json_1 = require("./data/questionnaire-response-8.json");
describe('Patient Master Record Tests', function () {
    test('should generate correct JSON patch operations for a new patient', function () {
        var _a;
        var patientPatchOperations = [
            {
                op: 'add',
                path: '/address',
                value: [
                    {
                        line: ['street address new'],
                        city: 'Pembroke Pine',
                        state: 'CA',
                        postalCode: '06001',
                    },
                ],
            },
            {
                op: 'add',
                path: '/telecom',
                value: [
                    {
                        system: 'email',
                        value: 'okovalenko+testnew@masslight.com',
                    },
                    {
                        system: 'phone',
                        value: '+12027139680',
                    },
                ],
            },
            {
                op: 'add',
                path: '/extension',
                value: [
                    {
                        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/ethnicity',
                        valueCodeableConcept: {
                            coding: [
                                {
                                    system: 'http://terminology.hl7.org/CodeSystem/v3-Ethnicity',
                                    code: '2135-2',
                                    display: 'Hispanic or Latino',
                                },
                            ],
                        },
                    },
                    {
                        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/race',
                        valueCodeableConcept: {
                            coding: [
                                {
                                    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
                                    code: '1002-5',
                                    display: 'American Indian or Alaska Native',
                                },
                            ],
                        },
                    },
                ],
            },
            {
                op: 'add',
                path: '/communication',
                value: [
                    {
                        language: {
                            coding: [
                                {
                                    system: 'urn:ietf:bcp:47',
                                    code: 'en',
                                    display: 'English',
                                },
                            ],
                        },
                        preferred: true,
                    },
                ],
            },
            {
                op: 'replace',
                path: '/name/0/given',
                value: ['Olha'],
            },
            {
                op: 'replace',
                path: '/name/0/family',
                value: 'Test0418',
            },
            {
                op: 'replace',
                path: '/birthDate',
                value: '2005-07-18',
            },
            {
                op: 'replace',
                path: '/gender',
                value: 'female',
            },
        ];
        var result = (0, harvest_1.createMasterRecordPatchOperations)((_a = questionnaire_response_1_json_1.default.item) !== null && _a !== void 0 ? _a : [], patient_1_json_1.default);
        (0, vitest_1.expect)(result).toEqual({
            coverage: {},
            patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
            relatedPerson: {},
        });
    });
    test('should not generate patch operations for a patient with already processed paperwork with the same answers', function () {
        var _a;
        var result = (0, harvest_1.createMasterRecordPatchOperations)((_a = questionnaire_response_1_json_1.default.item) !== null && _a !== void 0 ? _a : [], patient_2_json_1.default);
        (0, vitest_1.expect)(result).toEqual({
            coverage: {},
            patient: { conflictingUpdates: [], patchOpsForDirectUpdate: [] },
            relatedPerson: {},
        });
    });
    test('should generate correct JSON patch operations for an old patient with a paperwork, different answers', function () {
        var _a;
        var patientPatchOperations = [
            {
                op: 'replace',
                path: '/name/0/given',
                value: ['Olga'],
            },
            {
                op: 'replace',
                path: '/address/0/city',
                value: 'New York',
            },
            {
                op: 'replace',
                path: '/address/0/state',
                value: 'NY',
            },
            {
                op: 'replace',
                path: '/address/0/postalCode',
                value: '10001',
            },
            {
                op: 'replace',
                path: '/telecom/1/value',
                value: '+12027139681',
            },
        ];
        var result = (0, harvest_1.createMasterRecordPatchOperations)((_a = questionnaire_response_3_json_1.default.item) !== null && _a !== void 0 ? _a : [], patient_2_json_1.default);
        (0, vitest_1.expect)(result).toEqual({
            coverage: {},
            patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
            relatedPerson: {},
        });
    });
    test('should generate correct JSON patch operation to remove patient birth sex value', function () {
        var _a;
        var result = (0, harvest_1.createMasterRecordPatchOperations)((_a = questionnaire_response_2_json_1.default.item) !== null && _a !== void 0 ? _a : [], patient_3_json_1.default);
        (0, vitest_1.expect)(result).toEqual({
            coverage: {},
            patient: { conflictingUpdates: [], patchOpsForDirectUpdate: [{ op: 'remove', path: '/gender' }] },
            relatedPerson: {},
        });
    });
    test('should generate correct JSON patch operations to remove all not required data', function () {
        var _a;
        var patientPatchOperations = [
            { op: 'replace', path: '/name/0/given', value: ['George'] },
            { op: 'remove', path: '/name/0/suffix' },
            { op: 'remove', path: '/name/1' },
            { op: 'replace', path: '/address/0/line', value: ['Lincoln str., 21'] },
            { op: 'remove', path: '/communication' },
            {
                op: 'replace',
                path: '/extension',
                value: [
                    {
                        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/ethnicity',
                        valueCodeableConcept: {
                            coding: [
                                {
                                    code: '2186-5',
                                    system: 'http://terminology.hl7.org/CodeSystem/v3-Ethnicity',
                                    display: 'Not Hispanic or Latino',
                                },
                            ],
                        },
                    },
                    {
                        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/race',
                        valueCodeableConcept: {
                            coding: [
                                {
                                    code: '2028-9',
                                    system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
                                    display: 'Asian',
                                },
                            ],
                        },
                    },
                ],
            },
            { op: 'remove', path: '/generalPractitioner' },
            { op: 'remove', path: '/contained' },
        ];
        var result = (0, harvest_1.createMasterRecordPatchOperations)((_a = questionnaire_response_4_json_1.default.item) !== null && _a !== void 0 ? _a : [], patient_4_json_1.default);
        (0, vitest_1.expect)(result).toEqual({
            coverage: {},
            patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
            relatedPerson: {},
        });
    });
    test('should generate correct JSON patch operations to remove not required PCP fields', function () {
        var _a;
        var patientPatchOperations = [
            {
                op: 'replace',
                path: '/contained',
                value: [
                    {
                        id: 'primary-care-physician',
                        name: [
                            {
                                given: ['Elizabeth'],
                                family: 'Ronda',
                            },
                        ],
                        active: true,
                        resourceType: 'Practitioner',
                    },
                ],
            },
        ];
        var result = (0, harvest_1.createMasterRecordPatchOperations)((_a = questionnaire_response_5_json_1.default.item) !== null && _a !== void 0 ? _a : [], patient_4_json_1.default);
        (0, vitest_1.expect)(result).toEqual({
            coverage: {},
            patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
            relatedPerson: {},
        });
    });
    test('should generate correct JSON patch operations to deactivate PCP', function () {
        var _a;
        var patientPatchOperations = [
            {
                op: 'replace',
                path: '/contained',
                value: [
                    {
                        id: 'primary-care-physician',
                        name: [
                            {
                                given: ['Elizabeth'],
                                family: 'Ronda',
                            },
                        ],
                        active: false,
                        resourceType: 'Practitioner',
                    },
                ],
            },
        ];
        var result = (0, harvest_1.createMasterRecordPatchOperations)((_a = questionnaire_response_6_json_1.default.item) !== null && _a !== void 0 ? _a : [], patient_4_json_1.default);
        (0, vitest_1.expect)(result).toEqual({
            coverage: {},
            patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
            relatedPerson: {},
        });
    });
    test('should not generate JSON patch operations in case with no PCP data but active flag set to true', function () {
        var _a;
        var result = (0, harvest_1.createMasterRecordPatchOperations)((_a = questionnaire_response_7_json_1.default.item) !== null && _a !== void 0 ? _a : [], patient_1_json_1.default);
        (0, vitest_1.expect)(result).toEqual({
            coverage: {},
            patient: { conflictingUpdates: [], patchOpsForDirectUpdate: [] },
            relatedPerson: {},
        });
    });
    test('should generate correct JSON patch operations to remove PCP completely when all information is cleared', function () {
        var _a;
        var patientPatchOperations = [
            {
                op: 'remove',
                path: '/generalPractitioner',
            },
            {
                op: 'remove',
                path: '/contained',
            },
        ];
        var result = (0, harvest_1.createMasterRecordPatchOperations)((_a = questionnaire_response_8_json_1.default.item) !== null && _a !== void 0 ? _a : [], patient_4_json_1.default);
        (0, vitest_1.expect)(result).toEqual({
            coverage: {},
            patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
            relatedPerson: {},
        });
    });
    test('should not drop pharmacy contained resource when adding PCP', function () {
        var patientWithPharmacy = {
            id: 'patient-with-pharmacy',
            resourceType: 'Patient',
            contained: [
                {
                    id: harvest_1.PATIENT_CONTAINED_PHARMACY_ID,
                    name: 'Existing Pharmacy',
                    resourceType: 'Organization',
                },
            ],
            extension: [
                {
                    url: utils_1.PREFERRED_PHARMACY_EXTENSION_URL,
                    valueReference: {
                        reference: "#".concat(harvest_1.PATIENT_CONTAINED_PHARMACY_ID),
                    },
                },
            ],
        };
        var pcpItems = [
            { linkId: 'pcp-first', answer: [{ valueString: 'Jane' }] },
            { linkId: 'pcp-last', answer: [{ valueString: 'Doe' }] },
        ];
        var result = (0, harvest_1.createMasterRecordPatchOperations)(pcpItems, patientWithPharmacy);
        (0, vitest_1.expect)(result).toEqual({
            coverage: {},
            patient: {
                conflictingUpdates: [],
                patchOpsForDirectUpdate: [
                    {
                        op: 'replace',
                        path: '/contained',
                        value: [
                            {
                                id: harvest_1.PATIENT_CONTAINED_PHARMACY_ID,
                                name: 'Existing Pharmacy',
                                resourceType: 'Organization',
                            },
                            {
                                resourceType: 'Practitioner',
                                id: 'primary-care-physician',
                                name: [
                                    {
                                        family: 'Doe',
                                        given: ['Jane'],
                                    },
                                ],
                                active: true,
                            },
                        ],
                    },
                    {
                        op: 'add',
                        path: '/generalPractitioner',
                        value: [{ reference: '#primary-care-physician', resourceType: 'Practitioner' }],
                    },
                ],
            },
            relatedPerson: {},
        });
    });
});
