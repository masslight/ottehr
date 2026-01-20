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
var shared_1 = require("../../src/shared");
var secrets_1 = require("../data/secrets");
var testScheduleUtils_1 = require("../helpers/testScheduleUtils");
var createSlotAndValidate = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var createSlotParams, selectedSlot, schedule, createdSlotResponse, e_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                createSlotParams = input.params, selectedSlot = input.selectedSlot, schedule = input.schedule;
                _c.label = 1;
            case 1:
                _c.trys.push([1, 3, , 4]);
                return [4 /*yield*/, oystehr.zambda.executePublic(__assign({ id: 'create-slot' }, createSlotParams))];
            case 2:
                createdSlotResponse = (_c.sent()).output;
                return [3 /*break*/, 4];
            case 3:
                e_1 = _c.sent();
                console.error('Error executing get-schedule zambda', e_1);
                expect(false).toBeTruthy(); // fail the test if we can't create the slot
                return [3 /*break*/, 4];
            case 4:
                (0, vitest_1.assert)(createdSlotResponse);
                (0, vitest_1.assert)(createdSlotResponse.id);
                expect(createdSlotResponse.resourceType).toEqual('Slot');
                expect(createdSlotResponse.status).toEqual('busy-tentative');
                if (selectedSlot) {
                    expect(createdSlotResponse.start).toEqual(selectedSlot.slot.start);
                    expect(createdSlotResponse.end).toEqual(luxon_1.DateTime.fromISO(selectedSlot.slot.end, { zone: (0, utils_1.getTimezone)(schedule) }).toISO());
                }
                expect((0, utils_1.getSlotIsWalkin)(createdSlotResponse)).toEqual((_a = createSlotParams.walkin) !== null && _a !== void 0 ? _a : false);
                expect((0, utils_1.getSlotIsPostTelemed)(createdSlotResponse)).toEqual((_b = createSlotParams.postTelemedLabOnly) !== null && _b !== void 0 ? _b : false);
                return [2 /*return*/, {
                        slot: createdSlotResponse,
                        serviceMode: (0, utils_1.getServiceModeFromSlot)(createdSlotResponse),
                        originalBookingUrl: (0, utils_1.getOriginalBookingUrlFromSlot)(createdSlotResponse),
                    }];
        }
    });
}); };
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
describe('prebook integration - from getting list of slots to booking with selected slot', function () {
    var oystehr;
    var token = null;
    var processId = null;
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
                        name: 'BusySlotsTestLocation',
                        description: 'We only just met but I will be gone soon',
                        identifier: [
                            {
                                system: utils_1.SLUG_SYSTEM,
                                value: "busy-slots-slimy-slug-".concat((0, crypto_1.randomUUID)()),
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
    var getSlot = function (input) { return __awaiter(void 0, void 0, void 0, function () {
        var schedule, scheduleOwnerType, slug, serviceMode, getScheduleResponse, e_2, available, elevenPMSlot, createSlotParams, validatedSlotResponse, createdSlotResponse, serviceModeFromSlot, bookingUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    schedule = input.schedule, scheduleOwnerType = input.scheduleOwnerType, slug = input.slug, serviceMode = input.serviceMode;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, oystehr.zambda.executePublic({
                            id: 'get-schedule',
                            slug: slug,
                            scheduleType: scheduleOwnerType === 'Location' ? 'location' : 'provider',
                        })];
                case 2:
                    getScheduleResponse = (_a.sent()).output;
                    return [3 /*break*/, 4];
                case 3:
                    e_2 = _a.sent();
                    console.error('Error executing get-schedule zambda', e_2);
                    return [3 /*break*/, 4];
                case 4:
                    (0, vitest_1.assert)(getScheduleResponse);
                    available = getScheduleResponse.available;
                    console.log('available slots ', available);
                    elevenPMSlot = available.find(function (slotItem) {
                        var slotStartTime = luxon_1.DateTime.fromISO(slotItem.slot.start);
                        return slotStartTime.hour === 23;
                    });
                    (0, vitest_1.assert)(elevenPMSlot);
                    console.log('selectedSlot ', elevenPMSlot);
                    createSlotParams = (0, utils_1.createSlotParamsFromSlotAndOptions)(elevenPMSlot.slot, {
                        postTelemedLabOnly: false,
                        originalBookingUrl: "prebook/".concat(serviceMode, "?bookingOn=").concat(slug),
                        status: 'busy-tentative',
                    });
                    console.log('createSlotParams ', createSlotParams);
                    (0, vitest_1.assert)(createSlotParams);
                    return [4 /*yield*/, createSlotAndValidate({ params: createSlotParams, selectedSlot: elevenPMSlot, schedule: schedule }, oystehr)];
                case 5:
                    validatedSlotResponse = _a.sent();
                    console.log('validatedSlotResponse ', validatedSlotResponse);
                    createdSlotResponse = validatedSlotResponse.slot;
                    serviceModeFromSlot = validatedSlotResponse.serviceMode;
                    bookingUrl = validatedSlotResponse.originalBookingUrl;
                    (0, vitest_1.assert)(createdSlotResponse.id);
                    expect(serviceModeFromSlot).toEqual(serviceMode);
                    expect(bookingUrl).toEqual("prebook/".concat(serviceMode, "?bookingOn=").concat(slug));
                    return [2 /*return*/, {
                            slot: createdSlotResponse,
                            slotId: createdSlotResponse.id,
                        }];
            }
        });
    }); };
    var createAppointmentAndValidate = function (input) { return __awaiter(void 0, void 0, void 0, function () {
        var patientInfo, patient, timezone, slot, slotId, createAppointmentInputParams, createAppointmentResponse, e_3, validated, fetchedSlot;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientInfo = input.patientInfo, patient = input.patient, timezone = input.timezone, slot = input.slot;
                    slotId = slot.id;
                    (0, vitest_1.assert)(slotId);
                    createAppointmentInputParams = {
                        patient: patientInfo,
                        slotId: slotId,
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: 'create-appointment' }, createAppointmentInputParams))];
                case 2:
                    createAppointmentResponse = (_a.sent()).output;
                    return [3 /*break*/, 4];
                case 3:
                    e_3 = _a.sent();
                    console.error('Error executing create-appointment zambda', e_3);
                    return [3 /*break*/, 4];
                case 4:
                    validated = validateCreateAppointmentResponse({
                        createAppointmentResponse: createAppointmentResponse,
                        patient: patient,
                        slot: slot,
                        timezone: timezone,
                    });
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Slot',
                            id: slotId,
                        })];
                case 5:
                    fetchedSlot = _a.sent();
                    (0, vitest_1.assert)(fetchedSlot);
                    expect(fetchedSlot.status).toEqual('busy');
                    return [2 /*return*/, validated];
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
    test.skip('create an appointment at 1130PM eastern and ensure that the appointment created is for the correct calendar day.', function () { return __awaiter(void 0, void 0, void 0, function () {
        var initialResources, timezone, newPatient, patientInfo, createdSlotResponse, appointment, appointmentDateTime, slotDateTime;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    (0, vitest_1.assert)(processId);
                    return [4 /*yield*/, setUpInPersonResources()];
                case 1:
                    initialResources = _b.sent();
                    timezone = initialResources.timezone;
                    newPatient = (0, testScheduleUtils_1.makeTestPatient)();
                    patientInfo = {
                        firstName: newPatient.name[0].given[0],
                        lastName: newPatient.name[0].family,
                        sex: 'female',
                        dateOfBirth: newPatient.birthDate,
                        newPatient: true,
                        phoneNumber: '+12027139680',
                        email: 'okovalenko+coolNewPatient@masslight.com',
                        tags: [
                            {
                                system: 'OTTEHR_AUTOMATED_TEST',
                                code: (0, testScheduleUtils_1.tagForProcessId)(processId),
                                display: 'a test resource that should be cleaned up',
                            },
                        ],
                    };
                    return [4 /*yield*/, getSlot(__assign(__assign({}, initialResources), { serviceMode: utils_1.ServiceMode['in-person'], isWalkin: false, isPostTelemed: false }))];
                case 2:
                    createdSlotResponse = (_b.sent()).slot;
                    console.log('createdSlotResponse ', createdSlotResponse);
                    return [4 /*yield*/, createAppointmentAndValidate({
                            timezone: timezone,
                            patientInfo: patientInfo,
                            patient: undefined,
                            slot: createdSlotResponse,
                        })];
                case 3:
                    appointment = (_b.sent()).appointment;
                    console.log('appointment ', appointment);
                    expect(appointment).toBeDefined();
                    expect((_a = appointment.start) === null || _a === void 0 ? void 0 : _a.charAt(appointment.start.length - 1)).toEqual('Z'); // should be in UTC
                    appointmentDateTime = luxon_1.DateTime.fromISO(appointment.start);
                    slotDateTime = luxon_1.DateTime.fromISO(createdSlotResponse.start);
                    expect(slotDateTime.toISO()).toEqual(appointmentDateTime.toISO()); // Appointment should have the same time as the Slot
                    expect(appointmentDateTime.hour).toEqual(23);
                    expect(appointmentDateTime.day).toEqual(luxon_1.DateTime.now().day); // Appointment should be for today, not tomorrow.
                    return [2 /*return*/];
            }
        });
    }); });
});
