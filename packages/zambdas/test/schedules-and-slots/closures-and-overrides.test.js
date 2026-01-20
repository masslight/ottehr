"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var appointment_validation_test_1 = require("../appointment-validation.test");
var testScheduleUtils_1 = require("../helpers/testScheduleUtils");
describe('closure and override tests', function () {
    vitest_1.vi.setConfig({ testTimeout: appointment_validation_test_1.DEFAULT_TEST_TIMEOUT });
    it('one day closure today results in no slots for today but all slots for tomorrow', function () {
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)();
        var scheduleExtension = (0, testScheduleUtils_1.addClosureDay)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, startDate);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleExtension });
        var timezone = (0, utils_1.getTimezone)(schedule);
        var getSlotsInput = {
            now: startDate,
            schedule: schedule,
            numDays: 2,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(96);
        var tomorrowStart = startDate.plus({ days: 1 });
        var tomorrowEnd = tomorrowStart.endOf('day');
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList = [];
        while (now <= tomorrowEnd) {
            if (now >= tomorrowStart) {
                expectedList.push(now.toISO());
            }
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList.length).toEqual(96);
        expect(availableSlots).toEqual(expectedList);
        // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
        // to verify that the number of slots in each time slot is correct
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate,
            finishDate: startDate.plus({ days: 2 }),
            scheduleExtension: scheduleExtension,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        while (now <= tomorrowEnd) {
            var capacity = capacityMap[now.toISO()];
            if (now >= tomorrowStart) {
                expect(capacity).toBeDefined();
                expect(capacity).toEqual(1);
            }
            else {
                expect(capacity).toBeUndefined();
            }
            now = now.plus({ minutes: 15 });
        }
    });
    it("closure starting tomorrow has no affect on today's slots, but does eliminate tomorrow's", function () {
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)();
        var closureDate = startDate.plus({ days: 1 });
        var scheduleExtension = (0, testScheduleUtils_1.addClosurePeriod)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, closureDate, 1);
        scheduleExtension = (0, testScheduleUtils_1.addClosureDay)(scheduleExtension, closureDate);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleExtension });
        var timezone = (0, utils_1.getTimezone)(schedule);
        var getSlotsInput = {
            now: startDate,
            schedule: schedule,
            numDays: 2,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(96);
        var tomorrowStart = startDate.plus({ days: 1 });
        var tomorrowEnd = tomorrowStart.endOf('day');
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList = [];
        while (now <= tomorrowEnd) {
            if (now < tomorrowStart) {
                expectedList.push(now.toISO());
            }
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList.length).toEqual(96);
        expect(availableSlots).toEqual(expectedList);
        // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
        // to verify that the number of slots in each time slot is correct
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate,
            finishDate: startDate.plus({ days: 2 }),
            scheduleExtension: scheduleExtension,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        while (now <= tomorrowEnd) {
            var capacity = capacityMap[now.toISO()];
            if (now < tomorrowStart) {
                expect(capacity).toBeDefined();
                expect(capacity).toEqual(1);
            }
            else {
                expect(capacity).toBeUndefined();
            }
            now = now.plus({ minutes: 15 });
        }
    });
    it('period closure starting today results in no slots for either today or tomorrow (period.end is inclusive of the entire day)', function () {
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)();
        var scheduleExtension = (0, testScheduleUtils_1.addClosurePeriod)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, startDate, 1);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleExtension });
        var timezone = (0, utils_1.getTimezone)(schedule);
        var getSlotsInput = {
            now: startDate,
            schedule: schedule,
            numDays: 2,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(0);
        var tomorrowStart = startDate.plus({ days: 1 });
        var tomorrowEnd = tomorrowStart.endOf('day');
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList = [];
        expect(expectedList.length).toEqual(0);
        expect(availableSlots).toEqual(expectedList);
        // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
        // to verify that the number of slots in each time slot is correct
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate,
            finishDate: startDate.plus({ days: 2 }),
            scheduleExtension: scheduleExtension,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        while (now <= tomorrowEnd) {
            var capacity = capacityMap[now.toISO()];
            expect(capacity).toBeUndefined();
            now = now.plus({ minutes: 15 });
        }
    });
    it("closure one week ago has no impact on today's slots", function () {
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)();
        var closureDate = startDate.minus({ weeks: 1 });
        var scheduleExtension = (0, testScheduleUtils_1.addClosurePeriod)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, closureDate, 1);
        scheduleExtension = (0, testScheduleUtils_1.addClosureDay)(scheduleExtension, closureDate);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleExtension });
        var timezone = (0, utils_1.getTimezone)(schedule);
        var getSlotsInput = {
            now: startDate,
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(96);
        var tomorrowStart = startDate.plus({ days: 1 });
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList = [];
        while (now < tomorrowStart) {
            expectedList.push(now.toISO());
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList.length).toEqual(96);
        expect(availableSlots).toEqual(expectedList);
        // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
        // to verify that the number of slots in each time slot is correct
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate,
            finishDate: startDate.plus({ days: 1 }),
            scheduleExtension: scheduleExtension,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        while (now < tomorrowStart) {
            var capacity = capacityMap[now.toISO()];
            expect(capacity).toBeDefined();
            expect(capacity).toEqual(1);
            now = now.plus({ minutes: 15 });
        }
    });
    it("closure one year ago has no impact on today's slots", function () {
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)();
        var closureDate = startDate.minus({ years: 1 });
        var scheduleExtension = (0, testScheduleUtils_1.addClosurePeriod)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, closureDate, 1);
        scheduleExtension = (0, testScheduleUtils_1.addClosureDay)(scheduleExtension, closureDate);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleExtension });
        var timezone = (0, utils_1.getTimezone)(schedule);
        var getSlotsInput = {
            now: startDate,
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(96);
        var tomorrowStart = startDate.plus({ days: 1 });
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList = [];
        while (now < tomorrowStart) {
            expectedList.push(now.toISO());
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList.length).toEqual(96);
        expect(availableSlots).toEqual(expectedList);
        // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
        // to verify that the number of slots in each time slot is correct
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate,
            finishDate: startDate.plus({ days: 1 }),
            scheduleExtension: scheduleExtension,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        while (now < tomorrowStart) {
            var capacity = capacityMap[now.toISO()];
            expect(capacity).toBeDefined();
            expect(capacity).toEqual(1);
            now = now.plus({ minutes: 15 });
        }
    });
    // do some override tests
    it('applies open override makes slots available where they would not otherwise be', function () {
        var _a;
        var startTime = (0, testScheduleUtils_1.startOfDayWithTimezone)().set({ hour: 11 });
        var todayDoW = (_a = startTime.weekdayLong) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase();
        (0, vitest_1.assert)(todayDoW);
        var hoursInfo = [{ dayOfWeek: todayDoW, open: 16, close: 22, workingDay: true }];
        var scheduleExtension = (0, testScheduleUtils_1.adjustHoursOfOperation)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, hoursInfo);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        console.log('scheduleExtension', JSON.stringify(scheduleExtension, null, 2));
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleExtension });
        var timezone = (0, utils_1.getTimezone)(schedule);
        var getSlotsInput = {
            now: startTime,
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(24);
        // first we verify that there are no slots available until 16:00
        var earliestExpectedSlot = startTime.plus({ hours: 5 }).startOf('hour');
        availableSlots.forEach(function (slot) {
            var slotDateTime = luxon_1.DateTime.fromISO(slot, { zone: timezone });
            expect(slotDateTime >= earliestExpectedSlot).toBeTruthy();
        });
        var overrideInfo = {
            date: startTime.startOf('day'),
            open: 9,
            close: 12,
            openingBuffer: 0,
            closingBuffer: 0,
            hourlyCapacity: 4,
        };
        var newScheduleExtension = (0, testScheduleUtils_1.addOverrides)(scheduleExtension, [overrideInfo]);
        expect(newScheduleExtension).toBeDefined();
        (0, vitest_1.assert)(newScheduleExtension);
        var newSchedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: newScheduleExtension });
        getSlotsInput = {
            now: startTime.startOf('day'),
            schedule: newSchedule,
            numDays: 1,
            busySlots: [],
        };
        availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(12);
        earliestExpectedSlot = startTime.startOf('day').plus({ hours: 9 }).startOf('hour');
        var latestExpectedSlot = startTime.startOf('day').plus({ hours: 12 }).startOf('hour').minus({ minutes: 15 });
        availableSlots.forEach(function (slot) {
            var slotDateTime = luxon_1.DateTime.fromISO(slot, { zone: timezone });
            expect(slotDateTime >= earliestExpectedSlot).toBeTruthy();
            expect(slotDateTime <= latestExpectedSlot).toBeTruthy();
        });
        var now = luxon_1.DateTime.fromISO(startTime.startOf('day').toISO(), { zone: timezone });
        var tomorrowStart = startTime.startOf('day').plus({ days: 1 }).startOf('day');
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startTime.startOf('day'),
            finishDate: startTime.startOf('day').plus({ days: 1 }),
            scheduleExtension: newScheduleExtension,
            timezone: timezone,
        });
        while (now < tomorrowStart) {
            var capacity = capacityMap[now.toISO()];
            if (now >= earliestExpectedSlot && now <= latestExpectedSlot) {
                expect(capacity).toBeDefined();
                expect(capacity).toEqual(1);
            }
            else {
                expect(capacity).toBeUndefined();
            }
            now = now.plus({ minutes: 15 });
        }
    });
    it('applies closed override to make slots unavailable where they would otherwise be available', function () {
        var _a;
        var startTime = (0, testScheduleUtils_1.startOfDayWithTimezone)();
        var todayDoW = (_a = startTime.weekdayLong) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase();
        (0, vitest_1.assert)(todayDoW);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: testScheduleUtils_1.DEFAULT_SCHEDULE_JSON });
        var timezone = (0, utils_1.getTimezone)(schedule);
        var getSlotsInput = {
            now: startTime,
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(96);
        var overrideInfo = {
            date: startTime.startOf('day'),
            open: 9,
            close: 12,
            openingBuffer: 0,
            closingBuffer: 0,
            hourlyCapacity: 4,
        };
        var newScheduleExtension = (0, testScheduleUtils_1.addOverrides)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [overrideInfo]);
        expect(newScheduleExtension).toBeDefined();
        (0, vitest_1.assert)(newScheduleExtension);
        var newSchedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: newScheduleExtension });
        getSlotsInput = {
            now: startTime.startOf('day'),
            schedule: newSchedule,
            numDays: 1,
            busySlots: [],
        };
        availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(12);
        var earliestExpectedSlot = startTime.startOf('day').plus({ hours: 9 }).startOf('hour');
        var latestExpectedSlot = startTime.startOf('day').plus({ hours: 12 }).startOf('hour').minus({ minutes: 15 });
        availableSlots.forEach(function (slot) {
            var slotDateTime = luxon_1.DateTime.fromISO(slot, { zone: timezone });
            expect(slotDateTime >= earliestExpectedSlot).toBeTruthy();
            expect(slotDateTime <= latestExpectedSlot).toBeTruthy();
        });
        var now = luxon_1.DateTime.fromISO(startTime.startOf('day').toISO(), { zone: timezone });
        var tomorrowStart = startTime.startOf('day').plus({ days: 1 }).startOf('day');
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startTime.startOf('day'),
            finishDate: startTime.startOf('day').plus({ days: 1 }),
            scheduleExtension: newScheduleExtension,
            timezone: timezone,
        });
        while (now < tomorrowStart) {
            var capacity = capacityMap[now.toISO()];
            if (now >= earliestExpectedSlot && now <= latestExpectedSlot) {
                expect(capacity).toBeDefined();
                expect(capacity).toEqual(1);
            }
            else {
                expect(capacity).toBeUndefined();
            }
            now = now.plus({ minutes: 15 });
        }
    });
    it('applies buffer overrides to make slots unavailable where they would otherwise be available', function () {
        var _a;
        var startTime = (0, testScheduleUtils_1.startOfDayWithTimezone)();
        var todayDoW = (_a = startTime.weekdayLong) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase();
        (0, vitest_1.assert)(todayDoW);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: testScheduleUtils_1.DEFAULT_SCHEDULE_JSON });
        var timezone = (0, utils_1.getTimezone)(schedule);
        var getSlotsInput = {
            now: startTime,
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(96);
        var existingConfig = (0, testScheduleUtils_1.getScheduleDay)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, startTime);
        (0, vitest_1.assert)(existingConfig);
        var overrideInfo = {
            date: startTime.startOf('day'),
            open: existingConfig.open,
            close: existingConfig.close,
            openingBuffer: 60,
            closingBuffer: 60,
            hourlyCapacity: 4,
        };
        var newScheduleExtension = (0, testScheduleUtils_1.addOverrides)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [overrideInfo]);
        expect(newScheduleExtension).toBeDefined();
        (0, vitest_1.assert)(newScheduleExtension);
        var newSchedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: newScheduleExtension });
        getSlotsInput = {
            now: startTime.startOf('day'),
            schedule: newSchedule,
            numDays: 1,
            busySlots: [],
        };
        availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(88);
        var earliestExpectedSlot = startTime.startOf('day').plus({ hours: 1 }).startOf('hour');
        var latestExpectedSlot = startTime.plus({ days: 1 }).minus({ hours: 1, minutes: 15 });
        console.log('earliestExpectedSlot', earliestExpectedSlot.toISO());
        console.log('latestExpectedSlot', latestExpectedSlot.toISO());
        availableSlots.forEach(function (slot) {
            var slotDateTime = luxon_1.DateTime.fromISO(slot, { zone: timezone });
            expect(slotDateTime >= earliestExpectedSlot).toBeTruthy();
            expect(slotDateTime <= latestExpectedSlot).toBeTruthy();
        });
        var now = luxon_1.DateTime.fromISO(startTime.startOf('day').toISO(), { zone: timezone });
        var tomorrowStart = startTime.startOf('day').plus({ days: 1 }).startOf('day');
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startTime.startOf('day'),
            finishDate: startTime.startOf('day').plus({ days: 1 }),
            scheduleExtension: newScheduleExtension,
            timezone: timezone,
        });
        while (now < tomorrowStart) {
            var capacity = capacityMap[now.toISO()];
            if (now >= earliestExpectedSlot && now <= latestExpectedSlot) {
                expect(capacity).toBeDefined();
                expect(capacity).toEqual(1);
            }
            else {
                expect(capacity).toBeUndefined();
            }
            now = now.plus({ minutes: 15 });
        }
    });
    it('applies capacity overrides to make slots unavailable where they would otherwise be available', function () {
        var _a;
        var startTime = (0, testScheduleUtils_1.startOfDayWithTimezone)();
        var todayDoW = (_a = startTime.weekdayLong) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase();
        (0, vitest_1.assert)(todayDoW);
        var scheduleExtension = (0, testScheduleUtils_1.changeAllCapacities)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, 1);
        console.log('scheduleExtension', JSON.stringify(scheduleExtension, null, 2));
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleExtension });
        var timezone = (0, utils_1.getTimezone)(schedule);
        var getSlotsInput = {
            now: startTime,
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        console.log('availableSlots last test', availableSlots);
        expect(availableSlots.length).toEqual(24);
        var existingConfig = (0, testScheduleUtils_1.getScheduleDay)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, startTime);
        (0, vitest_1.assert)(existingConfig);
        var granularHours = [
            { hour: 0, capacity: 4 },
            { hour: 1, capacity: 8 },
            { hour: 2, capacity: 4 },
            { hour: 3, capacity: 8 },
            { hour: 4, capacity: 4 },
            { hour: 5, capacity: 8 },
            { hour: 6, capacity: 4 },
            { hour: 7, capacity: 8 },
            { hour: 8, capacity: 4 },
            { hour: 9, capacity: 8 },
            { hour: 10, capacity: 4 },
            { hour: 11, capacity: 8 },
            { hour: 12, capacity: 4 },
            { hour: 13, capacity: 8 },
            { hour: 14, capacity: 4 },
            { hour: 15, capacity: 8 },
            { hour: 16, capacity: 4 },
            { hour: 17, capacity: 8 },
            { hour: 18, capacity: 4 },
            { hour: 19, capacity: 8 },
            { hour: 20, capacity: 4 },
            { hour: 21, capacity: 8 },
            { hour: 22, capacity: 4 },
            { hour: 23, capacity: 8 },
        ];
        var overrideInfo = {
            date: startTime.startOf('day'),
            open: existingConfig.open,
            close: existingConfig.close,
            openingBuffer: existingConfig.openingBuffer,
            closingBuffer: existingConfig.closingBuffer,
            hourlyCapacity: 4,
            granularCapacityOverride: granularHours,
        };
        var newScheduleExtension = (0, testScheduleUtils_1.addOverrides)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [overrideInfo]);
        expect(newScheduleExtension).toBeDefined();
        (0, vitest_1.assert)(newScheduleExtension);
        var newSchedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: newScheduleExtension });
        getSlotsInput = {
            now: startTime.startOf('day'),
            schedule: newSchedule,
            numDays: 1,
            busySlots: [],
        };
        availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(96);
        var now = luxon_1.DateTime.fromISO(startTime.startOf('day').toISO(), { zone: timezone });
        var tomorrowStart = startTime.startOf('day').plus({ days: 1 }).startOf('day');
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startTime.startOf('day'),
            finishDate: startTime.startOf('day').plus({ days: 1 }),
            scheduleExtension: newScheduleExtension,
            timezone: timezone,
        });
        while (now < tomorrowStart) {
            var capacity = capacityMap[now.toISO()];
            expect(capacity).toBeDefined();
            var hour = now.hour;
            if (hour % 2 === 0) {
                expect(capacity).toEqual(1);
            }
            else {
                expect(capacity).toEqual(2);
            }
            now = now.plus({ minutes: 15 });
        }
    });
});
