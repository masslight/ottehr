"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var parsedJSON = JSON.parse(input.body);
    // Safely extract and validate encounterId
    if (!parsedJSON || typeof parsedJSON !== 'object') {
        throw new Error('Request body must be a valid JSON object');
    }
    var body = parsedJSON;
    if (typeof body.encounterId !== 'string') {
        throw new Error('encounterId must be a string');
    }
    var encounterId = body.encounterId;
    // Validate practitioner - check for required Practitioner properties
    if (!body.practitionerId || typeof body.practitionerId !== 'string') {
        throw new Error('practitionerId must be a string');
    }
    var practitionerId = body.practitionerId;
    // Validate userRole - should be an array of Coding objects
    if (!Array.isArray(body.userRole)) {
        throw new Error('userRole must be an array of Coding objects');
    }
    var userRole = body.userRole;
    // Validate each item in userRole array is a valid Coding object
    for (var i = 0; i < userRole.length; i++) {
        var coding = userRole[i];
        if (!coding || typeof coding !== 'object') {
            throw new Error("userRole[".concat(i, "] must be a valid Coding object"));
        }
        var codingObj = coding;
        if (codingObj.code != undefined && typeof codingObj.code !== 'string') {
            throw new Error("userRole[".concat(i, "].code must be a string if provided"));
        }
        if (codingObj.display !== undefined && typeof codingObj.display !== 'string') {
            throw new Error("userRole[".concat(i, "].display must be a string if provided"));
        }
        if (codingObj.system !== undefined && typeof codingObj.system !== 'string') {
            throw new Error("userRole[".concat(i, "].system must be a string if provided"));
        }
    }
    var validatedUserRole = userRole;
    if (encounterId === undefined || practitionerId === undefined || validatedUserRole === undefined) {
        throw new Error('These fields are required: "encounterId" "practitionerId" "userRole".');
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
        encounterId: encounterId,
        practitionerId: practitionerId,
        userRole: validatedUserRole,
        secrets: input.secrets,
        userToken: userToken,
    };
}
