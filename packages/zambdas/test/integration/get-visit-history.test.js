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
var sdk_1 = require("@oystehr/sdk");
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var shared_1 = require("../../src/shared");
var secrets_1 = require("../data/secrets");
var configureTestM2MClient_1 = require("../helpers/configureTestM2MClient");
var testScheduleUtils_1 = require("../helpers/testScheduleUtils");
var validateCreateAppointmentResponse = function (input) {
    var _a, _b;
    var createAppointmentResponse = input.createAppointmentResponse, timezone = input.timezone, patient = input.patient, slot = input.slot;
    (0, vitest_1.assert)(createAppointmentResponse);
    var appointmentId = createAppointmentResponse.appointmentId, fhirPatientId = createAppointmentResponse.fhirPatientId, questionnaireResponseId = createAppointmentResponse.questionnaireResponseId, encounterId = createAppointmentResponse.encounterId, resources = createAppointmentResponse.resources;
    (0, vitest_1.assert)(appointmentId);
    (0, vitest_1.assert)(fhirPatientId);
    (0, vitest_1.assert)(questionnaireResponseId);
    (0, vitest_1.assert)(encounterId);
    (0, vitest_1.assert)(resources);
    var appointment = resources.appointment, encounter = resources.encounter, questionnaire = resources.questionnaire, fhirPatient = resources.patient;
    (0, vitest_1.assert)(appointment);
    (0, vitest_1.assert)(appointment.id);
    expect(appointment.id).toEqual(appointmentId);
    var isWalkin = (0, utils_1.getSlotIsWalkin)(slot);
    var isPostTelemed = (0, utils_1.getSlotIsPostTelemed)(slot);
    var isVirtual = (0, utils_1.checkEncounterIsVirtual)(encounter);
    // this really should be 'booked' for all but there is a known issue https://github.com/masslight/ottehr/issues/2431
    // todo: change the check to 'booked' once the issue with virtual appointments is resolved
    expect(appointment.status).toEqual(isVirtual || isWalkin ? 'arrived' : 'booked');
    (0, vitest_1.assert)(appointment.start);
    if (isWalkin) {
        var appointmentTimeStamp = luxon_1.DateTime.fromISO(appointment.start, { zone: timezone }).toUnixInteger();
        var slotTimeStamp = luxon_1.DateTime.fromISO(slot.start).toUnixInteger();
        var timeDiff = appointmentTimeStamp - slotTimeStamp;
        // start time is calculated on the fly in the create-appointment zambda, expecting the appointment
        // time to be within 10 seconds of the slot start time should be adequate precision here
        expect(timeDiff).toBeGreaterThanOrEqual(0);
        expect(timeDiff).toBeLessThanOrEqual(10);
    }
    else {
        expect(luxon_1.DateTime.fromISO(appointment.start, { zone: timezone }).toISO()).toEqual(slot.start);
    }
    expect((_b = (_a = appointment.slot) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference).toEqual("Slot/".concat(slot.id));
    (0, vitest_1.assert)(encounter);
    (0, vitest_1.assert)(encounter.id);
    // todo: should encounter status be 'arrived' for walkin virtual appointments to match the appointment status?
    // i think this is intended and helps with some intake logic particular to the virtual walkin flow
    if (isWalkin && !isVirtual) {
        expect(encounter.status).toEqual('arrived');
    }
    else {
        expect(encounter.status).toEqual('planned');
    }
    expect((0, utils_1.checkEncounterIsVirtual)(encounter)).toEqual(isVirtual);
    (0, vitest_1.assert)(questionnaire);
    (0, vitest_1.assert)(fhirPatient);
    if (patient) {
        expect(fhirPatient.id).toEqual(patient.id);
    }
    var slotIsWalkin = (0, utils_1.getSlotIsWalkin)(slot);
    var appointmentType = (0, utils_1.appointmentTypeForAppointment)(appointment);
    if (slotIsWalkin) {
        expect(appointmentType).toEqual('walk-in');
    }
    else if (isPostTelemed) {
        expect(appointmentType).toEqual('post-telemed');
    }
    else {
        expect(appointmentType).toEqual('pre-booked');
    }
    expect((0, utils_1.isPostTelemedAppointment)(appointment)).toEqual(isPostTelemed);
    return { appointment: appointment, appointmentId: appointment.id };
};
describe('tests for getting the visit history for a patient', function () {
    var oystehr;
    var token = null;
    var processId = null;
    var inPersonSchedule;
    var virtualSchedule;
    var testPatient;
    var pastAppointments = [];
    var getPatientInfo = function () { return ({
        id: testPatient.id,
        firstName: testPatient.name[0].given[0],
        lastName: testPatient.name[0].family,
        email: 'okovalenko+coolPatient@masslight.com',
        sex: 'female',
        dateOfBirth: testPatient.birthDate,
        newPatient: false,
    }); };
    var setUpInPersonResources = function () { return __awaiter(void 0, void 0, void 0, function () {
        var timeNow, adjustedScheduleJSON, ownerLocation, _a, schedule, owner, scheduleExtension, timezone, slug;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    expect(oystehr).toBeDefined();
                    timeNow = (0, testScheduleUtils_1.startOfDayWithTimezone)().plus({ hours: 8 });
                    adjustedScheduleJSON = (0, testScheduleUtils_1.adjustHoursOfOperation)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [
                        {
                            dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
                            open: 8,
                            close: 24,
                            workingDay: true,
                        },
                    ]);
                    adjustedScheduleJSON = (0, testScheduleUtils_1.changeAllCapacities)(adjustedScheduleJSON, 1);
                    ownerLocation = {
                        resourceType: 'Location',
                        status: 'active',
                        name: 'Visit History In Person Test Location',
                        description: 'We only just met but I will be gone soon',
                        identifier: [
                            {
                                system: utils_1.SLUG_SYSTEM,
                                value: "visit-history-in-person-test-slug-".concat((0, crypto_1.randomUUID)()),
                            },
                        ],
                        address: {
                            use: 'work',
                            type: 'physical',
                            line: ['12345 Test St'],
                            city: 'Test City',
                            state: 'Test State',
                            postalCode: '12345',
                        },
                        telecom: [
                            {
                                system: 'phone',
                                use: 'work',
                                value: '1234567890',
                            },
                            {
                                system: 'url',
                                use: 'work',
                                value: 'https://example.com',
                            },
                        ],
                    };
                    return [4 /*yield*/, (0, testScheduleUtils_1.persistSchedule)({ scheduleExtension: adjustedScheduleJSON, processId: processId, scheduleOwner: ownerLocation }, oystehr)];
                case 1:
                    _a = _b.sent(), schedule = _a.schedule, owner = _a.owner;
                    (0, vitest_1.assert)(schedule.id);
                    scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
                    (0, vitest_1.assert)(scheduleExtension);
                    timezone = (0, utils_1.getTimezone)(schedule);
                    (0, vitest_1.assert)(owner);
                    slug = (0, utils_1.getSlugForBookableResource)(owner);
                    (0, vitest_1.assert)(slug);
                    return [2 /*return*/, {
                            timezone: timezone,
                            schedule: schedule,
                            slug: slug,
                            scheduleOwnerType: owner.resourceType,
                        }];
            }
        });
    }); };
    var setUpVirtualResources = function () { return __awaiter(void 0, void 0, void 0, function () {
        var timeNow, adjustedScheduleJSON, ownerLocation, _a, schedule, owner, scheduleExtension, timezone, slug;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    timeNow = (0, testScheduleUtils_1.startOfDayWithTimezone)().plus({ hours: 8 });
                    adjustedScheduleJSON = (0, testScheduleUtils_1.adjustHoursOfOperation)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [
                        {
                            dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
                            open: 8,
                            close: 18,
                            workingDay: true,
                        },
                    ]);
                    adjustedScheduleJSON = (0, testScheduleUtils_1.changeAllCapacities)(adjustedScheduleJSON, 1);
                    ownerLocation = {
                        resourceType: 'Location',
                        status: 'active',
                        name: 'Visit History Virtual Test Location',
                        description: 'We only just met but I will be gone soon',
                        identifier: [
                            {
                                system: utils_1.SLUG_SYSTEM,
                                value: "get-visit-history-virtual-loc-".concat((0, crypto_1.randomUUID)()),
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
                    };
                    return [4 /*yield*/, (0, testScheduleUtils_1.persistSchedule)({ scheduleExtension: adjustedScheduleJSON, processId: processId, scheduleOwner: ownerLocation }, oystehr)];
                case 1:
                    _a = _b.sent(), schedule = _a.schedule, owner = _a.owner;
                    expect(schedule.id).toBeDefined();
                    (0, vitest_1.assert)(schedule.id);
                    scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
                    expect(scheduleExtension).toBeDefined();
                    (0, vitest_1.assert)(scheduleExtension);
                    timezone = (0, utils_1.getTimezone)(schedule);
                    expect(owner).toBeDefined();
                    (0, vitest_1.assert)(owner);
                    slug = (0, utils_1.getSlugForBookableResource)(owner);
                    expect(slug).toBeDefined();
                    (0, vitest_1.assert)(slug);
                    return [2 /*return*/, {
                            timezone: timezone,
                            schedule: schedule,
                            slug: slug,
                            scheduleOwnerType: owner.resourceType,
                        }];
            }
        });
    }); };
    var createAppointmentAndValidate = function (input) { return __awaiter(void 0, void 0, void 0, function () {
        var patientInfo, patient, schedule, type, serviceMode, timezone, slot, walkinSlot, threeYearsAgo, nowMs, startDate, endDate, start, end, testStart1, testStart2, SLOT_TZs, prebookSlot, createAppointmentInputParams, createAppointmentResponse, e_1, validated;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientInfo = input.patientInfo, patient = input.patient, schedule = input.schedule, type = input.type, serviceMode = input.serviceMode;
                    timezone = (0, utils_1.getTimezone)(schedule);
                    console.log('timezone for schedule:', timezone);
                    if (!(type === 'walk-in')) return [3 /*break*/, 2];
                    walkinSlot = {
                        resourceType: 'Slot',
                        start: luxon_1.DateTime.now().setZone(timezone).toISO(),
                        end: luxon_1.DateTime.now().setZone(timezone).plus({ minutes: 30 }).toISO(),
                        schedule: { reference: "Schedule/".concat(schedule.id) },
                        status: 'busy-tentative',
                        appointmentType: __assign({}, utils_1.SLOT_WALKIN_APPOINTMENT_TYPE_CODING),
                        serviceCategory: serviceMode === utils_1.ServiceMode.virtual
                            ? [utils_1.SlotServiceCategory.virtualServiceMode]
                            : [utils_1.SlotServiceCategory.inPersonServiceMode],
                    };
                    return [4 /*yield*/, oystehr.fhir.create(__assign({}, walkinSlot))];
                case 1:
                    slot = _a.sent();
                    return [3 /*break*/, 4];
                case 2:
                    threeYearsAgo = luxon_1.DateTime.now().setZone(timezone).minus({ years: 3 }).toMillis();
                    nowMs = luxon_1.DateTime.now().setZone(timezone).toMillis();
                    startDate = luxon_1.DateTime.fromMillis(Math.floor(Math.random() * (nowMs - threeYearsAgo) + threeYearsAgo)).setZone(timezone);
                    (0, vitest_1.assert)(startDate.isValid);
                    endDate = startDate.plus({ minutes: 30 });
                    (0, vitest_1.assert)(endDate.isValid);
                    start = startDate.toISO();
                    (0, vitest_1.assert)(start);
                    end = endDate.toISO();
                    (0, vitest_1.assert)(end);
                    testStart1 = luxon_1.DateTime.fromISO(start, { setZone: true });
                    testStart2 = luxon_1.DateTime.fromISO(start);
                    SLOT_TZs = [testStart1.zoneName, testStart2.zoneName];
                    console.log('Slot TZs to investigate:', SLOT_TZs);
                    prebookSlot = {
                        resourceType: 'Slot',
                        start: start,
                        end: end,
                        schedule: { reference: "Schedule/".concat(schedule.id) },
                        status: 'busy-tentative',
                        serviceCategory: serviceMode === utils_1.ServiceMode.virtual
                            ? [utils_1.SlotServiceCategory.virtualServiceMode]
                            : [utils_1.SlotServiceCategory.inPersonServiceMode],
                    };
                    return [4 /*yield*/, oystehr.fhir.create(__assign({}, prebookSlot))];
                case 3:
                    slot = _a.sent();
                    _a.label = 4;
                case 4:
                    (0, vitest_1.assert)(slot.id);
                    createAppointmentInputParams = {
                        patient: patientInfo,
                        slotId: slot.id,
                    };
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: 'create-appointment' }, createAppointmentInputParams))];
                case 6:
                    createAppointmentResponse = (_a.sent()).output;
                    return [3 /*break*/, 8];
                case 7:
                    e_1 = _a.sent();
                    console.error('Error executing create-appointment zambda', e_1);
                    return [3 /*break*/, 8];
                case 8:
                    validated = validateCreateAppointmentResponse({
                        createAppointmentResponse: createAppointmentResponse,
                        patient: patient,
                        slot: slot,
                        timezone: timezone,
                    });
                    return [2 /*return*/, validated];
            }
        });
    }); };
    var getVisitHistory = function (input) { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: 'get-patient-visit-history', patientId: testPatient.id }, input))];
                case 1:
                    response = (_a.sent()).output;
                    return [2 /*return*/, response];
            }
        });
    }); };
    var changeInPersonAppointmentStatus = function (encounterId, status) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.zambda.execute({
                        id: 'change-in-person-visit-status',
                        encounterId: encounterId,
                        updatedStatus: status,
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var changeVirtualAppointmentStatus = function (appointmentId, status) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.zambda.execute({
                        id: 'change-telemed-appointment-status',
                        appointmentId: appointmentId,
                        newStatus: status,
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var AUTH0_ENDPOINT, AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID, EXECUTE_ZAMBDA_URL;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    processId = (0, crypto_1.randomUUID)();
                    AUTH0_ENDPOINT = secrets_1.SECRETS.AUTH0_ENDPOINT, AUTH0_CLIENT_TESTS = secrets_1.SECRETS.AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS = secrets_1.SECRETS.AUTH0_SECRET_TESTS, AUTH0_AUDIENCE = secrets_1.SECRETS.AUTH0_AUDIENCE, FHIR_API = secrets_1.SECRETS.FHIR_API, PROJECT_ID = secrets_1.SECRETS.PROJECT_ID;
                    EXECUTE_ZAMBDA_URL = (0, vitest_1.inject)('EXECUTE_ZAMBDA_URL');
                    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)({
                            AUTH0_ENDPOINT: AUTH0_ENDPOINT,
                            AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
                            AUTH0_SECRET: AUTH0_SECRET_TESTS,
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
                    return [4 /*yield*/, setUpInPersonResources()];
                case 3:
                    inPersonSchedule = _a.sent();
                    return [4 /*yield*/, setUpVirtualResources()];
                case 4:
                    virtualSchedule = _a.sent();
                    return [4 /*yield*/, (0, testScheduleUtils_1.persistTestPatient)({ patient: (0, testScheduleUtils_1.makeTestPatient)(), processId: processId }, oystehr)];
                case 5:
                    testPatient = _a.sent();
                    expect(testPatient.id).toBeDefined();
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
                    return [4 /*yield*/, (0, testScheduleUtils_1.cleanupTestScheduleResources)(processId, oystehr)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    // this is flaky and can fail based on time of day for the CI server
    test('create appointment helper func works', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientInfo, inPersonAppointmentPrebooked, inPersonWalkin, virtualAppointmentOnDemand, virtualAppointmentPrebook;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientInfo = getPatientInfo();
                    return [4 /*yield*/, createAppointmentAndValidate({
                            patientInfo: patientInfo,
                            patient: testPatient,
                            schedule: inPersonSchedule.schedule,
                            type: 'pre-booked',
                            serviceMode: utils_1.ServiceMode['in-person'],
                        })];
                case 1:
                    inPersonAppointmentPrebooked = (_a.sent()).appointment;
                    expect(inPersonAppointmentPrebooked).toBeDefined();
                    pastAppointments.push({
                        appointment: inPersonAppointmentPrebooked,
                        metadata: {
                            type: 'pre-booked',
                            serviceMode: utils_1.ServiceMode['in-person'],
                            startISO: inPersonAppointmentPrebooked.start,
                            timezone: inPersonSchedule.timezone,
                        },
                    });
                    return [4 /*yield*/, createAppointmentAndValidate({
                            patientInfo: patientInfo,
                            patient: testPatient,
                            schedule: inPersonSchedule.schedule,
                            type: 'walk-in',
                            serviceMode: utils_1.ServiceMode['in-person'],
                        })];
                case 2:
                    inPersonWalkin = (_a.sent()).appointment;
                    expect(inPersonWalkin).toBeDefined();
                    pastAppointments.push({
                        appointment: inPersonWalkin,
                        metadata: {
                            type: 'walk-in',
                            serviceMode: utils_1.ServiceMode['in-person'],
                            startISO: inPersonWalkin.start,
                            timezone: inPersonSchedule.timezone,
                        },
                    });
                    return [4 /*yield*/, createAppointmentAndValidate({
                            patientInfo: patientInfo,
                            patient: testPatient,
                            schedule: virtualSchedule.schedule,
                            type: 'walk-in',
                            serviceMode: utils_1.ServiceMode.virtual,
                        })];
                case 3:
                    virtualAppointmentOnDemand = (_a.sent()).appointment;
                    expect(virtualAppointmentOnDemand).toBeDefined();
                    pastAppointments.push({
                        appointment: virtualAppointmentOnDemand,
                        metadata: {
                            type: 'walk-in',
                            serviceMode: utils_1.ServiceMode.virtual,
                            startISO: virtualAppointmentOnDemand.start,
                            timezone: virtualSchedule.timezone,
                        },
                    });
                    return [4 /*yield*/, createAppointmentAndValidate({
                            patientInfo: patientInfo,
                            patient: testPatient,
                            schedule: virtualSchedule.schedule,
                            type: 'pre-booked',
                            serviceMode: utils_1.ServiceMode.virtual,
                        })];
                case 4:
                    virtualAppointmentPrebook = (_a.sent()).appointment;
                    expect(virtualAppointmentPrebook).toBeDefined();
                    pastAppointments.push({
                        appointment: virtualAppointmentPrebook,
                        metadata: {
                            type: 'pre-booked',
                            serviceMode: utils_1.ServiceMode.virtual,
                            startISO: virtualAppointmentPrebook.start,
                            timezone: virtualSchedule.timezone,
                        },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    test('get visit history returns all created appointments', function () { return __awaiter(void 0, void 0, void 0, function () {
        var visitHistory, sorted;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVisitHistory({})];
                case 1:
                    visitHistory = _a.sent();
                    expect(visitHistory.visits.length).toEqual(pastAppointments.length);
                    sorted = pastAppointments.sort(function (a, b) {
                        var aStart = luxon_1.DateTime.fromISO(a.appointment.start);
                        var bStart = luxon_1.DateTime.fromISO(b.appointment.start);
                        return bStart.toMillis() - aStart.toMillis();
                    });
                    sorted.forEach(function (_a, idx) {
                        var appointment = _a.appointment, metadata = _a.metadata;
                        var matchingVisit = visitHistory.visits[idx];
                        expect(matchingVisit).toBeDefined();
                        var appointmentType = (0, utils_1.appointmentTypeForAppointment)(appointment);
                        expect(metadata.timezone).toBeDefined();
                        expect(metadata.timezone).toBe(utils_1.TIMEZONES[0]);
                        expect(matchingVisit === null || matchingVisit === void 0 ? void 0 : matchingVisit.dateTime).toEqual(luxon_1.DateTime.fromISO(metadata.startISO, { zone: metadata.timezone }).toISO());
                        if (metadata.type === 'walk-in') {
                            expect(appointmentType).toEqual('walk-in');
                        }
                        else if (metadata.type === 'pre-booked' && metadata.serviceMode === utils_1.ServiceMode.virtual) {
                            expect(appointmentType).toEqual('pre-booked');
                        }
                        else if (metadata.type === 'pre-booked' && metadata.serviceMode === utils_1.ServiceMode['in-person']) {
                            expect(appointmentType).toEqual('pre-booked');
                        }
                        var serviceMode = metadata.serviceMode;
                        console.log('serviceMode for appointment:', serviceMode, matchingVisit === null || matchingVisit === void 0 ? void 0 : matchingVisit.serviceMode);
                        expect(matchingVisit === null || matchingVisit === void 0 ? void 0 : matchingVisit.serviceMode).toEqual(serviceMode);
                        var serviceModeFromAppointment = (0, utils_1.isTelemedAppointment)(appointment)
                            ? utils_1.ServiceMode.virtual
                            : utils_1.ServiceMode['in-person'];
                        expect(matchingVisit === null || matchingVisit === void 0 ? void 0 : matchingVisit.serviceMode).toEqual(serviceModeFromAppointment);
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    test('sort param works as expected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, visitHistory, visitHistoryBackwards, sorted, reversedSorted;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        getVisitHistory({ sortDirection: 'desc' }),
                        getVisitHistory({ sortDirection: 'asc' }),
                    ])];
                case 1:
                    _a = _b.sent(), visitHistory = _a[0], visitHistoryBackwards = _a[1];
                    expect(visitHistory.visits.length).toEqual(pastAppointments.length);
                    sorted = pastAppointments.sort(function (a, b) {
                        var aStart = luxon_1.DateTime.fromISO(a.appointment.start);
                        var bStart = luxon_1.DateTime.fromISO(b.appointment.start);
                        return bStart.toMillis() - aStart.toMillis();
                    });
                    sorted.forEach(function (_a, idx) {
                        var appointment = _a.appointment;
                        var matchingVisit = visitHistory.visits[idx];
                        expect(matchingVisit).toBeDefined();
                        expect(matchingVisit.appointmentId).toEqual(appointment.id);
                    });
                    reversedSorted = __spreadArray([], sorted, true).reverse();
                    reversedSorted.forEach(function (_a, idx) {
                        var appointment = _a.appointment;
                        var matchingVisit = visitHistoryBackwards.visits[idx];
                        expect(matchingVisit).toBeDefined();
                        expect(matchingVisit.appointmentId).toEqual(appointment.id);
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    test('sort param works as expected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, visitHistory, visitHistoryBackwards, sorted, reversedSorted;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        getVisitHistory({ sortDirection: 'desc' }),
                        getVisitHistory({ sortDirection: 'asc' }),
                    ])];
                case 1:
                    _a = _b.sent(), visitHistory = _a[0], visitHistoryBackwards = _a[1];
                    expect(visitHistory.visits.length).toEqual(pastAppointments.length);
                    sorted = pastAppointments.sort(function (a, b) {
                        var aStart = luxon_1.DateTime.fromISO(a.appointment.start);
                        var bStart = luxon_1.DateTime.fromISO(b.appointment.start);
                        return bStart.toMillis() - aStart.toMillis();
                    });
                    sorted.forEach(function (_a, idx) {
                        var appointment = _a.appointment;
                        var matchingVisit = visitHistory.visits[idx];
                        expect(matchingVisit).toBeDefined();
                        expect(matchingVisit.appointmentId).toEqual(appointment.id);
                    });
                    reversedSorted = __spreadArray([], sorted, true).reverse();
                    reversedSorted.forEach(function (_a, idx) {
                        var appointment = _a.appointment;
                        var matchingVisit = visitHistoryBackwards.visits[idx];
                        expect(matchingVisit).toBeDefined();
                        expect(matchingVisit.appointmentId).toEqual(appointment.id);
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    test('filter by service mode works as expected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, inPersonVisits, virtualVisits, inPersonAppointments, virtualAppointments;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        getVisitHistory({ serviceMode: utils_1.ServiceMode['in-person'] }),
                        getVisitHistory({ serviceMode: utils_1.ServiceMode.virtual }),
                    ])];
                case 1:
                    _a = _b.sent(), inPersonVisits = _a[0], virtualVisits = _a[1];
                    inPersonAppointments = pastAppointments.filter(function (_a) {
                        var metadata = _a.metadata;
                        return metadata.serviceMode === utils_1.ServiceMode['in-person'];
                    });
                    virtualAppointments = pastAppointments.filter(function (_a) {
                        var metadata = _a.metadata;
                        return metadata.serviceMode === utils_1.ServiceMode.virtual;
                    });
                    expect(inPersonVisits.visits.length).toEqual(inPersonAppointments.length);
                    expect(virtualVisits.visits.length).toEqual(virtualAppointments.length);
                    inPersonAppointments.forEach(function (_a) {
                        var appointment = _a.appointment;
                        var matchingVisit = inPersonVisits.visits.find(function (visit) { return visit.appointmentId === appointment.id; });
                        expect(matchingVisit).toBeDefined();
                        expect(matchingVisit === null || matchingVisit === void 0 ? void 0 : matchingVisit.serviceMode).toEqual(utils_1.ServiceMode['in-person']);
                    });
                    virtualAppointments.forEach(function (_a) {
                        var appointment = _a.appointment;
                        var matchingVisit = virtualVisits.visits.find(function (visit) { return visit.appointmentId === appointment.id; });
                        expect(matchingVisit).toBeDefined();
                        expect(matchingVisit === null || matchingVisit === void 0 ? void 0 : matchingVisit.serviceMode).toEqual(utils_1.ServiceMode.virtual);
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    test('filter by date range works as expected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var allDates, sortedDates, fromDate, toDate, visitHistory, expectedAppointments;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    allDates = pastAppointments.map(function (_a) {
                        var metadata = _a.metadata;
                        return luxon_1.DateTime.fromISO(metadata.startISO, { zone: metadata.timezone });
                    });
                    sortedDates = allDates.sort(function (a, b) { return a.toMillis() - b.toMillis(); });
                    fromDate = sortedDates[1];
                    toDate = sortedDates[sortedDates.length - 2];
                    return [4 /*yield*/, getVisitHistory({
                            from: fromDate.toISO(),
                            to: toDate.toISO(),
                        })];
                case 1:
                    visitHistory = _a.sent();
                    expectedAppointments = pastAppointments.filter(function (_a) {
                        var metadata = _a.metadata;
                        var appointmentDate = luxon_1.DateTime.fromISO(metadata.startISO, { zone: metadata.timezone });
                        return appointmentDate >= fromDate && appointmentDate <= toDate;
                    });
                    expect(visitHistory.visits.length).toEqual(expectedAppointments.length);
                    expectedAppointments.forEach(function (_a) {
                        var appointment = _a.appointment, metadata = _a.metadata;
                        var matchingVisit = visitHistory.visits.find(function (visit) { return visit.appointmentId === appointment.id; });
                        expect(matchingVisit).toBeDefined();
                        var appointmentDate = luxon_1.DateTime.fromISO(metadata.startISO, { zone: metadata.timezone });
                        expect(luxon_1.DateTime.fromISO(matchingVisit.dateTime, { zone: metadata.timezone }).toISO()).toEqual(appointmentDate.toISO());
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    test('filter by appointment type works as expected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, prebookedVisits, walkinVisits, allVisits, prebookedAppointments, walkinAppointments;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        getVisitHistory({ type: ['pre-booked'] }),
                        getVisitHistory({ type: ['walk-in'] }),
                        getVisitHistory({ type: ['pre-booked', 'walk-in'] }),
                    ])];
                case 1:
                    _a = _b.sent(), prebookedVisits = _a[0], walkinVisits = _a[1], allVisits = _a[2];
                    prebookedAppointments = pastAppointments.filter(function (_a) {
                        var metadata = _a.metadata;
                        return metadata.type === 'pre-booked';
                    });
                    walkinAppointments = pastAppointments.filter(function (_a) {
                        var metadata = _a.metadata;
                        return metadata.type === 'walk-in';
                    });
                    expect(prebookedVisits.visits.length).toEqual(prebookedAppointments.length);
                    expect(walkinVisits.visits.length).toEqual(walkinAppointments.length);
                    prebookedAppointments.forEach(function (_a) {
                        var appointment = _a.appointment;
                        var matchingVisit = prebookedVisits.visits.find(function (visit) { return visit.appointmentId === appointment.id; });
                        expect(matchingVisit).toBeDefined();
                        var appointmentType = (0, utils_1.appointmentTypeForAppointment)(appointment);
                        expect(appointmentType).toEqual('pre-booked');
                        expect(matchingVisit === null || matchingVisit === void 0 ? void 0 : matchingVisit.appointmentId).toEqual(appointment.id);
                        expect(matchingVisit === null || matchingVisit === void 0 ? void 0 : matchingVisit.type).toEqual('pre-booked');
                    });
                    walkinAppointments.forEach(function (_a) {
                        var appointment = _a.appointment;
                        var matchingVisit = walkinVisits.visits.find(function (visit) { return visit.appointmentId === appointment.id; });
                        expect(matchingVisit).toBeDefined();
                        var appointmentType = (0, utils_1.appointmentTypeForAppointment)(appointment);
                        expect(appointmentType).toEqual('walk-in');
                        expect(matchingVisit === null || matchingVisit === void 0 ? void 0 : matchingVisit.appointmentId).toEqual(appointment.id);
                        expect(matchingVisit === null || matchingVisit === void 0 ? void 0 : matchingVisit.type).toEqual('walk-in');
                    });
                    expect(allVisits.visits.length).toEqual(pastAppointments.length);
                    return [2 /*return*/];
            }
        });
    }); });
    test('status filter works as expected for in-person visits', function () { return __awaiter(void 0, void 0, void 0, function () {
        var allVisits, index, _i, _a, visit, newStatus, _b, allVisitsCanceledAndCompleted, canceledVisits, completedVisits;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, getVisitHistory({ serviceMode: utils_1.ServiceMode['in-person'] })];
                case 1:
                    allVisits = _c.sent();
                    expect(allVisits.visits.length).toBeGreaterThan(0);
                    index = 0;
                    _i = 0, _a = allVisits.visits;
                    _c.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    visit = _a[_i];
                    newStatus = index === 0 ? 'cancelled' : 'completed';
                    expect(visit.encounterId).toBeDefined();
                    return [4 /*yield*/, changeInPersonAppointmentStatus(visit.encounterId, newStatus)];
                case 3:
                    _c.sent();
                    index++;
                    _c.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [4 /*yield*/, Promise.all([
                        getVisitHistory({ status: ['cancelled', 'completed'] }),
                        getVisitHistory({ status: ['cancelled'] }),
                        getVisitHistory({ status: ['completed'] }),
                    ])];
                case 6:
                    _b = _c.sent(), allVisitsCanceledAndCompleted = _b[0], canceledVisits = _b[1], completedVisits = _b[2];
                    expect(allVisitsCanceledAndCompleted.visits.length).toEqual(index);
                    expect(canceledVisits.visits.length).toEqual(1);
                    expect(completedVisits.visits.length).toEqual(1);
                    canceledVisits.visits.forEach(function (visit) {
                        expect(visit.status).toEqual('cancelled');
                    });
                    completedVisits.visits.forEach(function (visit) {
                        expect(visit.status).toEqual('completed');
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // updating virtual appointment status throws an error right now when Oystehr.user.me() is called in the zambda
    // skipping this test for now until that is resolved
    // also not sure how long for this world this filter is
    test.skip('status filter works as expected for virtual visits', function () { return __awaiter(void 0, void 0, void 0, function () {
        var allVisits, index, _i, _a, visit, newStatus, _b, allVisitsInProgressOrComplete, completedVisits, inProgressVisits;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, getVisitHistory({ serviceMode: utils_1.ServiceMode.virtual })];
                case 1:
                    allVisits = _c.sent();
                    expect(allVisits.visits.length).toBeGreaterThan(0);
                    index = 0;
                    _i = 0, _a = allVisits.visits;
                    _c.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    visit = _a[_i];
                    newStatus = index === 0 ? 'on-video' : 'complete';
                    expect(visit.encounterId).toBeDefined();
                    return [4 /*yield*/, changeVirtualAppointmentStatus(visit.appointmentId, newStatus)];
                case 3:
                    _c.sent();
                    index++;
                    _c.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [4 /*yield*/, Promise.all([
                        getVisitHistory({ status: ['on-video', 'complete'] }),
                        getVisitHistory({ status: ['complete'] }),
                        getVisitHistory({ status: ['on-video'] }),
                    ])];
                case 6:
                    _b = _c.sent(), allVisitsInProgressOrComplete = _b[0], completedVisits = _b[1], inProgressVisits = _b[2];
                    expect(allVisitsInProgressOrComplete.visits.length).toEqual(index);
                    expect(inProgressVisits.visits.length).toEqual(1);
                    expect(completedVisits.visits.length).toEqual(1);
                    inProgressVisits.visits.forEach(function (visit) {
                        expect(visit.status).toEqual('on-video');
                    });
                    completedVisits.visits.forEach(function (visit) {
                        expect(visit.status).toEqual('complete');
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    describe('catching input errors', function () {
        test.concurrent('invalid date range throws error', function () { return __awaiter(void 0, void 0, void 0, function () {
            var fromDate, toDate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fromDate = luxon_1.DateTime.now().toISO();
                        toDate = luxon_1.DateTime.now().minus({ days: 1 }).toISO();
                        return [4 /*yield*/, expect(getVisitHistory({
                                from: fromDate,
                                to: toDate,
                            })).rejects.toThrow('The "from" date must be earlier than the "to" date.')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expect(getVisitHistory({
                                from: 'May 30th, 2023',
                            })).rejects.toThrow('"from" must be a valid ISO date string.')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, expect(getVisitHistory({
                                to: '4th of July, 1776',
                            })).rejects.toThrow('"to" must be a valid ISO date string.')];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test.concurrent('invalid "from" date range throws error', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(getVisitHistory({
                            from: 'May 30th, 2023',
                        })).rejects.toThrow('"from" must be a valid ISO date string.')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test.concurrent('invalid "to" date throws error', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(getVisitHistory({
                            to: '4th of July, 1776',
                        })).rejects.toThrow('"to" must be a valid ISO date string.')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test.concurrent('invalid serviceMode throws error', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(getVisitHistory({
                            serviceMode: 'invalid-service-mode',
                        })).rejects.toThrow('"serviceMode" must be one of in-person or virtual.')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test.concurrent('invalid type throws error', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(getVisitHistory({
                            type: 'drop-on-by',
                        })).rejects.toThrow('"type" must be an array of walk-in, pre-booked, post-telemed.')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test.concurrent('invalid status throws error', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(getVisitHistory({
                            status: 'fubar',
                        })).rejects.toThrow('"status" must be an array of strings.')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test.concurrent('invalid sortDirection', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(getVisitHistory({
                            sortDirection: 'sideways',
                        })).rejects.toThrow('"sortDirection" must be either "asc" or "desc".')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('follow up visits', function () {
        var visitHistoryAfterFollowups;
        beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
            var inPersonVisits, visitHistory, _loop_1, _i, inPersonVisits_1, appointment;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        inPersonVisits = pastAppointments.filter(function (_a) {
                            var metadata = _a.metadata;
                            return metadata.serviceMode === utils_1.ServiceMode['in-person'];
                        });
                        return [4 /*yield*/, getVisitHistory({ serviceMode: utils_1.ServiceMode['in-person'] })];
                    case 1:
                        visitHistory = _a.sent();
                        _loop_1 = function (appointment) {
                            var initialVisit;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        initialVisit = visitHistory.visits.find(function (visit) { return visit.appointmentId === appointment.id; });
                                        return [4 /*yield*/, oystehr.zambda.execute({
                                                id: 'save-followup-encounter',
                                                encounterDetails: {
                                                    patientId: testPatient.id,
                                                    followupType: 'Follow-up Encounter',
                                                    start: luxon_1.DateTime.now().setZone(inPersonSchedule.timezone).toISO(),
                                                    resolved: false,
                                                    initialEncounterID: initialVisit === null || initialVisit === void 0 ? void 0 : initialVisit.encounterId,
                                                    appointmentId: appointment.id,
                                                },
                                            })];
                                    case 1:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            });
                        };
                        _i = 0, inPersonVisits_1 = inPersonVisits;
                        _a.label = 2;
                    case 2:
                        if (!(_i < inPersonVisits_1.length)) return [3 /*break*/, 5];
                        appointment = inPersonVisits_1[_i].appointment;
                        return [5 /*yield**/, _loop_1(appointment)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, getVisitHistory({})];
                    case 6:
                        visitHistoryAfterFollowups = _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('follow up encounters are linked in visit history', function () { return __awaiter(void 0, void 0, void 0, function () {
            var inPersonVisits, _loop_2, _i, inPersonVisits_2, appointment;
            var _a;
            return __generator(this, function (_b) {
                inPersonVisits = pastAppointments.filter(function (_a) {
                    var metadata = _a.metadata;
                    return metadata.serviceMode === utils_1.ServiceMode['in-person'];
                });
                _loop_2 = function (appointment) {
                    var visit = visitHistoryAfterFollowups.visits.find(function (v) { return v.appointmentId === appointment.id; });
                    expect(visit).toBeDefined();
                    expect(visit === null || visit === void 0 ? void 0 : visit.followUps).toBeDefined();
                    expect((_a = visit === null || visit === void 0 ? void 0 : visit.followUps) === null || _a === void 0 ? void 0 : _a.length).toBe(1);
                    (0, vitest_1.assert)(visit === null || visit === void 0 ? void 0 : visit.followUps);
                    var followUpVisit = visit.followUps.find(function (fuv) { return fuv.originalAppointmentId === appointment.id; });
                    expect(followUpVisit).toBeDefined();
                    (0, vitest_1.assert)(followUpVisit);
                    expect(followUpVisit.type).toEqual('Follow-up Encounter');
                    expect(followUpVisit.dateTime).toBeDefined();
                    var followUpDateTime = luxon_1.DateTime.fromISO(followUpVisit.dateTime, { setZone: true });
                    expect(followUpDateTime.isValid).toBe(true);
                    var fuvInTimeZone = luxon_1.DateTime.fromISO(followUpVisit.dateTime).setZone(inPersonSchedule.timezone);
                    expect(followUpDateTime.year).toEqual(fuvInTimeZone.year);
                    expect(followUpDateTime.month).toEqual(fuvInTimeZone.month);
                    expect(followUpDateTime.day).toEqual(fuvInTimeZone.day);
                    expect(followUpDateTime.hour).toEqual(fuvInTimeZone.hour);
                    expect(followUpDateTime.minute).toEqual(fuvInTimeZone.minute);
                    expect(followUpDateTime.second).toEqual(fuvInTimeZone.second);
                };
                for (_i = 0, inPersonVisits_2 = inPersonVisits; _i < inPersonVisits_2.length; _i++) {
                    appointment = inPersonVisits_2[_i].appointment;
                    _loop_2(appointment);
                }
                return [2 /*return*/];
            });
        }); });
    });
});
