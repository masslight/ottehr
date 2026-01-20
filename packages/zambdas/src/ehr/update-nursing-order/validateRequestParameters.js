"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    if (!input.headers.Authorization) {
        throw new Error('Authorization header is required');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    var parsed = JSON.parse(input.body);
    var _a = (0, shared_1.safeValidate)(utils_1.UpdateNursingOrderInputSchema, parsed), serviceRequestId = _a.serviceRequestId, action = _a.action;
    console.groupEnd();
    console.log('validateRequestParameters success');
    return {
        serviceRequestId: serviceRequestId,
        action: action,
        userToken: userToken,
        secrets: input.secrets,
    };
}
