"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickTexts = exports.APPT_STATUS_MAP = exports.TelemedAppointmentStatusToPalette = exports.extractReviewAndSignAppointmentData = exports.extractPhotoUrlsFromAppointmentData = exports.createRefreshableAppointmentData = exports.updateEncounterStatusHistory = exports.formatVideoTimerTime = exports.getAppointmentWaitingTime = exports.filterAppointments = exports.compareAppointments = exports.getAppointmentUnsignedLengthTime = exports.compareLuxonDates = exports.UnsignedFor = exports.ApptTabToStatus = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var diffInMinutes_1 = require("./diffInMinutes");
exports.ApptTabToStatus = (_a = {},
    _a[utils_1.ApptTelemedTab.ready] = [utils_1.TelemedAppointmentStatusEnum.ready],
    _a[utils_1.ApptTelemedTab.provider] = [utils_1.TelemedAppointmentStatusEnum['pre-video'], utils_1.TelemedAppointmentStatusEnum['on-video']],
    _a[utils_1.ApptTelemedTab['not-signed']] = [utils_1.TelemedAppointmentStatusEnum.unsigned],
    _a[utils_1.ApptTelemedTab.complete] = [utils_1.TelemedAppointmentStatusEnum.complete, utils_1.TelemedAppointmentStatusEnum.cancelled],
    _a);
var UnsignedFor;
(function (UnsignedFor) {
    UnsignedFor["under12"] = "under12";
    UnsignedFor["more24"] = "more24";
    UnsignedFor["all"] = "all";
})(UnsignedFor || (exports.UnsignedFor = UnsignedFor = {}));
var compareLuxonDates = function (a, b) { return a.toMillis() - b.toMillis(); };
exports.compareLuxonDates = compareLuxonDates;
var getAppointmentUnsignedLengthTime = function (history) {
    var lastHistoryRecord = history.at(-1);
    var currentTimeISO = new Date().toISOString();
    return (0, exports.compareLuxonDates)(luxon_1.DateTime.fromISO((lastHistoryRecord === null || lastHistoryRecord === void 0 ? void 0 : lastHistoryRecord.end) || currentTimeISO), luxon_1.DateTime.fromISO((lastHistoryRecord === null || lastHistoryRecord === void 0 ? void 0 : lastHistoryRecord.start) || currentTimeISO));
};
exports.getAppointmentUnsignedLengthTime = getAppointmentUnsignedLengthTime;
var compareAppointments = function (isNotSignedTab, appointmentA, appointmentB) {
    if (isNotSignedTab) {
        return ((0, exports.getAppointmentUnsignedLengthTime)(appointmentB.telemedStatusHistory) -
            (0, exports.getAppointmentUnsignedLengthTime)(appointmentA.telemedStatusHistory));
    }
    else {
        return (0, exports.compareLuxonDates)(luxon_1.DateTime.fromISO(appointmentA.start), luxon_1.DateTime.fromISO(appointmentB.start));
    }
};
exports.compareAppointments = compareAppointments;
var filterAppointments = function (appointments, unsignedFor, tab, showOnlyNext, availableStates) {
    var _a;
    if (![utils_1.ApptTelemedTab['not-signed'], utils_1.ApptTelemedTab.ready].includes(tab)) {
        return appointments;
    }
    if (tab === utils_1.ApptTelemedTab.ready) {
        if (showOnlyNext) {
            var oldest = (_a = appointments
                .filter(function (appointment) { return availableStates.includes(appointment.locationVirtual.state); })
                .sort(function (a, b) { return (0, exports.compareLuxonDates)(luxon_1.DateTime.fromISO(a.start), luxon_1.DateTime.fromISO(b.start)); })) === null || _a === void 0 ? void 0 : _a[0];
            return oldest ? [oldest] : [];
        }
        else {
            return appointments;
        }
    }
    var getUnsignedTime = function (history) {
        var unsigned = history.find(function (element) { return element.status === utils_1.TelemedAppointmentStatusEnum.unsigned; });
        if (!unsigned || !unsigned.start) {
            return luxon_1.DateTime.now().toISO();
        }
        return unsigned.start;
    };
    var now = luxon_1.DateTime.now();
    switch (unsignedFor) {
        case UnsignedFor.under12:
            return appointments.filter(function (appointment) { return luxon_1.DateTime.fromISO(getUnsignedTime(appointment.telemedStatusHistory)) > now.minus({ hours: 12 }); });
        case UnsignedFor.more24:
            return appointments.filter(function (appointment) { return luxon_1.DateTime.fromISO(getUnsignedTime(appointment.telemedStatusHistory)) <= now.minus({ hours: 24 }); });
        default:
            return appointments;
    }
};
exports.filterAppointments = filterAppointments;
var getAppointmentWaitingTime = function (statuses) {
    var _a;
    if (!statuses) {
        return '...';
    }
    var onVideoIndex = statuses === null || statuses === void 0 ? void 0 : statuses.findIndex(function (status) { return status.status === utils_1.TelemedAppointmentStatusEnum['on-video']; });
    var statusesToWait = onVideoIndex === -1 ? statuses : statuses.slice(0, onVideoIndex);
    var start = statusesToWait.at(0).start;
    var end = (_a = statusesToWait.at(-1)) === null || _a === void 0 ? void 0 : _a.end;
    return end
        ? (0, diffInMinutes_1.diffInMinutes)(luxon_1.DateTime.fromISO(end), luxon_1.DateTime.fromISO(start))
        : (0, diffInMinutes_1.diffInMinutes)(luxon_1.DateTime.now(), luxon_1.DateTime.fromISO(start));
};
exports.getAppointmentWaitingTime = getAppointmentWaitingTime;
var formatVideoTimerTime = function (difference) {
    var m = Math.abs(difference.minutes);
    var s = Math.floor(Math.abs(difference.seconds));
    var addZero = function (num) {
        return num < 10 ? "0".concat(num) : num.toString();
    };
    return "".concat(m, ":").concat(addZero(s));
};
exports.formatVideoTimerTime = formatVideoTimerTime;
var updateEncounterStatusHistory = function (newStatus, history) {
    var now = luxon_1.DateTime.now().toString();
    var newItem = { status: newStatus, period: { start: now } };
    if (!history || history.length === 0) {
        return [newItem];
    }
    history.at(-1).period.end = now;
    history.push(newItem);
    return history;
};
exports.updateEncounterStatusHistory = updateEncounterStatusHistory;
var createRefreshableAppointmentData = function (originalData) {
    var photoUrls = (0, exports.extractPhotoUrlsFromAppointmentData)(originalData);
    return { patientConditionPhotoUrls: photoUrls };
};
exports.createRefreshableAppointmentData = createRefreshableAppointmentData;
var extractPhotoUrlsFromAppointmentData = function (appointment) {
    return ((appointment === null || appointment === void 0 ? void 0 : appointment.filter(function (resource) {
        var _a, _b;
        return resource.resourceType === 'DocumentReference' &&
            resource.status === 'current' &&
            ((_b = (_a = resource.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code) === utils_1.PATIENT_PHOTO_CODE;
    }).flatMap(function (docRef) { return docRef.content.map(function (cnt) { return cnt.attachment.url; }); }).filter(Boolean)) || []);
};
exports.extractPhotoUrlsFromAppointmentData = extractPhotoUrlsFromAppointmentData;
var extractReviewAndSignAppointmentData = function (data) {
    var _a, _b;
    var appointment = data === null || data === void 0 ? void 0 : data.find(function (resource) { return resource.resourceType === 'Appointment'; });
    if (!appointment) {
        return;
    }
    var appointmentStatus = appointment.status;
    var encounter = data === null || data === void 0 ? void 0 : data.find(function (resource) { return resource.resourceType === 'Encounter'; });
    if (!encounter) {
        return;
    }
    var encounterStatusHistory = (_a = encounter.statusHistory) !== null && _a !== void 0 ? _a : [];
    var finishedHistoryEntry = encounterStatusHistory.find(function (historyElement) { return historyElement.status === 'finished'; });
    var finishedAtTime = (_b = finishedHistoryEntry === null || finishedHistoryEntry === void 0 ? void 0 : finishedHistoryEntry.period) === null || _b === void 0 ? void 0 : _b.end;
    var encounterStatus = finishedHistoryEntry === null || finishedHistoryEntry === void 0 ? void 0 : finishedHistoryEntry.status;
    if (!encounterStatus) {
        return;
    }
    var telemedAppointmentStatus = (0, utils_1.mapStatusToTelemed)(encounterStatus, appointmentStatus);
    return telemedAppointmentStatus === utils_1.TelemedAppointmentStatusEnum.complete
        ? { signedOnDate: finishedAtTime }
        : undefined;
};
exports.extractReviewAndSignAppointmentData = extractReviewAndSignAppointmentData;
exports.TelemedAppointmentStatusToPalette = {
    ready: {
        background: {
            primary: '#FFE0B2',
        },
        color: {
            primary: '#E65100',
        },
    },
    'pre-video': {
        background: {
            primary: '#B3E5FC',
        },
        color: {
            primary: '#01579B',
        },
    },
    'on-video': {
        background: {
            primary: '#D1C4E9',
        },
        color: {
            primary: '#311B92',
        },
    },
    unsigned: {
        background: {
            primary: '#FFCCBC',
        },
        color: {
            primary: '#BF360C',
        },
    },
    complete: {
        background: {
            primary: '#C8E6C9',
        },
        color: {
            primary: '#1B5E20',
        },
    },
    cancelled: {
        background: {
            primary: '#FFCCBC',
        },
        color: {
            primary: '#BF360C',
        },
    },
};
exports.APPT_STATUS_MAP = {
    ready: {
        background: {
            primary: '#FFE0B2',
        },
        color: {
            primary: '#E65100',
        },
    },
    'pre-video': {
        background: {
            primary: '#B3E5FC',
        },
        color: {
            primary: '#01579B',
        },
    },
    'on-video': {
        background: {
            primary: '#D1C4E9',
        },
        color: {
            primary: '#311B92',
        },
    },
    unsigned: {
        background: {
            primary: '#FFCCBC',
        },
        color: {
            primary: '#BF360C',
        },
    },
    complete: {
        background: {
            primary: '#C8E6C9',
        },
        color: {
            primary: '#1B5E20',
        },
    },
    cancelled: {
        background: {
            primary: '#FFCCBC',
        },
        color: {
            primary: '#BF360C',
        },
    },
};
exports.quickTexts = [
    "Hello from ".concat(utils_1.PROJECT_NAME, " Telemedicine. A provider will see you soon. Please have your child with you, seated & in a quiet room. Please be in an area where you have strong wifi connection sufficient for video use. Have your video turned on. Questions? Call <phone>202-555-1212</phone>"),
    "Hello from ".concat(utils_1.PROJECT_NAME, " Telemedicine. Due to high volumes our providers are busier than usual. A provider will message you when they have an update or are ready to see you. We apologize for the delay. Questions? Call <phone>202-555-1212</phone>"),
    "Hello from ".concat(utils_1.PROJECT_NAME, " Telemedicine. We tried connecting, you seem to be having trouble connecting. If you still want a visit, log out then log back in. Click \u201CReturn to call\u201D and we will connect with you in 5-10 minutes. If you are still having trouble, call <phone>202-555-1212</phone>"),
    "Hello from ".concat(utils_1.PROJECT_NAME, " Telemedicine. We are sorry you canceled your visit. If accidental, please request a new visit. We will be sure to see you. If you are experiencing technical difficulties, call <phone>202-555-1212</phone>"),
];
//# sourceMappingURL=appointments.js.map