"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var appointment_validation_test_1 = require("../appointment-validation.test");
var testScheduleUtils_1 = require("../helpers/testScheduleUtils");
describe('walkin availability tests', function () {
    vitest_1.vi.setConfig({ testTimeout: appointment_validation_test_1.DEFAULT_TEST_TIMEOUT });
    it('should make walkin available before close time, but not at exactly close time', function () {
        // a reasonable requirement might be that some kind of buffer be applied so that walkin visits
        // can't be checked in right up to the brink of closing time, but that is not a feature thus far.
        var timeNow = (0, testScheduleUtils_1.startOfDayWithTimezone)().plus({ hours: 17, minutes: 59, seconds: 59 });
        var adjustedScheduleJSON = (0, testScheduleUtils_1.adjustHoursOfOperation)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [
            {
                dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
                open: 8,
                close: 18,
                workingDay: true,
            },
        ]);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: adjustedScheduleJSON });
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var timezone = (0, utils_1.getTimezone)(schedule);
        var walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension, timezone, timeNow);
        expect(walkinOpen).toBe(true);
        timeNow = timeNow.plus({ seconds: 1 });
        walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension, timezone, timeNow);
        expect(walkinOpen).toBe(false);
    });
    it('should make walkin available right at opening time, but not a moment before', function () {
        var timeNow = (0, testScheduleUtils_1.startOfDayWithTimezone)().plus({ hours: 8, minutes: 0, seconds: 0 });
        var adjustedScheduleJSON = (0, testScheduleUtils_1.adjustHoursOfOperation)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [
            {
                dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
                open: 8,
                close: 18,
                workingDay: true,
            },
        ]);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: adjustedScheduleJSON });
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var timezone = (0, utils_1.getTimezone)(schedule);
        var walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension, timezone, timeNow);
        expect(walkinOpen).toBe(true);
        timeNow = timeNow.minus({ seconds: 1 });
        walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension, timezone, timeNow);
        expect(walkinOpen).toBe(false);
    });
    it('should disregard opening buffer when determining walk-in availability', function () {
        // buffers control the start and end periods where prebook slots can be created, but should not affect
        // walkin availability.
        var timeNow = (0, testScheduleUtils_1.startOfDayWithTimezone)().plus({ hours: 8, minutes: 0, seconds: 0 });
        var adjustedScheduleJSON = (0, testScheduleUtils_1.adjustHoursOfOperation)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [
            {
                dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
                open: 8,
                close: 18,
                workingDay: true,
            },
        ]);
        var bufferedSchedule = (0, testScheduleUtils_1.applyBuffersToScheduleExtension)(adjustedScheduleJSON, {
            openingBuffer: 30,
        });
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: bufferedSchedule });
        expect(schedule).toBeDefined();
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var timezone = (0, utils_1.getTimezone)(schedule);
        expect(timezone).toBeDefined();
        var walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension, timezone, timeNow);
        expect(walkinOpen).toBe(true);
        timeNow = timeNow.minus({ seconds: 1 });
        walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension, timezone, timeNow);
        expect(walkinOpen).toBe(false);
    });
    it('should disregard closing buffer when determining walk-in availability', function () {
        // buffers control the start and end periods where prebook slots can be created, but should not affect
        // walkin availability.
        var timeNow = (0, testScheduleUtils_1.startOfDayWithTimezone)().plus({ hours: 17, minutes: 59, seconds: 59 });
        var adjustedScheduleJSON = (0, testScheduleUtils_1.adjustHoursOfOperation)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [
            {
                dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
                open: 8,
                close: 18,
                workingDay: true,
            },
        ]);
        var bufferedSchedule = (0, testScheduleUtils_1.applyBuffersToScheduleExtension)(adjustedScheduleJSON, {
            closingBuffer: 30,
        });
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: bufferedSchedule });
        expect(schedule).toBeDefined();
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var timezone = (0, utils_1.getTimezone)(schedule);
        var walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension, timezone, timeNow);
        expect(walkinOpen).toBe(true);
        timeNow = timeNow.plus({ seconds: 1 });
        walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension, timezone, timeNow);
        expect(walkinOpen).toBe(false);
    });
    it('should make walkin closed when a Closure is applied to a schedule that would otherwise make walk-in open', function () {
        // buffers control the start and end periods where prebook slots can be created, but should not affect
        // walkin availability.
        var timeNow = (0, testScheduleUtils_1.startOfDayWithTimezone)().plus({ hours: 14 });
        var adjustedScheduleJSON = (0, testScheduleUtils_1.adjustHoursOfOperation)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [
            {
                dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
                open: 8,
                close: 18,
                workingDay: true,
            },
        ]);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: adjustedScheduleJSON });
        expect(schedule).toBeDefined();
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var timezone = (0, utils_1.getTimezone)(schedule);
        var walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension, timezone, timeNow);
        expect(walkinOpen).toBe(true);
        // apply day closure
        var closedForADaySchedule = (0, testScheduleUtils_1.addClosureDay)(adjustedScheduleJSON, timeNow);
        walkinOpen = (0, utils_1.isWalkinOpen)(closedForADaySchedule, timezone, timeNow);
        expect(walkinOpen).toBe(false);
        // apply period closure
        var closedForAPeriodSchedule = (0, testScheduleUtils_1.addClosurePeriod)(adjustedScheduleJSON, (0, testScheduleUtils_1.startOfDayWithTimezone)({ date: timeNow.minus({ days: 1 }) }), 2);
        walkinOpen = (0, utils_1.isWalkinOpen)(closedForAPeriodSchedule, timezone, timeNow);
        expect(walkinOpen).toBe(false);
    });
    it('should make walkin closed when an Override is applied to a schedule that would otherwise make walk-in open', function () {
        // buffers control the start and end periods where prebook slots can be created, but should not affect
        // walkin availability.
        var timeNow = (0, testScheduleUtils_1.startOfDayWithTimezone)().plus({ hours: 14 });
        var adjustedScheduleJSON = (0, testScheduleUtils_1.adjustHoursOfOperation)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [
            {
                dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
                open: 8,
                close: 18,
                workingDay: true,
            },
        ]);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: adjustedScheduleJSON });
        expect(schedule).toBeDefined();
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var timezone = (0, utils_1.getTimezone)(schedule);
        var walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension, timezone, timeNow);
        expect(walkinOpen).toBe(true);
        var existingConfig = (0, testScheduleUtils_1.getScheduleDay)(scheduleExtension, timeNow);
        (0, vitest_1.assert)(existingConfig);
        // apply override that moves open time to after the current time
        var overrideInfo = {
            date: timeNow.startOf('day'),
            open: 15,
            close: existingConfig.close,
            openingBuffer: existingConfig.openingBuffer,
            closingBuffer: existingConfig.closingBuffer,
            hourlyCapacity: 4,
        };
        var notOpenYetSchedule = (0, testScheduleUtils_1.addOverrides)(scheduleExtension, [overrideInfo]);
        walkinOpen = (0, utils_1.isWalkinOpen)(notOpenYetSchedule, timezone, timeNow);
        expect(walkinOpen).toBe(false);
        // apply override that moves closed time to before the current time
        overrideInfo = {
            date: timeNow.startOf('day'),
            open: existingConfig.open,
            close: 14,
            openingBuffer: existingConfig.openingBuffer,
            closingBuffer: existingConfig.closingBuffer,
            hourlyCapacity: 4,
        };
        var alreadyClosedSchedule = (0, testScheduleUtils_1.addOverrides)(scheduleExtension, [overrideInfo]);
        walkinOpen = (0, utils_1.isWalkinOpen)(alreadyClosedSchedule, timezone, timeNow);
        expect(walkinOpen).toBe(false);
    });
    it('should make walkin unavailable if workingDay = false where it otherwise would be available', function () {
        // buffers control the start and end periods where prebook slots can be created, but should not affect
        // walkin availability.
        var timeNow = (0, testScheduleUtils_1.startOfDayWithTimezone)().plus({ hours: 8, minutes: 0, seconds: 0 });
        var adjustedScheduleJSON = (0, testScheduleUtils_1.adjustHoursOfOperation)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [
            {
                dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
                open: 8,
                close: 18,
                workingDay: true,
            },
        ]);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: adjustedScheduleJSON });
        expect(schedule).toBeDefined();
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var timezone = (0, utils_1.getTimezone)(schedule);
        expect(timezone).toBeDefined();
        var walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension, timezone, timeNow);
        expect(walkinOpen).toBe(true);
        var nonWorkingDayScheduleJSON = (0, testScheduleUtils_1.adjustHoursOfOperation)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, [
            {
                dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
                open: 8,
                close: 18,
                workingDay: false,
            },
        ]);
        var schedule2 = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: nonWorkingDayScheduleJSON });
        var scheduleExtension2 = (0, utils_1.getScheduleExtension)(schedule2);
        expect(scheduleExtension2).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension2);
        walkinOpen = (0, utils_1.isWalkinOpen)(scheduleExtension2, timezone, timeNow);
        expect(walkinOpen).toBe(false);
    });
});
