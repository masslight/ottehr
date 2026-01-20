"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    var appointmentID = JSON.parse(input.body || '').appointmentID;
    return {
        appointmentID: appointmentID,
        secrets: input.secrets,
    };
}
