"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var appointmentId = JSON.parse(input.body).appointmentId;
    // Check existence of necessary fields
    if (appointmentId === undefined) {
        throw new Error('appointment field is required');
    }
    if (!input.secrets) {
        throw new Error('secrets were not available');
    }
    return { appointmentId: appointmentId, secrets: input.secrets };
}
