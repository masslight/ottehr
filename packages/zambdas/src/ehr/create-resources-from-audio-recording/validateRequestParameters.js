"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    var _a = JSON.parse(input.body), visitID = _a.visitID, duration = _a.duration, z3URL = _a.z3URL;
    if (!z3URL) {
        throw new Error('z3URL is required');
    }
    if (!z3URL.startsWith('https://project-api.zapehr.com')) {
        throw new Error('z3 url must start with https://project-api.zapehr.com');
    }
    if (!visitID) {
        throw new Error('visitID is required');
    }
    return {
        userToken: userToken,
        duration: duration,
        z3URL: z3URL,
        visitID: visitID,
        secrets: input.secrets,
    };
}
