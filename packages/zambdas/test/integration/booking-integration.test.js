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
var vitest_1 = require("vitest");
var integration_test_seed_data_setup_1 = require("../helpers/integration-test-seed-data-setup");
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
                expect(createdSlotResponse).toBeDefined();
                (0, vitest_1.assert)(createdSlotResponse);
                expect(createdSlotResponse.id).toBeDefined();
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
    expect(createAppointmentResponse).toBeDefined();
    (0, vitest_1.assert)(createAppointmentResponse);
    var appointmentId = createAppointmentResponse.appointmentId, fhirPatientId = createAppointmentResponse.fhirPatientId, questionnaireResponseId = createAppointmentResponse.questionnaireResponseId, encounterId = createAppointmentResponse.encounterId, resources = createAppointmentResponse.resources;
    expect(appointmentId).toBeDefined();
    (0, vitest_1.assert)(appointmentId);
    expect(fhirPatientId).toBeDefined();
    (0, vitest_1.assert)(fhirPatientId);
    expect(questionnaireResponseId).toBeDefined();
    (0, vitest_1.assert)(questionnaireResponseId);
    expect(encounterId).toBeDefined();
    (0, vitest_1.assert)(encounterId);
    expect(resources).toBeDefined();
    (0, vitest_1.assert)(resources);
    var appointment = resources.appointment, encounter = resources.encounter, questionnaire = resources.questionnaire, fhirPatient = resources.patient;
    expect(appointment).toBeDefined();
    (0, vitest_1.assert)(appointment);
    expect(appointment.id).toEqual(appointmentId);
    (0, vitest_1.assert)(appointment.id);
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
    expect(encounter).toBeDefined();
    (0, vitest_1.assert)(encounter);
    expect(encounter.id);
    // todo: should encounter status be 'arrived' for walkin virtual appointments to match the appointment status?
    // i think this is intended and helps with some intake logic particular to the virtual walkin flow
    if (isWalkin && !isVirtual) {
        expect(encounter.status).toEqual('arrived');
    }
    else {
        expect(encounter.status).toEqual('planned');
    }
    expect((0, utils_1.checkEncounterIsVirtual)(encounter)).toEqual(isVirtual);
    expect(questionnaire).toBeDefined();
    (0, vitest_1.assert)(questionnaire);
    expect(fhirPatient).toBeDefined();
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
    var oystehrAdmin;
    var oystehrTestUserM2M;
    var processId = null;
    var existingTestPatient;
    var setUpInPersonResources = function () { return __awaiter(void 0, void 0, void 0, function () {
        var timeNow, adjustedScheduleJSON, ownerLocation, _a, schedule, owner, scheduleExtension, timezone, slug;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    expect(oystehrAdmin).toBeDefined();
                    expect(existingTestPatient).toBeDefined();
                    (0, vitest_1.assert)(existingTestPatient);
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
                    return [4 /*yield*/, (0, testScheduleUtils_1.persistSchedule)({ scheduleExtension: adjustedScheduleJSON, processId: processId, scheduleOwner: ownerLocation }, oystehrAdmin)];
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
                            location: owner,
                        }];
            }
        });
    }); };
    var setUpVirtualResources = function () { return __awaiter(void 0, void 0, void 0, function () {
        var timeNow, adjustedScheduleJSON, ownerLocation, _a, schedule, owner, scheduleExtension, timezone, slug;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    expect(oystehrAdmin).toBeDefined();
                    expect(existingTestPatient).toBeDefined();
                    (0, vitest_1.assert)(existingTestPatient);
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
                        name: 'BusySlotsTestTelemedLocation',
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
                    };
                    return [4 /*yield*/, (0, testScheduleUtils_1.persistSchedule)({ scheduleExtension: adjustedScheduleJSON, processId: processId, scheduleOwner: ownerLocation }, oystehrAdmin)];
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
                            location: owner,
                        }];
            }
        });
    }); };
    var getSlot = function (input) { return __awaiter(void 0, void 0, void 0, function () {
        var schedule, scheduleOwnerType, isWalkin, isPostTelemed, slug, serviceMode, getScheduleResponse, e_2, selectedSlot, regularAvailable, telemedAvailable, available, randomIndex, createSlotParams, now, end, walkinSlot, validatedSlotResponse, createdSlotResponse, serviceModeFromSlot, bookingUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    schedule = input.schedule, scheduleOwnerType = input.scheduleOwnerType, isWalkin = input.isWalkin, isPostTelemed = input.isPostTelemed, slug = input.slug, serviceMode = input.serviceMode;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, oystehrTestUserM2M.zambda.executePublic({
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
                    expect(getScheduleResponse).toBeDefined();
                    (0, vitest_1.assert)(getScheduleResponse);
                    if (!isWalkin) {
                        regularAvailable = getScheduleResponse.available, telemedAvailable = getScheduleResponse.telemedAvailable;
                        if (serviceMode === utils_1.ServiceMode.virtual) {
                            expect(telemedAvailable !== null && telemedAvailable !== void 0 ? telemedAvailable : []).toHaveLength(0);
                        }
                        available = isPostTelemed ? telemedAvailable : regularAvailable;
                        randomIndex = Math.ceil(Math.random() * (available.length - 1)) - 1;
                        selectedSlot = available[randomIndex];
                        expect(selectedSlot).toBeDefined();
                        (0, vitest_1.assert)(selectedSlot);
                    }
                    if (selectedSlot === undefined && isWalkin) {
                        now = luxon_1.DateTime.now().setZone((0, utils_1.getTimezone)(schedule));
                        end = now.plus({ minutes: 15 }).toISO();
                        walkinSlot = {
                            resourceType: 'Slot',
                            start: now.toISO(),
                            end: end,
                            schedule: { reference: "Schedule/".concat(schedule.id) },
                            status: 'busy-tentative',
                            appointmentType: __assign({}, utils_1.SLOT_WALKIN_APPOINTMENT_TYPE_CODING),
                            serviceCategory: serviceMode === utils_1.ServiceMode.virtual
                                ? [utils_1.SlotServiceCategory.virtualServiceMode]
                                : [utils_1.SlotServiceCategory.inPersonServiceMode],
                        };
                        createSlotParams = (0, utils_1.createSlotParamsFromSlotAndOptions)(walkinSlot, {
                            postTelemedLabOnly: isPostTelemed !== null && isPostTelemed !== void 0 ? isPostTelemed : false,
                            status: 'busy-tentative',
                        });
                    }
                    else {
                        (0, vitest_1.assert)(selectedSlot);
                        createSlotParams = (0, utils_1.createSlotParamsFromSlotAndOptions)(selectedSlot.slot, {
                            postTelemedLabOnly: isPostTelemed !== null && isPostTelemed !== void 0 ? isPostTelemed : false,
                            originalBookingUrl: isWalkin || isPostTelemed ? undefined : "prebook/".concat(serviceMode, "?bookingOn=").concat(slug),
                            status: 'busy-tentative',
                        });
                    }
                    (0, vitest_1.assert)(createSlotParams);
                    return [4 /*yield*/, createSlotAndValidate({ params: createSlotParams, selectedSlot: selectedSlot, schedule: schedule }, oystehrTestUserM2M)];
                case 5:
                    validatedSlotResponse = _a.sent();
                    createdSlotResponse = validatedSlotResponse.slot;
                    serviceModeFromSlot = validatedSlotResponse.serviceMode;
                    bookingUrl = validatedSlotResponse.originalBookingUrl;
                    (0, vitest_1.assert)(createdSlotResponse.id);
                    expect(serviceModeFromSlot).toEqual(serviceMode);
                    if (!isWalkin && !isPostTelemed) {
                        expect(bookingUrl).toEqual("prebook/".concat(serviceMode, "?bookingOn=").concat(slug));
                    }
                    else {
                        expect(bookingUrl).toBeUndefined();
                    }
                    return [2 /*return*/, {
                            slot: createdSlotResponse,
                            slotId: createdSlotResponse.id,
                        }];
            }
        });
    }); };
    var rescheduleAndValidate = function (input) { return __awaiter(void 0, void 0, void 0, function () {
        var appointmentId, oldSlotId, slug, schedule, serviceMode, getScheduleResponse, e_3, newAvailable, index, rescheduleSlot, rescheduleSlotParams, validatedRescheduledSlot, rescheduleSlotResponse, slotServiceMode, bookingUrl, rescheduleAppointmentResponse, e_4, appointmentID, _a, newAppointmentSearch, oldSlotSearch, unbundled, newAppointment, newSlot, oldSlotList;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    appointmentId = input.appointmentId, oldSlotId = input.oldSlotId, slug = input.slug, schedule = input.schedule, serviceMode = input.serviceMode;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, oystehrTestUserM2M.zambda.executePublic({
                            id: 'get-schedule',
                            slug: slug,
                            scheduleType: 'location',
                        })];
                case 2:
                    getScheduleResponse = (_b.sent()).output;
                    return [3 /*break*/, 4];
                case 3:
                    e_3 = _b.sent();
                    console.error('Error executing get-schedule zambda', e_3);
                    return [3 /*break*/, 4];
                case 4:
                    expect(getScheduleResponse).toBeDefined();
                    (0, vitest_1.assert)(getScheduleResponse);
                    newAvailable = getScheduleResponse.available;
                    index = Math.ceil(Math.random() * (newAvailable.length - 1)) - 1;
                    rescheduleSlot = newAvailable[index];
                    expect(rescheduleSlot).toBeDefined();
                    (0, vitest_1.assert)(rescheduleSlot);
                    rescheduleSlotParams = (0, utils_1.createSlotParamsFromSlotAndOptions)(rescheduleSlot.slot, {
                        originalBookingUrl: "prebook/".concat(serviceMode, "?bookingOn=").concat(slug),
                        status: 'busy-tentative',
                    });
                    return [4 /*yield*/, createSlotAndValidate({ params: rescheduleSlotParams, selectedSlot: rescheduleSlot, schedule: schedule }, oystehrTestUserM2M)];
                case 5:
                    validatedRescheduledSlot = _b.sent();
                    rescheduleSlotResponse = validatedRescheduledSlot.slot;
                    slotServiceMode = validatedRescheduledSlot.serviceMode;
                    bookingUrl = validatedRescheduledSlot.originalBookingUrl;
                    (0, vitest_1.assert)(rescheduleSlotResponse.id);
                    expect(slotServiceMode).toEqual(serviceMode);
                    expect(bookingUrl).toEqual("prebook/".concat(serviceMode, "?bookingOn=").concat(slug));
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, oystehrTestUserM2M.zambda.executePublic({
                            id: 'update-appointment',
                            appointmentID: appointmentId,
                            slot: rescheduleSlotResponse,
                        })];
                case 7:
                    rescheduleAppointmentResponse = (_b.sent()).output;
                    return [3 /*break*/, 9];
                case 8:
                    e_4 = _b.sent();
                    console.error('Error executing update-appointment zambda', e_4);
                    return [3 /*break*/, 9];
                case 9:
                    console.log('rescheduleAppointmentResponse', rescheduleAppointmentResponse);
                    expect(rescheduleAppointmentResponse).toBeDefined();
                    (0, vitest_1.assert)(rescheduleAppointmentResponse);
                    appointmentID = rescheduleAppointmentResponse.appointmentID;
                    expect(appointmentID).toBeDefined();
                    (0, vitest_1.assert)(appointmentID);
                    expect(appointmentID).toEqual(appointmentId);
                    return [4 /*yield*/, Promise.all([
                            oystehrAdmin.fhir.search({
                                resourceType: 'Appointment',
                                params: [
                                    {
                                        name: '_id',
                                        value: appointmentID,
                                    },
                                    {
                                        name: '_include',
                                        value: 'Appointment:slot',
                                    },
                                ],
                            }),
                            oystehrAdmin.fhir.search({
                                resourceType: 'Slot',
                                params: [
                                    {
                                        name: '_id',
                                        value: oldSlotId,
                                    },
                                ],
                            }),
                        ])];
                case 10:
                    _a = _b.sent(), newAppointmentSearch = _a[0], oldSlotSearch = _a[1];
                    expect(newAppointmentSearch).toBeDefined();
                    unbundled = newAppointmentSearch.unbundle();
                    newAppointment = unbundled.find(function (r) { return r.resourceType === 'Appointment'; });
                    newSlot = unbundled.find(function (r) { return r.resourceType === 'Slot'; });
                    expect(newAppointment).toBeDefined();
                    (0, vitest_1.assert)(newAppointment);
                    expect(luxon_1.DateTime.fromISO(newAppointment.start).setZone('UTC').toISO()).toEqual(luxon_1.DateTime.fromISO(rescheduleSlotResponse.start).setZone('UTC').toISO());
                    expect(luxon_1.DateTime.fromISO(newAppointment.end).setZone('UTC').toISO()).toEqual(luxon_1.DateTime.fromISO(rescheduleSlotResponse.end).setZone('UTC').toISO());
                    expect(luxon_1.DateTime.fromISO(newAppointment.start).setZone('UTC').toISO()).toEqual(luxon_1.DateTime.fromISO(newSlot.start).setZone('UTC').toISO());
                    expect(luxon_1.DateTime.fromISO(newAppointment.end).setZone('UTC').toISO()).toEqual(luxon_1.DateTime.fromISO(newSlot.end).setZone('UTC').toISO());
                    expect(newSlot).toBeDefined();
                    (0, vitest_1.assert)(newSlot.id);
                    expect(newSlot.status).toEqual('busy');
                    expect(oldSlotSearch).toBeDefined();
                    (0, vitest_1.assert)(oldSlotSearch);
                    oldSlotList = oldSlotSearch.unbundle();
                    expect(oldSlotList).toBeDefined();
                    (0, vitest_1.assert)(oldSlotList);
                    expect(oldSlotList.length).toEqual(0);
                    return [2 /*return*/, {
                            newSlotId: newSlot.id,
                        }];
            }
        });
    }); };
    var cancelAndValidate = function (input) { return __awaiter(void 0, void 0, void 0, function () {
        var appointmentId, oldSlotId, cancelResult, e_5, canceledAppointment, slotSearch, unbundledSlots;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    appointmentId = input.appointmentId, oldSlotId = input.oldSlotId;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, oystehrTestUserM2M.zambda.executePublic({
                            id: 'cancel-appointment',
                            appointmentID: appointmentId,
                            cancellationReason: 'Patient improved',
                        })];
                case 2:
                    cancelResult = _a.sent();
                    console.log('cancelResult', JSON.stringify(cancelResult));
                    expect(cancelResult.status).toBe(200);
                    return [3 /*break*/, 4];
                case 3:
                    e_5 = _a.sent();
                    console.error('Error executing cancel-appointment zambda', e_5);
                    expect(false).toBeTruthy(); // fail the test if we can't cancel the appointment
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, oystehrAdmin.fhir.get({
                        resourceType: 'Appointment',
                        id: appointmentId,
                    })];
                case 5:
                    canceledAppointment = _a.sent();
                    expect(canceledAppointment).toBeDefined();
                    (0, vitest_1.assert)(canceledAppointment);
                    expect(canceledAppointment.status).toEqual('cancelled');
                    return [4 /*yield*/, oystehrAdmin.fhir.search({
                            resourceType: 'Slot',
                            params: [
                                {
                                    name: '_id',
                                    value: oldSlotId,
                                },
                            ],
                        })];
                case 6:
                    slotSearch = _a.sent();
                    expect(slotSearch).toBeDefined();
                    unbundledSlots = slotSearch.unbundle();
                    expect(unbundledSlots.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); };
    var createAppointmentAndValidate = function (input) { return __awaiter(void 0, void 0, void 0, function () {
        var patientInfo, patient, timezone, slot, slotId, createAppointmentInputParams, createAppointmentResponse, e_6, validated, fetchedSlot;
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
                    return [4 /*yield*/, oystehrTestUserM2M.zambda.execute(__assign({ id: 'create-appointment' }, createAppointmentInputParams))];
                case 2:
                    createAppointmentResponse = (_a.sent()).output;
                    return [3 /*break*/, 4];
                case 3:
                    e_6 = _a.sent();
                    console.error('Error executing create-appointment zambda', e_6);
                    return [3 /*break*/, 4];
                case 4:
                    validated = validateCreateAppointmentResponse({
                        createAppointmentResponse: createAppointmentResponse,
                        patient: patient,
                        slot: slot,
                        timezone: timezone,
                    });
                    return [4 /*yield*/, oystehrAdmin.fhir.get({
                            resourceType: 'Slot',
                            id: slotId,
                        })];
                case 5:
                    fetchedSlot = _a.sent();
                    expect(fetchedSlot).toBeDefined();
                    (0, vitest_1.assert)(fetchedSlot);
                    expect(fetchedSlot.status).toEqual('busy');
                    return [2 /*return*/, validated];
            }
        });
    }); };
    var cleanUpResources = function (initialResources) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!initialResources.schedule.id) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehrAdmin.fhir.delete({
                            resourceType: 'Schedule',
                            id: initialResources.schedule.id,
                        })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    if (!initialResources.location.id) return [3 /*break*/, 4];
                    return [4 /*yield*/, oystehrAdmin.fhir.delete({
                            resourceType: 'Location',
                            id: initialResources.location.id,
                        })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    }); };
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var setup;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    processId = (0, crypto_1.randomUUID)();
                    return [4 /*yield*/, (0, integration_test_seed_data_setup_1.setupIntegrationTest)('booking-integration.test.ts', utils_1.M2MClientMockType.patient)];
                case 1:
                    setup = _a.sent();
                    oystehrTestUserM2M = setup.oystehrTestUserM2M;
                    oystehrAdmin = setup.oystehr;
                    return [4 /*yield*/, (0, testScheduleUtils_1.persistTestPatient)({ patient: (0, testScheduleUtils_1.makeTestPatient)(), processId: processId }, oystehrAdmin)];
                case 2:
                    existingTestPatient = _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, 60000);
    afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehrAdmin || !processId) {
                        throw new Error('oystehr or processId is null! could not clean up!');
                    }
                    return [4 /*yield*/, (0, testScheduleUtils_1.cleanupTestScheduleResources)(processId, oystehrAdmin)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('successfully creates an in person appointment for a returning patient after selecting an available slot', function () { return __awaiter(void 0, void 0, void 0, function () {
        var initialResources, timezone, schedule, slug, patientInfo, _a, createdSlotResponse, initialSlotId, appointmentId, newSlotId;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setUpInPersonResources()];
                case 1:
                    initialResources = _b.sent();
                    timezone = initialResources.timezone, schedule = initialResources.schedule, slug = initialResources.slug;
                    patientInfo = {
                        id: existingTestPatient.id,
                        firstName: existingTestPatient.name[0].given[0],
                        lastName: existingTestPatient.name[0].family,
                        email: 'okovalenko+coolPatient@masslight.com',
                        sex: 'female',
                        dateOfBirth: existingTestPatient.birthDate,
                        newPatient: false,
                    };
                    return [4 /*yield*/, getSlot(__assign(__assign({}, initialResources), { serviceMode: utils_1.ServiceMode['in-person'], isWalkin: false, isPostTelemed: false }))];
                case 2:
                    _a = _b.sent(), createdSlotResponse = _a.slot, initialSlotId = _a.slotId;
                    return [4 /*yield*/, createAppointmentAndValidate({
                            timezone: timezone,
                            patientInfo: patientInfo,
                            patient: existingTestPatient,
                            slot: createdSlotResponse,
                        })];
                case 3:
                    appointmentId = (_b.sent()).appointmentId;
                    return [4 /*yield*/, rescheduleAndValidate({
                            appointmentId: appointmentId,
                            oldSlotId: initialSlotId,
                            slug: slug,
                            serviceMode: utils_1.ServiceMode['in-person'],
                            schedule: schedule,
                        })];
                case 4:
                    newSlotId = (_b.sent()).newSlotId;
                    return [4 /*yield*/, cancelAndValidate({
                            appointmentId: appointmentId,
                            oldSlotId: newSlotId,
                        })];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, cleanUpResources(initialResources)];
                case 6:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('successfully creates a virtual appointment for a returning patient after selecting an available slot', function () { return __awaiter(void 0, void 0, void 0, function () {
        var initialResources, timezone, schedule, slug, patientInfo, _a, createdSlotResponse, initialSlotId, appointmentId, newSlotId;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setUpVirtualResources()];
                case 1:
                    initialResources = _b.sent();
                    timezone = initialResources.timezone, schedule = initialResources.schedule, slug = initialResources.slug;
                    patientInfo = {
                        id: existingTestPatient.id,
                        firstName: existingTestPatient.name[0].given[0],
                        lastName: existingTestPatient.name[0].family,
                        sex: 'female',
                        email: 'okovalenko+coolPatient@masslight.com',
                        dateOfBirth: existingTestPatient.birthDate,
                        newPatient: false,
                    };
                    return [4 /*yield*/, getSlot(__assign(__assign({}, initialResources), { serviceMode: utils_1.ServiceMode.virtual, isWalkin: false, isPostTelemed: false }))];
                case 2:
                    _a = _b.sent(), createdSlotResponse = _a.slot, initialSlotId = _a.slotId;
                    return [4 /*yield*/, createAppointmentAndValidate({
                            timezone: timezone,
                            patientInfo: patientInfo,
                            patient: existingTestPatient,
                            slot: createdSlotResponse,
                        })];
                case 3:
                    appointmentId = (_b.sent()).appointmentId;
                    return [4 /*yield*/, rescheduleAndValidate({
                            appointmentId: appointmentId,
                            oldSlotId: initialSlotId,
                            slug: slug,
                            serviceMode: utils_1.ServiceMode.virtual,
                            schedule: schedule,
                        })];
                case 4:
                    newSlotId = (_b.sent()).newSlotId;
                    return [4 /*yield*/, cancelAndValidate({
                            appointmentId: appointmentId,
                            oldSlotId: newSlotId,
                        })];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, cleanUpResources(initialResources)];
                case 6:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('successfully creates a post-telemed appointment for a returning patient after selecting an available slot', function () { return __awaiter(void 0, void 0, void 0, function () {
        var initialResources, timezone, schedule, slug, patientInfo, createdSlotResponse, appointment, getScheduleResponse, e_7, newAvailable, index, rescheduleSlot, rescheduleSlotParams, validatedRescheduledSlot, rescheduleSlotResponse, rescheduleAppointmentResponse, e_8, apiError, e_9, apiError, canceledAppointment;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setUpInPersonResources()];
                case 1:
                    initialResources = _a.sent();
                    timezone = initialResources.timezone, schedule = initialResources.schedule, slug = initialResources.slug;
                    patientInfo = {
                        id: existingTestPatient.id,
                        firstName: existingTestPatient.name[0].given[0],
                        lastName: existingTestPatient.name[0].family,
                        email: 'okovalenko+coolPatient@masslight.com',
                        sex: 'female',
                        dateOfBirth: existingTestPatient.birthDate,
                        newPatient: false,
                    };
                    return [4 /*yield*/, getSlot(__assign(__assign({}, initialResources), { serviceMode: utils_1.ServiceMode['in-person'], isWalkin: false, isPostTelemed: true }))];
                case 2:
                    createdSlotResponse = (_a.sent()).slot;
                    return [4 /*yield*/, createAppointmentAndValidate({
                            timezone: timezone,
                            patientInfo: patientInfo,
                            patient: existingTestPatient,
                            slot: createdSlotResponse,
                        })];
                case 3:
                    appointment = (_a.sent()).appointment;
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, oystehrTestUserM2M.zambda.executePublic({
                            id: 'get-schedule',
                            slug: slug,
                            scheduleType: 'location',
                        })];
                case 5:
                    getScheduleResponse = (_a.sent()).output;
                    return [3 /*break*/, 7];
                case 6:
                    e_7 = _a.sent();
                    console.error('Error executing get-schedule zambda', e_7);
                    return [3 /*break*/, 7];
                case 7:
                    expect(getScheduleResponse).toBeDefined();
                    (0, vitest_1.assert)(getScheduleResponse);
                    newAvailable = getScheduleResponse.telemedAvailable;
                    index = Math.ceil(Math.random() * (newAvailable.length - 1)) - 1;
                    rescheduleSlot = newAvailable[index];
                    expect(rescheduleSlot).toBeDefined();
                    (0, vitest_1.assert)(rescheduleSlot);
                    rescheduleSlotParams = (0, utils_1.createSlotParamsFromSlotAndOptions)(rescheduleSlot.slot, {
                        postTelemedLabOnly: true,
                        status: 'busy-tentative',
                    });
                    return [4 /*yield*/, createSlotAndValidate({ params: rescheduleSlotParams, selectedSlot: rescheduleSlot, schedule: schedule }, oystehrTestUserM2M)];
                case 8:
                    validatedRescheduledSlot = _a.sent();
                    rescheduleSlotResponse = validatedRescheduledSlot.slot;
                    (0, vitest_1.assert)(rescheduleSlotResponse.id);
                    expect((0, utils_1.getSlotIsPostTelemed)(createdSlotResponse)).toEqual(true);
                    _a.label = 9;
                case 9:
                    _a.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, oystehrTestUserM2M.zambda.executePublic({
                            id: 'update-appointment',
                            appointmentID: appointment.id,
                            slot: rescheduleSlotResponse,
                        })];
                case 10:
                    rescheduleAppointmentResponse = (_a.sent()).output;
                    return [3 /*break*/, 12];
                case 11:
                    e_8 = _a.sent();
                    console.error('Error executing update-appointment zambda', e_8);
                    apiError = e_8;
                    expect(apiError.message).toEqual(utils_1.POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR.message);
                    expect(apiError.code).toEqual(utils_1.POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR.code);
                    return [3 /*break*/, 12];
                case 12:
                    expect(rescheduleAppointmentResponse).toBeUndefined();
                    _a.label = 13;
                case 13:
                    _a.trys.push([13, 15, , 16]);
                    return [4 /*yield*/, oystehrTestUserM2M.zambda.executePublic({
                            id: 'cancel-appointment',
                            appointmentID: appointment.id,
                            cancellationReason: 'Patient improved',
                        })];
                case 14:
                    _a.sent();
                    return [3 /*break*/, 16];
                case 15:
                    e_9 = _a.sent();
                    console.error('Error executing cancel-appointment zambda', e_9);
                    apiError = e_9;
                    expect(apiError.message).toEqual(utils_1.POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR.message);
                    expect(apiError.code).toEqual(utils_1.POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR.code);
                    return [3 /*break*/, 16];
                case 16: return [4 /*yield*/, oystehrAdmin.fhir.get({
                        resourceType: 'Appointment',
                        id: appointment.id,
                    })];
                case 17:
                    canceledAppointment = _a.sent();
                    expect(canceledAppointment).toBeDefined();
                    (0, vitest_1.assert)(canceledAppointment);
                    expect(canceledAppointment.status).toEqual('booked'); // should still be booked since we can't cancel it
                    return [4 /*yield*/, cleanUpResources(initialResources)];
                case 18:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('successfully creates an in person appointment for a new patient after selecting an available slot', function () { return __awaiter(void 0, void 0, void 0, function () {
        var initialResources, timezone, schedule, slug, newPatient, patientInfo, _a, createdSlotResponse, slotId, appointmentId, newSlotId;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    (0, vitest_1.assert)(processId);
                    return [4 /*yield*/, setUpInPersonResources()];
                case 1:
                    initialResources = _b.sent();
                    timezone = initialResources.timezone, schedule = initialResources.schedule, slug = initialResources.slug;
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
                    _a = _b.sent(), createdSlotResponse = _a.slot, slotId = _a.slotId;
                    return [4 /*yield*/, createAppointmentAndValidate({
                            timezone: timezone,
                            patientInfo: patientInfo,
                            patient: undefined,
                            slot: createdSlotResponse,
                        })];
                case 3:
                    appointmentId = (_b.sent()).appointmentId;
                    return [4 /*yield*/, rescheduleAndValidate({
                            oldSlotId: slotId,
                            appointmentId: appointmentId,
                            slug: slug,
                            serviceMode: utils_1.ServiceMode['in-person'],
                            schedule: schedule,
                        })];
                case 4:
                    newSlotId = (_b.sent()).newSlotId;
                    return [4 /*yield*/, cancelAndValidate({
                            appointmentId: appointmentId,
                            oldSlotId: newSlotId,
                        })];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, cleanUpResources(initialResources)];
                case 6:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('successfully creates a virtual appointment for a new patient after selecting an available slot', function () { return __awaiter(void 0, void 0, void 0, function () {
        var initialResources, timezone, schedule, slug, newPatient, patientInfo, _a, createdSlotResponse, slotId, appointmentId, newSlotId;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    (0, vitest_1.assert)(processId);
                    return [4 /*yield*/, setUpVirtualResources()];
                case 1:
                    initialResources = _b.sent();
                    timezone = initialResources.timezone, schedule = initialResources.schedule, slug = initialResources.slug;
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
                    return [4 /*yield*/, getSlot(__assign(__assign({}, initialResources), { serviceMode: utils_1.ServiceMode.virtual, isWalkin: false, isPostTelemed: false }))];
                case 2:
                    _a = _b.sent(), createdSlotResponse = _a.slot, slotId = _a.slotId;
                    return [4 /*yield*/, createAppointmentAndValidate({
                            timezone: timezone,
                            patientInfo: patientInfo,
                            patient: undefined,
                            slot: createdSlotResponse,
                        })];
                case 3:
                    appointmentId = (_b.sent()).appointmentId;
                    return [4 /*yield*/, rescheduleAndValidate({
                            oldSlotId: slotId,
                            slug: slug,
                            serviceMode: utils_1.ServiceMode.virtual,
                            schedule: schedule,
                            appointmentId: appointmentId,
                        })];
                case 4:
                    newSlotId = (_b.sent()).newSlotId;
                    return [4 /*yield*/, cancelAndValidate({
                            appointmentId: appointmentId,
                            oldSlotId: newSlotId,
                        })];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, cleanUpResources(initialResources)];
                case 6:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    // irl this use case doesn't make sense, but there is nothing preventing this scenario from being initiated
    // by an EHR user, so might as well test it
    test.concurrent('successfully creates a post-telemed appointment for a new patient after selecting an available slot', function () { return __awaiter(void 0, void 0, void 0, function () {
        var initialResources, timezone, createdSlotResponse, newPatient, patientInfo;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, vitest_1.assert)(processId);
                    return [4 /*yield*/, setUpInPersonResources()];
                case 1:
                    initialResources = _a.sent();
                    timezone = initialResources.timezone;
                    return [4 /*yield*/, getSlot(__assign(__assign({}, initialResources), { serviceMode: utils_1.ServiceMode['in-person'], isWalkin: false, isPostTelemed: true }))];
                case 2:
                    createdSlotResponse = (_a.sent()).slot;
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
                    return [4 /*yield*/, createAppointmentAndValidate({
                            timezone: timezone,
                            patientInfo: patientInfo,
                            patient: undefined,
                            slot: createdSlotResponse,
                        })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, cleanUpResources(initialResources)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    describe('walkin appointments', function () {
        test.concurrent('successfully creates an in-person walkin appointment for a new patient after selecting an available slot', function () { return __awaiter(void 0, void 0, void 0, function () {
            var initialResources, timezone, newPatient, patientInfo, createdSlotResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, vitest_1.assert)(processId);
                        return [4 /*yield*/, setUpInPersonResources()];
                    case 1:
                        initialResources = _a.sent();
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
                        return [4 /*yield*/, getSlot(__assign(__assign({}, initialResources), { serviceMode: utils_1.ServiceMode['in-person'], isWalkin: true, isPostTelemed: false }))];
                    case 2:
                        createdSlotResponse = (_a.sent()).slot;
                        return [4 /*yield*/, createAppointmentAndValidate({
                                timezone: timezone,
                                patientInfo: patientInfo,
                                patient: undefined,
                                slot: createdSlotResponse,
                            })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, cleanUpResources(initialResources)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test.concurrent('successfully creates an in-person walkin appointment for an existing patient after selecting an available slot', function () { return __awaiter(void 0, void 0, void 0, function () {
            var initialResources, timezone, patientInfo, createdSlotResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, vitest_1.assert)(processId);
                        return [4 /*yield*/, setUpInPersonResources()];
                    case 1:
                        initialResources = _a.sent();
                        timezone = initialResources.timezone;
                        patientInfo = {
                            id: existingTestPatient.id,
                            firstName: existingTestPatient.name[0].given[0],
                            lastName: existingTestPatient.name[0].family,
                            sex: 'female',
                            email: 'okovalenko+coolPatient@masslight.com',
                            dateOfBirth: existingTestPatient.birthDate,
                            newPatient: false,
                        };
                        return [4 /*yield*/, getSlot(__assign(__assign({}, initialResources), { serviceMode: utils_1.ServiceMode['in-person'], isWalkin: true, isPostTelemed: false }))];
                    case 2:
                        createdSlotResponse = (_a.sent()).slot;
                        return [4 /*yield*/, createAppointmentAndValidate({
                                timezone: timezone,
                                patientInfo: patientInfo,
                                patient: existingTestPatient,
                                slot: createdSlotResponse,
                            })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, cleanUpResources(initialResources)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test.concurrent('successfully creates a virtual walkin appointment for a new patient', function () { return __awaiter(void 0, void 0, void 0, function () {
            var initialResources, timezone, newPatient, patientInfo, createdSlotResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, vitest_1.assert)(processId);
                        return [4 /*yield*/, setUpVirtualResources()];
                    case 1:
                        initialResources = _a.sent();
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
                        return [4 /*yield*/, getSlot(__assign(__assign({}, initialResources), { serviceMode: utils_1.ServiceMode.virtual, isWalkin: true, isPostTelemed: false }))];
                    case 2:
                        createdSlotResponse = (_a.sent()).slot;
                        return [4 /*yield*/, createAppointmentAndValidate({
                                timezone: timezone,
                                patientInfo: patientInfo,
                                patient: undefined,
                                slot: createdSlotResponse,
                            })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, cleanUpResources(initialResources)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test.concurrent('successfully creates a virtual walkin appointment for an existing patient', function () { return __awaiter(void 0, void 0, void 0, function () {
            var initialResources, timezone, patientInfo, createdSlotResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, vitest_1.assert)(processId);
                        return [4 /*yield*/, setUpVirtualResources()];
                    case 1:
                        initialResources = _a.sent();
                        timezone = initialResources.timezone;
                        patientInfo = {
                            id: existingTestPatient.id,
                            firstName: existingTestPatient.name[0].given[0],
                            lastName: existingTestPatient.name[0].family,
                            sex: 'female',
                            email: 'okovalenko+coolPatient@masslight.com',
                            dateOfBirth: existingTestPatient.birthDate,
                            newPatient: false,
                        };
                        return [4 /*yield*/, getSlot(__assign(__assign({}, initialResources), { serviceMode: utils_1.ServiceMode.virtual, isWalkin: true, isPostTelemed: false }))];
                    case 2:
                        createdSlotResponse = (_a.sent()).slot;
                        return [4 /*yield*/, createAppointmentAndValidate({
                                timezone: timezone,
                                patientInfo: patientInfo,
                                patient: existingTestPatient,
                                slot: createdSlotResponse,
                            })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, cleanUpResources(initialResources)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
