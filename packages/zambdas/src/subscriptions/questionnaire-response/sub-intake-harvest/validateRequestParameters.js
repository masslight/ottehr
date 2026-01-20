"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var questionnaireResponse = JSON.parse(input.body);
    if (questionnaireResponse.resourceType !== 'QuestionnaireResponse') {
        throw new Error("resource parsed should be a QuestionnaireResponse but was a ".concat(questionnaireResponse.resourceType));
    }
    return {
        qr: questionnaireResponse,
        secrets: input.secrets,
    };
}
