"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortAppointments = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var waitTimeUtils_1 = require("./waitTimeUtils");
var ARRIVED_PREBOOKED_EARLY_ARRIVAL_LIMIT = 15;
var READY_PREBOOKED_EARLY_ARRIVAL_LIMIT = 10;
var R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT = 5;
var READY_WALKIN_MAX_WAIT_THRESHOLD = 75;
// const R4P_WALKIN_MAX_WAIT_THRESHOLD = 75;
var checkForHop = function (app1, app2) {
    var _a, _b, _c, _d, _e, _f;
    var appt1Hopped = (_c = (_b = (_a = app1.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === 'hop-queue'; })) === null || _c === void 0 ? void 0 : _c.code;
    var appt2Hopped = (_f = (_e = (_d = app2.meta) === null || _d === void 0 ? void 0 : _d.tag) === null || _e === void 0 ? void 0 : _e.find(function (tag) { return tag.system === 'hop-queue'; })) === null || _f === void 0 ? void 0 : _f.code;
    if (appt1Hopped && appt2Hopped) {
        return luxon_1.DateTime.fromISO(appt2Hopped).diff(luxon_1.DateTime.fromISO(appt1Hopped), 'milliseconds').milliseconds;
    }
    if (appt1Hopped && !appt2Hopped) {
        return -1;
    }
    if (appt2Hopped && !appt1Hopped) {
        return 1;
    }
    return;
};
var prebookedSorter = function (visit1, visit2) {
    var _a, _b;
    var app1 = visit1.appointment;
    var app2 = visit2.appointment;
    var start1 = luxon_1.DateTime.fromISO((_a = app1.start) !== null && _a !== void 0 ? _a : '');
    var start2 = luxon_1.DateTime.fromISO((_b = app2.start) !== null && _b !== void 0 ? _b : '');
    if (!start1.isValid && !start2.isValid) {
        return 0;
    }
    if (!start1.isValid) {
        return -1;
    }
    if (!start2.isValid) {
        return 1;
    }
    if (start1.equals(start2)) {
        return (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit2.encounter) - (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit1.encounter);
    }
    return start1 < start2 ? -1 : 1;
};
var arrivedSorter = function (visit1, visit2) {
    var app1 = visit1.appointment;
    var app2 = visit2.appointment;
    var app1Type = (0, utils_1.appointmentTypeForAppointment)(app1);
    var app2Type = (0, utils_1.appointmentTypeForAppointment)(app2);
    var hopped = checkForHop(app1, app2);
    if (hopped)
        return hopped;
    if (app1Type === 'post-telemed' && app2Type === 'post-telemed') {
        return prebookedSorter(visit1, visit2);
    }
    if (app1Type === 'post-telemed' && app2Type !== 'post-telemed') {
        return -1;
    }
    if (app2Type === 'post-telemed' && app1Type !== 'post-telemed') {
        return 1;
    }
    if (app1Type === 'pre-booked' && app2Type === 'pre-booked') {
        return prebookedSorter(visit1, visit2);
    }
    if (app1Type === 'pre-booked') {
        var minutesUntilApptOneStart = luxon_1.DateTime.fromISO(app1.start).diffNow('minutes').minutes;
        if (minutesUntilApptOneStart <= ARRIVED_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
            return -1;
        }
    }
    if (app2Type === 'pre-booked') {
        var minutesUntilApptTwoStart = luxon_1.DateTime.fromISO(app2.start).diffNow('minutes').minutes;
        if (minutesUntilApptTwoStart <= ARRIVED_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
            return 1;
        }
    }
    return (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit2.encounter) - (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit1.encounter);
};
var readySorter = function (visit1, visit2) {
    var app1 = visit1.appointment;
    var app2 = visit2.appointment;
    var app1Type = (0, utils_1.appointmentTypeForAppointment)(app1);
    var app2Type = (0, utils_1.appointmentTypeForAppointment)(app2);
    var hopped = checkForHop(app1, app2);
    if (hopped)
        return hopped;
    if (app1Type === 'post-telemed' && app2Type === 'post-telemed') {
        return prebookedSorter(visit1, visit2);
    }
    if (app1Type === 'post-telemed' && app2Type !== 'post-telemed') {
        return -1;
    }
    if (app2Type === 'post-telemed' && app1Type !== 'post-telemed') {
        return 1;
    }
    if (app1Type === 'pre-booked' && app2Type === 'pre-booked') {
        return prebookedSorter(visit1, visit2);
    }
    if (app1Type === 'pre-booked') {
        var minutesUntilApptOneStart = luxon_1.DateTime.fromISO(app1.start).diffNow('minutes').minutes;
        if (minutesUntilApptOneStart <= 0) {
            return -1;
        }
    }
    if (app2Type === 'pre-booked') {
        var minutesUntilApptTwoStart = luxon_1.DateTime.fromISO(app2.start).diffNow('minutes').minutes;
        if (minutesUntilApptTwoStart <= 0) {
            return 1;
        }
    }
    var app1WaitingTime = (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit1.encounter);
    if (app1Type === 'walk-in' && app2Type === 'pre-booked' && app1WaitingTime >= READY_WALKIN_MAX_WAIT_THRESHOLD) {
        return -1;
    }
    var app2WaitingTime = (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit2.encounter);
    if (app2Type === 'walk-in' && app1Type === 'pre-booked' && app2WaitingTime >= READY_WALKIN_MAX_WAIT_THRESHOLD) {
        return 1;
    }
    if (app1Type === 'pre-booked') {
        var minutesUntilApptOneStart = luxon_1.DateTime.fromISO(app1.start).diffNow('minutes').minutes;
        if (minutesUntilApptOneStart <= READY_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
            return -1;
        }
    }
    if (app2Type === 'pre-booked') {
        var minutesUntilApptTwoStart = luxon_1.DateTime.fromISO(app2.start).diffNow('minutes').minutes;
        if (minutesUntilApptTwoStart <= READY_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
            return 1;
        }
    }
    return app2WaitingTime - app1WaitingTime;
};
var intakeSorter = function (visit1, visit2) {
    var app1WaitingTime = (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit1.encounter);
    var app2WaitingTime = (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit2.encounter);
    return app2WaitingTime - app1WaitingTime;
};
var r4ProviderSorter = function (visit1, visit2) {
    var app1 = visit1.appointment;
    var app2 = visit2.appointment;
    var app1Type = (0, utils_1.appointmentTypeForAppointment)(app1);
    var app2Type = (0, utils_1.appointmentTypeForAppointment)(app2);
    var app1WaitingTime = (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit1.encounter);
    var app2WaitingTime = (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit2.encounter);
    var hopped = checkForHop(app1, app2);
    if (hopped)
        return hopped;
    if (app1Type === 'post-telemed' && app2Type === 'post-telemed') {
        return prebookedSorter(visit1, visit2);
    }
    if (app1Type === 'post-telemed' && app2Type !== 'post-telemed') {
        return -1;
    }
    if (app2Type === 'post-telemed' && app1Type !== 'post-telemed') {
        return 1;
    }
    /*
      Walk-in, has waiting time of 75+ mins
      Pre-booked, current time + 5mins >= appointment time
      Walk-ins / Pre-booked, current time + 5mins < appointment time: descending order by waiting time
      */
    if (app1Type === 'walk-in' && app2Type === 'walk-in') {
        return app2WaitingTime - app1WaitingTime;
    }
    var minutesUntilApptOneStart = luxon_1.DateTime.fromISO(app1.start).diffNow('minutes').minutes;
    var minutesUntilApptTwoStart = luxon_1.DateTime.fromISO(app2.start).diffNow('minutes').minutes;
    // if (app1Type === 'walk-in' && app1WaitingTime >= R4P_WALKIN_MAX_WAIT_THRESHOLD) {
    //   return -1;
    // }
    // if (app2Type === 'walk-in' && app2WaitingTime >= R4P_WALKIN_MAX_WAIT_THRESHOLD) {
    //   return 1;
    // }
    if (app1Type === 'pre-booked' &&
        minutesUntilApptOneStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT &&
        app2Type === 'pre-booked' &&
        minutesUntilApptTwoStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
        return prebookedSorter(visit1, visit2);
    }
    if (app1Type === 'pre-booked') {
        if (minutesUntilApptOneStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
            return -1;
        }
    }
    if (app2Type === 'pre-booked') {
        if (minutesUntilApptTwoStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
            return 1;
        }
    }
    return app2WaitingTime - app1WaitingTime;
};
var getArrivalTime = function (encounter) {
    var _a, _b;
    var history = (_a = encounter.statusHistory) !== null && _a !== void 0 ? _a : [];
    var arrived = history.find(function (h) { return h.status === 'arrived'; });
    if (!arrived || !((_b = arrived.period) === null || _b === void 0 ? void 0 : _b.start)) {
        return Infinity;
    }
    return Date.parse(arrived.period.start);
};
function checkedOutSorter(visit1, visit2) {
    var getAppointmentTime = function (visit) {
        var _a;
        var type = (0, utils_1.appointmentTypeForAppointment)(visit.appointment);
        if (type === 'walk-in') {
            return getArrivalTime(visit.encounter);
        }
        return Date.parse((_a = visit.appointment.start) !== null && _a !== void 0 ? _a : '');
    };
    var time1 = getAppointmentTime(visit1);
    var time2 = getAppointmentTime(visit2);
    if (time1 !== time2) {
        return time1 - time2;
    }
    var app1Arrived = getArrivalTime(visit1.encounter);
    var app2Arrived = getArrivalTime(visit2.encounter);
    return app1Arrived - app2Arrived;
}
var currentStatusSorter = function (visit1, visit2) {
    var statusDiff = (0, waitTimeUtils_1.getTimeSpentInCurrentStatus)(visit2.encounter) - (0, waitTimeUtils_1.getTimeSpentInCurrentStatus)(visit1.encounter);
    if (statusDiff === 0) {
        return (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit2.encounter) - (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit1.encounter);
    }
    return statusDiff;
};
var currentStatusReversedSorter = function (visit1, visit2) {
    var statusDiff = (0, waitTimeUtils_1.getTimeSpentInCurrentStatus)(visit1.encounter) - (0, waitTimeUtils_1.getTimeSpentInCurrentStatus)(visit2.encounter);
    if (statusDiff === 0) {
        return (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit1.encounter) - (0, waitTimeUtils_1.getWaitingTimeForAppointment)(visit2.encounter);
    }
    return statusDiff;
};
var evalQueue = function (queue) {
    return queue.list.sort(queue.comparator).map(function (visit) { return visit.appointment; });
};
var QueueBuilder = /** @class */ (function () {
    function QueueBuilder() {
        var emptyQueues = {
            prebooked: { list: [], comparator: prebookedSorter },
            inOffice: {
                waitingRoom: {
                    arrived: { list: [], comparator: arrivedSorter },
                    ready: { list: [], comparator: readySorter },
                },
                inExam: {
                    intake: { list: [], comparator: intakeSorter },
                    'ready for provider': { list: [], comparator: r4ProviderSorter },
                    provider: { list: [], comparator: currentStatusSorter },
                },
            },
            checkedOut: { list: [], comparator: checkedOutSorter },
            canceled: { list: [], comparator: currentStatusReversedSorter },
        };
        this.queues = emptyQueues;
    }
    QueueBuilder.prototype.insertNew = function (appointment, encounter, queue) {
        queue.list.push({ appointment: appointment, encounter: encounter });
    };
    QueueBuilder.prototype.sortAppointments = function (appointments, apptRefToEncounterMap) {
        var _this = this;
        appointments.forEach(function (appointment) {
            var encounter = apptRefToEncounterMap["Appointment/".concat(appointment.id)];
            if (encounter && appointment) {
                var status_1 = (0, utils_1.getInPersonVisitStatus)(appointment, encounter);
                if (status_1 === 'pending') {
                    _this.insertNew(appointment, encounter, _this.queues.prebooked);
                }
                else if (status_1 === 'arrived') {
                    _this.insertNew(appointment, encounter, _this.queues.inOffice.waitingRoom.arrived);
                }
                else if (status_1 === 'ready') {
                    _this.insertNew(appointment, encounter, _this.queues.inOffice.waitingRoom.ready);
                }
                else if (status_1 === 'intake') {
                    _this.insertNew(appointment, encounter, _this.queues.inOffice.inExam.intake);
                }
                else if (status_1 === 'ready for provider') {
                    _this.insertNew(appointment, encounter, _this.queues.inOffice.inExam['ready for provider']);
                }
                else if (status_1 === 'provider') {
                    _this.insertNew(appointment, encounter, _this.queues.inOffice.inExam.provider);
                }
                else if (status_1 === 'cancelled' || status_1 === 'no show') {
                    _this.insertNew(appointment, encounter, _this.queues.canceled);
                }
                else if (status_1 === 'completed' || status_1 === 'discharged') {
                    _this.insertNew(appointment, encounter, _this.queues.checkedOut);
                }
            }
        });
        return {
            prebooked: evalQueue(this.queues.prebooked),
            inOffice: {
                waitingRoom: {
                    arrived: evalQueue(this.queues.inOffice.waitingRoom.arrived),
                    ready: evalQueue(this.queues.inOffice.waitingRoom.ready),
                },
                inExam: {
                    intake: evalQueue(this.queues.inOffice.inExam.intake),
                    'ready for provider': evalQueue(this.queues.inOffice.inExam['ready for provider']),
                    provider: evalQueue(this.queues.inOffice.inExam.provider),
                },
            },
            checkedOut: evalQueue(this.queues.checkedOut),
            canceled: evalQueue(this.queues.canceled),
        };
    };
    return QueueBuilder;
}());
var sortAppointments = function (appointments, apptRefToEncounterMap) {
    var queueBuilder = new QueueBuilder();
    return queueBuilder.sortAppointments(appointments, apptRefToEncounterMap);
};
exports.sortAppointments = sortAppointments;
