"use strict";
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
var appointment_validation_test_1 = require("../appointment-validation.test");
var secrets_1 = require("../data/secrets");
var testScheduleUtils_1 = require("../helpers/testScheduleUtils");
describe('busy slots tests', function () {
    var oystehr;
    var token = null;
    var processId = null;
    vitest_1.vi.setConfig({ testTimeout: appointment_validation_test_1.DEFAULT_TEST_TIMEOUT });
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var AUTH0_ENDPOINT, AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS, AUTH0_AUDIENCE, FHIR_API, PROJECT_API;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    processId = (0, crypto_1.randomUUID)();
                    AUTH0_ENDPOINT = secrets_1.SECRETS.AUTH0_ENDPOINT, AUTH0_CLIENT_TESTS = secrets_1.SECRETS.AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS = secrets_1.SECRETS.AUTH0_SECRET_TESTS, AUTH0_AUDIENCE = secrets_1.SECRETS.AUTH0_AUDIENCE, FHIR_API = secrets_1.SECRETS.FHIR_API, PROJECT_API = secrets_1.SECRETS.PROJECT_API;
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)({
                            AUTH0_ENDPOINT: AUTH0_ENDPOINT,
                            AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
                            AUTH0_SECRET: AUTH0_SECRET_TESTS,
                            AUTH0_AUDIENCE: AUTH0_AUDIENCE,
                        })];
                case 1:
                    token = _a.sent();
                    oystehr = new sdk_1.default({ accessToken: token, fhirApiUrl: FHIR_API, projectApiUrl: PROJECT_API });
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
    it('when capacity is 1, no slot will be available for an hour that has a booked slot', function () { return __awaiter(void 0, void 0, void 0, function () {
        var timeNow, adjustedScheduleJSON, schedule, scheduleExtension, timezone, startDate, getSlotsInput, availableSlots, now, close, expectedList, capacityMap, capacity, bookedSlotTimes, slotInputs, getBusySlotsInput, allBusySlots, availableSlots2, expectedList2;
        return __generator(this, function (_a) {
            switch (_a.label) {
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
                    return [4 /*yield*/, (0, testScheduleUtils_1.persistSchedule)({ scheduleExtension: adjustedScheduleJSON, processId: processId }, oystehr)];
                case 1:
                    schedule = (_a.sent()).schedule;
                    expect(schedule.id).toBeDefined();
                    (0, vitest_1.assert)(schedule.id);
                    scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
                    expect(scheduleExtension).toBeDefined();
                    (0, vitest_1.assert)(scheduleExtension);
                    timezone = (0, utils_1.getTimezone)(schedule);
                    startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
                    getSlotsInput = {
                        now: startDate,
                        schedule: schedule,
                        numDays: 1,
                        busySlots: [],
                    };
                    availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
                    expect(availableSlots).toBeDefined();
                    expect(availableSlots.length).toEqual(10);
                    now = luxon_1.DateTime.fromISO(timeNow.toISO(), { zone: timezone });
                    close = now.plus({ hours: 10 });
                    expectedList = [];
                    while (now < close) {
                        expectedList.push(now.toISO());
                        now = now.plus({ minutes: 60 });
                    }
                    expect(expectedList.length).toEqual(10);
                    expect(availableSlots).toEqual(expectedList);
                    capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
                        now: startDate,
                        finishDate: startDate.plus({ days: 1 }),
                        scheduleExtension: scheduleExtension,
                        timezone: timezone,
                    });
                    now = luxon_1.DateTime.fromISO(timeNow.toISO(), { zone: timezone });
                    while (now < close) {
                        capacity = capacityMap[now.toISO()];
                        expect(capacity).toBeDefined();
                        expect(capacity).toEqual(1);
                        now = now.plus({ minutes: 60 });
                    }
                    bookedSlotTimes = [
                        timeNow.plus({ hours: 1 }).toISO(),
                        timeNow.plus({ hours: 2 }).toISO(),
                        timeNow.plus({ hours: 4 }).toISO(),
                        timeNow.plus({ hours: 7 }).toISO(),
                    ];
                    slotInputs = bookedSlotTimes.map(function (time) { return ({
                        method: 'POST',
                        resource: {
                            resourceType: 'Slot',
                            status: 'busy',
                            start: time,
                            end: luxon_1.DateTime.fromISO(time, { zone: timezone }).plus({ minutes: 15 }).toISO(),
                            serviceCategory: [utils_1.SlotServiceCategory.inPersonServiceMode],
                            schedule: {
                                reference: "Schedule/".concat(schedule.id),
                            },
                        },
                        url: '/Slot',
                    }); });
                    return [4 /*yield*/, oystehr.fhir.batch({ requests: slotInputs })];
                case 2:
                    _a.sent();
                    getBusySlotsInput = {
                        scheduleIds: [schedule.id],
                        fromISO: startDate.toISO(),
                        toISO: startDate.plus({ days: 1 }).toISO(),
                        status: ['busy'],
                    };
                    return [4 /*yield*/, (0, utils_1.getSlotsInWindow)(getBusySlotsInput, oystehr)];
                case 3:
                    allBusySlots = _a.sent();
                    expect(allBusySlots).toBeDefined();
                    expect(allBusySlots.length).toEqual(4);
                    getSlotsInput = {
                        now: startDate,
                        schedule: schedule,
                        numDays: 1,
                        busySlots: allBusySlots,
                    };
                    availableSlots2 = (0, utils_1.getAvailableSlots)(getSlotsInput);
                    expect(availableSlots2).toBeDefined();
                    expect(availableSlots2.length).toEqual(6);
                    now = luxon_1.DateTime.fromISO(timeNow.toISO(), { zone: timezone });
                    expectedList2 = [];
                    while (now < close) {
                        if (!bookedSlotTimes.includes(now.toISO())) {
                            expectedList2.push(now.toISO());
                        }
                        now = now.plus({ minutes: 60 });
                    }
                    expect(expectedList2.length).toEqual(6);
                    expect(availableSlots2).toEqual(expectedList2);
                    return [2 /*return*/];
            }
        });
    }); });
    it('removes busy slots from list returned by getAvailableSlotsForSchedules', function () { return __awaiter(void 0, void 0, void 0, function () {
        var timeNow, adjustedScheduleJSON, ownerLocation, _a, schedule, owner, scheduleExtension, timezone, startDate, getSlotsInput, availableSlots, now, close, expectedList, capacityMap, capacity, bookedSlotTimes, slotInputs, getBusySlotsInput, allBusySlots, availableSlots2, slotStartTimes, expectedList2;
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
                        name: 'BusySlotsTestLocation',
                        description: 'We only just met but I will be gone soon',
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
                    expect(schedule.id).toBeDefined();
                    (0, vitest_1.assert)(schedule.id);
                    scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
                    expect(scheduleExtension).toBeDefined();
                    (0, vitest_1.assert)(scheduleExtension);
                    timezone = (0, utils_1.getTimezone)(schedule);
                    expect(owner).toBeDefined();
                    (0, vitest_1.assert)(owner);
                    startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
                    getSlotsInput = {
                        now: startDate,
                        schedule: schedule,
                        numDays: 1,
                        busySlots: [],
                    };
                    availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
                    expect(availableSlots).toBeDefined();
                    expect(availableSlots.length).toEqual(10);
                    now = luxon_1.DateTime.fromISO(timeNow.toISO(), { zone: timezone });
                    close = now.plus({ hours: 10 });
                    expectedList = [];
                    while (now < close) {
                        expectedList.push(now.toISO());
                        now = now.plus({ minutes: 60 });
                    }
                    expect(expectedList.length).toEqual(10);
                    expect(availableSlots).toEqual(expectedList);
                    capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
                        now: startDate,
                        finishDate: startDate.plus({ days: 1 }),
                        scheduleExtension: scheduleExtension,
                        timezone: timezone,
                    });
                    now = luxon_1.DateTime.fromISO(timeNow.toISO(), { zone: timezone });
                    while (now < close) {
                        capacity = capacityMap[now.toISO()];
                        expect(capacity).toBeDefined();
                        expect(capacity).toEqual(1);
                        now = now.plus({ minutes: 60 });
                    }
                    bookedSlotTimes = [
                        timeNow.plus({ hours: 1 }).toISO(),
                        timeNow.plus({ hours: 2 }).toISO(),
                        timeNow.plus({ hours: 4 }).toISO(),
                        timeNow.plus({ hours: 7 }).toISO(),
                    ];
                    slotInputs = bookedSlotTimes.map(function (time) { return ({
                        method: 'POST',
                        resource: {
                            resourceType: 'Slot',
                            status: 'busy',
                            start: time,
                            end: luxon_1.DateTime.fromISO(time, { zone: timezone }).plus({ minutes: 15 }).toISO(),
                            serviceCategory: [utils_1.SlotServiceCategory.inPersonServiceMode],
                            schedule: {
                                reference: "Schedule/".concat(schedule.id),
                            },
                        },
                        url: '/Slot',
                    }); });
                    return [4 /*yield*/, oystehr.fhir.batch({ requests: slotInputs })];
                case 2:
                    _b.sent();
                    getBusySlotsInput = {
                        scheduleIds: [schedule.id],
                        fromISO: startDate.toISO(),
                        toISO: startDate.plus({ days: 1 }).toISO(),
                        status: ['busy'],
                    };
                    return [4 /*yield*/, (0, utils_1.getSlotsInWindow)(getBusySlotsInput, oystehr)];
                case 3:
                    allBusySlots = _b.sent();
                    expect(allBusySlots).toBeDefined();
                    expect(allBusySlots.length).toEqual(4);
                    return [4 /*yield*/, (0, utils_1.getAvailableSlotsForSchedules)({
                            scheduleList: [{ schedule: schedule, owner: owner }],
                            now: timeNow,
                            numDays: 1,
                        }, oystehr)];
                case 4:
                    availableSlots2 = (_b.sent()).availableSlots;
                    expect(availableSlots2).toBeDefined();
                    slotStartTimes = availableSlots2.map(function (si) { return si.slot.start; });
                    expect(slotStartTimes.length).toEqual(6);
                    now = luxon_1.DateTime.fromISO(timeNow.toISO(), { zone: timezone });
                    expectedList2 = [];
                    while (now < close) {
                        if (!bookedSlotTimes.includes(now.toISO())) {
                            expectedList2.push(now.toISO());
                        }
                        now = now.plus({ minutes: 60 });
                    }
                    expect(expectedList2.length).toEqual(6);
                    expect(slotStartTimes).toEqual(expectedList2);
                    return [2 /*return*/];
            }
        });
    }); });
    it('removes busy-tentative and busy-unavailable slots from list returned by getAvailableSlotsForSchedules', function () { return __awaiter(void 0, void 0, void 0, function () {
        var timeNow, adjustedScheduleJSON, ownerLocation, _a, schedule, owner, scheduleExtension, timezone, bookedSlotTimes, slotInputs, startDate, getBusySlotsInput, allBusySlots, availableSlots, slotStartTimes, now, close, expectedList;
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
                        name: 'BusySlotsTestLocation',
                        description: 'We only just met but I will be gone soon',
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
                    expect(schedule.id).toBeDefined();
                    (0, vitest_1.assert)(schedule.id);
                    scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
                    expect(scheduleExtension).toBeDefined();
                    (0, vitest_1.assert)(scheduleExtension);
                    timezone = (0, utils_1.getTimezone)(schedule);
                    expect(owner).toBeDefined();
                    (0, vitest_1.assert)(owner);
                    bookedSlotTimes = [
                        timeNow.plus({ hours: 1 }).toISO(),
                        timeNow.plus({ hours: 2 }).toISO(),
                        timeNow.plus({ hours: 4 }).toISO(),
                        timeNow.plus({ hours: 7 }).toISO(),
                    ];
                    slotInputs = bookedSlotTimes.map(function (time, idx) { return ({
                        method: 'POST',
                        resource: {
                            resourceType: 'Slot',
                            status: idx % 2 === 0 ? 'busy-tentative' : 'busy-unavailable',
                            start: time,
                            end: luxon_1.DateTime.fromISO(time, { zone: timezone }).plus({ minutes: 15 }).toISO(),
                            serviceCategory: [utils_1.SlotServiceCategory.inPersonServiceMode],
                            schedule: {
                                reference: "Schedule/".concat(schedule.id),
                            },
                        },
                        url: '/Slot',
                    }); });
                    return [4 /*yield*/, oystehr.fhir.batch({ requests: slotInputs })];
                case 2:
                    _b.sent();
                    startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
                    getBusySlotsInput = {
                        scheduleIds: [schedule.id],
                        fromISO: startDate.toISO(),
                        toISO: startDate.plus({ days: 1 }).toISO(),
                        status: ['busy-tentative', 'busy-unavailable'],
                    };
                    return [4 /*yield*/, (0, utils_1.getSlotsInWindow)(getBusySlotsInput, oystehr)];
                case 3:
                    allBusySlots = _b.sent();
                    expect(allBusySlots).toBeDefined();
                    expect(allBusySlots.length).toEqual(4);
                    return [4 /*yield*/, (0, utils_1.getAvailableSlotsForSchedules)({
                            scheduleList: [{ schedule: schedule, owner: owner }],
                            now: timeNow,
                            numDays: 1,
                        }, oystehr)];
                case 4:
                    availableSlots = (_b.sent()).availableSlots;
                    expect(availableSlots).toBeDefined();
                    slotStartTimes = availableSlots.map(function (si) { return si.slot.start; });
                    expect(slotStartTimes.length).toEqual(6);
                    now = luxon_1.DateTime.fromISO(timeNow.toISO(), { zone: timezone });
                    close = now.plus({ hours: 10 });
                    expectedList = [];
                    while (now < close) {
                        if (!bookedSlotTimes.includes(now.toISO())) {
                            expectedList.push(now.toISO());
                        }
                        now = now.plus({ minutes: 60 });
                    }
                    expect(expectedList.length).toEqual(6);
                    expect(slotStartTimes).toEqual(expectedList);
                    return [2 /*return*/];
            }
        });
    }); });
    it('makes busy-tentative slots available again after 10 minutes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var timeNow, adjustedScheduleJSON, ownerLocation, _a, schedule, owner, scheduleExtension, timezone, bookedSlotTimes, slotInputs, startDate, getBusySlotsInput, allBusySlots, availableSlots, slotStartTimes, now, close, expectedList;
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
                        name: 'BusySlotsTestLocation',
                        description: 'We only just met but I will be gone soon',
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
                    expect(schedule.id).toBeDefined();
                    (0, vitest_1.assert)(schedule.id);
                    scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
                    expect(scheduleExtension).toBeDefined();
                    (0, vitest_1.assert)(scheduleExtension);
                    timezone = (0, utils_1.getTimezone)(schedule);
                    expect(owner).toBeDefined();
                    (0, vitest_1.assert)(owner);
                    bookedSlotTimes = [
                        timeNow.plus({ hours: 1 }).toISO(),
                        timeNow.plus({ hours: 2 }).toISO(),
                        timeNow.plus({ hours: 4 }).toISO(),
                        timeNow.plus({ hours: 7 }).toISO(),
                    ];
                    slotInputs = bookedSlotTimes.map(function (time) { return ({
                        method: 'POST',
                        resource: {
                            resourceType: 'Slot',
                            status: 'busy-tentative',
                            start: time,
                            end: luxon_1.DateTime.fromISO(time, { zone: timezone }).plus({ minutes: 15 }).toISO(),
                            serviceCategory: [utils_1.SlotServiceCategory.inPersonServiceMode],
                            schedule: {
                                reference: "Schedule/".concat(schedule.id),
                            },
                        },
                        url: '/Slot',
                    }); });
                    return [4 /*yield*/, oystehr.fhir.batch({ requests: slotInputs })];
                case 2:
                    _b.sent();
                    startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
                    getBusySlotsInput = {
                        scheduleIds: [schedule.id],
                        fromISO: startDate.toISO(),
                        toISO: startDate.plus({ days: 1 }).toISO(),
                        status: ['busy-tentative'],
                    };
                    return [4 /*yield*/, (0, utils_1.getSlotsInWindow)(getBusySlotsInput, oystehr)];
                case 3:
                    allBusySlots = _b.sent();
                    expect(allBusySlots).toBeDefined();
                    expect(allBusySlots.length).toEqual(4);
                    return [4 /*yield*/, (0, utils_1.getAvailableSlotsForSchedules)({
                            scheduleList: [{ schedule: schedule, owner: owner }],
                            now: timeNow,
                            numDays: 1,
                            slotExpirationBiasInSeconds: 10 * 60 + 2,
                        }, oystehr)];
                case 4:
                    availableSlots = (_b.sent()).availableSlots;
                    expect(availableSlots).toBeDefined();
                    slotStartTimes = availableSlots.map(function (si) { return si.slot.start; });
                    expect(slotStartTimes.length).toEqual(10);
                    now = luxon_1.DateTime.fromISO(timeNow.toISO(), { zone: timezone });
                    close = now.plus({ hours: 10 });
                    expectedList = [];
                    while (now < close) {
                        expectedList.push(now.toISO());
                        now = now.plus({ minutes: 60 });
                    }
                    expect(expectedList.length).toEqual(10);
                    expect(slotStartTimes).toEqual(expectedList);
                    return [2 /*return*/];
            }
        });
    }); });
});
