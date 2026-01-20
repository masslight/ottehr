"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var parsedInput = JSON.parse(input.body);
    if (!parsedInput || typeof parsedInput !== 'object') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('Request body must be a valid JSON object');
    }
    var _a = parsedInput, insuranceIds = _a.insuranceIds, active = _a.active;
    var missingFields = [];
    if (insuranceIds === undefined) {
        missingFields.push('insuranceIds');
    }
    if (active === undefined) {
        missingFields.push('active');
    }
    if (missingFields.length > 0) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingFields);
    }
    if (!Array.isArray(insuranceIds)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('insuranceIds must be an array');
    }
    if (insuranceIds.length === 0) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('insuranceIds must contain at least one insurance ID');
    }
    if (!insuranceIds.every(function (id) { return typeof id === 'string'; })) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('All insuranceIds must be strings');
    }
    if (typeof active !== 'boolean') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('active must be a boolean');
    }
    if (!input.secrets) {
        throw new Error('No secrets provided in input');
    }
    return {
        insuranceIds: insuranceIds,
        active: active,
        secrets: input.secrets,
    };
}
