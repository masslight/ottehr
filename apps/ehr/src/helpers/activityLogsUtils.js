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
exports.CRITICAL_CHANGE_SYSTEM = exports.getCriticalUpdateTagOp = exports.formatNotesHistory = exports.formatActivityDateTime = exports.sortLogs = exports.formatPaperworkStartedLog = exports.formatActivityLogs = exports.getAppointmentAndPatientHistory = exports.cleanUpStaffHistoryTag = exports.ActivityName = void 0;
var json_diff_ts_1 = require("json-diff-ts");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
Object.defineProperty(exports, "CRITICAL_CHANGE_SYSTEM", { enumerable: true, get: function () { return utils_1.CRITICAL_CHANGE_SYSTEM; } });
Object.defineProperty(exports, "getCriticalUpdateTagOp", { enumerable: true, get: function () { return utils_1.getCriticalUpdateTagOp; } });
var constants_1 = require("../constants");
var types_1 = require("../types/types");
var formatDateTime_1 = require("./formatDateTime");
var CREATED_BY_SYSTEM = 'created-by'; // exists in intake as well
var ActivityName;
(function (ActivityName) {
    ActivityName["apptCreation"] = "Visit Creation";
    ActivityName["nameChange"] = "Name Update";
    ActivityName["dobChange"] = "Date of Birth Update";
    ActivityName["movedToNext"] = "Moved to next in queue";
    ActivityName["paperworkStarted"] = "Paperwork started";
    ActivityName["statusChange"] = "Status Update";
})(ActivityName || (exports.ActivityName = ActivityName = {}));
var cleanUpStaffHistoryTag = function (resource, field) {
    var _a, _b;
    // going forward we will be using the history of the patient resource so this isn't needed
    // check if there is a tag to clean up
    var staffHistoryTagIdx = (_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.findIndex(function (tag) { return tag.system === "staff-update-history-".concat(field); });
    if (staffHistoryTagIdx !== undefined && staffHistoryTagIdx >= 0) {
        return {
            op: 'remove',
            path: "/meta/tag/".concat(staffHistoryTagIdx),
        };
    }
    else {
        return;
    }
};
exports.cleanUpStaffHistoryTag = cleanUpStaffHistoryTag;
var getAppointmentAndPatientHistory = function (appointment, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentId, patientId, bundle, patientHistory, appointmentHistory, _i, _a, entry, innerBundle, innerEntries, _b, innerEntries_1, item, resource, fhirAppointment, fhirPatient;
    var _c, _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                if (!appointment || !oystehr)
                    return [2 /*return*/];
                appointmentId = appointment === null || appointment === void 0 ? void 0 : appointment.id;
                patientId = (_e = (_d = (_c = appointment === null || appointment === void 0 ? void 0 : appointment.participant.find(function (appt) { var _a, _b; return (_b = (_a = appt.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); })) === null || _c === void 0 ? void 0 : _c.actor) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.replace('Patient/', '');
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: [
                            {
                                method: 'GET',
                                url: "/Appointment/".concat(appointmentId, "/_history"),
                            },
                            {
                                method: 'GET',
                                url: "/Patient/".concat(patientId, "/_history"),
                            },
                        ],
                    })];
            case 1:
                bundle = _h.sent();
                patientHistory = [];
                appointmentHistory = [];
                if (bundle.entry) {
                    for (_i = 0, _a = bundle.entry; _i < _a.length; _i++) {
                        entry = _a[_i];
                        if (((_g = (_f = entry.response) === null || _f === void 0 ? void 0 : _f.outcome) === null || _g === void 0 ? void 0 : _g.id) === 'ok' && entry.resource && entry.resource.resourceType === 'Bundle') {
                            innerBundle = entry.resource;
                            innerEntries = innerBundle.entry;
                            if (innerEntries) {
                                for (_b = 0, innerEntries_1 = innerEntries; _b < innerEntries_1.length; _b++) {
                                    item = innerEntries_1[_b];
                                    resource = item.resource;
                                    if (resource) {
                                        if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Appointment') {
                                            fhirAppointment = resource;
                                            appointmentHistory.push(fhirAppointment);
                                        }
                                        if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Patient') {
                                            fhirPatient = resource;
                                            patientHistory.push(fhirPatient);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                return [2 /*return*/, { patientHistory: patientHistory, appointmentHistory: appointmentHistory }];
        }
    });
}); };
exports.getAppointmentAndPatientHistory = getAppointmentAndPatientHistory;
var formatActivityLogs = function (appointment, appointmentHistory, patientHistory, paperworkStartedFlag, timezone) {
    var _a, _b, _c, _d;
    var logs = [];
    var _loop_1 = function (i) {
        var curPatientHistory = patientHistory[i];
        var previousPatientHistory = patientHistory[i + 1];
        var activityBy;
        // console.log(`checking ${curPatientHistory?.meta?.versionId} against ${previousPatientHistory?.meta?.versionId}`);
        var diffs = (0, json_diff_ts_1.diff)(previousPatientHistory, curPatientHistory, { embeddedObjKeys: { 'meta.tag': 'system' } });
        // check diffs for critical updates (ie updates that need to be surfaced in change logs)
        diffs.forEach(function (diff) {
            var _a, _b, _c, _d;
            // make sure that a critical update by tag was added with this change
            // the display may be the same but the version should always be different if it was "new" for the change
            // this ensures that we aren't assuming anything about who made the update
            if (diff.key === 'meta') {
                var criticalUpdateMadeBy = getCriticalUpdateMadeBy(diff, curPatientHistory);
                if (criticalUpdateMadeBy)
                    activityBy = criticalUpdateMadeBy;
            }
            if (diff.key === 'name') {
                var nameChangeActivityLog = {
                    activityName: ActivityName.nameChange,
                    activityDateTimeISO: (_a = curPatientHistory.meta) === null || _a === void 0 ? void 0 : _a.lastUpdated,
                    activityDateTime: (0, exports.formatActivityDateTime)(((_b = curPatientHistory.meta) === null || _b === void 0 ? void 0 : _b.lastUpdated) || '', timezone),
                    activityBy: activityBy ? activityBy : 'n/a',
                    moreDetails: {
                        valueBefore: (0, utils_1.getFullName)(previousPatientHistory),
                        valueAfter: (0, utils_1.getFullName)(curPatientHistory),
                    },
                };
                logs.push(nameChangeActivityLog);
            }
            if (diff.key === 'birthDate') {
                var dobChangeActivityLog = {
                    activityName: ActivityName.dobChange,
                    activityDateTimeISO: (_c = curPatientHistory.meta) === null || _c === void 0 ? void 0 : _c.lastUpdated,
                    activityDateTime: (0, exports.formatActivityDateTime)(((_d = curPatientHistory.meta) === null || _d === void 0 ? void 0 : _d.lastUpdated) || '', timezone),
                    activityBy: activityBy ? activityBy : 'n/a',
                    moreDetails: {
                        valueBefore: (0, formatDateTime_1.formatDateUsingSlashes)(previousPatientHistory.birthDate) || '',
                        valueAfter: (0, formatDateTime_1.formatDateUsingSlashes)(curPatientHistory.birthDate) || '',
                    },
                };
                logs.push(dobChangeActivityLog);
            }
        });
    };
    // check each patient history object against the previous for diffs
    for (var i = 0; i < patientHistory.length - 1; i++) {
        _loop_1(i);
    }
    var _loop_2 = function (i) {
        var curApptHistory = appointmentHistory[i];
        var previousApptHistory = appointmentHistory[i + 1];
        var activityBy;
        var diffs = (0, json_diff_ts_1.diff)(previousApptHistory, curApptHistory, { embeddedObjKeys: { 'meta.tag': 'system' } });
        // check diffs for critical updates (ie updates that need to be surfaced in change logs)
        diffs.forEach(function (diff) {
            var _a, _b, _c, _d, _e, _f;
            // make sure that a critical update by tag was added with this change
            // the display may be the same but the version should always be different if it was "new" for the change
            // this ensures that we aren't assuming anything about who made the update
            if (diff.key === 'meta') {
                var criticalUpdateMadeBy = getCriticalUpdateMadeBy(diff, curApptHistory);
                if (criticalUpdateMadeBy)
                    activityBy = criticalUpdateMadeBy;
                var tagChanges = (_b = (_a = diff.changes) === null || _a === void 0 ? void 0 : _a.find(function (change) { return change.key === 'tag'; })) === null || _b === void 0 ? void 0 : _b.changes;
                if (tagChanges) {
                    var movedToNext = tagChanges.find(function (change) { return change.key === constants_1.HOP_QUEUE_URI; });
                    if (movedToNext) {
                        var movedToNextLog = {
                            activityName: ActivityName.movedToNext,
                            activityDateTimeISO: (_c = curApptHistory.meta) === null || _c === void 0 ? void 0 : _c.lastUpdated,
                            activityDateTime: (0, exports.formatActivityDateTime)(((_d = curApptHistory.meta) === null || _d === void 0 ? void 0 : _d.lastUpdated) || '', timezone),
                            activityBy: activityBy ? activityBy : 'n/a',
                        };
                        logs.push(movedToNextLog);
                    }
                    var statusUpdate = tagChanges.find(function (change) { return change.key === utils_1.STATUS_UPDATE_TAG_SYSTEM; }); // todo update to const
                    if (statusUpdate) {
                        var statusUpdateLog = {
                            activityName: ActivityName.statusChange,
                            activityNameSupplement: getStatusToDisplay(statusUpdate),
                            activityDateTimeISO: (_e = curApptHistory.meta) === null || _e === void 0 ? void 0 : _e.lastUpdated,
                            activityDateTime: (0, exports.formatActivityDateTime)(((_f = curApptHistory.meta) === null || _f === void 0 ? void 0 : _f.lastUpdated) || '', timezone),
                            activityBy: activityBy ? activityBy : 'n/a',
                        };
                        logs.push(statusUpdateLog);
                    }
                }
            }
        });
    };
    // check each appointment history object against the previous for diffs
    for (var i = 0; i < appointmentHistory.length - 1; i++) {
        _loop_2(i);
    }
    if (paperworkStartedFlag) {
        var paperworkStartedActivityLog = (0, exports.formatPaperworkStartedLog)(paperworkStartedFlag, timezone);
        logs.push(paperworkStartedActivityLog);
    }
    var appointmentVisitType = (_a = appointment.appointmentType) === null || _a === void 0 ? void 0 : _a.text;
    logs.push({
        activityName: ActivityName.apptCreation,
        activityNameSupplement: appointmentVisitType
            ? types_1.appointmentTypeLabels[appointmentVisitType]
            : '',
        activityDateTimeISO: appointment === null || appointment === void 0 ? void 0 : appointment.created,
        activityDateTime: (0, exports.formatActivityDateTime)((appointment === null || appointment === void 0 ? void 0 : appointment.created) || '', timezone),
        activityBy: ((_d = (_c = (_b = appointment.meta) === null || _b === void 0 ? void 0 : _b.tag) === null || _c === void 0 ? void 0 : _c.find(function (tag) { return tag.system === CREATED_BY_SYSTEM; })) === null || _d === void 0 ? void 0 : _d.display) || 'n/a',
    });
    return (0, exports.sortLogs)(logs);
};
exports.formatActivityLogs = formatActivityLogs;
var formatPaperworkStartedLog = function (paperworkStartedFlag, timezone) {
    var _a, _b;
    var createdTag = (_b = (_a = paperworkStartedFlag.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return (tag === null || tag === void 0 ? void 0 : tag.system) === 'created-date-time'; });
    var activityDateTimeISO = createdTag === null || createdTag === void 0 ? void 0 : createdTag.version;
    var activityDateTime = (0, exports.formatActivityDateTime)(activityDateTimeISO || '', timezone);
    var activityBy = (createdTag === null || createdTag === void 0 ? void 0 : createdTag.display) || 'n/a';
    var paperworkStartedActivityLog = {
        activityName: ActivityName.paperworkStarted,
        activityDateTimeISO: activityDateTimeISO,
        activityDateTime: activityDateTime,
        activityBy: activityBy,
    };
    return paperworkStartedActivityLog;
};
exports.formatPaperworkStartedLog = formatPaperworkStartedLog;
var sortLogs = function (logs) {
    return logs.sort(function (a, b) {
        var dateA = luxon_1.DateTime.fromISO(a.activityDateTimeISO || '');
        var dateB = luxon_1.DateTime.fromISO(b.activityDateTimeISO || '');
        return dateB.diff(dateA, 'milliseconds').milliseconds;
    });
};
exports.sortLogs = sortLogs;
var getCriticalUpdateMadeBy = function (diff, resource) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var activityBy;
    var tagChange = (_a = diff.changes) === null || _a === void 0 ? void 0 : _a.find(function (d) { return d.key === 'tag'; });
    if ((tagChange === null || tagChange === void 0 ? void 0 : tagChange.type) === 'UPDATE') {
        var criticalUpdateBy = (_b = tagChange.changes) === null || _b === void 0 ? void 0 : _b.find(function (change) { return change.key === utils_1.CRITICAL_CHANGE_SYSTEM; });
        if ((criticalUpdateBy === null || criticalUpdateBy === void 0 ? void 0 : criticalUpdateBy.type) === 'UPDATE') {
            var criticalUpdateByVersion = (_d = (_c = criticalUpdateBy.changes) === null || _c === void 0 ? void 0 : _c.find(function (change) { return change.key === 'version'; })) === null || _d === void 0 ? void 0 : _d.value;
            if (criticalUpdateByVersion)
                activityBy = (_g = (_f = (_e = resource.meta) === null || _e === void 0 ? void 0 : _e.tag) === null || _f === void 0 ? void 0 : _f.find(function (tag) { return tag.system === utils_1.CRITICAL_CHANGE_SYSTEM; })) === null || _g === void 0 ? void 0 : _g.display;
        }
        if ((criticalUpdateBy === null || criticalUpdateBy === void 0 ? void 0 : criticalUpdateBy.type) === 'ADD') {
            var criticalUpdateByCoding = criticalUpdateBy.value;
            activityBy = criticalUpdateByCoding === null || criticalUpdateByCoding === void 0 ? void 0 : criticalUpdateByCoding.display;
        }
    }
    if ((tagChange === null || tagChange === void 0 ? void 0 : tagChange.type) === 'ADD') {
        var criticalUpdateBy = (_h = tagChange.value) === null || _h === void 0 ? void 0 : _h.find(function (value) { return value.system === utils_1.CRITICAL_CHANGE_SYSTEM; });
        if (criticalUpdateBy) {
            var criticalUpdateByCoding = criticalUpdateBy;
            activityBy = criticalUpdateByCoding === null || criticalUpdateByCoding === void 0 ? void 0 : criticalUpdateByCoding.display;
        }
    }
    return activityBy;
};
var getStatusToDisplay = function (diff) {
    var _a, _b, _c;
    var display = '';
    if ((diff === null || diff === void 0 ? void 0 : diff.type) === 'UPDATE') {
        display = ((_b = (_a = diff.changes) === null || _a === void 0 ? void 0 : _a.find(function (change) { return change.key === 'display'; })) === null || _b === void 0 ? void 0 : _b.value) || '';
    }
    if ((diff === null || diff === void 0 ? void 0 : diff.type) === 'ADD') {
        display = ((_c = diff === null || diff === void 0 ? void 0 : diff.value) === null || _c === void 0 ? void 0 : _c.display) || '';
    }
    return display;
};
var formatActivityDateTime = function (dateTime, timezone) {
    var date = luxon_1.DateTime.fromISO(dateTime).setZone(timezone);
    var dateFormatted = (0, formatDateTime_1.formatDateUsingSlashes)(date.toISO() || '');
    var timeFormatted = date.toLocaleString(luxon_1.DateTime.TIME_SIMPLE);
    var timezoneShort = date.offsetNameShort;
    return "".concat(dateFormatted, " ").concat(timeFormatted, " ").concat(timezoneShort !== null && timezoneShort !== void 0 ? timezoneShort : '');
};
exports.formatActivityDateTime = formatActivityDateTime;
var formatNotesHistory = function (timezone, appointmentHistory) {
    var notes = [];
    var _loop_3 = function (i) {
        var curApptHistory = appointmentHistory[i];
        var previousApptHistory = appointmentHistory[i + 1];
        var activityBy;
        var diffs = (0, json_diff_ts_1.diff)(previousApptHistory, curApptHistory, { embeddedObjKeys: { 'meta.tag': 'system' } });
        // check diffs for critical updates (ie updates that need to be surfaced in change logs)
        diffs.forEach(function (diff) {
            var _a;
            // make sure that a critical update by tag was added with this change
            // the display may be the same but the version should always be different if it was "new" for the change
            // this ensures that we aren't assuming anything about who made the update
            if (diff.key === 'meta') {
                var criticalUpdateMadeBy = getCriticalUpdateMadeBy(diff, curApptHistory);
                if (criticalUpdateMadeBy)
                    activityBy = criticalUpdateMadeBy;
            }
            if (diff.key === 'comment') {
                var noteVal = diff.value;
                if (diff.type === 'REMOVE') {
                    noteVal = '';
                }
                var dtAdded = (0, exports.formatActivityDateTime)(((_a = curApptHistory.meta) === null || _a === void 0 ? void 0 : _a.lastUpdated) || '', timezone);
                var note = {
                    note: noteVal,
                    noteAddedByAndWhen: "".concat(dtAdded, " By ").concat(activityBy),
                };
                notes.push(note);
            }
        });
    };
    for (var i = 0; i < appointmentHistory.length - 1; i++) {
        _loop_3(i);
    }
    return notes;
};
exports.formatNotesHistory = formatNotesHistory;
//# sourceMappingURL=activityLogsUtils.js.map