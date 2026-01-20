"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), appointmentID = _a.appointmentID, dateOfBirth = _a.dateOfBirth;
    if (!appointmentID) {
        throw new Error('appointmentID is not defined');
    }
    var authorization = input.headers.Authorization;
    return {
        appointmentID: appointmentID,
        dateOfBirth: dateOfBirth,
        secrets: input.secrets,
        authorization: authorization,
    };
}
