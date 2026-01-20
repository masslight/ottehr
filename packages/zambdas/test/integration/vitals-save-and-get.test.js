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
var secrets_1 = require("../data/secrets");
var configureTestM2MClient_1 = require("../helpers/configureTestM2MClient");
var testScheduleUtils_1 = require("../helpers/testScheduleUtils");
var DEFAULT_SUITE_TIMEOUT = 90000;
describe('saving and getting vitals', function () {
    var oystehr;
    var token;
    var processId;
    var makeTestResources = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientId, testPatient, partialPatient, now_1, birthDate, now, appointment, batchInputApp, encounter, batchInputEnc, batchResults, createdEncounter, createdAppointment, error_1;
        var _c;
        var _d;
        var processId = _b.processId, oystehr = _b.oystehr, _e = _b.addDays, addDays = _e === void 0 ? 0 : _e, patientAge = _b.patientAge, existingPatientId = _b.existingPatientId, patientSex = _b.patientSex;
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
                    _f.trys.push([3, 5, , 6]);
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
                    return [2 /*return*/, { encounter: createdEncounter, patient: testPatient }];
                case 5:
                    error_1 = _f.sent();
                    expect(error_1).toBeUndefined();
                    throw new Error("Error creating test resources: ".concat(error_1));
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var saveVital = function (obs, encounterId) { return __awaiter(void 0, void 0, void 0, function () {
        var payload, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    payload = {
                        encounterId: encounterId,
                        vitalsObservations: obs,
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: 'save-chart-data' }, payload))];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    expect(error_2).toBeUndefined();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var getVitals = function (encounterId) { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.zambda.execute({
                        id: 'get-vitals',
                        encounterId: encounterId,
                        mode: 'current',
                    })];
                case 1:
                    response = (_a.sent()).output;
                    return [2 /*return*/, response];
            }
        });
    }); };
    var getHistoricVitals = function (encounterId) { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.zambda.execute({
                        id: 'get-vitals',
                        encounterId: encounterId,
                        mode: 'historical',
                    })];
                case 1:
                    response = (_a.sent()).output;
                    return [2 /*return*/, response];
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
    (0, vitest_1.suite)('writing vitals observations that dont rise to alert thresholds produces vitals DTOs with no alerts', function () { return __awaiter(void 0, void 0, void 0, function () {
        var encounterId, patientId;
        return __generator(this, function (_a) {
            beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, maybeEncounter, maybePatient, obs;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, makeTestResources({
                                processId: processId,
                                oystehr: oystehr,
                                addDays: 1,
                            })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 72,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeight,
                                    value: 170,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalWeight,
                                    value: 70,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 20,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalVision,
                                    leftEyeVisionText: '20',
                                    rightEyeVisionText: '20',
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalBloodPressure,
                                    systolicPressure: 120,
                                    diastolicPressure: 80,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalOxygenSaturation,
                                    value: 98,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalTemperature,
                                    value: 37,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('saving normal heart beat observation succeeds with no alerts', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, heartbeatVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            heartbeatVitals = vitals[utils_1.VitalFieldNames.VitalHeartbeat];
                            expect(heartbeatVitals.length).toBe(1);
                            expect(heartbeatVitals[0].field).toBe(utils_1.VitalFieldNames.VitalHeartbeat);
                            expect(heartbeatVitals[0].value).toBe(72);
                            expect(heartbeatVitals[0].alertCriticality).toBeUndefined();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('saving height and weight observations succeeds with no alerts', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, weightVitals, heightVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            weightVitals = vitals[utils_1.VitalFieldNames.VitalWeight];
                            expect(weightVitals.length).toBe(1);
                            expect(weightVitals[0].field).toBe(utils_1.VitalFieldNames.VitalWeight);
                            expect(weightVitals[0].value).toBe(70);
                            expect(weightVitals[0].alertCriticality).toBeUndefined();
                            heightVitals = vitals[utils_1.VitalFieldNames.VitalHeight];
                            expect(heightVitals.length).toBe(1);
                            expect(heightVitals[0].field).toBe(utils_1.VitalFieldNames.VitalHeight);
                            expect(heightVitals[0].value).toBe(170);
                            expect(heightVitals[0].alertCriticality).toBeUndefined();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('respiration rate observation is saved and retrieved correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, respirationRateVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            respirationRateVitals = vitals[utils_1.VitalFieldNames.VitalRespirationRate];
                            expect(respirationRateVitals.length).toBe(1);
                            expect(respirationRateVitals[0].field).toBe(utils_1.VitalFieldNames.VitalRespirationRate);
                            expect(respirationRateVitals[0].value).toBe(20);
                            expect(respirationRateVitals[0].alertCriticality).toBeUndefined();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('vision observation is saved and retrieved correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, visionVitals, visionVital, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            console.log('Starting vision test for encounterId:', encounterId);
                            console.time('vision-test');
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, 4, 5]);
                            console.log('Calling getVitals...');
                            console.time('getVitals-call');
                            return [4 /*yield*/, getVitals(encounterId)];
                        case 2:
                            vitals = _a.sent();
                            console.timeEnd('getVitals-call');
                            console.log('Got vitals response, checking structure...');
                            expect(vitals).toBeDefined();
                            console.log('Looking for VitalVision data...');
                            console.log('Available vital keys:', Object.keys(vitals));
                            visionVitals = vitals[utils_1.VitalFieldNames.VitalVision];
                            console.log('VitalVision data:', visionVitals);
                            if (!visionVitals) {
                                console.error('No vision vitals found!');
                                console.log('Full vitals object:', JSON.stringify(vitals, null, 2));
                            }
                            expect(visionVitals).toBeDefined();
                            expect(visionVitals.length).toBe(1);
                            console.log('Checking vision vital details...');
                            visionVital = visionVitals[0];
                            console.log('Vision vital object:', visionVital);
                            expect(visionVital.field).toBe(utils_1.VitalFieldNames.VitalVision);
                            expect(visionVital.leftEyeVisionText).toBe('20');
                            expect(visionVital.rightEyeVisionText).toBe('20');
                            expect(visionVital.alertCriticality).toBeUndefined();
                            console.log('Vision test completed successfully');
                            return [3 /*break*/, 5];
                        case 3:
                            error_3 = _a.sent();
                            console.error('Vision test failed with error:', error_3);
                            console.error('Error stack:', error_3 === null || error_3 === void 0 ? void 0 : error_3.stack);
                            throw error_3;
                        case 4:
                            console.timeEnd('vision-test');
                            return [7 /*endfinally*/];
                        case 5: return [2 /*return*/];
                    }
                });
            }); }, 120000);
            test.concurrent('blood pressure observation is saved and retrieved correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, bloodPressureVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            bloodPressureVitals = vitals[utils_1.VitalFieldNames.VitalBloodPressure];
                            expect(bloodPressureVitals.length).toBe(1);
                            expect(bloodPressureVitals[0].field).toBe(utils_1.VitalFieldNames.VitalBloodPressure);
                            expect(bloodPressureVitals[0].systolicPressure).toBe(120);
                            expect(bloodPressureVitals[0].diastolicPressure).toBe(80);
                            expect(bloodPressureVitals[0].alertCriticality).toBeUndefined();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('oxygen saturation observation is saved and retrieved correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, oxygenSaturationVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            oxygenSaturationVitals = vitals[utils_1.VitalFieldNames.VitalOxygenSaturation];
                            expect(oxygenSaturationVitals.length).toBe(1);
                            expect(oxygenSaturationVitals[0].field).toBe(utils_1.VitalFieldNames.VitalOxygenSaturation);
                            expect(oxygenSaturationVitals[0].value).toBe(98);
                            expect(oxygenSaturationVitals[0].alertCriticality).toBeUndefined();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('temperature observation is saved and retrieved correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, temperatureVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            temperatureVitals = vitals[utils_1.VitalFieldNames.VitalTemperature];
                            expect(temperatureVitals.length).toBe(1);
                            expect(temperatureVitals[0].field).toBe(utils_1.VitalFieldNames.VitalTemperature);
                            expect(temperatureVitals[0].value).toBe(37);
                            expect(temperatureVitals[0].alertCriticality).toBeUndefined();
                            return [2 /*return*/];
                    }
                });
            }); });
            test('historical vitals do not include current encounter vitals, but do include previous encounter vitals', function () { return __awaiter(void 0, void 0, void 0, function () {
                var originalVitals, vitals, allEntries, _a, maybeEncounter, maybePatient, newEncounterId, newEncounterVitals, newAllEntries, newHistoricVitals;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            originalVitals = _b.sent();
                            return [4 /*yield*/, getHistoricVitals(encounterId)];
                        case 2:
                            vitals = _b.sent();
                            expect(vitals).toBeDefined();
                            allEntries = Object.values(vitals).flat();
                            expect(allEntries).toHaveLength(0);
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    addDays: 1,
                                    existingPatientId: patientId,
                                })];
                        case 3:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient).toBeUndefined();
                            newEncounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            (0, vitest_1.assert)(newEncounterId);
                            return [4 /*yield*/, getVitals(newEncounterId)];
                        case 4:
                            newEncounterVitals = _b.sent();
                            expect(newEncounterVitals).toBeDefined();
                            newAllEntries = Object.values(newEncounterVitals).flat();
                            expect(newAllEntries).toHaveLength(0);
                            return [4 /*yield*/, getHistoricVitals(newEncounterId)];
                        case 5:
                            newHistoricVitals = _b.sent();
                            expect(newHistoricVitals).toBeDefined();
                            expect(newHistoricVitals).toEqual(originalVitals);
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    }); }, { timeout: DEFAULT_SUITE_TIMEOUT });
    (0, vitest_1.suite)('writing vitals observations for 0-2 month old patients that do rise to alert threshold level produce vitals DTOs with alerts', function () { return __awaiter(void 0, void 0, void 0, function () {
        var encounterId, patientId;
        return __generator(this, function (_a) {
            beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, obs;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 1 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            // expect(maybePatient.birthDate).toBe('1234567890'); // should be set by makeTestResources
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                // too high heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 201,
                                },
                                // too low heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 99.5,
                                },
                                // too high temperature
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalTemperature,
                                    value: 38.5,
                                },
                                // too low temperature
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalTemperature,
                                    value: 36.4,
                                },
                                // too high respiration rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 61,
                                },
                                // too low respiration rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 24,
                                },
                                // too low oxygen saturation
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalOxygenSaturation,
                                    value: 93,
                                },
                                // too low systolic blood pressure
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalBloodPressure,
                                    systolicPressure: 58,
                                    diastolicPressure: 40,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, heartbeatVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            heartbeatVitals = vitals[utils_1.VitalFieldNames.VitalHeartbeat];
                            expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
                            heartbeatVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeartbeat);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal respiration rate observation has abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, respirationRateVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            respirationRateVitals = vitals[utils_1.VitalFieldNames.VitalRespirationRate];
                            expect(respirationRateVitals.length).toBeGreaterThanOrEqual(1);
                            respirationRateVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalRespirationRate);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal blood pressure observation has abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, bloodPressureVitals, observationId, observation, systolicComponent, interpretation, diastolicComponent;
                var _a, _b, _c, _d, _e, _f, _g, _h;
                return __generator(this, function (_j) {
                    switch (_j.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _j.sent();
                            expect(vitals).toBeDefined();
                            bloodPressureVitals = vitals[utils_1.VitalFieldNames.VitalBloodPressure];
                            expect(bloodPressureVitals.length).toBeGreaterThanOrEqual(1);
                            bloodPressureVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalBloodPressure);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            observationId = bloodPressureVitals[0].resourceId;
                            return [4 /*yield*/, oystehr.fhir.get({ resourceType: 'Observation', id: observationId })];
                        case 2:
                            observation = _j.sent();
                            expect(observation).toBeDefined();
                            expect(observation.component).toBeDefined();
                            systolicComponent = (_a = observation.component) === null || _a === void 0 ? void 0 : _a.find(function (c) {
                                var _a, _b;
                                return (_b = (_a = c.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === utils_1.VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE && coding.system === utils_1.LOINC_SYSTEM; });
                            });
                            expect(systolicComponent).toBeDefined();
                            expect((_b = systolicComponent === null || systolicComponent === void 0 ? void 0 : systolicComponent.valueQuantity) === null || _b === void 0 ? void 0 : _b.value).toBe(58);
                            (0, vitest_1.assert)(systolicComponent);
                            interpretation = systolicComponent.interpretation;
                            expect(interpretation).toBeDefined();
                            (0, vitest_1.assert)(interpretation);
                            expect((_d = (_c = interpretation === null || interpretation === void 0 ? void 0 : interpretation[0].coding) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.code).toBe('LX');
                            expect((_f = (_e = interpretation === null || interpretation === void 0 ? void 0 : interpretation[0].coding) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.system).toBe(utils_1.FHIRObservationInterpretationSystem);
                            diastolicComponent = (_g = observation.component) === null || _g === void 0 ? void 0 : _g.find(function (c) {
                                var _a, _b;
                                return (_b = (_a = c.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === utils_1.VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE && coding.system === utils_1.LOINC_SYSTEM; });
                            });
                            expect(diastolicComponent).toBeDefined();
                            expect((_h = diastolicComponent === null || diastolicComponent === void 0 ? void 0 : diastolicComponent.valueQuantity) === null || _h === void 0 ? void 0 : _h.value).toBe(40);
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal oxygen saturation observation has abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, oxygenSaturationVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            oxygenSaturationVitals = vitals[utils_1.VitalFieldNames.VitalOxygenSaturation];
                            expect(oxygenSaturationVitals.length).toBeGreaterThanOrEqual(1);
                            oxygenSaturationVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalOxygenSaturation);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal temperature vitals have abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, temperatureVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            temperatureVitals = vitals[utils_1.VitalFieldNames.VitalTemperature];
                            expect(temperatureVitals.length).toBeGreaterThanOrEqual(1);
                            temperatureVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalTemperature);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    }); }, { timeout: DEFAULT_SUITE_TIMEOUT });
    (0, vitest_1.suite)('writing vitals observations for 2-12 month old patients that do rise to alert threshold level produce vitals DTOs with alerts', function () { return __awaiter(void 0, void 0, void 0, function () {
        var encounterId, patientId;
        return __generator(this, function (_a) {
            beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, obs;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 10 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            // expect(maybePatient.birthDate).toBe('1234567890'); // should be set by makeTestResources
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                // too high heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 161,
                                },
                                // too low heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 79.5,
                                },
                                // too high temperature
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalTemperature,
                                    value: 38.5,
                                },
                                // too low temperature
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalTemperature,
                                    value: 35.9,
                                },
                                // too low systolic blood pressure
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalBloodPressure,
                                    systolicPressure: 68.9,
                                    diastolicPressure: 40,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, heartbeatVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            heartbeatVitals = vitals[utils_1.VitalFieldNames.VitalHeartbeat];
                            expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
                            heartbeatVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeartbeat);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal blood pressure observation has abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, bloodPressureVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            bloodPressureVitals = vitals[utils_1.VitalFieldNames.VitalBloodPressure];
                            expect(bloodPressureVitals.length).toBeGreaterThanOrEqual(1);
                            bloodPressureVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalBloodPressure);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal temperature vitals have abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, temperatureVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            temperatureVitals = vitals[utils_1.VitalFieldNames.VitalTemperature];
                            expect(temperatureVitals.length).toBeGreaterThanOrEqual(1);
                            temperatureVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalTemperature);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    }); }, { timeout: DEFAULT_SUITE_TIMEOUT });
    (0, vitest_1.suite)('writing vitals observations for 12-36 month old patients that do rise to alert threshold level produce vitals DTOs with alerts', function () { return __awaiter(void 0, void 0, void 0, function () {
        var encounterId, patientId;
        return __generator(this, function (_a) {
            beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, obs;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 24 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                // too high heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 150.5,
                                },
                                // too low heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 69,
                                },
                                /*
                                 { type: 'min', units: '', value: 20 },
                                { type: 'max', units: '', value: 50 },
                                */
                                // respiration rate is too high
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 50.5,
                                },
                                // respiration rate is too low
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 17.9,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, heartbeatVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            heartbeatVitals = vitals[utils_1.VitalFieldNames.VitalHeartbeat];
                            expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
                            heartbeatVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeartbeat);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal respiration rate observation has abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, respirationRateVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            respirationRateVitals = vitals[utils_1.VitalFieldNames.VitalRespirationRate];
                            expect(respirationRateVitals.length).toBeGreaterThanOrEqual(1);
                            respirationRateVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalRespirationRate);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    }); }, { timeout: DEFAULT_SUITE_TIMEOUT });
    (0, vitest_1.suite)('writing vitals observations for 12-36 month old patients that do rise to alert threshold level produce vitals DTOs with alerts', function () { return __awaiter(void 0, void 0, void 0, function () {
        var encounterId, patientId;
        return __generator(this, function (_a) {
            beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, obs;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 70 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                // too high heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 150.5,
                                },
                                // too low heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 50.9,
                                },
                                // respiration rate is too high
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 40.5,
                                },
                                // respiration rate is too low
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 17.5,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, heartbeatVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            heartbeatVitals = vitals[utils_1.VitalFieldNames.VitalHeartbeat];
                            expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
                            heartbeatVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeartbeat);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal respiration rate observation has abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, respirationRateVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            respirationRateVitals = vitals[utils_1.VitalFieldNames.VitalRespirationRate];
                            expect(respirationRateVitals.length).toBeGreaterThanOrEqual(1);
                            respirationRateVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalRespirationRate);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    }); }, { timeout: DEFAULT_SUITE_TIMEOUT });
    (0, vitest_1.suite)('writing vitals observations for 72-108 month old patients that do rise to alert threshold level produce vitals DTOs with alerts', function () { return __awaiter(void 0, void 0, void 0, function () {
        var encounterId, patientId;
        return __generator(this, function (_a) {
            beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, obs;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 98 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                // too high heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 140.5,
                                },
                                // too low heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 59.9,
                                },
                                // respiration rate is too high
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 40.1,
                                },
                                // respiration rate is too low
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 14.9,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalBloodPressure,
                                    systolicPressure: 80.9,
                                    diastolicPressure: 80,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, heartbeatVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            heartbeatVitals = vitals[utils_1.VitalFieldNames.VitalHeartbeat];
                            expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
                            heartbeatVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeartbeat);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal respiration rate observation has abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, respirationRateVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            respirationRateVitals = vitals[utils_1.VitalFieldNames.VitalRespirationRate];
                            expect(respirationRateVitals.length).toBeGreaterThanOrEqual(1);
                            respirationRateVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalRespirationRate);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    }); }, { timeout: DEFAULT_SUITE_TIMEOUT });
    (0, vitest_1.suite)('writing vitals observations for 108-144 month old patients that do rise to alert threshold level produce vitals DTOs with alerts', function () { return __awaiter(void 0, void 0, void 0, function () {
        var encounterId, patientId;
        return __generator(this, function (_a) {
            beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, obs;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 120 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                // too high heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 130.5,
                                },
                                // too low heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 59.9,
                                },
                                // respiration rate is too high
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 30.1,
                                },
                                // respiration rate is too low
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 14.9,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalBloodPressure,
                                    systolicPressure: 83.9,
                                    diastolicPressure: 80,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, heartbeatVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            heartbeatVitals = vitals[utils_1.VitalFieldNames.VitalHeartbeat];
                            expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
                            heartbeatVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeartbeat);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal blood pressure observation has abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, bloodPressureVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            bloodPressureVitals = vitals[utils_1.VitalFieldNames.VitalBloodPressure];
                            expect(bloodPressureVitals.length).toBeGreaterThanOrEqual(1);
                            bloodPressureVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalBloodPressure);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    }); }, { timeout: DEFAULT_SUITE_TIMEOUT });
    (0, vitest_1.suite)('writing vitals observations for 144+ month old patients that do rise to alert threshold level produce vitals DTOs with alerts', function () { return __awaiter(void 0, void 0, void 0, function () {
        var encounterId, patientId;
        return __generator(this, function (_a) {
            beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, obs;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 144 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                // too high heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 130.5,
                                },
                                // too low heart rate
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                                    value: 59.9,
                                },
                                // respiration rate is too high
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 30.1,
                                },
                                // respiration rate is too low
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalRespirationRate,
                                    value: 9.9,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', function () { return __awaiter(void 0, void 0, void 0, function () {
                var vitals, heartbeatVitals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getVitals(encounterId)];
                        case 1:
                            vitals = _a.sent();
                            expect(vitals).toBeDefined();
                            heartbeatVitals = vitals[utils_1.VitalFieldNames.VitalHeartbeat];
                            expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
                            heartbeatVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeartbeat);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    }); }, { timeout: DEFAULT_SUITE_TIMEOUT });
    (0, vitest_1.suite)('writing weight/height vitals observations alert when appropriate but not otherwise', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            test.concurrent('male patient younger than 24 months presents no alert for typical vitals', function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, encounterId, patientId, obs, vitals, heightVitals, weightVitals;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 14 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                    patientSex: 'male',
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalWeight,
                                    value: 10,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeight,
                                    value: 80,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, getVitals(encounterId)];
                        case 3:
                            vitals = _b.sent();
                            expect(vitals).toBeDefined();
                            heightVitals = vitals[utils_1.VitalFieldNames.VitalHeight];
                            expect(heightVitals.length).toBeGreaterThanOrEqual(1);
                            heightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeight);
                                expect(vital.alertCriticality).toBeUndefined();
                            });
                            weightVitals = vitals[utils_1.VitalFieldNames.VitalWeight];
                            expect(weightVitals.length).toBeGreaterThanOrEqual(1);
                            weightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalWeight);
                                expect(vital.alertCriticality).toBeUndefined();
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('female patient younger than 24 months presents no alert for typical vitals', function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, encounterId, patientId, obs, vitals, heightVitals, weightVitals;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 14 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                    patientSex: 'female',
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalWeight,
                                    value: 9,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeight,
                                    value: 78,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, getVitals(encounterId)];
                        case 3:
                            vitals = _b.sent();
                            expect(vitals).toBeDefined();
                            heightVitals = vitals[utils_1.VitalFieldNames.VitalHeight];
                            expect(heightVitals.length).toBeGreaterThanOrEqual(1);
                            heightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeight);
                                expect(vital.alertCriticality).toBeUndefined();
                            });
                            weightVitals = vitals[utils_1.VitalFieldNames.VitalWeight];
                            expect(weightVitals.length).toBeGreaterThanOrEqual(1);
                            weightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalWeight);
                                expect(vital.alertCriticality).toBeUndefined();
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('male patient older than 240 months triggers alert when vitals are extremely low', function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, encounterId, patientId, obs, vitals, heightVitals, weightVitals;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 241 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                    patientSex: 'male',
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalWeight,
                                    value: 3,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeight,
                                    value: 5,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, getVitals(encounterId)];
                        case 3:
                            vitals = _b.sent();
                            expect(vitals).toBeDefined();
                            heightVitals = vitals[utils_1.VitalFieldNames.VitalHeight];
                            expect(heightVitals.length).toBe(1);
                            heightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            weightVitals = vitals[utils_1.VitalFieldNames.VitalWeight];
                            expect(weightVitals.length).toBeGreaterThanOrEqual(1);
                            weightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalWeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('female patient older than 240 months triggers alert when vitals are extremely low', function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, encounterId, patientId, obs, vitals, heightVitals, weightVitals;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 241 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                    patientSex: 'female',
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalWeight,
                                    value: 3,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeight,
                                    value: 5,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, getVitals(encounterId)];
                        case 3:
                            vitals = _b.sent();
                            expect(vitals).toBeDefined();
                            heightVitals = vitals[utils_1.VitalFieldNames.VitalHeight];
                            expect(heightVitals.length).toBeGreaterThanOrEqual(1);
                            heightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            weightVitals = vitals[utils_1.VitalFieldNames.VitalWeight];
                            expect(weightVitals.length).toBeGreaterThanOrEqual(1);
                            weightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalWeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('male patient within mid-90 percentiles for weight and height presents no alert', function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, encounterId, patientId, obs, vitals, heightVitals, weightVitals;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 36 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                    patientSex: 'male',
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalWeight,
                                    value: 15,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeight,
                                    value: 94,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, getVitals(encounterId)];
                        case 3:
                            vitals = _b.sent();
                            expect(vitals).toBeDefined();
                            heightVitals = vitals[utils_1.VitalFieldNames.VitalHeight];
                            expect(heightVitals.length).toBe(1);
                            heightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeight);
                                expect(vital.alertCriticality).toBeUndefined();
                            });
                            weightVitals = vitals[utils_1.VitalFieldNames.VitalWeight];
                            expect(weightVitals.length).toBeGreaterThanOrEqual(1);
                            weightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalWeight);
                                expect(vital.alertCriticality).toBeUndefined();
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('female patient within mid-90 percentiles for weight and height presents no alert', function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, encounterId, patientId, obs, vitals, heightVitals, weightVitals;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 241 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                    patientSex: 'female',
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalWeight,
                                    value: 70,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeight,
                                    value: 170,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, getVitals(encounterId)];
                        case 3:
                            vitals = _b.sent();
                            expect(vitals).toBeDefined();
                            heightVitals = vitals[utils_1.VitalFieldNames.VitalHeight];
                            expect(heightVitals.length).toBeGreaterThanOrEqual(1);
                            heightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeight);
                                expect(vital.alertCriticality).toBeUndefined();
                            });
                            weightVitals = vitals[utils_1.VitalFieldNames.VitalWeight];
                            expect(weightVitals.length).toBeGreaterThanOrEqual(1);
                            weightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalWeight);
                                expect(vital.alertCriticality).toBeUndefined();
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('male patient under 5th percentile for weight produces alert', function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, encounterId, patientId, obs, vitals, heightVitals, weightVitals;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 36 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                    patientSex: 'male',
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalWeight,
                                    value: 11,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeight,
                                    value: 86,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, getVitals(encounterId)];
                        case 3:
                            vitals = _b.sent();
                            expect(vitals).toBeDefined();
                            heightVitals = vitals[utils_1.VitalFieldNames.VitalHeight];
                            expect(heightVitals.length).toBeGreaterThanOrEqual(1);
                            heightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            weightVitals = vitals[utils_1.VitalFieldNames.VitalWeight];
                            expect(weightVitals.length).toBeGreaterThanOrEqual(1);
                            weightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalWeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('female patient under 5th percentile for weight produces alert', function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, encounterId, patientId, obs, vitals, heightVitals, weightVitals;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 36 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                    patientSex: 'female',
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalWeight,
                                    value: 10.5,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeight,
                                    value: 85.5,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, getVitals(encounterId)];
                        case 3:
                            vitals = _b.sent();
                            expect(vitals).toBeDefined();
                            heightVitals = vitals[utils_1.VitalFieldNames.VitalHeight];
                            expect(heightVitals.length).toBeGreaterThanOrEqual(1);
                            heightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            weightVitals = vitals[utils_1.VitalFieldNames.VitalWeight];
                            expect(weightVitals.length).toBeGreaterThanOrEqual(1);
                            weightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalWeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('male patient over 95th percentile for weight produces alert', function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, encounterId, patientId, obs, vitals, heightVitals, weightVitals;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 36 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                    patientSex: 'male',
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalWeight,
                                    value: 21,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeight,
                                    value: 110,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, getVitals(encounterId)];
                        case 3:
                            vitals = _b.sent();
                            expect(vitals).toBeDefined();
                            heightVitals = vitals[utils_1.VitalFieldNames.VitalHeight];
                            expect(heightVitals.length).toBeGreaterThanOrEqual(1);
                            heightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            weightVitals = vitals[utils_1.VitalFieldNames.VitalWeight];
                            expect(weightVitals.length).toBeGreaterThanOrEqual(1);
                            weightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalWeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            test.concurrent('female patient over 95th percentile for weight produces alert', function () { return __awaiter(void 0, void 0, void 0, function () {
                var patientAge, _a, maybeEncounter, maybePatient, encounterId, patientId, obs, vitals, heightVitals, weightVitals;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            patientAge = { units: 'months', value: 36 };
                            return [4 /*yield*/, makeTestResources({
                                    processId: processId,
                                    oystehr: oystehr,
                                    patientAge: patientAge,
                                    patientSex: 'female',
                                })];
                        case 1:
                            _a = _b.sent(), maybeEncounter = _a.encounter, maybePatient = _a.patient;
                            expect(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id).toBeDefined();
                            expect(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id).toBeDefined();
                            (0, vitest_1.assert)(maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id);
                            (0, vitest_1.assert)(maybePatient === null || maybePatient === void 0 ? void 0 : maybePatient.id);
                            encounterId = maybeEncounter === null || maybeEncounter === void 0 ? void 0 : maybeEncounter.id;
                            patientId = maybePatient.id;
                            obs = [
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalWeight,
                                    value: 21,
                                },
                                {
                                    encounterId: encounterId,
                                    patientId: patientId,
                                    field: utils_1.VitalFieldNames.VitalHeight,
                                    value: 110,
                                },
                            ];
                            return [4 /*yield*/, saveVital(obs, encounterId)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, getVitals(encounterId)];
                        case 3:
                            vitals = _b.sent();
                            expect(vitals).toBeDefined();
                            heightVitals = vitals[utils_1.VitalFieldNames.VitalHeight];
                            expect(heightVitals.length).toBeGreaterThanOrEqual(1);
                            heightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalHeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            weightVitals = vitals[utils_1.VitalFieldNames.VitalWeight];
                            expect(weightVitals.length).toBeGreaterThanOrEqual(1);
                            weightVitals.forEach(function (vital) {
                                expect(vital.field).toBe(utils_1.VitalFieldNames.VitalWeight);
                                expect(vital.alertCriticality).toBe('abnormal');
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    }); }, { timeout: DEFAULT_SUITE_TIMEOUT });
});
