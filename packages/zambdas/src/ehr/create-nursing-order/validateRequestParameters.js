"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
function validateRequestParameters(input) {
    var _a;
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    if (!((_a = input.headers) === null || _a === void 0 ? void 0 : _a.Authorization)) {
        throw new Error('Authorization header is required');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    var parsedJSON = JSON.parse(input.body);
    var _b = (0, shared_1.safeValidate)(utils_1.CreateNursingOrderInputSchema, parsedJSON), encounterId = _b.encounterId, notes = _b.notes;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        encounterId: encounterId,
        notes: notes,
        secrets: input.secrets,
        userToken: userToken,
    };
}
