"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
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
    var appointmentId = body.appointmentId, encounterId = body.encounterId, timezone = body.timezone;
    if (appointmentId === undefined) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['appointmentId']);
    }
    else if (typeof appointmentId !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)("Invalid \"appointmentId\" parameter provided: ".concat(JSON.stringify(appointmentId), ". It must be a string."));
    }
    if (encounterId === undefined) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['encounterId']);
    }
    else if (typeof encounterId !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)("Invalid \"encounterId\" parameter provided: ".concat(JSON.stringify(encounterId), ". It must be a string."));
    }
    if ((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, input.secrets) === undefined) {
        throw new Error('"PROJECT_API" configuration not provided');
    }
    if ((0, utils_1.getSecret)(utils_1.SecretsKeys.ORGANIZATION_ID, input.secrets) === undefined) {
        throw new Error('"ORGANIZATION_ID" configuration not provided');
    }
    if (timezone != undefined && typeof timezone !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)("Invalid \"timezone\" parameter provided: ".concat(JSON.stringify(timezone), ". It must be a string or null."));
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    if (!input.secrets) {
        throw new Error('Secrets are required for this operation');
    }
    var supervisorApprovalEnabled = typeof body.supervisorApprovalEnabled === 'boolean' ? body.supervisorApprovalEnabled : false;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        appointmentId: appointmentId,
        encounterId: encounterId,
        secrets: input.secrets,
        timezone: timezone !== null && timezone !== void 0 ? timezone : null,
        userToken: userToken,
        supervisorApprovalEnabled: supervisorApprovalEnabled,
    };
}
