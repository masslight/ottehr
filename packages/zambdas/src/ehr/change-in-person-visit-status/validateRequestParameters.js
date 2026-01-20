"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var parsedBody = JSON.parse(input.body);
    // Safely unwrap and validate encounterId
    if (typeof parsedBody !== 'object' || parsedBody === null) {
        throw new Error('Request body must be a valid JSON object');
    }
    var bodyObj = parsedBody;
    var encounterId = bodyObj.encounterId, updatedStatus = bodyObj.updatedStatus;
    // Type-safe validation for encounterId
    if (typeof encounterId !== 'string') {
        throw new Error('Field "encounterId" is required and must be a string');
    }
    // Type-safe validation for updatedStatus
    if (typeof updatedStatus !== 'string') {
        throw new Error('Field "updatedStatus" is required and must be a string');
    }
    // Validate updatedStatus is a valid VisitStatusWithoutUnknown
    // Derive valid statuses from the Visit_Status_Array, excluding 'unknown'
    var validStatuses = utils_1.visitStatusArray.filter(function (status) { return status !== 'unknown'; });
    if (!validStatuses.includes(updatedStatus)) {
        throw new Error("Field \"updatedStatus\" must be one of: ".concat(validStatuses.join(', ')));
    }
    var typeSafeSecrets = input.secrets;
    if (typeSafeSecrets == null) {
        throw new Error('No secrets provided');
    }
    if ((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, input.secrets) === undefined) {
        throw new Error('"PROJECT_API" configuration not provided');
    }
    if ((0, utils_1.getSecret)(utils_1.SecretsKeys.ORGANIZATION_ID, input.secrets) === undefined) {
        throw new Error('"ORGANIZATION_ID" configuration not provided');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    if (!userToken) {
        throw new Error('No user token provided in Authorization header');
    }
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        encounterId: encounterId,
        userToken: userToken,
        updatedStatus: updatedStatus,
        secrets: typeSafeSecrets,
    };
}
