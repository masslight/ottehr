"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var constants_1 = require("../src/shared/constants");
var queueingUtils_1 = require("../src/shared/queueingUtils");
var NOW;
var applyHop = function (visit) {
    var appointment = visit.appointment, encounter = visit.encounter;
    var hoppedAppointment = __assign(__assign({}, appointment), { meta: {
            tag: [
                {
                    system: constants_1.HOP_QUEUE_URI,
                    code: luxon_1.DateTime.now().toISO() || '',
                },
            ],
        } });
    return { appointment: hoppedAppointment, encounter: encounter };
};
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
var makeAppointment = function (type, startTime, appointmentStatus) {
    return {
        resourceType: 'Appointment',
        id: (0, crypto_1.randomUUID)(),
        start: startTime,
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
var makeVisit_Pending = function (type, startTimeMinsAgo) {
    var _a, _b;
    var bookingTime = (_a = NOW.minus({ days: 1 }).toISO()) !== null && _a !== void 0 ? _a : 'FAIL';
    var startTime = (_b = NOW.minus({ minutes: startTimeMinsAgo }).toISO()) !== null && _b !== void 0 ? _b : 'FAIL';
    var appointment = makeAppointment(type, startTime, 'booked');
    var statusHistory = [
        {
            status: 'planned',
            period: {
                start: bookingTime,
            },
        },
    ];
    var encounter = makeEncounter('planned', statusHistory, appointment);
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
var addNewStatusToVisit = function (visit, status, timeInLastStatus) {
    var _a, _b;
    var endTime = NOW.minus({
        minutes: timeInLastStatus,
    }).toISO();
    var updatedAppointmentStatus = utils_1.visitStatusToFhirAppointmentStatusMap[status];
    var updatedEncounterStatus = utils_1.visitStatusToFhirEncounterStatusMap[status];
    visit.appointment.status = updatedAppointmentStatus;
    visit.encounter.status = updatedEncounterStatus;
    var newStatusHistory = {
        status: updatedEncounterStatus,
        period: {
            start: endTime,
        },
    };
    var encounterStatusHistory = visit.encounter.statusHistory;
    var curStatus = encounterStatusHistory === null || encounterStatusHistory === void 0 ? void 0 : encounterStatusHistory.find(function (h) { return !h.period.end; });
    if (encounterStatusHistory) {
        if (curStatus) {
            curStatus.period.end = endTime;
        }
        encounterStatusHistory.push(newStatusHistory);
    }
    else {
        visit.encounter.statusHistory = [newStatusHistory];
    }
    if (status === 'intake') {
        addParticipant(visit.encounter, 'ADM', 'admitter', endTime);
    }
    if (status === 'ready for provider') {
        var curParticipant = visit.encounter.participant;
        if (curParticipant === null || curParticipant === void 0 ? void 0 : curParticipant.length) {
            var lastParticipant = curParticipant === null || curParticipant === void 0 ? void 0 : curParticipant[curParticipant.length - 1];
            curParticipant[curParticipant.length - 1].period = { start: (_a = lastParticipant.period) === null || _a === void 0 ? void 0 : _a.start, end: endTime };
        }
        else {
            addParticipant(visit.encounter, 'ADM', 'admitter', endTime, endTime);
        }
    }
    if (status === 'discharged') {
        var curParticipant = visit.encounter.participant;
        if (curParticipant === null || curParticipant === void 0 ? void 0 : curParticipant.length) {
            var lastParticipant = curParticipant === null || curParticipant === void 0 ? void 0 : curParticipant[curParticipant.length - 1];
            curParticipant[curParticipant.length - 1].period = { start: (_b = lastParticipant.period) === null || _b === void 0 ? void 0 : _b.start, end: endTime };
        }
        else {
            addParticipant(visit.encounter, 'ATND', 'attender', endTime, endTime);
        }
    }
    return visit;
};
var addParticipant = function (encounter, participantCode, participantDisplay, start, end) {
    var curParticipant = encounter.participant;
    var newParticipant = {
        period: {
            start: start,
            end: end,
        },
        individual: {
            type: 'Practitioner',
            reference: 'Practitioner/502a540d-c5f1-4af1-81bc-215b104bc04c',
        },
        type: [
            {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                        code: participantCode,
                        display: participantDisplay,
                    },
                ],
            },
        ],
    };
    if (curParticipant === null || curParticipant === void 0 ? void 0 : curParticipant.length) {
        curParticipant.push(newParticipant);
    }
    else {
        encounter.participant = [newParticipant];
    }
    return encounter;
};
var getAppointmentsAndMap = function (visits) {
    var appointments = visits.map(function (visit) { return visit.appointment; });
    var apptRefToEncounterMap = visits.reduce(function (acc, visit) {
        acc["Appointment/".concat(visit.appointment.id)] = visit.encounter;
        return acc;
    }, {});
    return { appointments: appointments, apptRefToEncounterMap: apptRefToEncounterMap };
};
(0, vitest_1.beforeAll)(function () {
    NOW = luxon_1.DateTime.now();
});
(0, vitest_1.test)('arrived patients queue', function () { return __awaiter(void 0, void 0, void 0, function () {
    var prebooked15MinEarlyAppt, preBooked17MinEarly, prebooked15MinEarly2, hoppedPrebook30Early, walkinJustNow, walkin75MinsAgo, prebookedRightOnTime, prebookedAlmostRightOnTime, walkin11MinsAgo, postTelemedOne, postTelemedTwo, hoppedWalkin11MinsAgo, visits, _a, appointments, apptRefToEncounterMap, expectedOrder, sorted;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                prebooked15MinEarlyAppt = makeVisit_Arrived('pre-booked', -15, 3);
                preBooked17MinEarly = makeVisit_Arrived('pre-booked', -17, 10);
                prebooked15MinEarly2 = makeVisit_Arrived('pre-booked', -15, 1);
                hoppedPrebook30Early = applyHop(makeVisit_Arrived('pre-booked', -30, 1));
                walkinJustNow = makeWalkinVisit_Arrived(1);
                walkin75MinsAgo = makeWalkinVisit_Arrived(75);
                prebookedRightOnTime = makeVisit_Arrived('pre-booked', 0, 0);
                prebookedAlmostRightOnTime = makeVisit_Arrived('pre-booked', 0, 2);
                walkin11MinsAgo = makeWalkinVisit_Arrived(11);
                postTelemedOne = makeVisit_Arrived('post-telemed', 30, 5);
                postTelemedTwo = makeVisit_Arrived('post-telemed', 0, 10);
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
            case 1:
                _b.sent(); // make sure this appointment is hopped after the first
                hoppedWalkin11MinsAgo = applyHop(makeWalkinVisit_Arrived(11));
                visits = [
                    prebooked15MinEarlyAppt,
                    preBooked17MinEarly,
                    postTelemedTwo,
                    walkinJustNow,
                    walkin75MinsAgo,
                    prebookedRightOnTime,
                    walkin11MinsAgo,
                    prebooked15MinEarly2,
                    postTelemedOne,
                    prebookedAlmostRightOnTime,
                    hoppedPrebook30Early,
                    hoppedWalkin11MinsAgo,
                ];
                _a = getAppointmentsAndMap(visits), appointments = _a.appointments, apptRefToEncounterMap = _a.apptRefToEncounterMap;
                expectedOrder = [
                    hoppedWalkin11MinsAgo.appointment,
                    hoppedPrebook30Early.appointment,
                    postTelemedOne.appointment,
                    postTelemedTwo.appointment,
                    prebookedAlmostRightOnTime.appointment,
                    prebookedRightOnTime.appointment,
                    prebooked15MinEarlyAppt.appointment,
                    prebooked15MinEarly2.appointment,
                    walkin75MinsAgo.appointment,
                    walkin11MinsAgo.appointment,
                    preBooked17MinEarly.appointment,
                    walkinJustNow.appointment,
                ];
                sorted = (0, queueingUtils_1.sortAppointments)(appointments, apptRefToEncounterMap).inOffice.waitingRoom.arrived;
                (0, vitest_1.expect)(sorted.length).toBe(expectedOrder.length);
                sorted.forEach(function (val, idx) {
                    console.log(val.id);
                    (0, vitest_1.expect)(val.id).toBe(expectedOrder[idx].id);
                });
                return [2 /*return*/];
        }
    });
}); });
(0, vitest_1.test)('ready patients queue', function () { return __awaiter(void 0, void 0, void 0, function () {
    var checkInAppointment, prebooked15MinEarly, preBooked17MinEarly, preBooked10MinEarly, prebooked15MinEarly2, walkinJustNow, walkin74MinsAgo, hoppedWalkin74MinsAgo, walkin75MinsAgo, prebookedRightOnTime, prebookedAlmostRightOnTime, walkin11MinsAgo, postTelemedRightOnTime, postTelemedAlmostRightOnTime, hoppedPreBooked17MinEarly, visits, _a, appointments, apptRefToEncounterMap, expectedOrder, sorted;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                checkInAppointment = function (visit) {
                    visit.appointment.status = 'checked-in';
                    return visit;
                };
                prebooked15MinEarly = checkInAppointment(makeVisit_Arrived('pre-booked', -15, 3));
                preBooked17MinEarly = checkInAppointment(makeVisit_Arrived('pre-booked', -17, 10));
                preBooked10MinEarly = checkInAppointment(makeVisit_Arrived('pre-booked', -10, 5));
                prebooked15MinEarly2 = checkInAppointment(makeVisit_Arrived('pre-booked', -15, 1));
                walkinJustNow = checkInAppointment(makeWalkinVisit_Arrived(2));
                walkin74MinsAgo = checkInAppointment(makeWalkinVisit_Arrived(74));
                hoppedWalkin74MinsAgo = applyHop(checkInAppointment(makeWalkinVisit_Arrived(74)));
                walkin75MinsAgo = checkInAppointment(makeWalkinVisit_Arrived(75));
                prebookedRightOnTime = checkInAppointment(makeVisit_Arrived('pre-booked', 0, 0));
                prebookedAlmostRightOnTime = checkInAppointment(makeVisit_Arrived('pre-booked', 0, 2));
                walkin11MinsAgo = checkInAppointment(makeWalkinVisit_Arrived(11));
                postTelemedRightOnTime = checkInAppointment(makeVisit_Arrived('post-telemed', 0, 0));
                postTelemedAlmostRightOnTime = checkInAppointment(makeVisit_Arrived('post-telemed', 0, 2));
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
            case 1:
                _b.sent(); // make sure this appointment is hopped after the first
                hoppedPreBooked17MinEarly = applyHop(checkInAppointment(makeVisit_Arrived('pre-booked', -17, 10)));
                visits = [
                    prebooked15MinEarly,
                    preBooked17MinEarly,
                    postTelemedRightOnTime,
                    walkinJustNow,
                    walkin75MinsAgo,
                    walkin74MinsAgo,
                    postTelemedAlmostRightOnTime,
                    prebookedRightOnTime,
                    preBooked10MinEarly,
                    walkin11MinsAgo,
                    prebooked15MinEarly2,
                    prebookedAlmostRightOnTime,
                    hoppedWalkin74MinsAgo,
                    hoppedPreBooked17MinEarly,
                ];
                _a = getAppointmentsAndMap(visits), appointments = _a.appointments, apptRefToEncounterMap = _a.apptRefToEncounterMap;
                expectedOrder = [
                    hoppedPreBooked17MinEarly.appointment,
                    hoppedWalkin74MinsAgo.appointment,
                    postTelemedAlmostRightOnTime.appointment,
                    postTelemedRightOnTime.appointment,
                    prebookedAlmostRightOnTime.appointment,
                    prebookedRightOnTime.appointment,
                    walkin75MinsAgo.appointment,
                    preBooked10MinEarly.appointment,
                    walkin74MinsAgo.appointment,
                    walkin11MinsAgo.appointment,
                    prebooked15MinEarly.appointment,
                    prebooked15MinEarly2.appointment,
                    preBooked17MinEarly.appointment,
                    walkinJustNow.appointment,
                ];
                sorted = (0, queueingUtils_1.sortAppointments)(appointments, apptRefToEncounterMap).inOffice.waitingRoom.ready;
                (0, vitest_1.expect)(sorted.length).toBe(expectedOrder.length);
                sorted.forEach(function (val, idx) {
                    console.log(val.id);
                    (0, vitest_1.expect)(val.id).toBe(expectedOrder[idx].id);
                });
                return [2 /*return*/];
        }
    });
}); });
(0, vitest_1.test)('intake patients queue', function () {
    var prebooked15MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 7), 'intake', 1);
    var preBooked17MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -17, 10), 'intake', 1);
    var preBooked10MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -10, 5), 'intake', 1);
    var prebooked15MinEarly2 = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 1), 'intake', 0);
    var walkinJustNow = addNewStatusToVisit(makeWalkinVisit_Arrived(2), 'intake', 1);
    var walkin74MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(74), 'intake', 20);
    var walkin75MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(75), 'intake', 15);
    var prebookedRightOnTime = addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 0), 'intake', 0);
    var prebookedAlmostRightOnTime = addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 2), 'intake', 1);
    var postTelemedRightOnTime = addNewStatusToVisit(makeVisit_Arrived('post-telemed', 0, 0), 'intake', 0);
    var postTelemedAlmostRightOnTime = addNewStatusToVisit(makeVisit_Arrived('post-telemed', 0, 2), 'intake', 1);
    var walkin11MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(11), 'intake', 1);
    var visits = [
        prebooked15MinEarly,
        postTelemedRightOnTime,
        walkin11MinsAgo,
        walkin74MinsAgo,
        walkin75MinsAgo,
        preBooked10MinEarly,
        prebookedAlmostRightOnTime,
        prebookedRightOnTime,
        postTelemedAlmostRightOnTime,
        preBooked17MinEarly,
        prebooked15MinEarly2,
        walkinJustNow,
    ];
    var _a = getAppointmentsAndMap(visits), appointments = _a.appointments, apptRefToEncounterMap = _a.apptRefToEncounterMap;
    // 15 min early appt gets to go in first b/c waiting 1 additional minute??
    var expectedOrder = [
        walkin75MinsAgo.appointment,
        walkin74MinsAgo.appointment,
        walkin11MinsAgo.appointment,
        preBooked17MinEarly.appointment,
        prebooked15MinEarly.appointment,
        preBooked10MinEarly.appointment,
        prebookedAlmostRightOnTime.appointment,
        postTelemedAlmostRightOnTime.appointment,
        walkinJustNow.appointment,
        prebooked15MinEarly2.appointment,
        postTelemedRightOnTime.appointment,
        prebookedRightOnTime.appointment,
    ];
    var sorted = (0, queueingUtils_1.sortAppointments)(appointments, apptRefToEncounterMap).inOffice.inExam.intake;
    (0, vitest_1.expect)(sorted.length).toBe(expectedOrder.length);
    sorted.forEach(function (val, idx) {
        console.log(val.id);
        (0, vitest_1.expect)(val.id).toBe(expectedOrder[idx].id);
    });
});
(0, vitest_1.test)('ready for provider patients queue', function () { return __awaiter(void 0, void 0, void 0, function () {
    var prebooked15MinEarly, preBooked17MinEarly, preBooked10MinEarly, prebooked15MinEarly2, preBooked5MinEarly, walkinJustNow, walkin74MinsAgo, hoppedWalkin74MinsAgo, walkin75MinsAgo, prebookedRightOnTime, prebookedAlmostRightOnTime, postTelemedRightOnTime, postTelemedAlmostRightOnTime, walkin11MinsAgo, hoppedPrebookedRightOnTime, visits, _a, appointments, apptRefToEncounterMap, expectedOrder, sorted;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                prebooked15MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 7), 'ready for provider', 1);
                preBooked17MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -17, 10), 'ready for provider', 1);
                preBooked10MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -10, 5), 'ready for provider', 1);
                prebooked15MinEarly2 = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 1), 'ready for provider', 0);
                preBooked5MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -5, 5), 'ready for provider', 1);
                walkinJustNow = addNewStatusToVisit(makeWalkinVisit_Arrived(2), 'ready for provider', 1);
                walkin74MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(74), 'ready for provider', 20);
                hoppedWalkin74MinsAgo = applyHop(addNewStatusToVisit(makeWalkinVisit_Arrived(74), 'ready for provider', 20));
                walkin75MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(75), 'ready for provider', 15);
                prebookedRightOnTime = addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 0), 'ready for provider', 0);
                prebookedAlmostRightOnTime = addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 2), 'ready for provider', 1);
                postTelemedRightOnTime = addNewStatusToVisit(makeVisit_Arrived('post-telemed', 0, 0), 'ready for provider', 0);
                postTelemedAlmostRightOnTime = addNewStatusToVisit(makeVisit_Arrived('post-telemed', 0, 2), 'ready for provider', 1);
                walkin11MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(11), 'ready for provider', 1);
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
            case 1:
                _b.sent(); // make sure this appointment is hopped after the first
                hoppedPrebookedRightOnTime = applyHop(addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 0), 'ready for provider', 0));
                visits = [
                    postTelemedRightOnTime,
                    prebooked15MinEarly,
                    walkin11MinsAgo,
                    walkin74MinsAgo,
                    walkin75MinsAgo,
                    preBooked10MinEarly,
                    preBooked5MinEarly,
                    prebookedAlmostRightOnTime,
                    prebookedRightOnTime,
                    preBooked17MinEarly,
                    prebooked15MinEarly2,
                    postTelemedAlmostRightOnTime,
                    walkinJustNow,
                    hoppedWalkin74MinsAgo,
                    hoppedPrebookedRightOnTime,
                ];
                _a = getAppointmentsAndMap(visits), appointments = _a.appointments, apptRefToEncounterMap = _a.apptRefToEncounterMap;
                expectedOrder = [
                    hoppedPrebookedRightOnTime.appointment,
                    hoppedWalkin74MinsAgo.appointment,
                    postTelemedAlmostRightOnTime.appointment,
                    postTelemedRightOnTime.appointment,
                    prebookedAlmostRightOnTime.appointment,
                    prebookedRightOnTime.appointment,
                    preBooked5MinEarly.appointment,
                    walkin75MinsAgo.appointment,
                    walkin74MinsAgo.appointment,
                    walkin11MinsAgo.appointment,
                    preBooked17MinEarly.appointment,
                    prebooked15MinEarly.appointment,
                    preBooked10MinEarly.appointment,
                    walkinJustNow.appointment,
                    prebooked15MinEarly2.appointment,
                ];
                sorted = (0, queueingUtils_1.sortAppointments)(appointments, apptRefToEncounterMap).inOffice.inExam['ready for provider'];
                (0, vitest_1.expect)(sorted.length).toBe(expectedOrder.length);
                sorted.forEach(function (val, idx) {
                    console.log(val.id);
                    (0, vitest_1.expect)(val.id).toBe(expectedOrder[idx].id);
                });
                return [2 /*return*/];
        }
    });
}); });
(0, vitest_1.test)('discharged patients queue', function () {
    var prebooked15MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 7), 'discharged', 4);
    var preBooked17MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -17, 10), 'discharged', 2);
    var preBooked10MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -10, 5), 'discharged', 1);
    var prebooked15MinEarly2 = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 1), 'discharged', 0);
    var preBooked5MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -5, 5), 'discharged', 2);
    var walkinJustNow = addNewStatusToVisit(makeWalkinVisit_Arrived(2), 'discharged', 1);
    var walkin74MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(74), 'discharged', 20);
    var walkin75MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(75), 'discharged', 15);
    var prebookedRightOnTime = addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 0), 'discharged', 0);
    var prebookedAlmostRightOnTime = addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 2), 'discharged', 1);
    var walkin11MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(11), 'discharged', 6);
    var visits = [
        prebooked15MinEarly,
        walkin11MinsAgo,
        walkin74MinsAgo,
        walkin75MinsAgo,
        preBooked10MinEarly,
        preBooked5MinEarly,
        prebookedAlmostRightOnTime,
        prebookedRightOnTime,
        preBooked17MinEarly,
        prebooked15MinEarly2,
        walkinJustNow,
    ];
    var _a = getAppointmentsAndMap(visits), appointments = _a.appointments, apptRefToEncounterMap = _a.apptRefToEncounterMap;
    var expectedOrder = [
        walkin75MinsAgo.appointment,
        walkin74MinsAgo.appointment,
        walkin11MinsAgo.appointment,
        walkinJustNow.appointment,
        prebookedAlmostRightOnTime.appointment,
        prebookedRightOnTime.appointment,
        preBooked5MinEarly.appointment,
        preBooked10MinEarly.appointment,
        prebooked15MinEarly.appointment,
        prebooked15MinEarly2.appointment,
        preBooked17MinEarly.appointment,
    ];
    var sorted = (0, queueingUtils_1.sortAppointments)(appointments, apptRefToEncounterMap).checkedOut;
    (0, vitest_1.expect)(sorted.length).toBe(expectedOrder.length);
    sorted.forEach(function (val, idx) {
        console.log(val.id);
        (0, vitest_1.expect)(val.id).toBe(expectedOrder[idx].id);
    });
});
(0, vitest_1.test)('prebooked patients queue', function () {
    var prebooked15MinOut = makeVisit_Pending('pre-booked', -15);
    var preBooked17MinOut = makeVisit_Pending('pre-booked', -17);
    var prebooked14MinOut = makeVisit_Pending('pre-booked', -14);
    var prebookedRightNow = makeVisit_Pending('pre-booked', 0);
    var prebooked10MinsLate = makeVisit_Pending('pre-booked', 10);
    var prebooked5MinsLate = makeVisit_Pending('pre-booked', 5);
    var posttelemedRightNow = makeVisit_Pending('post-telemed', 0);
    var postTelemed16MinsOut = makeVisit_Pending('post-telemed', -16);
    var postTelemed8MinsLate = makeVisit_Pending('post-telemed', 8);
    var visits = [
        prebooked15MinOut,
        preBooked17MinOut,
        posttelemedRightNow,
        prebooked14MinOut,
        prebookedRightNow,
        postTelemed16MinsOut,
        prebooked10MinsLate,
        postTelemed8MinsLate,
        prebooked5MinsLate,
    ];
    var _a = getAppointmentsAndMap(visits), appointments = _a.appointments, apptRefToEncounterMap = _a.apptRefToEncounterMap;
    // 15 min early appt gets to go in first b/c waiting 1 additional minute??
    var expectedOrder = [
        prebooked10MinsLate.appointment,
        postTelemed8MinsLate.appointment,
        prebooked5MinsLate.appointment,
        posttelemedRightNow.appointment, // order doesn't matter between these two
        prebookedRightNow.appointment, // order doesn't matter between these two
        prebooked14MinOut.appointment,
        prebooked15MinOut.appointment,
        postTelemed16MinsOut.appointment,
        preBooked17MinOut.appointment,
    ];
    var sorted = (0, queueingUtils_1.sortAppointments)(appointments, apptRefToEncounterMap).prebooked;
    (0, vitest_1.expect)(sorted.length).toBe(expectedOrder.length);
    sorted.forEach(function (val, idx) {
        console.log(val.id);
        (0, vitest_1.expect)(val.id).toBe(expectedOrder[idx].id);
    });
});
