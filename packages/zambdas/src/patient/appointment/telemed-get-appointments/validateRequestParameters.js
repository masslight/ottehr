"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    var patientId = (input.body ? JSON.parse(input.body) : { patientId: undefined }).patientId;
    return {
        patientId: patientId,
        secrets: input.secrets,
    };
}
