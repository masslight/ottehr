"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var visitID = JSON.parse(input.body).visitID;
    if (!visitID) {
        throw new Error('visitID is required');
    }
    return {
        visitID: visitID,
        secrets: input.secrets,
    };
}
