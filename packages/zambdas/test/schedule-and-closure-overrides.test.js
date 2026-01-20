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
/* eslint-disable @typescript-eslint/no-unused-vars */
var sdk_1 = require("@oystehr/sdk");
var luxon_1 = require("luxon");
var react_1 = require("react");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var useCheckOfficeOpen_1 = require("../../../apps/intake/src/hooks/useCheckOfficeOpen");
var get_schedule_1 = require("../src/patient/get-schedule");
var overrideData = require("./data/override-constants");
var slotData = require("./data/slot-constants");
var slot_constants_1 = require("./data/slot-constants");
var testScheduleUtils_1 = require("./helpers/testScheduleUtils");
var oystehr = new sdk_1.default({});
describe.skip('test schedule override for getAvailableSlots function, i.e., front end slot display', function () {
    test('1: it should return slots between 6pm and 10pm today if opening buffer 15, capacity 3, and schedule override is applied for today open @6pm close @10pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, overrideInfo, schedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
            overrideInfo = overrideData.todaySlotScheduleOverride;
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 15, 0, overrideInfo).schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.overrideSlotMapGroupC);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('2: it should return slots between 1pm and 5pm for today and tomorrow if opening buffer 15, capacity 3, and schedule override is applied for past week', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, overrideInfo, schedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 12 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 13, close: 17, workingDay: true },
            ];
            overrideInfo = overrideData.pastScheduleOverride2;
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 15, 0, overrideInfo).schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupC), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotsTimesGroupC), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('3: it should return slots between 1pm and 5pm for today and tomorrow if opening buffer 15, capacity 3, and schedule override is applied for future week', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, overrideInfo, schedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 12 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 13, close: 17, workingDay: true },
            ];
            overrideInfo = overrideData.futureScheduleOverride2;
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 15, 0, overrideInfo).schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupC), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotsTimesGroupC), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('4: it should return slots between 8pm and 12am for today if capacity 3 and no schedule override', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, schedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 20, close: 24, workingDay: true }];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 0, 0).schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotMapZ);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test closure override for getAvailableSlots function, i.e., front end slot display', function () {
    test('1: it should return tomorrow slots if opening buffer 15, capacity 3, and closure override is applied for today', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, closures, schedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 13, close: 17, workingDay: true },
            ];
            closures = overrideData.todayClosureOverrideForOneDay;
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 15, 0, undefined, closures).schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotsTimesGroupC);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('2: it should return slots for today and tomorrow if opening buffer 15, capacity 3, and closure override is applied for past week', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, closures, schedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 12 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 13, close: 17, workingDay: true },
            ];
            closures = overrideData.pastClosureOverrideForOneDay;
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 15, 0, undefined, closures).schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupC), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotsTimesGroupC), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
    test('3: it should return slots for today and tomorrow if opening buffer 15, capacity 3, and closure override is applied for future week', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, tomorrow, tomorrowDoW, hoursInfo, closures, schedule, testSlots, expectedSlots;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 12 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            tomorrow = time.plus({ day: 1 });
            tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
            hoursInfo = [
                { dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true },
                { dayOfWeek: tomorrowDoW, open: 13, close: 17, workingDay: true },
            ];
            closures = overrideData.futureClosureOverrideForOneDay;
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 3, 15, 0, undefined, closures).schedule;
            testSlots = (0, utils_1.getAvailableSlots)({ now: time, schedule: schedule, numDays: 1, busySlots: [] });
            expectedSlots = __spreadArray(__spreadArray([], (0, slot_constants_1.addDateToSlotTimes)(time, slotData.slotsTimesGroupC), true), (0, slot_constants_1.addDateToSlotTimes)(tomorrow, slotData.slotsTimesGroupC), true);
            (0, vitest_1.expect)(testSlots).toEqual(expectedSlots);
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test schedule override for getSlotCapacityMapForDayAndSchedule function', function () {
    test('1: capacity 15, no buffers, open @10am close @3pm; schedule override capacity 15, opening buffer 15, closing buffer 15, open @1pm close @2pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, scheduleDetails, testSlotCapacityMap, expectedSlotMap;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 15, workingDay: true }];
            overrideInfo = overrideData.overrideScheduleA;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            scheduleDetails = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDetails)
                throw new Error('location does not have schedule');
            testSlotCapacityMap = (0, utils_1.getSlotCapacityMapForDayAndSchedule)(time, scheduleDetails.schedule, scheduleDetails.scheduleOverrides, scheduleDetails.closures);
            expectedSlotMap = slotData.addDateToSlotMap(time, slotData.overrideSlotMapA);
            (0, vitest_1.expect)(testSlotCapacityMap).toEqual(expectedSlotMap);
            return [2 /*return*/];
        });
    }); });
    test('2: capacity 15, no buffers, open @10am close @3pm; schedule past override but same week day', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, overrideInfo, schedule, scheduleDetails, testSlotCapacityMap, expectedSlotMap;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 15, workingDay: true }];
            overrideInfo = overrideData.pastScheduleOverride1;
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo).schedule;
            scheduleDetails = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDetails)
                throw new Error('location does not have schedule');
            testSlotCapacityMap = (0, utils_1.getSlotCapacityMapForDayAndSchedule)(time, scheduleDetails.schedule, scheduleDetails.scheduleOverrides, scheduleDetails.closures);
            expectedSlotMap = slotData.addDateToSlotMap(time, slotData.slotMapA);
            (0, vitest_1.expect)(testSlotCapacityMap).toEqual(expectedSlotMap);
            return [2 /*return*/];
        });
    }); });
    test('3: capacity 15, no buffers, open @10am close @3pm; schedule future override but same week day', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, overrideInfo, schedule, scheduleDetails, testSlotCapacityMap, expectedSlotMap;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 10, close: 15, workingDay: true }];
            overrideInfo = overrideData.futureScheduleOverride1;
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo).schedule;
            scheduleDetails = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDetails)
                throw new Error('location does not have schedule');
            testSlotCapacityMap = (0, utils_1.getSlotCapacityMapForDayAndSchedule)(time, scheduleDetails.schedule, scheduleDetails.scheduleOverrides, scheduleDetails.closures);
            expectedSlotMap = slotData.addDateToSlotMap(time, slotData.slotMapA);
            (0, vitest_1.expect)(testSlotCapacityMap).toEqual(expectedSlotMap);
            return [2 /*return*/];
        });
    }); });
    test('4: capacity 15, no buffers, open @8pm close @12am; no schedule override', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, overrideInfo, schedule, scheduleDetails, testSlotCapacityMap, expectedSlotMap;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 20, close: 24, workingDay: true }];
            overrideInfo = [];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo).schedule;
            scheduleDetails = (0, utils_1.getScheduleExtension)(schedule);
            if (!scheduleDetails)
                throw new Error('location does not have schedule');
            testSlotCapacityMap = (0, utils_1.getSlotCapacityMapForDayAndSchedule)(time, scheduleDetails === null || scheduleDetails === void 0 ? void 0 : scheduleDetails.schedule, scheduleDetails === null || scheduleDetails === void 0 ? void 0 : scheduleDetails.scheduleOverrides, scheduleDetails === null || scheduleDetails === void 0 ? void 0 : scheduleDetails.closures);
            expectedSlotMap = slotData.addDateToSlotMap(time, slotData.slotMapB);
            (0, vitest_1.expect)(testSlotCapacityMap).toEqual(expectedSlotMap);
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test schedule override for officeOpen', function () {
    var originalUseMemo;
    beforeAll(function () {
        originalUseMemo = react_1.default.useMemo;
        react_1.default.useMemo = jest.fn(function (fn) {
            var memoizedValue = fn();
            return memoizedValue;
        });
    });
    afterAll(function () {
        react_1.default.useMemo = originalUseMemo;
    });
    test('1: it should return officeOpen as true if current time is 8am today, open @12am, close @11pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, _a, location, schedule, selectedLocation, testOfficeOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 0, close: 23, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testOfficeOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testOfficeOpen.officeOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('2: it should return officeOpen as false if current time is 8am today, open @2pm, close @11pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, _a, location, schedule, selectedLocation, testOfficeOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 14, close: 23, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testOfficeOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testOfficeOpen.officeOpen).toBe(false);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('3: it should return officeOpen as true if current time is 1pm today, open @9am, close @10pm and schedule override is applied for past week with open @8pm, close @10pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testOfficeOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 13 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
            overrideInfo = overrideData.pastScheduleOverride2;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testOfficeOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testOfficeOpen.officeOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('4: it should return officeOpen as true if current time is 1pm today, open @9am, close @10pm and schedule override is applied for future week with open @8pm, close @10pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testOfficeOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 13 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
            overrideInfo = overrideData.futureScheduleOverride2;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testOfficeOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testOfficeOpen.officeOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('5: it should return officeOpen as false if current time is 1pm today, open @9am, close @10pm and schedule override is applied today with open @5pm, close @10pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testOfficeOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 13 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
            overrideInfo = overrideData.todayScheduleOverride;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testOfficeOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testOfficeOpen.officeOpen).toBe(false);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('6: it should return officeOpen as true if current time is 11am today, open @4pm, close @10pm and schedule override is applied today with open @9am, close @12pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testOfficeOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 11 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 16, close: 22, workingDay: true }];
            overrideInfo = overrideData.todayScheduleOverride2;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testOfficeOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testOfficeOpen.officeOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('7: it should return officeOpen as true if current time is 7pm today, open @9am, close @12pm and schedule override is applied today with open @5pm, close @10pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testOfficeOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 19 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 12, workingDay: true }];
            overrideInfo = overrideData.todayScheduleOverride;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testOfficeOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testOfficeOpen.officeOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('8: it should return officeOpen as true if current time is 7pm today, open @9am, close @12pm and schedule override is applied today with open @5pm, close @12am', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testOfficeOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 19 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 12, workingDay: true }];
            overrideInfo = overrideData.todayScheduleOverrideMidnight;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testOfficeOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testOfficeOpen.officeOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test schedule override for walkinOpen', function () {
    var originalUseMemo;
    beforeAll(function () {
        originalUseMemo = react_1.default.useMemo;
        react_1.default.useMemo = jest.fn(function (fn) {
            var memoizedValue = fn();
            return memoizedValue;
        });
    });
    afterAll(function () {
        react_1.default.useMemo = originalUseMemo;
    });
    test('1: it should return walkinOpen as true if current time is 8am today, open @12am, close @11pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, _a, location, schedule, selectedLocation, testWalkinOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 0, close: 23, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testWalkinOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testWalkinOpen.walkinOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    // case where walkin should be open 15 minutes prior to the office opening time
    test('2: it should return walkinOpen as true if current time is 8:50am today, open @9am, close @11pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, _a, location, schedule, selectedLocation, testWalkinOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8, minute: 50 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testWalkinOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testWalkinOpen.walkinOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('3: it should return walkinOpen as false if current time is 9pm today, open @2pm, close @5pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, _a, location, schedule, selectedLocation, testWalkinOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 21 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 14, close: 17, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testWalkinOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testWalkinOpen.walkinOpen).toBe(false);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('4: it should return walkinOpen as true if current time is 1pm today, open @9am, close @10pm and schedule override is applied for past week with open @8pm, close @10pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testWalkinOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 13 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
            overrideInfo = overrideData.pastScheduleOverride2;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testWalkinOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testWalkinOpen.walkinOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('5: it should return walkinOpen as true if current time is 1pm today, open @9am, close @10pm and schedule override is applied for future week with open @8pm, close @10pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testWalkinOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 13 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
            overrideInfo = overrideData.futureScheduleOverride2;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testWalkinOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testWalkinOpen.walkinOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('6: it should return walkinOpen as false if current time is 1pm today, open @9am, close @10pm and schedule override is applied today with open @5pm, close @10pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testWalkinOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 13 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
            overrideInfo = overrideData.todayScheduleOverride;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testWalkinOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testWalkinOpen.walkinOpen).toBe(false);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('7: it should return walkin as true if current time is 11am today, open @4pm, close @10pm and schedule override is applied today with open @9am, close @12pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testWalkinOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 11 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 16, close: 22, workingDay: true }];
            overrideInfo = overrideData.todayScheduleOverride2;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testWalkinOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testWalkinOpen.walkinOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('8: it should return walkinOpen as true if current time is 7pm today, open @9am, close @12pm and schedule override is applied today with open @5pm, close @10pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testWalkinOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 19 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 12, workingDay: true }];
            overrideInfo = overrideData.todayScheduleOverride;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testWalkinOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testWalkinOpen.walkinOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('9: it should return walkinOpen as true if current time is 7pm today, open @9am, close @12pm and schedule override is applied today with open @5pm, close @12am', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, overrideInfo, _a, location, schedule, selectedLocation, testWalkinOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 19 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 12, workingDay: true }];
            overrideInfo = overrideData.todayScheduleOverrideMidnight;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, overrideInfo), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testWalkinOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testWalkinOpen.walkinOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('10: it should return walkinOpen as false if current time is 4pm today, open @9am, close @11pm, but it is a non-working day, i.e., workingDay = false', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, _a, location, schedule, selectedLocation, testWalkinOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 16 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: false }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, [], []), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testWalkinOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testWalkinOpen.walkinOpen).toBe(false);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test closure override for officeHasClosureOverrideToday', function () {
    var originalUseMemo;
    beforeAll(function () {
        originalUseMemo = react_1.default.useMemo;
        react_1.default.useMemo = jest.fn(function (fn) {
            var memoizedValue = fn();
            return memoizedValue;
        });
    });
    afterAll(function () {
        react_1.default.useMemo = originalUseMemo;
    });
    test('1: it should return officeHasClosureOverrideToday as true if current time is 8am today, open @8am, close @3pm and closure override is applied for today', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, closures, _a, location, schedule, selectedLocation, testResult;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
            closures = overrideData.todayClosureOverrideForOneDay;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, undefined, closures), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testResult = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testResult.officeHasClosureOverrideToday).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('2: it should return officeHasClosureOverrideToday as false if current time is 8am today, open @8am, close @3pm and closure override is applied for past week', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, closures, _a, location, schedule, selectedLocation, testResult;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
            closures = overrideData.pastClosureOverrideForOneDay;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, undefined, closures), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testResult = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testResult.officeHasClosureOverrideToday).toBe(false);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('3: it should return officeHasClosureOverrideToday as false if current time is 8am today, open @8am, close @3pm and closure override is applied for future week', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, closures, _a, location, schedule, selectedLocation, testResult;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
            closures = overrideData.futureClosureOverrideForOneDay;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, undefined, closures), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testResult = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testResult.officeHasClosureOverrideToday).toBe(false);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test closure override for officeHasClosureOverrideTomorrow', function () {
    var originalUseMemo;
    beforeAll(function () {
        originalUseMemo = react_1.default.useMemo;
        react_1.default.useMemo = jest.fn(function (fn) {
            var memoizedValue = fn();
            return memoizedValue;
        });
    });
    afterAll(function () {
        react_1.default.useMemo = originalUseMemo;
    });
    test('1: it should return officeHasClosureOverrideTomorrow as true if current time is 8am today, open @8am, close @3pm and closure override is applied for tomorrow', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, closures, _a, location, schedule, selectedLocation, testResult;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
            closures = overrideData.tomorrowClosureOverrideForOneDay;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, undefined, closures), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testResult = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testResult.officeHasClosureOverrideTomorrow).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('2: it should return officeHasClosureOverrideTomorrow as false if current time is 8am today, open @8am, close @3pm and closure override is applied for past week', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, closures, _a, location, schedule, selectedLocation, testResult;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
            closures = overrideData.pastClosureOverrideForOneDay;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, undefined, closures), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testResult = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testResult.officeHasClosureOverrideTomorrow).toBe(false);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('3: it should return officeHasClosureOverrideTomorrow as false if current time is 8am today, open @8am, close @3pm and closure override is applied for future week', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, closures, _a, location, schedule, selectedLocation, testResult;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
            closures = overrideData.futureClosureOverrideForOneDay;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, undefined, closures), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testResult = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testResult.officeHasClosureOverrideTomorrow).toBe(false);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('4: it should return officeHasClosureOverrideToday and officeHasClosureOverrideTomorrow as true if current time is 8am today, open @8am, close @3pm and closure override is applied for period starting today until next week', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, closures, _a, location, schedule, selectedLocation, testResult;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 8 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
            closures = overrideData.closureOverrideForPeriod;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 0, undefined, closures), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testResult = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testResult.officeHasClosureOverrideTomorrow && testResult.officeHasClosureOverrideTomorrow).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test prebookStillOpenForToday, officeOpen, and walkinOpen when no slots are available', function () {
    var originalUseMemo;
    beforeAll(function () {
        originalUseMemo = react_1.default.useMemo;
        react_1.default.useMemo = jest.fn(function (fn) {
            var memoizedValue = fn();
            return memoizedValue;
        });
    });
    afterAll(function () {
        react_1.default.useMemo = originalUseMemo;
    });
    test('1: it should return officeOpen as true if no slots are available for today, current time is 10pm today, closing buffer 60, open @9am, close @11pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, _a, location, schedule, selectedLocation, testOfficeOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 22 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 60), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testOfficeOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testOfficeOpen.officeOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('2: it should return walkinOpen as true if no slots are available for today, current time is 10pm today, closing buffer 60, open @9am, close @11pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, _a, location, schedule, selectedLocation, testWalkinOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 22 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 60), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testWalkinOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testWalkinOpen.walkinOpen).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('3: it should return prebookStillOpenForToday as true if no slots are available for today, current time is 9:59pm today, closing buffer 60, open @9am, close @11pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, _a, location, schedule, selectedLocation, testPrebookOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 21, minute: 59 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 60), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testPrebookOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testPrebookOpen.prebookStillOpenForToday).toBe(true);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
    test('4: it should return prebookStillOpenForToday as false if current time is 10:30pm today, closing buffer 60, open @9am, close @11pm', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, spy, todayDoW, hoursInfo, _a, location, schedule, selectedLocation, testPrebookOpen;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 22, minute: 30 });
            spy = vitest_1.vi.spyOn(luxon_1.DateTime, 'now');
            spy.mockReturnValue(time);
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 60), location = _a.location, schedule = _a.schedule;
            selectedLocation = (0, utils_1.getLocationInformation)(location, schedule);
            testPrebookOpen = (0, useCheckOfficeOpen_1.useCheckOfficeOpen)(selectedLocation);
            (0, vitest_1.expect)(testPrebookOpen.prebookStillOpenForToday).toBe(false);
            spy.mockRestore();
            return [2 /*return*/];
        });
    }); });
});
describe.skip('test getNextOpeningDateTime', function () {
    test('1: it should return opening time for today if walkin is closed and current time is before opening time', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, schedule, testResult, expectedResult;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 9, minute: 30 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 18, close: 23, workingDay: true }];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 60).schedule;
            testResult = (0, get_schedule_1.getNextOpeningDateTime)(time, schedule);
            expectedResult = luxon_1.DateTime.now().set({ hour: 18, minute: 0 }).setZone('utc').toFormat('HH:mm MM-dd-yyyy z');
            (0, vitest_1.expect)(testResult).toBe(expectedResult);
            return [2 /*return*/];
        });
    }); });
    test('2: it should return opening time for tomorrow if walkin is closed and current time is after opening time', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, todayDoW, hoursInfo, schedule, testResult, expectedResult;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 18, minute: 30 });
            todayDoW = time.weekdayLong.toLocaleLowerCase();
            hoursInfo = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 60).schedule;
            testResult = (0, get_schedule_1.getNextOpeningDateTime)(time, schedule);
            expectedResult = luxon_1.DateTime.now()
                .set({ hour: 5, minute: 0 })
                .setZone('utc')
                .plus({ day: 1 })
                .toFormat('HH:mm MM-dd-yyyy z');
            (0, vitest_1.expect)(testResult).toBe(expectedResult);
            return [2 /*return*/];
        });
    }); });
    test('3: it should return opening time for 5th day from today if walkin is closed, it is a working day, no schedule override, closure override for 4 days, and current time is after opening time', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, hoursInfo, closures, schedule, testResult, expectedResult;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 18, minute: 30, weekday: 1 });
            hoursInfo = [
                { dayOfWeek: 'monday', open: 10, close: 18, workingDay: true },
                { dayOfWeek: 'friday', open: 3, close: 18, workingDay: true },
            ];
            closures = overrideData.closureOverrideFourDays;
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 60, undefined, closures).schedule;
            testResult = (0, get_schedule_1.getNextOpeningDateTime)(time, schedule);
            expectedResult = luxon_1.DateTime.now()
                .set({ weekday: 1, hour: 3, minute: 0 })
                .plus({ day: 4 })
                .setZone('utc')
                .toFormat('HH:mm MM-dd-yyyy z');
            (0, vitest_1.expect)(testResult).toBe(expectedResult);
            return [2 /*return*/];
        });
    }); });
    test('4: it should return opening time of schedule override for tomorrow if walkin is closed, it is a working day, schedule override is for tomorrow, closure override is for today, and current time is after opening time', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, hoursInfo, overrideInfo, closures, schedule, testResult, expectedResult;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 18, minute: 30, weekday: 1 });
            hoursInfo = [{ dayOfWeek: 'monday', open: 7, close: 18, workingDay: true }];
            overrideInfo = overrideData.tuesdayScheduleOverride;
            closures = overrideData.mondayClosureOverrideForOneDay;
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 60, overrideInfo, closures).schedule;
            testResult = (0, get_schedule_1.getNextOpeningDateTime)(time, schedule);
            expectedResult = luxon_1.DateTime.now()
                .set({ weekday: 1, hour: 8, minute: 0 })
                .plus({ day: 1 })
                .setZone('utc')
                .toFormat('HH:mm MM-dd-yyyy z');
            (0, vitest_1.expect)(testResult).toBe(expectedResult);
            return [2 /*return*/];
        });
    }); });
    test('5: it should return opening time for 3rd day from today if walkin is closed, it is a non-working day, no schedule override, closure override is for tomorrow, and current time is after opening time', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, hoursInfo, closures, _a, location, schedule, testResult, expectedResult;
        return __generator(this, function (_b) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 18, minute: 30, weekday: 1 });
            hoursInfo = [
                { dayOfWeek: 'monday', open: 7, close: 18, workingDay: false },
                { dayOfWeek: 'wednesday', open: 7, close: 18, workingDay: true },
            ];
            closures = overrideData.tuesdayClosureOverrideForOneDay;
            _a = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 60, [], closures), location = _a.location, schedule = _a.schedule;
            testResult = (0, get_schedule_1.getNextOpeningDateTime)(time, schedule);
            expectedResult = luxon_1.DateTime.now()
                .set({ weekday: 1, hour: 7, minute: 0 })
                .plus({ day: 2 })
                .setZone('utc')
                .toFormat('HH:mm MM-dd-yyyy z');
            (0, vitest_1.expect)(testResult).toBe(expectedResult);
            return [2 /*return*/];
        });
    }); });
    test('6: it should return opening time of schedule override for tomorrow if walkin is closed, it is a non-working day, schedule override is for tomorrow, no closure override, and current time is after opening time', function () { return __awaiter(void 0, void 0, void 0, function () {
        var time, hoursInfo, overrideInfo, schedule, testResult, expectedResult;
        return __generator(this, function (_a) {
            time = luxon_1.DateTime.now().startOf('day').set({ hour: 18, minute: 30, weekday: 1 });
            hoursInfo = [
                { dayOfWeek: 'monday', open: 7, close: 18, workingDay: true },
                { dayOfWeek: 'tuesday', open: 16, close: 18, workingDay: true },
            ];
            overrideInfo = overrideData.tuesdayScheduleOverride;
            schedule = (0, testScheduleUtils_1.makeLocationWithSchedule)(hoursInfo, 15, 0, 60, overrideInfo).schedule;
            testResult = (0, get_schedule_1.getNextOpeningDateTime)(time, schedule);
            expectedResult = luxon_1.DateTime.now()
                .set({ weekday: 1, hour: 8, minute: 0 })
                .plus({ day: 1 })
                .setZone('utc')
                .toFormat('HH:mm MM-dd-yyyy z');
            (0, vitest_1.expect)(testResult).toBe(expectedResult);
            return [2 /*return*/];
        });
    }); });
});
