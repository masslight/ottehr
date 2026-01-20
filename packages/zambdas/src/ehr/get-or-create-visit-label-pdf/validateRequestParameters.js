"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var encounterId = JSON.parse(input.body).encounterId;
    if (!encounterId)
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)([encounterId]);
    return {
        encounterId: encounterId,
        secrets: input.secrets,
    };
}
