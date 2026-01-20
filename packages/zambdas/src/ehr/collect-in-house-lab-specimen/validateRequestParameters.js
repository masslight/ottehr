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
    if (!params.encounterId) {
        throw new Error('encounterId is required');
    }
    if (!params.serviceRequestId) {
        throw new Error('serviceRequestId is required');
    }
    if (!params.data) {
        throw new Error('data is required');
    }
    if (!params.data.specimen) {
        throw new Error('specimen is required');
    }
    if (!params.data.specimen.source) {
        throw new Error('specimen.source is required');
    }
    if (!params.data.specimen.collectedBy) {
        throw new Error('specimen.collectedBy is required');
    }
    if (!('id' in params.data.specimen.collectedBy)) {
        throw new Error('specimen.collectedBy.id is required');
    }
    if (!('name' in params.data.specimen.collectedBy)) {
        throw new Error('specimen.collectedBy.name is required');
    }
    if (!params.data.specimen.collectionDate) {
        throw new Error('specimen.collectionDate is required');
    }
    return __assign(__assign({}, params), { secrets: secrets, userToken: userToken });
}
