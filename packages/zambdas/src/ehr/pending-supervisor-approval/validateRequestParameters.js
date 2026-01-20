"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var parsedJSON = JSON.parse(input.body);
    var _a = (0, shared_1.safeValidate)(utils_1.PendingSupervisorApprovalInputSchema, parsedJSON), encounterId = _a.encounterId, practitionerId = _a.practitionerId;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        encounterId: encounterId,
        practitionerId: practitionerId,
        secrets: input.secrets,
    };
}
