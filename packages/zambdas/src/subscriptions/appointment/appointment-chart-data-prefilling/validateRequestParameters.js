"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var appointment = JSON.parse(input.body);
    if (appointment.resourceType !== 'Appointment') {
        throw new Error("resource parsed should be an appointment but was a ".concat(appointment.resourceType));
    }
    return {
        appointment: appointment,
        secrets: input.secrets,
    };
}
