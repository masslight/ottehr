"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var luxon_1 = require("luxon");
var vitest_1 = require("vitest");
var waitTimeUtils_1 = require("../src/shared/waitTimeUtils");
var makeEncounter = function (statusHistory, status) {
    return {
        resourceType: 'Encounter',
        status: status,
        statusHistory: statusHistory,
        class: {
            system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
            code: 'ACUTE',
            display: 'inpatient acute',
        },
    };
};
(0, vitest_1.test)('waiting time, no ready for provider, no discharged', function () {
    var statusHistory = [
        {
            status: 'planned',
            period: {
                start: '2024-02-01T23:07:35.152Z',
                end: '2024-02-02T00:33:20.149Z',
            },
        },
        {
            status: 'arrived',
            period: {
                start: '2024-02-02T00:33:20.149Z',
                end: '2024-02-02T00:37:48.744Z',
            },
        },
        {
            status: 'in-progress',
            period: {
                start: '2024-02-02T00:37:48.744Z',
                end: '2024-02-02T01:00:33.464Z',
            },
        },
        {
            status: 'finished',
            period: {
                start: '2024-02-02T01:00:33.464Z',
            },
        },
    ];
    var encounter = makeEncounter(statusHistory, 'finished');
    var waitingTime = (0, waitTimeUtils_1.getWaitingTimeForAppointment)(encounter);
    console.log('waitingTime', waitingTime);
    // the start of 'ARR' status
    var start = luxon_1.DateTime.fromISO('2024-02-02T00:33:20.149Z').toSeconds();
    // the start of 'CHK' status
    var end = luxon_1.DateTime.fromISO('2024-02-02T01:00:33.464Z').toSeconds();
    var expectedWT = Math.round((end - start) / 60);
    (0, vitest_1.expect)(waitingTime).toBeGreaterThan(0);
    (0, vitest_1.expect)(waitingTime).toEqual(expectedWT);
});
(0, vitest_1.test)('waiting time, canceled appointment', function () {
    var statusHistory = [
        {
            status: 'planned',
            period: {
                start: '2024-02-01T23:18:22.359Z',
                end: '2024-02-02T00:15:09.184Z',
            },
        },
        {
            status: 'arrived',
            period: {
                start: '2024-02-02T00:15:09.185Z',
                end: '2024-02-02T00:41:33.714Z',
            },
        },
        {
            status: 'cancelled',
            period: {
                start: '2024-02-02T00:41:33.714Z',
            },
        },
    ];
    var encounter = makeEncounter(statusHistory, 'cancelled');
    var waitingTime = (0, waitTimeUtils_1.getWaitingTimeForAppointment)(encounter);
    // the start of 'ARR' status
    var start = luxon_1.DateTime.fromISO('2024-02-02T00:15:09.185Z').toSeconds();
    // the start of 'CANC' status
    var end = luxon_1.DateTime.fromISO('2024-02-02T00:41:33.714Z').toSeconds();
    var expectedWT = Math.round((end - start) / 60);
    (0, vitest_1.expect)(waitingTime).toBeGreaterThan(0);
    (0, vitest_1.expect)(waitingTime).toEqual(expectedWT);
});
(0, vitest_1.test)('waiting time, pending then canceled appointment', function () {
    var statusHistory = [
        {
            status: 'planned',
            period: {
                start: '2024-02-01T23:18:22.359Z',
                end: '2024-02-02T00:15:09.184Z',
            },
        },
        {
            status: 'cancelled',
            period: {
                start: '2024-02-02T00:15:09.184Z',
            },
        },
    ];
    var encounter = makeEncounter(statusHistory, 'cancelled');
    var waitingTime = (0, waitTimeUtils_1.getWaitingTimeForAppointment)(encounter);
    (0, vitest_1.expect)(waitingTime).toEqual(0);
    (0, vitest_1.expect)(waitingTime).toEqual(0);
});
(0, vitest_1.test)('waiting time, no show appointment', function () {
    var statusHistory = [
        {
            status: 'planned',
            period: {
                start: '2024-02-01T23:18:22.359Z',
                end: '2024-02-02T00:15:09.184Z',
            },
        },
        {
            status: 'cancelled',
            period: {
                start: '2024-02-02T00:15:09.184Z',
            },
        },
    ];
    var encounter = makeEncounter(statusHistory, 'cancelled');
    var waitingTimeProd = (0, waitTimeUtils_1.getWaitingTimeForAppointment)(encounter);
    (0, vitest_1.expect)(waitingTimeProd).toEqual(0);
});
(0, vitest_1.test)('waiting time, no provider, no ready for provider and no discharged', function () {
    var statusHistory = [
        {
            status: 'planned',
            period: {
                start: '2024-02-01T23:07:35.152Z',
                end: '2024-02-02T00:33:20.149Z',
            },
        },
        {
            status: 'arrived',
            period: {
                start: '2024-02-02T00:33:20.149Z',
                end: '2024-02-02T00:37:48.744Z',
            },
        },
        {
            status: 'in-progress',
            period: {
                start: '2024-02-02T00:37:48.744Z',
                end: '2024-02-02T00:38:04.147Z',
            },
        },
        {
            status: 'arrived',
            period: {
                start: '2024-02-02T00:38:04.147Z',
                end: '2024-02-02T00:42:04.669Z',
            },
        },
        {
            status: 'in-progress',
            period: {
                start: '2024-02-02T00:42:04.669Z',
                end: '2024-02-02T00:47:49.187Z',
            },
        },
        {
            status: 'finished',
            period: {
                start: '2024-02-02T00:47:49.187Z',
            },
        },
    ];
    var encounter = makeEncounter(statusHistory, 'finished');
    var waitingTimeProd = (0, waitTimeUtils_1.getWaitingTimeForAppointment)(encounter);
    // most recent arrived start time
    var start = luxon_1.DateTime.fromISO('2024-02-02T00:38:04.147Z').toSeconds();
    // the start of finished status
    var end = luxon_1.DateTime.fromISO('2024-02-02T00:47:49.187Z').toSeconds();
    var expectedWT = Math.round((end - start) / 60);
    (0, vitest_1.expect)(waitingTimeProd).toBeGreaterThan(0);
    (0, vitest_1.expect)(waitingTimeProd).toEqual(expectedWT);
});
