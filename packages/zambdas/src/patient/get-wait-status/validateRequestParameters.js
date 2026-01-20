"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var appointmentID = JSON.parse(input.body).appointmentID;
    if (!appointmentID) {
        throw new Error('appointmentID is not defined');
    }
    var authorization = input.headers.Authorization;
    return {
        appointmentID: appointmentID,
        secrets: input.secrets,
        authorization: authorization,
    };
}
