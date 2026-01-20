"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), encounterId = _a.encounterId, requestedFields = _a.requestedFields;
    if (encounterId === undefined) {
        throw new Error('These fields are required: "encounterId"');
    }
    return {
        encounterId: encounterId,
        secrets: input.secrets,
        requestedFields: requestedFields,
    };
}
