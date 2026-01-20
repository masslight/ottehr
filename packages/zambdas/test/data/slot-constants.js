"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slotsTimesGroupA2 = exports.slotsTimesGroupA1 = exports.slotsTimesGroupZ = exports.slotMapZ = exports.overrideSlotMapGroupC = exports.slotMapB = exports.overrideSlotMapA = exports.slotMapA = exports.slotsTimesForClosingBufferWith2Cap = exports.slotsTimesForClosingBufferWith3Cap = exports.slotsTimesForOpeningBufferWith1Cap = exports.slotsTimesForClosingBuffer15 = exports.slotsTimesForClosingBuffer30 = exports.slotsTimesForClosingBuffer45 = exports.slotsTimesForClosingBuffer60 = exports.slotsTimesForClosingBufferBase = exports.slotsTimesForOpeningBuffer60 = exports.slotsTimesForOpeningBuffer45 = exports.slotsTimesForOpeningBuffer30 = exports.slotsTimesForOpeningBuffer15 = exports.slotsTimesForOpeningBufferBase = exports.slotsTimesGroupW = exports.slotsTimesGroupV3 = exports.slotsTimesGroupV2 = exports.slotsTimesGroupV = exports.slotsTimesGroupU = exports.slotsTimesGroupT = exports.slotsTimesGroupS = exports.slotsTimesGroupR = exports.slotsTimesGroupQ = exports.slotsTimesGroupP = exports.slotsTimesGroupO = exports.slotsTimesGroupN = exports.slotsTimesGroupM = exports.slotsTimesGroupL = exports.slotsTimesGroupK = exports.slotsTimesGroupJ = exports.slotsTimesGroupI = exports.slotsTimesGroupH = exports.slotsTimesGroupG = exports.slotsTimesGroupF = exports.slotsTimesGroupE = exports.slotsTimesGroupD = exports.slotsTimesGroupC = exports.slotsTimesGroupB = exports.slotsTimesGroupA = exports.slotTimesAllDay10to6Cap3 = exports.slotTimesAllDay10to6Cap4 = exports.addDateToSlotMap = exports.addDateToSlotTimes = void 0;
exports.slotsTimesGroupA4 = exports.slotsTimesGroupA3 = void 0;
var addDateToSlotTimes = function (date, slotTimes) {
    var dateString = date.toFormat('yyyy-MM-dd');
    return slotTimes.map(function (slot) { return dateString + slot; });
};
exports.addDateToSlotTimes = addDateToSlotTimes;
var addDateToSlotMap = function (date, slots) {
    var dateString = date.toFormat('yyyy-MM-dd');
    var updatedSlots = {};
    for (var _i = 0, _a = Object.entries(slots); _i < _a.length; _i++) {
        var _b = _a[_i], slot = _b[0], count = _b[1];
        updatedSlots[dateString + slot] = count;
    }
    return updatedSlots;
};
exports.addDateToSlotMap = addDateToSlotMap;
exports.slotTimesAllDay10to6Cap4 = [
    'T10:00:00.000-04:00',
    'T10:15:00.000-04:00',
    'T10:30:00.000-04:00',
    'T10:45:00.000-04:00',
    'T11:00:00.000-04:00',
    'T11:15:00.000-04:00',
    'T11:30:00.000-04:00',
    'T11:45:00.000-04:00',
    'T12:00:00.000-04:00',
    'T12:15:00.000-04:00',
    'T12:30:00.000-04:00',
    'T12:45:00.000-04:00',
    'T13:00:00.000-04:00',
    'T13:15:00.000-04:00',
    'T13:30:00.000-04:00',
    'T13:45:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:30:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:30:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
    'T16:30:00.000-04:00',
    'T16:45:00.000-04:00',
    'T17:00:00.000-04:00',
    'T17:15:00.000-04:00',
    'T17:30:00.000-04:00',
    'T17:45:00.000-04:00',
];
exports.slotTimesAllDay10to6Cap3 = [
    'T10:00:00.000-04:00',
    'T10:15:00.000-04:00',
    'T10:45:00.000-04:00',
    'T11:00:00.000-04:00',
    'T11:15:00.000-04:00',
    'T11:45:00.000-04:00',
    'T12:00:00.000-04:00',
    'T12:15:00.000-04:00',
    'T12:45:00.000-04:00',
    'T13:00:00.000-04:00',
    'T13:15:00.000-04:00',
    'T13:45:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
    'T16:45:00.000-04:00',
    'T17:00:00.000-04:00',
    'T17:15:00.000-04:00',
    'T17:45:00.000-04:00',
];
// // arrays of slot strings formatted for the front end (no duplicates)
// slots should start showing 40 minutes from now
// if now is 2, slots will start at 2:45
// if now is 1:47, slots will start at 2:30
// capacity 4 or more, now 2pm, opens @10am, closes @6pm, no buffers
exports.slotsTimesGroupA = [
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:30:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
    'T16:30:00.000-04:00',
    'T16:45:00.000-04:00',
    'T17:00:00.000-04:00',
    'T17:15:00.000-04:00',
    'T17:30:00.000-04:00',
    'T17:45:00.000-04:00',
];
// now 2pm, close 6pm, no buffers, capacity 3
exports.slotsTimesGroupB = [
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
    'T16:45:00.000-04:00',
    'T17:00:00.000-04:00',
    'T17:15:00.000-04:00',
    'T17:45:00.000-04:00',
];
// opening buffer 15, capacity 3, open @13, close @17
exports.slotsTimesGroupC = [
    'T13:15:00.000-04:00',
    'T13:30:00.000-04:00',
    'T13:45:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
    'T16:45:00.000-04:00',
];
// opening buffer 30 & capacity 3, open @13, close @17
exports.slotsTimesGroupD = [
    'T13:30:00.000-04:00',
    'T13:45:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
    'T16:45:00.000-04:00',
];
// closing buffer 30 & capacity 3, open @13, close @17
exports.slotsTimesGroupE = [
    'T13:00:00.000-04:00',
    'T13:15:00.000-04:00', // 2024-04-27T13:15:00.000-04:00
    'T13:45:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
];
// closing buffer 30 & capacity 4, 2 appointments (13:15 and 13:45)
exports.slotsTimesGroupF = [
    'T13:00:00.000-04:00', // (is this the right distribution??)
    'T13:30:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:30:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:30:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
];
// capacity 3 with 1 busy-tentative slot in each of hours 13 and 14
exports.slotsTimesGroupG = [
    'T13:15:00.000-04:00',
    'T13:45:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
];
// capacity 3 with busy-tentative slots at 13:00, 13:15 and 14
exports.slotsTimesGroupH = [
    'T13:45:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
];
// capacity 3 with busy-tentative slots at 13:00, 13:15 and 14, appointments at 13:45, 15:15
exports.slotsTimesGroupI = [
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
];
// capacity 3 with 1 appointment at 15:15
exports.slotsTimesGroupJ = [
    'T13:00:00.000-04:00',
    'T13:15:00.000-04:00', // 2024-04-27T13:15:00.000-04:00
    'T13:45:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
];
// capacity 3 with 1 appointment at 15:30 (hard case because there shouldn't be any appointment at that time)
exports.slotsTimesGroupK = [
    'T13:00:00.000-04:00',
    'T13:15:00.000-04:00', // 2024-04-27T13:15:00.000-04:00
    'T13:45:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
];
// capacity 3 with 15 minute opening and closing buffers, no schedule
exports.slotsTimesGroupL = [
    'T13:15:00.000-04:00',
    'T13:30:00.000-04:00',
    'T13:45:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
    'T16:30:00.000-04:00',
];
// now 8am, office opens at 10, closes at 3, no buffers, capacity 2
exports.slotsTimesGroupM = [
    'T10:00:00.000-04:00',
    'T10:30:00.000-04:00',
    'T11:00:00.000-04:00',
    'T11:30:00.000-04:00',
    'T12:00:00.000-04:00',
    'T12:30:00.000-04:00',
    'T13:00:00.000-04:00',
    'T13:30:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:30:00.000-04:00',
];
// open @1pm, close @5pm, closing buffer 30 & capacity 3, 2 appointments (13:15, 13:45)
exports.slotsTimesGroupN = [
    'T13:00:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
];
// capacity 4 with 15 minute closing buffer
exports.slotsTimesGroupO = [
    'T13:00:00.000-04:00',
    'T13:15:00.000-04:00',
    'T13:30:00.000-04:00',
    'T13:45:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:30:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:30:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
    'T16:30:00.000-04:00',
];
// open @8pm close @12am, capacity 3 with 60 minute closing buffer
exports.slotsTimesGroupP = [
    'T20:00:00.000-04:00',
    'T20:15:00.000-04:00',
    'T20:45:00.000-04:00',
    'T21:00:00.000-04:00',
    'T21:15:00.000-04:00',
    'T21:45:00.000-04:00',
    'T22:00:00.000-04:00',
    'T22:15:00.000-04:00',
    'T22:45:00.000-04:00',
];
// capacity 1, now 8am, open @12am close @12am, no buffers
// slots are shown 45 from the current time so the first slot is 8:45
// there is a 40 minute buffer to hide slots from current time
exports.slotsTimesGroupQ = [
    'T09:00:00.000-04:00',
    'T10:00:00.000-04:00',
    'T11:00:00.000-04:00',
    'T12:00:00.000-04:00',
    'T13:00:00.000-04:00',
    'T14:00:00.000-04:00',
    'T15:00:00.000-04:00',
    'T16:00:00.000-04:00',
    'T17:00:00.000-04:00',
    'T18:00:00.000-04:00',
    'T19:00:00.000-04:00',
    'T20:00:00.000-04:00',
    'T21:00:00.000-04:00',
    'T22:00:00.000-04:00',
    'T23:00:00.000-04:00',
];
// open @10am close @5pm, capacity 4, 30 min open + close buffers, current time is 8am
// 11 - 12 & 13-14 gets 2 slots only
exports.slotsTimesGroupR = [
    'T10:30:00.000-04:00',
    'T10:45:00.000-04:00',
    'T11:00:00.000-04:00',
    'T11:30:00.000-04:00',
    'T12:00:00.000-04:00',
    'T12:15:00.000-04:00',
    'T12:30:00.000-04:00',
    'T12:45:00.000-04:00',
    'T13:00:00.000-04:00',
    'T13:30:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:30:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:30:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
];
// open @1pm close @5pm, capacity 4, specific capacity of 1 during hour 13, 15 minute opening buffer
exports.slotsTimesGroupS = [
    'T13:15:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:30:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:30:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
    'T16:30:00.000-04:00',
    'T16:45:00.000-04:00',
];
// open @1pm close @5pm, capacity 1, no buffers, 1 appointment @15
exports.slotsTimesGroupT = ['T13:00:00.000-04:00', 'T14:00:00.000-04:00', 'T16:00:00.000-04:00'];
// open @2pm close @5pm, capacity 3, 15 minute opening + closing buffer
exports.slotsTimesGroupU = [
    'T14:15:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:45:00.000-04:00',
    'T16:00:00.000-04:00',
    'T16:15:00.000-04:00',
    'T16:45:00.000-04:00',
    'T17:00:00.000-04:00',
    'T17:15:00.000-04:00',
    'T17:30:00.000-04:00',
];
// open @2pm close @5pm, capacity 1, 15 minute opening + closing buffer
exports.slotsTimesGroupV = ['T17:00:00.000-04:00'];
exports.slotsTimesGroupV2 = [
    'T14:15:00.000-04:00',
    'T15:00:00.000-04:00',
    'T16:00:00.000-04:00',
    'T17:00:00.000-04:00',
];
exports.slotsTimesGroupV3 = [
    'T14:00:00.000-04:00',
    'T15:00:00.000-04:00',
    'T16:00:00.000-04:00',
    'T17:00:00.000-04:00',
];
// open @2pm close @5pm, capacity 2, 15 minute opening + closing buffer
exports.slotsTimesGroupW = ['T17:00:00.000-04:00', 'T17:30:00.000-04:00'];
exports.slotsTimesForOpeningBufferBase = [
    'T14:30:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
    'T15:30:00.000-04:00',
    'T15:45:00.000-04:00',
];
exports.slotsTimesForOpeningBuffer15 = ['T13:15:00.000-04:00'];
exports.slotsTimesForOpeningBuffer30 = ['T13:30:00.000-04:00'];
exports.slotsTimesForOpeningBuffer45 = ['T13:45:00.000-04:00'];
exports.slotsTimesForOpeningBuffer60 = ['T14:00:00.000-04:00', 'T14:15:00.000-04:00'];
exports.slotsTimesForClosingBufferBase = [
    'T13:00:00.000-04:00',
    'T13:15:00.000-04:00',
    'T13:30:00.000-04:00',
    'T13:45:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
];
exports.slotsTimesForClosingBuffer60 = ['T14:30:00.000-04:00', 'T14:45:00.000-04:00'];
exports.slotsTimesForClosingBuffer45 = ['T15:00:00.000-04:00'];
exports.slotsTimesForClosingBuffer30 = ['T15:15:00.000-04:00'];
exports.slotsTimesForClosingBuffer15 = ['T15:30:00.000-04:00'];
// opening buffer 15
exports.slotsTimesForOpeningBufferWith1Cap = ['T13:15:00.000-04:00', 'T14:00:00.000-04:00', 'T15:00:00.000-04:00'];
// closing buffer 15
exports.slotsTimesForClosingBufferWith3Cap = [
    'T13:00:00.000-04:00',
    'T13:15:00.000-04:00',
    'T13:45:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:15:00.000-04:00',
    'T14:45:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
];
// closing buffer 30
exports.slotsTimesForClosingBufferWith2Cap = [
    'T13:00:00.000-04:00',
    'T13:30:00.000-04:00',
    'T14:00:00.000-04:00',
    'T14:30:00.000-04:00',
    'T15:00:00.000-04:00',
    'T15:15:00.000-04:00',
];
// capacity 15
exports.slotMapA = {
    'T10:00:00.000-04:00': 3,
    'T10:15:00.000-04:00': 4,
    'T10:30:00.000-04:00': 4,
    'T10:45:00.000-04:00': 4,
    'T11:00:00.000-04:00': 3,
    'T11:15:00.000-04:00': 4,
    'T11:30:00.000-04:00': 4,
    'T11:45:00.000-04:00': 4,
    'T12:00:00.000-04:00': 3,
    'T12:15:00.000-04:00': 4,
    'T12:30:00.000-04:00': 4,
    'T12:45:00.000-04:00': 4,
    'T13:00:00.000-04:00': 3,
    'T13:15:00.000-04:00': 4,
    'T13:30:00.000-04:00': 4,
    'T13:45:00.000-04:00': 4,
    'T14:00:00.000-04:00': 3,
    'T14:15:00.000-04:00': 4,
    'T14:30:00.000-04:00': 4,
    'T14:45:00.000-04:00': 4,
};
exports.overrideSlotMapA = {
    'T13:15:00.000-04:00': 4,
    'T13:30:00.000-04:00': 4,
};
exports.slotMapB = {
    'T20:00:00.000-04:00': 3,
    'T20:15:00.000-04:00': 4,
    'T20:30:00.000-04:00': 4,
    'T20:45:00.000-04:00': 4,
    'T21:00:00.000-04:00': 3,
    'T21:15:00.000-04:00': 4,
    'T21:30:00.000-04:00': 4,
    'T21:45:00.000-04:00': 4,
    'T22:00:00.000-04:00': 3,
    'T22:15:00.000-04:00': 4,
    'T22:30:00.000-04:00': 4,
    'T22:45:00.000-04:00': 4,
    'T23:00:00.000-04:00': 3,
    'T23:15:00.000-04:00': 4,
    'T23:30:00.000-04:00': 4,
    'T23:45:00.000-04:00': 4,
};
exports.overrideSlotMapGroupC = [
    'T18:15:00.000-04:00',
    'T18:30:00.000-04:00',
    'T18:45:00.000-04:00',
    'T19:00:00.000-04:00',
    'T19:15:00.000-04:00',
    'T19:45:00.000-04:00',
    'T20:00:00.000-04:00',
    'T20:15:00.000-04:00',
    'T20:45:00.000-04:00',
    'T21:00:00.000-04:00',
    'T21:15:00.000-04:00',
    'T21:45:00.000-04:00',
];
exports.slotMapZ = [
    'T20:00:00.000-04:00',
    'T20:15:00.000-04:00',
    'T20:45:00.000-04:00',
    'T21:00:00.000-04:00',
    'T21:15:00.000-04:00',
    'T21:45:00.000-04:00',
    'T22:00:00.000-04:00',
    'T22:15:00.000-04:00',
    'T22:45:00.000-04:00',
    'T23:00:00.000-04:00',
    'T23:15:00.000-04:00',
    'T23:45:00.000-04:00',
];
exports.slotsTimesGroupZ = [
    'T10:45:00.000-04:00',
    'T11:00:00.000-04:00',
    'T11:15:00.000-04:00',
    'T11:30:00.000-04:00',
    'T11:45:00.000-04:00',
    'T12:00:00.000-04:00',
    'T12:15:00.000-04:00',
    'T12:30:00.000-04:00',
    'T12:45:00.000-04:00',
];
exports.slotsTimesGroupA1 = [
    'T10:45:00.000-04:00',
    'T11:00:00.000-04:00',
    'T11:15:00.000-04:00',
    'T11:45:00.000-04:00',
    'T12:00:00.000-04:00',
    'T12:15:00.000-04:00',
    'T12:45:00.000-04:00',
];
exports.slotsTimesGroupA2 = [
    'T11:00:00.000-04:00',
    'T11:30:00.000-04:00',
    'T12:00:00.000-04:00',
    'T12:30:00.000-04:00',
];
exports.slotsTimesGroupA3 = [
    'T10:30:00.000-04:00',
    'T10:45:00.000-04:00',
    'T11:00:00.000-04:00',
    'T11:30:00.000-04:00',
    'T12:00:00.000-04:00',
    'T12:30:00.000-04:00',
];
exports.slotsTimesGroupA4 = [
    'T11:00:00.000-04:00',
    'T11:15:00.000-04:00',
    'T11:30:00.000-04:00',
    'T11:45:00.000-04:00',
    'T12:00:00.000-04:00',
    'T12:15:00.000-04:00',
    'T12:30:00.000-04:00',
    'T12:45:00.000-04:00',
];
