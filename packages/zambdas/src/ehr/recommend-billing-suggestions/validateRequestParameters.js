"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), diagnoses = _a.diagnoses, billing = _a.billing;
    return {
        diagnoses: diagnoses,
        billing: billing,
        secrets: input.secrets,
    };
}
