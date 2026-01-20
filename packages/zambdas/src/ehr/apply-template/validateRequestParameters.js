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
    var _a = parsedInput, examType = _a.examType, templateName = _a.templateName, encounterId = _a.encounterId;
    // Validate required parameters
    var missingFields = [];
    if (examType === undefined) {
        missingFields.push('examType');
    }
    if (templateName === undefined) {
        missingFields.push('templateName');
    }
    if (encounterId === undefined) {
        missingFields.push('encounterId');
    }
    if (missingFields.length > 0) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingFields);
    }
    // Validate examType is a valid ExamType enum value
    if (!Object.values(utils_1.ExamType).includes(examType)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("Invalid examType: ".concat(examType, ". Must be one of: ").concat(Object.values(utils_1.ExamType).join(', ')));
    }
    // Validate templateName is a string
    if (typeof templateName !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('templateName must be a string');
    }
    if (typeof encounterId !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('encounterId must be a string');
    }
    if (!input.secrets) {
        throw new Error('No secrets provided in input');
    }
    return {
        examType: examType,
        templateName: templateName,
        encounterId: encounterId,
        secrets: input.secrets,
    };
}
