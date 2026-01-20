"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function isTelemedAppointmentStatus(value) {
    return typeof value === 'string' && utils_1.TelemedCallStatusesArr.includes(value);
}
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var parsedBody;
    try {
        parsedBody = JSON.parse(input.body);
    }
    catch (_a) {
        throw new Error('Invalid JSON in request body');
    }
    if (!parsedBody || typeof parsedBody !== 'object') {
        throw new Error('Request body must be a valid JSON object');
    }
    var body = parsedBody;
    var appointmentId = body.appointmentId, newStatus = body.newStatus;
    if (typeof appointmentId !== 'string') {
        throw new Error('These fields are required: "appointmentId".');
    }
    if (typeof newStatus !== 'string') {
        throw new Error('These fields are required: "newStatus".');
    }
    if (!isTelemedAppointmentStatus(newStatus)) {
        throw new Error('"newStatus" field value is not TelemedCallStatuses type.');
    }
    if ((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, input.secrets) === undefined) {
        throw new Error('"PROJECT_API" configuration not provided');
    }
    if ((0, utils_1.getSecret)(utils_1.SecretsKeys.ORGANIZATION_ID, input.secrets) === undefined) {
        throw new Error('"ORGANIZATION_ID" configuration not provided');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        appointmentId: appointmentId,
        newStatus: newStatus,
        secrets: input.secrets,
        userToken: userToken,
    };
}
