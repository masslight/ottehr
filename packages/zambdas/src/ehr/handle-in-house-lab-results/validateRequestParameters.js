"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    // todo throw better errors here
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    var secrets = input.secrets;
    var _a = JSON.parse(input.body), serviceRequestId = _a.serviceRequestId, data = _a.data;
    var missingResources = [];
    if (!serviceRequestId)
        missingResources.push('serviceRequestID');
    if (!data)
        missingResources.push('data');
    if (missingResources.length) {
        // throw MISSING_REQUIRED_PARAMETERS(missingResources);
        throw new Error("missing resources: ".concat(missingResources.join(',')));
    }
    return { userToken: userToken, secrets: secrets, serviceRequestId: serviceRequestId, data: data };
}
