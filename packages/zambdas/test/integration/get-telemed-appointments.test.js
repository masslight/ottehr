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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var integration_test_seed_data_setup_1 = require("../helpers/integration-test-seed-data-setup");
var testScheduleUtils_1 = require("../helpers/testScheduleUtils");
describe('get-telemed-appointments integration tests', function () {
    var oystehrLocalZambdas;
    var oystehr;
    var cleanupAppointmentGraph;
    var virtualLocation;
    var schedule;
    var userToken;
    var processId;
    var endOfTomorrowSlotStart;
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var setup, createSlotParams, slot, patient, patientInfo, createAppointmentInputParams, createAppointmentResponse;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, integration_test_seed_data_setup_1.setupIntegrationTest)('get-telemed-appointments.test.ts', utils_1.M2MClientMockType.provider)];
                case 1:
                    setup = _a.sent();
                    oystehrLocalZambdas = setup.oystehrTestUserM2M;
                    oystehr = setup.oystehr;
                    cleanupAppointmentGraph = setup.cleanup;
                    userToken = setup.token;
                    processId = setup.processId;
                    return [4 /*yield*/, oystehr.fhir.create({
                            resourceType: 'Location',
                            status: 'active',
                            name: 'GetTelemedAppointmentsTestLocation',
                            description: 'We only just met but I will be gone soon',
                            identifier: [
                                {
                                    system: utils_1.SLUG_SYSTEM,
                                    value: "busy-slots-slimy-slug-".concat((0, crypto_1.randomUUID)()),
                                },
                            ],
                            address: {
                                state: 'FL',
                            },
                            extension: [
                                {
                                    url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
                                    valueCoding: {
                                        system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
                                        code: 'vi',
                                        display: 'Virtual',
                                    },
                                },
                            ],
                        })];
                case 2:
                    // Create a virtual location for telemed appointments
                    virtualLocation = (_a.sent());
                    return [4 /*yield*/, oystehr.fhir.create((0, integration_test_seed_data_setup_1.addProcessIdMetaTagToResource)({
                            resourceType: 'Schedule',
                            actor: [
                                {
                                    reference: "Location/".concat(virtualLocation.id),
                                },
                            ],
                            extension: [
                                {
                                    url: 'http://hl7.org/fhir/StructureDefinition/timezone',
                                    valueString: 'America/New_York',
                                },
                                {
                                    url: utils_1.SCHEDULE_EXTENSION_URL,
                                    valueString: JSON.stringify(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON),
                                },
                            ],
                        }, processId))];
                case 3:
                    // Create a Schedule
                    schedule = (_a.sent());
                    endOfTomorrowSlotStart = luxon_1.DateTime.now()
                        .setZone('America/New_York')
                        .startOf('day')
                        .plus({ days: 1, hours: 23, minutes: 45 })
                        .toISO();
                    createSlotParams = {
                        scheduleId: schedule.id,
                        serviceModality: utils_1.ServiceMode.virtual,
                        startISO: endOfTomorrowSlotStart,
                        lengthInHours: 0,
                        lengthInMinutes: 15,
                    };
                    return [4 /*yield*/, oystehrLocalZambdas.zambda.executePublic(__assign({ id: 'create-slot' }, createSlotParams))];
                case 4:
                    slot = (_a.sent()).output;
                    // Note that Slot stores start time in timezone specified by caller
                    expect(slot.start).toEqual(endOfTomorrowSlotStart);
                    return [4 /*yield*/, (0, testScheduleUtils_1.persistTestPatient)({ patient: (0, testScheduleUtils_1.makeTestPatient)(), processId: processId }, oystehr)];
                case 5:
                    patient = _a.sent();
                    patientInfo = {
                        id: patient.id,
                        firstName: patient.name[0].given[0],
                        lastName: patient.name[0].family,
                        sex: 'female',
                        email: 'okovalenko+coolPatient@masslight.com',
                        dateOfBirth: patient.birthDate,
                        newPatient: false,
                    };
                    createAppointmentInputParams = {
                        patient: patientInfo,
                        slotId: slot.id,
                    };
                    return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'create-appointment' }, createAppointmentInputParams))];
                case 6:
                    createAppointmentResponse = (_a.sent()).output;
                    // Note that appointment stores start time in UTC
                    expect(createAppointmentResponse).toBeDefined();
                    console.log('appointment start time, ', createAppointmentResponse.resources.appointment.start);
                    expect(createAppointmentResponse.resources.appointment.start).toEqual(luxon_1.DateTime.fromISO(endOfTomorrowSlotStart).setZone('UTC').toISO());
                    return [4 /*yield*/, oystehr.fhir.update(__assign({}, (0, integration_test_seed_data_setup_1.addProcessIdMetaTagToResource)(createAppointmentResponse.resources.appointment, processId)))];
                case 7:
                    _a.sent();
                    expect(createAppointmentResponse).toBeDefined();
                    expect(createAppointmentResponse.appointmentId).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); }, 60000);
    afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Cleaning up');
                    if (!(virtualLocation && virtualLocation.id)) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehr.fhir.delete({
                            resourceType: 'Location',
                            id: virtualLocation.id,
                        })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    if (!(schedule && schedule.id)) return [3 /*break*/, 4];
                    return [4 /*yield*/, oystehr.fhir.delete({
                            resourceType: 'Schedule',
                            id: schedule.id,
                        })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [4 /*yield*/, cleanupAppointmentGraph()];
                case 5:
                    _a.sent();
                    console.log('Clean up complete');
                    return [2 /*return*/];
            }
        });
    }); });
    describe('get-telemed-appointments happy paths', function () {
        it('should get all telemed appointments for today NY time with location and date filter and find zero appointments -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getTelemedAppointmentsInput, getTelemedAppointmentsOutput, error_1, typedOutput;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getTelemedAppointmentsInput = {
                            patientFilter: 'all-patients',
                            statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
                            locationsIdsFilter: [virtualLocation.id], // We need the location filter for the location we just made so we don't get stuff from other tests
                            dateFilter: luxon_1.DateTime.now().setZone('America/New_York').toFormat('yyyy-MM-dd'), // "Today" in New York time
                            timeZone: 'America/New_York',
                            userToken: userToken,
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-TELEMED-APPOINTMENTS' }, getTelemedAppointmentsInput))];
                    case 2:
                        getTelemedAppointmentsOutput = (_a.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Error executing zambda:', error_1);
                        getTelemedAppointmentsOutput = error_1;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
                        typedOutput = getTelemedAppointmentsOutput;
                        expect(typedOutput).toBeDefined();
                        expect(typedOutput).toHaveProperty('message');
                        expect(typedOutput).toHaveProperty('appointments');
                        expect(typedOutput.appointments).toBeInstanceOf(Array);
                        expect(typedOutput.appointments.length).toEqual(0);
                        expect(typedOutput.message).toBe('Successfully retrieved all appointments');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should get appointments for tomorrow NY time, find one, and validate shape of telemed appointment information -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getTelemedAppointmentsInput, getTelemedAppointmentsOutput, error_2, typedOutput, appointment, validStatuses;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getTelemedAppointmentsInput = {
                            patientFilter: 'all-patients',
                            statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
                            locationsIdsFilter: [virtualLocation.id],
                            dateFilter: luxon_1.DateTime.now().plus({ days: 1 }).setZone('America/New_York').toFormat('yyyy-MM-dd'),
                            timeZone: 'America/New_York',
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-TELEMED-APPOINTMENTS' }, getTelemedAppointmentsInput))];
                    case 2:
                        getTelemedAppointmentsOutput = (_a.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error('Error executing zambda:', error_2);
                        getTelemedAppointmentsOutput = error_2;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
                        typedOutput = getTelemedAppointmentsOutput;
                        expect(typedOutput).toBeDefined();
                        expect(typedOutput.appointments).toBeInstanceOf(Array);
                        expect(typedOutput.appointments.length).toEqual(1);
                        appointment = typedOutput.appointments[0];
                        expect(appointment).toMatchObject({
                            id: expect.any(String),
                            start: luxon_1.DateTime.fromISO(endOfTomorrowSlotStart).setZone('UTC').toISO(),
                            patient: expect.objectContaining({
                                id: expect.any(String),
                                firstName: expect.any(String),
                                lastName: expect.any(String),
                                dateOfBirth: expect.any(String),
                            }),
                            telemedStatus: expect.any(String),
                            telemedStatusHistory: expect.any(Array),
                            appointmentStatus: expect.any(String),
                            locationVirtual: expect.objectContaining({
                                id: expect.any(String),
                                resourceType: 'Location',
                            }),
                            encounterId: expect.any(String),
                        });
                        validStatuses = [
                            'ready',
                            'pre-video',
                            'on-video',
                            'unsigned',
                            'complete',
                            'cancelled',
                        ];
                        expect(validStatuses).toContain(appointment.telemedStatus);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should get appointments for tomorrow in Bermuda time and not find any -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getTelemedAppointmentsInput, getTelemedAppointmentsOutput, error_3, typedOutput;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getTelemedAppointmentsInput = {
                            patientFilter: 'all-patients',
                            statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
                            locationsIdsFilter: [virtualLocation.id],
                            dateFilter: luxon_1.DateTime.now().setZone('America/New_York').startOf('day').plus({ days: 1 }).toFormat('yyyy-MM-dd'),
                            timeZone: 'Atlantic/Bermuda',
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-TELEMED-APPOINTMENTS' }, getTelemedAppointmentsInput))];
                    case 2:
                        getTelemedAppointmentsOutput = (_a.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        console.error('Error executing zambda:', error_3);
                        getTelemedAppointmentsOutput = error_3;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
                        typedOutput = getTelemedAppointmentsOutput;
                        expect(typedOutput).toBeDefined();
                        expect(typedOutput.appointments).toBeInstanceOf(Array);
                        expect(typedOutput.appointments.length).toEqual(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
