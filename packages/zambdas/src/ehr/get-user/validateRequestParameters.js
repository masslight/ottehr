"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var userId = JSON.parse(input.body).userId;
    if (userId === undefined
    // locations === undefined ||
    // locations.length === 0
    ) {
        throw new Error('These fields are required: "userId"');
    }
    return {
        userId: userId,
        secrets: input.secrets,
    };
}
