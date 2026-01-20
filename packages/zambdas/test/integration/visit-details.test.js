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
var sdk_1 = require("@oystehr/sdk");
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var local_json_1 = require("../../.env/local.json");
var shared_1 = require("../../src/shared");
var questionnaire_response_1_json_1 = require("../data/questionnaire-response-1.json");
var secrets_1 = require("../data/secrets");
var configureTestM2MClient_1 = require("../helpers/configureTestM2MClient");
var testScheduleUtils_1 = require("../helpers/testScheduleUtils");
describe('saving and getting visit details', function () {
    var oystehr;
    var token;
    var processId;
    var makeTestResources = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientId, testPatient, partialPatient, now_1, birthDate, now, appointment, batchInputApp, encounter, batchInputEnc, batchResults, createdEncounter, createdAppointment, testQR, createdQR, error_1;
        var _c;
        var _d;
        var processId = _b.processId, oystehr = _b.oystehr, _e = _b.addDays, addDays = _e === void 0 ? 0 : _e, patientAge = _b.patientAge, existingPatientId = _b.existingPatientId, patientSex = _b.patientSex, unconfirmedDob = _b.unconfirmedDob;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    patientId = existingPatientId;
                    if (!!patientId) return [3 /*break*/, 2];
                    partialPatient = {};
                    if (patientAge) {
                        now_1 = luxon_1.DateTime.now();
                        birthDate = now_1.minus((_c = {}, _c[patientAge.units] = patientAge.value, _c));
                        partialPatient.birthDate = birthDate.toFormat(utils_1.DOB_DATE_FORMAT);
                    }
                    if (patientSex) {
                        partialPatient.gender = patientSex;
                    }
                    return [4 /*yield*/, (0, testScheduleUtils_1.persistTestPatient)({ patient: (0, testScheduleUtils_1.makeTestPatient)(partialPatient), processId: processId }, oystehr)];
                case 1:
                    testPatient = _f.sent();
                    expect(testPatient).toBeDefined();
                    patientId = testPatient.id;
                    _f.label = 2;
                case 2:
                    expect(patientId).toBeDefined();
                    (0, vitest_1.assert)(patientId);
                    now = luxon_1.DateTime.now().plus({ days: addDays });
                    appointment = {
                        resourceType: 'Appointment',
                        status: 'fulfilled',
                        start: now.toISO(),
                        end: now.plus({ minutes: 15 }).toISO(),
                        participant: [
                            {
                                actor: {
                                    reference: "Patient/".concat(patientId),
                                },
                                status: 'accepted',
                            },
                        ],
                        extension: unconfirmedDob
                            ? [
                                {
                                    url: utils_1.FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url,
                                    valueString: unconfirmedDob,
                                },
                            ]
                            : undefined,
                    };
                    batchInputApp = {
                        method: 'POST',
                        resource: appointment,
                        url: 'Appointment',
                        fullUrl: "urn:uuid:".concat((0, crypto_1.randomUUID)()),
                    };
                    encounter = {
                        resourceType: 'Encounter',
                        status: 'in-progress',
                        class: {
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                            code: 'AMB',
                            display: 'ambulatory',
                        },
                        subject: {
                            reference: "Patient/".concat(patientId),
                        },
                        appointment: [
                            {
                                reference: "".concat(batchInputApp.fullUrl),
                            },
                        ],
                        period: {
                            start: now.toISO(),
                        },
                    };
                    batchInputEnc = {
                        method: 'POST',
                        resource: encounter,
                        url: 'Encounter',
                    };
                    _f.label = 3;
                case 3:
                    _f.trys.push([3, 6, , 7]);
                    return [4 /*yield*/, oystehr.fhir.transaction({
                            requests: [batchInputApp, batchInputEnc],
                        })];
                case 4:
                    batchResults = ((_d = (_f.sent()).entry) === null || _d === void 0 ? void 0 : _d.flatMap(function (entry) { var _a; return (_a = entry.resource) !== null && _a !== void 0 ? _a : []; })) || [];
                    expect(batchResults).toBeDefined();
                    createdEncounter = batchResults.find(function (entry) { return entry.resourceType === 'Encounter'; });
                    expect(createdEncounter === null || createdEncounter === void 0 ? void 0 : createdEncounter.id).toBeDefined();
                    (0, vitest_1.assert)(createdEncounter);
                    createdAppointment = batchResults.find(function (entry) { return entry.resourceType === 'Appointment'; });
                    expect(createdAppointment === null || createdAppointment === void 0 ? void 0 : createdAppointment.id).toBeDefined();
                    (0, vitest_1.assert)(createdAppointment);
                    testQR = __assign(__assign({}, questionnaire_response_1_json_1.default), { subject: { reference: "Patient/".concat(patientId) }, encounter: { reference: "Encounter/".concat(createdEncounter.id) } });
                    return [4 /*yield*/, oystehr.fhir.create(testQR)];
                case 5:
                    createdQR = _f.sent();
                    expect(createdQR).toBeDefined();
                    expect(createdQR.id).toBeDefined();
                    return [2 /*return*/, { encounter: createdEncounter, patient: testPatient, appointment: createdAppointment, qr: createdQR }];
                case 6:
                    error_1 = _f.sent();
                    expect(error_1).toBeUndefined();
                    throw new Error("Error creating test resources: ".concat(error_1));
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var getVisitDetails = function (appointmentId) { return __awaiter(void 0, void 0, void 0, function () {
        var visitDetailsOutput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.zambda.execute({
                        id: 'EHR-GET-VISIT-DETAILS',
                        appointmentId: appointmentId,
                    })];
                case 1:
                    visitDetailsOutput = (_a.sent()).output;
                    return [2 /*return*/, visitDetailsOutput];
            }
        });
    }); };
    var updateVisitDetails = function (input) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // implement when needed
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: 'EHR-UPDATE-VISIT-DETAILS' }, input))];
                case 1:
                    // implement when needed
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID, EXECUTE_ZAMBDA_URL;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    processId = (0, crypto_1.randomUUID)();
                    AUTH0_ENDPOINT = secrets_1.SECRETS.AUTH0_ENDPOINT, AUTH0_AUDIENCE = secrets_1.SECRETS.AUTH0_AUDIENCE, FHIR_API = secrets_1.SECRETS.FHIR_API, PROJECT_ID = secrets_1.SECRETS.PROJECT_ID;
                    EXECUTE_ZAMBDA_URL = (0, vitest_1.inject)('EXECUTE_ZAMBDA_URL');
                    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)({
                            AUTH0_ENDPOINT: AUTH0_ENDPOINT,
                            AUTH0_CLIENT: local_json_1.AUTH0_CLIENT_TESTS,
                            AUTH0_SECRET: local_json_1.AUTH0_SECRET_TESTS,
                            AUTH0_AUDIENCE: AUTH0_AUDIENCE,
                        })];
                case 1:
                    token = _a.sent();
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: FHIR_API,
                        projectApiUrl: EXECUTE_ZAMBDA_URL,
                        projectId: PROJECT_ID,
                    });
                    return [4 /*yield*/, (0, configureTestM2MClient_1.ensureM2MPractitionerProfile)(token)];
                case 2:
                    _a.sent();
                    expect(oystehr).toBeDefined();
                    expect(oystehr.fhir).toBeDefined();
                    expect(oystehr.zambda).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
    afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not clean up!');
                    }
                    // this will clean up everything connect to the test patient too
                    return [4 /*yield*/, (0, testScheduleUtils_1.cleanupTestScheduleResources)(processId, oystehr)];
                case 1:
                    // this will clean up everything connect to the test patient too
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save and retrieve reason for visit', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, encounter, appointment, visitDetails, reasonForVisit, randomIndex, reasonText, updatedVisitDetails, newReasonForVisit;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 30 },
                            patientSex: 'male',
                        })];
                case 1:
                    _a = _b.sent(), encounter = _a.encounter, appointment = _a.appointment;
                    expect(encounter).toBeDefined();
                    expect(appointment).toBeDefined();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 2:
                    visitDetails = _b.sent();
                    expect(visitDetails).toBeDefined();
                    expect(visitDetails.encounter).toBeDefined();
                    expect(visitDetails.appointment).toBeDefined();
                    reasonForVisit = (0, utils_1.getReasonForVisitFromAppointment)(appointment);
                    expect(reasonForVisit).toBeUndefined();
                    randomIndex = Math.floor(Math.random() * utils_1.VALUE_SETS.reasonForVisitOptions.length);
                    reasonText = utils_1.VALUE_SETS.reasonForVisitOptions[randomIndex].value;
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                reasonForVisit: reasonText,
                            },
                        })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 4:
                    updatedVisitDetails = _b.sent();
                    expect(updatedVisitDetails).toBeDefined();
                    expect(updatedVisitDetails.appointment).toBeDefined();
                    newReasonForVisit = (0, utils_1.getReasonForVisitFromAppointment)(updatedVisitDetails.appointment);
                    expect(newReasonForVisit).toBeDefined();
                    expect(newReasonForVisit).toEqual(reasonText);
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save and retrieve additionalDetails', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, encounter, appointment, visitDetails, reasonForVisit, randomIndex, reasonText, updatedVisitDetails, newReasonForVisit, _b, newReasonForVisit2, newAdditionalDetails, randomIndex2, reasonText2, _c, newReasonForVisit3, newAdditionalDetails2, _d, newReasonForVisit4, newAdditionalDetails3;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 30 },
                            patientSex: 'male',
                        })];
                case 1:
                    _a = _e.sent(), encounter = _a.encounter, appointment = _a.appointment;
                    expect(encounter).toBeDefined();
                    expect(appointment).toBeDefined();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 2:
                    visitDetails = _e.sent();
                    expect(visitDetails).toBeDefined();
                    expect(visitDetails.encounter).toBeDefined();
                    expect(visitDetails.appointment).toBeDefined();
                    reasonForVisit = (0, utils_1.getReasonForVisitFromAppointment)(appointment);
                    expect(reasonForVisit).toBeUndefined();
                    randomIndex = Math.floor(Math.random() * utils_1.VALUE_SETS.reasonForVisitOptions.length);
                    reasonText = utils_1.VALUE_SETS.reasonForVisitOptions[randomIndex].value;
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                reasonForVisit: reasonText,
                            },
                        })];
                case 3:
                    _e.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 4:
                    updatedVisitDetails = _e.sent();
                    expect(updatedVisitDetails).toBeDefined();
                    expect(updatedVisitDetails.appointment).toBeDefined();
                    newReasonForVisit = (0, utils_1.getReasonForVisitFromAppointment)(updatedVisitDetails.appointment);
                    expect(newReasonForVisit).toBeDefined();
                    expect(newReasonForVisit).toEqual(reasonText);
                    // main reason for visit stays the same when not included in update
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                additionalDetails: 'Mom says speech a bit slurred',
                            },
                        })];
                case 5:
                    // main reason for visit stays the same when not included in update
                    _e.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 6:
                    updatedVisitDetails = _e.sent();
                    expect(updatedVisitDetails).toBeDefined();
                    expect(updatedVisitDetails.appointment).toBeDefined();
                    _b = (0, utils_1.getReasonForVisitAndAdditionalDetailsFromAppointment)(updatedVisitDetails.appointment), newReasonForVisit2 = _b.reasonForVisit, newAdditionalDetails = _b.additionalDetails;
                    expect(newReasonForVisit2).toBeDefined();
                    expect(newReasonForVisit2).toEqual(newReasonForVisit);
                    expect(newAdditionalDetails).toBeDefined();
                    expect(newAdditionalDetails).toEqual('Mom says speech a bit slurred');
                    randomIndex2 = Math.floor(Math.random() * utils_1.VALUE_SETS.reasonForVisitOptions.length);
                    reasonText2 = utils_1.VALUE_SETS.reasonForVisitOptions[randomIndex2].value;
                    // both main reason for visit and additional details updated when both included
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                additionalDetails: 'Mom says brother is very sorry',
                                reasonForVisit: reasonText2,
                            },
                        })];
                case 7:
                    // both main reason for visit and additional details updated when both included
                    _e.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 8:
                    updatedVisitDetails = _e.sent();
                    expect(updatedVisitDetails).toBeDefined();
                    expect(updatedVisitDetails.appointment).toBeDefined();
                    _c = (0, utils_1.getReasonForVisitAndAdditionalDetailsFromAppointment)(updatedVisitDetails.appointment), newReasonForVisit3 = _c.reasonForVisit, newAdditionalDetails2 = _c.additionalDetails;
                    expect(newReasonForVisit3).toBeDefined();
                    expect(newReasonForVisit3).toEqual(reasonText2);
                    expect(newAdditionalDetails2).toBeDefined();
                    expect(newAdditionalDetails2).toEqual('Mom says brother is very sorry');
                    // additional details removed when set to empty string
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                additionalDetails: '',
                                reasonForVisit: reasonText, // set back to original reason
                            },
                        })];
                case 9:
                    // additional details removed when set to empty string
                    _e.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 10:
                    updatedVisitDetails = _e.sent();
                    expect(updatedVisitDetails).toBeDefined();
                    expect(updatedVisitDetails.appointment).toBeDefined();
                    _d = (0, utils_1.getReasonForVisitAndAdditionalDetailsFromAppointment)(updatedVisitDetails.appointment), newReasonForVisit4 = _d.reasonForVisit, newAdditionalDetails3 = _d.additionalDetails;
                    expect(newReasonForVisit4).toBeDefined();
                    expect(newReasonForVisit4).toEqual(reasonText);
                    expect(newAdditionalDetails3).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save and retrieve patient name', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, encounter, appointment, patient, originalName, originalFirstName, visitDetails, newFirstName, newMiddleName, newLastName, updatedVisitDetails, updatedName;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 30 },
                            patientSex: 'female',
                        })];
                case 1:
                    _a = _m.sent(), encounter = _a.encounter, appointment = _a.appointment, patient = _a.patient;
                    expect(encounter).toBeDefined();
                    expect(appointment).toBeDefined();
                    expect(patient).toBeDefined();
                    expect(patient === null || patient === void 0 ? void 0 : patient.name).toBeDefined();
                    expect((_b = patient === null || patient === void 0 ? void 0 : patient.name) === null || _b === void 0 ? void 0 : _b.length).toBeGreaterThan(0);
                    originalName = (_c = patient === null || patient === void 0 ? void 0 : patient.name) === null || _c === void 0 ? void 0 : _c[0];
                    expect(originalName).toBeDefined();
                    expect(originalName === null || originalName === void 0 ? void 0 : originalName.given).toBeDefined();
                    expect((_d = originalName === null || originalName === void 0 ? void 0 : originalName.given) === null || _d === void 0 ? void 0 : _d.length).toBeGreaterThan(0);
                    originalFirstName = (_e = originalName === null || originalName === void 0 ? void 0 : originalName.given) === null || _e === void 0 ? void 0 : _e[0];
                    expect(originalFirstName).toBeDefined();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 2:
                    visitDetails = _m.sent();
                    expect(visitDetails).toBeDefined();
                    expect(visitDetails.patient).toBeDefined();
                    expect(visitDetails.patient.name).toBeDefined();
                    expect((_f = visitDetails.patient.name) === null || _f === void 0 ? void 0 : _f[0]).toEqual(originalName);
                    newFirstName = "UpdatedFirstName".concat((0, crypto_1.randomUUID)().substring(0, 5));
                    newMiddleName = "UpdatedMiddleName".concat((0, crypto_1.randomUUID)().substring(0, 5));
                    newLastName = "UpdatedLastName".concat((0, crypto_1.randomUUID)().substring(0, 5));
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                patientName: {
                                    first: newFirstName,
                                    middle: newMiddleName,
                                    last: newLastName,
                                },
                            },
                        })];
                case 3:
                    _m.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 4:
                    updatedVisitDetails = _m.sent();
                    expect(updatedVisitDetails).toBeDefined();
                    expect(updatedVisitDetails.appointment).toBeDefined();
                    expect(updatedVisitDetails.patient).toBeDefined();
                    expect(updatedVisitDetails.patient.name).toBeDefined();
                    expect((_g = updatedVisitDetails.patient.name) === null || _g === void 0 ? void 0 : _g.length).toBeGreaterThan(0);
                    updatedName = (_h = updatedVisitDetails.patient.name) === null || _h === void 0 ? void 0 : _h[0];
                    expect(updatedName).toBeDefined();
                    expect(updatedName).not.toEqual(originalName);
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.given).toBeDefined();
                    expect((_j = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _j === void 0 ? void 0 : _j.length).toBeGreaterThan(1);
                    expect((_k = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _k === void 0 ? void 0 : _k[0]).toEqual(newFirstName);
                    expect((_l = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _l === void 0 ? void 0 : _l[1]).toEqual(newMiddleName);
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.family).toBeDefined();
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.family).toEqual(newLastName);
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save and retrieve patient name with empty middle name', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, encounter, appointment, patient, originalName, originalFirstName, visitDetails, newFirstName, newMiddleName, newLastName, updatedVisitDetails, errorFound, _b, updatedName;
        var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 30 },
                            patientSex: 'female',
                        })];
                case 1:
                    _a = _o.sent(), encounter = _a.encounter, appointment = _a.appointment, patient = _a.patient;
                    expect(encounter).toBeDefined();
                    expect(appointment).toBeDefined();
                    expect(patient).toBeDefined();
                    expect(patient === null || patient === void 0 ? void 0 : patient.name).toBeDefined();
                    expect((_c = patient === null || patient === void 0 ? void 0 : patient.name) === null || _c === void 0 ? void 0 : _c.length).toBeGreaterThan(0);
                    originalName = (_d = patient === null || patient === void 0 ? void 0 : patient.name) === null || _d === void 0 ? void 0 : _d[0];
                    expect(originalName).toBeDefined();
                    expect(originalName === null || originalName === void 0 ? void 0 : originalName.given).toBeDefined();
                    expect((_e = originalName === null || originalName === void 0 ? void 0 : originalName.given) === null || _e === void 0 ? void 0 : _e.length).toBeGreaterThan(0);
                    originalFirstName = (_f = originalName === null || originalName === void 0 ? void 0 : originalName.given) === null || _f === void 0 ? void 0 : _f[0];
                    expect(originalFirstName).toBeDefined();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 2:
                    visitDetails = _o.sent();
                    expect(visitDetails).toBeDefined();
                    expect(visitDetails.patient).toBeDefined();
                    expect(visitDetails.patient.name).toBeDefined();
                    expect((_g = visitDetails.patient.name) === null || _g === void 0 ? void 0 : _g[0]).toEqual(originalName);
                    newFirstName = 'Sven';
                    newMiddleName = '';
                    newLastName = 'Stiegson';
                    errorFound = false;
                    _o.label = 3;
                case 3:
                    _o.trys.push([3, 6, , 7]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                patientName: {
                                    first: newFirstName,
                                    middle: newMiddleName,
                                    last: newLastName,
                                },
                            },
                        })];
                case 4:
                    _o.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 5:
                    updatedVisitDetails = _o.sent();
                    return [3 /*break*/, 7];
                case 6:
                    _b = _o.sent();
                    errorFound = true;
                    return [3 /*break*/, 7];
                case 7:
                    expect(errorFound).toBe(false);
                    expect(updatedVisitDetails).toBeDefined();
                    (0, vitest_1.assert)(updatedVisitDetails);
                    expect(updatedVisitDetails.appointment).toBeDefined();
                    expect(updatedVisitDetails.patient).toBeDefined();
                    expect(updatedVisitDetails.patient.name).toBeDefined();
                    expect((_h = updatedVisitDetails.patient.name) === null || _h === void 0 ? void 0 : _h.length).toBeGreaterThan(0);
                    updatedName = (_j = updatedVisitDetails.patient.name) === null || _j === void 0 ? void 0 : _j[0];
                    expect(updatedName).toBeDefined();
                    expect(updatedName).not.toEqual(originalName);
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.given).toBeDefined();
                    expect((_k = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _k === void 0 ? void 0 : _k.length).toBe(1);
                    expect((_l = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _l === void 0 ? void 0 : _l[0]).toEqual(newFirstName);
                    expect((_m = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _m === void 0 ? void 0 : _m[1]).toBeUndefined();
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.family).toBeDefined();
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.family).toEqual(newLastName);
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('patient middle name can be removed', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, encounter, appointment, patient, originalName, originalFirstName, visitDetails, newFirstName, newMiddleName, newLastName, updatedVisitDetails, updatedName, updatedName2;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        return __generator(this, function (_s) {
            switch (_s.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 30 },
                            patientSex: 'female',
                        })];
                case 1:
                    _a = _s.sent(), encounter = _a.encounter, appointment = _a.appointment, patient = _a.patient;
                    expect(encounter).toBeDefined();
                    expect(appointment).toBeDefined();
                    expect(patient).toBeDefined();
                    expect(patient === null || patient === void 0 ? void 0 : patient.name).toBeDefined();
                    expect((_b = patient === null || patient === void 0 ? void 0 : patient.name) === null || _b === void 0 ? void 0 : _b.length).toBeGreaterThan(0);
                    originalName = (_c = patient === null || patient === void 0 ? void 0 : patient.name) === null || _c === void 0 ? void 0 : _c[0];
                    expect(originalName).toBeDefined();
                    expect(originalName === null || originalName === void 0 ? void 0 : originalName.given).toBeDefined();
                    expect((_d = originalName === null || originalName === void 0 ? void 0 : originalName.given) === null || _d === void 0 ? void 0 : _d.length).toBeGreaterThan(0);
                    originalFirstName = (_e = originalName === null || originalName === void 0 ? void 0 : originalName.given) === null || _e === void 0 ? void 0 : _e[0];
                    expect(originalFirstName).toBeDefined();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 2:
                    visitDetails = _s.sent();
                    expect(visitDetails).toBeDefined();
                    expect(visitDetails.patient).toBeDefined();
                    expect(visitDetails.patient.name).toBeDefined();
                    expect((_f = visitDetails.patient.name) === null || _f === void 0 ? void 0 : _f[0]).toEqual(originalName);
                    newFirstName = 'Anna';
                    newMiddleName = 'Hedda';
                    newLastName = 'Andersson';
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                patientName: {
                                    first: newFirstName,
                                    middle: newMiddleName,
                                    last: newLastName,
                                },
                            },
                        })];
                case 3:
                    _s.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 4:
                    updatedVisitDetails = _s.sent();
                    expect(updatedVisitDetails).toBeDefined();
                    expect(updatedVisitDetails.appointment).toBeDefined();
                    expect(updatedVisitDetails.patient).toBeDefined();
                    expect(updatedVisitDetails.patient.name).toBeDefined();
                    expect((_g = updatedVisitDetails.patient.name) === null || _g === void 0 ? void 0 : _g.length).toBeGreaterThan(0);
                    updatedName = (_h = updatedVisitDetails.patient.name) === null || _h === void 0 ? void 0 : _h[0];
                    expect(updatedName).toBeDefined();
                    expect(updatedName).not.toEqual(originalName);
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.given).toBeDefined();
                    expect((_j = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _j === void 0 ? void 0 : _j.length).toBe(2);
                    expect((_k = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _k === void 0 ? void 0 : _k[0]).toEqual(newFirstName);
                    expect((_l = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _l === void 0 ? void 0 : _l[1]).toEqual(newMiddleName);
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.family).toBeDefined();
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.family).toEqual(newLastName);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                patientName: {
                                    first: newFirstName,
                                    middle: '',
                                    last: newLastName,
                                },
                            },
                        })];
                case 5:
                    _s.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 6:
                    updatedVisitDetails = _s.sent();
                    expect(updatedVisitDetails).toBeDefined();
                    expect(updatedVisitDetails.appointment).toBeDefined();
                    expect(updatedVisitDetails.patient).toBeDefined();
                    expect(updatedVisitDetails.patient.name).toBeDefined();
                    expect((_m = updatedVisitDetails.patient.name) === null || _m === void 0 ? void 0 : _m.length).toBeGreaterThan(0);
                    updatedName2 = (_o = updatedVisitDetails.patient.name) === null || _o === void 0 ? void 0 : _o[0];
                    expect(updatedName2).toBeDefined();
                    expect(updatedName2).not.toEqual(originalName);
                    expect(updatedName2 === null || updatedName2 === void 0 ? void 0 : updatedName2.given).toBeDefined();
                    expect((_p = updatedName2 === null || updatedName2 === void 0 ? void 0 : updatedName2.given) === null || _p === void 0 ? void 0 : _p.length).toBe(1);
                    expect((_q = updatedName2 === null || updatedName2 === void 0 ? void 0 : updatedName2.given) === null || _q === void 0 ? void 0 : _q[0]).toEqual(newFirstName);
                    expect((_r = updatedName2 === null || updatedName2 === void 0 ? void 0 : updatedName2.given) === null || _r === void 0 ? void 0 : _r[1]).toBeUndefined();
                    expect(updatedName2 === null || updatedName2 === void 0 ? void 0 : updatedName2.family).toBeDefined();
                    expect(updatedName2 === null || updatedName2 === void 0 ? void 0 : updatedName2.family).toEqual(newLastName);
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save and retrieve confirmed DOB', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, encounter, appointment, patient, originalBirthDate, visitDetails, newBirthDate, updatedVisitDetails;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 5 },
                            unconfirmedDob: '2022-02-02',
                        })];
                case 1:
                    _a = _b.sent(), encounter = _a.encounter, appointment = _a.appointment, patient = _a.patient;
                    originalBirthDate = luxon_1.DateTime.now().minus({ years: 5 }).toISODate();
                    expect(encounter).toBeDefined();
                    expect(appointment).toBeDefined();
                    expect(patient).toBeDefined();
                    expect(patient === null || patient === void 0 ? void 0 : patient.birthDate).toBeDefined();
                    expect(patient === null || patient === void 0 ? void 0 : patient.birthDate).toEqual(originalBirthDate);
                    expect(originalBirthDate).toBeDefined();
                    expect((0, utils_1.getUnconfirmedDOBIdx)(appointment)).toBeDefined();
                    expect((0, utils_1.getUnconfirmedDOBIdx)(appointment)).toEqual(0);
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 2:
                    visitDetails = _b.sent();
                    expect(visitDetails).toBeDefined();
                    expect(visitDetails.patient).toBeDefined();
                    expect(visitDetails.patient.birthDate).toBeDefined();
                    expect(visitDetails.patient.birthDate).toEqual(originalBirthDate);
                    newBirthDate = '2017-02-02';
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                confirmedDob: newBirthDate,
                            },
                        })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 4:
                    updatedVisitDetails = _b.sent();
                    expect(updatedVisitDetails).toBeDefined();
                    expect(updatedVisitDetails.appointment).toBeDefined();
                    expect(updatedVisitDetails.patient).toBeDefined();
                    expect(updatedVisitDetails.patient.birthDate).toBeDefined();
                    expect(updatedVisitDetails.patient.birthDate).toEqual(newBirthDate);
                    expect((0, utils_1.getUnconfirmedDOBIdx)(updatedVisitDetails.appointment)).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save and retrieve authorized non-legal guardians', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, encounter, appointment, visitDetails, authorizedGuardians, guardiansText, updatedPatient, updatedAuthorizedGuardians, updatedPatient2, updatedAuthorizedGuardians2;
        var _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 1 },
                            patientSex: 'male',
                        })];
                case 1:
                    _a = _j.sent(), encounter = _a.encounter, appointment = _a.appointment;
                    expect(encounter).toBeDefined();
                    expect(appointment).toBeDefined();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 2:
                    visitDetails = _j.sent();
                    expect(visitDetails).toBeDefined();
                    expect(visitDetails.encounter).toBeDefined();
                    expect(visitDetails.appointment).toBeDefined();
                    expect(visitDetails.patient).toBeDefined();
                    authorizedGuardians = (_d = (_c = (_b = visitDetails.patient) === null || _b === void 0 ? void 0 : _b.extension) === null || _c === void 0 ? void 0 : _c.find(function (e) { return e.url === utils_1.FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url; })) === null || _d === void 0 ? void 0 : _d.valueString;
                    expect(authorizedGuardians).toBeUndefined();
                    guardiansText = 'Uncle Rico';
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                authorizedNonLegalGuardians: guardiansText,
                            },
                        })];
                case 3:
                    _j.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 4:
                    updatedPatient = (_j.sent()).patient;
                    expect(updatedPatient).toBeDefined();
                    updatedAuthorizedGuardians = (_f = (_e = updatedPatient === null || updatedPatient === void 0 ? void 0 : updatedPatient.extension) === null || _e === void 0 ? void 0 : _e.find(function (e) { return e.url === utils_1.FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url; })) === null || _f === void 0 ? void 0 : _f.valueString;
                    expect(updatedAuthorizedGuardians).toBeDefined();
                    expect(updatedAuthorizedGuardians).toEqual(guardiansText);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                authorizedNonLegalGuardians: '',
                            },
                        })];
                case 5:
                    _j.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 6:
                    updatedPatient2 = (_j.sent()).patient;
                    expect(updatedPatient2).toBeDefined();
                    updatedAuthorizedGuardians2 = (_h = (_g = updatedPatient2 === null || updatedPatient2 === void 0 ? void 0 : updatedPatient2.extension) === null || _g === void 0 ? void 0 : _g.find(function (e) { return e.url === utils_1.FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url; })) === null || _h === void 0 ? void 0 : _h.valueString;
                    expect(updatedAuthorizedGuardians2).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save and retrieve consent attestation', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, encounter, appointment, visitDetails, updatedVisitDetails, updatedEncounter, consentSig, consentSigType, when, today;
        var _b, _c, _d, _e, _f, _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 1 },
                            patientSex: 'male',
                        })];
                case 1:
                    _a = _k.sent(), encounter = _a.encounter, appointment = _a.appointment;
                    expect(encounter).toBeDefined();
                    expect(appointment).toBeDefined();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 2:
                    visitDetails = _k.sent();
                    expect(visitDetails).toBeDefined();
                    expect(visitDetails.encounter).toBeDefined();
                    expect(visitDetails.appointment).toBeDefined();
                    expect(visitDetails.patient).toBeDefined();
                    expect(visitDetails.consentIsAttested).toBe(false);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                consentForms: {
                                    consentAttested: true,
                                },
                            },
                        })];
                case 3:
                    _k.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 4:
                    updatedVisitDetails = _k.sent();
                    expect(updatedVisitDetails).toBeDefined();
                    expect(updatedVisitDetails.consentIsAttested).toBe(true);
                    updatedEncounter = updatedVisitDetails.encounter;
                    expect(updatedEncounter).toBeDefined();
                    consentSig = (0, utils_1.getAttestedConsentFromEncounter)(updatedEncounter);
                    expect(consentSig).toBeDefined();
                    (0, vitest_1.assert)(consentSig);
                    expect(consentSig === null || consentSig === void 0 ? void 0 : consentSig.type).toBeDefined();
                    expect((_b = consentSig === null || consentSig === void 0 ? void 0 : consentSig.type) === null || _b === void 0 ? void 0 : _b.length).toBeGreaterThan(0);
                    consentSigType = (_c = consentSig === null || consentSig === void 0 ? void 0 : consentSig.type) === null || _c === void 0 ? void 0 : _c[0];
                    expect(consentSigType).toBeDefined();
                    (0, vitest_1.assert)(consentSigType);
                    expect(consentSigType.code).toEqual(utils_1.CONSENT_ATTESTATION_SIG_TYPE.code);
                    expect(consentSigType.system).toEqual(utils_1.CONSENT_ATTESTATION_SIG_TYPE.system);
                    expect(consentSig.who).toBeDefined();
                    expect((_d = consentSig.who) === null || _d === void 0 ? void 0 : _d.reference).toBeDefined();
                    expect((_f = (_e = consentSig.who) === null || _e === void 0 ? void 0 : _e.reference) === null || _f === void 0 ? void 0 : _f.split('/')[0]).toBe('Practitioner');
                    expect((0, utils_1.isValidUUID)((_j = (_h = (_g = consentSig.who) === null || _g === void 0 ? void 0 : _g.reference) === null || _h === void 0 ? void 0 : _h.split('/')[1]) !== null && _j !== void 0 ? _j : '')).toBe(true);
                    expect(consentSig.when).toBeDefined();
                    when = luxon_1.DateTime.fromISO(consentSig.when).toISODate();
                    today = luxon_1.DateTime.now().toISODate();
                    expect(when).toEqual(today);
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save all visit details at once and retrieve them', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, encounter, appointment, visitDetails, randomIndex, reasonForVisit, guardiansText, newBirthDate, newFirstName, newMiddleName, newLastName, updatedVisitDetails, updatedReasonForVisit, updatedAuthorizedGuardians, updatedName, updatedEncounter, consentSig, consentSigType, when, today;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        return __generator(this, function (_t) {
            switch (_t.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 },
                            patientSex: 'female',
                        })];
                case 1:
                    _a = _t.sent(), encounter = _a.encounter, appointment = _a.appointment;
                    expect(encounter).toBeDefined();
                    expect(appointment).toBeDefined();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 2:
                    visitDetails = _t.sent();
                    expect(visitDetails).toBeDefined();
                    expect(visitDetails.encounter).toBeDefined();
                    expect(visitDetails.appointment).toBeDefined();
                    expect(visitDetails.patient).toBeDefined();
                    expect(visitDetails.consentIsAttested).toBe(false);
                    randomIndex = Math.floor(Math.random() * utils_1.VALUE_SETS.reasonForVisitOptions.length);
                    reasonForVisit = utils_1.VALUE_SETS.reasonForVisitOptions[randomIndex].value;
                    guardiansText = 'Aunt Becky';
                    newBirthDate = '2020-05-05';
                    newFirstName = "AllAtOnceFirst".concat((0, crypto_1.randomUUID)().substring(0, 5));
                    newMiddleName = "AllAtOnceMiddle".concat((0, crypto_1.randomUUID)().substring(0, 5));
                    newLastName = "AllAtOnceLast".concat((0, crypto_1.randomUUID)().substring(0, 5));
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                reasonForVisit: reasonForVisit,
                                authorizedNonLegalGuardians: guardiansText,
                                confirmedDob: newBirthDate,
                                patientName: {
                                    first: newFirstName,
                                    middle: newMiddleName,
                                    last: newLastName,
                                },
                                consentForms: {
                                    consentAttested: true,
                                },
                            },
                        })];
                case 3:
                    _t.sent();
                    return [4 /*yield*/, getVisitDetails(appointment.id)];
                case 4:
                    updatedVisitDetails = _t.sent();
                    expect(updatedVisitDetails).toBeDefined();
                    expect(updatedVisitDetails.appointment).toBeDefined();
                    expect(updatedVisitDetails.patient).toBeDefined();
                    expect(updatedVisitDetails.consentIsAttested).toBe(true);
                    updatedReasonForVisit = (0, utils_1.getReasonForVisitFromAppointment)(updatedVisitDetails.appointment);
                    expect(updatedReasonForVisit).toBeDefined();
                    expect(updatedReasonForVisit).toEqual(reasonForVisit);
                    updatedAuthorizedGuardians = (_d = (_c = (_b = updatedVisitDetails.patient) === null || _b === void 0 ? void 0 : _b.extension) === null || _c === void 0 ? void 0 : _c.find(function (e) { return e.url === utils_1.FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url; })) === null || _d === void 0 ? void 0 : _d.valueString;
                    expect(updatedAuthorizedGuardians).toBeDefined();
                    expect(updatedAuthorizedGuardians).toEqual(guardiansText);
                    expect(updatedVisitDetails.patient.birthDate).toBeDefined();
                    expect(updatedVisitDetails.patient.birthDate).toEqual(newBirthDate);
                    expect(updatedVisitDetails.patient.name).toBeDefined();
                    expect((_e = updatedVisitDetails.patient.name) === null || _e === void 0 ? void 0 : _e.length).toBeGreaterThan(0);
                    updatedName = (_f = updatedVisitDetails.patient.name) === null || _f === void 0 ? void 0 : _f[0];
                    expect(updatedName).toBeDefined();
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.given).toBeDefined();
                    expect((_g = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _g === void 0 ? void 0 : _g.length).toBeGreaterThan(1);
                    expect((_h = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _h === void 0 ? void 0 : _h[0]).toEqual(newFirstName);
                    expect((_j = updatedName === null || updatedName === void 0 ? void 0 : updatedName.given) === null || _j === void 0 ? void 0 : _j[1]).toEqual(newMiddleName);
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.family).toBeDefined();
                    expect(updatedName === null || updatedName === void 0 ? void 0 : updatedName.family).toEqual(newLastName);
                    updatedEncounter = updatedVisitDetails.encounter;
                    expect(updatedEncounter).toBeDefined();
                    consentSig = (0, utils_1.getAttestedConsentFromEncounter)(updatedEncounter);
                    expect(consentSig).toBeDefined();
                    (0, vitest_1.assert)(consentSig);
                    expect(consentSig === null || consentSig === void 0 ? void 0 : consentSig.type).toBeDefined();
                    expect((_k = consentSig === null || consentSig === void 0 ? void 0 : consentSig.type) === null || _k === void 0 ? void 0 : _k.length).toBeGreaterThan(0);
                    consentSigType = (_l = consentSig === null || consentSig === void 0 ? void 0 : consentSig.type) === null || _l === void 0 ? void 0 : _l[0];
                    expect(consentSigType).toBeDefined();
                    (0, vitest_1.assert)(consentSigType);
                    expect(consentSigType.code).toEqual(utils_1.CONSENT_ATTESTATION_SIG_TYPE.code);
                    expect(consentSigType.system).toEqual(utils_1.CONSENT_ATTESTATION_SIG_TYPE.system);
                    expect(consentSig.who).toBeDefined();
                    expect((_m = consentSig.who) === null || _m === void 0 ? void 0 : _m.reference).toBeDefined();
                    expect((_p = (_o = consentSig.who) === null || _o === void 0 ? void 0 : _o.reference) === null || _p === void 0 ? void 0 : _p.split('/')[0]).toBe('Practitioner');
                    expect((0, utils_1.isValidUUID)((_s = (_r = (_q = consentSig.who) === null || _q === void 0 ? void 0 : _q.reference) === null || _r === void 0 ? void 0 : _r.split('/')[1]) !== null && _s !== void 0 ? _s : '')).toBe(true);
                    expect(consentSig.when).toBeDefined();
                    when = luxon_1.DateTime.fromISO(consentSig.when).toISODate();
                    today = luxon_1.DateTime.now().toISODate();
                    expect(when).toEqual(today);
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('fails gracefully when given invalid appointment id', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, error_2, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: 'invalid',
                            bookingDetails: {
                                authorizedNonLegalGuardians: 'Cousin Sal',
                            },
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    expect(error_2.message).toBe('"appointmentId" value must be a valid UUID');
                    return [3 /*break*/, 5];
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: (0, crypto_1.randomUUID)(),
                            bookingDetails: {
                                authorizedNonLegalGuardians: 'Cousin Sal',
                            },
                        })];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    error_3 = _a.sent();
                    expect(error_3.message).toBe('The requested Appointment resource could not be found');
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('fails gracefully when no booking details are provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, error_4, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {},
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_4 = _a.sent();
                    expect(error_4.message).toBe('at least one field in bookingDetails must be provided');
                    return [3 /*break*/, 5];
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: undefined,
                        })];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    error_5 = _a.sent();
                    expect(error_5.message).toBe('The following required parameters were missing: bookingDetails');
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('fails gracefully when given invalid reason for visit', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                reasonForVisit: 'gum in my hair',
                            },
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_6 = _a.sent();
                    expect(error_6.message).toBe('reasonForVisit, "gum in my hair", is not a valid option');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('fails gracefully when given invalid additional details', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, randomIndex, reasonText, errorFound, error_7, error_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    randomIndex = Math.floor(Math.random() * utils_1.VALUE_SETS.reasonForVisitOptions.length);
                    reasonText = utils_1.VALUE_SETS.reasonForVisitOptions[randomIndex].value;
                    errorFound = false;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                reasonForVisit: reasonText,
                                additionalDetails: 7,
                            },
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_7 = _a.sent();
                    errorFound = true;
                    expect(error_7.message).toBe("additionalDetails must be a string");
                    return [3 /*break*/, 5];
                case 5:
                    expect(errorFound).toBe(true);
                    errorFound = false;
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                reasonForVisit: reasonText,
                                additionalDetails: 'A'.repeat(utils_1.REASON_ADDITIONAL_MAX_CHAR + 1),
                            },
                        })];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    error_8 = _a.sent();
                    errorFound = true;
                    expect(error_8.message).toBe("additionalDetails must be at most ".concat(utils_1.REASON_ADDITIONAL_MAX_CHAR, " characters"));
                    return [3 /*break*/, 9];
                case 9:
                    expect(errorFound).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('fails gracefully when given invalid dob', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                confirmedDob: 'not-a-date',
                            },
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_9 = _a.sent();
                    expect(error_9.message).toBe("confirmedDob, \"not-a-date\", is not a valid iso date string");
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('fails gracefully when given invalid name', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, error_10, error_11, error_12, error_13, error_14, error_15, error_16;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                patientName: {
                                    first: 'First',
                                    middle: 7,
                                    last: 'Last',
                                },
                            },
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_10 = _a.sent();
                    expect(error_10.message).toBe("\"patientName.middle\" must be a string");
                    return [3 /*break*/, 5];
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                patientName: {
                                    first: 8,
                                    middle: 'Middle',
                                    last: 'Last',
                                },
                            },
                        })];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    error_11 = _a.sent();
                    expect(error_11.message).toBe("\"patientName.first\" must be a string");
                    return [3 /*break*/, 8];
                case 8:
                    _a.trys.push([8, 10, , 11]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                patientName: {
                                    first: 'First',
                                    middle: 'Middle',
                                    last: 3,
                                },
                            },
                        })];
                case 9:
                    _a.sent();
                    return [3 /*break*/, 11];
                case 10:
                    error_12 = _a.sent();
                    expect(error_12.message).toBe("\"patientName.last\" must be a string");
                    return [3 /*break*/, 11];
                case 11:
                    _a.trys.push([11, 13, , 14]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                patientName: {},
                            },
                        })];
                case 12:
                    _a.sent();
                    return [3 /*break*/, 14];
                case 13:
                    error_13 = _a.sent();
                    expect(error_13.message).toBe("\"patientName\" must have at least one field defined");
                    return [3 /*break*/, 14];
                case 14:
                    _a.trys.push([14, 16, , 17]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                patientName: '14',
                            },
                        })];
                case 15:
                    _a.sent();
                    return [3 /*break*/, 17];
                case 16:
                    error_14 = _a.sent();
                    expect(error_14.message).toBe("\"patientName\" must be an object");
                    return [3 /*break*/, 17];
                case 17:
                    _a.trys.push([17, 19, , 20]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                patientName: {
                                    first: '',
                                    middle: '',
                                    last: 'Anderson',
                                },
                            },
                        })];
                case 18:
                    _a.sent();
                    return [3 /*break*/, 20];
                case 19:
                    error_15 = _a.sent();
                    expect(error_15.message).toBe("patientName must have a non-empty first name");
                    return [3 /*break*/, 20];
                case 20:
                    _a.trys.push([20, 22, , 23]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                patientName: {
                                    // cSpell:disable-next Anders(on)
                                    first: 'Anders',
                                    middle: '',
                                    last: '',
                                },
                            },
                        })];
                case 21:
                    _a.sent();
                    return [3 /*break*/, 23];
                case 22:
                    error_16 = _a.sent();
                    expect(error_16.message).toBe("patientName must have a non-empty last name");
                    return [3 /*break*/, 23];
                case 23: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('fails gracefully when given invalid consentForms object', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, error_17;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                consentForms: {
                                    consentAttested: 'yes',
                                },
                            },
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_17 = _a.sent();
                    expect(error_17.message).toBe("consentForms.consentAttested must be a boolean");
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('fails gracefully when given invalid authorizedNonLegalGuardians', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, error_18;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitDetails({
                            appointmentId: appointment.id,
                            bookingDetails: {
                                authorizedNonLegalGuardians: {},
                            },
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_18 = _a.sent();
                    expect(error_18.message).toBe("authorizedNonLegalGuardians must be a string");
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
});
