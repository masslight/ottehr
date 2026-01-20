"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    var secrets = input.secrets;
    var params;
    try {
        params = JSON.parse(input.body);
    }
    catch (_a) {
        throw Error('Invalid JSON in request body');
    }
    if (!params.serviceRequestId) {
        throw new Error('Service request ID is required');
    }
    return __assign({ userToken: userToken, secrets: secrets }, params);
}
