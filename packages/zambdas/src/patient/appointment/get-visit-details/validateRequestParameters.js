"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var appointmentId = JSON.parse(input.body).appointmentId;
    if (!appointmentId) {
        throw new Error('appointmentID is not defined');
    }
    return {
        appointmentId: appointmentId,
        secrets: input.secrets,
    };
}
