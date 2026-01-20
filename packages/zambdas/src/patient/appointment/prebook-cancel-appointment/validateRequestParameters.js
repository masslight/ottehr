"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _a = JSON.parse(input.body), language = _a.language, appointmentID = _a.appointmentID, cancellationReason = _a.cancellationReason, silent = _a.silent;
    var missingFields = [];
    if (appointmentID === undefined) {
        missingFields.push('appointmentID');
    }
    if (cancellationReason === undefined) {
        missingFields.push('cancellationReason');
    }
    if (missingFields.length > 0) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingFields);
    }
    var validReasons = utils_1.VALUE_SETS.cancelReasonOptions.map(function (option) { return option.value; });
    if (!validReasons.includes(cancellationReason)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("\"cancellationReason\" must be one of the following values: ".concat(JSON.stringify(validReasons)));
    }
    return {
        appointmentID: appointmentID,
        cancellationReason: cancellationReason,
        silent: silent,
        secrets: input.secrets,
        language: language,
    };
}
