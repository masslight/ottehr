"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var parsedInput = JSON.parse(input.body);
    // Type guard to check if parsedInput is an object
    if (!parsedInput || typeof parsedInput !== 'object') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('Request body must be a valid JSON object');
    }
    var examType = parsedInput.examType;
    // Validate required parameters
    var missingFields = [];
    if (examType === undefined) {
        missingFields.push('examType');
    }
    if (missingFields.length > 0) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingFields);
    }
    // Validate examType is a valid ExamType enum value
    if (!Object.values(utils_1.ExamType).includes(examType)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("Invalid examType: ".concat(examType, ". Must be one of: ").concat(Object.values(utils_1.ExamType).join(', ')));
    }
    if (!input.secrets) {
        throw new Error('No secrets provided in input');
    }
    return {
        examType: examType,
        secrets: input.secrets,
    };
}
