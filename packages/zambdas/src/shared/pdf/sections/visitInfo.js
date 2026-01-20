"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVisitInfoSection = exports.composeVisitData = exports.validateVisitData = void 0;
var utils_1 = require("utils");
var validateVisitData = function (appointment) {
    if (!(appointment === null || appointment === void 0 ? void 0 : appointment.id)) {
        throw new Error('Visit ID is required');
    }
};
exports.validateVisitData = validateVisitData;
var composeVisitData = function (_a) {
    var _b, _c, _d;
    var appointment = _a.appointment, location = _a.location, timezone = _a.timezone;
    var type = (0, utils_1.getAppointmentType)(appointment).type;
    var _e = (_b = (0, utils_1.formatDateToMDYWithTime)(appointment === null || appointment === void 0 ? void 0 : appointment.start, timezone !== null && timezone !== void 0 ? timezone : 'America/New_York')) !== null && _b !== void 0 ? _b : {}, _f = _e.date, date = _f === void 0 ? '' : _f, _g = _e.time, time = _g === void 0 ? '' : _g;
    var locationName = (_c = location === null || location === void 0 ? void 0 : location.name) !== null && _c !== void 0 ? _c : '';
    var reasonForVisit = (_d = appointment === null || appointment === void 0 ? void 0 : appointment.description) !== null && _d !== void 0 ? _d : '';
    return { type: type, time: time, date: date, location: locationName, reasonForVisit: reasonForVisit };
};
exports.composeVisitData = composeVisitData;
var createVisitInfoSection = function () { return ({
    dataSelector: function (data) { return data.visit; },
    shouldRender: function (visitInfo) { return !!(visitInfo === null || visitInfo === void 0 ? void 0 : visitInfo.type); },
    render: function (client, visitInfo, styles) {
        var _a;
        client.drawText("".concat(visitInfo.type, " | ").concat(visitInfo.time, " | ").concat(visitInfo.date), styles.textStyles.regular);
        client.drawText((_a = visitInfo.location) !== null && _a !== void 0 ? _a : '', styles.textStyles.regular);
    },
}); };
exports.createVisitInfoSection = createVisitInfoSection;
