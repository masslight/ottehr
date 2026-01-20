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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var appointment_validation_test_1 = require("../appointment-validation.test");
var testScheduleUtils_1 = require("../helpers/testScheduleUtils");
describe('slot availability tests', function () {
    vitest_1.vi.setConfig({ testTimeout: appointment_validation_test_1.DEFAULT_TEST_TIMEOUT });
    it('24/7 schedule with capacity divisible by 4 should make n/4 slots available every 15 minutes', function () {
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: testScheduleUtils_1.DEFAULT_SCHEDULE_JSON });
        expect(schedule).toBeDefined();
        expect(schedule.id).toBeDefined();
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        expect(JSON.stringify(scheduleExtension)).toEqual(JSON.stringify(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON));
        var timezone = (0, utils_1.getTimezone)(schedule);
        expect(timezone).toBeDefined();
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
        var getSlotsInput = {
            now: startDate.setZone('UTC'),
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(96); // 24 hours * 4 slots per hour
        var tomorrow = startDate.plus({ days: 1 });
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList = [];
        while (now < tomorrow) {
            expectedList.push(now.toISO());
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList.length).toEqual(96);
        expect(availableSlots).toEqual(expectedList);
        // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
        // to verify that the number of slots in each time slot is correct
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate.setZone('UTC'),
            finishDate: startDate.plus({ days: 1 }),
            scheduleExtension: scheduleExtension,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        tomorrow = now.plus({ days: 1 });
        while (now < tomorrow) {
            var capacity = capacityMap[now.toISO()];
            if (capacity === undefined) {
                expect(now.toISO()).toBe('hello');
            }
            expect(capacity).toEqual(1);
            now = now.plus({ minutes: 15 });
        }
        // double the capacity and do the same checks
        var scheduleExtensionDoubleCapacity = (0, testScheduleUtils_1.changeAllCapacities)(scheduleExtension, 8);
        var doubleCapacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate,
            finishDate: startDate.plus({ days: 1 }),
            scheduleExtension: scheduleExtensionDoubleCapacity,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        while (now < tomorrow) {
            var capacity = doubleCapacityMap[now.toISO()];
            expect(capacity).toBeDefined();
            expect(capacity).toEqual(2);
            now = now.plus({ minutes: 15 });
        }
        var schedule2 = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleExtensionDoubleCapacity });
        expect(schedule2).toBeDefined();
        var getSlotsInput2 = {
            now: startDate.setZone('UTC'),
            schedule: schedule2,
            numDays: 1,
            busySlots: [],
        };
        // available slots deduplicates, so we expect the same number of slots as before
        var availableSlots2 = (0, utils_1.getAvailableSlots)(getSlotsInput2);
        expect(availableSlots2).toBeDefined();
        expect(availableSlots2.length).toEqual(96); // 24 hours * 4 slots per hour
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList2 = [];
        while (now < tomorrow) {
            expectedList2.push(now.toISO());
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList2.length).toEqual(96);
        expect(availableSlots2).toEqual(expectedList);
    });
    it('for a 24/7 schedule, should have post-telemed slots available every 30 minutes on the hour and half hour, open to close', function () {
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: testScheduleUtils_1.DEFAULT_SCHEDULE_JSON });
        expect(schedule).toBeDefined();
        expect(schedule.id).toBeDefined();
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        expect(JSON.stringify(scheduleExtension)).toEqual(JSON.stringify(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON));
        var timezone = (0, utils_1.getTimezone)(schedule);
        expect(timezone).toBeDefined();
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
        var ptmSlots = (0, utils_1.getPostTelemedSlots)(startDate, schedule, []);
        expect(ptmSlots).toBeDefined();
        expect(ptmSlots.length).toEqual(96); // 24 hours * 4 slots per hour
        var expectedList = [];
        var dayAfterTomorrow = startDate.plus({ days: 2 });
        var now = startDate.startOf('day');
        while (now < dayAfterTomorrow) {
            expectedList.push(now.toISO());
            now = now.plus({ minutes: 30 });
        }
        expect(expectedList.length).toEqual(96);
        expect(ptmSlots).toEqual(expectedList);
    });
    it('opening buffers should remove slots from the beginning of the available slots list as expected', function () {
        var bufferedSchedule = (0, testScheduleUtils_1.applyBuffersToScheduleExtension)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, {
            openingBuffer: 30,
        });
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: bufferedSchedule });
        expect(schedule).toBeDefined();
        expect(schedule.id).toBeDefined();
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var timezone = (0, utils_1.getTimezone)(schedule);
        expect(timezone).toBeDefined();
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
        var getSlotsInput = {
            now: startDate.setZone('UTC'),
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(94); // 24 hours * 4 slots per hour - 2 slots for the opening buffer
        var tomorrow = startDate.plus({ days: 1 });
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone }).plus({ minutes: 30 });
        var expectedList = [];
        while (now < tomorrow) {
            expectedList.push(now.toISO());
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList.length).toEqual(94);
        expect(availableSlots).toEqual(expectedList);
        // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
        // to verify that the number of slots in each time slot is correct
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate.setZone('UTC'),
            finishDate: startDate.plus({ days: 1 }),
            scheduleExtension: scheduleExtension,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone }).plus({ minutes: 30 });
        while (now < tomorrow) {
            var capacity = capacityMap[now.toISO()];
            expect(capacity).toBeDefined();
            expect(capacity).toEqual(1);
            now = now.plus({ minutes: 15 });
        }
    });
    it('closing buffers should remove slots from the end of the available slots list as expected', function () {
        var bufferedSchedule = (0, testScheduleUtils_1.applyBuffersToScheduleExtension)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, {
            closingBuffer: 30,
        });
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: bufferedSchedule });
        expect(schedule).toBeDefined();
        expect(schedule.id).toBeDefined();
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        var timezone = (0, utils_1.getTimezone)(schedule);
        expect(timezone).toBeDefined();
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
        var getSlotsInput = {
            now: startDate.setZone('UTC'),
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(94); // 24 hours * 4 slots per hour - 2 slots for the closing buffer
        var tomorrow = startDate.plus({ days: 1 }).minus({ minutes: 30 });
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList = [];
        while (now < tomorrow) {
            expectedList.push(now.toISO());
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList.length).toEqual(94);
        expect(availableSlots).toEqual(expectedList);
        // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
        // to verify that the number of slots in each time slot is correct
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate.setZone('UTC'),
            finishDate: startDate.plus({ days: 1 }),
            scheduleExtension: scheduleExtension,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        while (now < tomorrow) {
            var capacity = capacityMap[now.toISO()];
            expect(capacity).toBeDefined();
            expect(capacity).toEqual(1);
            now = now.plus({ minutes: 15 });
        }
    });
    it('24/7 schedule where 4 % capacity == 1 && capacity < 4 will skip the slot on the 45th minute when distributing the last 3 slots', function () {
        // if we have capacity = 3 and need to distribute those slots in 15 minute windows across a single hour
        var scheduleAdjusted = (0, testScheduleUtils_1.changeAllCapacities)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, 3);
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleAdjusted });
        expect(schedule).toBeDefined();
        expect(schedule.id).toBeDefined();
        var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
        expect(scheduleExtension).toBeDefined();
        (0, vitest_1.assert)(scheduleExtension);
        expect(JSON.stringify(scheduleExtension)).toEqual(JSON.stringify(scheduleAdjusted));
        var timezone = (0, utils_1.getTimezone)(schedule);
        expect(timezone).toBeDefined();
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
        var getSlotsInput = {
            now: startDate.setZone('UTC'),
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // this gives us a list of strings representing the start time of some 15 minute slots
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(72); // 24 hours * 3 slots per hour
        var tomorrow = startDate.plus({ days: 1 });
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList = [];
        while (now < tomorrow) {
            if (now.minute !== 45) {
                expectedList.push(now.toISO());
            }
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList.length).toEqual(72);
        expect(availableSlots).toEqual(expectedList);
        // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
        // to verify that the number of slots in each time slot is correct
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate.setZone('UTC'),
            finishDate: startDate.plus({ days: 1 }),
            scheduleExtension: scheduleExtension,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        while (now < tomorrow) {
            if (now.minute !== 45) {
                var capacity = capacityMap[now.toISO()];
                expect(capacity).toBeDefined();
                expect(capacity).toEqual(1);
            }
            now = now.plus({ minutes: 15 });
        }
    });
    it('24/7 schedule where 4 % capacity == 1 && capacity > 4 will skip the slot on the 45th minute when distributing the last 3 slots', function () {
        // if we have capacity = 7 and need to distribute the last 3 slots in 15 minute windows across a single hour
        var timezone = 'America/New_York';
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
        var tomorrow = startDate.plus({ days: 1 });
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var scheduleExtensionCapacity7 = (0, testScheduleUtils_1.changeAllCapacities)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, 7);
        var capacity7Map = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate.setZone('UTC'),
            finishDate: startDate.plus({ days: 1 }),
            scheduleExtension: scheduleExtensionCapacity7,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        while (now < tomorrow) {
            var capacity = capacity7Map[now.toISO()];
            expect(capacity).toBeDefined();
            if (now.minute !== 45) {
                expect(capacity).toEqual(2);
            }
            else {
                expect(capacity).toEqual(1);
            }
            now = now.plus({ minutes: 15 });
        }
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleExtensionCapacity7 });
        expect(schedule).toBeDefined();
        var getSlotsInput = {
            now: startDate.setZone('UTC'),
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // available slots deduplicates, so we expect the same number of slots as before
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(96);
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList = [];
        while (now < tomorrow) {
            expectedList.push(now.toISO());
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList.length).toEqual(96);
        expect(availableSlots).toEqual(expectedList);
    });
    it('24/7 schedule where 4 % capacity == 2 && capacity > 4 will skip the slots on the 15th and 45th minutes when distributing the slots', function () {
        var timezone = 'America/New_York';
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)();
        var tomorrow = startDate.startOf('day').plus({ days: 1 });
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var scheduleExtensionCapacity2 = (0, testScheduleUtils_1.changeAllCapacities)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, 2);
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate.setZone('UTC'),
            finishDate: startDate.plus({ days: 1 }),
            scheduleExtension: scheduleExtensionCapacity2,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        while (now < tomorrow) {
            var capacity = capacityMap[now.toISO()];
            expect(capacity).toBeDefined();
            if (now.minute === 0 || now.minute === 30) {
                if (capacity !== 1) {
                    console.log('now logged', now.toISO());
                }
                expect(capacity).toEqual(1);
            }
            else {
                expect(capacity).toEqual(0);
            }
            now = now.plus({ minutes: 15 });
        }
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleExtensionCapacity2 });
        expect(schedule).toBeDefined();
        var getSlotsInput = {
            now: startDate.setZone('UTC'),
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        // available slots deduplicates, so we expect the same number of slots as before
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(48);
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList = [];
        while (now < tomorrow) {
            if (now.minute !== 45 && now.minute !== 15) {
                expectedList.push(now.toISO());
            }
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList.length).toEqual(48);
        expect(availableSlots).toEqual(expectedList);
    });
    it('24/7 schedule where 4 % capacity == 2 && capacity < 4 will skip the slots on the 15th and 45th minutes when distributing the slots', function () {
        var timezone = 'America/New_York';
        var startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)();
        var tomorrow = startDate.plus({ days: 1 });
        var now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var scheduleExtensionCapacity6 = (0, testScheduleUtils_1.changeAllCapacities)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, 6);
        var capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
            now: startDate.setZone('UTC'),
            finishDate: startDate.plus({ days: 1 }),
            scheduleExtension: scheduleExtensionCapacity6,
            timezone: timezone,
        });
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        while (now < tomorrow) {
            var capacity = capacityMap[now.toISO()];
            expect(capacity).toBeDefined();
            if (now.minute !== 45 && now.minute !== 15) {
                expect(capacity).toEqual(2);
            }
            else {
                expect(capacity).toEqual(1);
            }
            now = now.plus({ minutes: 15 });
        }
        var schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleExtensionCapacity6 });
        expect(schedule).toBeDefined();
        var getSlotsInput = {
            now: startDate.setZone('UTC'),
            schedule: schedule,
            numDays: 1,
            busySlots: [],
        };
        var availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
        expect(availableSlots).toBeDefined();
        expect(availableSlots.length).toEqual(96);
        now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
        var expectedList = [];
        while (now < tomorrow) {
            expectedList.push(now.toISO());
            now = now.plus({ minutes: 15 });
        }
        expect(expectedList.length).toEqual(96);
        expect(availableSlots).toEqual(expectedList);
    });
    it('huge capacity test', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scheduleAdjusted, schedule, scheduleExtension, timezone, startDate, getSlotsInput, availableSlots, tomorrow, now, expectedList, capacityMap, capacity;
        return __generator(this, function (_a) {
            scheduleAdjusted = (0, testScheduleUtils_1.changeAllCapacities)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, 100000);
            schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleAdjusted });
            expect(schedule).toBeDefined();
            expect(schedule.id).toBeDefined();
            scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
            expect(scheduleExtension).toBeDefined();
            (0, vitest_1.assert)(scheduleExtension);
            expect(JSON.stringify(scheduleExtension)).toEqual(JSON.stringify(scheduleAdjusted));
            timezone = (0, utils_1.getTimezone)(schedule);
            expect(timezone).toBeDefined();
            startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
            getSlotsInput = {
                now: startDate.setZone('UTC'),
                schedule: schedule,
                numDays: 1,
                busySlots: [],
            };
            availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
            expect(availableSlots).toBeDefined();
            expect(availableSlots.length).toEqual(96);
            tomorrow = startDate.plus({ days: 1 });
            now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
            expectedList = [];
            while (now < tomorrow) {
                expectedList.push(now.toISO());
                now = now.plus({ minutes: 15 });
            }
            expect(expectedList.length).toEqual(96);
            expect(availableSlots).toEqual(expectedList);
            capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
                now: startDate.setZone('UTC'),
                finishDate: startDate.plus({ days: 1 }),
                scheduleExtension: scheduleExtension,
                timezone: timezone,
            });
            now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
            while (now < tomorrow) {
                capacity = capacityMap[now.toISO()];
                expect(capacity).toBeDefined();
                expect(capacity).toEqual(25000);
                now = now.plus({ minutes: 15 });
            }
            return [2 /*return*/];
        });
    }); });
    it('should produce 1 slot every 30 minutes, on the hour and half hour, when slot-length is 30 minutes and capacity is 2', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scheduleAdjusted, schedule, scheduleExtension, timezone, startDate, getSlotsInput, availableSlots, tomorrow, now, expectedList, capacityMap, capacity;
        return __generator(this, function (_a) {
            scheduleAdjusted = (0, testScheduleUtils_1.setSlotLengthInMinutes)((0, testScheduleUtils_1.changeAllCapacities)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, 2), 30);
            schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleAdjusted });
            expect(schedule).toBeDefined();
            expect(schedule.id).toBeDefined();
            scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
            expect(scheduleExtension).toBeDefined();
            (0, vitest_1.assert)(scheduleExtension);
            timezone = (0, utils_1.getTimezone)(schedule);
            expect(timezone).toBeDefined();
            startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
            getSlotsInput = {
                now: startDate.setZone('UTC'),
                schedule: schedule,
                numDays: 1,
                busySlots: [],
            };
            availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
            expect(availableSlots).toBeDefined();
            expect(availableSlots.length).toEqual(48); // 24 hours * 2 slots per hour
            tomorrow = startDate.plus({ days: 1 });
            now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
            expectedList = [];
            while (now < tomorrow) {
                expectedList.push(now.toISO());
                now = now.plus({ minutes: 30 });
            }
            expect(expectedList.length).toEqual(48);
            expect(availableSlots).toEqual(expectedList);
            capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
                now: startDate.setZone('UTC'),
                finishDate: startDate.plus({ days: 1 }),
                scheduleExtension: scheduleExtension,
                timezone: timezone,
            });
            now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
            while (now < tomorrow) {
                capacity = capacityMap[now.toISO()];
                expect(capacity).toBeDefined();
                expect(capacity).toEqual(1);
                now = now.plus({ minutes: 30 });
            }
            return [2 /*return*/];
        });
    }); });
    it('should produce 2 slots every 30 minutes, on the hour and half hour, when slot-length is 30 minutes and capacity is 4', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scheduleAdjusted, schedule, scheduleExtension, timezone, startDate, getSlotsInput, availableSlots, tomorrow, now, expectedList, capacityMap, capacity;
        return __generator(this, function (_a) {
            scheduleAdjusted = (0, testScheduleUtils_1.setSlotLengthInMinutes)((0, testScheduleUtils_1.changeAllCapacities)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, 4), 30);
            schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleAdjusted });
            expect(schedule).toBeDefined();
            expect(schedule.id).toBeDefined();
            scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
            expect(scheduleExtension).toBeDefined();
            (0, vitest_1.assert)(scheduleExtension);
            timezone = (0, utils_1.getTimezone)(schedule);
            expect(timezone).toBeDefined();
            startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)();
            getSlotsInput = {
                now: startDate.setZone('UTC'),
                schedule: schedule,
                numDays: 1,
                busySlots: [],
            };
            availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
            expect(availableSlots).toBeDefined();
            expect(availableSlots.length).toEqual(48); // 24 hours * 2 slots per hour
            tomorrow = startDate.plus({ days: 1 });
            now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
            expectedList = [];
            while (now < tomorrow) {
                expectedList.push(now.toISO());
                now = now.plus({ minutes: 30 });
            }
            expect(expectedList.length).toEqual(48);
            expect(availableSlots).toEqual(expectedList);
            capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
                now: startDate.setZone('UTC'),
                finishDate: startDate.plus({ days: 1 }),
                scheduleExtension: scheduleExtension,
                timezone: timezone,
            });
            now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
            while (now < tomorrow) {
                capacity = capacityMap[now.toISO()];
                expect(capacity).toBeDefined();
                expect(capacity).toEqual(2);
                now = now.plus({ minutes: 30 });
            }
            return [2 /*return*/];
        });
    }); });
    it('should produce 1 slot every hour on the hour when slot-length is 30 minutes and capacity is 1', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scheduleAdjusted, schedule, scheduleExtension, timezone, startDate, getSlotsInput, availableSlots, tomorrow, now, expectedList, capacityMap, capacity;
        return __generator(this, function (_a) {
            scheduleAdjusted = (0, testScheduleUtils_1.setSlotLengthInMinutes)((0, testScheduleUtils_1.changeAllCapacities)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, 1), 30);
            schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleAdjusted });
            expect(schedule).toBeDefined();
            expect(schedule.id).toBeDefined();
            scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
            expect(scheduleExtension).toBeDefined();
            (0, vitest_1.assert)(scheduleExtension);
            timezone = (0, utils_1.getTimezone)(schedule);
            expect(timezone).toBeDefined();
            startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
            getSlotsInput = {
                now: startDate.setZone('UTC'),
                schedule: schedule,
                numDays: 1,
                busySlots: [],
            };
            availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
            expect(availableSlots).toBeDefined();
            expect(availableSlots.length).toEqual(24);
            tomorrow = startDate.plus({ days: 1 });
            now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
            expectedList = [];
            while (now < tomorrow) {
                expectedList.push(now.toISO());
                now = now.plus({ minutes: 60 });
            }
            expect(expectedList.length).toEqual(24);
            expect(availableSlots).toEqual(expectedList);
            capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
                now: startDate.setZone('UTC'),
                finishDate: startDate.plus({ days: 1 }),
                scheduleExtension: scheduleExtension,
                timezone: timezone,
            });
            now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
            while (now < tomorrow) {
                capacity = capacityMap[now.toISO()];
                expect(capacity).toBeDefined();
                expect(capacity).toEqual(1);
                now = now.plus({ minutes: 60 });
            }
            return [2 /*return*/];
        });
    }); });
    it('should produce 1 slot every hour on the hour when slot-length is 60 minutes and capacity is 1', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scheduleAdjusted, schedule, scheduleExtension, timezone, startDate, getSlotsInput, availableSlots, tomorrow, now, expectedList, capacityMap, capacity;
        return __generator(this, function (_a) {
            scheduleAdjusted = (0, testScheduleUtils_1.setSlotLengthInMinutes)((0, testScheduleUtils_1.changeAllCapacities)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, 1), 60);
            schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleAdjusted });
            expect(schedule).toBeDefined();
            expect(schedule.id).toBeDefined();
            scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
            expect(scheduleExtension).toBeDefined();
            (0, vitest_1.assert)(scheduleExtension);
            timezone = (0, utils_1.getTimezone)(schedule);
            expect(timezone).toBeDefined();
            startDate = (0, testScheduleUtils_1.startOfDayWithTimezone)({ timezone: timezone });
            getSlotsInput = {
                now: startDate.setZone('UTC'),
                schedule: schedule,
                numDays: 1,
                busySlots: [],
            };
            availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
            expect(availableSlots).toBeDefined();
            expect(availableSlots.length).toEqual(24);
            tomorrow = startDate.plus({ days: 1 });
            now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
            expectedList = [];
            while (now < tomorrow) {
                expectedList.push(now.toISO());
                now = now.plus({ minutes: 60 });
            }
            expect(expectedList.length).toEqual(24);
            expect(availableSlots).toEqual(expectedList);
            capacityMap = (0, utils_1.getAllSlotsAsCapacityMap)({
                now: startDate.setZone('UTC'),
                finishDate: startDate.plus({ days: 1 }),
                scheduleExtension: scheduleExtension,
                timezone: timezone,
            });
            now = luxon_1.DateTime.fromISO(startDate.toISO(), { zone: timezone });
            while (now < tomorrow) {
                capacity = capacityMap[now.toISO()];
                expect(capacity).toBeDefined();
                expect(capacity).toEqual(1);
                now = now.plus({ minutes: 60 });
            }
            return [2 /*return*/];
        });
    }); });
    it('should make slots available up until the last 45 minute slot when there is no buffer and no busy slots', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scheduleAdjusted, schedule, scheduleExtension, timezone, startDate, close, getSlotsInput, availableSlots, last3Slots, startString, endString;
        return __generator(this, function (_a) {
            scheduleAdjusted = (0, testScheduleUtils_1.setClosingHourForAllDays)(testScheduleUtils_1.DEFAULT_SCHEDULE_JSON, 22);
            schedule = (0, testScheduleUtils_1.makeSchedule)({ scheduleObject: scheduleAdjusted, timezone: 'America/Chicago' });
            expect(schedule).toBeDefined();
            expect(schedule.id).toBeDefined();
            scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
            expect(scheduleExtension).toBeDefined();
            (0, vitest_1.assert)(scheduleExtension);
            timezone = (0, utils_1.getTimezone)(schedule);
            expect(timezone).toBeDefined();
            startDate = luxon_1.DateTime.now().setZone(timezone).set({ hour: 21, minute: 10, second: 0 });
            console.log('startDate', startDate.toISO(), startDate.weekdayLong);
            close = scheduleExtension.schedule[startDate.weekdayLong.toLowerCase()].close;
            console.log('close', close);
            expect(close).toBeDefined();
            expect(close).toEqual(22);
            getSlotsInput = {
                now: startDate.setZone('UTC'),
                schedule: schedule,
                numDays: 1,
                busySlots: [],
            };
            availableSlots = (0, utils_1.getAvailableSlots)(getSlotsInput);
            expect(availableSlots).toBeDefined();
            console.log('availableSlots', availableSlots);
            last3Slots = availableSlots.slice(-3);
            expect(last3Slots.length).toEqual(3);
            startString = startDate.toISO().split(':')[0];
            endString = startDate.toISO().split('-').pop();
            expect(last3Slots[0]).toEqual("".concat(startString, ":15:00.000-").concat(endString));
            expect(last3Slots[1]).toEqual("".concat(startString, ":30:00.000-").concat(endString));
            expect(last3Slots[2]).toEqual("".concat(startString, ":45:00.000-").concat(endString));
            return [2 /*return*/];
        });
    }); });
});
