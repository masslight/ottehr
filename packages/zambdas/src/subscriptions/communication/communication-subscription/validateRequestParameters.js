"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var communication = JSON.parse(input.body);
    if (communication.resourceType !== 'Communication') {
        throw new Error("resource parsed should be a communication but was a ".concat(communication.resourceType));
    }
    return {
        communication: communication,
        secrets: input.secrets,
    };
}
