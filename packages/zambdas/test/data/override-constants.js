"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mondayClosureOverrideForOneDay = exports.tuesdayClosureOverrideForOneDay = exports.tuesdayScheduleOverride = exports.closureOverrideFourDays = exports.todayScheduleOverrideMidnight = exports.todayScheduleOverride2 = exports.closureOverrideForPeriod = exports.tomorrowClosureOverrideForOneDay = exports.futureClosureOverrideForOneDay = exports.pastClosureOverrideForOneDay = exports.todayClosureOverrideForOneDay = exports.todayScheduleOverride = exports.futureScheduleOverride2 = exports.pastScheduleOverride2 = exports.futureScheduleOverride1 = exports.pastScheduleOverride1 = exports.overrideScheduleA = exports.todaySlotScheduleOverride = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
exports.todaySlotScheduleOverride = [
    {
        date: luxon_1.DateTime.now().startOf('day').set({ hour: 13 }),
        open: 18,
        close: 22,
        openingBuffer: 15,
        closingBuffer: 0,
        hourlyCapacity: 3,
    },
];
exports.overrideScheduleA = [
    {
        date: luxon_1.DateTime.now().startOf('day').set({ hour: 13 }),
        open: 13,
        close: 14,
        openingBuffer: 15,
        closingBuffer: 15,
        hourlyCapacity: 15,
    },
];
exports.pastScheduleOverride1 = [
    {
        date: luxon_1.DateTime.now().startOf('day').set({ hour: 13 }).minus({ week: 1 }),
        open: 13,
        close: 14,
        openingBuffer: 15,
        closingBuffer: 15,
        hourlyCapacity: 15,
    },
];
exports.futureScheduleOverride1 = [
    {
        date: luxon_1.DateTime.now().startOf('day').set({ hour: 13 }).plus({ week: 1 }),
        open: 13,
        close: 14,
        openingBuffer: 15,
        closingBuffer: 15,
        hourlyCapacity: 15,
    },
];
exports.pastScheduleOverride2 = [
    {
        date: luxon_1.DateTime.now().startOf('day').set({ hour: 13 }).minus({ week: 1 }),
        open: 20,
        close: 22,
        openingBuffer: 0,
        closingBuffer: 0,
        hourlyCapacity: 15,
    },
];
exports.futureScheduleOverride2 = [
    {
        date: luxon_1.DateTime.now().startOf('day').set({ hour: 13 }).plus({ week: 1 }),
        open: 20,
        close: 22,
        openingBuffer: 0,
        closingBuffer: 0,
        hourlyCapacity: 15,
    },
];
exports.todayScheduleOverride = [
    {
        date: luxon_1.DateTime.now().startOf('day').set({ hour: 13 }),
        open: 17,
        close: 22,
        openingBuffer: 0,
        closingBuffer: 0,
        hourlyCapacity: 15,
    },
];
exports.todayClosureOverrideForOneDay = [
    {
        type: utils_1.ClosureType.OneDay,
        start: luxon_1.DateTime.now().startOf('day').toFormat(utils_1.OVERRIDE_DATE_FORMAT),
        end: luxon_1.DateTime.now().endOf('day').toFormat(utils_1.OVERRIDE_DATE_FORMAT),
    },
];
exports.pastClosureOverrideForOneDay = [
    {
        type: utils_1.ClosureType.OneDay,
        start: luxon_1.DateTime.now().startOf('day').minus({ week: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
        end: luxon_1.DateTime.now().endOf('day').minus({ week: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
    },
];
exports.futureClosureOverrideForOneDay = [
    {
        type: utils_1.ClosureType.OneDay,
        start: luxon_1.DateTime.now().startOf('day').plus({ week: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
        end: luxon_1.DateTime.now().endOf('day').plus({ week: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
    },
];
exports.tomorrowClosureOverrideForOneDay = [
    {
        type: utils_1.ClosureType.OneDay,
        start: luxon_1.DateTime.now().startOf('day').plus({ day: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
        end: luxon_1.DateTime.now().endOf('day').plus({ day: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
    },
];
exports.closureOverrideForPeriod = [
    {
        type: utils_1.ClosureType.Period,
        start: luxon_1.DateTime.now().startOf('day').toFormat(utils_1.OVERRIDE_DATE_FORMAT),
        end: luxon_1.DateTime.now().endOf('day').plus({ week: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
    },
];
exports.todayScheduleOverride2 = [
    {
        date: luxon_1.DateTime.now().startOf('day').set({ hour: 11 }),
        open: 9,
        close: 12,
        openingBuffer: 0,
        closingBuffer: 0,
        hourlyCapacity: 15,
    },
];
exports.todayScheduleOverrideMidnight = [
    {
        date: luxon_1.DateTime.now().startOf('day').set({ hour: 19 }),
        open: 17,
        close: 24,
        openingBuffer: 0,
        closingBuffer: 0,
        hourlyCapacity: 15,
    },
];
exports.closureOverrideFourDays = [
    {
        type: utils_1.ClosureType.Period,
        start: luxon_1.DateTime.now().startOf('day').set({ weekday: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
        end: luxon_1.DateTime.now().startOf('day').set({ weekday: 1 }).plus({ day: 3 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
    },
];
exports.tuesdayScheduleOverride = [
    {
        date: luxon_1.DateTime.now().startOf('day').set({ weekday: 1 }).plus({ day: 1 }),
        open: 8,
        close: 20,
        openingBuffer: 0,
        closingBuffer: 0,
        hourlyCapacity: 15,
    },
];
exports.tuesdayClosureOverrideForOneDay = [
    {
        type: utils_1.ClosureType.OneDay,
        start: luxon_1.DateTime.now().startOf('day').set({ weekday: 1 }).plus({ day: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
        end: luxon_1.DateTime.now().endOf('day').set({ weekday: 1 }).plus({ day: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
    },
];
exports.mondayClosureOverrideForOneDay = [
    {
        type: utils_1.ClosureType.OneDay,
        start: luxon_1.DateTime.now().startOf('day').set({ weekday: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
        end: luxon_1.DateTime.now().endOf('day').set({ weekday: 1 }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
    },
];
