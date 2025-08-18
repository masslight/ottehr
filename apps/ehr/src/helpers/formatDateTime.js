"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATE_FORMAT = exports.OVERRIDE_DATE_FORMAT = void 0;
exports.formatHourNumber = formatHourNumber;
exports.formatDateUsingSlashes = formatDateUsingSlashes;
exports.datesCompareFn = datesCompareFn;
exports.formatISODateToLocaleDate = formatISODateToLocaleDate;
exports.formatISOStringToDateAndTime = formatISOStringToDateAndTime;
exports.getTimezone = getTimezone;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
exports.OVERRIDE_DATE_FORMAT = 'M/d/yyyy';
exports.DATE_FORMAT = 'MM/dd/yyyy';
function formatHourNumber(hour) {
    return luxon_1.DateTime.fromFormat(String(hour), 'h').toFormat('h a');
}
function formatDateUsingSlashes(date, timezone) {
    if (!date) {
        return date;
    }
    if (timezone) {
        return luxon_1.DateTime.fromISO(date).setZone(timezone).toFormat(exports.DATE_FORMAT);
    }
    else {
        return luxon_1.DateTime.fromISO(date).toFormat(exports.DATE_FORMAT);
    }
}
function datesCompareFn(format) {
    return function (d1, d2) {
        var seconds1 = luxon_1.DateTime.fromFormat(d1, format).toSeconds();
        var seconds2 = luxon_1.DateTime.fromFormat(d2, format).toSeconds();
        if (isNaN(seconds1) || isNaN(seconds2)) {
            return NaN;
        }
        return seconds1 - seconds2;
    };
}
function formatISODateToLocaleDate(date) {
    if (!date) {
        return date;
    }
    var dateTime = luxon_1.DateTime.fromISO(date);
    var formattedDate = dateTime.toFormat('LLL dd, yyyy');
    return formattedDate;
}
function formatISOStringToDateAndTime(isoString, timezone) {
    var dateTime = luxon_1.DateTime.fromISO(isoString);
    if (timezone) {
        dateTime = dateTime.setZone(timezone);
    }
    var formattedDateTime = dateTime.toFormat("".concat(exports.DATE_FORMAT, ", HH:mm"));
    return formattedDateTime;
}
function getTimezone(resource) {
    var _a, _b;
    var timezone = 'America/New_York';
    if (resource) {
        var timezoneTemp = (_b = (_a = resource.extension) === null || _a === void 0 ? void 0 : _a.find(function (extensionTemp) { return extensionTemp.url === utils_1.TIMEZONE_EXTENSION_URL; })) === null || _b === void 0 ? void 0 : _b.valueString;
        if (timezoneTemp)
            timezone = timezoneTemp;
    }
    return timezone;
}
//# sourceMappingURL=formatDateTime.js.map