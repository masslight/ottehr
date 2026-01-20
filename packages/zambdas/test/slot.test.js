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
exports.DEFAULT_TEST_TIMEOUT = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars */
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var slotData = require("./data/slot-constants");
var slot_constants_1 = require("./data/slot-constants");
var testScheduleUtils_1 = require("./helpers/testScheduleUtils");
exports.DEFAULT_TEST_TIMEOUT = 100000;
var makeAppointments = function (input) {
    return input.times.map(function (time, idx) {
        var _a;
        var zoneSensitiveStart = time;
        if (input.timezone) {
            zoneSensitiveStart = time.setZone(input.timezone);
        }
        var status = (_a = input.statusAll) !== null && _a !== void 0 ? _a : input.statuses[idx];
        var appt = {
            resourceType: 'Appointment',
            id: (0, crypto_1.randomUUID)(),
            start: zoneSensitiveStart.toISO() || '',
            status: status,
            participant: [],
        };
        return appt;
    });
};
var slotFromStartISO = function (start, lengthInHours, scheduleId) {
    var slot = {
        resourceType: 'Slot',
        id: (0, crypto_1.randomUUID)(),
        start: start,
        status: 'busy',
        end: luxon_1.DateTime.fromISO(start)
            .plus({ hours: lengthInHours !== null && lengthInHours !== void 0 ? lengthInHours : 0.25 })
            .toISO() || '',
        schedule: scheduleId ? { reference: "Schedule/".concat(scheduleId) } : { reference: "Schedule/".concat((0, crypto_1.randomUUID)()) },
    };
    return slot;
};
var makeSlots = function (input) {
    return input.times.map(function (time, idx) {
        var _a;
        var zoneSensitiveStart = time;
        if (input.timezone) {
            zoneSensitiveStart = time.setZone(input.timezone);
        }
        var status = (_a = input.statusAll) !== null && _a !== void 0 ? _a : input.statuses[idx];
        var slot = {
            resourceType: 'Slot',
            id: (0, crypto_1.randomUUID)(),
            start: zoneSensitiveStart.toISO() || '',
            status: status,
            end: time.plus({ hours: 1 }).toISO() || '',
            schedule: { reference: 'Schedule/some' },
        };
        return slot;
    });
};
describe.skip('test front end slot display: different capacities, no buffers, no busy slots, no appointments', function () {
    vitest_1.vi.setConfig({ testTimeout: exports.DEFAULT_TEST_TIMEOUT });
    test('1: capacity 4, now 2pm, opens @10am, closes @6pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, scheduleDTO, allSlotsForDay, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 14 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 0), location = _a.location, schedule = _a.schedule;
            scheduleDTO = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDTO)
                throw new Error('location does not have schedule');
            allSlotsForDay = (0, utils_1.convertCapacityMapToSlotList)((0, utils_1.getAllSlotsAsCapacityMap)({
                scheduleExtension: scheduleDTO,
                now: time,
                finishDate: time.plus({ days: 1 }),
                timezone: (0, utils_1.getTimezone)(schedule),
            }));
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            (0, vitest_1.expect)(allSlotsForDay).toEqual(testSlots);
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T14:15:00.000-04:00', 'T14:30:00.000-04:00'], slotData.slotsTimesGroupA, true)), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotTimesAllDay10to6Cap4), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('2: capacity 6, now 2pm, opens @10am, closes @6pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 14 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 6, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T14:15:00.000-04:00', 'T14:30:00.000-04:00'], slotData.slotsTimesGroupA, true)), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotTimesAllDay10to6Cap4), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('3: capacity 3, now 2pm, opens @10am, closes @6pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 14 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T14:15:00.000-04:00'], slotData.slotsTimesGroupB, true)), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotTimesAllDay10to6Cap3), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('4: capacity 2, now 8am, opens @10am, closes @3pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 15, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupM);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('5: capacity 1, now 8am, open @12am close @12am', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 0, close: 0, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 1, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupQ);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('6: capacity 4, now 2:15pm, opens @10am, closes @6pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 14, minute: 15 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T14:30:00.000-04:00'], slotData.slotsTimesGroupA, true)), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotTimesAllDay10to6Cap4), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('7: capacity 4, now 2:13pm, opens @10am, closes @6pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 14, minute: 13 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T14:30:00.000-04:00'], slotData.slotsTimesGroupA, true)), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotTimesAllDay10to6Cap4), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('8: capacity 4, now 2:21pm, opens @10am, closes @6pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 14, minute: 21 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupA), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotTimesAllDay10to6Cap4), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('9: capacity 4, now 3:03pm, opens @10am, closes @6pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 15, minute: 3 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupA.slice(3)), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotTimesAllDay10to6Cap4), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('10.1: capacity 4, now 2:37pm, opens @10am, closes @6pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 14, minute: 37 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupA.slice(1)), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotTimesAllDay10to6Cap4), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('10.2: capacity 4, now 1:53pm, opens @10am, closes @6pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 13, minute: 53 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T14:15:00.000-04:00', 'T14:30:00.000-04:00'], slotData.slotsTimesGroupA, true)), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotTimesAllDay10to6Cap4), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('10.3: capacity 4, now 2:25pm, opens @10am, closes @6pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 14, minute: 25 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupA), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotTimesAllDay10to6Cap4), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('11: test first slot display (40 minutes from now), now 10:04am, office is opened', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 10, minute: 4 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T10:30:00.000-04:00'], slotData.slotsTimesGroupZ, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('11.5: test first slot display (40 minutes from now), now 10:06am, office is opened', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, schedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 10, minute: 6 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 0).schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T10:30:00.000-04:00'], slotData.slotsTimesGroupZ, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test front end slot display: straight forward opening and closing buffers, capacity 4, no busy slots, no appointments', function () {
    test('1: opening buffer 15', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 15, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], slotData.slotsTimesForOpeningBuffer15, true), slotData.slotsTimesForOpeningBuffer30, true), slotData.slotsTimesForOpeningBuffer45, true), slotData.slotsTimesForOpeningBuffer60, true), slotData.slotsTimesForOpeningBufferBase, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('1.5: opening buffer 15, capacity 1', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 1, 15, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesForOpeningBufferWith1Cap);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('2: opening buffer 30', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 30, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(__spreadArray(__spreadArray(__spreadArray([], slotData.slotsTimesForOpeningBuffer30, true), slotData.slotsTimesForOpeningBuffer45, true), slotData.slotsTimesForOpeningBuffer60, true), slotData.slotsTimesForOpeningBufferBase, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('2: opening buffer 45', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 45, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(__spreadArray(__spreadArray([], slotData.slotsTimesForOpeningBuffer45, true), slotData.slotsTimesForOpeningBuffer60, true), slotData.slotsTimesForOpeningBufferBase, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('3: opening buffer 60', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 60, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(__spreadArray([], slotData.slotsTimesForOpeningBuffer60, true), slotData.slotsTimesForOpeningBufferBase, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('4: opening buffer 90', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 90, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesForOpeningBufferBase);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('5: closing buffer 15', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 15), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], slotData.slotsTimesForClosingBufferBase, true), slotData.slotsTimesForClosingBuffer60, true), slotData.slotsTimesForClosingBuffer45, true), slotData.slotsTimesForClosingBuffer30, true), slotData.slotsTimesForClosingBuffer15, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('5.5: closing buffer 15, capacity 3', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 30), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesForClosingBufferWith3Cap);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('6: closing buffer 30', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 30), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(__spreadArray(__spreadArray(__spreadArray([], slotData.slotsTimesForClosingBufferBase, true), slotData.slotsTimesForClosingBuffer60, true), slotData.slotsTimesForClosingBuffer45, true), slotData.slotsTimesForClosingBuffer30, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('6.5: closing buffer 30, capacity 2', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 0, 30), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesForClosingBufferWith2Cap);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('7: closing buffer 45', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 45), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(__spreadArray(__spreadArray([], slotData.slotsTimesForClosingBufferBase, true), slotData.slotsTimesForClosingBuffer60, true), slotData.slotsTimesForClosingBuffer45, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('8: closing buffer 60', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 60), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(__spreadArray([], slotData.slotsTimesForClosingBufferBase, true), slotData.slotsTimesForClosingBuffer60, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('9: closing buffer 90', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 90), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesForClosingBufferBase);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test front end slot display: opening and closing buffers, varied capacity, varied busy slot & appointments', function () {
    test('1: opening buffer 15 & capacity 3', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 15, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupC);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('2: opening buffer 30 & capacity 3', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 30, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupD);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('3: closing buffer 30 & capacity 3', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 30), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupE);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('4: closing buffer 30 & capacity 3, 2 appointments', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, apptTimes, busySlots, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 30), location = _a.location, schedule = _a.schedule;
            apptTimes = [time.plus({ hour: 5, minutes: 15 }), time.plus({ hour: 5, minutes: 45 })];
            busySlots = makeAppointments({
                times: apptTimes,
                statuses: [],
                statusAll: 'booked',
            }).map(function (appt) { return slotFromStartISO(appt.start, 0.25, schedule.id); });
            (0, vitest_1.expect)(busySlots.length).toBe(2);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: schedule,
                busySlots: busySlots,
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupN);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    // same as above but with capacity 4
    test('4.5: closing buffer 30 & capacity 4, 2 appointments', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, apptTimes, busySlots, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 30), location = _a.location, schedule = _a.schedule;
            apptTimes = [time.plus({ hour: 5, minutes: 15 }), time.plus({ hour: 5, minutes: 45 })];
            busySlots = makeAppointments({
                times: apptTimes,
                statuses: [],
                statusAll: 'booked',
            }).map(function (appt) { return slotFromStartISO(appt.start, 0.25, schedule.id); });
            (0, vitest_1.expect)(busySlots.length).toBe(2);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: schedule,
                busySlots: busySlots,
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupF);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('5: closing buffer 30 & capacity 3, 2 busy slots', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, schedule, slotTimes, busySlots, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 30).schedule;
            slotTimes = [time.plus({ hour: 5 }), time.plus({ hour: 6 })];
            busySlots = makeSlots({
                times: slotTimes,
                statuses: [],
                statusAll: 'busy-tentative',
            });
            (0, vitest_1.expect)(busySlots.length).toBe(2);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: schedule,
                busySlots: busySlots,
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupG);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('6: closing buffer 30 & capacity 3, 3 busy slots', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, slotTimes, slots, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 30), location = _a.location, schedule = _a.schedule;
            slotTimes = [time.plus({ hour: 5 }), time.plus({ hour: 5, minutes: 15 }), time.plus({ hour: 6 })];
            slots = makeSlots({
                times: slotTimes,
                statuses: [],
                statusAll: 'busy-tentative',
            });
            (0, vitest_1.expect)(slots.length).toBe(3);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: schedule,
                busySlots: slots,
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupH);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('7: closing buffer 30 & capacity 3, 3 busy slots, 2 appointments', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, slotTimes, slots, apptTimes, appointmentSlots, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 30), location = _a.location, schedule = _a.schedule;
            slotTimes = [time.plus({ hour: 5 }), time.plus({ hour: 5, minutes: 15 }), time.plus({ hour: 6 })];
            slots = makeSlots({
                times: slotTimes,
                statuses: [],
                statusAll: 'busy-tentative',
            });
            apptTimes = [time.plus({ hour: 5, minutes: 45 }), time.plus({ hour: 7, minutes: 15 })];
            appointmentSlots = makeAppointments({
                times: apptTimes,
                statuses: [],
                statusAll: 'booked',
            }).map(function (appt) { return slotFromStartISO(appt.start, 0.25, schedule.id); });
            (0, vitest_1.expect)(slots.length).toBe(3);
            (0, vitest_1.expect)(appointmentSlots.length).toBe(2);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: schedule,
                busySlots: __spreadArray(__spreadArray([], slots, true), appointmentSlots, true),
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupI);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('8: closing buffer 30 & capacity 3, 1 appointment in middle hour', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, schedule, apptTimes, appointmentSlots, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 30).schedule;
            apptTimes = [time.plus({ hour: 7, minutes: 15 })];
            appointmentSlots = makeAppointments({
                times: apptTimes,
                statuses: [],
                statusAll: 'booked',
            }).map(function (appt) { return slotFromStartISO(appt.start, 0.25, schedule.id); });
            (0, vitest_1.expect)(appointmentSlots.length).toBe(1);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: schedule,
                busySlots: appointmentSlots,
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupJ);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    // currently expecting this to fail
    test('9: closing buffer 30 & capacity 3, 1 appointment at unexpected time (expecting failure atm)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, apptTimes, appointmentSlots, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 30), location = _a.location, schedule = _a.schedule;
            apptTimes = [time.plus({ hour: 7, minutes: 30 })];
            appointmentSlots = makeAppointments({
                times: apptTimes,
                statuses: [],
                statusAll: 'booked',
            }).map(function (appt) { return slotFromStartISO(appt.start, 0.25, schedule.id); });
            (0, vitest_1.expect)(appointmentSlots.length).toBe(1);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: schedule,
                busySlots: appointmentSlots,
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupK);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('10: opening buffer 15, closing buffer 15 & capacity 3', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 15, 15), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupL);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('11: closing buffer 15 & capacity 4', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 0, 15), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupO);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('12: open @8pm close @12am, capacity 3 with 60 minute closing buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 20, close: 0, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 60), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupP);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('13: open @10am close @5pm, capacity 4, 30 min open + close buffers, specific capacity on 2 hours', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, schedule, scheduleDetails, updatedDailySchedule, updatedSchedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 17, workingDay: true }];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 30, 30).schedule;
            scheduleDetails = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDetails)
                throw new Error('location does not have schedule');
            updatedDailySchedule = (0, testScheduleUtils_1.setHourlyCapacity)((0, testScheduleUtils_1.setHourlyCapacity)(scheduleDetails.schedule, todayDoW, 11, 2), todayDoW, 13, 2);
            scheduleDetails.schedule = updatedDailySchedule;
            updatedSchedule = (0, testScheduleUtils_1.replaceSchedule)(schedule, scheduleDetails);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: updatedSchedule,
                busySlots: [],
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupR);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('14: open @1pm close @5pm, capacity 4, specific capacity 1 during hour 13, 15 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, schedule, scheduleDetails, updatedDailySchedule, updatedSchedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 15, 0).schedule;
            scheduleDetails = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDetails)
                throw new Error('location does not have schedule');
            updatedDailySchedule = (0, testScheduleUtils_1.setHourlyCapacity)(scheduleDetails.schedule, todayDoW, 13, 1);
            scheduleDetails.schedule = updatedDailySchedule;
            updatedSchedule = (0, testScheduleUtils_1.replaceSchedule)(schedule, scheduleDetails);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: updatedSchedule,
                busySlots: [],
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupS);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('15: open @1pm close @5pm, capacity 1, no buffers, 1 appointment on the hour', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, schedule, apptTimes, appointmentSlots, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 1, 0, 0).schedule;
            apptTimes = [time.plus({ hour: 7, minutes: 0 })];
            appointmentSlots = makeAppointments({
                times: apptTimes,
                statuses: [],
                statusAll: 'booked',
            }).map(function (appt) { return slotFromStartISO(appt.start, 0.25, schedule.id); });
            (0, vitest_1.expect)(appointmentSlots.length).toBe(1);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: schedule,
                busySlots: appointmentSlots,
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupT);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    // same as above but with a busy slot instead of an appointment
    test('15.5: open @1pm close @5pm, capacity 1, no buffers, 1 busy on the hour', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, slotTimes, slots, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 1, 0, 0), location = _a.location, schedule = _a.schedule;
            slotTimes = [time.plus({ hour: 7 })];
            slots = makeSlots({
                times: slotTimes,
                statuses: [],
                statusAll: 'busy-tentative',
            });
            (0, vitest_1.expect)(slots.length).toBe(1);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: schedule,
                busySlots: [],
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupT);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('16: open @2pm close @6pm, capacity 3, 15 minute opening + closing buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, scheduleDetails, updatedDailySchedule, updatedSchedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 14, close: 18, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 15, 15), location = _a.location, schedule = _a.schedule;
            scheduleDetails = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDetails)
                throw new Error('location does not have schedule');
            updatedDailySchedule = (0, testScheduleUtils_1.setHourlyCapacity)(scheduleDetails.schedule, todayDoW, 14, 1);
            scheduleDetails.schedule = updatedDailySchedule;
            updatedSchedule = (0, testScheduleUtils_1.replaceSchedule)(schedule, scheduleDetails);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: updatedSchedule,
                busySlots: [],
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupU);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    // todo check all of the below changes
    test('17: open @2pm close @6pm, capacity 1, 15 minute opening + closing buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, schedule, scheduleDetails, updatedDailySchedule, updatedSchedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 15, minute: 6 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 14, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 14, close: 18, workingDay: true },
            ];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 1, 15, 15).schedule;
            scheduleDetails = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDetails)
                throw new Error('location does not have schedule');
            updatedDailySchedule = (0, testScheduleUtils_1.setHourlyCapacity)(scheduleDetails.schedule, todayDoW, 16, 0);
            scheduleDetails.schedule = updatedDailySchedule;
            updatedSchedule = (0, testScheduleUtils_1.replaceSchedule)(schedule, scheduleDetails);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: updatedSchedule,
                busySlots: [],
            });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupV), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotsTimesGroupV2), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('18: open @2pm close @6pm, capacity 2, 15 minute opening + closing buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, schedule, scheduleDetails, updatedDailySchedule, updatedSchedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 15, minute: 6 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 14, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 14, close: 18, workingDay: true },
            ];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 1, 15, 15).schedule;
            scheduleDetails = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDetails)
                throw new Error('location does not have schedule');
            updatedDailySchedule = (0, testScheduleUtils_1.setHourlyCapacity)(scheduleDetails.schedule, todayDoW, 16, 0);
            updatedDailySchedule = (0, testScheduleUtils_1.setHourlyCapacity)(updatedDailySchedule, todayDoW, 17, 2);
            scheduleDetails.schedule = updatedDailySchedule;
            updatedSchedule = (0, testScheduleUtils_1.replaceSchedule)(schedule, scheduleDetails);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: updatedSchedule,
                busySlots: [],
            });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupW), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotsTimesGroupV2), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('19: now is 8am (before hour where we show tomorrow slots), today slots are 0, with buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, schedule, scheduleDetails, updatedDailySchedule, updatedSchedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8, minute: 6 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 7, close: 10, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 14, close: 18, workingDay: true },
            ];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 1, 15, 15).schedule;
            scheduleDetails = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDetails)
                throw new Error('location does not have schedule');
            updatedDailySchedule = (0, testScheduleUtils_1.setHourlyCapacity)(scheduleDetails.schedule, todayDoW, 9, 0);
            scheduleDetails.schedule = updatedDailySchedule;
            updatedSchedule = (0, testScheduleUtils_1.replaceSchedule)(schedule, scheduleDetails);
            testSlots = (0, utils_1.getAvailableSlots)({
                now: time,
                numDays: 1,
                schedule: updatedSchedule,
                busySlots: [],
            });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotsTimesGroupV2);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('19.5: now is 816am (before hour where we show tomorrow slots) and today slots are 0, without buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8, minute: 16 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 7, close: 9, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 14, close: 18, workingDay: true },
            ];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 1, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotsTimesGroupV3);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('20: open @8am, close @1pm, now 937am, capacity 3, no buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 37 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray([
                'T10:00:00.000-04:00',
                'T10:15:00.000-04:00'
            ], slotData.slotsTimesGroupA1, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('20.1: open @8am, close @1pm, now 925am, capacity 3, no buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 25 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray([
                'T09:45:00.000-04:00',
                'T10:00:00.000-04:00',
                'T10:15:00.000-04:00'
            ], slotData.slotsTimesGroupA1, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('20.2: open @8am, close @1pm, now 920am, capacity 3, no buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 20 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray([
                'T09:45:00.000-04:00',
                'T10:00:00.000-04:00',
                'T10:15:00.000-04:00'
            ], slotData.slotsTimesGroupA1, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('21: open @8am, close @1pm, now 920am, capacity 2, no buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 20 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray([
                'T10:00:00.000-04:00',
                'T10:30:00.000-04:00'
            ], slotData.slotsTimesGroupA2, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('21.1: open @8am, close @1pm, now 927am, capacity 2, no buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 27 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray([
                'T10:00:00.000-04:00',
                'T10:30:00.000-04:00'
            ], slotData.slotsTimesGroupA2, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('21.2: open @8am, close @1pm, now 940am, capacity 2, no buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 40 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray([
                'T10:00:00.000-04:00',
                'T10:30:00.000-04:00'
            ], slotData.slotsTimesGroupA2, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('21.3: open @8am, close @1pm, now 955am, capacity 2, no buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 55 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T10:30:00.000-04:00'], slotData.slotsTimesGroupA2, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('22: open @10am, close @1pm, now 7am, capacity 2, 15 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 7 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 15, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray([
                'T10:15:00.000-04:00',
                'T10:45:00.000-04:00'
            ], slotData.slotsTimesGroupA2, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('22.1: open @10am, close @1pm, now 7am, capacity 2, no buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 7 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray([
                'T10:00:00.000-04:00',
                'T10:30:00.000-04:00'
            ], slotData.slotsTimesGroupA2, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('23.1: open @10am, close @1pm, now 10:01am, capacity 2, no buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T10:30:00.000-04:00'], slotData.slotsTimesGroupA2, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('23.2: open @10am, close @1pm, now 10:01am, capacity 2, 15 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 15, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T10:15:00.000-04:00'], slotData.slotsTimesGroupA3.slice(1), true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('23.3: open @10am, close @1pm, now 10:01am, capacity 2, 30 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 30, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupA3);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('23.4: open @10am, close @1pm, now 10:01am, capacity 2, 60 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 60, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupA2);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('23.5: open @10am, close @1pm, now 9:43am, capacity 2, no buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 43 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray([
                'T10:00:00.000-04:00',
                'T10:30:00.000-04:00'
            ], slotData.slotsTimesGroupA2, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('23.6: open @10am, close @1pm, now 9:43am, capacity 2, 15 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 43 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 15, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T10:15:00.000-04:00'], slotData.slotsTimesGroupA3.slice(1), true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('23.7: open @10am, close @1pm, now 9:43am, capacity 2, 30 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 43 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 30, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupA3);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('23.8: open @10am, close @1pm, now 9:49am, capacity 2, no buffers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 49 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 0, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T10:30:00.000-04:00'], slotData.slotsTimesGroupA2, true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('23.9: open @10am, close @1pm, now 9:52am, capacity 2, 15 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 52 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 15, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, __spreadArray(['T10:15:00.000-04:00'], slotData.slotsTimesGroupA3.slice(1), true));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('23.10: open @10am, close @1pm, now 9:52am, capacity 2, 30 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 52 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 30, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupA3);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('23.11: open @10am, close @1pm, now 9:52am, capacity 2, 60 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 52 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 2, 60, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupA3.slice(2));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('24: open @10am, close @1pm, now 10:01am, capacity 4, 60 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 60, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupA4);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('24.1: open @10am, close @1pm, now 10:01am, capacity 4, 90 minute opening buffer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, _a, location, schedule, testSlots, expectedSlots;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 4, 90, 0), location = _a.location, schedule = _a.schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupA4.slice(2));
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test back end slot generation', function () {
    test('1: capacity 15, no buffers, open @10am close @3pm ', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, schedule, scheduleDetails, testSlotCapacityMap, expectedSlotMap;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 15, workingDay: true }];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0).schedule;
            scheduleDetails = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDetails)
                throw new Error('location does not have schedule');
            testSlotCapacityMap = (0, utils_1.getSlotCapacityMapForDayAndSchedule)(time, scheduleDetails.schedule, scheduleDetails.scheduleOverrides, scheduleDetails.closures);
            expectedSlotMap = (0, slot_constants_1.addDateToSlotMap)(time, slotData.slotMapA);
            (0, vitest_1.expect)(testSlotCapacityMap).toEqual(expectedSlotMap);
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test closures', function () {
    test('1: today closed now 8am, opens @10am, closes @6pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, closures, schedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
            ];
            closures = [
                {
                    type: utils_1.ClosureType.OneDay,
                    start: time.startOf('day').toFormat(utils_1.OVERRIDE_DATE_FORMAT),
                    end: time.endOf('day').toFormat(utils_1.OVERRIDE_DATE_FORMAT),
                },
            ];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 0, undefined, closures).schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotTimesAllDay10to6Cap3), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
});
