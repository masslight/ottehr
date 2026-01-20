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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var crypto_1 = require("crypto");
var fs = require("fs");
var short_uuid_1 = require("short-uuid");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var harvest_1 = require("../../src/ehr/shared/harvest");
var shared_1 = require("../../src/shared");
var sub_intake_harvest_1 = require("../../src/subscriptions/questionnaire-response/sub-intake-harvest");
var base_qr_json_1 = require("../data/base-qr.json");
var expected_coverage_resources_qr1_1 = require("../data/expected-coverage-resources-qr1");
var harvest_test_helpers_1 = require("../helpers/harvest-test-helpers");
var DEFAULT_TIMEOUT = 40000;
var stubAccount = {
    resourceType: 'Account',
    type: __assign({}, utils_1.PATIENT_BILLING_ACCOUNT_TYPE),
    status: 'active',
    subject: [{ reference: "{{PATIENT_REF}}" }],
    description: 'Patient account',
};
(0, vitest_1.describe)('Harvest Module Integration Tests', function () {
    var envConfig = JSON.parse(fs.readFileSync('.env/local.json', 'utf8'));
    var INSURANCE_PLAN_ORGS_IDS = [];
    var token;
    var oystehrClient;
    var BASE_QR;
    var patientIdsForCleanup = {};
    var patientsUsed = new Set();
    var stripIdAndMeta = function (resource) {
        return __assign(__assign({}, resource), { id: undefined, meta: undefined });
    };
    var QR_WITH_PATIENT_GUARANTOR = function () {
        var _a;
        return (__assign(__assign({}, BASE_QR), { item: (0, harvest_test_helpers_1.replaceGuarantorWithPatient)((_a = BASE_QR.item) !== null && _a !== void 0 ? _a : []) }));
    };
    var QR_WITH_PATIENT_PRIMARY_SUBSCRIBER = function () {
        var _a;
        return (__assign(__assign({}, BASE_QR), { item: (0, harvest_test_helpers_1.replaceSubscriberWithPatient)((_a = BASE_QR.item) !== null && _a !== void 0 ? _a : [], {
                primary: true,
                secondary: false,
            }) }));
    };
    var QR_WITH_PATIENT_SECONDARY_SUBSCRIBER = function () {
        var _a;
        return (__assign(__assign({}, BASE_QR), { item: (0, harvest_test_helpers_1.replaceSubscriberWithPatient)((_a = BASE_QR.item) !== null && _a !== void 0 ? _a : [], {
                primary: false,
                secondary: true,
            }) }));
    };
    var QR_WITH_PATIENT_FOR_ALL_SUBSCRIBERS_AND_GUARANTOR = function () {
        var _a;
        return (__assign(__assign({}, BASE_QR), { item: (0, harvest_test_helpers_1.replaceGuarantorWithPatient)((0, harvest_test_helpers_1.replaceSubscriberWithPatient)((_a = BASE_QR.item) !== null && _a !== void 0 ? _a : [], {
                primary: true,
                secondary: true,
            })) }));
    };
    var QR_WITH_ALT_GUARANTOR = function (param) {
        var _a;
        return (__assign(__assign({}, BASE_QR), { item: (0, harvest_test_helpers_1.replaceGuarantorWithAlternate)((_a = BASE_QR.item) !== null && _a !== void 0 ? _a : [], param) }));
    };
    var getQR1Refs = function (pId, dummyResourceRefs) {
        var orgId = INSURANCE_PLAN_ORGS_IDS[0];
        var persistedIds = patientIdsForCleanup[pId];
        if (persistedIds === undefined && dummyResourceRefs) {
            var appointment = dummyResourceRefs.appointment, encounter = dummyResourceRefs.encounter;
            return ["Organization/".concat(orgId), "Patient/".concat(pId), encounter, appointment];
        }
        var _a = patientIdsForCleanup[pId], patientId = _a[0], encounterId = _a[1], appointmentId = _a[2];
        var refs = [
            "Organization/".concat(orgId),
            "Patient/".concat(patientId),
            "Encounter/".concat(encounterId),
            "Appointment/".concat(appointmentId),
        ];
        return refs;
    };
    var fillWithQR1Refs = function (template, patientId, dummyResourceRefs) {
        var refs = getQR1Refs(patientId, dummyResourceRefs);
        return (0, harvest_test_helpers_1.fillReferences)(template, refs);
    };
    var normalizedCompare = function (rawTemplate, rawExpectation, patientId) {
        var template = fillWithQR1Refs(rawTemplate, patientId);
        (0, vitest_1.expect)(template).toEqual(stripIdAndMeta(rawExpectation));
    };
    var changeCoverageMemberId = function (coverage, patientId) {
        var newId = (0, short_uuid_1.uuid)();
        return fillWithQR1Refs(__assign(__assign({}, coverage), { identifier: [
                __assign(__assign({}, utils_1.COVERAGE_MEMBER_IDENTIFIER_BASE), { value: newId, assigner: {
                        reference: '{{ORGANIZATION_REF}}',
                        display: 'Aetna',
                    } }),
            ], subscriberId: newId }), patientId);
    };
    var getEncounter = function (id) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehrClient.fhir.get({
                        resourceType: 'Encounter',
                        id: id,
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var cleanup = function () { return __awaiter(void 0, void 0, void 0, function () {
        var errors, cleanupOutcomes, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    errors = [];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.allSettled(((_a = Object.values(patientIdsForCleanup)) !== null && _a !== void 0 ? _a : []).map(function (resources) { return cleanupPatientResources(resources); }))];
                case 2:
                    cleanupOutcomes = _b.sent();
                    cleanupOutcomes.forEach(function (outcome, idx) {
                        if (outcome.status === 'rejected') {
                            errors.push("".concat(Object.keys(patientIdsForCleanup)[idx]));
                        }
                    });
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _b.sent();
                    console.error('Error during cleanup:', error_1);
                    throw error_1;
                case 4:
                    if (errors.length > 0) {
                        return [2 /*return*/, { error: new Error("Failed to clean up resources for patients: ".concat(errors.join(', '))) }];
                    }
                    return [2 /*return*/, { error: undefined }];
            }
        });
    }); };
    var cleanupPatientResources = function (ids) { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, encounterId, appointmentId, relatedPersonId, oystehrClient, createdResources, uniques, deletes, error_2, error_3, error_4, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientId = ids[0], encounterId = ids[1], appointmentId = ids[2], relatedPersonId = ids[3];
                    if (!token) {
                        throw new Error('Failed to fetch auth token.');
                    }
                    oystehrClient = (0, shared_1.createOystehrClient)(token, envConfig);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Patient',
                            params: [
                                {
                                    name: '_id',
                                    value: patientId,
                                },
                                {
                                    name: '_revinclude',
                                    value: 'Appointment:patient',
                                },
                                {
                                    name: '_revinclude',
                                    value: 'Encounter:patient',
                                },
                                {
                                    name: '_revinclude',
                                    value: 'RelatedPerson:patient',
                                },
                                {
                                    name: '_revinclude',
                                    value: "Account:patient",
                                },
                                {
                                    name: '_revinclude',
                                    value: 'Coverage:patient',
                                },
                                {
                                    name: '_include:iterate',
                                    value: 'Coverage:subscriber:RelatedPerson',
                                },
                            ],
                        })];
                case 1:
                    createdResources = (_a.sent()).unbundle();
                    uniques = new Set();
                    deletes = createdResources
                        .map(function (res) {
                        return {
                            method: 'DELETE',
                            url: "".concat(res.resourceType, "/").concat(res.id),
                        };
                    })
                        .filter(function (request) {
                        if (uniques.has(request.url)) {
                            return false;
                        }
                        uniques.add(request.url);
                        return true;
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: deletes })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, oystehrClient.fhir.get({ resourceType: 'Patient', id: patientId })];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_2 = _a.sent();
                    (0, vitest_1.expect)(error_2).toBeDefined();
                    (0, vitest_1.expect)(error_2 === null || error_2 === void 0 ? void 0 : error_2.code).toBe(410);
                    return [3 /*break*/, 6];
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, oystehrClient.fhir.get({ resourceType: 'Appointment', id: appointmentId })];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    error_3 = _a.sent();
                    (0, vitest_1.expect)(error_3).toBeDefined();
                    (0, vitest_1.expect)(error_3 === null || error_3 === void 0 ? void 0 : error_3.code).toBe(410);
                    return [3 /*break*/, 9];
                case 9:
                    _a.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, oystehrClient.fhir.get({ resourceType: 'Encounter', id: encounterId })];
                case 10:
                    _a.sent();
                    return [3 /*break*/, 12];
                case 11:
                    error_4 = _a.sent();
                    (0, vitest_1.expect)(error_4).toBeDefined();
                    (0, vitest_1.expect)(error_4 === null || error_4 === void 0 ? void 0 : error_4.code).toBe(410);
                    return [3 /*break*/, 12];
                case 12:
                    _a.trys.push([12, 14, , 15]);
                    return [4 /*yield*/, oystehrClient.fhir.get({ resourceType: 'RelatedPerson', id: relatedPersonId })];
                case 13:
                    _a.sent();
                    return [3 /*break*/, 15];
                case 14:
                    error_5 = _a.sent();
                    (0, vitest_1.expect)(error_5).toBeDefined();
                    (0, vitest_1.expect)(error_5 === null || error_5 === void 0 ? void 0 : error_5.code).toBe(410);
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/];
            }
        });
    }); };
    var applyEffectAndValidateResults = function (input) { return __awaiter(void 0, void 0, void 0, function () {
        var qr, idToCheck, guarantorRef, patientId, dummyResourceRefs, qrWithPatient, effect, foundAccounts, foundGuarantor, _a, resourceType, resourceId, foundAccountResources, foundAccount, primaryCoverageRef, secondaryCoverageRef, contained, guarantor;
        var _b, _c, _d, _e, _f, _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    qr = input.qr, idToCheck = input.idToCheck, guarantorRef = input.guarantorRef, patientId = input.patientId, dummyResourceRefs = input.dummyResourceRefs;
                    qrWithPatient = fillWithQR1Refs(qr !== null && qr !== void 0 ? qr : BASE_QR, patientId, dummyResourceRefs);
                    console.log('QR with patient:', JSON.stringify(qrWithPatient, null, 2));
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qrWithPatient, secrets: envConfig }, oystehrClient)];
                case 1:
                    effect = _k.sent();
                    // todo: deeper integration test is needed here
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Account',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 2:
                    foundAccounts = (_k.sent()).unbundle();
                    (0, vitest_1.expect)(foundAccounts).toBeDefined();
                    if (!(guarantorRef && !guarantorRef.startsWith('#'))) return [3 /*break*/, 4];
                    _a = guarantorRef.split('/'), resourceType = _a[0], resourceId = _a[1];
                    return [4 /*yield*/, oystehrClient.fhir.get({
                            resourceType: resourceType,
                            id: resourceId,
                        })];
                case 3:
                    foundGuarantor = _k.sent();
                    _k.label = 4;
                case 4:
                    foundAccountResources = foundAccounts.filter(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(foundAccountResources.length).toBe(1);
                    foundAccount = foundAccountResources[0];
                    (0, vitest_1.expect)(foundAccount).toBeDefined();
                    (0, vitest_1.assert)(foundAccount.id);
                    if (idToCheck) {
                        (0, vitest_1.expect)(foundAccount.id).toBe(idToCheck);
                    }
                    (0, vitest_1.expect)(foundAccount.coverage).toBeDefined();
                    (0, vitest_1.expect)((_b = foundAccount.coverage) === null || _b === void 0 ? void 0 : _b.length).toBe(2);
                    primaryCoverageRef = (_e = (_d = (_c = foundAccount.coverage) === null || _c === void 0 ? void 0 : _c.find(function (cov) { return cov.priority === 1; })) === null || _d === void 0 ? void 0 : _d.coverage) === null || _e === void 0 ? void 0 : _e.reference;
                    secondaryCoverageRef = (_h = (_g = (_f = foundAccount.coverage) === null || _f === void 0 ? void 0 : _f.find(function (cov) { return cov.priority === 2; })) === null || _g === void 0 ? void 0 : _g.coverage) === null || _h === void 0 ? void 0 : _h.reference;
                    (0, vitest_1.expect)(primaryCoverageRef).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverageRef).toBeDefined();
                    (0, vitest_1.assert)(primaryCoverageRef);
                    (0, vitest_1.assert)(secondaryCoverageRef);
                    if (guarantorRef && guarantorRef.startsWith('#')) {
                        contained = (_j = foundAccount.contained) !== null && _j !== void 0 ? _j : [];
                        guarantor = contained.find(function (res) { return "#".concat(res.id) === guarantorRef; });
                        (0, vitest_1.expect)(guarantor).toBeDefined();
                    }
                    return [2 /*return*/, {
                            account: foundAccount,
                            primaryCoverageRef: primaryCoverageRef,
                            secondaryCoverageRef: secondaryCoverageRef,
                            persistedGuarantor: foundGuarantor,
                        }];
            }
        });
    }); };
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var org1, orgs, refs, replacedItem;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Set up environment
                    // Add your setup code here
                    (0, vitest_1.expect)(process.env).toBeDefined();
                    (0, vitest_1.expect)(envConfig).toBeDefined();
                    if (!!token) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(envConfig)];
                case 1:
                    token = _a.sent();
                    _a.label = 2;
                case 2:
                    oystehrClient = (0, shared_1.createOystehrClient)(token, envConfig);
                    (0, vitest_1.expect)(oystehrClient).toBeDefined();
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Organization',
                            params: [
                                {
                                    name: 'name:exact',
                                    value: 'Aetna',
                                },
                                {
                                    name: 'active',
                                    value: 'true',
                                },
                            ],
                        })];
                case 3:
                    org1 = (_a.sent()).unbundle();
                    orgs = org1.filter(function (org) { return org.resourceType === 'Organization'; });
                    (0, vitest_1.expect)(orgs.length).toBeGreaterThan(0);
                    INSURANCE_PLAN_ORGS_IDS.push.apply(INSURANCE_PLAN_ORGS_IDS, orgs.map(function (o) { return o.id; }));
                    (0, vitest_1.expect)(INSURANCE_PLAN_ORGS_IDS.length).toBeGreaterThan(0);
                    refs = ["Organization/".concat(INSURANCE_PLAN_ORGS_IDS[0])];
                    replacedItem = (0, harvest_test_helpers_1.fillReferences)(base_qr_json_1.default.item, refs);
                    base_qr_json_1.default.item = replacedItem;
                    base_qr_json_1.default.status = 'completed';
                    BASE_QR = base_qr_json_1.default;
                    (0, vitest_1.expect)(BASE_QR).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
    beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        var patient, patientFullUrl, appointmentFullUrl, postRequests, createdBundle, resources, createdPatient, createdAppointment, createdEncounter, createdRelatedPerson;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patient = {
                        resourceType: 'Patient',
                        active: true,
                        gender: 'male',
                        birthDate: '2020-08-06',
                    };
                    patientFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                    appointmentFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                    postRequests = [
                        {
                            resource: patient,
                            method: 'POST',
                            url: 'Patient',
                            fullUrl: patientFullUrl,
                        },
                        {
                            method: 'POST',
                            url: 'Appointment',
                            fullUrl: appointmentFullUrl,
                            resource: {
                                resourceType: 'Appointment',
                                meta: {
                                    tag: [
                                        {
                                            code: utils_1.OTTEHR_MODULE.IP,
                                        },
                                    ],
                                },
                                status: 'proposed',
                                participant: [
                                    {
                                        actor: {
                                            reference: patientFullUrl,
                                        },
                                        status: 'accepted',
                                    },
                                    {
                                        actor: {
                                            reference: 'HealthcareService/3ad8f817-d3a4-4879-aac7-8a0b9461738b',
                                        },
                                        status: 'accepted',
                                    },
                                ],
                            },
                        },
                        {
                            method: 'POST',
                            url: 'Encounter',
                            resource: {
                                resourceType: 'Encounter',
                                status: 'finished',
                                class: {
                                    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                                    code: 'ACUTE',
                                },
                                appointment: [
                                    {
                                        reference: appointmentFullUrl,
                                    },
                                ],
                                subject: {
                                    reference: patientFullUrl,
                                },
                            },
                        },
                        {
                            method: 'POST',
                            url: 'RelatedPerson',
                            resource: {
                                resourceType: 'RelatedPerson',
                                patient: {
                                    reference: patientFullUrl,
                                },
                                telecom: [
                                    {
                                        value: '+15555555555',
                                        system: 'phone',
                                    },
                                    {
                                        value: '+15555555555',
                                        system: 'sms',
                                    },
                                ],
                                relationship: [
                                    {
                                        coding: [
                                            {
                                                code: 'user-relatedperson',
                                                system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    ];
                    return [4 /*yield*/, oystehrClient.fhir.transaction({
                            requests: postRequests,
                        })];
                case 1:
                    createdBundle = _a.sent();
                    (0, vitest_1.expect)(createdBundle).toBeDefined();
                    resources = (0, utils_1.unbundleBatchPostOutput)(createdBundle);
                    (0, vitest_1.expect)(resources.length).toBe(4);
                    createdPatient = resources.find(function (res) { return res.resourceType === 'Patient'; });
                    createdAppointment = resources.find(function (res) { return res.resourceType === 'Appointment'; });
                    createdEncounter = resources.find(function (res) { return res.resourceType === 'Encounter'; });
                    createdRelatedPerson = resources.find(function (res) { return res.resourceType === 'RelatedPerson'; });
                    (0, vitest_1.expect)(createdPatient).toBeDefined();
                    (0, vitest_1.expect)(createdPatient.id).toBeDefined();
                    (0, vitest_1.assert)(createdPatient.id);
                    (0, vitest_1.expect)(createdAppointment).toBeDefined();
                    (0, vitest_1.expect)(createdAppointment.id).toBeDefined();
                    (0, vitest_1.assert)(createdAppointment.id);
                    (0, vitest_1.expect)(createdEncounter).toBeDefined();
                    (0, vitest_1.expect)(createdEncounter.id).toBeDefined();
                    (0, vitest_1.assert)(createdEncounter.id);
                    (0, vitest_1.expect)(createdRelatedPerson).toBeDefined();
                    (0, vitest_1.expect)(createdRelatedPerson.id).toBeDefined();
                    (0, vitest_1.assert)(createdRelatedPerson.id);
                    patientIdsForCleanup[createdPatient.id] = [
                        createdPatient.id,
                        createdEncounter.id,
                        createdAppointment.id,
                        createdRelatedPerson.id,
                    ];
                    return [2 /*return*/];
            }
        });
    }); });
    afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cleanup()];
                case 1:
                    error = (_a.sent()).error;
                    (0, vitest_1.expect)(error).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT + 10000);
    var getPatientId = function () {
        var allEntries = Array.from(Object.entries(patientIdsForCleanup));
        var pId = allEntries[allEntries.length - 1][0];
        (0, vitest_1.expect)((0, utils_1.isValidUUID)(pId)).toBe(true);
        (0, vitest_1.expect)(patientsUsed.has(pId)).toBe(false);
        patientsUsed.add(pId);
        return pId;
    };
    (0, vitest_1.it)('should perform a sample test', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, createdAccount;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientId = getPatientId();
                    (0, vitest_1.expect)(true).toBe(true);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Account',
                            params: [
                                {
                                    name: 'patient._id',
                                    value: "".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 1:
                    createdAccount = (_a.sent()).unbundle();
                    (0, vitest_1.expect)(createdAccount.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should create an account with two associated coverages from the base sample QR', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, _a, _, encounterId, qr, encounterRef, encounterIdFromQr, effect, createdAccountBundle, createdAccount, primaryCoverageRef, secondaryCoverageRef, createdCoverages, primaryCoverage, secondaryCoverage, primary, secondary;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    patientId = getPatientId();
                    (0, vitest_1.expect)(patientId).toBeDefined();
                    (0, vitest_1.expect)((0, utils_1.isValidUUID)(patientId)).toBe(true);
                    _a = patientIdsForCleanup[patientId], _ = _a[0], encounterId = _a[1];
                    (0, vitest_1.expect)(encounterId).toBeDefined();
                    qr = fillWithQR1Refs(BASE_QR, patientId);
                    encounterRef = (_b = qr.encounter) === null || _b === void 0 ? void 0 : _b.reference;
                    (0, vitest_1.expect)(encounterRef).toBeDefined();
                    encounterIdFromQr = encounterRef === null || encounterRef === void 0 ? void 0 : encounterRef.replace('Encounter/', '');
                    (0, vitest_1.assert)(encounterRef);
                    (0, vitest_1.expect)(encounterIdFromQr).toBeDefined();
                    (0, vitest_1.expect)((0, utils_1.isValidUUID)(encounterIdFromQr)).toBe(true);
                    (0, vitest_1.expect)(encounterId).toBe(encounterIdFromQr);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 1:
                    effect = _o.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Account',
                            params: [
                                {
                                    name: 'patient._id',
                                    value: "".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 2:
                    createdAccountBundle = _o.sent();
                    createdAccount = createdAccountBundle.unbundle()[0];
                    (0, vitest_1.expect)(createdAccount).toBeDefined();
                    (0, vitest_1.assert)(createdAccount.id);
                    (0, vitest_1.expect)(createdAccount.coverage).toBeDefined();
                    primaryCoverageRef = (_e = (_d = (_c = createdAccount.coverage) === null || _c === void 0 ? void 0 : _c.find(function (cov) { return cov.priority === 1; })) === null || _d === void 0 ? void 0 : _d.coverage) === null || _e === void 0 ? void 0 : _e.reference;
                    secondaryCoverageRef = (_h = (_g = (_f = createdAccount.coverage) === null || _f === void 0 ? void 0 : _f.find(function (cov) { return cov.priority === 2; })) === null || _g === void 0 ? void 0 : _g.coverage) === null || _h === void 0 ? void 0 : _h.reference;
                    (0, vitest_1.expect)(primaryCoverageRef).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverageRef).toBeDefined();
                    (0, vitest_1.assert)(primaryCoverageRef);
                    (0, vitest_1.assert)(secondaryCoverageRef);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 3:
                    createdCoverages = (_o.sent()).unbundle();
                    (0, vitest_1.expect)(createdCoverages).toBeDefined();
                    (0, vitest_1.expect)(createdCoverages.length).toBeGreaterThanOrEqual(2);
                    primaryCoverage = createdCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = createdCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_j = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _j === void 0 ? void 0 : _j.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_k = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _k === void 0 ? void 0 : _k.reference).toEqual("Patient/".concat(patientId));
                    // both coverages should have contained RP as the subscriber
                    (0, vitest_1.expect)((_l = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _l === void 0 ? void 0 : _l.reference).toEqual('#coverageSubscriber');
                    (0, vitest_1.expect)((_m = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _m === void 0 ? void 0 : _m.reference).toEqual('#coverageSubscriber');
                    primary = expected_coverage_resources_qr1_1.expectedCoverageResources.primary, secondary = expected_coverage_resources_qr1_1.expectedCoverageResources.secondary;
                    normalizedCompare(primary, primaryCoverage, patientId);
                    normalizedCompare(secondary, secondaryCoverage, patientId);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update existing coverages to live on the new Account when the inputs match', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedRP2, persistedCoverage1, persistedCoverage2, batchRequests, transactionRequests, writtenResources, writtenPrimaryCoverage, writtenSecondaryCoverage, writtenPrimarySubscriber, writtenSecondarySubscriber, qr, effect, createdAccount, primaryCoverageRef, secondaryCoverageRef, createdCoverages, primaryCoverage, secondaryCoverage;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedRP2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedCoverage1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.primary, getQR1Refs(patientId));
                    persistedCoverage2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, getQR1Refs(patientId));
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _l.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(4);
                    writtenPrimaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage1.subscriberId; });
                    writtenSecondaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage2.subscriberId; });
                    writtenPrimarySubscriber = writtenResources.find(function (res) { var _a; return "RelatedPerson/".concat(res.id) === ((_a = writtenPrimaryCoverage === null || writtenPrimaryCoverage === void 0 ? void 0 : writtenPrimaryCoverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference); });
                    writtenSecondarySubscriber = writtenResources.find(function (res) { var _a; return "RelatedPerson/".concat(res.id) === ((_a = writtenSecondaryCoverage === null || writtenSecondaryCoverage === void 0 ? void 0 : writtenSecondaryCoverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference); });
                    qr = fillWithQR1Refs(BASE_QR, patientId);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 2:
                    effect = _l.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Account',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 3:
                    createdAccount = (_l.sent()).unbundle()[0];
                    (0, vitest_1.expect)(createdAccount).toBeDefined();
                    (0, vitest_1.assert)(createdAccount.id);
                    primaryCoverageRef = (_c = (_b = (_a = createdAccount.coverage) === null || _a === void 0 ? void 0 : _a.find(function (cov) { return cov.priority === 1; })) === null || _b === void 0 ? void 0 : _b.coverage) === null || _c === void 0 ? void 0 : _c.reference;
                    secondaryCoverageRef = (_f = (_e = (_d = createdAccount.coverage) === null || _d === void 0 ? void 0 : _d.find(function (cov) { return cov.priority === 2; })) === null || _e === void 0 ? void 0 : _e.coverage) === null || _f === void 0 ? void 0 : _f.reference;
                    (0, vitest_1.expect)(primaryCoverageRef).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverageRef).toBeDefined();
                    (0, vitest_1.assert)(primaryCoverageRef);
                    (0, vitest_1.assert)(secondaryCoverageRef);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 4:
                    createdCoverages = (_l.sent()).unbundle();
                    (0, vitest_1.expect)(createdCoverages).toBeDefined();
                    (0, vitest_1.expect)(createdCoverages.length).toBe(2);
                    primaryCoverage = createdCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = createdCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_g = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _g === void 0 ? void 0 : _g.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_h = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _h === void 0 ? void 0 : _h.reference).toEqual("Patient/".concat(patientId));
                    // both coverages should have the existing persisted RP as the subscriber
                    (0, vitest_1.expect)((_j = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _j === void 0 ? void 0 : _j.reference).toEqual("RelatedPerson/".concat(writtenPrimarySubscriber.id));
                    (0, vitest_1.expect)((_k = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _k === void 0 ? void 0 : _k.reference).toEqual("RelatedPerson/".concat(writtenSecondarySubscriber.id));
                    (0, vitest_1.expect)(writtenPrimaryCoverage).toEqual(primaryCoverage);
                    (0, vitest_1.expect)(writtenSecondaryCoverage).toEqual(secondaryCoverage);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update existing primary coverage to live on the new Account when the inputs match, but should create a new one for secondary if no match found', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedRP2, persistedCoverage1, persistedCoverage2, batchRequests, transactionRequests, writtenResources, writtenPrimaryCoverage, writtenSecondaryCoverage, writtenPrimarySubscriber, writtenSecondarySubscriber, qr, effect, createdAccount, primaryCoverageRef, secondaryCoverageRef, allCoverages, primaryCoverage, secondaryCoverage, extraCoverageJustHangingOutInFhir, secondary;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedRP2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedCoverage1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.primary, getQR1Refs(patientId));
                    persistedCoverage2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, getQR1Refs(patientId));
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: false },
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _o.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(4);
                    writtenPrimaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage1.subscriberId; });
                    writtenSecondaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage2.subscriberId; });
                    writtenPrimarySubscriber = writtenResources.find(function (res) { var _a; return "RelatedPerson/".concat(res.id) === ((_a = writtenPrimaryCoverage === null || writtenPrimaryCoverage === void 0 ? void 0 : writtenPrimaryCoverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference); });
                    writtenSecondarySubscriber = writtenResources.find(function (res) { var _a; return "RelatedPerson/".concat(res.id) === ((_a = writtenSecondaryCoverage === null || writtenSecondaryCoverage === void 0 ? void 0 : writtenSecondaryCoverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference); });
                    qr = fillWithQR1Refs(BASE_QR, patientId);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 2:
                    effect = _o.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Account',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 3:
                    createdAccount = (_o.sent()).unbundle()[0];
                    (0, vitest_1.expect)(createdAccount).toBeDefined();
                    (0, vitest_1.assert)(createdAccount.id);
                    primaryCoverageRef = (_c = (_b = (_a = createdAccount.coverage) === null || _a === void 0 ? void 0 : _a.find(function (cov) { return cov.priority === 1; })) === null || _b === void 0 ? void 0 : _b.coverage) === null || _c === void 0 ? void 0 : _c.reference;
                    secondaryCoverageRef = (_f = (_e = (_d = createdAccount.coverage) === null || _d === void 0 ? void 0 : _d.find(function (cov) { return cov.priority === 2; })) === null || _e === void 0 ? void 0 : _e.coverage) === null || _f === void 0 ? void 0 : _f.reference;
                    (0, vitest_1.expect)(primaryCoverageRef).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverageRef).toBeDefined();
                    (0, vitest_1.assert)(primaryCoverageRef);
                    (0, vitest_1.assert)(secondaryCoverageRef);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 4:
                    allCoverages = (_o.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(3);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    extraCoverageJustHangingOutInFhir = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef !== secondaryCoverageRef && coverageRef !== primaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_g = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _g === void 0 ? void 0 : _g.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_h = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _h === void 0 ? void 0 : _h.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)(extraCoverageJustHangingOutInFhir).toBeDefined();
                    (0, vitest_1.expect)(extraCoverageJustHangingOutInFhir === null || extraCoverageJustHangingOutInFhir === void 0 ? void 0 : extraCoverageJustHangingOutInFhir.status).toBe('active');
                    (0, vitest_1.expect)((_j = extraCoverageJustHangingOutInFhir === null || extraCoverageJustHangingOutInFhir === void 0 ? void 0 : extraCoverageJustHangingOutInFhir.subscriber) === null || _j === void 0 ? void 0 : _j.reference).toEqual("RelatedPerson/".concat(writtenSecondarySubscriber.id));
                    (0, vitest_1.expect)((_k = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _k === void 0 ? void 0 : _k.reference).toEqual("RelatedPerson/".concat(writtenPrimarySubscriber.id));
                    (0, vitest_1.expect)((_l = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _l === void 0 ? void 0 : _l.reference).toEqual('#coverageSubscriber');
                    (0, vitest_1.expect)(writtenPrimaryCoverage).toEqual(primaryCoverage);
                    secondary = expected_coverage_resources_qr1_1.expectedCoverageResources.secondary;
                    normalizedCompare(secondary, secondaryCoverage, patientId);
                    (0, vitest_1.expect)((0, harvest_1.relatedPersonsAreSame)(writtenSecondarySubscriber, (_m = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.contained) === null || _m === void 0 ? void 0 : _m[0])).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update existing secondary coverage to live on the new Account when the inputs match, but should create a new one for primary is no match found', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedRP2, persistedCoverage1, persistedCoverage2, batchRequests, transactionRequests, writtenResources, writtenPrimaryCoverage, writtenSecondaryCoverage, writtenPrimarySubscriber, writtenSecondarySubscriber, qr, effect, createdAccount, primaryCoverageRef, secondaryCoverageRef, allCoverages, primaryCoverage, secondaryCoverage, extraCoverageJustHangingOutInFhir, primary;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedRP2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedCoverage1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.primary, getQR1Refs(patientId));
                    persistedCoverage2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, getQR1Refs(patientId));
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: false },
                        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _o.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(4);
                    writtenPrimaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage1.subscriberId; });
                    writtenSecondaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage2.subscriberId; });
                    writtenPrimarySubscriber = writtenResources.find(function (res) { var _a; return "RelatedPerson/".concat(res.id) === ((_a = writtenPrimaryCoverage === null || writtenPrimaryCoverage === void 0 ? void 0 : writtenPrimaryCoverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference); });
                    writtenSecondarySubscriber = writtenResources.find(function (res) { var _a; return "RelatedPerson/".concat(res.id) === ((_a = writtenSecondaryCoverage === null || writtenSecondaryCoverage === void 0 ? void 0 : writtenSecondaryCoverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference); });
                    qr = fillWithQR1Refs(BASE_QR, patientId);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 2:
                    effect = _o.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Account',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 3:
                    createdAccount = (_o.sent()).unbundle()[0];
                    (0, vitest_1.expect)(createdAccount).toBeDefined();
                    (0, vitest_1.assert)(createdAccount.id);
                    primaryCoverageRef = (_c = (_b = (_a = createdAccount.coverage) === null || _a === void 0 ? void 0 : _a.find(function (cov) { return cov.priority === 1; })) === null || _b === void 0 ? void 0 : _b.coverage) === null || _c === void 0 ? void 0 : _c.reference;
                    secondaryCoverageRef = (_f = (_e = (_d = createdAccount.coverage) === null || _d === void 0 ? void 0 : _d.find(function (cov) { return cov.priority === 2; })) === null || _e === void 0 ? void 0 : _e.coverage) === null || _f === void 0 ? void 0 : _f.reference;
                    (0, vitest_1.expect)(primaryCoverageRef).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverageRef).toBeDefined();
                    (0, vitest_1.assert)(primaryCoverageRef);
                    (0, vitest_1.assert)(secondaryCoverageRef);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 4:
                    allCoverages = (_o.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(3);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    extraCoverageJustHangingOutInFhir = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef !== secondaryCoverageRef && coverageRef !== primaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(extraCoverageJustHangingOutInFhir).toBeDefined();
                    (0, vitest_1.expect)((_g = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _g === void 0 ? void 0 : _g.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_h = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _h === void 0 ? void 0 : _h.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)(extraCoverageJustHangingOutInFhir === null || extraCoverageJustHangingOutInFhir === void 0 ? void 0 : extraCoverageJustHangingOutInFhir.status).toBe('active');
                    (0, vitest_1.expect)((_j = extraCoverageJustHangingOutInFhir === null || extraCoverageJustHangingOutInFhir === void 0 ? void 0 : extraCoverageJustHangingOutInFhir.subscriber) === null || _j === void 0 ? void 0 : _j.reference).toEqual("RelatedPerson/".concat(writtenPrimarySubscriber.id));
                    (0, vitest_1.expect)((_k = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _k === void 0 ? void 0 : _k.reference).toEqual('#coverageSubscriber');
                    (0, vitest_1.expect)((_l = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _l === void 0 ? void 0 : _l.reference).toEqual("RelatedPerson/".concat(writtenSecondarySubscriber.id));
                    (0, vitest_1.expect)(writtenSecondaryCoverage).toEqual(secondaryCoverage);
                    primary = expected_coverage_resources_qr1_1.expectedCoverageResources.primary;
                    normalizedCompare(primary, primaryCoverage, patientId);
                    (0, vitest_1.expect)((0, harvest_1.relatedPersonsAreSame)(writtenPrimarySubscriber, (_m = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.contained) === null || _m === void 0 ? void 0 : _m[0])).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should create two new coverages when neither matches existing coverages', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedRP2, persistedCoverage1, persistedCoverage2, batchRequests, transactionRequests, writtenResources, qr, effect, createdAccount, primaryCoverageRef, secondaryCoverageRef, allCoverages, primaryCoverage, secondaryCoverage, primary, secondary;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedRP2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedCoverage1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.primary, getQR1Refs(patientId));
                    persistedCoverage2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, getQR1Refs(patientId));
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: false },
                        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: false },
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _l.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(4);
                    qr = fillWithQR1Refs(BASE_QR, patientId);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 2:
                    effect = _l.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Account',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 3:
                    createdAccount = (_l.sent()).unbundle()[0];
                    (0, vitest_1.expect)(createdAccount).toBeDefined();
                    (0, vitest_1.assert)(createdAccount.id);
                    primaryCoverageRef = (_c = (_b = (_a = createdAccount.coverage) === null || _a === void 0 ? void 0 : _a.find(function (cov) { return cov.priority === 1; })) === null || _b === void 0 ? void 0 : _b.coverage) === null || _c === void 0 ? void 0 : _c.reference;
                    secondaryCoverageRef = (_f = (_e = (_d = createdAccount.coverage) === null || _d === void 0 ? void 0 : _d.find(function (cov) { return cov.priority === 2; })) === null || _e === void 0 ? void 0 : _e.coverage) === null || _f === void 0 ? void 0 : _f.reference;
                    (0, vitest_1.expect)(primaryCoverageRef).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverageRef).toBeDefined();
                    (0, vitest_1.assert)(primaryCoverageRef);
                    (0, vitest_1.assert)(secondaryCoverageRef);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 4:
                    allCoverages = (_l.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(4);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_g = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _g === void 0 ? void 0 : _g.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_h = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _h === void 0 ? void 0 : _h.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_j = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _j === void 0 ? void 0 : _j.reference).toEqual('#coverageSubscriber');
                    (0, vitest_1.expect)((_k = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _k === void 0 ? void 0 : _k.reference).toEqual('#coverageSubscriber');
                    primary = expected_coverage_resources_qr1_1.expectedCoverageResources.primary, secondary = expected_coverage_resources_qr1_1.expectedCoverageResources.secondary;
                    normalizedCompare(primary, primaryCoverage, patientId);
                    normalizedCompare(secondary, secondaryCoverage, patientId);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('existing Account with no coverages should be updated with newly written coverages', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, batchRequests, transactionRequests, writtenResources, writtenAccount, qr, effect, foundAccounts, foundAccount, primaryCoverageRef, secondaryCoverageRef, allCoverages, primaryCoverage, secondaryCoverage, primary, secondary;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    patientId = getPatientId();
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({ account: fillWithQR1Refs(stubAccount, patientId) });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _m.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(1);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    qr = fillWithQR1Refs(BASE_QR, patientId);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 2:
                    effect = _m.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Account',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 3:
                    foundAccounts = (_m.sent()).unbundle();
                    (0, vitest_1.expect)(foundAccounts).toBeDefined();
                    (0, vitest_1.expect)(foundAccounts.length).toBe(1);
                    foundAccount = foundAccounts[0];
                    (0, vitest_1.expect)(foundAccount).toBeDefined();
                    (0, vitest_1.assert)(foundAccount.id);
                    (0, vitest_1.expect)(foundAccount.id).toEqual(writtenAccount.id);
                    (0, vitest_1.expect)(foundAccount.coverage).toBeDefined();
                    (0, vitest_1.expect)((_a = foundAccount.coverage) === null || _a === void 0 ? void 0 : _a.length).toBe(2);
                    primaryCoverageRef = (_d = (_c = (_b = foundAccount.coverage) === null || _b === void 0 ? void 0 : _b.find(function (cov) { return cov.priority === 1; })) === null || _c === void 0 ? void 0 : _c.coverage) === null || _d === void 0 ? void 0 : _d.reference;
                    secondaryCoverageRef = (_g = (_f = (_e = foundAccount.coverage) === null || _e === void 0 ? void 0 : _e.find(function (cov) { return cov.priority === 2; })) === null || _f === void 0 ? void 0 : _f.coverage) === null || _g === void 0 ? void 0 : _g.reference;
                    (0, vitest_1.expect)(primaryCoverageRef).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverageRef).toBeDefined();
                    (0, vitest_1.assert)(primaryCoverageRef);
                    (0, vitest_1.assert)(secondaryCoverageRef);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 4:
                    allCoverages = (_m.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(2);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_h = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _h === void 0 ? void 0 : _h.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_j = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _j === void 0 ? void 0 : _j.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_k = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _k === void 0 ? void 0 : _k.reference).toEqual('#coverageSubscriber');
                    (0, vitest_1.expect)((_l = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _l === void 0 ? void 0 : _l.reference).toEqual('#coverageSubscriber');
                    primary = expected_coverage_resources_qr1_1.expectedCoverageResources.primary, secondary = expected_coverage_resources_qr1_1.expectedCoverageResources.secondary;
                    normalizedCompare(primary, primaryCoverage, patientId);
                    normalizedCompare(secondary, secondaryCoverage, patientId);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update an existing Account to replace old coverage with unmatched member number, which should be updated to "cancelled', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, _a, primaryCoverageRef, secondaryCoverageRef, allCoverages, primaryCoverage, secondaryCoverage, primary, secondary, canceledCoverages, canceledCoverage, shouldHaveBeenCanceled;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.primary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _f.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(3);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            patientId: patientId,
                        })];
                case 2:
                    _a = _f.sent(), primaryCoverageRef = _a.primaryCoverageRef, secondaryCoverageRef = _a.secondaryCoverageRef;
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 3:
                    allCoverages = (_f.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(2);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_b = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _b === void 0 ? void 0 : _b.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_c = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _c === void 0 ? void 0 : _c.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_d = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _d === void 0 ? void 0 : _d.reference).toEqual('#coverageSubscriber');
                    (0, vitest_1.expect)((_e = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _e === void 0 ? void 0 : _e.reference).toEqual('#coverageSubscriber');
                    primary = expected_coverage_resources_qr1_1.expectedCoverageResources.primary, secondary = expected_coverage_resources_qr1_1.expectedCoverageResources.secondary;
                    normalizedCompare(primary, primaryCoverage, patientId);
                    normalizedCompare(secondary, secondaryCoverage, patientId);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'cancelled',
                                },
                            ],
                        })];
                case 4:
                    canceledCoverages = (_f.sent()).unbundle();
                    (0, vitest_1.expect)(canceledCoverages.length).toBe(1);
                    canceledCoverage = canceledCoverages[0];
                    (0, vitest_1.assert)(canceledCoverage);
                    shouldHaveBeenCanceled = writtenResources.find(function (res) { return res.resourceType === 'Coverage'; });
                    (0, vitest_1.expect)(canceledCoverage.id).toEqual(shouldHaveBeenCanceled.id);
                    (0, vitest_1.expect)(__assign(__assign({}, shouldHaveBeenCanceled), { status: 'cancelled', meta: undefined })).toEqual(__assign(__assign({}, canceledCoverage), { meta: undefined }));
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update an existing Account to update secondary Coverage with unmatched contained subscriber', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP2, persistedCoverage2, batchRequests, transactionRequests, writtenResources, writtenAccount, _a, primaryCoverageRef, secondaryCoverageRef, allCoverages, primaryCoverage, secondaryCoverage, primary, shouldHaveNewSubscriber, oldContained, newContained, canceledCoverages;
        var _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP2 = fillWithQR1Refs(__assign(__assign({}, expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1), { birthDate: '1990-01-01' }), patientId);
                    persistedCoverage2 = fillWithQR1Refs(__assign({}, expected_coverage_resources_qr1_1.expectedCoverageResources.secondary), patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        secondary: {
                            subscriber: persistedRP2,
                            coverage: persistedCoverage2,
                            ensureOrder: true,
                            containedSubscriber: true,
                        },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _h.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(2);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            patientId: patientId,
                        })];
                case 2:
                    _a = _h.sent(), primaryCoverageRef = _a.primaryCoverageRef, secondaryCoverageRef = _a.secondaryCoverageRef;
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    allCoverages = (_h.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(2);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_b = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _b === void 0 ? void 0 : _b.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_c = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _c === void 0 ? void 0 : _c.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_d = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _d === void 0 ? void 0 : _d.reference).toEqual('#coverageSubscriber');
                    (0, vitest_1.expect)((_e = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _e === void 0 ? void 0 : _e.reference).toEqual('#coverageSubscriber');
                    primary = expected_coverage_resources_qr1_1.expectedCoverageResources.primary;
                    normalizedCompare(primary, primaryCoverage, patientId);
                    shouldHaveNewSubscriber = writtenResources.find(function (res) { return res.resourceType === 'Coverage'; });
                    oldContained = (_f = shouldHaveNewSubscriber.contained) === null || _f === void 0 ? void 0 : _f[0];
                    newContained = (_g = secondaryCoverage.contained) === null || _g === void 0 ? void 0 : _g[0];
                    (0, vitest_1.expect)(shouldHaveNewSubscriber.id).toEqual(secondaryCoverage.id);
                    (0, vitest_1.expect)(newContained).toBeDefined();
                    (0, vitest_1.expect)(oldContained).toBeDefined();
                    (0, vitest_1.expect)(oldContained.birthDate).toEqual('1990-01-01');
                    (0, vitest_1.expect)(oldContained.name).toEqual(newContained.name);
                    (0, vitest_1.expect)(oldContained.patient).toEqual(newContained.patient);
                    (0, vitest_1.expect)(oldContained).not.toEqual(newContained);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'cancelled',
                                },
                            ],
                        })];
                case 4:
                    canceledCoverages = (_h.sent()).unbundle();
                    (0, vitest_1.expect)(canceledCoverages.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update an existing Account to update secondary Coverage with unmatched persisted subscriber, old subscriber should be unchanged', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP2, persistedCoverage2, batchRequests, transactionRequests, writtenResources, writtenAccount, _a, primaryCoverageRef, secondaryCoverageRef, allCoverages, primaryCoverage, secondaryCoverage, primary, shouldHaveNewSubscriber, newContained, oldSubscriber, canceledCoverages;
        var _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP2 = fillWithQR1Refs(__assign(__assign({}, expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1), { birthDate: '1990-01-01' }), patientId);
                    persistedCoverage2 = fillWithQR1Refs(__assign({}, expected_coverage_resources_qr1_1.expectedCoverageResources.secondary), patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _j.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(3);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            patientId: patientId,
                        })];
                case 2:
                    _a = _j.sent(), primaryCoverageRef = _a.primaryCoverageRef, secondaryCoverageRef = _a.secondaryCoverageRef;
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    allCoverages = (_j.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(2);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_b = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _b === void 0 ? void 0 : _b.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_c = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _c === void 0 ? void 0 : _c.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_d = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _d === void 0 ? void 0 : _d.reference).toEqual('#coverageSubscriber');
                    (0, vitest_1.expect)((_e = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _e === void 0 ? void 0 : _e.reference).toEqual('#coverageSubscriber');
                    primary = expected_coverage_resources_qr1_1.expectedCoverageResources.primary;
                    normalizedCompare(primary, primaryCoverage, patientId);
                    shouldHaveNewSubscriber = writtenResources.find(function (res) { return res.resourceType === 'Coverage'; });
                    newContained = (_f = secondaryCoverage.contained) === null || _f === void 0 ? void 0 : _f[0];
                    (0, vitest_1.expect)(shouldHaveNewSubscriber.id).toEqual(secondaryCoverage.id);
                    (0, vitest_1.expect)(shouldHaveNewSubscriber.subscriber).not.toEqual(secondaryCoverage.subscriber);
                    (0, vitest_1.expect)(newContained).toBeDefined();
                    return [4 /*yield*/, oystehrClient.fhir.get({
                            id: (_h = (_g = shouldHaveNewSubscriber.subscriber) === null || _g === void 0 ? void 0 : _g.reference.split('/')[1]) !== null && _h !== void 0 ? _h : '',
                            resourceType: 'RelatedPerson',
                        })];
                case 4:
                    oldSubscriber = _j.sent();
                    (0, vitest_1.expect)(oldSubscriber).toBeDefined();
                    (0, vitest_1.expect)(oldSubscriber.birthDate).toEqual('1990-01-01');
                    (0, vitest_1.expect)(oldSubscriber.name).toEqual(newContained.name);
                    (0, vitest_1.expect)(oldSubscriber.patient).toEqual(newContained.patient);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'cancelled',
                                },
                            ],
                        })];
                case 5:
                    canceledCoverages = (_j.sent()).unbundle();
                    (0, vitest_1.expect)(canceledCoverages.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update an existing Account to update Coverage with unmatched persisted subscriber, old subscriber should be unchanged', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, _a, primaryCoverageRef, secondaryCoverageRef, allCoverages, primaryCoverage, secondaryCoverage, secondary, shouldHaveNewSubscriber, newContained, oldSubscriber, canceledCoverages;
        var _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(__assign(__assign({}, expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1), { birthDate: '1990-01-01' }), patientId);
                    persistedCoverage1 = fillWithQR1Refs(__assign({}, expected_coverage_resources_qr1_1.expectedCoverageResources.primary), patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _j.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(3);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            patientId: patientId,
                        })];
                case 2:
                    _a = _j.sent(), primaryCoverageRef = _a.primaryCoverageRef, secondaryCoverageRef = _a.secondaryCoverageRef;
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    allCoverages = (_j.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(2);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_b = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _b === void 0 ? void 0 : _b.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_c = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _c === void 0 ? void 0 : _c.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_d = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _d === void 0 ? void 0 : _d.reference).toEqual('#coverageSubscriber');
                    (0, vitest_1.expect)((_e = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _e === void 0 ? void 0 : _e.reference).toEqual('#coverageSubscriber');
                    secondary = expected_coverage_resources_qr1_1.expectedCoverageResources.secondary;
                    normalizedCompare(secondary, secondaryCoverage, patientId);
                    shouldHaveNewSubscriber = writtenResources.find(function (res) { return res.resourceType === 'Coverage'; });
                    newContained = (_f = primaryCoverage.contained) === null || _f === void 0 ? void 0 : _f[0];
                    (0, vitest_1.expect)(shouldHaveNewSubscriber.id).toEqual(primaryCoverage.id);
                    (0, vitest_1.expect)(shouldHaveNewSubscriber.subscriber).not.toEqual(primaryCoverage.subscriber);
                    (0, vitest_1.expect)(newContained).toBeDefined();
                    return [4 /*yield*/, oystehrClient.fhir.get({
                            id: (_h = (_g = shouldHaveNewSubscriber.subscriber) === null || _g === void 0 ? void 0 : _g.reference.split('/')[1]) !== null && _h !== void 0 ? _h : '',
                            resourceType: 'RelatedPerson',
                        })];
                case 4:
                    oldSubscriber = _j.sent();
                    (0, vitest_1.expect)(oldSubscriber).toBeDefined();
                    (0, vitest_1.expect)(oldSubscriber.birthDate).toEqual('1990-01-01');
                    (0, vitest_1.expect)(oldSubscriber.name).toEqual(newContained.name);
                    (0, vitest_1.expect)(oldSubscriber.patient).toEqual(newContained.patient);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'cancelled',
                                },
                            ],
                        })];
                case 5:
                    canceledCoverages = (_j.sent()).unbundle();
                    (0, vitest_1.expect)(canceledCoverages.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update an existing Account to update Coverage with unmatched contained subscriber', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, _a, primaryCoverageRef, secondaryCoverageRef, allCoverages, primaryCoverage, secondaryCoverage, secondary, shouldHaveNewSubscriber, oldContained, newContained, canceledCoverages;
        var _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(__assign(__assign({}, expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1), { birthDate: '1990-01-01' }), patientId);
                    persistedCoverage1 = fillWithQR1Refs(__assign({}, expected_coverage_resources_qr1_1.expectedCoverageResources.primary), patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: {
                            subscriber: persistedRP1,
                            coverage: persistedCoverage1,
                            ensureOrder: true,
                            containedSubscriber: true,
                        },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _h.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(2);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            patientId: patientId,
                        })];
                case 2:
                    _a = _h.sent(), primaryCoverageRef = _a.primaryCoverageRef, secondaryCoverageRef = _a.secondaryCoverageRef;
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    allCoverages = (_h.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(2);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_b = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _b === void 0 ? void 0 : _b.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_c = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _c === void 0 ? void 0 : _c.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_d = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _d === void 0 ? void 0 : _d.reference).toEqual('#coverageSubscriber');
                    (0, vitest_1.expect)((_e = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _e === void 0 ? void 0 : _e.reference).toEqual('#coverageSubscriber');
                    secondary = expected_coverage_resources_qr1_1.expectedCoverageResources.secondary;
                    normalizedCompare(secondary, secondaryCoverage, patientId);
                    shouldHaveNewSubscriber = writtenResources.find(function (res) { return res.resourceType === 'Coverage'; });
                    oldContained = (_f = shouldHaveNewSubscriber.contained) === null || _f === void 0 ? void 0 : _f[0];
                    newContained = (_g = primaryCoverage.contained) === null || _g === void 0 ? void 0 : _g[0];
                    (0, vitest_1.expect)(shouldHaveNewSubscriber.id).toEqual(primaryCoverage.id);
                    (0, vitest_1.expect)(newContained).toBeDefined();
                    (0, vitest_1.expect)(oldContained).toBeDefined();
                    (0, vitest_1.expect)(oldContained.birthDate).toEqual('1990-01-01');
                    (0, vitest_1.expect)(oldContained.name).toEqual(newContained.name);
                    (0, vitest_1.expect)(oldContained.patient).toEqual(newContained.patient);
                    (0, vitest_1.expect)(oldContained).not.toEqual(newContained);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'cancelled',
                                },
                            ],
                        })];
                case 4:
                    canceledCoverages = (_h.sent()).unbundle();
                    (0, vitest_1.expect)(canceledCoverages.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update an existing Account to update secondary Coverage with unmatched contained subscriber', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP2, persistedCoverage2, batchRequests, transactionRequests, writtenResources, writtenAccount, _a, primaryCoverageRef, secondaryCoverageRef, allCoverages, primaryCoverage, secondaryCoverage, primary, shouldHaveNewSubscriber, oldContained, newContained, canceledCoverages;
        var _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP2 = fillWithQR1Refs(__assign(__assign({}, expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1), { birthDate: '1990-01-01' }), patientId);
                    persistedCoverage2 = fillWithQR1Refs(__assign({}, expected_coverage_resources_qr1_1.expectedCoverageResources.secondary), patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        secondary: {
                            subscriber: persistedRP2,
                            coverage: persistedCoverage2,
                            ensureOrder: true,
                            containedSubscriber: true,
                        },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _h.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(2);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            patientId: patientId,
                        })];
                case 2:
                    _a = _h.sent(), primaryCoverageRef = _a.primaryCoverageRef, secondaryCoverageRef = _a.secondaryCoverageRef;
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    allCoverages = (_h.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(2);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_b = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _b === void 0 ? void 0 : _b.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_c = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _c === void 0 ? void 0 : _c.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_d = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.subscriber) === null || _d === void 0 ? void 0 : _d.reference).toEqual('#coverageSubscriber');
                    (0, vitest_1.expect)((_e = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.subscriber) === null || _e === void 0 ? void 0 : _e.reference).toEqual('#coverageSubscriber');
                    primary = expected_coverage_resources_qr1_1.expectedCoverageResources.primary;
                    normalizedCompare(primary, primaryCoverage, patientId);
                    shouldHaveNewSubscriber = writtenResources.find(function (res) { return res.resourceType === 'Coverage'; });
                    oldContained = (_f = shouldHaveNewSubscriber.contained) === null || _f === void 0 ? void 0 : _f[0];
                    newContained = (_g = secondaryCoverage.contained) === null || _g === void 0 ? void 0 : _g[0];
                    (0, vitest_1.expect)(shouldHaveNewSubscriber.id).toEqual(secondaryCoverage.id);
                    (0, vitest_1.expect)(newContained).toBeDefined();
                    (0, vitest_1.expect)(oldContained).toBeDefined();
                    (0, vitest_1.expect)(oldContained.birthDate).toEqual('1990-01-01');
                    (0, vitest_1.expect)(oldContained.name).toEqual(newContained.name);
                    (0, vitest_1.expect)(oldContained.patient).toEqual(newContained.patient);
                    (0, vitest_1.expect)(oldContained).not.toEqual(newContained);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'cancelled',
                                },
                            ],
                        })];
                case 4:
                    canceledCoverages = (_h.sent()).unbundle();
                    (0, vitest_1.expect)(canceledCoverages.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should correctly create an Account where primary and secondary Coverages are swapped', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP2, persistedRP1, persistedCoverage2, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, writtenPrimaryCoverage, writtenSecondaryCoverage, _a, primaryCoverageRef, secondaryCoverageRef, account, allCoverages;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedRP1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedCoverage2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.primary, getQR1Refs(patientId));
                    persistedCoverage1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, getQR1Refs(patientId));
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _c.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(4);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    writtenPrimaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 1; });
                    writtenSecondaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 2; });
                    (0, vitest_1.expect)(writtenAccount).toBeUndefined();
                    (0, vitest_1.expect)(writtenPrimaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(writtenSecondaryCoverage).toBeDefined();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            patientId: patientId,
                        })];
                case 2:
                    _a = _c.sent(), primaryCoverageRef = _a.primaryCoverageRef, secondaryCoverageRef = _a.secondaryCoverageRef, account = _a.account;
                    (0, vitest_1.expect)((_b = account.coverage) === null || _b === void 0 ? void 0 : _b.length).toBe(2);
                    (0, vitest_1.expect)(primaryCoverageRef.startsWith('Coverage/')).toBe(true);
                    (0, vitest_1.expect)(secondaryCoverageRef.startsWith('Coverage/')).toBe(true);
                    (0, vitest_1.expect)(primaryCoverageRef).toEqual("Coverage/".concat(writtenSecondaryCoverage.id));
                    (0, vitest_1.expect)(secondaryCoverageRef).toEqual("Coverage/".concat(writtenPrimaryCoverage.id));
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    allCoverages = (_c.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(4);
                    (0, vitest_1.expect)(allCoverages.filter(function (cov) { return cov.resourceType === 'Coverage'; }).length).toBe(2);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should correctly update an Account where primary and secondary Coverages are swapped', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP2, persistedRP1, persistedCoverage2, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, writtenPrimaryCoverage, writtenSecondaryCoverage, _a, primaryCoverageRef, secondaryCoverageRef, account, allCoverages;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedRP1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
                    persistedCoverage2 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.primary, getQR1Refs(patientId));
                    persistedCoverage1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, getQR1Refs(patientId));
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _c.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(5);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    writtenPrimaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 1; });
                    writtenSecondaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 2; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenPrimaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(writtenSecondaryCoverage).toBeDefined();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            patientId: patientId,
                        })];
                case 2:
                    _a = _c.sent(), primaryCoverageRef = _a.primaryCoverageRef, secondaryCoverageRef = _a.secondaryCoverageRef, account = _a.account;
                    (0, vitest_1.expect)((_b = account.coverage) === null || _b === void 0 ? void 0 : _b.length).toBe(2);
                    (0, vitest_1.expect)(primaryCoverageRef.startsWith('Coverage/')).toBe(true);
                    (0, vitest_1.expect)(secondaryCoverageRef.startsWith('Coverage/')).toBe(true);
                    (0, vitest_1.expect)(primaryCoverageRef).toEqual("Coverage/".concat(writtenSecondaryCoverage.id));
                    (0, vitest_1.expect)(secondaryCoverageRef).toEqual("Coverage/".concat(writtenPrimaryCoverage.id));
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    allCoverages = (_c.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(4);
                    (0, vitest_1.expect)(allCoverages.filter(function (cov) { return cov.resourceType === 'Coverage'; }).length).toBe(2);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should correctly update an Account whose existing primary coverage becomes secondary and secondary is replaced with new Coverage', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, persistedRP2, persistedCoverage2, batchRequests, transactionRequests, writtenResources, writtenAccount, writtenPrimaryCoverage, writtenSecondaryCoverage, _a, primaryCoverageRef, secondaryCoverageRef, account, allCoverages, primaryCoverage, secondaryCoverage;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, getQR1Refs(patientId));
                    persistedRP2 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, patientId);
                    persistedCoverage2 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.primary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _e.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(5);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    writtenPrimaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 1; });
                    writtenSecondaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 2; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenPrimaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(writtenSecondaryCoverage).toBeDefined();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            patientId: patientId,
                        })];
                case 2:
                    _a = _e.sent(), primaryCoverageRef = _a.primaryCoverageRef, secondaryCoverageRef = _a.secondaryCoverageRef, account = _a.account;
                    (0, vitest_1.expect)(secondaryCoverageRef).toEqual("Coverage/".concat(writtenPrimaryCoverage.id));
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    allCoverages = (_e.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(3);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_b = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _b === void 0 ? void 0 : _b.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_c = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _c === void 0 ? void 0 : _c.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_d = account.coverage) === null || _d === void 0 ? void 0 : _d.find(function (cov) { var _a; return ((_a = cov.coverage) === null || _a === void 0 ? void 0 : _a.reference) === secondaryCoverageRef; })).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should correctly update an Account whose existing secondary coverage becomes primary and primary is replaced with new Coverage', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, persistedRP2, persistedCoverage2, batchRequests, transactionRequests, writtenResources, writtenAccount, writtenPrimaryCoverage, writtenSecondaryCoverage, _a, primaryCoverageRef, secondaryCoverageRef, account, allCoverages, primaryCoverage, secondaryCoverage;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, patientId);
                    persistedRP2 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, patientId);
                    persistedCoverage2 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedCoverageResources.primary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _e.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(5);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    writtenPrimaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 1; });
                    writtenSecondaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 2; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenPrimaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(writtenSecondaryCoverage).toBeDefined();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            patientId: patientId,
                        })];
                case 2:
                    _a = _e.sent(), primaryCoverageRef = _a.primaryCoverageRef, secondaryCoverageRef = _a.secondaryCoverageRef, account = _a.account;
                    (0, vitest_1.expect)(primaryCoverageRef).toEqual("Coverage/".concat(writtenSecondaryCoverage.id));
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    allCoverages = (_e.sent()).unbundle();
                    (0, vitest_1.expect)(allCoverages).toBeDefined();
                    (0, vitest_1.expect)(allCoverages.length).toBe(3);
                    primaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === primaryCoverageRef;
                    });
                    secondaryCoverage = allCoverages.find(function (coverage) {
                        var coverageRef = "Coverage/".concat(coverage.id);
                        return coverageRef === secondaryCoverageRef;
                    });
                    (0, vitest_1.expect)(primaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)((_b = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.beneficiary) === null || _b === void 0 ? void 0 : _b.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_c = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.beneficiary) === null || _c === void 0 ? void 0 : _c.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)((_d = account.coverage) === null || _d === void 0 ? void 0 : _d.find(function (cov) { var _a; return ((_a = cov.coverage) === null || _a === void 0 ? void 0 : _a.reference) === primaryCoverageRef; })).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should correctly update an Account with a new guarantor when there is no existing guarantor', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, account, containedGuarantor;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _b.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(3);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.guarantor).toBeUndefined();
                    (0, vitest_1.expect)(writtenAccount.contained).toBeUndefined();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            patientId: patientId,
                        })];
                case 2:
                    account = (_b.sent()).account;
                    containedGuarantor = (_a = account.contained) === null || _a === void 0 ? void 0 : _a.find(function (res) { return res.resourceType === 'RelatedPerson'; });
                    (0, vitest_1.expect)(containedGuarantor).toBeDefined();
                    (0, vitest_1.expect)(containedGuarantor).toEqual(fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedAccountGuarantorFromQR1, patientId));
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should make no changes to an existing contained guarantor when the input matches', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, account, containedGuarantor;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                        containedGuarantor: fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedAccountGuarantorFromQR1, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _d.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(3);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.guarantor).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.contained).toBeDefined();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            patientId: patientId,
                        })];
                case 2:
                    account = (_d.sent()).account;
                    containedGuarantor = (_a = account.contained) === null || _a === void 0 ? void 0 : _a.find(function (res) { return res.resourceType === 'RelatedPerson'; });
                    (0, vitest_1.expect)((_b = account.contained) === null || _b === void 0 ? void 0 : _b.length).toBe(1);
                    (0, vitest_1.expect)(containedGuarantor).toBeDefined();
                    (0, vitest_1.expect)(__assign({}, containedGuarantor)).toEqual(fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedAccountGuarantorFromQR1, patientId));
                    (0, vitest_1.expect)(containedGuarantor).toEqual((_c = writtenAccount.contained) === null || _c === void 0 ? void 0 : _c[0]);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should make no changes to an existing persisted guarantor when the input matches', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, _a, account, persistedGuarantor, containedGuarantor;
        var _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                        persistedGuarantor: fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedAccountGuarantorFromQR1, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _j.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(4);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.guarantor).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.contained).toBeUndefined();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            guarantorRef: (_d = (_c = (_b = writtenAccount.guarantor) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.party) === null || _d === void 0 ? void 0 : _d.reference,
                            patientId: patientId,
                        })];
                case 2:
                    _a = _j.sent(), account = _a.account, persistedGuarantor = _a.persistedGuarantor;
                    containedGuarantor = (_e = account.contained) === null || _e === void 0 ? void 0 : _e.find(function (res) { return res.resourceType === 'RelatedPerson'; });
                    (0, vitest_1.expect)(containedGuarantor).toBeUndefined();
                    (0, vitest_1.expect)(persistedGuarantor).toBeDefined();
                    (0, vitest_1.assert)(persistedGuarantor);
                    (0, vitest_1.expect)("".concat(persistedGuarantor.resourceType, "/").concat(persistedGuarantor.id)).toEqual((_h = (_g = (_f = account.guarantor) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.party) === null || _h === void 0 ? void 0 : _h.reference);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update the relationship on an existing persisted guarantor when all other input matches', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, newRelationship, guarantorToPersist, batchRequests, transactionRequests, writtenResources, writtenAccount, _a, account, persistedGuarantor, containedGuarantor;
        var _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, patientId);
                    newRelationship = [
                        {
                            coding: [
                                {
                                    system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                    code: 'spouse',
                                    display: 'Spouse',
                                },
                            ],
                        },
                    ];
                    guarantorToPersist = __assign(__assign({}, expected_coverage_resources_qr1_1.expectedAccountGuarantorFromQR1), { relationship: newRelationship });
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                        persistedGuarantor: fillWithQR1Refs(guarantorToPersist, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _j.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(4);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.guarantor).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.contained).toBeUndefined();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            patientId: patientId,
                            idToCheck: writtenAccount.id,
                            guarantorRef: (_d = (_c = (_b = writtenAccount.guarantor) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.party) === null || _d === void 0 ? void 0 : _d.reference,
                        })];
                case 2:
                    _a = _j.sent(), account = _a.account, persistedGuarantor = _a.persistedGuarantor;
                    containedGuarantor = (_e = account.contained) === null || _e === void 0 ? void 0 : _e.find(function (res) { return res.resourceType === 'RelatedPerson'; });
                    (0, vitest_1.expect)(containedGuarantor).toBeUndefined();
                    (0, vitest_1.expect)(persistedGuarantor).toBeDefined();
                    (0, vitest_1.assert)(persistedGuarantor);
                    (0, vitest_1.expect)("".concat(persistedGuarantor.resourceType, "/").concat(persistedGuarantor.id)).toEqual((_h = (_g = (_f = account.guarantor) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.party) === null || _h === void 0 ? void 0 : _h.reference);
                    (0, vitest_1.expect)(persistedGuarantor.resourceType).toEqual('RelatedPerson');
                    (0, vitest_1.expect)(persistedGuarantor.relationship).toEqual(newRelationship);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update guarantor from referenced Patient to contained RP when guarantor relationship != self', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, _a, account, persistedGuarantor, containedGuarantor;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        return __generator(this, function (_r) {
            switch (_r.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                        persistedGuarantorReference: fillWithQR1Refs("{{PATIENT_REF}}", patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _r.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(3);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.guarantor).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.contained).toBeUndefined();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            patientId: patientId,
                            idToCheck: writtenAccount.id,
                        })];
                case 2:
                    _a = _r.sent(), account = _a.account, persistedGuarantor = _a.persistedGuarantor;
                    containedGuarantor = (_b = account.contained) === null || _b === void 0 ? void 0 : _b.find(function (res) { return res.resourceType === 'RelatedPerson'; });
                    (0, vitest_1.expect)(containedGuarantor).toBeDefined();
                    (0, vitest_1.expect)(persistedGuarantor).toBeUndefined();
                    (0, vitest_1.assert)(containedGuarantor);
                    (0, vitest_1.expect)("#".concat(containedGuarantor.id)).toEqual((_e = (_d = (_c = account.guarantor) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.party) === null || _e === void 0 ? void 0 : _e.reference);
                    (0, vitest_1.expect)((_f = account.guarantor) === null || _f === void 0 ? void 0 : _f.length).toBe(2);
                    (0, vitest_1.expect)(fillWithQR1Refs("{{PATIENT_REF}}", patientId)).toEqual((_j = (_h = (_g = account.guarantor) === null || _g === void 0 ? void 0 : _g[1]) === null || _h === void 0 ? void 0 : _h.party) === null || _j === void 0 ? void 0 : _j.reference);
                    (0, vitest_1.expect)((_m = (_l = (_k = account.guarantor) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.period) === null || _m === void 0 ? void 0 : _m.end).toBeUndefined();
                    (0, vitest_1.expect)((_q = (_p = (_o = account.guarantor) === null || _o === void 0 ? void 0 : _o[1]) === null || _p === void 0 ? void 0 : _p.period) === null || _q === void 0 ? void 0 : _q.end).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should update guarantor from contained RP to referenced Patient when relationship = self', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, QR_WITH_PATIENT_GUARANTOR, _a, account, persistedGuarantor, containedGuarantor;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        return __generator(this, function (_s) {
            switch (_s.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                        containedGuarantor: fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedAccountGuarantorFromQR1, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _s.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(3);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.guarantor).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.contained).toBeDefined();
                    QR_WITH_PATIENT_GUARANTOR = __assign(__assign({}, BASE_QR), { item: (0, harvest_test_helpers_1.replaceGuarantorWithPatient)((_b = BASE_QR.item) !== null && _b !== void 0 ? _b : []) });
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            qr: QR_WITH_PATIENT_GUARANTOR,
                            guarantorRef: fillWithQR1Refs("{{PATIENT_REF}}", patientId),
                            patientId: patientId,
                        })];
                case 2:
                    _a = _s.sent(), account = _a.account, persistedGuarantor = _a.persistedGuarantor;
                    containedGuarantor = (_c = account.contained) === null || _c === void 0 ? void 0 : _c.find(function (res) { return res.resourceType === 'RelatedPerson'; });
                    (0, vitest_1.expect)(persistedGuarantor).toBeDefined();
                    (0, vitest_1.assert)(containedGuarantor);
                    (0, vitest_1.expect)("#".concat(containedGuarantor.id)).toEqual((_f = (_e = (_d = account.guarantor) === null || _d === void 0 ? void 0 : _d[1]) === null || _e === void 0 ? void 0 : _e.party) === null || _f === void 0 ? void 0 : _f.reference);
                    (0, vitest_1.expect)((_g = account.guarantor) === null || _g === void 0 ? void 0 : _g.length).toBe(2);
                    (0, vitest_1.expect)(fillWithQR1Refs("{{PATIENT_REF}}", patientId)).toEqual((_k = (_j = (_h = account.guarantor) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.party) === null || _k === void 0 ? void 0 : _k.reference);
                    (0, vitest_1.expect)((_o = (_m = (_l = account.guarantor) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.period) === null || _o === void 0 ? void 0 : _o.end).toBeUndefined();
                    (0, vitest_1.expect)((_r = (_q = (_p = account.guarantor) === null || _p === void 0 ? void 0 : _p[1]) === null || _q === void 0 ? void 0 : _q.period) === null || _r === void 0 ? void 0 : _r.end).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update guarantor from referenced RP to Patient when relationship = self', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, qr, _a, account, persistedGuarantor, containedGuarantor;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        return __generator(this, function (_r) {
            switch (_r.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                        persistedGuarantor: fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedAccountGuarantorFromQR1, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _r.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(4);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.guarantor).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.contained).toBeUndefined();
                    qr = QR_WITH_PATIENT_GUARANTOR();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            qr: qr,
                            guarantorRef: fillWithQR1Refs("{{PATIENT_REF}}", patientId),
                            patientId: patientId,
                        })];
                case 2:
                    _a = _r.sent(), account = _a.account, persistedGuarantor = _a.persistedGuarantor;
                    containedGuarantor = (_b = account.contained) === null || _b === void 0 ? void 0 : _b.find(function (res) { return res.resourceType === 'RelatedPerson'; });
                    (0, vitest_1.expect)(containedGuarantor).toBeUndefined();
                    (0, vitest_1.expect)(persistedGuarantor).toBeDefined();
                    (0, vitest_1.expect)((_c = account.guarantor) === null || _c === void 0 ? void 0 : _c.length).toBe(2);
                    (0, vitest_1.expect)(fillWithQR1Refs("{{PATIENT_REF}}", patientId)).toEqual((_f = (_e = (_d = account.guarantor) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.party) === null || _f === void 0 ? void 0 : _f.reference);
                    (0, vitest_1.expect)((_j = (_h = (_g = account.guarantor) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.period) === null || _j === void 0 ? void 0 : _j.end).toBeUndefined();
                    (0, vitest_1.expect)((_m = (_l = (_k = account.guarantor) === null || _k === void 0 ? void 0 : _k[1]) === null || _l === void 0 ? void 0 : _l.period) === null || _m === void 0 ? void 0 : _m.end).toBeDefined();
                    (0, vitest_1.expect)((_q = (_p = (_o = account.guarantor) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.party) === null || _q === void 0 ? void 0 : _q.reference).toEqual((persistedGuarantor === null || persistedGuarantor === void 0 ? void 0 : persistedGuarantor.resourceType) + '/' + (persistedGuarantor === null || persistedGuarantor === void 0 ? void 0 : persistedGuarantor.id));
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should handle successive guarantor updates resulting in multiple contained RP resources', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, persistedRP1, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, qr, _a, account, persistedGuarantor, containedGuarantor, account2, uniqueContained, _b, account3, persistedGuarantor2, containedGuarantor2;
        var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15;
        return __generator(this, function (_16) {
            switch (_16.label) {
                case 0:
                    patientId = getPatientId();
                    persistedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.primary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
                        account: fillWithQR1Refs(stubAccount, patientId),
                        containedGuarantor: fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedAccountGuarantorFromQR1, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _16.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(3);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.guarantor).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.contained).toBeDefined();
                    qr = QR_WITH_PATIENT_GUARANTOR();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            patientId: patientId,
                            idToCheck: writtenAccount.id,
                            qr: qr,
                            guarantorRef: fillWithQR1Refs("{{PATIENT_REF}}", patientId),
                        })];
                case 2:
                    _a = _16.sent(), account = _a.account, persistedGuarantor = _a.persistedGuarantor;
                    containedGuarantor = (_c = account.contained) === null || _c === void 0 ? void 0 : _c.find(function (res) { return res.resourceType === 'RelatedPerson'; });
                    (0, vitest_1.expect)(containedGuarantor).toBeDefined();
                    (0, vitest_1.expect)(persistedGuarantor).toBeDefined();
                    (0, vitest_1.expect)((_d = account.guarantor) === null || _d === void 0 ? void 0 : _d.length).toBe(2);
                    (0, vitest_1.expect)(fillWithQR1Refs("{{PATIENT_REF}}", patientId)).toEqual((_g = (_f = (_e = account.guarantor) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.party) === null || _g === void 0 ? void 0 : _g.reference);
                    (0, vitest_1.expect)((_k = (_j = (_h = account.guarantor) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.period) === null || _k === void 0 ? void 0 : _k.end).toBeUndefined();
                    (0, vitest_1.expect)((_o = (_m = (_l = account.guarantor) === null || _l === void 0 ? void 0 : _l[1]) === null || _m === void 0 ? void 0 : _m.period) === null || _o === void 0 ? void 0 : _o.end).toBeDefined();
                    (0, vitest_1.expect)((_r = (_q = (_p = account.guarantor) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.party) === null || _r === void 0 ? void 0 : _r.reference).toEqual((persistedGuarantor === null || persistedGuarantor === void 0 ? void 0 : persistedGuarantor.resourceType) + '/' + (persistedGuarantor === null || persistedGuarantor === void 0 ? void 0 : persistedGuarantor.id));
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            qr: QR_WITH_ALT_GUARANTOR(),
                            patientId: patientId,
                        })];
                case 3:
                    account2 = (_16.sent()).account;
                    (0, vitest_1.expect)((_s = account2.contained) === null || _s === void 0 ? void 0 : _s.length).toBe(2);
                    (0, vitest_1.expect)((_t = account2.guarantor) === null || _t === void 0 ? void 0 : _t.length).toBe(3);
                    (0, vitest_1.expect)((_w = (_v = (_u = account2.guarantor) === null || _u === void 0 ? void 0 : _u[0]) === null || _v === void 0 ? void 0 : _v.party) === null || _w === void 0 ? void 0 : _w.reference).toEqual("#".concat((_y = (_x = account2.contained) === null || _x === void 0 ? void 0 : _x[0]) === null || _y === void 0 ? void 0 : _y.id));
                    (0, vitest_1.expect)(((_z = account2.guarantor) !== null && _z !== void 0 ? _z : []).filter(function (gRef) { var _a; return ((_a = gRef.period) === null || _a === void 0 ? void 0 : _a.end) !== undefined; }).length).toBe(2);
                    uniqueContained = new Set((_0 = account2.contained) === null || _0 === void 0 ? void 0 : _0.map(function (res) { return res.id; }));
                    (0, vitest_1.expect)(uniqueContained.size).toBe(2);
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            qr: qr, // this is the patient guarantor qr again
                            guarantorRef: fillWithQR1Refs("{{PATIENT_REF}}", patientId),
                            patientId: patientId,
                        })];
                case 4:
                    _b = _16.sent(), account3 = _b.account, persistedGuarantor2 = _b.persistedGuarantor;
                    containedGuarantor2 = (_1 = account3.contained) === null || _1 === void 0 ? void 0 : _1.find(function (res) { return res.resourceType === 'RelatedPerson'; });
                    (0, vitest_1.expect)(containedGuarantor2).toBeDefined();
                    (0, vitest_1.expect)(persistedGuarantor2).toBeDefined();
                    (0, vitest_1.expect)((_2 = account3.guarantor) === null || _2 === void 0 ? void 0 : _2.length).toBe(4);
                    (0, vitest_1.expect)(fillWithQR1Refs("{{PATIENT_REF}}", patientId)).toEqual((_5 = (_4 = (_3 = account3.guarantor) === null || _3 === void 0 ? void 0 : _3[0]) === null || _4 === void 0 ? void 0 : _4.party) === null || _5 === void 0 ? void 0 : _5.reference);
                    (0, vitest_1.expect)((_8 = (_7 = (_6 = account.guarantor) === null || _6 === void 0 ? void 0 : _6[0]) === null || _7 === void 0 ? void 0 : _7.period) === null || _8 === void 0 ? void 0 : _8.end).toBeUndefined();
                    (0, vitest_1.expect)((_11 = (_10 = (_9 = account.guarantor) === null || _9 === void 0 ? void 0 : _9[1]) === null || _10 === void 0 ? void 0 : _10.period) === null || _11 === void 0 ? void 0 : _11.end).toBeDefined();
                    (0, vitest_1.expect)((_14 = (_13 = (_12 = account.guarantor) === null || _12 === void 0 ? void 0 : _12[0]) === null || _13 === void 0 ? void 0 : _13.party) === null || _14 === void 0 ? void 0 : _14.reference).toEqual((persistedGuarantor === null || persistedGuarantor === void 0 ? void 0 : persistedGuarantor.resourceType) + '/' + (persistedGuarantor === null || persistedGuarantor === void 0 ? void 0 : persistedGuarantor.id));
                    (0, vitest_1.expect)((_15 = account3.contained) === null || _15 === void 0 ? void 0 : _15.length).toBe(2);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update contained primary subscriber to persisted Patient when relationship = self', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, containedRP1, persistedCoverage1, batchRequests, transactionRequests, writtenResources, writtenAccount, writtenPrimaryCoverage, qr, relationshipValue, primaryCoverageRef, _a, _, coverageId, persistedCoverageAndSubscriber, persistedCoverage, persistedSubscriber;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        return __generator(this, function (_p) {
            switch (_p.label) {
                case 0:
                    patientId = getPatientId();
                    containedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: {
                            subscriber: containedRP1,
                            coverage: persistedCoverage1,
                            ensureOrder: true,
                            containedSubscriber: true,
                        },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _p.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(2);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.coverage).toBeDefined();
                    writtenPrimaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 1; });
                    (0, vitest_1.expect)(writtenPrimaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(writtenPrimaryCoverage.subscriber).toBeDefined();
                    (0, vitest_1.expect)(writtenPrimaryCoverage.contained).toBeDefined();
                    (0, vitest_1.expect)((_b = writtenPrimaryCoverage.contained) === null || _b === void 0 ? void 0 : _b[0]).toEqual(containedRP1);
                    (0, vitest_1.expect)((_c = writtenPrimaryCoverage.subscriber) === null || _c === void 0 ? void 0 : _c.reference).toEqual("#".concat((_e = (_d = writtenPrimaryCoverage.contained) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.id));
                    qr = QR_WITH_PATIENT_PRIMARY_SUBSCRIBER();
                    relationshipValue = (_l = (_k = (_j = (_h = (_g = (_f = qr.item) === null || _f === void 0 ? void 0 : _f.find(function (item) { return item.linkId === 'payment-option-page'; })) === null || _g === void 0 ? void 0 : _g.item) === null || _h === void 0 ? void 0 : _h.find(function (item) { return item.linkId === 'patient-relationship-to-insured'; })) === null || _j === void 0 ? void 0 : _j.answer) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.valueString;
                    (0, vitest_1.expect)(relationshipValue).toBeDefined();
                    (0, vitest_1.expect)(relationshipValue).toBe('Self');
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            qr: qr,
                            patientId: patientId,
                        })];
                case 2:
                    primaryCoverageRef = (_p.sent()).primaryCoverageRef;
                    (0, vitest_1.expect)(primaryCoverageRef).toBeDefined();
                    _a = primaryCoverageRef.split('/'), _ = _a[0], coverageId = _a[1];
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: '_id',
                                    value: coverageId,
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    persistedCoverageAndSubscriber = (_p.sent()).unbundle();
                    persistedCoverage = persistedCoverageAndSubscriber.find(function (res) { return res.resourceType === 'Coverage'; });
                    persistedSubscriber = persistedCoverageAndSubscriber.find(function (res) { var _a; return "".concat(res.resourceType, "/").concat(res.id) === ((_a = persistedCoverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference); });
                    (0, vitest_1.expect)(persistedCoverage).toBeDefined();
                    (0, vitest_1.expect)(persistedCoverage.contained).toBeUndefined();
                    (0, vitest_1.expect)((_m = persistedCoverage.subscriber) === null || _m === void 0 ? void 0 : _m.reference).toEqual(fillWithQR1Refs("{{PATIENT_REF}}", patientId));
                    (0, vitest_1.expect)(persistedSubscriber).toBeDefined();
                    (0, vitest_1.expect)("Patient/".concat(persistedSubscriber.id)).toEqual((_o = persistedCoverage.subscriber) === null || _o === void 0 ? void 0 : _o.reference);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update contained secondary subscriber to persisted Patient when relationship = self', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, containedRP2, persistedCoverage2, batchRequests, transactionRequests, writtenResources, writtenAccount, writtenSecondaryCoverage, qr, relationshipValue, secondaryCoverageRef, _a, _, coverageId, persistedCoverageAndSubscriber, persistedCoverage, persistedSubscriber;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        return __generator(this, function (_r) {
            switch (_r.label) {
                case 0:
                    patientId = getPatientId();
                    containedRP2 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage2 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        secondary: {
                            subscriber: containedRP2,
                            coverage: persistedCoverage2,
                            ensureOrder: true,
                            containedSubscriber: true,
                        },
                        account: fillWithQR1Refs(stubAccount, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _r.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(2);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.coverage).toBeDefined();
                    writtenSecondaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 2; });
                    (0, vitest_1.expect)(writtenSecondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(writtenSecondaryCoverage.subscriber).toBeDefined();
                    (0, vitest_1.expect)(writtenSecondaryCoverage.contained).toBeDefined();
                    (0, vitest_1.expect)((_b = writtenSecondaryCoverage.contained) === null || _b === void 0 ? void 0 : _b[0]).toEqual(containedRP2);
                    (0, vitest_1.expect)((_c = writtenSecondaryCoverage.subscriber) === null || _c === void 0 ? void 0 : _c.reference).toEqual("#".concat((_e = (_d = writtenSecondaryCoverage.contained) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.id));
                    qr = QR_WITH_PATIENT_SECONDARY_SUBSCRIBER();
                    relationshipValue = (_o = (_m = (_l = (_k = (_j = (_h = (_g = (_f = qr.item) === null || _f === void 0 ? void 0 : _f.find(function (item) { return item.linkId === 'payment-option-page'; })) === null || _g === void 0 ? void 0 : _g.item) === null || _h === void 0 ? void 0 : _h.find(function (item) { return item.linkId === 'secondary-insurance'; })) === null || _j === void 0 ? void 0 : _j.item) === null || _k === void 0 ? void 0 : _k.find(function (item) { return item.linkId === 'patient-relationship-to-insured-2'; })) === null || _l === void 0 ? void 0 : _l.answer) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.valueString;
                    (0, vitest_1.expect)(relationshipValue).toBeDefined();
                    (0, vitest_1.expect)(relationshipValue).toBe('Self');
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            qr: qr,
                            patientId: patientId,
                        })];
                case 2:
                    secondaryCoverageRef = (_r.sent()).secondaryCoverageRef;
                    (0, vitest_1.expect)(secondaryCoverageRef).toBeDefined();
                    _a = secondaryCoverageRef.split('/'), _ = _a[0], coverageId = _a[1];
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: '_id',
                                    value: coverageId,
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    persistedCoverageAndSubscriber = (_r.sent()).unbundle();
                    persistedCoverage = persistedCoverageAndSubscriber.find(function (res) { return res.resourceType === 'Coverage'; });
                    persistedSubscriber = persistedCoverageAndSubscriber.find(function (res) { var _a; return "".concat(res.resourceType, "/").concat(res.id) === ((_a = persistedCoverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference); });
                    (0, vitest_1.expect)(persistedCoverage).toBeDefined();
                    (0, vitest_1.expect)(persistedCoverage.contained).toBeUndefined();
                    (0, vitest_1.expect)((_p = persistedCoverage.subscriber) === null || _p === void 0 ? void 0 : _p.reference).toEqual(fillWithQR1Refs("{{PATIENT_REF}}", patientId));
                    (0, vitest_1.expect)(persistedSubscriber).toBeDefined();
                    (0, vitest_1.expect)("Patient/".concat(persistedSubscriber.id)).toEqual((_q = persistedCoverage.subscriber) === null || _q === void 0 ? void 0 : _q.reference);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should update contained primary and secondary subscribers as well as Account guarantor to persisted Patient when relationship = self', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, containedRP1, containedRP2, persistedCoverage1, persistedCoverage2, batchRequests, transactionRequests, writtenResources, writtenAccount, writtenPrimaryCoverage, writtenSecondaryCoverage, qr, _a, account, secondaryCoverageRef, primaryCoverageRef, persistedGuarantor, _b, primaryCoverageId, _c, secondaryCoverageId, persistedPrimaryCoverageAndSubscriber, persistedPrimaryCoverage, persistedPrimarySubscriber, persistedSecondaryCoverageAndSubscriber, persistedSecondaryCoverage, persistedSecondarySubscriber, containedGuarantor;
        var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4;
        return __generator(this, function (_5) {
            switch (_5.label) {
                case 0:
                    patientId = getPatientId();
                    containedRP1 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, patientId);
                    containedRP2 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, patientId);
                    persistedCoverage1 = changeCoverageMemberId(expected_coverage_resources_qr1_1.expectedCoverageResources.primary, patientId);
                    persistedCoverage2 = fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedCoverageResources.secondary, patientId);
                    batchRequests = (0, harvest_test_helpers_1.batchTestInsuranceWrites)({
                        primary: {
                            subscriber: containedRP1,
                            coverage: persistedCoverage1,
                            ensureOrder: true,
                            containedSubscriber: true,
                        },
                        secondary: {
                            subscriber: containedRP2,
                            coverage: persistedCoverage2,
                            ensureOrder: true,
                            containedSubscriber: true,
                        },
                        account: fillWithQR1Refs(stubAccount, patientId),
                        containedGuarantor: fillWithQR1Refs(expected_coverage_resources_qr1_1.expectedAccountGuarantorFromQR1, patientId),
                    });
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: batchRequests })];
                case 1:
                    transactionRequests = _5.sent();
                    (0, vitest_1.expect)(transactionRequests).toBeDefined();
                    writtenResources = (0, utils_1.unbundleBatchPostOutput)(transactionRequests);
                    (0, vitest_1.expect)(writtenResources.length).toBe(3);
                    writtenAccount = writtenResources.find(function (res) { return res.resourceType === 'Account'; });
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.coverage).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.guarantor).toBeDefined();
                    (0, vitest_1.expect)(writtenAccount.contained).toBeDefined();
                    writtenPrimaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 1; });
                    (0, vitest_1.expect)(writtenPrimaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(writtenPrimaryCoverage.subscriber).toBeDefined();
                    (0, vitest_1.expect)(writtenPrimaryCoverage.contained).toBeDefined();
                    (0, vitest_1.expect)((_d = writtenPrimaryCoverage.contained) === null || _d === void 0 ? void 0 : _d[0]).toEqual(containedRP1);
                    (0, vitest_1.expect)((_e = writtenPrimaryCoverage.subscriber) === null || _e === void 0 ? void 0 : _e.reference).toEqual("#".concat((_g = (_f = writtenPrimaryCoverage.contained) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.id));
                    writtenSecondaryCoverage = writtenResources.find(function (res) { return res.resourceType === 'Coverage' && res.order === 2; });
                    (0, vitest_1.expect)(writtenSecondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(writtenSecondaryCoverage.subscriber).toBeDefined();
                    (0, vitest_1.expect)(writtenSecondaryCoverage.contained).toBeDefined();
                    (0, vitest_1.expect)((_h = writtenSecondaryCoverage.contained) === null || _h === void 0 ? void 0 : _h[0]).toEqual(containedRP2);
                    (0, vitest_1.expect)((_j = writtenSecondaryCoverage.subscriber) === null || _j === void 0 ? void 0 : _j.reference).toEqual("#".concat((_l = (_k = writtenSecondaryCoverage.contained) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.id));
                    qr = QR_WITH_PATIENT_FOR_ALL_SUBSCRIBERS_AND_GUARANTOR();
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: writtenAccount.id,
                            qr: qr,
                            guarantorRef: fillWithQR1Refs("{{PATIENT_REF}}", patientId),
                            patientId: patientId,
                        })];
                case 2:
                    _a = _5.sent(), account = _a.account, secondaryCoverageRef = _a.secondaryCoverageRef, primaryCoverageRef = _a.primaryCoverageRef, persistedGuarantor = _a.persistedGuarantor;
                    (0, vitest_1.expect)(primaryCoverageRef).toBeDefined();
                    (0, vitest_1.expect)(secondaryCoverageRef).toBeDefined();
                    _b = primaryCoverageRef.split('/'), primaryCoverageId = _b[1];
                    _c = secondaryCoverageRef.split('/'), secondaryCoverageId = _c[1];
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: '_id',
                                    value: primaryCoverageId,
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 3:
                    persistedPrimaryCoverageAndSubscriber = (_5.sent()).unbundle();
                    persistedPrimaryCoverage = persistedPrimaryCoverageAndSubscriber.find(function (res) { return res.resourceType === 'Coverage'; });
                    persistedPrimarySubscriber = persistedPrimaryCoverageAndSubscriber.find(function (res) { var _a; return "".concat(res.resourceType, "/").concat(res.id) === ((_a = persistedPrimaryCoverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference); });
                    (0, vitest_1.expect)(persistedPrimaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(persistedPrimaryCoverage.contained).toBeUndefined();
                    (0, vitest_1.expect)((_m = persistedPrimaryCoverage.subscriber) === null || _m === void 0 ? void 0 : _m.reference).toEqual(fillWithQR1Refs("{{PATIENT_REF}}", patientId));
                    (0, vitest_1.expect)(persistedPrimarySubscriber).toBeDefined();
                    (0, vitest_1.expect)("Patient/".concat(persistedPrimarySubscriber.id)).toEqual((_o = persistedPrimaryCoverage.subscriber) === null || _o === void 0 ? void 0 : _o.reference);
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: '_id',
                                    value: secondaryCoverageId,
                                },
                                {
                                    name: '_include',
                                    value: 'Coverage:subscriber',
                                },
                            ],
                        })];
                case 4:
                    persistedSecondaryCoverageAndSubscriber = (_5.sent()).unbundle();
                    persistedSecondaryCoverage = persistedSecondaryCoverageAndSubscriber.find(function (res) { return res.resourceType === 'Coverage'; });
                    persistedSecondarySubscriber = persistedSecondaryCoverageAndSubscriber.find(function (res) { var _a; return "".concat(res.resourceType, "/").concat(res.id) === ((_a = persistedSecondaryCoverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference); });
                    (0, vitest_1.expect)(persistedSecondaryCoverage).toBeDefined();
                    (0, vitest_1.expect)(persistedSecondaryCoverage.contained).toBeUndefined();
                    (0, vitest_1.expect)((_p = persistedSecondaryCoverage.subscriber) === null || _p === void 0 ? void 0 : _p.reference).toEqual(fillWithQR1Refs("{{PATIENT_REF}}", patientId));
                    (0, vitest_1.expect)(persistedSecondarySubscriber).toBeDefined();
                    (0, vitest_1.expect)("Patient/".concat(persistedSecondarySubscriber.id)).toEqual((_q = persistedSecondaryCoverage.subscriber) === null || _q === void 0 ? void 0 : _q.reference);
                    containedGuarantor = (_r = account.contained) === null || _r === void 0 ? void 0 : _r.find(function (res) { return res.resourceType === 'RelatedPerson'; });
                    (0, vitest_1.expect)(persistedGuarantor).toBeDefined();
                    (0, vitest_1.assert)(containedGuarantor);
                    (0, vitest_1.expect)("#".concat(containedGuarantor.id)).toEqual((_u = (_t = (_s = account.guarantor) === null || _s === void 0 ? void 0 : _s[1]) === null || _t === void 0 ? void 0 : _t.party) === null || _u === void 0 ? void 0 : _u.reference);
                    (0, vitest_1.expect)((_v = account.guarantor) === null || _v === void 0 ? void 0 : _v.length).toBe(2);
                    (0, vitest_1.expect)(fillWithQR1Refs("{{PATIENT_REF}}", patientId)).toEqual((_y = (_x = (_w = account.guarantor) === null || _w === void 0 ? void 0 : _w[0]) === null || _x === void 0 ? void 0 : _x.party) === null || _y === void 0 ? void 0 : _y.reference);
                    (0, vitest_1.expect)((_1 = (_0 = (_z = account.guarantor) === null || _z === void 0 ? void 0 : _z[0]) === null || _0 === void 0 ? void 0 : _0.period) === null || _1 === void 0 ? void 0 : _1.end).toBeUndefined();
                    (0, vitest_1.expect)((_4 = (_3 = (_2 = account.guarantor) === null || _2 === void 0 ? void 0 : _2[1]) === null || _3 === void 0 ? void 0 : _3.period) === null || _4 === void 0 ? void 0 : _4.end).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should create an Account with Patient guarantor when responsible party relationship = self', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patient, patientId, freshAccount, relatedPerson, dummyAppt, dummyEncounter, _a, account, persistedGuarantor, batchDeletes, response;
        var _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0: return [4 /*yield*/, oystehrClient.fhir.create({
                        resourceType: 'Patient',
                        name: [
                            {
                                // cSpell:disable-next I don't know half of you half as well as I should like; and I like less than half of you half as well as you deserve.
                                given: ['Bibi'],
                                family: 'Baggins',
                            },
                        ],
                        birthDate: '2025-03-27',
                        gender: 'female',
                        active: true,
                    })];
                case 1:
                    patient = _g.sent();
                    patientId = patient.id;
                    (0, vitest_1.expect)(patientId).toBeDefined();
                    (0, vitest_1.assert)(patientId);
                    return [4 /*yield*/, oystehrClient.fhir.create({
                            resourceType: 'Account',
                            status: 'active',
                            type: {
                                coding: [
                                    {
                                        system: 'http://terminology.hl7.org/CodeSystem/account-type',
                                        code: 'PBILLACCT',
                                        display: 'patient billing account',
                                    },
                                ],
                            },
                            subject: [
                                {
                                    reference: "Patient/".concat(patientId),
                                },
                            ],
                        })];
                case 2:
                    freshAccount = _g.sent();
                    return [4 /*yield*/, oystehrClient.fhir.create({
                            resourceType: 'RelatedPerson',
                            patient: {
                                reference: "Patient/".concat(patientId),
                            },
                            relationship: [
                                {
                                    coding: [
                                        {
                                            code: 'user-relatedperson',
                                            system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
                                        },
                                    ],
                                },
                            ],
                        })];
                case 3:
                    relatedPerson = _g.sent();
                    (0, vitest_1.expect)(relatedPerson).toBeDefined();
                    return [4 /*yield*/, oystehrClient.fhir.create({
                            resourceType: 'Appointment',
                            status: 'booked',
                            meta: {
                                tag: [{ code: utils_1.OTTEHR_MODULE.IP }],
                            },
                            participant: [
                                {
                                    actor: {
                                        reference: "Patient/".concat(patientId),
                                    },
                                    status: 'accepted',
                                },
                            ],
                            start: '2025-03-27T10:00:00Z',
                            end: '2025-03-27T10:15:00Z',
                        })];
                case 4:
                    dummyAppt = _g.sent();
                    return [4 /*yield*/, oystehrClient.fhir.create({
                            resourceType: 'Encounter',
                            status: 'planned',
                            subject: {
                                reference: "Patient/".concat(patientId),
                            },
                            appointment: [
                                {
                                    reference: "Appointment/".concat(dummyAppt.id),
                                },
                            ],
                            class: {
                                system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                                code: 'VR',
                                display: 'virtual',
                            },
                        })];
                case 5:
                    dummyEncounter = _g.sent();
                    (0, vitest_1.expect)(dummyAppt).toBeDefined();
                    (0, vitest_1.expect)(dummyAppt.id).toBeDefined();
                    (0, vitest_1.assert)(dummyAppt.id);
                    (0, vitest_1.expect)(dummyEncounter).toBeDefined();
                    (0, vitest_1.expect)(dummyEncounter.id).toBeDefined();
                    (0, vitest_1.assert)(dummyEncounter.id);
                    (0, vitest_1.expect)(freshAccount).toBeDefined();
                    (0, vitest_1.expect)(freshAccount.id).toBeDefined();
                    (0, vitest_1.assert)(freshAccount.id);
                    return [4 /*yield*/, applyEffectAndValidateResults({
                            idToCheck: freshAccount.id,
                            qr: QR_WITH_PATIENT_FOR_ALL_SUBSCRIBERS_AND_GUARANTOR(),
                            guarantorRef: "Patient/".concat(patientId),
                            patientId: patientId,
                            dummyResourceRefs: {
                                appointment: "Appointment/".concat(dummyAppt.id),
                                encounter: "Encounter/".concat(dummyEncounter.id),
                            },
                        })];
                case 6:
                    _a = _g.sent(), account = _a.account, persistedGuarantor = _a.persistedGuarantor;
                    (0, vitest_1.expect)(account).toBeDefined();
                    (0, vitest_1.expect)(account.guarantor).toBeDefined();
                    (0, vitest_1.expect)((_b = account.guarantor) === null || _b === void 0 ? void 0 : _b.length).toBe(1);
                    (0, vitest_1.expect)((_e = (_d = (_c = account.guarantor) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.party) === null || _e === void 0 ? void 0 : _e.reference).toEqual("Patient/".concat(patientId));
                    (0, vitest_1.expect)(persistedGuarantor).toBeDefined();
                    (0, vitest_1.assert)(persistedGuarantor);
                    (0, vitest_1.expect)(persistedGuarantor.resourceType).toEqual('Patient');
                    (0, vitest_1.expect)(persistedGuarantor.id).toEqual(patientId);
                    batchDeletes = [
                        {
                            method: 'DELETE',
                            url: "Patient/".concat(patientId),
                        },
                        {
                            method: 'DELETE',
                            url: "Account/".concat(freshAccount.id),
                        },
                    ];
                    return [4 /*yield*/, oystehrClient.fhir.transaction({
                            requests: batchDeletes,
                        })];
                case 7:
                    response = _g.sent();
                    (0, vitest_1.expect)(response.entry).toBeDefined();
                    (_f = response.entry) === null || _f === void 0 ? void 0 : _f.forEach(function (entry) {
                        var _a, _b;
                        (0, vitest_1.expect)(entry.response).toBeDefined();
                        (0, vitest_1.expect)((_b = (_a = entry.response) === null || _a === void 0 ? void 0 : _a.outcome) === null || _b === void 0 ? void 0 : _b.id).toBe('ok');
                    });
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should check encounter gets updated with payment option selfPay extension', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, qr, encounterRef, encounterIdFromQr, encounter, effect, insurancePayExt;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    patientId = getPatientId();
                    qr = fillWithQR1Refs(BASE_QR, patientId);
                    encounterRef = (_a = qr.encounter) === null || _a === void 0 ? void 0 : _a.reference;
                    (0, vitest_1.expect)(encounterRef).toBeDefined();
                    encounterIdFromQr = encounterRef === null || encounterRef === void 0 ? void 0 : encounterRef.replace('Encounter/', '');
                    return [4 /*yield*/, getEncounter(encounterIdFromQr)];
                case 1:
                    encounter = _b.sent();
                    (0, vitest_1.expect)(encounter).toBeDefined();
                    (0, vitest_1.expect)(encounter.extension).toBe(undefined);
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(undefined);
                    qr = (0, harvest_test_helpers_1.selectSelfPayOption)(qr);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 2:
                    effect = _b.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, getEncounter(encounterIdFromQr)];
                case 3:
                    encounter = _b.sent();
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(utils_1.PaymentVariant.selfPay);
                    return [4 /*yield*/, oystehrClient.fhir.patch({
                            resourceType: 'Encounter',
                            id: encounterIdFromQr,
                            operations: [
                                {
                                    op: 'add',
                                    path: '/extension',
                                    value: [
                                        {
                                            // cSpell:disable-next dummy url
                                            url: 'dummyurl',
                                            valueString: 'string',
                                        },
                                    ],
                                },
                            ],
                        })];
                case 4:
                    // case 2: encounter has extension but without payment option selfPay extension
                    encounter = _b.sent();
                    (0, vitest_1.expect)(encounter.extension).not.toBe(undefined);
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(undefined);
                    qr = (0, harvest_test_helpers_1.selectSelfPayOption)(qr);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 5:
                    effect = _b.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, getEncounter(encounterIdFromQr)];
                case 6:
                    encounter = _b.sent();
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(utils_1.PaymentVariant.selfPay);
                    insurancePayExt = (0, utils_1.updateEncounterPaymentVariantExtension)(encounter, utils_1.PaymentVariant.insurance).extension;
                    return [4 /*yield*/, oystehrClient.fhir.patch({
                            resourceType: 'Encounter',
                            id: encounterIdFromQr,
                            operations: [
                                {
                                    op: 'replace',
                                    path: '/extension',
                                    value: insurancePayExt,
                                },
                            ],
                        })];
                case 7:
                    encounter = _b.sent();
                    (0, vitest_1.expect)(encounter.extension).not.toBe(undefined);
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(utils_1.PaymentVariant.insurance);
                    qr = (0, harvest_test_helpers_1.selectSelfPayOption)(qr);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 8:
                    effect = _b.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, getEncounter(encounterIdFromQr)];
                case 9:
                    encounter = _b.sent();
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(utils_1.PaymentVariant.selfPay);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    (0, vitest_1.it)('should check encounter gets updated with payment option insurancePay extension', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, qr, encounterRef, encounterIdFromQr, encounter, effect, selfPayExt;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    patientId = getPatientId();
                    qr = fillWithQR1Refs(BASE_QR, patientId);
                    encounterRef = (_a = qr.encounter) === null || _a === void 0 ? void 0 : _a.reference;
                    (0, vitest_1.expect)(encounterRef).toBeDefined();
                    encounterIdFromQr = encounterRef === null || encounterRef === void 0 ? void 0 : encounterRef.replace('Encounter/', '');
                    return [4 /*yield*/, getEncounter(encounterIdFromQr)];
                case 1:
                    encounter = _b.sent();
                    (0, vitest_1.expect)(encounter).toBeDefined();
                    (0, vitest_1.expect)(encounter.extension).toBe(undefined);
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(undefined);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 2:
                    effect = _b.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, getEncounter(encounterIdFromQr)];
                case 3:
                    encounter = _b.sent();
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(utils_1.PaymentVariant.insurance);
                    return [4 /*yield*/, oystehrClient.fhir.patch({
                            resourceType: 'Encounter',
                            id: encounterIdFromQr,
                            operations: [
                                {
                                    op: 'add',
                                    path: '/extension',
                                    value: [
                                        {
                                            // cSpell:disable-next dummy url
                                            url: 'dummyurl',
                                            valueString: 'string',
                                        },
                                    ],
                                },
                            ],
                        })];
                case 4:
                    // case 2: encounter has extension but without payment option insurancePay extension
                    encounter = _b.sent();
                    (0, vitest_1.expect)(encounter.extension).toBeDefined();
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(undefined);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 5:
                    effect = _b.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, getEncounter(encounterIdFromQr)];
                case 6:
                    encounter = _b.sent();
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(utils_1.PaymentVariant.insurance);
                    selfPayExt = (0, utils_1.updateEncounterPaymentVariantExtension)(encounter, utils_1.PaymentVariant.selfPay).extension;
                    return [4 /*yield*/, oystehrClient.fhir.patch({
                            resourceType: 'Encounter',
                            id: encounterIdFromQr,
                            operations: [
                                {
                                    op: 'replace',
                                    path: '/extension',
                                    value: selfPayExt,
                                },
                            ],
                        })];
                case 7:
                    encounter = _b.sent();
                    (0, vitest_1.expect)(encounter.extension).not.toBe(undefined);
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(utils_1.PaymentVariant.selfPay);
                    return [4 /*yield*/, (0, sub_intake_harvest_1.performEffect)({ qr: qr, secrets: envConfig }, oystehrClient)];
                case 8:
                    effect = _b.sent();
                    (0, vitest_1.expect)(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
                    return [4 /*yield*/, getEncounter(encounterIdFromQr)];
                case 9:
                    encounter = _b.sent();
                    (0, vitest_1.expect)((0, utils_1.getPaymentVariantFromEncounter)(encounter)).toBe(utils_1.PaymentVariant.insurance);
                    return [2 /*return*/];
            }
        });
    }); }, DEFAULT_TIMEOUT);
    // todo: tests for EHR updates: 1) test when no guarantor is provided; 2) test when insurance-is-secondary = true
});
