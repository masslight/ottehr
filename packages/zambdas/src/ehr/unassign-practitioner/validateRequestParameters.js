"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), encounterId = _a.encounterId, practitionerId = _a.practitionerId, userRole = _a.userRole;
    if (encounterId === undefined || practitionerId === undefined || userRole === undefined) {
        throw new Error('These fields are required: "encounterId" "practitionerId" "userRole".');
    }
    if ((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, input.secrets) === undefined) {
        throw new Error('"PROJECT_API" configuration not provided');
    }
    if ((0, utils_1.getSecret)(utils_1.SecretsKeys.ORGANIZATION_ID, input.secrets) === undefined) {
        throw new Error('"ORGANIZATION_ID" configuration not provided');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    if (!input.secrets) {
        throw new Error('No secrets provided');
    }
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        encounterId: encounterId,
        practitionerId: practitionerId,
        userRole: userRole,
        secrets: input.secrets,
        userToken: userToken,
    };
}
