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
    if (!input.headers.Authorization) {
        throw new Error('Authorization header is required');
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
    if (!userToken) {
        throw new Error('User token is required');
    }
    if (!secrets) {
        throw new Error('Secrets are required');
    }
    if (!params.encounterId) {
        throw new Error('Encounter ID is required');
    }
    if (!params.testItem || typeof params.testItem.name !== 'string') {
        throw new Error('Test item is required and testItem.name must be a string');
    }
    if (!params.cptCode || typeof params.cptCode !== 'string') {
        throw new Error('CPT code is required and must be a string');
    }
    if (!params.diagnosesAll || !Array.isArray(params.diagnosesAll)) {
        throw new Error('DiagnosesAll are required and must be an non-empty array');
    }
    if (!Array.isArray(params.diagnosesNew)) {
        throw new Error('Diagnoses are required and must be an array');
    }
    if (params.notes && typeof params.notes !== 'string') {
        throw new Error('Notes optional field, but if provided must be a string');
    }
    return __assign({ userToken: userToken, secrets: secrets }, params);
}
