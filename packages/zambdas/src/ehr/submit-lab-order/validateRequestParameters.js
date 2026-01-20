"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _a = JSON.parse(input.body), serviceRequestIDs = _a.serviceRequestIDs, manualOrder = _a.manualOrder;
    if (!serviceRequestIDs)
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['serviceRequestIDs']);
    if (serviceRequestIDs && !Object.values(serviceRequestIDs).every(function (srId) { return typeof srId === 'string'; })) {
        throw Error('Invalid parameter: all values passed to serviceRequestIDs must be strings');
    }
    if (typeof manualOrder !== 'boolean')
        throw Error('manualOrder is incorrect type, should be boolean');
    return {
        serviceRequestIDs: serviceRequestIDs,
        manualOrder: manualOrder,
        secrets: input.secrets,
    };
}
