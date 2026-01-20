"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var NOW;
var makeAppointmentTypeCoding = function (type) {
    if (type === 'pre-booked') {
        return { text: 'prebook' };
    }
    else if (type === 'walk-in') {
        return { text: 'walkin' };
    }
    else {
        return { text: 'posttelemed' };
    }
};
var makeAppointment = function (type, startTime, appointmentStatus) {
    var adjustedStartTime = luxon_1.DateTime.fromISO(startTime).set({ second: 0, millisecond: 0 }).toISO() || '';
    return {
        resourceType: 'Appointment',
        id: (0, crypto_1.randomUUID)(),
        start: adjustedStartTime,
        appointmentType: makeAppointmentTypeCoding(type),
        participant: [
            {
                actor: { reference: 'Patient/99bb5986-47ee-4030-b9ff-2e25541bf9b9' },
                status: 'accepted',
            },
        ],
        status: appointmentStatus,
    };
};
var makeEncounter = function (encounterStatus, statusHistory, fhirAppointment) {
    return {
        resourceType: 'Encounter',
        status: encounterStatus,
        statusHistory: statusHistory,
        class: {
            system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
            code: 'ACUTE',
            display: 'inpatient acute',
        },
        subject: {
            reference: 'Patient/07b1c9f6-cc11-4d48-bf31-56e2529c821e',
        },
        appointment: [
            {
                reference: "Appointment/".concat(fhirAppointment),
            },
        ],
        location: [
            {
                location: {
                    reference: 'Location/f2418766-0bf7-4ed9-9c88-b9d8044e7a37',
                },
            },
        ],
        id: (0, crypto_1.randomUUID)(),
    };
};
var makeWalkinVisit_Arrived = function (minsAgoStart) {
    var _a;
    var startTime = (_a = NOW.minus({ minutes: minsAgoStart }).toISO()) !== null && _a !== void 0 ? _a : 'FAIL';
    var appointment = makeAppointment('walk-in', startTime, 'arrived');
    var statusHistory = [
        {
            status: 'arrived',
            period: {
                start: startTime,
            },
        },
    ];
    var encounter = makeEncounter('arrived', statusHistory, appointment);
    return { appointment: appointment, encounter: encounter };
};
var makeVisit_Arrived = function (type, startTimeMinsAgo, arrivedTimeMinsAgo) {
    var _a, _b, _c;
    var bookingTime = (_a = NOW.minus({ days: 1 }).toISO()) !== null && _a !== void 0 ? _a : 'FAIL';
    var startTime = (_b = NOW.minus({ minutes: startTimeMinsAgo }).toISO()) !== null && _b !== void 0 ? _b : 'FAIL';
    var arrivedTime = (_c = NOW.minus({ minutes: arrivedTimeMinsAgo }).toISO()) !== null && _c !== void 0 ? _c : 'FAIL';
    var appointment = makeAppointment(type, startTime, 'arrived');
    var statusHistory = [
        {
            status: 'planned',
            period: {
                start: bookingTime,
                end: arrivedTime,
            },
        },
        {
            status: 'arrived',
            period: {
                start: arrivedTime,
            },
        },
    ];
    var encounter = makeEncounter('arrived', statusHistory, appointment);
    return { appointment: appointment, encounter: encounter };
};
beforeAll(function () {
    NOW = luxon_1.DateTime.now().setZone('America/New_York');
});
describe('test waiting minutes estimate calculation', function () {
    test('1: calculate wait time when no is in the office', function () {
        var result = (0, utils_1.getWaitingMinutes)(NOW, []);
        var expectedRange = { low: 0, high: 15 };
        expect(result).toBe(expectedRange.low);
        expect(result + 15).toBe(expectedRange.high);
    });
    test('2: calculate wait time based on 1 walkin waiting for 10 minutes', function () {
        var walkin10MinsAgo = makeWalkinVisit_Arrived(10);
        var result = (0, utils_1.getWaitingMinutes)(NOW, [walkin10MinsAgo.encounter]);
        var expectedRange = { low: 10, high: 25 };
        expect(result).toBe(expectedRange.low);
        expect(result + 15).toBe(expectedRange.high);
    });
    test('3: calculate wait time based on 1 walkin waiting for 10 minutes, 1 prebook waiting for 5', function () {
        var walkin10MinsAgo = makeWalkinVisit_Arrived(10);
        var prebooked15MinEarly = makeVisit_Arrived('pre-booked', -15, 5);
        var result = (0, utils_1.getWaitingMinutes)(NOW, [walkin10MinsAgo.encounter, prebooked15MinEarly.encounter]);
        var expectedRange = { low: 10, high: 25 };
        expect(result).toBe(expectedRange.low);
        expect(result + 15).toBe(expectedRange.high);
    });
    test('4: calculate wait time based on 3 waiting, longest has been there for 30 minutes', function () {
        var walkin10MinsAgo = makeWalkinVisit_Arrived(10);
        var walkin30MinsAgo = makeWalkinVisit_Arrived(30);
        var prebooked15MinEarly = makeVisit_Arrived('pre-booked', -15, 5);
        var encounters = [walkin10MinsAgo.encounter, walkin30MinsAgo.encounter, prebooked15MinEarly.encounter];
        var result = (0, utils_1.getWaitingMinutes)(NOW, encounters);
        var expectedRange = { low: 30, high: 45 };
        expect(result).toBe(expectedRange.low);
        expect(result + 15).toBe(expectedRange.high);
    });
    test('4: calculate wait time based on 3 waiting, longest has been there for 41 minutes', function () {
        var walkin10MinsAgo = makeWalkinVisit_Arrived(10);
        var walkin30MinsAgo = makeWalkinVisit_Arrived(30);
        var prebookedEarly = makeVisit_Arrived('pre-booked', 0, 41);
        var encounters = [prebookedEarly.encounter, walkin10MinsAgo.encounter, walkin30MinsAgo.encounter];
        var result = (0, utils_1.getWaitingMinutes)(NOW, encounters);
        var expectedRange = { low: 41, high: 56 };
        expect(result).toBe(expectedRange.low);
        expect(result + 15).toBe(expectedRange.high);
    });
});
