"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimeSpentInCurrentStatus = exports.getWaitingTimeForAppointment = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var startTimeOfMostRecentInstanceOfStatus = function (status, statusHistory) {
    var matchedStatuses = statusHistory.filter(function (item) {
        if (item.status === status && item.period.start !== undefined) {
            return true;
        }
        return false;
    });
    if (matchedStatuses.length === 1) {
        return luxon_1.DateTime.fromISO(matchedStatuses[0].period.start).toSeconds();
    }
    else if (matchedStatuses.length > 1) {
        var sorted = matchedStatuses.sort(function (a1, a2) {
            return luxon_1.DateTime.fromISO(a1.period.start).toSeconds() - luxon_1.DateTime.fromISO(a2.period.start).toSeconds();
        });
        var mostRecent = sorted.pop();
        return luxon_1.DateTime.fromISO(mostRecent.period.start).toSeconds();
    }
    else {
        return null;
    }
};
var getLastUnterminatedStatusEntry = function (statusHistory) {
    var matchedStatuses = statusHistory.filter(function (item) {
        if (item.period.end === undefined) {
            return true;
        }
        return false;
    });
    if (matchedStatuses.length === 1) {
        return matchedStatuses[0];
    }
    else if (matchedStatuses.length > 1) {
        var sorted = matchedStatuses.sort(function (a1, a2) {
            return luxon_1.DateTime.fromISO(a1.period.start).toSeconds() - luxon_1.DateTime.fromISO(a2.period.start).toSeconds();
        });
        return sorted[sorted.length - 1];
    }
    else {
        return null;
    }
};
// returns the arrived time as an epoch time in seconds
var getArrivedTime = function (statusHistory) {
    var arrivedTime = startTimeOfMostRecentInstanceOfStatus('arrived', statusHistory);
    if (arrivedTime === null) {
        arrivedTime = startTimeOfMostRecentInstanceOfStatus('ready', statusHistory);
    }
    if (arrivedTime === null) {
        arrivedTime = startTimeOfMostRecentInstanceOfStatus('intake', statusHistory);
    }
    return arrivedTime;
};
var getWaitingTimeEndRange = function (statusHistory) {
    var stopTime = startTimeOfMostRecentInstanceOfStatus('discharged', statusHistory);
    if (stopTime === null) {
        stopTime = startTimeOfMostRecentInstanceOfStatus('completed', statusHistory);
    }
    if (stopTime == null) {
        var lastUnterminated = getLastUnterminatedStatusEntry(statusHistory);
        if (lastUnterminated && lastUnterminated.status === 'cancelled') {
            stopTime = luxon_1.DateTime.fromISO(lastUnterminated.period.start).toSeconds();
        }
    }
    if (stopTime === null) {
        return luxon_1.DateTime.now().toSeconds();
    }
    return stopTime;
};
var getWaitingTimeForAppointment = function (encounter) {
    var statusHistory = (0, utils_1.getVisitStatusHistory)(encounter);
    var arrivedTime = getArrivedTime(statusHistory);
    if (arrivedTime === null) {
        return 0;
    }
    var stopTime = getWaitingTimeEndRange(statusHistory);
    return Math.round((stopTime - arrivedTime) / 60);
};
exports.getWaitingTimeForAppointment = getWaitingTimeForAppointment;
var getTimeSpentInCurrentStatus = function (encounter) {
    var statusHistory = (0, utils_1.getVisitStatusHistory)(encounter);
    var current = getLastUnterminatedStatusEntry(statusHistory);
    if (!current) {
        return 0;
    }
    return (-1.0 *
        (Math.round((luxon_1.DateTime.fromISO(current.period.start).diffNow('minutes').minutes + Number.EPSILON) * 100) / 100));
};
exports.getTimeSpentInCurrentStatus = getTimeSpentInCurrentStatus;
