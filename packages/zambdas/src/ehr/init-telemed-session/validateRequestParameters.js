"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), appointmentId = _a.appointmentId, userId = _a.userId;
    if (appointmentId === undefined) {
        throw new Error('These fields are required: "appointmentId"');
    }
    if (userId === undefined) {
        throw new Error('These fields are required: "userName"');
    }
    return {
        appointmentId: appointmentId,
        userId: userId,
        secrets: input.secrets,
    };
}
