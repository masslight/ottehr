"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinLocationsIdsForFhirSearch = exports.getLocationIdFromAppointment = exports.getAppointmentWaitingTime = exports.getPhoneNumberFromQuestionnaire = void 0;
exports.telemedStatusToAppointment = telemedStatusToAppointment;
var helpers_1 = require("../../../shared/appointment/helpers");
var getPhoneNumberFromQuestionnaire = function (questionnaire) {
    var _a, _b;
    var items = questionnaire.item;
    if (items) {
        var phoneNumberItem = items.find(function (item) {
            return item.linkId === 'guardian-number';
        });
        return (_b = (_a = phoneNumberItem === null || phoneNumberItem === void 0 ? void 0 : phoneNumberItem.answer) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.valueString;
    }
    return undefined;
};
exports.getPhoneNumberFromQuestionnaire = getPhoneNumberFromQuestionnaire;
var getAppointmentWaitingTime = function (appointment) {
    var rawDate = appointment.created;
    if (rawDate) {
        var apptDate = new Date(rawDate);
        var timeDifference = Math.abs(new Date().getTime() - apptDate.getTime());
        return timeDifference;
    }
    return undefined;
};
exports.getAppointmentWaitingTime = getAppointmentWaitingTime;
var getLocationIdFromAppointment = function (appointment) {
    var _a;
    var locationParticipant = appointment.participant.find(function (appointment) { var _a, _b; return (_b = (_a = appointment.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Location/'); });
    var locationId = ((_a = locationParticipant === null || locationParticipant === void 0 ? void 0 : locationParticipant.actor) === null || _a === void 0 ? void 0 : _a.reference) || '';
    return (0, helpers_1.removePrefix)('Location/', locationId);
};
exports.getLocationIdFromAppointment = getLocationIdFromAppointment;
var joinLocationsIdsForFhirSearch = function (locationsIds) {
    return locationsIds.map(function (locationId) { return 'Location/' + locationId; }).join(',');
};
exports.joinLocationsIdsForFhirSearch = joinLocationsIdsForFhirSearch;
function telemedStatusToAppointment(telemedStatus) {
    switch (telemedStatus) {
        case 'ready':
            return 'arrived';
        case 'pre-video':
            return 'arrived';
        case 'on-video':
            return 'arrived';
        case 'unsigned':
            return 'arrived';
        case 'complete':
            return 'fulfilled';
        case 'cancelled':
            return 'cancelled';
    }
}
