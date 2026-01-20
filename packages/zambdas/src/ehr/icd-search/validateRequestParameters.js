"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), search = _a.search, sabs = _a.sabs, radiologyOnly = _a.radiologyOnly;
    if (radiologyOnly != undefined && typeof radiologyOnly !== 'boolean') {
        throw new Error('Invalid radiologyOnly parameter. It must be a boolean.');
    }
    return {
        search: search || '',
        sabs: sabs,
        radiologyOnly: radiologyOnly,
        secrets: input.secrets,
    };
}
