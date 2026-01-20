"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _a = JSON.parse(input.body), appointmentID = _a.appointmentID, language = _a.language, slot = _a.slot;
    var missingFields = [];
    if (appointmentID === undefined) {
        missingFields.push('appointmentID');
    }
    if (slot === undefined) {
        missingFields.push('slot');
    }
    if (missingFields.length > 0) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingFields);
    }
    if (!(0, utils_1.isISODateTime)(slot.start)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("\"slot.start\" must be in ISO date and time format (YYYY-MM-DDTHH:MM:SS)");
    }
    return {
        appointmentID: appointmentID,
        slot: slot,
        language: language,
        secrets: input.secrets,
    };
}
