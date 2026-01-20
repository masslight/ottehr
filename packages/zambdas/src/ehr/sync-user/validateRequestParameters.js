"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        secrets: input.secrets,
    };
}
