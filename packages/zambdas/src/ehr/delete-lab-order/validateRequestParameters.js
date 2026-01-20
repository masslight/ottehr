"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    var serviceRequestId = JSON.parse(input.body).serviceRequestId;
    if (!serviceRequestId) {
        throw new Error('missing required parameter: serviceRequestId');
    }
    if (!input.secrets) {
        throw new Error('missing secrets');
    }
    return {
        serviceRequestId: serviceRequestId,
        secrets: input.secrets,
        userToken: userToken,
    };
}
