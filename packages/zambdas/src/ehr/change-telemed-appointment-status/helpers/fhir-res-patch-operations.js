"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeStatusRecordPeriodValueOp = exports.deleteStatusHistoryRecordOp = exports.addPeriodEndOp = exports.addStatusHistoryRecordOp = exports.addStatusHistoryOp = exports.changeStatusOp = exports.handleEmptyEncounterStatusHistoryOp = void 0;
var luxon_1 = require("luxon");
/**
 * This functions handles empty encounter status history and always guarantees that
 * there is at least one status history record with current status
 */
var handleEmptyEncounterStatusHistoryOp = function (appointmentPackage) {
    var _a;
    var patchOperations = [];
    var now = luxon_1.DateTime.utc().toISO();
    var statusHistoryLength = ((_a = appointmentPackage.encounter.statusHistory) === null || _a === void 0 ? void 0 : _a.length) || 0;
    if (statusHistoryLength <= 0) {
        patchOperations.push((0, exports.addStatusHistoryOp)());
        patchOperations.push((0, exports.addStatusHistoryRecordOp)(0, appointmentPackage.encounter.status, now));
    }
    return patchOperations;
};
exports.handleEmptyEncounterStatusHistoryOp = handleEmptyEncounterStatusHistoryOp;
var changeStatusOp = function (newStatus) {
    return {
        op: 'replace',
        path: '/status',
        value: newStatus,
    };
};
exports.changeStatusOp = changeStatusOp;
var addStatusHistoryOp = function () {
    return {
        op: 'add',
        path: "/statusHistory",
        value: [],
    };
};
exports.addStatusHistoryOp = addStatusHistoryOp;
var addStatusHistoryRecordOp = function (statusHistoryIndex, status, startTime) {
    return {
        op: 'add',
        path: "/statusHistory/".concat(statusHistoryIndex),
        value: {
            status: status,
            period: {
                start: startTime,
            },
        },
    };
};
exports.addStatusHistoryRecordOp = addStatusHistoryRecordOp;
var addPeriodEndOp = function (time) {
    return {
        op: 'add',
        path: "/period",
        value: {
            end: time,
        },
    };
};
exports.addPeriodEndOp = addPeriodEndOp;
var deleteStatusHistoryRecordOp = function (statusHistoryIndex) {
    return {
        op: 'remove',
        path: "/statusHistory/".concat(statusHistoryIndex),
    };
};
exports.deleteStatusHistoryRecordOp = deleteStatusHistoryRecordOp;
var changeStatusRecordPeriodValueOp = function (statusHistoryIndex, periodElement, value) {
    return {
        op: 'add',
        path: "/statusHistory/".concat(statusHistoryIndex, "/period/").concat(periodElement),
        value: value,
    };
};
exports.changeStatusRecordPeriodValueOp = changeStatusRecordPeriodValueOp;
